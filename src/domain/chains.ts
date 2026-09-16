import type {
  ChainDefinition,
  ChainType,
  ConditionRule,
  Connection,
  ExecutionMode,
  Frame,
  FrameworkDocument,
  FrameworkPattern,
  RelationshipMeaning
} from './types';

const FRAME_GAP_X = 286;
const FRAME_GAP_Y = 154;
const STRUCTURAL_CHAIN_TYPES = new Set<ChainType>(['hierarchy','contain','nested','nested-branch','recursive-framework']);

const clone = <T,>(value: T): T => structuredClone(value);
const now = () => new Date().toISOString();

export const CHAIN_TYPES: ChainType[] = [
  'sequence', 'branch', 'merge', 'diamond', 'parallel', 'hierarchy', 'contain', 'nested',
  'nested-branch', 'cascade', 'conditional', 'gate', 'reciprocal', 'feedback', 'network',
  'recursive-framework', 'freeform'
];

export const EXECUTION_MODES: ExecutionMode[] = [
  'sequential', 'parallel', 'ordered-parallel', 'conditional', 'manual', 'iterative'
];

export function defaultExecutionMode(type: ChainType): ExecutionMode {
  if (type === 'parallel' || type === 'branch' || type === 'diamond') return 'parallel';
  if (type === 'conditional') return 'conditional';
  if (type === 'reciprocal' || type === 'feedback') return 'iterative';
  return 'sequential';
}

function firstOutput(frame: Frame) {
  return frame.outputs[0]?.id ?? '';
}

function firstInput(frame: Frame) {
  return frame.inputs[0]?.id ?? '';
}

function canExecuteBetween(from: Frame, to: Frame) {
  return Boolean(firstOutput(from) && firstInput(to));
}

function executionConnection(
  chain: ChainDefinition,
  from: Frame,
  to: Frame,
  order: number,
  options?: { condition?: ConditionRule; feedback?: boolean; meaning?: RelationshipMeaning }
): Connection | null {
  if (!canExecuteBetween(from, to)) return null;
  return {
    id: `${chain.id}-edge-${order}-${from.id}-${to.id}`,
    fromFrame: from.id,
    fromPort: firstOutput(from),
    toFrame: to.id,
    toPort: firstInput(to),
    kind: 'execution',
    meaning: options?.meaning ?? chain.relationMeaning ?? 'feeds',
    chainId: chain.id,
    chainType: chain.type,
    executionMode: chain.executionMode,
    order,
    condition: options?.condition,
    isFeedback: options?.feedback,
    provenance: chain.provenance
  };
}

function semanticContains(chain: ChainDefinition, parent: Frame, child: Frame, order: number): Connection {
  return {
    id: `${chain.id}-contains-${order}-${parent.id}-${child.id}`,
    fromFrame: parent.id,
    fromPort: '',
    toFrame: child.id,
    toPort: '',
    kind: 'semantic',
    meaning: 'contains',
    chainId: chain.id,
    chainType: chain.type,
    order,
    provenance: chain.provenance
  };
}

function sortedSelection(doc: FrameworkDocument, frameIds: string[]) {
  const requested = new Map(frameIds.map((id, index) => [id, index]));
  return doc.frames
    .filter(frame => requested.has(frame.id))
    .sort((a, b) => (requested.get(a.id) ?? 0) - (requested.get(b.id) ?? 0));
}

