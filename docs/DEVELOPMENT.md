# Development Workflow

## Prerequisites

- Node.js 20+
- pnpm 10+
- Xcode 16+ (für iOS)
- iOS 26.5 Simulator (iPhone 17 Pro)
- PostgreSQL 14+ (für Backend)

## Project Structure

```
Meteoblick/
├── app/                    # React Native App (Expo)
├── backend/               # Hono API Backend
├── ios/                   # Native iOS Code
├── modules/widget-reload/ # Native Widget Bridge
└── docs/                  # Documentation
```

## Development Scripts

### App (Root Directory)

```bash
# Start Expo Metro bundler
pnpm start

# Start with cleared cache (use when code updates don't reflect)
pnpm dev

# Build and run on iOS Simulator (iPhone 17 Pro)
pnpm ios

# Clean build (when native code changes)
pnpm ios:clean

# Build iOS and reset widget (use after widget code changes)
pnpm ios:widget

# Reset widget only (force iOS to reload widget)
pnpm widget:reset

# Clean all caches
pnpm clean
```

### Backend

```bash
cd backend

# Start dev server with hot reload
pnpm dev

# Build for production
pnpm build

# Start production server
pnpm start

# Manual MeteoSwiss sync
pnpm sync
```

## When You See Old Build Number

**Problem:** App shows old build number after changes.

**Solution:**
```bash
# 1. Stop all processes
pkill -f "expo|metro"

# 2. Clean caches
pnpm clean

# 3. Rebuild and run (automatic)
pnpm ios
```

**If still showing old build (native code changed):**
```bash
pnpm ios:clean
```

## When to Update Build Number

Update build number (`YYMMDD-HHMM`) when:
- ✅ Native code changes (Swift, widget, native modules)
- ✅ Package.json dependencies change
- ✅ Widget implementation changes
- ❌ UI-only changes (React components, styles) - hot reload handles this

**Files to update:**
1. `src/screens/HomeScreen.tsx` → `BUILD_NUMBER`
2. `src/screens/DebugScreen.tsx` → `BUILD_NUMBER`
3. `ios/ExpoWidgetsTarget/index.swift` → `buildNumber`

**After widget changes:**
```bash
# Build and automatically reset widget
pnpm ios:widget
```

This builds the app and resets the widget by restarting SpringBoard, forcing iOS to reload the widget with new code.

## Backend Development

```bash
cd backend
pnpm dev
```

Backend runs on `http://localhost:3000`
- API Docs: `http://localhost:3000/docs`
- OpenAPI: `http://localhost:3000/openapi`

## Common Issues

### "Module not found" after dependency change
```bash
pnpm install
cd ios && pod install && cd ..
pnpm ios:clean
```

### Widget not updating
1. Check backend is running (`pnpm dev` in backend/)
2. Check Xcode console for widget errors
3. Rebuild: `pnpm ios:clean`

### Metro bundler stuck
```bash
pkill -f "metro"
pnpm clean
pnpm dev
```

## Debugging

### iOS Logs
```bash
# Watch all logs
xcrun simctl spawn booted log stream --level debug

# Filter for app
xcrun simctl spawn booted log stream --predicate 'processImagePath contains "Meteoblick"'
```

### Backend Logs
Backend uses `console.log` - all output in terminal where `pnpm dev` runs.

## Testing Flow

1. Start backend: `cd backend && pnpm dev`
2. Start app: `pnpm dev` (from root)
3. Press `i` to open iOS Simulator
4. Test POI search → Weather load → Widget update

## Release Checklist

- [ ] Update build number
- [ ] Test on iOS 26 Simulator
- [ ] Verify widget shows correct data
- [ ] Check backend API responses
- [ ] Commit changes
