import React from 'react';
import { useMultiplayer } from './MultiplayerProvider';

export function PlayerList() {
  const { players, myId } = useMultiplayer();

  return (
    <div style={{
      position: 'fixed',
      top: 20,
      right: 20,
      background: 'rgba(0, 0, 0, 0.7)',
      padding: '15px',
      borderRadius: '8px',
      color: 'white',
      fontFamily: 'Arial, sans-serif',
      minWidth: '200px',
      zIndex: 1000
    }}>
      <h3 style={{ 
        margin: '0 0 10px 0',
        fontSize: '16px',
        borderBottom: '1px solid rgba(255, 255, 255, 0.3)',
        paddingBottom: '5px'
      }}>
        Connected Players
      </h3>
      <ul style={{
        margin: 0,
        padding: 0,
        listStyle: 'none'
      }}>
        {Object.entries(players).map(([id, player]) => (
          <li key={id} style={{
            padding: '4px 0',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <div style={{
              width: '12px',
              height: '12px',
              borderRadius: '50%',
              backgroundColor: player.color || '#ffffff',
              border: '1px solid rgba(255, 255, 255, 0.3)'
            }} />
            <span style={{
              opacity: id === myId ? 1 : 0.7
            }}>
              {id === myId ? 'You' : `Player ${id.slice(0, 4)}`}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
} 