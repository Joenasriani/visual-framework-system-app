// One-time integration on the review branch only. Each edit requires its exact source anchor.
// The review workflow removes this file after applying it; it never runs on main.
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const read = path => readFileSync(path, 'utf8');
const write = (path, value) => writeFileSync(path, value);
let app = read('src/App.tsx');
const blob = createHash('sha1').update(`blob ${Buffer.byteLength(app)}\0`).update(app).digest('hex');
if (blob !== '448ead38dd45827e07a14f25409e4a867f0c2fc1') throw new Error('App source changed; review the patch instead of overwriting it.');
function edit(before, after) {
  if (app.split(before).length !== 2) throw new Error(`Expected exactly one App anchor: ${before.slice(0, 130)}`);
  app = app.replace(before, after);
}
edit("import { compatible,", "import { EmptyCanvas, FirstUseGuide, RunExplanation } from './ui/FirstUse';\nimport { createEmptyFramework, createEverydayExample, nextItemPosition } from './domain/starter';\nimport { compatible,");
edit("  const [status, setStatus] = useState('READY');", "  const [status, setStatus] = useState('READY');\n  const [showTools, setShowTools] = useState(false);\n  const [actionError, setActionError] = useState<string | null>(null);\n  const busyRef = useRef(false);");
edit("    const x = Math.max(32, ((stage?.scrollLeft ?? 0) + (stage?.clientWidth ?? 900) / 2) / scale - FRAME_WIDTH / 2 + Math.random() * 22);\n    const y = Math.max(48, ((stage?.scrollTop ?? 0) + (stage?.clientHeight ?? 600) / 2) / scale - FRAME_HEIGHT / 2 + Math.random() * 22);", "    const { x, y } = nextItemPosition(frameworkRef.current, (stage?.scrollLeft ?? 0) / scale + 56, (stage?.scrollTop ?? 0) / scale + 80);");
edit("      value: preset.kind === 'asset' ? (ELEMENT_EXPLANATIONS[preset.id] ?? preset.label) : base.value,", "      value: preset.kind === 'asset' ? '' : base.value,");
edit("    setSelectedFrameIds([frame.id]);\n    setSideMode('frame');\n    setPanelOpen(false);", "    setSelectedFrameIds([frame.id]);\n    setSideMode('frame');\n    setPanelOpen(true);\n    requestAnimationFrame(() => document.querySelector<HTMLTextAreaElement>('.inspector textarea')?.focus());");
edit("    return { kind: 'frame', frameIds: selectedFrameId ? [selectedFrameId] : frameworkRef.current.frames.slice(0, 1).map(frame => frame.id) };", "    if (selectedFrameId) return { kind: 'frame', frameIds: [selectedFrameId] };\n    return { kind: 'framework', frameIds: frameworkRef.current.frames.map(frame => frame.id) };");
edit("  const runStructuralOperation = useCallback(async (operation: StructuralOperation) => {\n    setStatus('THINKING');", "  const runStructuralOperation = useCallback(async (operation: StructuralOperation) => {\n    if (busyRef.current || !frameworkRef.current.frames.length) return;\n    busyRef.current = true;\n    setActionError(null);\n    setStatus('THINKING');");
edit("      setSideMode('proposal');\n      setStatus('PROPOSAL');\n    } catch (error) {\n      setStatus('STOPPED');\n      console.error(error);\n    }", "      setSideMode('proposal');\n      setPanelOpen(true);\n      setStatus('PROPOSAL');\n    } catch (error) {\n      setStatus('STOPPED');\n      setActionError(navigator.onLine ? 'AI could not return a suggestion. Try the tool again. Your map has not been changed.' : 'You are offline. Keep editing your map; thinking tools need an internet connection.');\n      console.error(error);\n    } finally {\n      busyRef.current = false;\n    }");
edit("    changeFramework(current => applyProposal(current, activeProposal), { label: `Accept ${activeProposal.operation}` });\n    setSideMode('frame');", "    changeFramework(current => applyProposal(current, activeProposal), { label: `Accept ${activeProposal.operation}` });\n    setRun(null);\n    setPanelOpen(false);\n    setSideMode('frame');");
edit("    changeFramework(current => rejectProposal(current, activeProposal), { record: false });\n    setSideMode('frame');", "    changeFramework(current => rejectProposal(current, activeProposal), { record: false });\n    setPanelOpen(false);\n    setSideMode('frame');");
const execStart = app.indexOf('  const executeSelected = useCallback(async () => {');
const execEnd = app.indexOf('  const switchFramework = useCallback', execStart);
if (execStart < 0 || execEnd < 0) throw new Error('Run block missing');
app = app.slice(0, execStart) + `  const executeSelected = useCallback(async () => {
    if (!selectedFrameId || busyRef.current) return;
    busyRef.current = true;
    setActionError(null);
    setStatus('RUNNING');
    try {
      const single = await runSingleFrame(frameworkRef.current, selectedFrameId, run);
      const merged = mergeSingleRun(run, single);
      setRun(merged);
      setStatus(single.status === 'ok' ? 'PASSED' : 'STOPPED');
      setSideMode('runs');
      setPanelOpen(true);
      await saveRun(single).catch(() => undefined);
      setRuns(await listRuns(frameworkRef.current.id).catch(() => []));
    } catch {
      setStatus('STOPPED');
      setActionError('This item could not finish. Check its content and connections, then try again.');
    } finally { busyRef.current = false; }
  }, [mergeSingleRun, run, selectedFrameId]);

  const executeAll = useCallback(async () => {
    if (busyRef.current || !frameworkRef.current.frames.length) return;
    busyRef.current = true;
    setActionError(null);
    setStatus('RUNNING');
    const running: FrameworkRun = {
      id: \`run-\${Date.now()}\`, frameworkId: frameworkRef.current.id, status: 'running', startedAt: new Date().toISOString(), activeFrameId: null, steps: []
    };
    setRun(running);
    try {
      const final = await runFramework(frameworkRef.current, event => setRun(event.run));
      setRun(final);
      setStatus(final.status === 'ok' ? 'PASSED' : 'STOPPED');
      setSideMode('runs');
      setPanelOpen(true);
      await saveRun(final).catch(() => undefined);
      setRuns(await listRuns(frameworkRef.current.id).catch(() => []));
    } catch {
      setStatus('STOPPED');
      setActionError('The run could not finish. Your map is still here. Check the connections and try again.');
    } finally { busyRef.current = false; }
  }, []);

` + app.slice(execEnd);
// Save the current map before opening any new map or worked example.
edit("  const reset = useCallback(() => {", `  const createWorkspace = useCallback(async (example: boolean) => {
    if (busyRef.current) return;
    try {
      if (persistTimer.current) window.clearTimeout(persistTimer.current);
      await saveFramework(frameworkRef.current);
      const next = example ? createEverydayExample() : createEmptyFramework(\`map-\${crypto.randomUUID()}\`);
      await saveFramework(next);
      await setActiveFrameworkId(next.id);
      frameworkRef.current = next;
      setFramework(next);
      setSelectedFrameIds([]);
      setSelectedConnectionId(null);
      setSelectedLayerId(null);
      setRun(null);
      setActionError(null);
      setPanelOpen(false);
      setScale(1);
      setStatus('READY');
      pastRef.current = [];
      futureRef.current = [];
      setHistoryTick(value => value + 1);
      await refreshLists(next.id);
    } catch {
      setActionError('This browser could not save the map. Keep this tab open; no new map was opened.');
    }
  }, [refreshLists]);

  const beginGuidedConnection = useCallback(() => {
    const source = (selectedFrame?.outputs.length ? selectedFrame : null) ?? frameworkRef.current.frames.find(frame => frame.outputs.length);
    if (!source) return;
    const port = source.outputs[0];
    const point = portCenter(source, 'out', 0);
    setSelectedFrameIds([source.id]);
    setTapConnect({ fromFrame: source.id, fromPort: port.id, outputType: port.type, x1: point.x, y1: point.y, x2: point.x, y2: point.y, sourceDirection: 'out', previewState: 'neutral' });
    setPanelOpen(false);
    setStatus('CHOOSE INPUT');
  }, [selectedFrame]);

  const reset = useCallback(() => {`);
