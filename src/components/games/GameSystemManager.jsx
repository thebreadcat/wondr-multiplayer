// src/components/games/GameSystemManager.jsx
import React, { useState, useEffect } from 'react';
import { useMultiplayer } from '../MultiplayerProvider';
import { gameRegistry, createGameRoomId } from '../../games/gameRegistry';
import { GameManager } from './GameManager';

export function GameSystemManager() {
  const { myId, socket } = useMultiplayer();
  const [activeGames, setActiveGames] = useState({});
  const [hostedGames, setHostedGames] = useState({});
  
  // Setup socket listeners for game system
  useEffect(() => {
    if (!socket?.current) return;
    
    // Listen for game invitations
    const handleGameInvite = (data) => {
      // Add game to active games if not already there
      setActiveGames(prev => {
        if (prev[data.roomId]) return prev;
        
        return {
          ...prev,
          [data.roomId]: {
            gameType: data.gameType,
            hostId: data.hostId,
            timestamp: Date.now()
          }
        };
      });
    };
    
    socket.current.on('gameInvite', handleGameInvite);
    
    return () => {
      socket.current.off('gameInvite', handleGameInvite);
    };
  }, [socket]);
  
  // Handle player joining a game
  const handleJoinGame = (gameType) => {
    if (!socket?.current) return;
    
    // Create a unique room ID with timestamp
    const roomId = createGameRoomId(gameType);
    
    // Add this game to hosted games (we're the host)
    setHostedGames(prev => ({
      ...prev,
      [roomId]: {
        gameType,
        timestamp: Date.now()
      }
    }));
    
    // Add to active games as well
    setActiveGames(prev => ({
      ...prev,
      [roomId]: {
        gameType,
        hostId: myId,
        timestamp: Date.now()
      }
    }));
    
    // Let server know a new game room is created
    socket.current.emit('createGameRoom', {
      gameType,
      roomId,
      hostId: myId
    });
    
    console.log(`Created game room: ${roomId} for game type: ${gameType}`);
  };
  
  // Handle cleanup when a game ends
  const handleGameEnd = (gameType, roomId) => {
    // Remove from active games
    setActiveGames(prev => {
      const newGames = { ...prev };
      delete newGames[roomId];
      return newGames;
    });
    
    // Remove from hosted games if we were the host
    setHostedGames(prev => {
      const newGames = { ...prev };
      delete newGames[roomId];
      return newGames;
    });
    
    console.log(`Game ended: ${roomId} (${gameType})`);
  };
  
  // Subscribe to join events from GameElements3D
  useEffect(() => {
    if (!socket?.current) return;
    
    const handleJoinRequest = (data) => {
      if (data && data.gameType) {
        handleJoinGame(data.gameType);
      }
    };
    
    socket.current.on('joinGameRequest', handleJoinRequest);
    
    return () => {
      socket.current.off('joinGameRequest', handleJoinRequest);
    };
  }, [socket]);  // We intentionally omit handleJoinGame from deps to avoid recreating listener
  
  // Render active game managers
  const renderGameManagers = () => {
    return Object.entries(activeGames).map(([roomId, game]) => (
      <GameManager
        key={roomId}
        gameType={game.gameType}
        gameRoomId={roomId}
        onGameEnd={handleGameEnd}
      />
    ));
  };
  
  return (
    <>
      {/* Only render the game UI managers - 3D elements are in GameElements3D */}
      {renderGameManagers()}
    </>
  );
}
