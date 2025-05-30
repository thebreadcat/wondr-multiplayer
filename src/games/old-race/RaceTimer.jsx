// RaceTimer.jsx - Timer display for race system
import React from 'react';
import { useRace } from './useRace';

export default function RaceTimer() {
  const { raceState, raceTime } = useRace();
  
  // Only show timer when race is running
  if (raceState !== 'running') return null;
  
  // Format time as MM:SS
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };
  
  return (
    <div style={{
      position: 'fixed',
      top: '20px',
      left: '50%',
      transform: 'translateX(-50%)',
      backgroundColor: 'rgba(0, 0, 0, 0.8)',
      color: 'white',
      padding: '10px 20px',
      borderRadius: '8px',
      fontSize: '24px',
      fontWeight: 'bold',
      zIndex: 1000,
      boxShadow: '0 4px 8px rgba(0, 0, 0, 0.5)'
    }}>
      {formatTime(raceTime)}
    </div>
  );
}
