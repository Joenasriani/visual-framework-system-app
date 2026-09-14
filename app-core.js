const W = 216, H = 112;
const KIND_LABELS = { asset:'DATA', instruction:'STEP', expression:'LOGIC', check:'CHECK', output:'RESULT' };
const seedNodes = [
  { id:'asset-1', kind:'asset', title:'Source', operation:'DETERMINISTIC', x:120, y:190, inputs:[], outputs:[{id:'out',name:'text',type:'text'}], body:'Reusable source', value:'A useful system makes its assumptions inspectable.' },
  { id:'instruction-1', kind:'instruction', title:'Step', operation:'MODEL', x:420, y:190, inputs:[{id:'in',name:'input',type:'text'}], outputs:[{id:'out',name:'text',type:'text'}], body:'State the claim:' },
  { id:'expression-1', kind:'expression', title:'Logic', operation:'DETERMINISTIC', expressionClass:'EXECUTABLE', x:720, y:190, inputs:[{id:'in',name:'input',type:'text'}], outputs:[{id:'out',name:'valid',type:'boolean'}], body:'notEmpty(input)' },
  { id:'output-1', kind:'output', title:'Result', operation:'DETERMINISTIC', x:1020, y:190, inputs:[{id:'in',name:'input',type:'boolean'}], outputs:[], body:'' }
];
const seedEdges = [
  {id:'e1',fromNode:'asset-1',fromPort:'out',toNode:'instruction-1',toPort:'in'},
  {id:'e2',fromNode:'instruction-1',fromPort:'out',toNode:'expression-1',toPort:'in'},
  {id:'e3',fromNode:'expression-1',fromPort:'out',toNode:'output-1',toPort:'in'}
];

const state = { nodes: structuredClone(seedNodes), edges: structuredClone(seedEdges), selected:'instruction-1', run:null, scale:1, wire:null, drag:null, pan:null };
const el = id => document.getElementById(id);
const nodesEl = el('nodes'), edgesEl = el('edges'), world = el('world'), stage = el('stage'), inspector = el('inspector');

function load() {
  try {
    const saved = JSON.parse(localStorage.getItem('visual-framework-workflow-v1'));
    if (saved?.nodes?.length && Array.isArray(saved.edges)) { state.nodes = saved.nodes; state.edges = saved.edges; state.selected = state.nodes[0]?.id || ''; }
  } catch {}
}
function save() { localStorage.setItem('visual-framework-workflow-v1', JSON.stringify({nodes:state.nodes, edges:state.edges})); }
function node(id) { return state.nodes.find(n => n.id === id); }
function short(v) { if (v === undefined) return '—'; const t = typeof v === 'string' ? v : JSON.stringify(v); return t.length > 70 ? t.slice(0,67)+'…' : t; }
function escapeHTML(s='') { return String(s).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }
function portCenter(n, side, index=0) { return { x: side==='out' ? n.x+W : n.x, y:n.y+58+index*22 }; }

function makeNode(kind) {
  const id = `${kind}-${Date.now()}-${Math.floor(Math.random()*1000)}`;
  const x = Math.max(32, stage.scrollLeft/state.scale + stage.clientWidth/(2*state.scale)-W/2) + Math.random()*26;
  const y = Math.max(48, stage.scrollTop/state.scale + stage.clientHeight/(2*state.scale)-H/2) + Math.random()*26;
  if (kind==='asset') return {id,kind,title:'Source',operation:'DETERMINISTIC',x,y,inputs:[],outputs:[{id:'out',name:'text',type:'text'}],body:'Reusable source',value:'New source'};
  if (kind==='instruction') return {id,kind,title:'Step',operation:'MODEL',x,y,inputs:[{id:'in',name:'input',type:'text'}],outputs:[{id:'out',name:'text',type:'text'}],body:'Transform:'};
  if (kind==='expression') return {id,kind,title:'Logic',operation:'DETERMINISTIC',expressionClass:'EXECUTABLE',x,y,inputs:[{id:'in',name:'input',type:'text'}],outputs:[{id:'out',name:'value',type:'boolean'}],body:'notEmpty(input)'};
  if (kind==='check') return {id,kind,title:'Check',operation:'DETERMINISTIC',x,y,inputs:[{id:'in',name:'input',type:'any'}],outputs:[{id:'out',name:'valid',type:'boolean'}],body:'Pass if truthy'};
  return {id,kind,title:'Result',operation:'DETERMINISTIC',x,y,inputs:[{id:'in',name:'input',type:'any'}],outputs:[],body:''};
}

