import type { FrameworkDocument, FrameKind, OperationMode, ValueType } from './types';

export const FRAMEWORK_EXPORT_FORMAT = 'visual-framework';
export const FRAMEWORK_EXPORT_VERSION = 1;

const FRAME_KINDS = new Set<FrameKind>(['asset', 'instruction', 'expression', 'check', 'output']);
const OPERATIONS = new Set<OperationMode>(['DETERMINISTIC', 'MODEL']);
const VALUE_TYPES = new Set<ValueType>(['text', 'boolean', 'number', 'json', 'any']);
const CONNECTION_KINDS = new Set(['execution', 'semantic', 'both']);

const isRecord = (value: unknown): value is Record<string, any> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

function executionCycle(framework: FrameworkDocument): boolean {
  const next = new Map<string, string[]>();
  for (const connection of framework.connections) {
    if (connection.kind === 'semantic') continue;
    next.set(connection.fromFrame, [...(next.get(connection.fromFrame) ?? []), connection.toFrame]);
  }
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const visit = (id: string): boolean => {
    if (visiting.has(id)) return true;
    if (visited.has(id)) return false;
    visiting.add(id);
    for (const target of next.get(id) ?? []) {
      if (visit(target)) return true;
    }
    visiting.delete(id);
    visited.add(id);
    return false;
  };
  return framework.frames.some(frame => visit(frame.id));
}

function hierarchyCycle(framework: FrameworkDocument): boolean {
  const parent = new Map(framework.frames.filter(frame => frame.parentId).map(frame => [frame.id, frame.parentId!]));
  for (const frame of framework.frames) {
    const seen = new Set<string>();
    let current: string | undefined = frame.id;
    while (current) {
      if (seen.has(current)) return true;
      seen.add(current);
      current = parent.get(current);
    }
  }
  return false;
}

