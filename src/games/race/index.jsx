import React, { useState } from "react";
import { RaceSocketListeners } from "./listeners";
import RaceHUD from "./RaceHUD";
import RaceManager from "./RaceManager";
import { CheckpointField } from "./components/CheckpointField";
import StartLine from "./components/StartLine";
import JoinArea from "./components/JoinArea";
import RaceBuilderUI from "./components/RaceBuilderUI";
import RaceBuilder3D from "./components/RaceBuilder3d";

// 3D/gameplay elements for use INSIDE <Canvas>
// Using React.memo to prevent unnecessary re-renders
export const RaceGame3D = React.memo(function RaceGame3D({ roomId = "race-1" }) {
  // Only log on first render using useRef
  const isFirstRender = React.useRef(true);
  
  React.useEffect(() => {
    if (isFirstRender.current) {
      console.log('[RaceGame3D] Initializing with roomId:', roomId);
      isFirstRender.current = false;
    }
  }, [roomId]);
  
  return (
    <>
      <RaceManager roomId={roomId} />
      <StartLine />
      <CheckpointField />
      <JoinArea />
      <RaceBuilder3D />
    </>
  );
});

// UI/listener elements for use OUTSIDE <Canvas>
export function RaceGameUI() {
  const [showBuilder, setShowBuilder] = useState(false);

  return (
    <>
      <RaceSocketListeners />
      <RaceHUD />
      
      {/* Race Builder UI toggle button */}
      <div style={{ position: 'fixed', top: 20, left: 20, zIndex: 1000 }}>
        <button 
          onClick={(e) => {
            setShowBuilder(prev => !prev);
            e.currentTarget.blur(); // Remove focus
          }}
          style={{
            padding: '10px 16px',
            backgroundColor: showBuilder ? '#e74c3c' : '#3498db',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            cursor: 'pointer',
            fontWeight: 'bold',
            fontSize: '14px'
          }}
        >
          {showBuilder ? 'Hide Builder' : 'Create Race'}
        </button>
      </div>
      
      {/* Show builder UI when toggled */}
      {showBuilder && <RaceBuilderUI />}
    </>
  );
}

// Optional: wrapper for both (not required, but for convenience)
export default function RaceGame({ roomId }) {
  return (
    <>
      <RaceGameUI />
      <RaceGame3D roomId={roomId} />
    </>
  );
}
