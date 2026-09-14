import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { compatible, runFramework, runSingleFrame } from './domain/engine';
import { FRAME_ORDERS } from './domain/orders';
import { createSeedFramework, FRAME_HEIGHT, FRAME_WIDTH } from './domain/seed';
import type { Frame, FrameKind, FrameworkDocument, FrameworkRun, Port } from './domain/types';
import { loadFramework, saveFramework, saveRun } from './storage/indexeddb';

const KIND_LABELS: Record<FrameKind, string> = {
  asset: 'DATA',
  instruction: 'STEP',
  expression: 'LOGIC',
  check: 'CHECK',
  output: 'RESULT'
};

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const short = (value: unknown, limit = 82) => {
  if (value === undefined) return '—';
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  return text.length > limit ? `${text.slice(0, limit - 1)}…` : text;
};

function portCenter(frame: Frame, side: 'in' | 'out', index = 0) {
  return { x: side === 'out' ? frame.x + FRAME_WIDTH : frame.x, y: frame.y + 54 + index * 22 };
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
  if (kind === 'asset') {
    return { id, kind, title: 'Source', operation: 'DETERMINISTIC', x, y, inputs: [], outputs: [{ id: 'out', name: 'text', type: 'text' }], body: 'Reusable source', value: 'New source' };
  }
  if (kind === 'instruction') {
    return { id, kind, title: 'Step', operation: 'MODEL', x, y, inputs: [{ id: 'in', name: 'input', type: 'text' }], outputs: [{ id: 'out', name: 'text', type: 'text' }], body: 'Transform:' };
  }
  if (kind === 'expression') {
    return { id, kind, title: 'Logic', operation: 'DETERMINISTIC', expressionClass: 'EXECUTABLE', x, y, inputs: [{ id: 'in', name: 'input', type: 'text' }], outputs: [{ id: 'out', name: 'value', type: 'boolean' }], body: 'notEmpty(input)' };
  }
  if (kind === 'check') {
    return { id, kind, title: 'Check', operation: 'DETERMINISTIC', x, y, inputs: [{ id: 'in', name: 'input', type: 'any' }], outputs: [{ id: 'out', name: 'valid', type: 'boolean' }], body: 'Pass if truthy' };
  }
  return { id, kind, title: 'Result', operation: 'DETERMINISTIC', x, y, inputs: [{ id: 'in', name: 'input', type: 'any' }], outputs: [], body: '' };
}

