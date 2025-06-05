// server.js - Fixed version for multiplayer tag game
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const ServerSpatialGrid = require('./src/utils/serverSpatialGrid');
const { setupRaceBuilderSocketHandlers } = require('./src/games/race/server');

// Create express app with CORS config for production and development
const app = express();

// Configure CORS for both Express and Socket.IO
const corsOptions = {
  origin: [
    'https://wondr-multiplayer.vercel.app',
    'https://thefishnfts.com',
    'http://localhost:5173',
    'http://localhost:3000',
    'http://127.0.0.1:5173'
  ],
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: false
};

app.use(cors(corsOptions));

// Create HTTP server
const server = http.createServer(app);

// Create Socket.IO instance with CORS settings
const io = new Server(server, {
  cors: {
    origin: [
      'https://wondr-multiplayer.vercel.app',
      'https://thefishnfts.com',
      'http://localhost:5173',
      'http://localhost:3000',
      'http://127.0.0.1:5173'
    ],
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: false
  },
  allowEIO3: true,
  transports: ['websocket', 'polling'],  // Try websocket first, then polling
  pingTimeout: 30000,
  pingInterval: 5000,
  connectTimeout: 20000,
  maxHttpBufferSize: 1e8,  // 100MB
  cookie: false  // Disable cookies to avoid CORS issues with credentials
});

// Log all socket.io events for debugging
io.engine.on('connection_error', (err) => {
  console.log('[SERVER] Connection error:', err);
});

console.log('[SERVER] Socket.IO server configured');

// Basic route for checking server status
app.get('/', (req, res) => {
  res.send('Socket.io server is running! Connected clients: ' + io.engine.clientsCount);
});

// Add a health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: Date.now(),
    clients: io.engine.clientsCount
  });
});

// ========== PLAYER TRACKING ==========
const players = {};
let hostId = null;

// Initialize spatial grid for efficient collision detection
const worldGrid = new ServerSpatialGrid(10, 200, 200);

// Tag distance - how close players need to be to tag each other
const TAG_DISTANCE = 0.25;

// Throttle tag checks to avoid performance issues
const tagCooldowns = {};

// Helper function to find a socket by player ID
function findSocketById(playerId) {
  // In Socket.IO v4, we can use the sockets Map in the io.sockets namespace
  try {
    // First try the modern Socket.IO v4 API
    if (io.sockets && io.sockets.sockets) {
      return io.sockets.sockets.get(playerId);
    }
  } catch (e) {
    console.error(`[SERVER] Error finding socket by ID:`, e);
  }
  return null;
}

// ========== GAME STATE TRACKING ==========
const activeGames = {};
const currentActiveGame = {}; // Tracks the current active game for each game type
const gameJoinStatus = {};
const playersInGameZones = {};
const playerQueues = {};
const queueCountdowns = {};

// ========== GAME CONFIGS ==========
const { tagConfig } = require('./src/games/tag/config');

// Race builder config
const raceBuilderConfig = {
  minPlayers: 1,
  maxPlayers: 16,
  initialCountdown: 3,
  tagDistance: 1.0,
};

const gameConfigs = {
  tag: tagConfig,
  race: raceBuilderConfig,
};

// Use a different name to avoid conflict with imported getGameConfig
const localGameConfig = (gameType) => gameConfigs[gameType] || {
  minPlayers: 2,
  maxPlayers: 10,
  roundDuration: 60,
  spawnPoints: [[0, 0, 0]],
  tagDistance: 1.0,
};

