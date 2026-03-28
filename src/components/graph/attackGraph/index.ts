// Graph module boundary for Attack Graph.
// Step 1 exposes the shared view model + adapter only.

// TODO Step 2: add Cytoscape stylesheet rules (node/edge classes and visual states).
// TODO Step 2: add Cytoscape renderer integration in a dedicated canvas component.
// TODO Step 2: wire selection sync between graph, path list, and detail panel.
// TODO Step 2: wire filters to both path list and graph query.

export * from './adapter';
export * from '../../../types/attackGraph';
export { attackGraphDefaultLayout } from './layout';
export { attackGraphStylesheet } from './stylesheet';
