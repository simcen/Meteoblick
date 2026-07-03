#!/bin/bash
# Reset iOS Widget
# Removes and re-adds the widget to force iOS to reload it

echo "🔄 Resetting iOS Widget..."

# Get booted device
DEVICE_ID=$(xcrun simctl list devices | grep "Booted" | grep -o '\([A-Z0-9-]\{36\}\)' | head -1)

if [ -z "$DEVICE_ID" ]; then
  echo "❌ No booted simulator found"
  exit 1
fi

echo "📱 Found booted device: $DEVICE_ID"

# Kill SpringBoard to reset Home Screen (this resets all widgets)
echo "🔄 Resetting SpringBoard..."
xcrun simctl spawn booted launchctl stop com.apple.SpringBoard

echo "⏳ Waiting for SpringBoard to restart..."
sleep 3

echo "✅ Widget reset complete!"
echo "ℹ️  You may need to re-add the widget to the Home Screen"
