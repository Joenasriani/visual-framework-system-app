const compatible = (outType, inType) => outType === inType || outType === 'any' || inType === 'any';

function validateWorkflow(workflow) {
  const errors = [];
  const byId = new Map(workflow.nodes.map(n => [n.id, n]));
  for (const edge of workflow.edges) {
    const from = byId.get(edge.fromNode);
    const to = byId.get(edge.toNode);
    if (!from || !to) { errors.push(`Broken connection: ${edge.id}`); continue; }
    const out = from.outputs.find(p => p.id === edge.fromPort);
    const input = to.inputs.find(p => p.id === edge.toPort);
    if (!out || !input) { errors.push(`Missing port: ${edge.id}`); continue; }
    if (!compatible(out.type, input.type)) errors.push(`${from.title}.${out.name} → ${to.title}.${input.name}: ${out.type} ≠ ${input.type}`);
  }
  for (const node of workflow.nodes) {
    for (const input of node.inputs) {
      const incoming = workflow.edges.some(e => e.toNode === node.id && e.toPort === input.id);
      if (!incoming && node.kind !== 'asset') errors.push(`${node.title}: ${input.name} is not connected`);
    }
  }
  return errors;
}

function topo(nodes, edges) {
  const indegree = new Map(nodes.map(n => [n.id, 0]));
  const next = new Map();
  for (const e of edges) {
    indegree.set(e.toNode, (indegree.get(e.toNode) ?? 0) + 1);
    next.set(e.fromNode, [...(next.get(e.fromNode) ?? []), e.toNode]);
  }
  const queue = nodes.filter(n => (indegree.get(n.id) ?? 0) === 0).map(n => n.id);
  const result = [];
  while (queue.length) {
    const id = queue.shift();
    const node = nodes.find(n => n.id === id);
    result.push(node);
    for (const target of next.get(id) ?? []) {
      indegree.set(target, (indegree.get(target) ?? 1) - 1);
      if (indegree.get(target) === 0) queue.push(target);
    }
  }
  if (result.length !== nodes.length) throw new Error('Cycle detected');
  return result;
}

function evaluateExpression(body, input) {
  const expr = body.trim();
  if (expr === 'length(input)') return String(input ?? '').length;
  if (expr === 'notEmpty(input)') return String(input ?? '').trim().length > 0;
  if (expr === 'uppercase(input)') return String(input ?? '').toUpperCase();
  if (expr === 'lowercase(input)') return String(input ?? '').toLowerCase();
  if (expr === 'json(input)') return JSON.stringify(input);
  throw new Error(`Unsupported expression: ${expr}`);
}

async function callModel(node, input) {
  const response = await fetch('/api/model', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: node.title,
      instruction: node.body || '',
      input
    })
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.error || 'MODEL FAILED');
  if (typeof data?.output !== 'string' || !data.output.trim()) throw new Error('EMPTY MODEL OUTPUT');
  return data.output.trim();
}

async function runWorkflow(workflow) {
  const startedAt = new Date().toISOString();
  const validation = validateWorkflow(workflow);
  if (validation.length) {
    return { status: 'error', startedAt, endedAt: new Date().toISOString(), steps: validation.map((error, i) => ({ nodeId:`validation-${i}`, status:'error', input:null, error, durationMs:0 })) };
  }
  let ordered;
  try { ordered = topo(workflow.nodes, workflow.edges); }
  catch (error) { return { status:'error', startedAt, endedAt:new Date().toISOString(), steps:[{nodeId:'graph',status:'error',input:null,error:error.message,durationMs:0}]}; }

  const outputs = new Map();
  const steps = [];
  for (const node of ordered) {
    const t0 = performance.now();
    const incoming = workflow.edges.filter(e => e.toNode === node.id);
    const gathered = incoming.map(e => outputs.get(e.fromNode));
    const input = gathered.length <= 1 ? gathered[0] : gathered;
    try {
      let output;
      if (node.kind === 'asset') output = node.value ?? node.body;
      else if (node.operation === 'MODEL') output = await callModel(node, input);
      else if (node.kind === 'expression') output = node.expressionClass === 'DESCRIPTIVE' ? input : evaluateExpression(node.body, input);
      else if (node.kind === 'check') output = Boolean(input);
      else if (node.kind === 'instruction') output = `${node.body}${input == null ? '' : `\n${String(input)}`}`.trim();
      else output = input;
      outputs.set(node.id, output);
      steps.push({ nodeId:node.id, status:'ok', input, output, durationMs:+(performance.now()-t0).toFixed(2) });
    } catch (error) {
      steps.push({ nodeId:node.id, status:'error', input, error:error.message || 'Execution failed', durationMs:+(performance.now()-t0).toFixed(2) });
      return { status:'error', startedAt, endedAt:new Date().toISOString(), steps };
    }
  }
  return { status:'ok', startedAt, endedAt:new Date().toISOString(), steps };
}
