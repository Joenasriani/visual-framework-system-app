import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
let app = readFileSync('src/App.tsx','utf8');
const sha = createHash('sha1').update(`blob ${Buffer.byteLength(app)}\0`).update(app).digest('hex');
if (sha !== '6e28415bf8440c89a4a89f9d077cf743e52a972d') throw new Error('App changed; refusing to overwrite another edit.');
function edit(before,after) {
  if (app.split(before).length !== 2) throw new Error(`Expected one anchor: ${before}`);
  app=app.replace(before,after);
}
edit('<span>Name</span><input value={frame.title}', '<span>Name</span><input aria-label="Name" value={frame.title}');
edit('<span>{bodyLabel}</span><textarea value=', '<span>{bodyLabel}</span><textarea aria-label={bodyLabel} value=');
edit('<span>Instruction</span><textarea value={frame.body}', '<span>Instruction</span><textarea aria-label="Instruction" value={frame.body}');
edit("onKeyDown={event => { if (event.target === event.currentTarget && event.key === 'Enter') { event.preventDefault(); setSelectedFrameIds([frame.id]); openPanel('frame'); } }}", "onKeyDown={event => { if (event.target === event.currentTarget && event.key === 'Enter') { event.preventDefault(); event.stopPropagation(); setSelectedFrameIds([frame.id]); openPanel('frame'); requestAnimationFrame(() => document.querySelector<HTMLTextAreaElement>('.inspector textarea')?.focus()); } }}");
writeFileSync('src/App.tsx',app);
let test=readFileSync('e2e/human-first.mjs','utf8');
test=test.replace(/^  console\.log\('KEYBOARD (BEFORE|AFTER)'.*\n/gm,'');
const anchor="  await keys.getByLabel('Content', { exact: true }).waitFor();";
if (test.split(anchor).length!==2) throw new Error('Keyboard assertion anchor changed.');
test=test.replace(anchor, anchor + "\n  assert(await keys.getByLabel('Content', { exact: true }).inputValue() === 'I can edit without dragging.', 'Reopening the editor must preserve saved text under the same accessible field name');\n  await keys.getByLabel('Content', { exact: true }).fill('Edited again using the keyboard.');\n  await keys.keyboard.press('Escape');\n  await keys.locator('.frame').focus();\n  await keys.keyboard.press('Enter');\n  assert(await keys.getByLabel('Content', { exact: true }).inputValue() === 'Edited again using the keyboard.', 'A second keyboard edit must survive reopening');");
writeFileSync('e2e/human-first.mjs',test);
console.log('Editor fields have stable explicit names; keyboard opening also focuses content. Exact-label and saved-value assertions remain required.');
