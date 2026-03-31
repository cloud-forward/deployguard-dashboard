import React from 'react';
import type { Cluster } from '../../types/cluster';

interface DeleteConfirmProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  cluster: Cluster | null;
}

const DeleteConfirm: React.FC<DeleteConfirmProps> = ({ isOpen, onClose, onConfirm, cluster }) => {
  if (!isOpen || !cluster) return null;

  return (
    <div className="modal show d-block" tabIndex={-1} style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
      <div className="modal-dialog">
        <div className="modal-content">
          <div className="modal-header border-0">
            <h5 className="modal-title">Delete Cluster</h5>
            <button type="button" className="btn-close" onClick={onClose}></button>
          </div>
          <div className="modal-body">
            <p>Are you sure you want to delete cluster <strong>{cluster.name}</strong>?</p>
            <p className="text-danger small">This action cannot be undone.</p>
          </div>
          <div className="modal-footer border-0">
            <button type="button" className="btn btn-sm dg-dashboard-action-btn dg-dashboard-action-btn--secondary" onClick={onClose}>Cancel</button>
            <button type="button" className="btn btn-sm dg-dashboard-action-btn dg-dashboard-action-btn--danger" onClick={() => { onConfirm(); onClose(); }}>Delete</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DeleteConfirm;
