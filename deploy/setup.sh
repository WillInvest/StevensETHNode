#!/usr/bin/env bash
# Stevens Blockchain Analytics — Deployment setup
set -euo pipefail

PROJ_DIR="$(cd "$(dirname "$0")/.." && pwd)"

echo "=== Stevens Blockchain Analytics — Deployment ==="
echo "Project: $PROJ_DIR"

# Build frontend
echo "Building frontend..."
cd "$PROJ_DIR/web/frontend"
npm ci
npx vite build

# Install Python dependencies
echo "Installing Python dependencies..."
cd "$PROJ_DIR"
pip3 install -r requirements.txt

# Copy systemd services
echo "Installing systemd services..."
sudo cp deploy/stevens-api.service /etc/systemd/system/
sudo cp deploy/stevens-shovel.service /etc/systemd/system/
sudo systemctl daemon-reload

# Copy nginx config
echo "Installing nginx config..."
sudo cp deploy/nginx.conf /etc/nginx/sites-available/stevens-blockchain
sudo ln -sf /etc/nginx/sites-available/stevens-blockchain /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx

# Enable and start services
echo "Starting services..."
sudo systemctl enable --now stevens-api
sudo systemctl enable --now stevens-shovel

echo ""
echo "=== Deployment complete ==="
echo "API: http://localhost:8000"
echo "Web: http://localhost (via nginx)"
echo ""
echo "Check status:"
echo "  sudo systemctl status stevens-api"
echo "  sudo systemctl status stevens-shovel"
echo "  sudo systemctl status nginx"
