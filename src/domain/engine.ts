import type { Connection, Frame, FrameworkDocument, FrameworkRun, RunEvent, RunStep, ValueType } from './types';

export const compatible = (outType: ValueType, inType: ValueType) =>
  outType === inType || outType === 'any' || inType === 'any';

function frameById(framework: FrameworkDocument, id: string) {
  return framework.frames.find(frame => frame.id === id);
}

export function validateFramework(framework: FrameworkDocument): string[] {
  const errors: string[] = [];
  for (const connection of framework.connections) {
    const from = frameById(framework, connection.fromFrame);
    const to = frameById(framework, connection.toFrame);
    if (!from || !to) {
      errors.push(`Broken connection: ${connection.id}`);
      continue;
    }
    const output = from.outputs.find(port => port.id === connection.fromPort);
    const input = to.inputs.find(port => port.id === connection.toPort);
    if (!output || !input) {
      errors.push(`Missing port: ${connection.id}`);
      continue;
    }
    if (!compatible(output.type, input.type)) {
      errors.push(`${from.title}.${output.name} to ${to.title}.${input.name}: ${output.type} is not compatible with ${input.type}`);
    }
  }

  for (const frame of framework.frames) {
    for (const input of frame.inputs) {
      const incoming = framework.connections.some(connection => connection.toFrame === frame.id && connection.toPort === input.id);
      if (!incoming && frame.kind !== 'asset') errors.push(`${frame.title}: ${input.name} is not connected`);
    }
  }
  return errors;
}

function topologicalOrder(framework: FrameworkDocument): Frame[] {
  const indegree = new Map(framework.frames.map(frame => [frame.id, 0]));
  const next = new Map<string, string[]>();

  for (const connection of framework.connections) {
    indegree.set(connection.toFrame, (indegree.get(connection.toFrame) ?? 0) + 1);
    next.set(connection.fromFrame, [...(next.get(connection.fromFrame) ?? []), connection.toFrame]);
  }

  const queue = framework.frames.filter(frame => (indegree.get(frame.id) ?? 0) === 0).map(frame => frame.id);
  const ordered: Frame[] = [];
  while (queue.length) {
    const id = queue.shift()!;
    const frame = frameById(framework, id);
    if (frame) ordered.push(frame);
    for (const target of next.get(id) ?? []) {
      indegree.set(target, (indegree.get(target) ?? 1) - 1);
      if (indegree.get(target) === 0) queue.push(target);
    }
  }
  if (ordered.length !== framework.frames.length) throw new Error('Cycle detected');
  return ordered;
}

function evaluateExpression(body: string, input: unknown): unknown {
  const expression = body.trim();
  if (expression === 'length(input)') return String(input ?? '').length;
  if (expression === 'notEmpty(input)') return String(input ?? '').trim().length > 0;
  if (expression === 'uppercase(input)') return String(input ?? '').toUpperCase();
  if (expression === 'lowercase(input)') return String(input ?? '').toLowerCase();
  if (expression === 'json(input)') return JSON.stringify(input);
  throw new Error(`Unsupported expression: ${expression}`);
}

async function callModel(frame: Frame, input: unknown): Promise<string> {
  const response = await fetch('/api/model', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: frame.title, instruction: frame.body || '', input })
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.error || 'MODEL FAILED');
  if (typeof data?.output !== 'string' || !data.output.trim()) throw new Error('EMPTY MODEL OUTPUT');
  return data.output.trim();
}

async function executeFrameOperation(frame: Frame, input: unknown): Promise<unknown> {
  if (frame.kind === 'asset') return frame.value ?? frame.body;
  if (frame.operation === 'MODEL') return callModel(frame, input);
  if (frame.kind === 'expression') {
    return frame.expressionClass === 'DESCRIPTIVE' ? input : evaluateExpression(frame.body, input);
  }
  if (frame.kind === 'check') return Boolean(input);
  if (frame.kind === 'instruction') return `${frame.body}${input == null ? '' : `\n${String(input)}`}`.trim();
  return input;
}

function gatheredInput(connections: Connection[], outputs: Map<string, unknown>, frameId: string): unknown {
  const incoming = connections.filter(connection => connection.toFrame === frameId);
  const values = incoming.map(connection => outputs.get(connection.fromFrame));
  return values.length <= 1 ? values[0] : values;
}

