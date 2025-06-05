// socketManager.js - Singleton pattern for socket.io
import { io } from 'socket.io-client';

// Socket singleton
let socket = null;

// Get the correct server URL based on environment
function getServerUrl() {
  // Check if we're on a deployed domain (not localhost)
  const isDeployed = window.location.hostname !== 'localhost' && 
                    window.location.hostname !== '127.0.0.1' && 
                    !window.location.hostname.includes('localhost');
  
  // Manual override for testing - check URL params
  const urlParams = new URLSearchParams(window.location.search);
  const forceServer = urlParams.get('server');
  
  let serverUrl;
  
  if (forceServer) {
    serverUrl = forceServer;
    console.log('[SocketManager] Using forced server from URL param:', serverUrl);
  } else if (import.meta.env.VITE_SERVER_URL) {
    serverUrl = import.meta.env.VITE_SERVER_URL;
    console.log('[SocketManager] Using VITE_SERVER_URL:', serverUrl);
  } else if (!isDeployed && import.meta.env.DEV) {
    // Only use localhost if we're actually running on localhost in dev mode
    serverUrl = 'https://thefishnfts.com';
    console.log('[SocketManager] Development mode on localhost, using localhost:', serverUrl);
  } else {
    // For any deployed environment, always use the live server
    serverUrl = 'https://thefishnfts.com';
    console.log('[SocketManager] Deployed environment detected, using live server:', serverUrl);
  }
  
  console.log('[SocketManager] Environment info:', {
    VITE_SERVER_URL: import.meta.env.VITE_SERVER_URL,
    DEV: import.meta.env.DEV,
    MODE: import.meta.env.MODE,
    hostname: window.location.hostname,
    isDeployed: isDeployed,
    forceServer: forceServer,
    finalServerUrl: serverUrl
  });
  
  return serverUrl;
}

// Get the socket instance, creating it if it doesn't exist
export function getSocket() {
  if (!socket) {
    console.log('[SocketManager] Creating new socket connection');
    
    const serverUrl = getServerUrl();
    
    // Enhanced socket connection with robust options to address CORS and reliability issues
    socket = io(serverUrl, {
      // Matching the server-side transport configuration
      transports: ['polling', 'websocket'],
      // Enhanced reconnection settings for reliability
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 30000,
      // Credentials handling to avoid CORS issues
      withCredentials: false,
      // Additional options for reliability
      forceNew: false,
      // Upgrade timeout for websocket
      upgrade: true,
      // Polling options for better reliability
      polling: {
        extraHeaders: {}
      }
    });
    
    // Make socket available globally for legacy code
    window.gameSocket = socket;
    window.socket = socket;
    
    // Setup basic event handlers
    socket.on('connect', () => {
      console.log('[SocketManager] ✅ Connected successfully with ID:', socket.id);
      console.log('[SocketManager] Connected to:', serverUrl);
    });
    
    socket.on('connect_error', (err) => {
      console.error('[SocketManager] ❌ Connection error:', err);
      console.error('[SocketManager] Failed to connect to:', serverUrl);
      
      // Enhanced error handling for specific error types
      if (err.message && err.message.includes('xhr poll error')) {
        console.warn('[SocketManager] 🔄 XHR polling error detected, this may be temporary');
        console.warn('[SocketManager] Server may be experiencing high load or network issues');
      }
      
      if (err.message && err.message.includes('502')) {
        console.warn('[SocketManager] 🔄 502 Bad Gateway error, server proxy may be restarting');
      }
      
      // Log additional debugging information
      console.log('[SocketManager] Error details:', {
        type: err.type,
        description: err.description,
        context: err.context,
        transport: err.transport
      });
    });
    
    socket.on('disconnect', () => {
      console.log('[SocketManager] 🔌 Disconnected');
    });
    
    socket.on('reconnect_attempt', (attemptNumber) => {
      console.log(`[SocketManager] 🔄 Reconnection attempt ${attemptNumber}/10`);
    });
    
    socket.on('reconnect', (attemptNumber) => {
      console.log(`[SocketManager] ✅ Reconnected successfully after ${attemptNumber} attempts`);
    });
    
    socket.on('reconnect_failed', () => {
      console.error('[SocketManager] ❌ Failed to reconnect after 10 attempts');
      console.error('[SocketManager] Please check your internet connection and server status');
    });
  }
  
  return socket;
}

// Reset the socket (useful for testing or forced reconnection)
export function resetSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
    window.gameSocket = null;
    window.socket = null;
  }
}
