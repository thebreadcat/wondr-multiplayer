import React, { useState, useEffect, useMemo, useRef } from "react";
import { KeyboardControls } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { Experience } from "./components/Experience";
import CustomizeButton from './components/CustomizeButton';
import CharacterCreator from './components/CharacterCreator';
import EmojiOverlay from './components/EmojiOverlay';
import { MultiplayerProvider } from './components/MultiplayerProvider';
import EmojiButton from './components/EmojiButton';
import { PlayerList } from './components/PlayerList';
import { StatsMonitor } from './components/StatsMonitor';

const keyboardMap = [
  { name: "forward", keys: ["ArrowUp", "KeyW"] },
  { name: "backward", keys: ["ArrowDown", "KeyS"] },
  { name: "left", keys: ["ArrowLeft", "KeyA"] },
  { name: "right", keys: ["ArrowRight", "KeyD"] },
  { name: "run", keys: ["Shift"] },
  { name: "jump", keys: ["Space"] },
];

// Import color options from CharacterCreator
const COLORS = [
  '#FF0000', '#FF7F00', '#FFFF00', '#7FFF00',
  '#00FF00', '#00FF7F', '#00FFFF', '#007FFF',
  '#0000FF', '#7F00FF', '#FF00FF', '#FF007F',
  '#803300', '#336633', '#333380', '#808080',
];

function App() {
  // Cookie helpers
  function getCookie(name) {
    const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
    return match ? decodeURIComponent(match[2]) : null;
  }
  
  function setCookie(name, value) {
    document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=31536000`; // 1 year expiry
  }

  // Get a random color from available options
  function getRandomColor() {
    return COLORS[Math.floor(Math.random() * COLORS.length)];
  }

  const [showCreator, setShowCreator] = useState(false);
  const [characterColor, setCharacterColor] = useState(getRandomColor()); // Default to random

  // On mount, read color from cookie or assign random color
  useEffect(() => {
    const cookieColor = getCookie('characterColor');
    
    if (cookieColor) {
      // Use saved color preference
      setCharacterColor(cookieColor);
    } else {
      // Assign and save random color for new users
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

  // Performance optimizations for Canvas
  const canvasConfig = useMemo(() => ({
    gl: {
      powerPreference: "high-performance",
      antialias: true,
      stencil: false,
      depth: true
    },
    dpr: Math.min(window.devicePixelRatio, 2), // Cap pixel ratio for better performance
    flat: true, // Flat framebuffers are more efficient
    frameloop: 'demand', // Only render when needed (saves CPU/GPU)
    // performance: { min: 0.5 } // Drop quality if framerate drops below target
  }), []);
  
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
            {...canvasConfig}
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
        
        {/* Performance monitor - toggle in production */}
        <StatsMonitor />
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