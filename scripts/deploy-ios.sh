#!/bin/bash
set -e

ARCHIVE_PATH="ios/build/Meteoblick.xcarchive"
BUNDLE_PATH="ios/main.jsbundle"

# Check if archive exists
if [ ! -d "$ARCHIVE_PATH" ]; then
  echo "📦 No archive found, building from scratch..."
  # Don't increment here - ios:archive already does it
  pnpm ios:archive
else
  # Find newest source file
  NEWEST_SRC=$(find src -type f \( -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" \) -print0 | xargs -0 stat -f "%m %N" | sort -rn | head -1 | cut -d' ' -f2-)
  NEWEST_SRC_TIME=$(stat -f "%m" "$NEWEST_SRC" 2>/dev/null || echo 0)

  # Get archive timestamp
  ARCHIVE_TIME=$(stat -f "%m" "$ARCHIVE_PATH" 2>/dev/null || echo 0)

  if [ $NEWEST_SRC_TIME -gt $ARCHIVE_TIME ]; then
    echo "🔄 Source files changed since last build, rebuilding..."
    echo "   Changed: $NEWEST_SRC"
    pnpm ios:archive
  else
    echo "✅ Archive is up to date, skipping build"
  fi
fi

echo "📱 Installing on connected iPhone..."

# Find first connected iPhone device ID
DEVICE_ID=$(xcrun devicectl list devices 2>/dev/null | grep 'iPhone' | grep 'connected' | awk '{print $3}' | head -1)

if [ -z "$DEVICE_ID" ]; then
  echo "❌ No connected iPhone found. Please connect your iPhone via USB."
  exit 1
fi

echo "   Device: $(xcrun devicectl list devices 2>/dev/null | grep "$DEVICE_ID" | awk '{print $1}')"
cd ios && xcrun devicectl device install app --device "$DEVICE_ID" build/Meteoblick.xcarchive/Products/Applications/Meteoblick.app
