declare module 'cytoscape-fcose' {
  import type cytoscape from 'cytoscape';

  type NodeValue = number | ((node: cytoscape.NodeSingular) => number);
  type EdgeValue = number | ((edge: cytoscape.EdgeSingular) => number);

  interface FcoseLayoutOptions extends cytoscape.LayoutOptions {
    name: 'fcose';
    animate?: boolean;
    fit?: boolean;
    padding?: number;
    quality?: 'draft' | 'default' | 'proof';
    randomize?: boolean;
    packComponents?: boolean;
    nodeDimensionsIncludeLabels?: boolean;
    uniformNodeDimensions?: boolean;
    avoidOverlap?: boolean;
    nodeSeparation?: number;
    nodeRepulsion?: NodeValue;
    idealEdgeLength?: EdgeValue;
    edgeElasticity?: EdgeValue;
    gravity?: number;
    gravityRange?: number;
    nestingFactor?: number;
    tile?: boolean;
    tilingPaddingVertical?: number;
    tilingPaddingHorizontal?: number;
    numIter?: number;
  }

  const fcose: cytoscape.Ext;

  export type { FcoseLayoutOptions };
  export default fcose;
}
