// server.js
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
// Removed problematic import
const ServerSpatialGrid = require('./src/utils/serverSpatialGrid');

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, { 
  cors: { 
    origin: ['http://localhost:5173', 'http://127.0.0.1:5173', 'http://localhost:5174', 'http://127.0.0.1:5174'],  // Allow Vite dev server on both ports
    methods: ['GET', 'POST', 'OPTIONS'],
    credentials: true,
    allowedHeaders: ['*']
  },
  allowEIO3: true,
  transports: ['polling', 'websocket'],  // Match client config - start with polling
  pingTimeout: 30000,
  pingInterval: 5000,
  connectTimeout: 20000,
  maxHttpBufferSize: 1e8  // 100MB
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

// ========== GAME STATE TRACKING ==========
const activeGames = {};
const currentActiveGame = {};
const playersInGameZones = {};
const playerQueues = {};
const queueCountdowns = {};

// ========== GAME CONFIGS ==========
const { tagConfig } = require('./src/games/tag/config');
const gameConfigs = {
  tag: tagConfig,
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
    };
    io.emit('player-joined', players[socket.id]);
    setTimeout(() => io.emit('players', players), 100);
  });

  socket.on('move', (data) => {
    if (players[socket.id]) {
      players[socket.id].position = data.position;
      if (data.animation) players[socket.id].animation = data.animation;
      if (typeof data.rotation === 'number') players[socket.id].rotation = data.rotation;
      
      // Update player position in the spatial grid
      worldGrid.updateEntity(socket.id, data.position);
      
      socket.broadcast.emit('player-moved', { id: socket.id, ...data });
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
  socket.on('tagPlayer', (data) => {
    const { gameType, roomId, taggerId, targetId } = data;
    
    console.log(`
====== TAG EVENT RECEIVED ======
[SERVER] 🎮 Received tag event: ${taggerId.substring(0, 6)} tagged ${targetId.substring(0, 6)} in ${roomId}
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
    if (game.taggedPlayerId !== taggerId) {
      console.log(`[SERVER] ⛔ REJECTED: Player ${taggerId.substring(0, 6)} is not IT (${game.taggedPlayerId?.substring(0, 6)} is)`);
      return;
    }
    
    console.log(`[SERVER] ✅ Valid tagger: ${taggerId.substring(0, 6)} is correctly IT`);
    
    // Check if the tag is on cooldown - check BOTH directions to prevent tag-backs
    const now = Date.now();
    const forwardCooldownKey = `${taggerId}-${targetId}`; // A tags B
    const reverseCooldownKey = `${targetId}-${taggerId}`; // B tags A
    
    // Check for cooldown in either direction
    const COOLDOWN_MS = 3000; // Match the client's 3-second cooldown
    
    if (tagCooldowns[forwardCooldownKey] && now - tagCooldowns[forwardCooldownKey] < COOLDOWN_MS) {
      console.log(`[SERVER] ⏱️ Tag on direct cooldown: ${taggerId.substring(0, 6)} -> ${targetId.substring(0, 6)}`);
      return;
    }
    
    if (tagCooldowns[reverseCooldownKey] && now - tagCooldowns[reverseCooldownKey] < COOLDOWN_MS) {
      console.log(`[SERVER] ⏱️ Tag on reverse cooldown: ${taggerId.substring(0, 6)} <- ${targetId.substring(0, 6)}`);
      return;
    }
    
    // Skip distance check if positions are missing
    const taggerPos = players[taggerId]?.position;
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
    
    // Update the tagged player
    game.taggedPlayerId = targetId;
    
    // Notify all players in the game
    console.log(`[SERVER] 📢 Broadcasting playerTagged event to all players`);
    io.emit('playerTagged', {
      roomId: actualRoomId,
      gameType: game.gameType,
      taggerId,
      targetId,
      timestamp: now
    });
    
    // Update game state
    console.log(`[SERVER] 📢 Broadcasting gameStateUpdate event to all players`);
    io.emit('gameStateUpdate', {
      roomId: actualRoomId,
      gameType: game.gameType,
      state: 'playing',
      taggedPlayerId: targetId,
      endTime: game.endTime
    });
    
    console.log(`
[SERVER] ✅ SUCCESS: Player ${taggerId.substring(0, 6)} tagged ${targetId.substring(0, 6)} in ${actualRoomId}
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

  socket.on('disconnect', () => {
    // Remove player from spatial grid
    worldGrid.removeEntity(socket.id);
    
    delete players[socket.id];
    Object.keys(playersInGameZones).forEach(gameType => {
      playersInGameZones[gameType].delete(socket.id);
    });
    Object.entries(activeGames).forEach(([roomId, game]) => {
      if (game.players.includes(socket.id)) {
        game.players = game.players.filter(id => id !== socket.id);
        if (game.players.length === 0) {
          delete activeGames[roomId];
          if (currentActiveGame[game.gameType] === roomId) delete currentActiveGame[game.gameType];
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
        queueCountdowns[gameType] = false;
        io.to(roomId).emit('gameJoinCountdown', { gameType, action: 'cancelled' });
      }
    }
  });

  socket.on('getGameStatus', ({ gameType, roomId }) => {
    const game = activeGames[roomId] || activeGames[currentActiveGame[gameType]];
    if (!game) return;

    const now = Date.now();
    if (game.endTime && now >= game.endTime && game.state !== 'ended') {
      endGame(io, roomId);
    } else {
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
  const taggedPlayerId = players[Math.floor(Math.random() * players.length)];

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

  io.to(roomId).emit('gameStart', {
    roomId,
    gameType,
    players,
    taggedPlayerId,
    startTime,
    endTime,
    spawnPositions: config.spawnPoints,
  });
}

function endGame(io, roomId) {
  const game = activeGames[roomId];
  if (!game || game.state === 'ended') return;

  game.state = 'ended';
  game.endTime = Date.now();

  io.to(roomId).emit('gameEnded', {
    roomId,
    gameType: game.gameType,
    players: game.players,
    taggedPlayerId: game.taggedPlayerId,
    endTime: game.endTime,
  });

  delete currentActiveGame[game.gameType];
}

server.listen(3006, () => {
  console.log('[SERVER] Listening on port 3006');
});
