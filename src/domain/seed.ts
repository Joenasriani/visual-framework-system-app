import type { FrameworkDocument } from './types';

export const FRAME_WIDTH = 216;
export const FRAME_HEIGHT = 112;

export function createSeedFramework(): FrameworkDocument {
  const createdAt = new Date().toISOString();
  return {
    id: 'framework-main',
    name: 'Framework',
    goal: 'understand',
    version: 1,
    proposals: [],
    transformations: [],
    layers: [],
    updatedAt: createdAt,
    frames: [
      {
        id: 'asset-1', kind: 'asset', role: 'question', epistemicState: 'unknown', provenance: { origin: 'user', createdAt },
        title: 'Start here', operation: 'DETERMINISTIC', x: 120, y: 190,
        inputs: [{ id: 'in', name: 'input', type: 'any' }], outputs: [{ id: 'out', name: 'response', type: 'any' }],
        body: '', value: 'Describe something you want to understand.'
      },
      {
        id: 'instruction-1', kind: 'instruction', role: 'instruction', epistemicState: 'known', provenance: { origin: 'user', createdAt },
        title: 'Look another way', operation: 'MODEL', x: 420, y: 190,
        inputs: [{ id: 'in', name: 'input', type: 'text' }], outputs: [{ id: 'out', name: 'text', type: 'text' }],
        body: 'Offer one useful alternative way to understand the input. Keep it clear and concise.'
      },
      {
        id: 'expression-1', kind: 'expression', role: 'evaluation', epistemicState: 'known', provenance: { origin: 'deterministic', createdAt },
        title: 'Check', operation: 'DETERMINISTIC', expressionClass: 'EXECUTABLE', x: 720, y: 190,
        inputs: [{ id: 'in', name: 'input', type: 'text' }], outputs: [{ id: 'out', name: 'valid', type: 'boolean' }],
        body: 'notEmpty(input)'
      },
      {
        id: 'output-1', kind: 'output', role: 'result', epistemicState: 'inferred', provenance: { origin: 'deterministic', createdAt },
        title: 'Result', operation: 'DETERMINISTIC', x: 1020, y: 190,
        inputs: [{ id: 'in', name: 'input', type: 'boolean' }], outputs: [], body: ''
      }
    ],
    connections: [
      { id: 'e1', fromFrame: 'asset-1', fromPort: 'out', toFrame: 'instruction-1', toPort: 'in', kind: 'execution', meaning: 'feeds', provenance: { origin: 'user', createdAt } },
      { id: 'e2', fromFrame: 'instruction-1', fromPort: 'out', toFrame: 'expression-1', toPort: 'in', kind: 'execution', meaning: 'feeds', provenance: { origin: 'user', createdAt } },
      { id: 'e3', fromFrame: 'expression-1', fromPort: 'out', toFrame: 'output-1', toPort: 'in', kind: 'execution', meaning: 'feeds', provenance: { origin: 'user', createdAt } }
    ]
  };
}
