# Attack Graph Korean Panel Polish Fix Report

## Files changed

- `src/pages/AttackGraphPage.tsx`
- `src/pages/AttackPathDetailPage.tsx`
- `src/components/graph/GraphFilters.tsx`
- `src/components/graph/NodeDetailPanel.tsx`
- `src/components/graph/GraphView.tsx`
- `src/components/graph/attackPathVisuals.tsx`

## Exact Korean UI copy changes

### `src/pages/AttackGraphPage.tsx`

- `Attack Graph` -> `공격 그래프`
- `Inspect connected resources and persisted attack paths across the selected cluster.` -> `선택한 클러스터의 연결 자산과 저장된 공격 경로를 확인합니다.`
- `Graph` -> `그래프`
- `Attack Paths` -> `공격 경로`
- `Cluster` -> `클러스터`
- `No clusters available` -> `사용 가능한 클러스터가 없습니다`
- cluster/load/error/empty helper copy converted to Korean
- same-page persisted drawer copy converted to Korean:
  - `Attack Path Detail`
  - `Entry`
  - `Target`
  - `Selected Path`
  - loading/error/empty text
  - `Retry`
  - `Path ID`
  - `Hop Count`
  - `Raw Final Risk`
  - `Node IDs`
  - `Edge IDs`
- bottom summary copy converted to Korean:
  - search summary
  - mode summary
  - count summary
- edge detail table keys converted:
  - `Relation` -> `관계`
  - `Source` -> `출발`
  - `Target` -> `도착`
  - `Label` -> `레이블`
  - `Reason` -> `사유`

### `src/components/graph/GraphFilters.tsx`

- `Graph Controls` -> `그래프 컨트롤`
- helper copy localized
- `Reset` -> `초기화`
- expand/collapse aria labels localized
- `Search` -> `검색`
- search placeholder localized
- search helper and navigator fallback localized
- previous/next search result aria labels localized
- `Resource Type` -> `리소스 유형`
- `Risk Border` -> `위험도 테두리`
- `Edge Relation` -> `엣지 관계`

### `src/components/graph/NodeDetailPanel.tsx`

- default title `Node Detail` -> `노드 상세 정보`
- default description `Selected node details` -> `선택한 노드의 세부 정보입니다.`
- close aria label `Close` -> `닫기`
- collapse/expand aria labels added in Korean
- drag handle tooltip added in Korean

### `src/components/graph/GraphView.tsx`

- hover tooltip `Source` -> `출발`
- hover tooltip `Target` -> `도착`

### `src/components/graph/attackPathVisuals.tsx`

- `Privilege Escalation` -> `권한 상승`
- `IAM privilege escalation path` -> `IAM 권한 상승 경로`
- `Data Exfiltration` -> `데이터 유출`
- `Access path to S3 data` -> `S3 데이터 접근 경로`
- `Database Access` -> `데이터베이스 접근`
- `Reachability to database asset` -> `데이터베이스 자산 도달 경로`

### `src/pages/AttackPathDetailPage.tsx`

- `Path ID` -> `경로 ID`

## Exact search-tightening change

Changed only the live-page search field selection in `src/pages/AttackGraphPage.tsx`.

Now searchable:
- nodes: `id`, `label`, `resourceType`, `namespace`
- edges: `id`, `label`, `relationType`
- paths: `id`, `label`, `path_id`

Removed from search matching:
- node detail blobs from `Object.values(node.details ?? {})`
- serialized edge raw metadata
- raw path `severity`
- raw path `title`
- raw path `summary`

Kept intact:
- tokenization
- search navigator
- search focus stepping
- in-place highlight model
- path/chain emphasis behavior

## Exact collapse/minimize design for node/edge detail panels

Implemented in:
- shell: `src/components/graph/NodeDetailPanel.tsx`
- state ownership: `src/pages/AttackGraphPage.tsx`

Design:
- `NodeDetailPanel` gained optional shell controls only.
- The panel body hides completely when collapsed.
- The collapsed header keeps:
  - panel title
  - current subject line
  - drag handle
  - collapse/expand control
  - close control

This keeps the existing detail family intact and avoids redesigning the content layout.

## Exact drag-state ownership and behavior

Ownership:
- drag state lives in `AttackGraphPage`

Added Attack Graph state/refs:
- `detailPanelPosition`
- `detailPanelMaxHeight`
- `detailPanelDragOffsetRef`
- `detailPanelRef`
- `detailPanelPositionRef`

Behavior:
- node/edge detail overlays are now absolutely positioned inside the graph card
- dragging starts from the shared panel header drag handle
- movement is clamped to the graph card bounds
- max height is recomputed from the current panel Y position
- the implementation mirrors the existing Graph Controls drag/clamp pattern instead of creating a separate drag system

## Exact translucency adjustments

### `src/components/graph/NodeDetailPanel.tsx`

- dark shell background:
  - before: `rgba(8, 15, 32, 0.94)`
  - after: `rgba(8, 15, 32, 0.76)`
- dark header background:
  - before: `rgba(15, 23, 42, 0.9)`
  - after: `rgba(15, 23, 42, 0.68)`
- summary card background:
  - before: `rgba(15, 23, 42, 0.76)`
  - after: `rgba(15, 23, 42, 0.48)`
- blur:
  - before: `blur(16px)`
  - after: `blur(18px)`

### `src/pages/AttackGraphPage.tsx`

Same-page persisted Attack Path drawer:
- scrim:
  - before: `rgba(2, 6, 23, 0.45)`
  - after: `rgba(2, 6, 23, 0.3)`
- drawer shell:
  - before: `#0f172a`
  - after: `rgba(15, 23, 42, 0.8)`
- added `backdropFilter: blur(18px)`
- inner path card:
  - before: `rgba(15, 23, 42, 0.84)`
  - after: `rgba(15, 23, 42, 0.6)`

## Any tradeoffs

- Drag/collapse was applied to the live Attack Graph node/edge overlays only. The dedicated Attack Path detail page still uses its existing inline selected-node and selected-edge blocks to avoid a broader page-structure change.
- `NodeDetailPanel` translucency changed at the shared shell level, which is intentionally small but affects any dark-tone uses of that panel.

## Anything intentionally left untouched

- `src/api/attackGraph.ts`
- generated hooks/models
- Orval output
- `src/components/graph/attackGraph/adapter.ts`
- `src/components/graph/attackGraph/stylesheet.ts`
- `src/components/graph/attackGraph/layout.ts`
- router structure
- `fcose` layout behavior
- node fill meaning
- node border meaning
- search navigator model
- search tokenization
- current chain emphasis/focus logic

## Verification

Passed:
- `npx eslint src/pages/AttackGraphPage.tsx src/pages/AttackPathDetailPage.tsx src/components/graph/GraphFilters.tsx src/components/graph/NodeDetailPanel.tsx src/components/graph/GraphView.tsx --max-warnings=0`
- `npx tsc -b`

Repo-wide checks attempted:
- `npm run lint`
  - still fails on multiple pre-existing issues outside this polish scope
- `npm run build`
  - still fails on the existing Vite/Rolldown resolution problem for `cytoscape-dagre`
