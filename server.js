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

  // Send all existing players to the new player
  socket.emit('players', players);

  // Broadcast new player to everyone else AFTER full state sent
  socket.on('join', (data) => {
    const player = {
      id: socket.id,
      position: data.position || [0, 0, 0],
      rotation: [0, 0, 0],
      color: data.color,
      emoji: null,
      emojiTimestamp: null,
      animation: 'idle'
    };
    players[socket.id] = player;

    socket.broadcast.emit('player-joined', player);
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

  // Handle full resync request
  socket.on('request-players', () => {
    socket.emit('players', players);
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
    delete players[socket.id];
    io.emit('player-left', socket.id);

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
