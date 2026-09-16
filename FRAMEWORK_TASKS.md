# Visual Framework Future Register

This file begins after the originally accepted MVP boundary.

Current accepted MVP status lives in `MVP_STATUS.md`.

The architecture has since been refined. The items in **Final MVP Completion Pass** are now treated as the remaining work required before freezing the product as the final MVP v1.0. Everything after that remains post-MVP unless a dependency forces an earlier architectural reservation.

Every future item must materially improve at least one of these abilities:

1. Construct a Framework.
2. Understand structure.
3. Test reasoning.
4. Reframe a subject.
5. Navigate abstraction and hierarchy.
6. Transform structure without losing inspectability.
7. Validate claims, assumptions and relationships.
8. Preserve alternatives, contradiction and uncertainty.
9. Generate insight from structure rather than generic brainstorming.

If an idea fails this filter, it does not belong in the product.

# Final MVP Completion Pass

## A. Typed recursive graph architecture

1. Treat the runtime as one typed recursive directed graph rather than separate graph systems.
2. Keep **Chain Type**, **Relationship Type**, and **Execution Mode** independent.
3. Preserve semantic relationships separately from execution wiring.
4. Allow contained Frames to hold complete sub-Frameworks.
5. Support practical unlimited nesting depth.
6. Preserve one canonical graph while allowing different visual arrangements of the same structure.

## B. Chain constructors

1. Sequence.
2. Branch / Fork.
3. Merge / Join.
4. Diamond.
5. Parallel.
6. Hierarchy.
7. Contain.
8. Nested.
9. Nested Branch.
10. Cascade.
11. Conditional / Switch.
12. Multi-input / Gate.
13. Reciprocal.
14. Feedback Loop.
15. Network / Mesh.
16. Recursive Framework.
17. Freeform.
18. Multi-select chain creation with topology preview before commit.
19. Convert an existing selection from one topology to another where structurally valid.
20. Select a complete chain as an addressable object.
21. Collapse, expand, duplicate, execute, pause, bypass, reverse, wrap and save a chain as a reusable pattern where applicable.

## C. Execution modes

1. Sequential execution.
2. True parallel execution for independent ready branches.
3. Ordered parallel execution.
4. Conditional execution.
5. Manual execution.
6. Iterative execution with explicit limits.
7. Controlled feedback execution without allowing accidental infinite cycles.
8. Explicitly distinguish temporal order from execution order.
9. Preserve deterministic failure when a required dependency is unavailable.

## D. Compositing operations over thought

1. Disable — Frame remains but does not execute.
2. Bypass — inherited state passes through without the transformation.
3. Mask — selected instruction, claim, assumption or content fragment is omitted from execution.
4. Subtract — explicitly remove a selected influence from inherited reasoning state.
5. Replace — substitute another Frame, instruction fragment or influence while preserving graph position.
6. Delete — permanently remove the object; never conflate with the operations above.
7. Scope masks and subtraction to this Frame, branch, descendants, selected sequence or complete Framework execution.
8. Preserve all masked or bypassed objects so they remain reversible and inspectable.
9. Record who or what applied each mask, bypass, subtraction or replacement.

## E. Addressable instructions and dependency-aware recomputation

1. Treat Frame instructions as composable structures rather than one opaque prompt blob wherever practical.
2. Support addressable instruction fragments.
3. Record inherited context separately from local additions, local masks and substitutions.
4. Introduce dependency fingerprints or equivalent dependency metadata.
5. Detect the descendants affected by a local change.
6. Invalidate only outputs whose dependencies changed.
7. Re-execute only the affected downstream region.
8. Preserve unaffected cached outputs.
9. Recompute the whole Framework only when the changed dependency actually reaches the whole Framework.
10. Keep the recomputation path visible in Run history.

## F. Counterfactual graph editing

