# Visual Framework Architecture

## Locked baseline

Visual Framework uses this technical direction until a concrete product requirement proves a change is necessary.

1. Source of truth: GitHub
2. Application: React + TypeScript + Vite
3. Delivery: Vercel
4. Local persistence: IndexedDB
5. Installability: PWA
6. Cloud services: added only when the product requires capabilities that cannot remain local
7. Python: optional research, analysis, graph, document or computation layer later
8. Android: later packaging and distribution decision, not a separate application codebase

## Permanent architectural rule

React is interface infrastructure. The Visual Framework domain model is the permanent core.

The following concepts must remain independent of React components:

1. Frame
2. Port
3. Connection
4. Framework
5. Run
6. Run event
7. Proposal
8. Provenance
9. Validation
10. Reusable Frame Order

## Current domain boundary

`src/domain` owns structure and execution semantics.

`src/storage` owns local persistence.

`src/App.tsx` owns interaction and presentation.

`api/model.js` owns protected online model execution.

The browser never receives `FW_API`.

## Local first rule

Creating, editing, positioning, connecting, inspecting saved structure and reading locally stored Runs must not require a cloud backend.

IndexedDB is the default store for Frameworks and Runs.

Cloud persistence is justified only by requirements such as account sync, multi device continuity, sharing, collaboration, scheduled work or protected external integrations.

## Canvas rule

Do not make a generic node library the product architecture.

The canvas remains custom because Frame interaction, cable behavior, semantic relationships, recursive Frameworks and structural reasoning are core product behavior.

Third party graph libraries may be studied or used internally only when they do not dictate the interaction model or visible product language.

## PWA rule

The web application should remain installable and offline capable for its local shell and locally stored Frameworks.

Online model Frames naturally require network access.

## Python rule

Python is not part of the primary UI runtime.

Introduce Python only when research pipelines, statistical analysis, graph algorithms, document processing, specialized computation or other server side work clearly benefits from it.

## Android rule

Do not create an Android fork.

First evaluate the PWA. Later evaluate packaging the same application if platform distribution or native APIs justify it.

## Locked node graph interaction contract

The node editor must follow [NODE_GRAPH_CONTRACT.md](NODE_GRAPH_CONTRACT.md). Layers are graph containers beneath cables and nodes; they must not alter node execution, port semantics, or cable compatibility.
