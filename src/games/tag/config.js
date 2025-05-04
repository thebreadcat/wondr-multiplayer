// src/games/tag/config.js
// Configuration for the Tag game

export const tagConfig = {
  minPlayers: 2,
  maxPlayers: 10,
  roundDuration: 60, // seconds
  freezeDuration: 2, // seconds that the IT player is frozen at start
  
  // Game area boundaries
  gameZone: {
    minY: -24, // Only limit how far down players can go
    // No other boundaries - players can go anywhere above this Y level
  },
  
  // Join zone location
  joinZone: {
    center: [-8, -0.75, -5], // Position the join zone away from spawn points
    radius: 5, // Larger radius to make it much easier to join
  },
  
  // Spawn positions for all players (same location)
  spawnPoints: [
    [0, 0, 0],    // All players spawn at the same location
    [0, 0, 0],    
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
  ],
  
  // Colors and visual settings
  taggedPlayerColor: '#FF0000', // Red for "it"
  normalPlayerColor: '#00FF00', // Green for non-tagged players
  
  // Tag mechanics
  tagDistance: 2.5, // How close players need to be for a tag
  
  // Game rules
  winCondition: 'notTaggedAtEnd', // The player who isn't IT at the end wins
  outOfBoundsPenalty: 'becomeTagged', // What happens if a player leaves the game zone
};
