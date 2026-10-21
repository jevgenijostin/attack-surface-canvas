import { describe, it, expect } from "vitest";
import {
  emptyGraph,
  addNode,
  removeNode,
  addEdge,
  removeEdge,
  moveNode,
  computeBlastRadius,
  summarize,
  validateGraph,
} from "../src/graph.js";
const node = (id) => ({ id, type: "server", label: id, x: 100, y: 100 });
function graph(ids, edges = []) {
  return {
    nodes: ids.map(node),
    edges: edges.map(([fromId, toId]) => ({ fromId, toId })),
  };
}
describe("graph mutations", () => {
  it("adds a node without mutating input", () => {
    const g = emptyGraph();
    expect(addNode(g, node("a")).nodes).toEqual([node("a")]);
    expect(g.nodes).toEqual([]);
  });
  it("rejects duplicate ids and unknown types", () => {
    expect(() => addNode(graph(["a"]), node("a"))).toThrow();
    expect(() =>
      addNode(emptyGraph(), { ...node("a"), type: "unknown" }),
    ).toThrow();
  });
  it("removes a node and incoming/outgoing edges", () => {
    expect(
      removeNode(
        graph(
          ["a", "b", "c"],
          [
            ["a", "b"],
            ["b", "c"],
            ["a", "c"],
          ],
        ),
        "b",
      ),
    ).toEqual(graph(["a", "c"], [["a", "c"]]));
  });
  it("adds directed edges and ignores duplicates", () => {
    const g = graph(["a", "b"]);
    const updated = addEdge(g, "a", "b");
    expect(updated.edges).toEqual([{ fromId: "a", toId: "b" }]);
    expect(addEdge(updated, "a", "b")).toBe(updated);
    expect(g.edges).toEqual([]);
  });
  it("rejects missing endpoints and self links", () => {
    expect(() => addEdge(graph(["a"]), "a", "b")).toThrow();
    expect(() => addEdge(graph(["a"]), "a", "a")).toThrow();
  });
  it("removes only the requested direction", () => {
    expect(
      removeEdge(
        graph(
          ["a", "b"],
          [
            ["a", "b"],
            ["b", "a"],
          ],
        ),
        "a",
        "b",
      ).edges,
    ).toEqual([{ fromId: "b", toId: "a" }]);
  });
  it("moves a node immutably and rejects invalid coordinates", () => {
    const g = graph(["a"]);
    expect(moveNode(g, "a", 200, 300).nodes[0].x).toBe(200);
    expect(g.nodes[0].x).toBe(100);
    expect(() => moveNode(g, "a", NaN, 0)).toThrow();
  });
  it("rejects malformed stored graphs", () => {
    expect(() => validateGraph({ nodes: [], edges: [null] })).toThrow();
    expect(() =>
      validateGraph({
        nodes: [{ ...node("x"), type: "__proto__" }],
        edges: [],
      }),
    ).toThrow();
  });
});
describe("breadth-first blast radius", () => {
  it("walks a linear chain", () => {
    expect(
      computeBlastRadius(
        graph(
          ["a", "b", "c"],
          [
            ["a", "b"],
            ["b", "c"],
          ],
        ),
        "a",
      ),
    ).toEqual([
      { nodeId: "a", depth: 0 },
      { nodeId: "b", depth: 1 },
      { nodeId: "c", depth: 2 },
    ]);
  });
  it("walks branches in insertion order at shortest depth", () => {
    expect(
      computeBlastRadius(
        graph(
          ["a", "b", "c", "d", "e"],
          [
            ["a", "b"],
            ["a", "c"],
            ["b", "d"],
            ["c", "e"],
          ],
        ),
        "a",
      ),
    ).toEqual([
      { nodeId: "a", depth: 0 },
      { nodeId: "b", depth: 1 },
      { nodeId: "c", depth: 1 },
      { nodeId: "d", depth: 2 },
      { nodeId: "e", depth: 2 },
    ]);
  });
  it("terminates on cycles with unique shortest visits", () => {
    expect(
      computeBlastRadius(
        graph(
          ["a", "b", "c", "d"],
          [
            ["a", "b"],
            ["b", "c"],
            ["c", "a"],
            ["a", "c"],
            ["c", "d"],
            ["d", "b"],
          ],
        ),
        "a",
      ),
    ).toEqual([
      { nodeId: "a", depth: 0 },
      { nodeId: "b", depth: 1 },
      { nodeId: "c", depth: 1 },
      { nodeId: "d", depth: 2 },
    ]);
  });
  it("returns only the disconnected start", () => {
    expect(
      computeBlastRadius(graph(["a", "b", "c"], [["a", "b"]]), "c"),
    ).toEqual([{ nodeId: "c", depth: 0 }]);
  });
  it("handles an empty graph", () => {
    expect(computeBlastRadius(emptyGraph(), "missing")).toEqual([]);
  });
  it("handles an unknown start and respects direction", () => {
    const g = graph(["a", "b"], [["a", "b"]]);
    expect(computeBlastRadius(g, "x")).toEqual([]);
    expect(computeBlastRadius(g, "b")).toEqual([{ nodeId: "b", depth: 0 }]);
  });
  it("summarizes counts and deterministic severity", () => {
    const g = graph(["a", "b"]);
    expect(summarize(g, computeBlastRadius(g, "a"))).toMatchObject({
      total: 1,
      byType: { server: 1 },
      note: expect.stringContaining("Significant"),
    });
    expect(
      summarize(g, [
        { nodeId: "a", depth: 0 },
        { nodeId: "b", depth: 1 },
      ]).note,
    ).toContain("Broad");
    expect(summarize(emptyGraph(), []).note).toContain("Contained");
  });
});
