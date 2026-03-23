#!/bin/bash

# Ensure we are in the root /app directory
BASE_DIR="/app"
cd "$BASE_DIR"

# 1. Start FastAPI backend
echo "Starting FastAPI backend..."
# Stay in /app and call backend.main:app
# This allows 'from .models' to work because 'backend' is the parent package
export PYTHONPATH=$PYTHONPATH:$BASE_DIR
python3 -m uvicorn backend.main:app --host 0.0.0.0 --port 8000 &
FASTAPI_PID=$!
echo "FastAPI started with PID: $FASTAPI_PID"

# 2. Start Node.js frontend server
# Inside start.sh - ensure this section looks like this:
echo "Starting Node.js frontend server..."
cd /app/frontend || exit 1
export API_PROXY_TARGET="http://127.0.0.1:8000"
node server.mjs &


# 3. Wait for startup
sleep 5

# 4. Start Cloudflared
echo "Starting Cloudflared tunnel..."
# Directing cloudflared to the frontend port
cloudflared tunnel --url http://127.0.0.1:3000 &

wait
