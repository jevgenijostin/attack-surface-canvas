# Attack Surface Canvas

A static tabletop exercise workspace for security teams. Model assets and directed trust relationships, compromise an asset, and explore the reachable blast radius. Vanilla JavaScript + SVG + Vite; no backend, telemetry, external fonts, or runtime data requests. The site downloads its static files; the application never contacts a real network asset.

**[Live demo](https://jevgenijostin.github.io/attack-surface-canvas/)** · [Repository](https://github.com/jevgenijostin/attack-surface-canvas)

## Why a visual interface?

Blast radius depends on relationships, not just an inventory. A node-link canvas makes the direction of trust visible, exposes paths through intermediate systems, and shows which assets remain disconnected. Teams can move assets into recognizable groups and compare shortest hop distances during a tabletop discussion without interpreting an adjacency table.

## Run locally

Use Node.js 24 and npm.

```sh
npm ci
npm run dev
```

Open the local URL printed by Vite. `npm run build` writes the static site to `dist/`; `npm run preview` serves that build. The relative Vite base supports GitHub Pages project URLs.

## Exercise workflow

1. Choose one of five asset types and click the canvas to place it. Repeat, or press Escape to exit placement mode.
2. Drag cards to reposition them. Drag a card's **+** handle onto another card to create a directed relationship: A can reach or affect B.
3. Select a card to rename it, remove it, or remove outgoing links. Keyboard users can Tab to a card and press Enter, then use the inspector's target selector and **Connect selected → target** button.
4. Click **Compromise**. Pink marks the starting asset, amber marks depth 1, and lavender marks depth 2+. Each affected card displays its exact shortest hop distance. The summary gives the affected count, type breakdown, and a count-based exposure note.
5. Save a named scenario. Saving the same name replaces it. Load or delete scenarios in the sidebar; loading a new graph asks before replacing unsaved changes.

Scenarios and the demo license live in this browser's localStorage. The current unsaved canvas is not automatically restored; save it before closing. All editing invalidates prior simulation results. Cycles terminate and each asset appears at most once, at its shortest depth. Edges are unweighted and traversal uses their insertion order to break equal-depth ties.

## Tiers and demo license

| Capability        | Free   | Demo Pro                                                |
| ----------------- | ------ | ------------------------------------------------------- |
| Assets per canvas | 8      | Unlimited by the tier gate                              |
| Saved scenarios   | 1      | Unlimited by the tier gate                              |
| Bundled templates | Locked | VPN ransomware, insider threat, supply-chain compromise |

Generate a key locally:

```sh
npm run generate-demo-license
```

Paste the printed `asc-demo-pro-v1.…` key into **Demo license settings** and activate it. Activation persists across reloads.

**This is a self-issuable demo stub, not real payment processing or secure license enforcement.** HMAC-SHA-256 signs a fixed demo payload using a deliberately public secret bundled in the source. Anyone can generate a valid key or change client-side state. There is no checkout, billing, entitlement server, expiration, or secret protection. Web Crypto requires HTTPS or localhost. “Unlimited” remains subject to device performance and browser storage quotas.

## Tests and architecture

```sh
npm test
npx playwright install chromium
npm run test:e2e
```

On Linux, use `npx playwright install --with-deps chromium` if browser dependencies are missing. Playwright builds the app and starts its own local production preview server.

- `src/graph.js`: immutable graph operations, validation, adjacency-list BFS, and deterministic summaries; no DOM or storage access.
- `src/license.js`: HMAC demo verification and pure tier-cap predicates.
- `src/storage.js`: validated named scenarios with an injected Storage interface.
- `src/main.js`: SVG rendering, pointer/keyboard interactions, and DOM orchestration.
- `src/templates.json`: three bundled fixtures, imported at build time.
- `tests/`: 28 unit cases covering graph operations, branches/cycles/disconnection/empty inputs, licenses, tier caps, and storage.
- `e2e/`: 8 Chromium scenarios covering connection gestures, compromise, caps, persistence, templates, deletion, editing, and license errors.

No application networking APIs are used. You can check with `rg -n 'fetch|XMLHttpRequest|WebSocket' src` (no matches expected). Vite's development server uses development-only tooling; the deployed `dist/` app is static.

GitHub Actions runs unit tests, builds, and Chromium e2e on both **ubuntu-latest** and **windows-latest**. After both pass on main, a separate build and deployment publish to GitHub Pages. Pages must use **GitHub Actions** as its source.

## Limitations / not built tonight

- No real scanning, exploit modeling, probability estimates, or AI severity analysis. The exposure note is a simple fraction of modeled assets, not a real risk assessment.
- No accounts, collaboration, sharing, import/export, or cloud synchronization. Clearing browser storage removes scenarios. Storage errors are surfaced without silently overwriting corrupted data.
- Fixed canvas, five asset types, and three templates; no zoom/pan, undo/redo, edge routing, edge weights, or conditional trust rules. Dense graphs and overlapping assets can become hard to read.
- Chromium is covered in CI; Firefox, Safari, and touch devices have not been certified. The layout adapts to narrow screens, but desktop is the intended modeling environment.
- No real payment integration. MIT licensed; see [LICENSE](LICENSE).
