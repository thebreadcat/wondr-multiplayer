import React, { useState, useEffect } from 'react';
import { useCameraStore } from './CameraToggleButton';
import EditModePanel from './EditModePanel';
import AddObjectModal from './AddObjectModal';
import AddObjectButton from './AddObjectButton';
import * as THREE from 'three';

const EditModeManager = () => {
  const { isEditMode } = useCameraStore();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [playerPosition, setPlayerPosition] = useState([0, 0, 0]);
  const [playerRotation, setPlayerRotation] = useState(0);

  // Track player position and rotation
  useEffect(() => {
    const updatePlayerData = () => {
      // Get player position from window.characterController or similar global reference
      if (window.characterController && window.characterController.getPosition) {
        const pos = window.characterController.getPosition();
        setPlayerPosition(pos);
        
        // Get player rotation if available
        if (window.characterController.getRotation) {
          const rot = window.characterController.getRotation();
          setPlayerRotation(rot);
        } else if (window.characterController.rotation !== undefined) {
          setPlayerRotation(window.characterController.rotation);
        }
      } else if (window.localPlayerPosition) {
        // Fallback to global position if available
        setPlayerPosition(window.localPlayerPosition);
      }
    };

    // Update immediately
    updatePlayerData();

    // Set up interval to track player data
    const interval = setInterval(updatePlayerData, 100);
    return () => clearInterval(interval);
  }, []);

  const handleOpenModal = () => {
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
  };

  const handleAddObject = (objectType) => {
    // Get current player position and calculate position in front of player
    const currentPlayerPosition = window.characterController?.getPosition() || playerPosition;
    
    // Calculate position in front of player (2 units forward)
    // Use a simple forward calculation based on current rotation
    const offsetDistance = 2.5;
    const frontPosition = [
      currentPlayerPosition[0] - Math.sin(playerRotation) * offsetDistance,
      currentPlayerPosition[1], // Same height as player
      currentPlayerPosition[2] - Math.cos(playerRotation) * offsetDistance
    ];
    
    // Add object
    if (window.objectManager) {
      window.objectManager.addObject(objectType, frontPosition);
    }
  };

  // Only render if edit mode is active
  if (!isEditMode) return null;

  return (
    <>
      {/* Right side panel showing existing objects */}
      <EditModePanel />
      
      {/* Circular + button at bottom center */}
      <AddObjectButton onClick={handleOpenModal} />
      
      {/* Modal for adding new objects */}
      <AddObjectModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        onAddObject={handleAddObject}
        playerPosition={playerPosition}
      />
    </>
  );
};

export default EditModeManager; 