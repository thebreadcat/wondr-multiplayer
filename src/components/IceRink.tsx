import React, { useCallback, useRef, useState, useEffect } from 'react';
import { RigidBody, BallCollider, CylinderCollider } from '@react-three/rapier';
import { Sphere } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { RapierRigidBody } from '@react-three/rapier';
import { Vector3 } from 'three';

// Extend window interface for ice physics
declare global {
  interface Window {
    characterController?: {
      rigidBody?: React.RefObject<RapierRigidBody>;
    };
    icePhysicsActive?: {
      accelerationMultiplier: number;
      decelerationMultiplier: number;
      maxSpeedMultiplier: number;
      playerId: string;
    };
  }
}

interface IceRinkProps {
  position?: [number, number, number];
  radius?: number;
  mini?: boolean;
  children?: React.ReactNode;
}

export function IceRink({ position = [0, 0, 0], radius = 1.8, mini = false, children }: IceRinkProps) {
  const rinkRef = useRef<RapierRigidBody>(null);
  const [playersInRink, setPlayersInRink] = useState<Set<RapierRigidBody>>(new Set());

  // Scale down dimensions for mini ice rinks
  const scale = mini ? 1/3 : 1;
  const effectiveRadius = radius * scale;
  const baseHeight = 0.2 * scale;
  const baseExtension = 0.3 * scale;

  // Ice physics parameters - based on game development best practices
  const icePhysicsConfig = {
    friction: 0.001,           // Extremely low friction
    restitution: 0.05,         // Very low bounce
    linearDamping: 0.02,       // Even lower damping for better momentum preservation
    // Movement modification factors
    accelerationMultiplier: 0.1, // 25% of normal acceleration on ice (even slower)
    decelerationMultiplier: 0.01, // 5% of normal deceleration on ice (much slower stopping)
    maxSpeedMultiplier: 2.0,      // 200% of normal max speed - as fast as running!
  };

  // Apply ice physics to a player
  const applyIcePhysics = (rigidBody: RapierRigidBody) => {
    const userData = rigidBody.userData as { type: string; id: string };
    console.log('🧊 ✅ Applying advanced ice physics to player:', userData.id);
    
    // Store original physics values
    (rigidBody as any)._originalLinearDamping = rigidBody.linearDamping();
    
    // Apply ice-specific linear damping for momentum preservation
    rigidBody.setLinearDamping(icePhysicsConfig.linearDamping);
    
    // Apply ice physics to all colliders
    const numColliders = rigidBody.numColliders();
    console.log('🧊 Number of colliders:', numColliders);
    
    for (let i = 0; i < numColliders; i++) {
      const collider = rigidBody.collider(i);
      if (collider) {
        // Store original values
        (collider as any)._originalFriction = collider.friction();
        (collider as any)._originalRestitution = collider.restitution();
        
        // Apply ice physics
        collider.setFriction(icePhysicsConfig.friction);
        collider.setRestitution(icePhysicsConfig.restitution);
        
        console.log('🧊 Applied to collider', i, '- friction:', icePhysicsConfig.friction, 'restitution:', icePhysicsConfig.restitution);
      }
    }
    
    // Set up ice movement modifiers for the character controller
    if (window.characterController && window.characterController.rigidBody?.current === rigidBody) {
      window.icePhysicsActive = {
        accelerationMultiplier: icePhysicsConfig.accelerationMultiplier,
        decelerationMultiplier: icePhysicsConfig.decelerationMultiplier,
        maxSpeedMultiplier: icePhysicsConfig.maxSpeedMultiplier,
        playerId: userData.id
      };
      console.log('🧊 ✅ Applied movement modifiers:', window.icePhysicsActive);
    }
    
    console.log('🧊 ✅ Ice physics applied - damping:', icePhysicsConfig.linearDamping);
  };

  // Remove ice physics from a player
  const removeIcePhysics = (rigidBody: RapierRigidBody) => {
    const userData = rigidBody.userData as { type: string; id: string };
    console.log('🧊 ✅ Removing advanced ice physics from player:', userData.id);
    
    // Restore original linear damping
    const originalLinearDamping = (rigidBody as any)._originalLinearDamping || 0.95;
    rigidBody.setLinearDamping(originalLinearDamping);
    delete (rigidBody as any)._originalLinearDamping;
    
    // Restore original collider physics
    const numColliders = rigidBody.numColliders();
    for (let i = 0; i < numColliders; i++) {
      const collider = rigidBody.collider(i);
      if (collider) {
        const originalFriction = (collider as any)._originalFriction || 0.7;
        const originalRestitution = (collider as any)._originalRestitution || 0.1;
        
        collider.setFriction(originalFriction);
        collider.setRestitution(originalRestitution);
        
        delete (collider as any)._originalFriction;
        delete (collider as any)._originalRestitution;
        
        console.log('🧊 Restored collider', i, '- friction:', originalFriction, 'restitution:', originalRestitution);
      }
    }
    
    // Remove ice movement modifiers
    if (window.icePhysicsActive && window.icePhysicsActive.playerId === userData.id) {
      delete window.icePhysicsActive;
      console.log('🧊 ✅ Removed movement modifiers');
    }
    
    console.log('🧊 ✅ Ice physics removed - damping restored:', originalLinearDamping);
  };

  // Enhanced frame-based ice physics simulation
  useFrame((state, delta) => {
    if (!rinkRef.current || playersInRink.size === 0) return;

    // Apply minimal continuous ice forces to players in the rink
    // Focus more on the character controller's deceleration handling
    playersInRink.forEach(rigidBody => {
      const userData = rigidBody.userData as { type: string; id: string };
      if (!rigidBody || userData?.type !== 'player') return;

      const velocity = rigidBody.linvel();
      const speed = Math.sqrt(velocity.x * velocity.x + velocity.z * velocity.z);

      // Only apply very small momentum preservation forces when moving slowly
      // This helps maintain the sliding effect without overpowering the character controller
      if (speed > 0.1 && speed < 2) {
        const normalizedVel = new Vector3(velocity.x, 0, velocity.z).normalize();
        const iceForce = normalizedVel.multiplyScalar(0.2 * delta); // Reduced force
        
        // Apply the minimal ice momentum force
        rigidBody.applyImpulse({
          x: iceForce.x,
          y: 0,
          z: iceForce.z
        }, true);
      }
    });
  });

  const handleIntersectionEnter = (other: any) => {
    console.log('🧊 Raw collision enter event:', other);
    
    // Use the actual Rapier rigidBody, not the rigidBodyObject (Three.js object)
    const rigidBody = other.rigidBody;
    console.log('🧊 Rapier rigidBody:', rigidBody);
    console.log('🧊 RigidBody userData:', rigidBody?.userData);
    
    const userData = rigidBody?.userData as { type: string; id: string };
    if (rigidBody && userData?.type === 'player') {
      applyIcePhysics(rigidBody);
      
      setPlayersInRink(prev => {
        const newSet = new Set(prev);
        newSet.add(rigidBody);
        return newSet;
      });
    } else {
      console.log('🧊 ❌ Not a player or no userData on enter:', userData);
    }
  };

  const handleIntersectionExit = (other: any) => {
    console.log('🧊 Raw collision exit event:', other);
    
    // Use the actual Rapier rigidBody, not the rigidBodyObject
    const rigidBody = other.rigidBody;
    console.log('🧊 Exit rigidBody:', rigidBody);
    console.log('🧊 Exit userData:', rigidBody?.userData);
    
    const userData = rigidBody?.userData as { type: string; id: string };
    if (rigidBody && userData?.type === 'player') {
      removeIcePhysics(rigidBody);
      
      setPlayersInRink(prev => {
        const newSet = new Set(prev);
        newSet.delete(rigidBody);
        return newSet;
      });
    } else {
      console.log('🧊 ❌ Not a player or no userData on exit:', userData);
    }
  };

  return (
    <group position={position}>
      {/* Solid platform for characters to stand on */}
      <RigidBody
        type="fixed"
        position={[0, baseHeight/2, 0]}
      >
        <CylinderCollider args={[baseHeight/2, effectiveRadius]} />
      </RigidBody>
      
      {/* Invisible sensor sphere to detect when players enter/exit - positioned at platform level */}
      <RigidBody
        ref={rinkRef}
        type="fixed"
        sensor
        onIntersectionEnter={({ other }) => handleIntersectionEnter(other)}
        onIntersectionExit={({ other }) => handleIntersectionExit(other)}
        position={[0, baseHeight/2, 0]}
      >
        <BallCollider args={[effectiveRadius + 0.2]} />
      </RigidBody>
      
      {/* Simple ice pad - like jump pad but blue - positioned on ground */}
      <mesh position={[0, baseHeight/2, 0]}>
        <cylinderGeometry args={[effectiveRadius, effectiveRadius, baseHeight, 16]} />
        <meshStandardMaterial 
          color="#87CEEB" 
          transparent 
          opacity={0.8}
          roughness={0.1}
          metalness={0.3}
        />
      </mesh>
      
      {children}
    </group>
  );
} 