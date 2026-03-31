import type cytoscape from 'cytoscape';
import type { FcoseLayoutOptions } from 'cytoscape-fcose';

export const attackGraphDefaultLayout: FcoseLayoutOptions = {
  name: 'fcose',
  quality: 'default',
  animate: false,
  fit: false,
  padding: 120,
  randomize: false,
  packComponents: true,
  nodeDimensionsIncludeLabels: true,
  uniformNodeDimensions: false,
  avoidOverlap: true,
  nodeSeparation: 320,
  nestingFactor: 1.2,
  tile: false,
  tilingPaddingHorizontal: 132,
  tilingPaddingVertical: 132,
  nodeRepulsion: (node: cytoscape.NodeSingular) => {
    const degree = node.connectedEdges().length;
    if (degree >= 8) return 560000;
    if (degree >= 5) return 430000;
    return 320000;
  },
  idealEdgeLength: (edge: cytoscape.EdgeSingular) => {
    const sourceDegree = edge.source().connectedEdges().length;
    const targetDegree = edge.target().connectedEdges().length;
    const maxDegree = Math.max(sourceDegree, targetDegree);

    if (maxDegree >= 8) return 730;
    if (maxDegree >= 5) return 590;
    return 400;
  },
  edgeElasticity: (edge: cytoscape.EdgeSingular) => {
    const sourceDegree = edge.source().connectedEdges().length;
    const targetDegree = edge.target().connectedEdges().length;
    const maxDegree = Math.max(sourceDegree, targetDegree);

    if (maxDegree >= 8) return 0.045;
    if (maxDegree >= 5) return 0.06;
    return 0.08;
  },
  gravity: 0.008,
  gravityRange: 5,
  numIter: 5600,
};
