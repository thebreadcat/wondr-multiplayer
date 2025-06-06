import React, { useState, useEffect } from 'react';
import { create } from 'zustand';

// Create a store for camera state that can be accessed globally
export const useCameraStore = create((set) => ({
  isFirstPerson: false,
  setFirstPerson: (value) => set({ isFirstPerson: value }),
  toggleView: () => set((state) => ({ isFirstPerson: !state.isFirstPerson })),
  
  // Edit mode state
  isEditMode: false,
  setEditMode: (value) => set({ isEditMode: value }),
  toggleEditMode: () => set((state) => ({ isEditMode: !state.isEditMode }))
}));

export default function CameraToggleButton() {
  const { isFirstPerson, toggleView } = useCameraStore();
  const [animating, setAnimating] = useState(false);

  const handleToggle = (e) => {
    // Remove focus to prevent spacebar from toggling the button
    e.currentTarget.blur();
    setAnimating(true);
    toggleView();
    
    // Reset animation state after transition
    setTimeout(() => setAnimating(false), 300);
  };

  return (
    <button
      onClick={handleToggle}
      disabled={animating}
      style={{
        fontSize: '16px',
        padding: '8px 12px',
        borderRadius: '5px',
        background: '#fff',
        cursor: animating ? 'not-allowed' : 'pointer',
        border: '1px solid #888',
        boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'transform 0.2s ease',
        transform: animating ? 'scale(0.95)' : 'scale(1)',
        height: '36px',
        minWidth: '70px',
      }}
      aria-label={isFirstPerson ? "Switch to third person view" : "Switch to first person view"}
      title={isFirstPerson ? "Switch to third person view" : "Switch to first person view"}
    >
      {isFirstPerson ? '👁️ 1st' : '🎮 3rd'}
    </button>
  );
}
