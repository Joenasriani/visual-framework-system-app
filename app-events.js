function clearPortHints() {
  document.querySelectorAll('.port-in').forEach(p => p.classList.remove('can-connect','cannot-connect'));
  stage.classList.remove('connecting');
}

function showPortHints(src, out) {
  document.querySelectorAll('.port-in').forEach(port => {
    const dst = node(port.dataset.node);
    const input = dst?.inputs.find(p => p.id === port.dataset.portId);
    const ok = !!(dst && input && src.id !== dst.id && compatible(out.type,input.type));
    port.classList.add(ok ? 'can-connect' : 'cannot-connect');
  });
  stage.classList.add('connecting');
}

function autoPan(clientX, clientY) {
  const r = stage.getBoundingClientRect();
  const edge = 72;
  const speed = 14;
  let dx = 0, dy = 0;
  if (clientX < r.left + edge) dx = -speed;
  else if (clientX > r.right - edge) dx = speed;
  if (clientY < r.top + edge) dy = -speed;
  else if (clientY > r.bottom - edge) dy = speed;
  if (dx || dy) stage.scrollBy(dx,dy);
}

nodesEl.addEventListener('pointerdown', e => {
  const port = e.target.closest('[data-port]');
  if (port?.dataset.port === 'out') {
    e.stopPropagation();
    const n = node(port.dataset.node);
    const i = Number(port.dataset.portIndex || 0);
    const out = n?.outputs.find(p => p.id === port.dataset.portId);
    if (!n || !out) return;
    const p = portCenter(n, 'out', i);
    state.wire = { nodeId:n.id, portId:port.dataset.portId, x1:p.x, y1:p.y, x2:p.x, y2:p.y };
    showPortHints(n,out);
    setStatus('CONNECT');
    renderEdges();
    return;
  }

  const frame = e.target.closest('[data-frame]');
  if (!frame) return;

  const n = node(frame.dataset.frame);
  state.selected = n.id;
  const rect = frame.getBoundingClientRect();
  state.drag = {
    id:n.id,
    dx:(e.clientX - rect.left) / state.scale,
    dy:(e.clientY - rect.top) / state.scale,
    pointerId:e.pointerId,
    element:frame
  };

  frame.classList.add('dragging');
  frame.setPointerCapture?.(e.pointerId);
  renderInspector();
});

nodesEl.addEventListener('pointermove', e => {
  if (!state.drag || state.drag.pointerId !== e.pointerId) return;

  autoPan(e.clientX,e.clientY);
  const r = stage.getBoundingClientRect();
  const n = node(state.drag.id);
  if (!n) return;

  n.x = Math.max(16, (e.clientX - r.left + stage.scrollLeft) / state.scale - state.drag.dx);
  n.y = Math.max(16, (e.clientY - r.top + stage.scrollTop) / state.scale - state.drag.dy);
  state.drag.element.style.left = `${n.x}px`;
  state.drag.element.style.top = `${n.y}px`;
  renderEdges();
});

nodesEl.addEventListener('pointerup', e => {
  const port = e.target.closest('[data-port]');

  if (port?.dataset.port === 'in' && state.wire) {
    const src = node(state.wire.nodeId);
    const dst = node(port.dataset.node);
    const out = src?.outputs.find(p => p.id === state.wire.portId);
    const input = dst?.inputs.find(p => p.id === port.dataset.portId);

    if (src && dst && src.id !== dst.id && out && input) {
      if (!compatible(out.type, input.type)) {
        setStatus('TYPE MISMATCH');
        setTimeout(() => setStatus('READY'), 1000);
      } else {
        state.edges = state.edges.filter(x => !(x.toNode === dst.id && x.toPort === input.id));
        state.edges.push({ id:'e-' + Date.now(), fromNode:src.id, fromPort:out.id, toNode:dst.id, toPort:input.id });
        state.run = null;
        setStatus('READY');
      }
    }
  }

  if (state.drag?.element) state.drag.element.classList.remove('dragging');
  state.wire = null;
  state.drag = null;
  clearPortHints();
  save();
  render();
});

