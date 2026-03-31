Attack Path detail graph-front mode fix report

Files changed

- `src/pages/AttackPathDetailPage.tsx`
- `_analysis/attack_graph_ui_refinement_report.md`
- `_analysis/attack_path_detail_graph_front_mode_fix_report.md`

Exact mode-toggle design

- Added a page-local presentation state in `src/pages/AttackPathDetailPage.tsx`.
- The toggle is hero-local and supports exactly two modes:
  - `요약 보기`
  - `경로 보기`
- The toggle sits in an always-reachable hero control layer at the top-right of the hero card.
- No router state, query state, or shared graph state was introduced.

Exact graph layer vs summary layer swap behavior

- The existing hero card remains the owning surface.
- Inside that card, the page now uses three local layer owners:
  - graph layer
  - summary layer
  - control layer
- Summary-first mode
  - keeps the graph as the hero background
  - keeps the summary visually in front
  - slightly reduces graph obstruction by easing the graph opacity/tint compared with the previous full-card blocking composition
  - keeps the summary in a non-blocking overlay owner instead of a full-card foreground body
- Graph-front mode
  - raises the graph layer above the summary layer
  - lowers the summary layer behind it
  - reduces summary opacity and shifts it back visually
  - keeps the summary non-blocking so pointer interaction goes to the graph
- Left unchanged
  - graph element generation
  - Cytoscape `preset` layout
  - node positions
  - node sizes
  - label sizes
  - graph callbacks and selection IDs

Exact side detail overlay implementation for node/edge detail

- Removed the old below-hero selected-node rendering path.
- Removed the old below-hero custom selected-edge card path.
- Added a hero-scoped right-side overlay that appears only in `경로 보기`.
- Selected node detail
  - reuses `NodeDetailPanel`
  - uses dark tone
  - stays attached to the hero area
- Selected edge detail
  - is now rendered through `NodeDetailPanel` as well
  - is built locally in `AttackPathDetailPage.tsx` using:
    - a synthetic edge panel node
    - a local edge detail map
    - the existing selected edge state
  - stays attached to the same right-side hero overlay area
- Shared graph/detail components were not edited for this pass.

Exact treatment of `상세 정보`

- Did not delete `상세 정보`.
- Kept its existing collapsed/default behavior in summary-first mode.
- Hid it entirely in graph-front mode.
- Preserved its existing path-level metadata and edge metadata exposure for summary-first use.

Tradeoffs

- The side detail overlay is intentionally only shown in graph-front mode to avoid reintroducing duplicate lower detail blocks.
- The summary layer still remains faintly visible in graph-front mode rather than disappearing completely, so the hero keeps the same overall product language.
- The implementation was kept page-local instead of extracting shared hero-layer utilities, because the requested scope was a dedicated Attack Path detail page polish only.

Intentionally left untouched

- `src/pages/AttackGraphPage.tsx`
- `src/components/graph/GraphView.tsx`
- `src/components/graph/NodeDetailPanel.tsx`
- `src/components/graph/attackPathVisuals.tsx`
- router ownership
- generated hooks/models
- remediation recommendation logic
- attack-path graph generation
- preset layout and placement math
- node sizing and label sizing
- current graph color semantics

Validation

- `npx eslint src/pages/AttackPathDetailPage.tsx` passed.
- `npm run build` passed.
