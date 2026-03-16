import React, { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
    getListClustersApiV1ClustersGetQueryKey,
    useCreateClusterApiV1ClustersPost,
    useDeleteClusterApiV1ClustersIdDelete,
    useListClustersApiV1ClustersGet,
    useUpdateClusterApiV1ClustersIdPatch,
} from '../api/generated/clusters/clusters';
import ClusterModal from '../components/clusters/ClusterModal';

type Cluster = {
    id: string;
    name: string;
    description?: string | null;
    cluster_type: string;
    created_at: string;
    updated_at: string;
};

type ClusterForm = {
    id?: string;
    name: string;
    description?: string | null;
    cluster_type: 'eks' | 'self-managed';
};

const ClustersPage: React.FC = () => {
    const queryClient = useQueryClient();
    const { data, isLoading, isError, error } = useListClustersApiV1ClustersGet();
    const clusters = Array.isArray(data) ? data : (data?.data ?? []);
    const {
        mutate: createCluster,
        isPending: isCreating,
        error: createError,
    } = useCreateClusterApiV1ClustersPost();
    const {
        mutate: updateCluster,
        isPending: isUpdating,
        error: updateError,
    } = useUpdateClusterApiV1ClustersIdPatch();
    const { mutate: deleteCluster, isPending: isDeleting } =
        useDeleteClusterApiV1ClustersIdDelete();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedCluster, setSelectedCluster] = useState<ClusterForm | null>(null);
    const [createdClusterName, setCreatedClusterName] = useState<string | null>(null);
    const [createdClusterId, setCreatedClusterId] = useState<string | null>(null);
    const [createdApiToken, setCreatedApiToken] = useState<string | null>(null);
    const [isInstallPanelVisible, setIsInstallPanelVisible] = useState(false);
    const [tokenCopied, setTokenCopied] = useState(false);
    const [commandCopied, setCommandCopied] = useState(false);

    const handleCreate = () => {
        setSelectedCluster(null);
        setIsModalOpen(true);
    };

    const handleEdit = (cluster: Cluster) => {
        setSelectedCluster({
            id: cluster.id,
            name: cluster.name,
            description: cluster.description ?? '',
            cluster_type: cluster.cluster_type as ClusterForm['cluster_type'],
        });
        setIsModalOpen(true);
    };

    const handleSave = (formData: ClusterForm) => {
        const payload = {
            name: formData.name,
            description: formData.description?.trim() ? formData.description : null,
            cluster_type: formData.cluster_type,
        };

        if (selectedCluster) {
            if (!selectedCluster.id) {
                return;
            }

            updateCluster(
                {
                    id: selectedCluster.id,
                    data: payload,
                },
                {
                    onSuccess: () => {
                        setIsModalOpen(false);
                        queryClient.invalidateQueries({
                            queryKey: getListClustersApiV1ClustersGetQueryKey(),
                        });
                    },
                },
            );
            return;
        }

        createCluster(
            {
                data: payload,
            },
            {
                onSuccess: (response) => {
                    const responseData =
                        response && typeof response === 'object' && 'data' in response
                            ? response.data
                            : response;

                    const apiToken =
                        responseData &&
                        typeof responseData === 'object' &&
                        'api_token' in responseData &&
                        typeof responseData.api_token === 'string'
                            ? responseData.api_token
                            : null;
                    const clusterId =
                        responseData &&
                        typeof responseData === 'object' &&
                        'id' in responseData &&
                        typeof responseData.id === 'string'
                            ? responseData.id
                            : null;

                    setCreatedApiToken(apiToken);
                    setCreatedClusterName(formData.name);
                    setCreatedClusterId(clusterId);
                    setIsInstallPanelVisible(Boolean(apiToken));
                    setTokenCopied(false);
                    setCommandCopied(false);
                    setSelectedCluster(null);
                    setIsModalOpen(false);
                    queryClient.invalidateQueries({
                        queryKey: getListClustersApiV1ClustersGetQueryKey(),
                    });
                },
            },
        );
    };

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
                    queryClient.invalidateQueries({
                        queryKey: getListClustersApiV1ClustersGetQueryKey(),
                    });
                },
            },
        );
    };

    const getErrorMessage = (err: unknown, fallback: string) => {
        if (err && typeof err === 'object' && 'message' in err) {
            const message = err.message;
            if (typeof message === 'string') {
                return message;
            }
        }

        return err ? fallback : undefined;
    };

    const helmInstallCommand =
        createdClusterId && createdApiToken
            ? `helm upgrade --install deployguard-scanner deployguard/scanner --set config.clusterId="${createdClusterId}" --set config.apiToken="${createdApiToken}" --set config.serverUrl="https://analysis.deployguard.org"`
            : '';
    const showInstallPanel =
        isInstallPanelVisible && Boolean(createdApiToken) && Boolean(createdClusterId);
    const showClustersTable = !isLoading && !isError;

    const copyToClipboard = async (
        value: string,
        onSuccess: React.Dispatch<React.SetStateAction<boolean>>,
    ) => {
        if (!value) {
            return;
        }
        if (!navigator?.clipboard?.writeText) {
            return;
        }

        try {
            await navigator.clipboard.writeText(value);
            onSuccess(true);
            window.setTimeout(() => onSuccess(false), 1500);
        } catch {
            onSuccess(false);
        }
    };

    return (
        <div>
            <div className="d-flex justify-content-between align-items-center mb-4">
                <div>
                    <h1 className="h2">Clusters</h1>
                    <p className="text-muted">
                        Management of protected infrastructure clusters.
                    </p>
                </div>
                <button className="btn btn-primary" onClick={handleCreate}>
                    Create Cluster
                </button>
            </div>
            {showInstallPanel && (
                <div className="card border-warning mb-4">
                    <div className="card-header bg-warning-subtle d-flex justify-content-between align-items-center">
                        <div className="fw-semibold">Scanner Installation</div>
                        <button
                            type="button"
                            className="btn-close"
                            aria-label="Close"
                            onClick={() => setIsInstallPanelVisible(false)}
                        />
                    </div>
                    <div className="card-body">
                        <p className="mb-2">
                            <strong>Cluster:</strong> {createdClusterName ?? '-'}
                        </p>
                        <p className="mb-2">
                            <strong>Cluster ID:</strong> <code>{createdClusterId}</code>
                        </p>
                        <div className="mb-3">
                            <label className="form-label fw-semibold">API Token</label>
                            <div className="d-flex gap-2 align-items-start">
                                <code className="d-block p-2 bg-light border rounded w-100 text-break">
                                    {createdApiToken}
                                </code>
                                <button
                                    type="button"
                                    className="btn btn-outline-secondary btn-sm"
                                    onClick={() => copyToClipboard(createdApiToken, setTokenCopied)}
                                >
                                    Copy
                                </button>
                            </div>
                            {tokenCopied && <div className="small text-success mt-1">Copied!</div>}
                        </div>
                        <div className="mb-3">
                            <label className="form-label fw-semibold">Helm Install Command</label>
                            <div className="d-flex gap-2 align-items-start">
                                <code className="d-block p-2 bg-light border rounded w-100 text-break">
                                    {helmInstallCommand}
                                </code>
                                <button
                                    type="button"
                                    className="btn btn-outline-secondary btn-sm"
                                    onClick={() =>
                                        copyToClipboard(helmInstallCommand, setCommandCopied)
                                    }
                                >
                                    Copy
                                </button>
                            </div>
                            {commandCopied && (
                                <div className="small text-success mt-1">Copied!</div>
                            )}
                        </div>
                        <div className="alert alert-warning mb-0" role="alert">
                            This API token may only be shown once. Store it securely before
                            closing this panel.
                        </div>
                    </div>
                </div>
            )}

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
                                    : getErrorMessage(error, 'Failed to load clusters.')}
                            </div>
                        </div>
                    )}
                    {showClustersTable && (
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
                                            <div className="d-inline-flex gap-2">
                                                <button
                                                    className="btn btn-sm btn-outline-secondary"
                                                    onClick={() => handleEdit(cluster)}
                                                >
                                                    Edit
                                                </button>
                                                <button
                                                    className="btn btn-sm btn-outline-danger"
                                                    onClick={() => handleDelete(cluster)}
                                                    disabled={isDeleting}
                                                >
                                                    {isDeleting ? 'Deleting...' : 'Delete'}
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
            <ClusterModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSave={handleSave}
                cluster={selectedCluster}
                isSubmitting={selectedCluster ? isUpdating : isCreating}
                errorMessage={
                    selectedCluster
                        ? getErrorMessage(updateError, 'Failed to update cluster.')
                        : getErrorMessage(createError, 'Failed to create cluster.')
                }
            />
        </div>
    );
};

export default ClustersPage;
