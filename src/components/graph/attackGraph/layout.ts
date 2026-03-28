import type cytoscape from 'cytoscape';
import type { FcoseLayoutOptions } from 'cytoscape-fcose';

export const attackGraphDefaultLayout: FcoseLayoutOptions = {
  name: 'fcose',
  quality: 'default',
  animate: false,
  fit: true,
  padding: 120,
  randomize: true,
  packComponents: true,
  nodeDimensionsIncludeLabels: true,
  uniformNodeDimensions: false,
  avoidOverlap: true,
  nodeSeparation: 90,
  nestingFactor: 1.1,
  tile: true,
  tilingPaddingHorizontal: 80,
  tilingPaddingVertical: 80,
  nodeRepulsion: (node: cytoscape.NodeSingular) => {
    const degree = node.connectedEdges().length;
    if (degree >= 8) return 220000;
    if (degree >= 5) return 160000;
    return 110000;
  },
  idealEdgeLength: (edge: cytoscape.EdgeSingular) => {
    const sourceDegree = edge.source().connectedEdges().length;
    const targetDegree = edge.target().connectedEdges().length;
    const maxDegree = Math.max(sourceDegree, targetDegree);

    if (maxDegree >= 8) return 360;
    if (maxDegree >= 5) return 300;
    return 230;
  },
  edgeElasticity: (edge: cytoscape.EdgeSingular) => {
    const sourceDegree = edge.source().connectedEdges().length;
    const targetDegree = edge.target().connectedEdges().length;
    const maxDegree = Math.max(sourceDegree, targetDegree);

    if (maxDegree >= 8) return 0.07;
    if (maxDegree >= 5) return 0.09;
    return 0.12;
  },
  gravity: 0.02,
  gravityRange: 3.8,
  numIter: 4500,
};
