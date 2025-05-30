/**
 * RaceJoinZone.jsx
 * Implements a join zone for race games using RigidBody with collision detection
 */
import React, { useEffect, useState, useRef } from 'react';
import { useRace } from './useRace';
import { getSocket } from '../../utils/socketManager';
import { Text } from '@react-three/drei';
import { RigidBody, CylinderCollider } from '@react-three/rapier';

const RaceJoinZone = ({ roomId = "main-room" }) => {
  const race = useRace();
  const joinZoneRef = useRef();
  const [isPlayerInZone, setIsPlayerInZone] = useState(false);
  // Use the same position as the working JoinArea component
  const [joinZonePosition, setJoinZonePosition] = useState([12, -0.75, 5]); // Position from JoinArea component
  const socket = getSocket();
  
  // Debug output to verify the component is rendering
  console.log(`[RaceJoinZone] Rendering for room ${roomId} with ${race.checkpoints?.length || 0} checkpoints`);
  
  // Initialize join zone position from race data if available
  useEffect(() => {
    if (race.joinZonePosition) {
      setJoinZonePosition(race.joinZonePosition);
    }
  }, [race.joinZonePosition]);
  
  // Collision detection handlers
  const handleIntersectionEnter = (payload) => {
    // Check if the colliding object is the player
    if (payload.other.rigidBodyObject?.name === "player") {
      console.log('🎯 Player entered race join zone!', payload);
      setIsPlayerInZone(true);
      
      // Get the player ID (socket ID)
      const playerId = socket?.id;
      
      // Emit the join event to the server
      if (socket && roomId) {
        // Log similar to tag game for debugging
        console.log(`${socket.id} joined game race with room id ${roomId}`);
        
        socket.emit('race:join', { roomId, playerId });
        
        // Add notification for player
        if (window.addNotification) {
          window.addNotification({
            type: 'success',
            message: 'Joining race! Stay in the blue circle for countdown.',
            duration: 5000
          });
        }
      }
    }
  };
  
  // Handle player exiting the join zone
  const handleIntersectionExit = (payload) => {
    // Check if the colliding object is the player
    console.log('hey hey', payload.other.rigidBodyObject?.name)
    if (payload.other.rigidBodyObject?.name === "player") {
      console.log('🚶 Player left race join zone!', payload);
      setIsPlayerInZone(false);
      
      // Get the player ID (socket ID)
      const playerId = socket?.id;
      
      // Emit the leave event to the server
      if (socket && roomId) {
        // Log similar to tag game for debugging
        console.log(`${socket.id} left game race with room id ${roomId}`);
        
        socket.emit('race:leave', { roomId, playerId });
        
        // Add notification for player
        if (window.addNotification) {
          window.addNotification({
            type: 'warning',
            message: 'Left the starting zone. Return to join the race.',
            duration: 3000
          });
        }
      }
    }
  };
  
  // Listen for race join events from server
  useEffect(() => {
    if (!socket) return;
    
    const handleRaceJoined = (data) => {
      if (data.roomId !== roomId) return;
      
      console.log(`[RaceJoinZone] Received race:joined event for room ${roomId}`, data);
      
      // Update race state
      race.setRoomId(data.roomId);
      
      // Start countdown
      race.startCountdown();
      
      // Show notification
      if (window.addNotification) {
        window.addNotification({
          type: 'success',
          message: 'Race countdown starting! Get ready!',
          duration: 3000
        });
      }
    };
    
    socket.on('race:joined', handleRaceJoined);
    
    return () => {
      socket.off('race:joined', handleRaceJoined);
    };
  }, [socket, roomId, race]);
  
  // Determine if race is ready (has checkpoints and start line)
  const isRaceReady = race.checkpoints && race.checkpoints.length > 0 && race.startLine;
  
  // Calculate text position (slightly above the join zone)
  const textPosition = [
    joinZonePosition[0],
    joinZonePosition[1] + 2, // Position text 2 units above the join zone
    joinZonePosition[2]
  ];
  
  const zoneRadius = 5; // Match the previous zone radius
  const zoneHeight = 2; // Height of the cylinder
  
  return (
    <>
      {/* Visual representation of the join zone */}
      <mesh position={joinZonePosition}>
        <cylinderGeometry args={[zoneRadius, zoneRadius, zoneHeight, 32]} />
        <meshStandardMaterial 
          color={isPlayerInZone ? "rgba(0, 255, 100, 0.3)" : "rgba(0, 100, 255, 0.3)"} 
          transparent 
          opacity={0.3} 
          emissive={isPlayerInZone ? "#00ff00" : "#0066ff"}
          emissiveIntensity={0.5}
        />
      </mesh>
      
      {/* Collision detection - match the working JoinArea component */}
      <RigidBody 
        type="fixed"
        colliders="cylinder"
        sensor
        position={joinZonePosition}
        userData={{ type: "raceJoinZone", roomId }}
        onIntersectionEnter={({ other }) => {
          console.log('hey hey', other);
          if (other.rigidBodyObject?.name === "player") {
            console.log('🎯 Player entered race join zone!');
            setIsPlayerInZone(true);
            
            // Get the player ID (socket ID)
            const playerId = socket?.id;
            
            // Emit the join event to the server
            if (socket && roomId) {
              // Log similar to tag game for debugging
              console.log(`${socket.id} joined game race with room id ${roomId}`);
              
              socket.emit('race:join', { roomId, playerId });
              
              // Add notification for player
              if (window.addNotification) {
                window.addNotification({
                  type: 'success',
                  message: 'Joining race! Stay in the blue circle for countdown.',
                  duration: 5000
                });
              }
            }
          }
        }}
        onIntersectionExit={({ other }) => {
          console.log('yo yo', other);
          if (other.rigidBodyObject?.name === "player") {
            console.log('🚶 Player left race join zone!');
            setIsPlayerInZone(false);
            
            // Get the player ID (socket ID)
            const playerId = socket?.id;
            
            // Emit the leave event to the server
            if (socket && roomId) {
              // Log similar to tag game for debugging
              console.log(`${socket.id} left game race with room id ${roomId}`);
              
              socket.emit('race:leave', { roomId, playerId });
              
              // Add notification for player
              if (window.addNotification) {
                window.addNotification({
                  type: 'warning',
                  message: 'Left the starting zone. Return to join the race.',
                  duration: 3000
                });
              }
            }
          }
        }}
      />
      {/* Render a text label above the join zone */}
      {isRaceReady && (
        <Text
          position={textPosition}
          fontSize={0.5}
          color="white"
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.05}
          outlineColor="black"
        >
          Join Race
        </Text>
      )}
          
      {/* Render a message if the race is not ready */}
      {!isRaceReady && (
        <Text
          position={textPosition}
          fontSize={0.5}
          color="orange"
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.05}
          outlineColor="black"
        >
          Race Not Ready
        </Text>
      )}
      
      {/* Show player status when in zone */}
      {isPlayerInZone && (
        <Text
          position={[joinZonePosition[0], joinZonePosition[1] + 1, joinZonePosition[2]]}
          fontSize={0.4}
          color="#00ff00"
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.05}
          outlineColor="black"
        >
          In Join Zone
        </Text>
      )}
    </>
  );
};

export default RaceJoinZone;
