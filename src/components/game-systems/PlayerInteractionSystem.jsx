/**
 * PlayerInteractionSystem.jsx
 * Reusable component for player interactions (collision detection, proximity events)
 * Uses position stabilization techniques for reliable interaction detection
 */
import React, { useEffect, useState, useRef } from 'react';
import { useMultiplayer } from '../MultiplayerProvider';
import { getSocket } from '../../utils/socketManager';
import { useFrame } from '@react-three/fiber';
import { Sphere, Html } from '@react-three/drei';

const DEFAULT_INTERACTION_DISTANCE = 0.5; // Reduced to be more similar to original code
const DEFAULT_STABILIZATION_THRESHOLD = 2;
const DEFAULT_COOLDOWN_MS = 3000;

const PlayerInteractionSystem = ({
  gameType,
  roomId,
  interactionType = 'collision', // 'collision', 'proximity', 'custom'
  interactionDistance = DEFAULT_INTERACTION_DISTANCE,
  stabilizationThreshold = DEFAULT_STABILIZATION_THRESHOLD,
  cooldownMs = DEFAULT_COOLDOWN_MS,
  showVisualDebug = false,
  ignoreYAxis = true,
  onInteractionDetected,
  onInteractionProcessed,
  serverEventName,
  customFilter,
  children,
}) => {
  const { myId, players } = useMultiplayer();
  const socket = getSocket();
  
  // State for tracking interactions
  const [nearbyPlayers, setNearbyPlayers] = useState([]);
  const [playerDistances, setPlayerDistances] = useState({});
  const [debugSpheres, setDebugSpheres] = useState({});
  
  // Refs for stabilization and tracking
  const stabilizationCountersRef = useRef({});
  const lastInteractionTimeRef = useRef(0);
  const playerCooldownsRef = useRef({});
  
  // Initialize and manage cooldowns
  useEffect(() => {
    playerCooldownsRef.current = playerCooldownsRef.current || {};
    stabilizationCountersRef.current = stabilizationCountersRef.current || {};
    
    // IMPORTANT: Add a higher frequency collision check similar to the original code
    // This runs in parallel with the frame-based checks to ensure more consistent detection
    const collisionInterval = setInterval(() => {
      // Skip if no socket or own player data is missing
      if (!socket || !myId || !players[myId] || !players[myId].position) return;
      
      const myPosition = players[myId].position;
      
      // Process all other players for interactions
      Object.entries(players).forEach(([playerId, player]) => {
        if (playerId === myId || !player || !player.position) return;
        
        // Apply custom filtering if provided
        if (customFilter && !customFilter(myId, playerId, players)) {
          return;
        }
        
        // Calculate distance - optionally ignore Y axis
        const dx = player.position[0] - myPosition[0];
        const dy = ignoreYAxis ? 0 : (player.position[1] - myPosition[1]);
        const dz = player.position[2] - myPosition[2];
        const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
        
        // Check if player is within interaction distance
        if (distance < interactionDistance) {
          // Initialize stabilization counter if needed
          if (!stabilizationCountersRef.current[playerId]) {
            stabilizationCountersRef.current[playerId] = 0;
          }
          
          // Increment counter for this player
          stabilizationCountersRef.current[playerId]++;
        }
      });
    }, 200); // Run at 5hz for more reliable detection
    
    return () => clearInterval(collisionInterval);
  }, [socket, myId, players, customFilter, interactionDistance, ignoreYAxis]);
  
  // Check for and handle player interactions on each frame
  useFrame(() => {
    // Skip if no socket or own player data is missing
    if (!socket || !myId || !players[myId] || !players[myId].position) return;
    
    const myPosition = players[myId].position;
    const currentNearbyPlayers = [];
    const currentDistances = {};
    
    // Update debug visualization for self if enabled
    if (showVisualDebug) {
      setDebugSpheres(prev => ({
        ...prev,
        self: {
          position: myPosition,
          radius: interactionDistance,
          color: 'rgba(0, 100, 255, 0.3)'
        }
      }));
    }
    
    // Process all other players for interactions
    Object.entries(players).forEach(([playerId, player]) => {
      if (playerId === myId || !player || !player.position) return;
      
      // Calculate distance - optionally ignore Y axis
      const dx = player.position[0] - myPosition[0];
      const dy = ignoreYAxis ? 0 : (player.position[1] - myPosition[1]);
      const dz = player.position[2] - myPosition[2];
      const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
      
      // Track distances for all players
      currentDistances[playerId] = distance.toFixed(2);
      
      // Check if player is within interaction distance
      const isNearby = distance < interactionDistance;
      
      // Visual updates for debugging
      if (showVisualDebug) {
        setDebugSpheres(prev => ({
          ...prev,
          [playerId]: {
            position: player.position,
            radius: 0.5,
            color: isNearby ? 'rgba(0, 255, 0, 0.5)' : 'rgba(255, 255, 0, 0.3)'
          }
        }));
      }
      
      // Apply custom filtering if provided
      if (customFilter && !customFilter(myId, playerId, players)) {
        return;
      }
      
      // Track nearby players
      if (isNearby) {
        currentNearbyPlayers.push(playerId);
        
        // Initialize stabilization counter if needed
        if (!stabilizationCountersRef.current[playerId]) {
          stabilizationCountersRef.current[playerId] = 0;
        }
        
        // Increment counter for this player
        stabilizationCountersRef.current[playerId]++;
        
        // Check if stabilization threshold reached for reliable detection
        if (stabilizationCountersRef.current[playerId] >= stabilizationThreshold) {
          // Check cooldowns
          const now = Date.now();
          const lastInteraction = lastInteractionTimeRef.current || 0;
          const playerLastInteraction = playerCooldownsRef.current[playerId] || 0;
          
          // Ensure both global and per-player cooldowns have passed
          if (now - lastInteraction > cooldownMs && now - playerLastInteraction > cooldownMs) {
            // Track interaction time
            lastInteractionTimeRef.current = now;
            playerCooldownsRef.current[playerId] = now;
            
            // Show visual feedback for debug purposes using React components instead of DOM manipulation
            if (showVisualDebug) {
              // Use state to manage the flash visibility instead of direct DOM manipulation
              const flashId = `flash-${playerId}-${now}`;
              const flashDuration = 500; // 500ms
              
              // Add flash notification by creating a temporary state
              setNearbyPlayers(prev => [
                ...prev,
                { id: flashId, distance, timestamp: now, playerId }
              ]);
              
              // Remove after a short time using timeout
              setTimeout(() => {
                setNearbyPlayers(prev => prev.filter(p => p.id !== flashId));
              }, flashDuration);
            }
            
            // Create the interaction payload
            const interactionPayload = {
              gameType,
              roomId: roomId || `${gameType}-1`,
              sourceId: myId,
              targetId: playerId,
              distance,
              interactionType,
              timestamp: now
            };
            
            // Notify callback if provided
            if (onInteractionDetected) {
              onInteractionDetected(interactionPayload);
            }
            
            // Send to server if event name is provided
            if (serverEventName && socket) {
              let eventSent = false;
              
              // Use sequential approach to avoid duplicate events
              if (window.gameSocket) {
                console.log(`📱 [PlayerInteraction] Emitting via global socket`);
                window.gameSocket.emit(serverEventName, interactionPayload);
                eventSent = true;
              } else if (socket) {
                console.log(`📱 [PlayerInteraction] Emitting via local socket`);
                socket.emit(serverEventName, interactionPayload);
                eventSent = true;
              }
              
              if (eventSent && onInteractionProcessed) {
                onInteractionProcessed(interactionPayload);
              }
            }
            
            // Reset counter after processing
            stabilizationCountersRef.current[playerId] = 0;
          }
        }
      } else {
        // Reset counter if player is no longer nearby
        if (stabilizationCountersRef.current[playerId]) {
          stabilizationCountersRef.current[playerId] = 0;
        }
      }
    });
    
    // Update state with current values
    setNearbyPlayers(currentNearbyPlayers);
    setPlayerDistances(currentDistances);
  });
  
  // Handle socket events related to player interactions
  useEffect(() => {
    if (!socket || !gameType || !roomId) return;
    
    // Clean up visual elements when component unmounts
    return () => {
      setDebugSpheres({});
      setNearbyPlayers([]);
      setPlayerDistances({});
    };
  }, [socket, gameType, roomId]);
  
  // Render flash notifications for interactions
  const renderInteractionFlashes = () => {
    // Only render flashes from the last 1 second (to clean up old ones)
    const now = Date.now();
    const recentFlashes = nearbyPlayers.filter(p => p.id && p.id.startsWith('flash-') && (now - p.timestamp) < 1000);
    
    if (recentFlashes.length === 0) return null;
    
    return (
      <Html fullscreen portal={{ current: document.getElementById('root') || undefined }}>
        {recentFlashes.map(flash => (
          <div 
            key={flash.id} 
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              backgroundColor: 'rgba(255,0,0,0.2)',
              zIndex: 9999,
              pointerEvents: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexDirection: 'column'
            }}
          >
            <div style={{
              color: 'white', 
              fontSize: '24px',
              textAlign: 'center',
              textShadow: '0 0 5px black'
            }}>
              INTERACTION! Distance: {flash.distance.toFixed(2)}m
            </div>
          </div>
        ))}
      </Html>
    );
  };

  return (
    <>
      {/* Render debug spheres if visual debugging is enabled */}
      {showVisualDebug && Object.entries(debugSpheres).map(([key, sphere]) => (
        <Sphere key={key} position={sphere.position} args={[sphere.radius, 16, 16]}>
          <meshBasicMaterial color={sphere.color} transparent opacity={0.3} />
        </Sphere>
      ))}
      
      {/* Render interaction flash notifications */}
      {showVisualDebug && renderInteractionFlashes()}
      
      {/* Render children with context */}
      {children ? children({
        nearbyPlayers: nearbyPlayers.filter(p => !p.id || !p.id.startsWith('flash-')),
        playerDistances,
        resetCooldown: (playerId) => {
          if (playerId) {
            playerCooldownsRef.current[playerId] = 0;
          } else {
            playerCooldownsRef.current = {};
            lastInteractionTimeRef.current = 0;
          }
        }
      }) : null}
    </>
  );
};

export default PlayerInteractionSystem;
