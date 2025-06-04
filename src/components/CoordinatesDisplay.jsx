import React, { useState, useEffect } from 'react';
import { useMultiplayer } from './MultiplayerProvider';

export function CoordinatesDisplay() {
  const { players, myId } = useMultiplayer();
  const [coordinates, setCoordinates] = useState({ x: 0, y: 0, z: 0 });
  
  useEffect(() => {
    // Update coordinates when player position changes
    const myPlayer = players[myId];
    if (myPlayer && myPlayer.position) {
      const [x, y, z] = myPlayer.position;
      setCoordinates({
        x: Math.round(x * 100) / 100, // Round to 2 decimal places
        y: Math.round(y * 100) / 100,
        z: Math.round(z * 100) / 100
      });
    }
  }, [players, myId]);

  const containerStyle = {
    position: 'absolute',
    top: '48px', // Position under the FPS tracker (which is typically 48px tall)
    left: '0px',
    zIndex: '1000',
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    color: '#00ff00',
    fontFamily: 'monospace',
    fontSize: '11px',
    padding: '4px 8px',
    borderRadius: '0 0 4px 0',
    border: '1px solid rgba(0, 255, 0, 0.3)',
    minWidth: '120px',
    userSelect: 'text', // Allow text selection for copying coordinates
    cursor: 'text'
  };

  const labelStyle = {
    color: '#ffffff',
    fontSize: '10px',
    marginBottom: '2px'
  };

  const coordStyle = {
    display: 'flex',
    justifyContent: 'space-between',
    gap: '8px'
  };

  const axisStyle = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    minWidth: '30px'
  };

  const axisLabelStyle = {
    fontSize: '9px',
    color: '#cccccc',
    marginBottom: '1px'
  };

  const valueStyle = {
    fontSize: '11px',
    fontWeight: 'bold'
  };

  return (
    <div style={containerStyle}>
      <div style={labelStyle}>COORDINATES</div>
      <div style={coordStyle}>
        <div style={axisStyle}>
          <div style={axisLabelStyle}>X</div>
          <div style={valueStyle}>{coordinates.x}</div>
        </div>
        <div style={axisStyle}>
          <div style={axisLabelStyle}>Y</div>
          <div style={valueStyle}>{coordinates.y}</div>
        </div>
        <div style={axisStyle}>
          <div style={axisLabelStyle}>Z</div>
          <div style={valueStyle}>{coordinates.z}</div>
        </div>
      </div>
    </div>
  );
} 