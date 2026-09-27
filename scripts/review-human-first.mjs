import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
let app = readFileSync('src/App.tsx', 'utf8');
const sha = createHash('sha1').update(`blob ${Buffer.byteLength(app)}\0`).update(app).digest('hex');
if (sha !== '7448f2ae3b5bbf38467fdc663d6962ed4b18839d') throw new Error('App changed; do not overwrite another edit.');
const oldEscape = `      if (event.key === 'Escape') {
        setSelectedFrameIds([]);
        setSelectedConnectionId(null);
        setSelectedLayerId(null);
        wireRef.current = null;
        setWire(null);
        setRelationshipPickMode(false);
        setPanelOpen(false);
        setStatus('READY');
      }
`;
if (app.split(oldEscape).length !== 2) throw new Error('Escape anchor is not unique.');
app = app.replace(oldEscape, '');
app = app.replace("      const target = event.target as HTMLElement;\n      if (target.matches('input,textarea,select')) return;", `      const target = event.target as HTMLElement;
      if (event.key === 'Escape') {
        event.preventDefault();
        target.blur?.();
        setSelectedFrameIds([]);
        setSelectedConnectionId(null);
        setSelectedLayerId(null);
        wireRef.current = null;
        setWire(null);
        setTapConnect(null);
        setRelationshipPickMode(false);
        setPanelOpen(false);
        setStatus(current => current === 'RUNNING' || current === 'THINKING' ? current : 'READY');
        return;
      }
      if (target.matches('input,textarea,select')) return;`);
writeFileSync('src/App.tsx', app);
let offline = readFileSync('e2e/offline.mjs', 'utf8');
const anchor = "  await page.getByRole('button', { name: 'Run This Item', exact: true }).click();";
if (offline.split(anchor).length !== 2) throw new Error('Offline test anchor changed.');
offline = offline.replace(anchor, "  await page.getByRole('button', { name: 'Edit', exact: true }).click();\n" + anchor);
writeFileSync('e2e/offline.mjs', offline);
console.log('Escape now closes the editor even from a textarea; offline test explicitly opens Edit.');
