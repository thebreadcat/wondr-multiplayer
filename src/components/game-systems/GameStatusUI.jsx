/**
 * GameStatusUI.jsx
 * Reusable component for displaying game status, players, and timers
 */
import React, { useEffect, useState } from 'react';
import { useGameSystem } from '../GameSystemProvider';
import { getSocket } from '../../utils/socketManager';
import { Html } from '@react-three/drei';
import { useMultiplayer } from '../MultiplayerProvider';

const GameStatusUI = ({
  gameType,
  roomId,
  styleOverride = {},
  statusLabels = {
    waiting: 'Waiting for players...',
    starting: 'Game starting soon!',
    playing: 'Game in progress',
    ended: 'Game over',
  },
  hideWhenInactive = false,
  showPlayerCount = true,
  showGameTimer = true,
  fixedPosition = true, // Fixed position at top of screen
  children,
}) => {
  const { activeGames = {}, gameJoinStatus = {} } = useGameSystem();
  const { myId } = useMultiplayer();
  const socket = getSocket();
  
  // Game state
  const [gameState, setGameState] = useState('waiting');
  const [playerCount, setPlayerCount] = useState(0);
  const [gameTimeRemaining, setGameTimeRemaining] = useState(0);
  const [isVisible, setIsVisible] = useState(!hideWhenInactive);
  
  // Get the current game from active games
  const game = roomId ? activeGames[roomId] : 
    Object.values(activeGames || {}).find(g => g?.gameType === gameType);
  
  // Check if the current player is in this game
  const isCurrentPlayerInGame = game?.players?.includes(myId);
  
  // Update game status based on active games
  useEffect(() => {
    if (!game) {
      setGameState('waiting');
      setPlayerCount(0);
      setIsVisible(!hideWhenInactive);
      return;
    }
    
    // Only show UI if player is in the game
    const shouldShowUI = isCurrentPlayerInGame;
    
    setGameState(game.state || 'waiting');
    setPlayerCount(game.players?.length || 0);
    setGameTimeRemaining(game.endTime ? Math.max(0, Math.floor((game.endTime - Date.now()) / 1000)) : 0);
    setIsVisible(shouldShowUI);
  }, [game, hideWhenInactive, isCurrentPlayerInGame, myId]);
  
  // Listen for game state updates
  useEffect(() => {
    if (!socket || !gameType) return;
    
    const handleGameStateUpdate = (data) => {
      if (roomId && data.roomId !== roomId) return;
      if (data.gameType !== gameType) return;
      
      if (data.state) {
        setGameState(data.state);
      }
      
      if (data.players) {
        setPlayerCount(data.players.length);
      }
      
      if (data.endTime) {
        const remaining = Math.max(0, Math.floor((data.endTime - Date.now()) / 1000));
        setGameTimeRemaining(remaining);
      }
    };
    
    socket.on('gameStateUpdate', handleGameStateUpdate);
    
    return () => {
      socket.off('gameStateUpdate', handleGameStateUpdate);
    };
  }, [socket, gameType, roomId]);
  
  // Timer update every second for remaining time
  useEffect(() => {
    if (gameState !== 'playing' || !game?.endTime) return;
    
    const timer = setInterval(() => {
      const remaining = Math.max(0, Math.floor((game.endTime - Date.now()) / 1000));
      setGameTimeRemaining(remaining);
      
      if (remaining <= 0) {
        clearInterval(timer);
      }
    }, 1000);
    
    return () => clearInterval(timer);
  }, [game, gameState]);
  
  // Format time as MM:SS
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };
  
  // Modern HUD-style UI matching GameTimer
  const defaultStyles = {
    container: {
      position: 'fixed',
      top: 20,
      left: '50%',
      transform: 'translateX(-50%)',
      zIndex: 1000,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      width: '300px',
      ...styleOverride.container
    },
    header: {
      backgroundColor: '#000000',
      color: '#FFFFFF',
      padding: '10px 20px',
      borderRadius: '8px',
      fontWeight: 'bold',
      fontSize: '20px',
      textAlign: 'center',
      marginBottom: '10px',
      width: '100%',
      boxShadow: '0 4px 8px rgba(0,0,0,0.5)',
      ...styleOverride.header
    },
    status: {
      backgroundColor: '#000000',
      color: '#FFFFFF',
      padding: '8px 16px',
      borderRadius: '8px',
      fontSize: '16px',
      textAlign: 'center',
      width: '90%',
      boxShadow: '0 4px 8px rgba(0,0,0,0.5)',
      marginBottom: '10px',
      ...styleOverride.status
    },
    timer: {
      // Included in header
      ...styleOverride.timer
    },
    players: {
      backgroundColor: '#000000',
      color: '#FFFFFF',
      padding: '8px 16px',
      borderRadius: '8px',
      fontSize: '16px',
      textAlign: 'center',
      width: '90%',
      boxShadow: '0 4px 8px rgba(0,0,0,0.5)',
      marginBottom: '10px',
      ...styleOverride.players
    },
    taggedStatus: {
      backgroundColor: (isTagged) => isTagged ? '#550000' : '#000000',
      color: (isTagged) => isTagged ? '#FF5555' : '#FFFFFF',
      padding: '8px 16px',
      borderRadius: '8px',
      fontSize: '16px',
      textAlign: 'center',
      width: '90%',
      boxShadow: '0 4px 8px rgba(0,0,0,0.5)',
      ...styleOverride.taggedStatus
    }
  };
  
  // Don't render if hidden
  if (!isVisible) return null;
  
  // Create the tag status component based on whether the current player is tagged
  // This is passed to the children render prop if provided
  const customContentData = {
    gameState,
    playerCount,
    timeRemaining: gameTimeRemaining,
    formattedTime: formatTime(gameTimeRemaining)
  };
  
  // Always use the fixed HUD-style overlay matching GameTimer
  return (
    <Html fullscreen>
      <div className="game-status-ui" style={defaultStyles.container}>
        <div style={defaultStyles.header}>
          {gameType.toUpperCase()} - {formatTime(gameTimeRemaining)} remaining
        </div>
        
        {/* Render custom content if provided */}
        {children ? (
          children(customContentData)
        ) : (
          // Otherwise render default tagged player indicator if available
          taggedPlayerId && (
            <div style={{
              ...defaultStyles.taggedStatus,
              backgroundColor: taggedPlayerId === myId ? '#550000' : '#000000',
              color: taggedPlayerId === myId ? '#FF5555' : '#FFFFFF'
            }}>
              {taggedPlayerId === myId ? 'YOU ARE IT!' : `${taggedPlayerId.substring(0, 5)}... is IT!`}
            </div>
          )
        )}
        
        {/* Only show additional status for debugging or if specifically requested */}
        {process.env.NODE_ENV === 'development' && (
          <>
            {showPlayerCount && (
              <div style={defaultStyles.players}>
                {playerCount > 1 ? `${playerCount} Players` : '1 Player'}
              </div>
            )}
          </>
        )}
      </div>
    </Html>
  );
};

export default GameStatusUI;
