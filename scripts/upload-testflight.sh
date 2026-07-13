#!/bin/bash
set -e

# TestFlight Upload via iTMSTransporter + App Store Connect API key (.p8).
#
# Apple deprecated altool for notarization in Xcode 13 and the path for
# iOS App Store Connect uploads is the same direction — iTMSTransporter
# (the same backend Transporter.app uses) is the supported route in 2026.
# See: https://developer.apple.com/documentation/technotes/tn3147-migrating-to-the-latest-notarization-tool
#
# One-time setup:
# 1. Generate an App Manager API key at
#    https://appstoreconnect.apple.com/access/api
# 2. Download the .p8 file — Apple only shows it ONCE.
# 3. Set the three env vars below (in ~/.zshrc is fine):
#      ASC_API_KEY_PATH   absolute path to the .p8
#      ASC_API_KEY_ID     10-char Key ID (e.g. JV2T936XNJ)
#      ASC_API_ISSUER_ID  UUID-shaped Issuer ID
# 4. Drop the old teamID from ios/ExportOptions.plist — the API key's
#    Issuer binds the team, so no manual team selection is needed.

# Defaults for this project; override via env vars if you rotate keys.
API_KEY_PATH="${ASC_API_KEY_PATH:-/Users/simcen/Documents/AuthKey_JV2T936XNJ.p8}"
API_KEY_ID="${ASC_API_KEY_ID:-JV2T936XNJ}"
API_ISSUER_ID="${ASC_API_ISSUER_ID:-69a6de6f-1a11-47e3-e053-5b8c7c11a4d1}"

# Validate .p8 exists before doing any work
if [ ! -f "$API_KEY_PATH" ]; then
  echo "❌ API key file not found: $API_KEY_PATH"
  echo "   Set ASC_API_KEY_PATH or download the .p8 from App Store Connect."
  echo "   (Note: Apple only shows the .p8 ONCE when you create the key.)"
  exit 1
fi

# Resolve archive path. Accept as $1 for explicit control, or default
# to the path archive-ios.sh writes to.
ARCHIVE_PATH="${1:-ios/build/Meteoblick.xcarchive}"

if [ ! -d "$ARCHIVE_PATH" ]; then
  echo "❌ Archive not found: $ARCHIVE_PATH"
  echo "   Run: pnpm ios:archive"
  exit 1
fi

echo "📦 Archive: $ARCHIVE_PATH"

# Export archive → IPA. teamID is intentionally absent from ExportOptions.plist;
# the API key's Issuer ID binds the team automatically.
EXPORT_DIR="ios/build/export"
IPA_PATH="$EXPORT_DIR/Meteoblick.ipa"

echo "📦 Exporting archive to IPA..."
rm -rf "$EXPORT_DIR"
mkdir -p "$EXPORT_DIR"

xcodebuild -exportArchive \
  -archivePath "$ARCHIVE_PATH" \
  -exportPath "$EXPORT_DIR" \
  -exportOptionsPlist ios/ExportOptions.plist

if [ ! -f "$IPA_PATH" ]; then
  echo "❌ Export failed — IPA not produced."
  echo "   Check ios/ExportOptions.plist and signing setup."
  exit 1
fi

# Surface the build number for traceability
IPA_BUNDLE_VERSION=$(plutil -extract CFBundleVersion raw "$EXPORT_DIR/Meteoblick.app/Info.plist" 2>/dev/null || echo "?")
echo "📋 IPA Build Number: $IPA_BUNDLE_VERSION"

# Upload via iTMSTransporter (Apple's first-party uploader).
#
# .p8 discovery: iTMSTransporter does NOT take the .p8 path as a CLI flag.
# Per the Apple Transporter User Guide it searches these fixed paths only
# (in order):
#   <current_directory>/private_keys
#   <user_home>/private_keys
#   <user_home>/.private_keys
#   <user_home>/.appstoreconnect/private_keys
#
# The .p8 file MUST be named AuthKey_<KEY_ID>.p8. TRANSPORTER_HOME is NOT
# in the search list — that's a misconception on Apple's part in their
# earlier docs but confirmed not to apply.
#
# We symlink the user's .p8 into ~/private_keys/ (the first search path)
# on every run. Idempotent: re-creates the symlink if missing or broken.
# User's actual file stays wherever they chose to put it.

PRIVATE_KEYS_DIR="$HOME/private_keys"
SYMLINK_PATH="$PRIVATE_KEYS_DIR/$(basename "$API_KEY_PATH")"

mkdir -p "$PRIVATE_KEYS_DIR"

# Recreate symlink if it doesn't exist OR is broken (source moved/deleted).
# `ln -sf` followed by `test -e` is the standard check.
if [ ! -e "$SYMLINK_PATH" ]; then
  ln -sf "$API_KEY_PATH" "$SYMLINK_PATH"
  echo "🔗 Symlinked: $SYMLINK_PATH → $API_KEY_PATH"
fi

# Correct flag set (per Apple Transporter User Guide):
#   -assetFile   path to the .ipa
#   -apiKey      App Store Connect Key ID (must match AuthKey_<KEY_ID>.p8)
#   -apiIssuer   Issuer ID (UUID)
#   -asc_provider optional, only if user has multiple App Store Connect providers
echo "📤 Uploading to TestFlight via iTMSTransporter..."

# -asc_provider is optional — only required when the user account is
# attached to multiple App Store Connect providers. Set ASC_PROVIDER
# env var if you see "Multiple providers found" errors.
ASC_PROVIDER_FLAG=""
if [ -n "${ASC_PROVIDER:-}" ]; then
  ASC_PROVIDER_FLAG="-asc_provider $ASC_PROVIDER"
fi

xcrun iTMSTransporter -m upload \
  -assetFile "$IPA_PATH" \
  -apiKey "$API_KEY_ID" \
  -apiIssuer "$API_ISSUER_ID" \
  $ASC_PROVIDER_FLAG

echo "✅ Upload complete! Check App Store Connect → TestFlight"