function arrange(frames: Frame[], type: ChainType): Frame[] {
  if (!frames.length) return frames;
  const minX = Math.min(...frames.map(frame => frame.x));
  const minY = Math.min(...frames.map(frame => frame.y));
  const place = (frame: Frame, x: number, y: number) => ({ ...frame, x, y });

  if (type === 'sequence' || type === 'cascade' || type === 'feedback' || type === 'reciprocal') {
    return frames.map((frame, index) => place(frame, minX + index * FRAME_GAP_X, minY));
  }

  if (type === 'branch' || type === 'conditional') {
    const children = frames.slice(1);
    const centerY = minY + Math.max(0, (children.length - 1) * FRAME_GAP_Y / 2);
    return [place(frames[0], minX, centerY), ...children.map((frame, index) => place(frame, minX + FRAME_GAP_X, minY + index * FRAME_GAP_Y))];
  }

  if (type === 'merge' || type === 'gate') {
    const sources = frames.slice(0, -1);
    const centerY = minY + Math.max(0, (sources.length - 1) * FRAME_GAP_Y / 2);
    return [...sources.map((frame, index) => place(frame, minX, minY + index * FRAME_GAP_Y)), place(frames.at(-1)!, minX + FRAME_GAP_X, centerY)];
  }

  if (type === 'diamond' || type === 'parallel') {
    if (frames.length < 3) return frames.map((frame, index) => place(frame, minX + index * FRAME_GAP_X, minY));
    const middle = frames.slice(1, -1);
    const centerY = minY + Math.max(0, (middle.length - 1) * FRAME_GAP_Y / 2);
    return [
      place(frames[0], minX, centerY),
      ...middle.map((frame, index) => place(frame, minX + FRAME_GAP_X, minY + index * FRAME_GAP_Y)),
      place(frames.at(-1)!, minX + FRAME_GAP_X * 2, centerY)
    ];
  }

  if (type === 'hierarchy' || type === 'contain' || type === 'recursive-framework') {
    return frames.map((frame, index) => place(frame, minX + (index === 0 ? 0 : FRAME_GAP_X), minY + Math.max(0, index - 1) * FRAME_GAP_Y));
  }

  if (type === 'nested' || type === 'nested-branch') {
    return frames.map((frame, index) => place(frame, minX + index * 54, minY + index * 128));
  }

  if (type === 'network') {
    const cols = Math.max(2, Math.ceil(Math.sqrt(frames.length)));
    return frames.map((frame, index) => place(frame, minX + (index % cols) * FRAME_GAP_X, minY + Math.floor(index / cols) * FRAME_GAP_Y));
  }

  return frames;
}

