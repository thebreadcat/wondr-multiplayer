/**
 * GameZoneSystem.jsx
 * Reusable component to handle game join zones with position stabilization
 * Incorporates the stabilization technique to prevent rapid zone entry/exit at boundaries
 */
import React, { useEffect, useState, useRef } from 'react';
import { useMultiplayer } from '../MultiplayerProvider';
import { useGameSystem } from '../GameSystemProvider';
import { getSocket } from '../../utils/socketManager';
import { Cylinder } from '@react-three/drei';

// Default settings
const DEFAULT_JOIN_ZONE_RADIUS = 5;
const DEFAULT_STABILIZATION_THRESHOLD = 3;

const GameZoneSystem = ({
  gameType,
  zonePosition = [0, 0, 0],
  zoneRadius = DEFAULT_JOIN_ZONE_RADIUS,
  stabilizationThreshold = DEFAULT_STABILIZATION_THRESHOLD,
  showVisualDebug = false,
  onPlayerEnteredZone,
  onPlayerExitedZone,
  enableAutoEmit = true,
  zoneColor = 'rgba(0, 255, 0, 0.2)',
  isGameActive = false,
  children,
}) => {
  const { myId, players } = useMultiplayer();
  const { activeGames, gameJoinStatus } = useGameSystem();
  const socket = getSocket();

  // State to track if player is in zone
  const [isInZone, setIsInZone] = useState(false);
  // State to track join rejection
  const [joinRejected, setJoinRejected] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  
  // Default cylinder height
  const cylinderHeight = 10;
  
  // Stabilization counter refs - use per-player per-game counters for zone entry/exit
  const zoneEntryCountersRef = useRef({});
  const zoneExitCountersRef = useRef({});
  
  // Initialize counter refs if needed
  useEffect(() => {
    if (!zoneEntryCountersRef.current[gameType]) {
      zoneEntryCountersRef.current[gameType] = {};
    }
    if (!zoneExitCountersRef.current[gameType]) {
      zoneExitCountersRef.current[gameType] = {};
    }
  }, [gameType]);
  
  // Listen for join rejection messages from server
  useEffect(() => {
    if (!socket) return;
    
    const handleGameJoinRejected = (data) => {
      if (data.gameType !== gameType) return;
      
      console.log(`[GameZoneSystem] Join rejected: ${data.message}`);
      setJoinRejected(true);
      setRejectionReason(data.message);
      
      // Reset after a short delay
      setTimeout(() => {
        setJoinRejected(false);
        setRejectionReason('');
      }, 3000);
      
      // Force player out of the zone state
      if (isInZone) {
        setIsInZone(false);
        zoneEntryCountersRef.current[gameType][myId] = 0;
        zoneExitCountersRef.current[gameType][myId] = stabilizationThreshold;
      }
    };
    
    socket.on('gameJoinRejected', handleGameJoinRejected);
    
    return () => {
      socket.off('gameJoinRejected', handleGameJoinRejected);
    };
  }, [socket, gameType, isInZone, myId, stabilizationThreshold]);

  // Zone detection with position stabilization
  useEffect(() => {
    if (!socket || !myId || !players[myId] || !players[myId].position) {
      return;
    }

    const myPos = players[myId].position;
    const dx = myPos[0] - zonePosition[0];
    const dz = myPos[2] - zonePosition[2];
    const distanceSquared = dx * dx + dz * dz;
    const inZone = distanceSquared <= zoneRadius * zoneRadius;
    
    // Position stabilization to prevent rapid zone entry/exit
    if (inZone && !isInZone) {
      // Initialize counter if not exists
      if (!zoneEntryCountersRef.current[gameType][myId]) {
        zoneEntryCountersRef.current[gameType][myId] = 0;
      }
      
      // Increment counter
      zoneEntryCountersRef.current[gameType][myId]++;
      
      // Reset exit counter
      zoneExitCountersRef.current[gameType][myId] = 0;
      
      // Only update state if counter reaches threshold
      if (zoneEntryCountersRef.current[gameType][myId] >= stabilizationThreshold) {
        setIsInZone(true);
        
        // Emit zone entry event if enabled
        if (enableAutoEmit && socket) {
          socket.emit('playerEnteredZone', { gameType, playerId: myId });
        }
        
        // Call callback if provided
        if (onPlayerEnteredZone) {
          onPlayerEnteredZone(myId, gameType);
        }
      }
    } else if (!inZone && isInZone) {
      // Initialize counter if not exists
      if (!zoneExitCountersRef.current[gameType][myId]) {
        zoneExitCountersRef.current[gameType][myId] = 0;
      }
      
      // Increment counter
      zoneExitCountersRef.current[gameType][myId]++;
      
      // Reset entry counter
      zoneEntryCountersRef.current[gameType][myId] = 0;
      
      // Only update state if counter reaches threshold
      if (zoneExitCountersRef.current[gameType][myId] >= stabilizationThreshold) {
        setIsInZone(false);
        
        // Emit zone exit event if enabled
        if (enableAutoEmit && socket) {
          const roomId = `${gameType}-1`; // Use a default room ID format
          console.log(`[GameZoneSystem] Player exited zone - emitting playerExitedZone for ${gameType} with roomId ${roomId}`);
          socket.emit('playerExitedZone', { gameType, playerId: myId, roomId });
        }
        
        // Call callback if provided
        if (onPlayerExitedZone) {
          onPlayerExitedZone(myId, gameType);
        }
      }
    } else {
      // Reset counters if state matches position
      if (inZone && isInZone) {
        zoneEntryCountersRef.current[gameType][myId] = stabilizationThreshold;
        zoneExitCountersRef.current[gameType][myId] = 0;
      } else if (!inZone && !isInZone) {
        zoneEntryCountersRef.current[gameType][myId] = 0;
        zoneExitCountersRef.current[gameType][myId] = stabilizationThreshold;
      }
    }
  }, [gameType, myId, isInZone, players, socket, zonePosition, zoneRadius, enableAutoEmit, onPlayerEnteredZone, onPlayerExitedZone, stabilizationThreshold]);

  return (
    <>
      {showVisualDebug && (
        <Cylinder 
          position={zonePosition} 
          args={[zoneRadius/3, zoneRadius/3, cylinderHeight, 32]} 
          rotation={[0, 0, 0]}
        >
          <meshBasicMaterial 
            color={isGameActive ? '#CCCCCC' : zoneColor} 
            transparent 
            opacity={isGameActive ? 0.08 : 0.3} 
            depthWrite={false}
          />
        </Cylinder>
      )}
      {children ? children({ isInZone }) : null}
    </>
  );
};

export default GameZoneSystem;
