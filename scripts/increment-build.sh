#!/bin/bash
set -e

# Get current build number from Info.plist
CURRENT_BUILD=$(plutil -extract CFBundleVersion raw ios/Meteoblick/Info.plist)

# Increment
NEW_BUILD=$((CURRENT_BUILD + 1))

echo "📦 Incrementing build number: $CURRENT_BUILD → $NEW_BUILD"

# Update Info.plist (main app)
plutil -replace CFBundleVersion -string "$NEW_BUILD" ios/Meteoblick/Info.plist

# Update Info.plist (widget extension)
plutil -replace CFBundleVersion -string "$NEW_BUILD" ios/ExpoWidgetsTarget/Info.plist

# Update CURRENT_PROJECT_VERSION — the widget target generates its Info.plist
# (GENERATE_INFOPLIST_FILE), so this setting overrides the plist value above
perl -pi -e "s/CURRENT_PROJECT_VERSION = \d+;/CURRENT_PROJECT_VERSION = $NEW_BUILD;/" ios/Meteoblick.xcodeproj/project.pbxproj

# Update app.json — `expo prebuild` regenerates ios/ from this value
perl -pi -e "s/\"buildNumber\": \"\d+\"/\"buildNumber\": \"$NEW_BUILD\"/" app.json

# Update BUILD_NUMBER in constants.ts with timestamp-based format
TIMESTAMP=$(date +%y%m%d-%H%M)
CONST_FILE="src/constants.ts"

if [[ "$OSTYPE" == "darwin"* ]]; then
  sed -i '' "s/export const BUILD_NUMBER = '.*';/export const BUILD_NUMBER = '$TIMESTAMP';/" "$CONST_FILE"
else
  sed -i "s/export const BUILD_NUMBER = '.*';/export const BUILD_NUMBER = '$TIMESTAMP';/" "$CONST_FILE"
fi

echo "✅ Build number updated to $NEW_BUILD"
echo "✅ BUILD_NUMBER constant updated to $TIMESTAMP"
