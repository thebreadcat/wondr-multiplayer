import React, { useRef, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { Character } from './Character';
import { PlayerSkateboard } from './Skateboard';
import { Html } from '@react-three/drei';
import { useMultiplayer } from './MultiplayerProvider';
import { useGameSystem } from './GameSystemProvider';
import { Vector3, MathUtils } from 'three';
import styles from './RemotePlayer.module.css';
import { RigidBody } from '@react-three/rapier';
import TagPlayerIndicator from '../games/tag/TagPlayerIndicator';
import { useVoiceChat } from './VoiceChatProvider';

export default function RemotePlayer({ player }) {
  // Always ensure animation is set to idle as fallback
  const { color, rotation = 0, id, showSkateboard = false } = player;
  const animation = player.animation || 'idle';
  const { emojis } = useMultiplayer();
  const { isVoiceChatEnabled, voiceActivity, connectionStatus } = useVoiceChat();
  const characterRef = useRef();
  const defaultPosition = [0, 2, 0];
  
  // Log remote player initialization and skateboard state changes
  useEffect(() => {
    console.log(`[RemotePlayer] Initializing player ${id} with animation: ${animation}, skateboard: ${showSkateboard}`);
  }, []);

  // Log when skateboard state changes
  useEffect(() => {
    console.log(`[RemotePlayer] Player ${id} skateboard state changed to: ${showSkateboard}`);
  }, [showSkateboard, id]);

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
      userData={{ type: 'player', id: id }}
    >
      <group rotation-y={rotation}>
        <Character color={color} animation={animation} />
        
        {/* Add skateboard under the remote player's feet if enabled */}
        {showSkateboard && (
          <group
            position={[0, animation.includes('jump') ? -0.02 : -0.038, 0]} // Change vertical position based on jump state
          >
            <PlayerSkateboard 
              scale={0.0055} 
              position={[0, 0, 0]} // Position relative to the parent group
              rotation={[0, rotation, 0]}
            />
          </group>
        )}
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
      
      {/* Voice chat indicator */}
      {isVoiceChatEnabled && connectionStatus[id] === 'connected' && (
        <Html position={[0, 0.8, 0]} center distanceFactor={8}>
          <div 
            className={styles.voiceChatIndicator}
            style={{
              fontSize: '0.6em', // 1/4 the size of emoji (2em * 0.3 = 0.6em)
              opacity: voiceActivity[id] ? 1 : 0.7,
              transform: voiceActivity[id] ? 'scale(3.07664)' : 'scale(3.07664)',
              transition: 'all 0.2s ease',
              filter: voiceActivity[id] ? 'drop-shadow(0 0 3px #4CAF50)' : 'none'
            }}
          >
            🔊
          </div>
        </Html>
      )}
      
      {/* Tag game indicator - red for IT, blue for players */}
      <TagPlayerIndicator playerId={id} />
      
      {/* Voice activity indicator */}
      {/* Removed VoiceActivityIndicator to eliminate floating circle */}
    </RigidBody>
  );
} 