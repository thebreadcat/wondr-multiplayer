// src/server/gameServer.js
// Server-side game management system

const activeGames = {};
const gamePlayerQueues = {};
console.log('===== GAME SERVER MODULE LOADED =====');
/**
 * Initialize game server functionality for a socket.io instance
 * @param {Object} io - Socket.io server instance
 */
function initGameServer(io) {
  io.on('connection', (socket) => {
    console.log(`Player connected to game server: ${socket.id}`);

    // Handle player requesting to join a game queue
    socket.on('joinGameQueue', (data) => {
      const { gameType } = data;
      const playerId = socket.id;

      // Initialize queue if it doesn't exist
      if (!gamePlayerQueues[gameType]) {
        gamePlayerQueues[gameType] = [];
      }

      // Add player if not already in queue
      if (!gamePlayerQueues[gameType].includes(playerId)) {
        gamePlayerQueues[gameType].push(playerId);
        console.log(`Player ${playerId} joined queue for ${gameType}. Queue size: ${gamePlayerQueues[gameType].length}`);

        // Notify player they joined the queue
        socket.emit('queueStatus', {
          gameType,
          position: gamePlayerQueues[gameType].length,
          status: 'joined'
        });

        // Check if we can start a game
        checkQueueAndStartGame(io, gameType);
      }
    });

    // Handle player creating a game room
    socket.on('createGameRoom', (data) => {
      const { gameType, roomId, hostId } = data;

      // Initialize game room
      activeGames[roomId] = {
        gameType,
        hostId,
        players: [hostId],
        state: 'waiting',
        startTime: null,
        endTime: null,
        taggedPlayerId: null,
        spawnPositions: {}
      };

      console.log(`Game room created: ${roomId} for ${gameType} by ${hostId}`);
      socket.join(roomId); // Join the socket.io room
    });
    
    // Track players in join zones by game type
    if (!socket.joinZones) {
      socket.joinZones = {};
    }
    
    // Handle player entering a join zone
    socket.on('playerEnteredZone', (data) => {
      const { gameType, playerId, timestamp } = data;
      console.log(`[DEBUG] Player ${playerId} entered ${gameType} zone`);
      
      // Track this player as in the zone
      if (!socket.joinZones[gameType]) {
        socket.joinZones[gameType] = new Set();
      }
      socket.joinZones[gameType].add(playerId);
      
      // Tell all players about this zone entry
      io.emit('zonePlayerUpdate', {
        gameType,
        action: 'entered',
        playerId,
        timestamp,
        playerCount: socket.joinZones[gameType].size
      });
    });
    
    // Handle player exiting a join zone
    socket.on('playerExitedZone', (data) => {
      const { gameType, playerId, timestamp } = data;
      console.log(`[DEBUG] Player ${playerId} exited ${gameType} zone`);
      
      // Remove this player from zone tracking
      if (socket.joinZones[gameType]) {
        socket.joinZones[gameType].delete(playerId);
      }
      
      // Tell all players about this zone exit
      io.emit('zonePlayerUpdate', {
        gameType,
        action: 'exited',
        playerId,
        timestamp,
        playerCount: socket.joinZones[gameType] ? socket.joinZones[gameType].size : 0
      });
    });
    
    // Handle game join countdown started
    socket.on('gameJoinCountdownStarted', (data) => {
      const { gameType, playerCount, startTime, duration } = data;
      console.log(`[DEBUG] Game join countdown started for ${gameType} with ${playerCount} players`);
      
      // Broadcast countdown to all players
      io.emit('gameJoinCountdown', {
        gameType,
        playerCount,
        startTime,
        duration,
        action: 'started'
      });
    });
    
    // Handle game join countdown cancelled
    socket.on('gameJoinCountdownCancelled', (data) => {
      const { gameType, reason } = data;
      console.log(`[DEBUG] Game join countdown cancelled for ${gameType}: ${reason}`);
      
      // Broadcast cancellation to all players
      io.emit('gameJoinCountdown', {
        gameType,
        action: 'cancelled',
        reason
      });
    });
    
    // Handle join game request from 3D join zones
    socket.on('joinGameRequest', (data) => {
      const { gameType, playersInZone } = data;
      console.log(`[DEBUG] Join game request received from ${socket.id} for ${gameType}`);
      console.log(`[DEBUG] Players in zone:`, playersInZone || 'None specified');
      
      // Print all active sockets for debugging
      const socketsInDefaultRoom = io.sockets.adapter.rooms.get('/');
      console.log(`[DEBUG] Active socket count:`, 
        io.sockets.sockets.size, 
        `Active in default room:`, 
        socketsInDefaultRoom ? socketsInDefaultRoom.size : 0
      );
      
      // This is the event that GameElements3D emits when players stand in a join zone
      // We need to create a game room and process the join
      const timestamp = Date.now();
      const roomId = `${gameType}-${timestamp}`;
      
      // First create the room
      activeGames[roomId] = {
        gameType,
        hostId: socket.id,
        players: [socket.id], // Start with the requester
        state: 'preparing', // Start in preparing state so it can immediately start
        startTime: null,
        endTime: null,
        taggedPlayerId: null,
        spawnPositions: {}
      };
      
      // Add all players from join zone if they exist
      if (playersInZone && Array.isArray(playersInZone)) {
        console.log(`[DEBUG] Adding ${playersInZone.length} players from join zone`);
        playersInZone.forEach(playerId => {
          if (playerId !== socket.id && !activeGames[roomId].players.includes(playerId)) {
            activeGames[roomId].players.push(playerId);
            
            // Get socket for this player and join them to the room
            const playerSocket = io.sockets.sockets.get(playerId);
            if (playerSocket) {
              playerSocket.join(roomId);
            }
          }
        });
      }
      
      // Join the socket.io room
      socket.join(roomId);
      
      // Broadcast the game invitation to all players
      console.log(`[DEBUG] Broadcasting game invite to all players for room ${roomId}`);
      io.emit('gameInvite', {
        roomId,
        gameType,
        hostId: socket.id,
        // Include the players that should auto-join from the join zone
        joinZonePlayers: playersInZone || []
      });
      
      // Also broadcast a direct message to the socket itself for confirmation
      socket.emit('debugJoinConfirmation', {
        message: `You (${socket.id}) successfully created game room ${roomId}`,
        roomId,
        gameType
      });
      
      console.log(`[DEBUG] Game room created through join request: ${roomId} for ${gameType}`);
      console.log(`[DEBUG] Active games:`, Object.keys(activeGames));
      
      // IMPORTANT: Start the game immediately after countdown - don't wait for additional signals
      console.log(`[DEBUG] Starting game immediately after countdown completion`);
      
      // First mark the game as preparing
      io.to(roomId).emit('gameStateUpdate', {
        roomId,
        state: 'preparing',
        meta: {
          playerCount: activeGames[roomId].players.length
        }
      });
      
      // Then immediately start the game
      startGame(io, roomId);
    });

    // Handle player joining a game
    socket.on('joinGame', (data) => {
      const { gameType, roomId, playerId } = data;
      
      // Check if game room exists
      if (!activeGames[roomId]) {
        socket.emit('gameError', { message: 'Game room does not exist' });
        return;
      }

      // Add player to game if not already in
      if (!activeGames[roomId].players.includes(playerId)) {
        activeGames[roomId].players.push(playerId);
        socket.join(roomId); // Join the socket.io room
      }

      console.log(`Player ${playerId} joined game ${roomId}. Players: ${activeGames[roomId].players.length}`);

      // Check if we have enough players to start
      checkAndStartGame(io, roomId);
    });

    // Handle player ready for game
    socket.on('readyForGame', (data) => {
      const { gameType, roomId, playerId } = data;
      
      // Mark this player as ready
      if (activeGames[roomId]?.players.includes(playerId)) {
        if (!activeGames[roomId].ready) activeGames[roomId].ready = [];
        if (!activeGames[roomId].ready.includes(playerId)) {
          activeGames[roomId].ready.push(playerId);
        }
        
        // Check if all players are ready
        if (activeGames[roomId].ready.length === activeGames[roomId].players.length) {
          startGame(io, roomId);
        }
      }
    });

    // Handle in-game actions
    socket.on('gameAction', (data) => {
      const { gameType, roomId, action, payload } = data;

      // Verify game exists and is active
      if (!activeGames[roomId] || activeGames[roomId].state !== 'playing') {
        return;
      }

      // Handle different game actions
      switch (action) {
        case 'tag':
          handleTagAction(io, roomId, payload);
          break;
        case 'gameEnd':
          endGame(io, roomId, payload);
          break;
        default:
          console.log(`Unknown game action: ${action} for game ${roomId}`);
          break;
      }
    });

    // Handle player leaving a game
    socket.on('leaveGame', (data) => {
      const { roomId, playerId } = data;
      if (activeGames[roomId]) {
        activeGames[roomId].players = activeGames[roomId].players.filter(p => p !== playerId);
        console.log(`Player ${playerId} left game ${roomId}`);

        // If game is empty, clean up
        if (activeGames[roomId].players.length === 0) {
          delete activeGames[roomId];
          console.log(`Game ${roomId} deleted (no players left)`);
        }
      }
    });

    // Clean up when socket disconnects
    socket.on('disconnect', () => {
      const playerId = socket.id;
      console.log(`Player disconnected from game server: ${playerId}`);

      // Remove from all game queues
      Object.keys(gamePlayerQueues).forEach(gameType => {
        gamePlayerQueues[gameType] = gamePlayerQueues[gameType].filter(id => id !== playerId);
      });

      // Remove from active games and notify other players
      Object.keys(activeGames).forEach(roomId => {
        const game = activeGames[roomId];
        if (game.players.includes(playerId)) {
          game.players = game.players.filter(id => id !== playerId);
          io.to(roomId).emit('playerLeft', { playerId });

          // If this player was "it", reassign role
          if (game.state === 'playing' && game.taggedPlayerId === playerId) {
            const newTaggedPlayer = game.players[Math.floor(Math.random() * game.players.length)];
            game.taggedPlayerId = newTaggedPlayer;
            io.to(roomId).emit('gameAction', {
              roomId,
              action: 'tag',
              payload: {
                taggerId: null, // System tag
                targetId: newTaggedPlayer
              }
            });
          }

          // If game is empty, clean up
          if (game.players.length === 0) {
            delete activeGames[roomId];
            console.log(`Game ${roomId} deleted (no players left)`);
          }
        }
      });
    });
  });
}