function makeRecursiveContainer(frames: Frame[]): Frame {
  const createdAt = now();
  const minX = Math.min(...frames.map(frame => frame.x));
  const minY = Math.min(...frames.map(frame => frame.y));
  return {
    id: `framework-frame-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
    kind: 'framework',
    role: 'framework',
    epistemicState: 'known',
    provenance: { origin: 'user', createdAt },
    title: 'Sub-framework',
    operation: 'DETERMINISTIC',
    controlState: 'active',
    x: Math.max(20, minX - 260),
    y: minY,
    inputs: [{ id: 'in', name: 'input', type: 'any' }],
    outputs: [{ id: 'out', name: 'result', type: 'any' }],
    body: 'Contained executable framework',
    collapsed: false
  };
}

function chainEdges(chain: ChainDefinition, frames: Frame[]): Connection[] {
  const edges: Array<Connection | null> = [];
  if (frames.length < 2) return [];

  if (chain.type === 'sequence' || chain.type === 'cascade') {
    for (let index = 0; index < frames.length - 1; index++) edges.push(executionConnection(chain, frames[index], frames[index + 1], index));
  } else if (chain.type === 'branch') {
    for (let index = 1; index < frames.length; index++) edges.push(executionConnection(chain, frames[0], frames[index], index - 1));
  } else if (chain.type === 'merge' || chain.type === 'gate') {
    const target = frames.at(-1)!;
    for (let index = 0; index < frames.length - 1; index++) edges.push(executionConnection(chain, frames[index], target, index));
  } else if (chain.type === 'diamond' || chain.type === 'parallel') {
    if (frames.length === 2) edges.push(executionConnection(chain, frames[0], frames[1], 0));
    else {
      const source = frames[0];
      const target = frames.at(-1)!;
      frames.slice(1, -1).forEach((frame, index) => {
        edges.push(executionConnection(chain, source, frame, index * 2));
        edges.push(executionConnection(chain, frame, target, index * 2 + 1));
      });
    }
  } else if (chain.type === 'conditional') {
    const source = frames[0];
    frames.slice(1).forEach((frame, index) => {
      const condition: ConditionRule = index === 0
        ? { operator: 'truthy', label: 'true' }
        : index === 1
          ? { operator: 'falsy', label: 'false' }
          : { operator: 'equals', value: String(index + 1), label: `route ${index + 1}` };
      edges.push(executionConnection(chain, source, frame, index, { condition }));
    });
  } else if (chain.type === 'reciprocal') {
    edges.push(executionConnection(chain, frames[0], frames[1], 0));
    edges.push(executionConnection(chain, frames[1], frames[0], 1, { feedback: true }));
  } else if (chain.type === 'feedback') {
    for (let index = 0; index < frames.length - 1; index++) edges.push(executionConnection(chain, frames[index], frames[index + 1], index));
    edges.push(executionConnection(chain, frames.at(-1)!, frames[0], frames.length, { feedback: true }));
  } else if (chain.type === 'network') {
    let order = 0;
    for (let from = 0; from < frames.length; from++) {
      for (let to = from + 1; to < frames.length; to++) edges.push(executionConnection(chain, frames[from], frames[to], order++));
    }
  }

  return edges.filter((edge): edge is Connection => Boolean(edge));
}

export function applyChain(
  framework: FrameworkDocument,
  frameIds: string[],
  type: ChainType,
  executionMode = defaultExecutionMode(type)
): FrameworkDocument {
  const sourceFrames = sortedSelection(framework, frameIds);
  if (sourceFrames.length < 2 && type !== 'recursive-framework') return framework;

  const createdAt = now();
  const chain: ChainDefinition = {
    id: `chain-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
    label: `${type.replaceAll('-', ' ')} chain`,
    type,
    frameIds: sourceFrames.map(frame => frame.id),
    executionMode,
    iterationLimit: type === 'feedback' || type === 'reciprocal' ? 3 : undefined,
    createdAt,
    provenance: { origin: 'user', createdAt },
    relationMeaning: 'feeds'
  };

  let frames = clone(framework.frames);
  let selected = sourceFrames;
  const selectedIds = new Set(sourceFrames.map(frame => frame.id));
  const structuralOnly = STRUCTURAL_CHAIN_TYPES.has(type);

  if (type === 'recursive-framework') {
    const container = makeRecursiveContainer(sourceFrames);
    chain.frameIds = [container.id, ...chain.frameIds];
    frames = [...frames, container].map(frame => selectedIds.has(frame.id) ? { ...frame, parentId: container.id } : frame);
    selected = [container, ...sourceFrames.map(frame => ({ ...frame, parentId: container.id }))];
  } else if (type === 'hierarchy' || type === 'contain') {
    const parent = sourceFrames[0];
    frames = frames.map(frame => sourceFrames.slice(1).some(child => child.id === frame.id) ? { ...frame, parentId: parent.id } : frame);
  } else if (type === 'nested') {
    const parentByChild = new Map(sourceFrames.slice(1).map((frame, index) => [frame.id, sourceFrames[index].id]));
    frames = frames.map(frame => parentByChild.has(frame.id) ? { ...frame, parentId: parentByChild.get(frame.id) } : frame);
  } else if (type === 'nested-branch') {
    const root = sourceFrames[0];
    const inner = sourceFrames[1];
    frames = frames.map(frame => {
      if (frame.id === inner.id) return { ...frame, parentId: root.id };
      if (sourceFrames.slice(2).some(child => child.id === frame.id)) return { ...frame, parentId: inner.id };
      return frame;
    });
  }

  const arranged = arrange(selected, type);
  const arrangedMap = new Map(arranged.map(frame => [frame.id, frame]));
  frames = frames.map(frame => arrangedMap.has(frame.id) ? { ...frame, x: arrangedMap.get(frame.id)!.x, y: arrangedMap.get(frame.id)!.y, parentId: arrangedMap.get(frame.id)!.parentId ?? frame.parentId } : frame);

  const internalSelected = new Set(sourceFrames.map(frame => frame.id));
  const preservedConnections = framework.connections.filter(connection => {
    if (connection.kind === 'semantic') return true;
    if (structuralOnly) return true;
    return !(internalSelected.has(connection.fromFrame) && internalSelected.has(connection.toFrame));
  });

  let additions = chainEdges(chain, selected);
  if (type === 'hierarchy' || type === 'contain') {
    additions = sourceFrames.slice(1).map((frame, index) => semanticContains(chain, sourceFrames[0], frame, index));
  } else if (type === 'nested') {
    additions = sourceFrames.slice(1).map((frame, index) => semanticContains(chain, sourceFrames[index], frame, index));
  } else if (type === 'nested-branch') {
    additions = [semanticContains(chain, sourceFrames[0], sourceFrames[1], 0), ...sourceFrames.slice(2).map((frame, index) => semanticContains(chain, sourceFrames[1], frame, index + 1))];
  } else if (type === 'recursive-framework') {
    const container = selected[0];
    additions = selected.slice(1).map((frame, index) => semanticContains(chain, container, frame, index));
  }

  const existingChains = framework.chains ?? [];
  const retainedChains = structuralOnly
    ? existingChains
    : existingChains.filter(item => STRUCTURAL_CHAIN_TYPES.has(item.type) || !item.frameIds.every(id => selectedIds.has(id)));

  return {
    ...framework,
    frames,
    connections: [...preservedConnections, ...additions],
    chains: [...retainedChains, chain],
    version: (framework.version ?? 1) + 1,
    updatedAt: createdAt
  };
}

