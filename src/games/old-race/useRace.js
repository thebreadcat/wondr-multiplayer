// useRace.js - Zustand store for race builder state management
import { create } from "zustand";
import { getSocket } from "../../utils/socketManager";

// Helper function to get player information from window object
// This retrieves both position and rotation information
function getPlayerInfo() {
  // Default values
  const defaultInfo = {
    position: [0, 0, 0], // Ground level default
    rotation: 0, // Rotation in radians around Y axis
    direction: [0, 0, -1] // Default forward direction
  };
  
  console.log('===== GETTING PLAYER POSITION FOR START LINE =====');
  
  // Check if we have the position directly from three.js camera (most reliable source)
  if (window.camera && window.camera.position) {
    const pos = [
      window.camera.position.x,
      window.camera.position.y - 1.6, // Adjust for camera height (typical eye height)
      window.camera.position.z
    ];
    console.log('Using position from window.camera with height adjustment:', pos);
    
    // Get direction based on camera rotation
    let direction = [0, 0, -1]; // Default forward
    if (window.camera.rotation) {
      // Convert Euler rotation to direction vector
      const rotY = window.camera.rotation.y;
      direction = [
        Math.sin(rotY),
        0,
        -Math.cos(rotY)
      ];
    }
    
    return {
      position: pos,
      rotation: window.camera.rotation?.y || 0,
      direction: direction
    };
  }
  
  // Next best source: character position from gameState
  if (window.gameState && window.gameState.playerPosition) {
    console.log('Using position from gameState.playerPosition:', window.gameState.playerPosition);
    
    // Ensure it's an array with 3 elements
    if (Array.isArray(window.gameState.playerPosition) && 
        window.gameState.playerPosition.length === 3) {
      // Make a copy to ensure we don't have reference issues
      const pos = [
        window.gameState.playerPosition[0],
        window.gameState.playerPosition[1],
        window.gameState.playerPosition[2]
      ];
      
      // Get direction based on player rotation if available
      let direction = [0, 0, -1]; // Default forward
      let rotation = 0;
      
      if (window.gameState.playerRotation) {
        rotation = window.gameState.playerRotation;
        direction = [
          Math.sin(rotation),
          0,
          -Math.cos(rotation)
        ];
      }
      
      return {
        position: pos,
        rotation: rotation,
        direction: direction
      };
    }
  }
  
  // Check for character references as a fallback
  if (window.characterRef && window.characterRef.current && window.characterRef.current.position) {
    console.log('Using position from characterRef:', window.characterRef.current.position);
    return {
      position: [
        window.characterRef.current.position.x,
        window.characterRef.current.position.y,
        window.characterRef.current.position.z
      ],
      rotation: window.characterRef.current.rotation?.y || 0,
      direction: defaultInfo.direction
    };
  }
  
  // Last resort: try window.player
  if (window.player && window.player.position) {
    console.log('Using position from window.player:', window.player.position);
    return {
      position: [
        window.player.position.x,
        window.player.position.y,
        window.player.position.z
      ],
      rotation: window.player.rotation?.y || 0,
      direction: defaultInfo.direction
    };
  }
  
  console.warn('⚠️ No position source found, using default spawn position');
  return defaultInfo;
}

// Determine if a player is within a certain distance of a target position
function isWithinDistance(playerPos, targetPos, distance = 5) {
  if (!playerPos || !targetPos) return false;
  
  const dx = playerPos[0] - targetPos[0];
  const dz = playerPos[2] - targetPos[2]; // Ignore Y (height)
  const distSquared = dx * dx + dz * dz;
  
  return distSquared < distance * distance; // Faster than using Math.sqrt
}

// Helper to initialize from server data
function initializeSocketEvents(set, get) {
  const socket = getSocket();
  if (!socket) return;
  
  // Listen for active race data from server
  socket.on('race:active_data', (data) => {
    if (!data || !data.raceId) return;
    
    console.log('[Race Client] Received active race data from server:', data);
    
    // Update race state with server data
    set({
      roomId: data.raceId,
      raceState: data.state || 'ready',
      startLine: data.startLine,
      checkpoints: data.checkpoints || []
    });
    
    console.log('[Race Client] Race state initialized from server');
  });
  
  // Fetch active races when socket connects
  socket.emit('race:fetch_active');
}

