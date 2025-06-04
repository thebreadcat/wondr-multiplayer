import React, { useRef, useEffect, useState } from 'react';
import { RigidBody, useRapier } from '@react-three/rapier';
import { useFrame } from '@react-three/fiber';
import { Vector3 } from 'three';
import { useMultiplayer } from './MultiplayerProvider';
import { Html } from '@react-three/drei';

export default function Portal({ 
  portalA = [0, 1, 0], 
  portalB = [10, 1, 0], 
  rotationA = [0, 0, 0], // [x, y, z] rotation in radians for Portal A
  rotationB = [0, 0, 0], // [x, y, z] rotation in radians for Portal B
  radius = 1.5, 
  thickness = 0.2,
  cooldownMs = 1000 // Prevent rapid teleportation
}) {
  const portalARef = useRef();
  const portalBRef = useRef();
  const lastTeleportTime = useRef(0);
  const teleportedPlayers = useRef(new Set());
  const lastCheckTimeRef = useRef(0);
  const checkIntervalMs = 50; // Check every 50ms for responsive teleportation
  
  // Fade transition state
  const [isFading, setIsFading] = useState(false);
  const fadeTimeoutRef = useRef(null);
  
  const { players, myId } = useMultiplayer();
  const { world } = useRapier();
  
  useFrame((state, delta) => {
    if (!portalARef.current || !portalBRef.current) return;
    
    const currentTime = Date.now();
    
    // Clear teleported players after cooldown
    if (currentTime - lastTeleportTime.current > cooldownMs) {
      teleportedPlayers.current.clear();
      lastTeleportTime.current = currentTime;
    }
    
    // Throttle position checks
    if (currentTime - lastCheckTimeRef.current > checkIntervalMs) {
      lastCheckTimeRef.current = currentTime;
      
      // Check all players for portal entry
      Object.entries(players).forEach(([playerId, player]) => {
        if (!player.position || teleportedPlayers.current.has(playerId)) return;
        
        const playerPos = player.position;
        
        // Check distance to Portal A
        const dxA = playerPos[0] - portalA[0];
        const dyA = playerPos[1] - portalA[1];
        const dzA = playerPos[2] - portalA[2];
        const distanceASquared = dxA * dxA + dyA * dyA + dzA * dzA;
        const inPortalA = distanceASquared <= radius * radius;
        
        // Check distance to Portal B
        const dxB = playerPos[0] - portalB[0];
        const dyB = playerPos[1] - portalB[1];
        const dzB = playerPos[2] - portalB[2];
        const distanceBSquared = dxB * dxB + dyB * dyB + dzB * dzB;
        const inPortalB = distanceBSquared <= radius * radius;
        
        // Teleport logic for local player only
        if (playerId === myId) {
          let teleportTarget = null;
          let teleportRotation = null;
          
          if (inPortalA) {
            teleportTarget = portalB;
            teleportRotation = rotationB;
            console.log(`[Portal] Player ${playerId} entered Portal A, teleporting to Portal B`);
          } else if (inPortalB) {
            teleportTarget = portalA;
            teleportRotation = rotationA;
            console.log(`[Portal] Player ${playerId} entered Portal B, teleporting to Portal A`);
          }
          
          if (teleportTarget) {
            // Start fade transition
            setIsFading(true);
            
            // Find the local player's rigid body
            let localPlayerRigidBody = null;
            
            world.forEachRigidBody((rigidBody) => {
              const userData = rigidBody.userData;
              if (userData && userData.type === 'player' && userData.id === myId) {
                localPlayerRigidBody = rigidBody;
                return false; // Break the loop
              }
            });
            
            if (localPlayerRigidBody) {
              // Calculate offset position based on portal rotation
              // Increased offset to spawn outside portal range to prevent immediate re-teleportation
              const forwardOffset = radius + 1.5; // Spawn outside portal radius + extra buffer
              
              // Calculate forward direction based on portal rotation (Y rotation primarily)
              const yRotation = teleportRotation[1];
              const forwardX = Math.sin(yRotation) * forwardOffset;
              const forwardZ = Math.cos(yRotation) * forwardOffset;
              
              // Delay the actual teleportation to allow fade effect
              setTimeout(() => {
                // Teleport the player
                const teleportPos = {
                  x: teleportTarget[0] + forwardX,
                  y: teleportTarget[1] + 0.5, // Slightly above the portal
                  z: teleportTarget[2] + forwardZ
                };
                
                localPlayerRigidBody.setTranslation(teleportPos, true);
                
                // Preserve some velocity but reduce it to prevent launching
                const currentVel = localPlayerRigidBody.linvel();
                localPlayerRigidBody.setLinvel({
                  x: currentVel.x * 0.3, // Reduced velocity preservation
                  y: Math.max(currentVel.y, 0), // Don't carry downward velocity
                  z: currentVel.z * 0.3
                }, true);
                
                console.log(`[Portal] Teleported player ${playerId} to`, teleportPos);
                
                // End fade transition after teleportation
                setTimeout(() => {
                  setIsFading(false);
                }, 200); // Fade out duration
                
              }, 300); // Fade in duration before teleport
              
              // Mark player as teleported to prevent immediate re-teleportation
              teleportedPlayers.current.add(playerId);
            }
          }
        }
      });
    }
  });

  return (
    <>
      {/* Fade overlay during teleportation */}
      {isFading && (
        <Html fullscreen>
          <div 
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              backgroundColor: 'rgba(0, 0, 0, 0.8)',
              zIndex: 9999,
              pointerEvents: 'none',
              transition: 'opacity 0.3s ease-in-out'
            }}
          />
        </Html>
      )}
      
      {/* Portal A */}
      <RigidBody
        ref={portalARef}
        type="fixed"
        position={portalA}
        rotation={rotationA}
        colliders={false}
        userData={{ type: 'portalA' }}
      >
        {/* Outer ring - blue */}
        <mesh rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[radius + 0.1, radius + 0.1, thickness, 32]} />
          <meshStandardMaterial 
            color="#0066ff"
            emissive="#001133"
            emissiveIntensity={0.3}
            metalness={0.8}
            roughness={0.2}
            transparent={true}
            opacity={0.8}
          />
        </mesh>
        
        {/* Inner portal area - glowing blue */}
        <mesh rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[radius - 0.1, radius - 0.1, thickness * 0.5, 32]} />
          <meshStandardMaterial 
            color="#4488ff"
            emissive="#2266dd"
            emissiveIntensity={0.8}
            transparent={true}
            opacity={0.6}
          />
        </mesh>
      </RigidBody>
      
      {/* Portal B */}
      <RigidBody
        ref={portalBRef}
        type="fixed"
        position={portalB}
        rotation={rotationB}
        colliders={false}
        userData={{ type: 'portalB' }}
      >
        {/* Outer ring - orange */}
        <mesh rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[radius + 0.1, radius + 0.1, thickness, 32]} />
          <meshStandardMaterial 
            color="#ff6600"
            emissive="#331100"
            emissiveIntensity={0.3}
            metalness={0.8}
            roughness={0.2}
            transparent={true}
            opacity={0.8}
          />
        </mesh>
        
        {/* Inner portal area - glowing orange */}
        <mesh rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[radius - 0.1, radius - 0.1, thickness * 0.5, 32]} />
          <meshStandardMaterial 
            color="#ff8844"
            emissive="#dd6622"
            emissiveIntensity={0.8}
            transparent={true}
            opacity={0.6}
          />
        </mesh>
      </RigidBody>
    </>
  );
} 