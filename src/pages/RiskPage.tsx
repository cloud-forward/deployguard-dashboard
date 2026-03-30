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

type AnalysisTab = 'analysis' | 'results';

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
        return 'dg-badge dg-badge--success';
      case 'failed':
        return 'dg-badge dg-badge--high';
      case 'running':
      case 'processing':
        return 'dg-badge dg-badge--info';
      default:
        return 'dg-badge dg-badge--low';
    }
  };

  const formatDateTime = (value?: string | null) => {
    if (!value) {
      return '-';
    }

    return new Date(value).toLocaleString();
  };

  const getScanListMaxHeight = (scannerType: 'k8s' | 'image' | 'aws') => {
    if (visibleScannerGroups.length === 1 && scannerType === 'aws') {
      return '400px';
    }

    return '220px';
  };

  const formatRawResult = (value: boolean) => (value ? '사용 가능' : '없음');
  const analysisPanelMinHeight = '600px';

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
          isSelected ? 'border-primary bg-primary-subtle' : 'bg-card-surface'
        }`}
        onClick={() => handleScanSelection(field, scan.scan_id)}
      >
        <div className="d-flex justify-content-between align-items-start gap-3 mb-2">
          <div>
            <div className="small text-muted mb-1">{getScannerTypeLabel(scannerType)}</div>
            <div className="fw-semibold text-break">{scan.scan_id}</div>
          </div>
          <div className="d-flex align-items-center gap-2">
            <span className={`${getStatusBadgeClass(scan.status)}`}>{scan.status}</span>
            {isSelected && <span className="dg-badge dg-badge--info">선택됨</span>}
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
            <strong className="text-dark">원본 결과:</strong> {formatRawResult(scan.has_raw_result)}
          </div>
        </div>
      </button>
    );
  };

  return (
    <div className="dg-page-shell">
      <div className="dg-page-header">
        <div className="dg-page-heading">
          <h1 className="dg-page-title">위험 분석 및 최적화</h1>
          <p className="dg-page-description">선택한 스캔을 바탕으로 위험을 분석하고, 결과와 권고사항을 확인합니다</p>
        </div>
      </div>

      {routeClusterId ? <ClusterFlowNav clusterId={routeClusterId} current="risk" /> : null}

      <div className="d-flex justify-content-between align-items-end gap-3 mb-3 flex-wrap">
        <ul className="nav nav-tabs mb-0">
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
              className={`nav-link ${activeTab === 'results' ? 'active' : ''}`}
              onClick={() => setActiveTab('results')}
            >
              결과
            </button>
          </li>
        </ul>
        {activeTab === 'analysis' && (
          <div className="d-flex gap-2 flex-wrap align-items-center">
            <label htmlFor="cluster-select" className="form-label mb-0 text-nowrap small">
              스캔 범위
            </label>
            <div style={{ minWidth: '220px' }}>
              <select
                id="cluster-select"
                className="form-select form-select-sm"
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
              className="btn btn-outline-secondary btn-sm"
              onClick={handleRefresh}
              disabled={!selectedClusterId}
            >
              새로 고침
            </button>
          </div>
        )}
      </div>

      {activeTab === 'analysis' && (
        <div className="d-flex flex-column gap-3">
          {feedback && (
            <div className={`alert alert-${feedback.type} mb-0`} role="alert">
              {feedback.message}
            </div>
          )}

          <div className="row g-3" style={{ alignItems: 'stretch' }}>
            <div className="col-12 col-xl-7" style={{ display: 'flex' }}>
              <div className="card shadow-sm border-0 w-100" style={{ minHeight: analysisPanelMinHeight }}>
                <div className="card-body py-3">
                  <style>{`
                    .dg-risk-candidate-scroll {
                      padding-right: 0.5rem;
                    }
                    .dg-risk-candidate-scroll {
                      overflow-y: auto;
                    }
                    .dg-risk-candidate-scroll::-webkit-scrollbar {
                      width: 6px;
                    }
                    .dg-risk-candidate-scroll::-webkit-scrollbar-track {
                      background: transparent;
                    }
                    .dg-risk-candidate-scroll::-webkit-scrollbar-thumb {
                      background: rgba(148, 163, 184, 0.4);
                      border-radius: 3px;
                    }
                    .dg-risk-candidate-scroll::-webkit-scrollbar-thumb:hover {
                      background: rgba(148, 163, 184, 0.6);
                    }
                  `}</style>
                  <div className="d-flex justify-content-between align-items-center mb-2">
                    <h4 className="h6 mb-0">스캔 후보</h4>
                    <span className="dg-badge dg-badge--tag">
                      {selectedCount}개 선택됨
                    </span>
                  </div>

                  {isLoadingScans ? (
                    <div className="text-muted">스캔 후보 불러오는 중…</div>
                  ) : visibleScannerGroups.length === 0 ? (
                    <div className="text-muted">이 클러스터에서 완료된 스캔 없음.</div>
                  ) : (
                    <div className="d-flex flex-column gap-3">
                      {visibleScannerGroups.map((group) => {
                        const field = `${group.scannerType}_scan_id` as keyof SelectedScans;

                        return (
                          <div key={group.scannerType}>
                            <div className="d-flex justify-content-between align-items-center mb-2">
                              <h5 className="h6 mb-0">{getScannerTypeLabel(group.scannerType)}</h5>
                              {group.items.length > 1 && (
                                <span className="text-muted small">
                                  +{group.items.length - 1}
                                </span>
                              )}
                            </div>

                            {group.items.length === 0 ? (
                              <div className="border rounded-3 p-3 text-muted small">
                                현재 클러스터 범위에서 완료된 {group.scannerType} 스캔 결과가 없습니다.
                              </div>
                            ) : (
                              <div
                                className={`dg-risk-candidate-scroll ${group.scannerType}`}
                                style={{
                                  maxHeight: getScanListMaxHeight(group.scannerType),
                                }}
                              >
                                <div className="d-flex flex-column gap-2">
                                  {group.items.map((scan) =>
                                    renderScanCandidate(scan, field, group.scannerType),
                                  )}
                                </div>
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

            <div className="col-12 col-xl-5 d-flex flex-column" style={{ minHeight: analysisPanelMinHeight }}>
              <div className="card shadow-sm border-0 mb-3">
                <div className="card-body py-3">
                  <h4 className="h6 mb-2">생성 및 실행</h4>
                  <div className="d-flex flex-column gap-2 small mb-3">
                    <div>
                      <strong>k8s:</strong> {selectedScans.k8s_scan_id ?? '-'}
                    </div>
                    <div>
                      <strong>image:</strong> {selectedScans.image_scan_id ?? '-'}
                    </div>
                    <div>
                      <strong>aws:</strong> {selectedScans.aws_scan_id ?? '-'}
                    </div>
                  </div>
                  <button
                    type="button"
                    className="btn btn-primary btn-sm w-100"
                    onClick={handleCreateAndExecute}
                    disabled={
                      !selectedClusterId || selectedCount === 0 || isCreatingJob || isExecutingJob
                    }
                  >
                    {isCreatingJob || isExecutingJob ? '제출 중…' : '작업 생성 및 실행'}
                  </button>
                </div>
              </div>

              <div className="card shadow-sm border-0" style={{ minHeight: '220px', flex: 1 }}>
                <div className="card-body py-3">
                  <div className="d-flex justify-content-between align-items-center mb-2">
                    <h4 className="h6 mb-0">작업 상태</h4>
                    {selectedActiveJob && (
                      <span className={`${getStatusBadgeClass(selectedActiveJob.status)}`}>
                        {selectedActiveJob.status}
                      </span>
                    )}
                  </div>

                  {!activeJobId && (
                    <div className="text-muted small">최근 작업을 선택하거나 새 작업을 생성하세요.</div>
                  )}

                  {activeJobId && !selectedActiveJob && (
                    <div className="text-muted small">작업 상태 불러오는 중…</div>
                  )}

                  {selectedActiveJob && (
                    <div className="d-flex flex-column gap-1 small">
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
                      {isPollingJob && <div className="text-muted small">상태 새로 고침 중…</div>}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'results' && (
        <div className="card shadow-sm border-0">
          <div className="card-body py-3">
            <style>{`
              .dg-risk-results-scroll {
                max-height: 420px;
                overflow-y: auto;
              }
            `}</style>
            <h4 className="h6 mb-2">최근 분석 작업</h4>

            {isLoadingJobs ? (
              <div className="text-muted small">분석 작업 불러오는 중…</div>
            ) : jobItems.length === 0 ? (
              <div className="text-muted small">이 클러스터에서 분석 작업 없음.</div>
            ) : (
              <div className="dg-risk-results-scroll">
                <div className="table-responsive">
                  <table className="table align-middle mb-0 small">
                    <thead className="table-light">
                      <tr>
                        <th className="small">작업 ID</th>
                        <th className="small">상태</th>
                        <th className="small">현재 단계</th>
                        <th className="small">생성</th>
                        <th className="small">선택된 스캔</th>
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
                          <td className="text-break small">{job.job_id}</td>
                          <td className="small">
                            <span className={`${getStatusBadgeClass(job.status)}`}>
                              {job.status}
                            </span>
                          </td>
                          <td className="small">{job.current_step ?? '-'}</td>
                          <td className="small">{formatDateTime(job.created_at)}</td>
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
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
};

export default RiskPage;