// Race state constants for better code readability
const RACE_STATES = {
  IDLE: 'idle',           // No race in progress or not created yet
  BUILDING: 'building',   // Race is being created (adding checkpoints)
  BUILT: 'built',         // Race has been built but not yet published
  JOINABLE: 'joinable',   // Race is published and players can join
  JOINED: 'joined',       // Player has joined but race hasn't started
  COUNTDOWN: 'countdown', // Race countdown in progress
  STARTED: 'started',     // Race has begun
  OVER: 'over'            // Race has been completed
};

export const useRace = create((set, get) => ({
  // State
  raceState: RACE_STATES.IDLE, // Current race state using the constants
  roomId: null,
  joinZoneStatus: null, // Message to display about join zone status
  joinZoneDetected: false, // Flag to indicate if player is near the join zone (even before stabilization)
  joinZonePosition: [-8, -0.75, -5], // Default join zone position (same as tag game)
  
  // Method to update race state from server data (used by useRaceSocket)
  updateRaceFromServer: (data) => {
    console.log('[useRace] Updating race state from server data:', data);
    
    // Create a comprehensive update object with all necessary fields
    const updateObj = {};
    
    // Update state based on what's available in the data
    if (data.state) {
      updateObj.raceState = data.state;
    }
    
    if (data.startLine) {
      updateObj.startLine = data.startLine;
    }
    
    if (data.checkpoints && Array.isArray(data.checkpoints)) {
      updateObj.checkpoints = data.checkpoints;
      
      // If we have checkpoints but no state was specified, assume 'ready'
      if (!data.state) {
        updateObj.raceState = 'ready';
      }
    }
    
    // If the race server says it's ready but we somehow don't have checkpoints,
    // we need to keep it visible
    if (data.state === 'ready' && (!data.checkpoints || !data.checkpoints.length)) {
      // Preserve existing checkpoints if available
      if (get().checkpoints && get().checkpoints.length > 0) {
        updateObj.checkpoints = [...get().checkpoints];
      }
    }
    
    console.log('[useRace] Updating store with:', updateObj);
    set(updateObj);
  },
  startLine: null,
  checkpoints: [],
  currentCheckpointIndex: 0,
  raceTime: 0,
  countdown: 5, // Changed to 5 seconds countdown for join zone
  isRunning: false,
  playerResults: {},
  inJoinZone: false, // Track if player is in the join zone
  joinZonePosition: [12, -0.8, 5], // Fixed join zone position on ground level
  joinZoneRadius: 5, // Detection radius for join zone
  joinZoneStabilityCounter: 0, // Counter for stable position detection
  hideRacePanel: false, // Control panel visibility independently
  
  // Method to set room ID
  setRoomId: (roomId) => set({ roomId }),
  
  // Race building actions
  startRace: () => {
    // Reset and start building a new race without affecting movement
    set({ 
      raceState: RACE_STATES.BUILDING, 
      startLine: null, 
      checkpoints: [] 
    });
    
    // Store the original socket to make sure we don't lose connection
    const socket = getSocket();
    if (socket) {
      const roomId = `race_${Date.now()}`;
      socket.emit('race:create', { roomId });
      set({ roomId });
    }
  },
  
  cancelRace: () => set({ 
    raceState: RACE_STATES.IDLE, 
    startLine: null, 
    checkpoints: [] 
  }),
  
  placeStart: () => {
    console.log('===== PLACING START LINE =====');
    console.log('Raw window.gameState before getting player info:', window.gameState);
    
    const playerInfo = getPlayerInfo();
    console.log('Player info for start line:', playerInfo);
    
    // Create start line data with position and player's rotation
    const startLine = {
      position: [...playerInfo.position], // Copy position exactly as is
      rotation: playerInfo.rotation,     // Store rotation in radians
      direction: [...playerInfo.direction] // Store normalized direction vector
    };
    
    // Keep the exact player position without changing height
    // This ensures the start line is placed correctly on the ground
    
    // Set the start line with orientation data
    set({ startLine });
    
    console.log('FINAL: Start line placed at:', startLine.position);
    console.log('===== END PLACING START LINE =====');
  },
  
  addCheckpoint: () => {
    console.log('===== ADDING CHECKPOINT =====');
    
    // Get all possible position sources for reliable positioning
    const cameraPosition = window.camera?.position ? [
      window.camera.position.x,
      window.camera.position.y - 1.6, // Apply height adjustment
      window.camera.position.z
    ] : null;
    
    const gameStatePosition = window.gameState?.playerPosition || null;
    const characterPosition = window.characterRef?.current?.position ? [
      window.characterRef.current.position.x,
      window.characterRef.current.position.y,
      window.characterRef.current.position.z
    ] : null;
    
    // Log all position sources to help debug
    console.log('Position sources for checkpoint:');
    console.log('- Camera position:', cameraPosition);
    console.log('- Game state position:', gameStatePosition);
    console.log('- Character position:', characterPosition);
    
    // Prioritize camera position as it's most reliable
    let finalPosition = cameraPosition || gameStatePosition || characterPosition || [0, 0, 0];
    
    // Create checkpoint data with the best position source
    const checkpoint = {
      id: `cp_${Date.now()}`,
      position: finalPosition,
      rotation: window.camera?.rotation?.y || 0,
      passed: false
    };
    
    console.log('✅ Adding checkpoint at position:', checkpoint.position);
    
    // Add checkpoint at the determined position
    set((state) => ({ 
      checkpoints: [...state.checkpoints, checkpoint]
    }));
    
    // Alert server to update the race
    const socket = getSocket();
    if (socket && get().roomId) {
      socket.emit('race:update', {
        roomId: get().roomId, 
        checkpoints: [...get().checkpoints, checkpoint],
        type: 'checkpoint_added'
      });
    }
    
    console.log('===== END ADDING CHECKPOINT =====');
  },
  
  undoCheckpoint: () => {
    set((state) => ({ 
      checkpoints: state.checkpoints.slice(0, -1) 
    }));
  },
  
  completeRace: () => {
    const { roomId, startLine, checkpoints } = get();
    
    if (!startLine || checkpoints.length === 0) {
      console.error("Can't complete race: missing start line or checkpoints");
      return;
    }
    
    // Prepare race data with validated data structure
    const raceData = {
      roomId,
      startLine: {
        position: Array.isArray(startLine.position) ? startLine.position : [0, 0, 0],
        rotation: typeof startLine.rotation === 'number' ? startLine.rotation : 0,
        direction: Array.isArray(startLine.direction) ? startLine.direction : [0, 0, -1]
      },
      checkpoints: checkpoints.map(cp => ({ 
        id: cp.id || `cp_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
        position: Array.isArray(cp.position) ? cp.position : [0, 0, 0],
        rotation: typeof cp.rotation === 'number' ? cp.rotation : 0
      })),
      createdAt: Date.now()
    };
    
    console.log('Client preparation - Race data to be sent:', JSON.stringify(raceData));
    
    // Save race to server
    const socket = getSocket();
    if (socket) {
      socket.emit("race:create", raceData);
      console.log("Race sent to server:", raceData);
    }
    
    // First set race state to BUILT, indicating construction is complete
    set({ 
      raceState: RACE_STATES.BUILT,
      hideRacePanel: false, // Make sure panel remains visible
      joinZonePosition: [-8, -0.75, -5] // Set join zone position to match tag game
    });
    
    console.log('Race is now in BUILT state with', checkpoints.length, 'checkpoints');
    
    // Then transition to JOINABLE after a brief delay to ensure server has processed the data
    setTimeout(() => {
      set({ 
        raceState: RACE_STATES.JOINABLE,
        // Set join zone properties
        joinZoneRadius: 5,
        inJoinZone: false,
        joinZoneDetected: false,
        joinZoneStatus: 'Race ready! Enter blue circle to join'
      });
      console.log('Race is now JOINABLE - players can enter the join zone at', [-8, -0.75, -5]);
      
      // Add a notification to guide the player
      if (window.addNotification) {
        window.addNotification({
          type: 'success',
          message: 'Race created! Go to the blue circle to join.',
          duration: 5000
        });
      }
    }, 500);
    return raceData;
  },
  
  // Race running actions
  // This function is called when a player enters the join zone
  startCountdown: () => {
    console.log('Player joined race, starting countdown');
    
    // First transition to JOINED state
    set({ 
      raceState: RACE_STATES.JOINED,
      inJoinZone: true,
      countdownActive: true // Flag to track if countdown is active
    });
    
    // Then start the countdown after a brief moment
    const countdownStartTimeout = setTimeout(() => {
      // Check if player is still in join zone before starting countdown
      if (get().inJoinZone) {
        set({ 
          raceState: RACE_STATES.COUNTDOWN, 
          countdown: 5, // 5 second countdown
          inJoinZone: true // Lock player in join zone during countdown
        });
        console.log('Race countdown started - 5 seconds to race start');
        
        // Store timeout ID for potential cancellation
        set({ countdownStartTimeoutId: null });
      } else {
        // Player left zone before countdown started
        console.log('Player left join zone before countdown started - cancelling join');
        get().cancelJoin();
      }
    }, 500);
    
    // Store timeout ID for potential cancellation
    set({ countdownStartTimeoutId: countdownStartTimeout });
    
    // We no longer automatically hide the race builder panel
    // This allows users to see the race UI during countdown
    
    // Start the countdown timer
    const countdownInterval = setInterval(() => {
      const { countdown, inJoinZone, countdownActive } = get();
      
      // Check if player is still in join zone
      if (!inJoinZone && countdownActive) {
        // Player left the zone during countdown - cancel it
        clearInterval(countdownInterval);
        get().cancelJoin();
        return;
      }
      
      if (countdown <= 1 && countdownActive) {
        clearInterval(countdownInterval);
        get().startRunning();
      } else if (countdownActive) {
        set({ countdown: countdown - 1 });
      } else {
        // Countdown was cancelled
        clearInterval(countdownInterval);
      }
    }, 1000);
    
    // Store interval ID for potential cancellation
    set({ countdownIntervalId: countdownInterval });
  },
  
  startRunning: () => {
    const startTime = Date.now();
    set({ 
      raceState: RACE_STATES.STARTED, 
      isRunning: true, 
      raceTime: 0,
      currentCheckpointIndex: 0
    });
    
    console.log('Race has STARTED - timer running');
    
    // Set up race timer
    const timerInterval = setInterval(() => {
      if (get().raceState !== RACE_STATES.STARTED) {
        clearInterval(timerInterval);
        return;
      }
      
      const elapsedTime = Math.floor((Date.now() - startTime) / 1000);
      set({ raceTime: elapsedTime });
    }, 100);
  },
  
  checkpointPassed: (checkpointId) => {
    set(state => ({
      checkpoints: state.checkpoints.map(cp => 
        cp.id === checkpointId ? { ...cp, passed: true } : cp
      ),
      currentCheckpointIndex: state.currentCheckpointIndex + 1
    }));
  },
  
  finishRace: () => {
    const { roomId, raceTime } = get();
    const socket = getSocket();
    
    if (socket) {
      socket.emit("race:complete", { roomId, time: raceTime });
    }
    
    set({ 
      raceState: RACE_STATES.OVER, 
      isRunning: false 
    });
    
    console.log('Race is now OVER - final time:', raceTime);
    
    // Auto reset after 10 seconds
    setTimeout(() => {
      get().resetRace();
    }, 10000);
  },
  
  resetRace: () => {
    set({
      raceState: RACE_STATES.IDLE,
      startLine: null,
      checkpoints: [],
      currentCheckpointIndex: 0,
      raceTime: 0,
      countdown: 5, // Reset to 5 seconds
      isRunning: false,
      inJoinZone: false
    });
    
    console.log('Race has been RESET to idle state');
  },
  
  // Helpers
  isPlayerAtStartLine: () => {
    const { startLine } = get();
    const playerPos = getPlayerPosition();
    return isWithinDistance(playerPos, startLine, 5);
  },
  
  isPlayerAtCheckpoint: (index) => {
    const { checkpoints } = get();
    if (index >= checkpoints.length) return false;
    
    const checkpoint = checkpoints[index];
    const playerPos = getPlayerPosition();
    return isWithinDistance(playerPos, checkpoint.position, 5);
  },
  
  isPlayerAtCurrentCheckpoint: () => {
    const { currentCheckpointIndex } = get();
    return get().isPlayerAtCheckpoint(currentCheckpointIndex);
  },
  
  // Check if player is in the join zone
  isPlayerAtJoinZone: () => {
    const { joinZonePosition, joinZoneRadius } = get();
    const playerPos = getPlayerInfo().position;
    return isWithinDistance(playerPos, joinZonePosition, joinZoneRadius);
  },
  
  // Cancel race join if player leaves the join zone
  cancelJoin: () => {
    console.log('Cancelling race join - player left join zone');
    
    // Clear any active timers
    const { countdownIntervalId, countdownStartTimeoutId } = get();
    if (countdownIntervalId) clearInterval(countdownIntervalId);
    if (countdownStartTimeoutId) clearTimeout(countdownStartTimeoutId);
    
    // Reset race state
    set({
      raceState: RACE_STATES.JOINABLE,
      inJoinZone: false,
      joinZoneDetected: false,
      countdownActive: false,
      countdown: 5,
      countdownIntervalId: null,
      countdownStartTimeoutId: null,
      joinZoneStatus: 'Join cancelled - left starting zone'
    });
    
    // Notify player
    if (window.addNotification) {
      window.addNotification({
        type: 'warning',
        message: 'Race join cancelled - you left the starting zone',
        duration: 4000
      });
    }
    
    // Notify server
    const socket = getSocket();
    if (socket) {
      socket.emit('race:leave', { roomId: get().roomId, playerId: socket.id });
    }
  },
  
  // Track player position in real-time to detect checkpoints and join zone
  trackPlayerPosition: (playerPosition) => {
    const { 
      raceState, 
      currentCheckpointIndex, 
      checkpoints, 
      inJoinZone,
      joinZonePosition,
      joinZoneRadius,
      joinZoneStabilityCounter,
      joinZoneDetected 
    } = get();
    
    // 1. Handle join zone detection when race is in the JOINABLE state
    if ((raceState === RACE_STATES.JOINABLE || raceState === RACE_STATES.JOINED || raceState === RACE_STATES.COUNTDOWN) && checkpoints.length > 0) {
      const isInZoneNow = isWithinDistance(playerPosition, joinZonePosition, joinZoneRadius);
      
      // Update the detection flag immediately for UI feedback
      if (isInZoneNow !== joinZoneDetected) {
        set({ 
          joinZoneDetected: isInZoneNow,
          joinZoneStatus: isInZoneNow ? "Approaching start zone..." : null
        });
      }
      
      // Apply stabilization to avoid flickering (from previous implementation)
      if (isInZoneNow !== inJoinZone) {
        // Player's zone status is changing, update counter
        if (joinZoneStabilityCounter >= 3) { // Require 3 consistent readings
          // Update the status when stable
          set({ 
            inJoinZone: isInZoneNow,
            joinZoneStabilityCounter: 0,
            joinZoneStatus: isInZoneNow ? "In start zone! Joining race..." : "Left start zone"
          });
          
          // Emit event if player entered the zone
          if (isInZoneNow) {
            console.log('Player entered join zone, transitioning to JOINED state');
            
            // Add a notification message for the player
            if (window.addNotification) {
              window.addNotification({
                type: 'success',
                message: 'Joining race! Stay in the blue circle for countdown.',
                duration: 5000
              });
            }
            
            get().startCountdown(); // This will handle transition to JOINED and then COUNTDOWN
            
            // Emit socket event for multiplayer
            const socket = getSocket();
            if (socket) {
              socket.emit('race:join', { roomId: get().roomId, playerId: socket.id });
            }
          } else {
            console.log('Player left join zone');
            
            // Check if we need to cancel an active join
            if (raceState === RACE_STATES.JOINED || raceState === RACE_STATES.COUNTDOWN) {
              // Player left during join process - cancel it
              get().cancelJoin();
            } else {
              // Just a normal zone exit notification
              if (window.addNotification) {
                window.addNotification({
                  type: 'warning',
                  message: 'Left the starting zone. Return to join the race.',
                  duration: 3000
                });
              }
            }
          }
        } else {
          // Increment counter for stability
          set({ 
            joinZoneStabilityCounter: joinZoneStabilityCounter + 1,
            joinZoneStatus: isInZoneNow ? `Confirming position (${joinZoneStabilityCounter+1}/3)...` : null
          });
        }
      } else {
        // Reset counter if status is consistent
        if (joinZoneStabilityCounter !== 0) {
          set({ joinZoneStabilityCounter: 0 });
        }
      }
    }
    
    // 2. Handle checkpoint detection when race has STARTED
    if (raceState === RACE_STATES.STARTED) {
      // Check if player is at current checkpoint
      if (currentCheckpointIndex < checkpoints.length) {
        const checkpoint = checkpoints[currentCheckpointIndex];
        if (isWithinDistance(playerPosition, checkpoint.position, 5)) {
          console.log(`Checkpoint ${currentCheckpointIndex + 1}/${checkpoints.length} reached`);
          get().checkpointPassed(checkpoint.id);
        }
      }
      
      // Check if player is at finish line and has passed all checkpoints
      if (currentCheckpointIndex >= checkpoints.length) {
        const { startLine } = get();
        if (isWithinDistance(playerPosition, startLine, 5)) {
          console.log('Player reached finish line after passing all checkpoints');
          get().finishRace(); // This will transition to OVER state
        }
      }
    }
  }
}));
