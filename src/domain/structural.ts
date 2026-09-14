import type {
  EpistemicState,
  Frame,
  FrameRole,
  FrameworkDocument,
  FrameworkGoal,
  FrameworkScope,
  Proposal,
  ProposedFrame,
  RelationshipMeaning,
  StructuralOperation
} from './types';

const ROLES = new Set<FrameRole>([
  'concept','claim','question','assumption','evidence','constraint','variable','observation','perspective','cause','effect','decision','criterion','hypothesis','alternative','unknown','contradiction','transformation','evaluation','result','instruction'
]);
const STATES = new Set<EpistemicState>([
  'known','supported','verified','assumed','inferred','hypothesized','disputed','contradicted','unknown','unresolved','invalid'
]);
const RELATIONSHIPS = new Set<RelationshipMeaning>([
  'feeds','contains','part-of','depends-on','supports','challenges','contradicts','causes','influences','constrains','explains','derives-from','evidence-for','assumes','questions','tests','validates','refines','reframes','alternative-to'
]);

const OPERATION_ORDERS: Record<StructuralOperation, string> = {
  expand: 'Reveal the next meaningful structural layer. Add only Frames that materially improve understanding. Preserve hierarchy and unresolved alternatives.',
  compress: 'Compress the supplied structure into the smallest set of Frames that preserves its essential distinctions, conflicts, dependencies, and uncertainty.',
  reframe: 'Produce structurally different interpretations by changing a meaningful framing condition. Do not merely rewrite the same wording.',
  alternatives: 'Generate the strongest materially different alternatives. Preserve competing explanations instead of ranking them prematurely.',
  challenge: 'Challenge the represented structure. Surface hidden assumptions, weak dependencies, counterpositions, and conditions under which the current interpretation could fail.',
  'find-missing': 'Find structurally important omissions such as causes, stakeholders, dependencies, alternatives, contradictions, variables, consequences, evidence needs, or abstraction levels.',
  'identify-assumption': 'Identify assumptions that the represented structure depends on. Separate explicit assumptions from hidden assumptions.',
  'find-contradiction': 'Find direct contradictions, incompatible claims, conflicting classifications, or conditions that cannot simultaneously hold.'
};

function scopeFrames(framework: FrameworkDocument, scope: FrameworkScope): Frame[] {
  if (scope.kind === 'framework') return framework.frames;
  const ids = new Set(scope.frameIds);
  return framework.frames.filter(frame => ids.has(frame.id));
}

function scopeText(framework: FrameworkDocument, scope: FrameworkScope) {
  const frames = scopeFrames(framework, scope);
  const ids = new Set(frames.map(frame => frame.id));
  const connections = framework.connections.filter(connection => ids.has(connection.fromFrame) && ids.has(connection.toFrame));
  return JSON.stringify({
    goal: framework.goal ?? 'understand',
    frames: frames.map(frame => ({
      id: frame.id,
      title: frame.title,
      role: frame.role ?? 'concept',
      state: frame.epistemicState ?? 'unknown',
      content: frame.kind === 'asset' ? frame.value ?? frame.body : frame.body,
      parentId: frame.parentId ?? null
    })),
    relationships: connections.map(connection => ({
      from: connection.fromFrame,
      to: connection.toFrame,
      meaning: connection.meaning ?? (connection.kind === 'semantic' ? 'depends-on' : 'feeds'),
      kind: connection.kind ?? 'execution'
    }))
  });
}

function extractObject(raw: string): any | null {
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try { return JSON.parse(raw.slice(start, end + 1)); }
  catch { return null; }
}

function cleanAddition(value: any, index: number): ProposedFrame | null {
  if (!value || typeof value.title !== 'string' || !value.title.trim()) return null;
  const role = ROLES.has(value.role as FrameRole) ? value.role as FrameRole : 'concept';
  const epistemicState = STATES.has(value.epistemicState as EpistemicState) ? value.epistemicState as EpistemicState : 'hypothesized';
  const relationshipToAnchor = RELATIONSHIPS.has(value.relationshipToAnchor as RelationshipMeaning)
    ? value.relationshipToAnchor as RelationshipMeaning
    : undefined;
  return {
    tempId: `proposal-${index}`,
    title: value.title.trim().slice(0, 120),
    body: typeof value.body === 'string' ? value.body.trim().slice(0, 1600) : '',
    role,
    epistemicState,
    relationshipToAnchor
  };
}

