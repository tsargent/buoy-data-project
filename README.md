# Buoy Sonification Project

[![CI](https://github.com/tsargent/buoy-data-project/actions/workflows/ci.yml/badge.svg)](https://github.com/tsargent/buoy-data-project/actions/workflows/ci.yml)

Transform real-time and historical NOAA buoy observations into reliable, well-structured APIs and derived sonification events for exploratory auditory analytics.

<img width="1536" height="1024" alt="ChatGPT Image Nov 14, 2025, 11_40_20 PM" src="https://github.com/user-attachments/assets/d125c417-db27-4ba9-898a-eb448ca11277" />


## 🏗️ Architecture

This is a TypeScript monorepo using pnpm workspaces:

```text
apps/
  server/     - Fastify REST API
  worker/     - BullMQ background job processor
  web-demo/   - (Future) Web audio client demo

packages/
  shared/     - Shared types and schemas

docs/
  PRD.md               - Product requirements
  AUDIO_CLIENTS.md     - Audio integration guide
```

**Tech Stack:**

- **Runtime**: Node.js 20+ with TypeScript
- **Server**: Fastify 5 + Prisma ORM
- **Queue**: BullMQ + Redis
- **Database**: PostgreSQL
- **Testing**: Vitest
- **Linting**: ESLint + Prettier

## 📋 Prerequisites

- **Node.js** 20 or later
- **pnpm** 10+ (`npm install -g pnpm`)
- **Docker** & Docker Compose (for local Postgres + Redis)

## 🚀 Quick Start

### 1. Clone and Install

```bash
git clone https://github.com/tsargent/buoy-data-project.git
cd buoy-sonification
pnpm install
```

### 2. Start Services

```bash
# Start Postgres + Redis
docker compose up -d

# Verify services are running
docker compose ps
```

### 3. Configure Environment

```bash
# Server environment
cp apps/server/.env.example apps/server/.env

# Worker environment
cp apps/worker/.env.example apps/worker/.env

# Default configuration works out of the box with Docker services
# Both use: postgresql://postgres:postgres@localhost:5432/buoys
```

### 4. Run Database Migrations

```bash
pnpm -F @app/server prisma:generate
pnpm -F @app/server prisma:migrate
```

### 5. Seed Database with Stations

```bash
pnpm -F @app/server prisma:seed
```

This seeds 5 active NOAA buoy stations:

- 44009: Delaware Bay
- 44013: Boston
- 46022: Eel River, CA
- 46050: Stonewall Bank, OR
- 42001: Mid-Gulf

### 6. Start Development Servers

```bash
# Terminal 1: Start API server
pnpm -F @app/server dev

# Terminal 2: Start worker (ingests real NOAA data every 5 minutes)
pnpm -F worker dev
```

The API will be available at `http://localhost:3000`.

**Worker will automatically**:

- Fetch latest observations from all active stations
- Parse and validate NOAA data
- Store observations in Postgres (handling missing sensors gracefully)
- Ingest ~6,000-7,000 observations per station per run

**Verify it's working**:

```bash
# Check stations
curl http://localhost:3000/v1/stations | jq '.data | length'

# Wait ~10 seconds for first ingestion, then check observations
curl "http://localhost:3000/v1/observations/by-station/44009?limit=5" | jq '.meta.total'

# You should see thousands of observations per station!
```

## 🧪 Testing

```bash
# Run all tests
pnpm test

# Run tests in watch mode
pnpm test

# Run tests with UI
pnpm test:ui

# Run server tests only
pnpm -F @app/server test
```

**Note**: Integration tests expect a test database or will gracefully handle DB unavailability. For full integration testing, ensure Docker services are running.

## 📚 Available Scripts

### Root Level

- `pnpm build` - Build all packages
- `pnpm test` - Run tests in watch mode
- `pnpm test:run` - Run tests once
- `pnpm lint` - Lint all code
- `pnpm format` - Format all code with Prettier

### Server (`apps/server`)

- `pnpm dev` - Start dev server with hot reload
- `pnpm build` - Build for production
- `pnpm start` - Start production server
- `pnpm test` - Run server tests
- `pnpm prisma:generate` - Generate Prisma client
- `pnpm prisma:migrate` - Run database migrations
- `pnpm prisma:studio` - Open Prisma Studio GUI
- `pnpm prisma:seed` - Seed database with sample NOAA buoy stations

### Worker (`apps/worker`)

- `pnpm dev` - Start worker in dev mode (fetches real NOAA data every 5 min)

## 🔌 API Endpoints

**Base URL**: `http://localhost:3000`  
**API Version**: All API endpoints are versioned under `/v1`

**Try it now**:

```bash
# List all stations
curl http://localhost:3000/v1/stations | jq .

# Get latest observations from Delaware Bay buoy
curl "http://localhost:3000/v1/observations/by-station/44009?limit=5" | jq .
```

### Health

- `GET /health` - Service health check (no versioning)
- `GET /metrics` - Prometheus metrics endpoint (no versioning)

### Stations

- `GET /v1/stations` - List all active stations
  - Query params:
    - `page` (optional): Page number, default 1
    - `limit` (optional): Results per page, default 100, max 500
  - Response:

    ```json
    {
      "data": [ ...stations... ],
      "meta": {
        "page": 1,
        "limit": 100,
        "total": 250
      }
    }
    ```

- `GET /v1/stations/:id` - Get station by ID

### Observations

- `GET /v1/observations/by-station/:stationId` - Get observations for a station
  - Query params:
    - `page` (optional): Page number, default 1
    - `limit` (optional): Results per page, default 100, max 500
    - `since` (optional): ISO 8601 date, filter observations after this time
  - Response:

    ```json
    {
      "data": [ ...observations... ],
      "meta": {
        "page": 1,
        "limit": 100,
        "total": 1500
      }
    }
    ```

### Error Responses

All errors follow a consistent shape per the project constitution:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid query parameters",
    "details": { ... }
  }
}
```

Error codes: `NOT_FOUND`, `VALIDATION_ERROR`, `INTERNAL_ERROR`, `UNAUTHORIZED`, `FORBIDDEN`, `BAD_REQUEST`

### Rate Limiting

All API endpoints are rate-limited to prevent abuse:

- **Default**: 100 requests per minute
- **Observations endpoint**: 60 requests per minute (stricter due to larger payloads)

Rate limit information is included in response headers:

- `x-ratelimit-limit`: Total requests allowed in time window
- `x-ratelimit-remaining`: Requests remaining in current window
- `x-ratelimit-reset`: Timestamp when limit resets

When rate limit is exceeded, the API returns `429 Too Many Requests`.

## 🗄️ Database Schema

### Station

| Field     | Type     | Description                  |
| --------- | -------- | ---------------------------- |
| id        | String   | Station ID (e.g. "44009")    |
| name      | String   | Station name                 |
| lat       | Float    | Latitude                     |
| lon       | Float    | Longitude                    |
| source    | String   | Data source (default "NDBC") |
| isActive  | Boolean  | Active status                |
| createdAt | DateTime | Record creation time         |
| updatedAt | DateTime | Last update time             |

### Observation

| Field        | Type     | Description                  |
| ------------ | -------- | ---------------------------- |
| id           | String   | Unique observation ID (cuid) |
| stationId    | String   | Foreign key to Station       |
| observedAt   | DateTime | Observation timestamp        |
| waveHeightM  | Float?   | Wave height in meters        |
| windSpeedMps | Float?   | Wind speed in m/s            |
| windDirDeg   | Int?     | Wind direction in degrees    |
| waterTempC   | Float?   | Water temperature in Celsius |
| pressureHpa  | Float?   | Atmospheric pressure in hPa  |
| createdAt    | DateTime | Record creation time         |

## 🎵 Audio Integration

See [`docs/AUDIO_CLIENTS.md`](./docs/AUDIO_CLIENTS.md) for detailed guidance on integrating with:

- Web Audio API / Tone.js
- Max/MSP, Pure Data
- SuperCollider, ChucK
- TouchDesigner, VCV Rack
- Unity, Unreal Engine

Transports supported: SSE (default), WebSocket (future), OSC, MIDI, MQTT

## 📖 Documentation

- [PRD (Product Requirements)](./docs/PRD.md) - Full project requirements
- [Audio Clients Guide](./docs/AUDIO_CLIENTS.md) - Sonification integration patterns
- [Architecture Decision Records (ADRs)](./docs/adr/README.md) - Key architectural decisions
- [Constitution](/.specify/memory/constitution.md) - Project principles and governance
- [Engineering Principles](/.github/engineering-principles.md) - Code quality standards
- [Analysis Report](/.specify/memory/analysis-2025-11-14-updated.md) - Current state assessment

## 🛠️ Development Workflow

### Adding a New Feature

1. Write failing tests first (TDD per constitution)
2. Implement feature
3. Ensure tests pass: `pnpm test:run`
4. Lint and format: `pnpm lint && pnpm format`
5. Verify types compile: `pnpm build`

### Database Changes

1. Edit `apps/server/prisma/schema.prisma`
2. Run migration: `pnpm -F @app/server prisma:migrate`
3. Regenerate client: `pnpm -F @app/server prisma:generate`

### Debugging

- Server logs: Structured JSON via pino (configured in Fastify)
- Database queries: Set `DEBUG=prisma:*` or use Prisma Studio (`pnpm -F @app/server prisma:studio`)
- Worker jobs: Check Redis with `docker exec -it buoy-sonification-redis-1 redis-cli`
- View ingested data: `curl "http://localhost:3000/v1/observations/by-station/44009?limit=10" | jq .`

## 🏛️ Project Principles

This project adheres to strict engineering principles defined in our [Constitution](/.specify/memory/constitution.md):

- **Test-First Delivery** (non-negotiable): Red → Green → Refactor
- **Type-Centric Contracts**: Explicit TypeScript types, runtime validation
- **Observability by Design**: Structured logging, metrics, error semantics
- **Performance Awareness**: No N+1 queries, pagination mandatory
- **Security Baselines**: Input validation, secrets in env vars, PII redaction

See [Engineering Principles](/.github/engineering-principles.md) for detailed guidelines.

## 🚧 Current Status

**Phase**: Production-ready (v0.1.0) - Phase 3 Complete ✅

**Completed**:

- ✅ Test framework (Vitest) - 30 passing tests
- ✅ Input validation (Zod schemas)
- ✅ Error handling (standardized shapes)
- ✅ API routes with pagination (stations, observations)
- ✅ Database schema (Prisma ORM)
- ✅ Docker Compose setup (Postgres + Redis)
- ✅ CI/CD pipeline (GitHub Actions)
- ✅ Metrics endpoint (Prometheus format)
- ✅ Worker architecture (BullMQ + Redis)
- ✅ **Real data ingestion** - Worker fetches live NOAA buoy data every 5 minutes
- ✅ **NDBC parser** - Handles missing sensors, NaN values, and data validation
- ✅ API versioning (/v1 prefix)
- ✅ Rate limiting (100 req/min global, 60 req/min observations)
- ✅ Security hardening (Helmet, CORS, JWT validation, PII redaction)
- ✅ ADR documentation (Prisma, BullMQ, SSE)
- ✅ Database seeding (5 active NOAA buoy stations)
- ✅ **Constitution Compliance: 100%**

**Live Data Available**:

- 🌊 **30,000+ real observations** ingested from 5 NOAA buoys
- 📡 Stations: Delaware Bay, Boston, Eel River, Stonewall Bank, Mid-Gulf
- 📊 Data includes: wave height, wind speed/direction, water temp, pressure
- ♻️ Auto-refresh every 5 minutes with latest observations

**Planned (Phase 4+)**:

- 📅 Real-time SSE stream endpoint
- 📅 E2E smoke tests
- 📅 Web demo client
- 📅 OSC bridge for audio tools
- 📅 Production deployment

See [Analysis Report](/.specify/memory/analysis-2025-11-14-updated.md) for detailed technical assessment.

## 🤝 Contributing

1. Follow the test-first mandate: write failing tests before implementation
2. Ensure `pnpm lint` and `pnpm format` pass
3. Keep PRs focused (< ~400 LOC net change)
4. Reference constitution principles in PR descriptions
5. Add ADR for architectural decisions (`docs/adr/`)

## 📝 License

ISC

## 🔗 Links

- **Repository**: [github.com/tsargent/buoy-data-project](https://github.com/tsargent/buoy-data-project)
- **NOAA NDBC Data**: [ndbc.noaa.gov](https://www.ndbc.noaa.gov/)
- **Fastify Docs**: [fastify.dev](https://fastify.dev/)
- **Prisma Docs**: [prisma.io/docs](https://www.prisma.io/docs)

---

**Onboarding Time Target**: < 60 minutes from clone to first API request (per constitution 2.9)

Questions? See docs or open an issue.
