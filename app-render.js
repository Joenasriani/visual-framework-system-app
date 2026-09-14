function renderInspector() {
  const n=node(state.selected);
  inspector.classList.toggle('inspector-open',!!n);
  if(!n) { inspector.innerHTML='<div class="empty-inspector"><span>INSPECT</span><p>Select a frame.</p></div>'; return; }
  const step=(state.run?.steps||[]).find(s=>s.nodeId===n.id);
  const bodyLabel=n.kind==='asset'?'Value':n.kind==='expression'?'Expression':'Instruction';
  inspector.innerHTML=`<div class="inspector-head"><div><span>FRAME</span><strong>${n.kind.toUpperCase()}</strong></div><button id="close-inspector" class="close-inspector">×</button></div>
    <label class="field"><span>Name</span><input id="field-title" value="${escapeHTML(n.title)}"></label>
    ${n.kind!=='output'?`<label class="field grow-field"><span>${bodyLabel}</span><textarea id="field-body">${escapeHTML(n.kind==='asset'?(n.value??''):n.body)}</textarea></label>`:''}
    ${(n.kind==='instruction'||n.kind==='expression')?`<div class="seg-field"><span>Mode</span><div class="seg"><button data-mode="DETERMINISTIC" class="${n.operation==='DETERMINISTIC'?'active':''}">Local</button><button data-mode="MODEL" class="${n.operation==='MODEL'?'active':''}">Model</button></div></div>`:''}
    ${n.kind==='expression'?`<div class="seg-field"><span>Equation</span><div class="seg"><button data-eq="EXECUTABLE" class="${n.expressionClass==='EXECUTABLE'?'active':''}">Run</button><button data-eq="DESCRIPTIVE" class="${n.expressionClass==='DESCRIPTIVE'?'active':''}">Note</button></div></div>`:''}
    <div class="io-block"><span>Ports</span>${[...n.inputs.map(p=>`IN  ${p.name}:${p.type}`),...n.outputs.map(p=>`OUT ${p.name}:${p.type}`)].map(x=>`<code>${escapeHTML(x)}</code>`).join('')||'<code>NONE</code>'}</div>
    <div class="trace-block"><span>Last run</span>${step?`<b class="trace-state trace-${step.status}">${step.status.toUpperCase()}</b><dl><dt>Input</dt><dd>${escapeHTML(short(step.input))}</dd><dt>Output</dt><dd>${escapeHTML(short(step.output))}</dd>${step.error?`<dt>Error</dt><dd>${escapeHTML(step.error)}</dd>`:''}</dl>`:'<em>Not run</em>'}</div>
    <button id="delete" class="delete-btn">Delete frame</button>`;
  el('close-inspector').onclick=()=>{state.selected='';render();};
  el('delete').onclick=removeSelected;
  el('field-title').oninput=e=>{n.title=e.target.value;save();renderNodes();};
  const body=el('field-body'); if(body) body.oninput=e=>{ if(n.kind==='asset')n.value=e.target.value;else n.body=e.target.value;state.run=null;save();renderNodes();};
  inspector.querySelectorAll('[data-mode]').forEach(b=>b.onclick=()=>updateSelected({operation:b.dataset.mode}));
  inspector.querySelectorAll('[data-eq]').forEach(b=>b.onclick=()=>updateSelected({expressionClass:b.dataset.eq}));
}
function setStatus(text) { const s=el('status'); s.className='status status-'+text.toLowerCase().replaceAll(' ','-'); s.querySelector('b').textContent=text; }
function showRunStrip() {
  const box=el('run-strip'); if(!state.run){box.hidden=true;return;} box.hidden=false; box.className='run-strip '+(state.run.status==='ok'?'':'run-strip-error');
  const ok=state.run.steps.filter(s=>s.status==='ok').length; box.innerHTML=`<span>${state.run.status==='ok'?'RUN COMPLETE':'RUN STOPPED'}</span><strong>${ok}/${state.nodes.length}</strong><button>×</button>`;
  box.querySelector('button').onclick=()=>{state.run=null;box.hidden=true;renderNodes();renderInspector();};
}
async function execute() {
  const btn=el('run'); btn.disabled=true; btn.querySelector('span').textContent='Running'; setStatus('RUNNING');
  state.run=await runWorkflow({nodes:state.nodes,edges:state.edges});
  setStatus(state.run.status==='ok'?'PASSED':'STOPPED'); btn.disabled=false; btn.querySelector('span').textContent='Run'; renderNodes();renderInspector();showRunStrip();
}
