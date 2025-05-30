import React, { useState } from "react";
import { RaceGame3D, RaceGameUI } from "./index";

export default function RaceGameButton() {
  const [showRace, setShowRace] = useState(false);
  const [roomId] = useState(() => `race_room_${Date.now()}`);
  return (
    <>
      <button
        style={{
          padding: '10px 16px',
          backgroundColor: showRace ? '#e67e22' : '#2980b9',
          color: 'white',
          border: 'none',
          borderRadius: '5px',
          cursor: 'pointer',
          fontWeight: 'bold',
          fontSize: '14px',
          marginLeft: 8
        }}
        onClick={() => setShowRace((v) => !v)}
      >
        {showRace ? 'Close Race Game' : 'Race Game'}
      </button>
      {/* UI overlays and listeners (outside Canvas) */}
      {showRace && <RaceGameUI />}
      {/* 3D elements must be rendered inside Canvas by the parent! */}
      {/* See App.jsx for integration instructions */}
    </>
  );
}
