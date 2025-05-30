import React, { useState, useEffect } from 'react';
import { create } from 'zustand';

// Create a store for camera state that can be accessed globally
export const useCameraStore = create((set) => ({
  isFirstPerson: false,
  setFirstPerson: (value) => set({ isFirstPerson: value }),
  toggleView: () => set((state) => ({ isFirstPerson: !state.isFirstPerson }))
}));

export default function CameraToggleButton() {
  const { isFirstPerson, toggleView } = useCameraStore();
  const [animating, setAnimating] = useState(false);

  const handleToggle = () => {
    setAnimating(true);
    toggleView();
    
    // Reset animation state after transition
    setTimeout(() => setAnimating(false), 300);
  };

  return (
    <div style={{ position: 'fixed', bottom: 20, right: 20, zIndex: 1000 }}>
      <button
        onClick={handleToggle}
        disabled={animating}
        style={{
          fontSize: '20px',
          padding: '10px',
          borderRadius: '8px',
          background: '#fff',
          cursor: animating ? 'not-allowed' : 'pointer',
          border: '1px solid #888',
          boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'transform 0.2s ease',
          transform: animating ? 'scale(0.95)' : 'scale(1)',
        }}
        aria-label={isFirstPerson ? "Switch to third person view" : "Switch to first person view"}
        title={isFirstPerson ? "Switch to third person view" : "Switch to first person view"}
      >
        {isFirstPerson ? '👁️ 1st Person' : '🎮 3rd Person'}
      </button>
    </div>
  );
}