1. Ask what the reasoning becomes without a selected assumption, event, Frame, claim, branch or sub-Framework.
2. Mask or subtract the selected element without destroying it.
3. Recompute only affected descendants.
4. Preserve original and counterfactual Runs separately.
5. Compare original and counterfactual outputs.
6. Expose what changed, what survived and what depended on the removed influence.

## G. Chain and execution UX

1. Make add, remove, connect and disconnect actions immediately understandable.
2. Replace ambiguous generic node-editor controls with product-specific interaction grammar.
3. Make side panels resizable where content density requires it.
4. Use direct contextual chain controls on selected Frames.
5. Preview topology before committing a Chain operation.
6. Keep relationship meaning visible separately from graph geometry.
7. Keep execution mode visible separately from both topology and relationship meaning.
8. Allow topology conversion without rebuilding the graph manually.
9. Preserve the current smooth motion quality while making motion explanatory rather than decorative.
10. Sequence animation should show signal progression.
11. Parallel animation should visibly split.
12. Merge animation should visibly converge.
13. Conditional animation should emphasize the active route and preserve inactive routes visibly.
14. Feedback animation should make each iteration and stopping condition inspectable.
15. Containment animation should reveal internal Framework structure without losing outer context.

## H. Final MVP schema reservations

These may remain lightly surfaced in the MVP but the data model must not make them expensive to add later.

1. `assumptions[]`.
2. `contextScope`.
3. `sourceRefs[]`.
4. `generatedClaims[]`.
5. Relationship reason or trigger.
6. Relationship confidence or assessment state without false precision.
7. Execution provenance beyond simple origin.
8. Dependency metadata.
9. Addressable instruction fragments.
10. Claim identifiers separate from complete Frame output where needed.

# Phase 1: Epistemic depth

1. Evidence objects separate from ordinary Frames.
2. Claim objects or claim records separate from whole-node outputs where useful.
3. Evidence attached to Frames, claims and semantic relationships.
4. Source identity, date, freshness and origin.
5. Source conflict representation.
6. Evidence missing state.
7. Evidence stale state.
8. Evidence requirement Proposals.
9. Confidence derived from evidence and process state without false precision.
10. Explicit distinction between observation, inference, assumption and hypothesis.
11. Conditions under which a claim holds.
12. Boundary conditions under which a claim stops holding.
13. Conditions under which a contradiction can be resolved.
14. Unknown decomposition into known unknowns and unresolved branches.
15. Provenance drawer tracing any result to source, Frame, claim and Run.
16. Trust transfer mapping across dependent claims.
17. Historical value overlay for evidence and claims.
18. Reasoning independence distinct from mere visual separation.
19. Evidence independence distinct from source count.
20. Information ancestry so repeated URLs or summaries derived from one source are not treated as independent corroboration.
21. Correlated-path warnings when Frames share the same model, prompt, source corpus, assumptions, parent reasoning or context.
22. Evidence-survival states that preserve why an item is CORE, CONDITIONAL, UNRESOLVED, REDUNDANT, REJECTED or INSUFFICIENT where that taxonomy is appropriate.
23. Preserve a reason for every epistemic state change.
24. Never remove an interpretation merely because another becomes better supported; preserve superseded alternatives with status and provenance.
25. Separate evidential strength from importance, centrality or model role.

# Phase 2: Graph intelligence

