Attack Graph UI refinement report

Scope

- This update was limited to the Attack Graph page's persisted Attack Path tab final polish.
- Code changes were restricted to:
  - `src/pages/AttackGraphPage.tsx`

Implemented changes

- Removed the in-page Attack Path detail panel path
  - Deleted the local `AttackPathDetailPanel` implementation that previously lived inside `src/pages/AttackGraphPage.tsx`.
  - Removed the generated persisted-detail hook import that was only used by that in-page panel.
  - Removed the Attack Path tab-only row-selection state and conditional panel mount.
  - Removed row click opening behavior and row-selected/button-like affordances that only existed to support the in-page panel.
- Preserved the separate full-page detail route
  - Kept the table `Link` to `/clusters/{clusterId}/attack-paths/{pathId}`.
  - Renamed the visible action label from `보기` to `상세`.
- Tightened combined sorting
  - Kept the existing two local sort directions: risk score and hop count.
  - Made the comparator explicit in this order:
    1. risk score by selected direction
    2. hop count by selected direction
    3. risk severity aligned with the selected risk-score direction
    4. `path_id` lexical order
  - Updated sort-button accessibility text to describe the current primary/secondary sort behavior more explicitly.
- Added internal scrolling to the Attack Path table region
  - Kept the card header/title/count outside the scroll area.
  - Made the existing Attack Path `table-responsive` wrapper the local scroll owner with a local `max-height`, `overflow: auto`, and contained overscroll.

Preserved behavior

- The separate full-page Attack Path detail route remains intact.
- Risk score display formatting was left unchanged.
- Badge colors and current localized table structure were left unchanged.
- Persisted attack path data still uses the generated hooks/models already in place.
- Live graph interaction logic, graph-mode node/edge detail panels, router structure, and `src/api/attackGraph.ts` were left untouched.

Tradeoffs

- The sort UI still uses two independent toggles instead of introducing a more complex multi-column sort framework. That was intentional to keep this pass small and local.
- The table scroll rule was kept local to `AttackGraphPage.tsx` instead of extracted to `src/App.css` because no shared styling was needed.

Validation

- `npx eslint src/pages/AttackGraphPage.tsx` passed.
- `npm run build` passed.

Attack Path detail/layout polish follow-up

- This follow-up stayed within:
  - `src/pages/AttackGraphPage.tsx`
  - `src/pages/AttackPathDetailPage.tsx`
- Attack Graph persisted Attack Path table
  - Kept the existing `table-responsive` wrapper as the only local scroll owner.
  - Made only the header cells sticky with local inline `th` styles:
    - `position: sticky`
    - `top: 0`
    - raised `z-index`
    - dark opaque background
    - subtle separator/shadow for readability
  - Renamed the row action link text from `상세` to `상세 보기`.
- Dedicated Attack Path detail page
  - Added the shared page-heading language above the hero:
    - `공격 그래프`
    - `선택한 클러스터의 연결 자산과 저장된 공격 경로를 확인합니다.`
  - Moved `공격 그래프로 돌아가기` from the hero metrics row into that top page row.
  - Kept the existing hero card, but added an in-hero path-specific heading block for `공격 경로 상세` plus the current path ID chip.
  - Re-homed the existing `GraphView` attack-path visualization into the hero card as an absolute background-like layer.
  - Kept the metrics and the `시작 노드 및 목표 자산` surface above the graph as translucent overlays using the current dark/red palette.
  - Removed the standalone normal-flow `공격 경로 시각화` section after the graph moved into the hero.
- Intentionally left untouched
  - persisted route ownership
  - generated hooks/models
  - `src/api/attackGraph.ts`
  - `src/components/graph/GraphView.tsx`
  - `src/components/graph/attackPathVisuals.tsx`
  - Attack Graph live graph-mode interactions
- Validation for this follow-up
  - `npx eslint src/pages/AttackGraphPage.tsx src/pages/AttackPathDetailPage.tsx` passed.
  - `npm run build` passed.

Dedicated Attack Path detail graph-front polish

- This pass was intentionally limited to:
  - `src/pages/AttackPathDetailPage.tsx`
