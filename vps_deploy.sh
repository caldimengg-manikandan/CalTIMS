#!/bin/bash
echo "🚀 Starting CalTIMS Deployment..."

# Ensure we are in the root directory
cd "$(dirname "$0")"

# Pull latest code
echo "📦 Pulling latest code from GitHub..."
git pull origin main

# Install Backend Dependencies
echo "🔧 Setting up backend..."
cd backend
npm install
# Generate Prisma Client
npx prisma generate
cd ..

# Install Frontend Dependencies and Build
echo "🎨 Setting up frontend..."
cd frontend
npm install
echo "🏗️ Building frontend for production..."
npm run build
cd ..

# Restart Backend using PM2
echo "🔄 Restarting backend server..."
pm2 restart ecosystem.config.js || pm2 start ecosystem.config.js

echo "✅ Deployment finished successfully!"
