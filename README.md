# Buoy Data Project 🌊

A TypeScript backend system that ingests NOAA buoy data, stores it in PostgreSQL, processes it with worker queues, and streams real-time ocean observations for audio sonification.

## Quick Start

### Prerequisites
- Node.js 20+
- PNPM 10.22+
- Docker & Docker Compose (for Postgres & Redis)

### Setup

```bash
# Install dependencies
pnpm install

# Start services (Postgres & Redis)
docker compose up -d

# Run database migrations
pnpm -F @app/server prisma:migrate

# Start server (terminal 1)
pnpm -F @app/server dev

# Start worker (terminal 2)
pnpm -F worker dev
```

### Verify Setup

```bash
# Check health endpoint
curl http://localhost:3000/health

# List stations
curl http://localhost:3000/stations

# Watch real-time stream (once implemented)
curl http://localhost:3000/stream
```

## Project Structure

```
buoy-data-project/
├── apps/
│   ├── server/          # Fastify REST API
│   └── worker/          # BullMQ worker for data ingestion
├── packages/
│   └── shared/          # Shared TypeScript types & schemas
├── docs/
│   ├── PRD.md          # Product requirements
│   └── AUDIO_CLIENTS.md # Audio integration guide
└── .github/
    ├── copilot-instructions.md  # AI coding guidelines
    └── agents/         # Specialized AI agent configurations
```

## Architecture

### Data Flow
1. **Scheduler** triggers buoy data fetch
2. **Worker** fetches from NOAA API, validates, and stores in DB
3. **Server** exposes REST API for historical data
4. **Server** streams real-time observations via SSE/WebSocket
5. **Audio Clients** receive normalized events for sonification

### Technologies
- **Runtime**: Node.js 20, TypeScript
- **API**: Fastify + Zod validation
- **Database**: PostgreSQL + Prisma ORM
- **Queue**: BullMQ + Redis
- **Streaming**: Server-Sent Events (SSE)
- **Monorepo**: PNPM workspaces

## API Endpoints

### Health Check
```bash
GET /health
```

### Stations
```bash
# List all active stations
GET /stations

# Get station details
GET /stations/:id
```

### Observations
```bash
# Get recent observations for a station
GET /observations/by-station/:stationId?limit=100&since=2024-01-01T00:00:00Z
```

### Real-Time Stream
```bash
# Subscribe to live observation stream
GET /stream
```

## Development

### Commands

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm build

# Format code
pnpm format

# Lint code
pnpm lint

# Server commands
pnpm -F @app/server dev          # Start dev server
pnpm -F @app/server build        # Build for production
pnpm -F @app/server prisma:generate   # Generate Prisma client
pnpm -F @app/server prisma:migrate    # Run migrations
pnpm -F @app/server prisma:studio     # Open Prisma Studio

# Worker commands
pnpm -F worker dev               # Start dev worker
pnpm -F worker build             # Build for production
```

### Database Management

```bash
# Create a new migration
cd apps/server
pnpm prisma migrate dev --name add_new_field

# Apply migrations
pnpm prisma migrate deploy

# Reset database (development only!)
pnpm prisma migrate reset

# Open Prisma Studio (database GUI)
pnpm prisma studio
```

### Docker Services

```bash
# Start all services
docker compose up -d

# View logs
docker compose logs -f

# Stop services
docker compose down

# Stop and remove volumes (delete data)
docker compose down -v
```

## Environment Variables

Copy `.env.example` to `apps/server/.env`:

```env
DATABASE_URL="postgresql://user:password@localhost:5432/buoy_data"
REDIS_URL="redis://localhost:6379"
JWT_SECRET="your-secret-key"
PORT=3000
```

## Testing

```bash
# Run tests (when configured)
pnpm test

# Run tests with coverage
pnpm test:coverage

# Run tests in watch mode
pnpm test --watch
```

## VS Code Setup

This project includes VS Code configurations:

1. **Recommended Extensions**: Install suggested extensions when prompted
2. **Workspace**: Open `buoy-data-project.code-workspace` for multi-root setup
3. **Debugging**: Use Run & Debug panel to start server/worker
4. **GitHub Copilot**: Automatically uses `.github/copilot-instructions.md`

### Useful VS Code Commands
- `Cmd/Ctrl + Shift + P` → "Prisma: Format" to format schema files
- `F5` → Start debugging server or worker
- `Cmd/Ctrl + Shift + B` → Run build task

## Audio Sonification

This project streams buoy data for audio visualization. Each observation includes:

- **Wave Height** (meters) → Amplitude/Volume
- **Wind Speed** (m/s) → Filter frequency/Timbre
- **Wind Direction** (degrees) → Panning/Spatialization
- **Water Temperature** (°C) → Pitch/Tone
- **Air Pressure** (hPa) → Modulation/Effects

See `docs/AUDIO_CLIENTS.md` for integration examples with:
- WebAudio API
- Max/MSP
- SuperCollider
- ChucK
- Pure Data

## Contributing

### Code Style
- Use Prettier for formatting (automatic on save)
- Follow ESLint rules
- Use TypeScript strict mode
- Add `.js` extension to ES module imports

### Commit Messages
- Use conventional commits: `feat:`, `fix:`, `docs:`, `refactor:`
- Keep first line under 72 characters
- Add details in commit body if needed

### Pull Requests
- Create feature branches from `main`
- Update documentation if needed
- Ensure tests pass (when available)
- Request review before merging

## Troubleshooting

### Port Already in Use
```bash
# Find process using port 3000
lsof -i :3000

# Kill process
kill -9 <PID>
```

### Prisma Client Out of Sync
```bash
pnpm -F @app/server prisma:generate
```

### Redis Connection Failed
```bash
# Check if Redis is running
docker compose ps

# Restart Redis
docker compose restart redis
```

### Database Connection Failed
```bash
# Check if Postgres is running
docker compose ps

# View Postgres logs
docker compose logs postgres

# Verify DATABASE_URL in .env
```

## Resources

- [Fastify Documentation](https://fastify.dev/)
- [Prisma Documentation](https://www.prisma.io/docs)
- [BullMQ Documentation](https://docs.bullmq.io/)
- [NOAA Buoy API](https://www.ndbc.noaa.gov/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)

## License

ISC

## Project Status

🚧 **In Development** - Core functionality is being built

### Completed
- [x] Project scaffolding
- [x] Database schema (Prisma)
- [x] Basic REST API endpoints
- [x] AI scaffolding & development tools

### In Progress
- [ ] NOAA data fetching
- [ ] BullMQ worker implementation
- [ ] Real-time SSE streaming
- [ ] Error handling & logging

### Planned
- [ ] Integration tests
- [ ] API documentation
- [ ] Performance optimization
- [ ] Deployment configuration
