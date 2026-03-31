## Files Changed
- `src/pages/AttackGraphPage.tsx`
- `src/components/graph/GraphView.tsx`
- `src/components/graph/attackGraph/layout.ts`

## Exact Focus-Zoom Reduction Change
- In `src/components/graph/GraphView.tsx`, changed:
  - `FOCUS_TARGET_ZOOM: 1.1 -> 1.08`
- Left these intentionally unchanged:
  - `FOCUS_REPEAT_ZOOM_DELTA = 0.08`
  - `FOCUS_MAX_KICK_ZOOM = 1.18`
  - `FOCUS_ANIMATION_DURATION_MS = 520`
  - easing `ease-in-out-cubic`
  - focus pulse interval/duration

## Exact Change That Keeps Next/Previous In Focus-Only Mode
- In `src/pages/AttackGraphPage.tsx`, added a navigator-step ref:
  - `const searchStepFocusOnlyRef = useRef(false);`
- `focusSearchResult()` now:
  1. marks the next focus request as navigator-driven
  2. clears `selectedNodeId`
  3. clears `selectedEdgeId`
  4. clears `selectedPathId`
  5. updates the search result index
- `handleSearchFocusHandled()` now consumes that flag and exits early for navigator stepping, so a stepped result stays in the search focus channel instead of becoming a selected node.

## Exact Change That Prevents Prior Clicked-Node Emphasis From Persisting During Stepping
- The prior clicked-node / clicked-edge / clicked-path state was already being cleared first.
- The persistence problem came from `handleSearchFocusHandled()` immediately recreating `selectedNodeId`.
- That recreation is now blocked only for next/previous stepping.
- Direct graph clicks still clear the navigator-step flag and preserve the existing selected-node and selected-edge detail behavior.

## Exact Low-Degree `fcose` Tweak
- In `src/components/graph/attackGraph/layout.ts`, changed the low-degree branch of `idealEdgeLength`:
  - `return 460; -> return 400;`
- Left the rest of the current `fcose` setup unchanged.

## Tradeoffs
- Typed-search focus behavior was not globally rewritten; this pass only changes navigator stepping, which keeps blast radius small.
- Edge and path search results still focus their existing proxy node targets; this pass avoids inventing a new edge/path detail navigation model.
- Repo-wide lint is still failing for unrelated pre-existing files because `package.json` defines `lint` as `eslint .`.

## Intentionally Left Untouched
- `src/components/graph/attackGraph/stylesheet.ts`
- `src/components/graph/NodeDetailPanel.tsx`
- `src/components/graph/GraphFilters.tsx`
- `src/components/graph/attackGraph/adapter.ts`
- `src/api/attackGraph.ts`
- generated hooks/models and Orval output

## Validation
- `npx eslint src/pages/AttackGraphPage.tsx src/components/graph/GraphView.tsx src/components/graph/attackGraph/layout.ts`
- `npm run build`
- `npm run lint -- src/pages/AttackGraphPage.tsx src/components/graph/GraphView.tsx src/components/graph/attackGraph/layout.ts`
  - reports unrelated pre-existing repo-wide lint failures because the script runs `eslint .`
