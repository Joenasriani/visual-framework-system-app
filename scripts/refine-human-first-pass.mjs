import { readFileSync, writeFileSync } from 'node:fs';
let app = readFileSync('src/App.tsx', 'utf8');
app = app.replace('  const busyRef = useRef(false);', "  const busyRef = useRef(false);\n  const fittedExampleRef = useRef('');");
app = app.replace("    if (!loaded || !framework.id.startsWith('example-')) return;\n    const frame = requestAnimationFrame(() => fitView());", "    if (!loaded || !framework.id.startsWith('example-') || fittedExampleRef.current === framework.id) return;\n    fittedExampleRef.current = framework.id;\n    const frame = requestAnimationFrame(() => fitView());");
writeFileSync('src/App.tsx', app);
let structural = readFileSync('src/domain/structural.ts', 'utf8');
structural = "import { nextItemPosition } from './starter';\n" + structural;
const start = structural.indexOf('  const addedFrames = proposal.additions.map((item, index): Frame => ({');
const end = structural.indexOf('  const addedConnections = addedFrames.map', start);
if (start < 0 || end < 0) throw new Error('Proposal placement changed; review before patching.');
let block = structural.slice(start, end);
block = block.replace('  const addedFrames = proposal.additions.map((item, index): Frame => ({', `  const addedFrames: Frame[] = [];
  proposal.additions.forEach((item, index) => {
    const position = nextItemPosition({ ...framework, frames: [...framework.frames, ...addedFrames] }, anchor.x + 310, Math.max(64, anchor.y));
    addedFrames.push({`);
block = block.replace('    x: anchor.x + 310,\n    y: anchor.y + (index - (proposal.additions.length - 1) / 2) * 150,', '    x: position.x,\n    y: position.y,');
block = block.replace('  }));', '    });\n  });');
structural = structural.slice(0, start) + block + structural.slice(end);
writeFileSync('src/domain/structural.ts', structural);
// Neutralize only blue/indigo/purple accents; keep green, amber and red status feedback.
function neutral(r, g, b) {
  const max = Math.max(r, g, b), min = Math.min(r, g, b), delta = max - min;
  if (delta < 8) return null;
  let hue = max === r ? ((g - b) / delta) % 6 : max === g ? (b - r) / delta + 2 : (r - g) / delta + 4;
  hue = (hue * 60 + 360) % 360;
  return hue >= 210 && hue <= 290 ? Math.round(.2126 * r + .7152 * g + .0722 * b) : null;
}
let css = readFileSync('src/styles.css', 'utf8');
css = css.replace(/#([0-9a-f]{6})(?![0-9a-f])/gi, (all, hex) => {
  const value = neutral(parseInt(hex.slice(0,2),16), parseInt(hex.slice(2,4),16), parseInt(hex.slice(4,6),16));
  return value === null ? all : '#' + value.toString(16).padStart(2, '0').repeat(3);
});
css = css.replace(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(\s*,\s*[\d.]+)?\s*\)/g, (all, r, g, b, alpha) => {
  const value = neutral(Number(r), Number(g), Number(b));
  return value === null ? all : `rgb${alpha ? 'a' : ''}(${value},${value},${value}${alpha || ''})`;
});
writeFileSync('src/styles.css', css);
const theme = readFileSync('src/ui/workstation.css', 'utf8');
writeFileSync('src/ui/workstation.css', theme + '\n.empty-canvas{position:absolute;left:50%;top:0;transform:translateX(-50%)}\n');
console.log('Placement and accent refinements applied without changing graph execution.');
