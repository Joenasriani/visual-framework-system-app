# Visual Framework

MVP status: ACCEPTED on September 15, 2026.

Visual Framework makes structured thought visible, executable, inspectable, challengeable, reframable and reusable.

A Frame can hold information, an explicit Order or both. A Frame can execute independently when its required input exists. During a Framework Run, completed outputs become available to dependent Frames and the chain resolves visibly Frame by Frame.

The accepted MVP also treats the graph as a reasoning structure. Frames can carry semantic roles, epistemic states and provenance. Semantic relationships remain separate from execution relationships. Structural model operations create Proposals that the user can inspect, accept, reject and reverse.

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

See `MVP_STATUS.md` for the completed acceptance record and `FRAMEWORK_TASKS.md` for the mission filtered future register.

## Local data migration

The React application imports the previous `visual-framework-workflow-v1` localStorage structure into IndexedDB when required.

## Development

```bash
npm install
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

The repository keeps two production browser acceptance suites:

1. `e2e/live.mjs` verifies the complete user loop.
2. `e2e/complete.mjs` verifies the remaining contract details including cable compatibility, all structural operations, reversibility, linter navigation and offline PWA behavior.

## Online model

The online Frame executor reads `FW_API` only inside `api/model.js`.

The browser never receives the key.

No paid fallback is configured.