// ========== SOCKET HANDLING ==========
io.on('connection', (socket) => {
  // Setup race builder socket handlers
  setupRaceBuilderSocketHandlers(io, socket, activeGames, players);
  socket.joinZones = {};
  console.log('Client connected:', socket.id);

  socket.emit('players', players);

  socket.on('join', (data) => {
    players[socket.id] = {
      id: socket.id,
      position: data.position || [0, 0, 0],
      rotation: data.rotation || 0,
      color: data.color,
      emoji: null,
      emojiTimestamp: null,
      animation: data.animation || 'idle',
      showSkateboard: data.showSkateboard || false,
    };
    io.emit('player-joined', players[socket.id]);
    setTimeout(() => io.emit('players', players), 100);
  });

  socket.on('move', (data) => {
    if (players[socket.id]) {
      players[socket.id].position = data.position;
      if (data.animation) players[socket.id].animation = data.animation;
      if (typeof data.rotation === 'number') players[socket.id].rotation = data.rotation;
      if (typeof data.showSkateboard === 'boolean') players[socket.id].showSkateboard = data.showSkateboard;
      
      // Update player position in the spatial grid
      worldGrid.updateEntity(socket.id, data.position);
      
      socket.broadcast.emit('player-moved', { id: socket.id, ...data });
    }
  });
  
  // Handle player-move event (used for teleportation)
  socket.on('player-move', (data) => {
    if (players[socket.id]) {
      // Log teleport events
      if (data.isTeleport) {
        console.log(`[SERVER] 🚀 Teleporting player ${socket.id.substring(0,6)} to [${data.position.join(', ')}]`);
      }
      
      // Update player data
      players[socket.id].position = data.position;
      
      // Update player position in the spatial grid
      worldGrid.updateEntity(socket.id, data.position);
      
      // Broadcast to all other clients
      socket.broadcast.emit('player-moved', { 
        id: socket.id, 
        position: data.position,
        isTeleport: data.isTeleport
      });
    }
  });

  socket.on('color', (color) => {
    if (players[socket.id]) {
      players[socket.id].color = color;
      socket.broadcast.emit('player-color', { id: socket.id, color });
    }
  });

  socket.on('emoji', (emoji) => {
    if (players[socket.id]) {
      players[socket.id].emoji = emoji;
      players[socket.id].emojiTimestamp = Date.now();
    }
    io.emit('player-emoji', { id: socket.id, emoji });
  });

  socket.on('emoji-removed', () => {
    if (players[socket.id]) {
      players[socket.id].emoji = null;
      players[socket.id].emojiTimestamp = null;
    }
    io.emit('player-emoji-removed', { id: socket.id });
  });

  // Handle tag events from clients
  // Handle penalty for players who jump off the map during tag game
  socket.on('penaltyTag', (data) => {
    const { gameType, roomId, playerId, reason } = data || {};
    
    // Safety check - ensure we have required data
    if (!playerId || !roomId) {
      console.error(`❌ [SERVER] Invalid penalty tag event received:`, data);
      return;
    }
    
    // Find the game
    let game = activeGames[roomId];
    let actualRoomId = roomId;
    
    // Validate the game exists
    if (!game) {
      console.log(`[SERVER] ❌ Penalty tag failed: No active game found for ${roomId}`);
      return;
    }
    
    // Ensure the game is in playing state
    if (game.state !== 'playing') {
      console.log(`[SERVER] ❌ Penalty tag failed: Game is not in playing state (${game.state})`);
      return;
    }
    
    // Validate that the player is actually in the game
    if (!game.players.includes(playerId)) {
      console.log(`[SERVER] ⛔ REJECTED: Player ${playerId.substring(0, 6)} is not a player in this game`);
      return;
    }
    
    // If the player is already IT, no need to change anything
    if (game.taggedPlayerId === playerId) {
      console.log(`[SERVER] Player ${playerId.substring(0, 6)} is already IT, no change needed`);
      return;
    }
    
    console.log(`[SERVER] 🔄 PENALTY: Player ${playerId.substring(0, 6)} jumped off map and is now IT`);
    
    // Update the tagged player to be the one who jumped off
    game.taggedPlayerId = playerId;
    
    // Send notifications about the penalty tag
    game.players.forEach(pid => {
      const playerSocket = io.sockets.sockets.get(pid);
      if (playerSocket) {
        // Send a special penalty tag event so clients can show appropriate UI
        playerSocket.emit('playerPenaltyTagged', {
          roomId: actualRoomId,
          gameType: game.gameType,
          playerId: playerId,
          reason: reason || 'jumped_off_map',
          timestamp: Date.now()
        });
        
        // Also send regular game state update
        playerSocket.emit('gameStateUpdate', {
          roomId: actualRoomId,
          gameType: game.gameType,
          state: 'playing',
          players: game.players,
          taggedPlayerId: playerId,
          endTime: game.endTime
        });
      }
    });
    
    // Also send a global state update with minimal data
    io.emit('gameStateUpdate', {
      roomId: actualRoomId,
      gameType: game.gameType,
      state: 'playing',
      taggedPlayerId: playerId
    });
    
    console.log(`[SERVER] ✅ SUCCESS: Player ${playerId.substring(0, 6)} is now IT due to penalty in ${actualRoomId}`);
  });

  socket.on('tagPlayer', (data) => {
    // Extract data with support for both naming conventions (taggerId/sourceId)
    const { 
      gameType, 
      roomId, 
      taggerId, sourceId, // Support both naming patterns
      targetId, 
      distance, 
      timestamp,
      interactionType
    } = data || {};
    
    // Normalize property names for backward compatibility
    const actualTaggerId = taggerId || sourceId;
    
    // Safety check - ensure we have required data
    if (!actualTaggerId || !targetId || !roomId) {
      console.error(`❌ [SERVER] Invalid tag event received:`, data);
      return;
    }
    
    // Safe access to properties with defaults
    const taggerIdShort = (actualTaggerId || '').substring(0, 6);
    const targetIdShort = (targetId || '').substring(0, 6);
    
    console.log(`
====== TAG EVENT RECEIVED ======
[SERVER] 🎮 Received tag event: ${taggerIdShort} tagged ${targetIdShort} in ${roomId}
[SERVER] 📏 Distance: ${distance ? distance.toFixed(2) + 'm' : 'unknown'}
[SERVER] 📝 Event type: ${interactionType || 'tag'}
`);
    // Find the game - first try exact room ID
    let game = activeGames[roomId];
    let actualRoomId = roomId;
    
    // If not found, try to find any game of this type
    if (!game && gameType) {
      console.log(`[SERVER] 🔎 Searching for game of type ${gameType}...`);
      const gameKeys = Object.keys(activeGames);
      for (const key of gameKeys) {
        if (key.startsWith(gameType)) {
          game = activeGames[key];
          actualRoomId = key;
          console.log(`[SERVER] 🔍 Found game with key ${key} instead of ${roomId}`);
          break;
        }
      }
    }
    
    // Validate the tag event
    if (!game) {
      console.log(`[SERVER] ❌ Tag failed: No active game found for ${roomId} or type ${gameType}`);
      console.log(`[SERVER] Available games:`, Object.keys(activeGames));
      return;
    }
    
    console.log(`[SERVER] 🎮 Game details:`, {
      roomId: actualRoomId,
      gameType: game.gameType,
      state: game.state,
      taggedPlayerId: game.taggedPlayerId,
      players: game.players
    });
    
    if (game.state !== 'playing') {
      console.log(`[SERVER] ❌ Tag failed: Game is not in playing state (${game.state})`);
      return;
    }
    
    // IMPORTANT: Tag validation - only the tagged player (IT) can tag others
    if (game.taggedPlayerId !== actualTaggerId) {
      console.log(`[SERVER] ⛔ REJECTED: Player ${taggerIdShort} is not IT (${game.taggedPlayerId?.substring(0, 6)} is)`);
      return;
    }
    
    // CRITICAL: Validate that both the tagger and target are actually in the game
    if (!game.players.includes(actualTaggerId)) {
      console.log(`[SERVER] ⛔ REJECTED: Tagger ${taggerIdShort} is not a player in this game`);
      return;
    }
    
    if (!game.players.includes(targetId)) {
      console.log(`[SERVER] ⛔ REJECTED: Target ${targetIdShort} is not a player in this game`);
      return;
    }
    
    console.log(`[SERVER] ✅ Valid tagger: ${taggerIdShort} is correctly IT and both players are in game`);
    
    // Check if the tag is on cooldown - check BOTH directions to prevent tag-backs
    const now = Date.now();
    const forwardCooldownKey = `${actualTaggerId}-${targetId}`; // A tags B
    const reverseCooldownKey = `${targetId}-${actualTaggerId}`; // B tags A
    
    // Check for cooldown in either direction
    const COOLDOWN_MS = 3000; // Match the client's 3-second cooldown
    
    if (tagCooldowns[forwardCooldownKey] && now - tagCooldowns[forwardCooldownKey] < COOLDOWN_MS) {
      console.log(`[SERVER] ⏱️ Tag on direct cooldown: ${taggerIdShort} -> ${targetIdShort}`);
      return;
    }
    
    if (tagCooldowns[reverseCooldownKey] && now - tagCooldowns[reverseCooldownKey] < COOLDOWN_MS) {
      console.log(`[SERVER] ⏱️ Tag on reverse cooldown: ${taggerIdShort} <- ${targetIdShort}`);
      return;
    }
    
    // Skip distance check if positions are missing
    const taggerPos = players[actualTaggerId]?.position;
    const targetPos = players[targetId]?.position;
    
    if (taggerPos && targetPos) {
      // Manual distance check as backup
      const dx = taggerPos[0] - targetPos[0];
      const dz = taggerPos[2] - targetPos[2];
      const distance = Math.sqrt(dx * dx + dz * dz);
      
      console.log(`[SERVER] 📏 Distance between players: ${distance.toFixed(2)} units`);
      
      // IMPORTANT: For testing, use a very lenient distance check
      const MAX_TAG_DISTANCE = TAG_DISTANCE * 4; // Very lenient for testing
      
      if (distance > MAX_TAG_DISTANCE) {
        console.log(`[SERVER] ❌ Tag distance check failed: ${distance.toFixed(2)} > ${MAX_TAG_DISTANCE}`);
        return;
      }
    } else {
      console.log(`[SERVER] ⚠️ Warning: Missing positions for tag check, allowing anyway`);
    }
    
    // Set cooldown for BOTH directions to prevent immediate tag-backs
    // This ensures that after A tags B, B can't immediately tag A back
    tagCooldowns[forwardCooldownKey] = now;
    tagCooldowns[reverseCooldownKey] = now;
    
    // Update the tagged player - with final validation check
    if (!game.players.includes(targetId)) {
      // Extra safety - if somehow a non-player was about to be tagged,
      // pick a random actual player instead
      console.log(`[SERVER] ⚠️ SAFETY CHECK: Target ${targetIdShort} is not in the game, picking a random player`);
      if (game.players.length > 0) {
        const randomPlayer = game.players[Math.floor(Math.random() * game.players.length)];
        game.taggedPlayerId = randomPlayer;
        console.log(`[SERVER] 🎲 Selected random player ${randomPlayer.substring(0, 6)} as IT instead`);
      }
    } else {
      // Normal update - tagged player is valid
      game.taggedPlayerId = targetId;
    }
    
    // CRITICAL FIX: Send tag events ONLY to players in the game, not globally
    console.log(`[SERVER] 📢 Broadcasting playerTagged event ONLY to players in the game`);
    game.players.forEach(playerId => {
      const playerSocket = io.sockets.sockets.get(playerId);
      if (playerSocket) {
        console.log(`[SERVER] 📣 Sending tag update to player ${playerId.substring(0, 6)}`);
        playerSocket.emit('playerTagged', {
          roomId: actualRoomId,
          gameType: game.gameType,
          taggerId: actualTaggerId,  // Use normalized tagger ID
          targetId,
          timestamp: now
        });
      }
    });
    
    // Update game state - send to game players first with accurate data
    console.log(`[SERVER] 📢 Broadcasting targeted gameStateUpdate to game players`);
    game.players.forEach(playerId => {
      const playerSocket = io.sockets.sockets.get(playerId);
      if (playerSocket) {
        playerSocket.emit('gameStateUpdate', {
          roomId: actualRoomId,
          gameType: game.gameType,
          state: 'playing',
          players: game.players,
          taggedPlayerId: targetId,
          endTime: game.endTime
        });
      }
    });
    
    // Also send a global state update with minimal data so other clients know someone is IT
    // but this won't trigger UI changes for non-players
    io.emit('gameStateUpdate', {
      roomId: actualRoomId,
      gameType: game.gameType,
      state: 'playing',
      taggedPlayerId: targetId
    });
    
    console.log(`
[SERVER] ✅ SUCCESS: Player ${actualTaggerId.substring(0, 6)} tagged ${targetId.substring(0, 6)} in ${actualRoomId}
====== TAG EVENT COMPLETED ======
`);
  });

  // Handle ping events for testing connection
  socket.on('ping', (data) => {
    //console.log(`[SERVER] 📡 Received ping from ${socket.id.substring(0, 6)}:`, data);
    // Send a pong response back to the client
    /*
    socket.emit('pong', {
      message: 'Server received your ping',
      originalData: data,
      timestamp: Date.now()
    });
    */
  });

  // ========== WEBRTC VOICE CHAT SIGNALING ==========
  
  // Handle WebRTC signaling for voice chat
  socket.on('webrtc-signal', (data) => {
    const { targetId, signal, from } = data;
    
    // Validate the data
    if (!targetId || !signal || !from) {
      console.error('[SERVER] Invalid WebRTC signal data:', data);
      return;
    }
    
    // Safe substring with null checks
    const fromShort = from ? from.substring(0, 6) : 'unknown';
    const targetShort = targetId ? targetId.substring(0, 6) : 'unknown';
    
    console.log(`[SERVER] 🔄 WebRTC Signal: ${fromShort} -> ${targetShort}`);
    console.log(`[SERVER] Signal type: ${signal.type || 'unknown'}`);
    
    // Find the target socket
    const targetSocket = io.sockets.sockets.get(targetId);
    if (targetSocket) {
      console.log(`[SERVER] ✅ Relaying WebRTC signal from ${fromShort} to ${targetShort}`);
      targetSocket.emit('webrtc-signal', { from, signal });
    } else {
      console.log(`[SERVER] ❌ Target socket ${targetShort} not found for WebRTC signal`);
      // Send error back to sender
      socket.emit('webrtc-error', { 
        targetId, 
        error: 'Target player not found',
        from: targetId 
      });
    }
  });

  // Handle voice chat join notifications
  socket.on('voice-chat-join', (data) => {
    const { playerId } = data;
    
    // Safe substring with null check
    const playerShort = playerId ? playerId.substring(0, 6) : 'unknown';
    
    console.log(`[SERVER] 🎤 Player ${playerShort} joined voice chat`);
    console.log(`[SERVER] Total connected clients: ${io.engine.clientsCount}`);
    
    // Broadcast to all other connected clients
    socket.broadcast.emit('voice-chat-join', { playerId });
  });

  // Handle voice chat leave notifications
  socket.on('voice-chat-leave', (data) => {
    const { playerId } = data;
    
    // Safe substring with null check
    const playerShort = playerId ? playerId.substring(0, 6) : 'unknown';
    
    console.log(`[SERVER] 🔇 Player ${playerShort} left voice chat`);
    
    // Broadcast to all other connected clients
    socket.broadcast.emit('voice-chat-leave', { playerId });
  });

  // Handle voice activity updates
  socket.on('voice-activity', (data) => {
    const { playerId, isActive } = data;
    
    // Only log when activity starts to avoid spam, with null check
    if (isActive && playerId) {
      const playerShort = playerId.substring(0, 6);
      console.log(`[SERVER] 🗣️ Voice activity from ${playerShort}`);
    }
    
    // Broadcast voice activity to all other clients
    socket.broadcast.emit('voice-activity', { playerId, isActive });
  });

  socket.on('disconnect', () => {
    // Remove player from spatial grid
    worldGrid.removeEntity(socket.id);
    
    delete players[socket.id];
    Object.keys(playersInGameZones).forEach(gameType => {
      playersInGameZones[gameType].delete(socket.id);
    });
    Object.entries(activeGames).forEach(([roomId, game]) => {
      // Make sure the game object exists and has a players array before accessing it
      if (game && game.players && Array.isArray(game.players) && game.players.includes(socket.id)) {
        game.players = game.players.filter(id => id !== socket.id);
        if (game.players.length === 0) {
          delete activeGames[roomId];
          if (game.gameType && currentActiveGame[game.gameType] === roomId) {
            delete currentActiveGame[game.gameType];
          }
        }
      }
    });
    io.emit('players', players);
    if (hostId === socket.id) {
      const remaining = Object.keys(players);
      hostId = remaining.length > 0 ? remaining[0] : null;
      io.emit('host-assigned', hostId);
    }
  });

  socket.on('playerEnteredZone', (data) => {
    const { gameType, roomId: incomingRoomId } = data;
    
    // Check if there's already an active game of this type
    if (currentActiveGame[gameType]) {
      const activeGameId = currentActiveGame[gameType];
      const activeGame = activeGames[activeGameId];
      
      if (activeGame && activeGame.state === 'playing') {
        console.log(`[SERVER] Player ${socket.id} tried to join ${gameType} but game is already active`);
        // Notify the client that they can't join an active game
        socket.emit('gameJoinRejected', { 
          gameType, 
          reason: 'active_game', 
          message: 'Cannot join while a game is in progress' 
        });
        return;
      }
    }
    
    if (!playersInGameZones[gameType]) playersInGameZones[gameType] = new Set();
    console.log(socket.id, 'joined game', gameType, 'with room id', incomingRoomId);
    playersInGameZones[gameType].add(socket.id);
    console.log(playersInGameZones[gameType]);
    
    if (!playerQueues[gameType]) playerQueues[gameType] = [];
    if (!playerQueues[gameType].includes(socket.id)) playerQueues[gameType].push(socket.id);

    const config = localGameConfig(gameType);
    if (playerQueues[gameType].length >= config.minPlayers && !queueCountdowns[gameType]) {
      queueCountdowns[gameType] = true;
      const startTime = Date.now();
      const duration = 5 * 1000;
      const roomId = incomingRoomId || `${gameType}-${startTime}`;
      io.emit('gameJoinCountdown', { gameType, roomId, startTime, duration });

      setTimeout(() => {
        console.log('Player queue:', playerQueues[gameType]);
        if (playerQueues[gameType].length >= config.minPlayers) {
          console.log('start the game!!');
          startGame(io, gameType, playerQueues[gameType], roomId);
          playerQueues[gameType] = [];
        }
        queueCountdowns[gameType] = false;
      }, duration);
    }
  });

  socket.on('playerExitedZone', (data) => {
    const { gameType, roomId } = data;
    if (playersInGameZones[gameType]) playersInGameZones[gameType].delete(socket.id);
    console.log(socket.id, 'left game', gameType, 'with room id', roomId);
    if (playerQueues[gameType]) {
      playerQueues[gameType] = playerQueues[gameType].filter(id => id !== socket.id);
      const config = localGameConfig(gameType);
      if (queueCountdowns[gameType] && playerQueues[gameType].length < config.minPlayers) {
        console.log(`[SERVER] Cancelling ${gameType} countdown - not enough players (${playerQueues[gameType].length}/${config.minPlayers})`);
        queueCountdowns[gameType] = false;
        // Broadcast the cancellation to ALL clients, not just those in a room
        io.emit('gameJoinCountdown', { gameType, action: 'cancelled', roomId });
      }
    }
  });

  socket.on('getGameStatus', (data) => {
    const { gameType, roomId } = data;
    if (!roomId) return;

    const game = activeGames[roomId] || activeGames[currentActiveGame[gameType]];
    if (!game) return;

    const now = Date.now();
    if (game.endTime && now >= game.endTime && game.state !== 'ended') {
      endGame(io, roomId);
    } else {
      // Verify tagged player is still connected
      if (game.taggedPlayerId) {
        const taggedSocket = io.sockets.sockets.get(game.taggedPlayerId);
        if (!taggedSocket || !taggedSocket.connected) {
          // Tagged player disconnected, select a new one
          console.log(`⚠️ [SERVER] Tagged player ${game.taggedPlayerId.substring(0, 6)} is no longer connected!`);
          
          // Filter for currently connected players
          const validPlayers = game.players.filter(playerId => {
            const playerSocket = io.sockets.sockets.get(playerId);
            return playerSocket && playerSocket.connected;
          });
          
          if (validPlayers.length > 0) {
            // Pick a new player to be IT
            game.taggedPlayerId = validPlayers[Math.floor(Math.random() * validPlayers.length)];
            console.log(`👑 [SERVER] Selected new IT player: ${game.taggedPlayerId.substring(0, 6)}`);
          }
        }
      }
      
      socket.emit('gameStatus', {
        roomId: game.roomId,
        gameType: game.gameType,
        state: game.state,
        startTime: game.startTime,
        endTime: game.endTime,
        players: game.players,
        taggedPlayerId: game.taggedPlayerId,
      });
    }
  });
});

