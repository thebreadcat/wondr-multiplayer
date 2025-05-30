import React, { useState, useEffect } from "react";
import { useRaceBuilderStore } from "../raceBuilderStore";
import { useMultiplayer } from "../../../components/MultiplayerProvider";

export default function RaceBuilderUI() {
  const { startLine, checkpoints, setStartLine, addCheckpoint, undoCheckpoint, reset } = useRaceBuilderStore();
  const { myId, players } = useMultiplayer();
  const [currentPosition, setCurrentPosition] = useState([0, 0, 0]);
  
  // Update current position from players object
  useEffect(() => {
    if (players && players[myId] && players[myId].position) {
      setCurrentPosition(players[myId].position);
    }
  }, [players, myId]);

  const handleAddStart = () => setStartLine([...currentPosition]);
  const handleAddCheckpoint = () => addCheckpoint([...currentPosition]);
  const handleUndo = () => undoCheckpoint();

  const handleDone = () => {
    const raceData = {
      roomId: `race_${Date.now()}`,
      startLine,
      checkpoints
    };
    console.log('🏁 Sending race build data:', raceData);
    window.gameSocket.emit("race:build", raceData);
    
    // Show confirmation to user
    alert('Race saved! Join the race by entering the blue cylinder.');
    reset(); // Reset builder state
  };

  return (
    <div style={{ position: 'fixed', top: 80, left: 20, zIndex: 1000, display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <button 
        onClick={handleAddStart}
        style={{
          ...buttonStyle,
          opacity: startLine ? 0.5 : 1,
          cursor: startLine ? 'not-allowed' : 'pointer'
        }}
        disabled={!!startLine}
      >
        📍 {startLine ? 'Starting Line Added' : 'Add Starting Line'}
      </button>
      <button 
        onClick={handleAddCheckpoint}
        style={buttonStyle}
      >
        🏁 Add Checkpoint
      </button>
      <button 
        onClick={handleUndo}
        style={{...buttonStyle, backgroundColor: '#e74c3c'}}
      >
        ↩️ Undo
      </button>
      <button 
        onClick={handleDone}
        style={{...buttonStyle, backgroundColor: '#2ecc71'}}
      >
        ✅ Save Race
      </button>
    </div>
  );
}

const buttonStyle = {
  padding: '10px 16px',
  backgroundColor: '#3498db',
  color: 'white',
  border: 'none',
  borderRadius: '5px',
  cursor: 'pointer',
  fontWeight: 'bold',
  fontSize: '14px',
  width: '180px'
};
