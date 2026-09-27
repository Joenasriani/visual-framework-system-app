import { useState } from 'react';
import type { Frame, FrameworkDocument, FrameworkRun, Proposal } from '../domain/types';

export function displayValue(value: unknown): string {
  if (value === undefined || value === null) return 'None';
  return typeof value === 'string' ? value : JSON.stringify(value, null, 2);
}

export function EmptyCanvas({ onAdd, onExample }: { onAdd: (kind: string) => void; onExample: () => void }) {
  return <section className="empty-canvas" aria-label="Start your map" onPointerDown={event => event.stopPropagation()} onDoubleClick={event => event.stopPropagation()}>
    <span className="guide-eyebrow">ADD → CONNECT → THINK → RUN</span>
    <h1>Start with something on your mind.</h1>
    <p>Put it in an item. Connect it to another. Explore a different way to see it.</p>
    <div className="empty-choices">{['Idea', 'Question', 'Observation', 'Assumption'].map(name => <button key={name} onClick={() => onAdd(name.toLowerCase())}>{name}</button>)}</div>
    <p className="empty-hint">You can also double-click an empty part of the canvas to add an idea.</p>
    <button className="example-action" onClick={onExample}>Try a worked example</button>
    <small>Your maps stay in this browser. Thinking tools send the selected text to AI when you use them.</small>
  </section>;
}

type GuideProps = {
  framework: FrameworkDocument;
  selected: Frame | null;
  pending: Proposal | null;
  run: FrameworkRun | null;
  busy: boolean;
  error: string | null;
  onAdd: () => void;
  onEdit: () => void;
  onConnect: () => void;
  onMeaning: (from: string, to: string) => void;
  onThink: () => void;
  onReview: () => void;
  onRun: () => void;
  onResult: () => void;
  onClearError: () => void;
};

export function FirstUseGuide(props: GuideProps) {
  const { framework, selected, pending, run, busy, error } = props;
  const [skippedMeaning, setSkippedMeaning] = useState<string>('');
  if (!framework.frames.length && !error) return null;
  const flows = framework.connections.filter(connection => connection.kind !== 'semantic');
  const lastFlow = flows.at(-1);
  const meaningKey = `${framework.id}:${lastFlow?.id ?? ''}`;
  const hasMeaning = lastFlow && framework.connections.some(connection => connection.kind === 'semantic' && connection.fromFrame === lastFlow.fromFrame && connection.toFrame === lastFlow.toFrame);
  const isBlank = selected && selected.kind !== 'output' && !String(selected.kind === 'asset' ? selected.value ?? '' : selected.body).trim();
  const decided = (framework.proposals ?? []).some(proposal => proposal.status !== 'pending');
  let phase = 'think';
  let title = 'Try another way to see it.';
  let text = 'Thinking tools suggest additions. Your map changes only when you apply a suggestion.';
  let action = 'Explore another view';
  let onAction = props.onThink;
  if (busy) {
    phase = 'busy'; title = 'Working…'; text = 'The result will open here. You do not need to click Run again.'; action = '';
  } else if (error) {
    phase = 'error'; title = 'That action could not finish.'; text = error; action = 'Dismiss message'; onAction = props.onClearError;
  } else if (pending) {
    phase = 'review'; title = 'Review the suggested change.'; text = 'Nothing has been applied. Read what would be added, then apply it or dismiss it.'; action = 'Review suggestion'; onAction = props.onReview;
  } else if (run?.status === 'error') {
    phase = 'error'; title = 'The run stopped.'; text = 'Your map is still here. Open the result to see which item could not finish and why.'; action = 'See what stopped'; onAction = props.onResult;
  } else if (run?.status === 'ok') {
    phase = 'result'; title = 'Your result is ready.'; text = 'See the input, the method and the result for each item. A finished run does not mean its ideas are proven.'; action = 'See result'; onAction = props.onResult;
  } else if (isBlank) {
    phase = 'write'; title = 'Write something in this item.'; text = 'Give it a short name and add your thought in Content. There is no special format.'; action = 'Edit this item'; onAction = props.onEdit;
  } else if (framework.frames.length === 1) {
    phase = 'add'; title = 'Add a second item.'; text = 'It could be a question, an observation or another idea. Each item holds one part of your map.'; action = 'Add another idea'; onAction = props.onAdd;
  } else if (framework.id.startsWith('example-')) {
    phase = 'run'; title = 'Follow this example from left to right.'; text = 'A question goes into an AI instruction. The next item shows the answer. You can edit the question before running.'; action = 'Run the example'; onAction = props.onRun;
  } else if (!framework.connections.length) {
    phase = 'connect'; title = 'Connect your items.'; text = 'Drag from the dot on the right of one item to the dot on the left of another. Or use Connect items, then tap a left dot. Solid lines pass results.'; action = 'Connect items'; onAction = props.onConnect;
  } else if (lastFlow && !hasMeaning && skippedMeaning !== meaningKey && !decided) {
    phase = 'meaning'; title = 'Add a meaning, when it helps.'; text = 'A labeled link can say “supports” or “conflicts with”. It describes a relationship; it does not change the solid line or the run order.'; action = 'Choose a meaning'; onAction = () => props.onMeaning(lastFlow.fromFrame, lastFlow.toFrame);
  } else if (decided) {
    phase = 'run'; title = 'Run the items, then read what happened.'; text = 'Run follows solid lines. “Use as written” keeps your text; “Ask AI” uses the item’s instruction. Labeled links are descriptions, not proof.'; action = 'Run my map'; onAction = props.onRun;
  }
  return <section className={`first-use-guide guide-${phase}`} data-guide-phase={phase} aria-label="Next step">
    <div className="guide-copy" aria-live="polite" aria-atomic="true"><strong>{title}</strong><p>{text}</p></div>
    <div className="guide-actions">{action && <button onClick={onAction}>{action}</button>}{phase === 'meaning' && <button className="guide-skip" onClick={() => setSkippedMeaning(meaningKey)}>Not needed</button>}</div>
  </section>;
}

