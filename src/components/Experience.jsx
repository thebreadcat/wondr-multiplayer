import React, { useState, useEffect, useRef, useContext } from "react";
import { Environment, OrthographicCamera, Html } from "@react-three/drei";
import { Physics } from "@react-three/rapier";
import { CharacterController } from "./CharacterController";
import { Map } from "./Map";
import { useMultiplayer } from "./MultiplayerProvider";
import { getSocket } from "../utils/socketManager";
import GameElements3D from "./games/GameElements3D";
import RemotePlayer from "./RemotePlayer";
import { GameSystemContext } from "./GameSystemProvider";
import TagGameRefactored from "../games/tag/TagGameRefactored";

const maps = {
  castle_on_hills: {
    scale: 3,
    position: [-6, -7, 0],
  },
  animal_crossing_map: {
    scale: 20,
    position: [-15, -1, 10],
  },
  city_scene_tokyo: {
    scale: 0.72,
    position: [0, -1, -3.5],
  },
  de_dust_2_with_real_light: {
    scale: 0.3,
    position: [-5, -3, 13],
  },
  medieval_fantasy_book: {
    scale: 0.4,
    position: [-4, 0, -6],
  },
};

const defaultPosition = [0, 0.8, 0];
function RemotePlayersPool() {
  const { players, myId } = useMultiplayer();
  
  // Create a stable array of remote players
  const remotePlayers = Object.values(players)
    .filter(player => player.id !== myId)
    .map(player => (
      <RemotePlayer 
        key={`player-${player.id}`} 
        player={player} 
      />
    ));

  return <>{remotePlayers}</>;
}

export const Experience = ({ characterColor }) => {
  const { sendEmoji, myId, players } = useMultiplayer();
  const { activeGames } = useContext(GameSystemContext);
  const shadowCameraRef = useRef();
  const map = "animal_crossing_map";
  const [localPosition, setLocalPosition] = useState(defaultPosition);
  const [idle, setIdle] = useState(false);
  const lastActiveTimeRef = useRef(Date.now());
  
  // Find active tag game if any exists - look for games that start with 'tag'
  // Make sure game is an object with properties, not just a string
  const activeTagGame = Object.entries(activeGames || {}).find(([roomId, game]) => {
    // Check if game is a valid object with required properties
    if (!game || typeof game !== 'object' || !game.gameType) {
      console.log(`\n⚠️ Invalid game format for key ${roomId}:`, game);
      return false;
    }
    
    // Check if this is a tag game that's currently playing
    return (game.gameType === 'tag' || roomId.startsWith('tag')) && 
           game.state === 'playing';
  });
  
  // Debug active tag game detection
  useEffect(() => {
    console.log('\n====== GAME STATE DEBUG ======');
    console.log('🎮 ACTIVE GAMES:', Object.keys(activeGames || {}));
    console.log('🎮 ACTIVE GAMES FULL:', activeGames);
    console.log('🎯 ACTIVE TAG GAME:', activeTagGame ? 
      `${activeTagGame[0]} (Tagged: ${activeTagGame[1].taggedPlayerId?.substring(0, 6)})` : 'none');
    
    if (activeTagGame) {
      console.log('🎮 GAME DETAILS:', {
        roomId: activeTagGame[0],
        gameType: activeTagGame[1].gameType,
        state: activeTagGame[1].state,
        taggedPlayerId: activeTagGame[1].taggedPlayerId?.substring(0, 6),
        isCurrentPlayerTagged: activeTagGame[1].taggedPlayerId === myId,
        playerCount: activeTagGame[1].players?.length || 0
      });
    }
  }, [activeGames, activeTagGame, myId]);

  // Reset idle timer whenever position changes
  useEffect(() => {
    lastActiveTimeRef.current = Date.now();
    setIdle(false);
  }, [localPosition]);

  // Check for idle state
  useEffect(() => {
    const idleCheck = setInterval(() => {
      const now = Date.now();
      const timeSinceLastActivity = now - lastActiveTimeRef.current;
      
      // Set to idle after 5 minutes of inactivity
      if (timeSinceLastActivity > 5 * 60 * 1000) {
        setIdle(true);
      }
    }, 10000); // Check every 10 seconds

    return () => clearInterval(idleCheck);
  }, []);

  // Add emoji keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (e) => {
      const emojiMap = {
        '1': '👋',
        '2': '😊',
        '3': '❤️',
        '4': '👍',
        '5': '🎉',
      };

      if (emojiMap[e.key]) {
        sendEmoji(emojiMap[e.key]);
      }
    };

    window.addEventListener('keypress', handleKeyPress);
    return () => window.removeEventListener('keypress', handleKeyPress);
  }, [sendEmoji]);

  const handleReconnect = () => {
    lastActiveTimeRef.current = Date.now();
    setIdle(false);
  };

  return (
    <>
      <Environment preset="sunset" />
      <directionalLight
        intensity={0.65}
        castShadow
        position={[-15, 10, 15]}
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-bias={-0.00005}
      >
        <OrthographicCamera
          left={-22}
          right={15}
          top={10}
          bottom={-20}
          ref={shadowCameraRef}
          attach={"shadow-camera"}
        />
      </directionalLight>
      {!idle && (
        <Physics>
          {/* CRITICAL FIX: Only show tag game if player is actually in it */}
          {activeTagGame && activeTagGame[1]?.players?.includes(myId) ? (
            <>
              {/* TagGame component with position control - only for players in the game */}
              <TagGameRefactored 
                gameType="tag"
                roomId={activeTagGame[0]}
                setLocalPosition={setLocalPosition}
              />
              
              {/* Map and players */}
              <Map
                scale={maps[map].scale}
                position={maps[map].position}
                model={`models/${map}.glb`}
              />
              
              {/* Always render local player with CharacterController */}
              <CharacterController
                initialPosition={localPosition}
                characterColor={characterColor}
                setLocalPosition={setLocalPosition}
              />
              
              {/* Render all remote players from the pool */}
              <RemotePlayersPool />
              
              {/* Render 3D game elements (join zones, etc.) */}
              <GameElements3D />
            </>
          ) : (
            <>
              <Map
                scale={maps[map].scale}
                position={maps[map].position}
                model={`models/${map}.glb`}
              />
              {/* Always render local player with CharacterController */}
              <CharacterController
                initialPosition={localPosition}
                characterColor={characterColor}
                setLocalPosition={setLocalPosition}
              />
              
              {/* Spawn position handling is now integrated into TagGameRefactored */}
              {/* <SpawnPositionHandler
                setLocalPosition={setLocalPosition}
              /> */}
              
              {/* Render all remote players from the pool */}
              <RemotePlayersPool />
              
              {/* Render 3D game elements (join zones, etc.) */}
              <GameElements3D />
            </>
          )}
        </Physics>
      )}
      {idle && (
        <Html fullscreen>
          <div style={{ position: 'fixed', top: 0, left: 0, bottom: 0, right: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'auto' }}>
            <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '8px', textAlign: 'center' }}>
              <p>You have been idle for a while.</p>
              <button onClick={handleReconnect}>Reconnect</button>
            </div>
          </div>
        </Html>
      )}
    </>
  );
};