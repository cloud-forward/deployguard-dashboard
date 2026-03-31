# Attack Graph Final Pass Fix Report

## Files Changed
- `src/pages/AttackGraphPage.tsx`
- `src/components/graph/NodeDetailPanel.tsx`
- `src/components/graph/GraphView.tsx`
- `src/components/graph/attackGraph/stylesheet.ts`
- `src/components/graph/attackGraph/layout.ts`

## Search Focus -> Node Detail Opening
- `AttackGraphPage.tsx` now passes `onFocusHandled` into `GraphView`.
- `GraphView` already knows when a search focus request resolves through `applyFocusHighlight()`, so it now remains the single source of truth for "focus succeeded for node X".
- `handleSearchFocusHandled()` in `AttackGraphPage.tsx` maps that resolved focus back into the existing right-side selection model:
  - clear `selectedPathId`
  - clear `selectedEdgeId`
  - set `selectedNodeId` to the focused node
- This produces the same node-detail state as a normal graph node click.
- Exact behavior for proxy search results:
  - node result: open that node
  - edge result: open the existing focus proxy source node
  - path result: open the existing focus proxy first path node

## Default Edge Softening
- `stylesheet.ts` changed the baseline default edge style to:
  - `width: 1.2`
  - `opacity: 0.22`
  - `arrowScale: 0.88`
- Added `toRestingEdgeStyle()` to soften every relation's resting width / opacity / arrow scale while preserving the exact existing relation colors.
- Selected edge, selected chain, path-active, and search-match states were left strong.

## Stronger Chained Emphasis
- `GraphView.tsx` keeps the BFS chain collection and applies selection classes in a batched Cytoscape update.
- `stylesheet.ts` strengthens the selected chain with separate emphasis channels:
  - selected node: stronger underlay + glow
  - chain nodes: stronger depth-banded underlay + glow
  - chain edges: much thicker widths, brighter glow, larger arrow scale
- Exact selected-chain edge widths:
  - base selected chain edge: `4.1`
  - depth 1: `5.4`
  - depth 2: `4.7`
  - depth 3+: `4.0`
- Relation colors remain intact on chain edges; readability comes from width, opacity, underlay, glow, and depth-band treatment.

## Sequential Feel Without Heavy Animation
- No timer-heavy wave system was added for chain emphasis.
- Sequential feel is achieved with:
  - BFS depth classes already produced by `GraphView`
  - Cytoscape transition properties on nodes and edges
  - increasing `transition-delay` by depth band
- Exact delays:
  - edge depth 1: `35ms`
  - node depth 1: `70ms`
  - edge depth 2: `115ms`
  - node depth 2: `150ms`
  - edge depth 3+: `195ms`
  - node depth 3+: `230ms`
- Result: root node appears first, near chain segments settle next, deeper chain segments follow, without introducing animation-state complexity.

## Click-Again Toggle-Off
- `handleGraphNodeClick()` in `AttackGraphPage.tsx` keeps node toggle-off behavior:
  - clicking a selected node again sets `selectedNodeId` to `null`
- Because chain emphasis is derived entirely from `selectedNodeId`, clicking the same node again removes the full chain emphasis state.

## Node Detail Consistency
- `NodeDetailPanel.tsx` keeps the current shared shell and scrolling model.
- Rich nested content rendering was flattened further:
  - muted nested labels only
  - simple numbered array rows
  - light left-rule nesting only
  - no inner-box clutter reintroduced

## Final Spacing Change
- `layout.ts` keeps `fcose` and applies one more modest spacing increase:
  - `nodeSeparation: 320`
  - `idealEdgeLength: 460 / 590 / 730` by degree band
- No other layout family or decorative arrangement change was introduced.

## Tradeoffs
- Search focus auto-open still depends on the current repository-grounded focus proxy for edge/path results rather than inventing a new detail abstraction.
- Border severity semantics were preserved by moving selected-node emphasis to glow / underlay instead of border overrides.
- The focus blink behavior already present in `GraphView` was left intact; the sequential chain feel was added only through class-based transitions.

## Intentionally Deferred
- No changes to `src/api/attackGraph.ts`
- No changes to generated attack-path hooks/models
- No changes to `GraphFilters.tsx`
- No Orval regeneration
- No bundling / chunk-splitting work for the existing Vite large-chunk warning

## Verification
- `pnpm exec eslint src/pages/AttackGraphPage.tsx src/components/graph/NodeDetailPanel.tsx src/components/graph/GraphView.tsx src/components/graph/attackGraph/stylesheet.ts src/components/graph/attackGraph/layout.ts`
- `pnpm build`
