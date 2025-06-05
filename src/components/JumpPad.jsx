import React, { useRef, useEffect } from 'react';
import { RigidBody, useRapier } from '@react-three/rapier';
import { useFrame } from '@react-three/fiber';
import { Vector3 } from 'three';
import { useMultiplayer } from './MultiplayerProvider';

export default function JumpPad({ position = [0, 0, 0], baseForce = { x: 0, y: 7.5, z: 0 }, directionMultiplier = 4, radius = 1.8, mini = false }) {
  const jumpPadRef = useRef();
  const lastActivationTime = useRef(0);
  const activatedPlayers = useRef(new Set());
  const lastCheckTimeRef = useRef(0);
  const checkIntervalMs = 100; // Check every 100ms
  
  const { players, myId } = useMultiplayer();
  const { world } = useRapier();
  
  // Scale down dimensions for mini jump pads
  const scale = mini ? 1/3 : 1;
  const effectiveRadius = radius * scale;
  const baseHeight = 0.2 * scale;
  const baseExtension = 0.3 * scale;
  const padHeight = 0.2 * scale;
  const arrowScale = mini ? 0.5 : 1; // Arrow scales less aggressively
  
  useFrame((state, delta) => {
    if (!jumpPadRef.current) return;
    
    const currentTime = Date.now();
    
    // Clear activated players every 500ms to allow re-activation
    if (currentTime - lastActivationTime.current > 500) {
      activatedPlayers.current.clear();
      lastActivationTime.current = currentTime;
    }
    
    // Throttle position checks
    if (currentTime - lastCheckTimeRef.current > checkIntervalMs) {
      lastCheckTimeRef.current = currentTime;
      
      // Check all players (local and remote)
      Object.entries(players).forEach(([playerId, player]) => {
        if (!player.position) return;
        
        // Check distance to jump pad using effective radius
        const playerPos = player.position;
        const dx = playerPos[0] - position[0];
        const dz = playerPos[2] - position[2];
        const dy = playerPos[1] - position[1];
        const distanceSquared = dx * dx + dz * dz;
        const inZone = distanceSquared <= effectiveRadius * effectiveRadius && Math.abs(dy) < 2; // Within radius and reasonable height
        
        if (inZone && !activatedPlayers.current.has(playerId)) {
          activatedPlayers.current.add(playerId);
          
          // For local player, apply the jump force
          if (playerId === myId) {
            // Find the local player's rigid body using the physics world
            let localPlayerRigidBody = null;
            
            // Iterate through all rigid bodies in the world to find the local player
            world.forEachRigidBody((rigidBody) => {
              const userData = rigidBody.userData;
              if (userData && userData.type === 'player' && userData.id === myId) {
                localPlayerRigidBody = rigidBody;
                return false; // Break the loop
              }
            });
            
            if (localPlayerRigidBody) {
              // Get player's current velocity
              const velocity = localPlayerRigidBody.linvel();
              
              // Check if player is on the ground (Y velocity close to zero or slightly negative)
              // This prevents double jumping while in the air
              const isOnGround = velocity.y <= 0.5 && velocity.y >= -2.0;
              
              if (isOnGround) {
                // Calculate launch direction based on player movement
                const movementDirection = new Vector3(velocity.x, 0, velocity.z);
                const speed = movementDirection.length();
                
                // If player is moving, use their direction; otherwise use a default forward direction
                if (speed > 0.1) {
                  movementDirection.normalize();
                } else {
                  movementDirection.set(0, 0, 1); // Default forward direction
                }
                
                // Scale the direction by the multiplier
                const launchDirection = movementDirection.multiplyScalar(directionMultiplier);
                
                // Combine base force with directional force
                const finalForce = {
                  x: baseForce.x + launchDirection.x,
                  y: baseForce.y,
                  z: baseForce.z + launchDirection.z
                };
                
                // Apply the launch force
                localPlayerRigidBody.setLinvel(finalForce, true);
                
                // Notify the character controller about the jump pad effect
                if (window.jumpPadControls && window.jumpPadControls.notifyJumpPadEffect) {
                  window.jumpPadControls.notifyJumpPadEffect(myId);
                }
                
                // Visual feedback - make the jump pad glow briefly
                if (jumpPadRef.current && jumpPadRef.current.children && jumpPadRef.current.children.length > 1) {
                  const mesh = jumpPadRef.current.children[1]; // Target the green pad (second child)
                  if (mesh && mesh.material) {
                    const originalEmissive = mesh.material.emissive.clone();
                    mesh.material.emissive.setHex(0x00ff00);
                    setTimeout(() => {
                      if (mesh.material) {
                        mesh.material.emissive.copy(originalEmissive);
                      }
                    }, 200);
                  }
                }
              }
            }
          }
        }
      });
    }
  });

  return (
    <>
      <RigidBody
        ref={jumpPadRef}
        type="fixed"
        position={position}
        colliders={false}
        userData={{ type: 'jumpPad' }}
      >
        {/* Base platform - black foundation */}
        <mesh position={[0, 0.05 * scale, 0]}>
          <cylinderGeometry args={[effectiveRadius + baseExtension, effectiveRadius + baseExtension, baseHeight, 16]} />
          <meshStandardMaterial 
            color="#222222"
            metalness={0.8}
            roughness={0.2}
          />
        </mesh>
        
        {/* Main jump pad - green platform */}
        <mesh position={[0, 0.15 * scale, 0]}>
          <cylinderGeometry args={[effectiveRadius, effectiveRadius, padHeight, 16]} />
          <meshStandardMaterial 
            color="#00ff88"
            emissive="#004422"
            emissiveIntensity={0.5}
            metalness={0.1}
            roughness={0.3}
          />
        </mesh>
      </RigidBody>
      
      {/* Floating up arrow made from simple geometry - NO PHYSICS */}
      <group position={[position[0], position[1] + (2.5 * arrowScale), position[2]]}>
        {/* Arrow shaft - purely visual, no colliders */}
        <mesh position={[0, -0.3 * arrowScale, 0]}>
          <cylinderGeometry args={[0.05 * arrowScale, 0.05 * arrowScale, 0.6 * arrowScale, 8]} />
          <meshStandardMaterial 
            color="#00ff88"
            emissive="#004422"
            emissiveIntensity={0.3}
          />
        </mesh>
        
        {/* Arrow head - purely visual, no colliders */}
        <mesh position={[0, 0.2 * arrowScale, 0]}>
          <coneGeometry args={[0.2 * arrowScale, 0.4 * arrowScale, 8]} />
          <meshStandardMaterial 
            color="#00ff88"
            emissive="#004422"
            emissiveIntensity={0.3}
          />
        </mesh>
      </group>
    </>
  );
} 