/** Render only values actually saved by the run. Current prompts are not passed off as historical prompts. */
export function RunExplanation({ run, framework }: { run: FrameworkRun; framework?: FrameworkDocument }) {
  const titles = new Map(framework?.frames.map(frame => [frame.id, frame.title]) ?? []);
  const successful = run.steps.filter(step => step.status === 'ok');
  const result = successful.filter(step => step.executor === 'MODEL').at(-1) ?? successful.at(-1);
  return <section className="readable-result" aria-label="Run result">
    <h2>{run.status === 'error' ? 'What finished, and what stopped' : run.status === 'running' ? 'Results as they arrive' : 'What came out'}</h2>
    {result && <pre className="result-output">{displayValue(result.output)}</pre>}
    {!result && <p>No item has produced a result in this run.</p>}
    <p className="result-note">A result is not a fact check. AI answers may be wrong. “Use as written” returns saved content or follows the item’s rule.</p>
    <h3>What happened in each item</h3>
    {run.steps.map((step, index) => <details key={`${step.frameId}-${index}`} open={step.status === 'error'}>
      <summary>{index + 1}. {titles.get(step.frameId) ?? step.frameId} — {step.status === 'ok' ? 'Finished' : 'Stopped'}</summary>
      <dl><dt>Input</dt><dd><pre>{displayValue(step.input)}</pre></dd><dt>Method</dt><dd>{step.executor === 'MODEL' ? (step.provenance?.modelProvider ? `Asked AI · ${step.provenance.modelProvider}${step.provenance.modelId ? ` · ${step.provenance.modelId}` : ''}` : 'Asked AI') : 'Used saved text or a rule'}</dd><dt>Result</dt><dd><pre>{displayValue(step.output)}</pre></dd>{step.error && <><dt>Why it stopped</dt><dd>{step.error}</dd></>}</dl>
    </details>)}
    <small>Item names refer to the current map. Inputs and results above are the saved values from this run.</small>
  </section>;
}