function startGame(io, gameType, players, roomId) {
  const config = localGameConfig(gameType);
  const startTime = Date.now();
  const endTime = startTime + config.roundDuration * 1000;
  
  // Safety check - ensure we have valid players
  if (!players || !Array.isArray(players) || players.length === 0) {
    console.error(`❌ [SERVER] Cannot start game: No valid players provided`);
    return false;
  }
  
  // Validate players exist in connected clients
  const validPlayers = players.filter(playerId => {
    const socket = io.sockets.sockets.get(playerId);
    return socket && socket.connected;
  });
  
  if (validPlayers.length === 0) {
    console.error(`❌ [SERVER] Cannot start game: No valid connected players`);
    return false;
  }
  
  // Select a random connected player to be IT
  const taggedPlayerId = validPlayers[Math.floor(Math.random() * validPlayers.length)];
  console.log(`👑 [SERVER] Selected ${taggedPlayerId.substring(0, 6)} as IT from ${validPlayers.length} valid players`);

  activeGames[roomId] = {
    gameType,
    players,
    roomId,
    taggedPlayerId,
    state: 'playing',
    startTime,
    endTime,
  };

  currentActiveGame[gameType] = roomId;

  players.forEach(playerId => {
    const socket = io.sockets.sockets.get(playerId);
    if (socket) socket.join(roomId);
  });

  // CRITICAL FIX: Send gameStart ONLY to players who joined
  // First, targeted broadcast to players who joined the game
  players.forEach(playerId => {
    const playerSocket = io.sockets.sockets.get(playerId);
    if (playerSocket) {
      console.log(`[SERVER] 📣 Sending game start to player ${playerId.substring(0, 6)}`);
      playerSocket.emit('gameStart', {
        roomId,
        gameType,
        players,
        taggedPlayerId,
        startTime,
        endTime,
        spawnPositions: config.spawnPoints,
      });
    }
  });
  
  // Then update the global game state with a gameStateUpdate that includes player list
  // This ensures non-playing clients know which players are in the game,
  // but don't receive teleportation instructions
  io.emit('gameStateUpdate', {
    roomId,
    gameType,
    state: 'playing',
    players, // Include the player list so clients can check if they're in the game
    taggedPlayerId,
    startTime,
    endTime
  });
}

