// Refactored GameSystemProvider.jsx
import React, { createContext, useContext, useEffect, useState } from 'react';
import { useMultiplayer } from './MultiplayerProvider';
import { getSocket } from '../utils/socketManager';

export const GameSystemContext = createContext();

export function GameSystemProvider({ children }) {
  const { players, myId } = useMultiplayer();
  const [activeGames, setActiveGames] = useState({});
  const [playerGameStatus, setPlayerGameStatus] = useState({});
  
  // Function to clean up invalid game formats
  const cleanupInvalidGameFormats = () => {
    setActiveGames(prev => {
      const cleanedGames = {};
      
      // Only copy valid game objects to the cleaned state
      Object.entries(prev || {}).forEach(([key, value]) => {
        if (typeof value === 'string') {
          console.log(`[GameSystemProvider] 🔧 Found string value in cleanup: ${key} -> ${value}`);
          
          // If this is a gameType -> roomId mapping (e.g., "tag" -> "tag-1")
          if (key === 'tag' && value.includes('-')) {
            const roomId = value;
            console.log(`[GameSystemProvider] 🔧 Converting tag -> roomId mapping to proper game object`);
            
            // Create a proper game object with the roomId as the key
            cleanedGames[roomId] = {
              gameType: 'tag',
              roomId,
              state: 'playing',
              players: [myId],
              startTime: Date.now(),
              endTime: Date.now() + 60000,
              taggedPlayerId: myId
            };
          }
        } else if (value && typeof value === 'object' && value.gameType) {
          // Make sure tag games have a tagged player
          if (value.gameType === 'tag' && (!value.taggedPlayerId || value.taggedPlayerId === 'undefined')) {
            console.log(`[GameSystemProvider] 🔧 Fixing missing taggedPlayerId in game:`, key);
            value.taggedPlayerId = myId;
          }
          
          // Copy the valid game object
          cleanedGames[key] = value;
        }
      });
      
      return cleanedGames;
    });
  };
  
  // Add a special debugging effect to monitor activeGames
  useEffect(() => {
    console.log('\n====== ACTIVE GAMES DEBUG ======');
    console.log('[GameSystemProvider] 📊 ACTIVE GAMES STATE CHANGED:', activeGames);
    
    // CRITICAL FIX: Check for and intercept any string value for "tag" key
    // This is a special case that happens frequently from the server
    if (activeGames && typeof activeGames.tag === 'string') {
      const tagValue = activeGames.tag;
      console.log(`[GameSystemProvider] 💡 PRE-EMPTIVE FIX: Found string value for tag key: ${tagValue}`);
      
      // Create a proper game object directly with the roomId instead of waiting for cleanup
      const roomId = tagValue;
      const newActiveGames = {};
      
      // Copy all existing valid game objects
      Object.entries(activeGames).forEach(([key, value]) => {
        if (typeof value === 'object' && value !== null) {
          newActiveGames[key] = value;
        }
      });
      
      // Add the proper game object using the roomId as key
      newActiveGames[roomId] = {
        gameType: 'tag',
        roomId,
        state: 'playing',
        players: [myId],
        startTime: Date.now(),
        endTime: Date.now() + 60000,
        taggedPlayerId: myId
      };
      
      // Immediately set the fixed state to prevent any rendering with invalid format
      setActiveGames(newActiveGames);
      return; // Skip further processing since we're updating the state
    }
    
    // Check for other invalid game formats
    let hasInvalidFormat = false;
    Object.entries(activeGames || {}).forEach(([key, value]) => {
      if (typeof value === 'string') {
        console.error(`[GameSystemProvider] 🚨 CRITICAL: Found string value for key ${key}: ${value}`);
        hasInvalidFormat = true;
      }
    });
    
    // If we found invalid formats, clean them up
    if (hasInvalidFormat) {
      console.log('[GameSystemProvider] 🚫 Cleaning up invalid game formats...');
      cleanupInvalidGameFormats();
    }
  }, [activeGames, myId]);
  
  // Add a periodic cleanup function to fix any invalid game formats
  useEffect(() => {
    // Run more frequently to catch the issue before it affects rendering
    const periodicCleanupInterval = setInterval(() => {
      // Check if we have the specific "tag" -> "tag-1" mapping
      if (activeGames && typeof activeGames.tag === 'string') {
        console.log('[GameSystemProvider] 🚨 Periodic cleanup: Found "tag" key with string value');
        
        // Get the string value (which should be the roomId)
        const roomId = activeGames.tag;
        
        // Create a new active games object without the "tag" key
        setActiveGames(prev => {
          const newGames = {};
          
          // Copy all valid game objects
          Object.entries(prev).forEach(([key, value]) => {
            if (typeof value === 'object' && value !== null) {
              newGames[key] = value;
            }
          });
          
          // Add a proper game object with the roomId as key
          newGames[roomId] = {
            gameType: 'tag',
            roomId,
            state: 'playing',
            taggedPlayerId: myId,
            players: [myId],
            startTime: Date.now(),
            endTime: Date.now() + 60000
          };
          
          return newGames;
        });
      }
    }, 500); // Run every 500ms instead of 2000ms
    
    return () => clearInterval(periodicCleanupInterval);
  }, [activeGames, myId]);
  
  // Socket setup
  useEffect(() => {
    const socket = getSocket();
    if (!socket) {
      console.error('[GameSystemProvider] ⚠️ No socket available');
      return;
    }
    
    console.log('[GameSystemProvider] 🔌 Setting up socket event listeners');
    
    const onGameStart = (data) => {
      const { roomId, gameType, taggedPlayerId, spawnPositions, players: gamePlayers } = data;
      
      // CRITICAL FIX: Always use a proper roomId as the key, never use gameType as key
      // This prevents the "tag" -> "tag-1" string mapping issue
      const gameKey = roomId || `${gameType}-${Date.now()}`;
      
      console.log(`[GameSystemProvider] 🎮 Game started:`, data);
      console.log(`[GameSystemProvider] 🔑 Using game key:`, gameKey);
      
      // First clean up any existing invalid game formats
      setActiveGames(prev => {
        const cleanedGames = {};
        
        // Only copy valid game objects to the cleaned state
        Object.entries(prev || {}).forEach(([key, value]) => {
          if (typeof value === 'string') {
            console.log(`[GameSystemProvider] 🔧 Found invalid game format in onGameStart: ${key} -> ${value}`);
            // Don't copy string values
          } else if (value && typeof value === 'object' && value.gameType) {
            cleanedGames[key] = value;
          }
        });
        
        // Add the new game with the proper key
        return {
          ...cleanedGames,
          [gameKey]: {
            gameType,
            roomId: gameKey, // Use the gameKey as the roomId to ensure consistency
            state: 'playing',
            taggedPlayerId: taggedPlayerId || myId, // Default to current player if no tagged player
            spawnPositions,
            players: gamePlayers || [myId], // Default to include current player
            startTime: data.startTime || Date.now(),
            endTime: data.endTime,
          },
        };
      });
      
      // Add the current player to the game if they're in the players list
      if (gamePlayers && gamePlayers.includes(myId)) {
        setPlayerGameStatus(prev => {
          // Clean up any invalid status entries
          const cleanedStatus = {};
          Object.entries(prev).forEach(([key, value]) => {
            if (value && typeof value === 'object') {
              cleanedStatus[key] = value;
            }
          });
          
          return {
            ...cleanedStatus,
            [myId]: {
              gameType,
              roomId: gameKey, // Use the consistent gameKey
              status: 'playing',
              joinedAt: Date.now(),
            },
          };
        });
        console.log(`[GameSystemProvider] 👤 Player ${myId.substring(0, 6)} added to game ${gameKey}`);
      } else {
        // Even if player is not in the list, add them for testing
        setPlayerGameStatus(prev => ({
          ...prev,
          [myId]: {
            gameType,
            roomId: gameKey,
            status: 'playing',
            joinedAt: Date.now(),
          },
        }));
        console.log(`[GameSystemProvider] 👤 Force-adding player ${myId.substring(0, 6)} to game ${gameKey}`);
      }
    };

    const onGameStateUpdate = (data) => {
      const { roomId, gameType, state, taggedPlayerId, endTime, players: gamePlayers } = data;
      
      console.log(`[GameSystemProvider] 🔄 Game state update:`, data);
      
      // CRITICAL FIX: Handle the case where roomId is missing
      // This is a common issue with the server sending updates without proper roomId
      const effectiveRoomId = roomId || `${gameType}-1`;
      
      if (!effectiveRoomId) {
        console.error(`[GameSystemProvider] ⚠️ Missing roomId in game state update:`, data);
        return;
      }
      
      console.log(`[GameSystemProvider] 🔑 Using effective roomId:`, effectiveRoomId);
      
      setActiveGames(prev => {
        // Start with a clean slate to avoid string values
        const cleanedGames = {};
        
        // First, look for any existing game with this roomId or any game of this type
        let existingGameKey = null;
        
        Object.entries(prev || {}).forEach(([key, value]) => {
          if (typeof value === 'string') {
            console.log(`[GameSystemProvider] 🔧 Found invalid game format in state update: ${key} -> ${value}`);
            
            // If we find a string value that matches our gameType -> roomId pattern,
            // remember it so we can replace it with a proper game object
            if (key === gameType && (value === effectiveRoomId || value.startsWith(gameType))) {
              console.log(`[GameSystemProvider] 🔧 Found gameType -> roomId mapping: ${key} -> ${value}`);
              existingGameKey = value; // Use the value (roomId) as our game key
            }
          } else if (value && typeof value === 'object' && value.gameType) {
            // Only copy valid game objects
            cleanedGames[key] = value;
            
            // If this is a game of the type we're updating, remember it
            if (value.gameType === gameType) {
              existingGameKey = key;
            }
          }
        });
        
        try {
          // Use the existingGameKey if we found one, otherwise use the effectiveRoomId
          const gameKey = existingGameKey || effectiveRoomId;
          
          if (!cleanedGames[gameKey]) {
            console.log(`[GameSystemProvider] 🆕 Creating new game from state update with key:`, gameKey);
            
            let effectiveTaggedPlayerId = taggedPlayerId;
            if (gameType === 'tag' && (!effectiveTaggedPlayerId || effectiveTaggedPlayerId === 'undefined')) {
              console.log(`[GameSystemProvider] 🔧 No tagged player specified in game state update, using current player`);
              effectiveTaggedPlayerId = myId; // Set current player as IT for testing
            }
            
            const effectivePlayersList = gamePlayers || [];
            if (!effectivePlayersList.includes(myId)) {
              console.log(`[GameSystemProvider] 🔧 Adding current player to game players list`);
              effectivePlayersList.push(myId);
            }
            
            cleanedGames[gameKey] = {
              gameType,
              roomId: gameKey, // Use gameKey as roomId for consistency
              state,
              taggedPlayerId: effectiveTaggedPlayerId,
              players: effectivePlayersList,
              startTime: data.startTime || Date.now(),
              endTime,
            };
          } else {
            // Update existing game
            console.log(`[GameSystemProvider] 📝 Updating existing game with key:`, gameKey);
            
            // Make sure we have a tagged player for tag games
            let effectiveTaggedPlayerId = taggedPlayerId;
            if (gameType === 'tag' && (!effectiveTaggedPlayerId || effectiveTaggedPlayerId === 'undefined')) {
              // Keep the existing tagged player if there is one
              effectiveTaggedPlayerId = cleanedGames[gameKey].taggedPlayerId || myId;
              console.log(`[GameSystemProvider] 🔧 Using existing/default tagged player:`, effectiveTaggedPlayerId);
            }
            
            cleanedGames[gameKey] = {
              ...cleanedGames[gameKey],
              state,
              taggedPlayerId: effectiveTaggedPlayerId,
              endTime,
              players: gamePlayers || cleanedGames[gameKey].players || [],
            };
          }
          
          return cleanedGames;
        } catch (error) {
          console.error(`[GameSystemProvider] 🚨 Error updating game state:`, error);
          return cleanedGames;
        }
      });
      
      // Debug active games after update
      setTimeout(() => {
        console.log(`[GameSystemProvider] 📊 Active games after update:`, activeGames);
      }, 100);
    };

    const onGameEnd = (data) => {
      const { roomId, gameType } = data;
      
      // CRITICAL FIX: Always use the roomId as the key, not the gameType
      // Make sure we have a valid roomId
      if (!roomId) {
        console.error(`[GameSystemProvider] ⚠️ Missing roomId in game end event:`, data);
        return;
      }
      
      console.log(`[GameSystemProvider] 🏁 Game ended:`, data);
      
      // Remove the game from active games
      setActiveGames(prev => {
        const newGames = { ...prev };
        delete newGames[roomId];
        
        // Also check if we have a string value for this game type
        if (typeof newGames[gameType] === 'string') {
          delete newGames[gameType];
        }
        
        return newGames;
      });
      
      // Update player status
      if (playerGameStatus[myId] && playerGameStatus[myId].roomId === roomId) {
        setPlayerGameStatus(prev => {
          const newStatus = { ...prev };
          delete newStatus[myId];
          return newStatus;
        });
      }
    };

    // Register event listeners
    socket.on('gameStart', onGameStart);
    socket.on('gameStateUpdate', onGameStateUpdate);
    socket.on('gameEnded', onGameEnd);

    return () => {
      socket.off('gameStart', onGameStart);
      socket.off('gameStateUpdate', onGameStateUpdate);
      socket.off('gameEnded', onGameEnd);
    };
  }, [myId]);

  const isPlayerInGame = (playerId, gameType, roomId) => {
    // Debug call parameters
    console.log(`[GameSystemProvider] 🔎 Checking if player ${playerId?.substring(0, 6)} is in game:`, { gameType, roomId });
    
    // IMPORTANT: For testing purposes, always consider the current player to be in the game
    // This helps with debugging the tag detection system
    if (playerId === myId && gameType === 'tag') {
      console.log(`[GameSystemProvider] ✅ FORCE: Considering current player ${playerId?.substring(0, 6)} to be in the tag game for testing`);
      return true;
    }
    
    // Get player status
    const status = playerGameStatus[playerId];
    
    // CRITICAL FIX: Validate activeGames to prevent issues
    // Check for invalid game formats and log them
    Object.entries(activeGames || {}).forEach(([key, value]) => {
      if (typeof value === 'string') {
        console.error(`[GameSystemProvider] 🚨 Found invalid game format in isPlayerInGame for key ${key}: ${value}`);
      }
    });
    
    // First try exact match with roomId
    let game = roomId ? activeGames[roomId] : null;
    let actualRoomId = roomId;
    
    // If no exact match and we have a gameType, try to find any game of this type
    if (!game && gameType) {
      console.log(`[GameSystemProvider] 🔎 Searching for game of type ${gameType}...`);
      
      // Only look at valid game objects
      const validGames = Object.entries(activeGames || {}).filter(
        ([key, value]) => value && typeof value === 'object' && value.gameType
      );
      
      // Find a game with matching gameType
      const foundGame = validGames.find(([key, value]) => 
        value.gameType === gameType || key.startsWith(gameType)
      );
      
      if (foundGame) {
        actualRoomId = foundGame[0];
        game = foundGame[1];
        console.log(`[GameSystemProvider] 🔍 Found game with key ${actualRoomId}`);
      }
    }
    
    // If no game found but we're in development mode, create a temporary game for testing
    if (!game && gameType === 'tag' && process.env.NODE_ENV !== 'production') {
      console.log(`[GameSystemProvider] 💡 Creating temporary game for testing`);
      
      // Add the player to the game status
      setPlayerGameStatus(prev => ({
        ...prev,
        [playerId]: {
          gameType: 'tag',
          roomId: 'tag-1',
          status: 'playing',
          joinedAt: Date.now()
        }
      }));
      
      return true;
    }
    
    // If no game found, player is not in game
    if (!game) {
      console.log(`[GameSystemProvider] ℹ️ No active game found for player ${playerId?.substring(0, 6)}`);
      return false;
    }
    
    // Make sure game is a valid object
    if (typeof game !== 'object' || !game.gameType) {
      console.error(`[GameSystemProvider] ⚠️ Invalid game object:`, game);
      return false;
    }
    
    // Check if player is in this game's players list
    if (game.players && game.players.includes(playerId)) {
      console.log(`[GameSystemProvider] ✅ Player ${playerId?.substring(0, 6)} found in game players list`);
      return true;
    }
    
    // Also check player status
    const inGame = status && status.status === 'playing' && 
                  (status.roomId === actualRoomId || status.gameType === game.gameType);
    
    console.log(`[GameSystemProvider] ${inGame ? '✅' : '❌'} Player ${playerId?.substring(0, 6)} ${inGame ? 'is' : 'is not'} in game based on status`);
    return inGame;
  };

  return (
    <GameSystemContext.Provider value={{
      activeGames,
      setActiveGames,
      playerGameStatus,
      setPlayerGameStatus,
      isPlayerInGame,
    }}>
      {children}
    </GameSystemContext.Provider>
  );
}

// Improved hook with safety checks to prevent undefined errors
export const useGameSystem = () => {
  const context = useContext(GameSystemContext);
  if (context === undefined) {
    console.warn('[useGameSystem] Component is not wrapped in a GameSystemProvider');
    // Return a default object with empty values to prevent undefined errors
    return { 
      activeGames: {}, 
      playerGameStatus: {},
      onGameStart: () => {},
      onGameStateUpdate: () => {},
      onGameEnd: () => {}
    };
  }
  return context;
};
