export type FrameKind = 'asset' | 'instruction' | 'expression' | 'check' | 'output' | 'framework';
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
  | 'instruction'
  | 'framework';

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

export type ChainType =
  | 'sequence'
  | 'branch'
  | 'merge'
  | 'diamond'
  | 'parallel'
  | 'hierarchy'
  | 'contain'
  | 'nested'
  | 'nested-branch'
  | 'cascade'
  | 'conditional'
  | 'gate'
  | 'reciprocal'
  | 'feedback'
  | 'network'
  | 'recursive-framework'
  | 'freeform';

export type ExecutionMode =
  | 'sequential'
  | 'parallel'
  | 'ordered-parallel'
  | 'conditional'
  | 'manual'
  | 'iterative';

export type FrameControlState = 'active' | 'disabled' | 'bypass';
export type FragmentState = 'active' | 'masked' | 'subtracted' | 'replaced';
export type FragmentKind = 'instruction' | 'assumption' | 'claim' | 'context';
export type CompositeOperationType = 'disable' | 'bypass' | 'mask' | 'subtract' | 'replace';
export type CompositeScope = 'frame' | 'selection' | 'branch' | 'descendants' | 'framework';

export interface InstructionFragment {
  id: string;
  text: string;
  kind?: FragmentKind;
  state?: FragmentState;
  replacement?: string;
  provenance?: Provenance;
}

export interface Claim {
  id: string;
  text: string;
  epistemicState?: EpistemicState;
  evidenceRefs?: string[];
  contradictionRefs?: string[];
  assumptions?: string[];
  boundaryConditions?: string[];
  provenance?: Provenance;
}

export interface CompositeOperationRecord {
  id: string;
  type: CompositeOperationType;
  targetFrameIds: string[];
  fragmentId?: string;
  scope: CompositeScope;
  replacement?: string;
  appliedAt: string;
  provenance: Provenance;
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
  controlState?: FrameControlState;
  instructionFragments?: InstructionFragment[];
  assumptions?: string[];
  contextScope?: string[];
  sourceRefs?: string[];
  generatedClaims?: Claim[];
  subframeworkId?: string;
  dependencyFingerprint?: string;
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
  | 'alternative-to'
  | 'falsifies'
  | 'narrows'
  | 'generalizes'
  | 'replicates'
  | 'predicts'
  | 'fails-under'
  | 'shares-source-with';

export type ConditionOperator = 'always' | 'truthy' | 'falsy' | 'equals' | 'not-equals' | 'contains';
export interface ConditionRule {
  operator: ConditionOperator;
  value?: string;
  label?: string;
}

export interface Connection {
  id: string;
  fromFrame: string;
  fromPort: string;
  toFrame: string;
  toPort: string;
  kind?: ConnectionKind;
  meaning?: RelationshipMeaning;
  provenance?: Provenance;
  chainId?: string;
  chainType?: ChainType;
  executionMode?: ExecutionMode;
  order?: number;
  condition?: ConditionRule;
  reason?: string;
  confidence?: number;
  isFeedback?: boolean;
}

export interface ChainDefinition {
  id: string;
  label: string;
  type: ChainType;
  frameIds: string[];
  executionMode: ExecutionMode;
  createdAt: string;
  provenance?: Provenance;
  iterationLimit?: number;
  paused?: boolean;
  bypassed?: boolean;
  collapsed?: boolean;
  relationMeaning?: RelationshipMeaning;
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

export interface FrameworkPattern {
  id: string;
  name: string;
  chainType: ChainType;
  executionMode: ExecutionMode;
  frameTemplates: Array<Pick<Frame, 'kind' | 'role' | 'title' | 'operation' | 'body' | 'inputs' | 'outputs'>>;
  createdAt: string;
}

export interface FrameworkDocument {
  id: string;
  name: string;
  frames: Frame[];
  connections: Connection[];
  chains?: ChainDefinition[];
  patterns?: FrameworkPattern[];
  compositeOperations?: CompositeOperationRecord[];
  goal?: FrameworkGoal;
  proposals?: Proposal[];
  transformations?: TransformationRecord[];
  version?: number;
  updatedAt: string;
}

export type RunStepStatus = 'ok' | 'error' | 'cached' | 'skipped' | 'disabled' | 'bypassed';

export interface RunStep {
  frameId: string;
  status: RunStepStatus;
  input: unknown;
  output?: unknown;
  error?: string;
  durationMs: number;
  executor?: OperationMode;
  provenance?: Provenance;
  dependencyFingerprint?: string;
  iteration?: number;
  reason?: string;
}

export interface CounterfactualRunMeta {
  label: string;
  removedFrameIds: string[];
  operation: 'disable' | 'bypass' | 'mask' | 'subtract';
  baseRunId?: string;
  changedFrameIds?: string[];
}

export interface FrameworkRun {
  id: string;
  frameworkId: string;
  status: 'running' | 'ok' | 'error';
  startedAt: string;
  endedAt?: string;
  activeFrameId?: string | null;
  activeFrameIds?: string[];
  steps: RunStep[];
  reusedStepCount?: number;
  variant?: 'canonical' | 'counterfactual';
  counterfactual?: CounterfactualRunMeta;
}

export type RunEvent =
  | { type: 'frame-started'; frameId: string; run: FrameworkRun }
  | { type: 'frame-completed'; frameId: string; run: FrameworkRun }
  | { type: 'batch-started'; frameIds: string[]; run: FrameworkRun }
  | { type: 'batch-completed'; frameIds: string[]; run: FrameworkRun }
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
