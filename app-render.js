function renderInspector() {
  const n=node(state.selected);
  inspector.classList.toggle('inspector-open',!!n);
  if(!n) { inspector.innerHTML='<div class="empty-inspector"><span>DETAILS</span><p>Select a frame.</p></div>'; return; }
  const step=(state.run?.steps||[]).find(s=>s.nodeId===n.id);
  const bodyLabel={asset:'Data',instruction:'Order',expression:'Logic',check:'Check'}[n.kind] || 'Content';
  const orderChoices=n.kind==='instruction'?`<div class="seg-field"><span>Orders</span><div class="seg">${FRAME_ORDERS.map(p=>`<button data-order="${p.id}" class="${n.orderPreset===p.id?'active':''}">${escapeHTML(p.title)}</button>`).join('')}</div></div>`:'';
  inspector.innerHTML=`<div class="inspector-head"><div><span>DETAILS</span><strong>${KIND_LABELS[n.kind] || n.kind.toUpperCase()}</strong></div><button id="close-inspector" class="close-inspector" aria-label="Close">×</button></div>
    <label class="field"><span>Name</span><input id="field-title" value="${escapeHTML(n.title)}"></label>
    ${orderChoices}
    ${n.kind!=='output'?`<label class="field grow-field"><span>${bodyLabel}</span><textarea id="field-body">${escapeHTML(n.kind==='asset'?(n.value??''):n.body)}</textarea></label>`:''}
    ${(n.kind==='instruction'||n.kind==='expression')?`<div class="seg-field"><span>Mode</span><div class="seg"><button data-mode="DETERMINISTIC" class="${n.operation==='DETERMINISTIC'?'active':''}">Local</button><button data-mode="MODEL" class="${n.operation==='MODEL'?'active':''}">Online</button></div></div>`:''}
    ${n.kind==='expression'?`<div class="seg-field"><span>Behavior</span><div class="seg"><button data-eq="EXECUTABLE" class="${n.expressionClass==='EXECUTABLE'?'active':''}">Run</button><button data-eq="DESCRIPTIVE" class="${n.expressionClass==='DESCRIPTIVE'?'active':''}">Note</button></div></div>`:''}
    <div class="io-block"><span>Connections</span>${[...n.inputs.map(p=>`IN  ${p.name}:${p.type}`),...n.outputs.map(p=>`OUT ${p.name}:${p.type}`)].map(x=>`<code>${escapeHTML(x)}</code>`).join('')||'<code>NONE</code>'}</div>
    <div class="trace-block"><span>Last run</span>${step?`<b class="trace-state trace-${step.status}">${step.status==='ok'?'DONE':'ERROR'}</b><dl><dt>Input</dt><dd>${escapeHTML(short(step.input))}</dd><dt>Output</dt><dd>${escapeHTML(short(step.output))}</dd>${step.error?`<dt>Error</dt><dd>${escapeHTML(step.error)}</dd>`:''}</dl>`:'<em>Not run</em>'}</div>
    <button id="run-frame" class="run-btn" style="width:100%;margin-top:18px"><span>Run Frame</span></button>
    <button id="delete" class="delete-btn">Delete</button>`;
  el('close-inspector').onclick=()=>{state.selected='';render();};
  el('delete').onclick=removeSelected;
  el('run-frame').onclick=executeSelected;
  el('field-title').oninput=e=>{n.title=e.target.value;save();renderNodes();};
  const body=el('field-body'); if(body) body.oninput=e=>{ if(n.kind==='asset')n.value=e.target.value;else {n.body=e.target.value;n.orderPreset='';} state.run=null;save();renderNodes();};
  inspector.querySelectorAll('[data-mode]').forEach(b=>b.onclick=()=>updateSelected({operation:b.dataset.mode}));
  inspector.querySelectorAll('[data-eq]').forEach(b=>b.onclick=()=>updateSelected({expressionClass:b.dataset.eq}));
  inspector.querySelectorAll('[data-order]').forEach(b=>b.onclick=()=>{
    const preset=FRAME_ORDERS.find(p=>p.id===b.dataset.order);
    if(!preset)return;
    updateSelected({title:preset.title,body:preset.prompt,operation:'MODEL',orderPreset:preset.id});
  });
}

function setStatus(text) { const s=el('status'); s.className='status status-'+text.toLowerCase().replaceAll(' ','-'); s.querySelector('b').textContent=text; }

function showRunStrip() {
  const box=el('run-strip');
  if(!state.run){box.hidden=true;return;}
  box.hidden=false;
  const running=state.run.status==='running';
  box.className='run-strip '+(state.run.status==='error'?'run-strip-error':'');
  const ok=state.run.steps.filter(s=>s.status==='ok').length;
  const label=running?'RUNNING':state.run.status==='ok'?'DONE':'STOPPED';
  box.innerHTML=`<span>${label}</span><strong>${ok}/${state.nodes.length}</strong><button aria-label="Close">×</button>`;
  box.querySelector('button').onclick=()=>{state.run=null;box.hidden=true;renderNodes();renderInspector();};
}

function mergeFrameRun(previousRun, frameRun) {
  const merged=new Map((previousRun?.steps||[]).filter(s=>state.nodes.some(n=>n.id===s.nodeId)).map(s=>[s.nodeId,s]));
  for(const step of frameRun.steps) merged.set(step.nodeId,step);
  return {...frameRun,steps:[...merged.values()]};
}

async function executeSelected() {
  const n=node(state.selected);
  if(!n)return;
  const btn=el('run-frame');
  btn.disabled=true;
  btn.querySelector('span').textContent='Running';
  setStatus('RUNNING');
  const previous=state.run;
  const single=await runFrame({nodes:state.nodes,edges:state.edges},n.id,previous);
  state.run=mergeFrameRun(previous,single);
  setStatus(single.status==='ok'?'PASSED':'STOPPED');
  renderNodes();
  renderInspector();
  showRunStrip();
}

async function execute() {
  const btn=el('run');
  btn.disabled=true;
  btn.querySelector('span').textContent='Running';
  setStatus('RUNNING');
  state.run={status:'running',startedAt:new Date().toISOString(),steps:[],activeNodeId:null};
  renderNodes();
  renderInspector();
  showRunStrip();

  const finalRun=await runWorkflow({nodes:state.nodes,edges:state.edges},event=>{
    if(event.type==='frame-started') {
      state.run={...state.run,status:'running',activeNodeId:event.nodeId,steps:event.steps};
    } else if(event.type==='frame-completed') {
      state.run={...state.run,status:'running',activeNodeId:null,steps:event.steps};
    } else if(event.run) {
      state.run=event.run;
    }
    renderNodes();
    renderInspector();
    showRunStrip();
  });

  state.run=finalRun;
  setStatus(state.run.status==='ok'?'PASSED':'STOPPED');
  btn.disabled=false;
  btn.querySelector('span').textContent='Run';
  renderNodes();
  renderInspector();
  showRunStrip();
}
