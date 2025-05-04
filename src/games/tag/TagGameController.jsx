/**
 * TagGameController.jsx
 * Handles the tag game logic and integrates with the existing game system
 */
import React, { useEffect, useState, useRef } from 'react';
import { useMultiplayer } from '../../components/MultiplayerProvider';
import { useGameSystem } from '../../components/GameSystemProvider';
import { getSocket } from '../../utils/socketManager';
import { useFrame } from '@react-three/fiber';
import { Sphere, Html } from '@react-three/drei';

// Custom hook to get socket
const useSocket = () => {
  return getSocket();
};

// Tag detection distance (how close players need to be to tag)
const TAG_DISTANCE = 0.25;

// Direct collision detection - will bypass all the socket/tag status logicd
const DIRECT_COLLISION_ENABLED = true;
const FORCE_COLLISION_TESTING = true; // Will test collisions regardless of tag status

// Tag cooldown in ms (prevents rapid re-tagging)
const TAG_COOLDOWN = 3000; // 3 seconds - increased to give more escape time

// Map to track cooldowns for individual players
const playerCooldowns = {};

// Visual debugging settings
const SHOW_DEBUG_COLLIDERS = true; // Always show visual debugging
const TAG_STABILIZATION_THRESHOLD = 2; // Reduced threshold to make tagging more responsive
const DEBUG_SPHERE_OPACITY = 0.5; // Increased opacity for better visibility

// Default game duration in seconds for fallback cleanup
const GAME_DURATION = 60;

