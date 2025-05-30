// race-builder/server.js - Server-side functionality for the race builder system
const { v4: uuidv4 } = require('uuid');

// Storage for race data
const raceStorage = {
  activeRaces: {},
  raceResults: {}
};

/**
 * Set up socket handlers for race builder functionality
 * @param {Object} io - Socket.io server instance
 * @param {Object} socket - Socket connection for a specific client
 * @param {Object} activeGames - Object tracking active games across the server
 * @param {Object} players - Object tracking all connected players
 */
function setupRaceBuilderSocketHandlers(io, socket, activeGames, players) {
  console.log(`[Race Builder] Setting up race builder socket handlers for player ${socket.id}`);
  
  // Create a new race
  socket.on('race:create', (raceData) => {
    try {
      console.log(`[Race Builder] Player ${socket.id} is creating a new race`);
      
      // Validate input data
      if (!raceData || typeof raceData !== 'object') {
        console.error('[Race Builder] Invalid race data format - not an object');
        socket.emit('race:error', { error: 'Invalid race data format', details: 'Race data must be an object' });
        return;
      }
      
      // Log the race data we received
      console.log('[Race Builder] Received race data:', 
        JSON.stringify(raceData, (key, value) => {
          // Special handling for potentially circular references
          if (typeof value === 'object' && value !== null) {
            return { ...value };
          }
          return value;
        }, 2));
      
      // Create a valid default startLine
      const defaultStartLine = { 
        position: [0, 0, 0], 
        rotation: 0, 
        direction: [0, 0, -1] 
      };
      
      // Validate/sanitize startLine
      let startLine = defaultStartLine;
      if (raceData.startLine && typeof raceData.startLine === 'object') {
        startLine = {
          position: Array.isArray(raceData.startLine.position) && raceData.startLine.position.length === 3
            ? raceData.startLine.position
            : defaultStartLine.position,
          rotation: typeof raceData.startLine.rotation === 'number'
            ? raceData.startLine.rotation
            : defaultStartLine.rotation,
          direction: Array.isArray(raceData.startLine.direction) && raceData.startLine.direction.length === 3
            ? raceData.startLine.direction
            : defaultStartLine.direction
        };
      }
      
      // Validate/sanitize checkpoints
      let checkpoints = [];
      if (Array.isArray(raceData.checkpoints)) {
        checkpoints = raceData.checkpoints
          .filter(cp => cp && typeof cp === 'object')
          .map(cp => ({
            id: cp.id || `cp_${Date.now()}_${Math.floor(Math.random() * 10000)}`,
            position: Array.isArray(cp.position) && cp.position.length === 3
              ? cp.position
              : [0, 0, 0],
            rotation: typeof cp.rotation === 'number' ? cp.rotation : 0,
            passed: false
          }));
      }
      
      const raceId = `race_${uuidv4().slice(0, 8)}`;
      const race = {
        id: raceId,
        creator: socket.id,
        startLine: startLine,
        checkpoints: checkpoints,
        players: [socket.id],
        state: 'ready',
        createdAt: Date.now(),
        results: {}
      };
      
      console.log(`[Race Builder] Processed race data:`, 
        JSON.stringify({
          id: race.id,
          startLine: race.startLine,
          checkpointCount: race.checkpoints.length
        }, null, 2)
      );
      
      // Store race
      raceStorage.activeRaces[raceId] = race;
      
      // Register with active games
      if (!activeGames['race']) {
        activeGames['race'] = {};
      }
      activeGames['race'][raceId] = {
        gameType: 'race',
        state: 'ready',
        players: [socket.id],
        creator: socket.id,
        startTime: null,
        endTime: null
      };
      
      // Notify creator
      socket.emit('race:created', { raceId, race });
      
      // Broadcast new race to all players
      socket.broadcast.emit('race:new', { 
        raceId, 
        creator: socket.id, 
        checkpointCount: checkpoints.length 
      });
      
      console.log(`[Race Builder] Race ${raceId} created with ${checkpoints.length} checkpoints`);
    } catch (err) {
      console.error('[Race Builder] Error creating race:', err);
      socket.emit('race:error', { error: 'Failed to create race', details: err.message });
    }
  });
  
  // Join an existing race
  socket.on('race:join', ({ raceId }) => {
    try {
      const race = raceStorage.activeRaces[raceId];
      console.log(`[Race Builder] Player ${socket.id} is joining race ${raceId}`);
      if (!race) {
        return socket.emit('race:error', { 
          error: 'Race not found', 
          raceId 
        });
      }
      
      if (race.state !== 'ready') {
        return socket.emit('race:error', { 
          error: 'Race already in progress', 
          raceId 
        });
      }
      
      // Add player to race
      if (!race.players.includes(socket.id)) {
        race.players.push(socket.id);
      }
      
      // Update active games
      if (activeGames['race'] && activeGames['race'][raceId]) {
        activeGames['race'][raceId].players = race.players;
      }
      
      // Notify player they've joined
      socket.emit('race:joined', { 
        raceId, 
        race: {
          startLine: race.startLine,
          checkpoints: race.checkpoints,
          players: race.players,
          state: race.state
        } 
      });
      
      // Notify other players
      socket.to(raceId).emit('race:player_joined', { 
        raceId, 
        playerId: socket.id 
      });
      
      // Join the socket to the race room
      socket.join(raceId);
      
      console.log(`[Race Builder] Player ${socket.id} joined race ${raceId}`);
    } catch (err) {
      console.error('[Race Builder] Error joining race:', err);
      socket.emit('race:error', { error: 'Failed to join race', details: err.message });
    }
  });
  
  // Start a race (only creator can start)
  socket.on('race:start', ({ raceId }) => {
    try {
      const race = raceStorage.activeRaces[raceId];
      
      if (!race) {
        return socket.emit('race:error', { 
          error: 'Race not found', 
          raceId 
        });
      }
      
      if (race.creator !== socket.id) {
        return socket.emit('race:error', { 
          error: 'Only the creator can start the race', 
          raceId 
        });
      }
      
      if (race.state !== 'ready') {
        return socket.emit('race:error', { 
          error: 'Race already in progress or finished', 
          raceId 
        });
      }
      
      // Set race to countdown state
      race.state = 'countdown';
      race.countdownStart = Date.now();
      
      // Update active games
      if (activeGames['race'] && activeGames['race'][raceId]) {
        activeGames['race'][raceId].state = 'countdown';
      }
      
      // Notify all players in the race
      io.to(raceId).emit('race:countdown', { 
        raceId, 
        countdown: 3 
      });
      
      // Start the race after countdown
      setTimeout(() => {
        if (!raceStorage.activeRaces[raceId]) return; // Race was deleted
        
        race.state = 'running';
        race.startTime = Date.now();
        
        // Update active games
        if (activeGames['race'] && activeGames['race'][raceId]) {
          activeGames['race'][raceId].state = 'running';
          activeGames['race'][raceId].startTime = race.startTime;
        }
        
        // Notify all players in the race
        io.to(raceId).emit('race:started', { 
          raceId, 
          startTime: race.startTime 
        });
        
        console.log(`[Race Builder] Race ${raceId} started with ${race.players.length} players`);
      }, 3000); // 3 second countdown
      
    } catch (err) {
      console.error('[Race Builder] Error starting race:', err);
      socket.emit('race:error', { error: 'Failed to start race', details: err.message });
    }
  });
  
  // Player completed the race
  socket.on('race:complete', ({ raceId, time }) => {
    try {
      const race = raceStorage.activeRaces[raceId];
      
      if (!race) {
        return socket.emit('race:error', { 
          error: 'Race not found', 
          raceId 
        });
      }
      
      if (race.state !== 'running') {
        return socket.emit('race:error', { 
          error: 'Race not in progress', 
          raceId 
        });
      }
      
      // Record player's time
      race.results[socket.id] = {
        playerId: socket.id,
        time,
        position: Object.keys(race.results).length + 1,
        finishTime: Date.now()
      };
      
      // Notify all players in the race
      io.to(raceId).emit('race:player_finished', { 
        raceId, 
        playerId: socket.id, 
        time,
        position: race.results[socket.id].position
      });
      
      console.log(`[Race Builder] Player ${socket.id} finished race ${raceId} in ${time} seconds`);
      
      // Check if all players have finished
      const finishedPlayers = Object.keys(race.results).length;
      
      if (finishedPlayers === race.players.length) {
        // All players finished - end the race
        race.state = 'finished';
        race.endTime = Date.now();
        
        // Update active games
        if (activeGames['race'] && activeGames['race'][raceId]) {
          activeGames['race'][raceId].state = 'finished';
          activeGames['race'][raceId].endTime = race.endTime;
          activeGames['race'][raceId].results = race.results;
        }
        
        // Store race results
        raceStorage.raceResults[raceId] = {
          id: raceId,
          results: race.results,
          startTime: race.startTime,
          endTime: race.endTime,
          checkpointCount: race.checkpoints.length
        };
        
        // Notify all players in the race
        io.to(raceId).emit('race:finished', { 
          raceId, 
          results: race.results,
          startTime: race.startTime,
          endTime: race.endTime
        });
        
        console.log(`[Race Builder] Race ${raceId} finished. All players completed.`);
        
        // Cleanup race after a delay
        setTimeout(() => {
          // Keep the results but clean up the active race
          delete raceStorage.activeRaces[raceId];
          
          if (activeGames['race']) {
            delete activeGames['race'][raceId];
          }
          
          console.log(`[Race Builder] Race ${raceId} cleaned up`);
        }, 300000); // 5 minutes for players to view results
      }
    } catch (err) {
      console.error('[Race Builder] Error completing race:', err);
      socket.emit('race:error', { error: 'Failed to complete race', details: err.message });
    }
  });
  
  // Leave a race
  socket.on('race:leave', ({ raceId }) => {
    try {
      const race = raceStorage.activeRaces[raceId];
      console.log(`[Race Builder] Player ${socket.id} is leaving race ${raceId}`);
      if (!race) return; // Race doesn't exist or already cleaned up
      
      // Remove player from race
      race.players = race.players.filter(id => id !== socket.id);
      
      // Update active games
      if (activeGames['race'] && activeGames['race'][raceId]) {
        activeGames['race'][raceId].players = race.players;
      }
      
      // Leave the socket room
      socket.leave(raceId);
      
      // Notify other players
      socket.to(raceId).emit('race:player_left', { 
        raceId, 
        playerId: socket.id 
      });
      
      // If no players left, clean up the race
      if (race.players.length === 0) {
        delete raceStorage.activeRaces[raceId];
        
        if (activeGames['race']) {
          delete activeGames['race'][raceId];
        }
        
        console.log(`[Race Builder] Race ${raceId} cleaned up - no players left`);
      }
      // If creator left, assign new creator
      else if (race.creator === socket.id && race.players.length > 0) {
        race.creator = race.players[0];
        
        if (activeGames['race'] && activeGames['race'][raceId]) {
          activeGames['race'][raceId].creator = race.creator;
        }
        
        // Notify the new creator
        const newCreatorSocket = io.sockets.sockets.get(race.creator);
        if (newCreatorSocket) {
          newCreatorSocket.emit('race:new_creator', { raceId });
        }
      }
      
      console.log(`[Race Builder] Player ${socket.id} left race ${raceId}`);
    } catch (err) {
      console.error('[Race Builder] Error leaving race:', err);
    }
  });
  
  // List all available races
  socket.on('race:list', () => {
    try {
      const races = Object.entries(raceStorage.activeRaces).map(([raceId, race]) => ({
        id: raceId,
        creator: race.creator,
        checkpointCount: race.checkpoints.length,
        playerCount: race.players.length,
        state: race.state
      }));
      
      socket.emit('race:list', { races });
    } catch (err) {
      console.error('[Race Builder] Error listing races:', err);
      socket.emit('race:error', { error: 'Failed to list races', details: err.message });
    }
  });
  
  // Fetch active race data for the current room
  socket.on('race:fetch_active', () => {
    try {
      console.log(`[Race Builder] Player ${socket.id} is fetching active races`);
      console.log(`[Race Builder] Active races: ${Object.keys(raceStorage.activeRaces).length}`);
      
      // Debug: Log all active races
      Object.entries(raceStorage.activeRaces).forEach(([raceId, race]) => {
        console.log(`[Race Builder] Active race ${raceId}: state=${race.state}, checkpoints=${race.checkpoints?.length || 0}, players=${race.players?.length || 0}`);
      });
      
      // First priority: Find any 'ready' race with checkpoints
      let raceToSend = null;
      
      // Look for races in 'ready' state with the most players
      let maxPlayers = 0;
      Object.entries(raceStorage.activeRaces).forEach(([raceId, race]) => {
        if (race.state === 'ready' && race.checkpoints && race.checkpoints.length > 0) {
          if (race.players.length >= maxPlayers) {
            raceToSend = race;
            maxPlayers = race.players.length;
          }
        }
      });
      
      // If no 'ready' race was found, look for any race with checkpoints
      if (!raceToSend) {
        Object.entries(raceStorage.activeRaces).forEach(([raceId, race]) => {
          if (race.checkpoints && race.checkpoints.length > 0) {
            raceToSend = race;
          }
        });
      }
      
      if (raceToSend) {
        console.log(`[Race Builder] Sending active race ${raceToSend.id} to player ${socket.id}`);
        console.log(`[Race Builder] Race details: state=${raceToSend.state}, checkpoints=${raceToSend.checkpoints.length}`);
        
        socket.emit('race:active_data', { 
          raceId: raceToSend.id,
          startLine: raceToSend.startLine,
          checkpoints: raceToSend.checkpoints,
          state: raceToSend.state || 'ready' // Default to 'ready' if no state is set
        });
        
        // If this is a race that's 'ready', make sure the player is added to it
        if (raceToSend.state === 'ready' && !raceToSend.players.includes(socket.id)) {
          raceToSend.players.push(socket.id);
          console.log(`[Race Builder] Added player ${socket.id} to race ${raceToSend.id}`);
        }
      } else {
        console.log(`[Race Builder] No active races found for player ${socket.id}`);
        socket.emit('race:active_data', { raceId: null });
      }
    } catch (err) {
      console.error('[Race Builder] Error fetching active race:', err);
      socket.emit('race:error', { error: 'Failed to fetch active race', details: err.message });
    }
  });
  
  // Handle client disconnect
  socket.on('disconnect', () => {
    try {
      // Find and leave all races this player is in
      Object.entries(raceStorage.activeRaces).forEach(([raceId, race]) => {
        if (race.players.includes(socket.id)) {
          // Remove player from race
          race.players = race.players.filter(id => id !== socket.id);
          
          // Update active games
          if (activeGames['race'] && activeGames['race'][raceId]) {
            activeGames['race'][raceId].players = race.players;
          }
          
          // Notify other players
          socket.to(raceId).emit('race:player_left', { 
            raceId, 
            playerId: socket.id 
          });
          
          // If no players left, clean up the race
          if (race.players.length === 0) {
            delete raceStorage.activeRaces[raceId];
            
            if (activeGames['race']) {
              delete activeGames['race'][raceId];
            }
            
            console.log(`[Race Builder] Race ${raceId} cleaned up - no players left`);
          }
          // If creator left, assign new creator
          else if (race.creator === socket.id && race.players.length > 0) {
            race.creator = race.players[0];
            
            if (activeGames['race'] && activeGames['race'][raceId]) {
              activeGames['race'][raceId].creator = race.creator;
            }
            
            // Notify the new creator
            const newCreatorSocket = io.sockets.sockets.get(race.creator);
            if (newCreatorSocket) {
              newCreatorSocket.emit('race:new_creator', { raceId });
            }
          }
        }
      });
    } catch (err) {
      console.error('[Race Builder] Error handling disconnect:', err);
    }
  });
}

// Export the functions
module.exports = {
  setupRaceBuilderSocketHandlers,
  getRaceStorage: () => raceStorage
};
