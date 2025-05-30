// playerUtils.js - Utility functions for player manipulation (Three.js)
// Usage: import { setPlayerRef, teleportTo, freezeMovement } from './playerUtils';

import * as THREE from 'three';

let playerRef = null; // Should be a THREE.Object3D or compatible

/**
 * Set the global player reference (for teleportation, freezing, etc)
 * @param {THREE.Object3D} ref - The player's object reference
 */
export const setPlayerRef = (ref) => {
  playerRef = ref;
};

/**
 * Teleport the player to a given position
 * @param {THREE.Vector3|Array} pos - Target position (THREE.Vector3 or [x, y, z])
 */
export const teleportTo = (pos) => {
  if (!playerRef) return;
  if (pos instanceof THREE.Vector3) {
    playerRef.position.copy(pos);
  } else if (Array.isArray(pos) && pos.length === 3) {
    playerRef.position.set(pos[0], pos[1], pos[2]);
  }
};

/**
 * Freeze or unfreeze player movement (stub - to be implemented with your input system)
 * @param {boolean} freeze - true to freeze, false to unfreeze
 */
export const freezeMovement = (freeze) => {
  // TODO: Integrate with your input or velocity system
  // Example: playerRef.userData.frozen = freeze;
  // Or disable input controls, or set velocity to zero
  if (playerRef) {
    playerRef.userData = playerRef.userData || {};
    playerRef.userData.frozen = freeze;
  }
};

/**
 * Get the current player reference
 * @returns {THREE.Object3D|null}
 */
export const getPlayerRef = () => playerRef;
