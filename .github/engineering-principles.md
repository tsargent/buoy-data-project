# Engineering Principles

These principles guide decisions across the buoy sonification project. Each principle includes rationale and concrete, repeatable actions.

## 1. Code Quality

### 1.1 Single Responsibility & Clear Boundaries

- Rationale: Small focused modules are easier to test, reason about, and evolve.
- Actions:
  - Keep route handlers thin; delegate data shaping and business logic to `lib/` or `packages/shared` utilities.
  - One exported concept per file (class/function/type group). If a file exceeds ~300 lines, consider splitting.

### 1.2 Type Safety First

- Rationale: Strong static types catch integration errors early and clarify intent.
- Actions:
  - Enable strict TypeScript in all tsconfigs (no implicit any, strictNullChecks, noUncheckedIndexedAccess where feasible).
  - Avoid `any`; prefer generics or discriminated unions.
  - Define shared domain types (e.g. Station, Observation) in `packages/shared/src/` and reuse.

### 1.3 Explicit Data Contracts

- Rationale: Stable, documented shapes reduce client coupling risk.
- Actions:
  - All API responses use a consistent envelope or raw shape; errors use `{ error: { code, message } }`.
  - Add inline JSDoc for exported types.
  - Version breaking changes (e.g. `/v1/observations`).

### 1.4 Defensive & Observability-Ready Error Handling

- Rationale: Fast diagnosis; graceful degradation.
- Actions:
  - Wrap external I/O (DB, network, file) with try/catch; standardize error mapping.
  - Use structured logging (level, context object) rather than string concatenation.
  - Never swallow errors—propagate or translate with context.

### 1.5 Performance-Aware Data Access

- Rationale: Avoid hidden N+1 and excessive payload sizes.
- Actions:
  - Use Prisma `select`/`include` to limit columns.
  - Batch queries when iterating over IDs.
  - Add indices to high-cardinality query fields (timestamp, stationId) in `schema.prisma`.

### 1.6 Cleanliness & Consistency

- Rationale: Reduces cognitive load, PR friction.
- Actions:
  - Zero lint errors; warnings treated as errors.
  - Automatic formatting via `pnpm format` (Prettier); never hand-format.
  - Avoid commented-out dead code—delete, rely on git history.

## 2. Best Practices

### 2.1 Small, Focused Pull Requests

- Rationale: Easier review, faster iteration, lower merge risk.
- Actions:
  - Target < ~400 LOC changed (excluding generated). Split larger changes.
  - Include summary: intent, key decisions, follow-ups.

### 2.2 Tests as Non-Negotiable

- Rationale: Prevent regressions; enable refactoring.
- Actions:
  - New business logic requires unit tests.
  - Data access & API endpoints get integration tests (with ephemeral or seeded DB).
  - Cover at least: happy path, boundary, failure.

### 2.3 Reproducible Local Environment

- Rationale: Onboarding velocity & fewer "works on my machine" issues.
- Actions:
  - `docker compose up -d` starts required services; keep compose lean and documented.
  - Seed scripts idempotent; dev data resets are safe.

### 2.4 Security Hygiene

- Rationale: Reduce exploit surface, protect data.
- Actions:
  - Keep dependencies updated weekly (automated diff + review).
  - Validate all input (query params, body) with a schema validator (e.g. Zod) before use.
  - Never log secrets or PII; sanitize payloads.

### 2.5 Documentation at Point of Use

- Rationale: Fewer context switches.
- Actions:
  - Exported functions/classes: brief JSDoc (purpose, inputs, outputs, pitfalls).
  - README sections updated when public behavior changes.
  - Add ADR (Architecture Decision Record) markdown in `docs/adr/` for major choices (DB schema changes, protocol design).

## 3. Developer Experience (DX)

### 3.1 Fast Feedback Loop

- Rationale: High iteration speed prevents stagnation.
- Actions:
  - Keep `pnpm dev` server startup < 3s; profile cold starts if exceeded.
  - Use incremental TypeScript builds (tsc --watch) where heavy.

### 3.2 Consistent Scripts

- Rationale: Discoverable workflows.
- Actions:
  - Prefer workspace script names: `dev`, `build`, `test`, `lint`, `format`, `prisma:*`.
  - Document any new script in root README "Scripts" section.

### 3.3 Tooling Automation

- Rationale: Humans focus on product logic, not style.
- Actions:
  - Pre-commit hook (optional) runs format + lint staged files.
  - CI: install, build, lint, test, typecheck, diff size guard.

### 3.4 Clear Onboarding Path

- Rationale: A new contributor should commit within 30–60 minutes.
- Actions:
  - Root README: prerequisites, setup, one-liner to start stack.
  - Provide minimal glossary (station, observation, sonification event).

### 3.5 Shared Abstractions over Duplication

- Rationale: Fewer divergence bugs.
- Actions:
  - Promote common utilities into `packages/shared` early.
  - Centralize constants (e.g. pagination default limit) in `shared`.

