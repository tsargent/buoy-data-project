# Getting Started with AI Scaffolding

Quick guide to using the AI tools added to this project.

## 🚀 First Time Setup

### 1. Open in VS Code
```bash
cd buoy-data-project
code .
# Or open the workspace file:
code .vscode/buoy-data-project.code-workspace
```

### 2. Install Extensions
When you open the project, VS Code will show a notification:

> "This workspace has extension recommendations."

**Click "Install All"** to install:
- GitHub Copilot & Copilot Chat
- ESLint, Prettier
- Prisma
- Docker
- REST Client
- And more...

### 3. You're Ready!
All settings, debug configurations, tasks, and snippets are automatically available.

---

## 🤖 Using GitHub Copilot

### Automatic Context
Copilot automatically reads `.github/copilot-instructions.md` and understands:
- Project architecture
- Tech stack (TypeScript, Fastify, Prisma, BullMQ)
- Coding conventions
- Common patterns

### In the Editor
Just start typing and Copilot will suggest code following your project's patterns:

```typescript
// Type this:
app.get('/stations/:id',

// Copilot suggests (press Tab to accept):
app.get<{ Params: { id: string } }>(
  '/stations/:id',
  async (req, reply) => {
    const station = await prisma.station.findUnique({
      where: { id: req.params.id }
    });
    if (!station) {
      return reply.code(404).send({ error: 'Station not found' });
    }
    return station;
  }
);
```

### In Chat
Ask Copilot Chat questions like:
- "How do I add a new API endpoint?"
- "What's the best way to query observations in this project?"
- "Show me an example of a BullMQ job processor"

Copilot knows your project structure and conventions!

---

## 🎯 Using Code Snippets

Type a prefix and press **Tab** to insert a snippet:

### Examples

**`fastify-route`** → Complete route handler
```typescript
app.get<{ Params: { id: string } }>(
  '/path',
  async (req, reply) => {
    // Handler logic
  }
);
```

**`prisma-query`** → Database query
```typescript
const result = await prisma.model.findMany({
  where: { id }
});
```

**`zod-schema`** → Validation schema
```typescript
export const NameSchema = z.object({
  field: z.string(),
});
export type Name = z.infer<typeof NameSchema>;
```

**See all snippets**: Type `snippets` in Command Palette or view `.vscode/buoy-data.code-snippets`

---

## 🐛 Debugging

### Quick Start
1. Press **F5**
2. Choose "Debug Server" or "Debug Worker"
3. Set breakpoints by clicking line numbers
4. Use debug console to inspect variables

### Available Configurations
- **Debug Server** - Start API server with debugger
- **Debug Worker** - Start BullMQ worker with debugger
- **Debug Server + Worker** - Start both simultaneously
- **Debug Current Test File** - Debug the test file you're viewing
- **Debug All Tests** - Debug all tests

Access: Click Run & Debug icon (▶️) in sidebar or press **Ctrl+Shift+D**

---

## 🧪 Testing APIs

### Using REST Client

1. Open `.vscode/api-requests.http`
2. Click **"Send Request"** above any request
3. View response in new tab

Example requests included:
- Health check
- List stations
- Get station details
- Get observations
- Test error cases

### Using curl
```bash
# Health check
curl http://localhost:3000/health

# Get stations
curl http://localhost:3000/stations

# Get observations
curl "http://localhost:3000/observations/by-station/44009?limit=10"
```

---

## ⚡ Running Tasks

### Quick Access
- **Terminal → Run Task** (or **Ctrl+Shift+P** → "Tasks: Run Task")

### Available Tasks

**Development:**
- Start Server
- Start Worker
- Start Server + Worker

**Database:**
- Prisma: Generate Client
- Prisma: Run Migration
- Prisma: Open Studio

**Docker:**
- Docker: Start Services
- Docker: Stop Services
- Docker: View Logs

**Code Quality:**
- Format Code
- Lint Code
- Run Tests

**Build:**
- Build All
- Install Dependencies
- Clean Build Artifacts

---

## 🎨 Custom AI Agents

Specialized AI assistants for specific tasks.

### Code Review Agent

**When to use:** Before submitting PRs, after implementing features

