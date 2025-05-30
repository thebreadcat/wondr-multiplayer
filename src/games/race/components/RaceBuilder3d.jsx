import React, { useEffect, useState } from "react";
import { useRaceBuilderStore } from "../raceBuilderStore";
import { useRaceStore } from "../store";

// Using React.memo to prevent unnecessary re-renders
const RaceBuilder3D = React.memo(function RaceBuilder3D() {
  // Get data from both stores - builder for editing, race store for active race
  const { startLine: builderStartLine, checkpoints: builderCheckpoints } = useRaceBuilderStore();
  const { 
    startLine: raceStartLine, 
    checkpoints: raceCheckpoints,
    isJoined,
    roomId
  } = useRaceStore();
  
  // Use race data when joined, otherwise use builder data
  const startLine = isJoined ? raceStartLine : builderStartLine;
  const checkpoints = isJoined ? raceCheckpoints : builderCheckpoints;
  
  // Function to get position from a checkpoint (handles both formats)
  const getCheckpointPosition = (checkpoint) => {
    // If checkpoint is an array, it's already a position
    if (Array.isArray(checkpoint)) {
      return checkpoint;
    }
    // If checkpoint is an object with position property, use that
    if (checkpoint && checkpoint.position) {
      return checkpoint.position;
    }
    // Fallback
    return [0, 0, 0];
  };
  
  // Debug logging
  useEffect(() => {
    console.log('🏁 RaceBuilder3D rendering:', { 
      startLine, 
      checkpoints: Array.isArray(checkpoints) ? checkpoints.length : 0,
      isJoined,
      roomId
    });
  }, [startLine, checkpoints, isJoined, roomId]);

  return (
    <>
      {startLine && (
        <mesh position={startLine}>
          <boxGeometry args={[2, 0.2, 1]} />
          <meshStandardMaterial color="green" opacity={0.7} transparent />
        </mesh>
      )}
      {checkpoints && checkpoints.map((checkpoint, idx) => (
        <group key={idx} position={getCheckpointPosition(checkpoint)}>
          {/* Checkpoint sphere */}
          <mesh>
            <sphereGeometry args={[0.8, 16, 16]} />
            <meshStandardMaterial 
              color={idx === checkpoints.length - 1 ? "#e74c3c" : "#3498db"} 
              opacity={0.5} 
              transparent 
            />
          </mesh>
          
          {/* Vertical pole for better visibility */}
          <mesh position={[0, 2, 0]}>
            <cylinderGeometry args={[0.1, 0.1, 4, 8]} />
            <meshStandardMaterial color={idx === checkpoints.length - 1 ? "#e74c3c" : "#3498db"} />
          </mesh>
          
          {/* Checkpoint number */}
          <mesh position={[0, 0.5, 0]}>
            <sphereGeometry args={[0.3, 16, 16]} />
            <meshStandardMaterial color="white" />
          </mesh>
        </group>
      ))}
    </>
  );
});
export default RaceBuilder3D;
