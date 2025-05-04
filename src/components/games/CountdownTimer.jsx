// src/components/games/CountdownTimer.jsx
import React, { useState, useEffect, useContext } from 'react';
import { Text, Html } from '@react-three/drei';
import { GameSystemContext } from '../GameSystemProvider';
import { useMultiplayer } from '../MultiplayerProvider';

export function CountdownTimer({ 
  gameType, 
  duration, 
  startTime, 
  onComplete, 
  roomId = '1',
  showToAllPlayers = false
}) {
  const { myId } = useMultiplayer();
  const { isPlayerInGame, isPlayerInZone } = useContext(GameSystemContext);
  const [timeLeft, setTimeLeft] = useState(calculateTimeLeft());
  
  // Check if this player should see the countdown
  const shouldShowToThisPlayer = () => {
    // Always show if requested to show to all players
    if (showToAllPlayers) return true;
    
    // Show if player is in an active game of this type
    if (isPlayerInGame && gameType && isPlayerInGame(myId, gameType, roomId)) {
      return true;
    }
    
    // Show if player is in the join zone for this game
    if (isPlayerInZone && gameType && isPlayerInZone(myId, gameType)) {
      return true;
    }
    
    return false;
  };
  
  // Debug log when mounted with roomId
  useEffect(() => {
    console.log(`[COUNTDOWN] Timer initialized for ${gameType} in room: ${roomId}, duration: ${duration}s, showing to player: ${shouldShowToThisPlayer()}`);
  }, [roomId, duration, startTime, gameType]);
  
  // Calculate time remaining
  function calculateTimeLeft() {
    const now = Date.now();
    const endTime = startTime + duration * 1000;
    const remaining = Math.max(0, Math.floor((endTime - now) / 1000));
    return remaining;
  }
  
  useEffect(() => {
    if (timeLeft <= 0) {
      if (onComplete) onComplete();
      return;
    }
    
    const timer = setInterval(() => {
      const remaining = calculateTimeLeft();
      setTimeLeft(remaining);
      
      if (remaining <= 0) {
        clearInterval(timer);
        if (onComplete) onComplete();
      }
    }, 1000);
    
    return () => clearInterval(timer);
  }, [timeLeft, startTime, duration, onComplete]);
  
  // Format the time nicely
  const formatTime = (seconds) => {
    if (seconds < 60) {
      return `${seconds}`;
    } else {
      const mins = Math.floor(seconds / 60);
      const secs = seconds % 60;
      return `${mins}:${secs.toString().padStart(2, '0')}`;
    }
  };
  
  // For overlay style (2D HTML overlay)
  if (!startTime) return null;
  
  // If this player shouldn't see the countdown, return null
  if (!shouldShowToThisPlayer()) {
    console.log(`[COUNTDOWN] Not showing countdown for ${gameType} to player ${myId} (not in game/zone)`);
    return null;
  }
  
  return (
    <>
      {/* 3D world text */}
      <Text
        position={[0, 3, 0]}
        color="#FFFFFF"
        fontSize={1.5}
        font="/fonts/Inter-Bold.woff"
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.05}
        outlineColor="#000000"
      >
        {timeLeft > 0 ? formatTime(timeLeft) : "Go!"}
      </Text>
      
      {/* Screen overlay */}
      <Html fullscreen zIndexRange={[100, 0]}>
        <div style={{
          position: 'absolute',
          top: '10%',
          left: '50%',
          transform: 'translateX(-50%)',
          fontSize: '48px',
          fontWeight: 'bold',
          color: '#FFFFFF',
          textShadow: '0 0 10px rgba(0,0,0,0.8)',
          fontFamily: "'Inter', sans-serif",
        }}>
          {timeLeft > 0 ? formatTime(timeLeft) : "Go!"}
        </div>
      </Html>
    </>
  );
}
