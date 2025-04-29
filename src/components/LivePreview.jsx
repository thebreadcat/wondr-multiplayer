import React from 'react';
import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import BlobRenderer from './BlobRenderer';

export default function LivePreview({ color, accessories, face }) {
  const mountRef = useRef();

  useEffect(() => {
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000);
    camera.position.z = 5;
    const renderer = new THREE.WebGLRenderer({ alpha: true });
    renderer.setSize(300, 300);
    mountRef.current.appendChild(renderer.domElement);

    const light = new THREE.DirectionalLight(0xffffff, 1);
    light.position.set(5, 10, 7.5);
    scene.add(light);

    const blob = new THREE.Group();
    blob.add(new BlobRenderer({ color, accessories, face }));
    scene.add(blob);

    function animate() {
      requestAnimationFrame(animate);
      blob.rotation.y += 0.01;
      renderer.render(scene, camera);
    }
    animate();

    return () => {
      if (mountRef.current && renderer.domElement.parentNode === mountRef.current) {
        mountRef.current.removeChild(renderer.domElement);
      }
    };
  }, [color, accessories, face]);

  return <div ref={mountRef}></div>;
}
