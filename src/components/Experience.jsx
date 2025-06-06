import React, { useState, useEffect, useRef, useCallback, useMemo, memo, useContext } from "react";
import { isMobile, VirtualJoystick, MobileButtons } from "./MobileControls";
import { Environment, OrthographicCamera, Html } from "@react-three/drei"; // <Environment /> usage is uncommented below to use local HDRI
// RaceGame3D is now rendered INSIDE Physics based on showRaceGame/raceRoomId props from App.jsx
import { Physics } from "@react-three/rapier";
import { CharacterController } from "./CharacterController";
import { Map } from "./Map";
import { useMultiplayer } from "./MultiplayerProvider";
import { getSocket } from "../utils/socketManager";
import GameElements3D from "./games/GameElements3D";
import RemotePlayer from "./RemotePlayer";
import { GameSystemContext } from "./GameSystemProvider";
import TagGameRefactored from "../games/tag/TagGameRefactored";
import { RaceGame3D } from "../games/race";
import JumpPad from "./JumpPad";
import Portal from "./Portal";
import ObjectManager from "./ObjectManager";

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

export const Experience = React.memo(({ characterColor, showRaceGame, raceRoomId, showSkateboard }) => {
  // Mobile detection moved to App.jsx
  // Use raceRoomId as the shared roomId for all games
  const sharedRoomId = raceRoomId || "main-room";
  const isFirstRender = useRef(true);
  
  // Only log on first render
  useEffect(() => {
    if (isFirstRender.current) {
      console.log('[Experience] Using shared roomId for all games:', sharedRoomId);
      isFirstRender.current = false;
      
      // Make roomId globally available for other components
      window.sharedRoomId = sharedRoomId;
    }
  }, [sharedRoomId]);
  
  const { sendEmoji, myId, players } = useMultiplayer();
  const { activeGames } = useContext(GameSystemContext);
  const shadowCameraRef = useRef();
  const map = "animal_crossing_map";
  const [localPosition, setLocalPosition] = useState(defaultPosition);
  // Idle state management moved to App.jsx to avoid 3D transforms on overlay
  
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
      <Physics>
        {/* CRITICAL FIX: Only show tag game if player is actually in it */}
        {activeTagGame && activeTagGame[1]?.players?.includes(myId) ? (
          <>
            {/* TagGame component with position control - only for players in the game */}
            <TagGameRefactored 
              gameType="tag"
              roomId={activeTagGame[0] || sharedRoomId}
              setLocalPosition={setLocalPosition}
            />
            {/* Render all remote players from the pool */}
            <RemotePlayersPool />
            {/* Render 3D game elements (join zones, etc.) */}
            <GameElements3D />
            {/* Race Game 3D Elements - inside Physics! */}
            {showRaceGame && <RaceGame3D roomId={sharedRoomId} />}
            
            {/* Jump Pads for Tag Game */}
            <JumpPad position={[7.84, 0.18, -2.22]} />
            <JumpPad position={[-4.22, -0.82, -11.37]} mini={true} />
            <JumpPad position={[-10.95, 0.18, -16.17]} mini={true} />
            <JumpPad position={[17.12, -0.82, -13.14]} mini={true} />
            <JumpPad position={[8.17, 0.18, -13.34]} mini={true} />
            <JumpPad position={[-1.45, 1.18, -16.53]} />
            <JumpPad position={[14.88, -0.82, -0.01]} mini={true} />
            
            {/* Portal Pair for Tag Game */}
            <Portal 
              portalA={[-9.39, -0.82, 3.05]} 
              portalB={[15.76, 1.18, -29.7]} 
              rotationA={[0, 0, 0]} // Back to original orientation (no rotation)
              rotationB={[0, -Math.PI / 2, 0]} // Face west (-90 degrees Y rotation)
              radius={1.2}
            />
            
            {/* Object Manager for Tag Game */}
            <ObjectManager roomId={activeTagGame[0] || sharedRoomId} />
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
              showSkateboard={showSkateboard}
            />
            {/* Render all remote players from the pool */}
            <RemotePlayersPool />
            {/* Render 3D game elements (join zones, etc.) */}
            <GameElements3D />
            {/* Race Game 3D Elements - inside Physics! */}
            {showRaceGame && <RaceGame3D roomId={sharedRoomId} />}
            
            {/* Jump Pads for Normal Game */}
            <JumpPad position={[7.84, 0.18, -2.22]} />
            <JumpPad position={[-4.22, -0.82, -11.37]} mini={true} />
            <JumpPad position={[-10.95, 0.18, -16.17]} mini={true} />
            <JumpPad position={[17.12, -0.82, -13.14]} mini={true} />
            <JumpPad position={[8.17, 0.18, -13.34]} mini={true} />
            <JumpPad position={[-1.45, 1.18, -16.53]} />
            <JumpPad position={[14.88, -0.82, -0.01]} mini={true} />
            
            {/* Portal Pair for Normal Game */}
            <Portal 
              portalA={[-9.39, -0.82, 3.05]} 
              portalB={[15.76, 1.18, -29.7]} 
              rotationA={[0, 0, 0]} // Back to original orientation (no rotation)
              rotationB={[0, -Math.PI / 2, 0]} // Face west (-90 degrees Y rotation)
              radius={1.2}
            />
            
            {/* Object Manager for Normal Game */}
            <ObjectManager roomId={sharedRoomId} />
          </>
        )}
      </Physics>
    </>
  );
});
