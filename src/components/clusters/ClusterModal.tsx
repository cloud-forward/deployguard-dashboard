import React, { useState, useEffect } from 'react';
import type { Cluster } from '../../types/cluster';

interface ClusterModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (cluster: Partial<Cluster>) => void;
  cluster?: Cluster | null;
}

const ClusterModal: React.FC<ClusterModalProps> = ({ isOpen, onClose, onSave, cluster }) => {
  const [formData, setFormData] = useState<Partial<Cluster>>({
    name: '',
    type: 'Kubernetes',
    status: 'Active',
    nodeCount: 0,
    lastScan: 'N/A'
  });

  useEffect(() => {
    if (cluster) {
      setFormData(cluster);
    } else {
      setFormData({
        name: '',
        type: 'Kubernetes',
        status: 'Active',
        nodeCount: 0,
        lastScan: 'N/A'
      });
    }
  }, [cluster]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
    onClose();
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'nodeCount' ? parseInt(value) || 0 : value
    }));
  };

  return (
    <div className="modal show d-block" tabIndex={-1} style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
      <div className="modal-dialog">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">{cluster ? 'Edit Cluster' : 'Add New Cluster'}</h5>
            <button type="button" className="btn-close" onClick={onClose}></button>
          </div>
          <form onSubmit={handleSubmit}>
            <div className="modal-body">
              <div className="mb-3">
                <label className="form-label">Name</label>
                <input
                  type="text"
                  className="form-control"
                  name="name"
                  value={formData.name || ''}
                  onChange={handleChange}
                  required
                />
              </div>
              <div className="mb-3">
                <label className="form-label">Type</label>
                <select
                  className="form-select"
                  name="type"
                  value={formData.type || 'Kubernetes'}
                  onChange={handleChange}
                >
                  <option value="Kubernetes">Kubernetes</option>
                  <option value="Docker">Docker</option>
                  <option value="Cloud">Cloud</option>
                </select>
              </div>
              <div className="mb-3">
                <label className="form-label">Status</label>
                <select
                  className="form-select"
                  name="status"
                  value={formData.status || 'Active'}
                  onChange={handleChange}
                >
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                  <option value="Pending">Pending</option>
                </select>
              </div>
              <div className="mb-3">
                <label className="form-label">Nodes</label>
                <input
                  type="number"
                  className="form-control"
                  name="nodeCount"
                  value={formData.nodeCount || 0}
                  onChange={handleChange}
                  min="0"
                />
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
              <button type="submit" className="btn btn-primary">{cluster ? 'Update' : 'Create'}</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ClusterModal;