interface DragState {
  frameId: string;
  pointerId: number;
  dx: number;
  dy: number;
  lastX: number;
  lastY: number;
  lastT: number;
  vx: number;
  vy: number;
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

export default function App() {
  const [framework, setFramework] = useState<FrameworkDocument>(() => createSeedFramework());
  const frameworkRef = useRef(framework);
  const [loaded, setLoaded] = useState(false);
  const [selectedFrameId, setSelectedFrameId] = useState<string>('instruction-1');
  const [selectedConnectionId, setSelectedConnectionId] = useState<string | null>(null);
  const [run, setRun] = useState<FrameworkRun | null>(null);
  const [status, setStatus] = useState('READY');
  const [scale, setScale] = useState(1);
  const [wire, setWire] = useState<WireState | null>(null);
  const wireRef = useRef<WireState | null>(null);
  const [newConnectionId, setNewConnectionId] = useState<string | null>(null);
  const [removingConnectionId, setRemovingConnectionId] = useState<string | null>(null);
  const [cableMotion, setCableMotion] = useState<{ frameId: string; x: number; y: number } | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const panRef = useRef<{ pointerId: number; x: number; y: number; left: number; top: number } | null>(null);
  const persistTimer = useRef<number | null>(null);
  const reducedMotion = useMemo(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches, []);

  useEffect(() => {
    loadFramework().then(saved => {
      frameworkRef.current = saved;
      setFramework(saved);
      setSelectedFrameId(saved.frames[0]?.id ?? '');
      setLoaded(true);
    });
  }, []);

  const persist = useCallback((doc = frameworkRef.current, delay = 160) => {
    if (!loaded) return;
    if (persistTimer.current) window.clearTimeout(persistTimer.current);
    persistTimer.current = window.setTimeout(() => saveFramework(doc).catch(() => undefined), delay);
  }, [loaded]);

  const changeFramework = useCallback((updater: (current: FrameworkDocument) => FrameworkDocument, save = true) => {
    setFramework(current => {
      const next = updater(current);
      frameworkRef.current = next;
      if (save) persist(next);
      return next;
    });
  }, [persist]);

  const frameMap = useMemo(() => new Map(framework.frames.map(frame => [frame.id, frame])), [framework.frames]);
  const stepMap = useMemo(() => new Map((run?.steps ?? []).map(step => [step.frameId, step])), [run]);
  const selectedFrame = selectedFrameId ? frameMap.get(selectedFrameId) ?? null : null;
  const worldWidth = Math.max(1500, ...framework.frames.map(frame => frame.x + FRAME_WIDTH + 220));
  const worldHeight = Math.max(860, ...framework.frames.map(frame => frame.y + FRAME_HEIGHT + 260));

  const updateFrame = useCallback((frameId: string, patch: Partial<Frame>, save = true) => {
    changeFramework(current => ({
      ...current,
      updatedAt: new Date().toISOString(),
      frames: current.frames.map(frame => frame.id === frameId ? { ...frame, ...patch } : frame)
    }), save);
    setRun(null);
  }, [changeFramework]);

  const addFrame = useCallback((kind: FrameKind) => {
    const stage = stageRef.current;
    const x = Math.max(32, ((stage?.scrollLeft ?? 0) + (stage?.clientWidth ?? 900) / 2) / scale - FRAME_WIDTH / 2 + Math.random() * 22);
    const y = Math.max(48, ((stage?.scrollTop ?? 0) + (stage?.clientHeight ?? 600) / 2) / scale - FRAME_HEIGHT / 2 + Math.random() * 22);
    const frame = makeFrame(kind, x, y);
    changeFramework(current => ({ ...current, updatedAt: new Date().toISOString(), frames: [...current.frames, frame] }));
    setSelectedConnectionId(null);
    setSelectedFrameId(frame.id);
    setRun(null);
  }, [changeFramework, scale]);

  const deleteSelectedFrame = useCallback(() => {
    if (!selectedFrameId) return;
    changeFramework(current => ({
      ...current,
      updatedAt: new Date().toISOString(),
      frames: current.frames.filter(frame => frame.id !== selectedFrameId),
      connections: current.connections.filter(connection => connection.fromFrame !== selectedFrameId && connection.toFrame !== selectedFrameId)
    }));
    setSelectedFrameId('');
    setRun(null);
  }, [changeFramework, selectedFrameId]);

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
    if ((event.target as HTMLElement).closest('[data-port]')) return;
    event.stopPropagation();
    setSelectedConnectionId(null);
    setSelectedFrameId(frame.id);
    const rect = event.currentTarget.getBoundingClientRect();
    dragRef.current = {
      frameId: frame.id,
      pointerId: event.pointerId,
      dx: (event.clientX - rect.left) / scale,
      dy: (event.clientY - rect.top) / scale,
      lastX: event.clientX,
      lastY: event.clientY,
      lastT: performance.now(),
      vx: 0,
      vy: 0
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }, [scale]);

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
    const now = performance.now();
    const dt = Math.max(8, now - drag.lastT);
    const ivx = (event.clientX - drag.lastX) / (dt * scale);
    const ivy = (event.clientY - drag.lastY) / (dt * scale);
    drag.vx = drag.vx * 0.62 + ivx * 0.38;
    drag.vy = drag.vy * 0.62 + ivy * 0.38;
    drag.lastX = event.clientX;
    drag.lastY = event.clientY;
    drag.lastT = now;
    const x = Math.max(16, (event.clientX - rect.left + stage.scrollLeft) / scale - drag.dx);
    const y = Math.max(16, (event.clientY - rect.top + stage.scrollTop) / scale - drag.dy);
    updateFrame(drag.frameId, { x, y }, false);
  }, [autoPan, scale, updateFrame]);

  const onFramePointerUp = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    dragRef.current = null;
    persist(frameworkRef.current, 0);
    const idleFor = performance.now() - drag.lastT;
    const decay = idleFor > 85 ? 0.25 : 1;
    const vx = drag.vx * decay;
    const vy = drag.vy * decay;
    settleFrame(drag.frameId, vx, vy);
    startCableFollowThrough(drag.frameId, vx, vy);
  }, [persist, settleFrame, startCableFollowThrough]);

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
      if (distance <= 34 && (!best || distance < best.distance)) best = { frameId, portId, distance };
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
        changeFramework(current => ({
          ...current,
          updatedAt: new Date().toISOString(),
          connections: [
            ...current.connections.filter(connection => !(connection.toFrame === target.frameId && connection.toPort === target.portId)),
            { id, fromFrame: active.fromFrame, fromPort: active.fromPort, toFrame: target.frameId, toPort: target.portId }
          ]
        }));
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
    if (reducedMotion) {
      changeFramework(current => ({ ...current, connections: current.connections.filter(connection => connection.id !== id), updatedAt: new Date().toISOString() }));
      setSelectedConnectionId(null);
      setRun(null);
      return;
    }
    setRemovingConnectionId(id);
    window.setTimeout(() => {
      changeFramework(current => ({ ...current, connections: current.connections.filter(connection => connection.id !== id), updatedAt: new Date().toISOString() }));
      setSelectedConnectionId(null);
      setRemovingConnectionId(null);
      setRun(null);
    }, 250);
  }, [changeFramework, reducedMotion, removingConnectionId]);

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
    saveRun(single).catch(() => undefined);
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
    saveRun(final).catch(() => undefined);
  }, []);

  const reset = useCallback(() => {
    const seed = createSeedFramework();
    frameworkRef.current = seed;
    setFramework(seed);
    setSelectedFrameId('instruction-1');
    setSelectedConnectionId(null);
    setRun(null);
    setScale(1);
    setCableMotion(null);
    setStatus('READY');
    saveFramework(seed).catch(() => undefined);
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (target.matches('input,textarea,select')) return;
      const kinds: Record<string, FrameKind> = { '1': 'asset', '2': 'instruction', '3': 'expression', '4': 'check', '5': 'output' };
      if (kinds[event.key]) addFrame(kinds[event.key]);
      if (event.key === 'Delete' || event.key === 'Backspace') {
        if (selectedConnectionId) removeConnection(selectedConnectionId);
        else if (selectedFrameId) deleteSelectedFrame();
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'r') {
        event.preventDefault();
        void executeAll();
      }
      if (event.key === 'Escape') {
        setSelectedFrameId('');
        setSelectedConnectionId(null);
        wireRef.current = null;
        setWire(null);
        setStatus('READY');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [addFrame, deleteSelectedFrame, executeAll, removeConnection, selectedConnectionId, selectedFrameId]);

  const onStagePointerDown = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    if (target.closest('[data-frame],[data-port],[data-connection-hit],[data-remove-connection]') || wireRef.current) return;
    if (event.button !== 0 && event.button !== 1) return;
    const stage = stageRef.current;
    if (!stage) return;
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
    const next = clamp(+(old + (event.deltaY < 0 ? 0.08 : -0.08)).toFixed(2), 0.65, 1.35);
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

  if (!loaded) return <div className="boot">Visual Framework</div>;

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand"><span className="brand-mark">VF</span><span className="brand-name">Visual Framework</span></div>
        <div className="top-actions">
          <span className={`status status-${status.toLowerCase()}`}><i /><b>{status}</b></span>
          <button className="text-btn" onClick={reset}>Reset</button>
          <button className="run-button" onClick={() => void executeAll()} disabled={status === 'RUNNING'}><span>Run</span><kbd>⌘R</kbd></button>
        </div>
      </header>

      <aside className="tool-rail" aria-label="Add to framework">
        <div className="tool-caption">ADD</div>
        {([
          ['asset', '◆', 'Data', '1'],
          ['instruction', '→', 'Step', '2'],
          ['expression', 'ƒ', 'Logic', '3'],
          ['check', '✓', 'Check', '4'],
          ['output', '□', 'Result', '5']
        ] as const).map(([kind, glyph, label, key]) => (
          <button key={kind} className="tool" onClick={() => addFrame(kind)}>
            <span className="tool-glyph">{glyph}</span><span className="tool-label">{label}</span><span className="tool-key">{key}</span>
          </button>
        ))}
      </aside>

      <section className="workspace">
        <div className="workspace-head">
          <div><strong>{framework.name}</strong><span>{framework.frames.length} frames · {framework.connections.length} links</span></div>
          <div className="zoom"><button onClick={() => setScale(value => clamp(+(value - 0.1).toFixed(2), 0.65, 1.35))}>−</button><span>{Math.round(scale * 100)}%</span><button onClick={() => setScale(value => clamp(+(value + 0.1).toFixed(2), 0.65, 1.35))}>+</button></div>
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
          <div className="world" style={{ width: worldWidth, height: worldHeight, transform: `scale(${scale})` }}>
            <svg className="connections" width={worldWidth} height={worldHeight}>
              {framework.connections.map(connection => {
                const source = frameMap.get(connection.fromFrame);
                const target = frameMap.get(connection.toFrame);
                if (!source || !target) return null;
                const sourceIndex = Math.max(0, source.outputs.findIndex(port => port.id === connection.fromPort));
                const targetIndex = Math.max(0, target.inputs.findIndex(port => port.id === connection.toPort));
                const sourceMotion = cableMotion?.frameId === source.id ? cableMotion : undefined;
                const targetMotion = cableMotion?.frameId === target.id ? cableMotion : undefined;
                const geometry = curveGeometry(portCenter(source, 'out', sourceIndex), portCenter(target, 'in', targetIndex), sourceMotion, targetMotion);
                const selected = selectedConnectionId === connection.id;
                const executing = run?.activeFrameId === target.id;
                const classes = ['connection-group', selected ? 'selected' : '', newConnectionId === connection.id ? 'just-connected' : '', removingConnectionId === connection.id ? 'removing' : '', executing ? 'executing' : ''].filter(Boolean).join(' ');
                return (
                  <g key={connection.id} className={classes}>
                    <path className="connection-halo" d={geometry.d} pathLength="1" />
                    <path className="connection-main" d={geometry.d} pathLength="1" />
                    <path
                      className="connection-hit"
                      data-connection-hit={connection.id}
                      d={geometry.d}
                      onPointerDown={(event: React.PointerEvent<SVGPathElement>) => event.stopPropagation()}
                      onClick={(event: React.MouseEvent<SVGPathElement>) => { event.stopPropagation(); setSelectedFrameId(''); setSelectedConnectionId(connection.id); }}
                    />
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
              {framework.frames.map(frame => {
                const step = stepMap.get(frame.id);
                const active = run?.activeFrameId === frame.id;
                const selected = selectedFrameId === frame.id;
                const body = active ? 'Running…' : step?.status === 'ok' ? short(step.output) : step?.status === 'error' ? 'Execution stopped' : frame.kind === 'asset' ? short(frame.value) : frame.body || '—';
                const meta = active ? 'RUNNING' : step ? `${step.durationMs}ms` : frame.outputs[0]?.type ?? 'result';
                return (
                  <div
                    key={frame.id}
                    data-frame={frame.id}
                    className={`frame frame-${frame.kind}${selected ? ' selected' : ''}${active ? ' run-active' : step ? ` run-${step.status}` : ''}${dragRef.current?.frameId === frame.id ? ' dragging' : ''}`}
                    style={{ left: frame.x, top: frame.y, width: FRAME_WIDTH, height: FRAME_HEIGHT }}
                    onPointerDown={(event: React.PointerEvent<HTMLDivElement>) => onFramePointerDown(event, frame)}
                    onPointerMove={onFramePointerMove}
                    onPointerUp={onFramePointerUp}
                    onPointerCancel={onFramePointerUp}
                  >
                    <div className="frame-index">{KIND_LABELS[frame.kind]}</div>
                    <div className="frame-title">{frame.title}</div>
                    <div className="frame-body">{body}</div>
                    <div className="frame-meta"><span>{frame.operation === 'MODEL' ? 'ONLINE' : 'LOCAL'}</span><span>{meta}</span></div>
                    {frame.inputs.map((port, index) => {
                      const sourceFrame = wire ? frameMap.get(wire.fromFrame) : null;
                      const valid = !!(wire && sourceFrame && sourceFrame.id !== frame.id && compatible(wire.outputType, port.type));
                      return (
                        <button
                          key={port.id}
                          data-port="in"
                          data-frame-id={frame.id}
                          data-port-id={port.id}
                          className={`port port-in${wire ? valid ? ' can-connect' : ' cannot-connect' : ''}`}
                          style={{ top: 54 + index * 22 }}
                          title={`${port.name}: ${port.type}`}
                          aria-label={`Input ${port.name}`}
                        />
                      );
                    })}
                    {frame.outputs.map((port, index) => (
                      <button
                        key={port.id}
                        data-port="out"
                        data-frame-id={frame.id}
                        data-port-id={port.id}
                        className="port port-out"
                        style={{ top: 54 + index * 22 }}
                        title={`${port.name}: ${port.type}`}
                        aria-label={`Output ${port.name}`}
                        onPointerDown={(event: React.PointerEvent<HTMLButtonElement>) => startWire(event, frame, port, index)}
                      />
                    ))}
                  </div>
                );
              })}
            </div>
            <div className="canvas-hint"><span>Drag space to move</span><i /><span>Connect ports</span><i /><span>Ctrl + scroll to zoom</span></div>
          </div>
        </div>
      </section>

      <aside className="inspector">
        {!selectedFrame ? (
          <div className="empty-inspector"><span>DETAILS</span><p>{selectedConnectionId ? 'Connection selected.' : 'Select a Frame.'}</p></div>
        ) : (
          <FrameInspector
            frame={selectedFrame}
            step={stepMap.get(selectedFrame.id)}
            onClose={() => setSelectedFrameId('')}
            onChange={patch => updateFrame(selectedFrame.id, patch)}
            onDelete={deleteSelectedFrame}
            onRun={() => void executeSelected()}
          />
        )}
      </aside>

      {run && <div className={`run-strip${run.status === 'error' ? ' run-strip-error' : ''}`}><span>{run.status === 'running' ? 'RUNNING' : run.status === 'ok' ? 'DONE' : 'STOPPED'}</span><strong>{run.steps.filter(step => step.status === 'ok').length}/{framework.frames.length}</strong><button onClick={() => setRun(null)}>×</button></div>}
    </main>
  );
}

function FrameInspector({
  frame,
  step,
  onClose,
  onChange,
  onDelete,
  onRun
}: {
  frame: Frame;
  step?: FrameworkRun['steps'][number];
  onClose: () => void;
  onChange: (patch: Partial<Frame>) => void;
  onDelete: () => void;
  onRun: () => void;
}) {
  const bodyLabel = { asset: 'Data', instruction: 'Order', expression: 'Logic', check: 'Check', output: 'Content' }[frame.kind];
  return (
    <>
      <div className="inspector-head"><div><span>DETAILS</span><strong>{KIND_LABELS[frame.kind]}</strong></div><button className="close-inspector" onClick={onClose}>×</button></div>
      <label className="field"><span>Name</span><input value={frame.title} onChange={(event: React.ChangeEvent<HTMLInputElement>) => onChange({ title: event.target.value })} /></label>
      {frame.kind === 'instruction' && (
        <div className="order-block"><span>Orders</span><div className="order-list">
          {FRAME_ORDERS.map(order => <button key={order.id} className={frame.orderPreset === order.id ? 'active' : ''} onClick={() => onChange({ title: order.title, body: order.prompt, operation: 'MODEL', orderPreset: order.id })}>{order.title}</button>)}
        </div></div>
      )}
      {frame.kind !== 'output' && (
        <label className="field"><span>{bodyLabel}</span><textarea value={String(frame.kind === 'asset' ? frame.value ?? '' : frame.body)} onChange={(event: React.ChangeEvent<HTMLTextAreaElement>) => frame.kind === 'asset' ? onChange({ value: event.target.value }) : onChange({ body: event.target.value, orderPreset: '' })} /></label>
      )}
      {(frame.kind === 'instruction' || frame.kind === 'expression') && (
        <div className="seg-field"><span>Mode</span><div className="seg"><button className={frame.operation === 'DETERMINISTIC' ? 'active' : ''} onClick={() => onChange({ operation: 'DETERMINISTIC' })}>Local</button><button className={frame.operation === 'MODEL' ? 'active' : ''} onClick={() => onChange({ operation: 'MODEL' })}>Online</button></div></div>
      )}
      {frame.kind === 'expression' && (
        <div className="seg-field"><span>Behavior</span><div className="seg"><button className={frame.expressionClass === 'EXECUTABLE' ? 'active' : ''} onClick={() => onChange({ expressionClass: 'EXECUTABLE' })}>Run</button><button className={frame.expressionClass === 'DESCRIPTIVE' ? 'active' : ''} onClick={() => onChange({ expressionClass: 'DESCRIPTIVE' })}>Note</button></div></div>
      )}
      <div className="io-block"><span>Connections</span>{[...frame.inputs.map(port => `IN  ${port.name}:${port.type}`), ...frame.outputs.map(port => `OUT ${port.name}:${port.type}`)].map(text => <code key={text}>{text}</code>)}</div>
      <div className="trace-block"><span>Last run</span>{step ? <><b className={`trace-state trace-${step.status}`}>{step.status === 'ok' ? 'DONE' : 'ERROR'}</b><dl><dt>Input</dt><dd>{short(step.input, 180)}</dd><dt>Output</dt><dd>{short(step.output, 180)}</dd>{step.error && <><dt>Error</dt><dd>{step.error}</dd></>}</dl></> : <em>Not run</em>}</div>
      <button className="inspector-run" onClick={onRun}>Run Frame</button>
      <button className="delete-btn" onClick={onDelete}>Delete</button>
    </>
  );
}
