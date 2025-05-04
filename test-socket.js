// Simple test script to verify Socket.IO connection
const { io } = require("socket.io-client");

console.log("Attempting to connect to Socket.IO server at http://localhost:3006");

const socket = io("http://localhost:3006", {
  transports: ["polling"]
});

socket.on("connect", () => {
  console.log("Connected to server with ID:", socket.id);
  
  // Test sending a message
  socket.emit("ping-server", { timestamp: Date.now() });
  
  // Wait 5 seconds then disconnect
  setTimeout(() => {
    console.log("Test complete, disconnecting");
    socket.disconnect();
    process.exit(0);
  }, 5000);
});

socket.on("connect_error", (err) => {
  console.error("Connection error:", err);
});

socket.on("disconnect", () => {
  console.log("Disconnected from server");
});

// Listen for pong response
socket.on("pong-client", (data) => {
  console.log("Received pong from server:", data);
});

// Exit after 10 seconds if no connection
setTimeout(() => {
  console.error("Timed out waiting for connection");
  process.exit(1);
}, 10000);
