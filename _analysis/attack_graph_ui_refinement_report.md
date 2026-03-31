# Attack Graph UI Refinement Report

## Scope

This pass stayed local to the Attack Graph / Attack Path detail polish requested after the gap analysis:
- Korean UI consistency for Attack Graph / Attack Path detail
- slight live-page search tightening
- collapsible/draggable node and edge detail panels on Attack Graph
- softer translucency for the detail panel shell and the same-page persisted Attack Path drawer

## Files Changed

- `src/pages/AttackGraphPage.tsx`
- `src/pages/AttackPathDetailPage.tsx`
- `src/components/graph/GraphFilters.tsx`
- `src/components/graph/NodeDetailPanel.tsx`
- `src/components/graph/GraphView.tsx`
- `src/components/graph/attackPathVisuals.tsx`

## What Changed

### Korean UI copy

- Localized the remaining Attack Graph page title, description, tabs, cluster label, empty/error/loading copy, search summary, mode summary, drawer labels, drawer button copy, and drawer aria labels in `src/pages/AttackGraphPage.tsx`.
- Localized Graph Controls copy, search helper text, navigator labels, filter section titles, and related aria labels in `src/components/graph/GraphFilters.tsx`.
- Localized the shared detail shell defaults and close/collapse control labels in `src/components/graph/NodeDetailPanel.tsx`.
- Localized edge hover tooltip labels in `src/components/graph/GraphView.tsx`.
- Localized threat badge labels/descriptions in `src/components/graph/attackPathVisuals.tsx`.
- Localized the remaining `Path ID` label on the dedicated Attack Path detail page in `src/pages/AttackPathDetailPage.tsx`.

Literal identifiers were intentionally preserved:
- resource names
- node IDs
- edge IDs
- path IDs
- cluster IDs
- analysis IDs
- risk values
- resource-type technical literals like `IAM`, `S3`, `RDS`

### Search tightening

Live-page search was narrowed only inside `src/pages/AttackGraphPage.tsx` `searchState`.

Kept searchable:
- nodes: `id`, `label`, `resourceType`, `namespace`
- edges: `id`, `label`, `relationType`
- paths: `id`, `label`, `path_id`

Removed from matching:
- node detail values via `Object.values(node.details ?? {})`
- serialized edge raw metadata
- path `severity`
- raw path `title`
- raw path `summary`

The search system itself was not replaced:
- tokenization unchanged
- in-place highlighting unchanged
- result navigator unchanged
- focus stepping unchanged
- chain emphasis unchanged

### Attack Graph detail panel controls

`src/components/graph/NodeDetailPanel.tsx`
- Added optional shell props for:
  - `collapsed`
  - `onToggleCollapsed`
  - `onDragHandleMouseDown`
  - `dragHandleLabel`
- Added a compact collapsed header mode with:
  - drag dots
  - title
  - current subject line
  - collapse/expand control
  - close control

`src/pages/AttackGraphPage.tsx`
- Added Attack Graph-owned detail panel state:
  - `detailPanelCollapsed`
  - `detailPanelPosition`
  - `detailPanelMaxHeight`
- Added drag refs and clamping logic scoped to the graph card.
- Reused the existing Graph Controls drag/clamp interaction pattern instead of introducing a new subsystem.
- Applied the shell behavior to both live node and live edge detail overlays.

### Translucency adjustments

`src/components/graph/NodeDetailPanel.tsx`
- Outer dark shell background: `rgba(8, 15, 32, 0.94)` -> `rgba(8, 15, 32, 0.76)`
- Header background: `rgba(15, 23, 42, 0.9)` -> `rgba(15, 23, 42, 0.68)`
- Inner summary tile: `rgba(15, 23, 42, 0.76)` -> `rgba(15, 23, 42, 0.48)`
- Blur: `blur(16px)` -> `blur(18px)`

`src/pages/AttackGraphPage.tsx`
- Same-page persisted Attack Path drawer scrim: `rgba(2, 6, 23, 0.45)` -> `rgba(2, 6, 23, 0.3)`
- Drawer background: `#0f172a` -> `rgba(15, 23, 42, 0.8)`
- Added drawer `backdropFilter: blur(18px)`
- Inner path ID card: `rgba(15, 23, 42, 0.84)` -> `rgba(15, 23, 42, 0.6)`

## What Stayed Untouched

- `src/api/attackGraph.ts`
- generated hooks/models
- Orval output
- `src/components/graph/attackGraph/adapter.ts`
- `src/components/graph/attackGraph/stylesheet.ts`
- `src/components/graph/attackGraph/layout.ts`
- router structure
- `fcose` behavior
- node fill meaning
- node border meaning
- search navigator behavior
- chain emphasis and focus logic

## Validation

Passed:
- `npx eslint src/pages/AttackGraphPage.tsx src/pages/AttackPathDetailPage.tsx src/components/graph/GraphFilters.tsx src/components/graph/NodeDetailPanel.tsx src/components/graph/GraphView.tsx --max-warnings=0`
- `npx tsc -b`

Observed but not addressed in this scoped pass:
- `npm run lint` fails on multiple pre-existing repo-wide lint issues outside the allowed scope.
- `npm run build` fails on an existing Vite/Rolldown resolution problem for `cytoscape-dagre` imported by `src/components/graph/GraphView.tsx`. The TypeScript compile step completed before that bundler failure.

## Tradeoffs

- Drag/collapse was implemented only for the live Attack Graph node/edge overlays. The dedicated Attack Path detail page keeps its existing inline selected-node/selected-edge layout in this pass to avoid a broader layout rewrite.
- Shared shell translucency was updated through `NodeDetailPanel`, so dark-tone detail shells become lighter consistently without changing graph semantics.
