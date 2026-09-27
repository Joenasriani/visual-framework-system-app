import type { FrameworkDocument } from './types';
import { FRAME_HEIGHT, FRAME_WIDTH } from './seed';

export function createEmptyFramework(id = 'framework-main'): FrameworkDocument {
  return { id, name: 'My map', frames: [], connections: [], layers: [], proposals: [], transformations: [], goal: 'understand', version: 1, updatedAt: new Date().toISOString() };
}

export function createEverydayExample(): FrameworkDocument {
  const createdAt = new Date().toISOString();
  const doc = createEmptyFramework(`example-${crypto.randomUUID()}`);
  return {
    ...doc,
    name: 'Example: a late reply',
    frames: [
      { id: 'example-question', kind: 'asset', role: 'question', title: 'A late reply', operation: 'DETERMINISTIC', x: 90, y: 150, inputs: [], outputs: [{ id: 'out', name: 'text', type: 'text' }], body: '', value: 'A friend has not replied to my message. I think they may be upset with me. What else could explain it?', epistemicState: 'unknown', provenance: { origin: 'user', createdAt, source: 'Fictional example' } },
      { id: 'example-step', kind: 'instruction', role: 'instruction', title: 'Look for another explanation', operation: 'MODEL', x: 390, y: 150, inputs: [{ id: 'in', name: 'input', type: 'text' }], outputs: [{ id: 'out', name: 'text', type: 'text' }], body: 'Separate what was observed from what was assumed. Offer two other possible explanations in plain language. Do not claim to know what the friend thinks. Suggest one question that could help clarify the situation.', epistemicState: 'unknown', provenance: { origin: 'user', createdAt } },
      { id: 'example-result', kind: 'output', role: 'result', title: 'Read the result', operation: 'DETERMINISTIC', x: 690, y: 150, inputs: [{ id: 'in', name: 'input', type: 'text' }], outputs: [], body: '', epistemicState: 'unknown', provenance: { origin: 'user', createdAt } }
    ],
    connections: [
      { id: 'example-flow-1', fromFrame: 'example-question', fromPort: 'out', toFrame: 'example-step', toPort: 'in', kind: 'execution', meaning: 'feeds' },
      { id: 'example-flow-2', fromFrame: 'example-step', fromPort: 'out', toFrame: 'example-result', toPort: 'in', kind: 'execution', meaning: 'feeds' }
    ]
  };
}

/** Find a free position near the visible canvas. Existing positions are never moved. */
export function nextItemPosition(doc: FrameworkDocument, startX: number, startY: number): { x: number; y: number } {
  const x = Math.max(48, startX);
  const y = Math.max(64, startY);
  const gap = 44;
  for (let row = 0; row <= doc.frames.length + 1; row += 1) {
    for (let col = 0; col < 3; col += 1) {
      const candidate = { x: x + col * (FRAME_WIDTH + gap), y: y + row * (FRAME_HEIGHT + gap) };
      const overlaps = doc.frames.some(frame => candidate.x < frame.x + FRAME_WIDTH + gap && candidate.x + FRAME_WIDTH + gap > frame.x && candidate.y < frame.y + FRAME_HEIGHT + gap && candidate.y + FRAME_HEIGHT + gap > frame.y);
      if (!overlaps) return candidate;
    }
  }
  return { x, y: Math.max(y, ...doc.frames.map(frame => frame.y + FRAME_HEIGHT + gap)) };
}
