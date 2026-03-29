import React from 'react';
import type { Cluster } from '../../types/cluster';

interface ClusterTableProps {
  clusters: Cluster[];
  onEdit: (cluster: Cluster) => void;
  onDelete: (cluster: Cluster) => void;
}

const ClusterTable: React.FC<ClusterTableProps> = ({ clusters, onEdit, onDelete }) => {
  return (
    <div className="table-responsive mt-3">
      <table className="table table-striped table-hover align-middle">
        <thead>
          <tr>
            <th>Name</th>
            <th>Type</th>
            <th>Status</th>
            <th>Nodes</th>
            <th>Last Scan</th>
            <th className="text-end">Actions</th>
          </tr>
        </thead>
        <tbody>
          {clusters.map((cluster) => (
            <tr key={cluster.id}>
              <td>{cluster.name}</td>
              <td>{cluster.type}</td>
              <td>
                <span className={`dg-badge ${cluster.status === 'Active' ? 'dg-badge--success' : cluster.status === 'Inactive' ? 'dg-badge--high' : 'dg-badge--notable'}`}>
                  {cluster.status}
                </span>
              </td>
              <td>{cluster.nodeCount}</td>
              <td>{cluster.lastScan}</td>
              <td className="text-end">
                <button
                  className="btn btn-sm btn-outline-primary me-2"
                  onClick={() => onEdit(cluster)}
                >
                  Edit
                </button>
                <button
                  className="btn btn-sm btn-outline-danger"
                  onClick={() => onDelete(cluster)}
                >
                  Delete
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default ClusterTable;
