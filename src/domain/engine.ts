import type { Connection, Frame, FrameworkDocument, FrameworkRun, RunEvent, RunStep, ValueType } from './types';

export const compatible = (outType: ValueType, inType: ValueType) =>
  outType === inType || outType === 'any' || inType === 'any';

const executionConnections = (framework: FrameworkDocument) =>
  framework.connections.filter(connection => !connection.kind || connection.kind === 'execution' || connection.kind === 'both');

function frameById(framework: FrameworkDocument, id: string) {
  return framework.frames.find(frame => frame.id === id);
}

export function validateFramework(framework: FrameworkDocument): string[] {
  const errors: string[] = [];
  const connections = executionConnections(framework);
  for (const connection of connections) {
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
      const incoming = connections.some(connection => connection.toFrame === frame.id && connection.toPort === input.id);
      if (!incoming && frame.kind !== 'asset') errors.push(`${frame.title}: ${input.name} is not connected`);
    }
  }
  return errors;
}

function executionBatches(framework: FrameworkDocument): Frame[][] {
  const connections = executionConnections(framework);
  const indegree = new Map(framework.frames.map(frame => [frame.id, 0]));
  const next = new Map<string, string[]>();

  for (const connection of connections) {
    indegree.set(connection.toFrame, (indegree.get(connection.toFrame) ?? 0) + 1);
    next.set(connection.fromFrame, [...(next.get(connection.fromFrame) ?? []), connection.toFrame]);
  }

  let ready = framework.frames.filter(frame => (indegree.get(frame.id) ?? 0) === 0).map(frame => frame.id);
  const batches: Frame[][] = [];
  let visited = 0;

  while (ready.length) {
    const currentIds = ready;
    const currentSet = new Set(currentIds);
    const batch = framework.frames.filter(frame => currentSet.has(frame.id));
    batches.push(batch);
    visited += batch.length;

    const newlyReady = new Set<string>();
    for (const id of currentIds) {
      for (const target of next.get(id) ?? []) {
        indegree.set(target, (indegree.get(target) ?? 1) - 1);
        if (indegree.get(target) === 0) newlyReady.add(target);
      }
    }
    ready = framework.frames.filter(frame => newlyReady.has(frame.id)).map(frame => frame.id);
  }

  if (visited !== framework.frames.length) throw new Error('Cycle detected');
  return batches;
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
  const instruction = frame.body?.trim() || `Respond using ${frame.title} as the active perspective.`;
  const stimulus = input ?? (frame.kind === 'asset' ? frame.value ?? null : null);
  const response = await fetch('/api/model', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: frame.title, instruction, input: stimulus })
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.error || 'MODEL FAILED');
  if (typeof data?.output !== 'string' || !data.output.trim()) throw new Error('EMPTY MODEL OUTPUT');
  return data.output.trim();
}

