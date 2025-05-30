import React from "react";
import { useRaceStore } from "../store";

export default function StartLine() {
  const { startLine } = useRaceStore();

  if (!startLine) return null;

  return (
    <mesh position={startLine}>
      <boxGeometry args={[2, 0.2, 1]} />
      <meshStandardMaterial color="green" />
    </mesh>
  );
}
