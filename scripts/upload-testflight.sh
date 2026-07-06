#!/bin/bash
set -e

# TestFlight Upload Script
# Requires:
# - App-specific password from https://appleid.apple.com/
# - Set TESTFLIGHT_PASSWORD env var or use keychain

PASSWORD_SOURCE="${TESTFLIGHT_PASSWORD:-@keychain:AC_PASSWORD}"

echo "🚀 Uploading to TestFlight..."

# Find latest archive in Xcode Organizer
ARCHIVE_DATE=$(date +%Y-%m-%d)
ARCHIVE_DIR="$HOME/Library/Developer/Xcode/Archives/$ARCHIVE_DATE"

if [ ! -d "$ARCHIVE_DIR" ]; then
  echo "❌ No archive directory found for $ARCHIVE_DATE"
  echo "   Run: pnpm ios:archive"
  exit 1
fi

# Get latest archive
LATEST_ARCHIVE=$(ls -td "$ARCHIVE_DIR"/Meteoblick*.xcarchive 2>/dev/null | head -1)

if [ -z "$LATEST_ARCHIVE" ]; then
  echo "❌ No Meteoblick archive found in $ARCHIVE_DIR"
  exit 1
fi

echo "📦 Archive: $LATEST_ARCHIVE"

# Always export fresh from latest archive
EXPORT_DIR="$HOME/Library/Developer/Xcode/Archives/export"
IPA_PATH="$EXPORT_DIR/Meteoblick.ipa"

echo "📦 Exporting archive..."
rm -rf "$EXPORT_DIR"
mkdir -p "$EXPORT_DIR"

xcodebuild -exportArchive \
  -archivePath "$LATEST_ARCHIVE" \
  -exportPath "$EXPORT_DIR" \
  -exportOptionsPlist "ios/ExportOptions.plist" || {
    echo "❌ Export failed. Common issues:"
    echo "   - Provisioning profile missing"
    echo "   - Wrong team ID"
    echo "   - Try: open Xcode → Fix signing → Try again"
    exit 1
  }

# Verify build number
IPA_BUNDLE_VERSION=$(plutil -extract CFBundleVersion raw "$EXPORT_DIR/Meteoblick.app/Info.plist" 2>/dev/null)
echo "📋 IPA Build Number: $IPA_BUNDLE_VERSION"

echo "📤 Uploading to App Store Connect..."

xcrun altool --upload-app --type ios \
  --file "$IPA_PATH" \
  --username "${TESTFLIGHT_USERNAME:-simon.balz@mac.com}" \
  --password "$PASSWORD_SOURCE"

echo "✅ Upload complete! Check App Store Connect → TestFlight"
