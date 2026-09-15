# Visual Framework MVP Status

Status: ACCEPTED

Accepted: September 15, 2026

The desktop MVP has passed its implementation, build, production, and live interaction acceptance gates.

## Accepted MVP capability

1. Create Data, Step, Logic, Check, and Result Frames.
2. Select one or multiple Frames.
3. Move multiple selected Frames together.
4. Duplicate, copy, paste, and delete Frames.
5. Undo and Redo structural edits.
6. Pan the canvas, zoom around the pointer, and fit the Framework to view.
7. Connect compatible typed execution ports.
8. Reject incompatible execution connections.
9. Select and remove execution or semantic connections.
10. Preserve tactile cable creation, removal, follow through, and settling behavior without changing exact structural geometry.
11. Run one Frame independently.
12. Run the full Framework progressively and expose intermediate Frame completion.
13. Store and inspect Run history.
14. Keep execution relationships separate from semantic relationships.
15. Create semantic relationships such as supports, challenges, contradicts, depends on, causes, contains, reframes, and alternatives.
16. Assign semantic Frame roles independently of runtime Frame kind.
17. Represent lightweight epistemic states including unknown and unresolved.
18. Preserve lightweight provenance for user, model, deterministic, imported, research, and prior Run origins.
19. Create parent and child hierarchy.
20. Collapse and restore contained structure.
21. Run scoped structural operations against a Frame, selection, branch, or Framework.
22. Structural operations include Expand, Reframe, Alternatives, Challenge, Find Missing, Assumptions, Contradictions, and Compress.
23. Structural AI output becomes a Proposal before accepted structure changes.
24. Accept or Reject a Proposal.
25. Undo and Redo accepted structural transformations.
26. Reorganize a Framework around Understand, Explain, Decide, Invent, Research, Compare, or Challenge goals.
27. Run the reasoning linter and navigate from an issue to affected Frames.
28. Create multiple local Frameworks.
29. Compress into a separate Framework while preserving the source Framework.
30. Persist Frameworks and Runs locally with IndexedDB.
31. Install and reload the application through the PWA shell.
32. Reload the application offline after installation while online model execution remains explicitly network dependent.
33. Use the protected server model endpoint without exposing FW_API to the browser.
34. Build with the locked React, TypeScript, Vite, Vercel, IndexedDB, and PWA architecture.

## Acceptance verification

The accepted production MVP passed all of the following gates:

1. Strict TypeScript type checking.
2. Vite production build.
3. Original live end to end production acceptance suite.
4. Focused remaining contract acceptance suite.
5. Multi selection movement.
6. Undo and Redo for Frame creation, movement, connection changes, hierarchy, semantic relationships, goal reorganization, and accepted Proposals.
7. Compatible and incompatible cable behavior.
8. Frame independent execution.
9. Progressive full Framework execution.
10. Stored Run inspection.
11. All current structural operations producing reviewable Proposals before mutation.
12. Proposal rejection without canonical graph mutation.
13. Proposal acceptance followed by reversible transformation.
14. Goal specific reorganization followed by reversal.
15. Reasoning linter issue navigation.
16. Compression into a second Framework while preserving the original.
17. IndexedDB persistence after reload.
18. Deterministic offline PWA shell reload using the current hashed Vite assets.
19. Explicit failure of online model execution when the network is unavailable.

## MVP completion boundary

The accepted MVP now supports the complete target loop:

Construct and connect → Expand → Reframe → Generate alternatives → Challenge and find gaps → Reorganize around a goal → Compress → produce a result or a new Framework.

The canonical Framework remains preserved unless the user explicitly accepts a change. Important structural transformations remain inspectable and reversible.

This closes the MVP scope.

Future product work begins from `FRAMEWORK_TASKS.md` and must continue to pass the Visual Framework mission filter.
