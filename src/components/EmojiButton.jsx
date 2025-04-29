import React, { useState } from 'react';
import { useMultiplayer } from './MultiplayerProvider';

const EMOJI_OPTIONS = ['👍', '👎', '😂', '🎉', '👋', '💯'];

export default function EmojiButton() {
  const { sendEmoji } = useMultiplayer();
  const [menuOpen, setMenuOpen] = useState(false);
  const [cooldown, setCooldown] = useState(false);

  const handleButtonClick = () => {
    if (!cooldown) setMenuOpen(open => !open);
  };

  const handleSelect = (emoji) => {
    sendEmoji(emoji);
    setMenuOpen(false);
    setCooldown(true);
    setTimeout(() => setCooldown(false), 5000);
  };

  return (
    <div>
      <button
        onClick={handleButtonClick}
        disabled={cooldown}
        style={{
          fontSize: '24px',
          padding: '10px',
          borderRadius: '8px',
          background: cooldown ? '#ccc' : '#fff',
          cursor: cooldown ? 'not-allowed' : 'pointer',
          border: '1px solid #888',
        }}
        aria-label="Open emoji menu"
      >
        {cooldown ? '⏳' : '😊'}
      </button>
      {menuOpen && (
        <div
          style={{
            display: 'flex',
            marginTop: '8px',
            background: '#fff',
            padding: '8px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
            borderRadius: '8px',
          }}
        >
          {EMOJI_OPTIONS.map(e => (
            <button
              key={e}
              onClick={() => handleSelect(e)}
              style={{
                fontSize: '24px',
                margin: '4px',
                padding: '4px',
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
              }}
              aria-label={`Send emoji ${e}`}
            >
              {e}
            </button>
          ))}
        </div>
      )}
    </div>
  );
} 