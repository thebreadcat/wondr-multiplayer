// src/games/tag/useTagGameLogic.js
// Game logic hook for the Tag game

import { useState, useEffect, useCallback } from 'react';
import { tagConfig } from './config';
import { Vector3 } from 'three';

export function useTagGameLogic({ players, currentPlayerId, socket, gameRoomId }) {
  const [gameState, setGameState] = useState({
    taggedPlayerId: null,
    freezeUntil: 0, // Timestamp when the IT player can move
    roundStartTime: null,
    roundEndTime: null,
    gameStatus: 'preparing', // 'preparing', 'playing', 'ended'
    spawnPositions: {}, // Where each player spawns
    message: null, // Message to display
    winner: null, // Who won
  });
  
  // Check if a player is within game boundaries
  const checkInBounds = useCallback((playerPosition) => {
    if (!playerPosition) return false;
    
    const center = new Vector3(...tagConfig.gameZone.center);
    const playerPos = new Vector3(...playerPosition);
    const distance = center.distanceTo(playerPos);
    
    return distance <= tagConfig.gameZone.radius;
  }, []);

  // Handle player tagging another player
  const handleTagAttempt = useCallback((taggerId, targetId) => {
    if (!gameState.taggedPlayerId || taggerId !== gameState.taggedPlayerId) return;
    
    // Don't allow tagging during freeze period
    if (Date.now() < gameState.freezeUntil) return;
    
    // Emit tag event to server
    socket.emit('gameAction', {
      gameType: 'tag',
      roomId: gameRoomId,
      action: 'tag',
      payload: {
        taggerId,
        targetId,
      }
    });
    
    // Let's also update local state immediately for responsiveness
    setGameState(prev => ({
      ...prev,
      taggedPlayerId: targetId,
      message: `${players[targetId]?.name || 'New player'} is now IT!`
    }));
  }, [gameState.taggedPlayerId, gameState.freezeUntil, socket, gameRoomId, players]);

  // Check if players are close enough for tagging
  const checkTagDistance = useCallback((player1Pos, player2Pos) => {
    if (!player1Pos || !player2Pos) return false;
    
    const p1 = new Vector3(...player1Pos);
    const p2 = new Vector3(...player2Pos);
    const distance = p1.distanceTo(p2);
    
    return distance <= 2; // Tagging distance in units
  }, []);

  // Setup listeners for game events
  useEffect(() => {
    if (!socket || !gameRoomId) return;
    
    const handleGameStart = (data) => {
      if (data.roomId !== gameRoomId) return;
      
      // Initial game setup - set the first "IT" and spawn positions
      const taggedPlayerId = data.taggedPlayerId;
      const spawnPositions = data.spawnPositions || {};
      const gameCenter = tagConfig.gameZone.center;
      
      // Calculate 2-second freeze period
      const freezeUntil = Date.now() + 2000;
      
      // Calculate round end time (60 seconds from now)
      const roundEndTime = Date.now() + (tagConfig.roundDuration * 1000);
      
      setGameState(prev => ({
        ...prev,
        gameStatus: 'playing',
        taggedPlayerId,
        spawnPositions,
        freezeUntil,
        roundStartTime: Date.now(),
        roundEndTime,
        message: taggedPlayerId === currentPlayerId ? 
          'You are IT! You are frozen for 2 seconds - then tag someone!' : 
          `${players[taggedPlayerId]?.name || 'Someone'} is IT! Run away!`
      }));
      
      // Schedule game end
      setTimeout(() => {
        setGameState(prev => {
          // Check if we're still in the same game
          if (prev.gameStatus !== 'playing') return prev;
          
          return {
            ...prev,
            gameStatus: 'ended',
            winner: prev.taggedPlayerId !== currentPlayerId
          };
        });
      }, tagConfig.roundDuration * 1000);
    };
    
    const handleGameAction = (action) => {
      if (action.roomId !== gameRoomId) return;
      
      switch (action.action) {
        case 'tag':
          // Someone got tagged
          if (action.payload?.targetId) {
            setGameState(prev => ({
              ...prev,
              taggedPlayerId: action.payload.targetId,
              message: `${players[action.payload.targetId]?.name || 'New player'} is now IT!`
            }));
          }
          break;
        case 'gameEnd':
          // Game ended
          setGameState(prev => ({
            ...prev,
            gameStatus: 'ended',
            winner: prev.taggedPlayerId !== currentPlayerId,
            message: null
          }));
          break;
        default:
          break;
      }
    };
    
    socket.on('gameStart', handleGameStart);
    socket.on('gameAction', handleGameAction);
    
    // Request game start when component mounts
    socket.emit('readyForGame', {
      gameType: 'tag',
      roomId: gameRoomId,
      playerId: currentPlayerId
    });
    
    return () => {
      socket.off('gameStart', handleGameStart);
      socket.off('gameAction', handleGameAction);
    };
  }, [socket, gameRoomId, currentPlayerId, players]);

  // Check if the current player can tag others or is within game boundaries
  useEffect(() => {
    if (gameState.gameStatus !== 'playing') return;
    
    // Handle the tagging mechanics
    const checkInterval = setInterval(() => {
      // Check if we're still in playing state
      if (gameState.gameStatus !== 'playing') {
        clearInterval(checkInterval);
        return;
      }
    
      // Check if game time expired
      if (gameState.roundEndTime && Date.now() > gameState.roundEndTime) {
        setGameState(prev => ({
          ...prev,
          gameStatus: 'ended',
          winner: prev.taggedPlayerId !== currentPlayerId
        }));
        
        // Notify server about game end
        socket.emit('gameAction', {
          gameType: 'tag',
          roomId: gameRoomId,
          action: 'gameEnd',
          payload: {
            taggedPlayerId: gameState.taggedPlayerId
          }
        });
        
        clearInterval(checkInterval);
        return;
      }
      
      // Only the tagged player can tag others
      if (gameState.taggedPlayerId !== currentPlayerId) return;
      
      // Don't allow tagging during freeze period
      if (Date.now() < gameState.freezeUntil) return;
      
      // Current player is IT, check if we can tag anyone
      const currentPlayer = Object.values(players).find(p => p.id === currentPlayerId);
      if (!currentPlayer) return;
      
      // Loop through all players to find taggable ones
      Object.values(players).forEach(player => {
        if (player.id !== currentPlayerId) {
          const canTag = checkTagDistance(
            currentPlayer.position,
            player.position
          );
          
          if (canTag) {
            handleTagAttempt(currentPlayerId, player.id);
            clearInterval(checkInterval); // Prevent multiple tags at once
          }
        }
      });
    }, 100); // Check every 100ms
    
    return () => clearInterval(checkInterval);
  }, [
    players, 
    currentPlayerId, 
    gameState.gameStatus, 
    gameState.taggedPlayerId,
    gameState.freezeUntil,
    gameState.roundEndTime,
    checkTagDistance,
    handleTagAttempt,
    socket,
    gameRoomId
  ]);

  // Create message data object for UI components instead of direct JSX
  const getUIMessageData = () => {
    // Display win/lose at the end
    if (gameState.gameStatus === 'ended') {
      return {
        type: 'statusBanner',
        text: gameState.winner ? "You Won! 🎉" : "You Lost! 😭",
        color: gameState.winner ? "#00FF00" : "#FF0000",
        position: "middle",
        size: "large",
        backgroundColor: gameState.winner ? "rgba(0,128,0,0.7)" : "rgba(128,0,0,0.7)"
      };
    }
    
    // Display game message during gameplay
    if (gameState.message) {
      return {
        type: 'statusBanner',
        text: gameState.message,
        color: "#FFFFFF",
        position: "top",
        size: "medium",
        backgroundColor: gameState.taggedPlayerId === currentPlayerId ? 
          "rgba(255,0,0,0.7)" : "rgba(0,0,128,0.7)",
        duration: 5000 // Show for 5 seconds
      };
    }
    
    return null;
  };
  
  // Return game state and any methods needed by the UI
  return {
    isTagged: gameState.taggedPlayerId === currentPlayerId,
    taggedPlayerId: gameState.taggedPlayerId,
    gameStatus: gameState.gameStatus,
    timeRemaining: gameState.roundEndTime ? Math.max(0, gameState.roundEndTime - Date.now()) / 1000 : 0,
    isFrozen: Date.now() < gameState.freezeUntil,
    freezeTimeRemaining: Math.max(0, gameState.freezeUntil - Date.now()) / 1000,
    message: gameState.message,
    isWinner: gameState.gameStatus === 'ended' && gameState.winner,
    uiData: getUIMessageData(), // Return data object instead of JSX rendering function
  };
}
