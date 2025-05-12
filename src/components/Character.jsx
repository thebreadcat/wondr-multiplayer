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
    const cloned = clone(scene);
    setLocalScene(cloned);

    // Attach ref to correct animation root
    const root = cloned.getObjectByName('fall_guys') || cloned;
    animationRef.current = root;

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

  useEffect(() => {
    if (!actions) return;

    // Stop previous animations
    Object.values(actions).forEach((a) => a?.fadeOut?.(0.2));

    // Play current
    const current = actions[animation] || actions['idle'];
    if (current) {
      current.reset().fadeIn(0.2).play();
    }
  }, [actions, animation]);

  if (!localScene) return null;

  return (
    <group position={position} rotation={rotation} scale={0.18}>
      <primitive object={localScene} />
    </group>
  );
}
