import React, { useState, useEffect, useRef } from "react";
import { Environment, OrthographicCamera, Html } from "@react-three/drei";
import { Physics } from "@react-three/rapier";
import { CharacterController } from "./CharacterController";
import { Map } from "./Map";
import { MultiplayerProvider, useMultiplayer } from "./MultiplayerProvider";
import { Character } from "./Character";
import RemotePlayer from "./RemotePlayer";

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

  return (
    <>
      {Object.values(players)
        .filter(player => player.id !== myId)
        .map((player) => (
          <RemotePlayer key={player.id} player={player} />
        ))
      }
    </>
  );
}

export const Experience = ({ characterColor }) => {
  const { sendEmoji } = useMultiplayer();
  const shadowCameraRef = useRef();
  const map = "animal_crossing_map";
  const [localPosition, setLocalPosition] = useState(defaultPosition);
  // idle timeout state
  const [idle, setIdle] = useState(false);
  const lastActiveTimeRef = useRef(Date.now());

  // reset activity timer when player moves
  useEffect(() => {
    lastActiveTimeRef.current = Date.now();
  }, [localPosition]);

  // check for inactivity
  useEffect(() => {
    if (idle) return;
    const interval = setInterval(() => {
      if (Date.now() - lastActiveTimeRef.current > 60000) {
        setIdle(true);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [idle]);

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
    // reset and unidle
    lastActiveTimeRef.current = Date.now();
    setIdle(false);
  };

  return (
    <>
      {/* <OrbitControls /> */}
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
        </Physics>
      )}
      {idle && (
        <Html fullscreen>
          <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'auto' }}>
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