function endGame(io, roomId) {
  console.log(`
[SERVER] ⏱️ ENDING GAME ${roomId}...
`);
  
  const game = activeGames[roomId];
  if (!game) {
    console.log(`[SERVER] ❌ Can't end game ${roomId} - not found!`);
    return;
  }
  
  console.log(`[SERVER] Game has ${game.players.length} players and tagged player is ${game.taggedPlayerId?.substring(0, 6)}`);
  
  // Mark game as ended but keep the game object for ceremony/UI purposes
  game.state = 'ended';
  game.endTime = Date.now();

  // Notify ONLY the players that were in the game that it has ended
  game.players.forEach(playerId => {
    const playerSocket = io.sockets.sockets.get(playerId);
    if (playerSocket) {
      console.log(`[SERVER] 📣 Sending game end to player ${playerId.substring(0, 6)}`);
      playerSocket.emit('gameEnded', {
        roomId,
        gameType: game.gameType,
        players: game.players,
        taggedPlayerId: game.taggedPlayerId,
        endTime: game.endTime,
      });
    }
  });
  
  // Send a global gameStateUpdate with the ended state
  // This helps spectators know the game ended without triggering end UI
  io.emit('gameStateUpdate', {
    roomId,
    gameType: game.gameType,
    state: 'ended',
    players: game.players,
    taggedPlayerId: game.taggedPlayerId,
    endTime: game.endTime
  });
  
  // Update activeGames with the ended state to ensure UI updates correctly
  activeGames[roomId] = {
    ...game,
    state: 'ended'
  };

  // Remove this game from the current active game mapping
  delete currentActiveGame[game.gameType];
  
  // IMMEDIATE CLEANUP: Clear player queues right away to prevent stale queue issues
  console.log(`[SERVER] 🧹 Immediately clearing player queue for ${game.gameType}`);
  playerQueues[game.gameType] = [];
  
  // Reset zone player tracking to allow new games to start
  if (playersInGameZones[game.gameType]) {
    playersInGameZones[game.gameType].clear();
    console.log(`[SERVER] 🧹 Immediately cleared join zone state for ${game.gameType}`);
  }
  
  // Reset any active countdown
  if (queueCountdowns[game.gameType]) {
    queueCountdowns[game.gameType] = false;
    console.log(`[SERVER] 🔄 Immediately resetting countdown for ${game.gameType}`);
  }
  
  // Set a cleanup timer to fully remove the game object after the ceremony time
  setTimeout(() => {
    console.log(`[SERVER] 🧹 Cleaning up ended game ${roomId}`);
    
    // If the game is still in the ended state (hasn't been restarted), clean it up
    if (activeGames[roomId] && activeGames[roomId].state === 'ended') {
      // Double check that the queues and zones are still clear
      // (this is redundant with the immediate cleanup, but serves as a safety check)
      if (playerQueues[game.gameType] && playerQueues[game.gameType].length > 0) {
        console.log(`[SERVER] ⚠️ WARNING: Player queue for ${game.gameType} was not empty during final cleanup`);
        playerQueues[game.gameType] = [];
      }
      
      if (playersInGameZones[game.gameType] && playersInGameZones[game.gameType].size > 0) {
        console.log(`[SERVER] ⚠️ WARNING: Join zone tracking for ${game.gameType} was not empty during final cleanup`);
        playersInGameZones[game.gameType].clear();
      }
      
      // Finally, clean up the actual game object
      delete activeGames[roomId];
      console.log(`[SERVER] 🗑️ Removed ended game ${roomId}`);
    } else {
      console.log(`[SERVER] Game ${roomId} no longer in ended state or already removed`);
    }
  }, 10000); // 10 seconds after game end (allowing time for ceremony)
}

// Start the server right away (no initialization needed)
server.listen(3006, () => {
  console.log('[SERVER] Listening on port 3006');
  console.log('[SERVER] Race builder system ready');
});
