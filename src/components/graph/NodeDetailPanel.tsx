import React from 'react';
import type { NodeData } from './mockGraphData';
import { nodeTypeColors, nodeTypeIcons } from './mockGraphData';

interface NodeDetailPanelProps {
  node: NodeData | null;
  onClose: () => void;
  style?: React.CSSProperties;
}

const NodeDetailPanel: React.FC<NodeDetailPanelProps> = ({ node, onClose, style }) => {
  if (!node) return null;

  const color = nodeTypeColors[node.type];
  const icon = nodeTypeIcons[node.type];

  return (
    <div
      className="card shadow"
      style={{
        position: 'absolute',
        top: 16,
        right: 16,
        width: 300,
        zIndex: 10,
        borderTop: `4px solid ${color}`,
        ...style,
      }}
    >
      <div className="card-header d-flex justify-content-between align-items-center">
        <span>
          <span className="me-2">{icon}</span>
          <strong>{node.label}</strong>
        </span>
        <button type="button" className="btn-close" aria-label="Close" onClick={onClose} />
      </div>
      <div className="card-body">
        <span className="badge mb-3" style={{ backgroundColor: color }}>
          {node.type}
        </span>
        <table className="table table-sm table-borderless mb-0">
          <tbody>
            {Object.entries(node.details).map(([key, value]) => (
              <tr key={key}>
                <td className="text-muted fw-semibold" style={{ width: '45%' }}>
                  {key}
                </td>
                <td style={{ wordBreak: 'break-all' }}>{value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default NodeDetailPanel;
