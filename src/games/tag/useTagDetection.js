/**
 * useTagDetection.js
 * Optimized tag detection system using spatial partitioning and client-side detection
 */
import { useEffect, useRef } from 'react';
import { useMultiplayer } from '../../components/MultiplayerProvider';
import { SpatialGrid } from '../../utils/spatialGrid';

// Tag detection distance (how close players need to be to tag)
const TAG_DISTANCE = 2.5;

/**
 * Hook for optimized tag detection
 * Only the player who is "IT" will check for collisions with other players
 */
export function useTagDetection({ 
  isGameActive, 
  isTagged, 
  myId, 
  gameType, 
  roomId,
  playerPositions,
  onTagPlayer
}) {
  // Create refs to prevent unnecessary re-renders
  const spatialGridRef = useRef(null);
  const lastTagAttemptRef = useRef(0);
  const { socket } = useMultiplayer();
  
  // Initialize spatial grid
  useEffect(() => {
    if (!spatialGridRef.current) {
      // Create a spatial grid with 10 unit cell size and 200x200 world size
      spatialGridRef.current = new SpatialGrid(10, 200, 200);
    }
    
    // Clean up function
    return () => {
      spatialGridRef.current = null;
    };
  }, []);
  
  // Update player positions in spatial grid and check for tags
  useEffect(() => {
    if (!isGameActive || !isTagged || !myId || !spatialGridRef.current || !socket) {
      return;
    }
    
    const grid = spatialGridRef.current;
    
    // Update all player positions in the grid
    Object.entries(playerPositions).forEach(([playerId, position]) => {
      grid.updateEntity(playerId, position);
    });
    
    // Only the player who is "IT" checks for tags
    if (isTagged) {
      // Throttle tag detection to avoid excessive checks
      const now = Date.now();
      if (now - lastTagAttemptRef.current < 200) { // Check every 200ms
        return;
      }
      lastTagAttemptRef.current = now;
      
      // Get nearby players using spatial grid
      const nearbyPlayers = grid.getNearbyEntities(myId, TAG_DISTANCE * 2);
      
      // My position
      const myPosition = grid.entityPositions[myId];
      if (!myPosition) return;
      
      // Check distance to each nearby player
      for (const playerId of nearbyPlayers) {
        const playerPosition = grid.entityPositions[playerId];
        if (!playerPosition) continue;
        
        // Calculate distance (only using X and Z coordinates for horizontal distance)
        const dx = myPosition.x - playerPosition.x;
        const dz = myPosition.z - playerPosition.z;
        const distance = Math.sqrt(dx * dx + dz * dz);
        
        // If player is within tag distance, tag them
        if (distance <= TAG_DISTANCE) {
          console.log(`[TagDetection] Tagged player ${playerId} at distance ${distance.toFixed(2)}`);
          
          // Call the tag handler function
          onTagPlayer(playerId);
          
          // Only tag one player at a time
          break;
        }
      }
    }
  }, [isGameActive, isTagged, myId, playerPositions, socket, onTagPlayer]);
  
  return {
    // Return any useful functions or state here
  };
}
