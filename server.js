const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

// Test route for browser
app.get('/', (req, res) => {
  res.send('Socket.io server is running!');
});

let players = {};
let hostId = null;

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  // Immediately send all existing players to the new player
  socket.emit('players', players);

  // Broadcast new player to everyone else AFTER full state sent
  socket.on('join', (data) => {
    const player = {
      id: socket.id,
      position: data.position || [0, 0, 0],
      rotation: data.rotation || 0,
      color: data.color,
      emoji: null,
      emojiTimestamp: null,
      animation: data.animation || 'idle'
    };
    players[socket.id] = player;

    // Important: Broadcast to ALL clients including sender
    // This ensures existing players know about new players
    io.emit('player-joined', player);
    
    // Also broadcast the full player list after a small delay
    // This helps ensure consistent state across all clients
    setTimeout(() => {
      io.emit('players', players);
    }, 100); // Small delay to ensure client is ready
    
    console.log(`Player joined: ${socket.id}`);
    console.log('Current players state:', players);
  });

  // Handle player movement
  socket.on('move', (data) => {
    if (players[socket.id]) {
      players[socket.id].position = data.position;
      if (data.animation) players[socket.id].animation = data.animation;
      if (typeof data.rotation === 'number') players[socket.id].rotation = data.rotation;

      socket.broadcast.emit('player-moved', {
        id: socket.id,
        position: data.position,
        color: data.color,
        animation: data.animation,
        rotation: data.rotation,
      });
    }
  });

  // Handle player color update
  socket.on('color', (color) => {
    if (players[socket.id]) {
      players[socket.id].color = color;
      console.log('Player color updated:', socket.id, color);
      socket.broadcast.emit('player-color', { id: socket.id, color });
    }
  });

  // Handle emoji update
  socket.on('emoji', (emoji) => {
    console.log(`Received emoji from player ${socket.id}:`, emoji);
    if (players[socket.id]) {
      players[socket.id].emoji = emoji;
      players[socket.id].emojiTimestamp = Date.now();
    }
    io.emit('player-emoji', { id: socket.id, emoji });
  });

  // Handle emoji removal
  socket.on('emoji-removed', () => {
    console.log(`Emoji removed for player ${socket.id}`);
    if (players[socket.id]) {
      players[socket.id].emoji = null;
      players[socket.id].emojiTimestamp = null;
    }
    io.emit('player-emoji-removed', { id: socket.id });
  });

  // Handle state refresh from existing players
  socket.on('refresh-state', (playerState) => {
    if (players[playerState.id]) {
      // Update server's record of this player's state
      players[playerState.id] = {
        ...players[playerState.id],
        ...playerState
      };
      
      // No need to broadcast here as this is just keeping server state in sync
      console.log(`Player state refreshed for ${playerState.id}`);
    }
  });

  // Handle full resync request
  socket.on('request-players', () => {
    // Send current state to the requesting client
    socket.emit('players', players);
    console.log(`Resync requested by ${socket.id}`);
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
    
    // Check if player exists before removal
    if (players[socket.id]) {
      delete players[socket.id];
      
      // Notify all clients that a player has left
      io.emit('player-left', socket.id);
      
      // Send updated player list after player leaves
      setTimeout(() => {
        io.emit('players', players);
      }, 100);
    }

    if (socket.id === hostId) {
      const remaining = Object.keys(players);
      hostId = remaining.length > 0 ? remaining[0] : null;
      io.emit('host-assigned', hostId);
    }
  });
});

server.listen(3006, () => {
  console.log('Socket.io server running on port 3006');
});
