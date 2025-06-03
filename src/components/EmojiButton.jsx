import React, { useState } from 'react';
import { useMultiplayer } from './MultiplayerProvider';

const EMOJI_OPTIONS = ['👍', '👎', '😂', '🎉', '👋', '💯'];

export default function EmojiButton() {
  const { sendEmoji } = useMultiplayer();
  const [menuOpen, setMenuOpen] = useState(false);
  const [cooldown, setCooldown] = useState(false);

  const handleButtonClick = (e) => {
    // Remove focus to prevent spacebar from toggling the button
    e.currentTarget.blur();
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
          fontSize: '16px',
          padding: '8px 12px',
          borderRadius: '5px',
          background: cooldown ? '#ccc' : '#fff',
          cursor: cooldown ? 'not-allowed' : 'pointer',
          border: '1px solid #888',
          boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '36px',
          minWidth: '44px',
        }}
        aria-label="Open emoji menu"
      >
        {cooldown ? '⏳' : '😊'}
      </button>
      {menuOpen && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            right: '0',
            marginTop: '8px',
            display: 'flex',
            background: '#fff',
            padding: '8px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
            borderRadius: '8px',
            zIndex: 1001,
          }}
        >
          {EMOJI_OPTIONS.map(e => (
            <button
              key={e}
              onClick={() => handleSelect(e)}
              style={{
                fontSize: '20px',
                margin: '2px',
                padding: '4px',
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                borderRadius: '4px',
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