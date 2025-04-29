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
  const prevColorRef = useRef(characterColor);

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

    socketRef.current.emit('move', moveData);

    setPlayers(prev => ({
      ...prev,
      [id]: {
        ...prev[id],
        ...moveData
      }
    }));
  }, [players]);

  // Request a full resync from the server
  const requestResync = useCallback(() => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('request-players');
    }
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

      setPlayers(prev => ({
        ...prev,
        [id]: initialPlayerData
      }));
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
        const newState = { ...serverPlayers };
        if (socket.id && prev[socket.id]) {
          newState[socket.id] = {
            ...prev[socket.id],
            color: characterColor
          };
        }
        Object.keys(newState).forEach(playerId => {
          newState[playerId].animation = newState[playerId].animation || 'idle';
        });
        return newState;
      });
    });

    socket.on('player-joined', (player) => {
      if (player.id === socket.id) return;
      setPlayers(prev => {
        if (prev[player.id]) return prev;
        return {
          ...prev,
          [player.id]: {
            ...player,
            animation: 'idle',
            color: player.color
          }
        };
      });
    });

    socket.on('player-moved', ({ id, position, animation, rotation }) => {
      if (id === socket.id) return;
      setPlayers(prev => {
        if (!prev[id]) return prev;
        return {
          ...prev,
          [id]: {
            ...prev[id],
            position: position || prev[id].position,
            animation: animation || prev[id].animation || 'idle',
            rotation: rotation !== undefined ? rotation : prev[id].rotation
          }
        };
      });
    });

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

  // Effect to handle color changes and re-trigger idle animation
  useEffect(() => {
    if (socketRef.current?.connected && myId && prevColorRef.current !== characterColor) {
      const currentPlayerState = players[myId];
      if (!currentPlayerState) return;

      const updatedPlayer = {
        ...currentPlayerState,
        color: characterColor
      };

      socketRef.current.emit('color', updatedPlayer);

      setPlayers(prev => ({
        ...prev,
        [myId]: updatedPlayer
      }));

      prevColorRef.current = characterColor;

      // 🛠️ After updating color, resend idle move to rebind animations!
      resendMyAnimation();
    }
  }, [characterColor, myId, players, resendMyAnimation]);

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

  const sendEmoji = (emoji) => {
    if (!socketRef.current) return;
    const id = socketRef.current.id;
    socketRef.current.emit('emoji', { emoji });
    setEmojis(prev => ({
      ...prev,
      [id]: { value: emoji, timestamp: Date.now() }
    }));
    setEmoji(emoji);
  };

  const value = {
    players,
    myId,
    sendMove,
    sendEmoji,
    emojis,
    emoji,
    requestResync
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