## 4. User Experience (API & Sonification Consumers)

### 4.1 Predictable Latency

- Rationale: Enables real-time sonification mapping.
- Actions:
  - Set internal SLO: p95 GET /stations < 200ms, /observations < 300ms with typical query.
  - Monitor with lightweight metrics (count, latency buckets) logged or exported.

### 4.2 Consistent Filtering & Pagination

- Rationale: Lower learning curve for clients.
- Actions:
  - Uniform params: `?page`, `?limit`, `?fromTs`, `?toTs`, `?stationId`.
  - Always return `meta: { page, limit, total }` when paginated.

### 4.3 Progressive Enhancement for Data Detail

- Rationale: Clients choose cost vs richness.
- Actions:
  - Support `fields=` or `detail=basic|full` pattern.
  - Default minimal payload; full includes derived metrics.

### 4.4 Stable Error Semantics

- Rationale: Simplifies error recovery logic client-side.
- Actions:
  - HTTP status codes reflect class (4xx client, 5xx server); body includes code + message.
  - Avoid mixing transport-level (HTTP) and domain errors.

### 4.5 Sonification-Relevant Semantics

- Rationale: Data structure influences musical mapping clarity.
- Actions:
  - Pre-compute normalized ranges / buckets (e.g. wave height intensity) for audio layer.
  - Document mapping suggestions in `docs/AUDIO_CLIENTS.md`.

## 5. Testing Strategy

### 5.1 Pyramid Approach

- Rationale: Maintainable & fast test suite.
- Actions:
  - Majority unit tests (pure transformations).
  - Integration tests for DB-backed routes.
  - Light end-to-end smoke test for critical flow (fetch station + recent observations).

### 5.2 Deterministic & Isolated

- Rationale: Trustworthy CI results.
- Actions:
  - Use fixed seed data; avoid time-of-day dependence (inject clock).
  - Clear DB between integration tests or use transaction rollback per test.

### 5.3 Fast Failures

- Rationale: Early exit reduces wasted cycles.
- Actions:
  - CI orders: lint/typecheck -> unit -> integration -> e2e.
  - Mark long-running tests separately; keep default test run < 10s.

## 6. Observability & Metrics

### 6.1 Meaningful Logs

- Rationale: Enables root cause analysis without replays.
- Actions:
  - Log structured JSON (level, msg, context) at INFO boundary events and DEBUG for deep tracing (opt-in env var).
  - Redact sensitive fields.

### 6.2 Minimal Essential Metrics

- Rationale: Avoid premature complexity.
- Actions:
  - Start with counters (requests by route) & histograms (latency) exposed via `/metrics` or log sinks.
  - Add domain metrics (observations ingested / min) as ingestion matures.

## 7. Change Management

### 7.1 Traceable Decisions

- Rationale: Prevent revisiting resolved debates.
- Actions:
  - Each architectural shift gets an ADR with context, options, reasoning.
  - Link ADRs in PR descriptions.

### 7.2 Backwards Compatibility Mindset

- Rationale: Stable experience for downstream consumers.
- Actions:
  - Deprecate before remove: mark field deprecated, provide alternative.
  - Communicate removal timeline in README / CHANGELOG.

## 8. Reliability & Resilience

### 8.1 Fail Fast, Recover Gracefully

- Rationale: System stability & user clarity.
- Actions:
  - Timeouts on external calls (e.g. 2–5s) and retries with jitter for idempotent operations.
  - Circuit breaker pattern for persistent upstream failure (log open/close events).

### 8.2 Data Integrity

- Rationale: Trustworthy analytics & sonification.
- Actions:
  - Validate ingestion payloads; reject partial corruption explicitly.
  - Use DB constraints (NOT NULL, foreign keys, unique) rather than only app logic.

## 9. Extensibility

### 9.1 Plugin-Friendly Design (Future)

- Rationale: Enables experimental sonification strategies.
- Actions:
  - Define an interface for transformation modules: `(observations[], config) => events[]`.
  - Keep side-effect boundaries explicit; pure transformation before emit.

## 10. Continuous Improvement

### 10.1 Regular Principle Review

- Rationale: Avoid stale guidance.
- Actions:
  - Quarterly audit: remove obsolete, add emerging needs.
  - Encourage PRs updating this file with observed friction.

---

\n## Quick Checklist for PR Authors

- [ ] Types added/updated in shared package.
- [ ] Tests (unit + integration where applicable).
- [ ] Lint & format pass locally.
- [ ] Docs (README / AUDIO_CLIENTS / ADR) updated if behavior changed.
- [ ] Performance or query changes reviewed for N+1.
- [ ] Error shapes consistent.

## Glossary (Seed)

- Station: A physical buoy location entity.
- Observation: Time-stamped measured data row (wave, wind, etc.).
- Sonification Event: Derived audio-trigger mapping from one or more observations.

---

By adhering to these principles we optimize for maintainability, clarity, speed of iteration, and a smooth experience for both developers and consumers of buoy data.
