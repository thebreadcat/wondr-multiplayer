import React, { useState, useEffect } from "react";
import { KeyboardControls } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { Experience } from "./components/Experience";
import CustomizeButton from './components/CustomizeButton';
import CharacterCreator from './components/CharacterCreator';
import EmojiOverlay from './components/EmojiOverlay';
import { MultiplayerProvider } from './components/MultiplayerProvider';
import EmojiButton from './components/EmojiButton';
import { PlayerList } from './components/PlayerList';

const keyboardMap = [
  { name: "forward", keys: ["ArrowUp", "KeyW"] },
  { name: "backward", keys: ["ArrowDown", "KeyS"] },
  { name: "left", keys: ["ArrowLeft", "KeyA"] },
  { name: "right", keys: ["ArrowRight", "KeyD"] },
  { name: "run", keys: ["Shift"] },
  { name: "jump", keys: ["Space"] },
];

function App() {
  // Cookie helpers
  function getCookie(name) {
    const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
    return match ? decodeURIComponent(match[2]) : null;
  }

  const [showCreator, setShowCreator] = useState(false);
  const [characterColor, setCharacterColor] = useState('#66FF66');

  // On mount, read color from cookie
  useEffect(() => {
    const cookieColor = getCookie('characterColor');
    if (cookieColor) setCharacterColor(cookieColor);
  }, []);

  function handleSaveColor(color) {
    setCharacterColor(color);
    document.cookie = `characterColor=${encodeURIComponent(color)}; path=/; max-age=31536000`;
    setShowCreator(false);
  }

  function handleCancel() {
    setShowCreator(false);
  }

  return (
    <>
      <MultiplayerProvider characterColor={characterColor} position={[0, 2, 0]}>
        <KeyboardControls map={keyboardMap}>
          <Canvas
            shadows
            camera={{ position: [3, 3, 3], near: 0.1, fov: 40 }}
            style={{
              touchAction: "none",
            }}
          >
            <color attach="background" args={["#ececec"]} />
            <Experience characterColor={characterColor} />
          </Canvas>
        </KeyboardControls>
        <div style={{ position: 'fixed', top: 20, right: 20, zIndex: 1000 }}>
          <CustomizeButton onClick={() => setShowCreator(true)} />
        </div>
        <div style={{ position: 'fixed', bottom: 20, left: 20, zIndex: 1000 }}>
          <EmojiButton />
        </div>
        <div style={{ position: 'fixed', bottom: 20, right: 20, zIndex: 1000 }}>
          <PlayerList />
        </div>
        {showCreator && (
          <CharacterCreator
            initialColor={characterColor}
            onSave={handleSaveColor}
            onCancel={handleCancel}
          />
        )}
      </MultiplayerProvider>
    </>
  );
}

export default App;