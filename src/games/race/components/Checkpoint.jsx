// Checkpoint.tsx
import { useRaceStore } from "../store";
import { RigidBody } from "@react-three/rapier";
import { useRef, useEffect, useState } from "react";

export function Checkpoint({ index, position }) {
  const ref = useRef(null);
  const raceState = useRaceStore((s) => s.raceState);
  const currentCheckpointIndex = useRaceStore((s) => s.currentCheckpointIndex);
  const passCheckpoint = useRaceStore((s) => s.passCheckpoint);

  const [active, setActive] = useState(true);

  useEffect(() => {
    if (raceState === "building") setActive(true);
    if (raceState === "running" && index < currentCheckpointIndex) setActive(false);
  }, [raceState, currentCheckpointIndex]);

  if (!active) return null;

  return (
    <RigidBody
      type="fixed"
      position={position}
      colliders="cuboid"
      sensor
      onCollisionEnter={({ other }) => {
        const isPlayer = other.rigidBodyObject?.name === "player";
        if (!isPlayer) return;

        if (raceState === "running" && currentCheckpointIndex === index) {
          passCheckpoint(index);
          setActive(false); // Hide this one
        }
      }}
    >
      <mesh ref={ref}>
        <sphereGeometry args={[1, 32, 32]} />
        <meshStandardMaterial color={index === currentCheckpointIndex ? "orange" : "gray"} opacity={0.5} transparent />
      </mesh>
    </RigidBody>
  );
}
