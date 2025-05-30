// RaceBuilder.jsx - Main container for the race builder system
import React, { useEffect } from 'react';
import { useRace } from './useRace';
import { StartLine, Checkpoints } from './RaceElements';
import { useMultiplayer } from '../../components/MultiplayerProvider';
import RaceJoinZone from './RaceJoinZone';

// This is the 3D part of the RaceBuilder - it will be used inside the Canvas
function RaceBuilder3D({ roomId }) {
  const raceStore = useRace();
  const { myId, players } = useMultiplayer();
  
  // Set the room ID when the component mounts
  useEffect(() => {
    if (roomId) {
      raceStore.setRoomId(roomId);
    }
  }, [roomId]);
  
  // Track player position for checkpoint detection
  useEffect(() => {
    if (myId && players && players[myId]) {
      // Update window.gameState for position tracking by the useRace store
      window.gameState = window.gameState || {};
      window.gameState.playerPosition = players[myId].position;
      
      // Update the race store with current position for checkpoint detection
      if (raceStore.raceState === 'running' && players[myId].position) {
        raceStore.trackPlayerPosition(players[myId].position);
      }
    }
  }, [myId, players, raceStore.raceState]);
  
  return (
    <group>
      <StartLine />
      <Checkpoints />
      {/* Using RaceJoinZone for join zone functionality */}
      <RaceJoinZone roomId={roomId} />
    </group>
  );
}

// Only export the 3D parts that go inside Canvas
const RaceBuilder = {
  In3D: RaceBuilder3D
};

export default RaceBuilder;