nodesEl.addEventListener('pointercancel', () => {
  if (state.drag?.element) state.drag.element.classList.remove('dragging');
  state.wire = null;
  state.drag = null;
  clearPortHints();
  setStatus('READY');
  renderEdges();
});

stage.addEventListener('pointerdown', e => {
  if (e.target.closest('[data-frame],[data-port]') || state.wire) return;
  if (e.button !== 0 && e.button !== 1) return;
  state.pan = { pointerId:e.pointerId, x:e.clientX, y:e.clientY, left:stage.scrollLeft, top:stage.scrollTop };
  stage.classList.add('panning');
  stage.setPointerCapture?.(e.pointerId);
});

stage.addEventListener('pointermove', e => {
  if (state.pan && state.pan.pointerId === e.pointerId) {
    stage.scrollLeft = state.pan.left - (e.clientX - state.pan.x);
    stage.scrollTop = state.pan.top - (e.clientY - state.pan.y);
    return;
  }
  if (!state.wire) return;
  autoPan(e.clientX,e.clientY);
  const r = stage.getBoundingClientRect();
  state.wire.x2 = (e.clientX - r.left + stage.scrollLeft) / state.scale;
  state.wire.y2 = (e.clientY - r.top + stage.scrollTop) / state.scale;
  renderEdges();
});

function endStageGesture() {
  if (state.pan) {
    state.pan = null;
    stage.classList.remove('panning');
  }
  if (state.wire) {
    state.wire = null;
    clearPortHints();
    setStatus('READY');
    renderEdges();
  }
}
stage.addEventListener('pointerup', endStageGesture);
stage.addEventListener('pointercancel', endStageGesture);

stage.addEventListener('wheel', e => {
  if (!(e.ctrlKey || e.metaKey)) return;
  e.preventDefault();
  const oldScale = state.scale;
  const next = Math.max(.65,Math.min(1.35,+(oldScale + (e.deltaY < 0 ? .08 : -.08)).toFixed(2)));
  if (next === oldScale) return;
  const r = stage.getBoundingClientRect();
  const sx = e.clientX - r.left;
  const sy = e.clientY - r.top;
  const worldX = (stage.scrollLeft + sx) / oldScale;
  const worldY = (stage.scrollTop + sy) / oldScale;
  state.scale = next;
  renderMeta();
  stage.scrollLeft = worldX * next - sx;
  stage.scrollTop = worldY * next - sy;
},{passive:false});

document.querySelectorAll('[data-add]').forEach(b => b.addEventListener('click', () => addNode(b.dataset.add)));

el('run').onclick = execute;
el('reset').onclick = () => {
  state.nodes = structuredClone(seedNodes);
  state.edges = structuredClone(seedEdges);
  state.selected = 'instruction-1';
  state.run = null;
  state.scale = 1;
  save();
  setStatus('READY');
  showRunStrip();
  render();
};

el('zoom-in').onclick = () => {
  state.scale = Math.min(1.35, +(state.scale + .1).toFixed(2));
  renderMeta();
};

el('zoom-out').onclick = () => {
  state.scale = Math.max(.65, +(state.scale - .1).toFixed(2));
  renderMeta();
};

window.addEventListener('keydown', e => {
  if (e.target.matches('input,textarea,select')) return;
  const kinds = {1:'asset',2:'instruction',3:'expression',4:'check',5:'output'};
  if (kinds[e.key]) addNode(kinds[e.key]);
  if ((e.key === 'Delete' || e.key === 'Backspace') && state.selected) removeSelected();
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'r') { e.preventDefault(); execute(); }
  if (e.key === 'Escape') { state.selected = ''; clearPortHints(); state.wire=null; render(); }
});

window.addEventListener('resize', renderMeta);

const hint = document.createElement('div');
hint.className = 'canvas-hint';
hint.innerHTML = '<span>Drag canvas to move</span><i></i><span>Connect dots</span><i></i><span>Ctrl + scroll to zoom</span>';
stage.appendChild(hint);
setTimeout(() => hint.classList.add('quiet'), 5000);

load();
render();
window.__VF__ = { state, runWorkflow, execute, addNode };