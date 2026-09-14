const mobileView = () => window.matchMedia('(max-width: 680px)').matches;

nodesEl.addEventListener('pointerdown', e => {
  const frame = e.target.closest('[data-frame]');

  // Mobile is an ordered workflow, not a draggable canvas.
  if (mobileView()) {
    if (!frame) return;
    state.selected = frame.dataset.frame;
    state.drag = null;
    state.wire = null;
    renderNodes();
    renderInspector();
    return;
  }

  const port = e.target.closest('[data-port]');
  if (port?.dataset.port === 'out') {
    e.stopPropagation();
    const n = node(port.dataset.node);
    const i = Number(port.dataset.portIndex || 0);
    const p = portCenter(n, 'out', i);
    state.wire = { nodeId:n.id, portId:port.dataset.portId, x1:p.x, y1:p.y, x2:p.x, y2:p.y };
    renderEdges();
    return;
  }

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
  if (mobileView() || !state.drag || state.drag.pointerId !== e.pointerId) return;
  const r = stage.getBoundingClientRect();
  const n = node(state.drag.id);
  if (!n) return;

  n.x = Math.max(16, (e.clientX - r.left + stage.scrollLeft) / state.scale - state.drag.dx);
  n.y = Math.max(16, (e.clientY - r.top + stage.scrollTop) / state.scale - state.drag.dy);

  // Move only the active element. Rebuilding the node DOM on every pointer event caused jitter.
  state.drag.element.style.left = `${n.x}px`;
  state.drag.element.style.top = `${n.y}px`;
  renderEdges();
});

nodesEl.addEventListener('pointerup', e => {
  if (mobileView()) return;

  const port = e.target.closest('[data-port]');
  if (port?.dataset.port === 'in' && state.wire) {
    const src = node(state.wire.nodeId);
    const dst = node(port.dataset.node);
    const out = src?.outputs.find(p => p.id === state.wire.portId);
    const input = dst?.inputs.find(p => p.id === port.dataset.portId);

    if (src && dst && src.id !== dst.id && out && input) {
      if (!compatible(out.type, input.type)) {
        setStatus('TYPE MISMATCH');
        setTimeout(() => setStatus('READY'), 1200);
      } else {
        state.edges = state.edges.filter(x => !(x.toNode === dst.id && x.toPort === input.id));
        state.edges.push({ id:'e-' + Date.now(), fromNode:src.id, fromPort:out.id, toNode:dst.id, toPort:input.id });
        state.run = null;
      }
    }
  }

  if (state.drag?.element) state.drag.element.classList.remove('dragging');
  state.wire = null;
  state.drag = null;
  save();
  render();
});

stage.addEventListener('pointermove', e => {
  if (mobileView() || !state.wire) return;
  const r = stage.getBoundingClientRect();
  state.wire.x2 = (e.clientX - r.left + stage.scrollLeft) / state.scale;
  state.wire.y2 = (e.clientY - r.top + stage.scrollTop) / state.scale;
  renderEdges();
});

stage.addEventListener('pointerup', () => {
  if (state.wire) {
    state.wire = null;
    renderEdges();
  }
});

document.querySelectorAll('[data-add]').forEach(b => b.addEventListener('click', () => {
  addNode(b.dataset.add);
  if (mobileView()) {
    requestAnimationFrame(() => {
      document.querySelector(`[data-frame="${state.selected}"]`)?.scrollIntoView({ behavior:'smooth', block:'center' });
    });
  }
}));

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
  if (mobileView()) return;
  state.scale = Math.min(1.35, +(state.scale + .1).toFixed(2));
  renderMeta();
};
el('zoom-out').onclick = () => {
  if (mobileView()) return;
  state.scale = Math.max(.65, +(state.scale - .1).toFixed(2));
  renderMeta();
};

window.addEventListener('keydown', e => {
  if (e.target.matches('input,textarea,select')) return;
  const kinds = {1:'asset',2:'instruction',3:'expression',4:'check',5:'output'};
  if (kinds[e.key]) addNode(kinds[e.key]);
  if ((e.key === 'Delete' || e.key === 'Backspace') && state.selected) removeSelected();
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'r') { e.preventDefault(); execute(); }
  if (e.key === 'Escape') { state.selected = ''; render(); }
});

window.addEventListener('resize', () => {
  if (mobileView() && state.scale !== 1) state.scale = 1;
  renderMeta();
});

load();
if (mobileView()) state.scale = 1;
render();
window.__VF__ = { state, runWorkflow, execute, addNode };
