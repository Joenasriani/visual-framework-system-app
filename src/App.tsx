import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { compatible, runFramework, runSingleFrame, validateFramework } from './domain/engine';
import { lintFramework } from './domain/linter';
import { FRAME_ORDERS } from './domain/orders';
import { createSeedFramework, FRAME_HEIGHT, FRAME_WIDTH } from './domain/seed';
import {
  applyProposal,
  proposalToFramework,
  rejectProposal,
  reorganizeForGoal,
  requestStructuralProposal
} from './domain/structural';
import type {
  EpistemicState,
  Frame,
  FrameKind,
  FrameRole,
  FrameworkDocument,
  FrameworkGoal,
  FrameworkRun,
  FrameworkScope,
  Port,
  Proposal,
  RelationshipMeaning,
  StructuralOperation
} from './domain/types';
import {
  listFrameworks,
  listRuns,
  loadFramework,
  saveFramework,
  saveRun,
  setActiveFrameworkId
} from './storage/indexeddb';

const KIND_LABELS: Record<FrameKind, string> = {
  asset: 'ELEMENT',
  instruction: 'PROCESS',
  expression: 'RULE',
  check: 'TEST',
  output: 'OUTCOME'
};

const ROLES: FrameRole[] = [
  'concept','claim','question','assumption','evidence','constraint','variable','observation','perspective','cause','effect','decision','criterion','hypothesis','alternative','unknown','contradiction','transformation','evaluation','result','instruction'
];
const STATES: EpistemicState[] = [
  'known','supported','verified','assumed','inferred','hypothesized','disputed','contradicted','unknown','unresolved','invalid'
];
const GOALS: FrameworkGoal[] = ['understand','explain','decide','invent','research','compare','challenge'];
const RELATIONSHIPS: RelationshipMeaning[] = [
  'supports','challenges','contradicts','depends-on','causes','influences','constrains','explains','derives-from','evidence-for','assumes','questions','tests','validates','refines','reframes','alternative-to','contains','part-of'
];
const STRUCTURAL_OPERATIONS: Array<[StructuralOperation, string]> = [
  ['expand','Explore Further'],
  ['reframe','Reframe'],
  ['alternatives','Explore Alternatives'],
  ['challenge','Test Reasoning'],
  ['find-missing','Find Gaps'],
  ['identify-assumption','Find Assumptions'],
  ['find-contradiction','Find Conflicts'],
  ['compress','Condense']
];

const ROLE_LABELS: Partial<Record<FrameRole, string>> = {
  constraint: 'Condition',
  effect: 'Outcome',
  alternative: 'Alternative Explanation',
  contradiction: 'Conflict',
  transformation: 'Change Process',
  evaluation: 'Assessment',
  result: 'Finding',
  instruction: 'Process'
};

const STATE_LABELS: Partial<Record<EpistemicState, string>> = {
  disputed: 'Mixed / Disputed'
};

interface ElementPreset {
  id: string;
  label: string;
  technical: string;
  category: 'Mind & Experience' | 'Behavior & Context' | 'People & Society' | 'Research & Reasoning' | 'Framework Tools';
  kind: FrameKind;
  role: FrameRole;
  epistemicState?: EpistemicState;
  glyph: string;
}

const ELEMENT_PRESETS: ElementPreset[] = [
  { id: 'thought', label: 'Thought', technical: 'Cognition / cognitive appraisal', category: 'Mind & Experience', kind: 'asset', role: 'concept', glyph: '◇' },
  { id: 'feeling', label: 'Feeling', technical: 'Affect / emotional state', category: 'Mind & Experience', kind: 'asset', role: 'variable', glyph: '≈' },
  { id: 'belief', label: 'Belief', technical: 'Belief / schema where applicable', category: 'Mind & Experience', kind: 'asset', role: 'concept', glyph: 'B' },
  { id: 'expectation', label: 'Expectation', technical: 'Expectancy', category: 'Mind & Experience', kind: 'asset', role: 'concept', glyph: 'E' },
  { id: 'attention', label: 'Attention', technical: 'Attentional process', category: 'Mind & Experience', kind: 'asset', role: 'variable', glyph: '◎' },
  { id: 'perception', label: 'Perception', technical: 'Perceptual representation / process', category: 'Mind & Experience', kind: 'asset', role: 'concept', glyph: 'P' },
  { id: 'motivation', label: 'Motivation', technical: 'Motivational state / variable', category: 'Mind & Experience', kind: 'asset', role: 'variable', glyph: 'M' },
  { id: 'goal', label: 'Goal', technical: 'Goal representation / objective', category: 'Mind & Experience', kind: 'asset', role: 'criterion', glyph: 'G' },
  { id: 'intention', label: 'Intention', technical: 'Behavioral intention', category: 'Mind & Experience', kind: 'asset', role: 'concept', glyph: 'I' },
  { id: 'sensation', label: 'Sensation', technical: 'Sensory / interoceptive experience', category: 'Mind & Experience', kind: 'asset', role: 'observation', glyph: 'S' },

  { id: 'trigger', label: 'Trigger', technical: 'Antecedent / cue / setting event, depending on function', category: 'Behavior & Context', kind: 'asset', role: 'cause', glyph: '!' },
  { id: 'behavior', label: 'Behavior', technical: 'Behavioral response / target behavior', category: 'Behavior & Context', kind: 'asset', role: 'observation', glyph: '→' },
  { id: 'habit', label: 'Habit', technical: 'Habitual response / learned behavioral pattern', category: 'Behavior & Context', kind: 'asset', role: 'concept', glyph: '↻' },
  { id: 'context', label: 'Context', technical: 'Situational / environmental / social context', category: 'Behavior & Context', kind: 'asset', role: 'constraint', glyph: '⊙' },
  { id: 'consequence', label: 'Consequence', technical: 'Consequence following a response', category: 'Behavior & Context', kind: 'asset', role: 'effect', glyph: 'C' },
  { id: 'outcome', label: 'Outcome', technical: 'Behavioral / psychological / social outcome', category: 'Behavior & Context', kind: 'asset', role: 'effect', glyph: 'O' },

  { id: 'person', label: 'Person', technical: 'Actor / individual', category: 'People & Society', kind: 'asset', role: 'concept', glyph: '●' },
  { id: 'group', label: 'Group', technical: 'Social group / collective', category: 'People & Society', kind: 'asset', role: 'concept', glyph: '◉' },
  { id: 'social-role', label: 'Role', technical: 'Social role', category: 'People & Society', kind: 'asset', role: 'concept', glyph: 'R' },
  { id: 'norm', label: 'Norm', technical: 'Social norm / normative expectation', category: 'People & Society', kind: 'asset', role: 'constraint', glyph: 'N' },
  { id: 'status', label: 'Status', technical: 'Social status / status position', category: 'People & Society', kind: 'asset', role: 'variable', glyph: 'S' },
  { id: 'identity', label: 'Identity', technical: 'Social identity / self-identity construct', category: 'People & Society', kind: 'asset', role: 'concept', glyph: 'ID' },
  { id: 'institution', label: 'Institution', technical: 'Institution / organizational actor', category: 'People & Society', kind: 'asset', role: 'concept', glyph: '▣' },
  { id: 'community', label: 'Community', technical: 'Social community', category: 'People & Society', kind: 'asset', role: 'concept', glyph: '◌' },
  { id: 'culture', label: 'Culture', technical: 'Cultural context / cultural construct', category: 'People & Society', kind: 'asset', role: 'concept', glyph: 'Cu' },
  { id: 'resource', label: 'Resource', technical: 'Social / material resource', category: 'People & Society', kind: 'asset', role: 'variable', glyph: '◆' },
  { id: 'power', label: 'Power', technical: 'Power relation / power construct', category: 'People & Society', kind: 'asset', role: 'variable', glyph: 'P' },

  { id: 'question', label: 'Question', technical: 'Research question / issue', category: 'Research & Reasoning', kind: 'asset', role: 'question', glyph: '?' },
  { id: 'observation', label: 'Observation', technical: 'Observation / recorded event', category: 'Research & Reasoning', kind: 'asset', role: 'observation', glyph: '○' },
  { id: 'claim', label: 'Claim', technical: 'Proposition / claim', category: 'Research & Reasoning', kind: 'asset', role: 'claim', glyph: 'C' },
  { id: 'evidence', label: 'Evidence', technical: 'Empirical evidence / observation / measurement', category: 'Research & Reasoning', kind: 'asset', role: 'evidence', glyph: '✓' },
  { id: 'hypothesis', label: 'Hypothesis', technical: 'Hypothesis', category: 'Research & Reasoning', kind: 'asset', role: 'hypothesis', epistemicState: 'hypothesized', glyph: 'H' },
  { id: 'assumption', label: 'Assumption', technical: 'Assumption / premise', category: 'Research & Reasoning', kind: 'asset', role: 'assumption', epistemicState: 'assumed', glyph: 'A' },
  { id: 'mechanism', label: 'Mechanism', technical: 'Proposed mechanism', category: 'Research & Reasoning', kind: 'asset', role: 'cause', epistemicState: 'hypothesized', glyph: 'M' },
  { id: 'prediction', label: 'Prediction', technical: 'Testable prediction', category: 'Research & Reasoning', kind: 'asset', role: 'hypothesis', epistemicState: 'hypothesized', glyph: 'Pr' },
  { id: 'alternative-explanation', label: 'Alternative Explanation', technical: 'Competing hypothesis / explanatory account', category: 'Research & Reasoning', kind: 'asset', role: 'alternative', epistemicState: 'hypothesized', glyph: 'Alt' },
  { id: 'counterargument', label: 'Counterargument', technical: 'Counterargument / challenge', category: 'Research & Reasoning', kind: 'asset', role: 'contradiction', glyph: '↯' },
  { id: 'limit', label: 'Limit', technical: 'Boundary condition / applicability limit', category: 'Research & Reasoning', kind: 'asset', role: 'constraint', glyph: 'L' },
  { id: 'unknown', label: 'Unknown', technical: 'Unresolved information', category: 'Research & Reasoning', kind: 'asset', role: 'unknown', epistemicState: 'unresolved', glyph: '?' },
  { id: 'gap', label: 'Gap', technical: 'Evidential / reasoning gap', category: 'Research & Reasoning', kind: 'asset', role: 'unknown', epistemicState: 'unresolved', glyph: '□' },
  { id: 'conclusion', label: 'Conclusion', technical: 'Conclusion / finding', category: 'Research & Reasoning', kind: 'asset', role: 'result', epistemicState: 'inferred', glyph: '∴' },

  { id: 'process', label: 'Process', technical: 'Executable process / transformation', category: 'Framework Tools', kind: 'instruction', role: 'instruction', epistemicState: 'known', glyph: '→' },
  { id: 'rule', label: 'Rule', technical: 'Deterministic or descriptive rule', category: 'Framework Tools', kind: 'expression', role: 'evaluation', epistemicState: 'known', glyph: 'ƒ' },
  { id: 'test', label: 'Test', technical: 'Evaluation / check', category: 'Framework Tools', kind: 'check', role: 'evaluation', epistemicState: 'known', glyph: '✓' },
  { id: 'run-result', label: 'Run Result', technical: 'Result produced by a framework run', category: 'Framework Tools', kind: 'output', role: 'result', epistemicState: 'inferred', glyph: '□' }
];

