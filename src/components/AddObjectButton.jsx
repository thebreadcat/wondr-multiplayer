import React from 'react';
import { FaPlus } from 'react-icons/fa';
import { useCameraStore } from './CameraToggleButton';

const AddObjectButton = ({ onClick }) => {
  const { isEditMode } = useCameraStore();

  if (!isEditMode) return null;

  const handleClick = (e) => {
    // Remove focus to prevent keyboard interactions and stuck states
    e.target.blur();
    
    // Call the original onClick handler
    if (onClick) {
      onClick(e);
    }
  };

  return (
    <button
      onClick={handleClick}
      style={{
        position: 'fixed',
        bottom: '30px',
        left: '50%',
        transform: 'translateX(-50%)',
        width: '60px',
        height: '60px',
        borderRadius: '50%',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        border: '2px solid rgba(255, 255, 255, 0.3)',
        color: 'white',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '24px',
        zIndex: 1500,
        boxShadow: '0 8px 25px rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(255, 255, 255, 0.1)',
        transition: 'all 0.3s ease',
        backdropFilter: 'blur(10px)',
        outline: 'none'
      }}
      onMouseEnter={(e) => {
        e.target.style.transform = 'translateX(-50%) scale(1.1)';
        e.target.style.boxShadow = '0 12px 35px rgba(0, 0, 0, 0.4), 0 0 0 2px rgba(255, 255, 255, 0.2)';
        e.target.style.background = 'linear-gradient(135deg, #7c8ff0 0%, #8a5cb8 100%)';
      }}
      onMouseLeave={(e) => {
        e.target.style.transform = 'translateX(-50%) scale(1)';
        e.target.style.boxShadow = '0 8px 25px rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(255, 255, 255, 0.1)';
        e.target.style.background = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
      }}
      onMouseDown={(e) => {
        e.target.style.transform = 'translateX(-50%) scale(0.95)';
      }}
      onMouseUp={(e) => {
        e.target.style.transform = 'translateX(-50%) scale(1.1)';
      }}
      title="Add New Object"
      aria-label="Add New Object"
    >
      <FaPlus />
    </button>
  );
};

export default AddObjectButton; 