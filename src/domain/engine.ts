import { applyCompositeOperation, effectiveFrameBody } from './compositing';
import type {
  ChainDefinition,
  ConditionRule,
  Connection,
  CounterfactualRunMeta,
  ExecutionMode,
  Frame,
  FrameworkDocument,
  FrameworkRun,
  RunEvent,
  RunStep,
  ValueType
} from './types';

export const compatible = (outType: ValueType, inType: ValueType) =>
  outType === inType || outType === 'any' || inType === 'any';

const clone = <T,>(value: T): T => structuredClone(value);

function chainMap(framework: FrameworkDocument) {
  return new Map((framework.chains ?? []).map(chain => [chain.id, chain]));
}

const executionConnections = (framework: FrameworkDocument, includeFeedback = true) => {
  const chains = chainMap(framework);
  return framework.connections.filter(connection => {
    if (connection.kind === 'semantic') return false;
    if (!includeFeedback && connection.isFeedback) return false;
    const chain = connection.chainId ? chains.get(connection.chainId) : undefined;
    return !chain?.paused;
  });
};

function frameById(framework: FrameworkDocument, id: string) {
  return framework.frames.find(frame => frame.id === id);
}

function chainForFrame(framework: FrameworkDocument, frameId: string): ChainDefinition | undefined {
  return [...(framework.chains ?? [])].reverse().find(chain => chain.frameIds.includes(frameId));
}

function frameExecutionMode(framework: FrameworkDocument, frameId: string): ExecutionMode {
  return chainForFrame(framework, frameId)?.executionMode ?? 'sequential';
}

function feedbackChains(framework: FrameworkDocument) {
  return (framework.chains ?? []).filter(chain =>
    (chain.type === 'feedback' || chain.type === 'reciprocal' || chain.executionMode === 'iterative') && !chain.paused
  );
}

function cycleNodes(framework: FrameworkDocument): string[] {
  const connections = executionConnections(framework, false);
  const indegree = new Map(framework.frames.map(frame => [frame.id, 0]));
  const next = new Map<string, string[]>();
  for (const connection of connections) {
    indegree.set(connection.toFrame, (indegree.get(connection.toFrame) ?? 0) + 1);
    next.set(connection.fromFrame, [...(next.get(connection.fromFrame) ?? []), connection.toFrame]);
  }
  const queue = framework.frames.filter(frame => (indegree.get(frame.id) ?? 0) === 0).map(frame => frame.id);
  let count = 0;
  while (queue.length) {
    const id = queue.shift()!;
    count++;
    for (const target of next.get(id) ?? []) {
      indegree.set(target, (indegree.get(target) ?? 1) - 1);
      if (indegree.get(target) === 0) queue.push(target);
    }
  }
  return count === framework.frames.length ? [] : [...indegree.entries()].filter(([, degree]) => degree > 0).map(([id]) => id);
}

export function validateFramework(framework: FrameworkDocument): string[] {
  const errors: string[] = [];
  const connections = executionConnections(framework);
  const chains = chainMap(framework);

  for (const connection of connections) {
    const from = frameById(framework, connection.fromFrame);
    const to = frameById(framework, connection.toFrame);
    if (!from || !to) {
      errors.push(`Broken connection: ${connection.id}`);
      continue;
    }
    if (connection.isFeedback) {
      const chain = connection.chainId ? chains.get(connection.chainId) : undefined;
      if (!chain || chain.executionMode !== 'iterative' || !chain.iterationLimit || chain.iterationLimit < 1) {
        errors.push(`Feedback connection ${connection.id} requires an iterative chain with an explicit iteration limit`);
      }
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
    if (frame.kind === 'framework') continue;
    for (const input of frame.inputs) {
      const incoming = connections.some(connection => connection.toFrame === frame.id && connection.toPort === input.id);
      if (!incoming && frame.kind !== 'asset') errors.push(`${frame.title}: ${input.name} is not connected`);
    }
  }

  const illegalCycle = cycleNodes(framework);
  if (illegalCycle.length) errors.push(`Cycle detected outside a controlled feedback chain: ${illegalCycle.join(', ')}`);
  return errors;
}

function topologicalLayers(framework: FrameworkDocument): Frame[][] {
  const connections = executionConnections(framework, false);
  const indegree = new Map(framework.frames.map(frame => [frame.id, 0]));
  const next = new Map<string, string[]>();
  for (const connection of connections) {
    indegree.set(connection.toFrame, (indegree.get(connection.toFrame) ?? 0) + 1);
    next.set(connection.fromFrame, [...(next.get(connection.fromFrame) ?? []), connection.toFrame]);
  }

  let ready = framework.frames.filter(frame => (indegree.get(frame.id) ?? 0) === 0).map(frame => frame.id);
  const layers: Frame[][] = [];
  let processed = 0;
  while (ready.length) {
    const current = ready;
    ready = [];
    const layer = current.map(id => frameById(framework, id)).filter((frame): frame is Frame => Boolean(frame));
    layers.push(layer);
    processed += layer.length;
    for (const id of current) {
      for (const target of next.get(id) ?? []) {
        indegree.set(target, (indegree.get(target) ?? 1) - 1);
        if (indegree.get(target) === 0) ready.push(target);
      }
    }
  }
  if (processed !== framework.frames.length) throw new Error('Cycle detected outside controlled feedback edges');
  return layers;
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

async function callModel(frame: Frame, input: unknown, instruction: string): Promise<string> {
  const response = await fetch('/api/model', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: frame.title, instruction, input })
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.error || 'MODEL FAILED');
  if (typeof data?.output !== 'string' || !data.output.trim()) throw new Error('EMPTY MODEL OUTPUT');
  return data.output.trim();
}

