// socketManager.js - Singleton pattern for socket.io
import { io } from 'socket.io-client';

// Socket singleton
let socket = null;

// Get the socket instance, creating it if it doesn't exist
export function getSocket() {
  if (!socket) {
    console.log('[SocketManager] Creating new socket connection');
    
    // Enhanced socket connection with robust options to address CORS and reliability issues
    socket = io('http://localhost:3006', {
      // Matching the server-side transport configuration
      transports: ['websocket', 'polling'],
      // Disable automatic reconnection to control the flow better
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000,
      // Credentials handling to avoid CORS issues
      withCredentials: false,
      // Explicitly set origin to match CORS configuration on server
      extraHeaders: {
        'Origin': window.location.origin
      }
    });
    
    // Make socket available globally for legacy code
    window.gameSocket = socket;
    window.socket = socket;
    
    // Setup basic event handlers
    socket.on('connect', () => {
      console.log('[SocketManager] Connected with ID:', socket.id);
    });
    
    socket.on('connect_error', (err) => {
      console.error('[SocketManager] Connection error:', err);
    });
    
    socket.on('disconnect', () => {
      console.log('[SocketManager] Disconnected');
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
