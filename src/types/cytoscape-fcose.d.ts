declare module 'cytoscape-fcose' {
  import type cytoscape from 'cytoscape';

  type NodeValue = number | ((node: cytoscape.NodeSingular) => number);
  type EdgeValue = number | ((edge: cytoscape.EdgeSingular) => number);

  interface FcoseLayoutOptions extends cytoscape.LayoutOptions {
    name: 'fcose';
    animate?: boolean;
    fit?: boolean;
    padding?: number;
    randomize?: boolean;
    nodeRepulsion?: NodeValue;
    idealEdgeLength?: EdgeValue;
    edgeElasticity?: EdgeValue;
    gravity?: number;
    numIter?: number;
  }

  const fcose: cytoscape.Ext;

  export type { FcoseLayoutOptions };
  export default fcose;
}
