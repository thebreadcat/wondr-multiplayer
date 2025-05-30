// src/games/gameRegistry.js
// Central registry for all game types and their configurations

// Import game logic hooks and configs
import { useTagGameLogic } from './tag/useTagGameLogic';
import { tagConfig } from './tag/config';

export const gameRegistry = {
  tag: {
    name: 'Classic Tag',
    description: 'Run and tag your friends!',
    useGameLogic: useTagGameLogic,
    config: tagConfig,
  },
  race: {
    name: 'Race Builder',
    description: 'Create custom race tracks and compete for the best time!',
    config: {
      minPlayers: 1,
      maxPlayers: 16,
      initialCountdown: 3
    }
  },
  // Add more games here as they're developed
};

// Helper function to get a list of all available games
export function getAvailableGames() {
  return Object.entries(gameRegistry).map(([id, game]) => ({
    id,
    name: game.name,
    description: game.description
  }));
}

// Helper to create unique room IDs with timestamps
export function createGameRoomId(gameType) {
  const timestamp = new Date().getTime();
  return `${gameType}_${timestamp}`;
}
