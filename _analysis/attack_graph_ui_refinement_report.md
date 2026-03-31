# Attack Graph UI Refinement Report

## Scope Preserved
- Repository: `deployguard-dashboard`
- Screen: `Attack Graph`
- Stack preserved: React + TypeScript + Cytoscape
- Data model preserved:
  - live graph uses `src/api/attackGraph.ts`
  - persisted attack paths use generated hooks/models
- No Orval regeneration
- No API contract changes
- No layout-family change away from `fcose`

## Final Pass Files Changed
- `src/pages/AttackGraphPage.tsx`
- `src/components/graph/NodeDetailPanel.tsx`
- `src/components/graph/GraphView.tsx`
- `src/components/graph/attackGraph/stylesheet.ts`
- `src/components/graph/attackGraph/layout.ts`

## Final Pass Refinements

### Search Focus Opens Node Detail
- Search result focus continues to use the existing `focusNodeId` / `focusRequestKey` path into `GraphView`.
- `GraphView` now reports handled focus back through `onFocusHandled`.
- `AttackGraphPage` bridges that callback into the existing right-panel selection state by clearing path/edge selection and setting `selectedNodeId`.
- This means a search-focused node now opens the same node detail panel state as a direct node click.
- For edge and path search hits, the existing focus proxy node is reused:
  - edge hit -> focused source node becomes the inspected node
  - path hit -> focused first path node becomes the inspected node
- Clicking the same node again still toggles the node selection off.

### Node Detail Rendering Stays Plain
- Kept the shared dark detail shell and scrolling behavior.
- Simplified nested rich-value rendering in `NodeDetailPanel`:
  - removed accent-colored nested labels
  - kept only muted labels, plain stacked values, and light left rules for nesting depth
  - kept arrays as simple numbered rows instead of decorative sub-boxes
- Node detail and edge detail now stay in the same plain visual family.

### Stronger BFS Chain Emphasis
- Kept the existing BFS-based incoming/outgoing chain collection in `GraphView`.
- Applied chain classes inside a single Cytoscape batch update to keep class transitions coherent:
  - `selected-node`
  - `selected-chain-node`
  - `selected-chain-edge`
  - `chain-depth-1`
  - `chain-depth-2`
  - `chain-depth-3plus`
- Strengthened the visual read in `stylesheet.ts` without changing node fill semantics or node border severity semantics:
  - selected node now relies on larger underlay and stronger glow instead of border overrides
  - chain nodes use stronger depth-banded underlay/shadow values
  - chain edges use much larger width, stronger glow, and larger arrow scale while preserving relation colors

### Sequential Feel Without Heavy Animation
- Did not add a timer-driven chain wave.
- Added short Cytoscape transitions plus depth-band delays:
  - node and edge styles now transition opacity / glow / width related properties
  - depth-1, depth-2, and depth-3plus classes use increasing `transition-delay`
- This creates a deterministic stepped emphasis feel when a node is selected:
  - selected node lights first
  - near edges and nodes come up next
  - deeper chain segments settle in after that

### Quieter Resting Edges
- Reduced the default resting edge baseline to:
  - `width: 1.2`
  - `opacity: 0.22`
  - `arrowScale: 0.88`
- Added `toRestingEdgeStyle()` so each relation keeps its current color but gets a quieter resting width / opacity / arrow scale.
- Selected edge, selected chain, search match, and path-active states were not softened.

### Final `fcose` Spacing Nudge
- Kept `fcose`.
- Increased:
  - `nodeSeparation` from `280` to `320`
  - `idealEdgeLength` to `460 / 590 / 730` by degree band
- This is the final modest spacing pass to reduce line-like collapses without changing the graph paradigm.

## Validation
- `pnpm exec eslint src/pages/AttackGraphPage.tsx src/components/graph/NodeDetailPanel.tsx src/components/graph/GraphView.tsx src/components/graph/attackGraph/stylesheet.ts src/components/graph/attackGraph/layout.ts`
- `pnpm build`

## Tradeoffs And Intentional Deferrals
- Search-focus auto-open intentionally reuses the existing focus proxy node for edge/path hits instead of inventing a second detail model.
- The sequential chain feel is style-transition based, not a scripted animation wave, to avoid state complexity and highlight conflicts.
- Edge selection still uses the existing single-edge detail behavior; click-again toggle-off was preserved only for node selection.
- The Vite build still reports the pre-existing large-chunk warning; no bundling work was included in this pass.

## Final Micro-Fix Update

### Files Changed In The Micro-Fix
- `src/components/graph/attackGraph/stylesheet.ts`
- `src/components/graph/GraphView.tsx`
- `./_analysis/attack_graph_ui_refinement_report.md`
- `./_analysis/attack_graph_final_micro_fix_report.md`

### Exact Selected/Search/Chain Edge Precedence Fix
- Added a final edge-emphasis override block at the end of `src/components/graph/attackGraph/stylesheet.ts`, after:
  - the generic `edge` rule
  - `EDGE_RELATION_SELECTORS`
  - `edge.path-active`
- That late block now reasserts active-state values for:
  - `edge.search-match`
  - `edge.selected-neighborhood-edge`
  - `edge.selected-edge`
  - `edge.selected-chain-edge`
  - `edge.selected-chain-edge.chain-depth-1`
  - `edge.selected-chain-edge.chain-depth-2`
  - `edge.selected-chain-edge.chain-depth-3plus`