const FEATURED_ELEMENT_IDS = ['thought', 'feeling', 'behavior', 'context', 'evidence'];
const FEATURED_ELEMENT_PRESETS = FEATURED_ELEMENT_IDS.map(id => ELEMENT_PRESETS.find(preset => preset.id === id)!).filter(Boolean);
const ELEMENT_CATEGORIES: ElementPreset['category'][] = ['Mind & Experience', 'Behavior & Context', 'People & Society', 'Research & Reasoning', 'Framework Tools'];

interface RelationshipPreset {
  meaning: RelationshipMeaning;
  label: string;
  technical: string;
  category: 'Influence & Explanation' | 'Evidence & Reasoning' | 'Interpretation & Alternatives' | 'Structure';
}

const RELATIONSHIP_PRESETS: RelationshipPreset[] = [
  { meaning: 'influences', label: 'Influences', technical: 'Influence relation', category: 'Influence & Explanation' },
  { meaning: 'causes', label: 'May Cause', technical: 'Hypothesized causal relation', category: 'Influence & Explanation' },
  { meaning: 'constrains', label: 'Limits', technical: 'Constraining condition / limiting relation', category: 'Influence & Explanation' },
  { meaning: 'explains', label: 'Explains', technical: 'Explanatory relation', category: 'Influence & Explanation' },
  { meaning: 'depends-on', label: 'Depends On', technical: 'Dependency relation', category: 'Influence & Explanation' },

  { meaning: 'supports', label: 'Supports', technical: 'Evidential / argumentative support', category: 'Evidence & Reasoning' },
  { meaning: 'evidence-for', label: 'Is Evidence For', technical: 'Evidential relation', category: 'Evidence & Reasoning' },
  { meaning: 'challenges', label: 'Challenges', technical: 'Challenge relation', category: 'Evidence & Reasoning' },
  { meaning: 'contradicts', label: 'Conflicts With', technical: 'Contradictory relation', category: 'Evidence & Reasoning' },
  { meaning: 'tests', label: 'Tests', technical: 'Test relation', category: 'Evidence & Reasoning' },
  { meaning: 'validates', label: 'Checks', technical: 'Validation / verification relation', category: 'Evidence & Reasoning' },
  { meaning: 'assumes', label: 'Assumes', technical: 'Assumption dependency', category: 'Evidence & Reasoning' },
  { meaning: 'questions', label: 'Questions', technical: 'Question / challenge relation', category: 'Evidence & Reasoning' },

  { meaning: 'refines', label: 'Refines', technical: 'Refinement relation', category: 'Interpretation & Alternatives' },
  { meaning: 'reframes', label: 'Reframes', technical: 'Interpretive reframing relation', category: 'Interpretation & Alternatives' },
  { meaning: 'alternative-to', label: 'Alternative To', technical: 'Competing explanation / position', category: 'Interpretation & Alternatives' },
  { meaning: 'derives-from', label: 'Comes From', technical: 'Derivation / provenance relation', category: 'Interpretation & Alternatives' },

  { meaning: 'contains', label: 'Contains', technical: 'Containment relation', category: 'Structure' },
  { meaning: 'part-of', label: 'Part Of', technical: 'Part-whole relation', category: 'Structure' }
];

const RELATIONSHIP_CATEGORIES: RelationshipPreset['category'][] = [
  'Influence & Explanation',
  'Evidence & Reasoning',
  'Interpretation & Alternatives',
  'Structure'
];

const RELATIONSHIP_LABELS: Partial<Record<RelationshipMeaning, string>> = Object.fromEntries(
  RELATIONSHIP_PRESETS.map(preset => [preset.meaning, preset.label])
) as Partial<Record<RelationshipMeaning, string>>;

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const clone = <T,>(value: T): T => structuredClone(value);
const short = (value: unknown, limit = 82) => {
  if (value === undefined || value === null) return '';
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  return text.length > limit ? `${text.slice(0, Math.max(0, limit - 1))}…` : text;
};
const label = (value: string) => value.replaceAll('-', ' ').replace(/\b\w/g, match => match.toUpperCase());
const roleLabel = (value: FrameRole) => ROLE_LABELS[value] ?? label(value);
const stateLabel = (value: EpistemicState) => STATE_LABELS[value] ?? label(value);
const relationshipLabel = (value: RelationshipMeaning) => RELATIONSHIP_LABELS[value] ?? label(value);
const checkCodeLabel = (value: string) => ({
  ISOLATED_FRAME: 'ISOLATED ELEMENT',
  UNSUPPORTED_CLAIM: 'UNSUPPORTED CLAIM',
  NO_ALTERNATIVE: 'NO ALTERNATIVE',
  POSSIBLE_DUPLICATE: 'POSSIBLE DUPLICATE',
  CONTRADICTION: 'CONFLICT',
  ASSUMPTION_AS_RESULT_SUPPORT: 'ASSUMPTION SUPPORT',
  CAUSAL_SUPPORT_MISSING: 'CAUSAL SUPPORT NEEDED',
  REASONING_CYCLE: 'REASONING LOOP'
} as Record<string, string>)[value] ?? value.replaceAll('_', ' ');
const checkMessage = (value: string) => value
  .replace(/\bFrames\b/g, 'elements')
  .replace(/\bFrame\b/g, 'element')
  .replace(/Missing port:/g, 'Missing connection point:')
  .replace(/Execution failed/g, 'Run failed');

function portCenter(frame: Frame, side: 'in' | 'out', index = 0) {
  return { x: side === 'out' ? frame.x + FRAME_WIDTH : frame.x, y: frame.y + 54 + index * 22 };
}
function semanticPoint(frame: Frame, side: 'from' | 'to') {
  return { x: side === 'from' ? frame.x + FRAME_WIDTH : frame.x, y: frame.y + FRAME_HEIGHT / 2 };
}

interface CurveGeometry {
  d: string;
  mid: { x: number; y: number };
}
function curveGeometry(
  a: { x: number; y: number },
  b: { x: number; y: number },
  sourceMotion?: { x: number; y: number },
  targetMotion?: { x: number; y: number }
): CurveGeometry {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const dir = dx >= 0 ? 1 : -1;
  const bend = Math.max(66, Math.min(280, Math.abs(dx) * 0.46 + Math.abs(dy) * 0.13));
  const c1 = { x: a.x + dir * bend + (sourceMotion?.x ?? 0), y: a.y + (sourceMotion?.y ?? 0) };
  const c2 = { x: b.x - dir * bend + (targetMotion?.x ?? 0), y: b.y + (targetMotion?.y ?? 0) };
  const t = 0.5;
  const mt = 1 - t;
  const mid = {
    x: mt ** 3 * a.x + 3 * mt ** 2 * t * c1.x + 3 * mt * t ** 2 * c2.x + t ** 3 * b.x,
    y: mt ** 3 * a.y + 3 * mt ** 2 * t * c1.y + 3 * mt * t ** 2 * c2.y + t ** 3 * b.y
  };
  return { d: `M ${a.x} ${a.y} C ${c1.x} ${c1.y}, ${c2.x} ${c2.y}, ${b.x} ${b.y}`, mid };
}