1. Missing Frame detection beyond the MVP linter.
2. Missing relationship detection.
3. Duplicate structure detection.
4. Overlapping category detection.
5. Structural boundary detection.
6. Framework completeness Proposals.
7. Structural stopping rules.
8. Centrality analysis.
9. Bridge analysis.
10. Hub detection.
11. Bottleneck detection.
12. Single point of failure detection.
13. Path strength scoring.
14. Route comparison.
15. Shortest credible path finder.
16. Redundant route detection.
17. Dynamic relationship strength.
18. Relationship state visualization.
19. Goal specific graph organization beyond simple layout.
20. Opportunity routing through structural gaps.
21. Reasoning-path correlation detection.
22. Evidence-origin correlation detection.
23. Shared-source detection.
24. Redundant reasoning-route detection.
25. Selective cross-examination routing only when a meaningful comparison trigger exists.
26. Comparison triggers may include contradiction, competing explanation, shared claim, shared evidence, different prediction, dependency, confidence mismatch, possible redundancy, incompatible assumptions, boundary differences or falsification attempts.
27. Store the reason a generated comparison edge exists.
28. Comparison-value or expected-information-gain routing as an explicitly heuristic mechanism until empirically validated.
29. Detect circular confirmation among claims, Frames and evidence paths.
30. Detect source monoculture.
31. Detect false replication when apparently independent support shares the same dataset or evidence origin.
32. Detect synthesis that removes unresolved disagreement.

# Phase 3: Competing models and adversarial reasoning

1. Preserve competing explanations as first class structures.
2. Preserve competing hierarchies.
3. Preserve competing classifications.
4. Preserve competing causes.
5. Preserve competing strategies.
6. Preserve competing conclusions.
7. Explicit evidence for each side.
8. Common cause hypotheses.
9. Reverse causality hypotheses.
10. Feedback loop hypotheses.
11. Selection effect hypotheses.
12. Measurement effect hypotheses.
13. Chronology and source order hypotheses.
14. Memory and salience hypotheses.
15. Coincidence hypotheses.
16. Combination hypotheses.
17. Adversarial challenge Frameworks.
18. Steelman an opposing Framework.
19. Compare strongest competing Frameworks without collapsing them prematurely.
20. Rank alternatives only after the option space is represented.
21. Two-Frame cross-examination view for local rather than global comparison matrices.
22. Compare claims, evidence, assumptions, predictions and boundary conditions separately.
23. Disagreement-preserving merge that combines compatible content without deleting incompatibilities.
24. Disagreement-preserving synthesis containing agreement, A-only, B-only, contradiction, unresolved items and discriminating tests.
25. Generate discriminating tests that identify observations under which competing hypotheses produce different expectations.
26. Generate explicit predictions from competing hypotheses before comparing them.
27. Assumption-surface view that exposes the assumptions required by each reasoning path.
28. Boundary-condition nodes for population, cultural, temporal, environmental, scale, incentive and measurement boundaries where relevant.
29. Reasoning diversity generated across explicit dimensions such as assumptions, framework, evidence, causal model, perspective and prediction rather than random prompt variation.
30. Preserve surprising agreement from genuinely different reasoning routes as distinct from agreement caused by shared ancestry.

# Phase 4: Time, dynamics and simulation

1. Temporal relationships distinct from execution order.
2. Past, present and expected future states.
3. State transitions.
4. Triggers.
5. Delays.
6. Cycles.
7. Feedback systems.
8. Dynamic edge strength over time.
9. Scenario branches.
10. Parameter changes and downstream effects.
11. Counterfactual state comparison.
12. Simple deterministic simulation where the Framework supports it.
13. Compare simulated paths.
14. Preserve simulation assumptions explicitly.
15. Never treat simulation output as observed evidence.
16. Preserve original, modified and simulated states as separate inspectable Runs.
17. Support causal-history subtraction where the model legitimately permits it.
18. Expose sensitivity to changed assumptions or parameter values.

# Phase 5: Decision and intervention

1. Decision criteria as explicit structure.
2. Alternatives linked to criteria.
3. Tradeoff representation.
4. Constraint representation.
5. Intervention points.
6. Expected consequence paths.
7. Second order consequence paths.
8. Reversibility of interventions.
9. Decision uncertainty.
10. Decision sensitivity to assumptions.
11. Compare decisions under different framings.
12. Go, Refine and Kill style evaluation where relevant.
13. Action routing from a validated Framework.
14. Post decision learning returned into the Framework.
15. Distinguish descriptive evidence from value criteria used to choose among actions.
16. Preserve the criteria responsible for any Go, Refine, Kill, Protect More, Productize or Scale decision.
17. Allow decision gates to route back only to affected Framework regions rather than restart the entire process.

