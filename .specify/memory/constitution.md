# Buoy Sonification Project Constitution

This constitution defines non-negotiable principles, scopes, workflows, and governance for the buoy sonification project. It complements (not duplicates) the living `/.github/engineering-principles.md` file.

## 1. Mission & Scope

### 1.1 Mission

Transform real-time and historical buoy observations into reliable, well-structured APIs and derived sonification events that enable exploratory auditory analytics.

### 1.2 In-Scope

- Data ingestion, validation, persistence.
- API delivery (stations, observations, derived metrics).
- Sonification event generation interfaces & mapping guidance.
- Shared type library and testing utilities.

### 1.3 Out-of-Scope (Unless Explicitly Approved)

- Closed-source proprietary audio engines.
- Novel ML models for prediction (future ADR required).
- Arbitrary feature spikes without tests or documented rationale.

## 2. Core Principles

### 2.1 Type-Centric Contracts

All public interfaces (API responses, shared functions, events) must have explicit TypeScript types in `packages/shared`. Runtime validation (e.g. Zod) accompanies untrusted input.

### 2.2 Test-First Delivery (Red → Green → Refactor)

Business logic and data transformations require failing tests before implementation. No merging of untested logic. Integration tests cover DB queries & route wiring. A minimal e2e smoke test guards critical retrieval flows.

### 2.3 Observability as a Design Input

Logging, metrics, and error surfaces are planned with the feature—not bolted on. Structured logs (JSON) at meaningful boundaries; latency and ingest rate metrics evolve with domain needs.

### 2.4 Simplicity & Decomposition

Prefer small pure functions and focused modules over frameworks or premature abstractions. Justify every new dependency (security, maintenance, footprint).

### 2.5 Performance Awareness

Avoid accidental N+1 queries, oversize payloads, and unbounded scans. Queries selective by default; pagination mandatory for list endpoints.

### 2.6 Explicit Error Semantics

Errors use consistent shape `{ error: { code, message } }` with appropriate HTTP status. Domain vs transport concerns are not mixed.

### 2.7 Backwards Compatibility

Public contracts are versioned when breaking changes occur. Deprecations are documented; removal requires an ADR + migration notes.

### 2.8 Security & Data Integrity Baselines

Validate all external input, redact sensitive logs, enforce DB constraints (NOT NULL, foreign keys). No secrets in repository history.

### 2.9 Developer Experience Velocity

Fast local start (<3s target for dev server), consistent scripts, clear onboarding path. Tooling automates rote work (format, lint, test, typecheck).

### 2.10 Sonification-Centric Data Modeling

Precompute or expose normalized ranges and event-friendly structures to minimize downstream transformation overhead.

## 3. Quality Gates

### 3.1 Pre-Merge Requirements

- All tests pass locally (`pnpm test`).
- Lint & format clean (`pnpm lint` + `pnpm format`).
- Types compile with no `any` regressions.
- PR description: intent, approach, follow-ups.
- Added/changed logic accompanied by tests.

### 3.2 CI Pipeline Order

Lint → Typecheck → Unit Tests → Integration Tests → E2E Smoke → (Optional) Size/Performance checks.

### 3.3 Test Categories

- Unit: pure logic, transformation (fast, isolated).
- Integration: DB + route behavior (transaction or seeded fixture isolation).
- E2E: Minimal path (fetch station + recent observations).

### 3.4 Performance SLO Starters

- p95 GET /stations < 200ms typical dev dataset.
- p95 GET /observations < 300ms with common filters.

Reviewed quarterly; adjustments via ADR if changed.

## 4. Workflow & Change Management

### 4.1 Pull Requests

Small, focused (< ~400 LOC net). Larger changes split logically. Include checkboxes referencing the PR checklist.

### 4.2 Architecture Decision Records (ADRs)

Required for: new data model, versioning change, major dependency addition, ingestion pipeline redesign, sonification algorithm interface.
Stored at `docs/adr/ADR-YYYYMMDD-title.md`.

### 4.3 Versioning Strategy

Semantic for packages; API version path prefix for breaking changes (e.g. `/v1`). Deprecations labeled and communicated in README + ADR.

### 4.4 Dependency Policy

No transient addition without justification (maintenance, security posture). Weekly review of outdated packages. Vulnerability patches prioritized.

### 4.5 Release & Deployment Readiness

Must pass: tests, migration verification, schema introspection, smoke endpoint probe. Rollback plan documented for risky changes.

## 5. Security & Privacy

### 5.1 Data Validation

All ingestion and API inputs validated before persistence or use.

### 5.2 Secrets Handling

No secrets checked in; use environment variables with documented fallback semantics in `env.ts`.

### 5.3 Logging Hygiene

Never log raw credentials or PII; context objects filtered/redacted.

## 6. Observability

### 6.1 Logging Levels

DEBUG (opt-in), INFO (boundary events), WARN (recoverable anomaly), ERROR (failure requiring attention). No silent catches.

### 6.2 Metrics Minimum Viable Set

Request count per route, latency histogram, ingestion events per minute. Expand with domain metrics as complexity grows.

## 7. Governance

### 7.1 Authority Hierarchy

This constitution > Engineering Principles > ADRs > Inline comments. Conflicts are escalated to maintainers; resolution documented via ADR amendment.

### 7.2 Amendment Process

1. Draft ADR proposing change (context/problem/options).
2. Review & consensus.
3. Update constitution section + bump version.
4. Communicate in CHANGELOG.

### 7.3 Enforcement

Reviewers block merge if constitution violations persist. Exceptions require explicit ADR note with sunset date.

### 7.4 Decommissioning / Removal

Features deprecated must provide migration path & timeframe. Removal occurs only after meeting communicated date.

## 8. Glossary (Summary)

- Station: Physical buoy location entity.
- Observation: Timestamped measurement record (wave, wind, etc.).
- Sonification Event: Derived structured representation for audio mapping.
- ADR: Architecture Decision Record capturing irreversible design choices.

## 9. Version

**Version**: 1.0.0 | **Ratified**: 2025-11-14 | **Last Amended**: 2025-11-14

---

Amendments welcome; propose via ADR referencing affected sections.