// The legacy regression example is retained under More tools, with an archived copy before replacement.
edit("    const seed = createSeedFramework();\n    recordHistory", "    const seed = createSeedFramework();\n    void saveFramework({ ...frameworkRef.current, id: `saved-${crypto.randomUUID()}`, name: `${frameworkRef.current.name} (saved)` });\n    recordHistory");
edit("  const connectionCount = framework.connections.length;", `  useEffect(() => {
    if (!loaded || !framework.id.startsWith('example-')) return;
    const frame = requestAnimationFrame(() => fitView());
    return () => cancelAnimationFrame(frame);
  }, [framework.id, loaded, fitView]);

  const connectionCount = framework.connections.length;`);
edit('    <main className="app-shell">', '    <main className={`app-shell${panelOpen ? \' has-inspector\' : \'\'}${!framework.frames.length ? \' is-empty\' : \'\'}`} data-tools={showTools ? \'all\' : \'basic\'}>');
edit('<i /><b>{status}</b></span>', '<i /><b>{status === \'PASSED\' ? \'FINISHED\' : status}</b></span>');
edit('          <button className="text-btn secondary-top-action" onClick={reset}>Reset</button>', `          <button className="text-btn secondary-top-action advanced-control" onClick={reset} title="Open the original example; preserve a separate copy of the current map">Reset</button>
          <button className="text-btn" onClick={() => void createWorkspace(false)} disabled={status === 'RUNNING' || status === 'THINKING'}>New map</button>
          <button className="text-btn" onClick={() => void createWorkspace(true)} disabled={status === 'RUNNING' || status === 'THINKING'}>Example</button>
          <button className="text-btn" aria-expanded={showTools} onClick={() => setShowTools(value => !value)}>{showTools ? 'Fewer tools' : 'More tools'}</button>`);
