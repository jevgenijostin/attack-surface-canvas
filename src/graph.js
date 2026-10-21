export const TYPES = { server: { label: 'Server', icon: '▤', color: '#6da9ff' }, firewall: { label: 'Firewall', icon: '⬡', color: '#f2ba65' }, workstation: { label: 'Workstation', icon: '▣', color: '#bca1ff' }, cloud: { label: 'Cloud service', icon: '☁', color: '#65d5d0' }, vendor: { label: 'Vendor', icon: '◇', color: '#f394b1' } };
export const emptyGraph = () => ({ nodes: [], edges: [] });
export function validateGraph(g) {
  if (!g || !Array.isArray(g.nodes) || !Array.isArray(g.edges)) throw Error('Invalid graph');
  const ids = new Set();
  for (const n of g.nodes) {
    if (!n || typeof n.id !== 'string' || !n.id || ids.has(n.id) || !Object.hasOwn(TYPES, n.type) || typeof n.label !== 'string' || n.label.length > 80 || !Number.isFinite(n.x) || !Number.isFinite(n.y)) throw Error('Invalid asset');
    ids.add(n.id);
  }
  const pairs = new Set();
  for (const e of g.edges) {
    const pair = JSON.stringify([e?.fromId,e?.toId]);
    if (!e || !ids.has(e.fromId) || !ids.has(e.toId) || e.fromId === e.toId || pairs.has(pair)) throw Error('Invalid relationship');
    pairs.add(pair);
  }
  return g;
}
export function addNode(g, node) { return validateGraph({ ...g, nodes: [...g.nodes, { ...node }] }); }
export function removeNode(g, id) { return { nodes: g.nodes.filter(n => n.id !== id), edges: g.edges.filter(e => e.fromId !== id && e.toId !== id) }; }
export function addEdge(g, fromId, toId) {
  if (g.edges.some(e => e.fromId === fromId && e.toId === toId)) return g;
  return validateGraph({ ...g, edges: [...g.edges, { fromId, toId }] });
}
export function removeEdge(g, fromId, toId) { return { ...g, edges: g.edges.filter(e => e.fromId !== fromId || e.toId !== toId) }; }
export function moveNode(g, id, x, y) { return validateGraph({ ...g, nodes: g.nodes.map(n => n.id === id ? { ...n, x, y } : n) }); }
export function computeBlastRadius(g, startNodeId) {
  if (!g.nodes.some(n => n.id === startNodeId)) return [];
  const adjacency = new Map(g.nodes.map(n => [n.id, []]));
  for (const e of g.edges) if (adjacency.has(e.fromId) && adjacency.has(e.toId)) adjacency.get(e.fromId).push(e.toId);
  const seen = new Set([startNodeId]), result = [{ nodeId: startNodeId, depth: 0 }];
  for (let i = 0; i < result.length; i++) for (const id of adjacency.get(result[i].nodeId)) {
    if (!seen.has(id)) { seen.add(id); result.push({ nodeId: id, depth: result[i].depth + 1 }); }
  }
  return result;
}
export function summarize(g, result) {
  const affected = new Set(result.map(r => r.nodeId));
  const byType = Object.fromEntries(Object.keys(TYPES).map(t => [t, g.nodes.filter(n => n.type === t && affected.has(n.id)).length]));
  const ratio = g.nodes.length ? result.length / g.nodes.length : 0;
  return { total: result.length, byType, note: ratio >= .75 ? 'Broad exposure: at least three quarters of modeled assets are reachable.' : ratio >= .4 ? 'Significant exposure: multiple trust boundaries may need review.' : 'Contained exposure: fewer than 40% of modeled assets are reachable.' };
}
