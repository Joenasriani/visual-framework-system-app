import type { FrameworkDocument } from './types';

export const FRAME_WIDTH = 216;
export const FRAME_HEIGHT = 112;

export function createSeedFramework(): FrameworkDocument {
  return {
    id: 'framework-main',
    name: 'Framework',
    updatedAt: new Date().toISOString(),
    frames: [
      {
        id: 'asset-1', kind: 'asset', title: 'Source', operation: 'DETERMINISTIC', x: 120, y: 190,
        inputs: [], outputs: [{ id: 'out', name: 'text', type: 'text' }],
        body: 'Reusable source', value: 'A useful system makes its assumptions inspectable.'
      },
      {
        id: 'instruction-1', kind: 'instruction', title: 'Step', operation: 'MODEL', x: 420, y: 190,
        inputs: [{ id: 'in', name: 'input', type: 'text' }], outputs: [{ id: 'out', name: 'text', type: 'text' }],
        body: 'State the claim:'
      },
      {
        id: 'expression-1', kind: 'expression', title: 'Logic', operation: 'DETERMINISTIC', expressionClass: 'EXECUTABLE', x: 720, y: 190,
        inputs: [{ id: 'in', name: 'input', type: 'text' }], outputs: [{ id: 'out', name: 'valid', type: 'boolean' }],
        body: 'notEmpty(input)'
      },
      {
        id: 'output-1', kind: 'output', title: 'Result', operation: 'DETERMINISTIC', x: 1020, y: 190,
        inputs: [{ id: 'in', name: 'input', type: 'boolean' }], outputs: [], body: ''
      }
    ],
    connections: [
      { id: 'e1', fromFrame: 'asset-1', fromPort: 'out', toFrame: 'instruction-1', toPort: 'in' },
      { id: 'e2', fromFrame: 'instruction-1', fromPort: 'out', toFrame: 'expression-1', toPort: 'in' },
      { id: 'e3', fromFrame: 'expression-1', fromPort: 'out', toFrame: 'output-1', toPort: 'in' }
    ]
  };
}
