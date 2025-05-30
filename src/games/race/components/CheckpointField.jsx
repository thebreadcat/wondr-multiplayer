import { useRaceStore } from "../store";
import { useMultiplayer } from "../../../components/MultiplayerProvider";
import React, { useRef, useState, useEffect } from "react";

// Using React.memo to prevent unnecessary re-renders
const Checkpoint = React.memo(function Checkpoint({ position, index, radius = 2 }) {
  const { isRaceRunning, currentCheckpointIndex, passCheckpoint, checkpoints } = useRaceStore();
  const { players, myId } = useMultiplayer();
  const [active, setActive] = useState(true);
  const ref = useRef();
  
  // Log when a checkpoint becomes the current one
  useEffect(() => {
    if (index === currentCheckpointIndex && active) {
      console.log(`[Checkpoint ${index}] Now ACTIVE at position [${position.join(', ')}], radius: ${radius}`);
    }
  }, [index, currentCheckpointIndex, active, position, radius]);
  
  // Position-based detection
  useEffect(() => {
    // Skip if not the current checkpoint or race not running
    if (!active || !isRaceRunning || currentCheckpointIndex !== index) return;
    
    // Skip if player doesn't exist or has no position
    if (!players[myId] || !players[myId].position) {
      if (Math.random() < 0.01) console.log(`[Checkpoint ${index}] Warning: Player ${myId} not found or has no position`);
      return;
    }
    
    // Get player position
    const playerPos = players[myId].position;
    
    // Calculate distance to checkpoint (ignoring Y axis for more forgiving detection)
    const dx = playerPos[0] - position[0];
    const dz = playerPos[2] - position[2];
    const distanceSquared = dx * dx + dz * dz;
    
    // Check if player is inside checkpoint radius
    const inCheckpoint = distanceSquared <= radius * radius;
    
    // Log distance periodically (approximately once every 2 seconds)
    if (Math.random() < 0.02) {
      console.log(`[Checkpoint ${index}] Distance: ${Math.sqrt(distanceSquared).toFixed(2)} units, inside: ${inCheckpoint}`);
    }
    
    // If player is inside checkpoint, mark it as passed
    if (inCheckpoint) {
      console.log(`[Checkpoint ${index}] ✅ PASSED! Player at [${playerPos.join(', ')}], checkpoint at [${position.join(', ')}]`);
      
      // Use the checkpoint ID if available, otherwise use the index
      const checkpointId = checkpoints[index]?.id || index;
      passCheckpoint(checkpointId);
      setActive(false); // hide checkpoint
    }
  }, [active, isRaceRunning, currentCheckpointIndex, index, players, myId, position, radius, passCheckpoint, checkpoints]);

  if (!active) return null;

  return (
    <group position={position}>
      <mesh ref={ref}>
        <sphereGeometry args={[radius, 32, 32]} />
        <meshStandardMaterial 
          color={index === currentCheckpointIndex ? "orange" : "gray"} 
          opacity={0.5} 
          transparent 
        />
      </mesh>
      
      {/* Vertical pole for better visibility */}
      <mesh position={[0, 4, 0]}>
        <cylinderGeometry args={[0.2, 0.2, 8, 8]} />
        <meshStandardMaterial color={index === currentCheckpointIndex ? "orange" : "gray"} />
      </mesh>
    </group>
  );
});

// Using React.memo to prevent unnecessary re-renders
export const CheckpointField = React.memo(function CheckpointField() {
  const { checkpoints, isRaceRunning, currentCheckpointIndex } = useRaceStore();
  const isFirstRender = useRef(true);
  
  // Debug logging only on first render
  useEffect(() => {
    if (isFirstRender.current) {
      console.log(`[CheckpointField] Initializing with ${checkpoints?.length || 0} checkpoints`);
      isFirstRender.current = false;
    }
  }, [checkpoints]);
  
  // Skip rendering if no checkpoints or race not running
  if (!checkpoints || checkpoints.length === 0) {
    return null;
  }
  
  return (
    <>
      {checkpoints.map((checkpoint, index) => {
        // Get position from checkpoint (handles both formats)
        const position = checkpoint.position || checkpoint;
        
        return (
          <Checkpoint 
            key={checkpoint.id || `checkpoint-${index}`} 
            position={position} 
            index={index} 
            radius={2} // Larger radius for easier detection
          />
        );
      })}
    </>
  );
});
