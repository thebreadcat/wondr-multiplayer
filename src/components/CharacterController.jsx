// CharacterController.jsx (refactored with stable animation, jump handling, clean updates)
import React, { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Vector3, Euler, MathUtils } from "three";
import { CapsuleCollider, RigidBody, useRapier } from "@react-three/rapier";
import { Character } from "./Character";
import { PlayerSkateboard } from "./Skateboard";
import { Html, useKeyboardControls } from "@react-three/drei";
import { useMultiplayer } from "./MultiplayerProvider";
import { useGameSystem } from "./GameSystemProvider";
import styles from "./RemotePlayer.module.css";
import TagPlayerIndicator from "../games/tag/TagPlayerIndicator";
import { handleGameCollision } from "../utils/handleGameCollision";
import { useCameraStore } from "./CameraToggleButton";
import { useVoiceChat } from "./VoiceChatProvider";

// Throttle function to limit how often a function gets called
const throttle = (callback, delay) => {
  let lastCall = 0;
  return (...args) => {
    const now = Date.now();
    if (now - lastCall >= delay) {
      lastCall = now;
      return callback(...args);
    }
  };
};

const WALK_SPEED = 2.5;
const RUN_SPEED = 5;
const ROTATION_SPEED = 0.1;
const VERTICAL_OFFSET = -0.18; // Character's vertical offset from the ground

// Camera configuration
const CAMERA_HEIGHT = 2.5; // Camera height above character
const CAMERA_DISTANCE = 6; // Camera distance behind character
const CAMERA_ROTATION_SPEED = 0.05; // Reduced rotation speed for smoother camera movement

// Add new camera control constants
const MIN_CAMERA_DISTANCE = 2; // Minimum zoom distance
const MAX_CAMERA_DISTANCE = 15; // Maximum zoom distance
const MIN_VERTICAL_ANGLE = -Math.PI / 12; // Minimum vertical angle (15 degrees down) - prevents looking below ground
const MAX_VERTICAL_ANGLE = Math.PI / 2.2; // Maximum vertical angle (82 degrees up) - increased for better upward view
const ZOOM_SPEED = 0.5; // Zoom sensitivity
const VERTICAL_ROTATION_SPEED = 0.003; // Vertical rotation sensitivity

// Dynamic zoom constants for preventing floor clipping
const BASE_CAMERA_DISTANCE = 6; // Base camera distance
const MIN_DYNAMIC_DISTANCE = 3; // Minimum distance when looking up
const ZOOM_FACTOR = 0.7; // How much to zoom in when looking up (0 = no zoom, 1 = full zoom)

const normalizeAngle = (angle) => {
  while (angle > Math.PI) angle -= 2 * Math.PI;
  while (angle < -Math.PI) angle += 2 * Math.PI;
  return angle;
};

const lerpAngle = (start, end, t) => {
  start = normalizeAngle(start);
  end = normalizeAngle(end);
  if (Math.abs(end - start) > Math.PI) {
    if (end > start) {
      start += 2 * Math.PI;
    } else {
      end += 2 * Math.PI;
    }
  }
  return normalizeAngle(start + (end - start) * t);
};

// Object Pool for reusing Vector3 objects to avoid garbage collection
const vector3Pool = [];
const getVector3FromPool = () => {
  if (vector3Pool.length > 0) {
    return vector3Pool.pop();
  }
  return new Vector3();
};

const releaseVector3ToPool = (vector) => {
  vector.set(0, 0, 0);
  vector3Pool.push(vector);
};

