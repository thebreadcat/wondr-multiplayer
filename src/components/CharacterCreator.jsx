import React, { useEffect, useState } from 'react';

const COLORS = [
  '#FF0000', '#FF7F00', '#FFFF00', '#7FFF00',
  '#00FF00', '#00FF7F', '#00FFFF', '#007FFF',
  '#0000FF', '#7F00FF', '#FF00FF', '#FF007F',
  '#803300', '#336633', '#333380', '#808080',
];

export default function CharacterCreator({ initialColor, onSave, onCancel }) {
  const [color, setColor] = useState(initialColor || COLORS[0]);

  // Save color to cookie on change
  useEffect(() => {
    document.cookie = `characterColor=${color}; path=/; max-age=31536000`;
  }, [color]);

  function handleColorPick(c) {
    setColor(c);
    onSave(c);
  }

  return (
    <div style={{
      position: 'fixed',
      top: 80,
      right: 20,
      background: 'white',
      border: '1px solid #ccc',
      borderRadius: 8,
      padding: 20,
      zIndex: 2000,
      boxShadow: '0 2px 12px rgba(0,0,0,0.15)',
      minWidth: 160
    }}>
      <h3 style={{marginTop:0}}>Pick a Color</h3>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 16 }}>
        {COLORS.map(c => (
          <button
            key={c}
            onClick={() => handleColorPick(c)}
            style={{
              background: c,
              width: 32,
              height: 32,
              border: color === c ? '3px solid #333' : '1px solid #aaa',
              borderRadius: '50%',
              cursor: 'pointer',
              outline: 'none',
            }}
            aria-label={`Pick color ${c}`}
          />
        ))}
      </div>
      <button onClick={onCancel} style={{marginTop:8}}>Cancel</button>
    </div>
  );
}
