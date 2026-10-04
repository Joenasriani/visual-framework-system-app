# Visual Framework MVP Status

Status: HUMAN-FIRST REVIEW / NOT RELEASED / HUMAN ACCEPTANCE PENDING

Updated: October 4, 2026

## Current scope

The current MVP combines the beginner-first interaction pass with release-path hardening from the October 4 audit. It does not add the advanced graph/runtime roadmap. Source correctness, local durability, free-model enforcement, deployment identity, and production acceptance wiring are part of this hardening; real human usability and live production AI remain separate release gates.

The interface must let a person add and edit items, connect them, distinguish run cables from descriptive relationships, request a thinking suggestion, review it before applying, run the map, and read the actual result. Use plain words and one neutral workstation surface.

## Separate acceptance gates

| Gate | Required evidence |
| --- | --- |
| Source and automated regression | Exact tested commit, workflow result and artifacts. Old passing checks do not certify newer commits. |
| Visual review | Actual rendered desktop, tablet and phone screenshots. CSS assertions alone are insufficient. |
| Real first-time human use | Unassisted task completion and correct understanding of connections, suggestions and results. NOT YET PROVEN. |
| Live AI and preview | Actual responses from the intended provider on a verified preview deployment. Mock responses do not satisfy this gate. |
| Production | The same approved build at the canonical URL, followed by live acceptance. This review build is NOT RELEASED. |

MVP 1.0 must not be marked frozen, launch-ready or fully accepted until all five gates are satisfied. Successful execution means the software finished an operation, not that a claim or AI answer is true.

`MVP_HUMAN_FIRST_ACCEPTANCE.md` defines the current review procedure. Automated results live in the Human-first MVP review workflow and its artifacts; they must be read against the exact tested commit.

## Preserved scope boundary

The VFS/advanced-runtime path remains frozen and separate. Do not merge advanced runtime, recursive chains, counterfactual execution, thought compositing or selective recomputation into MVP 1.0. Backward-compatible schema reservations may exist where they prevent future migration pain; they are not implemented runtime features. Preserve the existing frozen branches and all history.

`FRAMEWORK_TASKS.md` is a preserved future backlog, not a requirement to complete advanced features before this MVP. The current release boundary in this file supersedes its historical Final MVP Completion Pass wording.

`MVP_BEGINNER_INTERACTION_CONTRACT.md` remains the plain-language product requirement. Controls may be revealed contextually without deleting capabilities.

## Historical record

The complete earlier September 15 baseline and September 27 source-acceptance record remains unchanged in Git at commit `296782bdb0625450dd8bfde2741479036c2d78d1`, path `MVP_STATUS.md`.

Those historical claims concern their own builds. They do not prove human usability or live deployment of this review build. No history or advanced-work branch is deleted by this pass.
