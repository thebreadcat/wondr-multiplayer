import React, { createContext, useContext, useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { io } from 'socket.io-client';
import { Vector3 } from 'three';
import { getSocket } from '../utils/socketManager';

// Throttle function to limit network updates
const throttle = (callback, limit) => {
  let waiting = false;
  return function(...args) {
    if (!waiting) {
      callback.apply(this, args);
      waiting = true;
      setTimeout(function() {
        waiting = false;
      }, limit);
    }
  };
};

// Delta compression - only send what changed
const createDelta = (current, previous) => {
  if (!previous) return current; // Send full data if no previous state
  
  const delta = {};
  let hasChanges = false;
  
  // Check which properties have changed
  Object.keys(current).forEach(key => {
    if (key === 'position' && previous.position) {
      // For position arrays, check each coordinate
      if (!current.position.every((val, i) => {
        return Math.abs(val - previous.position[i]) < 0.01;
      })) {
        delta.position = current.position;
        hasChanges = true;
      }
    } 
    else if (key === 'rotation' && previous.rotation !== undefined) {
      // For rotation, use a threshold
      if (Math.abs(current.rotation - previous.rotation) > 0.05) {
        delta.rotation = current.rotation;
        hasChanges = true;
      }
    }
    else if (key === 'animation' && current.animation !== previous.animation) {
      delta.animation = current.animation;
      hasChanges = true;
    }
    else if (key === 'color' && current.color !== previous.color) {
      delta.color = current.color;
      hasChanges = true;
    }
  });
  
  return hasChanges ? { ...delta, id: current.id } : null;
};

const MultiplayerContext = createContext();

export function MultiplayerProvider({ characterColor, position, children }) {
  const [players, setPlayers] = useState({});
  const [myId, setMyId] = useState(null);
  const [emoji, setEmoji] = useState(null);
  const [emojis, setEmojis] = useState({});
  const socketRef = useRef();
  const playerCountRef = useRef(0);
  const prevColorRef = useRef(characterColor);
  
  // Store previous state for delta compression
  const prevStateRef = useRef({});
  
  // Refs for interpolation
  const interpolationTargets = useRef({});
  const lastUpdateTime = useRef({});

  // Send move data with delta compression
  const sendMove = useCallback((moveData) => {
    const id = socketRef.current?.id;
    if (!id || !socketRef.current?.connected) return;
    
    const fullData = {
      id,
      ...moveData
    };
    
    // Use delta compression
    const delta = createDelta(fullData, prevStateRef.current[id]);
    
    // Only send if there are actual changes
    if (delta) {
      socketRef.current.emit('move', delta);
      prevStateRef.current[id] = { ...fullData };
    }
    
    // Update local state immediately
    setPlayers(prev => ({
      ...prev,
      [id]: {
        ...prev[id],
        ...moveData
      }
    }));
  }, []);
  
  // Throttle network updates to 20 per second maximum for better performance
  const throttledSendMove = useMemo(
    () => throttle(sendMove, 50), // 20 updates per second
    [sendMove]
  );
  
  // Force resend idle animation when needed
  const resendMyAnimation = useCallback(() => {
    const id = socketRef.current?.id;
    if (!id) return;

    const player = players[id];
    if (!player) return;

    const moveData = {
      position: player.position || [0, 2, 0],
      rotation: player.rotation || 0,
      animation: player.animation || 'idle',
    };

    throttledSendMove(moveData);
  }, [players, throttledSendMove]);

  // Request a full resync from the server
  const requestResync = useCallback(() => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('request-players');
    }
  }, []);

  useEffect(() => {
    // Create a socket connection that works in both development and production
    // Priority: 1. VITE_SERVER_URL env var, 2. Development localhost, 3. Production fallback
    let serverUrl;
    
    // Check if we're on a deployed domain (not localhost)
    const isDeployed = window.location.hostname !== 'localhost' && 
                      window.location.hostname !== '127.0.0.1' && 
                      !window.location.hostname.includes('localhost');
    
    // Manual override for testing - check URL params
    const urlParams = new URLSearchParams(window.location.search);
    const forceServer = urlParams.get('server');
    
    if (forceServer) {
      serverUrl = forceServer;
      console.log('[MultiplayerProvider] Using forced server from URL param:', serverUrl);
    } else if (import.meta.env.VITE_SERVER_URL) {
      serverUrl = import.meta.env.VITE_SERVER_URL;
      console.log('[MultiplayerProvider] Using VITE_SERVER_URL:', serverUrl);
    } else if (!isDeployed && import.meta.env.DEV) {
      // Only use localhost if we're actually running on localhost in dev mode
      serverUrl = 'https://thefishnfts.com';
      console.log('[MultiplayerProvider] Development mode on localhost, using localhost:', serverUrl);
    } else {
      // For any deployed environment, always use the live server
      serverUrl = 'https://thefishnfts.com';
      console.log('[MultiplayerProvider] Deployed environment detected, using live server:', serverUrl);
    }
    
    console.log('[MultiplayerProvider] Environment info:', {
      VITE_SERVER_URL: import.meta.env.VITE_SERVER_URL,
      DEV: import.meta.env.DEV,
      MODE: import.meta.env.MODE,
      hostname: window.location.hostname,
      isDeployed: isDeployed,
      forceServer: forceServer,
      finalServerUrl: serverUrl
    });
    
    console.log('[MultiplayerProvider] Connecting to server:', serverUrl);
    const socket = io(serverUrl, { 
      transports: ['polling', 'websocket'],
      timeout: 20000,
      forceNew: true,
      withCredentials: false
    });
    
    // Store references
    socketRef.current = socket;
    window.gameSocket = socket;
    window.socket = socket;
    
    // Log connection status
    socket.on('connect', () => {
      console.log('[MultiplayerProvider] ✅ Connected successfully with ID:', socket.id);
      console.log('[MultiplayerProvider] Connected to:', serverUrl);
    });
    
    socket.on('connect_error', (err) => {
      console.error('[MultiplayerProvider] ❌ Connection error:', err);
      console.error('[MultiplayerProvider] Failed to connect to:', serverUrl);
      console.error('[MultiplayerProvider] Error details:', {
        message: err.message,
        description: err.description,
        context: err.context,
        type: err.type
      });
    });
    
    socket.on('disconnect', (reason) => {
      console.log('[MultiplayerProvider] 🔌 Disconnected:', reason);
    });
    
    socket.on('reconnect', (attemptNumber) => {
      console.log('[MultiplayerProvider] 🔄 Reconnected after', attemptNumber, 'attempts');
    });
    
    socket.on('reconnect_error', (err) => {
      console.error('[MultiplayerProvider] 🔄❌ Reconnection error:', err);
    });
    
    // Setup periodic resync to ensure all clients stay in sync
    const syncInterval = setInterval(() => {
      if (socket.connected) {
        requestResync();
      }
    }, 30000); // Resync every 30 seconds

    socket.on('connect', () => {
      const id = socket.id;
      setMyId(id);

      // Join the game
      const initialPlayerData = {
        id,
        color: characterColor,
        position,
        animation: 'idle',
        rotation: 0
      };
      
      socket.emit('join', initialPlayerData);
      
      // Request a full player list when joining
      socket.emit('request-players');

      setPlayers(prev => ({
        ...prev,
        [id]: initialPlayerData
      }));
      
      // Setup reconnection handling
      socket.io.on("reconnect", () => {
        // Re-join and get full player list on reconnection
        socket.emit('join', initialPlayerData);
        socket.emit('request-players');
      });
    });

    // All your existing socket.on handlers (player-color, player-joined, etc) stay the same...
    // I'm skipping them here just to save space, but they don't need to change!

    socket.on('player-color', ({ id, color, ...playerData }) => {
      if (id === socket.id) return; // Don't process our own color updates
      setPlayers(prev => {
        const currentPlayer = prev[id];
        if (!currentPlayer) return prev;
        return {
          ...prev,
          [id]: {
            ...currentPlayer,
            ...playerData,
            color
          }
        };
      });
    });

    socket.on('players', (serverPlayers) => {      
      setPlayers(prev => {
        // Create new state with server data
        const newState = { ...serverPlayers };
        
        // Always preserve our own state if we exist
        if (socket.id && prev[socket.id]) {
          newState[socket.id] = {
            ...prev[socket.id],
            color: characterColor
          };
        }

        // Ensure all players have an animation state
        Object.keys(newState).forEach(playerId => {
          if (!newState[playerId]) return;
          newState[playerId] = {
            ...newState[playerId],
            animation: newState[playerId].animation || 'idle',
            showSkateboard: newState[playerId].showSkateboard || false
          };
        });

        // Debug log
        console.log('Players update:', {
          myId: socket.id,
          playerCount: Object.keys(newState).length,
          players: newState
        });

        return newState;
      });
    });

    socket.on('player-joined', (player) => {      
      // Request a full players sync when someone new joins to ensure complete state
      requestResync();
      
      setPlayers(prev => {
        // Don't process our own join event
        if (player.id === socket.id) return prev;

        // Only add if player doesn't exist
        if (prev[player.id]) return prev;

        // Debug log
        console.log('Player joined:', {
          joinedId: player.id,
          myId: socket.id
        });

        return {
          ...prev,
          [player.id]: {
            ...player,
            animation: 'idle',
            showSkateboard: player.showSkateboard || false
          }
        };
      });
      
      // When a new player joins, send our current state to help synchronization
      // This ensures the server has the latest state to distribute
      if (socket.id && socket.id !== player.id) {
        const currentPlayerState = players[socket.id];
        if (currentPlayerState) {
          socket.emit('refresh-state', { 
            id: socket.id, 
            ...currentPlayerState 
          });
        }
      }
    });

    socket.on('player-moved', ({ id, position, animation, rotation, showSkateboard }) => {
      if (id === socket.id) return;
      
      // Set target for interpolation
      if (position) {
        if (!interpolationTargets.current[id]) {
          interpolationTargets.current[id] = {
            position: new Vector3().fromArray(position),
            prevPosition: new Vector3().fromArray(position),
            rotation: rotation || 0
          };
        } else {
          // Store previous position for interpolation
          interpolationTargets.current[id].prevPosition.copy(
            interpolationTargets.current[id].position
          );
          // Update target position
          interpolationTargets.current[id].position.fromArray(position);
          if (rotation !== undefined) {
            interpolationTargets.current[id].rotation = rotation;
          }
        }
        lastUpdateTime.current[id] = performance.now();
      }
      
      setPlayers(prev => {
        if (!prev[id]) return prev;
        return {
          ...prev,
          [id]: {
            ...prev[id],
            // Only update animation immediately, position will be interpolated
            animation: animation || prev[id].animation || 'idle',
            // Store target position and rotation for interpolation
            ...(position ? { targetPosition: position } : {}),
            ...(rotation !== undefined ? { targetRotation: rotation } : {}),
            // Update skateboard state
            ...(typeof showSkateboard === 'boolean' ? { showSkateboard } : {})
          }
        };
      });
    });

    socket.on('player-left', (playerId) => {      
      setPlayers(prev => {
        // Debug log
        console.log('Player left:', {
          leftId: playerId,
          myId: socket.id,
          remainingPlayers: Object.keys(prev).filter(id => id !== playerId)
        });

        const newState = { ...prev };
        delete newState[playerId];
        return newState;
      });
      
      setEmojis(prev => {
        const next = { ...prev };
        delete next[playerId];
        return next;
      });
    });

    socket.on('player-emoji', ({ id, emoji }) => {
      const emojiValue = typeof emoji === 'object' && emoji.emoji ? emoji.emoji : emoji;
      setEmojis(prev => ({
        ...prev,
        [id]: { value: emojiValue, timestamp: Date.now() }
      }));
      if (id === socket.id) {
        setEmoji(emojiValue);
      }
    });

    socket.on('player-emoji-removed', ({ id }) => {
      setEmojis(prev => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      if (id === socket.id) {
        setEmoji(null);
      }
    });

    const emojiInterval = setInterval(() => {
      const now = Date.now();
      setEmojis(prev => {
        const next = { ...prev };
        let changed = false;
        Object.entries(prev).forEach(([playerId, data]) => {
          if (now - data.timestamp >= 3000) {
            delete next[playerId];
            changed = true;
            if (playerId === socket.id) {
              setEmoji(null);
              socket.emit('emoji-removed');
            }
          }
        });
        return changed ? next : prev;
      });
    }, 1000);

    return () => {
      clearInterval(emojiInterval);
      socket.disconnect();
    };
  }, [characterColor, position, requestResync]);

  // Setup interpolation frame loop
  useEffect(() => {
    // Run interpolation at 60fps
    const interpolationLoop = setInterval(() => {
      let hasUpdates = false;

      // Process all players needing interpolation
      Object.keys(interpolationTargets.current).forEach((id) => {
        const target = interpolationTargets.current[id];
        if (!target) return;

        const now = performance.now();
        const timeSinceUpdate = now - (lastUpdateTime.current[id] || 0);

        // Use a smooth interpolation factor
        const lerpFactor = Math.min(0.2, timeSinceUpdate / 100); // Adjust based on network conditions

        setPlayers((prev) => {
          if (!prev[id]) return prev;

          // Convert current position to Vector3 for interpolation
          const currentPos = prev[id].position;
          if (!currentPos) return prev;

          // Create interpolated position
          const currentVec = new Vector3().fromArray(currentPos);
          currentVec.lerp(target.position, lerpFactor);

          hasUpdates = true;
          return {
            ...prev,
            [id]: {
              ...prev[id],
              position: [currentVec.x, currentVec.y, currentVec.z],
              // Smoothly interpolate rotation as well if needed
              ...(prev[id].targetRotation !== undefined ? {
                rotation: prev[id].rotation + (prev[id].targetRotation - prev[id].rotation) * lerpFactor,
              } : {}),
            },
          };
        });
      });

      // Only trigger re-render if there were changes
      if (!hasUpdates) {
        // Clean up any stale players from interpolation targets
        Object.keys(interpolationTargets.current).forEach((id) => {
          if (!players[id]) {
            delete interpolationTargets.current[id];
            delete lastUpdateTime.current[id];
          }
        });
      }
    }, 1000 / 60); // 60 fps updates

    return () => clearInterval(interpolationLoop);
  }, [players]);

  useEffect(() => {
    if (characterColor !== prevColorRef.current) {
      prevColorRef.current = characterColor;
      const id = socketRef.current?.id;

      if (id) {
        const currentPlayerState = players[id];
        socketRef.current.emit('color', { id, color: characterColor, ...currentPlayerState });

        setPlayers((prev) => ({
          ...prev,
          [id]: {
            ...prev[id],
            color: characterColor,
          },
        }));
      }
    }
  }, [characterColor, players]);

  const sendEmoji = useCallback((emojiData) => {
    const id = socketRef.current?.id;
    if (!id || !socketRef.current?.connected) return;

    socketRef.current.emit('emoji', { id, emoji: emojiData });
  }, []);

  // This is a duplicate throttledSendMove function that is unnecessary

  // Clean up when component unmounts
  useEffect(() => {
    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }

      // Clean up all Three.js objects to prevent memory leaks
      Object.values(interpolationTargets.current).forEach((target) => {
        if (target.position) target.position = null;
        if (target.prevPosition) target.prevPosition = null;
      });

      interpolationTargets.current = {};
      lastUpdateTime.current = {};
      prevStateRef.current = {};
    };
  }, []);

  // Function to teleport player to a specific position
  const teleportPlayer = useCallback((position) => {
    if (!socketRef.current || !socketRef.current.connected || !myId) return;
    
    console.log('[MultiplayerProvider] Teleporting player to:', position);
    
    // Update local state immediately
    setPlayers(prev => {
      const currentPlayer = prev[myId];
      if (!currentPlayer) return prev;
      
      return {
        ...prev,
        [myId]: {
          ...currentPlayer,
          position: position
        }
      };
    });
    
    // Send update to server with high priority (not throttled)
    socketRef.current.emit('player-move', {
      id: myId,
      position,
      isTeleport: true // Flag to indicate this is a teleport, not regular movement
    });
  }, [socketRef, myId]);

  const value = {
    players,
    myId,
    emojis,
    emoji,
    sendEmoji,
    sendMove: throttledSendMove, // Use throttled version
    resendMyAnimation,
    requestResync,
    teleportPlayer, // Add the teleport function to the context
  };

  return (
    <MultiplayerContext.Provider value={value}>
      {children}
    </MultiplayerContext.Provider>
  );
}

export function useMultiplayer() {
  return useContext(MultiplayerContext);
}