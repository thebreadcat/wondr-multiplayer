/**
 * SpawnPositionHandler.jsx
 * Handles teleporting players to spawn positions when a tag game starts
 */
import React, { useEffect, useRef } from 'react';
import { useMultiplayer } from '../../components/MultiplayerProvider';
import { useGameSystem } from '../../components/GameSystemProvider';
import { getSocket } from '../../utils/socketManager';

// Initial spawn position (center of map)
const DEFAULT_SPAWN = [0, 0.1, 0];

export function SpawnPositionHandler({ setLocalPosition }) {
  const { myId } = useMultiplayer();
  const { activeGames } = useGameSystem();
  const hasHandledSpawn = useRef({});
  
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;
    
    // Handler for game start events
    const handleGameStart = (data) => {
      console.log(`[SpawnHandler] 🎮 Game start detected:`, data);
      
      // Store the game ID to prevent handling it multiple times
      const gameId = data.roomId || `${data.gameType}-1`;
      
      // Skip if we've already handled this game start
      if (hasHandledSpawn.current[gameId]) {
        console.log(`[SpawnHandler] ⏭️ Already handled spawn for game ${gameId}`);
        return;
      }
      
      // Mark as handled
      hasHandledSpawn.current[gameId] = true;
      
      // Delay teleportation slightly to ensure game state is fully updated
      setTimeout(() => {
        // Get spawn position for this player (or use default)
        const spawnIndex = data.spawnPositions?.[myId] || 0;
        
        // Default position is center of map
        const spawnPosition = DEFAULT_SPAWN;
        
        console.log(`[SpawnHandler] 🏁 Teleporting player ${myId.substring(0, 6)} to spawn position:`, spawnPosition);
        
        // Teleport the player to spawn position
        if (setLocalPosition) {
          setLocalPosition(spawnPosition);
        }
        
        // Also emit a move event to update other players
        socket.emit('move', {
          position: spawnPosition,
          rotation: 0,
          animation: 'idle'
        });
      }, 500); // Small delay to ensure game state is properly set up
    };
    
    // Listen for game start events
    socket.on('gameStart', handleGameStart);
    
    // Clean up
    return () => {
      socket.off('gameStart', handleGameStart);
    };
  }, [myId, setLocalPosition]);
  
  // Also handle cases where we might have missed the original game start event
  useEffect(() => {
    // Check if there's an active tag game
    const tagGame = Object.entries(activeGames || {}).find(
      ([key, game]) => game && game.gameType === 'tag' && game.state === 'playing'
    );
    
    if (tagGame) {
      const [gameId, gameData] = tagGame;
      
      // Skip if we've already handled this game
      if (hasHandledSpawn.current[gameId]) {
        return;
      }
      
      console.log(`[SpawnHandler] 🔍 Found active tag game that wasn't handled:`, gameId);
      
      // Handle as if it's a new game start
      setTimeout(() => {
        hasHandledSpawn.current[gameId] = true;
        
        // Use default spawn position since we don't have specific spawn data
        console.log(`[SpawnHandler] 🏁 Teleporting player to default spawn position:`, DEFAULT_SPAWN);
        
        // Teleport the player
        if (setLocalPosition) {
          setLocalPosition(DEFAULT_SPAWN);
        }
        
        // Also emit a move event to update other players
        const socket = getSocket();
        if (socket) {
          socket.emit('move', {
            position: DEFAULT_SPAWN,
            rotation: 0,
            animation: 'idle'
          });
        }
      }, 500);
    }
  }, [activeGames, myId, setLocalPosition]);
  
  // This component doesn't render anything
  return null;
}
