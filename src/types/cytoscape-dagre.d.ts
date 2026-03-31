declare module 'cytoscape-dagre' {
  import type cytoscape from 'cytoscape';

  interface DagreLayoutOptions extends cytoscape.LayoutOptions {
    name: 'dagre';
    rankDir?: 'TB' | 'BT' | 'LR' | 'RL';
    nodeSep?: number;
    edgeSep?: number;
    rankSep?: number;
    fit?: boolean;
    padding?: number;
    animate?: boolean;
  }

  const dagre: cytoscape.Ext;
  export type { DagreLayoutOptions };
  export default dagre;
}
