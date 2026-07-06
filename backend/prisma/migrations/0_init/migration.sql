-- CreateTable
CREATE TABLE IF NOT EXISTS "pois" (
    "point_id" VARCHAR(10) NOT NULL,
    "point_name" VARCHAR(255) NOT NULL,
    "postal_code" VARCHAR(10),
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "height_masl" INTEGER,
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pois_pkey" PRIMARY KEY ("point_id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "weather" (
    "point_id" VARCHAR(10) NOT NULL,
    "symbol_code" INTEGER NOT NULL,
    "precipitation" DOUBLE PRECISION NOT NULL,
    "updated_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "temperature_actual" DOUBLE PRECISION NOT NULL,
    "temperature_forecast" DOUBLE PRECISION NOT NULL,
    "timestamp_actual" TIMESTAMP(6) NOT NULL,
    "timestamp_forecast" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "weather_pkey" PRIMARY KEY ("point_id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_pois_name" ON "pois"("point_name");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_pois_postal_code" ON "pois"("postal_code");

-- AddForeignKey
ALTER TABLE "weather" ADD CONSTRAINT "weather_point_id_fkey" FOREIGN KEY ("point_id") REFERENCES "pois"("point_id") ON DELETE NO ACTION ON UPDATE NO ACTION;
