export type FrameKind = 'asset' | 'instruction' | 'expression' | 'check' | 'output';
export type OperationMode = 'DETERMINISTIC' | 'MODEL';
export type ExpressionClass = 'EXECUTABLE' | 'DESCRIPTIVE';
export type ValueType = 'text' | 'boolean' | 'number' | 'json' | 'any';

export type FrameRole =
  | 'concept'
  | 'claim'
  | 'question'
  | 'assumption'
  | 'evidence'
  | 'constraint'
  | 'variable'
  | 'observation'
  | 'perspective'
  | 'cause'
  | 'effect'
  | 'decision'
  | 'criterion'
  | 'hypothesis'
  | 'alternative'
  | 'unknown'
  | 'contradiction'
  | 'transformation'
  | 'evaluation'
  | 'result'
  | 'instruction';

export type EpistemicState =
  | 'known'
  | 'supported'
  | 'verified'
  | 'assumed'
  | 'inferred'
  | 'hypothesized'
  | 'disputed'
  | 'contradicted'
  | 'unknown'
  | 'unresolved'
  | 'invalid';

export type ProvenanceOrigin = 'user' | 'model' | 'deterministic' | 'imported' | 'research' | 'run';

export interface Provenance {
  origin: ProvenanceOrigin;
  createdAt: string;
  source?: string;
  runId?: string;
  frameId?: string;
}

export interface Port {
  id: string;
  name: string;
  type: ValueType;
}

export interface Frame {
  id: string;
  kind: FrameKind;
  role?: FrameRole;
  epistemicState?: EpistemicState;
  provenance?: Provenance;
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
  parentId?: string;
  collapsed?: boolean;
}

export type ConnectionKind = 'execution' | 'semantic' | 'both';
export type RelationshipMeaning =
  | 'feeds'
  | 'contains'
  | 'part-of'
  | 'depends-on'
  | 'supports'
  | 'challenges'
  | 'contradicts'
  | 'causes'
  | 'influences'
  | 'constrains'
  | 'explains'
  | 'derives-from'
  | 'evidence-for'
  | 'assumes'
  | 'questions'
  | 'tests'
  | 'validates'
  | 'refines'
  | 'reframes'
  | 'alternative-to';

export interface Connection {
  id: string;
  fromFrame: string;
  fromPort: string;
  toFrame: string;
  toPort: string;
  kind?: ConnectionKind;
  meaning?: RelationshipMeaning;
  provenance?: Provenance;
}

export type FrameworkGoal = 'understand' | 'explain' | 'decide' | 'invent' | 'research' | 'compare' | 'challenge';
export type StructuralOperation = 'expand' | 'compress' | 'reframe' | 'alternatives' | 'challenge' | 'find-missing' | 'identify-assumption' | 'find-contradiction';
export type ProposalStatus = 'pending' | 'accepted' | 'rejected';

export interface FrameworkScope {
  kind: 'frame' | 'selection' | 'branch' | 'framework';
  frameIds: string[];
}

export interface ProposedFrame {
  tempId: string;
  title: string;
  body?: string;
  role?: FrameRole;
  epistemicState?: EpistemicState;
  relationshipToAnchor?: RelationshipMeaning;
}

export interface Proposal {
  id: string;
  operation: StructuralOperation;
  scope: FrameworkScope;
  status: ProposalStatus;
  createdAt: string;
  summary: string;
  additions: ProposedFrame[];
  sourceRunId?: string;
}

export interface TransformationRecord {
  id: string;
  label: string;
  createdAt: string;
  proposalId?: string;
  versionBefore: number;
  versionAfter: number;
}

export interface FrameworkDocument {
  id: string;
  name: string;
  frames: Frame[];
  connections: Connection[];
  goal?: FrameworkGoal;
  proposals?: Proposal[];
  transformations?: TransformationRecord[];
  version?: number;
  updatedAt: string;
}

export interface RunStep {
  frameId: string;
  status: 'ok' | 'error';
  input: unknown;
  output?: unknown;
  error?: string;
  durationMs: number;
  executor?: OperationMode;
  provenance?: Provenance;
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

export type LintSeverity = 'info' | 'warning' | 'error';
export interface LintIssue {
  id: string;
  severity: LintSeverity;
  code: string;
  message: string;
  frameIds: string[];
  connectionIds?: string[];
}

export interface OrderPreset {
  id: string;
  title: string;
  prompt: string;
}
