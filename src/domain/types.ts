export type FrameKind = 'asset' | 'instruction' | 'expression' | 'check' | 'output';
export type OperationMode = 'DETERMINISTIC' | 'MODEL';
export type ExpressionClass = 'EXECUTABLE' | 'DESCRIPTIVE';
export type ValueType = 'text' | 'boolean' | 'number' | 'json' | 'any';

export interface Port {
  id: string;
  name: string;
  type: ValueType;
}

export interface Frame {
  id: string;
  kind: FrameKind;
  title: string;
  operation: OperationMode;
  x: number;
  y: number;
  inputs: Port[];
  outputs: Port[];
  body: string;
  value?: unknown;
  expressionClass?: ExpressionClass;
  orderPreset?: string;
}

export interface Connection {
  id: string;
  fromFrame: string;
  fromPort: string;
  toFrame: string;
  toPort: string;
}

export interface FrameworkDocument {
  id: string;
  name: string;
  frames: Frame[];
  connections: Connection[];
  updatedAt: string;
}

export interface RunStep {
  frameId: string;
  status: 'ok' | 'error';
  input: unknown;
  output?: unknown;
  error?: string;
  durationMs: number;
}

export interface FrameworkRun {
  id: string;
  frameworkId: string;
  status: 'running' | 'ok' | 'error';
  startedAt: string;
  endedAt?: string;
  activeFrameId?: string | null;
  steps: RunStep[];
}

export type RunEvent =
  | { type: 'frame-started'; frameId: string; run: FrameworkRun }
  | { type: 'frame-completed'; frameId: string; run: FrameworkRun }
  | { type: 'run-completed'; run: FrameworkRun };

export interface OrderPreset {
  id: string;
  title: string;
  prompt: string;
}