# Phase 6: Multiple views over one canonical Framework

1. Hierarchy view.
2. Causal view.
3. Evidence view.
4. Contradiction view.
5. Execution view.
6. Goal view.
7. Timeline view.
8. Decision view.
9. Provenance view.
10. Confidence view.
11. Evidence Survival view.
12. Assumption Surface view.
13. Relationship type filtering.
14. Role filtering.
15. Epistemic state filtering.
16. Focus path isolation.
17. Saved viewpoints.
18. Semantic zoom with richer level of detail rules.
19. Dense Framework navigation without introducing a minimap unless scale proves it necessary.
20. All views must reference the same canonical graph rather than create disconnected copies.

# Phase 7: Live research and refresh

1. Research triggered by missing evidence.
2. Research triggered by contradiction.
3. Research triggered by uncertain classification.
4. Research triggered by an unknown relationship.
5. Research triggered by stale information.
6. Research triggered by a competing hypothesis.
7. Research triggered by undefined terminology.
8. Research output returned to the requesting Frame.
9. Research provenance.
10. Research freshness.
11. Change detection.
12. Structural diff after refresh.
13. Manual refresh.
14. On demand refresh.
15. Refresh when upstream evidence changes.
16. Event triggered refresh.
17. Scheduled refresh such as 30 minutes, 45 minutes, hourly or daily.
18. Last run timestamp.
19. Next run timestamp.
20. Staleness state.
21. Retry policy.
22. Backoff policy.
23. Rate limits.
24. Cost limits.
25. Preserve previous state for comparison.
26. Research stopping rule based on structural value rather than information volume.
27. Group retrieved sources by common evidence origin before counting corroboration.
28. Distinguish not found, inaccessible, not searched and available but inconclusive.
29. Retrieve specifically against declared evidence gaps rather than generic topic expansion.
30. Preserve search criteria and subsequent changes to those criteria.

# Phase 8: Specialist reasoning engines

1. Causal analysis engine.
2. Assumption audit engine.
3. Contradiction engine.
4. Classification engine.
5. Evidence sufficiency engine.
6. Alternative explanation engine.
7. Perspective transformation engine.
8. Decision analysis engine.
9. Systems reasoning engine.
10. Historical reasoning engine.
11. Behavioral and psychological reasoning engine.
12. Opportunity discovery engine.
13. Cross domain mechanism transfer engine.
14. Interpretive Divergence Framework as an explicit reusable operator or sub-Framework rather than hidden prompting.
15. TRACE Evidence-Survival Framework as an explicit reusable operator or sub-Framework rather than hidden prompting.
16. Selective Cross-Examination operator.
17. Discriminating-Test generator.
18. Boundary-Condition explorer.
19. Counterfactual / Ablation operator.
20. Disagreement-Preserving Synthesis operator.
21. Each engine must expose its internal Framework rather than become an opaque answer generator.

# Phase 9: Framework validation and benchmarking

1. Graph ablation testing.
2. Disable one reasoning component at a time and compare outcomes.
3. Compare full Framework versus no alternatives, no external evidence, no cross-examination, no boundary testing, no provenance or no synthesis.
4. Measure accuracy where ground truth exists.
5. Measure evidence accuracy separately from answer accuracy.
6. Measure contradiction detection.
7. Measure alternative-hypothesis recovery.
8. Measure calibration where meaningful.
9. Measure robustness.
10. Measure execution time.
11. Measure token and model cost.
12. Measure human auditability.
13. False-input or poisoned-premise resistance testing.
14. Measure whether a Framework blindly propagates, challenges, weakens or rejects a deliberately misleading input.
15. Framework performance profiles.
16. Alternative recovery profile.
17. False-premise resistance profile.
18. Evidence accuracy profile.
19. Contradiction discovery profile.
20. Stability profile.
21. Cost profile.
22. Human auditability profile.
23. Do not present heuristic scores as scientifically validated until empirical validation exists.
24. Allow one Framework to evaluate another Framework under explicit recursion depth and iteration limits.
25. Preserve validation datasets, parameters, runs and comparison provenance.