/**
 * Check if enough players are in queue to start a game
 */
function checkQueueAndStartGame(io, gameType) {
  // Get minimum players needed from game config (would need to import)
  const minPlayers = 2; // Simplified for this example

  if (gamePlayerQueues[gameType] && gamePlayerQueues[gameType].length >= minPlayers) {
    // Get players from queue
    const players = gamePlayerQueues[gameType].splice(0, minPlayers);
    
    // Create room ID
    const roomId = `${gameType}_${Date.now()}`;
    
    // Initialize game
    activeGames[roomId] = {
      gameType,
      hostId: players[0], // First player is host
      players,
      state: 'waiting',
      startTime: null,
      endTime: null,
      taggedPlayerId: null,
      spawnPositions: {}
    };

    // Notify players they've been added to a game
    players.forEach(playerId => {
      const playerSocket = io.sockets.sockets.get(playerId);
      if (playerSocket) {
        playerSocket.join(roomId);
        playerSocket.emit('gameInvite', {
          gameType,
          roomId,
          hostId: players[0]
        });
      }
    });

    console.log(`Started ${gameType} game ${roomId} with ${players.length} players`);
  }
}

/**
 * Check if we have enough players to start and if so, start the game
 */
function checkAndStartGame(io, roomId) {
  const game = activeGames[roomId];
  if (!game) return;

  // For tag game, need at least 2 players
  if (game.gameType === 'tag' && game.players.length >= 2 && game.state === 'waiting') {
    // Notify all players to get ready
    io.to(roomId).emit('gameStateUpdate', {
      roomId,
      state: 'preparing',
      meta: {
        playerCount: game.players.length
      }
    });

    // Update game state
    game.state = 'preparing';
  }
}