- This fixes the confirmed bug where width / opacity / arrow-scale were being overwritten by later resting relation rules.

### Exact Change That Makes Selected Elements Escape The Resting State
- Relation-backed selected/search/chain edges now keep their relation color but visibly leave the softened resting state:
  - selected chain base: `width 4.5`, `opacity 0.98`, `arrow-scale 1.12`
  - depth-1: `5.8 / 1 / 1.16`
  - depth-2: `5 / 0.99 / 1.13`
  - depth-3+: `4.4 / 0.94 / 1.09`
- Also strengthened deeper chain-node emphasis slightly without changing node fill or severity border semantics:
  - depth-2 node underlay/shadow: `0.22 / 15 / 22 / 0.48`
  - depth-3+ node underlay/shadow: `0.14 / 12 / 17 / 0.32`

### Exact Search Focus Strengthening
- In `src/components/graph/GraphView.tsx`:
  - removed the extra `200ms` focus timeout before `cy.animate`
  - raised base focus zoom from `1.02` to `1.1`
  - added a bounded repeated-step kick using:
    - `FOCUS_REPEAT_ZOOM_DELTA = 0.08`
    - `FOCUS_MAX_KICK_ZOOM = 1.18`
  - set focus animation duration to `520ms`
  - moved `onFocusHandled` so it fires after the camera animation is started, not before
- This preserves the current search navigator and current detail-panel bridge while restoring a stronger visible refocus step.

### Layout Status
- `src/components/graph/attackGraph/layout.ts` was intentionally left untouched in the micro-fix.
- The two primary regressions were fixed without needing the optional `nodeSeparation` nudge.

### Micro-Fix Validation
- `./node_modules/.bin/eslint src/components/graph/GraphView.tsx src/components/graph/attackGraph/stylesheet.ts`
- `npm run build`

### Intentionally Left Untouched
- `src/pages/AttackGraphPage.tsx`
- `src/components/graph/NodeDetailPanel.tsx`
- `src/components/graph/GraphFilters.tsx`
- `src/components/graph/attackGraph/layout.ts`
- All API contracts and generated model/hook boundaries

## Final Tiny Fix Update

### Files Changed
- `src/pages/AttackGraphPage.tsx`
- `src/components/graph/GraphView.tsx`
- `src/components/graph/attackGraph/layout.ts`
- `./_analysis/attack_graph_ui_refinement_report.md`
- `./_analysis/attack_graph_final_tiny_fix_report.md`

### Exact Focus-Zoom Reduction
- In `src/components/graph/GraphView.tsx`, lowered `FOCUS_TARGET_ZOOM` from `1.1` to `1.08`.
- Left the existing focus kick structure intact:
  - `FOCUS_REPEAT_ZOOM_DELTA = 0.08`
  - `FOCUS_MAX_KICK_ZOOM = 1.18`
  - `FOCUS_ANIMATION_DURATION_MS = 520`
  - easing remains `ease-in-out-cubic`
  - focus pulse timing remains unchanged

### Exact Change That Keeps Next/Previous In Focus-Only Mode
- In `src/pages/AttackGraphPage.tsx`, added `searchStepFocusOnlyRef`.
- `focusSearchResult()` now marks navigator-driven focus before clearing:
  - `selectedNodeId`
  - `selectedEdgeId`
  - `selectedPathId`
- `handleSearchFocusHandled()` now consumes that flag and returns early for navigator stepping, so the newly focused result is not promoted into `selectedNodeId`.
- Result:
  - next/previous still moves focus
  - stepped results do not auto-open node detail
  - stepped results do not auto-enter selected-chain mode

### Exact Change That Prevents Prior Clicked-Node Emphasis From Persisting
- The prior clicked selection is still cleared first in `focusSearchResult()`.
- The new part is that navigator stepping no longer recreates selection state in `handleSearchFocusHandled()`.
- Direct graph clicks still explicitly clear the navigator-step flag and preserve the existing inspected-node / inspected-edge behavior.

### Exact Low-Degree `fcose` Tweak
- In `src/components/graph/attackGraph/layout.ts`, changed the low-degree `idealEdgeLength` branch:
  - `460 -> 400`
- Left all other `fcose` family choices unchanged in this pass:
  - layout family stays `fcose`
  - no gravity change
  - no repulsion change
  - no randomize change
  - no paradigm change

### Validation
- `npx eslint src/pages/AttackGraphPage.tsx src/components/graph/GraphView.tsx src/components/graph/attackGraph/layout.ts`
- `npm run build`
- `npm run lint -- src/pages/AttackGraphPage.tsx src/components/graph/GraphView.tsx src/components/graph/attackGraph/layout.ts`
  - this still executes the repo-wide `eslint .` script from `package.json`, so it reports unrelated pre-existing lint failures outside the Attack Graph files changed here

### Intentionally Left Untouched
- `src/components/graph/attackGraph/stylesheet.ts`
- `src/components/graph/NodeDetailPanel.tsx`
- `src/components/graph/GraphFilters.tsx`
- `src/components/graph/attackGraph/adapter.ts`
- `src/api/attackGraph.ts`
- generated hooks/models and Orval output