export function CharacterController({ initialPosition = [0, 0, 0], characterColor, setLocalPosition, showSkateboard = false }) {
  const rigidBody = useRef();
  const character = useRef();
  const container = useRef();
  const [, getKeys] = useKeyboardControls();
  const { sendMove, sendEmoji, emoji, myId, emojis } = useMultiplayer();
  const { activeGames } = useGameSystem();
  const { isVoiceChatEnabled, voiceActivity, connectionStatus } = useVoiceChat();
  
  // Define state variables first
  const [isOnGround, setIsOnGround] = useState(true); // Start as on ground
  const wasInAir = useRef(false);
  const [animationState, setAnimationState] = useState("idle");
  const jumpAnimationTimer = useRef(null);
  const lastGroundCheckTime = useRef(0);
  const groundCheckInterval = useRef(300); // Check every 300ms
  
  // Create throttled sendMove function to limit network traffic
  const throttledSendMove = useMemo(
    () => throttle((data) => {
      // Always ensure animation state is included in network updates
      const updatedData = {
        ...data,
        animation: data.animation || animationState
      };
      sendMove(updatedData);
    }, 50), // Limit to 20 updates per second
    [sendMove, animationState]
  );

  // Add initial position with offset
  const adjustedInitialPosition = [
    initialPosition[0],
    initialPosition[1] + VERTICAL_OFFSET,
    initialPosition[2]
  ];

  const cameraTarget = useRef();
  const cameraPosition = useRef();
  const firstPersonCameraPosition = useRef();
  const cameraWorldPosition = useRef(new Vector3());
  const cameraLookAtWorldPosition = useRef(new Vector3());
  const cameraLookAt = useRef(new Vector3());
  
  // Get camera mode from the global store
  const { isFirstPerson } = useCameraStore();
  
  // First-person mouse look state
  const [isPointerLocked, setIsPointerLocked] = useState(false);
  const mouseRotation = useRef({ x: 0, y: 0 });
  
  // Track previous camera mode to handle transitions
  const previousCameraMode = useRef(false);
  const cameraTransitionTime = useRef(0);
  
  // Get Three.js state for canvas access
  const { gl } = useThree();
  
  // Mobile controls state
  const mobileInputs = useRef({
    joystick: { x: 0, y: 0 },
    camera: { x: 0, y: 0 },
    jump: false,
    run: false
  });
  
  // Mouse controls for camera rotation in third-person mode
  const [isMouseDown, setIsMouseDown] = useState(false);
  const lastMousePosition = useRef({ x: 0, y: 0 });
  const mouseSensitivity = 0.005; // Adjust this value to control mouse sensitivity
  
  // Add new camera control state
  const cameraDistance = useRef(CAMERA_DISTANCE);
  const cameraVerticalAngle = useRef(0); // Vertical camera angle
  const lastTouchDistance = useRef(0); // For pinch-to-zoom on mobile
  
  // Replace mouse drag controls with pointer lock controls for third-person
  const [isThirdPersonPointerLocked, setIsThirdPersonPointerLocked] = useState(false);
  const thirdPersonMouseRotation = useRef({ x: 0, y: 0 });
  
  // Track current position for respawn with offset
  const currentPosition = useRef(adjustedInitialPosition);

  const characterRotationTarget = useRef(0);
  const rotationTarget = useRef(0);
  const lastPosition = useRef([0, 0, 0]);
  const wasJumpPressed = useRef(false);
  const jumpCooldown = useRef(0);
  const jumpInProgress = useRef(false);

  // Initialize animation on mount and handle cleanup
  useEffect(() => {
    // Ensure we start with the idle animation
    console.log('[CharacterController] Initializing with idle animation');
    setAnimationState('idle');
    
    // Initialize camera rotation to match character rotation
    rotationTarget.current = characterRotationTarget.current;
    
    // Send initial animation state to server
    sendMove({
      position: adjustedInitialPosition,
      rotation: 0,
      animation: 'idle',
      color: characterColor,
      showSkateboard: showSkateboard,
    });
    
    // Clean up timers on unmount
    return () => {
      if (jumpAnimationTimer.current) {
        clearTimeout(jumpAnimationTimer.current);
        jumpAnimationTimer.current = null;
      }
    };
  }, []);

  useEffect(() => {
    // Clean up all event listeners and resources when component unmounts
    return () => {
      // Clean up Three.js resources to prevent memory leaks
      if (cameraWorldPosition.current) cameraWorldPosition.current = null;
      if (cameraLookAtWorldPosition.current) cameraLookAtWorldPosition.current = null;
      if (cameraLookAt.current) cameraLookAt.current = null;
      
      // Release any other references
      if (rigidBody.current) {
        // Clear physics body references
        rigidBody.current = null;
      }
      
      // Clear accumulated data
      movementAccumulator.current = { x: 0, y: 0, z: 0, rotation: 0 };
      lastPosition.current = [0, 0, 0];
      
      // Clear any animation timers
      if (jumpAnimationTimer.current) {
        clearTimeout(jumpAnimationTimer.current);
        jumpAnimationTimer.current = null;
      }
    };
  }, []);

  // Performance optimization: limit frame calculations with RAF
  const lastUpdateTime = useRef(0);
  const movementAccumulator = useRef({ x: 0, y: 0, z: 0, rotation: 0 });
  
  useFrame((state, delta) => {
    // Cap delta to avoid large jumps if framerate drops temporarily
    const cappedDelta = Math.min(delta, 0.1);
    const keys = getKeys();
    if (!rigidBody.current) return;
    
    // Check if camera mode changed and start transition timer
    if (previousCameraMode.current !== isFirstPerson) {
      cameraTransitionTime.current = 1.0; // 1 second transition
      previousCameraMode.current = isFirstPerson;
    }
    
    // Update camera transition timer
    if (cameraTransitionTime.current > 0) {
      cameraTransitionTime.current = Math.max(0, cameraTransitionTime.current - cappedDelta);
    }
    
    // Manual ground detection as a backup
    const now = performance.now();
    if (now - lastGroundCheckTime.current > groundCheckInterval.current) {
      lastGroundCheckTime.current = now;
      
      // Use the character's position to check if we're on ground
      const position = rigidBody.current.translation();
      const velocity = rigidBody.current.linvel();
      
      // If we're not moving vertically (or very slowly) and not too high, we're probably on ground
      const isNotFalling = Math.abs(velocity.y) < 0.5;
      const isCloseToGround = position.y < 2; // Adjust based on your world scale
      
      if (isNotFalling && isCloseToGround && !isOnGround && animationState.includes('jump')) {
        console.log(`[CharacterController] Manual ground detection: Character appears to be on ground but isOnGround=${isOnGround}`);
        console.log(`[CharacterController] Position: ${position.y}, Velocity Y: ${velocity.y}, Animation: ${animationState}`);
        
        // Force ground state update
        setIsOnGround(true);
        wasInAir.current = false;
        
        // Reset animation to idle
        if (animationState.includes('jump')) {
          console.log(`[CharacterController] Manually resetting jump animation to idle`);
          setAnimationState('idle');
          
          // Force immediate network update
          sendMove({
            position: [position.x, position.y, position.z],
            rotation: characterRotationTarget.current,
            animation: 'idle',
            color: characterColor,
            showSkateboard: showSkateboard,
          });
        }
      }
    }
    
    // Check if we need to reset animation state
    // This handles cases where the character is moving but stuck in a non-movement animation
    if (!keys.jump) { // Check regardless of isOnGround status to be safe
      const velocity = rigidBody.current.linvel();
      const isMoving = Math.abs(velocity.x) > 0.1 || Math.abs(velocity.z) > 0.1;
      
      // Check if we're moving horizontally but in a non-movement animation
      if (isMoving && animationState !== 'walk' && animationState !== 'run') {
        // If we're in a jump animation but moving horizontally and not falling, we should be walking/running
        const isFalling = velocity.y < -0.5;
        
        if (!isFalling || isOnGround) {
          // Character is moving but not in walk/run animation, fix it
          const movementSpeed = Math.sqrt(velocity.x * velocity.x + velocity.z * velocity.z);
          const newAnimState = showSkateboard ? 'walk' : (movementSpeed > 4 ? 'run' : 'walk');
          
          console.log(`[CharacterController] Fixing animation: Character is moving but in ${animationState} animation, resetting to ${newAnimState}`);
          console.log(`[CharacterController] isOnGround=${isOnGround}, isFalling=${isFalling}, velocity.y=${velocity.y}`);
          
          // If we were in a jump animation, force ground state
          if (animationState.includes('jump')) {
            setIsOnGround(true);
            wasInAir.current = false;
          }
          
          setAnimationState(newAnimState);
          
          // Force immediate network update for animation change
          sendMove({
            position: [rigidBody.current.translation().x, rigidBody.current.translation().y, rigidBody.current.translation().z],
            rotation: characterRotationTarget.current,
            animation: newAnimState,
            color: characterColor,
            showSkateboard: showSkateboard,
          });
        }
      } else if (!isMoving && animationState !== 'idle' && 
                animationState !== 'wave' && !animationState.includes('jump')) {
        // Character is stopped but not in idle animation, fix it
        console.log(`[CharacterController] Fixing animation: Character is stopped but in ${animationState} animation, resetting to idle`);
        
        setAnimationState('idle');
        
        // Force immediate network update for animation change
        sendMove({
          position: [rigidBody.current.translation().x, rigidBody.current.translation().y, rigidBody.current.translation().z],
          rotation: characterRotationTarget.current,
          animation: 'idle',
          color: characterColor,
          showSkateboard: showSkateboard,
        });
      }
    }

    const velocity = rigidBody.current.linvel();
    const position = rigidBody.current.translation();
    
    // Skip calculations if the object is far from the camera (culling)
    const distanceToCamera = new Vector3(position.x, position.y, position.z)
      .distanceTo(state.camera.position);
    const isVisible = distanceToCamera < 100; // Adjust based on your game scale
    
    // Reduce physics calculations for distant objects
    if (!isVisible && distanceToCamera > 50) {
      // Only do essential updates for distant objects
      if (Date.now() - lastUpdateTime.current > 500) {
        lastUpdateTime.current = Date.now();
        // Minimal position update for very distant objects
        return;
      }
    }

    const movement = { x: 0, z: 0 };
    
    // Movement logic
    const moveForward = keys.forward;
    const moveBackward = keys.backward;
    const moveLeft = keys.left;
    const moveRight = keys.right;
    const keyboardIsRunning = keys.run;
    const keyboardIsJumping = keys.jump;

    // Combine keyboard and mobile inputs with deadzone for joystick
    const joystickDeadzone = 0.15; // Increased deadzone to prevent drift and reset movement
    const combinedMoveForward = keys.forward || mobileInputs.current.joystick.y > joystickDeadzone;
    const combinedMoveBackward = keys.backward || mobileInputs.current.joystick.y < -joystickDeadzone;
    const combinedMoveLeft = keys.left || mobileInputs.current.joystick.x < -joystickDeadzone;
    const combinedMoveRight = keys.right || mobileInputs.current.joystick.x > joystickDeadzone;
    const combinedIsRunning = keys.run || mobileInputs.current.run;
    const combinedIsJumping = keys.jump || mobileInputs.current.jump;

    // Calculate movement intensity for mobile joystick (only if above deadzone)
    const joystickIntensity = Math.sqrt(
      mobileInputs.current.joystick.x ** 2 + mobileInputs.current.joystick.y ** 2
    );
    const mobileSpeedMultiplier = joystickIntensity > joystickDeadzone ? Math.min(joystickIntensity, 1) : 0;

    // Check if we're using joystick for movement (affects character rotation) - with deadzone
    const isUsingJoystick = joystickIntensity > joystickDeadzone;
    
    // Check if we're using camera joystick for camera control
    const cameraJoystickDeadzone = 0.15; // Same deadzone for camera joystick
    const isUsingCameraJoystick = Math.sqrt(
      mobileInputs.current.camera.x ** 2 + mobileInputs.current.camera.y ** 2
    ) > cameraJoystickDeadzone;

    // Determine if any movement key is pressed
    const isMoving = combinedMoveForward || combinedMoveBackward || combinedMoveLeft || combinedMoveRight;

    // Calculate speed based on running state and mobile input intensity
    let currentSpeed = combinedIsRunning ? RUN_SPEED : WALK_SPEED;
    if (joystickIntensity > 0) {
      currentSpeed *= mobileSpeedMultiplier;
    }

    // Handle movement differently based on camera mode
    if (isFirstPerson) {
      if (isPointerLocked) {
        // When pointer is locked, movement is relative to where the camera is looking
        const forwardVector = new Vector3(0, 0, 1);
        const rightVector = new Vector3(1, 0, 0);
        
        // Apply the camera's horizontal rotation to the movement vectors
        forwardVector.applyAxisAngle(new Vector3(0, 1, 0), mouseRotation.current.y);
        rightVector.applyAxisAngle(new Vector3(0, 1, 0), mouseRotation.current.y);

        // Calculate movement based on rotated vectors
        if (combinedMoveForward) {
          movement.x += forwardVector.x;
          movement.z += forwardVector.z;
        }
        if (combinedMoveBackward) {
          movement.x -= forwardVector.x;
          movement.z -= forwardVector.z;
        }
        if (combinedMoveLeft) {
          movement.x -= rightVector.x;
          movement.z -= rightVector.z;
        }
        if (combinedMoveRight) {
          movement.x += rightVector.x;
          movement.z += rightVector.z;
        }
        
        // Normalize movement vector if moving diagonally
        const length = Math.sqrt(movement.x * movement.x + movement.z * movement.z);
        if (length > 0) {
          movement.x /= length;
          movement.z /= length;
        }
      } else {
        // Standard first-person movement when not pointer locked
        if (combinedMoveForward) movement.z = 1;
        if (combinedMoveBackward) movement.z = -1;
        if (combinedMoveLeft) movement.x = 1;
        if (combinedMoveRight) movement.x = -1;
      }
    } else {
      // Third-person movement with camera-relative strafing
      // Calculate camera-relative movement directions
      const cameraRotation = rotationTarget.current;
      
      if (combinedMoveForward || combinedMoveBackward || combinedMoveLeft || combinedMoveRight) {
        // Reset movement vector
        movement.x = 0;
        movement.z = 0;

        // Forward/backward movement relative to camera
        if (combinedMoveForward) {
          movement.x += Math.sin(cameraRotation);
          movement.z += Math.cos(cameraRotation);
        }
        if (combinedMoveBackward) {
          movement.x -= Math.sin(cameraRotation);
          movement.z -= Math.cos(cameraRotation);
        }
        
        // Left/right strafing relative to camera (perpendicular to camera direction)
        if (combinedMoveLeft) {
          movement.x += Math.cos(cameraRotation);
          movement.z -= Math.sin(cameraRotation);
        }
        if (combinedMoveRight) {
          movement.x -= Math.cos(cameraRotation);
          movement.z += Math.sin(cameraRotation);
        }
        
        // Normalize movement vector for diagonal movement
        const length = Math.sqrt(movement.x * movement.x + movement.z * movement.z);
        if (length > 0) {
          movement.x /= length;
          movement.z /= length;
        }
      }
    }

    // Character rotation based on movement direction
    if (isUsingJoystick) {
      // For mobile joystick: rotate character to face movement direction
      if (isMoving) {
        // Calculate the angle based on joystick input
        // Negate x to swap left/right directions for mobile
        const joystickAngle = Math.atan2(-mobileInputs.current.joystick.x, mobileInputs.current.joystick.y);
        
        // Apply camera rotation offset to make movement relative to camera
        characterRotationTarget.current = joystickAngle + rotationTarget.current;
      }
      // If not moving with joystick, keep current character rotation
    } else {
      // Desktop keyboard controls: use absolute world directions (not camera-relative)
      if (combinedMoveForward && !combinedMoveBackward && !combinedMoveLeft && !combinedMoveRight) {
        // Moving forward (W key) - face North (0 degrees)
        characterRotationTarget.current = 0;
      } else if (combinedMoveBackward && !combinedMoveForward && !combinedMoveLeft && !combinedMoveRight) {
        // Moving backward (S key) - face South (180 degrees)
        characterRotationTarget.current = Math.PI;
      } else if (combinedMoveLeft && !combinedMoveRight && !combinedMoveForward && !combinedMoveBackward) {
        // Moving left (A key) - face East (90 degrees) - swapped from West
        characterRotationTarget.current = Math.PI * 0.5;
      } else if (combinedMoveRight && !combinedMoveLeft && !combinedMoveForward && !combinedMoveBackward) {
        // Moving right (D key) - face West (270 degrees) - swapped from East
        characterRotationTarget.current = Math.PI * 1.5;
      } else if (combinedMoveForward && combinedMoveLeft && !combinedMoveBackward && !combinedMoveRight) {
        // Moving forward-left (W+A) - face Northeast (45 degrees) - swapped from Northwest
        characterRotationTarget.current = Math.PI * 0.25;
      } else if (combinedMoveForward && combinedMoveRight && !combinedMoveBackward && !combinedMoveLeft) {
        // Moving forward-right (W+D) - face Northwest (315 degrees) - swapped from Northeast
        characterRotationTarget.current = Math.PI * 1.75;
      } else if (combinedMoveBackward && combinedMoveLeft && !combinedMoveForward && !combinedMoveRight) {
        // Moving backward-left (S+A) - face Southeast (135 degrees) - swapped from Southwest
        characterRotationTarget.current = Math.PI * 0.75;
      } else if (combinedMoveBackward && combinedMoveRight && !combinedMoveForward && !combinedMoveLeft) {
        // Moving backward-right (S+D) - face Southwest (225 degrees) - swapped from Southeast
        characterRotationTarget.current = Math.PI * 1.25;
      }
    }

    if (isMoving) {
      velocity.x = movement.x * currentSpeed;
      velocity.z = movement.z * currentSpeed;
      
      // Set animation state based on skateboard status
      if (isOnGround) {
        const newAnimState = showSkateboard ? "walk" : (currentSpeed === RUN_SPEED ? "run" : "walk");
        if (animationState !== newAnimState) {
          console.log(`[CharacterController] Setting animation to ${newAnimState} from ${animationState}`);
          setAnimationState(newAnimState);
          
          // Force immediate network update for animation change
          sendMove({
            position: [rigidBody.current.translation().x, rigidBody.current.translation().y, rigidBody.current.translation().z],
            rotation: characterRotationTarget.current,
            animation: newAnimState,
            color: characterColor,
            showSkateboard: showSkateboard,
          });
        }
      }
    } else {
      // Apply friction to slow down when no movement input
      velocity.x *= 0.8;
      velocity.z *= 0.8;
      
      // Check if we're actually moving (not just from momentum) before setting idle
      const isMoving = Math.abs(velocity.x) > 0.1 || Math.abs(velocity.z) > 0.1;
      
      if (isOnGround && !isMoving) {
        // Set to idle if we're truly stopped
        if (animationState !== "idle") {
          console.log(`[CharacterController] Setting animation to idle from ${animationState}`);
          setAnimationState("idle");
          
          // Force immediate network update for animation change
          sendMove({
            position: [rigidBody.current.translation().x, rigidBody.current.translation().y, rigidBody.current.translation().z],
            rotation: characterRotationTarget.current,
            animation: "idle",
            color: characterColor,
            showSkateboard: showSkateboard,
          });
        }
      } else if (isOnGround && isMoving) {
        // We're still moving from momentum, keep the walk animation
        const movementSpeed = Math.sqrt(velocity.x * velocity.x + velocity.z * velocity.z);
        const newAnimState = showSkateboard ? "walk" : (movementSpeed > 4 ? "run" : "walk");
        
        if (animationState !== newAnimState) {
          console.log(`[CharacterController] Setting animation to ${newAnimState} from ${animationState}`);
          setAnimationState(newAnimState);
          
          // Force immediate network update for animation change
          sendMove({
            position: [rigidBody.current.translation().x, rigidBody.current.translation().y, rigidBody.current.translation().z],
            rotation: characterRotationTarget.current,
            animation: newAnimState,
            color: characterColor,
            showSkateboard: showSkateboard,
          });
        }
      }
    }

    // Memoize physics calculations to avoid recalculation every frame
    // These values are constants that don't need to be recalculated every frame
    const jumpVelocity = 2.8; // Pre-calculated value of Math.sqrt(2 * 9.8 * 0.4)
    const totalJumpTime = 0.57; // Pre-calculated value of (2 * jumpVelocity) / 9.8

    // Update jump cooldown timer
    if (jumpCooldown.current > 0) {
      jumpCooldown.current -= cappedDelta; // Use capped delta time for consistent physics
    }

    // Handle jump with cooldown instead of ground check
    if (combinedIsJumping && !wasJumpPressed.current && jumpCooldown.current <= 0) {
      velocity.y = jumpVelocity;
      jumpCooldown.current = totalJumpTime;
      jumpInProgress.current = true;
      
      // Clear any existing jump animation timers
      if (jumpAnimationTimer.current) {
        clearTimeout(jumpAnimationTimer.current);
        jumpAnimationTimer.current = null;
      }
      
      // Set jump animation immediately
      setAnimationState("jump_up");
      
      // Force immediate network update for animation change
      sendMove({
        position: [rigidBody.current.translation().x, rigidBody.current.translation().y, rigidBody.current.translation().z],
        rotation: characterRotationTarget.current,
        animation: "jump_up",
        color: characterColor,
        showSkateboard: showSkateboard,
      });
      
      console.log('[CharacterController] Starting jump animation');
      
      // Still track ground state for animation purposes
      if (isOnGround) {
        setIsOnGround(false);
        wasInAir.current = true; // Set wasInAir flag when jumping
      }
      
      // Safety timer to reset animation if we get stuck
      jumpAnimationTimer.current = setTimeout(() => {
        if (animationState === "jump_up") {
          console.log('[CharacterController] Safety timer resetting jump animation');
          setAnimationState("idle");
          sendMove({
            position: [rigidBody.current.translation().x, rigidBody.current.translation().y, rigidBody.current.translation().z],
            rotation: characterRotationTarget.current,
            animation: "idle",
            color: characterColor,
            showSkateboard: showSkateboard,
          });
        }
        jumpAnimationTimer.current = null;
      }, 1500); // 1.5 second safety timer
    }
    wasJumpPressed.current = combinedIsJumping;

    rigidBody.current.setLinvel(velocity, true);

    if (character.current) {
      character.current.rotation.y = lerpAngle(
        character.current.rotation.y,
        characterRotationTarget.current,
        0.1
      );
    }

    const currentPos = [
      position.x, 
      position.y, 
      position.z
    ];
    // Accumulate movement for throttled updates
    const hasMoved = currentPos.some((v, i) => Math.abs(v - lastPosition.current[i]) > 0.01);
    const hasRotated = Math.abs(characterRotationTarget.current - movementAccumulator.current.rotation) > 0.05;

    if (hasMoved || hasRotated) {
      lastPosition.current = currentPos;
      movementAccumulator.current = {
        x: currentPos[0],
        y: currentPos[1],
        z: currentPos[2],
        rotation: characterRotationTarget.current
      };
      
      // Use throttled network updates
      throttledSendMove({
        position: currentPos,
        rotation: characterRotationTarget.current,
        animation: animationState,
        color: characterColor,
        showSkateboard: showSkateboard,
      });
      
      // Log skateboard state transmission occasionally
      if (Math.random() < 0.01) { // 1% chance to log
        console.log(`[CharacterController] Sending skateboard state: ${showSkateboard}`);
      }
    }

    // Calculate movement speed for camera adjustments
    const movementSpeed = Math.sqrt(velocity.x * velocity.x + velocity.z * velocity.z);
    const isWalking = movementSpeed > 0.1 && movementSpeed < 4;
    const isRunning = movementSpeed >= 4;
    
    // Use a consistent camera speed regardless of movement
    // This ensures character stays at consistent distance from bottom of screen
    const cameraSpeed = 0.1; // Fixed camera speed for all movement types

    // Apply camera joystick input for mobile camera controls
    const cameraJoystickIntensity = Math.sqrt(
      mobileInputs.current.camera.x ** 2 + mobileInputs.current.camera.y ** 2
    );
    
    if (cameraJoystickIntensity > cameraJoystickDeadzone && !isFirstPerson) {
      // Apply camera joystick input to camera rotation
      const cameraRotationSpeed = 0.03; // Adjust sensitivity
      
      // Horizontal rotation (left/right)
      rotationTarget.current -= mobileInputs.current.camera.x * cameraRotationSpeed;
      
      // Vertical rotation (up/down) - inverted for natural feel
      cameraVerticalAngle.current += mobileInputs.current.camera.y * cameraRotationSpeed;
      
      // Clamp vertical rotation
      const maxUpAngle = Math.PI / 2.2; // ~82 degrees up
      const maxDownAngle = -Math.PI / 12; // ~15 degrees down
      cameraVerticalAngle.current = Math.max(maxDownAngle, Math.min(maxUpAngle, cameraVerticalAngle.current));
      
      // Dynamic zoom based on vertical angle
      const normalizedVerticalAngle = (cameraVerticalAngle.current - maxDownAngle) / (maxUpAngle - maxDownAngle);
      const minDistance = 3;
      const maxDistance = 8;
      cameraDistance.current = minDistance + (maxDistance - minDistance) * (1 - normalizedVerticalAngle);
    }

    // Update container rotation (camera orbit point) with delta time for smooth motion
    if (container.current) {
      // Use a slower rotation speed for smoother camera movement
      const rotationLerpFactor = CAMERA_ROTATION_SPEED * (60 * cappedDelta); // Normalize by target framerate
      
      // Check if we've ever used mobile camera controls
      const hasUsedMobileCamera = Math.abs(rotationTarget.current - characterRotationTarget.current) > 0.1;
      
      // Only sync camera rotation with character rotation when using keyboard controls
      // AND we haven't used mobile camera controls to set an independent camera position
      if (!isUsingJoystick && !isUsingCameraJoystick && !hasUsedMobileCamera) {
        // Keyboard controls: camera follows character rotation
        container.current.rotation.y = MathUtils.lerp(
          container.current.rotation.y,
          characterRotationTarget.current,
          rotationLerpFactor
        );
        // Keep rotationTarget in sync with character when following
        rotationTarget.current = characterRotationTarget.current;
      } else {
        // Joystick controls or independent camera: use rotationTarget for camera
        container.current.rotation.y = MathUtils.lerp(
          container.current.rotation.y,
          rotationTarget.current,
          rotationLerpFactor
        );
      }
    }

    // Update camera position using refs with delta-time interpolation
    if (cameraTarget.current) {
      // Get target world position (where we're looking at)
      cameraTarget.current.getWorldPosition(cameraLookAtWorldPosition.current);
      
      // Always use smooth interpolation for camera transitions
      // Use slower interpolation when transitioning between views
      const positionLerpFactor = cameraSpeed * (60 * cappedDelta); // Normalize by target framerate
      
      if (isFirstPerson) {
        // First person camera - position camera at character's head
        if (firstPersonCameraPosition.current) {
          firstPersonCameraPosition.current.getWorldPosition(cameraWorldPosition.current);
          
          // Smoothly move camera to first person position
          state.camera.position.lerp(cameraWorldPosition.current, positionLerpFactor * 0.5);
          
          // Use pointer lock rotation for camera direction if locked
          if (isPointerLocked) {
            // Create a base look direction vector
            const lookDirection = new Vector3(0, 0, 1);
            
            // Apply vertical rotation (up/down) from mouse
            lookDirection.applyAxisAngle(new Vector3(1, 0, 0), mouseRotation.current.x);
            
            // Apply horizontal rotation (left/right) from mouse
            lookDirection.applyAxisAngle(new Vector3(0, 1, 0), mouseRotation.current.y);
            
            // Set the camera look target
            cameraLookAt.current.copy(state.camera.position).add(lookDirection);
            state.camera.lookAt(cameraLookAt.current);
            
            // Update character rotation to match camera horizontal rotation
            // This makes the character face the same direction as the camera
            const characterRotation = new Euler(0, mouseRotation.current.y, 0);
            container.current.setRotationFromEuler(characterRotation);
          } else {
            // Default: look in the direction the character is facing
            const lookDirection = new Vector3(0, 0, 1).applyQuaternion(container.current.quaternion);
            cameraLookAt.current.copy(state.camera.position).add(lookDirection);
            state.camera.lookAt(cameraLookAt.current);
          }
        }
      } else {
        // Third person camera - fixed distance behavior
        if (cameraPosition.current) {
          // Get the current character position
          const characterPos = new Vector3(position.x, position.y, position.z);
          
          // Calculate dynamic camera distance based on vertical angle to prevent floor clipping
          const normalizedVerticalAngle = (cameraVerticalAngle.current - MIN_VERTICAL_ANGLE) / (MAX_VERTICAL_ANGLE - MIN_VERTICAL_ANGLE);
          const clampedAngle = Math.max(0, Math.min(1, normalizedVerticalAngle));
          
          // When looking up (higher angle), zoom in to prevent clipping
          // When looking down (lower angle), use normal distance
          const dynamicZoomFactor = clampedAngle * ZOOM_FACTOR;
          const dynamicDistance = cameraDistance.current - (cameraDistance.current - MIN_DYNAMIC_DISTANCE) * dynamicZoomFactor;
          
          // Calculate camera position based on dynamic distance and vertical angle
          const cameraOffset = new Vector3();
          
          // Calculate horizontal distance based on vertical angle and dynamic zoom
          const horizontalDistance = dynamicDistance * Math.cos(cameraVerticalAngle.current);
          const verticalOffset = dynamicDistance * Math.sin(cameraVerticalAngle.current);
          
          // Calculate camera position behind character based on rotation and vertical angle
          cameraOffset.x = -Math.sin(rotationTarget.current) * horizontalDistance;
          cameraOffset.z = -Math.cos(rotationTarget.current) * horizontalDistance;
          
          // Set height based on vertical angle and base camera height
          cameraOffset.y = CAMERA_HEIGHT + verticalOffset;
          
          // Set the camera position target
          cameraWorldPosition.current.copy(characterPos).add(cameraOffset);
          
          // Smoothly move camera with delta-time interpolation
          // Use a consistent lerp factor regardless of movement speed
          const fixedLerpFactor = 0.1 * (60 * cappedDelta);
          state.camera.position.lerp(cameraWorldPosition.current, fixedLerpFactor);
          
          // Look at a point slightly above the character for better framing
          const lookTarget = new Vector3(characterPos.x, characterPos.y + 1.0, characterPos.z);
          cameraLookAt.current.lerp(lookTarget, fixedLerpFactor);
          state.camera.lookAt(cameraLookAt.current);
          
          // Debug camera position (reduced frequency)
          if (Math.random() < 0.002) {
            console.log(`[CharacterController] Camera distance: ${cameraDistance.current.toFixed(2)}, Dynamic distance: ${dynamicDistance.toFixed(2)}, Vertical angle: ${(cameraVerticalAngle.current * 180 / Math.PI).toFixed(1)}°`);
            console.log(`[CharacterController] Camera position: ${state.camera.position.x.toFixed(2)}, ${state.camera.position.y.toFixed(2)}, ${state.camera.position.z.toFixed(2)}`);
          }
        }
      }
    }

    // Get current position
    const worldPosition = position;
    currentPosition.current = [worldPosition.x, worldPosition.y, worldPosition.z];
    
    // Check if fallen too far
    if (worldPosition.y < -25) {
      // Check if player is in an active tag game
      const tagRoomId = Object.keys(activeGames || {}).find(
        key => activeGames[key]?.gameType === 'tag' && activeGames[key]?.state === 'playing'
      );
      
      // Check if player is in the game but not currently 'it'
      const isInTagGame = tagRoomId && activeGames[tagRoomId]?.players?.includes(myId);
      const isCurrentlyIt = tagRoomId && activeGames[tagRoomId]?.taggedPlayer === myId;
      
      // If player is in a tag game but not 'it', make them 'it' when they jump off
      if (isInTagGame && !isCurrentlyIt) {
        console.log(`[CharacterController] Player ${myId} jumped off map during Tag game - making them IT`);
        if (window.gameSocket) {
          window.gameSocket.emit('penaltyTag', {
            gameType: 'tag',
            roomId: tagRoomId,
            playerId: myId,
            reason: 'jumped_off_map'
          });
        }
      }
      
      // Respawn at initial position with offset
      rigidBody.current.setTranslation({ 
        x: adjustedInitialPosition[0], 
        y: adjustedInitialPosition[1], 
        z: adjustedInitialPosition[2] 
      });
      rigidBody.current.setLinvel({ x: 0, y: 0, z: 0 });
      rigidBody.current.setAngvel({ x: 0, y: 0, z: 0 });
      
      sendMove({
        position: adjustedInitialPosition,
        animation: 'idle',
        rotation: characterRotationTarget.current,
        showSkateboard: showSkateboard,
      });
      
      setLocalPosition(adjustedInitialPosition);
      return;
    }
  });

  // Fixed timestep for physics to decouple logic from framerate
  const fixedTimeStep = useRef(1/60); // Target 60 updates per second
  const accumulatedTime = useRef(0);
  const lastPhysicsTime = useRef(0);

  // Update physics at fixed timestep
  useEffect(() => {
    const physicsLoop = setInterval(() => {
      if (rigidBody.current) {
        const now = performance.now();
        const deltaTime = lastPhysicsTime.current ? (now - lastPhysicsTime.current) / 1000 : fixedTimeStep.current;
        lastPhysicsTime.current = now;
        
        // Update physics at a fixed rate regardless of frame rate
        accumulatedTime.current += deltaTime;
        
        // Process all accumulated time in fixed steps
        while (accumulatedTime.current >= fixedTimeStep.current) {
          // Optional: Add fixed timestep physics updates here if needed
          accumulatedTime.current -= fixedTimeStep.current;
        }
      }
    }, 1000 / 60); // 60hz physics update
    
    return () => clearInterval(physicsLoop);
  }, []);

  // Set up mobile controls interface
  useEffect(() => {
    // Create global mobile controls interface
    window.mobileControls = {
      handleJoystickMove: (input) => {
        mobileInputs.current.joystick = input;
      },
      handleCameraMove: (input) => {
        mobileInputs.current.camera = input;
      },
      handleJump: (pressed) => {
        mobileInputs.current.jump = pressed;
      },
      handleRunToggle: () => {
        mobileInputs.current.run = !mobileInputs.current.run;
      }
    };
    
    return () => {
      // Clean up global reference
      if (window.mobileControls) {
        delete window.mobileControls;
      }
    };
  }, []);

  // Mouse and touch event handlers for camera rotation in third-person mode
  const handlePointerDown = useCallback((event) => {
    if (isFirstPerson) return; // Don't interfere with first-person mode
    
    // Get touch/mouse coordinates
    const clientX = event.touches ? event.touches[0].clientX : event.clientX;
    const clientY = event.touches ? event.touches[0].clientY : event.clientY;
    
    // Get canvas dimensions for calculating relative positions
    const canvas = gl.domElement;
    const rect = canvas.getBoundingClientRect();
    const relativeX = clientX - rect.left;
    const relativeY = clientY - rect.top;
    
    // Define exclusion zones (areas where camera controls should not work)
    const joystickZone = {
      left: 0,
      top: rect.height - 180, // Bottom 180px
      right: 180, // Left 180px
      bottom: rect.height
    };
    
    const buttonZone = {
      left: rect.width - 100, // 60px button + 40px margin = 100px from right edge
      top: rect.height - 100, // 60px button + 40px margin = 100px from bottom edge
      right: rect.width,
      bottom: rect.height
    };
    
    const cameraJoystickZone = {
      left: rect.width - 300, // Larger camera joystick area (100px + positioning)
      top: rect.height - 100,
      right: rect.width - 200,
      bottom: rect.height
    };
    
    // Check if touch is in excluded zones
    const isInJoystickZone = (
      relativeX >= joystickZone.left && 
      relativeX <= joystickZone.right && 
      relativeY >= joystickZone.top && 
      relativeY <= joystickZone.bottom
    );
    
    const isInButtonZone = (
      relativeX >= buttonZone.left && 
      relativeX <= buttonZone.right && 
      relativeY >= buttonZone.top && 
      relativeY <= buttonZone.bottom
    );
    
    const isInCameraJoystickZone = (
      relativeX >= cameraJoystickZone.left && 
      relativeX <= cameraJoystickZone.right && 
      relativeY >= cameraJoystickZone.top && 
      relativeY <= cameraJoystickZone.bottom
    );
    
    // Only allow camera controls in the open area (not in joystick or button zones)
    if (isInJoystickZone || isInButtonZone || isInCameraJoystickZone) {
      return; // Don't start camera rotation
    }
    
    // Prevent default to avoid text selection or other browser behaviors
    event.preventDefault();
    
    setIsMouseDown(true);
    lastMousePosition.current = { x: clientX, y: clientY };
  }, [isFirstPerson, gl]);

  const handlePointerMove = useCallback((event) => {
    if (!isMouseDown || isFirstPerson) return; // Don't interfere with first-person mode
    
    event.preventDefault();
    
    const clientX = event.touches ? event.touches[0].clientX : event.clientX;
    const clientY = event.touches ? event.touches[0].clientY : event.clientY;
    
    const deltaX = clientX - lastMousePosition.current.x;
    const deltaY = clientY - lastMousePosition.current.y;

    // Update camera rotation using separate camera rotation
    rotationTarget.current -= deltaX * mouseSensitivity;
    cameraVerticalAngle.current += deltaY * mouseSensitivity;

    // Clamp vertical rotation with increased range and dynamic zoom
    const maxUpAngle = Math.PI / 2.2; // ~82 degrees up
    const maxDownAngle = -Math.PI / 12; // ~15 degrees down
    cameraVerticalAngle.current = Math.max(maxDownAngle, Math.min(maxUpAngle, cameraVerticalAngle.current));

    // Dynamic zoom based on vertical angle
    const normalizedVerticalAngle = (cameraVerticalAngle.current - maxDownAngle) / (maxUpAngle - maxDownAngle);
    const minDistance = 3;
    const maxDistance = 8;
    cameraDistance.current = minDistance + (maxDistance - minDistance) * (1 - normalizedVerticalAngle);

    lastMousePosition.current = { x: clientX, y: clientY };
  }, [isMouseDown, isFirstPerson, mouseSensitivity]);

  const handlePointerUp = useCallback((event) => {
    if (isFirstPerson) return; // Don't interfere with first-person mode
    
    event.preventDefault();
    setIsMouseDown(false);
  }, [isFirstPerson]);

  // Set up mouse and touch event listeners
  useEffect(() => {
    if (isFirstPerson) return;

    const canvas = gl.domElement;
    
    // Mouse events
    canvas.addEventListener('mousedown', handlePointerDown);
    canvas.addEventListener('mousemove', handlePointerMove);
    canvas.addEventListener('mouseup', handlePointerUp);
    
    // Touch events for mobile
    canvas.addEventListener('touchstart', handlePointerDown, { passive: false });
    canvas.addEventListener('touchmove', handlePointerMove, { passive: false });
    canvas.addEventListener('touchend', handlePointerUp, { passive: false });

    // Keep pinch-to-zoom for mobile
    const handleTouchStart = (event) => {
      if (event.touches.length === 2) {
        // Get canvas dimensions for calculating relative positions
        const canvas = gl.domElement;
        const rect = canvas.getBoundingClientRect();
        
        // Check if both touches are in the camera control area (not in joystick or button zones)
        let allTouchesInCameraArea = true;
        
        for (let i = 0; i < event.touches.length; i++) {
          const touch = event.touches[i];
          const relativeX = touch.clientX - rect.left;
          const relativeY = touch.clientY - rect.top;
          
          // Define exclusion zones
          const joystickZone = {
            left: 0,
            top: rect.height - 180,
            right: 180,
            bottom: rect.height
          };
          
          const buttonZone = {
            left: rect.width - 100,
            top: rect.height - 100,
            right: rect.width,
            bottom: rect.height
          };
          
          const cameraJoystickZone = {
            left: rect.width - 300,
            top: rect.height - 100,
            right: rect.width - 200,
            bottom: rect.height
          };
          
          const isInJoystickZone = (
            relativeX >= joystickZone.left && 
            relativeX <= joystickZone.right && 
            relativeY >= joystickZone.top && 
            relativeY <= joystickZone.bottom
          );
          
          const isInButtonZone = (
            relativeX >= buttonZone.left && 
            relativeX <= buttonZone.right && 
            relativeY >= buttonZone.top && 
            relativeY <= buttonZone.bottom
          );
          
          const isInCameraJoystickZone = (
            relativeX >= cameraJoystickZone.left && 
            relativeX <= cameraJoystickZone.right && 
            relativeY >= cameraJoystickZone.top && 
            relativeY <= cameraJoystickZone.bottom
          );
          
          if (isInJoystickZone || isInButtonZone || isInCameraJoystickZone) {
            allTouchesInCameraArea = false;
            break;
          }
        }
        
        // Only start pinch-to-zoom if both touches are in the camera area
        if (!allTouchesInCameraArea) {
          return;
        }
        
        const touch1 = event.touches[0];
        const touch2 = event.touches[1];
        const distance = Math.sqrt(
          Math.pow(touch2.clientX - touch1.clientX, 2) + 
          Math.pow(touch2.clientY - touch1.clientY, 2)
        );
        lastTouchDistance.current = distance;
      }
    };
    
    const handleTouchMove = (event) => {
      if (event.touches.length === 2 && lastTouchDistance.current > 0) {
        event.preventDefault();
        const touch1 = event.touches[0];
        const touch2 = event.touches[1];
        const distance = Math.sqrt(
          Math.pow(touch2.clientX - touch1.clientX, 2) + 
          Math.pow(touch2.clientY - touch1.clientY, 2)
        );
        
        const zoomDelta = (lastTouchDistance.current - distance) * 0.01 * ZOOM_SPEED;
        cameraDistance.current = Math.max(
          MIN_CAMERA_DISTANCE,
          Math.min(MAX_CAMERA_DISTANCE, cameraDistance.current + zoomDelta)
        );
        
        lastTouchDistance.current = distance;
      }
    };
    
    const handleTouchEnd = () => {
      lastTouchDistance.current = 0;
    };
    
    // Mouse wheel zoom
    const handleWheel = (event) => {
      event.preventDefault();
      const zoomDelta = event.deltaY * 0.001 * ZOOM_SPEED;
      cameraDistance.current = Math.max(
        MIN_CAMERA_DISTANCE,
        Math.min(MAX_CAMERA_DISTANCE, cameraDistance.current + zoomDelta)
      );
    };

    // Add additional event listeners for zoom
    canvas.addEventListener('wheel', handleWheel, { passive: false });
    canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
    canvas.addEventListener('touchmove', handleTouchMove, { passive: false });
    canvas.addEventListener('touchend', handleTouchEnd);

    return () => {
      canvas.removeEventListener('mousedown', handlePointerDown);
      canvas.removeEventListener('mousemove', handlePointerMove);
      canvas.removeEventListener('mouseup', handlePointerUp);
      canvas.removeEventListener('touchstart', handlePointerDown);
      canvas.removeEventListener('touchmove', handlePointerMove);
      canvas.removeEventListener('touchend', handlePointerUp);
      canvas.removeEventListener('wheel', handleWheel);
      canvas.removeEventListener('touchstart', handleTouchStart);
      canvas.removeEventListener('touchmove', handleTouchMove);
      canvas.removeEventListener('touchend', handleTouchEnd);
    };
  }, [isFirstPerson, handlePointerDown, handlePointerMove, handlePointerUp, gl]);

  // Pointer lock controls for first-person mode
  useEffect(() => {
    if (!isFirstPerson) return;
    
    const canvas = gl.domElement;
    
    const handlePointerLockChange = () => {
      setIsPointerLocked(document.pointerLockElement === canvas);
    };
    
    const handleMouseMove = (event) => {
      if (document.pointerLockElement === canvas) {
        // Apply a sensitivity factor to control rotation speed
        const sensitivity = 0.002;
        mouseRotation.current.y -= event.movementX * sensitivity;
        mouseRotation.current.x += event.movementY * sensitivity; // Inverted: mouse up = look down, mouse down = look up
        
        // Clamp vertical rotation to prevent camera flipping and looking below ground
        mouseRotation.current.x = Math.max(-Math.PI / 12, Math.min(Math.PI / 2.2, mouseRotation.current.x));
      }
    };
    
    const handleClick = (event) => {
      if (isFirstPerson && document.pointerLockElement !== canvas) {
        event.preventDefault();
        event.stopPropagation();
        console.log('[CharacterController] Requesting pointer lock for first-person mode');
        canvas.requestPointerLock().then(() => {
          console.log('[CharacterController] Pointer lock request successful');
        }).catch((error) => {
          console.error('[CharacterController] Pointer lock request failed:', error);
        });
      }
    };
    
    const handleKeyDown = (event) => {
      // ESC key to release pointer lock
      if (event.key === 'Escape' && document.pointerLockElement === canvas) {
        document.exitPointerLock();
      }
    };
    
    // Add event listeners
    canvas.addEventListener('click', handleClick);
    document.addEventListener('pointerlockchange', handlePointerLockChange);
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('keydown', handleKeyDown);
    
    // Cleanup function
    return () => {
      canvas.removeEventListener('click', handleClick);
      document.removeEventListener('pointerlockchange', handlePointerLockChange);
      canvas.removeEventListener('mousemove', handleMouseMove);
      canvas.removeEventListener('keydown', handleKeyDown);
      
      // Exit pointer lock when component unmounts or first-person mode is disabled
      if (document.pointerLockElement === canvas) {
        document.exitPointerLock();
      }
    };
  }, [isFirstPerson, gl]);

  return (
    <RigidBody
      ref={rigidBody}
      colliders={false}
      mass={1}
      type="dynamic"
      position={adjustedInitialPosition}
      enabledRotations={[false, false, false]}
      linearDamping={0.95} // Add damping for smoother physics
      angularDamping={0.95}
      name="player" // Add name property for join zone detection
      userData={{ type: 'player', id: myId }} // Add userData for jump pad detection
      onCollisionEnter={({ other }) => {
        const otherId = other.rigidBodyObject?.userData?.id;
        const otherType = other.rigidBodyObject?.userData?.type;
        const otherName = other.rigidBodyObject?.name || 'unknown';
        
        console.log(`[CharacterController] Collision enter with: ${otherName}`);
        
        // Handle ground collision for animation
        if (other.rigidBodyObject?.name === 'ground' || 
            other.rigidBodyObject?.name?.includes('floor') || 
            other.rigidBodyObject?.name?.includes('terrain') || 
            other.rigidBodyObject?.name?.includes('platform')) {
          
          console.log(`[CharacterController] Ground collision detected, setting isOnGround=true`);
          setIsOnGround(true);
          
          // If we were in the air and now landed, play landing animation
          if (wasInAir.current) {
            console.log(`[CharacterController] Landing from jump, setting animation to idle`);
            
            // Clear any existing jump animation timers
            if (jumpAnimationTimer.current) {
              clearTimeout(jumpAnimationTimer.current);
              jumpAnimationTimer.current = null;
            }
            
            // Force immediate animation change to idle
            setAnimationState('idle');
            
            // Force immediate network update for animation change
            sendMove({
              position: [rigidBody.current.translation().x, rigidBody.current.translation().y, rigidBody.current.translation().z],
              rotation: characterRotationTarget.current,
              animation: 'idle',
              color: characterColor,
              showSkateboard: showSkateboard,
            });
            
            // Reset the wasInAir flag
            wasInAir.current = false;
            
            // Check velocity after landing to determine if we should transition to walk/run
            const horizontalSpeed = Math.sqrt(velocity.x * velocity.x + velocity.z * velocity.z);
            if (horizontalSpeed > 0.1) {
              // If we're still moving after landing, update animation in the next frame
              setTimeout(() => {
                // Make sure the rigid body reference is still valid
                if (!rigidBody.current) return;
                
                const newSpeed = Math.sqrt(
                  rigidBody.current.linvel().x * rigidBody.current.linvel().x + 
                  rigidBody.current.linvel().z * rigidBody.current.linvel().z
                );
                
                // Only update if we're still moving
                if (newSpeed > 0.1) {
                  const newAnimState = showSkateboard ? 'walk' : (newSpeed > 4 ? 'run' : 'walk');
                  console.log(`[CharacterController] After landing, transitioning to ${newAnimState}`);
                  
                  setAnimationState(newAnimState);
                  
                  // Force immediate network update for animation change
                  sendMove({
                    position: [rigidBody.current.translation().x, rigidBody.current.translation().y, rigidBody.current.translation().z],
                    rotation: characterRotationTarget.current,
                    animation: newAnimState,
                    color: characterColor,
                    showSkateboard: showSkateboard,
                  });
                }
              }, 100); // Shorter delay for more responsive animation
              
              // Add a second check with longer delay as a backup
              setTimeout(() => {
                // Make sure the rigid body reference is still valid and we're still on ground
                if (!rigidBody.current || !isOnGround) return;
                
                const currentSpeed = Math.sqrt(
                  rigidBody.current.linvel().x * rigidBody.current.linvel().x + 
                  rigidBody.current.linvel().z * rigidBody.current.linvel().z
                );
                
                // Only update if we're still moving and not already in walk/run
                if (currentSpeed > 0.1 && animationState !== 'walk' && animationState !== 'run') {
                  const newAnimState = showSkateboard ? 'walk' : (currentSpeed > 4 ? 'run' : 'walk');
                  console.log(`[CharacterController] Backup check: Still moving but not in walk/run, transitioning to ${newAnimState}`);
                  
                  setAnimationState(newAnimState);
                  
                  // Force immediate network update for animation change
                  sendMove({
                    position: [rigidBody.current.translation().x, rigidBody.current.translation().y, rigidBody.current.translation().z],
                    rotation: characterRotationTarget.current,
                    animation: newAnimState,
                    color: characterColor,
                    showSkateboard: showSkateboard,
                  });
                }
              }, 300); // Longer delay as a backup check
            }
          }
        }
      
        if (!otherType || !otherId) return;
      
        // Send this to a centralized game collision handler
        handleGameCollision({
          localId: myId,
          otherId,
          otherType,
          activeGames,
          socket: window.gameSocket,
        });
      }}
      onCollisionExit={({ other }) => {
        const otherName = other.rigidBodyObject?.name || 'unknown';
        console.log(`[CharacterController] Collision exit with: ${otherName}`);
        
        // Only set not on ground if we're leaving a ground/floor collision
        if (other.rigidBodyObject?.name === 'ground' || 
            other.rigidBodyObject?.name?.includes('floor') || 
            other.rigidBodyObject?.name?.includes('terrain') || 
            other.rigidBodyObject?.name?.includes('platform')) {
          
          console.log(`[CharacterController] Left ground, setting isOnGround=false`);
          
          // Use setTimeout instead of requestAnimationFrame for more reliable timing
          setTimeout(() => {
            setIsOnGround(false);
            wasInAir.current = true;
            console.log(`[CharacterController] isOnGround set to false, wasInAir set to true`);
          }, 50); // Short delay to avoid race conditions
        }
      }}
    >
      <group ref={container}>
        <group ref={cameraTarget} position-z={1.5} position-y={1 + VERTICAL_OFFSET} />
        <group ref={cameraPosition} position-y={3 + VERTICAL_OFFSET} position-z={-5} />
        <group ref={firstPersonCameraPosition} position-y={1.2 + VERTICAL_OFFSET} position-z={0.1} />
        
        {/* Only show character model in third-person view */}
        {!isFirstPerson && (
          <>
            {/* Add skateboard under the player's feet if enabled */}
            {showSkateboard && (
              <group
                position={[0, animationState.includes('jump') ? -0.02 : -0.038, 0]} // Change vertical position based on jump state
              >
                <PlayerSkateboard 
                  scale={0.0055} 
                  position={[0, 0, 0]} // Position relative to the parent group
                  rotation={character.current ? [0, character.current.rotation.y, 0] : [0, 0, 0]}
                />
              </group>
            )}
            
            <group ref={character}>
              <Character 
                color={characterColor} 
                animation={animationState} 
              />
              {emoji && (
                <Html position={[0, 1 + VERTICAL_OFFSET, 0]} center distanceFactor={8}>
                  <div className={styles.emojiContainer}>{emoji}</div>
                </Html>
              )}
              
              {/* Voice chat indicator */}
              {isVoiceChatEnabled && Object.values(connectionStatus).some(status => status === 'connected') && (
                <Html position={[0, 0.8 + VERTICAL_OFFSET, 0]} center distanceFactor={8}>
                  <div 
                    className={styles.voiceChatIndicator}
                    style={{
                      fontSize: '0.6em', // 1/4 the size of emoji (2em * 0.3 = 0.6em)
                      opacity: voiceActivity[myId] ? 1 : 0.7,
                      transform: voiceActivity[myId] ? 'scale(3.07664)' : 'scale(3.07664)',
                      transition: 'all 0.2s ease',
                      filter: voiceActivity[myId] ? 'drop-shadow(0 0 3px #4CAF50)' : 'none'
                    }}
                  >
                    🔊
                  </div>
                </Html>
              )}
              
              <TagPlayerIndicator playerId={myId} />
            </group>
          </>
        )}
        
        {/* Pointer lock indicator for third-person mode */}
        {!isFirstPerson && isThirdPersonPointerLocked && (
          <Html position={[0, 3, 0]} center>
            <div style={{
              background: 'rgba(0, 0, 0, 0.8)',
              color: 'white',
              padding: '8px 12px',
              borderRadius: '4px',
              fontSize: '14px',
              fontFamily: 'Arial, sans-serif',
              textAlign: 'center',
              pointerEvents: 'none',
              whiteSpace: 'nowrap'
            }}>
              🎮 Mouse Look Active - Press ESC to release
            </div>
          </Html>
        )}
        
        {/* Click to activate indicator for third-person mode */}
        {!isFirstPerson && !isThirdPersonPointerLocked && (
          <Html position={[0, 3, 0]} center>
            <div style={{
              background: 'rgba(0, 0, 0, 0.6)',
              color: 'white',
              padding: '6px 10px',
              borderRadius: '4px',
              fontSize: '12px',
              fontFamily: 'Arial, sans-serif',
              textAlign: 'center',
              pointerEvents: 'none',
              whiteSpace: 'nowrap',
              opacity: 0.7
            }}>
              Click to activate mouse look
            </div>
          </Html>
        )}
      </group>
      <CapsuleCollider args={[0.3, 0.3]} position={[0, 0.8 + VERTICAL_OFFSET, 0]} />
    </RigidBody>
  );
}
