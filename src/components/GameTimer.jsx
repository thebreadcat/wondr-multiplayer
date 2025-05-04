// GameTimer.jsx
import React, { useState, useEffect, useRef, useContext } from 'react';
import { GameSystemContext } from './GameSystemProvider';
import { useMultiplayer } from './MultiplayerProvider';

// Simple game timer component that shows the game state
export function GameTimer({ 
  gameType = 'TAG', 
  timeRemaining = 60, 
  taggedPlayer = null, 
  myId = null,
  isGameActive = false,
  playerInGame = false
}) {
  // Only log in development mode
  if (process.env.NODE_ENV !== 'production') {
    //console.log('[GameTimer] Rendering with:', { gameType, timeRemaining, taggedPlayer, myId, isGameActive, playerInGame });
  }
  
  // Only check if the game is active
  // This ensures the timer is shown during active games
  if (!isGameActive) {
    return null;
  }

  return (
    <div style={{
      position: 'fixed', top: 20, left: '50%', transform: 'translateX(-50%)',
      zIndex: 1000, display: 'flex', flexDirection: 'column', alignItems: 'center', width: '300px'
    }}>
      <div style={{
        backgroundColor: '#000000', color: '#FFFFFF', padding: '10px 20px', borderRadius: '8px',
        fontWeight: 'bold', fontSize: '20px', textAlign: 'center', marginBottom: '10px',
        width: '100%', boxShadow: '0 4px 8px rgba(0,0,0,0.5)'
      }}>
        {gameType.toUpperCase()} - {timeRemaining} seconds remaining
      </div>
      {taggedPlayer && (
        <div style={{
          backgroundColor: myId === taggedPlayer ? '#550000' : '#000000',
          color: myId === taggedPlayer ? '#FF5555' : '#FFFFFF',
          padding: '8px 16px', borderRadius: '8px', fontSize: '16px', textAlign: 'center',
          width: '90%', boxShadow: '0 4px 8px rgba(0,0,0,0.5)'
        }}>
          {myId === taggedPlayer ? 'YOU ARE IT!' : `${taggedPlayer.substring(0, 5)}... is IT!`}
        </div>
      )}
    </div>
  );
}

// Memoized version of GameTimer to prevent unnecessary renders
const MemoizedGameTimer = React.memo(GameTimer);

