#!/bin/bash
set -e

echo "🚀 Deploying backend to Heroku..."

# Check if heroku remote exists
if ! git remote | grep -q "^heroku$"; then
  echo "❌ Heroku remote not found. Add it with:"
  echo "   git remote add heroku https://git.heroku.com/meteoblick-backend.git"
  exit 1
fi

# Get current branch
CURRENT_BRANCH=$(git branch --show-current)

echo "📦 Current branch: $CURRENT_BRANCH"
echo "📂 Pushing backend/ subtree to Heroku..."

# Push backend subdirectory to Heroku main branch
git subtree push --prefix backend heroku main

echo "✅ Deployed successfully!"
echo ""
echo "📊 View logs: heroku logs --tail --app meteoblick-backend"
echo "🌐 Open app: heroku open --app meteoblick-backend"
