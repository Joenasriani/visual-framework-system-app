const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function clearPortHints() {
  document.querySelectorAll('.port-in').forEach(port => {
    port.classList.remove('can-connect','cannot-connect');
    port.style.transform='';
    port.style.boxShadow='';
    port.style.opacity='';
  });
  stage.classList.remove('connecting');
}

function showPortHints(src, out) {
  document.querySelectorAll('.port-in').forEach(port => {
    const dst = node(port.dataset.node);
    const input = dst?.inputs.find(p => p.id === port.dataset.portId);
    const ok = !!(dst && input && src.id !== dst.id && compatible(out.type,input.type));
    port.classList.add(ok ? 'can-connect' : 'cannot-connect');
    if (ok) {
      port.style.transform='translateY(-50%) scale(1.28)';
      port.style.boxShadow='0 0 0 5px rgba(91,103,232,.10),0 2px 7px rgba(45,48,62,.12)';
      port.style.opacity='1';
    } else {
      port.style.opacity='.34';
    }
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

function animateFrameSettle(nodeId, vx=0, vy=0) {
  if (reducedMotion) return;
  const frame=document.querySelector(`[data-frame="${nodeId}"]`);
  if (!frame?.animate) return;
  const speed=Math.min(1,Math.hypot(vx,vy)*1.8);
  const lift=1.006+speed*.008;
  frame.animate([
    {transform:'scale(1)',offset:0},
    {transform:`scale(${lift})`,offset:.36},
    {transform:'scale(.997)',offset:.72},
    {transform:'scale(1)',offset:1}
  ],{duration:230,easing:'cubic-bezier(.2,.78,.22,1)'});
}

function settleCableMotion(nodeId, vx=0, vy=0) {
  if (reducedMotion) return;
  const speed=Math.hypot(vx,vy);
  if (speed < .025) return;
  const ax=Math.max(-28,Math.min(28,vx*74));
  const ay=Math.max(-24,Math.min(24,vy*74));
  const started=performance.now();
  const duration=430;
  function tick(now) {
    const t=Math.min(1,(now-started)/duration);
    const decay=Math.exp(-4.6*t);
    const swing=Math.cos(t*Math.PI*2.45);
    state.cableMotion={nodeId,x:ax*decay*swing,y:ay*decay*swing};
    renderEdges();
    if (t<1) requestAnimationFrame(tick);
    else {
      state.cableMotion=null;
      renderEdges();
    }
  }
  requestAnimationFrame(tick);
}

function pulsePort(nodeId, portId) {
  if (reducedMotion) return;
  const port=document.querySelector(`[data-port="in"][data-node="${nodeId}"][data-port-id="${portId}"]`);
  if (!port?.animate) return;
  port.animate([
    {transform:'translateY(-50%) scale(1)',offset:0},
    {transform:'translateY(-50%) scale(1.36)',offset:.34},
    {transform:'translateY(-50%) scale(.96)',offset:.72},
    {transform:'translateY(-50%) scale(1)',offset:1}
  ],{duration:270,easing:'cubic-bezier(.2,.8,.24,1)'});
}

function animateCableConnect(edgeId, targetNodeId, targetPortId) {
  const group=edgesEl.querySelector(`[data-edge="${edgeId}"]`);
  if (!group) return;
  const main=group.querySelector('.cable-main');
  const halo=group.querySelector('.cable-halo');
  if (!reducedMotion && main?.animate) {
    const length=main.getTotalLength();
    main.animate([
      {strokeDasharray:`${length} ${length}`,strokeDashoffset:length,strokeWidth:'2.7px'},
      {strokeDasharray:`${length} ${length}`,strokeDashoffset:0,strokeWidth:'1.55px'}
    ],{duration:240,easing:'cubic-bezier(.18,.72,.22,1)'});
    halo?.animate([
      {opacity:.1,strokeWidth:'8px'},
      {opacity:1,strokeWidth:'5px'}
    ],{duration:320,easing:'cubic-bezier(.2,.78,.22,1)'});
  }
  pulsePort(targetNodeId,targetPortId);
  setTimeout(()=>{
    state.edgeFlash=null;
    group.classList.remove('just-connected');
  },340);
}

function finalizeEdgeRemoval(edgeId) {
  state.edges=state.edges.filter(edge=>edge.id!==edgeId);
  if (state.selectedEdge===edgeId) state.selectedEdge=null;
  state.run=null;
  save();
  render();
}

function removeEdgeAnimated(edgeId) {
  const group=edgesEl.querySelector(`[data-edge="${edgeId}"]`);
  if (!group || reducedMotion) {
    finalizeEdgeRemoval(edgeId);
    return;
  }
  const main=group.querySelector('.cable-main');
  const halo=group.querySelector('.cable-halo');
  const control=group.querySelector('[data-remove-edge]');
  const length=main?.getTotalLength?.()||1;
  main?.animate([
    {strokeDasharray:`${length} ${length}`,strokeDashoffset:0,opacity:1},
    {strokeDasharray:`${length} ${length}`,strokeDashoffset:length,opacity:0}
  ],{duration:190,easing:'cubic-bezier(.55,0,.86,.45)',fill:'forwards'});
  halo?.animate([{opacity:1},{opacity:0}],{duration:250,easing:'ease-in',fill:'forwards'});
  control?.animate([{opacity:1,transform:'scale(1)'},{opacity:0,transform:'scale(.72)'}],{duration:130,easing:'ease-in',fill:'forwards'});
  setTimeout(()=>finalizeEdgeRemoval(edgeId),250);
}

function softenEdgeHover(edgeId, active) {
  if (state.selectedEdge===edgeId) return;
  const group=edgesEl.querySelector(`[data-edge="${edgeId}"]`);
  const main=group?.querySelector('.cable-main');
  const halo=group?.querySelector('.cable-halo');
  if (!main) return;
  main.style.stroke=active?'#737dea':'#a9abb5';
  main.style.strokeWidth=active?'2.15':'1.55';
  if (halo) halo.style.stroke=active?'rgba(91,103,232,.12)':'rgba(169,171,181,.14)';
}

edgesEl.addEventListener('pointerdown', e => {
  if (e.target.closest('[data-edge-hit],[data-remove-edge]')) e.stopPropagation();
});

edgesEl.addEventListener('pointerover', e => {
  const hit=e.target.closest('[data-edge-hit]');
  if (hit) softenEdgeHover(hit.dataset.edgeHit,true);
});

edgesEl.addEventListener('pointerout', e => {
  const hit=e.target.closest('[data-edge-hit]');
  if (hit) softenEdgeHover(hit.dataset.edgeHit,false);
});

edgesEl.addEventListener('click', e => {
  const remove=e.target.closest('[data-remove-edge]');
  if (remove) {
    e.stopPropagation();
    removeEdgeAnimated(remove.dataset.removeEdge);
    return;
  }
  const hit=e.target.closest('[data-edge-hit]');
  if (!hit) return;
  e.stopPropagation();
  state.selectedEdge=hit.dataset.edgeHit;
  state.selected='';
  renderEdges();
  renderInspector();
});

nodesEl.addEventListener('pointerdown', e => {
  state.selectedEdge=null;
  state.cableMotion=null;
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
  const now=performance.now();
  state.drag = {
    id:n.id,
    dx:(e.clientX - rect.left) / state.scale,
    dy:(e.clientY - rect.top) / state.scale,
    pointerId:e.pointerId,
    element:frame,
    lastX:e.clientX,
    lastY:e.clientY,
    lastT:now,
    vx:0,
    vy:0
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

  const now=performance.now();
  const dt=Math.max(8,now-state.drag.lastT);
  const ivx=(e.clientX-state.drag.lastX)/(dt*state.scale);
  const ivy=(e.clientY-state.drag.lastY)/(dt*state.scale);
  state.drag.vx=state.drag.vx*.62+ivx*.38;
  state.drag.vy=state.drag.vy*.62+ivy*.38;
  state.drag.lastX=e.clientX;
  state.drag.lastY=e.clientY;
  state.drag.lastT=now;

  n.x = Math.max(16, (e.clientX - r.left + stage.scrollLeft) / state.scale - state.drag.dx);
  n.y = Math.max(16, (e.clientY - r.top + stage.scrollTop) / state.scale - state.drag.dy);
  state.drag.element.style.left = `${n.x}px`;
  state.drag.element.style.top = `${n.y}px`;
  renderEdges();
});

nodesEl.addEventListener('pointerup', e => {
  const port = e.target.closest('[data-port]');
  const dragSnapshot=state.drag?{...state.drag}:null;
  let connected=null;

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
        const id='e-' + Date.now();
        state.edges.push({ id, fromNode:src.id, fromPort:out.id, toNode:dst.id, toPort:input.id });
        state.edgeFlash=id;
        state.run = null;
        connected={id,targetNodeId:dst.id,targetPortId:input.id};
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

  if (dragSnapshot) {
    const idleFor=performance.now()-dragSnapshot.lastT;
    const decay=idleFor>85?.25:1;
    const vx=dragSnapshot.vx*decay;
    const vy=dragSnapshot.vy*decay;
    requestAnimationFrame(()=>animateFrameSettle(dragSnapshot.id,vx,vy));
    settleCableMotion(dragSnapshot.id,vx,vy);
  }
  if (connected) requestAnimationFrame(()=>animateCableConnect(connected.id,connected.targetNodeId,connected.targetPortId));
});

nodesEl.addEventListener('pointercancel', () => {
  if (state.drag?.element) state.drag.element.classList.remove('dragging');
  state.wire = null;
  state.drag = null;
  state.cableMotion=null;
  clearPortHints();
  setStatus('READY');
  renderEdges();
});

stage.addEventListener('pointerdown', e => {
  if (e.target.closest('[data-frame],[data-port],[data-edge-hit],[data-remove-edge]') || state.wire) return;
  if (e.button !== 0 && e.button !== 1) return;
  if (state.selectedEdge) {
    state.selectedEdge=null;
    renderEdges();
  }
  state.pan = { pointerId:e.pointerId, x:e.clientX, y:e.clientY, left:stage.scrollLeft, top:stage.scrollTop };
  stage.style.cursor='grabbing';
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
    stage.style.cursor='';
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
  state.selectedEdge=null;
  state.run = null;
  state.scale = 1;
  state.cableMotion=null;
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
  if (e.key === 'Delete' || e.key === 'Backspace') {
    if (state.selectedEdge) removeEdgeAnimated(state.selectedEdge);
    else if (state.selected) removeSelected();
  }
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'r') { e.preventDefault(); execute(); }
  if (e.key === 'Escape') {
    state.selected = '';
    state.selectedEdge=null;
    clearPortHints();
    state.wire=null;
    render();
  }
});

window.addEventListener('resize', renderMeta);

const hint = document.createElement('div');
hint.className = 'canvas-hint';
hint.innerHTML = '<span>Drag canvas to move</span><i></i><span>Connect dots</span><i></i><span>Ctrl + scroll to zoom</span>';
stage.appendChild(hint);
setTimeout(() => hint.classList.add('quiet'), 5000);

load();
render();
window.__VF__ = { state, runWorkflow, execute, addNode, removeEdgeAnimated };