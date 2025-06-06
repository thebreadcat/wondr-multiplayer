import React, { useState, useEffect } from 'react';
import { useCameraStore } from './CameraToggleButton';
import EditModePanel from './EditModePanel';
import AddObjectModal from './AddObjectModal';
import AddObjectButton from './AddObjectButton';

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

  const handleAddObject = (objectType, position) => {
    if (window.objectManager) {
      // Calculate position in front of player to avoid getting trapped
      const offsetDistance = 2.5; // Distance in front of player
      const frontPosition = [
        playerPosition[0] - Math.sin(playerRotation) * offsetDistance,
        playerPosition[1], // Same height as player
        playerPosition[2] - Math.cos(playerRotation) * offsetDistance
      ];
      
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