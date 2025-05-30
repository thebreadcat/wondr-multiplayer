// RaceElements.jsx - 3D elements for the race system
import React, { useRef, useState, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { Text } from '@react-three/drei';
import { useRace } from './useRace';

// Start/Finish Line component
export function StartLine() {
  const { raceState, startLine } = useRace();
  const lineRef = useRef();
  const poleRef = useRef();
  
  // Don't render anything if there's no startLine data
  if (!startLine || !startLine.position) return null;
  
  // Calculate rotation - use the stored rotation or default to 0
  const rotationY = startLine.rotation || 0;
  
  return (
    <group position={startLine.position}>
      {/* Horizontal Line - rotated to face the same direction as player */}
      <mesh 
        ref={lineRef}
        position={[0, 0.05, 0]}
        rotation={[0, rotationY, 0]} // Use player's rotation
      >
        <boxGeometry args={[5, 0.1, 0.5]} /> 
        <meshStandardMaterial color="red" />
      </mesh>
      
      {/* Vertical Pole - better visibility */}
      <mesh 
        ref={poleRef}
        position={[0, 2, 0]}
      >
        <boxGeometry args={[0.1, 4, 0.1]} /> 
        <meshStandardMaterial color="red" />
      </mesh>
      
      {/* Text label floating above */}
      <Text 
        position={[0, 4, 0]}
        rotation={[0, rotationY, 0]} // Match player's facing direction
        fontSize={0.5}
        color="white"
        outlineWidth={0.05}
        outlineColor="black"
        anchorX="center"
        anchorY="middle"
      >
        START/FINISH
      </Text>
      
      {/* Direction indicator - shows which way is forward */}
      <mesh position={[0, 0.5, -1]} rotation={[0, 0, 0]}>
        <coneGeometry args={[0.3, 0.8, 8]} />
        <meshStandardMaterial color="yellow" />
      </mesh>
    </group>
  );
}

// Checkpoints component
export function Checkpoints() {
  const { checkpoints } = useRace();
  
  if (!checkpoints || checkpoints.length === 0) return null;
  
  return (
    <group>
      {checkpoints.map((checkpoint, index) => (
        <Checkpoint 
          key={checkpoint.id} 
          checkpoint={checkpoint} 
          number={index + 1} 
          isPassed={checkpoint.passed}
        />
      ))}
    </group>
  );
}

// Individual Checkpoint component
function Checkpoint({ checkpoint, number, isPassed = false }) {
  const checkpointRef = useRef();
  const poleRef = useRef();
  
  // Handle case where checkpoint doesn't have position data
  if (!checkpoint || !checkpoint.position) return null;
  
  // Get position and rotation from the checkpoint data
  const position = checkpoint.position;
  const rotation = checkpoint.rotation || 0;
  
  // Animation effect for active checkpoints
  useFrame((_, delta) => {
    if (checkpointRef.current) {
      checkpointRef.current.rotation.y += delta * 0.5;
    }
  });
  
  return (
    <group position={position}>
      {/* Checkpoint Ring */}
      <mesh ref={checkpointRef} position={[0, 0, 0]}>
        <torusGeometry args={[1.5, 0.1, 16, 32]} />
        <meshStandardMaterial 
          color={isPassed ? "green" : "yellow"} 
          emissive={isPassed ? "green" : "yellow"}
          emissiveIntensity={0.5}
        />
      </mesh>
      
      {/* Vertical Pole for better visibility - ensure it reaches ground */}
      <mesh ref={poleRef} position={[0, -3, 0]}>
        <boxGeometry args={[0.1, 10, 0.1]} />
        <meshStandardMaterial color={isPassed ? "green" : "yellow"} />
      </mesh>
      
      {/* Number Label */}
      <Text 
        position={[0, 1, 0]}
        rotation={[0, rotation, 0]} // Match player's rotation when placed
        fontSize={0.8}
        color="white"
        outlineWidth={0.08}
        outlineColor="black"
        anchorX="center"
        anchorY="middle"
      >
        {number}
      </Text>
    </group>
  );
}

// Join Area component - Now just a placeholder since we're using RaceJoinZone instead
export function JoinArea() {
  // This component is now just a placeholder
  // The actual join zone functionality is in RaceJoinZone.jsx which uses GameZoneSystem
  return null;
}

// Countdown in 3D space - this is an alternative to the HTML overlay
export function Countdown3D() {
  const { raceState, countdown } = useRace();
  const ref = useRef();
  
  if (raceState !== 'countdown') return null;
  
  // Make countdown visible to the player by positioning it in front of them
  return (
    <group position={[0, 2, -5]}>
      <Text
        ref={ref}
        position={[0, 0, 0]}
        fontSize={2}
        color="white"
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.1}
        outlineColor="black"
      >
        {countdown > 0 ? countdown.toString() : 'GO!'}
      </Text>
    </group>
  );
}

// Timer display in 3D - this is an alternative to the HTML overlay
export function Timer3D() {
  const { raceState, raceTime } = useRace();
  const ref = useRef();
  
  // Only show timer when race is running
  if (raceState !== 'running') return null;
  
  // Format time as MM:SS
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };
  
  // Billboard text that follows the camera
  return (
    <group position={[0, 4, -5]}>
      <Text
        ref={ref}
        position={[0, 0, 0]}
        fontSize={1}
        color="white"
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.05}
        outlineColor="black"
      >
        {formatTime(raceTime)}
      </Text>
    </group>
  );
}
