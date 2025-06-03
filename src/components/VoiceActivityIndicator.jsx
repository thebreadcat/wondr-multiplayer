import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { useVoiceChat } from './VoiceChatProvider';
import * as THREE from 'three';

export default function VoiceActivityIndicator({ playerId, position }) {
  const { voiceActivity } = useVoiceChat();
  const meshRef = useRef();
  const materialRef = useRef();
  
  const isActive = voiceActivity[playerId] || false;
  
  // Create a simple ring geometry for the voice indicator
  const geometry = useMemo(() => {
    return new THREE.RingGeometry(0.1, 0.15, 16);
  }, []);
  
  // Animate the indicator when voice is active
  useFrame((state) => {
    if (meshRef.current && materialRef.current) {
      if (isActive) {
        // Pulse animation when speaking
        const scale = 1 + Math.sin(state.clock.elapsedTime * 8) * 0.2;
        meshRef.current.scale.setScalar(scale);
        
        // Bright green when active
        materialRef.current.color.setHex(0x4CAF50);
        materialRef.current.opacity = 0.8 + Math.sin(state.clock.elapsedTime * 6) * 0.2;
      } else {
        // Fade out when not speaking
        meshRef.current.scale.setScalar(1);
        materialRef.current.color.setHex(0x757575);
        materialRef.current.opacity = 0.3;
      }
      
      // Always face the camera
      meshRef.current.lookAt(state.camera.position);
    }
  });
  
  if (!position) return null;
  
  return (
    <mesh
      ref={meshRef}
      position={[position[0], position[1] + 1.2, position[2]]}
      geometry={geometry}
    >
      <meshBasicMaterial
        ref={materialRef}
        transparent
        side={THREE.DoubleSide}
        depthWrite={false}
      />
    </mesh>
  );
} 