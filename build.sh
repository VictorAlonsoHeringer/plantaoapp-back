#!/bin/bash

# Script de build para PlantãoApp Backend
# Uso: ./build.sh [tag]

set -e

# Tag padrão
TAG=${1:-latest}
IMAGE_NAME="plantaoapp-backend"

echo "🐳 Building Docker image: $IMAGE_NAME:$TAG"

# Build da imagem
docker build -t $IMAGE_NAME:$TAG .

echo "✅ Build completed successfully!"
echo ""
echo "📦 Image: $IMAGE_NAME:$TAG"
echo ""
echo "🚀 To run the container:"
echo "   docker run -d -p 3333:3333 \\"
echo "     -e DATABASE_URL='postgresql://user:pass@host:5432/db' \\"
echo "     -e JWT_SECRET='your-secret-key' \\"
echo "     --name plantaoapp-api \\"
echo "     $IMAGE_NAME:$TAG"
echo ""
echo "📋 To view logs:"
echo "   docker logs -f plantaoapp-api"
