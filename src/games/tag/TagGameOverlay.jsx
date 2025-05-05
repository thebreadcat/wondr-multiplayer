/**
 * TagGameOverlay.jsx
 * A React component that provides a fixed HTML overlay UI for the tag game
 * This overlay sits outside the Three.js canvas for reliable positioning
 */
import React, { useEffect, useState, useRef } from 'react';
import { useMultiplayer } from '../../components/MultiplayerProvider';
import { useGameSystem } from '../../components/GameSystemProvider';
import { getSocket } from '../../utils/socketManager';

const TagGameOverlay = ({ gameType = 'tag' }) => {
  const { myId } = useMultiplayer();
  const { activeGames } = useGameSystem();
  const socket = getSocket();

  // Game state
  const [taggedPlayerId, setTaggedPlayerId] = useState(null);
  const [isTagged, setIsTagged] = useState(false);
  const [gameTimeRemaining, setGameTimeRemaining] = useState(0);
  const [isPlayerInGame, setIsPlayerInGame] = useState(false);
  const [roomId, setRoomId] = useState(null);
  const [gameState, setGameState] = useState('waiting');
  const [showEndCeremony, setShowEndCeremony] = useState(false);
  const [fadeOut, setFadeOut] = useState(false);
  const fadeOutTimerRef = useRef(null);

  // Format time as MM:SS
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Game end time ref to maintain a stable reference for the timer
  const gameEndTimeRef = useRef(null);
  
  // Find active tag game and handle game state changes
  useEffect(() => {
    // Find tag game of any state 
    const tagGame = Object.entries(activeGames || {}).find(([id, game]) => 
      game?.gameType === gameType
    );
    
    if (tagGame) {
      const [gameRoomId, game] = tagGame;
      setRoomId(gameRoomId);
      setGameState(game.state || 'waiting');
      
      // Check if player is in this game
      const playerIsInGame = game.players?.includes(myId);
      setIsPlayerInGame(playerIsInGame);
      
      // Handle different game states
      if (game.state === 'playing') {
        // Clear any existing fade out timer
        if (fadeOutTimerRef.current) {
          clearTimeout(fadeOutTimerRef.current);
          fadeOutTimerRef.current = null;
        }
        
        setFadeOut(false);
        setShowEndCeremony(false);
        
        // Update tagged state
        setTaggedPlayerId(game.taggedPlayerId);
        setIsTagged(game.taggedPlayerId === myId);
        
        // Store the end time in ref for stable timer
        if (game.endTime) {
          gameEndTimeRef.current = game.endTime;
          const remaining = Math.max(0, Math.floor((game.endTime - Date.now()) / 1000));
          setGameTimeRemaining(remaining);
        }
      } 
      else if (game.state === 'ended' && playerIsInGame) {
        // Game just ended - show end ceremony
        console.log(`[TagGameOverlay] Game ended, showing end ceremony`);
        setShowEndCeremony(true);
        
        // Set a timer to fade out the UI after showing the end ceremony
        fadeOutTimerRef.current = setTimeout(() => {
          console.log(`[TagGameOverlay] Fading out end ceremony`);
          setFadeOut(true);
          
          // After fadeout animation completes, hide the UI completely
          setTimeout(() => {
            console.log(`[TagGameOverlay] Hiding UI completely`);
            setShowEndCeremony(false);
          }, 2000); // Match the CSS animation duration
        }, 5000); // Show end ceremony for 5 seconds
      }
    } else {
      // No tag game found
      setRoomId(null);
      setGameState('waiting');
      setIsPlayerInGame(false);
      setTaggedPlayerId(null);
      setIsTagged(false);
      setGameTimeRemaining(0);
    }
    
    // Clean up any timers when component unmounts or dependencies change
    return () => {
      if (fadeOutTimerRef.current) {
        clearTimeout(fadeOutTimerRef.current);
      }
    };
  }, [activeGames, myId, gameType]);

  // Set up continuous timer update (fixes timer freezing issue)
  useEffect(() => {
    // Only run timer when game is active and we have an end time
    if (gameState === 'playing' && gameEndTimeRef.current) {
      console.log(`[TagGameOverlay] Starting timer interval, end time: ${new Date(gameEndTimeRef.current).toISOString()}`);
      
      // Update every second
      const timerInterval = setInterval(() => {
        const now = Date.now();
        const endTime = gameEndTimeRef.current;
        const remaining = Math.max(0, Math.floor((endTime - now) / 1000));
        
        // Update the countdown
        setGameTimeRemaining(remaining);
        
        // If timer reaches zero, we can clear the interval
        if (remaining <= 0) {
          clearInterval(timerInterval);
        }
      }, 1000);
      
      // Clean up interval on unmount or when game state changes
      return () => {
        clearInterval(timerInterval);
        console.log(`[TagGameOverlay] Cleared timer interval`);
      };
    }
  }, [gameState]);

  // Listen for game state updates
  useEffect(() => {
    if (!socket) return;
    
    const handleGameStateUpdate = (data) => {
      if (data.gameType !== gameType) return;
      
      // Update tagged player
      if (data.taggedPlayerId) {
        setTaggedPlayerId(data.taggedPlayerId);
        setIsTagged(data.taggedPlayerId === myId);
      }
      
      // Update time remaining
      if (data.endTime) {
        const remaining = Math.max(0, Math.floor((data.endTime - Date.now()) / 1000));
        setGameTimeRemaining(remaining);
      }
    };
    
    const handlePlayerTagged = (data) => {
      if (data.gameType !== gameType) return;
      
      // Update tagged state
      if (data.targetId) {
        setTaggedPlayerId(data.targetId);
        setIsTagged(data.targetId === myId);
      }
    };
    
    socket.on('gameStateUpdate', handleGameStateUpdate);
    socket.on('playerTagged', handlePlayerTagged);
    
    return () => {
      socket.off('gameStateUpdate', handleGameStateUpdate);
      socket.off('playerTagged', handlePlayerTagged);
    };
  }, [socket, myId, gameType]);

  // CSS for fade animation
  const fadeStyle = {
    transition: 'opacity 2s ease-out',
    opacity: fadeOut ? 0 : 1
  };
  
  // Don't render if player is not in a game and not showing end ceremony
  if ((!isPlayerInGame || !roomId) && !showEndCeremony) return null;

  // Regular game UI
  if (gameState === 'playing' && !showEndCeremony) {
    return (
      <div style={{
        ...fadeStyle,
        position: 'fixed', top: 20, left: '50%', transform: 'translateX(-50%)',
        zIndex: 1000, display: 'flex', flexDirection: 'column', alignItems: 'center', width: '300px'
      }}>
        <div style={{
          backgroundColor: '#000000', color: '#FFFFFF', padding: '10px 20px', borderRadius: '8px',
          fontWeight: 'bold', fontSize: '20px', textAlign: 'center', marginBottom: '10px',
          width: '100%', boxShadow: '0 4px 8px rgba(0,0,0,0.5)'
        }}>
          {gameType.toUpperCase()} - {formatTime(gameTimeRemaining)} remainingz
        </div>
        {taggedPlayerId && (
          <div style={{
            backgroundColor: isTagged ? '#550000' : '#000000',
            color: isTagged ? '#FF5555' : '#FFFFFF',
            padding: '8px 16px', borderRadius: '8px', fontSize: '16px', textAlign: 'center',
            width: '90%', boxShadow: '0 4px 8px rgba(0,0,0,0.5)'
          }}>
            {isTagged ? 'YOU ARE IT!' : `${taggedPlayerId.substring(0, 5)}... is IT!`}
          </div>
        )}
      </div>
    );
  }
  
  // End game ceremony UI
  if (showEndCeremony) {
    // Determine if the player won or lost
    const playerWon = !isTagged; // If you're not tagged when game ends, you win!
    
    return (
      <div style={{
        ...fadeStyle,
        position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
        zIndex: 1000, display: 'flex', flexDirection: 'column', alignItems: 'center',
        width: '400px', textAlign: 'center'
      }}>
        <div style={{
          backgroundColor: playerWon ? '#005500' : '#550000',
          color: playerWon ? '#55FF55' : '#FF5555',
          padding: '20px 30px', borderRadius: '12px', fontSize: '32px', fontWeight: 'bold',
          width: '100%', boxShadow: '0 8px 16px rgba(0,0,0,0.5)', marginBottom: '20px',
          animation: 'pulse 1s infinite alternate'
        }}>
          {playerWon ? 'YOU WON!' : 'YOU LOST!'}
        </div>
        <div style={{
          backgroundColor: 'rgba(0,0,0,0.8)',
          color: '#FFFFFF',
          padding: '15px 25px', borderRadius: '8px', fontSize: '18px',
          width: '90%', boxShadow: '0 4px 8px rgba(0,0,0,0.5)'
        }}>
          {playerWon 
            ? 'Congratulations! You survived without being tagged!' 
            : 'Better luck next time! You were IT when the game ended.'}
        </div>
      </div>
    );
  }
  
  return null;
};

export default TagGameOverlay;
