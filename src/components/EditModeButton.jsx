import React, { useState, useEffect } from 'react';
import { useCameraStore } from './CameraToggleButton';
import { FaEdit, FaStopCircle } from "react-icons/fa";


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
        background: 'transparent',
        color: 'white',
        cursor: 'pointer',
        border: '1px solid rgba(255, 255, 255, 0.2)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '36px',
        minWidth: '44px',
        transition: 'all 0.2s ease',
      }}
      title={isEditMode ? 'Exit Edit Mode' : 'Enter Edit Mode'}
      aria-label={isEditMode ? 'Exit Edit Mode' : 'Enter Edit Mode'}
    >
      {isEditMode ? <FaStopCircle /> : <FaEdit />}
    </button>
  );
} 