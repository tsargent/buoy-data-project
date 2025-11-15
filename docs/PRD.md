# PRD: Buoy Data Backend + Real-Time Sonification System

## 1. Overview  

A small TypeScript backend that ingests NOAA buoy data, stores it in Postgres, processes it with a worker queue, and streams normalized events to an audio client in real time. Designed to demonstrate full-stack engineering skills with a creative twist.

## 2. Project Goals

- Fetch buoy data on a schedule.
- Store structured readings in Postgres.
- Use BullMQ and Redis for ingestion and processing.
- Expose a REST API for buoy data.
- Provide real-time updates via SSE or WebSocket.
- Emit normalized events to an audio client.
- Use PNPM workspaces and TypeScript across the monorepo.
- Keep local development simple with Docker.

### Non-Goals

- No user accounts or authentication.
- No advanced frontend UI.
- No complex historical analytics.
- No cloud deployment required.

## 3. User Stories

### Developer

- Run pnpm dev to start everything.
- Run migrations easily.
- Inspect the DB to confirm ingestion.
- See worker logs for job processing.
- Subscribe to a real-time stream of buoy events.

### Audio Client

- Connect to `/stream` or a WebSocket endpoint.
- Receive normalized buoy readings.
- Use a predictable event schema.
- See `docs/AUDIO_CLIENTS.md` for supported client environments (WebAudio, ChucK, Max, SuperCollider, etc.), transports, and mapping guidance.

## 4. Functional Requirements

### Ingestion

- Fetch buoy data from NOAA at a configurable interval.
- Add each fetch request as a job to the ingest queue.
- Handle API errors gracefully.

### Processing

- Worker pulls ingest jobs, parses data, validates fields, writes readings to Postgres, and pushes processed events to a broadcast mechanism.

### Real-Time Stream

- Server exposes SSE `(GET /stream)` or WebSocket (SSE by default).
- Each event includes fields like:
  
  ```ts
  {
    buoyId: string,
    timestamp: string,
    waveHeight: number,
    windSpeed: number,
    windDirection: number,
    waterTemp: number,
    airTemp: number,
  }
  ```

### API Endpoints

- `GET /stations` — list active stations
- `GET /stations/:id` — station details
- `GET /observations/by-station/:stationId?limit=100&since=ISO_DATE` — recent observations (descending by observedAt, returned oldest-first)
- `GET /health` — service health

### Database Structure

**stations** table: id, name, lat, lon, source, isActive, createdAt, updatedAt

**observations** table: id, stationId, observedAt, waveHeightM, windSpeedMps, windDirDeg, waterTempC, pressureHpa, createdAt

## 5. Non-Functional Requirements

- Ingestion + processing < 1 second each cycle.
- Real-time broadcast latency < 200ms.
- Retry failed jobs with backoff.
- Minimal surface area, no sensitive data.
- Horizontal scaling supported (multiple workers).

## 6. Architecture Overview

### Monorepo Layout (PNPM)

```txt
apps/
  server/
  worker/

packages/
  shared/

docs/
  PRD.md

docker-compose.yml
```

### Technologies

- Node 20, TypeScript
- Fastify
- BullMQ + Redis
- Postgres + Prisma ORM (Prisma Client, Prisma Migrate, Prisma Studio)
- Docker Compose for services

## 7. Data Flow

1. Scheduler triggers a buoy fetch.
2. Request becomes a job in the ingest queue.
3. Worker processes job: fetch → normalize → store.
4. Worker emits processed event.
5. Server streams event to connected clients.

## 8. Event Stream Format

```txt
event: observation
data: {"stationId":"44009","timestamp":"...","waveHeightM":1.2,"windSpeedMps":5.1,"windDirDeg":180,"waterTempC":12.4,"pressureHpa":1012.8}
```

## 9. Logging & Telemetry

- Use structured logs via pino.
- Worker logs job lifecycle.
- Server logs connection counts for streams.

## 10. Local Dev Flow

1. Clone repo → pnpm install
1. Run docker compose up for Postgres + Redis
1. Start server: `pnpm -F @app/server dev`
1. Start worker: `pnpm -F worker dev`
1. Run Prisma migrations: `pnpm -F @app/server prisma:migrate`
1. Hit `/health` and `/stream` (once implemented) to confirm everything works

## 11. Open Questions

- SSE or WebSocket by default?
- Track one buoy or many?
- How much history to persist?
- Batch insert readings or single-row writes?