async function executeFrameOperation(frame: Frame, input: unknown): Promise<unknown> {
  const body = effectiveFrameBody(frame);
  if (frame.kind === 'framework') return input;
  if (frame.kind === 'asset') return frame.value ?? body;
  if (frame.operation === 'MODEL') return callModel(frame, input, body);
  if (frame.kind === 'expression') {
    return frame.expressionClass === 'DESCRIPTIVE' ? input : evaluateExpression(body, input);
  }
  if (frame.kind === 'check') return Boolean(input);
  if (frame.kind === 'instruction') return `${body}${input == null ? '' : `\n${String(input)}`}`.trim();
  return input;
}

function conditionMatches(rule: ConditionRule | undefined, value: unknown) {
  if (!rule || rule.operator === 'always') return true;
  if (rule.operator === 'truthy') return Boolean(value);
  if (rule.operator === 'falsy') return !value;
  const actual = typeof value === 'string' ? value : JSON.stringify(value);
  const expected = rule.value ?? '';
  if (rule.operator === 'equals') return actual === expected;
  if (rule.operator === 'not-equals') return actual !== expected;
  if (rule.operator === 'contains') return actual.includes(expected);
  return false;
}

function activeIncoming(
  connections: Connection[],
  outputs: Map<string, unknown>,
  frameId: string
) {
  return connections.filter(connection => {
    if (connection.toFrame !== frameId) return false;
    if (!outputs.has(connection.fromFrame)) return false;
    return conditionMatches(connection.condition, outputs.get(connection.fromFrame));
  });
}

function gatheredInput(connections: Connection[], outputs: Map<string, unknown>, frameId: string): unknown {
  const incoming = activeIncoming(connections, outputs, frameId);
  const values = incoming.map(connection => outputs.get(connection.fromFrame));
  return values.length <= 1 ? values[0] : values;
}

