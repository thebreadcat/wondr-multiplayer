import React from 'react';
import { useMultiplayer } from './MultiplayerProvider';
import EmojiButton from './EmojiButton';
import { EditModeButton } from './EditModeButton';

export default function EmojiOverlay() {
  const { sendEmoji } = useMultiplayer(); // <-- use the already existing context!

  return (
    <div style={{ 
      position: 'fixed', 
      bottom: 20, 
      left: 20, 
      zIndex: 1000,
      display: 'flex',
      gap: '8px',
      alignItems: 'center'
    }}>
      <EditModeButton />
      <EmojiButton sendEmoji={sendEmoji} />
    </div>
  );
}
