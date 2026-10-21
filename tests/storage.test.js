import { it, expect } from "vitest";
import {
  readScenarios,
  saveScenario,
  deleteScenario,
  SCENARIOS_KEY,
} from "../src/storage.js";
import { emptyGraph } from "../src/graph.js";
function storage() {
  const m = new Map();
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v) };
}
it("roundtrips named graphs and deletes one", () => {
  const s = storage();
  saveScenario(s, " Demo ", emptyGraph(), false);
  expect(readScenarios(s)).toEqual([{ name: "Demo", graph: emptyGraph() }]);
  deleteScenario(s, "Demo");
  expect(readScenarios(s)).toEqual([]);
});
it("permits overwrite but blocks second free scenario", () => {
  const s = storage();
  saveScenario(s, "One", emptyGraph(), false);
  saveScenario(s, "One", emptyGraph(), false);
  expect(() => saveScenario(s, "Two", emptyGraph(), false)).toThrow("1 saved");
  saveScenario(s, "Two", emptyGraph(), true);
  expect(readScenarios(s)).toHaveLength(2);
});
it("rejects empty names and skips corrupt entries without changing storage on read", () => {
  const s = storage();
  expect(() => saveScenario(s, " ", emptyGraph(), false)).toThrow();
  const raw = JSON.stringify([{ name: "Broken", graph: null }]);
  s.setItem(SCENARIOS_KEY, raw);
  expect(readScenarios(s)).toEqual([]);
  expect(s.getItem(SCENARIOS_KEY)).toBe(raw);
  saveScenario(s, "One", emptyGraph(), true);
  expect(readScenarios(s)).toEqual([{ name: "One", graph: emptyGraph() }]);
});
it("rejects unreadable JSON without overwriting it", () => {
  const s = storage();
  s.setItem(SCENARIOS_KEY, "broken");
  expect(() => readScenarios(s)).toThrow();
  expect(() => saveScenario(s, "One", emptyGraph(), true)).toThrow();
  expect(s.getItem(SCENARIOS_KEY)).toBe("broken");
});
it.each([
  null,
  { name: " ", graph: emptyGraph() },
  { name: "Broken", graph: null },
  { name: "Broken", graph: { nodes: [null], edges: [] } },
])(
  "keeps valid scenarios readable and deletable beside corrupt entry %j",
  (bad) => {
    const s = storage();
    const valid = { name: "One", graph: emptyGraph() };
    for (const entries of [
      [bad, valid],
      [valid, bad],
    ]) {
      const raw = JSON.stringify(entries);
      s.setItem(SCENARIOS_KEY, raw);
      expect(readScenarios(s)).toEqual([valid]);
      expect(s.getItem(SCENARIOS_KEY)).toBe(raw);
      deleteScenario(s, "One");
      expect(readScenarios(s)).toEqual([]);
    }
  },
);
