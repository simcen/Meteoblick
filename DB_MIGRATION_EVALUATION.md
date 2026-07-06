# Database Migration Framework Evaluation

## Current Approach: Raw SQL in `db.ts`

**Pros:**
- Zero dependencies
- Full control über SQL
- Keine Abstraktion-Overhead

**Cons:**
- ❌ Manuelle Migration-Logic (IF NOT EXISTS Blocks sind fehleranfällig)
- ❌ Keine Migration History / Rollback
- ❌ Keine Type Safety zwischen DB Schema und TypeScript Types
- ❌ Schwierig zu testen (keine separate Migration Files)
- ❌ Keine automatische Schema-Generierung aus Models

## Recommended: Prisma

**Warum Prisma?**
1. **Automatische Migrations**: `prisma migrate dev` generiert SQL-Files
2. **Type Safety**: Schema → TypeScript Types automatisch generiert
3. **Migration History**: Jede Migration ist versioniert (`.sql` Files in `prisma/migrations/`)
4. **Rollback Support**: `prisma migrate resolve --rolled-back`
5. **Zero-Downtime Migrations**: Erkennt Breaking Changes
6. **Prisma Studio**: GUI für DB Debugging
7. **Heroku-kompatibel**: Standard `DATABASE_URL` Support

**Migration Flow:**
```bash
# 1. Schema definieren
# prisma/schema.prisma
model Weather {
  point_id             String   @id
  temperature_actual   Float
  temperature_forecast Float
  timestamp_actual     DateTime
  timestamp_forecast   DateTime
  updated_at           DateTime @default(now())
}

# 2. Migration erstellen
pnpm prisma migrate dev --name add-forecast-temperature

# 3. Migration wird automatisch generiert:
# prisma/migrations/20260706_add_forecast_temperature/migration.sql

# 4. Auf Heroku: automatisch via Procfile
release: pnpm prisma migrate deploy
```

**Code Before (Current):**
```typescript
// types.ts - manually maintained
export interface WeatherData {
  point_id: string;
  temperature_actual: number;
  // ...
}

// db.ts - manual migration logic
await client.query(`
  DO $$
  BEGIN
    IF NOT EXISTS (...) THEN
      ALTER TABLE weather ADD COLUMN temperature_actual DOUBLE PRECISION;
    END IF;
  END $$;
`);
```

**Code After (Prisma):**
```typescript
// prisma/schema.prisma (Single Source of Truth)
model Weather {
  point_id             String   @id
  temperature_actual   Float
  temperature_forecast Float
}

// Auto-generated types
import { Weather } from '@prisma/client';

// Auto-typed queries
const weather = await prisma.weather.findUnique({
  where: { point_id: '1' }
});
// weather.temperature_actual is typed as number
```

## Alternative: Drizzle ORM

**Pros:**
- Leichtgewichtiger als Prisma
- TypeScript-first (kein Schema DSL)
- Bessere Performance

**Cons:**
- Weniger Tooling als Prisma
- Kleinere Community

## Recommendation

**Migrate zu Prisma** weil:
1. Deine aktuellen Manual Migrations sind bereits komplex (DO $$ Blocks)
2. Type Safety zwischen DB und TS fehlt (WeatherData Interface manuell)
3. Keine Migration History → schwer zu debuggen auf Heroku
4. Prisma ist Industry Standard für Node.js + PostgreSQL

## Migration Plan

**Phase 1: Setup Prisma (30 min)**
```bash
cd backend
pnpm add -D prisma
pnpm add @prisma/client
pnpm prisma init
```

**Phase 2: Introspect Existing DB**
```bash
# Generiert schema.prisma aus aktueller Heroku DB
pnpm prisma db pull
```

**Phase 3: Baseline Migration**
```bash
# Markiert aktuelle DB als "baseline"
pnpm prisma migrate resolve --applied "0_init"
```

**Phase 4: Refactor Code**
- Replace raw SQL queries mit Prisma Client
- Remove manual migration logic
- Generate TypeScript types

**Phase 5: Deploy**
```bash
# Heroku Procfile: release: pnpm prisma migrate deploy
git push heroku main
```

## Decision

✅ **Use Prisma** für:
- Type Safety
- Migration History
- Automatic Schema → Types
- Better Developer Experience

Aktuelles Raw SQL System ist für Production zu fehleranfällig.