const TagGameController = () => {
  const { myId, players } = useMultiplayer();
  const { activeGames, gameJoinStatus } = useGameSystem();
  const socket = useSocket();
  
  // Track previous game state to detect when a game ends
  const prevGameActiveRef = useRef(false);
  // Track game start time for fallback cleanup
  const gameStartTimeRef = useRef(null);
  // Track cleanup status to avoid duplicate cleanups
  const cleanupPerformedRef = useRef(false);
  
  // State for tracking who is tagged and game status
  const [isTagged, setIsTagged] = useState(false);
  const [taggedPlayerId, setTaggedPlayerId] = useState(null);
  const [gameType, setGameType] = useState('tag');
  const [roomId, setRoomId] = useState(null);
  
  // Debug visualization state
  const [debugSpheres, setDebugSpheres] = useState({});
  const [nearbyPlayers, setNearbyPlayers] = useState([]);
  const [playerDistances, setPlayerDistances] = useState({});
  
  // Refs for tracking tag detection state
  const lastTagAttemptRef = useRef(0);
  const lastTaggedTimeRef = useRef(0);
  const tagProximityCounters = useRef({});
  const tagRangeRef = useRef(TAG_DISTANCE);
  
  // Determine if the current game is active
  const isGameActive = Object.values(activeGames || {}).some(
    game => game?.gameType === gameType && game?.state === 'playing'
  );
  
  // Helper function for complete cleanup to avoid duplicate code
  const performCompleteCleanup = (reason) => {
    if (cleanupPerformedRef.current) {
      console.log(`😴 [TagGame] Cleanup already performed, skipping...`);
      return;
    }
    
    console.log(`🔴 [TagGame] CLEANUP - ${reason}`);
    
    // Clear all visual elements
    setDebugSpheres({});
    setNearbyPlayers([]);
    setPlayerDistances({});
    
    // Reset tag state
    setIsTagged(false);
    setTaggedPlayerId(null);
    setRoomId(null);
    
    // Clear all cooldowns
    Object.keys(playerCooldowns).forEach(id => {
      delete playerCooldowns[id];
    });
    
    // Clear test functions
    if (window.testTagEvent) {
      delete window.testTagEvent;
      console.log(`🧹 [TagGame] Removed window.testTagEvent function`);
    }
    
    if (window.manuallyTagPlayer) {
      delete window.manuallyTagPlayer;
      console.log(`🧹 [TagGame] Removed window.manuallyTagPlayer function`);
    }
    
    // Mark cleanup as performed
    cleanupPerformedRef.current = true;
    // Reset game start time
    gameStartTimeRef.current = null;
  };
  
  // Detect game start/end and perform cleanup
  useEffect(() => {
    const wasActive = prevGameActiveRef.current;
    prevGameActiveRef.current = isGameActive;
    
    // Reset cleanup status when game goes from inactive to active
    if (!wasActive && isGameActive) {
      cleanupPerformedRef.current = false;
      gameStartTimeRef.current = Date.now();
      console.log(`🔴 [TagGame] Game started at ${new Date().toLocaleTimeString()}`);
    }
    
    // Normal cleanup when game ends
    if (wasActive && !isGameActive) {
      performCompleteCleanup('Game ended normally');
    }
  }, [isGameActive]);
  
  // Add debug logging for tag state
  useEffect(() => {
    console.log(`🏷️ [TagGame] Debug - isTagged: ${isTagged}, taggedPlayerId: ${taggedPlayerId}, myId: ${myId}`);
    
    // Added: force-check for tagged status based on Experience.jsx data
    // This helps when TagGameController and Experience disagree about who is tagged
    if (activeGames && Object.values(activeGames).some(g => g?.taggedId === myId) && !isTagged) {
      console.log(`🔄 [TagGame] Forced correction: Experience.jsx says I'm tagged but controller doesn't. Updating state...`);
      setIsTagged(true);
    }
  }, [isTagged, taggedPlayerId, myId, activeGames]);
  
  // Add force polling for collisions on interval (backup to frame-based detection)
  useEffect(() => {
    if (!DIRECT_COLLISION_ENABLED || !players || !myId || !isGameActive) {
      // Clear all collision detection resources when conditions aren't met
      return () => {};
    }
    
    console.log(`🕒 [TagGame] Starting collision detection interval`);
    
    const collisionInterval = setInterval(() => {
      const myPlayer = players[myId];
      if (!myPlayer || !myPlayer.position) return;
      
      // Check all other players for collisions
      Object.entries(players).forEach(([playerId, player]) => {
        if (playerId === myId || !player || !player.position) return;
        
        // Calculate horizontal distance (X,Z plane only)
        const dx = player.position[0] - myPlayer.position[0];
        const dz = player.position[2] - myPlayer.position[2];
        const distance = Math.sqrt(dx * dx + dz * dz);
        
        if (distance <= TAG_DISTANCE) {
          // Check cooldowns to avoid spamming logs
          const now = Date.now();
          const playerLastTagged = playerCooldowns[playerId] || 0;
          
          if (now - playerLastTagged > TAG_COOLDOWN) {
            // Reduced logging to prevent console spam
            // Only log every 10 seconds for the same player
            const logKey = `log-${playerId}`;
            const lastLog = playerCooldowns[logKey] || 0;
            if (now - lastLog > 10000) {
              console.log(`🕒 [TagGame] Player ${playerId} in range! Distance: ${distance.toFixed(2)}`);
              playerCooldowns[logKey] = now;
            }
          }
        }
      });
      
      // Clean up expired cooldowns
      const now = Date.now();
      Object.entries(playerCooldowns).forEach(([id, timestamp]) => {
        if ((now - timestamp > TAG_COOLDOWN) && !id.startsWith('log-')) {
          delete playerCooldowns[id];
        }
      });
    }, 500);
    
    // Add test tag function only when game is active and it doesn't already exist
    if (!window.testTagEvent) {
      window.testTagEvent = () => {
        const targetPlayerId = Object.keys(players).find(id => id !== myId);
        
        if (!targetPlayerId) {
          console.log(`⚠️ [TagGame] No other players found for test tag`);
          return;
        }
        
        const testPayload = {
          gameType: 'tag',
          roomId: roomId || 'tag-1', // Fallback roomId if not set
          taggerId: myId,
          targetId: targetPlayerId
        };
        
        console.log(`🧪 [TagGame] TEST TAG EVENT:`, testPayload);
        
        // Try all available socket methods
        if (window.gameSocket) window.gameSocket.emit('tagPlayer', testPayload);
        if (socket) socket.emit('tagPlayer', testPayload);
        if (window.socket) window.socket.emit('tagPlayer', testPayload);
      };
      
      // Log the test function (only once)
      console.log(`🧪 [TagGame] Added test function: Call window.testTagEvent() to test tagging`);
    }
    
    return () => {
      clearInterval(collisionInterval);
      console.log(`🕒 [TagGame] Stopped collision detection interval`);
    };
  }, [players, myId, roomId, isGameActive, socket]);
  
  // Find the current tag game room if any
  useEffect(() => {
    if (!activeGames) return;
    
    // Debug active games
    console.log(`🎮 [TagGame] Active games:`, activeGames);
    
    Object.entries(activeGames).forEach(([id, game]) => {
      if (game?.gameType === 'tag' && game?.state === 'playing') {
        console.log(`🎯 [TagGame] Found active tag game: ${id}`);
        setRoomId(id);
        setGameType('tag');
        
        // Check if current player is tagged
        if (game.taggedId === myId) {
          console.log(`🔴 [TagGame] I am tagged!`);
          setIsTagged(true);
          setTaggedPlayerId(myId);
        } else if (game.taggedId) {
          console.log(`🟢 [TagGame] Player ${game.taggedId} is tagged`);
          setIsTagged(false);
          setTaggedPlayerId(game.taggedId);
        } else {
          console.log(`⚠️ [TagGame] No tagged player in game!`);
        }
      }
    });
  }, [activeGames, myId]);
  
  // Main tag detection logic
  useEffect(() => {
    if (!isGameActive) {
      console.log(`🛑 [TagGame] Tag detection disabled - Game is not active`);
      // Clear all tag-related resources when game is not active
      setDebugSpheres({});
      setNearbyPlayers([]);
      setPlayerDistances({});
      return () => {};
    }
    
    if (!myId || !players || !socket) {
      console.log(`⚠️ [TagGame] Tag detection inactive - missing requirements:`, {
        myId,
        hasPlayers: !!players,
        hasSocket: !!socket
      });
      return () => {};
    }
    
    if (!isTagged) {
      console.log(`🟢 [TagGame] Tag detection inactive - I am not tagged`);
      return () => {};
    }
    
    console.log(`🏷️ [TagGame] Tag detection active - I am tagged!`);
    console.log(`🎮 [TagGame] Game details:`, { gameType, roomId, myId, taggedPlayerId });
    
    // Function to check for nearby players to tag
    const checkForTags = () => {
      const now = Date.now();
      if (now - lastTagAttemptRef.current < 200) return;
      lastTagAttemptRef.current = now;
      
      const myPlayer = players[myId];
      if (!myPlayer || !myPlayer.position) return;
      
      const myPosition = myPlayer.position;
      const nearbyPlayersList = [];
      const distances = {};
      
      Object.entries(players).forEach(([playerId, player]) => {
        // Skip self or players without position
        if (playerId === myId || !player || !player.position) return;
        
        // Calculate distance (horizontal plane only - X and Z)
        const dx = player.position[0] - myPosition[0];
        const dz = player.position[2] - myPosition[2];
        const distance = Math.sqrt(dx * dx + dz * dz);
        
        // Store distance for debugging
        distances[playerId] = distance.toFixed(2);
        
        // Check if player is within tagging range
        if (distance < TAG_DISTANCE) {
          // Initialize counter if not exist
          if (!tagProximityCounters.current[playerId]) {
            tagProximityCounters.current[playerId] = 0;
          }
          
          // Increment counter for this player
          tagProximityCounters.current[playerId]++;
          nearbyPlayersList.push(player);
          
          console.log(`🔍 [TagGame] Player ${playerId} in range (${distance.toFixed(2)} units), counter: ${tagProximityCounters.current[playerId]}/${TAG_STABILIZATION_THRESHOLD}`);
          
          // Check if stable enough to tag
          if (tagProximityCounters.current[playerId] >= TAG_STABILIZATION_THRESHOLD) {
            console.log(`🔴 [TagGame] TAGGING PLAYER ${playerId}!`);
            console.log(`💬 [TagGame] Tag details:`, {
              gameType,
              roomId,
              taggerId: myId,
              targetId: playerId,
              distance,
              threshold: TAG_STABILIZATION_THRESHOLD,
              counter: tagProximityCounters.current[playerId]
            });
            
            // Create the tag payload once to ensure consistency
            const tagPayload = {
              gameType,
              roomId,
              taggerId: myId,
              targetId: playerId
            };
                        // SEQUENTIAL socket approach to avoid duplicate tag events
            try {
              let tagEventSent = false;
              
              // Track if we've sent the event to avoid duplicates
              // Try global socket first (most reliable)
              if (window.gameSocket && !tagEventSent) {
                console.log(`📱 [TagGame] Emitting tag via global socket (primary)`);
                window.gameSocket.emit('tagPlayer', tagPayload);
                tagEventSent = true;
              }
              
              // Only try local socket if global socket didn't work
              if (socket && !tagEventSent) {
                console.log(`📱 [TagGame] Emitting tag via local socket (fallback 1)`);
                socket.emit('tagPlayer', tagPayload);
                tagEventSent = true;
              }
              
              // Last resort - only if other methods failed
              if (window.socket && !tagEventSent && window.socket !== socket && window.socket !== window.gameSocket) {
                console.log(`📱 [TagGame] Emitting tag via window.socket (fallback 2)`);
                window.socket.emit('tagPlayer', tagPayload);
                tagEventSent = true;
              }
              
              // Add direct alert for debugging if no event was sent
              if (!tagEventSent) {
                console.error(`⚠️ [TagGame] No socket available for tagging! This is a critical error.`);
                alert(`Debug: No socket available for tag event. Check console.`);
              }
              
              // Reset counter after tag attempt
              tagProximityCounters.current[playerId] = 0;
            } catch (err) {
              console.error('[TagGame] Error emitting tag event:', err);
              alert(`Debug: Error sending tag event: ${err.message}`);
            }
          }
        } else {
          // Reset counter if player moves out of range
          if (tagProximityCounters.current[playerId]) {
            tagProximityCounters.current[playerId] = 0;
          }
        }
      });
      
      // Update nearby players list for visualization
      setNearbyPlayers(nearbyPlayersList);
      setPlayerDistances(distances);
    };
    
    // Run tag detection on interval for consistent performance
    const intervalId = setInterval(checkForTags, 200);
    console.log(`💬 [TagGame] Started tag detection interval ${intervalId}`);
    
    return () => {
      console.log(`🗑 [TagGame] Cleaning up tag detection interval ${intervalId}`);
      clearInterval(intervalId);
    };
  }, [isGameActive, isTagged, myId, players, socket, gameType, roomId, taggedPlayerId]);
  
  // Update debug visualization and handle direct collision detection on each frame
  useFrame(() => {
    if (!SHOW_DEBUG_COLLIDERS && !DIRECT_COLLISION_ENABLED) return;
    
    // Handle all player positions and collision detection in one pass
    const myPlayer = players[myId];
    if (!myPlayer || !myPlayer.position) return;
    
    // Update tag detection sphere around the current player
    if (SHOW_DEBUG_COLLIDERS) {
      setDebugSpheres(prev => ({
        ...prev,
        self: {
          position: myPlayer.position,
          radius: tagRangeRef.current,
          color: isTagged ? 'rgba(255, 0, 0, 0.6)' : 'rgba(0, 0, 255, 0.6)' // Brighter color based on tag status
        }
      }));
    }
    
    // Process all other players for visualization and DIRECT collision detection
    Object.entries(players).forEach(([playerId, player]) => {
      if (playerId === myId || !player || !player.position) return;
      
      // Calculate distance - ONLY horizontal plane (X and Z)
      const dx = player.position[0] - myPlayer.position[0];
      const dz = player.position[2] - myPlayer.position[2];
      const distance = Math.sqrt(dx * dx + dz * dz);
      const isNearby = distance < TAG_DISTANCE;
      
      // Visual updates for debugging
      if (SHOW_DEBUG_COLLIDERS) {
        setDebugSpheres(prev => ({
          ...prev,
          [playerId]: {
            position: player.position,
            radius: 0.25,
            color: isNearby ? 'rgba(0, 255, 0, 0.8)' : 'rgba(255, 255, 0, 0.5)' // Brighter colors
          }
        }));
        
        // Update distance labels
        setPlayerDistances(prev => ({
          ...prev,
          [playerId]: distance.toFixed(2)
        }));
      }
      
      // DIRECT COLLISION DETECTION - bypass all the socket communication complexities
      // Only attempt to tag if we're close enough
      if (DIRECT_COLLISION_ENABLED && isNearby) {
        // Check if we should emit a tag event:
        // 1. Either I am tagged (I can tag others)
        // 2. Or the other player is tagged (they can tag me, but let server validate)
        // 3. Or we're forcing collision testing for debugging
        const otherPlayerIsTagged = taggedPlayerId === playerId;
        const canAttemptTag = FORCE_COLLISION_TESTING || isTagged || otherPlayerIsTagged;  
        
        if (!canAttemptTag) {
          // Skip this tag attempt - neither player is IT
          return; // This immediately exits the current forEach callback (for this player only)
        }
        // Rate limit how often we trigger the tag event using per-player cooldowns
        const now = Date.now();
        const lastTagTime = lastTaggedTimeRef.current || 0;
        const playerLastTagged = playerCooldowns[playerId] || 0;
        
        // Check both global cooldown and per-player cooldown
        if (now - lastTagTime > TAG_COOLDOWN && now - playerLastTagged > TAG_COOLDOWN) {
          console.log(`⚡⚡⚡ [TagGame] DIRECT COLLISION with ${playerId} at distance ${distance.toFixed(2)}! ⚡⚡⚡`);
          
          // Show visual feedback without using alerts
          const flashElement = document.createElement('div');
          flashElement.style.position = 'fixed';
          flashElement.style.top = '0';
          flashElement.style.left = '0';
          flashElement.style.width = '100%';
          flashElement.style.height = '100%';
          flashElement.style.backgroundColor = 'rgba(255,0,0,0.3)';
          flashElement.style.zIndex = '9999';
          flashElement.style.pointerEvents = 'none';
          flashElement.innerHTML = `<div style="color: white; font-size: 24px; text-align: center; margin-top: 40vh">
            COLLISION! Distance: ${distance.toFixed(2)}m
          </div>`;
          document.body.appendChild(flashElement);
          
          // Remove after a short time
          setTimeout(() => {
            document.body.removeChild(flashElement);
          }, 500);
          
          // IMPORTANT: Don't update local state immediately!
          // Instead, only track cooldowns and wait for server confirmation via socket events
          // This ensures client and server states stay in sync
          
          // Record this player's cooldown locally
          playerCooldowns[playerId] = now;
          console.log(`🕗 [TagGame] Player ${playerId} now on cooldown until ${new Date(now + TAG_COOLDOWN).toLocaleTimeString()}`);
          
          // Log upcoming tag attempt
          console.log(`🔥 [TagGame] Direct collision detected with ${playerId} - sending tag event`);
          
          // Send tag event to server using SEQUENTIAL approach to avoid duplicates
          try {
            const tagPayload = {
              gameType: 'tag',
              roomId: roomId || 'tag-1',
              taggerId: myId,
              targetId: playerId,
              direct: true // Mark this as a direct collision detection
            };
            
            // Use sequential approach to avoid duplicate events
            let tagEventSent = false;
            
            // Try global socket first (most reliable)
            if (window.gameSocket && !tagEventSent) {
              console.log(`📱 [TagGame] Emitting direct tag via global socket (primary)`);
              window.gameSocket.emit('tagPlayer', tagPayload);
              tagEventSent = true;
            }
            
            // Only try local socket if global socket didn't work
            if (socket && !tagEventSent) {
              console.log(`📱 [TagGame] Emitting direct tag via local socket (fallback 1)`);
              socket.emit('tagPlayer', tagPayload);
              tagEventSent = true;
            }
            
            // Last resort only if other methods failed
            if (window.socket && !tagEventSent && window.socket !== socket && window.socket !== window.gameSocket) {
              console.log(`📱 [TagGame] Emitting direct tag via window.socket (fallback 2)`);
              window.socket.emit('tagPlayer', tagPayload);
              tagEventSent = true;
            }
            
            if (tagEventSent) {
              console.log(`💬 [TagGame] Tag event sent successfully, waiting for server confirmation`);
            } else {
              console.error(`❗ [TagGame] Failed to send tag event - no working socket found!`);
            }
          } catch (err) {
            console.error('Error with direct collision detection:', err);
          }
        }
      }
    });
  });
  
  // Manual tag function for debugging
  useEffect(() => {
    if (!socket || !roomId || !gameType || !isGameActive) return;
    
    // Only add debug functions when game is active
    if (!window.manuallyTagPlayer) {
      window.manuallyTagPlayer = (targetId) => {
        console.log(`🤖 [TagGame] Manually tagging player ${targetId}`);
        socket.emit('tagPlayer', {
          gameType,
          roomId,
          taggerId: myId,
          targetId
        });
      };
      
      console.log('🤖 [TagGame] Added window.manuallyTagPlayer() debug function');
    }
    
    // Handle player tagged events - critical for tag game functionality
    const handlePlayerTagged = (data) => {
      console.log(`👉 [TagGame] Player tagged event received:`, data);
      
      if (!data) {
        console.error(`❌ [TagGame] Invalid playerTagged event - no data received`);
        return;
      }
      
      // Reset cleanup status whenever we get a valid tag event
      cleanupPerformedRef.current = false;
      
      if (data.taggerId === myId) {
        console.log(`🎮 [TagGame] I tagged player ${data.targetId}!`);
        setIsTagged(false);
        
        // Update cooldowns to prevent immediate tag-backs
        const now = Date.now();
        if (data.targetId) playerCooldowns[data.targetId] = now;
        lastTaggedTimeRef.current = now;
      } else if (data.targetId === myId) {
        console.log(`😱 [TagGame] I got tagged by ${data.taggerId}!`);
        setIsTagged(true);
      }
      
      if (data.targetId) {
        setTaggedPlayerId(data.targetId);
      }
    };
    
    // Also listen for game state updates which include tag information
    const handleGameStateUpdate = (data) => {
      console.log(`📊 [TagGame] Game state update:`, data);
      
      // Reset cleanup status whenever we get a valid game state update
      if (data && data.state === 'playing') {
        cleanupPerformedRef.current = false;
      }
      
      // Special handling for game ended state
      if (data && data.state === 'ended') {
        console.log(`📊 [TagGame] Game ended via gameStateUpdate event`);  
        performCompleteCleanup('Game ended via gameStateUpdate event');
        return;
      }
      
      if (data && data.taggedId) {
        if (data.taggedId === myId) {
          setIsTagged(true);
          setTaggedPlayerId(myId);
        } else {
          setIsTagged(false);
          setTaggedPlayerId(data.taggedId);
        }
      }
    };
    
    // Handle game end events
    const handleGameEnded = (data) => {
      console.log(`🎮 [TagGame] Game ended event received:`, data);
      performCompleteCleanup('Explicit gameEnded event received');
    };
    
    // Handle pong responses from the server
    const handlePong = (data) => {
      // Reduced logging to prevent spam
      // console.log(`🏓 [TagGame] Pong from server:`, data);
    };
    
    // Register event listeners on primary socket
    socket.on('playerTagged', handlePlayerTagged);
    socket.on('gameStateUpdate', handleGameStateUpdate);
    socket.on('gameEnded', handleGameEnded);
    socket.on('pong', handlePong);
    
    // Register the same listeners on window.gameSocket if it exists and is different
    if (window.gameSocket && window.gameSocket !== socket) {
      window.gameSocket.on('playerTagged', handlePlayerTagged);
      window.gameSocket.on('gameStateUpdate', handleGameStateUpdate);
      window.gameSocket.on('gameEnded', handleGameEnded);
    }
    
    // Cleanup all event listeners
    return () => {
      // Clean up primary socket
      socket.off('playerTagged', handlePlayerTagged);
      socket.off('gameStateUpdate', handleGameStateUpdate);
      socket.off('gameEnded', handleGameEnded);
      socket.off('pong', handlePong);
      
      // Clean up global socket if different
      if (window.gameSocket && window.gameSocket !== socket) {
        window.gameSocket.off('playerTagged', handlePlayerTagged);
        window.gameSocket.off('gameStateUpdate', handleGameStateUpdate);
        window.gameSocket.off('gameEnded', handleGameEnded);
      }
      
      // Clean up debug function
      delete window.manuallyTagPlayer;
    };
  }, [socket, myId, roomId, gameType]);
  
  // Fallback cleanup timer based on game duration
  useEffect(() => {
    if (!isGameActive || !gameStartTimeRef.current) return;
    
    console.log(`🕓 [TagGame] Starting fallback cleanup timer for ${GAME_DURATION} seconds`);
    
    // Set a timer to clean up after GAME_DURATION seconds even if game end events don't fire
    const cleanupTimer = setTimeout(() => {
      if (isGameActive && gameStartTimeRef.current) {
        const now = Date.now();
        const gameRuntime = (now - gameStartTimeRef.current) / 1000;
        
        if (gameRuntime >= GAME_DURATION) {
          console.warn(`⚠️ [TagGame] Game exceeded expected duration (${gameRuntime.toFixed(0)}s), triggering fallback cleanup!`);
          performCompleteCleanup('Fallback cleanup after duration exceeded');
        }
      }
    }, (GAME_DURATION + 5) * 1000); // Add 5 seconds buffer
    
    return () => {
      clearTimeout(cleanupTimer);
      console.log(`🕓 [TagGame] Cleaned up fallback timer`);
    };
  }, [isGameActive]);
  
  // Ping server periodically to make sure connection is alive
  useEffect(() => {
    if (!socket || !isGameActive) return;
    
    const pingInterval = setInterval(() => {
      socket.emit('ping', { timestamp: Date.now() });
    }, 5000);
    
    // Add a manual tag test function on window for debugging
    if (!window.testTagEvent) {
      window.testTagEvent = () => {
        const targetPlayerId = Object.keys(players).find(id => id !== myId);
        
        if (!targetPlayerId) {
          console.log(`⚠️ [TagGame] No other players found for test tag`);
          alert('No other players to tag');
          return;
        }
        
        const testPayload = {
          gameType: 'tag',
          roomId: roomId || 'tag-1', // Fallback roomId if not set
          taggerId: myId,
          targetId: targetPlayerId
        };
        
        console.log(`🧪 [TagGame] TEST TAG EVENT:`, testPayload);
        alert(`Sending test tag: ${myId.substring(0, 5)} tagging ${targetPlayerId.substring(0, 5)}`);
        
        // Try all available socket methods
        if (window.gameSocket) window.gameSocket.emit('tagPlayer', testPayload);
        if (socket) socket.emit('tagPlayer', testPayload);
        if (window.socket) window.socket.emit('tagPlayer', testPayload);
      };
      
      // Log the test function
      console.log(`🧪 [TagGame] Added test function: Call window.testTagEvent() to test tagging`);
    }
    
    return () => {
      clearInterval(pingInterval);
      delete window.testTagEvent;
    };
  }, [socket, isGameActive, myId, players, roomId]);
  
  // Render debug visualizations when enabled
  if (!SHOW_DEBUG_COLLIDERS) return null;
  
  return (
    <>
      {/* Visual debugging elements - always show regardless of tag status */}
      {Object.entries(debugSpheres).map(([key, sphere]) => (
        <Sphere key={key} args={[sphere.radius]} position={sphere.position}>
          <meshBasicMaterial color={sphere.color} transparent={true} opacity={DEBUG_SPHERE_OPACITY} />
        </Sphere>
      ))}
      
      {/* Player distance labels - always show regardless of tag status */}
      {Object.entries(playerDistances).map(([playerId, distance]) => {
        const player = players[playerId];
        if (!player || !player.position) return null;
        
        return (
          <Html key={`label-${playerId}`} position={[player.position[0], player.position[1] + 2, player.position[2]]}>
            <div style={{ 
              background: 'rgba(0,0,0,0.7)', 
              color: 'white', 
              padding: '2px 6px', 
              borderRadius: '4px',
              fontFamily: 'monospace',
              fontSize: '12px'
            }}>
              {playerId.substring(0, 4)}... ({distance}m)
            </div>
          </Html>
        );
      })}
    </>
  );
};

export { TagGameController };
