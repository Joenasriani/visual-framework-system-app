# Visual Framework MVP Status

This file is the acceptance register for the current MVP.

The MVP exists to prove one complete product loop:

Construct and connect → expand → reframe → generate alternatives → challenge and find gaps → reorganize around a goal → compress → create a reusable result or new Framework.

The canonical Framework must remain inspectable and important transformations must remain reversible.

## Implemented

1. React, TypeScript, Vite, Vercel, IndexedDB and PWA baseline.
2. Custom desktop canvas with Frame movement, canvas movement, pointer anchored zoom and fit to view.
3. Create, select, multi select, move, duplicate, copy, paste and delete Frames.
4. Typed execution ports with magnetic compatible target selection.
5. Cable selection, removal, follow through, overlapping settle and execution motion.
6. Independent Frame execution.
7. Progressive Framework execution with visible intermediate results.
8. Local deterministic operations and protected online model operations.
9. Seven reusable reasoning Orders for Frame execution.
10. Undo and Redo for Framework editing.
11. Semantic Frame roles separate from execution kind.
12. Explicit epistemic state including Unknown and Unresolved.
13. Lightweight provenance on Frames, relationships and Run steps.
14. Semantic relationships separate from execution relationships.
15. Parent and child hierarchy with collapse and expansion.
16. Scoped structural operations for Frame, Selection, Branch and Framework.
17. Structural operations: Expand, Reframe, Alternatives, Challenge, Find Missing, Assumptions, Contradictions and Compress.
18. Structural AI output is stored as a Proposal and does not silently rewrite the Framework.
19. Proposal acceptance and rejection.
20. Accepted structural transformations are recorded.
21. Goal specific reorganization for Understand, Explain, Decide, Invent, Research, Compare and Challenge.
22. Minimal reasoning linter for isolated Frames, unsupported claims, duplicate structure, unresolved contradiction, causal support gaps, direct assumption to result support and reasoning cycles.
23. Multiple local Frameworks.
24. Compress can create a separate Framework while preserving the source Framework.
25. Run history stored in IndexedDB and inspectable from the application.
26. Semantic zoom reduces visual detail at distant scale.
27. Build verification through GitHub Actions with strict TypeScript and Vite production build.

## Acceptance verification still required

The code is not considered fully accepted until the live desktop application is manually or automatically exercised for the following interactions.

1. Create five Frame kinds.
2. Multi select and move several Frames together.
3. Duplicate, copy and paste a selection.
4. Undo and Redo each structural edit.
5. Pan and zoom around a larger Framework.
6. Fit the complete Framework into view.
7. Connect compatible execution ports.
8. Reject incompatible execution ports.
9. Select and remove a cable.
10. Create a semantic relationship between two Frames.
11. Build a parent and child hierarchy.
12. Collapse and restore the hierarchy.
13. Run one Frame independently.
14. Run a complete executable chain and observe each result appear progressively.
15. Reopen a stored Run and inspect its steps.
16. Execute each structural operation against a selected Frame.
17. Confirm the operation creates a Proposal before changing the graph.
18. Reject a Proposal without changing accepted structure.
19. Accept a Proposal and Undo the accepted transformation.
20. Reorganize the Framework around a goal and Undo it.
21. Run the linter and navigate from an issue to the affected Frames.
22. Compress a Framework into a new Framework.
23. Switch between the source Framework and compressed Framework.
24. Reload the page and confirm Frameworks and Runs persist from IndexedDB.
25. Confirm the PWA shell reloads when offline while online model Frames correctly require network access.

## Not MVP

Future graph intelligence, evidence depth, competing models, simulation, decision engines, live refresh, specialist engines, framework libraries, cloud synchronization, collaboration and native packaging remain outside the current acceptance boundary.
