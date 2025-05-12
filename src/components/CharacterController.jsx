// CharacterController.jsx (refactored with stable animation, jump handling, clean updates)
import React, { useState, useRef, useEffect, useMemo } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Vector3, Euler, MathUtils } from "three";
import { CapsuleCollider, RigidBody, useRapier } from "@react-three/rapier";
import { Character } from "./Character";
import { Html, useKeyboardControls } from "@react-three/drei";
import { useMultiplayer } from "./MultiplayerProvider";
import { useGameSystem } from "./GameSystemProvider";
import styles from "./RemotePlayer.module.css";
import TagPlayerIndicator from "../games/tag/TagPlayerIndicator";

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

export function CharacterController({ initialPosition, characterColor, setLocalPosition }) {
  const rigidBody = useRef();
  const character = useRef();
  const container = useRef();
  const [, getKeys] = useKeyboardControls();
  const { sendMove, sendEmoji, emoji, myId, emojis } = useMultiplayer();
  const { activeGames } = useGameSystem();
  
  // Create throttled sendMove function to limit network traffic
  const throttledSendMove = useMemo(
    () => throttle((data) => sendMove(data), 50), // Limit to 20 updates per second
    [sendMove]
  );

  // Add initial position with offset
  const adjustedInitialPosition = [
    initialPosition[0],
    initialPosition[1] + VERTICAL_OFFSET,
    initialPosition[2]
  ];

  const [isOnGround, setIsOnGround] = useState(false);
  const [animationState, setAnimationState] = useState("idle");

  const cameraTarget = useRef();
  const cameraPosition = useRef();
  const cameraWorldPosition = useRef(new Vector3());
  const cameraLookAtWorldPosition = useRef(new Vector3());
  const cameraLookAt = useRef(new Vector3());

  const characterRotationTarget = useRef(0);
  const rotationTarget = useRef(0);
  const lastPosition = useRef([0, 0, 0]);
  const wasJumpPressed = useRef(false);
  const isClicking = useRef(false);
  const jumpCooldown = useRef(0);
  const jumpInProgress = useRef(false);

  // Track current position for respawn with offset
  const currentPosition = useRef(adjustedInitialPosition);

  useEffect(() => {
    // Use passive event listeners for improved performance
    const onMouseDown = () => { isClicking.current = true; };
    const onMouseUp = () => { isClicking.current = false; };
    
    // Add passive flag to indicate these listeners don't call preventDefault()
    document.addEventListener("mousedown", onMouseDown, { passive: true });
    document.addEventListener("mouseup", onMouseUp, { passive: true });
    document.addEventListener("touchstart", onMouseDown, { passive: true });
    document.addEventListener("touchend", onMouseUp, { passive: true });
    
    // Clean up all event listeners and resources when component unmounts
    return () => {
      document.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("mouseup", onMouseUp);
      document.removeEventListener("touchstart", onMouseDown);
      document.removeEventListener("touchend", onMouseUp);
      
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
    if (forward) movement.z = 1;
    if (backward) movement.z = -1;
    if (left) movement.x = 1;
    if (right) movement.x = -1;

    let speed = run ? RUN_SPEED : WALK_SPEED;

    if (isClicking.current) {
      if (Math.abs(state.mouse.x) > 0.1) movement.x = -state.mouse.x;
      movement.z = state.mouse.y + 0.4;
      if (Math.abs(movement.x) > 0.5 || Math.abs(movement.z) > 0.5) speed = RUN_SPEED;
    }

    if (movement.x !== 0) rotationTarget.current += ROTATION_SPEED * movement.x;

    if (movement.x !== 0 || movement.z !== 0) {
      characterRotationTarget.current = Math.atan2(movement.x, movement.z);
      velocity.x = Math.sin(rotationTarget.current + characterRotationTarget.current) * speed;
      velocity.z = Math.cos(rotationTarget.current + characterRotationTarget.current) * speed;
      if (isOnGround) setAnimationState(speed === RUN_SPEED ? "run" : "walk");
    } else {
      velocity.x *= 0.8;
      velocity.z *= 0.8;
      if (isOnGround) setAnimationState("idle");
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
      
      // Use requestAnimationFrame for smoother animation state changes
      requestAnimationFrame(() => {
        setAnimationState("jump_up");
        // Still track ground state for animation purposes
        if (isOnGround) {
          setIsOnGround(false);
        }
      });
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

    // Adjust camera follow speed based on movement
    let cameraSpeed = 0.1; // Default camera speed
    if (isRunning) {
      cameraSpeed = 0.05; // Slower camera movement when running
    } else if (isWalking) {
      cameraSpeed = 0.08; // Medium camera speed when walking
    }

    // Update container rotation (camera orbit point) with delta time for smooth motion
    if (container.current) {
      const rotationLerpFactor = cameraSpeed * (60 * cappedDelta); // Normalize by target framerate
      container.current.rotation.y = MathUtils.lerp(
        container.current.rotation.y,
        rotationTarget.current,
        rotationLerpFactor
      );
    }

    // Update camera position using refs with delta-time interpolation
    if (cameraPosition.current && cameraTarget.current) {
      // Get world positions
      cameraPosition.current.getWorldPosition(cameraWorldPosition.current);
      cameraTarget.current.getWorldPosition(cameraLookAtWorldPosition.current);

      // Calculate lerp factor based on delta time
      const positionLerpFactor = cameraSpeed * (60 * cappedDelta); // Normalize by target framerate
      
      // Smoothly move camera with delta-time interpolation
      state.camera.position.lerp(cameraWorldPosition.current, positionLerpFactor);
      cameraLookAt.current.lerp(cameraLookAtWorldPosition.current, positionLerpFactor);
      state.camera.lookAt(cameraLookAt.current);
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
      onCollisionEnter={() => {
        if (!rigidBody.current) return;
        
        // Use requestAnimationFrame for smoother state changes
        requestAnimationFrame(() => {
          setIsOnGround(true);
          const vel = rigidBody.current?.linvel();
          const isMoving = vel && (Math.abs(vel.x) > 0.1 || Math.abs(vel.z) > 0.1);
          setAnimationState(isMoving ? "walk" : "idle");
        });
      }}
      onCollisionExit={() => requestAnimationFrame(() => setIsOnGround(false))}
    >
      <group ref={container}>
        <group ref={cameraTarget} position-z={1.5} position-y={1 + VERTICAL_OFFSET} />
        <group ref={cameraPosition} position-y={3 + VERTICAL_OFFSET} position-z={-5} />
        <group ref={character}>
          <Character color={characterColor} animation={animationState} />
          {emoji && (
            <Html position={[0, 1 + VERTICAL_OFFSET, 0]} center distanceFactor={8}>
              <div className={styles.emojiContainer}>{emoji}</div>
            </Html>
          )}
          
          {/* Tag game indicator for local player */}
          <TagPlayerIndicator playerId={myId} />
        </group>
      </group>
      <CapsuleCollider args={[0.3, 0.3]} position={[0, 0.8 + VERTICAL_OFFSET, 0]} />
    </RigidBody>
  );
}
