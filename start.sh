#!/bin/bash

# GhostChat Quick Start Script
# Start backend and frontend for real-time testing

echo "🚀 Starting GhostChat (Backend + Frontend)..."
echo ""

# Check if Node is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js not found. Please install Node.js 18+"
    exit 1
fi

echo "📦 Node.js version: $(node -v)"
echo ""

# Start backend
echo "🔌 Starting Socket.IO backend on port 3001..."
npm run dev:server &
SERVER_PID=$!

# Give backend time to start
sleep 2

# Start frontend
echo "🎨 Starting React frontend on port 5173..."
npm run dev &
FRONTEND_PID=$!

sleep 3

echo ""
echo "✅ GhostChat is running!"
echo ""
echo "🌐 Frontend:  http://localhost:5173"
echo "🔌 Backend:   http://localhost:3001"
echo ""
echo "📝 To test real-time messaging:"
echo "  1. Open http://localhost:5173 in TWO browser tabs"
echo "  2. Tab 1: Go to 'Keys' tab → Generate a code"
echo "  3. Tab 2: Go to 'Search' tab → Enter the code → Connect"
echo "  4. Both tabs: Now chat in real-time!"
echo ""
echo "Press Ctrl+C to stop both servers"
echo ""

# Keep script running
wait

# Cleanup
kill $SERVER_PID $FRONTEND_PID 2>/dev/null || true
echo "👋 GhostChat stopped."
