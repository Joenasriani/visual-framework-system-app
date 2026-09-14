# Visual Framework

Visual Framework makes structured thought visible, executable, inspectable, challengeable and reusable.

A Frame can hold information, an explicit Order or both. A Frame can execute independently when its required input exists. During a Framework Run, completed outputs become available to dependent Frames and the chain resolves visibly Frame by Frame.

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

The application is organized so the Visual Framework model does not depend on React.

1. `src/domain/types.ts` defines the typed product model
2. `src/domain/engine.ts` validates and executes Frameworks and individual Frames
3. `src/domain/orders.ts` contains the current reusable reasoning Orders
4. `src/domain/seed.ts` defines the initial Framework
5. `src/storage/indexeddb.ts` stores Frameworks and Runs locally
6. `src/App.tsx` renders and manipulates the domain model
7. `api/model.js` performs protected online model execution

## Current MVP reasoning Orders

1. Decompose
2. Move Up
3. Move Down
4. Challenge Assumptions
5. Reframe
6. Find Missing Structure
7. Validate Structure

See `FRAMEWORK_TASKS.md` for the mission filtered future register.

## Local data migration

The React application automatically imports the previous `visual-framework-workflow-v1` localStorage structure into IndexedDB the first time it runs, then removes the legacy localStorage record.

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

## Online model

The current online Frame executor reads `FW_API` only inside `api/model.js`.

No paid fallback is configured.
