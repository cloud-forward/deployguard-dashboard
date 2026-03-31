Attack Path tab final polish fix report

Files changed

- `src/pages/AttackGraphPage.tsx`
- `_analysis/attack_graph_ui_refinement_report.md`
- `_analysis/attack_path_tab_final_polish_fix_report.md`

Exact removal of the in-page detail panel path

- Removed the local `AttackPathDetailPanel` component from `src/pages/AttackGraphPage.tsx`.
- Removed the generated persisted-detail hook import that only existed for that panel.
- Removed the Attack Path tab-only `selectedPathId` state and the derived `resolvedSelectedPathId`, `shouldLoadDetail`, and `isAttackPathDetailOpen` values from `AttackPathsPanel`.
- Removed row click opening behavior.
- Removed row-selected styling and button-like affordances that only supported the in-page panel:
  - `role="button"`
  - `table-active`
  - pointer cursor
- Left the table itself in place and kept the separate route action intact.

Exact rename from `보기` to `상세`

- Kept the existing route `Link` in the table.
- Changed only the visible label from `보기` to `상세`.
- Removed `event.stopPropagation()` because the row no longer has a click-to-open interaction path.

Exact strict comparator order after the change

- The Attack Path list comparator is now explicit in this order:
  1. risk score by `riskScoreSortDirection`
  2. hop count by `hopCountSortDirection`
  3. risk severity aligned with `riskScoreSortDirection`
  4. `path_id` lexical order
- Risk score display formatting was intentionally left unchanged.
- Sort-button accessibility copy now describes the current primary/secondary behavior instead of only implying the next toggle.

Exact internal table-scroll ownership change

- Kept the card header/title/count outside the scroll region.
- Made the existing Attack Path table wrapper (`div.table-responsive`) the scroll owner.
- Added a local `maxHeight` plus `overflow: auto` and `overscrollBehavior: contain` in `src/pages/AttackGraphPage.tsx`.
- Did not change global table overflow rules in `src/App.css`.

Tradeoffs

- Kept the current two-toggle sorting model instead of introducing a broader sort framework.
- Kept the scroll rule local to the page component to avoid affecting other tables.

Intentionally left untouched

- Live graph interaction logic
- Graph-mode node/edge detail panels
- Router structure
- Generated hooks/models
- `src/api/attackGraph.ts`
- Badge colors and current Attack Path risk-score display formatting

Validation

- `npx eslint src/pages/AttackGraphPage.tsx` passed.
- `npm run build` passed.
