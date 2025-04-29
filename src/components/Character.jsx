import React, { useRef, useEffect, useState } from 'react';
import { useGLTF, useAnimations } from '@react-three/drei';
import { clone } from 'three/examples/jsm/utils/SkeletonUtils';

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

    // Clone materials once
    cloned.traverse((child) => {
      if (child.isMesh && child.material) {
        child.material = child.material.clone();
      }
    });
  }, [scene]);

  // Update color directly on materials
  useEffect(() => {
    if (!localScene) return;
    localScene.traverse((child) => {
      if (child.isMesh && child.material && child.material.color) {
        child.material.color.set(color);
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