async function executeFrameOperation(frame: Frame, input: unknown): Promise<unknown> {
  if (frame.operation === 'MODEL') return callModel(frame, input);
  if (frame.kind === 'asset') return frame.value ?? frame.body;
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

function downstreamExecutionFrameIds(framework: FrameworkDocument, roots: string[]): Set<string> {
  const connections = executionConnections(framework);
  const next = new Map<string, string[]>();
  for (const connection of connections) {
    next.set(connection.fromFrame, [...(next.get(connection.fromFrame) ?? []), connection.toFrame]);
  }
  const found = new Set<string>();
  const queue = roots.filter(id => framework.frames.some(frame => frame.id === id));
  while (queue.length) {
    const id = queue.shift()!;
    if (found.has(id)) continue;
    found.add(id);
    for (const target of next.get(id) ?? []) {
      if (!found.has(target)) queue.push(target);
    }
  }
  return found;
}

function stepProvenance(runIdValue: string, frame: Frame) {
  return {
    origin: frame.operation === 'MODEL' ? 'model' as const : 'deterministic' as const,
    createdAt: new Date().toISOString(),
    runId: runIdValue,
    frameId: frame.id
  };
}

export async function runFramework(
  framework: FrameworkDocument,
  onEvent?: (event: RunEvent) => void
): Promise<FrameworkRun> {
  const startedAt = new Date().toISOString();
  const run: FrameworkRun = {
    id: runId(), frameworkId: framework.id, status: 'running', startedAt, activeFrameId: null, activeFrameIds: [], steps: []
  };

  const validation = validateFramework(framework);
  if (validation.length) {
    run.status = 'error';
    run.endedAt = new Date().toISOString();
    run.steps = validation.map((error, index) => ({
      frameId: `validation-${index}`, status: 'error', input: null, error, durationMs: 0, executor: 'DETERMINISTIC'
    }));
    onEvent?.({ type: 'run-completed', run: { ...run, activeFrameIds: [], steps: [...run.steps] } });
    return run;
  }

  let batches: Frame[][];
  try {
    batches = executionBatches(framework);
  } catch (error) {
    run.status = 'error';
    run.endedAt = new Date().toISOString();
    run.steps = [{ frameId: 'graph', status: 'error', input: null, error: error instanceof Error ? error.message : 'Cycle detected', durationMs: 0, executor: 'DETERMINISTIC' }];
    onEvent?.({ type: 'run-completed', run: { ...run, activeFrameIds: [], steps: [...run.steps] } });
    return run;
  }

  const outputs = new Map<string, unknown>();
  const connections = executionConnections(framework);

  for (const batch of batches) {
    const activeIds = batch.map(frame => frame.id);
    run.activeFrameIds = activeIds;
    run.activeFrameId = activeIds.length === 1 ? activeIds[0] : null;

    for (const frame of batch) {
      onEvent?.({
        type: 'frame-started',
        frameId: frame.id,
        run: { ...run, activeFrameIds: [...activeIds], steps: [...run.steps] }
      });
    }

    const results = await Promise.all(batch.map(async frame => {
      const input = gatheredInput(connections, outputs, frame.id);
      const started = performance.now();
      try {
        const output = await executeFrameOperation(frame, input);
        const step: RunStep = {
          frameId: frame.id,
          status: 'ok',
          input,
          output,
          durationMs: +(performance.now() - started).toFixed(2),
          executor: frame.operation,
          provenance: stepProvenance(run.id, frame)
        };
        return { frame, step, output };
      } catch (error) {
        const step: RunStep = {
          frameId: frame.id,
          status: 'error',
          input,
          error: error instanceof Error ? error.message : 'Execution failed',
          durationMs: +(performance.now() - started).toFixed(2),
          executor: frame.operation,
          provenance: stepProvenance(run.id, frame)
        };
        return { frame, step, output: undefined };
      }
    }));

    for (const result of results) {
      run.steps = [...run.steps, result.step];
      if (result.step.status === 'ok') outputs.set(result.frame.id, result.output);
      onEvent?.({
        type: 'frame-completed',
        frameId: result.frame.id,
        run: { ...run, activeFrameIds: [...activeIds], steps: [...run.steps] }
      });
    }

    run.activeFrameIds = [];
    run.activeFrameId = null;

    if (results.some(result => result.step.status === 'error')) {
      run.status = 'error';
      run.endedAt = new Date().toISOString();
      onEvent?.({ type: 'run-completed', run: { ...run, activeFrameIds: [], steps: [...run.steps] } });
      return run;
    }
  }

  run.status = 'ok';
  run.endedAt = new Date().toISOString();
  run.activeFrameId = null;
  run.activeFrameIds = [];
  onEvent?.({ type: 'run-completed', run: { ...run, activeFrameIds: [], steps: [...run.steps] } });
  return run;
}

export async function rerunAffectedFramework(
  framework: FrameworkDocument,
  changedFrameIds: string[],
  previousRun: FrameworkRun,
  onEvent?: (event: RunEvent) => void
): Promise<FrameworkRun> {
  if (
    previousRun.status !== 'ok' ||
    previousRun.frameworkId !== framework.id ||
    !changedFrameIds.length
  ) {
    return runFramework(framework, onEvent);
  }

  const validation = validateFramework(framework);
  if (validation.length) return runFramework(framework, onEvent);

  const affected = downstreamExecutionFrameIds(framework, changedFrameIds);
  if (!affected.size) return runFramework(framework, onEvent);

  const previousSteps = new Map(previousRun.steps.filter(step => step.status === 'ok').map(step => [step.frameId, step]));
  const missingReusable = framework.frames.some(frame => !affected.has(frame.id) && !previousSteps.has(frame.id));
  if (missingReusable) return runFramework(framework, onEvent);

  let batches: Frame[][];
  try {
    batches = executionBatches(framework);
  } catch {
    return runFramework(framework, onEvent);
  }

  const startedAt = new Date().toISOString();
  const run: FrameworkRun = {
    id: runId(),
    frameworkId: framework.id,
    status: 'running',
    startedAt,
    activeFrameId: null,
    activeFrameIds: [],
    steps: []
  };

  const outputs = new Map<string, unknown>();
  for (const [frameId, step] of previousSteps) {
    if (!affected.has(frameId)) outputs.set(frameId, step.output);
  }

  const createdAt = new Date().toISOString();
  for (const frame of framework.frames) {
    if (affected.has(frame.id)) continue;
    const prior = previousSteps.get(frame.id);
    if (!prior) continue;
    run.steps.push({
      ...prior,
      durationMs: 0,
      reusedFromRunId: previousRun.id,
      provenance: {
        origin: 'run',
        createdAt,
        source: `Reused unchanged output from ${previousRun.id}`,
        runId: previousRun.id,
        frameId: frame.id
      }
    });
  }

  const connections = executionConnections(framework);
  for (const batch of batches) {
    const affectedBatch = batch.filter(frame => affected.has(frame.id));
    if (!affectedBatch.length) continue;

    const activeIds = affectedBatch.map(frame => frame.id);
    run.activeFrameIds = activeIds;
    run.activeFrameId = activeIds.length === 1 ? activeIds[0] : null;

    for (const frame of affectedBatch) {
      onEvent?.({
        type: 'frame-started',
        frameId: frame.id,
        run: { ...run, activeFrameIds: [...activeIds], steps: [...run.steps] }
      });
    }

    const results = await Promise.all(affectedBatch.map(async frame => {
      const input = gatheredInput(connections, outputs, frame.id);
      const started = performance.now();
      try {
        const output = await executeFrameOperation(frame, input);
        const step: RunStep = {
          frameId: frame.id,
          status: 'ok',
          input,
          output,
          durationMs: +(performance.now() - started).toFixed(2),
          executor: frame.operation,
          provenance: stepProvenance(run.id, frame)
        };
        return { frame, step, output };
      } catch (error) {
        const step: RunStep = {
          frameId: frame.id,
          status: 'error',
          input,
          error: error instanceof Error ? error.message : 'Execution failed',
          durationMs: +(performance.now() - started).toFixed(2),
          executor: frame.operation,
          provenance: stepProvenance(run.id, frame)
        };
        return { frame, step, output: undefined };
      }
    }));

    for (const result of results) {
      run.steps = run.steps.filter(step => step.frameId !== result.frame.id);
      run.steps.push(result.step);
      if (result.step.status === 'ok') outputs.set(result.frame.id, result.output);
      onEvent?.({
        type: 'frame-completed',
        frameId: result.frame.id,
        run: { ...run, activeFrameIds: [...activeIds], steps: [...run.steps] }
      });
    }

    run.activeFrameIds = [];
    run.activeFrameId = null;

    if (results.some(result => result.step.status === 'error')) {
      run.status = 'error';
      run.endedAt = new Date().toISOString();
      onEvent?.({ type: 'run-completed', run: { ...run, activeFrameIds: [], steps: [...run.steps] } });
      return run;
    }
  }

  const order = new Map(framework.frames.map((frame, index) => [frame.id, index]));
  run.steps = [...run.steps].sort((a, b) => (order.get(a.frameId) ?? Number.MAX_SAFE_INTEGER) - (order.get(b.frameId) ?? Number.MAX_SAFE_INTEGER));
  run.status = 'ok';
  run.endedAt = new Date().toISOString();
  run.activeFrameId = null;
  run.activeFrameIds = [];
  onEvent?.({ type: 'run-completed', run: { ...run, activeFrameIds: [], steps: [...run.steps] } });
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
    id: runId(), frameworkId: framework.id, status: 'running', startedAt, activeFrameId: frameId, activeFrameIds: [frameId], steps: []
  };
  if (!frame) {
    return { ...run, status: 'error', endedAt: new Date().toISOString(), activeFrameId: null, activeFrameIds: [], steps: [{ frameId, status: 'error', input: null, error: 'Frame not found', durationMs: 0, executor: 'DETERMINISTIC' }] };
  }

  const incoming = executionConnections(framework).filter(connection => connection.toFrame === frameId);
  const prior = new Map((previousRun?.steps ?? []).filter(step => step.status === 'ok').map(step => [step.frameId, step.output]));
  for (const connection of incoming) {
    if (prior.has(connection.fromFrame)) continue;
    const upstream = frameById(framework, connection.fromFrame);
    if (upstream?.kind === 'asset') prior.set(upstream.id, upstream.value ?? upstream.body);
  }
  const input = gatheredInput(incoming, prior, frameId);
  if (frame.inputs.length && incoming.length && input === undefined) {
    return { ...run, status: 'error', endedAt: new Date().toISOString(), activeFrameId: null, activeFrameIds: [], steps: [{ frameId, status: 'error', input: null, error: 'Required upstream result is not available', durationMs: 0, executor: frame.operation }] };
  }

  const started = performance.now();
  try {
    const output = await executeFrameOperation(frame, input);
    return {
      ...run, status: 'ok', endedAt: new Date().toISOString(), activeFrameId: null, activeFrameIds: [],
      steps: [{ frameId, status: 'ok', input, output, durationMs: +(performance.now() - started).toFixed(2), executor: frame.operation, provenance: stepProvenance(run.id, frame) }]
    };
  } catch (error) {
    return {
      ...run, status: 'error', endedAt: new Date().toISOString(), activeFrameId: null, activeFrameIds: [],
      steps: [{ frameId, status: 'error', input, error: error instanceof Error ? error.message : 'Execution failed', durationMs: +(performance.now() - started).toFixed(2), executor: frame.operation, provenance: stepProvenance(run.id, frame) }]
    };
  }
}
