import React, { useEffect, useRef, useState, useContext } from 'react';
import { useFrame } from '@react-three/fiber';
import { Vector3 } from 'three';
import { Text } from '@react-three/drei';
import { useMultiplayer } from '../MultiplayerProvider';
import { GameSystemContext } from '../GameSystemProvider';
import { gameRegistry } from '../../games/gameRegistry';
import { getSocket } from '../../utils/socketManager';

function GameElements3D() {
  const { myId, players } = useMultiplayer();
  const { activeGames, setActiveGames } = useContext(GameSystemContext);

  const [activeGameStates, setActiveGameStates] = useState({});
  const countdownRoomIds = useRef({});
  const [showCountdown, setShowCountdown] = useState({});
  const [countdownText, setCountdownText] = useState({});
  const exitedZones = useRef({});
  const gameSocketRef = useRef(null);

  useEffect(() => {
    // Use the global socket reference created by MultiplayerProvider
    const socket = window.gameSocket || window.socket;
    
    if (!socket) {
      console.error('[GameElements3D] No global socket reference found!');
      return;
    }
    
    gameSocketRef.current = socket;
    console.log('[GameElements3D] Using global socket with ID:', socket.id);

    socket.on('gameJoinCountdown', (data) => {
      if (data.action === 'cancelled') {
        setShowCountdown(prev => ({ ...prev, [data.gameType]: false }));
      } else {
        const duration = Math.floor((data.duration || 5000) / 1000);
        setShowCountdown(prev => ({ ...prev, [data.gameType]: true }));
        setCountdownText(prev => ({ ...prev, [data.gameType]: duration }));
        countdownRoomIds.current[data.gameType] = data.roomId;

        let remaining = duration;
        const interval = setInterval(() => {
          remaining--;
          if (remaining <= 0) clearInterval(interval);
          setCountdownText(prev => ({ ...prev, [data.gameType]: remaining }));
        }, 1000);
      }
    });

    socket.on('gameStart', (data) => {
      setActiveGames(prev => ({ ...prev, [data.gameType]: data.roomId }));
      setActiveGameStates(prev => ({
        ...prev,
        [data.gameType]: {
          state: 'playing',
          startTime: data.startTime,
          endTime: data.endTime,
          taggedPlayerId: data.taggedPlayerId,
          roomId: data.roomId,
        }
      }));
    });

    socket.on('gameEnded', (data) => {
      setActiveGameStates(prev => ({
        ...prev,
        [data.gameType]: {
          ...prev[data.gameType],
          state: 'ended',
          endTime: data.endTime,
        }
      }));
      setActiveGames(prev => {
        const newGames = { ...prev };
        delete newGames[data.gameType];
        return newGames;
      });
    });
  }, [setActiveGames]);

  useFrame(() => {
    if (!myId || !players[myId]) return;

    Object.entries(gameRegistry).forEach(([gameType, game]) => {
      const joinZone = game.config.joinZone;
      if (!joinZone) return;
      
      // Check if a game of this type is already active
      // Look through all active games to find any with matching gameType and active state
      const activeGameOfType = Object.entries(activeGames || {}).find(([roomId, game]) => {
        return game?.gameType === gameType && game?.state === 'playing';
      });
      
      const isGameActive = !!activeGameOfType;
      
      if (isGameActive) {
        console.log(`[GameElements3D] Game ${gameType} is active (${activeGameOfType[0]}), disabling join zone`);
        return; // Skip zone detection when game is active
      }

      const player = players[myId];
      const playerPos = new Vector3(...(player.position || [0, 0, 0]));
      const zoneCenter = new Vector3(...joinZone.center);
      const distance = playerPos.distanceTo(zoneCenter);
      const inZone = distance <= (joinZone.radius || 2);
      const roomId = countdownRoomIds.current[gameType] || `${gameType}-1`;

      if (inZone) {
        if (exitedZones.current[gameType]) {
          exitedZones.current[gameType] = false;
          gameSocketRef.current?.emit('playerEnteredZone', { gameType, roomId });
        }
      } else {
        if (!exitedZones.current[gameType]) {
          exitedZones.current[gameType] = true;
          gameSocketRef.current?.emit('playerExitedZone', { gameType, roomId });
        }
      }
    });
  });

  useEffect(() => {
    const interval = setInterval(() => {
      Object.keys(gameRegistry).forEach(gameType => {
        const roomId = countdownRoomIds.current[gameType] || `${gameType}-1`;
        gameSocketRef.current?.emit('getGameStatus', { gameType, roomId });
      });
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const renderJoinZones = () => {
    return Object.entries(gameRegistry).map(([gameType, game]) => {
      const joinZone = game.config.joinZone;
      if (!joinZone) return null;
      
      // Check if a game of this type is already active - use the same logic as useFrame
      const activeGameOfType = Object.entries(activeGames || {}).find(([roomId, game]) => {
        return game?.gameType === gameType && game?.state === 'playing';
      });
      
      const isGameActive = !!activeGameOfType;
      const position = joinZone.center || [0, 0, 0];
      const scale = [joinZone.radius * 2 || 2, 0.2, joinZone.radius * 2 || 2];
      
      // Change color based on game state
      const zoneColor = isGameActive ? '#888888' : '#00FF00';
      const zoneOpacity = isGameActive ? 0.15 : 0.3;
      
      console.log(`[GameElements3D] Rendering join zone for ${gameType}, active: ${isGameActive}`);

      return (
        <group key={gameType}>
          <mesh position={position} scale={scale}>
            <boxGeometry />
            <meshStandardMaterial color={zoneColor} transparent opacity={zoneOpacity} />
          </mesh>
          <Text
            position={[position[0], position[1] + 1, position[2]]}
            fontSize={0.5}
            color={isGameActive ? "#888" : "#000"}
            anchorX="center"
            anchorY="middle">
            {game.name || gameType} {isGameActive ? "(Game in progress)" : "(Join here!)"}
          </Text>
          {showCountdown[gameType] && (
            <Text
              position={[position[0], position[1] + 2, position[2]]}
              fontSize={1}
              color="#FFF"
              anchorX="center"
              anchorY="middle">
              {countdownText[gameType] || '...'}
            </Text>
          )}
        </group>
      );
    });
  };

  return (
    <group>
      {renderJoinZones()}
    </group>
  );
}

export default GameElements3D;
