import React, { useEffect, useState } from 'react';

type ClusterForm = {
  id?: string;
  name: string;
  description?: string | null;
  cluster_type: 'eks' | 'self-managed' | 'aws';
};

interface ClusterModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (cluster: ClusterForm) => void;
  cluster?: ClusterForm | null;
  isSubmitting?: boolean;
  errorMessage?: string;
}

const ClusterModal: React.FC<ClusterModalProps> = ({
  isOpen,
  onClose,
  onSave,
  cluster,
  isSubmitting = false,
  errorMessage,
}) => {
  const [formData, setFormData] = useState<ClusterForm>({
    name: '',
    description: '',
    cluster_type: 'eks',
  });
  const [touched, setTouched] = useState({ name: false });

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    if (cluster) {
      setFormData(cluster);
    } else {
      setFormData({
        name: '',
        description: '',
        cluster_type: 'eks',
      });
    }
    setTouched({ name: false });
  }, [cluster, isOpen]);

  if (!isOpen) return null;

  const nameError = formData.name.trim().length === 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setTouched({ name: true });
    if (nameError) {
      return;
    }
    onSave(formData);
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
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
              {errorMessage && (
                <div className="alert alert-danger" role="alert">
                  {errorMessage}
                </div>
              )}
              <div className="mb-3">
                <label className="form-label">Name</label>
                <input
                  type="text"
                  className={`form-control${touched.name && nameError ? ' is-invalid' : ''}`}
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  required
                />
                {touched.name && nameError && (
                  <div className="invalid-feedback">Name is required.</div>
                )}
              </div>
              <div className="mb-3">
                <label className="form-label">Description</label>
                <input
                  type="text"
                  className="form-control"
                  name="description"
                  value={formData.description ?? ''}
                  onChange={handleChange}
                />
              </div>
              <div className="mb-3">
                <label className="form-label">Type</label>
                <select
                  className="form-select"
                  name="cluster_type"
                  value={formData.cluster_type}
                  onChange={handleChange}
                  required
                >
                  <option value="eks">EKS</option>
                  <option value="self-managed">Self-managed</option>
                  <option value="aws">AWS</option>
                </select>
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={onClose}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
                {isSubmitting ? (cluster ? 'Updating...' : 'Creating...') : (cluster ? 'Update' : 'Create')}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ClusterModal;
