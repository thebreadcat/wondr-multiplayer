import * as THREE from 'three';

export default function BlobRenderer({ color, accessories = [], face, baseWiggle = 0 }) {
  const group = new THREE.Group();

  // Main body+head (raindrop shape, symmetrical, flat base)
  const bodyHeight = 2.5;
  const bodyRadius = 1.0;
  const widthSegments = 32;
  const heightSegments = 32;
  const bodyGeometry = new THREE.SphereGeometry(bodyRadius, widthSegments, heightSegments);
  // Calculate the flat bottom y value
  const bottomY = -bodyRadius * 0.98 * (bodyHeight / (bodyRadius * 2));
  // Shape the body as a raindrop: wide at base, narrows in middle, expands at top
  // Also, collect seam indices for smoothing
  const seamIndices = [];
  for (let i = 0; i < bodyGeometry.attributes.position.count; i++) {
    let x = bodyGeometry.attributes.position.getX(i);
    let y = bodyGeometry.attributes.position.getY(i);
    let z = bodyGeometry.attributes.position.getZ(i);
    // Leave the base and lid logic alone
    if (y < -bodyRadius * 0.98) {
      y = bottomY;
      // For base wiggle, store seam indices
      if (Math.abs(z) < 1e-5) seamIndices.push(i);
    } else if (y < -bodyRadius * 0.7) {
      // Lower region: blend into the body with a quadratic curve
      const t = (y + bodyRadius * 0.98) / (bodyRadius * 0.28);
      y = bottomY + 0.18 * Math.pow(t, 2);
    } else {
      // Stretch vertically
      y = y * (bodyHeight / (bodyRadius * 2));
    }
    // Raindrop profile: scale x/z based on y
    let tProfile = (y - bottomY) / (bodyHeight - (bottomY)); // 0 at base, 1 at top
    let scaleXZ;
    if (tProfile < 0.5) {
      scaleXZ = 1.05 - 0.35 * (tProfile / 0.5); // from 1.05 to 0.7
    } else {
      const s = (tProfile - 0.5) / 0.5;
      scaleXZ = 0.7 + 0.7 * (3 * s * s - 2 * s * s * s); // smoothstep from 0.7 to 1.4
    }
    x *= scaleXZ;
    z *= scaleXZ;
    bodyGeometry.attributes.position.setX(i, x);
    bodyGeometry.attributes.position.setY(i, y);
    bodyGeometry.attributes.position.setZ(i, z);
  }
  // Remove seam by averaging first and last longitude vertices for each latitude
  for (let iy = 0; iy <= heightSegments; iy++) {
    const first = iy * (widthSegments + 1);
    const last = first + widthSegments;
    const avgX = 0.5 * (bodyGeometry.attributes.position.getX(first) + bodyGeometry.attributes.position.getX(last));
    const avgY = 0.5 * (bodyGeometry.attributes.position.getY(first) + bodyGeometry.attributes.position.getY(last));
    const avgZ = 0.5 * (bodyGeometry.attributes.position.getZ(first) + bodyGeometry.attributes.position.getZ(last));
    bodyGeometry.attributes.position.setX(first, avgX);
    bodyGeometry.attributes.position.setY(first, avgY);
    bodyGeometry.attributes.position.setZ(first, avgZ);
    bodyGeometry.attributes.position.setX(last, avgX);
    bodyGeometry.attributes.position.setY(last, avgY);
    bodyGeometry.attributes.position.setZ(last, avgZ);
  }
  // Apply base wiggle to the base vertices
  if (baseWiggle !== 0) {
    for (const i of seamIndices) {
      const x = bodyGeometry.attributes.position.getX(i);
      bodyGeometry.attributes.position.setX(i, x + baseWiggle);
    }
  }
  bodyGeometry.computeVertexNormals();
  const bodyMaterial = new THREE.MeshStandardMaterial({ color });
  const bodyMesh = new THREE.Mesh(bodyGeometry, bodyMaterial);
  bodyMesh.position.y = bodyHeight / 2; // So the base touches y=0
  bodyMesh.name = 'body';
  group.add(bodyMesh);

  // Add a flat circle at the bottom to act as a lid, matching the body's bottom y
  const lidGeometry = new THREE.CircleGeometry(bodyRadius * 1.05, widthSegments);
  const lidMaterial = new THREE.MeshStandardMaterial({ color });
  const lidMesh = new THREE.Mesh(lidGeometry, lidMaterial);
  lidMesh.position.y = bottomY + bodyHeight / 2; // Match the body's bottom
  lidMesh.rotation.x = -Math.PI / 2; // Make it face upward
  lidMesh.name = 'bottomLid';
  // Apply base wiggle to the lid
  lidMesh.position.x = baseWiggle;
  group.add(lidMesh);

  // Arms (tapered cylinders, wider at body, narrower at hand)
  const armLength = 0.48; // shorter arms
  const armRadBody = 0.23;
  const armRadHand = 0.13;
  const armSegments = 24;
  // Left arm
  const leftArm = new THREE.Mesh(
    new THREE.CylinderGeometry(armRadHand, armRadBody, armLength, armSegments),
    bodyMaterial
  );
  leftArm.position.set(-0.95, bodyHeight * 0.82, 0); // higher arms
  leftArm.rotation.z = Math.PI / 2.1;
  leftArm.name = 'leftArm';
  group.add(leftArm);
  // Right arm
  const rightArm = new THREE.Mesh(
    new THREE.CylinderGeometry(armRadHand, armRadBody, armLength, armSegments),
    bodyMaterial
  );
  rightArm.position.set(0.95, bodyHeight * 0.82, 0); // higher arms
  rightArm.rotation.z = -Math.PI / 2.1;
  rightArm.name = 'rightArm';
  group.add(rightArm);

  // Hands (spheres, slightly overlapping arms)
  const handGeometry = new THREE.SphereGeometry(0.28, 24, 24);
  const leftHand = new THREE.Mesh(handGeometry, bodyMaterial);
  const rightHand = new THREE.Mesh(handGeometry, bodyMaterial);
  leftHand.position.set(-1.18, bodyHeight * 0.8, 0); // higher hands
  rightHand.position.set(1.18, bodyHeight * 0.8, 0);
  leftHand.name = 'leftHand';
  rightHand.name = 'rightHand';
  group.add(leftHand);
  group.add(rightHand);

  accessories.forEach(acc => {
    const mesh = createAccessoryMesh(acc.variant);
    mesh.position.set(acc.position.x, acc.position.y, acc.position.z);
    group.add(mesh);
  });

  // After geometry is created and modified, store the original top vertex y for head bobble
  let maxY = -Infinity, maxIdx = -1;
  for (let i = 0; i < bodyGeometry.attributes.position.count; i++) {
    const y = bodyGeometry.attributes.position.getY(i);
    if (y > maxY) {
      maxY = y;
      maxIdx = i;
    }
  }
  bodyGeometry.userData.baseTopY = maxY;
  bodyGeometry.userData.topIdx = maxIdx;

  return group;
}

function createAccessoryMesh(variant) {
  switch (variant) {
    case 'wizard':
      return new THREE.Mesh(new THREE.ConeGeometry(0.4, 0.5, 16), new THREE.MeshStandardMaterial({ color: 0xff00ff }));
    case 'backpack':
      return new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.6, 0.2), new THREE.MeshStandardMaterial({ color: 0x333333 }));
    default:
      return new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 0.3), new THREE.MeshStandardMaterial({ color: 0x999999 }));
  }
}
