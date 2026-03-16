import React, { useCallback } from 'react';
import CytoscapeComponent from 'react-cytoscapejs';
import type { ElementDefinition } from 'cytoscape';
import type { NodeData, NodeType } from './mockGraphData';
import { nodeTypeColors } from './mockGraphData';

interface GraphViewProps {
  elements: ElementDefinition[];
  onNodeClick: (node: NodeData) => void;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const stylesheet: any[] = [
  {
    selector: 'node',
    style: {
      label: 'data(label)',
      'text-valign': 'bottom',
      'text-halign': 'center',
      'font-size': 11,
      'text-margin-y': 4,
      width: 48,
      height: 48,
      'border-width': 2,
      'border-color': '#fff',
      color: '#333',
    },
  },
  ...(['Pod', 'ServiceAccount', 'IAMRole', 'S3Bucket'] as NodeType[]).map((type) => ({
    selector: `node[type = "${type}"]`,
    style: {
      'background-color': nodeTypeColors[type],
    },
  })),
  {
    selector: 'node:selected',
    style: {
      'border-width': 3,
      'border-color': '#212529',
    },
  },
  {
    selector: 'edge',
    style: {
      label: 'data(label)',
      'font-size': 10,
      'curve-style': 'bezier',
      'target-arrow-shape': 'triangle',
      'line-color': '#adb5bd',
      'target-arrow-color': '#adb5bd',
      color: '#6c757d',
      'text-background-color': '#fff',
      'text-background-opacity': 1,
      'text-background-padding': '2px',
    },
  },
];

const GraphView: React.FC<GraphViewProps> = ({ elements, onNodeClick }) => {
  const handleCy = useCallback(
    (cy: cytoscape.Core) => {
      cy.removeAllListeners();
      cy.on('tap', 'node', (evt) => {
        const data = evt.target.data() as NodeData;
        onNodeClick(data);
      });
    },
    [onNodeClick],
  );

  return (
    <CytoscapeComponent
      elements={elements}
      stylesheet={stylesheet}
      layout={{ name: 'breadthfirst', directed: true, padding: 40 }}
      style={{ width: '100%', height: '100%' }}
      cy={handleCy}
    />
  );
};

export default GraphView;
