import React, { useState } from 'react';
import ClusterTable from '../components/clusters/ClusterTable';
import ClusterModal from '../components/clusters/ClusterModal';
import DeleteConfirm from '../components/clusters/DeleteConfirm';
import type { Cluster } from '../types/cluster';

const MOCK_CLUSTERS: Cluster[] = [
  { id: '1', name: 'Production-US-East', type: 'Kubernetes', status: 'Active', nodeCount: 12, lastScan: '2026-03-15 10:00' },
  { id: '2', name: 'Staging-EU-West', type: 'Kubernetes', status: 'Active', nodeCount: 5, lastScan: '2026-03-16 08:30' },
  { id: '3', name: 'Dev-Local', type: 'Docker', status: 'Inactive', nodeCount: 1, lastScan: '2026-03-10 14:15' },
  { id: '4', name: 'Multi-Cloud-Core', type: 'Cloud', status: 'Pending', nodeCount: 20, lastScan: 'N/A' },
];

const ClustersPage: React.FC = () => {
  const [clusters, setClusters] = useState<Cluster[]>(MOCK_CLUSTERS);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [selectedCluster, setSelectedCluster] = useState<Cluster | null>(null);

  const handleAdd = () => {
    setSelectedCluster(null);
    setIsModalOpen(true);
  };

  const handleEdit = (cluster: Cluster) => {
    setSelectedCluster(cluster);
    setIsModalOpen(true);
  };

  const handleDeleteClick = (cluster: Cluster) => {
    setSelectedCluster(cluster);
    setIsDeleteOpen(true);
  };

  const handleSave = (clusterData: Partial<Cluster>) => {
    if (selectedCluster) {
      // Edit
      setClusters(clusters.map(c => c.id === selectedCluster.id ? { ...c, ...clusterData } as Cluster : c));
    } else {
      // Create
      const newCluster: Cluster = {
        ...clusterData,
        id: Math.random().toString(36).substr(2, 9),
        lastScan: 'N/A'
      } as Cluster;
      setClusters([...clusters, newCluster]);
    }
  };

  const handleConfirmDelete = () => {
    if (selectedCluster) {
      setClusters(clusters.filter(c => c.id !== selectedCluster.id));
    }
  };

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h1 className="h2">Clusters</h1>
          <p className="text-muted">Management of protected infrastructure clusters.</p>
        </div>
        <button className="btn btn-primary" onClick={handleAdd}>
          Add Cluster
        </button>
      </div>

      <div className="card shadow-sm">
        <div className="card-body p-0">
          <ClusterTable 
            clusters={clusters} 
            onEdit={handleEdit} 
            onDelete={handleDeleteClick} 
          />
        </div>
      </div>

      <ClusterModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        onSave={handleSave} 
        cluster={selectedCluster} 
      />

      <DeleteConfirm 
        isOpen={isDeleteOpen} 
        onClose={() => setIsDeleteOpen(false)} 
        onConfirm={handleConfirmDelete} 
        cluster={selectedCluster} 
      />
    </div>
  );
};

export default ClustersPage;
