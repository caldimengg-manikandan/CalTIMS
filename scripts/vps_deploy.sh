#!/bin/bash
echo "🚀 Starting CalTIMS Docker Deployment..."

# Move to the root directory (one level up from scripts/)
cd "$(dirname "$0")/.."

# Pull latest code
echo "📦 Pulling latest code from GitHub..."
git pull origin main

# Check for .env file
if [ ! -f .env ]; then
    echo "⚠️ Warning: .env file not found. Please create it before deploying."
    exit 1
fi

# Deploy using Docker Compose
echo "🏗️ Building and starting containers..."
docker compose up -d --build

echo "✅ Docker deployment finished successfully!"
echo "📡 Your services should be running at:"
echo "   - Frontend: http://localhost:3000"
echo "   - Backend: http://localhost:5000"
echo "   - DB: http://localhost:5432"
