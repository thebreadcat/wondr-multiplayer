// useRaceSocket.js - Socket event handling for the race system
import { useEffect } from 'react';
import { getSocket } from "../../utils/socketManager";
import { useRace } from './useRace';

/**
 * Custom hook to initialize race state from server socket events
 * This ensures the join zone remains visible even when the race builder UI is closed
 */
export function useRaceSocket() {
  const race = useRace();
  
  // Debug info about the current race state
  useEffect(() => {
    console.log('[Race Socket] CURRENT RACE STATE:', {
      raceState: race.raceState,
      checkpoints: race.checkpoints?.length || 0,
      roomId: race.roomId
    });
  }, [race.raceState, race.checkpoints, race.roomId]);
  
  useEffect(() => {
    const socket = getSocket();
    if (!socket) {
      console.error('[Race Socket] No socket available');
      return;
    }
    
    console.log('[Race Socket] Setting up race socket event handlers');
    
    // Listen for active race data from server
    function handleActiveRaceData(data) {
      if (!data || !data.raceId) {
        console.warn('[Race Socket] Received invalid race data from server');
        return;
      }
      
      console.log('[Race Socket] Received active race data from server:', data);
      
      // Only update if we're not already in a running race
      if (race.raceState !== 'running' && race.raceState !== 'countdown') {
        // IMPORTANT: Store the race data as a globally accessible variable
        // This ensures the data persists even if components unmount
        window.activeRaceData = data;
        
        // Use the setter methods or dispatch actions to update the store
        race.setRoomId(data.raceId);

        // Create a batch update to the store that includes all race properties
        race.updateRaceFromServer(data);
        
        console.log('[Race Socket] Race state initialized from server with', 
          data.checkpoints ? data.checkpoints.length : 0, 'checkpoints');
      }
    }
    
    // Handle race countdown events
    function handleRaceCountdown(data) {
      if (!data || !data.roomId) return;
      
      console.log('[Race Socket] Received race countdown event:', data);
      
      // Show notification
      if (window.addNotification) {
        window.addNotification({
          type: 'success',
          message: data.message || 'Race starting soon!',
          duration: 3000
        });
      }
      
      // Update race state to countdown
      race.setRaceState('countdown');
      race.setCountdown(Math.ceil(data.duration / 1000)); // Convert ms to seconds
    }
    
    // Handle race countdown cancellation
    function handleRaceCountdownCancelled(data) {
      if (!data || !data.roomId) return;
      
      console.log('[Race Socket] Race countdown cancelled:', data);
      
      // Show notification
      if (window.addNotification) {
        window.addNotification({
          type: 'warning',
          message: data.message || 'Race countdown cancelled',
          duration: 3000
        });
      }
      
      // Reset race state
      race.resetRace();
    }
    
    // Handle race start events
    function handleRaceStart(data) {
      if (!data || !data.roomId) return;
      
      console.log('[Race Socket] Race starting:', data);
      
      // Show notification
      if (window.addNotification) {
        window.addNotification({
          type: 'success',
          message: 'Race started! GO!',
          duration: 2000
        });
      }
      
      // Start the race
      race.startRunning();
    }
    
    // Add event listeners
    socket.on('race:active_data', handleActiveRaceData);
    socket.on('race:countdown', handleRaceCountdown);
    socket.on('race:countdown_cancelled', handleRaceCountdownCancelled);
    socket.on('race:start', handleRaceStart);
    
    // Fetch active races when component mounts
    socket.emit('race:fetch_active');
    
    // Cleanup
    return () => {
      socket.off('race:active_data', handleActiveRaceData);
      socket.off('race:countdown', handleRaceCountdown);
      socket.off('race:countdown_cancelled', handleRaceCountdownCancelled);
      socket.off('race:start', handleRaceStart);
    };
  }, []);
  
  return null; // This hook doesn't return anything
}
