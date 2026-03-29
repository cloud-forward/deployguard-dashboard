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

const formatDateOnly = (value?: string | null) => {
    if (!value) {
        return '-';
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return value;
    }

    return new Intl.DateTimeFormat('ko-KR', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
    }).format(date);
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
                return '자체 관리형';
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
            `클러스터 "${cluster.name}"을(를) 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.`,
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
                        message: `스캔 요청 생성됨${scanLabel}`,
                        isError: false,
                    });
                },
                onError: () => {
                    setScanFeedback({
                        clusterName: cluster.name,
                        message: '스캔 요청 생성에 실패했습니다',
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
        <div className="dg-page-shell">
            <div className="dg-page-header">
                <div className="dg-page-heading">
                    <h1 className="dg-page-title">클러스터</h1>
                    <p className="dg-page-description">연결된 클러스터를 관리합니다</p>
                </div>
                <button
                    className="btn btn-primary"
                    onClick={handleCreate}
                    disabled={isCreating}
                >
                    {isCreating ? '생성 중…' : '클러스터 생성'}
                </button>
            </div>
            {scanFeedback && (
                <div
                    className={`alert ${scanFeedback.isError ? 'alert-danger' : 'alert-success'}`}
                    role="alert"
                >
                    <strong>{scanFeedback.message}</strong>
                    {!scanFeedback.isError ? ` — ${scanFeedback.clusterName}.` : null}
                </div>
            )}

            <div className="card shadow-sm">
                <div className="card-body p-0">
                    {isLoading && (
                        <div className="p-4 text-center text-muted">클러스터 불러오는 중…</div>
                    )}
                    {isError && (
                        <div className="p-4">
                            <div className="alert alert-danger mb-0" role="alert">
                                {error instanceof Error
                                    ? error.message
                                    : getErrorMessage(error, '클러스터를 불러오지 못했습니다.')}
                            </div>
                        </div>
                    )}
                    {showClustersTable && (
                        <div className="table-responsive" style={{ maxHeight: '420px', overflowY: 'auto' }}>
                            <table className="table table-hover mb-0 align-middle">
                                <thead className="table-light" style={{ position: 'sticky', top: 0, zIndex: 1 }}>
                                    <tr>
                                        <th className="text-start align-middle">이름</th>
                                        <th className="text-start align-middle">클러스터 ID</th>
                                        <th className="text-start align-middle">유형</th>
                                        <th className="text-start align-middle">생성일</th>
                                        <th className="text-start align-middle">작업</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {clusters.length === 0 && (
                                        <tr>
                                            <td colSpan={5} className="text-center text-muted py-4">
                                                클러스터 없음.
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
                                                <span
                                                    className={`badge ${getClusterTypeBadgeClass(
                                                        cluster.cluster_type ?? 'eks',
                                                    )}`}
                                                >
                                                    {getClusterTypeLabel(cluster.cluster_type ?? '-')}
                                                </span>
                                            </td>
                                            <td>
                                                {formatDateOnly(cluster.created_at)}
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
                                                        인벤토리 보기
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
                                                            ? '시작 중…'
                                                            : '스캔 요청'}
                                                    </button>
                                                    <button
                                                        className="btn btn-sm btn-outline-secondary"
                                                        onClick={(event) => {
                                                            event.stopPropagation();
                                                            handleEdit(cluster);
                                                        }}
                                                    >
                                                        편집
                                                    </button>
                                                    <button
                                                        className="btn btn-sm btn-outline-danger"
                                                        onClick={(event) => {
                                                            event.stopPropagation();
                                                            handleDelete(cluster);
                                                        }}
                                                        disabled={isDeleting}
                                                    >
                                                        {isDeleting ? '삭제 중…' : '삭제'}
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
                        ? getErrorMessage(updateError, '클러스터 업데이트에 실패했습니다.')
                        : getErrorMessage(createError, '클러스터 생성에 실패했습니다.')
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
