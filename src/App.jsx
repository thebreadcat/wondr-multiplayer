import React, { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { isMobile, VirtualJoystick, MobileButtons } from "./components/MobileControls";
import { KeyboardControls } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { Experience } from "./components/Experience";
import CharacterCreator from './components/CharacterCreator';
import EmojiButton from "./components/EmojiButton";
import { EditModeButton } from "./components/EditModeButton";
import CameraToggleButton from "./components/CameraToggleButton";
import { MultiplayerProvider } from './components/MultiplayerProvider';
import { VoiceChatProvider } from './components/VoiceChatProvider';
import VoiceChatControls from './components/VoiceChatControls';
import { GameSystemProvider } from './components/GameSystemProvider';
import { PlayerList } from './components/PlayerList';
import { StatsMonitor } from './components/StatsMonitor';
import { CoordinatesDisplay } from './components/CoordinatesDisplay';
import { RaceGame3D, RaceGameUI } from './games/race';
import RaceBuilderUI from './games/race/components/RaceBuilderUI';
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
  
  // Idle state management
  const [idle, setIdle] = useState(false);
  const lastActiveTimeRef = useRef(Date.now());
  
  // Mobile controls state
  const isMobileDevice = useMemo(() => isMobile(), []);
  const [mobileRunning, setMobileRunning] = useState(false);
  
  // Mobile control handlers that connect to the CharacterController component
  const handleJoystickMove = useCallback((input) => {
    if (window.mobileControls) {
      window.mobileControls.handleJoystickMove(input);
    }
  }, []);

  const handleCameraMove = useCallback((input) => {
    if (window.mobileControls) {
      window.mobileControls.handleCameraMove(input);
    }
  }, []);

  const handleJump = useCallback((pressed) => {
    if (window.mobileControls) {
      window.mobileControls.handleJump(pressed);
    }
  }, []);

  const handleRunToggle = useCallback(() => {
    if (window.mobileControls) {
      window.mobileControls.handleRunToggle();
      // Update local state to trigger re-render
      setMobileRunning(prev => !prev);
    }
  }, []);
  
  // Race socket handlers are now managed by the RaceSocketListeners component
  
  // Notification system is now handled by the race components directly

  // Create a global function to hide the race builder panel that can be accessed from the race system
  useEffect(() => {
    window.hideRaceBuilderPanel = () => setShowRaceBuilder(false);
    return () => {
      delete window.hideRaceBuilderPanel;
    };
  }, []);

  // Idle state management effects
  useEffect(() => {
    const idleCheck = setInterval(() => {
      const now = Date.now();
      const timeSinceLastActivity = now - lastActiveTimeRef.current;
      
      // Set to idle after 5 minutes of inactivity
      if (timeSinceLastActivity > 5 * 60 * 1000) {
        setIdle(true);
      }
    }, 10000); // Check every 10 seconds

    return () => clearInterval(idleCheck);
  }, []);

  // Reset idle timer on user activity
  useEffect(() => {
    const resetIdleTimer = () => {
      lastActiveTimeRef.current = Date.now();
      setIdle(false);
    };

    // Listen for various user activity events
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];
    events.forEach(event => {
      document.addEventListener(event, resetIdleTimer, true);
    });

    return () => {
      events.forEach(event => {
        document.removeEventListener(event, resetIdleTimer, true);
      });
    };
  }, []);

  const handleReconnect = () => {
    lastActiveTimeRef.current = Date.now();
    setIdle(false);
  };

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
      <VoiceChatProvider>
        <GameSystemProvider>
          <KeyboardControls map={keyboardMap}>
            <Canvas
              shadows
              camera={{ position: [3, 3, 3], near: 0.1, fov: 25 }}
              style={{ touchAction: "none" }}
              {...canvasConfig}
            >
              <color attach="background" args={["#87CEEB"]} />
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
            
            {/* Mobile controls - These must be outside the Canvas */}
            {isMobileDevice ? (
              <>
                <VirtualJoystick onMove={handleJoystickMove} />
                <MobileButtons 
                  onJump={handleJump} 
                  onRun={handleRunToggle} 
                  isRunning={mobileRunning}
                  onCameraMove={handleCameraMove}
                />
              </>
            ) : null}
            
            {/* Race HUD - Shows race timer and other race UI elements */}
            <RaceHUD />
          </KeyboardControls>
          {/* WondR Logo in top left */}
          <a 
            href="https://wondrland.io" 
            target="_blank" 
            rel="noopener noreferrer"
            style={{ 
              position: 'fixed', 
              top: 20, 
              left: 20, 
              zIndex: 1000,
              color: 'white',
              textDecoration: 'none',
              fontWeight: 'bold',
              fontSize: '18px',
              textShadow: '2px 2px 4px rgba(0,0,0,0.5)'
            }}
          >
            WondR
          </a>
          
          {/* Top right controls */}
          <div style={{ 
            position: 'fixed', 
            top: 20, 
            right: 20, 
            zIndex: 1000, 
            display: 'flex', 
            gap: 8, 
            alignItems: 'center',
          }}>
            <EditModeButton />
            <div style={{ position: 'relative' }}>
              <EmojiButton 
                showOverlay={showEmojiOverlay} 
                setShowOverlay={setShowEmojiOverlay} 
              />
            </div>
            <CameraToggleButton 
              showThirdPerson={showThirdPerson} 
              setShowThirdPerson={setShowThirdPerson} 
            />
            <PhoneMenuButton onClick={(e) => { e.currentTarget.blur(); setShowPhoneMenu(true); }} />
            <VoiceChatControls />
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
          
          {/* Race Game button - positioned separately to avoid overlap */}
          <div style={{ position: 'fixed', top: 70, right: 20, zIndex: 1000 }}>
            <button
              style={{
                padding: '8px 12px',
                backgroundColor: showRaceGame ? '#e67e22' : '#2980b9',
                color: 'white',
                border: 'none',
                borderRadius: '5px',
                cursor: 'pointer',
                fontWeight: 'bold',
                fontSize: '14px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                height: '36px',
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
          <StatsMonitor />
          <CoordinatesDisplay />
          {showCreator && (
            <CharacterCreator
              initialColor={characterColor}
              onSave={handleSaveColor}
              onCancel={handleCancel}
            />
          )}
          
          {/* Idle overlay - rendered outside Canvas to avoid 3D transforms */}
          {idle && (
            <div style={{ 
              position: 'fixed', 
              top: 0, 
              left: 0, 
              bottom: 0, 
              right: 0, 
              width: '100vw', 
              height: '100vh', 
              backgroundColor: 'rgba(0,0,0,0.5)', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              pointerEvents: 'auto',
              zIndex: 10000 // Higher than other overlays
            }}>
              <div style={{ 
                backgroundColor: 'white', 
                padding: '20px', 
                borderRadius: '8px', 
                textAlign: 'center',
                boxShadow: '0 4px 20px rgba(0,0,0,0.3)'
              }}>
                <p>You have been idle for a while.</p>
                <button 
                  onClick={handleReconnect}
                  style={{
                    padding: '10px 20px',
                    backgroundColor: '#2980b9',
                    color: 'white',
                    border: 'none',
                    borderRadius: '5px',
                    cursor: 'pointer',
                    fontWeight: 'bold'
                  }}
                >
                  Reconnect
                </button>
              </div>
            </div>
          )}
        </GameSystemProvider>
      </VoiceChatProvider>
    </MultiplayerProvider>
  );
}

export default App;
