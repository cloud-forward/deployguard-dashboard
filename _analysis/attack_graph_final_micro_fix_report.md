# Attack Graph Final Micro-Fix Report

## Files Changed
- `src/components/graph/attackGraph/stylesheet.ts`
- `src/components/graph/GraphView.tsx`
- `./_analysis/attack_graph_ui_refinement_report.md`
- `./_analysis/attack_graph_final_micro_fix_report.md`

## Exact Precedence Fix For Selected/Search/Chain Edge Emphasis
- The active edge styles were being declared before the generic `edge` rule and before `EDGE_RELATION_SELECTORS`, so relation-backed edges were falling back to their softened resting `width`, `opacity`, and `arrow-scale`.
- The micro-fix adds a final override block at the end of `src/components/graph/attackGraph/stylesheet.ts`, after the generic edge baseline and after relation-resting selectors.
- The late override block now reasserts active emphasis for:
  - `edge.search-match`
  - `edge.selected-neighborhood-edge`
  - `edge.selected-edge`
  - `edge.selected-chain-edge`
  - `edge.selected-chain-edge.chain-depth-1`
  - `edge.selected-chain-edge.chain-depth-2`
  - `edge.selected-chain-edge.chain-depth-3plus`
- That makes active edge emphasis win by order without changing the relation-resting model itself.

## Exact Change That Makes Selected Elements Escape The Resting Dim State
- Relation colors are preserved for selected/search/chain edges; the emphasis remains a separate channel driven by width, opacity, arrow scale, underlay, and glow.
- Updated edge emphasis values:
  - `selected-edge`: `width 4.9`, `opacity 1`, `arrow-scale 1.14`, stronger underlay/glow
  - `selected-neighborhood-edge`: `width 5`, `opacity 1`, `arrow-scale 1.14`, stronger underlay/glow
  - `search-match`: `width 4.4`, `opacity 1`, `arrow-scale 1.12`, stronger underlay/glow
  - `selected-chain-edge`: `width 4.5`, `opacity 0.98`, `arrow-scale 1.12`
  - `chain-depth-1`: `5.8 / 1 / 1.16`
  - `chain-depth-2`: `5 / 0.99 / 1.13`
  - `chain-depth-3plus`: `4.4 / 0.94 / 1.09`
- Also slightly strengthened deeper chain-node intensity only:
  - `chain-depth-2` node: `underlay-opacity 0.22`, `underlay-padding 15`, `shadow-blur 22`, `shadow-opacity 0.48`
  - `chain-depth-3plus` node: `underlay-opacity 0.14`, `underlay-padding 12`, `shadow-blur 17`, `shadow-opacity 0.32`
- Node fill still encodes resource type.
- Node border still encodes risk severity.

## Exact GraphView Focus Timing Change
- Removed the extra `200ms` pre-animation timeout inside `applyFocusHighlight()` in `src/components/graph/GraphView.tsx`.
- `onFocusHandled` now fires after `cy.animate(...)` is started, instead of firing before the delayed camera move could be cancelled by the search-to-selection handoff.
- The existing search-focus -> selected node -> right-side node detail bridge remains intact.

## Exact GraphView Zoom/Focus Strengthening Change
- Raised the base focus zoom from `1.02` to `1.1`.
- Added a bounded repeated-step zoom kick:
  - `FOCUS_REPEAT_ZOOM_DELTA = 0.08`
  - `FOCUS_MAX_KICK_ZOOM = 1.18`
- This keeps repeated next/previous stepping from feeling flat when the graph is already near the prior focus zoom.
- Set focus animation duration to `520ms` and kept the existing cubic easing.

## Whether `layout.ts` Was Touched
- No.
- `src/components/graph/attackGraph/layout.ts` was intentionally left untouched because the precedence and focus fixes were sufficient for this micro-pass.
- The optional `nodeSeparation: 320 -> 340` nudge remains available later if the graph still needs a small anti-line-collapse pass after manual review.

## Tradeoffs
- Selected edge and search-match emphasis now preserve relation colors while adding stronger width/opacity/arrow/underlay separation. This keeps semantic color information visible during emphasis instead of flattening active edges into a single neutral highlight color.
- Focus handoff is still coupled to the existing page selection bridge. The micro-fix only changed timing so the camera move lands first.
- No BFS chain logic, search result model, or panel contract was changed.

## Intentionally Left Untouched
- `src/pages/AttackGraphPage.tsx`
- `src/components/graph/NodeDetailPanel.tsx`
- `src/components/graph/GraphFilters.tsx`
- `src/components/graph/attackGraph/layout.ts`
- `src/api/attackGraph.ts`
- Generated hooks/models and all API contracts

## Validation
- `./node_modules/.bin/eslint src/components/graph/GraphView.tsx src/components/graph/attackGraph/stylesheet.ts`
- `npm run build`
- Local Cytoscape style check confirmed that relation-backed active edges now pick up the stronger active `width`, `opacity`, and `arrow-scale` instead of keeping resting values.

## Optional Later
- If manual review still shows too much line-collapse after this micro-fix, the smallest safe next tweak is `nodeSeparation: 320 -> 340` in `src/components/graph/attackGraph/layout.ts`.
