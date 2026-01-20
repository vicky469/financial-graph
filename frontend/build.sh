#!/bin/bash
set -e

echo "Building shared package..."
cd ../shared
npm install
npm run build

echo "Building frontend..."
cd ../frontend
npm install
npm run build

echo "Build completed successfully!"