export function GameTimerDemo() {
  const { myId } = useMultiplayer();
  const { isPlayerInGame, activeGames } = useContext(GameSystemContext);

  const [isGameActive, setIsGameActive] = useState(false);
  const [gameType, setGameType] = useState('tag');
  const [timeRemaining, setTimeRemaining] = useState(60);
  const [taggedPlayer, setTaggedPlayer] = useState(null);
  const [roomId, setRoomId] = useState('tag-1');
  
  // Skip rendering entirely if game is not active
  const shouldRender = useRef(false);

  // Create a ref to store the timer ID at the component level
  const timerRef = useRef(null);
  
  useEffect(() => {
    let socket;

    const initSocket = () => {
      socket = window.gameSocket || window.socket;
      if (socket) {
        setupListeners(socket);
      } else {
        setTimeout(initSocket, 500);
      }
    };

    const setupListeners = (socket) => {
      const handleGameStateUpdate = (data) => {
        console.log('[GameTimer] ⚙️ Received game state update:', data);
        
        // IMPORTANT: Make sure we have a valid roomId
        if (!data.roomId) {
          console.error('[GameTimer] ⚠️ Missing roomId in game state update:', data);
          return;
        }
        
        const extractedGameType = data.gameType || (data.roomId?.split('-')[0]) || 'tag';
        const extractedRoomId = data.roomId;
        
        console.log('[GameTimer] 💬 Using roomId:', extractedRoomId);
        
        // Always update these values
        setGameType(extractedGameType);
        setRoomId(extractedRoomId);
        
        // Force the game to be active if we receive a 'playing' state
        if (data.state === 'playing') {
          shouldRender.current = true;
          setIsGameActive(true);
          
          // Update tagged player
          if (data.taggedPlayerId) {
            setTaggedPlayer(data.taggedPlayerId);
            console.log(`[GameTimer] 🎯 Tagged player set to: ${data.taggedPlayerId.substring(0, 6)}`);
          }
          
          // Start the countdown timer
          if (data.endTime) {
            const remaining = Math.max(0, Math.floor((data.endTime - Date.now()) / 1000));
            setTimeRemaining(remaining);
            startCountdown(data.endTime);
            console.log(`[GameTimer] ⏱️ Started countdown with ${remaining} seconds remaining`);
          }
        } else if (data.state === 'ended') {
          console.log(`[GameTimer] 🏁 Game ${extractedGameType} has ENDED`);
          shouldRender.current = false;
          setIsGameActive(false);
        }  
      };

      socket.on('gameStateUpdate', handleGameStateUpdate);
      socket.on('gameStart', (data) => {
        console.log('[GameTimer] 🎮 Received game start event:', data);
        handleGameStateUpdate({ ...data, state: 'playing' });
      });
      socket.on('gameEnded', (data) => {
        if (process.env.NODE_ENV !== 'production') {
          console.log('[GameTimer] Received gameEnded event:', data);
        }
        // Explicitly reset all game state
        shouldRender.current = false;
        setIsGameActive(false);
        setTaggedPlayer(null);
        setTimeRemaining(60);
        
        // Clear any active timers
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
          if (process.env.NODE_ENV !== 'production') {
            console.log('[GameTimer] Cleared active timer on game end');
          }
        }
      });
      socket.emit('getGameStatus', { gameType: 'tag', roomId: 'tag-1' });
    };

    const startCountdown = (endTime) => {
      // Clear any existing timer
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      
      // Start a new timer
      timerRef.current = setInterval(() => {
        const now = Date.now();
        const remaining = Math.max(0, Math.floor((endTime - now) / 1000));
        setTimeRemaining(remaining);
        
        // Auto-end the game when timer reaches zero
        if (remaining <= 0) {
          clearInterval(timerRef.current);
          timerRef.current = null;
          setIsGameActive(false);
          //console.log('[GameTimer] Game timer reached zero, ending game');
        }
      }, 1000);
      
      //console.log('[GameTimer] Started countdown timer, will end at:', new Date(endTime).toLocaleTimeString());
    };

    initSocket();

    return () => {
      // Clean up socket listeners
      if (socket) {
        socket.off('gameStateUpdate');
        socket.off('gameStart');
        socket.off('gameEnded');
        //console.log('[GameTimer] Cleaned up all socket listeners');
      }
      
      // Clean up any active timers
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
        //console.log('[GameTimer] Cleared timer on component unmount');
      }
    };
  }, []);

  const prevDebug = useRef({});

  useEffect(() => {
    const debugChanged =
      JSON.stringify(prevDebug.current.activeGames) !== JSON.stringify(activeGames) ||
      prevDebug.current.roomId !== roomId ||
      prevDebug.current.isGameActive !== isGameActive;

    if (debugChanged) {
      //console.log('[GameTimer] Game info - type:', gameType, 'roomId:', roomId, 'active:', isGameActive);
      prevDebug.current = { activeGames: { ...activeGames }, roomId, isGameActive };
    }
  }, [activeGames, roomId, isGameActive, gameType]);

  // Only perform player checks if the game is active
  let playerInGame = false;
  
  if (isGameActive) {
    // Check for different room ID formats (tag-1, tag_timestamp, etc.)
    let gameExists = false;
    let gameObject = null;
    
    if (activeGames) {
      // First check exact match
      if (activeGames[roomId]) {
        gameExists = true;
        gameObject = activeGames[roomId];
      } else {
        // Then check for any active game of this type
        const gameKeys = Object.keys(activeGames);
        for (const key of gameKeys) {
          if (key.startsWith(gameType)) {
            gameExists = true;
            gameObject = activeGames[key];
            break;
          }
        }
      }
    }
    
    // Log what we know about the game (only when active)
    if (process.env.NODE_ENV !== 'production') {
      /*
      console.log('[GameTimer] Checking player status with:', {
        myId, 
        gameType, 
        roomId,
        gameExists,
        isGameActive,
        activeGames: activeGames ? Object.keys(activeGames).join(',') : 'none',
        isPlayerInGameFunction: !!isPlayerInGame
      });
      */
    }
    
    // Special case: If this player is the tagged player, they are definitely in the game
    // Check this first as it's the most efficient check
    if (taggedPlayer === myId) {
      playerInGame = true;
    }
    // First check: Use the isPlayerInGame function if available
    else if (isPlayerInGame && myId && gameType && gameExists) {
      playerInGame = isPlayerInGame(myId, gameType, roomId);
    }
    // Second check: If the game exists, check if the player is in the players list
    else if (gameObject && gameObject.players && myId) {
      if (Array.isArray(gameObject.players)) {
        playerInGame = gameObject.players.includes(myId);
      } else if (typeof gameObject.players === 'object') {
        // Handle case where players might be an object with player IDs as keys
        playerInGame = Object.keys(gameObject.players).includes(myId);
      }
    }
    // Last resort: If we still can't determine, default to showing the timer for testing
    else {
      if (process.env.NODE_ENV !== 'production') {
        console.log('[GameTimer] Defaulting playerInGame to true for testing');
      }
      playerInGame = true;
    }
  }

  // Skip rendering entirely if no game is active
  if (!shouldRender.current && !isGameActive) {
    return null;
  }
  
  // Use the memoized version to prevent unnecessary re-renders
  return (
    <MemoizedGameTimer
      gameType={gameType}
      timeRemaining={timeRemaining}
      taggedPlayer={taggedPlayer}
      myId={myId}
      isGameActive={isGameActive}
      playerInGame={playerInGame}
    />
  );
}
