# Meteoblick API - Bruno Collection

API client collection for [Bruno](https://www.usebruno.com/) - an open-source API client.

## Setup

1. **Install Bruno:**
   ```bash
   brew install bruno
   ```
   Or download from: https://www.usebruno.com/downloads

2. **Open Collection:**
   - Launch Bruno
   - Click "Open Collection"
   - Navigate to: `backend/bruno`
   - Select the folder

3. **Select Environment:**
   - Click environment dropdown (top right)
   - Choose "Local" for development or "Production" for Heroku

## Environments

### Local
- **Base URL:** `http://localhost:3000`
- **Admin Token:** `dev-secret-token-12345`

### Production
- **Base URL:** `https://meteoblick-api.apps.balz.me`
- **Admin Token:** Set in `environments/Production.bru` after deployment

## Available Requests

### Public Endpoints
- **Get API Info** - Root endpoint with API overview
- **Get Weather by POI** - Fetch weather for specific location
- **Get All POIs** - List all available weather stations
- **Search POIs** - Search by name or postal code

### Admin Endpoints (requires token)
- **Trigger Sync** - Manually trigger MeteoSwiss data sync

## Quick Test

After starting the dev server (`pnpm dev`):

1. Run "Get API Info" → should return 200 with endpoint list
2. Run "Get Weather by POI" → should return weather for Arosa (POI 1)
3. Run "Trigger Sync" with admin token → should start data sync

## Notes

- Admin token is stored in `.env` file (not committed to Git)
- Update `Production.bru` with actual Heroku token after deployment
- Collection auto-updates when API changes are deployed
