# Stage 1: Python Backend dependencies
FROM python:3.12-slim-bookworm AS backend-builder
WORKDIR /app
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Stage 2: Node.js Frontend build
FROM node:20-slim AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm install
COPY frontend/ .
RUN mv /app/frontend/server.js /app/frontend/server.mjs
RUN npm run build

# Stage 3: Final image (Python runtime, Node.js runtime, Cloudflared, Backend and Frontend dependencies)
# Stage 3: Final image
FROM debian:bookworm-slim
LABEL authors="Gemini CLI Agent"

RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    python3-pip \
    nodejs \
    npm \
    ca-certificates \
    curl \
    && rm -rf /var/lib/apt/lists/*

RUN curl -L --output /usr/local/bin/cloudflared https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 && \
    chmod +x /usr/local/bin/cloudflared

WORKDIR /app

# 1. Copy Backend
COPY backend/ ./backend/
WORKDIR /app/backend
RUN pip3 install --no-cache-dir --break-system-packages -r requirements.txt

# 2. Copy Frontend (Consolidated into /app/frontend)
WORKDIR /app/frontend
COPY --from=frontend-builder /app/frontend/dist ./dist
COPY --from=frontend-builder /app/frontend/server.mjs ./server.mjs
COPY --from=frontend-builder /app/frontend/node_modules ./node_modules

# 3. Final Setup
WORKDIR /app
COPY start.sh .
RUN chmod +x ./start.sh

EXPOSE 3000
ENTRYPOINT ["./start.sh"]
