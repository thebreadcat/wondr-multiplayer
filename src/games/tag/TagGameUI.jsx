/**
 * TagGameUI.jsx
 * Displays the UI for the tag game, showing who is currently IT
 */
import React, { useEffect, useState } from 'react';
import { useGameSystem } from '../../components/GameSystemProvider';
import './TagGameUI.css';

export function TagGameUI({ gameType = 'tag', roomId, players, myId }) {
  // Use a try-catch to handle cases where useGameSystem might return undefined
  // This can happen if the component is rendered outside of a GameSystemProvider
  let activeGames = {};
  try {
    const gameSystem = useGameSystem();
    activeGames = gameSystem?.activeGames || {};
  } catch (error) {
    console.log('[TagGameUI] Game system not available:', error);
  }
  
  const [taggedPlayerName, setTaggedPlayerName] = useState('');
  const [isCurrentPlayerTagged, setIsCurrentPlayerTagged] = useState(false);
  
  // Helper function to check if a player is in a specific game
  const isPlayerInGame = (playerId, gameType, roomId) => {
    if (!playerId || !activeGames) return false;
    
    // If roomId is provided, check that specific game
    if (roomId && activeGames[roomId]) {
      return activeGames[roomId]?.players?.includes(playerId);
    }
    
    // Otherwise check all games of the given type
    return Object.values(activeGames || {}).some(game => 
      game?.gameType === gameType && game?.players?.includes(playerId)
    );
  };
  
  // Get the active game
  const game = roomId ? activeGames[roomId] : 
    Object.values(activeGames).find(g => g.gameType === gameType);
  
  useEffect(() => {
    if (!game) return;
    
    const taggedId = game.taggedPlayerId;
    const isTagged = taggedId === myId;
    
    // Set the tagged player state
    setIsCurrentPlayerTagged(isTagged);
    
    // Get the tagged player's name
    if (taggedId) {
      // Just use the first 6 chars of their ID if players object is not available
      const playerName = players && players[taggedId] ? 
        (players[taggedId].name || taggedId.substring(0, 6)) : 
        taggedId.substring(0, 6);
      setTaggedPlayerName(playerName);
    } else {
      setTaggedPlayerName('Unknown');
    }
  }, [game, myId, players]);
  
  // Don't render anything if there's no active game or the player is not in the game
  if (!game || !isPlayerInGame(myId, gameType, roomId)) {
    return null;
  }
  
  return (
    <div className="tag-game-ui">
      <div className="tag-status">
        <div className="tag-indicator">
          {isCurrentPlayerTagged ? (
            <div className="you-are-it">
              <span className="tag-emoji">🔴</span> You are IT!
            </div>
          ) : (
            <div className="tagged-player">
              <span className="tag-emoji">🟢</span> {taggedPlayerName} is IT
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
