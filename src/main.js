import "./style.css";
import {
  TYPES,
  emptyGraph,
  addNode,
  removeNode,
  addEdge,
  removeEdge,
  moveNode,
  computeBlastRadius,
  summarize,
} from "./graph.js";
import { verifyLicense, canAddNode, canLoadTemplate } from "./license.js";
import { readScenarios, saveScenario, deleteScenario } from "./storage.js";
import templates from "./templates.json";

const $ = (s) => document.querySelector(s);
let graph = emptyGraph(),
  selected = null,
  result = [],
  placing = null,
  gesture = null,
  dirty = false,
  paid = false;
document.querySelector("#app").innerHTML = `
<header><div class="brand"><span class="brand-mark">◈</span><div>ATTACK SURFACE <strong>CANVAS</strong><small>TABLETOP EXERCISE WORKSPACE</small></div></div><div class="header-right"><span class="local">● Local only</span><span id="tier">Free tier</span></div></header>
<main><aside class="library"><div class="eyebrow">01 / BUILD THE MODEL</div><h1>Map the trust.<br>Trace the impact.</h1><p class="muted">Start with an asset. Connect what it can reach. Explore what happens next.</p><h2>Asset library</h2><div id="assets"></div><p class="hint">Choose an asset, then click the canvas to place it.</p><div class="rule"></div><h2>Scenarios</h2><label for="scenario-name">Scenario name</label><input id="scenario-name" maxlength="60" placeholder="e.g. Corporate perimeter"><button id="save" class="wide">Save scenario</button><div id="saved"></div><h2 class="template-heading">Exercise templates <span>PRO</span></h2><div id="templates"></div><details><summary>Demo license settings</summary><p class="hint">Self-issuable demo key. No payment processing.</p><label for="license">License key</label><input id="license" placeholder="asc-demo-pro-v1.…"><button id="activate" class="wide">Activate demo license</button></details></aside>
<section class="workspace"><div class="canvas-toolbar"><div><strong id="title">Untitled scenario</strong><span id="counts"></span></div><button id="new">New canvas</button></div><div id="status" role="status" aria-live="polite">Ready. Add your first asset to begin.</div><div class="canvas-wrap"><svg id="canvas" viewBox="0 0 1000 650" aria-label="Attack surface canvas"><defs><pattern id="grid" width="24" height="24" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r="1" fill="#283348"/></pattern><marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="#73839d"/></marker></defs><rect width="1000" height="650" fill="url(#grid)"/><g id="edges"></g><g id="nodes"></g><text id="empty" x="500" y="300" text-anchor="middle">Your attack surface starts here</text></svg></div><div class="canvas-footer"><span>Drag cards to move · Drag the + handle to connect →</span><span id="budget"></span></div><div class="legend"><span><i class="d0"></i>Depth 0 · Compromised</span><span><i class="d1"></i>Depth 1 · Direct exposure</span><span><i class="d2"></i>Depth 2+ · Secondary exposure</span></div></section>
<aside class="inspector"><div class="eyebrow">02 / EXPLORE THE IMPACT</div><h2>Asset inspector</h2><div id="selection"><p class="muted">Select an asset to inspect its connections or simulate a compromise.</p></div><div class="rule"></div><h2>Blast radius</h2><div id="results"><div class="result-placeholder">◎</div><p class="muted">Run a compromise to reveal the reachable assets and their shortest hop distance.</p></div><p class="disclaimer">A model, not a scanner. Reachability follows only the directed relationships you draw.</p></aside></main>`;
function message(text) {
  $("#status").textContent = text;
}
function protect(action) {
  try {
    action();
  } catch (e) {
    message(e.message);
  }
}
function changed() {
  dirty = true;
  result = [];
  render();
}
function svgEl(tag, attrs, text) {
  const el = document.createElementNS("http://www.w3.org/2000/svg", tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  if (text !== undefined) el.textContent = text;
  return el;
}
function button(text, action, parent, cls = "") {
  const b = document.createElement("button");
  b.textContent = text;
  b.className = cls;
  b.onclick = () => protect(action);
  parent.append(b);
  return b;
}
function renderCanvas() {
  $("#edges").replaceChildren();
  $("#nodes").replaceChildren();
  $("#empty").style.display = graph.nodes.length ? "none" : "";
  for (const e of graph.edges) {
    const a = graph.nodes.find((n) => n.id === e.fromId),
      b = graph.nodes.find((n) => n.id === e.toId);
    const dx = b.x - a.x,
      dy = b.y - a.y,
      scale = Math.min(
        80 / Math.max(Math.abs(dx), 0.001),
        34 / Math.max(Math.abs(dy), 0.001),
        0.45,
      );
    const endScale = Math.min(
      85 / Math.max(Math.abs(dx), 0.001),
      39 / Math.max(Math.abs(dy), 0.001),
      0.45,
    );
    $("#edges").append(
      svgEl("path", {
        d: `M ${a.x + dx * scale} ${a.y + dy * scale} L ${b.x - dx * endScale} ${b.y - dy * endScale}`,
        class: "edge",
        "marker-end": "url(#arrow)",
      }),
    );
  }
  for (const n of graph.nodes) {
    const hit = result.find((r) => r.nodeId === n.id),
      type = TYPES[n.type];
    const g = svgEl("g", {
      transform: `translate(${n.x},${n.y})`,
      class: `node ${selected === n.id ? "selected" : ""} ${hit ? `affected depth-${Math.min(hit.depth, 2)}` : ""}`,
      "data-id": n.id,
      "data-depth": hit?.depth ?? "",
      tabindex: "0",
      role: "button",
      "aria-label": `${n.label}, ${type.label}`,
      style: `--asset:${type.color}`,
    });
    g.append(
      svgEl("rect", {
        x: -80,
        y: -34,
        width: 160,
        height: 68,
        rx: 12,
        class: "card",
      }),
      svgEl("text", { x: -65, y: 6, class: "icon" }, type.icon),
      svgEl(
        "text",
        { x: -35, y: -5, class: "node-label" },
        n.label.length > 16 ? `${n.label.slice(0, 15)}…` : n.label,
      ),
      svgEl(
        "text",
        { x: -35, y: 15, class: "node-type" },
        hit ? `DEPTH ${hit.depth}` : type.label,
      ),
    );
    g.append(
      svgEl(
        "title",
        {},
        `${n.label} (${type.label})${hit ? ` — depth ${hit.depth}` : ""}`,
      ),
    );
    const port = svgEl("g", { class: "port", "data-port": n.id });
    port.append(
      svgEl("circle", { cx: 80, cy: 0, r: 12 }),
      svgEl("text", { x: 80, y: 5, "text-anchor": "middle" }, "+"),
    );
    g.append(port);
    g.onkeydown = (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        selected = n.id;
        render();
      }
    };
    $("#nodes").append(g);
  }
}
function render() {
  renderCanvas();
  $("#counts").textContent =
    `${graph.nodes.length} assets · ${graph.edges.length} trust links`;
  $("#budget").textContent = paid
    ? "Unlimited assets"
    : `${graph.nodes.length} / 8 free assets`;
  $("#tier").textContent = paid ? "Demo Pro" : "Free tier";
  const panel = $("#selection");
  panel.replaceChildren();
  const n = graph.nodes.find((n) => n.id === selected);
  if (!n) {
    const p = document.createElement("p");
    p.className = "muted";
    p.textContent =
      "Select an asset to inspect its connections or simulate a compromise.";
    panel.append(p);
  } else {
    const label = document.createElement("label");
    label.textContent = "Asset label";
    label.htmlFor = "asset-label";
    const input = document.createElement("input");
    input.id = "asset-label";
    input.value = n.label;
    input.maxLength = 80;
    input.oninput = () => {
      graph = {
        ...graph,
        nodes: graph.nodes.map((v) =>
          v.id === n.id
            ? { ...v, label: input.value.trim() || TYPES[v.type].label }
            : v,
        ),
      };
      dirty = true;
      result = [];
      renderCanvas();
      renderResults();
    };
    panel.append(label, input);
    button(
      "Compromise",
      () => {
        result = computeBlastRadius(graph, n.id);
        render();
        message(
          `Simulation complete: ${result.length} of ${graph.nodes.length} assets affected.`,
        );
      },
      panel,
      "primary wide",
    );
    button(
      "Remove asset",
      () => {
        graph = removeNode(graph, n.id);
        selected = null;
        changed();
      },
      panel,
      "wide subtle",
    );
    const target = document.createElement("select");
    target.id = "connection-target";
    target.setAttribute("aria-label", "Connection target");
    for (const other of graph.nodes.filter((v) => v.id !== n.id)) {
      const o = document.createElement("option");
      o.value = other.id;
      o.textContent = other.label;
      target.append(o);
    }
    panel.append(target);
    button(
      "Connect selected → target",
      () => {
        if (target.value) {
          graph = addEdge(graph, n.id, target.value);
          changed();
          message("Directed trust relationship added.");
        }
      },
      panel,
      "wide",
    );
    for (const edge of graph.edges.filter((e) => e.fromId === n.id))
      button(
        `Remove → ${graph.nodes.find((v) => v.id === edge.toId).label}`,
        () => {
          graph = removeEdge(graph, edge.fromId, edge.toId);
          changed();
        },
        panel,
        "wide subtle",
      );
  }
  renderResults();
  renderScenarios();
}
function renderResults() {
  const results = $("#results");
  if (result.length) {
    const summary = summarize(graph, result);
    results.replaceChildren();
    const total = document.createElement("div");
    total.className = "total";
    total.textContent = summary.total;
    const caption = document.createElement("p");
    caption.textContent = `of ${graph.nodes.length} assets affected`;
    results.append(total, caption);
    for (const [type, count] of Object.entries(summary.byType)) {
      const row = document.createElement("div");
      row.className = "stat";
      row.textContent = `${TYPES[type].label} · ${count}`;
      results.append(row);
    }
    const note = document.createElement("p");
    note.className = "severity";
    note.textContent = summary.note;
    results.append(note);
  } else
    results.innerHTML =
      '<div class="result-placeholder">◎</div><p class="muted">Run a compromise to reveal reachable assets and their shortest hop distance.</p>';
}
function renderScenarios() {
  const list = $("#saved");
  list.replaceChildren();
  try {
    for (const s of readScenarios(localStorage)) {
      const row = document.createElement("div");
      row.className = "saved-row";
      button(`Load ${s.name}`, () => load(s.graph, s.name), row);
      button(
        "Delete",
        () => {
          deleteScenario(localStorage, s.name);
          renderScenarios();
          message(`Deleted ${s.name}.`);
        },
        row,
        "subtle",
      );
      list.append(row);
    }
  } catch {
    message(
      "Saved data could not be read. Browser storage may be unavailable or corrupted.",
    );
  }
  const listT = $("#templates");
  listT.replaceChildren();
  for (const t of templates) {
    const b = button(
      t.name,
      () => {
        if (canLoadTemplate(paid)) load(t.graph, t.name);
      },
      listT,
      "template",
    );
    b.disabled = !paid;
    b.title = paid ? "Load template" : "Requires Demo Pro";
  }
}
function load(g, name) {
  if (!paid && g.nodes.length > 8) {
    message(
      "Free tier allows 8 nodes. Activate Demo Pro to load this scenario.",
    );
    return;
  }
  if (dirty && !confirm("Replace unsaved canvas changes?")) return;
  graph = structuredClone(g);
  selected = null;
  result = [];
  dirty = false;
  $("#scenario-name").value = name;
  $("#title").textContent = name;
  render();
  message(`Loaded ${name}.`);
}
for (const [type, info] of Object.entries(TYPES)) {
  const b = button(
    `${info.icon}  ${info.label}`,
    () => {
      placing = type;
      $("#canvas").classList.add("placing");
      message(
        `Click the canvas to place a ${info.label.toLowerCase()}. Escape cancels.`,
      );
    },
    $("#assets"),
    "asset-button",
  );
  b.style.setProperty("--asset", info.color);
}
function point(e) {
  const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(
    $("#canvas").getScreenCTM().inverse(),
  );
  return {
    x: Math.max(90, Math.min(910, p.x)),
    y: Math.max(45, Math.min(605, p.y)),
  };
}
$("#canvas").addEventListener("pointerdown", (e) => {
  if (e.button !== 0) return;
  const node = e.target.closest(".node");
  if (node) {
    selected = node.dataset.id;
    const n = graph.nodes.find((v) => v.id === selected);
    gesture = {
      id: selected,
      port: !!e.target.closest(".port"),
      start: point(e),
      x: n.x,
      y: n.y,
      moved: false,
    };
    render();
  } else if (placing) {
    protect(() => {
      if (!canAddNode(paid, graph.nodes.length))
        throw Error(
          "Free tier allows 8 nodes. Activate Demo Pro for unlimited assets.",
        );
      const p = point(e);
      graph = addNode(graph, {
        id: crypto.randomUUID(),
        type: placing,
        label: TYPES[placing].label,
        ...p,
      });
      changed();
      message("Asset added. Place another, or press Escape.");
    });
  } else {
    selected = null;
    render();
  }
});
window.addEventListener("pointermove", (e) => {
  if (!gesture) return;
  const p = point(e);
  if (Math.hypot(p.x - gesture.start.x, p.y - gesture.start.y) > 3)
    gesture.moved = true;
  if (!gesture.port && gesture.moved) {
    graph = moveNode(
      graph,
      gesture.id,
      Math.max(90, Math.min(910, gesture.x + p.x - gesture.start.x)),
      Math.max(45, Math.min(605, gesture.y + p.y - gesture.start.y)),
    );
    dirty = true;
    result = [];
    renderCanvas();
  } else if (gesture.port) {
    $("#preview-edge")?.remove();
    const n = graph.nodes.find((v) => v.id === gesture.id);
    $("#edges").append(
      svgEl("path", {
        id: "preview-edge",
        d: `M ${n.x + 80} ${n.y} L ${p.x} ${p.y}`,
        class: "edge preview",
      }),
    );
  }
});
window.addEventListener("pointerup", (e) => {
  if (!gesture) return;
  const current = gesture;
  gesture = null;
  if (current.port) {
    const target = document
      .elementFromPoint(e.clientX, e.clientY)
      ?.closest(".node");
    if (target && target.dataset.id !== current.id)
      protect(() => {
        graph = addEdge(graph, current.id, target.dataset.id);
        dirty = true;
        result = [];
        message("Directed trust relationship added.");
      });
  }
  render();
});
window.addEventListener("pointercancel", () => {
  gesture = null;
  render();
});
window.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    placing = null;
    gesture = null;
    $("#canvas").classList.remove("placing");
    message("Placement cancelled.");
    render();
  }
});
window.addEventListener("beforeunload", (e) => {
  if (dirty) {
    e.preventDefault();
    e.returnValue = "";
  }
});
$("#save").onclick = () =>
  protect(() => {
    saveScenario(localStorage, $("#scenario-name").value, graph, paid);
    dirty = false;
    $("#title").textContent = $("#scenario-name").value.trim();
    renderScenarios();
    message("Scenario saved in this browser.");
  });
$("#new").onclick = () => {
  load(emptyGraph(), "Untitled scenario");
};
$("#activate").onclick = async () => {
  try {
    const key = $("#license").value.trim();
    if (!(await verifyLicense(key))) {
      message("Invalid demo license key.");
      return;
    }
    localStorage.setItem("asc.license", key);
    paid = true;
    render();
    message(
      "Demo Pro activated. Unlimited assets, scenarios and templates unlocked.",
    );
  } catch {
    message("License could not be saved. Check browser storage availability.");
  }
};
try {
  paid = await verifyLicense(localStorage.getItem("asc.license"));
} catch {
  message("Browser storage is unavailable. Changes may not be saved.");
}
render();
