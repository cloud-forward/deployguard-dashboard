Attack Path detail summary/graph swap fix report

Files changed

- `src/pages/AttackPathDetailPage.tsx`
- `src/pages/AttackGraphPage.tsx`

Why `src/pages/AttackGraphPage.tsx` was necessary

- The new top action `공격 패스로 돌아가기` needed to land on the existing Attack Graph page with the Attack Path tab already active.
- The Attack Graph page previously owned that tab only in local component state.
- The smallest safe fix was a tiny URL-hint behavior:
  - read `?tab=attack-paths`
  - write `?tab=attack-paths` when the Attack Path tab is selected
  - fall back to the existing graph tab when the hint is absent
- No route redesign, router edit, or broader Attack Graph behavior change was introduced.

Exact summary-first / graph-front swap behavior

- The hero remains the single local owner of:
  - graph layer
  - summary layer
  - control layer
  - graph-front detail overlay
- Summary-first mode:
  - graph remains inside the hero
  - graph pointer interaction is disabled
  - graph opacity is reduced
  - graph is blurred, dimmed, and slightly scaled back
  - the scrim is stronger and darker
  - summary surfaces stay fully readable and visually dominant
- Graph-front mode:
  - graph pointer interaction is enabled
  - graph opacity, clarity, and saturation are restored
  - graph tint relaxes so the graph reads as the focal layer
  - summary is pushed backward with:
    - very low opacity
    - blur
    - scale/translate recession
    - lower z-order
  - summary remains present as atmospheric context but does not materially compete with the graph

Exact animation/composition strategy

- This pass used page-local composition only in `src/pages/AttackPathDetailPage.tsx`.
- The transition channels are:
  - `opacity`
  - `transform`
  - `filter`
  - `background`
  - `border-color`
  - `box-shadow`
  - `pointer-events`
  - `z-index`
- The graph layer transitions between:
  - summary mode: dimmed / blurred / background-like
  - graph mode: clear / forward / interactive
- The summary layer transitions between:
  - summary mode: full opacity and strong glass surfaces
  - graph mode: deep recession with low opacity and blur
- The graph itself was not regenerated differently, and no graph logic or layout math changed.

Exact side detail overlay behavior for node and edge detail

- In graph-front mode only, selected node and selected edge detail now render as a right-side hero overlay.
- Node detail:
  - still uses `NodeDetailPanel`
  - uses the existing selected-node state and selected-node lookup already owned by `AttackPathDetailPage.tsx`
- Edge detail:
  - still uses `NodeDetailPanel`
  - uses the existing selected-edge state and selected-edge detail map already owned by `AttackPathDetailPage.tsx`
  - keeps the local synthetic panel-node pattern for edge rendering
- The panel width is slightly larger than before for dedicated single-path readability.
- There is no separate below-hero selected node/edge detail path in this pass; the graph-front overlay is the active selection-detail surface.

Exact minimize/collapse and drag behavior

- Implemented page-locally in `src/pages/AttackPathDetailPage.tsx`.
- No shared `NodeDetailPanel.tsx` edit was needed because the shared panel already supported:
  - collapse
  - collapse toggle callback
  - drag-handle mouse-down callback
- Behavior:
  - panel appears attached to the right side by default
  - user can drag it within the hero bounds
  - drag position is clamped to the hero area
  - panel can be collapsed/minimized
  - panel max height adapts to hero size and drag position
  - switching out of graph-front mode resets the temporary collapsed state

Exact top action-area button addition

- Kept the existing top action:
  - `공격 그래프로 돌아가기`
- Added:
  - `공격 패스로 돌아가기`
- Both live in the same existing page-header action slot and use the same DeployGuard action-button language.
- `공격 패스로 돌아가기` now links to:
  - `/clusters/:clusterId/graph?tab=attack-paths`

Exact `요약 보기` / `경로 보기` polish

- Kept the controls hero-local.
- Kept the existing two labels:
  - `요약 보기`
  - `경로 보기`
- The polish stayed local to `AttackPathDetailPage.tsx`:
  - stronger blurred capsule shell
  - richer active button treatment
  - local shadows/borders
  - animated state transitions tied to the presentation mode
- No global button-class redesign was introduced.

Exact type-color alignment approach

- Kept the solution page-local.
- Did not edit `src/components/graph/attackPathVisuals.tsx`.
- Replaced dedicated-page usage of shared `NodeTypeBadge` / `NodeIdentity` with page-local equivalents that:
  - preserve the same badge labels like `POD`, `SVC`, `IAM`
  - source color from `getAttackGraphNodeTypeStyle`
- This aligned the dedicated page with the Attack Graph node color system without creating a third badge language.

Exact treatment of `상세 정보`

- `상세 정보` was not deleted.
- It remains available in summary-first mode.
- It remains hidden in graph-front mode.
- The existing path-level metadata it exposes was preserved:
  - generated time
  - cluster ID
  - path ID
  - analysis run ID
  - raw risk value
  - raw edge IDs
  - raw edge metadata blocks

Any tradeoffs

- `src/pages/AttackGraphPage.tsx` needed a tiny complementary change because the new return action would otherwise always land on the graph tab, not the Attack Path tab.
- Badge alignment was implemented locally on the dedicated page rather than changing the shared attack-path badge component. That kept scope narrow, but it means full cross-page badge alignment is still a separate choice if desired later.
- The graph-front summary layer still exists visually at very low opacity for atmospheric continuity. It is intentionally not a hard hide, but it is now effectively non-competing.

Anything intentionally left untouched

- route ownership
- current detail fetching
- remediation recommendation logic
- graph element generation
- preset layout
- node positions
- node sizes
- label sizes
- graph callbacks
- selection ID ownership
- `src/components/graph/GraphView.tsx`
- `src/components/graph/NodeDetailPanel.tsx`
- `src/components/graph/attackPathVisuals.tsx`
- router structure
- Orval / generated API contracts

Validation

- `npx eslint src/pages/AttackPathDetailPage.tsx src/pages/AttackGraphPage.tsx`
- `npm run build`
