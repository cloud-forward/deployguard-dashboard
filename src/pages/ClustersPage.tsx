import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import {
    getListClustersApiV1ClustersGetQueryKey,
    useCreateClusterApiV1ClustersPost,
    useDeleteClusterApiV1ClustersIdDelete,
    useListClustersApiV1ClustersGet,
    useUpdateClusterApiV1ClustersIdPatch,
} from '../api/generated/clusters/clusters';
import { useStartScanApiV1ScansStartPost } from '../api/generated/scans/scans';
import ClusterModal from '../components/clusters/ClusterModal';
import ClusterOnboardingModal from '../components/clusters/ClusterOnboardingModal';

type Cluster = {
    id: string;
    name: string;
    description?: string | null;
    cluster_type?: string | null;
    aws_account_id?: string | null;
    aws_role_arn?: string | null;
    aws_region?: string | null;
    created_at?: string | null;
    updated_at?: string | null;
};

type ClusterForm = {
    id?: string;
    name: string;
    description?: string | null;
    cluster_type: 'eks' | 'self-managed' | 'aws';
};

const ClustersPage: React.FC = () => {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const { data, isLoading, isError, error } = useListClustersApiV1ClustersGet();
    const clusters = Array.isArray(data) ? data : [];
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
    const {
        mutate: startScan,
        isPending: isStartingScan,
    } = useStartScanApiV1ScansStartPost();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedCluster, setSelectedCluster] = useState<ClusterForm | null>(null);
    const [createModalResetKey, setCreateModalResetKey] = useState(0);
    const [createdClusterName, setCreatedClusterName] = useState<string | null>(null);
    const [createdClusterId, setCreatedClusterId] = useState<string | null>(null);
    const [createdClusterType, setCreatedClusterType] = useState<string | null>(null);
    const [createdApiToken, setCreatedApiToken] = useState<string | null>(null);
    const [isInstallPanelVisible, setIsInstallPanelVisible] = useState(false);
    const [startingClusterId, setStartingClusterId] = useState<string | null>(null);
    const [scanFeedback, setScanFeedback] = useState<{
        clusterName: string;
        message: string;
        isError: boolean;
    } | null>(null);

    const resetOnboardingState = () => {
        setCreatedClusterName(null);
        setCreatedClusterId(null);
        setCreatedClusterType(null);
        setCreatedApiToken(null);
        setIsInstallPanelVisible(false);
    };

    const handleCreate = () => {
        resetOnboardingState();
        setCreateModalResetKey((value) => value + 1);
        setSelectedCluster(null);
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setSelectedCluster(null);
    };

    const getClusterTypeLabel = (clusterType: string) => {
        switch (clusterType) {
            case 'eks':
                return 'EKS';
            case 'self-managed':
                return 'Self-managed';
            case 'aws':
                return 'AWS';
            default:
                return clusterType;
        }
    };

    const getClusterTypeBadgeClass = (clusterType: string) => {
        switch (clusterType) {
            case 'aws':
                return 'bg-success text-white';
            case 'self-managed':
                return 'bg-warning text-dark';
            case 'eks':
            default:
                return 'bg-primary text-white';
        }
    };

    const getCreateResponseData = (
        response: unknown,
    ):
        | {
              id?: string;
              name?: string;
              cluster_type?: string;
              api_token?: string;
          }
        | null => {
        if (!response || typeof response !== 'object') {
            return null;
        }

        const payload = response as Record<string, unknown>;

        return {
            id:
                typeof payload.id === 'string'
                    ? payload.id
                    : typeof payload['id'] === 'string'
                      ? (payload['id'] as string)
                      : undefined,
            name:
                typeof payload.name === 'string'
                    ? payload.name
                    : typeof payload['name'] === 'string'
                      ? (payload['name'] as string)
                      : undefined,
            cluster_type:
                typeof payload.cluster_type === 'string'
                    ? payload.cluster_type
                    : typeof payload['cluster_type'] === 'string'
                      ? (payload['cluster_type'] as string)
                      : undefined,
            api_token:
                typeof payload.api_token === 'string'
                    ? payload.api_token
                    : typeof payload['api_token'] === 'string'
                      ? (payload['api_token'] as string)
                      : undefined,
        };
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
                    const responseData = getCreateResponseData(response);

                    const clusterId = responseData?.id ?? null;
                    const clusterName = responseData?.name ?? formData.name;
                    const clusterType = responseData?.cluster_type ?? formData.cluster_type;
                    const apiToken = responseData?.api_token ?? null;

                    setCreatedApiToken(apiToken);
                    setCreatedClusterName(clusterName);
                    setCreatedClusterId(clusterId);
                    setCreatedClusterType(clusterType);
                    setIsInstallPanelVisible(true);
                    setSelectedCluster(null);
                    setIsModalOpen(false);
                    queryClient.invalidateQueries({
                        queryKey: getListClustersApiV1ClustersGetQueryKey(),
                        refetchType: 'all',
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

    const handleScanNow = (cluster: Cluster) => {
        setStartingClusterId(cluster.id);
        setScanFeedback(null);
        startScan(
            {
                data: {
                    cluster_id: cluster.id,
                    request_source: 'manual',
                },
            },
            {
                onSuccess: (response) => {
                    const createdScans = Array.isArray(response?.scans) ? response.scans : [];
                    const scannerTypes = createdScans
                        .map((scan) => scan.scanner_type)
                        .filter((value): value is string => Boolean(value));
                    const scanLabel =
                        scannerTypes.length > 0 ? ` (${scannerTypes.join(', ')})` : '';
                    setScanFeedback({
                        clusterName: cluster.name,
                        message: `Scan request created${scanLabel}`,
                        isError: false,
                    });
                },
                onError: () => {
                    setScanFeedback({
                        clusterName: cluster.name,
                        message: 'Failed to create scan request',
                        isError: true,
                    });
                },
                onSettled: () => {
                    setStartingClusterId((current) => (current === cluster.id ? null : current));
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

    const showClustersTable = !isLoading && !isError;
    const handleOpenInventory = (cluster: Cluster) => {
        navigate(`/clusters/${cluster.id}/inventory`);
    };

    return (
        <div>
            <div className="d-flex justify-content-between align-items-center mb-4">
                <div>
                    <h1 className="h2">Clusters</h1>
                    <p className="dg-subtitle-text">
                        Management of protected infrastructure clusters.
                    </p>
                </div>
                <button
                    className="btn btn-primary"
                    onClick={handleCreate}
                    disabled={isCreating}
                >
                    {isCreating ? 'Creating...' : 'Create Cluster'}
                </button>
            </div>
            {scanFeedback && (
                <div
                    className={`alert ${scanFeedback.isError ? 'alert-danger' : 'alert-success'}`}
                    role="alert"
                >
                    <strong>{scanFeedback.message}</strong>
                    {!scanFeedback.isError ? ` for ${scanFeedback.clusterName}.` : null}
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
                                        <tr
                                            key={cluster.id}
                                            role="button"
                                            className="cursor-pointer"
                                            onClick={() => handleOpenInventory(cluster)}
                                        >
                                            <td>{cluster.name}</td>
                                            <td className="text-muted">{cluster.id}</td>
                                            <td>
                                                <div>{cluster.description ?? '-'}</div>
                                                {(cluster.aws_account_id ||
                                                    cluster.aws_region ||
                                                    cluster.aws_role_arn) && (
                                                    <div className="mt-2 small text-muted">
                                                        <div>
                                                            <strong>AWS Account:</strong>{' '}
                                                            {cluster.aws_account_id ?? '-'}
                                                        </div>
                                                        <div>
                                                            <strong>AWS Region:</strong>{' '}
                                                            {cluster.aws_region ?? '-'}
                                                        </div>
                                                        <div className="text-break">
                                                            <strong>AssumeRole ARN:</strong>{' '}
                                                            {cluster.aws_role_arn ?? '-'}
                                                        </div>
                                                    </div>
                                                )}
                                            </td>
                                            <td>
                                                <span
                                                    className={`badge ${getClusterTypeBadgeClass(
                                                        cluster.cluster_type ?? 'eks',
                                                    )}`}
                                                >
                                                    {getClusterTypeLabel(cluster.cluster_type ?? '-')}
                                                </span>
                                            </td>
                                            <td>
                                                {cluster.created_at
                                                    ? new Date(cluster.created_at).toLocaleString()
                                                    : '-'}
                                            </td>
                                            <td className="text-end">
                                                <div className="d-inline-flex gap-2">
                                                    <button
                                                        className="btn btn-sm btn-outline-primary"
                                                        onClick={(event) => {
                                                            event.stopPropagation();
                                                            handleOpenInventory(cluster);
                                                        }}
                                                    >
                                                        Inventory 보기
                                                    </button>
                                                    <button
                                                        className="btn btn-sm btn-outline-success"
                                                        onClick={(event) => {
                                                            event.stopPropagation();
                                                            handleScanNow(cluster);
                                                        }}
                                                        disabled={
                                                            isStartingScan &&
                                                            startingClusterId === cluster.id
                                                        }
                                                    >
                                                        {isStartingScan && startingClusterId === cluster.id
                                                            ? 'Starting...'
                                                            : 'Scan Request'}
                                                    </button>
                                                    <button
                                                        className="btn btn-sm btn-outline-secondary"
                                                        onClick={(event) => {
                                                            event.stopPropagation();
                                                            handleEdit(cluster);
                                                        }}
                                                    >
                                                        Edit
                                                    </button>
                                                    <button
                                                        className="btn btn-sm btn-outline-danger"
                                                        onClick={(event) => {
                                                            event.stopPropagation();
                                                            handleDelete(cluster);
                                                        }}
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
                key={
                    selectedCluster?.id
                        ? `edit-${selectedCluster.id}`
                        : `create-${createModalResetKey}`
                }
                isOpen={isModalOpen}
                onClose={handleCloseModal}
                onSave={handleSave}
                cluster={selectedCluster}
                isSubmitting={selectedCluster ? isUpdating : isCreating}
                errorMessage={
                    selectedCluster
                        ? getErrorMessage(updateError, 'Failed to update cluster.')
                        : getErrorMessage(createError, 'Failed to create cluster.')
                }
            />
            <ClusterOnboardingModal
                isOpen={isInstallPanelVisible}
                onClose={() => resetOnboardingState()}
                clusterId={createdClusterId ?? ''}
                clusterName={createdClusterName ?? ''}
                clusterType={createdClusterType ?? ''}
                apiToken={createdApiToken ?? ''}
            />
        </div>
    );
};

export default ClustersPage;