/**
 * Start a game with all necessary initialization
 */
function startGame(io, roomId) {
  const game = activeGames[roomId];
  if (!game) {
    console.log(`[SERVER ERROR] Cannot start game - roomId ${roomId} not found in activeGames`);
    console.log(`[SERVER DEBUG] Available rooms:`, Object.keys(activeGames));
    return;
  }
  
  if (game.state !== 'preparing') {
    console.log(`[SERVER ERROR] Cannot start game - roomId ${roomId} not in 'preparing' state (current state: ${game.state})`);
    return;
  }

  console.log(`[SERVER START] Starting game ${roomId} with ${game.players.length} players`);
  console.log(`[SERVER START] Players:`, game.players);

  // For tag game, assign initial "IT" player and spawn positions
  if (game.gameType === 'tag') {
    // Select random player to be "IT"
    const taggedPlayerIndex = Math.floor(Math.random() * game.players.length);
    game.taggedPlayerId = game.players[taggedPlayerIndex];

    // Assign spawn positions (IT player in center, others in circle)
    game.spawnPositions = {};
    game.players.forEach((playerId, index) => {
      // Simple example - would use actual spawn point coordinates from config
      const spawnIndex = (playerId === game.taggedPlayerId) ? 0 : (index % 9) + 1;
      game.spawnPositions[playerId] = spawnIndex;
    });

    // Update game state
    game.state = 'playing';
    game.startTime = Date.now();
    game.endTime = game.startTime + (60 * 1000); // 60 seconds for tag game

    // Notify all players that game is starting
    console.log(`[SERVER START] Emitting gameStart event to room ${roomId}`);
    console.log(`[SERVER START] Tagged player: ${game.taggedPlayerId}`);
    console.log(`[SERVER START] Spawn positions:`, game.spawnPositions);
    
    io.to(roomId).emit('gameStart', {
      roomId,
      gameType: game.gameType,
      taggedPlayerId: game.taggedPlayerId,
      spawnPositions: game.spawnPositions,
      startTime: game.startTime,
      endTime: game.endTime,
      gameDuration: 60 // seconds
    });
    
    // Debug check of room membership
    const roomMembers = io.sockets.adapter.rooms.get(roomId);
    console.log(`[SERVER START] Room ${roomId} has ${roomMembers ? roomMembers.size : 0} members`);
    if (roomMembers) {
      console.log(`[SERVER START] Room members:`, Array.from(roomMembers));
    }

    // Schedule game end
    setTimeout(() => {
      endGame(io, roomId);
    }, 60 * 1000);
  }
}