function addNode(kind) { const n=makeNode(kind); state.nodes.push(n); state.selected=n.id; state.run=null; save(); render(); }
function removeSelected() {
  if (!state.selected) return;
  state.nodes = state.nodes.filter(n=>n.id!==state.selected);
  state.edges = state.edges.filter(e=>e.fromNode!==state.selected && e.toNode!==state.selected);
  state.selected=''; state.run=null; save(); render();
}
function updateSelected(patch) { const n=node(state.selected); if (!n) return; Object.assign(n,patch); state.run=null; save(); renderNodes(); renderEdges(); renderInspector(); }

function render() { renderNodes(); renderEdges(); renderInspector(); renderMeta(); }
function renderMeta() {
  el('count').textContent = `${state.nodes.length} frames · ${state.edges.length} links`;
  el('zoom-label').textContent = `${Math.round(state.scale*100)}%`;
  world.style.transform = `scale(${state.scale})`;
  const width = Math.max(1500, ...state.nodes.map(n=>n.x+W+220));
  const height = Math.max(860, ...state.nodes.map(n=>n.y+H+260));
  world.style.width = width+'px'; world.style.height=height+'px'; edgesEl.setAttribute('width',width); edgesEl.setAttribute('height',height);
}
function renderNodes() {
  const stepMap = new Map((state.run?.steps||[]).map(s=>[s.nodeId,s]));
  nodesEl.innerHTML = state.nodes.map(n=>{
    const step=stepMap.get(n.id), sel=state.selected===n.id?' selected':'', runClass=step?` run-${step.status}`:'';
    const ins=n.inputs.map((p,i)=>`<button data-port="in" data-node="${n.id}" data-port-id="${p.id}" class="port port-in" style="top:${54+i*22}px" title="${p.name}: ${p.type}" aria-label="Input ${p.name}"><span>${p.type[0]}</span></button>`).join('');
    const outs=n.outputs.map((p,i)=>`<button data-port="out" data-node="${n.id}" data-port-id="${p.id}" data-port-index="${i}" class="port port-out" style="top:${54+i*22}px" title="${p.name}: ${p.type}" aria-label="Output ${p.name}"><span>${p.type[0]}</span></button>`).join('');
    return `<div class="frame frame-${n.kind}${sel}${runClass}" data-frame="${n.id}" style="left:${n.x}px;top:${n.y}px;width:${W}px;height:${H}px">
      <div class="frame-index">${KIND_LABELS[n.kind] || n.kind.toUpperCase()}</div><div class="frame-title">${escapeHTML(n.title)}</div>
      <div class="frame-body">${escapeHTML(n.kind==='asset'?short(n.value):(n.body||'—'))}</div>
      <div class="frame-meta"><span>${n.operation==='MODEL'?'ONLINE':'LOCAL'}</span><span>${step?step.durationMs+'ms':(n.outputs[0]?.type||'result')}</span></div>${ins}${outs}</div>`;
  }).join('');
}
function curve(a,b) {
  const dx=b.x-a.x, dy=b.y-a.y;
  const dir=dx>=0?1:-1;
  const bend=Math.max(66,Math.min(280,Math.abs(dx)*.46+Math.abs(dy)*.13));
  return `M ${a.x} ${a.y} C ${a.x+dir*bend} ${a.y}, ${b.x-dir*bend} ${b.y}, ${b.x} ${b.y}`;
}
function renderEdges() {
  const paths = state.edges.map(e=>{
    const a=node(e.fromNode), b=node(e.toNode); if(!a||!b)return '';
    const ai=Math.max(0,a.outputs.findIndex(p=>p.id===e.fromPort)), bi=Math.max(0,b.inputs.findIndex(p=>p.id===e.toPort));
    const d=curve(portCenter(a,'out',ai),portCenter(b,'in',bi));
    return `<g class="cable-group"><path class="cable-halo" d="${d}"></path><path class="cable-main" d="${d}"></path><path class="cable-signal" d="${d}"></path></g>`;
  }).join('');
  const live=state.wire?(()=>{const d=curve({x:state.wire.x1,y:state.wire.y1},{x:state.wire.x2,y:state.wire.y2});return `<path class="wire-live" d="${d}"></path><circle class="wire-tip" cx="${state.wire.x2}" cy="${state.wire.y2}" r="5"></circle>`;})():'';
  edgesEl.innerHTML=paths+live;
}