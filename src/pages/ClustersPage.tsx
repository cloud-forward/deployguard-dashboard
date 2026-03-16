import React from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
    useDeleteClusterApiV1ClustersIdDelete,
    useListClustersApiV1ClustersGet,
} from '../api/generated/clusters/clusters';

type Cluster = {
    id: string;
    name: string;
    description?: string | null;
    cluster_type: string;
    created_at: string;
    updated_at: string;
};

const ClustersPage: React.FC = () => {
    const queryClient = useQueryClient();
    const { data, isLoading, isError, error } = useListClustersApiV1ClustersGet();
    const clusters = data ?? [];
    const { mutate: deleteCluster, isPending: isDeleting } =
        useDeleteClusterApiV1ClustersIdDelete();

    const handleDelete = (cluster: Cluster) => {
        const confirmed = window.confirm(
            `Delete cluster "${cluster.name}"? This action cannot be undone.`,
        );
        if (!confirmed) {
            return;
        }

        deleteCluster(
            { id: cluster.id },
            {
                onSuccess: () => {
                    queryClient.invalidateQueries();
                },
            },
        );
    };

    return (
        <div>
            <div className="d-flex justify-content-between align-items-center mb-4">
                <div>
                    <h1 className="h2">Clusters</h1>
                    <p className="text-muted">Management of protected infrastructure clusters.</p>
                </div>
            </div>

            <div className="card shadow-sm">
                <div className="card-body p-0">
                    {isLoading && (
                        <div className="p-4 text-center text-muted">Loading clusters...</div>
                    )}
                    {isError && (
                        <div className="p-4">
                            <div className="alert alert-danger mb-0" role="alert">
                                {error instanceof Error
                                    ? error.message
                                    : 'Failed to load clusters.'}
                            </div>
                        </div>
                    )}
                    {!isLoading && !isError && (
                        <div className="table-responsive">
                            <table className="table table-hover mb-0 align-middle">
                                <thead className="table-light">
                                <tr>
                                    <th>Name</th>
                                    <th>Cluster ID</th>
                                    <th>Description</th>
                                    <th>Type</th>
                                    <th>Created At</th>
                                    <th className="text-end">Actions</th>
                                </tr>
                                </thead>
                                <tbody>
                                {clusters.length === 0 && (
                                    <tr>
                                        <td colSpan={6} className="text-center text-muted py-4">
                                            No clusters found.
                                        </td>
                                    </tr>
                                )}
                                {clusters.map((cluster) => (
                                    <tr key={cluster.id}>
                                        <td>{cluster.name}</td>
                                        <td className="text-muted">{cluster.id}</td>
                                        <td>{cluster.description ?? '-'}</td>
                                        <td>{cluster.cluster_type}</td>
                                        <td>
                                            {cluster.created_at
                                                ? new Date(cluster.created_at).toLocaleString()
                                                : '-'}
                                        </td>
                                        <td className="text-end">
                                            <button
                                                className="btn btn-sm btn-outline-danger"
                                                onClick={() => handleDelete(cluster)}
                                                disabled={isDeleting}
                                            >
                                                {isDeleting ? 'Deleting...' : 'Delete'}
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ClustersPage;