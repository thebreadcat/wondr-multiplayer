import React, { useEffect, useRef, useState } from "react";
import { Text, Cylinder } from "@react-three/drei";
import { useRaceStore } from "../store";
import { useGameContext } from "../../useGameContext";
import { useMultiplayer } from "../../../components/MultiplayerProvider";

const JOIN_TIME = 10;

// Using React.memo to prevent unnecessary re-renders
const JoinArea = React.memo(function JoinArea({ position = [12, -0.75, 5], radius = 3 }) {
  // Only log on first render using useRef
  const isFirstRender = useRef(true);
  const { localPlayerId } = useGameContext();
  const { 
    isJoined, 
    setJoined, 
    roomId: storeRoomId, 
    setRoomId,
    checkpoints,
    startLine,
    isRaceReady
  } = useRaceStore();
  const { players, myId, teleportPlayer } = useMultiplayer();
  
  // Track available race rooms
  const [availableRaceRooms, setAvailableRaceRooms] = useState([]);
  
  // Fetch available race rooms from server
  useEffect(() => {
    if (!window.gameSocket) return;
    
    // Request available race rooms
    window.gameSocket.emit('race:listRooms');
    
    // Listen for response
    const handleRaceRooms = (rooms) => {
      console.log('[JoinArea] Available race rooms:', rooms);
      setAvailableRaceRooms(rooms);
      
      // If we have rooms and no roomId is set, use the first available room
      if (rooms.length > 0 && !storeRoomId) {
        setTimeout(() => {
          setRoomId(rooms[0]);
          console.log('[JoinArea] Auto-selecting first available race room:', rooms[0]);
        }, 0);
      }
    };
    
    window.gameSocket.on('race:rooms', handleRaceRooms);
    
    return () => {
      window.gameSocket.off('race:rooms', handleRaceRooms);
    };
  }, [window.gameSocket, storeRoomId, setRoomId]);
  
  // Use the global sharedRoomId (main-room) if available, otherwise fall back to dynamic room IDs
  const mainRoomId = window.sharedRoomId || 'main-room';
  
  // Prioritize using main-room, then stored roomId, then first available room
  const effectiveRoomId = mainRoomId || storeRoomId || (availableRaceRooms.length > 0 ? availableRaceRooms[0] : null);
  const hasValidRoomId = !!effectiveRoomId;
  
  // If we're using main-room but it's not in the available rooms, add it
  useEffect(() => {
    if (effectiveRoomId === 'main-room' && !availableRaceRooms.includes('main-room')) {
      console.log('[JoinArea] Adding main-room to available race rooms');
      setAvailableRaceRooms(prev => [...prev, 'main-room']);
    }
  }, [effectiveRoomId, availableRaceRooms]);
  
  // Debug log for room IDs
  useEffect(() => {
    if (isFirstRender.current) {
      console.log('[JoinArea] Room ID debug:', {
        storeRoomId,
        availableRooms: availableRaceRooms,
        effectiveRoomId,
        hasValidRoomId
      });
    }
  }, [storeRoomId, availableRaceRooms, effectiveRoomId, hasValidRoomId]);
  
  // State for join zone
  const [isInside, setIsInside] = useState(false);
  const [joinTimer, setJoinTimer] = useState(0);
  const intervalRef = useRef(null);
  
  // Stabilization counter refs - prevent rapid zone entry/exit
  const zoneEntryCounterRef = useRef(0);
  const zoneExitCounterRef = useRef(0);
  const STABILIZATION_THRESHOLD = 3; // Must be in/out of zone for 3 consecutive checks
  
  useEffect(() => {
    if (isFirstRender.current) {
      console.log('[JoinArea] Rendering join area at position:', position);
      isFirstRender.current = false;
    }
  }, [position]);
  
  // Ensure the room ID is set in the store - using a ref to avoid render-time setState
  const hasSetRoomId = useRef(false);
  
  // No need to get race data again, already destructured above
  
  // Track which room IDs we've already requested data for
  const requestedRoomIdsRef = useRef({});
  
  // Debug log race data
  useEffect(() => {
    // Only log on significant changes to reduce console spam
    if (isFirstRender.current || joinTimer % 5 === 0) {
      console.log('[JoinArea] Race data:', {
        checkpoints: checkpoints?.length || 0,
        startLine: !!startLine,
        isRaceReady: !!isRaceReady,
        isInside,
        joinTimer,
        roomId: storeRoomId,
        effectiveRoomId,
        hasValidRoomId,
        availableRooms: availableRaceRooms
      });
    }
  }, [checkpoints, startLine, isRaceReady, isInside, joinTimer, storeRoomId, effectiveRoomId, hasValidRoomId, availableRaceRooms]);
  
  // Separate effect for requesting race data to avoid infinite loops
  useEffect(() => {
    // If we have a valid roomId but no checkpoints and haven't requested this room yet
    if (effectiveRoomId && 
        (!checkpoints || checkpoints.length === 0) && 
        window.gameSocket && 
        !requestedRoomIdsRef.current[effectiveRoomId]) {
      
      // Mark this room as requested to prevent repeated requests
      requestedRoomIdsRef.current[effectiveRoomId] = true;
      
      console.log(`[JoinArea] Requesting race data for room ${effectiveRoomId}`);
      window.gameSocket.emit('race:getData', { roomId: effectiveRoomId });
    }
  }, [effectiveRoomId, checkpoints]);
  
  useEffect(() => {
    if (!storeRoomId && !hasSetRoomId.current) {
      console.log('[JoinArea] Setting default roomId in store:', effectiveRoomId);
      hasSetRoomId.current = true;
      // Schedule the state update for after render
      setTimeout(() => {
        setRoomId(effectiveRoomId);
      }, 0);
    }
  }, [storeRoomId, setRoomId, effectiveRoomId]);

  // Position-based zone detection with stabilization
  // Using requestAnimationFrame to avoid state updates during render
  const lastCheckTimeRef = useRef(0);
  const checkIntervalMs = 100; // Check every 100ms to avoid too frequent checks
  
  useEffect(() => {
    let animationFrameId;
    
    const checkZone = (timestamp) => {
      // Throttle checks to avoid too frequent updates
      if (timestamp - lastCheckTimeRef.current > checkIntervalMs) {
        lastCheckTimeRef.current = timestamp;
        
        if (myId && players[myId] && players[myId].position) {
          // Check distance to join zone
          const myPos = players[myId].position;
          const dx = myPos[0] - position[0];
          const dz = myPos[2] - position[2];
          const distanceSquared = dx * dx + dz * dz;
          const inZone = distanceSquared <= radius * radius;
          
          // Position stabilization to prevent rapid zone entry/exit
          if (inZone && !isInside) {
            // Increment entry counter
            zoneEntryCounterRef.current++;
            // Reset exit counter
            zoneExitCounterRef.current = 0;
            
            // Only update state after threshold is met
            if (zoneEntryCounterRef.current >= STABILIZATION_THRESHOLD) {
              console.log('[JoinArea] Player entered join zone (stabilized)');
              // Schedule state update for after render
              setTimeout(() => {
                setIsInside(true);
                // Emit event to server only if we have a valid room ID
                if (window.gameSocket && hasValidRoomId) {
                  console.log(`${window.gameSocket.id} joined game race with room id ${effectiveRoomId}`);
                  window.gameSocket.emit("race:join", { playerId: localPlayerId, roomId: effectiveRoomId });
                } else if (window.gameSocket) {
                  console.log(`Cannot join race: No valid race room available`);
                }
              }, 0);
              zoneEntryCounterRef.current = 0; // Reset counter
            }
          } else if (!inZone && isInside) {
            // Increment exit counter
            zoneExitCounterRef.current++;
            // Reset entry counter
            zoneEntryCounterRef.current = 0;
            
            // Only update state after threshold is met
            if (zoneExitCounterRef.current >= STABILIZATION_THRESHOLD) {
              console.log('[JoinArea] Player exited join zone (stabilized)');
              // Schedule state update for after render
              setTimeout(() => {
                setIsInside(false);
                // Emit event to server only if we have a valid room ID
                if (window.gameSocket && hasValidRoomId) {
                  console.log(`${window.gameSocket.id} left game race with room id ${effectiveRoomId}`);
                  window.gameSocket.emit("race:leave", { playerId: localPlayerId, roomId: effectiveRoomId });
                }
              }, 0);
              zoneExitCounterRef.current = 0; // Reset counter
            }
          } else if (!inZone) {
            // Reset entry counter when definitely outside
            zoneEntryCounterRef.current = 0;
          } else if (inZone) {
            // Reset exit counter when definitely inside
            zoneExitCounterRef.current = 0;
          }
        }
      }
      
      // Continue checking in animation frame
      animationFrameId = requestAnimationFrame(checkZone);
    };
    
    // Start checking
    animationFrameId = requestAnimationFrame(checkZone);
    
    // Cleanup
    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [myId, players, position, radius, isInside, localPlayerId, effectiveRoomId]);
  
  // Track if join timer has completed
  const joinTimerCompletedRef = useRef(false);
  
  // Effect to handle join completion separately from timer
  useEffect(() => {
    if (joinTimer >= JOIN_TIME && !joinTimerCompletedRef.current && hasValidRoomId) {
      joinTimerCompletedRef.current = true;
      // Schedule state update for after render
      setTimeout(() => {
        setJoined(true);
        window.gameSocket.emit("race:join", { playerId: localPlayerId, roomId: effectiveRoomId });
        console.log('[JoinArea] Joining race with roomId:', effectiveRoomId);
        
        // Teleport player to the starting line if available
        if (startLine && teleportPlayer) {
          // Add a slight offset to position player at the starting line
          // We add a small Y offset to ensure the player is above the ground
          // and a Z offset to position them just behind the start line
          const teleportPosition = [
            startLine[0],
            startLine[1] + 1.5, // Position player above the ground
            startLine[2] + 2    // Position player behind the start line
          ];
          
          console.log('[JoinArea] Teleporting player to start line:', teleportPosition);
          teleportPlayer(teleportPosition);
        } else {
          console.warn('[JoinArea] Cannot teleport player: startLine or teleportPlayer not available');
        }
      }, 0);
    }
  }, [joinTimer, hasValidRoomId, localPlayerId, effectiveRoomId, setJoined, startLine, teleportPlayer]);
  
  // Join timer effect - separated from the state update
  useEffect(() => {
    if (isInside && !isJoined && hasValidRoomId) {
      intervalRef.current = setInterval(() => {
        setJoinTimer((t) => {
          const nextValue = Math.min(t + 1, JOIN_TIME);
          return nextValue;
        });
      }, 1000);
    } else if (!hasValidRoomId && isInside) {
      // If inside but no valid room ID, show a message
      console.log('[JoinArea] Cannot start join timer: No valid race room available');
      clearInterval(intervalRef.current);
      setJoinTimer(0);
    } else {
      clearInterval(intervalRef.current);
      setJoinTimer(0);
    }
    return () => clearInterval(intervalRef.current);
  }, [isInside]);

  // Compute if race is ready based on existing data
  const raceIsReady = checkpoints && checkpoints.length > 0 && startLine;
  
  // Debug output
  useEffect(() => {
    console.log('[JoinArea] Race data:', { 
      checkpoints: checkpoints?.length || 0,
      startLine: !!startLine,
      isRaceReady,
      isInside,
      joinTimer
    });
  }, [checkpoints, startLine, isRaceReady, isInside, joinTimer]);
  
  // Don't render join area if race is already running
  const { isRaceRunning } = useRaceStore();
  
  // Skip rendering if race is running
  if (isRaceRunning) {
    return null;
  }
  
  return (
    <>
      {/* Visual representation of join zone - using the same approach as Tag game */}
      <Cylinder
        position={position}
        args={[radius/3, radius/3, 3, 32]}
        rotation={[0, 0, 0]}
      >
        <meshBasicMaterial
          color={isInside ? "rgba(0, 255, 0, 0.3)" : "rgba(0, 120, 255, 0.2)"}
          transparent
          opacity={isInside ? 0.3 : 0.2}
          depthWrite={false}
        />
      </Cylinder>
      
      {/* Text rendered using the exact same approach as Tag game */}
      {isRaceReady && (
        <>
          {/* Game name text */}
          <Text
            position={[position[0], position[1] + 11.5, position[2]]}
            fontSize={1.0}
            color="#000000"
            anchorX="center"
            anchorY="middle"
            billboard
            renderOrder={10}
            depthTest={false}
          >
            Race Game
          </Text>
          
          {/* Join here text */}
          <Text
            position={[position[0], position[1] + 10.5, position[2]]}
            fontSize={0.8}
            color="#00AA00"
            anchorX="center"
            anchorY="middle"
            billboard
            renderOrder={10}
            depthTest={false}
          >
            JOIN HERE!
          </Text>
          
          {/* Checkpoint count */}
          <Text
            position={[position[0], position[1] + 9.5, position[2]]}
            fontSize={0.6}
            color="#444444"
            anchorX="center"
            anchorY="middle"
            billboard
            renderOrder={10}
            depthTest={false}
          >
            {checkpoints?.length || 0} checkpoints
          </Text>
        </>
      )}
      
      {/* Join timer if inside */}
      {isRaceReady && isInside && joinTimer > 0 && (
        <Text
          position={[position[0], position[1] + 13, position[2]]}
          fontSize={1.5}
          color="#FFFF00"
          anchorX="center"
          anchorY="middle"
          billboard
          renderOrder={10}
          depthTest={false}
        >
          {JOIN_TIME - joinTimer}s
        </Text>
      )}
      
      {/* Visual representation of join zone */}
      <Cylinder
        position={position}
        args={[radius, radius, 3, 32]}
        rotation={[0, 0, 0]}
      >
        <meshBasicMaterial
          color={isInside ? "rgba(0, 255, 0, 0.3)" : "rgba(0, 120, 255, 0.2)"}
          transparent
          opacity={0.3}
        />
      </Cylinder>
    </>
  );
});

export default JoinArea;
