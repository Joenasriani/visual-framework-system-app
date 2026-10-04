# Visual Framework

Historical September 15 source baseline: accepted for that build only.

Current status: MVP 1.0 IMPLEMENTATION COMPLETE / RELEASE ACCEPTANCE OPEN — real first-time human use, live AI, rendered review, and production acceptance remain required.

Visual Framework helps people put ideas on a canvas, connect them, look at them in different ways, and run simple thinking steps while keeping the structure editable and visible.

A Frame can hold information, an explicit Order or both. A Frame can execute independently when its required input exists. During a Framework Run, completed outputs become available to dependent Frames and the chain resolves visibly Frame by Frame.

The September 15 baseline already supports structured roles, status, origin tracking, separate meaning and run connections, and reversible suggested changes. The final MVP pass keeps that precision underneath while simplifying the default user experience.

## Project status

Visual Framework is a working MVP implementation under release acceptance. Passing source/build automation does not by itself certify human usability, live AI reliability, or the canonical production deployment. See `MVP_STATUS.md` for the release gates.

Investment and strategic partnerships are being explored to accelerate development toward a complete production release.

## Architecture

The project baseline is locked to:

1. GitHub
2. React 19.3
3. TypeScript 7.0
4. Vite 8.3
5. Vercel
6. Local first IndexedDB
7. PWA
8. Cloud services only when justified by a real requirement
9. Python as an optional later analysis or backend layer
10. Android as a later packaging decision, never a separate codebase by default

See `ARCHITECTURE.md` for the permanent boundaries.

## Domain core

The Visual Framework model does not depend on React.

1. `src/domain/types.ts` defines Frames, relationships, epistemic state, provenance, Proposals, transformations and Runs.
2. `src/domain/engine.ts` validates and executes Frameworks and individual Frames.
3. `src/domain/orders.ts` contains the reusable executable reasoning Orders.
4. `src/domain/structural.ts` creates scoped structural Proposals, applies accepted transformations, reorganizes by goal and creates compressed Frameworks.
5. `src/domain/linter.ts` performs the current reasoning checks.
6. `src/domain/seed.ts` defines the initial Framework.
7. `src/storage/indexeddb.ts` stores multiple Frameworks and Run history locally.
8. `src/App.tsx` renders and manipulates the domain model.
9. `api/model.js` performs protected online model execution.

## Current executable Frame Orders

1. Decompose
2. Move Up
3. Move Down
4. Challenge Assumptions
5. Reframe
6. Find Missing Structure
7. Validate Structure

## Current structural operations

1. Expand
2. Reframe
3. Alternatives
4. Challenge
5. Find Missing
6. Assumptions
7. Contradictions
8. Compress

Each operation can run against a Frame, a Selection, a Branch or the complete Framework. Model output remains a Proposal until accepted.

## Accepted MVP reasoning layer

1. Semantic Frame roles
2. Known, supported, verified, assumed, inferred, hypothesized, disputed, contradicted, unknown, unresolved and invalid states
3. Lightweight provenance
4. Semantic relationships separate from execution wiring
5. Parent and child hierarchy with collapse
6. Undo and Redo
7. Goal specific reorganization
8. Minimal Framework linter
9. Transformation records
10. Multiple local Frameworks
11. Stored Run inspection
12. Compression into a separate Framework
13. Deterministic offline PWA shell after installation

See `MVP_STATUS.md` for the historical baseline acceptance, `MVP_BEGINNER_INTERACTION_CONTRACT.md` for the current user-facing MVP contract, and `FRAMEWORK_TASKS.md` for the final completion pass and later roadmap.

## Local data and backups

The React application imports the previous `visual-framework-workflow-v1` localStorage structure into IndexedDB when required.

The MVP can export all locally stored maps and Run history as a JSON backup and restore that backup later. Automatic save failures are surfaced to the user instead of being silently ignored.

## Development

```bash
npm ci
npm run dev
```

Type check:

```bash
npm run typecheck
```

Production build:

```bash
npm run build
```

## Acceptance

The repository keeps production browser acceptance coverage for the complete user loop, detailed graph interactions, model settings, local backup/restore and true offline PWA behavior. Production acceptance also verifies that the canonical deployment reports the exact Git commit being certified before the live suites run.

## Online model

The managed online Frame executor reads `FW_API` only inside `api/model.js`. The browser never receives that managed key.

The MVP accepts only OpenRouter free routes: the managed model must be `openrouter/free` or an explicit model id ending in `:free`, and the same rule is enforced server-side for a user's session-only OpenRouter key. Paid model routes and non-OpenRouter providers are rejected. No paid fallback is configured.
## Node graph interaction

The Resolve-style node, cable, and Layer behavior is locked in [NODE_GRAPH_CONTRACT.md](NODE_GRAPH_CONTRACT.md).
