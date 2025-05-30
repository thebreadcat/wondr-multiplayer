// src/components/RaceInterface.jsx
// Component for accessing race creation and management

import React, { useState } from 'react';
import { Html } from '@react-three/drei';
import { RaceManagement } from '../games/race/RaceManagement';
import { RaceEditor } from '../games/race/RaceEditor';
import { useMultiplayer } from './MultiplayerProvider';
import { getSocket } from '../utils/socketManager';
import RaceCreatorButton from './RaceCreatorButton';

export function RaceInterface() {
  const [showRaceUI, setShowRaceUI] = useState(false);
  const [editorMode, setEditorMode] = useState(false);
  const [selectedRaceId, setSelectedRaceId] = useState(null);
  const { myId } = useMultiplayer();
  const socket = getSocket();

  // Handle creating a new race
  const handleCreateRace = () => {
    setEditorMode(true);
    setShowRaceUI(false);
  };

  // Handle joining an existing race
  const handleJoinRace = (roomId, race) => {
    if (!roomId || !race) return;
    
    // Join the race room
    socket.emit('joinGameRoom', {
      roomId,
      gameType: 'race',
      playerId: myId,
    });
    
    // Close the race UI
    setShowRaceUI(false);
    setSelectedRaceId(null);
  };

  // Handle editor completion
  const handleEditorComplete = (saved, raceData) => {
    setEditorMode(false);
    
    if (saved && raceData) {
      // Optionally join the newly created race
      if (confirm('Race saved! Would you like to try it now?')) {
        const roomId = `race_${Date.now()}`;
        
        // Create a new race room
        socket.emit('createGameRoom', {
          gameType: 'race',
          roomId,
          hostId: myId,
          raceId: raceData.id,
        }, (response) => {
          if (response.success) {
            // Join the race room
            socket.emit('joinGameRoom', {
              roomId,
              gameType: 'race',
              playerId: myId,
            });
          } else {
            console.error('Failed to create race room:', response.error);
          }
        });
      }
    }
  };

  // Button to toggle race UI
  const toggleRaceUI = () => {
    setShowRaceUI(!showRaceUI);
    setEditorMode(false);
  };

  return (
    <>
      {/* Button to open race management (positioned in UI overlay) */}
      <RaceCreatorButton onClick={toggleRaceUI} />

      {/* Race management UI */}
      {showRaceUI && (
        <Html fullscreen>
          <div style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            backgroundColor: 'white',
            padding: '20px',
            borderRadius: '10px',
            boxShadow: '0 4px 8px rgba(0,0,0,0.2)',
            maxWidth: '80vw',
            maxHeight: '80vh',
            overflow: 'auto',
            zIndex: 1000
          }}>
            <RaceManagement
              onJoinRace={handleJoinRace}
              onCreateRace={handleCreateRace}
            />
            <button
              onClick={() => setShowRaceUI(false)}
              style={{
                padding: '8px 15px',
                backgroundColor: '#e74c3c',
                color: 'white',
                border: 'none',
                borderRadius: '5px',
                cursor: 'pointer',
                marginTop: '15px'
              }}
            >
              Close
            </button>
          </div>
        </Html>
      )}

      {/* Race editor */}
      {editorMode && (
        <RaceEditor
          active={true}
          onComplete={handleEditorComplete}
          raceId={selectedRaceId}
        />
      )}
    </>
  );
}
