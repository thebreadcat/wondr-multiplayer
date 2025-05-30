import React, { useRef, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import { useRaceStore } from "./store";
import { useMultiplayer } from "../../components/MultiplayerProvider";

// Using React.memo to prevent unnecessary re-renders
const RaceManager = React.memo(function RaceManager({ roomId = "race-1" }) {
  // Only log on first render using useRef
  const isFirstRender = useRef(true);
  const { teleportPlayer } = useMultiplayer();
  
  useEffect(() => {
    if (isFirstRender.current) {
      console.log('[RaceManager] Initializing with roomId:', roomId);
      isFirstRender.current = false;
    }
  }, [roomId]);
  
  const {
    isRaceRunning,
    isJoined,
    startLine,
    timeStart,
    finishRace,
    checkpoints,
    currentCheckpointIndex,
    roomId: storeRoomId,
    setRoomId
  } = useRaceStore();
  
  // Ensure the roomId is set in the store
  useEffect(() => {
    if (roomId && roomId !== storeRoomId) {
      console.log('[RaceManager] Setting roomId in store:', roomId);
      setRoomId(roomId);
    }
  }, [roomId, storeRoomId, setRoomId]);
  
  // Teleport player to starting line when race begins
  useEffect(() => {
    if (isRaceRunning && startLine && teleportPlayer) {
      console.log('[RaceManager] Race started! Teleporting to starting line:', startLine);
      
      // Add a slight offset to position player at the starting line
      const teleportPosition = [
        startLine[0],
        startLine[1] + 1.5, // Position player above the ground
        startLine[2] + 2    // Position player behind the start line
      ];
      
      // Force teleport with multiple attempts to ensure it works
      const attemptTeleport = (attempt = 1) => {
        console.log(`[RaceManager] Teleport attempt ${attempt} to position:`, teleportPosition);
        teleportPlayer(teleportPosition);
        
        // Make additional attempts with delays to ensure teleportation works
        if (attempt < 3) {
          setTimeout(() => attemptTeleport(attempt + 1), 500 * attempt);
        }
      };
      
      // Start teleportation attempts
      attemptTeleport();
    }
  }, [isRaceRunning, startLine, teleportPlayer]);
  
  // Handle race countdown from server
  useEffect(() => {
    if (!window.gameSocket) return;
    
    const handleRaceCountdown = (data) => {
      if (data.roomId === roomId) {
        console.log('[RaceManager] Received race countdown:', data);
        useRaceStore.getState().startCountdown(data.duration || 3000);
      }
    };
    
    window.gameSocket.on('race:countdown', handleRaceCountdown);
    
    return () => {
      window.gameSocket.off('race:countdown', handleRaceCountdown);
    };
  }, [roomId]);

  const raceFinished = useRef(false);

  useFrame(() => {
    if (!isRaceRunning || !isJoined || !startLine || !timeStart) return;

    // Optional: log or store live time
    const now = Date.now();
    const timeElapsed = now - timeStart;

    // Complete race when all checkpoints passed
    if (
      !raceFinished.current &&
      currentCheckpointIndex >= checkpoints.length
    ) {
      raceFinished.current = true; // prevent repeat
      finishRace(); // will emit to server
    }

    // Optional: update timeElapsed in store (for HUD)
    useRaceStore.setState({ timeElapsed });
  });

  return null;
});

export default RaceManager;
