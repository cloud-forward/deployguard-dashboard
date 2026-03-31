Attack Path detail/layout polish fix report

Files changed

- `src/pages/AttackGraphPage.tsx`
- `src/pages/AttackPathDetailPage.tsx`

Exact sticky-header implementation

- Kept the existing Attack Path table `table-responsive` wrapper as the only local scroll owner.
- Added a narrow local `stickyHeaderCellStyle` in `src/pages/AttackGraphPage.tsx`.
- Applied that style only to the Attack Path table header cells for:
  - `위험도 점수`
  - `위험`
  - `시작 노드`
  - `목표 자산`
  - `단계`
  - `상세`
- The sticky style uses:
  - `position: sticky`
  - `top: 0`
  - `z-index: 2`
  - dark opaque background
  - subtle bottom/shadow separation
  - blur for readability in the existing dark palette

Exact rename from `상세` to `상세 보기`

- Changed only the visible route-link text in `src/pages/AttackGraphPage.tsx`.
- Route target and button styling were left unchanged.
- No extra accessibility machinery was added because the link already derives its accessible name from the visible text.

Exact dedicated detail-page heading/top-row change

- Added the shared page-heading structure at the top of `src/pages/AttackPathDetailPage.tsx` using the existing dashboard page-shell/header classes already used elsewhere in the app.
- Added:
  - `공격 그래프`
  - `선택한 클러스터의 연결 자산과 저장된 공격 경로를 확인합니다.`
- Moved `공격 그래프로 돌아가기` out of the hero card and into that new top row on the right.
- Kept the success-state route params, generated detail fetching, remediation loading, and section order below the hero intact.

Exact move of the graph into the hero/background composition

- Removed the standalone normal-flow `공격 경로 시각화` section from below the hero.
- Re-homed the existing `GraphView` instance into the hero card as an absolutely positioned background-like layer.
- Kept the same graph props, graph elements, layout, selection wiring, and click handlers.
- Added a non-interactive dark scrim above the graph layer to preserve readability.
- Kept the summary surfaces above the graph as overlays:
  - the new `공격 경로 상세` heading block with path ID chip
  - the existing risk metric cards
  - the existing `시작 노드 및 목표 자산` identity block
- Strengthened those overlay surfaces slightly with blur/shadow while keeping the current dark DeployGuard visual language.

Tradeoffs

- Sticky header styling was kept local in `src/pages/AttackGraphPage.tsx` instead of extracted to `src/App.css` to avoid widening scope.
- The hero graph remains interactive only in the visible uncovered area behind the overlays. This keeps the composition small and avoids changing `GraphView` internals.
- The detail-page fallback and error states were left structurally unchanged except for preserving the existing back-link behavior.

Anything intentionally left untouched

- persisted attack path route ownership
- generated hooks/models
- `src/api/attackGraph.ts`
- `src/components/graph/GraphView.tsx`
- `src/components/graph/attackPathVisuals.tsx`
- Attack Graph live graph-mode interactions
- graph element creation and attack-path graph logic
- remediation recommendation fetching logic

Validation

- `npx eslint src/pages/AttackGraphPage.tsx src/pages/AttackPathDetailPage.tsx` passed.
- `npm run build` passed.
