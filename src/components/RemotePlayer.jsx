import React, { useRef, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { Character } from './Character';
import { Html } from '@react-three/drei';
import { useMultiplayer } from './MultiplayerProvider';
import { useGameSystem } from './GameSystemProvider';
import { Vector3, MathUtils } from 'three';
import styles from './RemotePlayer.module.css';
import { RigidBody } from '@react-three/rapier';
import TagPlayerIndicator from '../games/tag/TagPlayerIndicator';

export default function RemotePlayer({ player }) {
  // Always ensure animation is set to idle as fallback
  const { color, rotation = 0, id } = player;
  const animation = player.animation || 'idle';
  const { emojis } = useMultiplayer();
  const characterRef = useRef();
  const defaultPosition = [0, 2, 0];
  
  // Log remote player initialization
  useEffect(() => {
    console.log(`[RemotePlayer] Initializing player ${id} with animation: ${animation}`);
  }, []);

  // Update physics position when network data arrives
  useEffect(() => {
    if (player.position && characterRef.current) {
      const [x, y, z] = player.position;
      // Only update if position has changed significantly
      const currentPos = characterRef.current.translation();
      const distance = Math.sqrt(
        Math.pow(currentPos.x - x, 2) +
        Math.pow(currentPos.y - y, 2) +
        Math.pow(currentPos.z - z, 2)
      );

      if (distance > 0.1) { // Only update if moved more than 0.1 units
        characterRef.current.setTranslation({ x, y, z });
        // Reset velocities when teleporting
        characterRef.current.setLinvel({ x: 0, y: 0, z: 0 });
        characterRef.current.setAngvel({ x: 0, y: 0, z: 0 });
      }
    }
  }, [player.position]);

  useFrame(() => {
    if (!characterRef.current) return;

    // Get current position
    const worldPosition = characterRef.current.translation();

    // Check if fallen too far
    if (worldPosition.y < -25) {
      // Respawn at default position
      characterRef.current.setTranslation({ x: defaultPosition[0], y: defaultPosition[1], z: defaultPosition[2] });
      characterRef.current.setLinvel({ x: 0, y: 0, z: 0 });
      characterRef.current.setAngvel({ x: 0, y: 0, z: 0 });
    }

    // Debug log occasionally
    if (Math.random() < 0.02 && false) {
      console.log(`Player ${id} physics position:`, {
        position: [worldPosition.x, worldPosition.y, worldPosition.z],
        serverPosition: player.position,
        animation
      });
    }
  });

  // Ensure we have a valid position
  const currentPosition = player.position && player.position.length === 3 
    ? [...player.position]
    : [...defaultPosition];

  return (
    <RigidBody
      ref={characterRef}
      colliders="hull"
      type="dynamic"
      position={currentPosition}
      enabledRotations={[false, false, false]}
      lockRotations
      friction={0.7}
      restitution={0}
      linearDamping={12} // Increased damping to reduce sliding
      angularDamping={0.5}
      mass={1}
    >
      <group rotation-y={rotation}>
        <Character color={color} animation={animation} />
      </group>
      {/* Player emoji */}
      {emojis[id]?.value && (
        <Html
          position={[0, 1, 0]}
          center
          distanceFactor={8}
        >
          <div className={styles.emojiContainer}>
            {emojis[id].value}
          </div>
        </Html>
      )}
      
      {/* Tag game indicator - red for IT, blue for players */}
      <TagPlayerIndicator playerId={id} />
    </RigidBody>
  );
} 