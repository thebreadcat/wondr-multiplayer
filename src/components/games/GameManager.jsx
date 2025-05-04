// src/components/games/GameManager.jsx
import React, { useEffect, useState, useCallback, useContext } from 'react';
import { gameRegistry } from '../../games/gameRegistry';
import { CountdownTimer } from './CountdownTimer';
import { StatusBanner } from './StatusBanner';
import { useMultiplayer } from '../MultiplayerProvider';
import { GameSystemContext } from '../GameSystemProvider';

export function GameManager({ 
  gameType, 
  gameRoomId, 
  onGameEnd 
}) {
  const { myId, players, sendEmoji } = useMultiplayer();
  const { isPlayerInGame } = useContext(GameSystemContext);
  const [gameState, setGameState] = useState('waiting'); // 'waiting', 'countdown', 'playing', 'ended'
  const [gameMeta, setGameMeta] = useState({});
  const [errorMessage, setErrorMessage] = useState('');
  
  // Get game configuration from registry
  const gameConfig = gameRegistry[gameType]?.config;
  const GameLogicHook = gameRegistry[gameType]?.useGameLogic;
  
  // Check if current player is participating in this game
  const isParticipating = isPlayerInGame ? isPlayerInGame(myId, gameType, gameRoomId) : false;
  
  // Handle game state updates from server
  const handleGameUpdate = useCallback((update) => {
    console.log('Game update received:', update);
    
    if (update.roomId !== gameRoomId) return;
    
    setGameState(update.state);
    setGameMeta(update.meta || {});
    
    // Handle emoji reactions for game events
    if (update.state === 'ended' && update.meta?.winnerId) {
      if (update.meta.winnerId === myId) {
        // Show victory emoji
        sendEmoji('🏆');
      }
    }
  }, [gameRoomId, myId, sendEmoji]);
  
  // Listen for game events from server
  useEffect(() => {
    const socket = window.socket;
    if (!socket) {
      setErrorMessage('Socket connection not available');
      return;
    }
    
    // Register event listeners
    socket.on('gameStateUpdate', handleGameUpdate);
    
    // Send join game event to server
    socket.emit('joinGame', {
      gameType,
      roomId: gameRoomId,
      playerId: myId
    });
    
    // Cleanup listeners on unmount
    return () => {
      socket.off('gameStateUpdate', handleGameUpdate);
      
      // Leave game room
      socket.emit('leaveGame', {
        roomId: gameRoomId,
        playerId: myId
      });
    };
  }, [gameType, gameRoomId, myId, handleGameUpdate]);
  
  // Handle countdown completion
  const handleCountdownComplete = useCallback(() => {
    // The server should already be tracking this, but this ensures UI updates
    if (gameState === 'countdown') {
      setGameState('playing');
    }
  }, [gameState]);
  
  // Handle cleanup when game ends
  useEffect(() => {
    if (gameState === 'ended') {
      const timer = setTimeout(() => {
        if (onGameEnd) onGameEnd(gameType, gameRoomId);
      }, 5000); // 5 second delay before cleanup
      
      return () => clearTimeout(timer);
    }
  }, [gameState, gameType, gameRoomId, onGameEnd]);

  // Component for game logic
  const GameLogicComponent = ({ GameLogicHook, players, myId, gameRoomId }) => {
    const hookResult = GameLogicHook({ 
      myId, 
      players, 
      roomId: gameRoomId,
      onSendEmoji: sendEmoji,
      onGameEnd: () => {
        setGameState('ended');
        onGameEnd?.();
      }
    });
    
    return null; // Game logic doesn't render anything
  };

  // Only show game UI to participating players
  useEffect(() => {
    if (isParticipating) {
      console.log(`[GAME MANAGER] Player ${myId} is participating in ${gameType} game ${gameRoomId}`);
    } else {
      console.log(`[GAME MANAGER] Player ${myId} is NOT participating in ${gameType} game ${gameRoomId}`);
    }
  }, [isParticipating, myId, gameType, gameRoomId]);

  // Don't render anything if player is not participating or until we have a game state
  if (!isParticipating || !gameState || gameState === 'waiting') {
    return null;
  }
  
  // Render error message if something goes wrong
  if (errorMessage) {
    return <StatusBanner text={errorMessage} color="#FF0000" />;
  }
  
  // Render appropriate UI based on game state
  return (
    <>
      {gameState === 'countdown' && (
        <CountdownTimer 
          gameType={gameType}
          duration={gameMeta.countdownDuration || 5} 
          startTime={gameMeta.startTime || Date.now()} 
          onComplete={handleCountdownComplete}
          roomId={gameRoomId || '1'}
        />
      )}
      
      {gameState === 'playing' && GameLogicHook && (
        <GameLogicComponent 
          GameLogicHook={GameLogicHook} 
          players={players} 
          myId={myId} 
          gameRoomId={gameRoomId}
        />
      )}
      
      {gameState === 'ended' && (
        <StatusBanner 
          text={
            gameMeta.winnerId === myId 
              ? 'You Won! 🎉' 
              : `${gameMeta.winnerName || 'Another player'} won!`
          }
          size="large"
          position="middle"
          backgroundColor={gameMeta.winnerId === myId ? 'rgba(0,128,0,0.8)' : 'rgba(0,0,0,0.8)'}
          gameType={gameType}
          roomId={gameRoomId}
        />
      )}
    </>
  );
}

// Helper component to use the game-specific logic hook
function GameLogicComponent({ GameLogicHook, players, myId, gameRoomId }) {
  // Use the game-specific logic hook
  const gameState = GameLogicHook({
    players,
    currentPlayerId: myId,
    socket: window.socket,
    gameRoomId
  });
  
  // Return game-specific UI if the hook provides UI data
  if (gameState.uiData) {
    const uiData = gameState.uiData;
    
    if (uiData.type === 'statusBanner') {
      return (
        <StatusBanner
          text={uiData.text}
          color={uiData.color}
          position={uiData.position}
          size={uiData.size}
          backgroundColor={uiData.backgroundColor}
          duration={uiData.duration}
        />
      );
    }
  }
  
  // Default UI based on common game state properties
  return (
    <>
      {gameState.message && (
        <StatusBanner 
          text={gameState.message} 
          position="top"
          size="medium"
          backgroundColor={gameState.messageBackground || 'rgba(0,0,0,0.7)'}
          color={gameState.messageColor || '#FFFFFF'}
        />
      )}
      
      {gameState.timeRemaining !== undefined && (
        <div style={{
          position: 'absolute',
          top: '5%',
          right: '5%',
          background: 'rgba(0,0,0,0.6)',
          color: '#FFFFFF',
          padding: '8px 16px',
          borderRadius: '8px',
          fontWeight: 'bold',
          fontSize: '24px'
        }}>
          {Math.ceil(gameState.timeRemaining)}s
        </div>
      )}
    </>
  );
}