export async function requestStructuralProposal(
  framework: FrameworkDocument,
  scope: FrameworkScope,
  operation: StructuralOperation
): Promise<Proposal> {
  const instruction = `${OPERATION_ORDERS[operation]}\n\nReturn JSON only using this exact shape:\n{"summary":"brief explanation","additions":[{"title":"Frame title","body":"concise content","role":"concept|claim|question|assumption|evidence|constraint|variable|observation|perspective|cause|effect|decision|criterion|hypothesis|alternative|unknown|contradiction|transformation|evaluation|result|instruction","epistemicState":"known|supported|verified|assumed|inferred|hypothesized|disputed|contradicted|unknown|unresolved|invalid","relationshipToAnchor":"contains|part-of|depends-on|supports|challenges|contradicts|causes|influences|constrains|explains|derives-from|evidence-for|assumes|questions|tests|validates|refines|reframes|alternative-to"}]}\n\nUse 1 to 7 additions. If no defensible addition exists, return an empty additions array. Do not invent certainty.`;
  const response = await fetch('/api/model', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: `Structural ${operation}`, instruction, input: scopeText(framework, scope) })
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.error || 'STRUCTURAL OPERATION FAILED');
  const output = typeof data?.output === 'string' ? data.output.trim() : '';
  if (!output) throw new Error('EMPTY STRUCTURAL PROPOSAL');
  const parsed = extractObject(output);
  const additions = Array.isArray(parsed?.additions)
    ? parsed.additions.map(cleanAddition).filter(Boolean) as ProposedFrame[]
    : [];
  return {
    id: `proposal-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
    operation,
    scope,
    status: 'pending',
    createdAt: new Date().toISOString(),
    summary: typeof parsed?.summary === 'string' && parsed.summary.trim() ? parsed.summary.trim() : output.slice(0, 1200),
    additions
  };
}

function relationFor(operation: StructuralOperation, proposed?: RelationshipMeaning): RelationshipMeaning {
  if (proposed) return proposed;
  if (operation === 'reframe') return 'reframes';
  if (operation === 'alternatives') return 'alternative-to';
  if (operation === 'challenge') return 'challenges';
  if (operation === 'identify-assumption') return 'assumes';
  if (operation === 'find-contradiction') return 'contradicts';
  if (operation === 'expand') return 'contains';
  return 'depends-on';
}

export function applyProposal(framework: FrameworkDocument, proposal: Proposal): FrameworkDocument {
  const anchorId = proposal.scope.frameIds[0] ?? framework.frames[0]?.id;
  const anchor = framework.frames.find(frame => frame.id === anchorId) ?? framework.frames[0];
  if (!anchor || !proposal.additions.length) {
    return {
      ...framework,
      proposals: [...(framework.proposals ?? []).filter(item => item.id !== proposal.id), { ...proposal, status: 'accepted' }]
    };
  }
  const stamp = Date.now();
  const createdAt = new Date().toISOString();
  const addedFrames = proposal.additions.map((item, index): Frame => ({
    id: `frame-${stamp}-${index}`,
    kind: 'asset',
    role: item.role ?? 'concept',
    epistemicState: item.epistemicState ?? 'hypothesized',
    provenance: { origin: 'model', createdAt },
    title: item.title,
    operation: 'DETERMINISTIC',
    x: anchor.x + 310,
    y: anchor.y + (index - (proposal.additions.length - 1) / 2) * 150,
    inputs: [],
    outputs: [{ id: 'out', name: 'value', type: 'any' }],
    body: item.body ?? '',
    value: item.body || item.title,
    parentId: proposal.operation === 'expand' ? anchor.id : undefined
  }));
  const addedConnections = addedFrames.map((frame, index) => ({
    id: `semantic-${stamp}-${index}`,
    fromFrame: anchor.id,
    fromPort: '',
    toFrame: frame.id,
    toPort: '',
    kind: 'semantic' as const,
    meaning: relationFor(proposal.operation, proposal.additions[index]?.relationshipToAnchor),
    provenance: { origin: 'model' as const, createdAt }
  }));
  const before = framework.version ?? 1;
  const after = before + 1;
  return {
    ...framework,
    version: after,
    updatedAt: createdAt,
    frames: [...framework.frames, ...addedFrames],
    connections: [...framework.connections, ...addedConnections],
    proposals: [...(framework.proposals ?? []).filter(item => item.id !== proposal.id), { ...proposal, status: 'accepted' }],
    transformations: [...(framework.transformations ?? []), {
      id: `transform-${stamp}`,
      label: proposal.operation,
      createdAt,
      proposalId: proposal.id,
      versionBefore: before,
      versionAfter: after
    }]
  };
}

export function rejectProposal(framework: FrameworkDocument, proposal: Proposal): FrameworkDocument {
  return {
    ...framework,
    proposals: [...(framework.proposals ?? []).filter(item => item.id !== proposal.id), { ...proposal, status: 'rejected' }],
    updatedAt: new Date().toISOString()
  };
}

const goalRank: Record<FrameworkGoal, FrameRole[]> = {
  understand: ['question','concept','evidence','cause','effect','unknown','result'],
  explain: ['concept','cause','effect','evidence','example' as FrameRole,'result'],
  decide: ['question','criterion','alternative','evidence','constraint','decision','result'],
  invent: ['constraint','assumption','alternative','perspective','hypothesis','result'],
  research: ['question','unknown','hypothesis','evidence','contradiction','result'],
  compare: ['concept','criterion','alternative','evidence','contradiction','result'],
  challenge: ['claim','assumption','evidence','contradiction','alternative','unknown','result']
};

export function reorganizeForGoal(framework: FrameworkDocument, goal: FrameworkGoal): FrameworkDocument {
  const order = goalRank[goal];
  const rank = new Map(order.map((role, index) => [role, index]));
  const sorted = [...framework.frames].sort((a, b) => {
    const ar = rank.get(a.role ?? 'concept') ?? order.length;
    const br = rank.get(b.role ?? 'concept') ?? order.length;
    if (ar !== br) return ar - br;
    return a.title.localeCompare(b.title);
  });
  const createdAt = new Date().toISOString();
  const before = framework.version ?? 1;
  const frames = sorted.map((frame, index) => ({
    ...frame,
    x: 120 + (index % 4) * 290,
    y: 150 + Math.floor(index / 4) * 180
  }));
  return {
    ...framework,
    goal,
    frames,
    version: before + 1,
    updatedAt: createdAt,
    transformations: [...(framework.transformations ?? []), {
      id: `transform-goal-${Date.now()}`,
      label: `Organize for ${goal}`,
      createdAt,
      versionBefore: before,
      versionAfter: before + 1
    }]
  };
}

export function proposalToFramework(source: FrameworkDocument, proposal: Proposal): FrameworkDocument {
  const createdAt = new Date().toISOString();
  const frames = proposal.additions.map((item, index): Frame => ({
    id: `compressed-${Date.now()}-${index}`,
    kind: 'asset',
    role: item.role ?? 'concept',
    epistemicState: item.epistemicState ?? 'inferred',
    provenance: { origin: 'model', createdAt },
    title: item.title,
    operation: 'DETERMINISTIC',
    x: 140 + (index % 3) * 330,
    y: 160 + Math.floor(index / 3) * 170,
    inputs: [],
    outputs: [{ id: 'out', name: 'value', type: 'any' }],
    body: item.body ?? '',
    value: item.body || item.title
  }));
  return {
    id: `framework-${Date.now()}`,
    name: `${source.name} compressed`,
    frames,
    connections: [],
    goal: source.goal,
    proposals: [{ ...proposal, status: 'accepted' }],
    transformations: [],
    version: 1,
    updatedAt: createdAt
  };
}
