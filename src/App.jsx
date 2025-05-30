import React, { useState, useEffect, useMemo, useRef } from "react";
import { KeyboardControls } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { Experience } from "./components/Experience";
import CustomizeButton from './components/CustomizeButton';
import CharacterCreator from './components/CharacterCreator';
import EmojiButton from "./components/EmojiButton";
import CameraToggleButton from "./components/CameraToggleButton";
import { MultiplayerProvider } from './components/MultiplayerProvider';
import { GameSystemProvider } from './components/GameSystemProvider';
import { PlayerList } from './components/PlayerList';
import { StatsMonitor } from './components/StatsMonitor';
import { RaceGame3D, RaceGameUI } from './games/race';
import RaceHUD from './games/race/RaceHUD';
import TagGameOverlay from './games/tag/TagGameOverlay';
import PhoneMenu, { PhoneMenuButton } from './components/PhoneMenu';

// Using simpler approach without 3D context provider

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
  // Extract roomId from URL or use default
  const [roomId, setRoomId] = useState(() => {
    // Try to get roomId from URL path
    const pathSegments = window.location.pathname.split('/');
    const roomFromPath = pathSegments.length > 1 && pathSegments[1] ? pathSegments[1] : null;
    
    // Use roomId from URL or default to "main-room"
    const defaultRoomId = "main-room";
    const effectiveRoomId = roomFromPath || defaultRoomId;
    
    // Set a global shared room ID for all components to access
    window.sharedRoomId = effectiveRoomId;
    
    console.log(`[App] Using roomId: ${effectiveRoomId}${roomFromPath ? ' (from URL)' : ' (default)'}`); 
    console.log(`[App] Set global window.sharedRoomId = ${window.sharedRoomId}`);
    
    return effectiveRoomId;
  });
  
  // --- Race Game state ---
  const [showRaceGame, setShowRaceGame] = useState(false);
  const [raceRoomId] = useState(() => roomId);
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
  const [showEmojiOverlay, setShowEmojiOverlay] = useState(false);
  const [showRaceBuilder, setShowRaceBuilder] = useState(false);
  const [showThirdPerson, setShowThirdPerson] = useState(false);
  const [showPhoneMenu, setShowPhoneMenu] = useState(false);
  const [showSkateboard, setShowSkateboard] = useState(false);
  
  // Race socket handlers are now managed by the RaceSocketListeners component
  
  // Notification system is now handled by the race components directly

  // Create a global function to hide the race builder panel that can be accessed from the race system
  useEffect(() => {
    window.hideRaceBuilderPanel = () => setShowRaceBuilder(false);
    return () => {
      delete window.hideRaceBuilderPanel;
    };
  }, []);

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
            <Experience 
              characterColor={characterColor} 
              showRaceGame={showRaceGame} 
              raceRoomId={raceRoomId} 
              showSkateboard={showSkateboard}
            />
            
            {/* Race Builder 3D Elements */}
            {showRaceBuilder && <RaceGame3D roomId={raceRoomId} />}
            
            {/* Race Game 3D Elements are now rendered inside Experience (inside Physics) */}
          </Canvas>
          
          {/* Race Builder UI Components - These must be outside the Canvas */}
          {showRaceBuilder && <RaceBuilderUI />}
          
          {/* Race HUD - Shows race timer and other race UI elements */}
          <RaceHUD />
        </KeyboardControls>
        <div style={{ position: 'fixed', top: 20, right: 20, zIndex: 1000, display: 'flex', gap: 8 }}>
          <PhoneMenuButton onClick={() => setShowPhoneMenu(true)} />
        </div>
        
        {/* Phone Menu */}
        {showPhoneMenu && (
          <PhoneMenu 
            isOpen={showPhoneMenu} 
            onClose={() => setShowPhoneMenu(false)} 
            onCustomizeClick={() => setShowCreator(true)}
            onToggleSkateboard={() => setShowSkateboard(prev => !prev)}
            showSkateboard={showSkateboard}
          />
        )}
        <div style={{ position: 'fixed', top: 20, right: 160, zIndex: 1000, display: 'flex', gap: 8 }}>
          <button
            style={{
              padding: '10px 16px',
              backgroundColor: showRaceGame ? '#e67e22' : '#2980b9',
              color: 'white',
              border: 'none',
              borderRadius: '5px',
              cursor: 'pointer',
              fontWeight: 'bold',
              fontSize: '14px',
              marginLeft: 8
            }}
            onClick={(e) => {
              setShowRaceGame((v) => !v);
              e.currentTarget.blur(); // Remove focus after clicking to prevent spacebar toggling
            }}
          >
            {showRaceGame ? 'Close Race Game' : 'Race Game'}
          </button>
          {/* RaceGameUI overlays/listeners outside Canvas */}
          {showRaceGame && <RaceGameUI />}
        </div>
        <div style={{ position: 'fixed', bottom: 20, left: 20, zIndex: 1000 }}>
          <EmojiButton />
        </div>
        <CameraToggleButton />
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
