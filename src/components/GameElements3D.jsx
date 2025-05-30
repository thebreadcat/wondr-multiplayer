// Wrapper component for all 3D game elements
import React, { useRef, useEffect } from 'react';
import { useGameSystem } from "./GameSystemProvider";
import TagGame3D from '../games/tag/TagGame3D';
import { RaceGame3D } from '../games/race';

// Using React.memo to prevent unnecessary re-renders
const GameElements3D = React.memo(function GameElements3D() {
  const { activeGames, playerGameStatus } = useGameSystem();
  const isFirstRender = useRef(true);
  
  // Only log on first render
  useEffect(() => {
    if (isFirstRender.current) {
      console.log('[GameElements3D] Rendering join zone for tag, active:', !!activeGames?.tag);
      isFirstRender.current = false;
    }
  }, [activeGames?.tag]);
  
  return (
    <>
      {/* Display tag game elements */}
      <TagGame3D />
      
      {/* We're now using the RaceGame3D component directly in Experience.jsx */}
    </>
  );
});

export default GameElements3D;