function makeFrame(kind: FrameKind, x: number, y: number): Frame {
  const id = `${kind}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  const createdAt = new Date().toISOString();
  const provenance = { origin: 'user' as const, createdAt };
  if (kind === 'asset') {
    return { id, kind, role: 'concept', epistemicState: 'unknown', provenance, title: 'Concept', operation: 'DETERMINISTIC', x, y, inputs: [], outputs: [{ id: 'out', name: 'value', type: 'any' }], body: '', value: 'New concept' };
  }
  if (kind === 'instruction') {
    return { id, kind, role: 'instruction', epistemicState: 'known', provenance, title: 'Process', operation: 'MODEL', x, y, inputs: [{ id: 'in', name: 'input', type: 'any' }], outputs: [{ id: 'out', name: 'result', type: 'any' }], body: 'Transform the input.' };
  }
  if (kind === 'expression') {
    return { id, kind, role: 'evaluation', epistemicState: 'known', provenance, title: 'Rule', operation: 'DETERMINISTIC', expressionClass: 'EXECUTABLE', x, y, inputs: [{ id: 'in', name: 'input', type: 'text' }], outputs: [{ id: 'out', name: 'value', type: 'boolean' }], body: 'notEmpty(input)' };
  }
  if (kind === 'check') {
    return { id, kind, role: 'evaluation', epistemicState: 'known', provenance, title: 'Test', operation: 'DETERMINISTIC', x, y, inputs: [{ id: 'in', name: 'input', type: 'any' }], outputs: [{ id: 'out', name: 'valid', type: 'boolean' }], body: 'Pass if truthy' };
  }
  return { id, kind, role: 'result', epistemicState: 'inferred', provenance, title: 'Outcome', operation: 'DETERMINISTIC', x, y, inputs: [{ id: 'in', name: 'input', type: 'any' }], outputs: [], body: '' };
}

interface DragState {
  pointerId: number;
  frameIds: string[];
  startWorldX: number;
  startWorldY: number;
  startPositions: Record<string, { x: number; y: number }>;
  before: FrameworkDocument;
  lastX: number;
  lastY: number;
  lastT: number;
  vx: number;
  vy: number;
  moved: boolean;
}
interface WireState {
  fromFrame: string;
  fromPort: string;
  outputType: Port['type'];
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}
interface ClipboardState {
  frames: Frame[];
  connections: FrameworkDocument['connections'];
}
type SideMode = 'frame' | 'issues' | 'runs' | 'proposal' | 'framework' | 'library' | 'relationships';
type ScopeMode = FrameworkScope['kind'];

function descendants(framework: FrameworkDocument, rootId: string) {
  const found = new Set<string>();
  const walk = (id: string) => {
    for (const frame of framework.frames) {
      if (frame.parentId === id && !found.has(frame.id)) {
        found.add(frame.id);
        walk(frame.id);
      }
    }
  };
  walk(rootId);
  return found;
}

export default function App() {
  const [framework, setFramework] = useState<FrameworkDocument>(() => createSeedFramework());
  const frameworkRef = useRef(framework);
  const [frameworkList, setFrameworkList] = useState<FrameworkDocument[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [selectedFrameIds, setSelectedFrameIds] = useState<string[]>(['instruction-1']);
  const [selectedConnectionId, setSelectedConnectionId] = useState<string | null>(null);
  const [run, setRun] = useState<FrameworkRun | null>(null);
  const [runs, setRuns] = useState<FrameworkRun[]>([]);
  const [status, setStatus] = useState('READY');
  const [scale, setScale] = useState(1);
  const [wire, setWire] = useState<WireState | null>(null);
  const wireRef = useRef<WireState | null>(null);
  const [newConnectionId, setNewConnectionId] = useState<string | null>(null);
  const [removingConnectionId, setRemovingConnectionId] = useState<string | null>(null);
  const [cableMotion, setCableMotion] = useState<{ frameId: string; x: number; y: number } | null>(null);
  const [sideMode, setSideMode] = useState<SideMode>('frame');
  const [panelOpen, setPanelOpen] = useState(false);
  const [relationshipPickMode, setRelationshipPickMode] = useState(false);
  const [scopeMode, setScopeMode] = useState<ScopeMode>('frame');
  const [relationshipMeaning, setRelationshipMeaning] = useState<RelationshipMeaning>('supports');
  const stageRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const panRef = useRef<{ pointerId: number; x: number; y: number; left: number; top: number } | null>(null);
  const persistTimer = useRef<number | null>(null);
  const clipboardRef = useRef<ClipboardState | null>(null);
  const pastRef = useRef<Array<{ doc: FrameworkDocument; label: string }>>([]);
  const futureRef = useRef<Array<{ doc: FrameworkDocument; label: string }>>([]);
  const [historyTick, setHistoryTick] = useState(0);
  const reducedMotion = useMemo(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches, []);

  const selectedFrameId = selectedFrameIds.at(-1) ?? '';

  const openPanel = useCallback((mode: SideMode) => {
    setRelationshipPickMode(false);
    setStatus(current => current === 'SELECT 2' ? 'READY' : current);
    setSideMode(mode);
    setPanelOpen(true);
  }, []);

  const closePanel = useCallback(() => setPanelOpen(false), []);

  const refreshLists = useCallback(async (frameworkId: string) => {
    const [docs, storedRuns] = await Promise.all([listFrameworks(), listRuns(frameworkId)]);
    setFrameworkList(docs);
    setRuns(storedRuns);
  }, []);

  useEffect(() => {
    loadFramework().then(async saved => {
      frameworkRef.current = saved;
      setFramework(saved);
      setSelectedFrameIds(saved.frames[0]?.id ? [saved.frames[0].id] : []);
      pastRef.current = [];
      futureRef.current = [];
      setLoaded(true);
      await refreshLists(saved.id);
    });
  }, [refreshLists]);

  const persist = useCallback((doc = frameworkRef.current, delay = 160) => {
    if (!loaded) return;
    if (persistTimer.current) window.clearTimeout(persistTimer.current);
    persistTimer.current = window.setTimeout(() => saveFramework(doc).catch(() => undefined), delay);
  }, [loaded]);

  const recordHistory = useCallback((doc: FrameworkDocument, historyLabel: string) => {
    pastRef.current = [...pastRef.current, { doc: clone(doc), label: historyLabel }].slice(-100);
    futureRef.current = [];
    setHistoryTick(value => value + 1);
  }, []);

  const changeFramework = useCallback((
    updater: (current: FrameworkDocument) => FrameworkDocument,
    options?: { save?: boolean; record?: boolean; label?: string }
  ) => {
    const save = options?.save ?? true;
    const record = options?.record ?? true;
    const historyLabel = options?.label ?? 'Edit Framework';
    setFramework(current => {
      if (record) recordHistory(current, historyLabel);
      const next = updater(current);
      frameworkRef.current = next;
      if (save) persist(next);
      return next;
    });
  }, [persist, recordHistory]);

  const undo = useCallback(() => {
    const previous = pastRef.current.pop();
    if (!previous) return;
    futureRef.current.push({ doc: clone(frameworkRef.current), label: previous.label });
    const next = clone(previous.doc);
    frameworkRef.current = next;
    setFramework(next);
    setRun(null);
    persist(next, 0);
    setHistoryTick(value => value + 1);
  }, [persist]);

  const redo = useCallback(() => {
    const nextItem = futureRef.current.pop();
    if (!nextItem) return;
    pastRef.current.push({ doc: clone(frameworkRef.current), label: nextItem.label });
    const next = clone(nextItem.doc);
    frameworkRef.current = next;
    setFramework(next);
    setRun(null);
    persist(next, 0);
    setHistoryTick(value => value + 1);
  }, [persist]);

  const frameMap = useMemo(() => new Map(framework.frames.map(frame => [frame.id, frame])), [framework.frames]);
  const stepMap = useMemo(() => new Map((run?.steps ?? []).map(step => [step.frameId, step])), [run]);
  const selectedFrame = selectedFrameId ? frameMap.get(selectedFrameId) ?? null : null;
  const lintIssues = useMemo(() => lintFramework(framework), [framework]);
  const executionIssues = useMemo(() => validateFramework(framework), [framework]);
  const activeProposal = useMemo(() => [...(framework.proposals ?? [])].reverse().find(item => item.status === 'pending') ?? null, [framework.proposals]);

  const hiddenIds = useMemo(() => {
    const hidden = new Set<string>();
    for (const frame of framework.frames) {
      if (!frame.collapsed) continue;
      for (const id of descendants(framework, frame.id)) hidden.add(id);
    }
    return hidden;
  }, [framework]);
  const visibleFrames = useMemo(() => framework.frames.filter(frame => !hiddenIds.has(frame.id)), [framework.frames, hiddenIds]);
  const visibleIds = useMemo(() => new Set(visibleFrames.map(frame => frame.id)), [visibleFrames]);
  const childrenByParent = useMemo(() => {
    const map = new Map<string, Frame[]>();
    for (const frame of framework.frames) {
      if (!frame.parentId) continue;
      map.set(frame.parentId, [...(map.get(frame.parentId) ?? []), frame]);
    }
    return map;
  }, [framework.frames]);
  const worldWidth = Math.max(1500, ...framework.frames.map(frame => frame.x + FRAME_WIDTH + 260));
  const worldHeight = Math.max(900, ...framework.frames.map(frame => frame.y + FRAME_HEIGHT + 300));

  const updateFrame = useCallback((frameId: string, patch: Partial<Frame>, record = true) => {
    changeFramework(current => ({
      ...current,
      updatedAt: new Date().toISOString(),
      version: (current.version ?? 1) + (record ? 1 : 0),
      frames: current.frames.map(frame => frame.id === frameId ? { ...frame, ...patch } : frame)
    }), { record, label: 'Edit Frame' });
    setRun(null);
  }, [changeFramework]);

  const addElementPreset = useCallback((presetId: string) => {
    const preset = ELEMENT_PRESETS.find(item => item.id === presetId);
    if (!preset) return;
    const stage = stageRef.current;
    const x = Math.max(32, ((stage?.scrollLeft ?? 0) + (stage?.clientWidth ?? 900) / 2) / scale - FRAME_WIDTH / 2 + Math.random() * 22);
    const y = Math.max(48, ((stage?.scrollTop ?? 0) + (stage?.clientHeight ?? 600) / 2) / scale - FRAME_HEIGHT / 2 + Math.random() * 22);
    const base = makeFrame(preset.kind, x, y);
    const frame: Frame = {
      ...base,
      title: preset.label,
      role: preset.role,
      epistemicState: preset.epistemicState ?? 'unknown',
      value: preset.kind === 'asset' ? preset.technical : base.value,
      body: preset.kind === 'instruction' ? 'Describe the process or transformation.' : base.body
    };
    changeFramework(current => ({ ...current, version: (current.version ?? 1) + 1, updatedAt: new Date().toISOString(), frames: [...current.frames, frame] }), { label: `Add ${preset.label}` });
    setSelectedConnectionId(null);
    setSelectedFrameIds([frame.id]);
    setSideMode('frame');
    setPanelOpen(false);
    setRun(null);
  }, [changeFramework, scale]);

  const deleteSelection = useCallback(() => {
    if (!selectedFrameIds.length) return;
    const ids = new Set(selectedFrameIds);
    changeFramework(current => ({
      ...current,
      version: (current.version ?? 1) + 1,
      updatedAt: new Date().toISOString(),
      frames: current.frames.filter(frame => !ids.has(frame.id)).map(frame => ids.has(frame.parentId ?? '') ? { ...frame, parentId: undefined } : frame),
      connections: current.connections.filter(connection => !ids.has(connection.fromFrame) && !ids.has(connection.toFrame))
    }), { label: 'Delete Frames' });
    setSelectedFrameIds([]);
    setRun(null);
  }, [changeFramework, selectedFrameIds]);

  const copySelection = useCallback(() => {
    if (!selectedFrameIds.length) return;
    const ids = new Set(selectedFrameIds);
    clipboardRef.current = {
      frames: clone(frameworkRef.current.frames.filter(frame => ids.has(frame.id))),
      connections: clone(frameworkRef.current.connections.filter(connection => ids.has(connection.fromFrame) && ids.has(connection.toFrame)))
    };
    setStatus('COPIED');
    window.setTimeout(() => setStatus(current => current === 'COPIED' ? 'READY' : current), 650);
  }, [selectedFrameIds]);

  const pasteSelection = useCallback(() => {
    const clip = clipboardRef.current;
    if (!clip?.frames.length) return;
    const stamp = Date.now();
    const mapping = new Map<string, string>();
    clip.frames.forEach((frame, index) => mapping.set(frame.id, `${frame.kind}-${stamp}-${index}`));
    const createdAt = new Date().toISOString();
    const frames = clip.frames.map(frame => ({
      ...clone(frame),
      id: mapping.get(frame.id)!,
      x: frame.x + 34,
      y: frame.y + 34,
      parentId: frame.parentId && mapping.has(frame.parentId) ? mapping.get(frame.parentId) : undefined,
      provenance: { origin: 'user' as const, createdAt }
    }));
    const connections = clip.connections.map((connection, index) => ({
      ...clone(connection),
      id: `copy-link-${stamp}-${index}`,
      fromFrame: mapping.get(connection.fromFrame)!,
      toFrame: mapping.get(connection.toFrame)!,
      provenance: { origin: 'user' as const, createdAt }
    }));
    changeFramework(current => ({
      ...current,
      version: (current.version ?? 1) + 1,
      updatedAt: createdAt,
      frames: [...current.frames, ...frames],
      connections: [...current.connections, ...connections]
    }), { label: 'Paste Frames' });
    setSelectedFrameIds(frames.map(frame => frame.id));
    setRun(null);
  }, [changeFramework]);

  const duplicateSelection = useCallback(() => {
    copySelection();
    requestAnimationFrame(() => pasteSelection());
  }, [copySelection, pasteSelection]);

  const startCableFollowThrough = useCallback((frameId: string, vx: number, vy: number) => {
    if (reducedMotion) return;
    const speed = Math.hypot(vx, vy);
    if (speed < 0.025) return;
    const ax = clamp(vx * 74, -28, 28);
    const ay = clamp(vy * 74, -24, 24);
    const started = performance.now();
    const duration = 430;
    const tick = (now: number) => {
      const t = Math.min(1, (now - started) / duration);
      const decay = Math.exp(-4.6 * t);
      const swing = Math.cos(t * Math.PI * 2.45);
      setCableMotion({ frameId, x: ax * decay * swing, y: ay * decay * swing });
      if (t < 1) requestAnimationFrame(tick);
      else setCableMotion(null);
    };
    requestAnimationFrame(tick);
  }, [reducedMotion]);

  const settleFrame = useCallback((frameId: string, vx: number, vy: number) => {
    if (reducedMotion) return;
    const element = document.querySelector<HTMLElement>(`[data-frame="${frameId}"]`);
    if (!element?.animate) return;
    const speed = Math.min(1, Math.hypot(vx, vy) * 1.8);
    const lift = 1.006 + speed * 0.008;
    element.animate([
      { transform: 'scale(1)', offset: 0 },
      { transform: `scale(${lift})`, offset: 0.36 },
      { transform: 'scale(.997)', offset: 0.72 },
      { transform: 'scale(1)', offset: 1 }
    ], { duration: 230, easing: 'cubic-bezier(.2,.78,.22,1)' });
  }, [reducedMotion]);

  const onFramePointerDown = useCallback((event: React.PointerEvent<HTMLDivElement>, frame: Frame) => {
    if ((event.target as HTMLElement).closest('button,input,textarea,select,[data-port]')) return;
    event.stopPropagation();
    const additive = event.shiftKey || event.metaKey || event.ctrlKey || relationshipPickMode;
    let selection = selectedFrameIds;
    if (!selection.includes(frame.id)) {
      selection = relationshipPickMode ? [...selection, frame.id].slice(-2) : additive ? [...selection, frame.id] : [frame.id];
    }
    setSelectedFrameIds(selection);
    setSelectedConnectionId(null);
    setSideMode('frame');
    const stage = stageRef.current;
    if (!stage) return;
    const rect = stage.getBoundingClientRect();
    const startWorldX = (event.clientX - rect.left + stage.scrollLeft) / scale;
    const startWorldY = (event.clientY - rect.top + stage.scrollTop) / scale;
    const startPositions: Record<string, { x: number; y: number }> = {};
    for (const id of selection) {
      const item = frameworkRef.current.frames.find(candidate => candidate.id === id);
      if (item) startPositions[id] = { x: item.x, y: item.y };
    }
    dragRef.current = {
      pointerId: event.pointerId,
      frameIds: selection,
      startWorldX,
      startWorldY,
      startPositions,
      before: clone(frameworkRef.current),
      lastX: event.clientX,
      lastY: event.clientY,
      lastT: performance.now(),
      vx: 0,
      vy: 0,
      moved: false
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }, [relationshipPickMode, scale, selectedFrameIds]);

  const autoPan = useCallback((clientX: number, clientY: number) => {
    const stage = stageRef.current;
    if (!stage) return;
    const rect = stage.getBoundingClientRect();
    const edge = 72;
    const speed = 14;
    let dx = 0;
    let dy = 0;
    if (clientX < rect.left + edge) dx = -speed;
    else if (clientX > rect.right - edge) dx = speed;
    if (clientY < rect.top + edge) dy = -speed;
    else if (clientY > rect.bottom - edge) dy = speed;
    if (dx || dy) stage.scrollBy(dx, dy);
  }, []);

  const onFramePointerMove = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    const stage = stageRef.current;
    if (!drag || drag.pointerId !== event.pointerId || !stage) return;
    autoPan(event.clientX, event.clientY);
    const rect = stage.getBoundingClientRect();
    const worldX = (event.clientX - rect.left + stage.scrollLeft) / scale;
    const worldY = (event.clientY - rect.top + stage.scrollTop) / scale;
    const dx = worldX - drag.startWorldX;
    const dy = worldY - drag.startWorldY;
    if (Math.abs(dx) + Math.abs(dy) > 1) drag.moved = true;
    const now = performance.now();
    const dt = Math.max(8, now - drag.lastT);
    const ivx = (event.clientX - drag.lastX) / (dt * scale);
    const ivy = (event.clientY - drag.lastY) / (dt * scale);
    drag.vx = drag.vx * 0.62 + ivx * 0.38;
    drag.vy = drag.vy * 0.62 + ivy * 0.38;
    drag.lastX = event.clientX;
    drag.lastY = event.clientY;
    drag.lastT = now;
    changeFramework(current => ({
      ...current,
      frames: current.frames.map(item => {
        const start = drag.startPositions[item.id];
        return start ? { ...item, x: Math.max(16, start.x + dx), y: Math.max(16, start.y + dy) } : item;
      })
    }), { save: false, record: false });
  }, [autoPan, changeFramework, scale]);

  const onFramePointerUp = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    dragRef.current = null;
    if (drag.moved) {
      recordHistory(drag.before, drag.frameIds.length > 1 ? 'Move Frames' : 'Move Frame');
      persist(frameworkRef.current, 0);
    }
    const idleFor = performance.now() - drag.lastT;
    const decay = idleFor > 85 ? 0.25 : 1;
    const vx = drag.vx * decay;
    const vy = drag.vy * decay;
    for (const id of drag.frameIds) {
      settleFrame(id, vx, vy);
      startCableFollowThrough(id, vx, vy);
    }
  }, [persist, recordHistory, settleFrame, startCableFollowThrough]);

  const startWire = useCallback((event: React.PointerEvent<HTMLButtonElement>, frame: Frame, port: Port, portIndex: number) => {
    event.stopPropagation();
    event.preventDefault();
    const point = portCenter(frame, 'out', portIndex);
    const next: WireState = { fromFrame: frame.id, fromPort: port.id, outputType: port.type, x1: point.x, y1: point.y, x2: point.x, y2: point.y };
    wireRef.current = next;
    setWire(next);
    setSelectedConnectionId(null);
    setStatus('CONNECT');
  }, []);

  const nearestCompatiblePort = useCallback((clientX: number, clientY: number, activeWire: WireState) => {
    const candidates = Array.from(document.querySelectorAll<HTMLButtonElement>('[data-port="in"]'));
    let best: { frameId: string; portId: string; distance: number } | null = null;
    const source = frameMap.get(activeWire.fromFrame);
    if (!source) return null;
    for (const element of candidates) {
      const frameId = element.dataset.frameId;
      const portId = element.dataset.portId;
      if (!frameId || !portId || frameId === source.id) continue;
      const frame = frameMap.get(frameId);
      const input = frame?.inputs.find(port => port.id === portId);
      if (!frame || !input || !compatible(activeWire.outputType, input.type)) continue;
      const rect = element.getBoundingClientRect();
      const px = rect.left + rect.width / 2;
      const py = rect.top + rect.height / 2;
      const distance = Math.hypot(clientX - px, clientY - py);
      if (distance <= 38 && (!best || distance < best.distance)) best = { frameId, portId, distance };
    }
    return best;
  }, [frameMap]);

  useEffect(() => {
    const onMove = (event: PointerEvent) => {
      const active = wireRef.current;
      const stage = stageRef.current;
      if (!active || !stage) return;
      autoPan(event.clientX, event.clientY);
      const rect = stage.getBoundingClientRect();
      const next = {
        ...active,
        x2: (event.clientX - rect.left + stage.scrollLeft) / scale,
        y2: (event.clientY - rect.top + stage.scrollTop) / scale
      };
      wireRef.current = next;
      setWire(next);
    };
    const onUp = (event: PointerEvent) => {
      const active = wireRef.current;
      if (!active) return;
      const target = nearestCompatiblePort(event.clientX, event.clientY, active);
      if (target) {
        const id = `e-${Date.now()}`;
        const createdAt = new Date().toISOString();
        changeFramework(current => ({
          ...current,
          version: (current.version ?? 1) + 1,
          updatedAt: createdAt,
          connections: [
            ...current.connections.filter(connection => connection.kind === 'semantic' || !(connection.toFrame === target.frameId && connection.toPort === target.portId)),
            { id, fromFrame: active.fromFrame, fromPort: active.fromPort, toFrame: target.frameId, toPort: target.portId, kind: 'execution', meaning: 'feeds', provenance: { origin: 'user', createdAt } }
          ]
        }), { label: 'Connect Frames' });
        setNewConnectionId(id);
        window.setTimeout(() => setNewConnectionId(null), 340);
        setRun(null);
      }
      wireRef.current = null;
      setWire(null);
      setStatus('READY');
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  }, [autoPan, changeFramework, nearestCompatiblePort, scale]);

  const removeConnection = useCallback((id: string) => {
    if (removingConnectionId) return;
    const remove = () => {
      changeFramework(current => ({
        ...current,
        version: (current.version ?? 1) + 1,
        connections: current.connections.filter(connection => connection.id !== id),
        updatedAt: new Date().toISOString()
      }), { label: 'Remove Connection' });
      setSelectedConnectionId(null);
      setRemovingConnectionId(null);
      setRun(null);
    };
    if (reducedMotion) remove();
    else {
      setRemovingConnectionId(id);
      window.setTimeout(remove, 250);
    }
  }, [changeFramework, reducedMotion, removingConnectionId]);

  const connectMeaning = useCallback((meaning?: RelationshipMeaning) => {
    if (selectedFrameIds.length !== 2) return;
    const [fromFrame, toFrame] = selectedFrameIds;
    if (fromFrame === toFrame) return;
    const selectedMeaning = meaning ?? relationshipMeaning;
    const createdAt = new Date().toISOString();
    changeFramework(current => ({
      ...current,
      version: (current.version ?? 1) + 1,
      updatedAt: createdAt,
      connections: [...current.connections, {
        id: `semantic-${Date.now()}`,
        fromFrame,
        fromPort: '',
        toFrame,
        toPort: '',
        kind: 'semantic',
        meaning: selectedMeaning,
        provenance: { origin: 'user', createdAt }
      }]
    }), { label: `Add ${relationshipLabel(selectedMeaning)} Relationship` });
    setRelationshipMeaning(selectedMeaning);
    setRelationshipPickMode(false);
    setPanelOpen(false);
    setStatus('READY');
  }, [changeFramework, relationshipMeaning, selectedFrameIds]);

  const containSelection = useCallback(() => {
    if (selectedFrameIds.length < 2 || !selectedFrameId) return;
    const parentId = selectedFrameId;
    const childIds = selectedFrameIds.filter(id => id !== parentId);
    const createdAt = new Date().toISOString();
    changeFramework(current => {
      const existing = new Set(current.connections.filter(connection => connection.meaning === 'contains').map(connection => `${connection.fromFrame}:${connection.toFrame}`));
      const additions = childIds.filter(id => !existing.has(`${parentId}:${id}`)).map((id, index) => ({
        id: `contains-${Date.now()}-${index}`,
        fromFrame: parentId,
        fromPort: '',
        toFrame: id,
        toPort: '',
        kind: 'semantic' as const,
        meaning: 'contains' as const,
        provenance: { origin: 'user' as const, createdAt }
      }));
      return {
        ...current,
        version: (current.version ?? 1) + 1,
        updatedAt: createdAt,
        frames: current.frames.map(frame => childIds.includes(frame.id) ? { ...frame, parentId } : frame),
        connections: [...current.connections, ...additions]
      };
    }, { label: 'Create Hierarchy' });
  }, [changeFramework, selectedFrameId, selectedFrameIds]);

  const releaseFromParent = useCallback(() => {
    if (!selectedFrameIds.length) return;
    const ids = new Set(selectedFrameIds);
    const parentPairs = new Set(frameworkRef.current.frames.filter(frame => ids.has(frame.id) && frame.parentId).map(frame => `${frame.parentId}:${frame.id}`));
    changeFramework(current => ({
      ...current,
      version: (current.version ?? 1) + 1,
      updatedAt: new Date().toISOString(),
      frames: current.frames.map(frame => ids.has(frame.id) ? { ...frame, parentId: undefined } : frame),
      connections: current.connections.filter(connection => !(connection.meaning === 'contains' && parentPairs.has(`${connection.fromFrame}:${connection.toFrame}`)))
    }), { label: 'Release Hierarchy' });
  }, [changeFramework, selectedFrameIds]);

  const toggleCollapsed = useCallback((frameId: string) => {
    const item = frameMap.get(frameId);
    if (!item) return;
    updateFrame(frameId, { collapsed: !item.collapsed });
  }, [frameMap, updateFrame]);

  const branchIds = useCallback((rootId: string) => {
    const found = new Set<string>([rootId]);
    const queue = [rootId];
    while (queue.length) {
      const current = queue.shift()!;
      for (const connection of frameworkRef.current.connections) {
        if (connection.fromFrame !== current || found.has(connection.toFrame)) continue;
        found.add(connection.toFrame);
        queue.push(connection.toFrame);
      }
      for (const child of frameworkRef.current.frames.filter(frame => frame.parentId === current)) {
        if (!found.has(child.id)) {
          found.add(child.id);
          queue.push(child.id);
        }
      }
    }
    return [...found];
  }, []);

  const currentScope = useCallback((): FrameworkScope => {
    if (scopeMode === 'framework') return { kind: 'framework', frameIds: frameworkRef.current.frames.map(frame => frame.id) };
    if (scopeMode === 'selection') return { kind: 'selection', frameIds: selectedFrameIds.length ? selectedFrameIds : frameworkRef.current.frames.map(frame => frame.id) };
    if (scopeMode === 'branch' && selectedFrameId) return { kind: 'branch', frameIds: branchIds(selectedFrameId) };
    return { kind: 'frame', frameIds: selectedFrameId ? [selectedFrameId] : frameworkRef.current.frames.slice(0, 1).map(frame => frame.id) };
  }, [branchIds, scopeMode, selectedFrameId, selectedFrameIds]);

  const runStructuralOperation = useCallback(async (operation: StructuralOperation) => {
    setStatus('THINKING');
    try {
      const proposal = await requestStructuralProposal(frameworkRef.current, currentScope(), operation);
      changeFramework(current => ({
        ...current,
        proposals: [...(current.proposals ?? []).filter(item => item.id !== proposal.id), proposal],
        updatedAt: new Date().toISOString()
      }), { record: false });
      setSideMode('proposal');
      setStatus('PROPOSAL');
    } catch (error) {
      setStatus('STOPPED');
      console.error(error);
    }
  }, [changeFramework, currentScope]);

  const acceptActiveProposal = useCallback(async () => {
    if (!activeProposal) return;
    if (activeProposal.operation === 'compress') {
      const acceptedSource = {
        ...frameworkRef.current,
        proposals: [...(frameworkRef.current.proposals ?? []).filter(item => item.id !== activeProposal.id), { ...activeProposal, status: 'accepted' as const }],
        updatedAt: new Date().toISOString()
      };
      await saveFramework(acceptedSource);
      const compressed = proposalToFramework(acceptedSource, activeProposal);
      await saveFramework(compressed);
      await setActiveFrameworkId(compressed.id);
      frameworkRef.current = compressed;
      setFramework(compressed);
      setSelectedFrameIds(compressed.frames[0]?.id ? [compressed.frames[0].id] : []);
      pastRef.current = [];
      futureRef.current = [];
      setHistoryTick(value => value + 1);
      setRun(null);
      setSideMode('framework');
      await refreshLists(compressed.id);
      setStatus('READY');
      return;
    }
    changeFramework(current => applyProposal(current, activeProposal), { label: `Accept ${activeProposal.operation}` });
    setSideMode('frame');
    setStatus('READY');
  }, [activeProposal, changeFramework, refreshLists]);

  const rejectActiveProposal = useCallback(() => {
    if (!activeProposal) return;
    changeFramework(current => rejectProposal(current, activeProposal), { record: false });
    setSideMode('frame');
    setStatus('READY');
  }, [activeProposal, changeFramework]);

  const organizeGoal = useCallback((goal: FrameworkGoal) => {
    changeFramework(current => reorganizeForGoal(current, goal), { label: `Organize for ${goal}` });
    setRun(null);
    requestAnimationFrame(() => fitView());
  }, [changeFramework]);

  const mergeSingleRun = useCallback((previous: FrameworkRun | null, single: FrameworkRun) => {
    const merged = new Map((previous?.steps ?? []).filter(step => frameworkRef.current.frames.some(frame => frame.id === step.frameId)).map(step => [step.frameId, step]));
    for (const step of single.steps) merged.set(step.frameId, step);
    return { ...single, steps: [...merged.values()] };
  }, []);

  const executeSelected = useCallback(async () => {
    if (!selectedFrameId) return;
    setStatus('RUNNING');
    const single = await runSingleFrame(frameworkRef.current, selectedFrameId, run);
    const merged = mergeSingleRun(run, single);
    setRun(merged);
    setStatus(single.status === 'ok' ? 'PASSED' : 'STOPPED');
    await saveRun(single).catch(() => undefined);
    setRuns(await listRuns(frameworkRef.current.id).catch(() => []));
  }, [mergeSingleRun, run, selectedFrameId]);

  const executeAll = useCallback(async () => {
    setStatus('RUNNING');
    const running: FrameworkRun = {
      id: `run-${Date.now()}`, frameworkId: frameworkRef.current.id, status: 'running', startedAt: new Date().toISOString(), activeFrameId: null, steps: []
    };
    setRun(running);
    const final = await runFramework(frameworkRef.current, event => setRun(event.run));
    setRun(final);
    setStatus(final.status === 'ok' ? 'PASSED' : 'STOPPED');
    await saveRun(final).catch(() => undefined);
    setRuns(await listRuns(frameworkRef.current.id).catch(() => []));
  }, []);

  const switchFramework = useCallback(async (id: string) => {
    if (id === frameworkRef.current.id) return;
    await saveFramework(frameworkRef.current).catch(() => undefined);
    await setActiveFrameworkId(id);
    const next = await loadFramework(id);
    frameworkRef.current = next;
    setFramework(next);
    setSelectedFrameIds(next.frames[0]?.id ? [next.frames[0].id] : []);
    setSelectedConnectionId(null);
    setRun(null);
    setScale(1);
    pastRef.current = [];
    futureRef.current = [];
    setHistoryTick(value => value + 1);
    setSideMode('framework');
    await refreshLists(next.id);
  }, [refreshLists]);

  const reset = useCallback(() => {
    const seed = createSeedFramework();
    recordHistory(frameworkRef.current, 'Reset Framework');
    frameworkRef.current = seed;
    setFramework(seed);
    setSelectedFrameIds(['instruction-1']);
    setSelectedConnectionId(null);
    setRun(null);
    setScale(1);
    setCableMotion(null);
    setStatus('READY');
    saveFramework(seed).catch(() => undefined);
  }, [recordHistory]);

  const fitView = useCallback(() => {
    const stage = stageRef.current;
    if (!stage || !visibleFrames.length) return;
    const minX = Math.min(...visibleFrames.map(frame => frame.x));
    const minY = Math.min(...visibleFrames.map(frame => frame.y));
    const maxX = Math.max(...visibleFrames.map(frame => frame.x + FRAME_WIDTH));
    const maxY = Math.max(...visibleFrames.map(frame => frame.y + FRAME_HEIGHT));
    const width = Math.max(1, maxX - minX);
    const height = Math.max(1, maxY - minY);
    const padding = 90;
    const next = clamp(Math.min((stage.clientWidth - padding * 2) / width, (stage.clientHeight - padding * 2) / height), 0.35, 1.35);
    setScale(next);
    requestAnimationFrame(() => {
      stage.scrollLeft = Math.max(0, (minX + width / 2) * next - stage.clientWidth / 2);
      stage.scrollTop = Math.max(0, (minY + height / 2) * next - stage.clientHeight / 2);
    });
  }, [visibleFrames]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (target.matches('input,textarea,select')) return;
      const command = event.metaKey || event.ctrlKey;
      const key = event.key.toLowerCase();
      if (command && key === 'z') {
        event.preventDefault();
        if (event.shiftKey) redo(); else undo();
        return;
      }
      if (command && key === 'c') { event.preventDefault(); copySelection(); return; }
      if (command && key === 'v') { event.preventDefault(); pasteSelection(); return; }
      if (command && key === 'd') { event.preventDefault(); duplicateSelection(); return; }
      if (command && key === 'r') { event.preventDefault(); void executeAll(); return; }
      const presetIds: Record<string, string> = { '1': 'thought', '2': 'feeling', '3': 'behavior', '4': 'context', '5': 'evidence' };
      if (presetIds[event.key]) addElementPreset(presetIds[event.key]);
      if (event.key === 'Delete' || event.key === 'Backspace') {
        if (selectedConnectionId) removeConnection(selectedConnectionId);
        else deleteSelection();
      }
      if (event.key === 'Escape') {
        setSelectedFrameIds([]);
        setSelectedConnectionId(null);
        wireRef.current = null;
        setWire(null);
        setRelationshipPickMode(false);
        setPanelOpen(false);
        setStatus('READY');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [addElementPreset, copySelection, deleteSelection, duplicateSelection, executeAll, pasteSelection, redo, removeConnection, selectedConnectionId, undo]);

  const onStagePointerDown = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    if (target.closest('[data-frame],[data-port],[data-connection-hit],[data-remove-connection]') || wireRef.current) return;
    if (event.button !== 0 && event.button !== 1) return;
    const stage = stageRef.current;
    if (!stage) return;
    if (!(event.shiftKey || event.metaKey || event.ctrlKey)) setSelectedFrameIds([]);
    setSelectedConnectionId(null);
    panRef.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, left: stage.scrollLeft, top: stage.scrollTop };
    stage.classList.add('panning');
    stage.setPointerCapture(event.pointerId);
  }, []);

  const onStagePointerMove = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const pan = panRef.current;
    const stage = stageRef.current;
    if (!pan || pan.pointerId !== event.pointerId || !stage) return;
    stage.scrollLeft = pan.left - (event.clientX - pan.x);
    stage.scrollTop = pan.top - (event.clientY - pan.y);
  }, []);
  const endPan = useCallback(() => {
    panRef.current = null;
    stageRef.current?.classList.remove('panning');
  }, []);

  const onWheel = useCallback((event: React.WheelEvent<HTMLDivElement>) => {
    if (!(event.ctrlKey || event.metaKey)) return;
    event.preventDefault();
    const stage = stageRef.current;
    if (!stage) return;
    const old = scale;
    const next = clamp(+(old + (event.deltaY < 0 ? 0.08 : -0.08)).toFixed(2), 0.35, 1.6);
    if (next === old) return;
    const rect = stage.getBoundingClientRect();
    const sx = event.clientX - rect.left;
    const sy = event.clientY - rect.top;
    const worldX = (stage.scrollLeft + sx) / old;
    const worldY = (stage.scrollTop + sy) / old;
    setScale(next);
    requestAnimationFrame(() => {
      stage.scrollLeft = worldX * next - sx;
      stage.scrollTop = worldY * next - sy;
    });
  }, [scale]);

  const connectionCount = framework.connections.length;
  const proposalCount = framework.proposals?.filter(item => item.status === 'pending').length ?? 0;
  void historyTick;

  if (!loaded) return <div className="boot">Visual Framework</div>;

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand"><span className="brand-mark">VF</span><span className="brand-name">Visual Framework</span></div>
        <div className="top-actions">
          <span className={`status status-${status.toLowerCase()}`}><i /><b>{status}</b></span>
          <button className="text-btn secondary-top-action" onClick={undo} disabled={!pastRef.current.length}>Undo</button>
          <button className="text-btn secondary-top-action" onClick={redo} disabled={!futureRef.current.length}>Redo</button>
          <button className="text-btn secondary-top-action" onClick={() => openPanel('issues')}>Checks {lintIssues.length + executionIssues.length}</button>
          <button className="text-btn secondary-top-action" onClick={() => openPanel('runs')}>Runs {runs.length}</button>
          <button className="text-btn secondary-top-action" onClick={reset}>Reset</button>
          <button className="run-button" onClick={() => void executeAll()} disabled={status === 'RUNNING' || status === 'THINKING'}><span>Run</span><kbd>⌘R</kbd></button>
        </div>
      </header>

      <aside className="tool-rail" aria-label="Add to framework">
        <div className="tool-caption">ADD</div>
        {FEATURED_ELEMENT_PRESETS.map((preset, index) => (
          <button key={preset.id} className="tool" title={preset.technical} onClick={() => addElementPreset(preset.id)}>
            <span className="tool-glyph">{preset.glyph}</span><span className="tool-label">{preset.label}</span><span className="tool-key">{index + 1}</span>
          </button>
        ))}
        <button className="tool compact" onClick={() => openPanel('library')} title="Open the Human Sciences Element Library">
          <span className="tool-glyph">＋</span><span className="tool-label">Library</span>
        </button>
        <div className="rail-divider" />
        <button className="tool compact" onClick={duplicateSelection} disabled={!selectedFrameIds.length}><span className="tool-glyph">⧉</span><span className="tool-label">Duplicate</span></button>
        <button className="tool compact" onClick={fitView}><span className="tool-glyph">⌗</span><span className="tool-label">Fit</span></button>
      </aside>

      <section className="workspace">
        <div className="workspace-head">
          <div className="framework-heading">
            <select className="framework-switch" value={framework.id} onChange={(event: React.ChangeEvent<HTMLSelectElement>) => void switchFramework(event.target.value)}>
              {frameworkList.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
              {!frameworkList.some(item => item.id === framework.id) && <option value={framework.id}>{framework.name}</option>}
            </select>
            <span>{framework.frames.length} elements · {connectionCount} relationships</span>
            {selectedFrameIds.length > 1 && <b className="selection-count">{selectedFrameIds.length} selected</b>}
          </div>
          <div className="workspace-controls">
            {selectedFrameIds.length === 2 && <>
              <select className="relation-select" value={relationshipMeaning} onChange={(event: React.ChangeEvent<HTMLSelectElement>) => setRelationshipMeaning(event.target.value as RelationshipMeaning)}>
                {RELATIONSHIPS.map(item => <option key={item} value={item}>{relationshipLabel(item)}</option>)}
              </select>
              <button className="quiet-action" onClick={() => connectMeaning()}>Connect</button>
              <button className="quiet-action" onClick={() => openPanel('relationships')}>Relationship Library</button>
            </>}
            {selectedFrameIds.length !== 2 && <button className="quiet-action relationship-action" onClick={() => openPanel('relationships')}>Relationships</button>}
            {selectedFrame && <button className="quiet-action inspect-action" onClick={() => openPanel('frame')}>Inspect</button>}
            <button className="quiet-action fit-action" onClick={fitView}>Fit</button>
            <div className="zoom"><button onClick={() => setScale(value => clamp(+(value - 0.1).toFixed(2), 0.35, 1.6))}>−</button><span>{Math.round(scale * 100)}%</span><button onClick={() => setScale(value => clamp(+(value + 0.1).toFixed(2), 0.35, 1.6))}>+</button></div>
          </div>
        </div>

        <div className="structure-bar">
          <div className="scope-control"><span>SCOPE</span><select value={scopeMode} onChange={(event: React.ChangeEvent<HTMLSelectElement>) => setScopeMode(event.target.value as ScopeMode)}><option value="frame">Element</option><option value="selection">Selection</option><option value="branch">Path</option><option value="framework">Framework</option></select></div>
          <div className="structure-actions">
            {STRUCTURAL_OPERATIONS.map(([operation, operationLabel]) => <button key={operation} onClick={() => void runStructuralOperation(operation)} disabled={status === 'THINKING' || status === 'RUNNING'}>{operationLabel}</button>)}
          </div>
          <div className="goal-control"><span>GOAL</span><select value={framework.goal ?? 'understand'} onChange={(event: React.ChangeEvent<HTMLSelectElement>) => organizeGoal(event.target.value as FrameworkGoal)}>{GOALS.map(goal => <option key={goal} value={goal}>{label(goal)}</option>)}</select></div>
        </div>

        <div
          ref={stageRef}
          className={`stage${wire ? ' connecting' : ''}`}
          onPointerDown={onStagePointerDown}
          onPointerMove={onStagePointerMove}
          onPointerUp={endPan}
          onPointerCancel={endPan}
          onWheel={onWheel}
        >
          <div className={`world${scale < 0.58 ? ' zoom-far' : ''}`} style={{ width: worldWidth, height: worldHeight, transform: `scale(${scale})` }}>
            <svg className="connections" width={worldWidth} height={worldHeight}>
              {framework.connections.map(connection => {
                const source = frameMap.get(connection.fromFrame);
                const target = frameMap.get(connection.toFrame);
                if (!source || !target || !visibleIds.has(source.id) || !visibleIds.has(target.id)) return null;
                const semantic = connection.kind === 'semantic';
                const sourceIndex = Math.max(0, source.outputs.findIndex(port => port.id === connection.fromPort));
                const targetIndex = Math.max(0, target.inputs.findIndex(port => port.id === connection.toPort));
                const start = semantic ? semanticPoint(source, 'from') : portCenter(source, 'out', sourceIndex);
                const end = semantic ? semanticPoint(target, 'to') : portCenter(target, 'in', targetIndex);
                const sourceMotion = cableMotion?.frameId === source.id ? cableMotion : undefined;
                const targetMotion = cableMotion?.frameId === target.id ? cableMotion : undefined;
                const geometry = curveGeometry(start, end, sourceMotion, targetMotion);
                const selected = selectedConnectionId === connection.id;
                const executing = !semantic && run?.activeFrameId === target.id;
                const classes = ['connection-group', semantic ? 'semantic' : 'execution', selected ? 'selected' : '', newConnectionId === connection.id ? 'just-connected' : '', removingConnectionId === connection.id ? 'removing' : '', executing ? 'executing' : ''].filter(Boolean).join(' ');
                return (
                  <g key={connection.id} className={classes}>
                    <path className="connection-halo" d={geometry.d} pathLength="1" />
                    <path className="connection-main" d={geometry.d} pathLength="1" />
                    <path
                      className="connection-hit"
                      data-connection-hit={connection.id}
                      d={geometry.d}
                      onPointerDown={(event: React.PointerEvent<SVGPathElement>) => event.stopPropagation()}
                      onClick={(event: React.MouseEvent<SVGPathElement>) => { event.stopPropagation(); setSelectedFrameIds([]); setSelectedConnectionId(connection.id); }}
                    />
                    {selected && semantic && <text className="connection-label" x={geometry.mid.x} y={geometry.mid.y - 9} textAnchor="middle">{relationshipLabel(connection.meaning ?? 'depends-on')}</text>}
                    {selected && (
                      <g
                        className="connection-remove"
                        data-remove-connection={connection.id}
                        transform={`translate(${geometry.mid.x} ${geometry.mid.y})`}
                        onPointerDown={(event: React.PointerEvent<SVGGElement>) => event.stopPropagation()}
                        onClick={(event: React.MouseEvent<SVGGElement>) => { event.stopPropagation(); removeConnection(connection.id); }}
                      >
                        <circle r="12" /><path d="M -4 -4 L 4 4 M 4 -4 L -4 4" />
                      </g>
                    )}
                  </g>
                );
              })}
              {wire && <path className="wire-live" d={curveGeometry({ x: wire.x1, y: wire.y1 }, { x: wire.x2, y: wire.y2 }).d} />}
              {wire && <circle className="wire-tip" cx={wire.x2} cy={wire.y2} r="5" />}
            </svg>

            <div className="frames">
              {visibleFrames.map(frame => {
                const step = stepMap.get(frame.id);
                const active = run?.activeFrameId === frame.id;
                const selected = selectedFrameIds.includes(frame.id);
                const body = active ? 'Running…' : step?.status === 'ok' ? short(step.output) : step?.status === 'error' ? 'Run stopped' : frame.kind === 'asset' ? short(frame.value) : frame.body || '';
                const meta = active ? 'RUNNING' : step ? `${step.durationMs}ms` : frame.epistemicState ? stateLabel(frame.epistemicState) : 'UNASSESSED';
                const children = childrenByParent.get(frame.id) ?? [];
                const parent = frame.parentId ? frameMap.get(frame.parentId) : undefined;
                return (
                  <div
                    key={frame.id}
                    data-frame={frame.id}
                    className={`frame frame-${frame.kind}${selected ? ' selected' : ''}${active ? ' run-active' : ''}${step?.status === 'ok' ? ' run-ok' : ''}${step?.status === 'error' ? ' run-error' : ''}`}
                    style={{ width: FRAME_WIDTH, height: FRAME_HEIGHT, left: frame.x, top: frame.y }}
                    onPointerDown={event => onFramePointerDown(event, frame)}
                    onPointerMove={onFramePointerMove}
                    onPointerUp={onFramePointerUp}
                    onDoubleClick={() => { setSelectedFrameIds([frame.id]); openPanel('frame'); }}
                  >
                    <div className="frame-index">{frame.role ? roleLabel(frame.role) : KIND_LABELS[frame.kind]}</div>
                    <div className="frame-title">{frame.title}</div>
                    <div className="frame-body">{body}</div>
                    <div className="frame-meta"><span>{meta}</span><span>{frame.operation === 'MODEL' ? 'MODEL' : 'LOCAL'}</span></div>
                    {parent && <span className="frame-parent">inside {parent.title}</span>}
                    {children.length > 0 && <button className="frame-collapse" onClick={(event: React.MouseEvent<HTMLButtonElement>) => { event.stopPropagation(); toggleCollapsed(frame.id); }}>{frame.collapsed ? `+${children.length}` : `−${children.length}`}</button>}
                    {frame.inputs.map((port, index) => (
                      <button
                        key={port.id}
                        data-port="in"
                        data-frame-id={frame.id}
                        data-port-id={port.id}
                        title="Connect into this element"
                        className={`port port-in${wire ? compatible(wire.outputType, port.type) && wire.fromFrame !== frame.id ? ' can-connect' : ' cannot-connect' : ''}`}
                        style={{ top: 54 + index * 22 }}
                        onPointerDown={(event: React.PointerEvent<HTMLButtonElement>) => event.stopPropagation()}
                      />
                    ))}
                    {frame.outputs.map((port, index) => (
                      <button
                        key={port.id}
                        data-port="out"
                        data-frame-id={frame.id}
                        data-port-id={port.id}
                        title="Connect from this element"
                        className="port port-out"
                        style={{ top: 54 + index * 22 }}
                        onPointerDown={(event: React.PointerEvent<HTMLButtonElement>) => startWire(event, frame, port, index)}
                      />
                    ))}
                  </div>
                );
              })}
            </div>
            <div className="canvas-hint"><span>Drag space to move</span><i /><span>Shift selects more</span><i /><span>Ctrl scroll zooms</span></div>
          </div>
        </div>
      </section>

      {panelOpen && <button className="panel-backdrop" aria-label="Close panel" onClick={closePanel} />}
      <aside className={`inspector${panelOpen ? ' panel-open' : ''}`}>
        {sideMode === 'library' ? (
          <ElementLibraryInspector onAdd={addElementPreset} onClose={() => { closePanel(); setSideMode(selectedFrame ? 'frame' : 'framework'); }} />
        ) : sideMode === 'relationships' ? (
          <RelationshipLibraryInspector
            selectedCount={selectedFrameIds.length}
            onConnect={meaning => connectMeaning(meaning)}
            onClose={() => { closePanel(); setSideMode(selectedFrame ? 'frame' : 'framework'); }}
          />
        ) : sideMode === 'proposal' && activeProposal ? (
          <ProposalInspector proposal={activeProposal} onAccept={() => void acceptActiveProposal()} onReject={rejectActiveProposal} onClose={() => { closePanel(); setSideMode('frame'); }} />
        ) : sideMode === 'issues' ? (
          <IssuesInspector issues={lintIssues} executionIssues={executionIssues} onSelect={ids => { setSelectedFrameIds(ids); setSideMode('frame'); closePanel(); }} onClose={() => { closePanel(); setSideMode('frame'); }} />
        ) : sideMode === 'runs' ? (
          <RunsInspector runs={runs} activeRun={run} onSelect={selected => setRun(selected)} onClose={() => { closePanel(); setSideMode('frame'); }} />
        ) : sideMode === 'framework' ? (
          <FrameworkInspector
            framework={framework}
            pendingProposals={proposalCount}
            transformations={framework.transformations?.length ?? 0}
            onOpenProposal={() => openPanel('proposal')}
            onOpenIssues={() => openPanel('issues')}
            onOpenRuns={() => openPanel('runs')}
          />
        ) : selectedFrame ? (
          <FrameInspector
            frame={selectedFrame}
            step={stepMap.get(selectedFrame.id)}
            selectedCount={selectedFrameIds.length}
            childCount={(childrenByParent.get(selectedFrame.id) ?? []).length}
            onClose={() => { closePanel(); setSelectedFrameIds([]); }}
            onChange={patch => updateFrame(selectedFrame.id, patch)}
            onDelete={deleteSelection}
            onRun={() => void executeSelected()}
            onContain={containSelection}
            onRelease={releaseFromParent}
            onToggleCollapse={() => toggleCollapsed(selectedFrame.id)}
          />
        ) : (
          <FrameworkInspector
            framework={framework}
            pendingProposals={proposalCount}
            transformations={framework.transformations?.length ?? 0}
            onOpenProposal={() => openPanel('proposal')}
            onOpenIssues={() => openPanel('issues')}
            onOpenRuns={() => openPanel('runs')}
          />
        )}
      </aside>

      <nav className="mobile-action-bar" aria-label="Canvas actions">
        <button onClick={undo} disabled={!pastRef.current.length}><span>↶</span><b>Undo</b></button>
        <button onClick={() => openPanel('library')}><span>＋</span><b>New</b></button>
        <button
          className={relationshipPickMode ? 'active' : ''}
          onClick={() => {
            if (selectedFrameIds.length === 2) {
              setRelationshipPickMode(false);
              openPanel('relationships');
            } else {
              setRelationshipPickMode(true);
              setPanelOpen(false);
              if (selectedFrameIds.length > 2) setSelectedFrameIds([]);
              setStatus('SELECT 2');
            }
          }}
        ><span>↔</span><b>Relate</b></button>
        <button onClick={() => selectedFrame && openPanel('frame')} disabled={!selectedFrame}><span>◎</span><b>Inspect</b></button>
        <button onClick={() => openPanel('framework')}><span>•••</span><b>More</b></button>
      </nav>

      {run && <div className={`run-strip${run.status === 'error' ? ' run-strip-error' : ''}`}><span>{run.status === 'running' ? 'RUNNING' : run.status === 'ok' ? 'DONE' : 'STOPPED'}</span><strong>{run.steps.filter(step => step.status === 'ok').length}/{framework.frames.length}</strong><button onClick={() => setRun(null)}>×</button></div>}
    </main>
  );
}

function RelationshipLibraryInspector({ selectedCount, onConnect, onClose }: {
  selectedCount: number;
  onConnect: (meaning: RelationshipMeaning) => void;
  onClose: () => void;
}) {
  return <>
    <div className="inspector-head"><div><span>RELATIONSHIP LIBRARY</span><strong>Human Sciences</strong></div><button className="close-inspector" onClick={onClose}>×</button></div>
    <p className="proposal-summary">
      Choose what the connection means. Select exactly two elements to create a relationship from the first selected element to the second.
    </p>
    {selectedCount !== 2 && <p className="empty-copy">Select exactly two elements to connect them. You can still inspect the relationship vocabulary below.</p>}
    {RELATIONSHIP_CATEGORIES.map(category => (
      <div className="order-block" key={category}>
        <span>{category}</span>
        <div className="order-list">
          {RELATIONSHIP_PRESETS.filter(preset => preset.category === category).map(preset => (
            <button
              key={preset.meaning}
              title={preset.technical}
              disabled={selectedCount !== 2}
              onClick={() => onConnect(preset.meaning)}
            >
              {preset.label} · {preset.technical}
            </button>
          ))}
        </div>
      </div>
    ))}
    <div className="hierarchy-block">
      <span>Scientific precision</span>
      <p>Moderation, mediation, reinforcement, temporal precedence, priming, diffusion, contagion, mobilization and similar mechanisms are not collapsed into these relationships. They should be added only when VFA has distinct underlying relationship types for them.</p>
    </div>
  </>;
}

function ElementLibraryInspector({ onAdd, onClose }: { onAdd: (presetId: string) => void; onClose: () => void }) {
  return <>
    <div className="inspector-head"><div><span>ELEMENT LIBRARY</span><strong>Human Sciences</strong></div><button className="close-inspector" onClick={onClose}>×</button></div>
    <p className="proposal-summary">Choose what the element represents. The plain-language label comes first; the professional term follows it. These are presets over the existing VFA graph, not new engine types.</p>
    {ELEMENT_CATEGORIES.map(category => (
      <div className="order-block" key={category}>
        <span>{category}</span>
        <div className="order-list">
          {ELEMENT_PRESETS.filter(preset => preset.category === category).map(preset => (
            <button key={preset.id} title={preset.technical} onClick={() => onAdd(preset.id)}>
              {preset.label} · {preset.technical}
            </button>
          ))}
        </div>
      </div>
    ))}
  </>;
}

function FrameInspector({ frame, step, selectedCount, childCount, onClose, onChange, onDelete, onRun, onContain, onRelease, onToggleCollapse }: {
  frame: Frame;
  step?: FrameworkRun['steps'][number];
  selectedCount: number;
  childCount: number;
  onClose: () => void;
  onChange: (patch: Partial<Frame>) => void;
  onDelete: () => void;
  onRun: () => void;
  onContain: () => void;
  onRelease: () => void;
  onToggleCollapse: () => void;
}) {
  const bodyLabel = { asset: 'Content', instruction: 'Instruction', expression: 'Rule', check: 'Test', output: 'Finding' }[frame.kind];
  return <>
    <div className="inspector-head"><div><span>ELEMENT</span><strong>{frame.title}</strong></div><button className="close-inspector" onClick={onClose}>×</button></div>
    <label className="field"><span>Name</span><input value={frame.title} onChange={(event: React.ChangeEvent<HTMLInputElement>) => onChange({ title: event.target.value })} /></label>
    <div className="dual-field">
      <label className="field"><span>Element Type</span><select value={frame.role ?? 'concept'} onChange={(event: React.ChangeEvent<HTMLSelectElement>) => onChange({ role: event.target.value as FrameRole })}>{ROLES.map(role => <option key={role} value={role}>{roleLabel(role)}</option>)}</select></label>
      <label className="field"><span>Status</span><select value={frame.epistemicState ?? 'unknown'} onChange={(event: React.ChangeEvent<HTMLSelectElement>) => onChange({ epistemicState: event.target.value as EpistemicState })}>{STATES.map(state => <option key={state} value={state}>{stateLabel(state)}</option>)}</select></label>
    </div>
    {frame.kind === 'instruction' && <div className="order-block"><span>Methods</span><div className="order-list">{FRAME_ORDERS.map(order => <button key={order.id} className={frame.orderPreset === order.id ? 'active' : ''} onClick={() => onChange({ title: order.title, body: order.prompt, operation: 'MODEL', orderPreset: order.id })}>{order.title}</button>)}</div></div>}
    {frame.kind !== 'output' && <label className="field"><span>{bodyLabel}</span><textarea value={String(frame.kind === 'asset' ? frame.value ?? '' : frame.body)} onChange={(event: React.ChangeEvent<HTMLTextAreaElement>) => frame.kind === 'asset' ? onChange({ value: event.target.value }) : onChange({ body: event.target.value, orderPreset: '' })} /></label>}
    {(frame.kind === 'instruction' || frame.kind === 'expression') && <div className="seg-field"><span>Processing</span><div className="seg"><button className={frame.operation === 'DETERMINISTIC' ? 'active' : ''} onClick={() => onChange({ operation: 'DETERMINISTIC' })}>Local</button><button className={frame.operation === 'MODEL' ? 'active' : ''} onClick={() => onChange({ operation: 'MODEL' })}>Model</button></div></div>}
    {frame.kind === 'expression' && <div className="seg-field"><span>Use As</span><div className="seg"><button className={frame.expressionClass === 'EXECUTABLE' ? 'active' : ''} onClick={() => onChange({ expressionClass: 'EXECUTABLE' })}>Active Rule</button><button className={frame.expressionClass === 'DESCRIPTIVE' ? 'active' : ''} onClick={() => onChange({ expressionClass: 'DESCRIPTIVE' })}>Descriptive Note</button></div></div>}
    <div className="hierarchy-block"><span>Structure</span><p>{frame.parentId ? 'Inside another element.' : 'Top level element.'}{childCount ? ` Contains ${childCount}.` : ''}</p>{selectedCount > 1 && <button onClick={onContain}>Group selection inside active element</button>}{frame.parentId && <button onClick={onRelease}>Move out of group</button>}{childCount > 0 && <button onClick={onToggleCollapse}>{frame.collapsed ? 'Show contained elements' : 'Hide contained elements'}</button>}</div>
    <div className="io-block"><span>Relationships</span>{[...frame.inputs.map(port => `Receives · ${port.name}`), ...frame.outputs.map(port => `Leads to · ${port.name}`)].map(text => <code key={text}>{text}</code>)}</div>
    <div className="provenance-block"><span>Origin</span><b>{label(frame.provenance?.origin ?? 'user')}</b>{frame.provenance?.source && <small>{frame.provenance.source}</small>}</div>
    <div className="trace-block"><span>Last run</span>{step ? <><b className={`trace-state trace-${step.status}`}>{step.status === 'ok' ? 'DONE' : 'ERROR'}</b><dl><dt>Received</dt><dd>{short(step.input, 180)}</dd><dt>Instruction</dt><dd>{frame.body || 'Local process'}</dd><dt>Produced</dt><dd>{short(step.output, 180)}</dd><dt>Processing</dt><dd>{step.executor === 'MODEL' ? 'Model' : 'Local'}</dd>{step.error && <><dt>Error</dt><dd>{step.error}</dd></>}</dl></> : <em>Not run</em>}</div>
    <button className="inspector-run" onClick={onRun}>Run Element</button>
    <button className="delete-btn" onClick={onDelete}>Delete</button>
  </>;
}

function ProposalInspector({ proposal, onAccept, onReject, onClose }: { proposal: Proposal; onAccept: () => void; onReject: () => void; onClose: () => void }) {
  return <>
    <div className="inspector-head"><div><span>SUGGESTED CHANGE</span><strong>{STRUCTURAL_OPERATIONS.find(([operation]) => operation === proposal.operation)?.[1] ?? label(proposal.operation)}</strong></div><button className="close-inspector" onClick={onClose}>×</button></div>
    <p className="proposal-summary">{proposal.summary}</p>
    <div className="proposal-list">{proposal.additions.length ? proposal.additions.map(item => <article key={item.tempId}><span>{roleLabel(item.role ?? 'concept')}</span><strong>{item.title}</strong>{item.body && <p>{item.body}</p>}<small>{item.relationshipToAnchor ? relationshipLabel(item.relationshipToAnchor) : 'No relationship specified'}</small></article>) : <p className="empty-copy">No structural addition was proposed.</p>}</div>
    <button className="inspector-run" onClick={onAccept}>{proposal.operation === 'compress' ? 'Create Framework' : 'Apply Changes'}</button>
    <button className="delete-btn" onClick={onReject}>Dismiss</button>
  </>;
}

function IssuesInspector({ issues, executionIssues, onSelect, onClose }: { issues: ReturnType<typeof lintFramework>; executionIssues: string[]; onSelect: (ids: string[]) => void; onClose: () => void }) {
  return <>
    <div className="inspector-head"><div><span>FRAMEWORK</span><strong>Checks</strong></div><button className="close-inspector" onClick={onClose}>×</button></div>
    {!issues.length && !executionIssues.length && <p className="empty-copy">No current concerns.</p>}
    <div className="issue-list">
      {executionIssues.map((message, index) => <article key={`execution-${index}`} className="issue error"><span>RUN</span><p>{checkMessage(message)}</p></article>)}
      {issues.map(issue => <button key={issue.id} className={`issue ${issue.severity}`} onClick={() => onSelect(issue.frameIds)}><span>{checkCodeLabel(issue.code)}</span><p>{checkMessage(issue.message)}</p></button>)}
    </div>
  </>;
}

function RunsInspector({ runs, activeRun, onSelect, onClose }: { runs: FrameworkRun[]; activeRun: FrameworkRun | null; onSelect: (run: FrameworkRun) => void; onClose: () => void }) {
  return <>
    <div className="inspector-head"><div><span>FRAMEWORK</span><strong>Runs</strong></div><button className="close-inspector" onClick={onClose}>×</button></div>
    {!runs.length && <p className="empty-copy">No saved runs yet.</p>}
    <div className="run-list">{runs.map(item => <button key={item.id} className={activeRun?.id === item.id ? 'active' : ''} onClick={() => onSelect(item)}><span>{item.status.toUpperCase()}</span><strong>{new Date(item.startedAt).toLocaleString()}</strong><small>{item.steps.length} elements</small></button>)}</div>
    {activeRun && <div className="run-detail"><span>Selected run</span>{activeRun.steps.map(step => <article key={step.frameId}><b>{step.frameId}</b><small>{step.status.toUpperCase()} · {step.durationMs}ms</small><p>{short(step.output ?? step.error, 220)}</p></article>)}</div>}
  </>;
}

function FrameworkInspector({ framework, pendingProposals, transformations, onOpenProposal, onOpenIssues, onOpenRuns }: { framework: FrameworkDocument; pendingProposals: number; transformations: number; onOpenProposal: () => void; onOpenIssues: () => void; onOpenRuns: () => void }) {
  return <div className="framework-inspector">
    <div className="inspector-head"><div><span>FRAMEWORK</span><strong>{framework.name}</strong></div></div>
    <dl><dt>Goal</dt><dd>{label(framework.goal ?? 'understand')}</dd><dt>Version</dt><dd>{framework.version ?? 1}</dd><dt>Elements</dt><dd>{framework.frames.length}</dd><dt>Relationships</dt><dd>{framework.connections.length}</dd><dt>Changes</dt><dd>{transformations}</dd></dl>
    {pendingProposals > 0 && <button className="panel-action" onClick={onOpenProposal}>Review Suggested Change</button>}
    <button className="panel-action" onClick={onOpenIssues}>Inspect Checks</button>
    <button className="panel-action" onClick={onOpenRuns}>Inspect Runs</button>
  </div>;
}
