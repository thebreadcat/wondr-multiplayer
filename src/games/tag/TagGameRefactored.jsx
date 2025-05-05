/**
 * TagGameRefactored.jsx
 * Refactored version of the tag game using modular game system components
 */
import React, { useState, useEffect, useRef } from 'react';
import { useMultiplayer } from '../../components/MultiplayerProvider';
import { useGameSystem } from '../../components/GameSystemProvider';
import { getSocket } from '../../utils/socketManager';

// Import reusable game system components
import GameZoneSystem from '../../components/game-systems/GameZoneSystem';
import GameTimerSystem from '../../components/game-systems/GameTimerSystem';
import PlayerInteractionSystem from '../../components/game-systems/PlayerInteractionSystem';
import GameStatusUI from '../../components/game-systems/GameStatusUI';

// Tag game configuration - EXACTLY matching original settings for consistency
const TAG_DISTANCE = 0.25; // CRITICAL: Match the original 0.25 distance (much smaller than default)
const TAG_COOLDOWN = 3000; // 3 seconds between tags
const GAME_DURATION = 60; // 1 minute games
const JOIN_ZONE_POSITION = [-8, -0.75, -5]; // Same as original
const TAG_STABILIZATION_THRESHOLD = 2; // Match original threshold

const TagGameRefactored = ({ setLocalPosition }) => {
  const { myId, players } = useMultiplayer();
  const { activeGames, gameJoinStatus } = useGameSystem();
  const socket = getSocket();
  
  // Game state
  const [isTagged, setIsTagged] = useState(false);
  const [taggedPlayerId, setTaggedPlayerId] = useState(null);
  const gameStartTimeRef = useRef(null);
  const cleanupPerformedRef = useRef(false);
  
  // Determine game status
  const gameType = 'tag';
  const roomId = Object.keys(activeGames || {}).find(
    key => activeGames[key]?.gameType === gameType && activeGames[key]?.state === 'playing'
  );
  const isGameActive = !!roomId;
  
  // IMPORTANT: Check if current player has explicitly joined this game
  const isPlayerInGame = !!roomId && activeGames[roomId]?.players?.includes(myId);
  
  // Debug player status
  useEffect(() => {
    if (isGameActive) {
      console.log(`🎮 [TagGame] Game status check: roomId=${roomId}, currentPlayer=${myId}`);
      console.log(`🎮 [TagGame] Player in game: ${isPlayerInGame}, game has ${activeGames[roomId]?.players?.length || 0} players`);
      if (activeGames[roomId]?.players) {
        console.log(`🎮 [TagGame] Players in game:`, activeGames[roomId].players);
      }
    }
  }, [isGameActive, roomId, myId, isPlayerInGame, activeGames]);
  
  // Complete cleanup function for game end
  const performCompleteCleanup = (reason) => {
    if (cleanupPerformedRef.current) {
      console.log(`😴 [TagGame] Cleanup already performed, skipping...`);
      return;
    }
    
    console.log(`🔴 [TagGame] CLEANUP - ${reason}`);
    
    // Reset tag state
    setIsTagged(false);
    setTaggedPlayerId(null);
    
    // Mark cleanup as performed
    cleanupPerformedRef.current = true;
    // Reset game start time
    gameStartTimeRef.current = null;
  };
  
  // Handle player teleportation to spawn point when game starts - ONLY if they've joined
  useEffect(() => {
    // CRITICAL FIX: Triple-check player is in game before teleporting
    if (setLocalPosition && isGameActive && isPlayerInGame && roomId) {
      // Extra verification against server state
      const gameData = activeGames[roomId];
      const playerIsDefinitelyInGame = gameData?.players?.includes(myId);
      
      if (playerIsDefinitelyInGame) {
        // Use standard spawn position
        const spawnPosition = [0, 0.8, 0];
        console.log(`📥 [TagGame] Teleporting player to spawn position:`, spawnPosition);
        setLocalPosition(spawnPosition);
      } else {
        console.log(`⛔ [TagGame] CRITICAL: Player not found in game.players list! Preventing teleport.`);
        console.log(`⛔ [TagGame] Game players:`, gameData?.players);
        console.log(`⛔ [TagGame] Current player:`, myId);
      }
    } else if (setLocalPosition && isGameActive && !isPlayerInGame) {
      console.log(`📛 [TagGame] Player NOT in game, skipping teleportation`);
    }
  }, [isGameActive, isPlayerInGame, setLocalPosition, roomId, activeGames, myId]);

  // Track game state changes for cleanup
  useEffect(() => {
    // Reset cleanup status when game goes from inactive to active
    if (isGameActive && !gameStartTimeRef.current) {
      cleanupPerformedRef.current = false;
      gameStartTimeRef.current = Date.now();
      console.log(`🔴 [TagGame] Game started at ${new Date().toLocaleTimeString()}`);
    }
    
    // Cleanup when game ends
    if (!isGameActive && gameStartTimeRef.current) {
      performCompleteCleanup('Game ended normally');
    }
    
    // Fallback cleanup based on duration
    if (isGameActive && gameStartTimeRef.current) {
      const cleanupTimer = setTimeout(() => {
        const now = Date.now();
        const gameRuntime = (now - gameStartTimeRef.current) / 1000;
        
        if (gameRuntime >= GAME_DURATION) {
          console.warn(`⚠️ [TagGame] Game exceeded expected duration (${gameRuntime.toFixed(0)}s), triggering fallback cleanup!`);
          performCompleteCleanup('Fallback cleanup after duration exceeded');
        }
      }, (GAME_DURATION + 5) * 1000);
      
      return () => clearTimeout(cleanupTimer);
    }
  }, [isGameActive]);
  
  // Actively query game status on first connection for immediate state sync
  useEffect(() => {
    if (!socket || !isGameActive || !roomId) return;
    
    // Query the current game status to ensure we have accurate data
    console.log(`🔍 [TagGame] Explicitly querying game status for room ${roomId}...`);
    socket.emit('getGameStatus', { gameType, roomId });
    
    // Also try with the global socket if available
    if (window.gameSocket && window.gameSocket !== socket) {
      window.gameSocket.emit('getGameStatus', { gameType, roomId });
    }
  }, [socket, isGameActive, roomId, gameType]);

  // Extra debug effect to track tagged state changes
  useEffect(() => {
    console.log(`💡 [TagGame] Tagged state changed: isTagged=${isTagged}, taggedPlayerId=${taggedPlayerId?.substring(0, 6) || 'none'}`);
  }, [isTagged, taggedPlayerId]);
  
  // Handle player tagged events from server
  useEffect(() => {
    if (!socket || !isGameActive) return;
    
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
      } else if (data.targetId === myId) {
        console.log(`😱 [TagGame] I got tagged by ${data.taggerId}!`);
        setIsTagged(true);
      }
      
      if (data.targetId) {
        setTaggedPlayerId(data.targetId);
      }
    };
    
    const handleGameStateUpdate = (data) => {
      console.log(`💡 [TagGame] Game state update received:`, data);
      
      // SERVER SENDS taggedPlayerId NOT taggedId
      if (data && data.taggedPlayerId) {
        if (data.taggedPlayerId === myId) {
          console.log(`🔥 [TagGame] I AM NOW IT!`);
          setIsTagged(true);
          setTaggedPlayerId(myId);
        } else {
          console.log(`👌 [TagGame] I am NOT IT, ${data.taggedPlayerId.substring(0, 6)} is IT`);
          setIsTagged(false);
          setTaggedPlayerId(data.taggedPlayerId);
        }
      }
      
      // Special handling for game ended state
      if (data && data.state === 'ended') {
        performCompleteCleanup('Game ended via gameStateUpdate event');
      }
    };
    
    const handleGameEnded = (data) => {
      performCompleteCleanup('Explicit gameEnded event received');
    };
    
    // Register event listeners on socket
    socket.on('playerTagged', handlePlayerTagged);
    socket.on('gameStateUpdate', handleGameStateUpdate);
    socket.on('gameEnded', handleGameEnded);
    
    // Register the same listeners on window.gameSocket if it exists and is different
    if (window.gameSocket && window.gameSocket !== socket) {
      window.gameSocket.on('playerTagged', handlePlayerTagged);
      window.gameSocket.on('gameStateUpdate', handleGameStateUpdate);
      window.gameSocket.on('gameEnded', handleGameEnded);
    }
    
    return () => {
      // Clean up socket listeners
      socket.off('playerTagged', handlePlayerTagged);
      socket.off('gameStateUpdate', handleGameStateUpdate);
      socket.off('gameEnded', handleGameEnded);
      
      // Clean up global socket listeners
      if (window.gameSocket && window.gameSocket !== socket) {
        window.gameSocket.off('playerTagged', handlePlayerTagged);
        window.gameSocket.off('gameStateUpdate', handleGameStateUpdate);
        window.gameSocket.off('gameEnded', handleGameEnded);
      }
    };
  }, [socket, myId, isGameActive]);
  
  // Enhanced tag interaction handler to properly process collisions
  const handleTagInteraction = (interactionData) => {
    const targetId = interactionData.targetId;
    const sourceId = interactionData.sourceId;
    const distance = interactionData.distance;
    
    // Include full debug data in logs - match original style
    console.log(`🔥 [TagGame] Tag interaction detected at ${distance.toFixed(2)}m with: ${targetId.substring(0, 6)}`);
    
    // CRITICAL: Show proximity detection for everyone, but only proceed with tagging if we're IT
    if (!isTagged) {
      console.log(`🔄 [TagGame] Not tagged, collision detected but not sending tag event`);
      return;
    }
    
    // Only send tag events if we're within the proper range
    if (distance > TAG_DISTANCE) {
      console.log(`📏 [TagGame] Distance ${distance.toFixed(2)}m is greater than tag distance ${TAG_DISTANCE}m`);
      return;
    }
    
    // Explicitly send tag event to ensure collisions are processed
    console.log(`🎮 [TagGame] Processing tag event from ${sourceId} to ${targetId} at distance ${distance.toFixed(2)}m`);
    
    try {
      // Create tag payload with detailed information
      const tagPayload = {
        gameType,
        roomId: roomId || `${gameType}-1`,
        taggerId: myId,
        targetId,
        distance,
        timestamp: Date.now(),
        direct: true
      };
      
      // Send tag event through most reliable socket
      let tagEventSent = false;
      
      if (window.gameSocket) {
        console.log(`📱 [TagGame] Sending tag via global socket (primary)`);
        window.gameSocket.emit('tagPlayer', tagPayload);
        tagEventSent = true;
      } else if (socket) {
        console.log(`📱 [TagGame] Sending tag via local socket`);
        socket.emit('tagPlayer', tagPayload);
        tagEventSent = true;
      }
      
      if (!tagEventSent) {
        console.error(`❌ [TagGame] Failed to send tag event - no working sockets!`);
      }
    } catch (err) {
      console.error(`❌ [TagGame] Error sending tag:`, err);
    }
  };
  
  return (
    <>
      {/* Join zone system - always visible to allow joining */}
      <GameZoneSystem
        gameType={gameType}
        zonePosition={JOIN_ZONE_POSITION}
        zoneRadius={5}
        stabilizationThreshold={3} 
        showVisualDebug={true}
        zoneColor="rgba(0, 255, 0, 0.2)"
      />
      
      {/* UI is now handled by the TagGameOverlay component in App.jsx */}
      
      {/* Tag interaction system - ONLY active for players who joined the game */}
      {isGameActive && isPlayerInGame && (
        <PlayerInteractionSystem
          gameType={gameType}
          roomId={roomId}
          interactionDistance={TAG_DISTANCE} // Using exact same distance as original
          interactionType="tag"
          showVisualDebug={true}
          ignoreYAxis={true}
          cooldownMs={TAG_COOLDOWN}
          stabilizationThreshold={TAG_STABILIZATION_THRESHOLD} // Match original
          serverEventName="tagPlayer"
          onInteractionDetected={handleTagInteraction}
          customFilter={(myId, targetId, players) => {
            // IMPORTANT: We check collision for everyone but only process tagging
            // when the current player is IT in the handleTagInteraction function
            // This allows us to always track proximity for debugging
            return true;
          }}
        />
      )}
      
      {/* Countdown timer when game is starting */}
      {gameJoinStatus?.[gameType]?.state === 'countdown' && (
        <GameTimerSystem
          gameType={gameType}
          roomId={roomId}
          initialTime={gameJoinStatus[gameType].countdown || 5}
          timerType="countdown"
          autoStart={true}
        >
          {({ formattedTime, isRunning }) => (
            isRunning && (
              <div style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                fontSize: '5rem',
                color: 'white',
                textShadow: '0 0 10px black',
                zIndex: 1000
              }}>
                {formattedTime}
              </div>
            )
          )}
        </GameTimerSystem>
      )}
    </>
  );
};

export default TagGameRefactored;
