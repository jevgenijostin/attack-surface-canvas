import { validateGraph } from './graph.js';
import { canSaveScenario } from './license.js';
export const SCENARIOS_KEY = 'asc.scenarios.v1';
export function readScenarios(storage) {
  const list = JSON.parse(storage.getItem(SCENARIOS_KEY) || '[]');
  if (!Array.isArray(list)) throw Error('Saved scenarios are invalid');
  for (const s of list) { if (!s || typeof s.name !== 'string' || !s.name.trim() || s.name.length > 60) throw Error('Invalid scenario name'); validateGraph(s.graph); }
  return list;
}
export function saveScenario(storage, name, graph, paid) {
  name = name.trim();
  if (!name || name.length > 60) throw Error('Enter a scenario name (1–60 characters).');
  validateGraph(graph);
  const list = readScenarios(storage), index = list.findIndex(s => s.name === name);
  if (!canSaveScenario(paid, list.length, index >= 0)) throw Error('Free tier allows 1 saved scenario. Replace it by using the same name, or unlock Demo Pro.');
  const scenario = { name, graph };
  if (index >= 0) list[index] = scenario; else list.push(scenario);
  storage.setItem(SCENARIOS_KEY, JSON.stringify(list));
}
export function deleteScenario(storage, name) { storage.setItem(SCENARIOS_KEY, JSON.stringify(readScenarios(storage).filter(s => s.name !== name))); }