# Phase 10: Framework library ecosystem

The intellectual priority remains:

Psychology → mindset → framing → reasoning path → perspective shift → idea generation → reusable Framework.

Future library work:

1. Psychology Frameworks.
2. Mindset Frameworks.
3. Reframing Frameworks.
4. Perspective shift Frameworks.
5. Causal reasoning Frameworks.
6. Assumption audit Frameworks.
7. Contrarian investigation Frameworks.
8. Idea generation through structural transformation.
9. Decision Frameworks.
10. Research Frameworks.
11. Teaching and explanation Frameworks.
12. Framework composition from smaller reusable Frameworks.
13. Framework versioning.
14. Framework provenance.
15. Framework comparison.
16. Framework quality checks before library inclusion.
17. Framework applicability conditions and known failure modes.
18. Preserve established academic terminology from psychology, sociology, behavioral science, cognitive science and decision science where established terms exist.
19. Clearly label product-specific or proposed constructs instead of presenting them as established scholarship.
20. Store framework lineage so adapted or combined Frameworks retain their intellectual ancestry.

Secondary sources to re audit after the MVP is accepted:

1. Fabric Patterns.
2. Prompt Patterns.
3. LangGPT.
4. AI System Prompts Library.
5. Prompt Library.
6. Prompts.chat.

Before ingestion verify structure, provenance, licensing, duplication and relevance to the Visual Framework mission.

General prompt libraries are sources to mine selectively. They are not the product focus.

# Phase 11: Cloud, collaboration and distribution

Only introduce this phase when local first limitations justify it.

1. Account based synchronization.
2. Multi device continuity.
3. Shared Frameworks.
4. Collaboration.
5. Review and commenting tied to Frames and relationships.
6. Permission boundaries.
7. Cloud Run history where necessary.
8. Shared provenance.
9. Scheduled server work.
10. Protected external integrations.
11. Import and export formats.
12. Public Framework sharing where useful.
13. PWA remains the primary installable web application.
14. Android packaging only if distribution or native APIs justify it.
15. No separate Android product codebase by default.
16. Python remains optional for research, analysis, graph algorithms, document processing and specialized computation.
17. Framework sharing must preserve provenance, version and dependency metadata.
18. Collaborative edits must preserve transformation history and reversible state where practical.

# Canonical architectural principles now carried by this register

1. Nodes are compositing operators over structured thought, not merely boxes containing prompts.
2. Visual multiplicity must never be presented as epistemic independence unless the system has grounds to distinguish the reasoning paths, assumptions, contexts or evidence that produced it.
3. Agreement is weak evidence when the agreeing paths share the same informational ancestry.
4. Change locally, invalidate selectively, propagate only where dependency requires it.
5. Instructions should be composable rather than opaque wherever practical.
6. Synthesis should preserve material disagreement rather than force fluent convergence.
7. UNRESOLVED is a valid terminal state.
8. Frameworks may contain, transform, compare, audit and revise other Frameworks.
9. Every visible mechanism should communicate structure, relationship, state, provenance, execution, hierarchy or interaction rather than decorate the canvas.
10. Chain Type, Relationship Type and Execution Mode must remain independent.

# Permanent future filter

Do not add a feature because graph software usually has it.

Do not add a feature because AI products usually have it.

Do not add a feature because it looks sophisticated.

Do not add a feature merely because another AI workflow product has it.

A future feature belongs only when it improves the construction, understanding, testing, reframing, navigation, transformation or validation of a Framework.