export function updateChain(framework: FrameworkDocument, chainId: string, patch: Partial<ChainDefinition>): FrameworkDocument {
  const createdAt = now();
  const chains = (framework.chains ?? []).map(chain => chain.id === chainId ? { ...chain, ...patch } : chain);
  const changed = chains.find(chain => chain.id === chainId);
  return {
    ...framework,
    chains,
    connections: framework.connections.map(connection => connection.chainId === chainId && changed ? {
      ...connection,
      chainType: changed.type,
      executionMode: changed.executionMode,
      meaning: changed.relationMeaning ?? connection.meaning
    } : connection),
    version: (framework.version ?? 1) + 1,
    updatedAt: createdAt
  };
}

export function reverseChain(framework: FrameworkDocument, chainId: string): FrameworkDocument {
  const chain = (framework.chains ?? []).find(item => item.id === chainId);
  if (!chain || chain.frameIds.length < 2 || STRUCTURAL_CHAIN_TYPES.has(chain.type)) return framework;
  const reversed = [...chain.frameIds].reverse();
  const without = {
    ...framework,
    connections: framework.connections.filter(connection => connection.chainId !== chainId),
    chains: (framework.chains ?? []).filter(item => item.id !== chainId)
  };
  const rebuilt = applyChain(without, reversed, chain.type, chain.executionMode);
  const newChain = rebuilt.chains?.at(-1);
  if (!newChain) return rebuilt;
  return {
    ...rebuilt,
    chains: rebuilt.chains?.map(item => item.id === newChain.id ? { ...item, id: chainId, label: chain.label, iterationLimit: chain.iterationLimit, paused: chain.paused, bypassed: chain.bypassed } : item),
    connections: rebuilt.connections.map(connection => connection.chainId === newChain.id ? { ...connection, chainId } : connection)
  };
}

export function removeChain(framework: FrameworkDocument, chainId: string, removeConnections = false): FrameworkDocument {
  return {
    ...framework,
    chains: (framework.chains ?? []).filter(chain => chain.id !== chainId),
    connections: removeConnections
      ? framework.connections.filter(connection => connection.chainId !== chainId)
      : framework.connections.map(connection => connection.chainId === chainId ? { ...connection, chainId: undefined, chainType: undefined, executionMode: undefined } : connection),
    version: (framework.version ?? 1) + 1,
    updatedAt: now()
  };
}

export function saveChainPattern(framework: FrameworkDocument, chainId: string, name?: string): FrameworkDocument {
  const chain = (framework.chains ?? []).find(item => item.id === chainId);
  if (!chain) return framework;
  const frames = chain.frameIds.map(id => framework.frames.find(frame => frame.id === id)).filter((frame): frame is Frame => Boolean(frame));
  const pattern: FrameworkPattern = {
    id: `pattern-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
    name: name?.trim() || chain.label,
    chainType: chain.type,
    executionMode: chain.executionMode,
    frameTemplates: frames.map(frame => ({
      kind: frame.kind,
      role: frame.role,
      title: frame.title,
      operation: frame.operation,
      body: frame.body,
      inputs: clone(frame.inputs),
      outputs: clone(frame.outputs)
    })),
    createdAt: now()
  };
  return { ...framework, patterns: [...(framework.patterns ?? []), pattern], updatedAt: now() };
}
