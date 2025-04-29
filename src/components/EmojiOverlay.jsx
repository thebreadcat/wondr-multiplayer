import React from 'react';
import { useMultiplayer } from './MultiplayerProvider';
import EmojiButton from './EmojiButton';

export default function EmojiOverlay() {
  const { sendEmoji } = useMultiplayer(); // <-- use the already existing context!

  return (
    <div style={{ position: 'fixed', bottom: 20, left: 20, zIndex: 1000 }}>
      <EmojiButton sendEmoji={sendEmoji} />
    </div>
  );
}
