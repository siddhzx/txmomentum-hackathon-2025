#!/bin/bash

echo "🚀 Starting VGGT Real-time 3D Reconstruction System"
echo "=================================="

# Check if VGGT directory exists
VGGT_DIR="/Users/siddhantsingh/Documents/GitHub/txmomentum-hackathon-2025/vggt"
if [ ! -d "$VGGT_DIR" ]; then
    echo "❌ VGGT directory not found at: $VGGT_DIR"
    echo "Please ensure VGGT is installed and accessible"
    exit 1
fi

echo "✅ Found VGGT directory at: $VGGT_DIR"

# Try to activate the VGGT virtual environment if it exists
if [ -f "$VGGT_DIR/venv/bin/activate" ]; then
    echo "🔧 Activating VGGT virtual environment..."
    source "$VGGT_DIR/venv/bin/activate"
elif [ -f "$VGGT_DIR/env/bin/activate" ]; then
    echo "🔧 Activating VGGT virtual environment..."
    source "$VGGT_DIR/env/bin/activate"
else
    echo "⚠️  No virtual environment found. Using system Python."
    echo "   If you have issues, please activate your VGGT environment first:"
    echo "   cd $VGGT_DIR && source venv/bin/activate"
fi

# Install additional dependencies for the proxy server
echo "📦 Installing proxy server dependencies..."
pip install flask flask-cors

echo ""
echo "🔗 Starting servers:"
echo "  - VGGT API Server:        http://localhost:8081"
echo "  - Viser 3D Viewer:       http://localhost:8080" 
echo "  - React App:              http://localhost:3000"
echo ""

# Function to handle cleanup
cleanup() {
    echo ""
    echo "🛑 Shutting down servers..."
    pkill -f "VGGTServerProxy.py"
    pkill -f "demo_viser.py"
    exit 0
}

# Trap SIGINT and SIGTERM to call cleanup function
trap cleanup SIGINT SIGTERM

# Start VGGT API Server
echo "🚀 Starting VGGT API Server on port 8081..."
cd "$(dirname "$0")"
python3 src/services/VGGTServerProxy.py &
VGGT_PID=$!

# Wait a moment for the API server to start
sleep 2

# Start Viser visualization server
echo "🚀 Starting Viser 3D Viewer on port 8080..."
cd "$VGGT_DIR"
python3 demo_viser.py &
VISER_PID=$!

# Wait a moment for servers to start
sleep 3

echo ""
echo "✅ All servers started successfully!"
echo ""
echo "📡 API Endpoints:"
echo "  - Health Check:           GET  http://localhost:8081/api/health"
echo "  - Reconstruction:         POST http://localhost:8081/api/reconstruct"
echo "  - List Sessions:          GET  http://localhost:8081/api/sessions"
echo ""
echo "🎯 Ready for real-time 3D reconstruction!"
echo "   1. Start recording in your React app"
echo "   2. Frames will be automatically sent to VGGT for processing"
echo "   3. View live 3D reconstruction at http://localhost:8080"
echo ""
echo "Press Ctrl+C to stop all servers..."

# Wait for background processes
wait $VGGT_PID $VISER_PID