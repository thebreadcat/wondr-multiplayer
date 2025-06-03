#!/bin/bash

# Deployment script for Wondr Multiplayer Server
# Run this on your DigitalOcean server at 159.65.161.194

echo "🚀 Deploying Wondr Multiplayer Server..."

# Stop existing PM2 processes
echo "📦 Stopping existing PM2 processes..."
pm2 stop all || true
pm2 delete all || true

# Also kill any standalone Node.js processes as backup
pkill -f "node server.js" || true
sleep 2

# Start the server with PM2
echo "🎮 Starting server on port 3000 with PM2..."
pm2 start server.js --name "wondr-server" --watch --ignore-watch="node_modules"

# Check if server started successfully
sleep 3
if pm2 list | grep -q "wondr-server"; then
    echo "✅ Server started successfully with PM2!"
    echo "📊 PM2 status:"
    pm2 status
    echo ""
    echo "📊 Server health check:"
    curl -s http://localhost:3000/health | head -5
    echo ""
    echo "🌐 Server accessible at: http://159.65.161.194:3000"
    echo "📋 CORS configured for: https://wondr-multiplayer.vercel.app"
    echo ""
    echo "🔧 PM2 Commands:"
    echo "  - View logs: pm2 logs wondr-server"
    echo "  - Restart: pm2 restart wondr-server"
    echo "  - Stop: pm2 stop wondr-server"
    echo "  - Monitor: pm2 monit"
else
    echo "❌ Failed to start server. Check PM2 logs:"
    pm2 logs --lines 10
fi 