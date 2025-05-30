import React, { useRef, useEffect, useState } from 'react';
import { useGLTF, useAnimations } from '@react-three/drei';
import { clone } from 'three/examples/jsm/utils/SkeletonUtils';
import * as THREE from 'three';

const MODEL_PATH = '/models/character.glb';
useGLTF.preload(MODEL_PATH);

export function Character({
  color = 'mediumpurple',
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  animation = 'idle',
}) {
  const animationRef = useRef();
  const [localScene, setLocalScene] = useState(null);
  const { scene, animations } = useGLTF(MODEL_PATH);

  // Clone scene only once
  useEffect(() => {
    console.log('[Character] Initializing character model');
    const cloned = clone(scene);
    setLocalScene(cloned);

    // Attach ref to correct animation root
    const root = cloned.getObjectByName('fall_guys') || cloned;
    animationRef.current = root;
    
    // Immediately try to play idle animation to prevent T-pose
    if (animations && animations.length > 0) {
      console.log('[Character] Attempting to play idle animation immediately');
      const mixer = new THREE.AnimationMixer(root);
      const idleClip = animations.find(clip => clip.name === 'idle');
      if (idleClip) {
        const action = mixer.clipAction(idleClip);
        action.play();
        mixer.update(0.01); // Force an update to apply the animation
      }
    }

    // Create new clean materials for all meshes
    const newMaterial = new THREE.MeshStandardMaterial({
      roughness: 0.5,
      metalness: 0.2,
    });

    // Apply the new material to all meshes
    cloned.traverse((child) => {
      if (child.isMesh) {
        // Save original material properties we want to keep
        const originalMaterial = child.material;
        const originalSide = originalMaterial.side;
        const originalTransparent = originalMaterial.transparent;
        const originalOpacity = originalMaterial.opacity;
        
        // Clone our new material for each mesh
        child.material = newMaterial.clone();
        
        // Preserve important original properties
        child.material.side = originalSide;
        child.material.transparent = originalTransparent;
        child.material.opacity = originalOpacity;
      }
    });
  }, [scene]);

  // Update color directly on materials
  useEffect(() => {
    if (!localScene) return;
    localScene.traverse((child) => {
      if (child.isMesh && child.material) {
        // Make sure all meshes receive the same exact color
        child.material.color.set(color);
        // Disable any maps or textures that might interfere with the color
        child.material.map = null;
        child.material.emissiveMap = null;
        child.material.normalMap = null;
        child.material.specularMap = null;
        child.material.roughnessMap = null;
        child.material.metalnessMap = null;
        child.material.alphaMap = null;
        child.material.aoMap = null;
        child.material.lightMap = null;
      }
    });
  }, [color, localScene]);

  // Hook into animations
  const { actions } = useAnimations(animations, animationRef);
  const prevAnimationRef = useRef('idle');
  const animationsLoggedRef = useRef(false);

  // Log available animations once
  useEffect(() => {
    if (actions && !animationsLoggedRef.current) {
      console.log('[Character] Available animations:', Object.keys(actions));
      animationsLoggedRef.current = true;
    }
  }, [actions]);

  useEffect(() => {
    if (!actions) return;
    
    // Only change animation if it's actually different
    if (animation !== prevAnimationRef.current) {
      console.log(`[Character] Animation changing from ${prevAnimationRef.current} to ${animation}`);
      
      // Stop previous animations with a quick fadeOut
      Object.values(actions).forEach((a) => a?.fadeOut?.(0.2));

      // Play current animation
      const current = actions[animation];
      
      if (current) {
        current.reset().fadeIn(0.2).play();
        console.log(`[Character] Successfully playing animation: ${animation}`);
      } else {
        console.warn(`[Character] Animation not found: ${animation}, falling back to idle`);
        // Fallback to idle if the requested animation doesn't exist
        if (actions['idle']) {
          actions['idle'].reset().fadeIn(0.2).play();
        } else {
          // If even idle doesn't exist, try to find any animation to play
          const firstAnimation = Object.values(actions)[0];
          if (firstAnimation) {
            console.warn(`[Character] No idle animation found, using ${Object.keys(actions)[0]}`);
            firstAnimation.reset().fadeIn(0.2).play();
          }
        }
      }
      
      // Update the previous animation reference
      prevAnimationRef.current = animation;
    }
  }, [actions, animation]);

  if (!localScene) return null;

  return (
    <group position={position} rotation={rotation} scale={0.18}>
      <primitive object={localScene} />
    </group>
  );
}
