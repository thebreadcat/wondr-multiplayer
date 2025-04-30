// CharacterController.jsx (refactored with stable animation, jump handling, clean updates)
import React, { useRef, useState, useEffect } from "react";
import { useKeyboardControls, Html } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { CapsuleCollider, RigidBody } from "@react-three/rapier";
import { MathUtils, Vector3 } from "three";
import { Character } from "./Character";
import { useMultiplayer } from "./MultiplayerProvider";
import styles from './RemotePlayer.module.css';

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

export function CharacterController({ initialPosition, characterColor, setLocalPosition }) {
  const rigidBody = useRef();
  const character = useRef();
  const container = useRef();
  const [, getKeys] = useKeyboardControls();
  const { sendMove, sendEmoji, emoji, myId } = useMultiplayer();

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
    const onMouseDown = () => { isClicking.current = true; };
    const onMouseUp = () => { isClicking.current = false; };
    document.addEventListener("mousedown", onMouseDown);
    document.addEventListener("mouseup", onMouseUp);
    document.addEventListener("touchstart", onMouseDown);
    document.addEventListener("touchend", onMouseUp);
    return () => {
      document.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("mouseup", onMouseUp);
      document.removeEventListener("touchstart", onMouseDown);
      document.removeEventListener("touchend", onMouseUp);
    };
  }, []);

  useFrame((state, delta) => {
    const { forward, backward, left, right, run, jump } = getKeys();
    if (!rigidBody.current) return;

    const velocity = rigidBody.current.linvel();
    const position = rigidBody.current.translation();

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

    // Calculate jump cooldown time (time to go up and come down based on physics)
    const jumpVelocity = Math.sqrt(2 * 9.8 * 0.4); // sqrt(2 * gravity * jumpHeight)
    const totalJumpTime = (2 * jumpVelocity) / 9.8; // 2 * initialVelocity / gravity

    // Update jump cooldown timer
    if (jumpCooldown.current > 0) {
      jumpCooldown.current -= delta;
    }

    // Handle jump with cooldown instead of ground check
    if (jump && !wasJumpPressed.current && jumpCooldown.current <= 0) {
      velocity.y = jumpVelocity;
      jumpCooldown.current = totalJumpTime;
      jumpInProgress.current = true;
      setAnimationState("jump_up");
      
      // Still track ground state for animation purposes
      if (isOnGround) {
        setIsOnGround(false);
      }
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
    const hasMoved = currentPos.some((v, i) => Math.abs(v - lastPosition.current[i]) > 0.01);

    if (hasMoved) {
      lastPosition.current = currentPos;
      sendMove({
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

    // Update container rotation (camera orbit point)
    if (container.current) {
      container.current.rotation.y = MathUtils.lerp(
        container.current.rotation.y,
        rotationTarget.current,
        cameraSpeed
      );
    }

    // Update camera position using refs
    if (cameraPosition.current && cameraTarget.current) {
      // Get world positions
      cameraPosition.current.getWorldPosition(cameraWorldPosition.current);
      cameraTarget.current.getWorldPosition(cameraLookAtWorldPosition.current);

      // Smoothly move camera
      state.camera.position.lerp(cameraWorldPosition.current, cameraSpeed);
      cameraLookAt.current.lerp(cameraLookAtWorldPosition.current, cameraSpeed);
      state.camera.lookAt(cameraLookAt.current);
    }

    // Get current position
    const worldPosition = position;
    currentPosition.current = [worldPosition.x, worldPosition.y, worldPosition.z];

    // Check if fallen too far
    if (worldPosition.y < -25) {
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

  return (
    <RigidBody
      ref={rigidBody}
      colliders={false}
      mass={1}
      type="dynamic"
      position={adjustedInitialPosition}
      enabledRotations={[false, false, false]}
      onCollisionEnter={() => {
        setIsOnGround(true);
        const vel = rigidBody.current?.linvel();
        const isMoving = vel && (Math.abs(vel.x) > 0.1 || Math.abs(vel.z) > 0.1);
        setAnimationState(isMoving ? "walk" : "idle");
      }}
      onCollisionExit={() => setIsOnGround(false)}
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
        </group>
      </group>
      <CapsuleCollider args={[0.3, 0.3]} position={[0, 0.8 + VERTICAL_OFFSET, 0]} />
    </RigidBody>
  );
}
