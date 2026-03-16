import React from 'react';
import type { NodeData } from './mockGraphData';

interface BlastRadiusPanelProps {
  node: NodeData | null;
}

const BlastRadiusPanel: React.FC<BlastRadiusPanelProps> = ({ node }) => {
  if (!node) return null;

  const { blastRadius } = node;

  return (
    <div
      className="card shadow"
      style={{
        position: 'absolute',
        top: 330, // Positioned below the NodeDetailPanel (which has top: 16 and is about 300px high)
        right: 16,
        width: 300,
        zIndex: 10,
      }}
    >
      <div className="card-header bg-danger text-white">
        <strong>Blast Radius</strong>
      </div>
      <div className="card-body">
        <p className="small text-muted mb-3">
          Reachable resources from <strong>{node.label}</strong>
        </p>
        <div className="list-group list-group-flush">
          <div className="list-group-item d-flex justify-content-between align-items-center px-0">
            <span>Pods</span>
            <span className="badge bg-secondary rounded-pill">{blastRadius.pods}</span>
          </div>
          <div className="list-group-item d-flex justify-content-between align-items-center px-0">
            <span>Secrets</span>
            <span className="badge bg-secondary rounded-pill">{blastRadius.secrets}</span>
          </div>
          <div className="list-group-item d-flex justify-content-between align-items-center px-0">
            <span>Databases</span>
            <span className="badge bg-secondary rounded-pill">{blastRadius.databases}</span>
          </div>
          <div className="list-group-item d-flex justify-content-between align-items-center px-0">
            <span>Admin privilege</span>
            {blastRadius.adminPrivilege ? (
              <span className="badge bg-danger">Yes</span>
            ) : (
              <span className="badge bg-success">No</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default BlastRadiusPanel;
