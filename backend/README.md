# Meteoblick Backend API

MeteoSwiss weather forecast data API built with Hono, TypeScript, and PostgreSQL.

## Features

- ✅ RESTful API with OpenAPI 3.1 specification
- ✅ Interactive Swagger UI documentation at `/docs`
- ✅ Hourly weather data sync from MeteoSwiss STAC API
- ✅ PostgreSQL database with ~5600 Swiss weather locations
- ✅ Optimized endpoints for mobile widgets (<1KB responses)
- ✅ Heroku deployment ready

## API Endpoints

- `GET /` - API info
- `GET /docs` - Interactive API documentation (Swagger UI)
- `GET /openapi` - OpenAPI specification JSON
- `GET /api/weather/{pointId}` - Get weather for specific location
- `GET /api/pois?search={query}` - Search locations
- `POST /api/admin/sync` - Manually trigger data sync (requires Bearer token)

## API Testing

### Bruno Collection (Recommended)

We provide a [Bruno](https://www.usebruno.com/) collection for easy API testing:

```bash
# Install Bruno
brew install bruno

# Open collection
# File → Open Collection → Select backend/bruno folder
```

See [`bruno/README.md`](./bruno/README.md) for details.

### cURL Examples

```bash
# Get weather for POI 1 (Arosa)
curl http://localhost:3000/api/weather/1

# Search POIs
curl "http://localhost:3000/api/pois?search=Zürich"

# Trigger manual sync (requires admin token)
curl -X POST http://localhost:3000/api/admin/sync \
  -H "Authorization: Bearer dev-secret-token-12345"
```

## Development

### Prerequisites

- Node.js 20+
- PostgreSQL 14+
- pnpm (or npm)

### Setup

```bash
cd backend
pnpm install
cp .env.example .env
# Edit .env with your PostgreSQL credentials
```

### Run locally

```bash
# Start dev server with hot reload
pnpm dev

# Manual sync (one-time)
pnpm sync

# Build for production
pnpm build
pnpm start
```

Server runs on `http://localhost:3000`
API docs: `http://localhost:3000/docs`

## Database Schema

### `pois` table
- `point_id` (PK): MeteoSwiss point identifier
- `point_name`: Location name (e.g., "Arosa", "Zürich")
- `postal_code`: Swiss postal code (nullable)
- `latitude`, `longitude`: WGS84 coordinates
- `height_masl`: Elevation in meters above sea level

### `weather` table
- `point_id` (FK to pois): Location reference
- `temperature`: Current temperature (°C)
- `symbol_code`: Weather symbol code (1-9)
- `precipitation`: Precipitation amount (mm)
- `timestamp`: Forecast timestamp
- `updated_at`: Last sync time

## Deployment to Heroku

### 1. Create Heroku app

```bash
heroku create meteoblick-api
heroku addons:create heroku-postgresql:essential-0
```

### 2. Set environment variables

```bash
heroku config:set NODE_ENV=production
heroku config:set API_BASE_URL=https://meteoblick-api.herokuapp.com
```

### 3. Deploy

```bash
git init
git add .
git commit -m "Initial backend"
heroku git:remote -a meteoblick-api
git push heroku main
```

### 4. Verify

```bash
heroku logs --tail
heroku open /docs
```

## CRON Job

The app runs a cron job every hour (`0 * * * *`) to sync:
1. POI list from MeteoSwiss metadata CSV (~5600 locations)
2. Weather forecast from latest STAC item (temperature, symbol, precipitation)

Disable cron with: `ENABLE_CRON=false`

## Tech Stack

- **Runtime:** Node.js 20 + TypeScript
- **Framework:** Hono (ultra-fast, edge-ready)
- **Validation:** Zod
- **OpenAPI:** @hono/zod-openapi
- **API Docs:** Scalar API Reference
- **Database:** PostgreSQL
- **ORM:** node-postgres (pg)
- **Scheduler:** node-cron
- **CSV Parser:** PapaParse

## License

MIT
