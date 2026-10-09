#!/bin/bash
# Quick Docker verification script
# Validates Docker setup without actually building

set -e

echo "🔍 Docker Setup Verification"
echo "=============================="
echo ""

# Check if Docker files exist
echo "✓ Checking Docker configuration files..."

if [ -f "Dockerfile" ]; then
    echo "  ✓ Dockerfile found"
else
    echo "  ✗ Dockerfile missing"
    exit 1
fi

if [ -f "docker-compose.yml" ]; then
    echo "  ✓ docker-compose.yml found"
else
    echo "  ✗ docker-compose.yml missing"
    exit 1
fi

if [ -f ".dockerignore" ]; then
    echo "  ✓ .dockerignore found"
else
    echo "  ✗ .dockerignore missing"
    exit 1
fi

if [ -f ".env.example" ]; then
    echo "  ✓ .env.example found"
else
    echo "  ✗ .env.example missing"
    exit 1
fi

echo ""
echo "✓ Checking documentation..."

if [ -f "DOCKER.md" ]; then
    echo "  ✓ DOCKER.md found"
else
    echo "  ✗ DOCKER.md missing"
    exit 1
fi

echo ""
echo "✓ Checking project build..."

if [ -d "dist" ] && [ -f "dist/cli.js" ]; then
    echo "  ✓ Project already built (dist/cli.js exists)"
else
    echo "  ⚠ Project not built yet"
    echo "  Run: npm run build"
fi

echo ""
echo "✓ Verifying package.json scripts..."

if grep -q '"build"' package.json; then
    echo "  ✓ Build script found"
else
    echo "  ✗ Build script missing"
    exit 1
fi

echo ""
echo "=============================="
echo "✅ Docker setup is complete!"
echo ""
echo "Next steps:"
echo "  1. Build the Docker image:"
echo "     docker build -t airlock:latest ."
echo ""
echo "  2. Run with Docker Compose:"
echo "     docker-compose up"
echo ""
echo "  3. Or run directly:"
echo "     docker run -p 3000:3000 airlock node dist/cli.js guard --port 3000 node test-server.js"
echo ""
echo "📚 Full documentation: ./DOCKER.md"