- No shared graph files, router files, generated API files, or Attack Graph page files were edited.
- Added a page-local two-mode presentation toggle inside the existing hero:
  - `요약 보기`
  - `경로 보기`
- Reworked the hero into three local layers owned by `AttackPathDetailPage.tsx`:
  - graph layer
  - summary layer
  - always-reachable control layer
- Summary-first mode
  - Kept the graph in the hero background.
  - Reduced obstruction slightly by easing graph dimming/tint.
  - Moved the summary into a non-blocking overlay owner instead of a full-card foreground body.
- Graph-front mode
  - Brings the graph above the summary overlay with unchanged graph elements, preset layout, node sizes, label sizes, and selection callbacks.
  - Recedes the summary visually with lower opacity and lower z-order.
  - Keeps the summary non-blocking so graph interaction remains available.
- Selection detail handling
  - Removed the old below-hero selected-node panel.
  - Removed the old below-hero custom selected-edge card.
  - Added a hero-scoped right-side overlay in graph-front mode only.
  - Reused `NodeDetailPanel` for selected-node detail.
  - Converted selected-edge detail to the same overlay family locally by building a small panel node plus edge detail map in `AttackPathDetailPage.tsx`.
- `상세 정보`
  - Kept the section and its current collapsed/default behavior in summary-first mode.
  - Hid it in graph-front mode.
  - Left all path-level backend metadata exposure intact in summary-first mode.
- Preserved
  - persisted route ownership
  - current queries/fetching
  - remediation recommendation logic
  - attack-path graph element generation
  - preset layout and node positions
  - current node sizing and label sizing
  - current graph color semantics
- Validation for this pass
  - `npx eslint src/pages/AttackPathDetailPage.tsx` passed.
  - `npm run build` passed.

Dedicated Attack Path detail summary/graph swap implementation

- This implementation pass stayed tightly scoped to:
  - `src/pages/AttackPathDetailPage.tsx`
  - `src/pages/AttackGraphPage.tsx`
- `src/pages/AttackGraphPage.tsx` was touched only because the new top action `공격 패스로 돌아가기` needed a real landing path to the Attack Path tab. The page now reads and writes a tiny `?tab=attack-paths` URL hint instead of relying on in-memory tab state.
- Dedicated page changes in `src/pages/AttackPathDetailPage.tsx`
  - Kept the existing hero as the single owner of:
    - graph layer
    - summary layer
    - control layer
    - graph-front detail overlay
  - Implemented a true animated summary-first vs graph-front swap by changing only page-local composition:
    - summary-first:
      - graph interaction disabled
      - graph opacity reduced
      - graph blurred/dimmed
      - stronger dark scrim
      - summary surfaces remain fully readable and visually forward
    - graph-front:
      - graph interaction restored
      - graph opacity/clarity increased
      - graph tint relaxed
      - summary layer pushed back with very low opacity, blur, and scale/translate recession so it no longer competes
  - Kept graph generation, preset layout, node size, node placement, label size, and click selection IDs unchanged.
  - Added a right-side hero overlay for both selected node and selected edge detail in graph-front mode only.
  - Reused `NodeDetailPanel` for both node and edge detail without editing the shared component.
  - Added page-local panel dragging and collapse/minimize behavior using local refs/state and hero-bounded clamping.
  - Increased overlay panel width slightly for the dedicated single-path context.
  - Added a second top action beside `공격 그래프로 돌아가기`:
    - `공격 패스로 돌아가기`
  - Polished the in-hero `요약 보기` / `경로 보기` controls locally with a stronger capsule, active-state treatment, and animated transitions while keeping the existing DeployGuard button language.
  - Aligned dedicated-page resource/type badges with Attack Graph colors locally by replacing page usage of `NodeTypeBadge` / `NodeIdentity` with page-local badge/identity wrappers that source colors from `getAttackGraphNodeTypeStyle`.
  - Kept the lower `상세 정보` accordion intact and still hidden in graph-front mode.
- Validation for this pass
  - `npx eslint src/pages/AttackPathDetailPage.tsx src/pages/AttackGraphPage.tsx` passed.
  - `npm run build` passed.
