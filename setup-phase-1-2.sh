#!/bin/bash

# Phase 1.2: Supabase Setup Quick Start
# This script helps you set up Supabase for ParLeap

set -e

echo "🚀 ParLeap Phase 1.2: Supabase Setup"
echo "===================================="
echo ""

# Check if we're in the project root
if [ ! -f "package.json" ]; then
  echo "❌ Error: Please run this script from the project root directory"
  exit 1
fi

echo "📋 Phase 1.2 Setup Steps:"
echo ""
echo "1️⃣  Manual Steps (Required):"
echo "   • Go to https://supabase.com and create a new project"
echo "   • Save your database password securely"
echo "   • Wait for project creation (~2 minutes)"
echo ""
echo "2️⃣  Get Your API Keys:"
echo "   • In Supabase: Settings → API"
echo "   • Copy Project URL"
echo "   • Copy 'anon public' key"
echo "   • Copy 'service_role' key"
echo ""
echo "3️⃣  Create Environment Files:"
echo ""

# Create backend .env if it doesn't exist
if [ ! -f "backend/.env" ]; then
  echo "📝 Creating backend/.env..."
  cat > backend/.env << 'EOF'
PORT=3001
NODE_ENV=development

# Get these from Supabase: Settings → API
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here

CORS_ORIGIN=http://localhost:3000
EOF
  echo "✅ Created backend/.env"
  echo "   ⚠️  Edit this file and add your Supabase credentials"
else
  echo "✅ backend/.env already exists"
fi

echo ""

# Create frontend .env.local if it doesn't exist
if [ ! -f "frontend/.env.local" ]; then
  echo "📝 Creating frontend/.env.local..."
  cat > frontend/.env.local << 'EOF'
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
NEXT_PUBLIC_WS_URL=ws://localhost:3001
EOF
  echo "✅ Created frontend/.env.local"
  echo "   ⚠️  Edit this file and add your Supabase credentials"
else
  echo "✅ frontend/.env.local already exists"
fi

echo ""
echo "4️⃣  Next Steps:"
echo ""
echo "   a) Run database migration in Supabase:"
echo "      • Go to Supabase SQL Editor → New Query"
echo "      • Copy contents of: supabase/migrations/001_initial_schema.sql"
echo "      • Paste and click Run"
echo ""
echo "   b) Seed test data (after migration):"
echo "      cd backend"
echo "      npm install"
echo "      npx ts-node src/utils/seedDatabase.ts"
echo ""
echo "   c) Start the servers:"
echo "      Terminal 1: cd backend && npm run dev"
echo "      Terminal 2: cd frontend && npm run dev"
echo ""
echo "   d) Test the integration:"
echo "      Visit: http://localhost:3000/test-websocket"
echo "      Enter the Event ID from seed output"
echo "      Click 'Start Session'"
echo ""
echo "📚 For detailed guide, see: PHASE_1_2_GUIDE.md"
echo ""

