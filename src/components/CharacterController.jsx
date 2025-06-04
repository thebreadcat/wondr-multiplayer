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
import VoiceActivityIndicator from "./VoiceActivityIndicator";
import { handleGameCollision } from "../utils/handleGameCollision";
import { useCameraStore } from "./CameraToggleButton";

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
        mouseRotation.current.x -= event.movementY * sensitivity;
        
        // Clamp vertical rotation to prevent camera flipping
        mouseRotation.current.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, mouseRotation.current.x));
      }
    };
    
    const handleClick = () => {
      if (isFirstPerson && document.pointerLockElement !== canvas) {
        canvas.requestPointerLock();
      }
    };
    
    // Add event listeners
    canvas.addEventListener('click', handleClick);
    document.addEventListener('pointerlockchange', handlePointerLockChange);
    document.addEventListener('mousemove', handleMouseMove);
    
    // Cleanup function
    return () => {
      canvas.removeEventListener('click', handleClick);
      document.removeEventListener('pointerlockchange', handlePointerLockChange);
      document.removeEventListener('mousemove', handleMouseMove);
      
      // Exit pointer lock when component unmounts or first-person mode is disabled
      if (document.pointerLockElement === canvas) {
        document.exitPointerLock();
      }
    };
  }, [isFirstPerson, gl]);

  const characterRotationTarget = useRef(0);
  const rotationTarget = useRef(0);
  const lastPosition = useRef([0, 0, 0]);
  const wasJumpPressed = useRef(false);
  const jumpCooldown = useRef(0);
  const jumpInProgress = useRef(false);

  // Track current position for respawn with offset
  const currentPosition = useRef(adjustedInitialPosition);

  // Initialize animation on mount and handle cleanup
  useEffect(() => {
    // Ensure we start with the idle animation
    console.log('[CharacterController] Initializing with idle animation');
    setAnimationState('idle');
    
    // Send initial animation state to server
    sendMove({
      position: adjustedInitialPosition,
      rotation: 0,
      animation: 'idle',
      color: characterColor,
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
    const { forward, backward, left, right, run, jump } = getKeys();
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
          });
        }
      }
    }
    
    // Check if we need to reset animation state
    // This handles cases where the character is moving but stuck in a non-movement animation
    if (!jump) { // Check regardless of isOnGround status to be safe
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
        if (forward) {
          movement.x += forwardVector.x;
          movement.z += forwardVector.z;
        }
        if (backward) {
          movement.x -= forwardVector.x;
          movement.z -= forwardVector.z;
        }
        if (left) {
          movement.x -= rightVector.x;
          movement.z -= rightVector.z;
        }
        if (right) {
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
        if (forward) movement.z = 1;
        if (backward) movement.z = -1;
        if (left) movement.x = 1; // Match third-person controls
        if (right) movement.x = -1; // Match third-person controls
      }
    } else {
      // Third-person movement (original behavior)
      if (forward) movement.z = 1;
      if (backward) movement.z = -1;
      if (left) movement.x = 1;
      if (right) movement.x = -1;
    }

    let speed = run ? RUN_SPEED : WALK_SPEED;

    if (movement.x !== 0) rotationTarget.current += ROTATION_SPEED * movement.x;

    if (movement.x !== 0 || movement.z !== 0) {
      characterRotationTarget.current = Math.atan2(movement.x, movement.z);
      velocity.x = Math.sin(rotationTarget.current + characterRotationTarget.current) * speed;
      velocity.z = Math.cos(rotationTarget.current + characterRotationTarget.current) * speed;
      
      // Set animation state based on skateboard status
      if (isOnGround) {
        const newAnimState = showSkateboard ? "walk" : (speed === RUN_SPEED ? "run" : "walk");
        if (animationState !== newAnimState) {
          console.log(`[CharacterController] Setting animation to ${newAnimState} from ${animationState}`);
          setAnimationState(newAnimState);
          
          // Force immediate network update for animation change
          sendMove({
            position: [rigidBody.current.translation().x, rigidBody.current.translation().y, rigidBody.current.translation().z],
            rotation: characterRotationTarget.current,
            animation: newAnimState,
            color: characterColor,
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
    if (jump && !wasJumpPressed.current && jumpCooldown.current <= 0) {
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
          });
        }
        jumpAnimationTimer.current = null;
      }, 1500); // 1.5 second safety timer
    }
    wasJumpPressed.current = jump;

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
      });
    }

    // Calculate movement speed for camera adjustments
    const movementSpeed = Math.sqrt(velocity.x * velocity.x + velocity.z * velocity.z);
    const isWalking = movementSpeed > 0.1 && movementSpeed < 4;
    const isRunning = movementSpeed >= 4;
    
    // Use a consistent camera speed regardless of movement
    // This ensures character stays at consistent distance from bottom of screen
    const cameraSpeed = 0.1; // Fixed camera speed for all movement types

    // Update container rotation (camera orbit point) with delta time for smooth motion
    if (container.current) {
      // Use a slower rotation speed for smoother camera movement
      const rotationLerpFactor = CAMERA_ROTATION_SPEED * (60 * cappedDelta); // Normalize by target framerate
      container.current.rotation.y = MathUtils.lerp(
        container.current.rotation.y,
        rotationTarget.current,
        rotationLerpFactor
      );
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
          
          // Calculate camera position based on fixed height and distance
          // This ensures the character stays at a consistent position on screen
          const cameraOffset = new Vector3();
          
          // Calculate camera position behind character based on rotation
          cameraOffset.x = -Math.sin(container.current.rotation.y) * CAMERA_DISTANCE;
          cameraOffset.z = -Math.cos(container.current.rotation.y) * CAMERA_DISTANCE;
          
          // Set fixed height above character
          cameraOffset.y = CAMERA_HEIGHT;
          
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
          
          // Debug camera position
          if (Math.random() < 0.005) {
            console.log(`[CharacterController] Camera position: ${state.camera.position.x.toFixed(2)}, ${state.camera.position.y.toFixed(2)}, ${state.camera.position.z.toFixed(2)}`);
            console.log(`[CharacterController] Character position: ${characterPos.x.toFixed(2)}, ${characterPos.y.toFixed(2)}, ${characterPos.z.toFixed(2)}`);
            console.log(`[CharacterController] Camera distance: ${state.camera.position.distanceTo(characterPos).toFixed(2)}`);
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
              <TagPlayerIndicator playerId={myId} />
              
              {/* Voice activity indicator for local player */}
              <VoiceActivityIndicator playerId={myId} position={currentPosition.current} />
            </group>
          </>
        )}
      </group>
      <CapsuleCollider args={[0.3, 0.3]} position={[0, 0.8 + VERTICAL_OFFSET, 0]} />
    </RigidBody>
  );
}
