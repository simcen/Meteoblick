# Meteoblick Backend API

MeteoSwiss weather forecast data API built with Hono, TypeScript, and PostgreSQL.

## Features

- ✅ RESTful API with OpenAPI 3.1 specification
- ✅ Interactive Swagger UI documentation at `/docs`
- ✅ Hourly weather data sync from MeteoSwiss STAC API
- ✅ PostgreSQL database with ~5600 Swiss weather locations
- ✅ Optimized endpoints for mobile widgets (<1KB responses)
- ✅ Deployed with Coolify (auto deploy on push to `main`)

## API Endpoints

- `GET /` - API info
- `GET /docs` - Interactive API documentation (Swagger UI)
- `GET /openapi` - OpenAPI specification JSON
- `GET /api/weather/{pointId}` - Get weather for specific location
- `GET /api/pois?search={query}` - Search locations
- `GET /api/widget/timeline?poiId={poiId}` - Single-shot payload for the iOS widget
- `GET /api/loxone/sensors` - Temperature sensors of the Loxone Miniserver
- `GET /api/loxone/temperatures?uuids={uuid,...}` - Current sensor values
- `POST /api/admin/sync` - Manually trigger data sync (requires Bearer token)

## Authentication

All `/api` endpoints require the pre-shared secret from the `API_TOKEN`
environment variable:

```
Authorization: Bearer <API_TOKEN>
```

The app reads the same value at build time from `EXPO_PUBLIC_API_TOKEN` in
the repository's `.env.local` (not committed) and passes it on to the widget.
Generate one with `openssl rand -hex 32`. `/api/admin/*` uses its own
`ADMIN_TOKEN` instead.

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

## Deployment (Coolify)

The API runs as a Coolify application in the same network as the Loxone
Miniserver. The Miniserver address and credentials are configured here as
environment variables only — the app never sees them.

- **Source:** GitHub App, repository `simcen/Meteoblick`, branch `main`,
  base directory `/backend`
- **Deploy:** every push to `main` triggers a deployment
  (Advanced → Deployment → Auto deploy: "Deploy on push (webhooks)")
- **Build / start:** `pnpm build` (`prisma generate`) / `pnpm start`
- **Migrations:** `pnpm prisma:migrate` (`prisma migrate deploy`) has to run
  after schema changes, e.g. as a pre-deployment command

### Environment variables

| Variable | Purpose |
|---|---|
| `NODE_ENV` | `production` |
| `DATABASE_URL` | PostgreSQL connection string |
| `API_BASE_URL` | Public URL, `https://meteoblick-api.apps.balz.me` |
| `ADMIN_TOKEN` | Bearer token for `/api/admin/*` |
| `ENABLE_CRON` | `false` disables the weather sync (optional) |
| `API_TOKEN` | Pre-shared secret; the app sends it as `Authorization: Bearer …`. Without it all `/api` endpoints answer 503 |
| `LOXONE_BASE_URL` | Miniserver address incl. protocol, e.g. `http://192.168.1.47` (optional, enables Loxone) |
| `LOXONE_USERNAME` / `LOXONE_PASSWORD` | Miniserver user (optional, enables Loxone) |

### Verify

```bash
curl -H "Authorization: Bearer $API_TOKEN" https://meteoblick-api.apps.balz.me/api/debug
open https://meteoblick-api.apps.balz.me/docs
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

tbd
