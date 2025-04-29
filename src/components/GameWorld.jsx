import React from 'react';
import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import BlobRenderer from './BlobRenderer';
import CustomizeButton from './CustomizeButton';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';

export default function GameWorld({ playerData, onCustomize }) {
  const mountRef = useRef(null);

  useEffect(() => {
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 2, 5);
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    mountRef.current.appendChild(renderer.domElement);

    // OrbitControls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 1, 0);
    controls.enableDamping = true;
    controls.dampingFactor = 0.1;
    controls.minDistance = 3;
    controls.maxDistance = 20;

    const light = new THREE.DirectionalLight(0xffffff, 1);
    light.position.set(5, 10, 7.5);
    scene.add(light);

    // Ground
    const groundGeo = new THREE.PlaneGeometry(100, 100);
    const groundMat = new THREE.MeshStandardMaterial({ color: 0xdddddd });
    const groundMesh = new THREE.Mesh(groundGeo, groundMat);
    groundMesh.rotation.x = -Math.PI / 2;
    scene.add(groundMesh);

    // Ramp (visual only)
    const rampGeo = new THREE.BoxGeometry(4, 0.4, 2);
    const rampMat = new THREE.MeshStandardMaterial({ color: 0xaaddaa });
    const rampMesh = new THREE.Mesh(rampGeo, rampMat);
    rampMesh.position.set(5, 1, 0);
    rampMesh.rotation.set(-0.4, 0, 0);
    scene.add(rampMesh);

    // Add spiral planks with landings (visual only)
    const numPlanks = 10;
    const spiralRadius = 4;
    const spiralHeight = 0.7;
    const spiralStep = Math.PI / 5;
    const plankLength = 4.5;
    const plankWidth = 0.7;
    const landingSize = 1.5;
    const platforms = [];
    for (let i = 0; i < numPlanks; i++) {
      const angle = i * spiralStep;
      const x = Math.cos(angle) * spiralRadius;
      const z = Math.sin(angle) * spiralRadius;
      const y = 0.5 + i * spiralHeight;
      // Plank
      const plankGeometry = new THREE.BoxGeometry(plankLength, 0.2, plankWidth);
      const plankMaterial = new THREE.MeshStandardMaterial({ color: 0x888888 });
      const plank = new THREE.Mesh(plankGeometry, plankMaterial);
      plank.position.set(x, y, z);
      plank.rotation.y = -angle + Math.PI / 2;
      scene.add(plank);
      platforms.push(plank);
      // Landing
      const landingGeometry = new THREE.BoxGeometry(landingSize, 0.2, landingSize);
      const landingMaterial = new THREE.MeshStandardMaterial({ color: 0xaaaaaa });
      const landing = new THREE.Mesh(landingGeometry, landingMaterial);
      // Place landing at the end of the plank
      landing.position.set(
        x + Math.cos(angle) * (plankLength / 2 + landingSize / 2 - 0.1),
        y,
        z + Math.sin(angle) * (plankLength / 2 + landingSize / 2 - 0.1)
      );
      scene.add(landing);
      platforms.push(landing);
    }

    // Player state
    const playerRadius = 0.65;
    let playerPos = new THREE.Vector3(0, 5, 0);
    let playerVel = new THREE.Vector3(0, 0, 0);
    let canJump = false;

    // Player visual
    const blob = new THREE.Group();
    const bodyMesh = new BlobRenderer(playerData);
    blob.add(bodyMesh);
    scene.add(blob);

    // Input
    const keys = {};
    window.addEventListener('keydown', (e) => keys[e.code] = true);
    window.addEventListener('keyup', (e) => keys[e.code] = false);

    function checkGroundOrPlatform(pos) {
      // Check ground
      if (pos.y - playerRadius <= 0) return true;
      // Check platforms (AABB)
      for (const plat of platforms) {
        const p = plat.position;
        if (
          Math.abs(pos.x - p.x) < plat.scale.x * plat.geometry.parameters.width / 2 + playerRadius &&
          Math.abs(pos.z - p.z) < plat.scale.z * plat.geometry.parameters.depth / 2 + playerRadius &&
          Math.abs((pos.y - playerRadius) - (p.y + 0.1)) < 0.28
        ) {
          return true;
        }
      }
      // Check ramp (AABB, rough)
      if (
        playerPos.x > 3 && playerPos.x < 7 &&
        playerPos.z > -1.5 && playerPos.z < 1.5 &&
        playerPos.y - playerRadius < 1.2 &&
        playerPos.y - playerRadius > 0.7
      ) {
        return true;
      }
      return false;
    }

    function animate() {
      requestAnimationFrame(animate);

      // Movement
      let moveX = 0, moveZ = 0;
      const speed = keys['ShiftLeft'] ? 0.13 : 0.08;
      if (keys['KeyW']) moveZ -= 1;
      if (keys['KeyS']) moveZ += 1;
      if (keys['KeyA']) moveX -= 1;
      if (keys['KeyD']) moveX += 1;

      // Calculate movement direction relative to camera
      let isMoving = moveX !== 0 || moveZ !== 0;
      let moveAngle = null;
      let moveVec = new THREE.Vector3();
      if (isMoving) {
        const camY = camera.rotation.y;
        const localDir = new THREE.Vector3(moveX, 0, moveZ).normalize();
        moveVec.copy(localDir).applyAxisAngle(new THREE.Vector3(0, 1, 0), camY);
        playerVel.x += moveVec.x * speed;
        playerVel.z += moveVec.z * speed;
        moveAngle = Math.atan2(moveVec.x, moveVec.z);
      }

      // Gravity
      playerVel.y -= 0.018;

      // Clamp horizontal speed
      const maxSpeed = 0.18;
      const horizSpeed = Math.sqrt(playerVel.x * playerVel.x + playerVel.z * playerVel.z);
      if (horizSpeed > maxSpeed) {
        playerVel.x *= maxSpeed / horizSpeed;
        playerVel.z *= maxSpeed / horizSpeed;
      }

      // Simple drag
      playerVel.x *= 0.92;
      playerVel.z *= 0.92;

      // Jump
      if (keys['Space'] && canJump) {
        playerVel.y = 0.32;
        canJump = false;
      }

      // Update position
      playerPos.add(playerVel);

      // Collision with ground/platforms/ramp
      if (checkGroundOrPlatform(playerPos)) {
        if (playerVel.y < 0) playerVel.y = 0;
        // Snap to surface
        if (playerPos.y - playerRadius < 0.01) playerPos.y = playerRadius;
        else {
          // Snap to platform/ramp
          let snapped = false;
          for (const plat of platforms) {
            const p = plat.position;
            if (
              Math.abs(playerPos.x - p.x) < plat.scale.x * plat.geometry.parameters.width / 2 + playerRadius &&
              Math.abs(playerPos.z - p.z) < plat.scale.z * plat.geometry.parameters.depth / 2 + playerRadius &&
              Math.abs((playerPos.y - playerRadius) - (p.y + 0.1)) < 0.28
            ) {
              playerPos.y = p.y + 0.1 + playerRadius;
              snapped = true;
              break;
            }
          }
          // Snap to ramp
          if (!snapped && playerPos.x > 3 && playerPos.x < 7 && playerPos.z > -1.5 && playerPos.z < 1.5) {
            if (playerPos.y - playerRadius < 1.2 && playerPos.y - playerRadius > 0.7) {
              playerPos.y = Math.max(playerPos.y, 1.2 + playerRadius);
            }
          }
        }
        canJump = true;
      } else {
        canJump = false;
      }

      // Clamp player to world bounds
      playerPos.x = Math.max(Math.min(playerPos.x, 48), -48);
      playerPos.z = Math.max(Math.min(playerPos.z, 48), -48);
      playerPos.y = Math.max(playerPos.y, playerRadius);

      // Update blob position
      blob.position.copy(playerPos);

      // Rotate entire blob group to face movement direction
      if (moveAngle !== null) {
        blob.rotation.y = moveAngle;
      }

      // Animate arms and hands
      const leftArm = blob.getObjectByName('leftArm');
      const rightArm = blob.getObjectByName('rightArm');
      const leftHand = blob.getObjectByName('leftHand');
      const rightHand = blob.getObjectByName('rightHand');
      const t = performance.now() * 0.003;
      if (isMoving) {
        // Bounce arms/hands up and down, alternating
        const bounce = Math.sin(t * 8) * 0.12;
        if (leftArm) leftArm.position.y = 1.0 + bounce;
        if (rightArm) rightArm.position.y = 1.0 - bounce;
        if (leftHand) leftHand.position.y = 0.95 + bounce;
        if (rightHand) rightHand.position.y = 0.95 - bounce;
      } else {
        // Reset to default positions
        if (leftArm) leftArm.position.y = 1.0;
        if (rightArm) rightArm.position.y = 1.0;
        if (leftHand) leftHand.position.y = 0.95;
        if (rightHand) rightHand.position.y = 0.95;
      }

      // Camera controls update
      controls.update();

      renderer.render(scene, camera);
    }

    animate();

    return () => {
      if (mountRef.current && renderer.domElement.parentNode === mountRef.current) {
        mountRef.current.removeChild(renderer.domElement);
      }
    };
  }, [playerData]);

  return (
    <>
      <div ref={mountRef} />
      <CustomizeButton onClick={onCustomize} />
    </>
  );
}
