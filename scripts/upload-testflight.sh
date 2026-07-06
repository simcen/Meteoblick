#!/bin/bash
set -e

# Check if API credentials are configured
if [ -z "$APP_STORE_CONNECT_API_KEY_ID" ] || [ -z "$APP_STORE_CONNECT_API_ISSUER_ID" ]; then
  echo "❌ App Store Connect API credentials not configured"
  echo ""
  echo "Setup instructions:"
  echo "1. Go to https://appstoreconnect.apple.com/access/api"
  echo "2. Create a new API Key with 'App Manager' role"
  echo "3. Download the .p8 file and save it to: ~/.appstoreconnect/private_keys/"
  echo "4. Add to your ~/.zshrc or ~/.bashrc:"
  echo "   export APP_STORE_CONNECT_API_KEY_ID='YOUR_KEY_ID'"
  echo "   export APP_STORE_CONNECT_API_ISSUER_ID='YOUR_ISSUER_ID'"
  echo "   export APP_STORE_CONNECT_API_KEY_PATH='~/.appstoreconnect/private_keys/AuthKey_YOUR_KEY_ID.p8'"
  echo ""
  exit 1
fi

IPA_PATH="ios/build/TestFlight/Meteoblick.ipa"

if [ ! -f "$IPA_PATH" ]; then
  echo "❌ IPA not found at $IPA_PATH"
  echo "Run 'pnpm ios:testflight' first to create the build"
  exit 1
fi

echo "📤 Uploading to TestFlight..."
echo "   IPA: $IPA_PATH"

# Use xcrun altool for upload
xcrun altool --upload-app \
  --type ios \
  --file "$IPA_PATH" \
  --apiKey "$APP_STORE_CONNECT_API_KEY_ID" \
  --apiIssuer "$APP_STORE_CONNECT_API_ISSUER_ID"

echo "✅ Upload complete!"
echo "   Check App Store Connect for processing status"
echo "   Processing usually takes 5-10 minutes"
