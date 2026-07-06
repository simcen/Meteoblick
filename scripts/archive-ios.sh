#!/bin/bash
set -e

# Increment build number
./scripts/increment-build.sh

echo "📦 Building archive..."

# Build archive
cd ios
xcodebuild -workspace Meteoblick.xcworkspace \
  -scheme Meteoblick \
  -configuration Release \
  -archivePath build/Meteoblick.xcarchive \
  archive

# Copy to Xcode's archive location for Organizer with timestamp
ARCHIVE_DATE=$(date +%Y-%m-%d)
ARCHIVE_TIME=$(date +%H%M%S)
XCODE_ARCHIVE_DIR="$HOME/Library/Developer/Xcode/Archives/$ARCHIVE_DATE"
ARCHIVE_NAME="Meteoblick-$ARCHIVE_TIME.xcarchive"

echo "📁 Copying archive to Xcode Organizer location..."
mkdir -p "$XCODE_ARCHIVE_DIR"
cp -R build/Meteoblick.xcarchive "$XCODE_ARCHIVE_DIR/$ARCHIVE_NAME"

echo "✅ Archive complete!"
echo "   Local: ios/build/Meteoblick.xcarchive"
echo "   Organizer: $XCODE_ARCHIVE_DIR/$ARCHIVE_NAME"
echo "   (Refresh Xcode → Window → Organizer to see it)"