export function validatePortableFramework(value: unknown): string[] {
  const errors: string[] = [];
  if (!isRecord(value)) return ['Framework JSON must contain an object.'];
  if (typeof value.id !== 'string' || !value.id.trim()) errors.push('Framework id is missing.');
  if (typeof value.name !== 'string' || !value.name.trim()) errors.push('Framework name is missing.');
  if (!Array.isArray(value.frames)) errors.push('Frames must be an array.');
  if (!Array.isArray(value.connections)) errors.push('Connections must be an array.');
  if (errors.length) return errors;

  const frames = value.frames as Record<string, any>[];
  const connections = value.connections as Record<string, any>[];
  const frameIds = new Set<string>();
  const layerIds = new Set<string>();

  for (const frame of frames) {
    if (!isRecord(frame) || typeof frame.id !== 'string' || !frame.id) {
      errors.push('Every Frame needs an id.');
      continue;
    }
    if (frameIds.has(frame.id)) errors.push(`Duplicate Frame id: ${frame.id}`);
    frameIds.add(frame.id);
    if (!FRAME_KINDS.has(frame.kind as FrameKind)) errors.push(`Invalid Frame kind: ${frame.id}`);
    if (!OPERATIONS.has(frame.operation as OperationMode)) errors.push(`Invalid Frame operation: ${frame.id}`);
    if (typeof frame.title !== 'string') errors.push(`Invalid Frame title: ${frame.id}`);
    if (!Number.isFinite(frame.x) || !Number.isFinite(frame.y)) errors.push(`Invalid Frame position: ${frame.id}`);
    if (!Array.isArray(frame.inputs) || !Array.isArray(frame.outputs)) {
      errors.push(`Invalid Frame ports: ${frame.id}`);
      continue;
    }
    const portIds = new Set<string>();
    for (const port of [...frame.inputs, ...frame.outputs]) {
      if (!isRecord(port) || typeof port.id !== 'string' || !port.id || typeof port.name !== 'string' || !VALUE_TYPES.has(port.type as ValueType)) {
        errors.push(`Invalid port on Frame: ${frame.id}`);
        continue;
      }
      if (portIds.has(port.id)) errors.push(`Duplicate port id on Frame ${frame.id}: ${port.id}`);
      portIds.add(port.id);
    }
  }

  if (Array.isArray(value.layers)) {
    for (const layer of value.layers) {
      if (!isRecord(layer) || typeof layer.id !== 'string' || !layer.id) {
        errors.push('Every Layer needs an id.');
        continue;
      }
      if (layerIds.has(layer.id)) errors.push(`Duplicate Layer id: ${layer.id}`);
      layerIds.add(layer.id);
      if (typeof layer.name !== 'string' || ![layer.x, layer.y, layer.width, layer.height].every(Number.isFinite)) {
        errors.push(`Invalid Layer: ${layer.id}`);
      }
    }
  }

  for (const frame of frames) {
    if (!isRecord(frame) || typeof frame.id !== 'string') continue;
    if (frame.parentId && (!frameIds.has(frame.parentId) || frame.parentId === frame.id)) errors.push(`Invalid parent for Frame: ${frame.id}`);
    if (frame.layerId && !layerIds.has(frame.layerId)) errors.push(`Missing Layer for Frame: ${frame.id}`);
  }

  const connectionIds = new Set<string>();
  const occupiedInputs = new Set<string>();
  for (const connection of connections) {
    if (!isRecord(connection) || typeof connection.id !== 'string' || !connection.id) {
      errors.push('Every connection needs an id.');
      continue;
    }
    if (connectionIds.has(connection.id)) errors.push(`Duplicate connection id: ${connection.id}`);
    connectionIds.add(connection.id);
    if (!frameIds.has(connection.fromFrame) || !frameIds.has(connection.toFrame)) {
      errors.push(`Connection references a missing Frame: ${connection.id}`);
      continue;
    }
    const kind = connection.kind ?? 'execution';
    if (!CONNECTION_KINDS.has(kind)) errors.push(`Invalid connection kind: ${connection.id}`);
    if (kind !== 'semantic') {
      const from = frames.find(frame => frame.id === connection.fromFrame);
      const to = frames.find(frame => frame.id === connection.toFrame);
      if (!from?.outputs?.some((port: any) => port.id === connection.fromPort)) errors.push(`Missing output port: ${connection.id}`);
      if (!to?.inputs?.some((port: any) => port.id === connection.toPort)) errors.push(`Missing input port: ${connection.id}`);
      const inputKey = `${connection.toFrame}:${connection.toPort}`;
      if (occupiedInputs.has(inputKey)) errors.push(`Input has more than one execution cable: ${inputKey}`);
      occupiedInputs.add(inputKey);
    }
  }

  if (!errors.length) {
    const framework = value as unknown as FrameworkDocument;
    if (executionCycle(framework)) errors.push('Execution graph contains a cycle.');
    if (hierarchyCycle(framework)) errors.push('Hierarchy contains a cycle.');
  }
  return errors;
}

export function serializeFramework(framework: FrameworkDocument): string {
  return JSON.stringify({
    format: FRAMEWORK_EXPORT_FORMAT,
    formatVersion: FRAMEWORK_EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    framework
  }, null, 2);
}

export function parseFrameworkExport(text: string): FrameworkDocument {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('The selected file is not valid JSON.');
  }

  let candidate: unknown = parsed;
  if (isRecord(parsed) && parsed.format === FRAMEWORK_EXPORT_FORMAT) {
    if (parsed.formatVersion !== FRAMEWORK_EXPORT_VERSION) {
      throw new Error(`Unsupported VFA export version: ${String(parsed.formatVersion)}`);
    }
    candidate = parsed.framework;
  }

  const errors = validatePortableFramework(candidate);
  if (errors.length) throw new Error(errors.join(' '));

  const framework = candidate as FrameworkDocument;
  return {
    ...framework,
    frames: framework.frames.map(frame => ({ ...frame, inputs: [...frame.inputs], outputs: [...frame.outputs] })),
    connections: framework.connections.map(connection => ({ ...connection })),
    layers: [...(framework.layers ?? [])],
    proposals: [...(framework.proposals ?? [])],
    transformations: [...(framework.transformations ?? [])],
    version: framework.version ?? 1,
    updatedAt: framework.updatedAt || new Date().toISOString()
  };
}
