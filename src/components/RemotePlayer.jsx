import React, { useRef, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { Character } from './Character';
import { Html } from '@react-three/drei';
import { useMultiplayer } from './MultiplayerProvider';
import { Vector3, MathUtils } from 'three';
import styles from './RemotePlayer.module.css';

const RemotePlayer = ({ player }) => {
  const ref = useRef();
  const { position, color, rotation = 0, animation = 'idle', id } = player;
  const { emojis } = useMultiplayer();

  // Initialize target position and rotation
  const targetPosition = useRef(new Vector3(...position));
  const targetRotation = useRef(rotation);

  // Update targets when network data arrives
  useEffect(() => {
    if (position) {
      targetPosition.current.set(...position);
    }
  }, [position]);

  useEffect(() => {
    if (typeof rotation === 'number') {
      targetRotation.current = rotation;
    }
  }, [rotation]);

  // Smoothly interpolate position and rotation
  useFrame(() => {
    if (ref.current) {
      // Position interpolation
      ref.current.position.lerp(targetPosition.current, 0.2);
      
      // Rotation interpolation
      const currentY = ref.current.rotation.y;
      ref.current.rotation.y = MathUtils.lerp(
        currentY,
        targetRotation.current,
        0.2
      );
    }
  });

  const emojiValue = emojis[id]?.value;

  return (
    <group ref={ref}>
      <Character 
        color={color}
        animation={animation}
        playerId={id}
      />
      {emojiValue && (
        <Html
          position={[0, 1, 0]}
          center
          distanceFactor={8}
        >
          <div className={styles.emojiContainer}>
            {emojiValue}
          </div>
        </Html>
      )}
    </group>
  );
};

export default RemotePlayer; 