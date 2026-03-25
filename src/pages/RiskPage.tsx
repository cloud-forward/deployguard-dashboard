import React, { useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import type {
  AnalysisJobDetailResponse,
  AnalysisJobSummaryResponse,
  ScanSummaryItemResponse,
} from '../api/model';
import {
  getGetAnalysisJobApiV1AnalysisJobsJobIdGetQueryKey,
  getListAnalysisJobsApiV1ClustersClusterIdAnalysisJobsGetQueryKey,
  useCreateAnalysisJobApiV1AnalysisJobsPost,
  useExecuteAnalysisJobApiV1AnalysisJobsJobIdExecutePost,
  useGetAnalysisJobApiV1AnalysisJobsJobIdGet,
  useListAnalysisJobsApiV1ClustersClusterIdAnalysisJobsGet,
} from '../api/generated/analysis/analysis';
import {
  getListClustersApiV1ClustersGetQueryKey,
  useListClustersApiV1ClustersGet,
} from '../api/generated/clusters/clusters';
import {
  getListClusterScansApiV1ClustersClusterIdScansGetQueryKey,
  useListClusterScansApiV1ClustersClusterIdScansGet,
} from '../api/generated/scans/scans';
import ChokePointList from '../components/risk/ChokePointList';
import ClusterFlowNav from '../components/layout/ClusterFlowNav';

type ClusterOption = {
  id: string;
  name: string;
  cluster_type?: string | null;
};

type SelectedScans = {
  k8s_scan_id: string | null;
  image_scan_id: string | null;
  aws_scan_id: string | null;
};

type AnalysisTab = 'analysis' | 'recommendations';

const isScanSummaryItem = (value: unknown): value is ScanSummaryItemResponse =>
  Boolean(
    value &&
      typeof value === 'object' &&
      'scan_id' in value &&
      'scanner_type' in value &&
      'status' in value,
  );

const isAnalysisJobSummary = (value: unknown): value is AnalysisJobSummaryResponse =>
  Boolean(value && typeof value === 'object' && 'job_id' in value && 'status' in value);

const isAnalysisJobDetail = (value: unknown): value is AnalysisJobDetailResponse =>
  Boolean(
    value &&
      typeof value === 'object' &&
      'job_id' in value &&
      'status' in value &&
      'cluster_id' in value,
  );

const RiskPage: React.FC = () => {
  const { clusterId: routeClusterId = '' } = useParams();
  const queryClient = useQueryClient();
  const { data: clustersData, isLoading: isLoadingClusters } = useListClustersApiV1ClustersGet();
  const clusters = (Array.isArray(clustersData) ? clustersData : []) as ClusterOption[];

  const [activeTab, setActiveTab] = useState<AnalysisTab>('analysis');
  const [selectedClusterId, setSelectedClusterId] = useState('');
  const [selectedScans, setSelectedScans] = useState<SelectedScans>({
    k8s_scan_id: null,
    image_scan_id: null,
    aws_scan_id: null,
  });
  const [activeJobId, setActiveJobId] = useState('');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'danger'; message: string } | null>(
    null,
  );

  useEffect(() => {
    if (routeClusterId) {
      setSelectedClusterId(routeClusterId);
      return;
    }

    if (!selectedClusterId && clusters.length > 0) {
      setSelectedClusterId(clusters[0].id);
    }
  }, [clusters, routeClusterId, selectedClusterId]);

  useEffect(() => {
    setActiveJobId('');
    setFeedback(null);
  }, [selectedClusterId]);

  const selectedCluster = clusters.find((cluster) => cluster.id === selectedClusterId) ?? null;

  const { data: scansData, isLoading: isLoadingScans } =
    useListClusterScansApiV1ClustersClusterIdScansGet(selectedClusterId);
  const scanItems = Array.isArray((scansData as { items?: unknown[] } | undefined)?.items)
    ? ((scansData as { items?: unknown[] }).items ?? []).filter(isScanSummaryItem)
    : [];
  const completedScans = scanItems.filter((scan) => scan.status === 'completed');

  useEffect(() => {
    setSelectedScans((current) => {
      let nextState = current;

      const ensureStillValid = (
        field: keyof SelectedScans,
        scannerType: 'k8s' | 'image' | 'aws',
      ) => {
        const selectedScanId = current[field];
        if (!selectedScanId) {
          return;
        }

        const matchingVisibleScan = scanItems.find(
          (scan) => scan.scan_id === selectedScanId && scan.scanner_type === scannerType,
        );

        if (!matchingVisibleScan) {
          return;
        }

        if (matchingVisibleScan.status === 'completed') {
          return;
        }

        nextState = {
          ...nextState,
          [field]: null,
        };
      };

      ensureStillValid('k8s_scan_id', 'k8s');
      ensureStillValid('image_scan_id', 'image');
      ensureStillValid('aws_scan_id', 'aws');

      return nextState;
    });
  }, [scanItems]);

  const {
    data: jobsData,
    isLoading: isLoadingJobs,
  } = useListAnalysisJobsApiV1ClustersClusterIdAnalysisJobsGet(selectedClusterId, undefined, {
    query: {
      enabled: Boolean(selectedClusterId),
    },
  });
  const jobItems = Array.isArray((jobsData as { items?: unknown[] } | undefined)?.items)
    ? ((jobsData as { items?: unknown[] }).items ?? []).filter(isAnalysisJobSummary)
    : [];

  useEffect(() => {
    if (!activeJobId && jobItems.length > 0) {
      setActiveJobId(jobItems[0].job_id);
    }
  }, [activeJobId, jobItems]);

  const { data: activeJob, isFetching: isPollingJob } = useGetAnalysisJobApiV1AnalysisJobsJobIdGet(
    activeJobId,
    {
      query: {
        enabled: Boolean(activeJobId),
        refetchInterval: (query) => {
          const job = query.state.data;
          if (!job || typeof job !== "object" || !('status' in job)) {
            return false;
          }

          return ['created', 'queued', 'running', 'processing'].includes(job.status)
            ? 3000
            : false;
        },
      },
    },
  );
  const selectedActiveJob = isAnalysisJobDetail(activeJob) ? activeJob : null;

  const {
    mutate: createAnalysisJob,
    isPending: isCreatingJob,
  } = useCreateAnalysisJobApiV1AnalysisJobsPost();
  const {
    mutate: executeAnalysisJob,
    isPending: isExecutingJob,
  } = useExecuteAnalysisJobApiV1AnalysisJobsJobIdExecutePost();

  const selectedCount = Object.values(selectedScans).filter(Boolean).length;

  const preferredScannerTypes = useMemo(() => {
    if (selectedCluster?.cluster_type === 'aws') {
      return ['aws'] as const;
    }

    return ['k8s', 'image'] as const;
  }, [selectedCluster?.cluster_type]);

  const visibleScannerGroups = useMemo(() => {
    const order = [...preferredScannerTypes];

    for (const scan of completedScans) {
      if (
        (scan.scanner_type === 'k8s' || scan.scanner_type === 'image' || scan.scanner_type === 'aws') &&
        !order.includes(scan.scanner_type)
      ) {
        order.push(scan.scanner_type);
      }
    }

    return order.map((scannerType) => ({
      scannerType,
      items: completedScans
        .filter((scan) => scan.scanner_type === scannerType)
        .sort((left, right) => {
          const leftTime = new Date(left.completed_at ?? left.created_at).getTime();
          const rightTime = new Date(right.completed_at ?? right.created_at).getTime();
          return rightTime - leftTime;
        }),
    }));
  }, [completedScans, preferredScannerTypes]);

  const getScannerTypeLabel = (scannerType: string) => {
    switch (scannerType) {
      case 'k8s':
        return 'Kubernetes 스캔';
      case 'image':
        return '이미지 스캔';
      case 'aws':
        return 'AWS 스캔';
      default:
        return scannerType;
    }
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-success';
      case 'failed':
        return 'bg-danger';
      case 'running':
      case 'processing':
        return 'bg-primary';
      default:
        return 'bg-secondary';
    }
  };

  const formatDateTime = (value?: string | null) => {
    if (!value) {
      return '-';
    }

    return new Date(value).toLocaleString();
  };

  const formatRawResult = (value: boolean) => (value ? '사용 가능' : '없음');

  const handleScanSelection = (field: keyof SelectedScans, scanId: string) => {
    setSelectedScans((current) => ({
      ...current,
      [field]: current[field] === scanId ? null : scanId,
    }));
  };

  const handleRefresh = () => {
    queryClient.invalidateQueries({
      queryKey: getListClustersApiV1ClustersGetQueryKey(),
    });
    queryClient.invalidateQueries({
      queryKey: getListClusterScansApiV1ClustersClusterIdScansGetQueryKey(selectedClusterId),
    });
    queryClient.invalidateQueries({
      queryKey: getListAnalysisJobsApiV1ClustersClusterIdAnalysisJobsGetQueryKey(selectedClusterId),
    });
    if (activeJobId) {
      queryClient.invalidateQueries({
        queryKey: getGetAnalysisJobApiV1AnalysisJobsJobIdGetQueryKey(activeJobId),
      });
    }
  };

  const handleCreateAndExecute = () => {
    if (selectedCount === 0) {
      setFeedback({
        type: 'danger',
        message: '분석 작업 생성 전에 완료된 스캔 결과를 하나 이상 선택하세요.',
      });
      return;
    }

    setFeedback(null);
    createAnalysisJob(
      {
        data: selectedScans,
      },
      {
        onSuccess: (response) => {
          const jobId = response?.job_id;

          if (!jobId) {
            setFeedback({
              type: 'danger',
              message: '분석 작업이 생성되었지만 작업 ID가 반환되지 않았습니다.',
            });
            return;
          }

          setActiveJobId(jobId);
          queryClient.invalidateQueries({
            queryKey: getListAnalysisJobsApiV1ClustersClusterIdAnalysisJobsGetQueryKey(
              selectedClusterId,
            ),
          });
          queryClient.invalidateQueries({
            queryKey: getGetAnalysisJobApiV1AnalysisJobsJobIdGetQueryKey(jobId),
          });

          executeAnalysisJob(
            { jobId },
            {
              onSuccess: () => {
                setFeedback({
                  type: 'success',
                  message: `분석 작업 ${jobId}이(가) 생성되고 실행이 시작되었습니다.`,
                });
                queryClient.invalidateQueries({
                  queryKey: getListAnalysisJobsApiV1ClustersClusterIdAnalysisJobsGetQueryKey(
                    selectedClusterId,
                  ),
                });
                queryClient.invalidateQueries({
                  queryKey: getGetAnalysisJobApiV1AnalysisJobsJobIdGetQueryKey(jobId),
                });
              },
              onError: () => {
                setFeedback({
                  type: 'danger',
                  message: `분석 작업 ${jobId}이(가) 생성되었지만 실행 시작에 실패했습니다.`,
                });
              },
            },
          );
        },
        onError: () => {
          setFeedback({
            type: 'danger',
            message: '분석 작업 생성에 실패했습니다.',
          });
        },
      },
    );
  };

  const renderScanCandidate = (
    scan: ScanSummaryItemResponse,
    field: keyof SelectedScans,
    scannerType: string,
  ) => {
    const isSelected = selectedScans[field] === scan.scan_id;

    return (
      <button
        key={scan.scan_id}
        type="button"
        className={`btn text-start border rounded-3 p-3 w-100 ${
          isSelected ? 'border-primary bg-primary-subtle' : 'bg-white'
        }`}
        onClick={() => handleScanSelection(field, scan.scan_id)}
      >
        <div className="d-flex justify-content-between align-items-start gap-3 mb-2">
          <div>
            <div className="small text-muted mb-1">{getScannerTypeLabel(scannerType)}</div>
            <div className="fw-semibold text-break">{scan.scan_id}</div>
          </div>
          <div className="d-flex align-items-center gap-2">
            <span className={`badge ${getStatusBadgeClass(scan.status)}`}>{scan.status}</span>
            {isSelected && <span className="badge bg-primary">선택됨</span>}
          </div>
        </div>
        <div className="row g-2 small text-muted">
          <div className="col-12 col-md-6">
            <strong className="text-dark">생성:</strong> {formatDateTime(scan.created_at)}
          </div>
          <div className="col-12 col-md-6">
            <strong className="text-dark">완료:</strong> {formatDateTime(scan.completed_at)}
          </div>
          <div className="col-12 col-md-6">
            <strong className="text-dark">파일:</strong> {scan.file_count}
          </div>
          <div className="col-12 col-md-6">
            <strong className="text-dark">원시 결과:</strong> {formatRawResult(scan.has_raw_result)}
          </div>
        </div>
      </button>
    );
  };

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h1 className="h2 mb-1">리스크 최적화</h1>
          <p className="dg-subtitle-text mb-0">
            분석 워크플로, 작업 추적 및 권장 완화 조치.
          </p>
        </div>
      </div>

      {routeClusterId ? <ClusterFlowNav clusterId={routeClusterId} current="risk" /> : null}

      <ul className="nav nav-tabs mb-4">
        <li className="nav-item">
          <button
            type="button"
            className={`nav-link ${activeTab === 'analysis' ? 'active' : ''}`}
            onClick={() => setActiveTab('analysis')}
          >
            분석
          </button>
        </li>
        <li className="nav-item">
          <button
            type="button"
            className={`nav-link ${activeTab === 'recommendations' ? 'active' : ''}`}
            onClick={() => setActiveTab('recommendations')}
          >
            권장 사항
          </button>
        </li>
      </ul>

      {activeTab === 'analysis' && (
        <div className="d-flex flex-column gap-4">
          <div className="card shadow-sm border-0">
            <div className="card-body">
              <div className="d-flex justify-content-between align-items-start gap-3 flex-wrap">
                <div>
                  <h3 className="h5 mb-1">수동 분석</h3>
                  <p className="text-muted mb-0">
                    스캔 범위는 표시되는 후보만 필터링합니다. 선택한 스캔 ID는 범위 변경 시에도 전역적으로 유지됩니다.
                  </p>
                </div>
                <div className="d-flex gap-2 flex-wrap align-items-end">
                  <div style={{ minWidth: '280px' }}>
                    <label htmlFor="cluster-select" className="form-label mb-1">
                      스캔 범위
                    </label>
                    <select
                      id="cluster-select"
                      className="form-select"
                      value={selectedClusterId}
                      onChange={(event) => setSelectedClusterId(event.target.value)}
                      disabled={isLoadingClusters || clusters.length === 0}
                    >
                      {clusters.length === 0 && <option value="">사용 가능한 클러스터 없음</option>}
                      {clusters.map((cluster) => (
                        <option key={cluster.id} value={cluster.id}>
                          {cluster.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <button
                    type="button"
                    className="btn btn-outline-secondary"
                    onClick={handleRefresh}
                    disabled={!selectedClusterId}
                  >
                    새로 고침
                  </button>
                </div>
              </div>

              {selectedCluster && (
                <div className="mt-3 small text-muted">
                  <strong className="text-dark">{selectedCluster.name}</strong>의 스캔 후보 표시{' '}
                  ({selectedCluster.cluster_type ?? '알 수 없음'} 클러스터). 범위를 변경해도 현재 선택은 초기화되지 않습니다.
                </div>
              )}

              {feedback && (
                <div className={`alert alert-${feedback.type} mt-3 mb-0`} role="alert">
                  {feedback.message}
                </div>
              )}
            </div>
          </div>

          <div className="row g-4">
            <div className="col-12 col-xl-7">
              <div className="card shadow-sm border-0 h-100">
                <div className="card-body">
                  <div className="d-flex justify-content-between align-items-center mb-3">
                    <div>
                      <h4 className="h6 mb-1">스캔 후보</h4>
                      <p className="text-muted small mb-0">
                        완료된 구체적인 스캔 레코드를 선택하세요. 표시되는 후보는 범위별이지만 선택 상태는 전역입니다.
                      </p>
                    </div>
                    <span className="badge bg-light text-dark border">
                      {selectedCount}개 선택됨
                    </span>
                  </div>

                  {isLoadingScans ? (
                    <div className="text-muted">스캔 후보 불러오는 중…</div>
                  ) : visibleScannerGroups.length === 0 ? (
                    <div className="text-muted">이 클러스터에서 완료된 스캔 없음.</div>
                  ) : (
                    <div className="d-flex flex-column gap-4">
                      {visibleScannerGroups.map((group) => {
                        const field = `${group.scannerType}_scan_id` as keyof SelectedScans;

                        return (
                          <div key={group.scannerType}>
                            <div className="d-flex justify-content-between align-items-center mb-2">
                              <h5 className="h6 mb-0">{getScannerTypeLabel(group.scannerType)}</h5>
                              <span className="text-muted small">
                                {group.items.length}개의 완료된 후보
                              </span>
                            </div>

                            {group.items.length === 0 ? (
                              <div className="border rounded-3 p-3 text-muted small">
                                현재 클러스터 범위에서 완료된 {group.scannerType} 스캔 결과가 없습니다.
                              </div>
                            ) : (
                              <div className="d-flex flex-column gap-2">
                                {group.items.map((scan) =>
                                  renderScanCandidate(scan, field, group.scannerType),
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="col-12 col-xl-5">
                <div className="card shadow-sm border-0 mb-4">
                <div className="card-body">
                  <h4 className="h6 mb-3">생성 및 실행</h4>
                  <p className="text-muted small mb-3">
                    이 요약은 현재 표시된 범위가 아닌 전역적으로 선택된 스캔 ID를 항상 반영합니다.
                  </p>
                  <div className="d-flex flex-column gap-2 small">
                    <div>
                      <strong>k8s_scan_id:</strong> {selectedScans.k8s_scan_id ?? '-'}
                    </div>
                    <div>
                      <strong>image_scan_id:</strong> {selectedScans.image_scan_id ?? '-'}
                    </div>
                    <div>
                      <strong>aws_scan_id:</strong> {selectedScans.aws_scan_id ?? '-'}
                    </div>
                  </div>
                  <button
                    type="button"
                    className="btn btn-primary mt-3 w-100"
                    onClick={handleCreateAndExecute}
                    disabled={
                      !selectedClusterId || selectedCount === 0 || isCreatingJob || isExecutingJob
                    }
                  >
                    {isCreatingJob || isExecutingJob ? '제출 중…' : '작업 생성 및 실행'}
                  </button>
                </div>
              </div>

              <div className="card shadow-sm border-0">
                <div className="card-body">
                  <div className="d-flex justify-content-between align-items-center mb-3">
                    <div>
                      <h4 className="h6 mb-1">작업 상태</h4>
                      <p className="text-muted small mb-0">
                        실행 시작 후 저장된 분석 작업을 폴링합니다.
                      </p>
                    </div>
                    {selectedActiveJob && (
                      <span className={`badge ${getStatusBadgeClass(selectedActiveJob.status)}`}>
                        {selectedActiveJob.status}
                      </span>
                    )}
                  </div>

                  {!activeJobId && (
                    <div className="text-muted">최근 작업을 선택하거나 새 작업을 생성하세요.</div>
                  )}

                  {activeJobId && !selectedActiveJob && (
                    <div className="text-muted">작업 상태 불러오는 중…</div>
                  )}

                  {selectedActiveJob && (
                    <div className="d-flex flex-column gap-2 small">
                      <div>
                        <strong>작업 ID:</strong>{' '}
                        <span className="text-break">{selectedActiveJob.job_id}</span>
                      </div>
                      <div>
                        <strong>현재 단계:</strong> {selectedActiveJob.current_step ?? '-'}
                      </div>
                      <div>
                        <strong>오류:</strong> {selectedActiveJob.error_message ?? '-'}
                      </div>
                      <div>
                        <strong>생성:</strong> {formatDateTime(selectedActiveJob.created_at)}
                      </div>
                      <div>
                        <strong>시작:</strong> {formatDateTime(selectedActiveJob.started_at)}
                      </div>
                      <div>
                        <strong>완료:</strong> {formatDateTime(selectedActiveJob.completed_at)}
                      </div>
                      {isPollingJob && <div className="text-muted">상태 새로 고침 중…</div>}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="card shadow-sm border-0">
            <div className="card-body">
              <div className="d-flex justify-content-between align-items-center mb-3">
                <div>
                  <h4 className="h6 mb-1">최근 분석 작업</h4>
                  <p className="text-muted small mb-0">
                    현재 클러스터 범위의 최근 저장된 분석 작업.
                  </p>
                </div>
              </div>

              {isLoadingJobs ? (
                <div className="text-muted">분석 작업 불러오는 중…</div>
              ) : jobItems.length === 0 ? (
                <div className="text-muted">이 클러스터에서 분석 작업 없음.</div>
              ) : (
                <div className="table-responsive">
                  <table className="table align-middle mb-0">
                    <thead className="table-light">
                      <tr>
                        <th>작업 ID</th>
                        <th>상태</th>
                        <th>현재 단계</th>
                        <th>생성</th>
                        <th>선택된 스캔</th>
                      </tr>
                    </thead>
                    <tbody>
                      {jobItems.map((job) => (
                        <tr
                          key={job.job_id}
                          role="button"
                          className={activeJobId === job.job_id ? 'table-active' : undefined}
                          onClick={() => setActiveJobId(job.job_id)}
                        >
                          <td className="text-break">{job.job_id}</td>
                          <td>
                            <span className={`badge ${getStatusBadgeClass(job.status)}`}>
                              {job.status}
                            </span>
                          </td>
                          <td>{job.current_step ?? '-'}</td>
                          <td>{formatDateTime(job.created_at)}</td>
                          <td className="small text-muted">
                            {[
                              job.k8s_scan_id ? `k8s:${job.k8s_scan_id}` : null,
                              job.image_scan_id ? `image:${job.image_scan_id}` : null,
                              job.aws_scan_id ? `aws:${job.aws_scan_id}` : null,
                            ]
                              .filter(Boolean)
                              .join(' | ') || '-'}
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
      )}

      {activeTab === 'recommendations' && (
        <div>
          <div className="mb-4">
            <h3 className="h5 mb-3">주요 권장 사항</h3>
            <ChokePointList />
          </div>
        </div>
      )}
    </div>
  );
};

export default RiskPage;
