# VFA MVP Beginner-First Interaction Contract

Status: LOCKED FOR MVP 1.0 COMPLETION PASS

## Product rule

A first-time user should understand what to add, how to connect it, what a tool will do, how to run the framework, and what changed after a run without learning graph theory, formal reasoning, psychology terminology, or AI workflow terminology.

The underlying domain model may remain precise and advanced. The MVP interface uses plain language and reveals deeper controls only when they are needed.

## First-use loop

1. Add an item.
2. Add another item.
3. Connect them.
4. Say how they are related when meaning matters.
5. Choose a thinking tool.
6. Review the suggested change.
7. Apply it or dismiss it.
8. Run one item or the full framework.
9. See what went in, what happened, and what came out.
10. Change something and run again.

## Default visible item choices

The first-use surface prioritizes:
- Idea
- Question
- Observation
- Assumption
- Evidence

More specific psychology, behavior, social, research, and framework items remain available under More items.

## Default visible connection choices

The quick relationship control prioritizes:
- Supports
- Conflicts with
- Depends on
- May cause
- Influences
- Is part of
- Another view of

More precise relationships may remain available in More connections.

## Thinking tools

Visible MVP labels:
- Add Detail
- Look Another Way
- Find Alternatives
- Challenge
- What's Missing?
- Find Assumptions
- Find Conflicts
- Simplify

These labels map onto the existing structural operations. Internal operation identifiers do not change.

## Run language

Use:
- Run
- Run This Item
- Runs
- Input
- Instruction
- Result
- AI
- Direct

Do not expose provider/runtime jargon in the default UI.

## Grouping language

Use Group in the user interface. Layer may remain the internal implementation term.

## Progressive disclosure

The MVP default surface must not require users to understand:
- node / edge
- topology
- semantic relationship
- execution policy
- epistemic state
- provenance
- recursive directed graph
- dependency invalidation
- counterfactual ablation
- ontology

If such concepts are required later, introduce them through plain-language controls first and keep the precise internal representation underneath.

## Acceptance test

Give the app to a first-time user with no instructions and ask them to map a problem they are thinking about. They should be able to add items, connect them, choose what a connection means, use at least one thinking tool, review the proposed change, run the framework, and understand the result without external documentation.
