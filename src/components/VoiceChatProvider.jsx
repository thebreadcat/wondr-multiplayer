import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
// Remove the import since we're using CDN version
// import Peer from 'simple-peer';
import { useMultiplayer } from './MultiplayerProvider';

const VoiceChatContext = createContext();

export function VoiceChatProvider({ children }) {
  const { myId, players } = useMultiplayer();
  const [isVoiceChatEnabled, setIsVoiceChatEnabled] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isDeafened, setIsDeafened] = useState(false);
  const [voiceActivity, setVoiceActivity] = useState({});
  const [connectionStatus, setConnectionStatus] = useState({});
  const [simplePeerLoaded, setSimplePeerLoaded] = useState(false);
  const [connectionRetries, setConnectionRetries] = useState({});
  
  const peersRef = useRef({});
  const localStreamRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const microphoneVolumeRef = useRef(0);
  const voiceActivityTimeoutRef = useRef({});
  const retryTimeoutRef = useRef({});
  const connectionTimeoutRef = useRef({});

  // Check if SimplePeer is loaded from CDN
  useEffect(() => {
    const checkSimplePeer = () => {
      console.log('[VoiceChat] Checking for SimplePeer...', {
        windowSimplePeer: typeof window.SimplePeer,
        windowKeys: Object.keys(window).filter(key => key.toLowerCase().includes('peer')),
        simplePeerConstructor: window.SimplePeer ? window.SimplePeer.toString().substring(0, 100) : 'undefined'
      });
      
      if (typeof window.SimplePeer !== 'undefined') {
        console.log('[VoiceChat] SimplePeer loaded successfully from CDN');
        setSimplePeerLoaded(true);
      } else {
        console.warn('[VoiceChat] SimplePeer not yet loaded, retrying...');
        setTimeout(checkSimplePeer, 100);
      }
    };
    
    // Wait a bit for the script to load
    setTimeout(checkSimplePeer, 500);
  }, []);

  // Get socket reference from global window object
  const getSocket = useCallback(() => {
    return window.gameSocket || window.socket;
  }, []);

  // Initialize audio context and analyzer for voice activity detection
  const initializeAudioAnalysis = useCallback(async () => {
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
      }
      
      if (!analyserRef.current && localStreamRef.current) {
        const source = audioContextRef.current.createMediaStreamSource(localStreamRef.current);
        analyserRef.current = audioContextRef.current.createAnalyser();
        analyserRef.current.fftSize = 256;
        source.connect(analyserRef.current);
        
        // Start voice activity detection
        detectVoiceActivity();
      }
    } catch (error) {
      console.error('[VoiceChat] Error initializing audio analysis:', error);
    }
  }, []);

  // Voice activity detection
  const detectVoiceActivity = useCallback(() => {
    if (!analyserRef.current || !myId) return;
    
    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
    
    const checkActivity = () => {
      if (!analyserRef.current || !isVoiceChatEnabled || isMuted) {
        microphoneVolumeRef.current = 0;
        setVoiceActivity(prev => ({ ...prev, [myId]: false }));
        return;
      }
      
      analyserRef.current.getByteFrequencyData(dataArray);
      
      // Calculate average volume
      const average = dataArray.reduce((sum, value) => sum + value, 0) / dataArray.length;
      microphoneVolumeRef.current = average;
      
      // Voice activity threshold
      const isActive = average > 20;
      
      setVoiceActivity(prev => {
        if (prev[myId] !== isActive) {
          // Broadcast voice activity to other players
          const socket = getSocket();
          if (socket && socket.connected) {
            socket.emit('voice-activity', { playerId: myId, isActive });
          }
          return { ...prev, [myId]: isActive };
        }
        return prev;
      });
      
      requestAnimationFrame(checkActivity);
    };
    
    checkActivity();
  }, [isVoiceChatEnabled, isMuted, myId, getSocket]);

  // Get user media (microphone)
  const getUserMedia = useCallback(async () => {
    try {
      console.log('[VoiceChat] Requesting microphone access...');
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 48000
        },
        video: false
      });
      
      console.log('[VoiceChat] Microphone access granted');
      localStreamRef.current = stream;
      await initializeAudioAnalysis();
      return stream;
    } catch (error) {
      console.error('[VoiceChat] Error accessing microphone:', error);
      throw error;
    }
  }, [initializeAudioAnalysis]);

  // Cleanup peer connection
  const cleanupPeer = useCallback((targetId) => {
    console.log(`[VoiceChat] Cleaning up peer: ${targetId}`);
    
    if (peersRef.current[targetId]) {
      const { peer } = peersRef.current[targetId];
      if (peer && !peer.destroyed) {
        peer.destroy();
      }
      delete peersRef.current[targetId];
    }
    
    setConnectionStatus(prev => {
      const newStatus = { ...prev };
      delete newStatus[targetId];
      return newStatus;
    });
    
    setVoiceActivity(prev => {
      const newActivity = { ...prev };
      delete newActivity[targetId];
      return newActivity;
    });
  }, []);

  // Internal peer creation function to avoid circular dependency
  const createPeerInternal = useCallback((targetId, initiator = false) => {
    if (!simplePeerLoaded) {
      console.error('[VoiceChat] SimplePeer not yet loaded from CDN');
      return null;
    }
    
    console.log(`[VoiceChat] Creating peer connection to ${targetId} (initiator: ${initiator})`);
    
    // For initiators, we need a local stream. For receivers, we'll get it when we receive the signal
    if (initiator && !localStreamRef.current) {
      console.error('[VoiceChat] No local stream available for peer creation');
      console.error('[VoiceChat] Debug info:', {
        isVoiceChatEnabled,
        simplePeerLoaded,
        targetId,
        initiator,
        localStreamExists: !!localStreamRef.current
      });
      return null;
    }
    
    try {
      // Check if SimplePeer is available from CDN
      if (typeof window.SimplePeer === 'undefined') {
        console.error('[VoiceChat] SimplePeer library not loaded from CDN');
        return null;
      }

      const Peer = window.SimplePeer;

      // Create peer with simplified configuration
      const peerConfig = {
        initiator,
        trickle: true,
        stream: localStreamRef.current, // This will be null for receivers initially
        config: {
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            {
              urls: 'turn:openrelay.metered.ca:80',
              username: 'openrelayproject',
              credential: 'openrelayproject'
            },
            {
              urls: 'turn:openrelay.metered.ca:443',
              username: 'openrelayproject',
              credential: 'openrelayproject'
            }
          ]
        }
      };

      console.log('[VoiceChat] Creating peer with config:', {
        initiator,
        hasStream: !!localStreamRef.current,
        targetId
      });
      
      const peer = new Peer(peerConfig);

      // Set up event handlers
      peer.on('signal', (signal) => {
        console.log(`[VoiceChat] Sending signal to ${targetId}:`, signal.type);
        
        const socket = getSocket();
        if (socket && socket.connected) {
          socket.emit('webrtc-signal', {
            targetId,
            signal,
            from: myId
          });
          console.log(`[VoiceChat] Signal sent successfully to ${targetId}`);
        } else {
          console.error('[VoiceChat] Socket not connected when trying to send signal');
        }
      });

      peer.on('stream', (remoteStream) => {
        console.log('[VoiceChat] Received remote stream from:', targetId);
        
        try {
          // Create audio element for remote stream
          const audio = new Audio();
          audio.srcObject = remoteStream;
          audio.autoplay = true;
          audio.volume = isDeafened ? 0 : 1;
          
          // Ensure audio plays
          const playPromise = audio.play();
          if (playPromise !== undefined) {
            playPromise.catch(e => {
              console.warn('[VoiceChat] Audio autoplay failed:', e);
            });
          }
          
          // Store audio element reference
          if (!peersRef.current[targetId]) {
            peersRef.current[targetId] = {};
          }
          peersRef.current[targetId].audio = audio;
          
          setConnectionStatus(prev => ({ ...prev, [targetId]: 'connected' }));
          console.log(`[VoiceChat] Successfully connected to ${targetId}`);
        } catch (error) {
          console.error('[VoiceChat] Error setting up remote audio:', error);
        }
      });

      peer.on('connect', () => {
        console.log(`[VoiceChat] Data channel connected to ${targetId}`);
      });

      peer.on('close', () => {
        console.log(`[VoiceChat] Connection closed with ${targetId}`);
        setConnectionStatus(prev => ({ ...prev, [targetId]: 'disconnected' }));
      });

      peer.on('error', (err) => {
        console.error(`[VoiceChat] Peer error with ${targetId}:`, err);
        setConnectionStatus(prev => ({ ...prev, [targetId]: 'error' }));
        
        // Simple retry logic - only retry if we were the initiator
        if (initiator) {
          const currentRetries = connectionRetries[targetId] || 0;
          if (currentRetries < 2) {
            console.log(`[VoiceChat] Retrying connection to ${targetId} (attempt ${currentRetries + 1})`);
            setConnectionRetries(prev => ({ ...prev, [targetId]: currentRetries + 1 }));
            setTimeout(() => {
              cleanupPeer(targetId);
              const newPeer = createPeerInternal(targetId, true);
              if (newPeer) {
                peersRef.current[targetId] = { peer: newPeer };
                setConnectionStatus(prev => ({ ...prev, [targetId]: 'connecting' }));
              }
            }, 2000);
          }
        }
      });

      // Set initial connecting status
      setConnectionStatus(prev => ({ ...prev, [targetId]: 'connecting' }));

      return peer;
    } catch (error) {
      console.error('[VoiceChat] Failed to create peer:', error);
      setConnectionStatus(prev => ({ ...prev, [targetId]: 'error' }));
      return null;
    }
  }, [myId, isDeafened, getSocket, simplePeerLoaded, cleanupPeer, connectionRetries]);

  // Create peer connection (public interface)
  const createPeer = useCallback((targetId, initiator = false) => {
    return createPeerInternal(targetId, initiator);
  }, [createPeerInternal]);

  // Manual retry function for debugging
  const retryAllConnections = useCallback(() => {
    console.log('[VoiceChat] Manually retrying all connections...');
    
    Object.entries(connectionStatus).forEach(([targetId, status]) => {
      if (status === 'connecting' || status === 'error' || status === 'retrying') {
        console.log(`[VoiceChat] Retrying connection to ${targetId} (current status: ${status})`);
        cleanupPeer(targetId);
        
        setTimeout(() => {
          const peer = createPeer(targetId, true);
          if (peer) {
            peersRef.current[targetId] = { peer };
          }
        }, 1000);
      }
    });
  }, [connectionStatus, cleanupPeer, createPeer]);

  // Start voice chat - simplified approach
  const startVoiceChat = useCallback(async () => {
    try {
      console.log('[VoiceChat] Starting voice chat...');
      
      if (!simplePeerLoaded) {
        console.error('[VoiceChat] Cannot start voice chat: SimplePeer not loaded');
        throw new Error('SimplePeer library not loaded from CDN');
      }
      
      // Get microphone access first
      await getUserMedia();
      
      if (!localStreamRef.current) {
        console.error('[VoiceChat] Local stream not available after getUserMedia');
        throw new Error('Failed to initialize local stream');
      }
      
      console.log('[VoiceChat] Local stream initialized successfully');
      setIsVoiceChatEnabled(true);
      
      // Notify server that we're joining voice chat
      const socket = getSocket();
      if (socket && socket.connected) {
        console.log('[VoiceChat] Notifying server of voice chat join');
        socket.emit('voice-chat-join', { playerId: myId });
      }
      
      // Connect to all existing players who are already in voice chat
      // We become the initiator to all existing participants
      Object.keys(players).forEach(playerId => {
        if (playerId !== myId && !peersRef.current[playerId]) {
          console.log('[VoiceChat] Initiating connection to existing player:', playerId);
          const peer = createPeer(playerId, true); // We are always the initiator when joining
          if (peer) {
            peersRef.current[playerId] = { peer };
          }
        }
      });
      
    } catch (error) {
      console.error('[VoiceChat] Failed to start voice chat:', error);
      setIsVoiceChatEnabled(false);
      // Clean up any partial initialization
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => track.stop());
        localStreamRef.current = null;
      }
      throw error;
    }
  }, [getUserMedia, createPeer, players, myId, getSocket, simplePeerLoaded]);

  // Stop voice chat
  const stopVoiceChat = useCallback(() => {
    console.log('[VoiceChat] Stopping voice chat...');
    
    // Cleanup all peer connections
    Object.keys(peersRef.current).forEach(cleanupPeer);
    
    // Stop local stream
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
    }
    
    // Cleanup audio context
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    
    analyserRef.current = null;
    setIsVoiceChatEnabled(false);
    setVoiceActivity({});
    setConnectionStatus({});
    
    // Notify other players that we left voice chat
    const socket = getSocket();
    if (socket && socket.connected) {
      socket.emit('voice-chat-leave', { playerId: myId });
    }
  }, [cleanupPeer, myId, getSocket]);

  // Toggle mute
  const toggleMute = useCallback(() => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = isMuted;
        setIsMuted(!isMuted);
        console.log('[VoiceChat] Mute toggled:', !isMuted);
      }
    }
  }, [isMuted]);

  // Toggle deafen
  const toggleDeafen = useCallback(() => {
    const newDeafenState = !isDeafened;
    setIsDeafened(newDeafenState);
    
    // Update volume for all remote audio elements
    Object.values(peersRef.current).forEach(peerData => {
      if (peerData.audio) {
        peerData.audio.volume = newDeafenState ? 0 : 1;
      }
    });
    
    console.log('[VoiceChat] Deafen toggled:', newDeafenState);
  }, [isDeafened]);

  // Manual audio enable function to handle browser restrictions
  const enableAudio = useCallback(() => {
    console.log('[VoiceChat] Manually enabling audio for all connections...');
    Object.values(peersRef.current).forEach(peerData => {
      if (peerData.audio) {
        peerData.audio.play().catch(e => {
          console.warn('[VoiceChat] Failed to play audio:', e);
        });
      }
    });
  }, []);

  // Test audio function
  const testAudio = useCallback(() => {
    console.log('[VoiceChat] Testing audio...');
    console.log('Local stream:', localStreamRef.current);
    console.log('Peers:', Object.keys(peersRef.current));
    console.log('Connection status:', connectionStatus);
    
    // Test local microphone
    if (localStreamRef.current) {
      const tracks = localStreamRef.current.getAudioTracks();
      console.log('Local audio tracks:', tracks.map(t => ({ 
        enabled: t.enabled, 
        readyState: t.readyState,
        muted: t.muted 
      })));
    }
    
    // Test remote audio elements
    Object.entries(peersRef.current).forEach(([peerId, peerData]) => {
      if (peerData.audio) {
        console.log(`Audio element for ${peerId}:`, {
          paused: peerData.audio.paused,
          volume: peerData.audio.volume,
          muted: peerData.audio.muted,
          readyState: peerData.audio.readyState
        });
      }
    });
  }, [connectionStatus]);

  // Socket event handlers
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    // Handle WebRTC signaling
    const handleWebRTCSignal = async ({ from, signal }) => {
      console.log('[VoiceChat] Received WebRTC signal from:', from, 'type:', signal.type);
      
      // If we're not in voice chat, ignore signals
      if (!isVoiceChatEnabled) {
        console.log('[VoiceChat] Ignoring signal - voice chat not enabled');
        return;
      }
      
      // Ensure we have a local stream before processing any signals
      if (!localStreamRef.current) {
        console.log('[VoiceChat] No local stream available, initializing...');
        try {
          await getUserMedia();
          console.log('[VoiceChat] Local stream initialized for incoming signal');
        } catch (error) {
          console.error('[VoiceChat] Failed to initialize local stream for incoming signal:', error);
          return;
        }
      }
      
      // If we don't have a peer for this sender, create one as receiver
      if (!peersRef.current[from]) {
        console.log('[VoiceChat] Creating receiver peer for:', from);
        const peer = createPeer(from, false); // Always receiver when we get a signal first
        if (peer) {
          peersRef.current[from] = { peer };
          
          // Add the local stream to the peer now that we have it
          if (localStreamRef.current) {
            try {
              peer.addStream(localStreamRef.current);
              console.log('[VoiceChat] Added local stream to receiver peer');
            } catch (error) {
              console.warn('[VoiceChat] Could not add stream to peer (might be too early):', error);
            }
          }
        } else {
          console.error('[VoiceChat] Failed to create receiver peer for:', from);
          return;
        }
      }
      
      // Process the signal
      if (peersRef.current[from]?.peer) {
        try {
          console.log(`[VoiceChat] Processing ${signal.type} signal from ${from}`);
          peersRef.current[from].peer.signal(signal);
          console.log(`[VoiceChat] Signal processed successfully from ${from}`);
        } catch (error) {
          console.error('[VoiceChat] Error processing signal from', from, ':', error);
          console.error('[VoiceChat] Peer state:', {
            destroyed: peersRef.current[from].peer.destroyed,
            connected: peersRef.current[from].peer.connected
          });
          
          // If signal processing fails, clean up and let them retry
          cleanupPeer(from);
        }
      } else {
        console.error('[VoiceChat] No peer found for signal from:', from);
      }
    };

    // Handle voice chat join - when someone else joins
    const handleVoiceChatJoin = ({ playerId }) => {
      console.log('[VoiceChat] Player joined voice chat:', playerId);
      
      // Only create a connection if we're in voice chat and don't already have a peer
      if (playerId !== myId && isVoiceChatEnabled && !peersRef.current[playerId]) {
        // Don't create a peer here - let them initiate to us
        // This prevents the collision issue
        console.log('[VoiceChat] Waiting for', playerId, 'to initiate connection');
      }
    };

    // Handle voice chat leave
    const handleVoiceChatLeave = ({ playerId }) => {
      console.log('[VoiceChat] Player left voice chat:', playerId);
      cleanupPeer(playerId);
    };

    // Handle voice activity from other players
    const handleVoiceActivity = ({ playerId, isActive }) => {
      setVoiceActivity(prev => ({ ...prev, [playerId]: isActive }));
      
      // Clear timeout for this player
      if (voiceActivityTimeoutRef.current[playerId]) {
        clearTimeout(voiceActivityTimeoutRef.current[playerId]);
      }
      
      // Set timeout to clear activity if no update received
      if (isActive) {
        voiceActivityTimeoutRef.current[playerId] = setTimeout(() => {
          setVoiceActivity(prev => ({ ...prev, [playerId]: false }));
        }, 1000);
      }
    };

    // Handle player disconnect
    const handlePlayerLeft = ({ id }) => {
      cleanupPeer(id);
    };

    // Handle WebRTC errors
    const handleWebRTCError = ({ targetId, error, from }) => {
      console.error(`[VoiceChat] WebRTC error from server:`, { targetId, error, from });
      setConnectionStatus(prev => ({ ...prev, [targetId]: 'error' }));
      cleanupPeer(targetId);
    };

    socket.on('webrtc-signal', handleWebRTCSignal);
    socket.on('voice-chat-join', handleVoiceChatJoin);
    socket.on('voice-chat-leave', handleVoiceChatLeave);
    socket.on('voice-activity', handleVoiceActivity);
    socket.on('player-left', handlePlayerLeft);
    socket.on('webrtc-error', handleWebRTCError);

    return () => {
      socket.off('webrtc-signal', handleWebRTCSignal);
      socket.off('voice-chat-join', handleVoiceChatJoin);
      socket.off('voice-chat-leave', handleVoiceChatLeave);
      socket.off('voice-activity', handleVoiceActivity);
      socket.off('player-left', handlePlayerLeft);
      socket.off('webrtc-error', handleWebRTCError);
    };
  }, [myId, isVoiceChatEnabled, createPeer, cleanupPeer, getSocket]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopVoiceChat();
      
      // Cleanup all timeouts
      Object.values(voiceActivityTimeoutRef.current).forEach(timeout => clearTimeout(timeout));
      Object.values(retryTimeoutRef.current).forEach(timeout => clearTimeout(timeout));
      Object.values(connectionTimeoutRef.current).forEach(timeout => clearTimeout(timeout));
      
      // Cleanup all peers
      Object.values(peersRef.current).forEach(({ peer }) => {
        if (peer && !peer.destroyed) {
          peer.destroy();
        }
      });
    };
  }, []);

  const value = {
    isVoiceChatEnabled,
    isMuted,
    isDeafened,
    voiceActivity,
    connectionStatus,
    microphoneVolume: microphoneVolumeRef.current,
    startVoiceChat,
    stopVoiceChat,
    toggleMute,
    toggleDeafen,
    enableAudio,
    testAudio,
    retryAllConnections
  };

  return (
    <VoiceChatContext.Provider value={value}>
      {children}
    </VoiceChatContext.Provider>
  );
}

export function useVoiceChat() {
  const context = useContext(VoiceChatContext);
  if (!context) {
    throw new Error('useVoiceChat must be used within a VoiceChatProvider');
  }
  return context;
} 