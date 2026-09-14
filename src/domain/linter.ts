import type { FrameworkDocument, LintIssue, RelationshipMeaning } from './types';

const semantic = (framework: FrameworkDocument) => framework.connections.filter(connection => connection.kind === 'semantic' || connection.kind === 'both');
const titleKey = (value: string) => value.trim().toLocaleLowerCase();

function semanticCycle(framework: FrameworkDocument): string[] | null {
  const tracked = new Set<RelationshipMeaning>(['supports', 'depends-on', 'derives-from']);
  const edges = semantic(framework).filter(connection => connection.meaning && tracked.has(connection.meaning));
  const next = new Map<string, string[]>();
  for (const edge of edges) next.set(edge.fromFrame, [...(next.get(edge.fromFrame) ?? []), edge.toFrame]);
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const path: string[] = [];

  const visit = (id: string): string[] | null => {
    if (visiting.has(id)) {
      const at = path.indexOf(id);
      return at >= 0 ? [...path.slice(at), id] : [id];
    }
    if (visited.has(id)) return null;
    visiting.add(id);
    path.push(id);
    for (const target of next.get(id) ?? []) {
      const found = visit(target);
      if (found) return found;
    }
    path.pop();
    visiting.delete(id);
    visited.add(id);
    return null;
  };

  for (const frame of framework.frames) {
    const found = visit(frame.id);
    if (found) return found;
  }
  return null;
}

export function lintFramework(framework: FrameworkDocument): LintIssue[] {
  const issues: LintIssue[] = [];
  const links = framework.connections;
  const semanticLinks = semantic(framework);

  for (const frame of framework.frames) {
    const connected = links.some(connection => connection.fromFrame === frame.id || connection.toFrame === frame.id);
    if (!connected && framework.frames.length > 1) {
      issues.push({ id: `isolated:${frame.id}`, severity: 'info', code: 'ISOLATED_FRAME', message: `${frame.title} is isolated from the Framework.`, frameIds: [frame.id] });
    }

    if (frame.role === 'claim') {
      const supported = semanticLinks.some(connection => connection.toFrame === frame.id && (connection.meaning === 'supports' || connection.meaning === 'evidence-for' || connection.meaning === 'validates'));
      if (!supported) issues.push({ id: `unsupported:${frame.id}`, severity: 'warning', code: 'UNSUPPORTED_CLAIM', message: `${frame.title} is a claim without represented support.`, frameIds: [frame.id] });
    }

    if (frame.role === 'decision' || frame.role === 'result') {
      const hasAlternative = semanticLinks.some(connection => (connection.fromFrame === frame.id || connection.toFrame === frame.id) && connection.meaning === 'alternative-to');
      if (!hasAlternative) issues.push({ id: `alternative:${frame.id}`, severity: 'info', code: 'NO_ALTERNATIVE', message: `${frame.title} has no represented alternative.`, frameIds: [frame.id] });
    }
  }

  const byTitle = new Map<string, string[]>();
  for (const frame of framework.frames) {
    const key = titleKey(frame.title);
    if (!key) continue;
    byTitle.set(key, [...(byTitle.get(key) ?? []), frame.id]);
  }
  for (const [title, ids] of byTitle) {
    if (ids.length > 1) issues.push({ id: `duplicate:${title}`, severity: 'info', code: 'POSSIBLE_DUPLICATE', message: `Multiple Frames use the same title: ${title}.`, frameIds: ids });
  }

  for (const connection of semanticLinks) {
    const from = framework.frames.find(frame => frame.id === connection.fromFrame);
    const to = framework.frames.find(frame => frame.id === connection.toFrame);
    if (!from || !to) continue;
    if (connection.meaning === 'contradicts') {
      issues.push({ id: `contradiction:${connection.id}`, severity: 'warning', code: 'CONTRADICTION', message: `${from.title} contradicts ${to.title}. Keep the conflict unresolved until evidence resolves it.`, frameIds: [from.id, to.id], connectionIds: [connection.id] });
    }
    if (from.role === 'assumption' && to.role === 'result' && (connection.meaning === 'supports' || connection.meaning === 'feeds')) {
      issues.push({ id: `assumption-result:${connection.id}`, severity: 'warning', code: 'ASSUMPTION_AS_RESULT_SUPPORT', message: `An assumption directly supports a result. Add validation or evidence before treating it as established.`, frameIds: [from.id, to.id], connectionIds: [connection.id] });
    }
    if (connection.meaning === 'causes') {
      const hasEvidence = semanticLinks.some(edge => edge.toFrame === from.id && (edge.meaning === 'evidence-for' || edge.meaning === 'supports'));
      if (!hasEvidence) issues.push({ id: `causal:${connection.id}`, severity: 'info', code: 'CAUSAL_SUPPORT_MISSING', message: `${from.title} is represented as a cause without represented supporting evidence.`, frameIds: [from.id, to.id], connectionIds: [connection.id] });
    }
  }

  const cycle = semanticCycle(framework);
  if (cycle) issues.push({ id: `reasoning-cycle:${cycle.join(':')}`, severity: 'warning', code: 'REASONING_CYCLE', message: 'A support or dependency path loops back into itself.', frameIds: [...new Set(cycle)] });

  return issues;
}
