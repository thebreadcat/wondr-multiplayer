import { Vector3 } from 'three';

/**
 * Utility functions for efficient collision detection using sphere collisions
 * Uses a two-phase approach: broad phase (spatial grid) and narrow phase (precise distance checks)
 */

/**
 * Check if two spheres are colliding
 * @param {Object|Array} pos1 - Position of first entity
 * @param {Object|Array} pos2 - Position of second entity
 * @param {number} radius1 - Radius of first entity
 * @param {number} radius2 - Radius of second entity
 * @returns {boolean} - True if spheres are colliding
 */
export function checkSpheresCollision(pos1, pos2, radius1 = 0.75, radius2 = 0.75) {
  // Convert positions to Vector3
  const position1 = new Vector3(
    pos1.x !== undefined ? pos1.x : (pos1[0] || 0),
    pos1.y !== undefined ? pos1.y : (pos1[1] || 0),
    pos1.z !== undefined ? pos1.z : (pos1[2] || 0)
  );
  
  const position2 = new Vector3(
    pos2.x !== undefined ? pos2.x : (pos2[0] || 0),
    pos2.y !== undefined ? pos2.y : (pos2[1] || 0),
    pos2.z !== undefined ? pos2.z : (pos2[2] || 0)
  );
  
  // Calculate distance between centers
  const distance = position1.distanceTo(position2);
  
  // Collision occurs when distance is less than the sum of radii
  return distance < (radius1 + radius2);
}

/**
 * Get distance between two positions
 * @param {Object|Array} pos1 - Position of first entity
 * @param {Object|Array} pos2 - Position of second entity
 * @returns {number} - Distance between positions
 */
export function getDistance(pos1, pos2) {
  // Convert positions to Vector3
  const position1 = new Vector3(
    pos1.x !== undefined ? pos1.x : (pos1[0] || 0),
    pos1.y !== undefined ? pos1.y : (pos1[1] || 0),
    pos1.z !== undefined ? pos1.z : (pos1[2] || 0)
  );
  
  const position2 = new Vector3(
    pos2.x !== undefined ? pos2.x : (pos2[0] || 0),
    pos2.y !== undefined ? pos2.y : (pos2[1] || 0),
    pos2.z !== undefined ? pos2.z : (pos2[2] || 0)
  );
  
  // Calculate distance between positions
  return position1.distanceTo(position2);
}

/**
 * Standardize a position object to {x, y, z} format
 * @param {Object|Array} position - Position in any supported format
 * @returns {Object} - Standardized position {x, y, z}
 */
export function standardizePosition(position) {
  if (!position) return { x: 0, y: 0, z: 0 };
  
  return {
    x: position.x !== undefined ? position.x : (position[0] || 0),
    y: position.y !== undefined ? position.y : (position[1] || 0),
    z: position.z !== undefined ? position.z : (position[2] || 0)
  };
}
