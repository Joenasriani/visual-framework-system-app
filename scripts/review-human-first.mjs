import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
let app = readFileSync('src/App.tsx', 'utf8');
const sha = createHash('sha1').update(`blob ${Buffer.byteLength(app)}\0`).update(app).digest('hex');
if (sha !== '70ce45c4c16f59784c9f70142dfdac8b9dbb56d8') throw new Error('Unexpected App version; refusing to overwrite.');
function replace(before, after) {
  if (app.split(before).length !== 2) throw new Error(`Source anchor changed: ${before}`);
  app = app.replace(before, after);
}
replace("  return { x: side === 'from' ? frame.x + FRAME_WIDTH : frame.x, y: frame.y + FRAME_HEIGHT / 2 };", "  return { x: frame.x + FRAME_WIDTH * (side === 'from' ? 0.75 : 0.25), y: frame.y + FRAME_HEIGHT }; ");
replace('                const geometry = curveGeometry(start, end, sourceMotion, targetMotion);', `                const geometry = semantic
                  ? curveGeometry(start, end, { x: sourceMotion?.x ?? 0, y: 36 + (sourceMotion?.y ?? 0) }, { x: targetMotion?.x ?? 0, y: 36 + (targetMotion?.y ?? 0) })
                  : curveGeometry(start, end, sourceMotion, targetMotion);`);
replace('<path className="connection-main" d={geometry.d} pathLength="1" />', '<path className="connection-main" d={geometry.d} pathLength={semantic ? undefined : 1} />');
replace('{selected && semantic && <text className="connection-label" x={geometry.mid.x} y={geometry.mid.y - 9}', '{semantic && <text className="connection-label" x={geometry.mid.x} y={geometry.mid.y + 4}');
writeFileSync('src/App.tsx', app);
let css = readFileSync('src/ui/workstation.css', 'utf8');
css += '\n.connection-group.semantic .connection-main{stroke:#acb3bd;stroke-dasharray:4 5;stroke-width:1.4}.connection-group.semantic .connection-label{font-size:11px;fill:#d5dae1;stroke:#18191b;stroke-width:6px}\n';
writeFileSync('src/ui/workstation.css', css);
let test = readFileSync('e2e/human-first.mjs','utf8');
const testAnchor = "  assert(await page.locator('.connection-group.semantic').count() === 1, 'Meaning must remain a separate relationship');";
if (!test.includes(testAnchor)) throw new Error('Relationship regression anchor missing.');
test = test.replace(testAnchor, testAnchor + "\n  await page.locator('.connection-group.semantic .connection-label').filter({ hasText: 'Supports' }).waitFor();\n  assert(!(await page.locator('.connection-group.semantic').getAttribute('class')).includes('selected'), 'Relationship label test must not depend on selection');");
writeFileSync('e2e/human-first.mjs',test);
mkdirSync('docs/history', { recursive: true });
const oldStatus = readFileSync('MVP_STATUS.md','utf8');
writeFileSync('docs/history/MVP_STATUS-before-human-first.md', oldStatus);
writeFileSync('MVP_STATUS.md', `# Visual Framework MVP Status

Status: HUMAN-FIRST REVIEW / NOT RELEASED / HUMAN ACCEPTANCE PENDING

Updated: September 27, 2026

## Current release scope

The current work is a human-first usability and visual consistency pass over the existing MVP. It does not add an advanced graph runtime. Work stays on the review branch until its source checks and preview review are complete.

The first-use experience must let a person add and edit an item, connect items, understand the difference between a run cable and a descriptive relationship, request a thinking suggestion, review it before applying, run the map, and read the actual result. Use plain words and a consistent neutral workstation surface.

## Separate acceptance gates

1. Source build and automated interaction regression. Record the exact tested commit, workflow run and artifacts. Old passing checks do not certify newer commits.
2. Rendered desktop and touch-screen review. Inspect actual screenshots; a stylesheet assertion alone is insufficient.
3. Real first-time human use. NOT YET PROVEN. Automated browser interactions cannot pass this gate.
4. Live AI and preview deployment. NOT YET VERIFIED for this review build. Mock responses prove UI behavior only.
5. Canonical production deployment and live acceptance. NOT RELEASED for this review build.

MVP 1.0 must not be marked frozen, launch-ready or fully accepted until all five gates are satisfied. Successful execution means the software finished an operation, not that an idea or AI answer is true.

## Scope boundary

The advanced VFS/runtime path remains frozen and separate. Do not merge advanced runtime, recursive chains, counterfactual architecture, thought compositing or selective recomputation into this pass. Preserve the existing frozen branches and all history.

FRAMEWORK_TASKS.md is a preserved future backlog, not a requirement to complete advanced features before this MVP. MVP_BEGINNER_INTERACTION_CONTRACT.md defines the plain-language interaction requirement. MVP_HUMAN_FIRST_ACCEPTANCE.md defines how current acceptance is recorded.

## Historical evidence

The earlier September 15 baseline and September 27 source acceptance record are preserved verbatim in docs/history/MVP_STATUS-before-human-first.md. They apply to their historical builds, not to human usability or live deployment of the current review build.
`);
console.log('Visible relationship labels and separate acceptance gates written. Historical status preserved verbatim.');
