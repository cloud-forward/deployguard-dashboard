import type cytoscape from 'cytoscape';
import type { FcoseLayoutOptions } from 'cytoscape-fcose';

export const attackGraphDefaultLayout: FcoseLayoutOptions = {
  name: 'fcose',
  animate: false,
  fit: true,
  padding: 60,
  randomize: true,
  nodeRepulsion: (node: cytoscape.NodeSingular) => {
    const degree = node.connectedEdges().length;
    if (degree >= 6) return 45000;
    if (degree >= 4) return 30000;
    return 18000;
  },
  idealEdgeLength: (edge: cytoscape.EdgeSingular) => {
    const sourceDegree = edge.source().connectedEdges().length;
    const targetDegree = edge.target().connectedEdges().length;
    const maxDegree = Math.max(sourceDegree, targetDegree);

    if (maxDegree >= 6) return 280;
    if (maxDegree >= 4) return 220;
    return 150;
  },
  edgeElasticity: (edge: cytoscape.EdgeSingular) => {
    const sourceDegree = edge.source().connectedEdges().length;
    const targetDegree = edge.target().connectedEdges().length;
    const maxDegree = Math.max(sourceDegree, targetDegree);

    if (maxDegree >= 6) return 0.08;
    if (maxDegree >= 4) return 0.1;
    return 0.12;
  },
  gravity: 0.04,
  numIter: 3000,
};
