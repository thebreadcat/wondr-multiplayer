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

  // New player joins
  socket.on('join', (data) => {
    const player = {
      id: socket.id,
      position: [0, 0, 0],
      rotation: [0, 0, 0],
      color: data.color,
      emoji: null,
      emojiTimestamp: null,
    };
    players[socket.id] = player;
    
    // Send the new player to all other players
    socket.broadcast.emit('player-joined', player);
    
    // Send all existing players to the new player
    socket.emit('players', players);
    
    console.log(`Player joined: ${socket.id}`);
    console.log('Current players state:', players);
  });

  // Player movement update
  socket.on('move', (data) => {
    if (players[socket.id]) {
      // Update position, animation, and rotation
      players[socket.id].position = data.position;
      if (data.animation) players[socket.id].animation = data.animation;
      if (typeof data.rotation === 'number') players[socket.id].rotation = data.rotation;
      //console.log('Player moved:', socket.id, data);
      // Broadcast updated state
      socket.broadcast.emit('player-moved', {
        id: socket.id,
        position: data.position,
        color: data.color,
        animation: data.animation,
        rotation: data.rotation,
      });
    }
  });

  // Player color update
  socket.on('color', (color) => {
    if (players[socket.id]) {
      players[socket.id].color = color;
      console.log('Player color updated:', socket.id, color);
      socket.broadcast.emit('player-color', { id: socket.id, color });
    }
  });

  // Player emoji update
  socket.on('emoji', (emoji) => {
    console.log(`Received emoji from player ${socket.id}:`, emoji);
    // Update player's emoji state
    if (players[socket.id]) {
      players[socket.id].emoji = emoji;
      players[socket.id].emojiTimestamp = Date.now();
    }
    
    // Broadcast to all clients including sender
    io.emit('player-emoji', { id: socket.id, emoji });
    console.log('Current players state after emoji:', players);
  });

  socket.on('emoji-removed', () => {
    console.log(`Emoji removed for player ${socket.id}`);
    // Clear player's emoji state
    if (players[socket.id]) {
      players[socket.id].emoji = null;
      players[socket.id].emojiTimestamp = null;
    }
    
    // Broadcast to all clients including sender
    io.emit('player-emoji-removed', { id: socket.id });
    console.log('Current players state after emoji removal:', players);
  });

  // Handle disconnect
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
    delete players[socket.id];
    io.emit('player-left', socket.id);
    // Reassign host if the host left
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
