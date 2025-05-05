/**
 * TagPlayerIndicator.jsx
 * Shows colored indicators above players' heads in tag game
 * 🔴 above the player who is IT
 * 🔵 above other players who are in the game
 */
import React from 'react';
import { Html } from '@react-three/drei';
import { useGameSystem } from '../../components/GameSystemProvider';

const TagPlayerIndicator = ({ playerId }) => {
  const { activeGames } = useGameSystem();
  
  // Find active tag game
  const tagGame = Object.entries(activeGames || {}).find(([id, game]) => 
    game?.gameType === 'tag' && game?.state === 'playing'
  );
  
  // If no active game or this player is not in the game, don't show any indicator
  if (!tagGame || !tagGame[1].players?.includes(playerId)) {
    return null;
  }
  
  // Determine if this player is IT
  const isTagged = tagGame[1].taggedPlayerId === playerId;
  
  // Style for indicator
  const indicatorStyle = {
    fontSize: '4px',
    filter: 'drop-shadow(0 0 2px rgba(0,0,0,0.25))',
    transition: 'all 0.3s ease'
  };
  
  return (
    <Html
      position={[0, 0.6, 0]}
      center
      distanceFactor={15}
    >
      <div style={indicatorStyle}>
        {isTagged ? '🔴' : '🔵'}
      </div>
    </Html>
  );
};

export default TagPlayerIndicator;
