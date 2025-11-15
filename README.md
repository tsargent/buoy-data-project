# Buoy Sonification Project

[![CI](https://github.com/tsargent/buoy-data-project/actions/workflows/ci.yml/badge.svg)](https://github.com/tsargent/buoy-data-project/actions/workflows/ci.yml)

Transform real-time and historical NOAA buoy observations into reliable, well-structured APIs and derived sonification events for exploratory auditory analytics.

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
# Copy example env file
cp apps/server/.env.example apps/server/.env

# Edit with your DATABASE_URL if needed
# Default: postgresql://postgres:postgres@localhost:5432/buoy
```

### 4. Run Database Migrations

```bash
pnpm -F @app/server prisma:generate
pnpm -F @app/server prisma:migrate
```

### 5. Start Development Servers

```bash
# Terminal 1: Start API server
pnpm -F @app/server dev

# Terminal 2: Start worker
pnpm -F worker dev
```

The API will be available at `http://localhost:3000`.

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

### Worker (`apps/worker`)

- `pnpm dev` - Start worker in dev mode

## 🔌 API Endpoints

### Health

- `GET /health` - Service health check

### Stations

- `GET /stations` - List all active stations
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

- `GET /stations/:id` - Get station by ID

### Observations

- `GET /observations/by-station/:stationId` - Get observations for a station
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

## 🗄️ Database Schema

### Station

| Field      | Type      | Description                     |
| ---------- | --------- | ------------------------------- |
| id         | String    | Station ID (e.g. "44009")       |
| name       | String    | Station name                    |
| lat        | Float     | Latitude                        |
| lon        | Float     | Longitude                       |
| source     | String    | Data source (default "NDBC")    |
| isActive   | Boolean   | Active status                   |
| createdAt  | DateTime  | Record creation time            |
| updatedAt  | DateTime  | Last update time                |

### Observation

| Field         | Type      | Description                    |
| ------------- | --------- | ------------------------------ |
| id            | String    | Unique observation ID (cuid)   |
| stationId     | String    | Foreign key to Station         |
| observedAt    | DateTime  | Observation timestamp          |
| waveHeightM   | Float?    | Wave height in meters          |
| windSpeedMps  | Float?    | Wind speed in m/s              |
| windDirDeg    | Int?      | Wind direction in degrees      |
| waterTempC    | Float?    | Water temperature in Celsius   |
| pressureHpa   | Float?    | Atmospheric pressure in hPa    |
| createdAt     | DateTime  | Record creation time           |

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
- [Constitution](/.specify/memory/constitution.md) - Project principles and governance
- [Engineering Principles](/.github/engineering-principles.md) - Code quality standards
- [Analysis Report](/.specify/memory/analysis.md) - Current state assessment

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
- Database queries: Set `DEBUG=prisma:*` or use Prisma Studio
- Worker jobs: Check Redis with `docker exec -it buoy-sonification-redis-1 redis-cli`

## 🏛️ Project Principles

This project adheres to strict engineering principles defined in our [Constitution](/.specify/memory/constitution.md):

- **Test-First Delivery** (non-negotiable): Red → Green → Refactor
- **Type-Centric Contracts**: Explicit TypeScript types, runtime validation
- **Observability by Design**: Structured logging, metrics, error semantics
- **Performance Awareness**: No N+1 queries, pagination mandatory
- **Security Baselines**: Input validation, secrets in env vars, PII redaction

See [Engineering Principles](/.github/engineering-principles.md) for detailed guidelines.

## 🚧 Current Status

**Phase**: Early development (v0.1.0)

**Completed**:

- ✅ Test framework (Vitest)
- ✅ Input validation (Zod schemas)
- ✅ Error handling (standardized shapes)
- ✅ API routes (stations, observations)
- ✅ Database schema (Prisma)
- ✅ Docker Compose setup

**In Progress**:

- 🔄 Worker ingestion logic (placeholder)
- 🔄 Real-time SSE stream
- 🔄 CI/CD pipeline

**Planned**:

- 📅 Metrics endpoint
- 📅 ADR documentation
- 📅 Web demo client
- 📅 OSC bridge

See [Analysis Report](/.specify/memory/analysis.md) for detailed technical debt and roadmap.

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
