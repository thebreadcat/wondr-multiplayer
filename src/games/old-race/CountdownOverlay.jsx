// CountdownOverlay.jsx - Separate component for race countdown overlay
import React from 'react';
import { useRace } from './useRace';

export default function CountdownOverlay() {
  const { raceState, countdown } = useRace();
  
  if (raceState !== 'countdown') return null;
  
  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      backgroundColor: 'rgba(0, 0, 0, 0.7)',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 1000
    }}>
      <div style={{
        fontSize: '120px',
        fontWeight: 'bold',
        color: 'white',
        textShadow: '0 0 20px rgba(255, 255, 255, 0.5)'
      }}>
        {countdown > 0 ? countdown : 'GO!'}
      </div>
    </div>
  );
}