/**
 * Handle a tag action in the game
 */
function handleTagAction(io, roomId, payload) {
  const game = activeGames[roomId];
  if (!game || game.state !== 'playing') return;

  const { taggerId, targetId } = payload;

  // Verify tag is valid (tagger is IT)
  if (game.taggedPlayerId !== taggerId) return;

  // Update tagged player
  game.taggedPlayerId = targetId;

  // Notify all players of tag
  io.to(roomId).emit('gameAction', {
    roomId,
    action: 'tag',
    payload: {
      taggerId,
      targetId
    }
  });
}

/**
 * End a game and determine winners/losers
 */
function endGame(io, roomId, payload = null) {
  const game = activeGames[roomId];
  if (!game || game.state === 'ended') return;

  console.log(`Ending game ${roomId}`);

  // Determine final tagged player
  const finalTaggedPlayerId = payload?.taggedPlayerId || game.taggedPlayerId;

  // Update game state
  game.state = 'ended';
  game.endTime = Date.now();

  // Notify all players that game has ended
  io.to(roomId).emit('gameAction', {
    roomId,
    action: 'gameEnd',
    payload: {
      taggedPlayerId: finalTaggedPlayerId
    }
  });

  // Clean up game after a delay
  setTimeout(() => {
    delete activeGames[roomId];
    console.log(`Cleaned up game ${roomId}`);
  }, 10000); // 10 second delay before cleanup
}

module.exports = {
  initGameServer
};
