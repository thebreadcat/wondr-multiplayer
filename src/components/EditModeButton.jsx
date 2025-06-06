import React, { useState, useEffect } from 'react';
import { useCameraStore } from './CameraToggleButton';

export function EditModeButton() {
  const { isEditMode, toggleEditMode } = useCameraStore();

  const handleToggle = (e) => {
    e.currentTarget.blur();
    toggleEditMode();
    
    // Exit pointer lock when entering edit mode
    if (!isEditMode && document.pointerLockElement) {
      if (document.exitPointerLock) {
        document.exitPointerLock();
      }
    }
  };

  return (
    <button
      onClick={handleToggle}
      style={{
        fontSize: '16px',
        padding: '8px 12px',
        borderRadius: '5px',
        background: isEditMode ? '#e74c3c' : '#2ecc71',
        color: 'white',
        cursor: 'pointer',
        border: 'none',
        boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '36px',
        minWidth: '44px',
        fontWeight: 'bold',
        transition: 'all 0.2s ease',
      }}
      title={isEditMode ? 'Exit Edit Mode' : 'Enter Edit Mode'}
      aria-label={isEditMode ? 'Exit Edit Mode' : 'Enter Edit Mode'}
    >
      {isEditMode ? '✏️' : '🔒'}
    </button>
  );
} 