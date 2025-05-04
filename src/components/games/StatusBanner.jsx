// src/components/games/StatusBanner.jsx
import React, { useState, useEffect, useContext } from 'react';
import { Html } from '@react-three/drei';
import { useMultiplayer } from '../MultiplayerProvider';
import { GameSystemContext } from '../GameSystemProvider';

export function StatusBanner({ 
  text, 
  color = '#FFFFFF', 
  backgroundColor = 'rgba(0,0,0,0.7)',
  duration = 0, // 0 = permanent, otherwise milliseconds to show
  position = 'top', // 'top', 'middle', 'bottom'
  size = 'medium', // 'small', 'medium', 'large'
  gameType, // Optional - if provided, will check if player is in this game
  roomId, // Optional - if provided, will check if player is in this room
  showToAllPlayers = false // Force show to all players
}) {
  const { myId } = useMultiplayer();
  const { isPlayerInGame, isPlayerInZone } = useContext(GameSystemContext);
  
  // Check if we should show this banner to the current player
  const shouldShowToPlayer = () => {
    // Always show if explicitly requested
    if (showToAllPlayers) return true;
    
    // If no game info provided, default to show
    if (!gameType) return true;
    
    // Check if player is in specified game
    if (isPlayerInGame && gameType) {
      return isPlayerInGame(myId, gameType, roomId);
    }
    
    // Check if player is in zone for this game type
    if (isPlayerInZone && gameType) {
      return isPlayerInZone(myId, gameType);
    }
    
    return true;
  };
  const [visible, setVisible] = useState(true);
  
  useEffect(() => {
    if (duration > 0) {
      const timer = setTimeout(() => {
        setVisible(false);
      }, duration);
      
      return () => clearTimeout(timer);
    }
  }, [duration]);
  
  // Don't render if not visible, no text, or shouldn't show to this player
  if (!visible || !text || !shouldShowToPlayer()) {
    return null;
  }
  
  // Determine font size based on size prop
  let fontSize;
  switch (size) {
    case 'small':
      fontSize = '24px';
      break;
    case 'large':
      fontSize = '48px';
      break;
    case 'medium':
    default:
      fontSize = '32px';
      break;
  }
  
  // Determine position
  let positionStyle;
  switch (position) {
    case 'top':
      positionStyle = { top: '10%', left: '50%', transform: 'translateX(-50%)' };
      break;
    case 'bottom':
      positionStyle = { bottom: '10%', left: '50%', transform: 'translateX(-50%)' };
      break;
    case 'middle':
    default:
      positionStyle = { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' };
      break;
  }
  
  return (
    <Html fullscreen zIndexRange={[100, 0]}>
      <div style={{
        position: 'absolute',
        ...positionStyle,
        padding: '15px 30px',
        borderRadius: '10px',
        backgroundColor,
        color,
        fontSize,
        fontWeight: 'bold',
        textAlign: 'center',
        maxWidth: '80%',
        boxShadow: '0 0 20px rgba(0,0,0,0.5)',
        animation: 'fadeIn 0.3s ease-in-out',
        fontFamily: "'Inter', sans-serif",
      }}>
        {text}
      </div>
    </Html>
  );
}