app = app.replace('className="text-btn secondary-top-action" onClick={() => openPanel(\'issues\')}', 'className="text-btn secondary-top-action advanced-control" onClick={() => openPanel(\'issues\')}');
app = app.replace('className="text-btn secondary-top-action" onClick={() => openPanel(\'runs\')}', 'className="text-btn secondary-top-action advanced-control" onClick={() => openPanel(\'runs\')}');
edit('className="run-button" onClick={() => void executeAll()} disabled={status === \'RUNNING\' || status === \'THINKING\'}', 'className="run-button" onClick={() => void executeAll()} disabled={!framework.frames.length || status === \'RUNNING\' || status === \'THINKING\'}');
edit('        <div className="structure-bar">', `        <FirstUseGuide framework={framework} selected={selectedFrame} pending={activeProposal} run={run} busy={status === 'RUNNING' || status === 'THINKING'} error={actionError}
          onAdd={() => addElementPreset('idea')} onEdit={() => openPanel('frame')} onConnect={beginGuidedConnection}
          onMeaning={(from, to) => { setSelectedFrameIds([from, to]); openPanel('relationships'); }}
          onThink={() => void runStructuralOperation('reframe')} onReview={() => openPanel('proposal')} onRun={() => void executeAll()} onResult={() => openPanel('runs')} onClearError={() => setActionError(null)} />
        <div className="structure-bar">
          <span className="scope-summary">Thinking about: <b>{scopeMode === 'framework' || !selectedFrame ? 'all items' : scopeMode === 'selection' ? \`\${selectedFrameIds.length} selected items\` : scopeMode === 'branch' ? \`the path from \${selectedFrame.title}\` : selectedFrame.title}</b></span>`);
edit('className="scope-control"', 'className="scope-control advanced-control"');
edit('className="goal-control"', 'className="goal-control advanced-control"');
edit('<button key={operation} onClick={() => void runStructuralOperation(operation)} disabled={status === \'THINKING\' || status === \'RUNNING\'}>', '<button key={operation} className={[\'expand\',\'reframe\',\'alternatives\'].includes(operation) ? \'\' : \'advanced-control\'} title="AI suggests a change for you to review before applying" onClick={() => void runStructuralOperation(operation)} disabled={!framework.frames.length || status === \'THINKING\' || status === \'RUNNING\'}>');
app = app.replaceAll('className="quiet-action layer-action"', 'className="quiet-action layer-action advanced-control"');
edit('          onWheel={onWheel}\n        >', `          onWheel={onWheel}
          onDoubleClick={event => { if (!(event.target as HTMLElement).closest('[data-frame],[data-layer],button,input,select,textarea,.empty-canvas')) addElementPreset('idea'); }}
        >
          {!framework.frames.length && <EmptyCanvas onAdd={addElementPreset} onExample={() => void createWorkspace(true)} />}`);
