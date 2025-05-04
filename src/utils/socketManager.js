// socketManager.js - Singleton pattern for socket.io
import { io } from 'socket.io-client';

// Socket singleton
let socket = null;

// Get the socket instance, creating it if it doesn't exist
export function getSocket() {
  if (!socket) {
    console.log('[SocketManager] Creating new socket connection');
    
    // Create a basic socket connection with minimal options
    socket = io('http://localhost:3006');
    
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