function runId() {
  return `run-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}

export async function runFramework(
  framework: FrameworkDocument,
  onEvent?: (event: RunEvent) => void
): Promise<FrameworkRun> {
  const startedAt = new Date().toISOString();
  const run: FrameworkRun = {
    id: runId(), frameworkId: framework.id, status: 'running', startedAt, activeFrameId: null, steps: []
  };

  const validation = validateFramework(framework);
  if (validation.length) {
    run.status = 'error';
    run.endedAt = new Date().toISOString();
    run.steps = validation.map((error, index) => ({
      frameId: `validation-${index}`, status: 'error', input: null, error, durationMs: 0
    }));
    onEvent?.({ type: 'run-completed', run: { ...run } });
    return run;
  }

  let ordered: Frame[];
  try {
    ordered = topologicalOrder(framework);
  } catch (error) {
    run.status = 'error';
    run.endedAt = new Date().toISOString();
    run.steps = [{ frameId: 'graph', status: 'error', input: null, error: error instanceof Error ? error.message : 'Cycle detected', durationMs: 0 }];
    onEvent?.({ type: 'run-completed', run: { ...run } });
    return run;
  }

  const outputs = new Map<string, unknown>();
  for (const frame of ordered) {
    const input = gatheredInput(framework.connections, outputs, frame.id);
    run.activeFrameId = frame.id;
    onEvent?.({ type: 'frame-started', frameId: frame.id, run: { ...run, steps: [...run.steps] } });
    const started = performance.now();
    try {
      const output = await executeFrameOperation(frame, input);
      outputs.set(frame.id, output);
      const step: RunStep = {
        frameId: frame.id, status: 'ok', input, output, durationMs: +(performance.now() - started).toFixed(2)
      };
      run.steps = [...run.steps, step];
      run.activeFrameId = null;
      onEvent?.({ type: 'frame-completed', frameId: frame.id, run: { ...run, steps: [...run.steps] } });
    } catch (error) {
      const step: RunStep = {
        frameId: frame.id, status: 'error', input,
        error: error instanceof Error ? error.message : 'Execution failed',
        durationMs: +(performance.now() - started).toFixed(2)
      };
      run.steps = [...run.steps, step];
      run.activeFrameId = null;
      run.status = 'error';
      run.endedAt = new Date().toISOString();
      onEvent?.({ type: 'run-completed', run: { ...run, steps: [...run.steps] } });
      return run;
    }
  }

  run.status = 'ok';
  run.endedAt = new Date().toISOString();
  run.activeFrameId = null;
  onEvent?.({ type: 'run-completed', run: { ...run, steps: [...run.steps] } });
  return run;
}

export async function runSingleFrame(
  framework: FrameworkDocument,
  frameId: string,
  previousRun?: FrameworkRun | null
): Promise<FrameworkRun> {
  const frame = frameById(framework, frameId);
  const startedAt = new Date().toISOString();
  const run: FrameworkRun = {
    id: runId(), frameworkId: framework.id, status: 'running', startedAt, activeFrameId: frameId, steps: []
  };
  if (!frame) {
    return { ...run, status: 'error', endedAt: new Date().toISOString(), activeFrameId: null, steps: [{ frameId, status: 'error', input: null, error: 'Frame not found', durationMs: 0 }] };
  }

  const incoming = framework.connections.filter(connection => connection.toFrame === frameId);
  const prior = new Map((previousRun?.steps ?? []).filter(step => step.status === 'ok').map(step => [step.frameId, step.output]));
  for (const connection of incoming) {
    if (prior.has(connection.fromFrame)) continue;
    const upstream = frameById(framework, connection.fromFrame);
    if (upstream?.kind === 'asset') prior.set(upstream.id, upstream.value ?? upstream.body);
  }
  const input = gatheredInput(incoming, prior, frameId);
  if (frame.inputs.length && incoming.length && input === undefined) {
    return { ...run, status: 'error', endedAt: new Date().toISOString(), activeFrameId: null, steps: [{ frameId, status: 'error', input: null, error: 'Required upstream result is not available', durationMs: 0 }] };
  }

  const started = performance.now();
  try {
    const output = await executeFrameOperation(frame, input);
    return {
      ...run, status: 'ok', endedAt: new Date().toISOString(), activeFrameId: null,
      steps: [{ frameId, status: 'ok', input, output, durationMs: +(performance.now() - started).toFixed(2) }]
    };
  } catch (error) {
    return {
      ...run, status: 'error', endedAt: new Date().toISOString(), activeFrameId: null,
      steps: [{ frameId, status: 'error', input, error: error instanceof Error ? error.message : 'Execution failed', durationMs: +(performance.now() - started).toFixed(2) }]
    };
  }
}
