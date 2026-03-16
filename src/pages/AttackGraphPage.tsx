import React, { useState, useMemo } from 'react';
import GraphView from '../components/graph/GraphView';
import NodeDetailPanel from '../components/graph/NodeDetailPanel';
import BlastRadiusPanel from '../components/graph/BlastRadiusPanel';
import GraphFilters from '../components/graph/GraphFilters';
import type { NodeData, NodeType } from '../components/graph/mockGraphData';
import { mockElements } from '../components/graph/mockGraphData';

const ALL_TYPES: NodeType[] = ['Pod', 'ServiceAccount', 'IAMRole', 'S3Bucket'];

const AttackGraphPage: React.FC = () => {
  const [selectedNode, setSelectedNode] = useState<NodeData | null>(null);
  const [activeTypes, setActiveTypes] = useState<NodeType[]>(ALL_TYPES);

  const filteredElements = useMemo(() => {
    return mockElements.filter((el) => {
      const data = el.data as Record<string, string>;
      if (data.source) return true; // keep edges
      return activeTypes.includes(data.type as NodeType);
    });
  }, [activeTypes]);

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <div>
          <h1 className="h2 mb-0">Attack Graph</h1>
          <p className="text-muted mb-0 small">Visualization of potential attack vectors.</p>
        </div>
      </div>

      <div className="card mb-3">
        <div className="card-body py-2">
          <GraphFilters activeTypes={activeTypes} onChange={setActiveTypes} />
        </div>
      </div>

      <div className="card" style={{ height: 600, position: 'relative' }}>
        <GraphView elements={filteredElements} onNodeClick={setSelectedNode} />
        <NodeDetailPanel node={selectedNode} onClose={() => setSelectedNode(null)} />
        <BlastRadiusPanel node={selectedNode} />
      </div>

      <div className="mt-3 d-flex gap-3 flex-wrap">
        <span className="text-muted small">
          <strong>{filteredElements.filter((e) => !(e.data as Record<string, string>).source).length}</strong> nodes &nbsp;·&nbsp;
          <strong>{filteredElements.filter((e) => !!(e.data as Record<string, string>).source).length}</strong> edges
        </span>
        <span className="text-muted small">Click a node to view details.</span>
      </div>
    </div>
  );
};

export default AttackGraphPage;
