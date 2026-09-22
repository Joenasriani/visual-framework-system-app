import type {
  CompositeOperationRecord,
  CompositeOperationType,
  CompositeScope,
  FragmentKind,
  FragmentState,
  Frame,
  FrameworkDocument,
  InstructionFragment
} from './types';

const now = () => new Date().toISOString();

export function fragmentsFromText(text: string, kind: FragmentKind = 'instruction'): InstructionFragment[] {
  const parts = text
    .split(/\n+/)
    .map(part => part.trim())
    .filter(Boolean);
  const safe = parts.length ? parts : [text.trim()].filter(Boolean);
  return safe.map((part, index) => ({
    id: `fragment-${index}-${stableToken(part)}`,
    text: part,
    kind,
    state: 'active'
  }));
}

function stableToken(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index++) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

export function frameFragments(frame: Frame): InstructionFragment[] {
  if (frame.instructionFragments?.length) return frame.instructionFragments;
  return fragmentsFromText(frame.body || String(frame.value ?? ''), frame.role === 'assumption' ? 'assumption' : frame.role === 'claim' ? 'claim' : 'instruction');
}

export function effectiveFrameBody(frame: Frame): string {
  const fragments = frameFragments(frame);
  if (!fragments.length) return frame.body;
  return fragments
    .filter(fragment => (fragment.state ?? 'active') !== 'masked' && (fragment.state ?? 'active') !== 'subtracted')
    .map(fragment => (fragment.state ?? 'active') === 'replaced' ? fragment.replacement ?? fragment.text : fragment.text)
    .filter(Boolean)
    .join('\n');
}

function updateFragments(
  frame: Frame,
  operation: Extract<CompositeOperationType, 'mask' | 'subtract' | 'replace'>,
  fragmentId?: string,
  replacement?: string
): Frame {
  const fragments = frameFragments(frame);
  const nextState: FragmentState = operation === 'mask' ? 'masked' : operation === 'subtract' ? 'subtracted' : 'replaced';
  const next = fragments.map(fragment => {
    if (fragmentId && fragment.id !== fragmentId) return fragment;
    return {
      ...fragment,
      state: nextState,
      replacement: operation === 'replace' ? replacement ?? fragment.replacement ?? fragment.text : fragment.replacement
    };
  });
  return { ...frame, instructionFragments: next };
}

export function syncFrameFragments(frame: Frame, text: string): Frame {
  return { ...frame, body: text, instructionFragments: fragmentsFromText(text, frame.role === 'assumption' ? 'assumption' : frame.role === 'claim' ? 'claim' : 'instruction') };
}

export function setFragmentState(frame: Frame, fragmentId: string, state: FragmentState, replacement?: string): Frame {
  const next = frameFragments(frame).map(fragment => fragment.id === fragmentId ? { ...fragment, state, replacement: state === 'replaced' ? replacement ?? fragment.replacement ?? fragment.text : fragment.replacement } : fragment);
  return { ...frame, instructionFragments: next };
}

export function restoreFrameComposition(frame: Frame): Frame {
  return {
    ...frame,
    controlState: 'active',
    instructionFragments: frameFragments(frame).map(fragment => ({ ...fragment, state: 'active', replacement: undefined }))
  };
}

export function applyCompositeOperation(
  framework: FrameworkDocument,
  targetFrameIds: string[],
  type: CompositeOperationType,
  scope: CompositeScope,
  options?: { fragmentId?: string; replacement?: string }
): FrameworkDocument {
  const ids = new Set(targetFrameIds);
  const createdAt = now();
  const provenance = { origin: 'user' as const, createdAt };
  const frames = framework.frames.map(frame => {
    if (!ids.has(frame.id)) return frame;
    if (type === 'disable') return { ...frame, controlState: 'disabled' as const };
    if (type === 'bypass') return { ...frame, controlState: 'bypass' as const };
    return updateFragments(frame, type, options?.fragmentId, options?.replacement);
  });
  const record: CompositeOperationRecord = {
    id: `composite-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
    type,
    targetFrameIds: [...ids],
    fragmentId: options?.fragmentId,
    scope,
    replacement: options?.replacement,
    appliedAt: createdAt,
    provenance
  };
  return {
    ...framework,
    frames,
    compositeOperations: [...(framework.compositeOperations ?? []), record],
    version: (framework.version ?? 1) + 1,
    updatedAt: createdAt
  };
}

export function restoreComposition(framework: FrameworkDocument, targetFrameIds: string[]): FrameworkDocument {
  const ids = new Set(targetFrameIds);
  return {
    ...framework,
    frames: framework.frames.map(frame => ids.has(frame.id) ? restoreFrameComposition(frame) : frame),
    version: (framework.version ?? 1) + 1,
    updatedAt: now()
  };
}
