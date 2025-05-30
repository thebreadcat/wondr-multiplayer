import { create } from "zustand";
// Uses window.gameSocket for multiplayer socket communication

export const useRaceStore = create((set, get) => ({
  // Race state
  currentCheckpointIndex: 0,
  checkpoints: [],
  roomId: null,
  isRaceRunning: false,
  timeStart: null,
  timeElapsed: 0,
  isJoined: false,
  raceData: null,
  isRaceReady: false,
  startLine: [0, -0.8, -7], // Positioned on the ground, 2 units behind join area
  
  // Countdown state
  isCountdownActive: false,
  countdownStartTime: null,
  countdownDuration: 3000, // 3 seconds countdown
  
  // Join state management
  setJoined: (value) => {
    console.log('[RaceStore] Setting joined state:', value);
    set({ isJoined: value });
  },
  
  // Update checkpoints and check if race is ready
  setCheckpoints: (checkpoints) => {
    const { startLine } = get();
    const isReady = checkpoints && checkpoints.length > 0 && startLine;
    set({ 
      checkpoints, 
      isRaceReady: isReady 
    });
    console.log('[RaceStore] Updated checkpoints, race ready:', isReady);
  },
  
  // Update startLine and check if race is ready
  setStartLine: (pos) => {
    const { checkpoints } = get();
    const isReady = pos && checkpoints && checkpoints.length > 0;
    set({ 
      startLine: pos, 
      isRaceReady: isReady 
    });
    console.log('[RaceStore] Updated startLine, race ready:', isReady);
  },
  
  // Update race data and set isRaceReady if we have valid data
  setRaceData: (data) => {
    const isReady = data && data.checkpoints && data.checkpoints.length > 0 && data.startLine;
    set({ 
      raceData: data,
      checkpoints: data?.checkpoints || [],
      startLine: data?.startLine || get().startLine,
      isRaceReady: isReady
    });
    console.log('[RaceStore] Updated race data, race ready:', isReady);
  },
  
  // Set room ID
  setRoomId: (roomId) => {
    console.log('[RaceStore] Setting roomId:', roomId);
    set({ roomId });
  },
  
  // Handle countdown start
  startCountdown: (duration = 3000) => {
    console.log('[RaceStore] Starting countdown for', duration, 'ms');
    set({ 
      isCountdownActive: true,
      countdownStartTime: Date.now(),
      countdownDuration: duration
    });
    
    // Auto-start race after countdown
    setTimeout(() => {
      const { isCountdownActive } = get();
      if (isCountdownActive) {
        get().startRace();
      }
    }, duration);
  },
  
  // Cancel countdown
  cancelCountdown: () => {
    console.log('[RaceStore] Cancelling countdown');
    set({ 
      isCountdownActive: false,
      countdownStartTime: null
    });
  },


  passCheckpoint: (id) => {
    const { currentCheckpointIndex, checkpoints, roomId } = get();
    console.log(`[RaceStore] Attempting to pass checkpoint ${id}, current index: ${currentCheckpointIndex}`);
    
    // Check if this is the current checkpoint
    const currentCheckpoint = checkpoints[currentCheckpointIndex];
    if (currentCheckpoint && (currentCheckpoint.id === id || id === currentCheckpointIndex)) {
      const newIndex = currentCheckpointIndex + 1;
      console.log(`[RaceStore] Passed checkpoint ${id}, advancing to index ${newIndex}`);
      
      set({ currentCheckpointIndex: newIndex });
      
      // Emit to server if socket exists
      if (window.gameSocket) {
        window.gameSocket.emit("checkpoint:passed", { 
          roomId, 
          checkpointId: id, 
          index: newIndex 
        });
      }
      
      // Check if race is finished
      if (newIndex >= checkpoints.length) {
        console.log('[RaceStore] All checkpoints passed, finishing race!');
        setTimeout(() => get().finishRace(), 500); // Small delay to ensure last checkpoint is registered
      }
    } else {
      console.log(`[RaceStore] Checkpoint mismatch: tried to pass ${id} but current is ${currentCheckpoint?.id || 'unknown'}`);
    }
  },

  startRace: () => {
    console.log('[RaceStore] Starting race!');
    const timeStart = Date.now();
    
    // End countdown if active
    set({ 
      isRaceRunning: true, 
      timeStart, 
      currentCheckpointIndex: 0,
      isCountdownActive: false 
    });
    
    // Emit to server if socket exists
    if (window.gameSocket) {
      window.gameSocket.emit("race:start", { 
        roomId: get().roomId, 
        timeStart 
      });
    }
  },

  finishRace: () => {
    const { timeStart, roomId } = get();
    const timeElapsed = timeStart ? Date.now() - timeStart : 0;
    
    console.log(`[RaceStore] Race finished in ${timeElapsed/1000} seconds!`);
    
    set({ 
      isRaceRunning: false, 
      timeElapsed,
      isJoined: false // Reset joined state so player can join again
    });
    
    // Emit to server if socket exists
    if (window.gameSocket) {
      window.gameSocket.emit("race:finished", { 
        roomId, 
        timeElapsed 
      });
    }
    
    // Show completion message
    alert(`Race completed in ${(timeElapsed/1000).toFixed(2)} seconds!`);
  },
}));
