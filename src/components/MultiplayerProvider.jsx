import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { io } from 'socket.io-client';

const MultiplayerContext = createContext();

export function MultiplayerProvider({ characterColor, position, children }) {
  const [players, setPlayers] = useState({});
  const [myId, setMyId] = useState(null);
  const [emoji, setEmoji] = useState(null);
  const [emojis, setEmojis] = useState({});
  const socketRef = useRef();
  const playerCountRef = useRef(0);

  // Debug function to log player state
  const logPlayerState = useCallback((msg, playerState) => {
    console.log(msg, {
      playerCount: Object.keys(playerState).length,
      playerIds: Object.keys(playerState),
      players: playerState
    });
  }, []);

  // Request a full resync from the server
  const requestResync = useCallback(() => {
    console.log('Requesting resync from server');
    if (socketRef.current?.connected) {
      socketRef.current.emit('request-players');
    }
  }, []);

  // Send emoji reaction
  const sendEmoji = useCallback((emoji) => {
    if (!socketRef.current) return;
    
    const id = socketRef.current.id;
    socketRef.current.emit('emoji', { emoji });
    
    // Update local emoji state immediately for responsive feedback
    setEmojis(prev => ({
      ...prev,
      [id]: { value: emoji, timestamp: Date.now() }
    }));
    setEmoji(emoji);
  }, []);

  useEffect(() => {
    const socket = io('http://localhost:3006');
    socketRef.current = socket;

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

      // Set our initial state
      setPlayers(prev => ({
        ...prev,
        [id]: initialPlayerData
      }));

      // Request initial player list
      requestResync();
    });

    // Handle server sending player count
    socket.on('player-count', (count) => {
      playerCountRef.current = count;
      
      // If our local count doesn't match, request a resync
      const localCount = Object.keys(players).length;
      if (localCount !== count) {
        requestResync();
      }
    });

    // Handle receiving all players (initial sync and updates)
    socket.on('players', (serverPlayers) => {      
      setPlayers(prev => {
        // Create new state with server data
        const newState = { ...serverPlayers };
        
        // If we exist in the server state, ensure our local data is preserved
        if (socket.id && newState[socket.id]) {
          newState[socket.id] = {
            ...newState[socket.id],
            color: characterColor,
            position: prev[socket.id]?.position || position,
            animation: prev[socket.id]?.animation || 'idle',
            rotation: prev[socket.id]?.rotation || 0
          };
        }

        return newState;
      });
    });

    // Handle new player joining
    socket.on('player-joined', (player) => {      
      setPlayers(prev => {
        // Don't process our own join event
        if (player.id === socket.id) {
          return prev;
        }

        const newState = {
          ...prev,
          [player.id]: player
        };

        return newState;
      });
    });

    // Handle player movement
    socket.on('player-moved', ({ id, position, animation, rotation }) => {
      if (id === socket.id) return;
      
      setPlayers(prev => {
        if (!prev[id]) {
          requestResync();
          return prev;
        }

        const newState = {
          ...prev,
          [id]: {
            ...prev[id],
            position: position || prev[id].position,
            animation: animation || prev[id].animation,
            rotation: rotation !== undefined ? rotation : prev[id].rotation
          }
        };

        return newState;
      });
    });

    // Handle player leaving
    socket.on('player-left', (playerId) => {      
      setPlayers(prev => {
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

    // Handle emoji updates
    socket.on('player-emoji', ({ id, emoji }) => {      
      // Extract emoji value from server response
      const emojiValue = typeof emoji === 'object' && emoji.emoji ? emoji.emoji : emoji;
      
      // Always update emojis state regardless of sender
      setEmojis(prev => ({
        ...prev,
        [id]: { value: emojiValue, timestamp: Date.now() }
      }));

      // Only update local emoji state if it's our own emoji
      if (id === socket.id) {
        setEmoji(emojiValue);
      }
    });

    // Handle emoji removal
    socket.on('player-emoji-removed', ({ id }) => {
      console.log('Emoji removed for player:', id);
      setEmojis(prev => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      
      if (id === socket.id) {
        setEmoji(null);
      }
    });

    // Cleanup emoji after delay
    const emojiInterval = setInterval(() => {
      const now = Date.now();
      setEmojis(prev => {
        const next = { ...prev };
        let changed = false;
        
        Object.entries(prev).forEach(([playerId, data]) => {
          if (now - data.timestamp >= 3000) {
            delete next[playerId];
            changed = true;
            // Only clear local emoji if it's our own
            if (playerId === socket.id) {
              setEmoji(null);
              // Notify server about emoji removal
              socket.emit('emoji-removed');
            }
          }
        });
        
        return changed ? next : prev;
      });
    }, 1000);

    // Periodic player count verification
    const verifyInterval = setInterval(() => {
      if (socket.connected) {
        socket.emit('get-player-count');
      }
    }, 3000);

    return () => {
      clearInterval(emojiInterval);
      clearInterval(verifyInterval);
      socket.disconnect();
    };
  }, [characterColor, position, requestResync, logPlayerState]);

  const sendMove = useCallback(({ position, animation, rotation }) => {
    if (!socketRef.current) return;
    
    const moveData = { position, animation, rotation };
    
    setPlayers(prev => ({
      ...prev,
      [socketRef.current.id]: {
        ...prev[socketRef.current.id],
        ...moveData,
        color: characterColor
      }
    }));
    
    socketRef.current.emit('move', moveData);
  }, [characterColor]);

  const value = {
    players,
    myId,
    sendMove,
    sendEmoji,
    emojis,
    emoji,
    requestResync // Expose resync function
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