**How to use:**
1. Open `.github/agents/code-review-agent.md`
2. Copy content to Copilot Chat
3. Ask: "Review the changes in `src/routes/stations.ts`"

**What it checks:** TypeScript practices, API design, error handling, security

### Documentation Agent

**When to use:** Adding features, updating APIs, writing guides

**How to use:**
1. Open `.github/agents/documentation-agent.md`
2. Copy content to Copilot Chat
3. Ask: "Document the new `/stream` endpoint"

**What it creates:** API docs, examples, architecture docs, guides

### Testing Agent

**When to use:** Adding tests, improving coverage, TDD

**How to use:**
1. Open `.github/agents/testing-agent.md`
2. Copy content to Copilot Chat
3. Ask: "Create integration tests for the observations endpoint"

**What it creates:** Vitest tests, API tests, database tests, mocks

---

## 📚 Quick References

### Files to Know

**Start Here:**
- `README.md` - Project overview and setup
- `.github/AI_CONTEXT.md` - Quick project reference
- `.github/copilot-instructions.md` - Detailed guidelines

**Development:**
- `.github/AI_DEVELOPMENT_GUIDE.md` - Common tasks and patterns
- `.vscode/api-requests.http` - API testing
- `.vscode/buoy-data.code-snippets` - Code snippets

**Agents:**
- `.github/agents/README.md` - Agent guide
- `.github/agents/code-review-agent.md` - Code reviews
- `.github/agents/documentation-agent.md` - Documentation
- `.github/agents/testing-agent.md` - Testing

### Commands to Remember

```bash
# Development
pnpm -F @app/server dev      # Start server
pnpm -F worker dev           # Start worker

# Database
pnpm -F @app/server prisma:generate  # Generate client
pnpm -F @app/server prisma:migrate   # Run migration
pnpm -F @app/server prisma:studio    # Open DB GUI

# Code Quality
pnpm format                  # Format code
pnpm lint                    # Lint code
pnpm build                   # Build all

# Docker
docker compose up -d         # Start services
docker compose down          # Stop services
docker compose logs -f       # View logs
```

---

## 💡 Tips & Tricks

### Copilot
- Be specific in comments: `// Fetch station with observations, limit 10`
- Use descriptive variable names for better suggestions
- Accept with Tab, see alternatives with Alt+]

### VS Code
- **Cmd/Ctrl+P** - Quick file open
- **Cmd/Ctrl+Shift+P** - Command palette
- **Cmd/Ctrl+`** - Toggle terminal
- **F5** - Start debugging
- **Ctrl+Space** - Trigger IntelliSense

### Productivity
- Use multi-root workspace for focused work
- Run Server + Worker task to start both at once
- Use REST Client instead of external tools
- Enable format-on-save (already configured)
- Use code snippets for repetitive code

---

## 🆘 Troubleshooting

### Copilot not working?
1. Check extension is installed and enabled
2. Sign in to GitHub in VS Code
3. Restart VS Code

### Extensions not recommended?
- Open `.vscode/extensions.json`
- Click "Install All" in bottom-right notification

### Snippets not working?
- Type the full prefix (e.g., `fastify-route`)
- Press **Tab** (not Enter)
- Check `.vscode/buoy-data.code-snippets` for available snippets

### Debug not working?
- Ensure dependencies are installed: `pnpm install`
- Check `.vscode/launch.json` for configuration
- Try "Restart Debugging" from debug toolbar

### Tasks not showing?
- Check `.vscode/tasks.json` exists
- Reload window: **Cmd/Ctrl+Shift+P** → "Reload Window"

---

## 📖 Learning Resources

### Project Documentation
- `docs/PRD.md` - Product requirements
- `docs/AUDIO_CLIENTS.md` - Audio integration guide
- `.github/AI_SCAFFOLDING_SUMMARY.md` - This scaffolding overview

### Technology Docs
- [Fastify](https://fastify.dev/)
- [Prisma](https://www.prisma.io/docs)
- [BullMQ](https://docs.bullmq.io/)
- [TypeScript](https://www.typescriptlang.org/docs/)
- [GitHub Copilot](https://docs.github.com/en/copilot)

---

**Need help?** Check the documentation files or ask in Copilot Chat with context from the agent files!