function runId() {
  return `run-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}

function stepProvenance(runIdValue: string, frame: Frame) {
  return {
    origin: frame.operation === 'MODEL' ? 'model' as const : 'deterministic' as const,
    createdAt: new Date().toISOString(),
    runId: runIdValue,
    frameId: frame.id
  };
}

function normalizeForHash(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(normalizeForHash);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, normalizeForHash(item)]));
  }
  return value;
}

function stableHash(value: unknown) {
  const text = JSON.stringify(normalizeForHash(value));
  let hash = 2166136261;
  for (let index = 0; index < text.length; index++) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function dependencyFingerprint(frame: Frame, upstream: Array<{ frameId: string; fingerprint?: string; output: unknown }>, iteration?: number) {
  return stableHash({
    frame: {
      kind: frame.kind,
      operation: frame.operation,
      expressionClass: frame.expressionClass,
      body: effectiveFrameBody(frame),
      value: frame.value,
      controlState: frame.controlState ?? 'active',
      assumptions: frame.assumptions ?? [],
      contextScope: frame.contextScope ?? [],
      sourceRefs: frame.sourceRefs ?? [],
      subframeworkId: frame.subframeworkId
    },
    upstream,
    iteration: iteration ?? 0
  });
}

function outputBearing(step: RunStep | undefined) {
  return Boolean(step && ['ok', 'cached', 'bypassed'].includes(step.status));
}

function previousStepMap(previousRun?: FrameworkRun | null) {
  const map = new Map<string, RunStep>();
  for (const step of previousRun?.steps ?? []) {
    if (!step.iteration || step.iteration <= 1) map.set(step.frameId, step);
  }
  return map;
}

function chainBypass(framework: FrameworkDocument, frameId: string) {
  return (framework.chains ?? []).some(chain => chain.bypassed && chain.frameIds.includes(frameId));
}

interface ExecuteContext {
  framework: FrameworkDocument;
  run: FrameworkRun;
  connections: Connection[];
  outputs: Map<string, unknown>;
  fingerprints: Map<string, string>;
  previous: Map<string, RunStep>;
}

async function executeOne(context: ExecuteContext, frame: Frame, iteration?: number, allowCache = true): Promise<RunStep> {
  const { framework, run, connections, outputs, fingerprints, previous } = context;
  const allIncoming = connections.filter(connection => connection.toFrame === frame.id);
  const incoming = activeIncoming(connections, outputs, frame.id);
  const upstream = incoming.map(connection => ({
    frameId: connection.fromFrame,
    fingerprint: fingerprints.get(connection.fromFrame),
    output: outputs.get(connection.fromFrame)
  }));
  const input = gatheredInput(connections, outputs, frame.id);
  const fingerprint = dependencyFingerprint(frame, upstream, iteration);
  const provenance = stepProvenance(run.id, frame);

  if (frame.controlState === 'disabled') {
    return { frameId: frame.id, status: 'disabled', input, durationMs: 0, executor: frame.operation, provenance, dependencyFingerprint: fingerprint, iteration, reason: 'Frame disabled' };
  }

  const mode = frameExecutionMode(framework, frame.id);
  if (mode === 'manual' && !iteration) {
    const prior = previous.get(frame.id);
    if (outputBearing(prior)) {
      outputs.set(frame.id, prior!.output);
      fingerprints.set(frame.id, prior!.dependencyFingerprint ?? fingerprint);
      return { ...prior!, status: 'cached', durationMs: 0, reason: 'Manual Frame reused from prior Run' };
    }
    return { frameId: frame.id, status: 'skipped', input, durationMs: 0, executor: frame.operation, provenance, dependencyFingerprint: fingerprint, reason: 'Manual execution mode' };
  }

  const conditionalIncoming = allIncoming.filter(connection => connection.condition && connection.condition.operator !== 'always');
  if (conditionalIncoming.length && !incoming.some(connection => conditionalIncoming.includes(connection))) {
    return { frameId: frame.id, status: 'skipped', input, durationMs: 0, executor: frame.operation, provenance, dependencyFingerprint: fingerprint, iteration, reason: 'Conditional route inactive' };
  }

  if (frame.kind !== 'asset' && frame.kind !== 'framework' && frame.inputs.length && allIncoming.length && incoming.length === 0) {
    return { frameId: frame.id, status: 'skipped', input, durationMs: 0, executor: frame.operation, provenance, dependencyFingerprint: fingerprint, iteration, reason: 'Required upstream result unavailable' };
  }

  if (frame.controlState === 'bypass' || chainBypass(framework, frame.id)) {
    outputs.set(frame.id, input);
    fingerprints.set(frame.id, fingerprint);
    return { frameId: frame.id, status: 'bypassed', input, output: input, durationMs: 0, executor: frame.operation, provenance, dependencyFingerprint: fingerprint, iteration, reason: frame.controlState === 'bypass' ? 'Frame bypassed' : 'Chain bypassed' };
  }

  const prior = previous.get(frame.id);
  if (allowCache && outputBearing(prior) && prior?.dependencyFingerprint === fingerprint) {
    outputs.set(frame.id, prior.output);
    fingerprints.set(frame.id, fingerprint);
    return { ...prior, status: 'cached', durationMs: 0, dependencyFingerprint: fingerprint, reason: 'Dependencies unchanged' };
  }

  const started = performance.now();
  try {
    const output = await executeFrameOperation(frame, input);
    outputs.set(frame.id, output);
    fingerprints.set(frame.id, fingerprint);
    return {
      frameId: frame.id,
      status: 'ok',
      input,
      output,
      durationMs: +(performance.now() - started).toFixed(2),
      executor: frame.operation,
      provenance,
      dependencyFingerprint: fingerprint,
      iteration
    };
  } catch (error) {
    return {
      frameId: frame.id,
      status: 'error',
      input,
      error: error instanceof Error ? error.message : 'Execution failed',
      durationMs: +(performance.now() - started).toFixed(2),
      executor: frame.operation,
      provenance,
      dependencyFingerprint: fingerprint,
      iteration
    };
  }
}

function snapshot(run: FrameworkRun): FrameworkRun {
  return { ...run, activeFrameIds: [...(run.activeFrameIds ?? [])], steps: [...run.steps] };
}

export interface RunOptions {
  previousRun?: FrameworkRun | null;
  variant?: 'canonical' | 'counterfactual';
  counterfactual?: CounterfactualRunMeta;
}

export async function runFramework(
  framework: FrameworkDocument,
  onEvent?: (event: RunEvent) => void,
  options?: RunOptions
): Promise<FrameworkRun> {
  const startedAt = new Date().toISOString();
  const run: FrameworkRun = {
    id: runId(),
    frameworkId: framework.id,
    status: 'running',
    startedAt,
    activeFrameId: null,
    activeFrameIds: [],
    steps: [],
    reusedStepCount: 0,
    variant: options?.variant ?? 'canonical',
    counterfactual: options?.counterfactual
  };

  const validation = validateFramework(framework);
  if (validation.length) {
    run.status = 'error';
    run.endedAt = new Date().toISOString();
    run.steps = validation.map((error, index) => ({
      frameId: `validation-${index}`,
      status: 'error',
      input: null,
      error,
      durationMs: 0,
      executor: 'DETERMINISTIC'
    }));
    onEvent?.({ type: 'run-completed', run: snapshot(run) });
    return run;
  }

  let layers: Frame[][];
  try {
    layers = topologicalLayers(framework);
  } catch (error) {
    run.status = 'error';
    run.endedAt = new Date().toISOString();
    run.steps = [{ frameId: 'graph', status: 'error', input: null, error: error instanceof Error ? error.message : 'Cycle detected', durationMs: 0, executor: 'DETERMINISTIC' }];
    onEvent?.({ type: 'run-completed', run: snapshot(run) });
    return run;
  }

  const outputs = new Map<string, unknown>();
  const fingerprints = new Map<string, string>();
  const previous = previousStepMap(options?.previousRun);
  const connections = executionConnections(framework, false);
  const context: ExecuteContext = { framework, run, connections, outputs, fingerprints, previous };

  for (const layer of layers) {
    const runnable = layer.filter(frame => !feedbackChains(framework).some(chain => chain.paused && chain.frameIds.includes(frame.id)));
    const ids = runnable.map(frame => frame.id);
    run.activeFrameIds = ids;
    run.activeFrameId = ids[0] ?? null;
    onEvent?.({ type: 'batch-started', frameIds: ids, run: snapshot(run) });
    for (const frameId of ids) onEvent?.({ type: 'frame-started', frameId, run: snapshot(run) });

    const steps = await Promise.all(runnable.map(frame => executeOne(context, frame)));
    run.steps = [...run.steps, ...steps];
    run.reusedStepCount = (run.reusedStepCount ?? 0) + steps.filter(step => step.status === 'cached').length;
    for (const step of steps) onEvent?.({ type: 'frame-completed', frameId: step.frameId, run: snapshot(run) });
    onEvent?.({ type: 'batch-completed', frameIds: ids, run: snapshot(run) });

    if (steps.some(step => step.status === 'error')) {
      run.status = 'error';
      run.activeFrameId = null;
      run.activeFrameIds = [];
      run.endedAt = new Date().toISOString();
      onEvent?.({ type: 'run-completed', run: snapshot(run) });
      return run;
    }
  }

  for (const chain of feedbackChains(framework)) {
    const limit = Math.max(1, Math.min(chain.iterationLimit ?? 3, 20));
    const chainFrames = chain.frameIds.map(id => frameById(framework, id)).filter((frame): frame is Frame => Boolean(frame) && frame.kind !== 'framework');
    if (!chainFrames.length || chain.paused) continue;
    const iterativeConnections = executionConnections(framework, true);
    const iterativeContext: ExecuteContext = { framework, run, connections: iterativeConnections, outputs, fingerprints, previous: new Map() };
    for (let iteration = 2; iteration <= limit; iteration++) {
      for (const frame of chainFrames) {
        run.activeFrameIds = [frame.id];
        run.activeFrameId = frame.id;
        onEvent?.({ type: 'frame-started', frameId: frame.id, run: snapshot(run) });
        const step = await executeOne(iterativeContext, frame, iteration, false);
        run.steps = [...run.steps, step];
        onEvent?.({ type: 'frame-completed', frameId: frame.id, run: snapshot(run) });
        if (step.status === 'error') {
          run.status = 'error';
          run.activeFrameId = null;
          run.activeFrameIds = [];
          run.endedAt = new Date().toISOString();
          onEvent?.({ type: 'run-completed', run: snapshot(run) });
          return run;
        }
      }
    }
  }

  run.status = 'ok';
  run.endedAt = new Date().toISOString();
  run.activeFrameId = null;
  run.activeFrameIds = [];
  onEvent?.({ type: 'run-completed', run: snapshot(run) });
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
    id: runId(), frameworkId: framework.id, status: 'running', startedAt, activeFrameId: frameId, activeFrameIds: [frameId], steps: [], variant: 'canonical'
  };
  if (!frame) {
    return { ...run, status: 'error', endedAt: new Date().toISOString(), activeFrameId: null, activeFrameIds: [], steps: [{ frameId, status: 'error', input: null, error: 'Frame not found', durationMs: 0, executor: 'DETERMINISTIC' }] };
  }

  const connections = executionConnections(framework, true).filter(connection => connection.toFrame === frameId);
  const outputs = new Map<string, unknown>();
  const fingerprints = new Map<string, string>();
  for (const step of previousRun?.steps ?? []) {
    if (outputBearing(step)) {
      outputs.set(step.frameId, step.output);
      if (step.dependencyFingerprint) fingerprints.set(step.frameId, step.dependencyFingerprint);
    }
  }
  for (const connection of connections) {
    if (outputs.has(connection.fromFrame)) continue;
    const upstream = frameById(framework, connection.fromFrame);
    if (upstream?.kind === 'asset') outputs.set(upstream.id, upstream.value ?? effectiveFrameBody(upstream));
  }
  const context: ExecuteContext = {
    framework,
    run,
    connections,
    outputs,
    fingerprints,
    previous: previousStepMap(previousRun)
  };
  const step = await executeOne(context, frame, undefined, false);
  return {
    ...run,
    status: step.status === 'error' ? 'error' : 'ok',
    endedAt: new Date().toISOString(),
    activeFrameId: null,
    activeFrameIds: [],
    steps: [step]
  };
}

export function compareRuns(base: FrameworkRun | null | undefined, candidate: FrameworkRun) {
  const baseMap = new Map<string, unknown>();
  for (const step of base?.steps ?? []) if (outputBearing(step)) baseMap.set(step.frameId, step.output);
  const candidateMap = new Map<string, unknown>();
  for (const step of candidate.steps) if (outputBearing(step)) candidateMap.set(step.frameId, step.output);
  const ids = new Set([...baseMap.keys(), ...candidateMap.keys()]);
  return [...ids].filter(id => stableHash(baseMap.get(id)) !== stableHash(candidateMap.get(id)));
}

export async function runCounterfactual(
  framework: FrameworkDocument,
  baseRun: FrameworkRun | null,
  targetFrameIds: string[],
  operation: 'disable' | 'bypass' | 'mask' | 'subtract' = 'disable',
  onEvent?: (event: RunEvent) => void
): Promise<FrameworkRun> {
  const modified = applyCompositeOperation(clone(framework), targetFrameIds, operation, targetFrameIds.length > 1 ? 'selection' : 'frame');
  const meta: CounterfactualRunMeta = {
    label: `${operation} ${targetFrameIds.join(', ')}`,
    removedFrameIds: targetFrameIds,
    operation,
    baseRunId: baseRun?.id
  };
  const run = await runFramework(modified, onEvent, { previousRun: baseRun, variant: 'counterfactual', counterfactual: meta });
  if (run.counterfactual) run.counterfactual.changedFrameIds = compareRuns(baseRun, run);
  return run;
}