edit('data-frame={frame.id}', `data-frame={frame.id}
                    tabIndex={0} role="group" aria-label={frame.title}
                    onDoubleClick={event => { if (!(event.target as HTMLElement).closest('button')) { event.stopPropagation(); setSelectedFrameIds([frame.id]); openPanel('frame'); } }}
                    onKeyDown={event => { if (event.target === event.currentTarget && event.key === 'Enter') { event.preventDefault(); setSelectedFrameIds([frame.id]); openPanel('frame'); } }}`);
edit('title="Flow into this item"', 'title="Receive a result into this item" aria-label={`Receive into ${frame.title}`}');
edit('title="Start a flow from this item"', 'title="Send a result from this item" aria-label={`Send from ${frame.title}`}');
edit('<RunsInspector runs={runs} activeRun={run}', '<RunsInspector framework={framework} runs={runs} activeRun={run}');
edit('function RunsInspector({ runs, activeRun, onSelect, onClose }: { runs: FrameworkRun[];', 'function RunsInspector({ framework, runs, activeRun, onSelect, onClose }: { framework: FrameworkDocument; runs: FrameworkRun[];');
edit('    {activeRun && <div className="run-detail"><span>Selected run</span>{activeRun.steps.map(step => <article key={step.frameId}><b>{step.frameId}</b><small>{step.status.toUpperCase()} · {step.durationMs}ms</small><p>{short(step.output ?? step.error, 220)}</p></article>)}</div>}', '    {activeRun && <RunExplanation run={activeRun} framework={framework} />}');
edit('    <p className="proposal-summary">{proposal.summary}</p>', '    <p className="proposal-notice">Not applied yet. These are AI suggestions, not verified evidence. Applying adds the items below; dismissing leaves your map unchanged.</p>\n    <p className="proposal-summary">{proposal.summary}</p>');
edit('    <div className="hierarchy-block"><span>Structure</span>', '    <details className="item-details"><summary>Structure and sources</summary>\n    <div className="hierarchy-block"><span>Structure</span>');
edit('    <div className="trace-block"><span>Last run</span>', '    </details>\n    <div className="trace-block"><span>Last run</span>');
app = app.replaceAll('className="close-inspector" onClick=', 'className="close-inspector" aria-label="Close editor" onClick=');
write('src/App.tsx', app);
let storage = read('src/storage/indexeddb.ts');
storage = storage.replace("import { createSeedFramework } from '../domain/seed';", "import { createEmptyFramework } from '../domain/starter';");
storage = storage.replace('const seed = createSeedFramework();', 'const seed = createEmptyFramework();');
write('src/storage/indexeddb.ts', storage);
let entry = read('src/main.tsx');
if (!entry.includes("import './styles.css';")) throw new Error('Missing CSS entry');
write('src/main.tsx', entry.replace("import './styles.css';", "import './styles.css';\nimport './ui/workstation.css';"));
// Update legacy tests only for deliberate disclosure and run-status wording, not to weaken assertions.
for (const path of ['e2e/beginner.mjs', 'e2e/complete.mjs', 'e2e/live.mjs', 'e2e/offline.mjs']) {
  let test = read(path).replaceAll("'PASSED'", "'FINISHED'");
  const anchor = "  await page.getByText('Visual Framework', { exact: true }).first().waitFor();";
  if (!test.includes(anchor)) throw new Error(`Test startup anchor absent: ${path}`);
  test = test.replace(anchor, anchor + "\n  await page.getByRole('button', { name: 'More tools', exact: true }).click();" + (path.endsWith('offline.mjs') ? "\n  await page.getByRole('button', { name: 'Reset', exact: true }).click();" : ''));
  if (path.endsWith('complete.mjs')) {
    test = test.replace("  await page.getByRole('button', { name: 'Group selection inside active item' }).click();", "  await page.getByRole('button', { name: 'Edit', exact: true }).click();\n  await page.getByText('Structure and sources', { exact: true }).click();\n  await page.getByRole('button', { name: 'Group selection inside active item' }).click();");
  }
  write(path, test);
}
console.log('Human-first integration applied. Run typecheck, browser regression and human acceptance separately.');
