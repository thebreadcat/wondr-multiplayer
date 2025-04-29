import React from 'react';

export default function CustomizeButton({ onClick }) {
    return (
      <button onClick={onClick} style={{
        position: 'absolute',
        top: 20,
        right: 20,
        padding: '10px 20px',
        fontSize: '16px'
      }}>
        Customize Character
      </button>
    );
  }
  