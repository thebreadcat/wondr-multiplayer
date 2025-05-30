// src/games/race/server/index.js

/**
 * Sets up socket handlers for race game functionality
 */
function setupRaceBuilderSocketHandlers(io, socket, activeGames, players) {
    console.log('[SERVER] 🏁 Setting up race socket handlers');
    socket.on('race:build', (data) => {
      console.log('[SERVER] 🏁 Received race:build event', data);
      const { roomId, startLine, checkpoints } = data;
  
      if (!roomId || !startLine || !checkpoints || !checkpoints.length) {
        console.warn('[SERVER] ⚠️ Invalid race build data', data);
        return;
      }
  
      // Create race data object
      const raceData = {
        roomId,
        gameType: 'race',
        startLine,
        checkpoints: checkpoints.map((pos, index) => ({
          id: `checkpoint-${index}-${Date.now()}`,
          position: pos
        })),
        state: 'waiting',
        players: [],
      };
      
      // Save to the dynamic room ID
      activeGames[roomId] = raceData;
      
      // Also save to 'main-room' for consistent access
      activeGames['main-room'] = {
        ...raceData,
        roomId: 'main-room' // Override roomId to be 'main-room'
      };
  
      console.log(`[SERVER] 🏁 Race built for room ${roomId} and main-room`);
  
      // Emit to both room IDs
      io.emit('race:data', activeGames[roomId]);
      io.emit('race:data', activeGames['main-room']);
    });
  
    // Add handler for listing available race rooms
    socket.on('race:listRooms', () => {
      // Filter active games to only include races
      const raceRooms = Object.keys(activeGames).filter(roomId => {
        return activeGames[roomId] && activeGames[roomId].gameType === 'race';
      });
      
      console.log(`[SERVER] 📋 Sending list of ${raceRooms.length} race rooms to ${socket.id.substring(0,6)}`);
      socket.emit('race:rooms', raceRooms);
    });
    
    // Add handler for getting race data for a specific room
    socket.on('race:getData', ({ roomId }) => {
      const game = activeGames[roomId];
      if (!game || game.gameType !== 'race') {
        console.log(`[SERVER] ⚠️ Player ${socket.id.substring(0,6)} requested data for invalid race ${roomId}`);
        socket.emit('race:data_error', { message: 'Race not found or invalid' });
        return;
      }
      
      console.log(`[SERVER] 🏁 Sending race data for room ${roomId} to ${socket.id.substring(0,6)}`);
      socket.emit('race:data', game);
    });
    
    socket.on('race:join', ({ roomId, playerId }) => {
      const game = activeGames[roomId];
      if (!game || game.gameType !== 'race') {
        console.log(`[SERVER] ⚠️ Player ${socket.id.substring(0,6)} attempted to join invalid race ${roomId}`);
        // Send error feedback to player
        socket.emit('race:join_error', { message: 'Race not found or invalid' });
        return;
      }
  
      // Use socket.id if playerId isn't provided
      const actualPlayerId = playerId || socket.id;
      
      if (!game.players.includes(actualPlayerId)) {
        game.players.push(actualPlayerId);
        console.log(`[SERVER] 🏃‍♂️ Player ${actualPlayerId.substring(0,6)} joined race ${roomId} (${game.players.length} players total)`);
      } else {
        console.log(`[SERVER] 🔄 Player ${actualPlayerId.substring(0,6)} rejoined race ${roomId}`);
      }
      
      // Track player in join zone (similar to tag game)
      if (!game.playersInJoinZone) game.playersInJoinZone = new Set();
      game.playersInJoinZone.add(actualPlayerId);
      
      // Start countdown if we have enough players and no countdown is running
      const minPlayers = 1; // For race, we only need 1 player
      if (game.playersInJoinZone.size >= minPlayers && !game.countdownActive) {
        game.countdownActive = true;
        game.countdownStartTime = Date.now();
        game.countdownDuration = 5000; // 5 seconds
        
        console.log(`[SERVER] ⏱ Starting race join countdown for room ${roomId} with ${game.playersInJoinZone.size} players`);
        
        // Broadcast countdown to all players
        io.emit('race:countdown', {
          roomId,
          startTime: game.countdownStartTime,
          duration: game.countdownDuration,
          message: 'Race starting soon!'
        });
        
        // Schedule race start after countdown
        game.countdownTimer = setTimeout(() => {
          if (game.playersInJoinZone.size >= minPlayers) {
            console.log(`[SERVER] 🏁 Starting race in room ${roomId} with ${game.playersInJoinZone.size} players`);
            
            // Update game state
            game.state = 'racing';
            game.startTime = Date.now();
            
            // Broadcast race start to all players
            io.emit('race:start', {
              roomId,
              timeStart: game.startTime,
              players: Array.from(game.playersInJoinZone)
            });
          } else {
            console.log(`[SERVER] ⛔ Race countdown cancelled - not enough players in join zone`);
            io.emit('race:countdown_cancelled', { roomId });
          }
          
          // Reset countdown state
          game.countdownActive = false;
          game.countdownTimer = null;
        }, game.countdownDuration);
      }
  
      // Send detailed confirmation back to the joining player
      socket.emit('race:joined', {
        roomId,
        startLine: game.startLine,
        checkpoints: game.checkpoints,
        countdown: game.countdownActive ? game.countdownDuration : 3000, // ms
        countdownStartTime: game.countdownStartTime,
        message: 'Successfully joined race! Get ready for the countdown.',
        playerCount: game.players.length
      });
  
      // Notify all other players about the new participant
      socket.broadcast.emit('race:playerJoined', { 
        roomId, 
        playerId: actualPlayerId,
        playerCount: game.players.length,
        message: `A new player has joined the race! (${game.players.length} total)`
      });
      
      // Update race state if needed
      if (game.state === 'waiting') {
        game.state = 'ready';
        console.log(`[SERVER] 🏁 Race ${roomId} is now ready with ${game.players.length} players`);
      }
    });
  
    // Handle player leaving a race (cancelling join)
    socket.on('race:leave', ({ roomId, playerId }) => {
      const game = activeGames[roomId];
      if (!game) {
        console.log(`[SERVER] ⚠️ Player ${socket.id.substring(0,6)} attempted to leave non-existent race ${roomId}`);
        return;
      }
      
      // Use socket.id if playerId isn't provided
      const actualPlayerId = playerId || socket.id;
      
      // Remove player from the join zone
      if (game.playersInJoinZone && game.playersInJoinZone.has(actualPlayerId)) {
        game.playersInJoinZone.delete(actualPlayerId);
        console.log(`[SERVER] 🚶 Player ${actualPlayerId.substring(0,6)} left race join zone for ${roomId} (${game.playersInJoinZone.size} players remaining)`);
        
        // Check if we need to cancel the countdown
        const minPlayers = 1; // For race, we only need 1 player
        if (game.countdownActive && game.playersInJoinZone.size < minPlayers) {
          console.log(`[SERVER] ⛔ Cancelling race countdown for ${roomId} - not enough players in join zone`);
          
          // Clear the countdown timer
          if (game.countdownTimer) {
            clearTimeout(game.countdownTimer);
            game.countdownTimer = null;
          }
          
          // Reset countdown state
          game.countdownActive = false;
          
          // Notify all players that the countdown was cancelled
          io.emit('race:countdown_cancelled', {
            roomId,
            reason: 'not_enough_players',
            message: 'Race countdown cancelled - not enough players in join zone'
          });
        }
      }
      
      // Remove player from the race participants list
      const playerIndex = game.players.indexOf(actualPlayerId);
      if (playerIndex !== -1) {
        game.players.splice(playerIndex, 1);
        console.log(`[SERVER] 🚶 Player ${actualPlayerId.substring(0,6)} left race ${roomId} (${game.players.length} players remaining)`);
        
        // Notify other players
        socket.broadcast.emit('race:playerLeft', {
          roomId,
          playerId: actualPlayerId,
          playerCount: game.players.length,
          message: `A player has left the race. (${game.players.length} remaining)`
        });
      }
    });
    
    socket.on('race:start', ({ roomId, timeStart }) => {
      const game = activeGames[roomId];
      if (!game) return;
  
      game.state = 'racing';
      game.startTime = timeStart;
  
      console.log(`[SERVER] ⏱ Race started in room ${roomId}`);
  
      io.emit('race:start', { roomId, timeStart });
    });
  
    socket.on('race:checkpoint', ({ roomId, playerId, checkpointId, index }) => {
      const game = activeGames[roomId];
      if (!game) return;

      console.log(`[SERVER] ✅ Player ${playerId} passed checkpoint ${checkpointId} in ${roomId}`);
  
      // Broadcast to all other players
      socket.broadcast.emit('opponent:checkpoint', {
        roomId,
        playerId,
        checkpointId,
        index
      });
    });
  
    socket.on('race:finished', ({ roomId, timeElapsed }) => {
      const game = activeGames[roomId];
      if (!game) return;
  
      console.log(`[SERVER] 🏁 Race finished in ${roomId}, time: ${timeElapsed}ms`);
  
      io.emit('race:finished', {
        roomId,
        timeElapsed,
      });
    });
}

// Export the function for use in server.js
module.exports = {
  setupRaceBuilderSocketHandlers
};