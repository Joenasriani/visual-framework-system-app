import type {
  Chain,
  ChainType,
  Connection,
  Frame,
  FrameworkDocument,
  RelationshipMeaning,
  ValueType
} from './types';

export interface ChainPlanLink {
  fromFrame: string;
  toFrame: string;
  kind: 'execution' | 'containment';
}

export interface ChainPlan {
  type: ChainType;
  frameIds: string[];
  links: ChainPlanLink[];
}

const uniquePairs = (links: ChainPlanLink[]) => {
  const seen = new Set<string>();
  return links.filter(link => {
    const key = `${link.kind}:${link.fromFrame}:${link.toFrame}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return link.fromFrame !== link.toFrame;
  });
};

export function buildChainPlan(type: ChainType, frameIds: string[]): ChainPlan {
  const ids = [...new Set(frameIds)];
  if (ids.length < 2) throw new Error('Select at least two elements to create a chain.');

  const first = ids[0];
  const last = ids[ids.length - 1];
  const middle = ids.slice(1, -1);
  let links: ChainPlanLink[] = [];

  switch (type) {
    case 'sequence':
    case 'cascade':
      links = ids.slice(0, -1).map((id, index) => ({ fromFrame: id, toFrame: ids[index + 1], kind: 'execution' }));
      break;
    case 'branch':
      links = ids.slice(1).map(id => ({ fromFrame: first, toFrame: id, kind: 'execution' }));
      break;
    case 'merge':
    case 'gate':
      links = ids.slice(0, -1).map(id => ({ fromFrame: id, toFrame: last, kind: 'execution' }));
      break;
    case 'diamond':
    case 'parallel':
      if (ids.length < 3) throw new Error('Diamond and Parallel chains need at least three selected elements.');
      links = [
        ...middle.map(id => ({ fromFrame: first, toFrame: id, kind: 'execution' as const })),
        ...middle.map(id => ({ fromFrame: id, toFrame: last, kind: 'execution' as const }))
      ];
      if (!middle.length) links = [{ fromFrame: first, toFrame: last, kind: 'execution' }];
      break;
    case 'hierarchy':
    case 'contain':
      links = ids.slice(1).map(id => ({ fromFrame: first, toFrame: id, kind: 'containment' }));
      break;
    case 'nested':
      links = ids.slice(0, -1).map((id, index) => ({ fromFrame: id, toFrame: ids[index + 1], kind: 'containment' }));
      break;
    case 'nested-branch':
      if (ids.length < 3) throw new Error('Nested Branch needs at least three selected elements.');
      links = [
        { fromFrame: first, toFrame: ids[1], kind: 'containment' },
        ...ids.slice(2).map(id => ({ fromFrame: ids[1], toFrame: id, kind: 'execution' as const }))
      ];
      break;
    case 'network':
      for (let i = 0; i < ids.length; i += 1) {
        for (let j = i + 1; j < ids.length; j += 1) {
          links.push({ fromFrame: ids[i], toFrame: ids[j], kind: 'execution' });
        }
      }
      break;
    case 'freeform':
      links = [];
      break;
    default:
      throw new Error(`${type} requires its dedicated execution semantics and is not available in the DAG-safe constructor.`);
  }

  return { type, frameIds: ids, links: uniquePairs(links) };
}

function nextOutput(frame: Frame): { frame: Frame; portId: string; type: ValueType } {
  const existing = frame.outputs[0];
  if (existing) return { frame, portId: existing.id, type: existing.type };
  const port = { id: 'chain-out', name: 'chain output', type: 'any' as ValueType };
  return { frame: { ...frame, outputs: [...frame.outputs, port] }, portId: port.id, type: port.type };
}

function nextInput(
  frame: Frame,
  sourceType: ValueType,
  occupied: Set<string>,
  serial: number
): { frame: Frame; portId: string } {
  const compatible = frame.inputs.find(port =>
    !occupied.has(`${frame.id}:${port.id}`) &&
    (port.type === sourceType || port.type === 'any' || sourceType === 'any')
  );
  if (compatible) return { frame, portId: compatible.id };
  const port = { id: `chain-in-${serial}`, name: `chain input ${serial}`, type: sourceType };
  return { frame: { ...frame, inputs: [...frame.inputs, port] }, portId: port.id };
}

const sameSet = (a: string[], b: string[]) =>
  a.length === b.length && a.every(id => b.includes(id));

export function applyChainPlan(framework: FrameworkDocument, plan: ChainPlan): FrameworkDocument {
  const selected = new Set(plan.frameIds);
  const createdAt = new Date().toISOString();
  const chainId = `chain-${Date.now()}-${Math.floor(Math.random() * 10000)}`;

  // A Chain operation converts the internal topology of exactly this selection.
  // Cross-boundary links and unrelated semantic relationships remain untouched.
  const retainedConnections = framework.connections.filter(connection => {
    const internal = selected.has(connection.fromFrame) && selected.has(connection.toFrame);
    if (!internal) return true;
    if (connection.kind !== 'semantic') return false;
    return connection.meaning !== 'contains' && connection.meaning !== 'part-of';
  });

  let frames = framework.frames.map(frame => {
    if (!selected.has(frame.id)) return frame;
    return {
      ...frame,
      parentId: undefined,
      executionMode: frame.executionMode ?? 'auto'
    };
  });
  const frameIndex = () => new Map(frames.map((frame, index) => [frame.id, index]));
  const createdConnections: Connection[] = [];
  const occupied = new Set(
    retainedConnections
      .filter(connection => connection.kind !== 'semantic')
      .map(connection => `${connection.toFrame}:${connection.toPort}`)
  );
  let portSerial = 1;

  for (const link of plan.links) {
    const indexes = frameIndex();
    const fromIndex = indexes.get(link.fromFrame);
    const toIndex = indexes.get(link.toFrame);
    if (fromIndex === undefined || toIndex === undefined) continue;

    if (link.kind === 'containment') {
      frames[toIndex] = { ...frames[toIndex], parentId: link.fromFrame };
      createdConnections.push({
        id: `${chainId}-contains-${createdConnections.length}`,
        fromFrame: link.fromFrame,
        fromPort: '',
        toFrame: link.toFrame,
        toPort: '',
        kind: 'semantic',
        meaning: 'contains' as RelationshipMeaning,
        chainId,
        provenance: { origin: 'user', createdAt }
      });
      continue;
    }

    const source = nextOutput(frames[fromIndex]);
    frames[fromIndex] = source.frame;
    const target = nextInput(frames[toIndex], source.type, occupied, portSerial++);
    frames[toIndex] = target.frame;
    occupied.add(`${link.toFrame}:${target.portId}`);
    createdConnections.push({
      id: `${chainId}-flow-${createdConnections.length}`,
      fromFrame: link.fromFrame,
      fromPort: source.portId,
      toFrame: link.toFrame,
      toPort: target.portId,
      kind: 'execution',
      meaning: 'feeds',
      chainId,
      provenance: { origin: 'user', createdAt }
    });
  }

  const chain: Chain = {
    id: chainId,
    name: plan.type.replaceAll('-', ' '),
    type: plan.type,
    frameIds: [...plan.frameIds],
    connectionIds: createdConnections.map(connection => connection.id),
    executionMode: 'auto',
    createdAt
  };

  return {
    ...framework,
    version: (framework.version ?? 1) + 1,
    updatedAt: createdAt,
    frames,
    connections: [...retainedConnections, ...createdConnections],
    chains: [...(framework.chains ?? []).filter(item => !sameSet(item.frameIds, plan.frameIds)), chain]
  };
}
