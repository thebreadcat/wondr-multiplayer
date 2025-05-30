import React, { useRef } from 'react';
import { useGLTF } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';

// Update path to your model location
const MODEL_PATH = '/models/skateboard.glb';

export function Skateboard({
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  scale = 0.005, // Extremely small scale for world skateboards
  onCollide = null,
  id = 'skateboard'
}) {
  const groupRef = useRef();
  const { nodes, materials } = useGLTF(MODEL_PATH);
  
  // Rotate the skateboard slightly for visual appeal
  useFrame(() => {
    if (groupRef.current) {
      groupRef.current.rotation.y += 0.005;
    }
  });

  return (
    <group 
      ref={groupRef}
      position={position} 
      rotation={rotation}
      scale={scale}
      userData={{ type: 'skateboard', id }}
    >
      <mesh
        castShadow
        receiveShadow
        geometry={nodes.Skateboard?.geometry}
        material={materials.Mat}
        // Rotate to lay flat on the ground
        rotation={[0, 0, 0]}
      />
    </group>
  );
}

export function PlayerSkateboard({
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  scale = 0.005, // Matched to user's preference
  followPlayer = null
}) {
  const groupRef = useRef();
  const { nodes, materials } = useGLTF(MODEL_PATH);
  
  // No rotation animation for player skateboard

  return (
    <group 
      ref={groupRef}
      position={position}
      rotation={rotation} 
      scale={scale}
      userData={{ type: 'playerSkateboard' }}
    >
      <mesh
        castShadow
        receiveShadow
        geometry={nodes.Skateboard?.geometry}
        material={materials.Mat}
        // Keep flat orientation
        rotation={[0, 0, 0]}
      />
    </group>
  );
}

// Preload the model to improve performance
useGLTF.preload(MODEL_PATH);
