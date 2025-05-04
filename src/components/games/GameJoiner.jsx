// src/components/games/GameJoiner.jsx
import React, { useState, useEffect, useRef } from 'react';
import { Text } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { Vector3 } from 'three';
import { useMultiplayer } from '../MultiplayerProvider';

export function GameJoiner({ 
  gameType, 
  joinZone, 
  isGameActive, 
  onJoin,
  playerCountThreshold = 2
}) {
  const [playersInZone, setPlayersInZone] = useState(0);
  const [canJoin, setCanJoin] = useState(false);
  const [hasJoined, setHasJoined] = useState(false);
  const [gameState, setGameState] = useState('waiting'); // waiting, preparing, playing, ended
  const [countdownInfo, setCountdownInfo] = useState(null);
  const [endTime, setEndTime] = useState(null);
  const { players, myId } = useMultiplayer();
  const inZoneRef = useRef(false);
  const meshRef = useRef();
  const textRef = useRef();
  
  // Debug access to socket
  useEffect(() => {
    console.log(`[DEBUG] GameJoiner for ${gameType}: window.gameSocket exists?`, !!window.gameSocket);
    
    // Print current state
    console.log(`[DEBUG] GameJoiner for ${gameType} current state: ${gameState}, hasJoined: ${hasJoined}`);
  }, []);
  
  // Listen for game events from the server
  useEffect(() => {
    const socket = window.gameSocket;
    if (!socket) {
      console.log(`[ERROR] GameJoiner for ${gameType}: No socket available!`);
      return;
    }
    
    console.log(`[DEBUG] GameJoiner for ${gameType}: Setting up listeners on socket ID ${socket.id}`);
    
    // Handle countdown events
    const handleGameJoinCountdown = (data) => {
      console.log(`[JOINER] Received gameJoinCountdown for ${gameType}:`, data);
      
      if (data.gameType === gameType) {
        if (data.action === 'cancelled') {
          console.log(`[JOINER] Game join countdown cancelled for ${gameType}`);
          setGameState('waiting');
          setCountdownInfo(null);
        } else {
          console.log(`[JOINER] Game join countdown started for ${gameType}`);
          setGameState('preparing');
          setCountdownInfo({
            startTime: data.startTime,
            duration: data.duration,
            roomId: data.roomId
          });
        }
      }
    };
    
    // Handle game start
    const handleGameStart = (data) => {
      console.log(`[JOINER] Received gameStart:`, data);
      
      if (data.gameType === gameType) {
        console.log(`[JOINER] Game ${gameType} started - UPDATING UI`);
        setGameState('playing');
        setHasJoined(true);
        setCountdownInfo(null);
        
        if (data.endTime) {
          setEndTime(data.endTime);
        }
      }
    };
    
    // Handle game status updates
    const handleGameStatus = (data) => {
      console.log(`[JOINER] Received gameStatus for ${gameType}:`, data);
      
      if (data.gameType === gameType) {
        setGameState(data.state);
        
        if (data.state === 'playing') {
          setHasJoined(true);
        }
        
        if (data.endTime) {
          setEndTime(data.endTime);
        }
      }
    };
    
    // Handle game end
    const handleGameEnded = (data) => {
      console.log(`[JOINER] Received gameEnded for ${gameType}:`, data);
      
      if (data.gameType === gameType) {
        setGameState('ended');
        setEndTime(data.endTime);
      }
    };
    
    // Set up listeners
    socket.on('gameJoinCountdown', handleGameJoinCountdown);
    socket.on('gameStart', handleGameStart);
    socket.on('gameStatus', handleGameStatus);
    socket.on('gameEnded', handleGameEnded);
    
    // Request current game status
    socket.emit('getGameStatus', { gameType });
    
    return () => {
      socket.off('gameJoinCountdown', handleGameJoinCountdown);
      socket.off('gameStart', handleGameStart);
      socket.off('gameStatus', handleGameStatus);
      socket.off('gameEnded', handleGameEnded);
    };
  }, [gameType]);
  
  // Check if current player is in the join zone and emit appropriate events
  useEffect(() => {
    // Don't process if game is already active or we've already joined
    if (isGameActive || hasJoined || gameState === 'playing') {
      return;
    }
    
    const socket = window.gameSocket;
    if (!socket) return;
    
    const checkPlayerInZone = () => {
      let count = 0;
      const playerList = Object.values(players);
      
      // Count players in zone
      playerList.forEach(player => {
        if (checkProximity(player.position, joinZone)) {
          count++;
        }
      });
      
      setPlayersInZone(count);
      
      // Check if current player is in zone
      const currentPlayer = players[myId];
      const currentlyInZone = currentPlayer && checkProximity(currentPlayer.position, joinZone);

      // Update join eligibility
      setCanJoin(currentlyInZone && count >= playerCountThreshold);
      
      // If player zone status changed, emit appropriate events
      if (currentlyInZone && !inZoneRef.current) {
        console.log(`[GAME JOIN] Player entered ${gameType} zone`);
        socket.emit('playerEnteredZone', { gameType });
        inZoneRef.current = true;
      } else if (!currentlyInZone && inZoneRef.current) {
        console.log(`[GAME JOIN] Player exited ${gameType} zone`);
        socket.emit('playerExitedZone', { gameType });
        inZoneRef.current = false;
      }
    };

    // Set up interval to check player position
    const intervalId = setInterval(checkPlayerInZone, 200); // Check 5 times per second
    
    return () => {
      clearInterval(intervalId);
      // If component unmounts while player is in zone, notify server
      if (inZoneRef.current) {
        socket.emit('playerExitedZone', { gameType });
      }
    };
  }, [players, myId, joinZone, isGameActive, hasJoined, gameState, gameType, playerCountThreshold]);
  
  // Determine color and opacity based on game state
  let color = '#FFFF00'; // Yellow by default (waiting for players)
  let opacity = 0.6;
  
  if (gameState === 'playing') {
    color = '#FF0000'; // Red when game is active
    opacity = 0.3; // More transparent when game is active
  } else if (gameState === 'ended') {
    color = '#808080'; // Gray when game has ended
    opacity = 0.3;
  } else if (gameState === 'preparing' || countdownInfo) {
    color = '#FF00FF'; // Purple when countdown is active
    opacity = 0.4;
  } else if (inZoneRef.current && playersInZone >= playerCountThreshold) {
    color = '#00FF00'; // Green when enough players to start
  }
  
  // Handle pulse animation
  useFrame(({ clock }) => {
    if (meshRef.current) {
      // Pulse effect for visibility
      const pulse = Math.sin(clock.getElapsedTime() * 2) * 0.1 + 0.9;
      meshRef.current.scale.set(pulse, 1, pulse);
      
      // Rotate slightly for better visibility
      meshRef.current.rotation.y += 0.005;
      
      if (textRef.current) {
        textRef.current.rotation.y = -meshRef.current.rotation.y;
      }
    }
  });
  
  return (
    <group position={[joinZone.center[0], joinZone.center[1], joinZone.center[2]]}>
      <mesh ref={meshRef} position={[0, 0.1, 0]}>
        <cylinderGeometry args={[joinZone.radius, joinZone.radius, 0.1, 32]} />
        <meshStandardMaterial 
          color={color} 
          opacity={opacity} 
          transparent 
          emissive={color}
          emissiveIntensity={gameState === 'playing' ? 0.2 : 0.5}
        />
      </mesh>
      
      <Text
        ref={textRef}
        position={[0, 1.5, 0]}
        color="white"
        fontSize={0.5}
        maxWidth={10}
        textAlign="center"
        anchorX="center"
        anchorY="middle"
      >
        {gameState === 'playing'
          ? `${gameType.toUpperCase()} - IN PROGRESS`
          : gameState === 'ended'
            ? `${gameType.toUpperCase()} - GAME OVER`
            : gameState === 'preparing'
              ? 'Game Starting Soon...'
              : countdownInfo
                ? 'Players Ready - Starting!'
                : inZoneRef.current
                  ? playersInZone >= playerCountThreshold
                    ? 'Waiting for game to start...'
                    : `Waiting for more players (${playersInZone}/${playerCountThreshold})`
                  : `${gameType} (${playersInZone}/${playerCountThreshold} players)`}
      </Text>
    </group>
  );
}

// Helper function to check if a player is within the join zone
function checkProximity(playerPos, zone) {
  if (!playerPos) return false;
  
  const dx = playerPos[0] - zone.center[0];
  const dz = playerPos[2] - zone.center[2];
  const distSq = dx * dx + dz * dz;
  
  return distSq < zone.radius * zone.radius;
}
