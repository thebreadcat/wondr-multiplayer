import React, { useState, useEffect, useMemo, useRef } from "react";
import { KeyboardControls } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { Experience } from "./components/Experience";
import CustomizeButton from './components/CustomizeButton';
import CharacterCreator from './components/CharacterCreator';
import EmojiOverlay from './components/EmojiOverlay';
import { MultiplayerProvider } from './components/MultiplayerProvider';
import { GameSystemProvider } from './components/GameSystemProvider';
import EmojiButton from './components/EmojiButton';
import { PlayerList } from './components/PlayerList';
import { StatsMonitor } from './components/StatsMonitor';
import { GameTimerDemo } from './components/GameTimer';

const keyboardMap = [
  { name: "forward", keys: ["ArrowUp", "KeyW"] },
  { name: "backward", keys: ["ArrowDown", "KeyS"] },
  { name: "left", keys: ["ArrowLeft", "KeyA"] },
  { name: "right", keys: ["ArrowRight", "KeyD"] },
  { name: "run", keys: ["Shift"] },
  { name: "jump", keys: ["Space"] },
];

const COLORS = [
  '#FF0000', '#FF7F00', '#FFFF00', '#7FFF00',
  '#00FF00', '#00FF7F', '#00FFFF', '#007FFF',
  '#0000FF', '#7F00FF', '#FF00FF', '#FF007F',
  '#803300', '#336633', '#333380', '#808080',
];

function App() {
  function getCookie(name) {
    const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
    return match ? decodeURIComponent(match[2]) : null;
  }

  function setCookie(name, value) {
    document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=31536000`;
  }

  function getRandomColor() {
    return COLORS[Math.floor(Math.random() * COLORS.length)];
  }

  const [showCreator, setShowCreator] = useState(false);
  const [characterColor, setCharacterColor] = useState(getRandomColor());

  useEffect(() => {
    const cookieColor = getCookie('characterColor');
    if (cookieColor) {
      setCharacterColor(cookieColor);
    } else {
      const randomColor = getRandomColor();
      setCharacterColor(randomColor);
      setCookie('characterColor', randomColor);
    }
  }, []);

  function handleSaveColor(color) {
    setCharacterColor(color);
    setCookie('characterColor', color);
    setShowCreator(false);
  }

  function handleCancel() {
    setShowCreator(false);
  }

  const canvasConfig = useMemo(() => ({
    gl: {
      powerPreference: "high-performance",
      antialias: true,
      stencil: false,
      depth: true
    },
    dpr: Math.min(window.devicePixelRatio, 2),
    flat: true,
    frameloop: 'demand',
  }), []);

  return (
    <MultiplayerProvider characterColor={characterColor} position={[0, 2, 0]}>
      <GameSystemProvider>
        <KeyboardControls map={keyboardMap}>
          <Canvas
            shadows
            camera={{ position: [3, 3, 3], near: 0.1, fov: 40 }}
            style={{ touchAction: "none" }}
            {...canvasConfig}
          >
            <color attach="background" args={["#ececec"]} />
            <Experience characterColor={characterColor} />
          </Canvas>
        </KeyboardControls>
        <GameTimerDemo />
        <div style={{ position: 'fixed', top: 20, right: 20, zIndex: 1000 }}>
          <CustomizeButton onClick={() => setShowCreator(true)} />
        </div>
        <div style={{ position: 'fixed', bottom: 20, left: 20, zIndex: 1000 }}>
          <EmojiButton />
        </div>
        <div style={{ position: 'fixed', bottom: 20, right: 20, zIndex: 1000 }}>
          <PlayerList />
        </div>
        <StatsMonitor />
        {showCreator && (
          <CharacterCreator
            initialColor={characterColor}
            onSave={handleSaveColor}
            onCancel={handleCancel}
          />
        )}
      </GameSystemProvider>
    </MultiplayerProvider>
  );
}

export default App;
