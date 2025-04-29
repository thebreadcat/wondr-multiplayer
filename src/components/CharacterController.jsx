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

  // Track current position for respawn
  const currentPosition = useRef(initialPosition);

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

    if (jump && !wasJumpPressed.current && isOnGround) {
      const jumpVelocity = Math.sqrt(2 * 9.8 * 0.4);
      velocity.y = jumpVelocity;
      setIsOnGround(false);
      setAnimationState("jump_up");
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

    const currentPos = [position.x, position.y, position.z];
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

    if (container.current) {
      container.current.rotation.y = MathUtils.lerp(
        container.current.rotation.y,
        rotationTarget.current,
        0.1
      );
      if (cameraPosition.current) {
        cameraPosition.current.getWorldPosition(cameraWorldPosition.current);
        state.camera.position.lerp(cameraWorldPosition.current, 0.1);
      }
      if (cameraTarget.current) {
        cameraTarget.current.getWorldPosition(cameraLookAtWorldPosition.current);
        cameraLookAt.current.lerp(cameraLookAtWorldPosition.current, 0.1);
        state.camera.lookAt(cameraLookAt.current);
      }
    }

    // Get current position
    const worldPosition = position;
    currentPosition.current = [worldPosition.x, worldPosition.y, worldPosition.z];

    // Check if fallen too far
    if (worldPosition.y < -25) {
      // Respawn at initial position
      rigidBody.current.setTranslation({ x: initialPosition[0], y: initialPosition[1], z: initialPosition[2] });
      rigidBody.current.setLinvel({ x: 0, y: 0, z: 0 }); // Reset velocity
      rigidBody.current.setAngvel({ x: 0, y: 0, z: 0 }); // Reset angular velocity
      
      // Update position in multiplayer
      sendMove({
        position: initialPosition,
        animation: 'idle',
        rotation: characterRotationTarget.current,
      });
      
      // Update local position state
      setLocalPosition(initialPosition);
      return;
    }
  });

  return (
    <RigidBody
      ref={rigidBody}
      colliders={false}
      mass={1}
      type="dynamic"
      position={[0, 2, 0]}
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
        <group ref={cameraTarget} position-z={1.5} />
        <group ref={cameraPosition} position-y={4} position-z={-4} />
        <group ref={character}>
          <Character color={characterColor} animation={animationState} />
          {emoji && (
            <Html position={[0, 1, 0]} center distanceFactor={8}>
              <div className={styles.emojiContainer}>{emoji}</div>
            </Html>
          )}
        </group>
      </group>
      <CapsuleCollider args={[0.3, 0.3]} position={[0, 0.8, 0]} />
    </RigidBody>
  );
}
