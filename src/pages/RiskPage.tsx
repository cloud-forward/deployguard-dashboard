import React, { useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
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
    if (!selectedClusterId && clusters.length > 0) {
      setSelectedClusterId(clusters[0].id);
    }
  }, [clusters, selectedClusterId]);

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
        return 'Kubernetes Scans';
      case 'image':
        return 'Image Scans';
      case 'aws':
        return 'AWS Scans';
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

  const formatRawResult = (value: boolean) => (value ? 'Available' : 'Missing');

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
        message: 'Select at least one completed scan result before creating an analysis job.',
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
              message: 'Analysis job was created, but no job ID was returned.',
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
                  message: `Analysis job ${jobId} created and execution started.`,
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
                  message: `Analysis job ${jobId} was created, but execution failed to start.`,
                });
              },
            },
          );
        },
        onError: () => {
          setFeedback({
            type: 'danger',
            message: 'Failed to create analysis job.',
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
            {isSelected && <span className="badge bg-primary">Selected</span>}
          </div>
        </div>
        <div className="row g-2 small text-muted">
          <div className="col-12 col-md-6">
            <strong className="text-dark">Created:</strong> {formatDateTime(scan.created_at)}
          </div>
          <div className="col-12 col-md-6">
            <strong className="text-dark">Completed:</strong> {formatDateTime(scan.completed_at)}
          </div>
          <div className="col-12 col-md-6">
            <strong className="text-dark">Files:</strong> {scan.file_count}
          </div>
          <div className="col-12 col-md-6">
            <strong className="text-dark">Raw Result:</strong> {formatRawResult(scan.has_raw_result)}
          </div>
        </div>
      </button>
    );
  };

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h1 className="h2 mb-1">Risk Optimization</h1>
          <p className="dg-subtitle-text mb-0">
            Analysis workflows, job tracking, and recommended mitigations.
          </p>
        </div>
      </div>

      <ul className="nav nav-tabs mb-4">
        <li className="nav-item">
          <button
            type="button"
            className={`nav-link ${activeTab === 'analysis' ? 'active' : ''}`}
            onClick={() => setActiveTab('analysis')}
          >
            Analysis
          </button>
        </li>
        <li className="nav-item">
          <button
            type="button"
            className={`nav-link ${activeTab === 'recommendations' ? 'active' : ''}`}
            onClick={() => setActiveTab('recommendations')}
          >
            Recommendations
          </button>
        </li>
      </ul>

      {activeTab === 'analysis' && (
        <div className="d-flex flex-column gap-4">
          <div className="card shadow-sm border-0">
            <div className="card-body">
              <div className="d-flex justify-content-between align-items-start gap-3 flex-wrap">
                <div>
                  <h3 className="h5 mb-1">Manual Analysis</h3>
                  <p className="text-muted mb-0">
                    Scan Scope only filters visible candidates. Selected scan IDs persist globally
                    across scope changes.
                  </p>
                </div>
                <div className="d-flex gap-2 flex-wrap align-items-end">
                  <div style={{ minWidth: '280px' }}>
                    <label htmlFor="cluster-select" className="form-label mb-1">
                      Scan Scope
                    </label>
                    <select
                      id="cluster-select"
                      className="form-select"
                      value={selectedClusterId}
                      onChange={(event) => setSelectedClusterId(event.target.value)}
                      disabled={isLoadingClusters || clusters.length === 0}
                    >
                      {clusters.length === 0 && <option value="">No clusters available</option>}
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
                    Refresh
                  </button>
                </div>
              </div>

              {selectedCluster && (
                <div className="mt-3 small text-muted">
                  Showing scan candidates for <strong className="text-dark">{selectedCluster.name}</strong>{' '}
                  ({selectedCluster.cluster_type ?? 'unknown'} cluster). Current selections are not
                  cleared when you switch scope.
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
                      <h4 className="h6 mb-1">Scan Candidates</h4>
                      <p className="text-muted small mb-0">
                        Select concrete completed scan records. Visible candidates are scope-specific,
                        but selection state is global.
                      </p>
                    </div>
                    <span className="badge bg-light text-dark border">
                      {selectedCount} selected
                    </span>
                  </div>

                  {isLoadingScans ? (
                    <div className="text-muted">Loading scan candidates...</div>
                  ) : visibleScannerGroups.length === 0 ? (
                    <div className="text-muted">No completed scans found for this cluster.</div>
                  ) : (
                    <div className="d-flex flex-column gap-4">
                      {visibleScannerGroups.map((group) => {
                        const field = `${group.scannerType}_scan_id` as keyof SelectedScans;

                        return (
                          <div key={group.scannerType}>
                            <div className="d-flex justify-content-between align-items-center mb-2">
                              <h5 className="h6 mb-0">{getScannerTypeLabel(group.scannerType)}</h5>
                              <span className="text-muted small">
                                {group.items.length} completed candidate{group.items.length === 1 ? '' : 's'}
                              </span>
                            </div>

                            {group.items.length === 0 ? (
                              <div className="border rounded-3 p-3 text-muted small">
                                No completed {group.scannerType} scan results are available for the
                                current cluster scope.
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
                  <h4 className="h6 mb-3">Create And Execute</h4>
                  <p className="text-muted small mb-3">
                    This summary always reflects the global selected scan IDs, not just the current
                    visible scope.
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
                    {isCreatingJob || isExecutingJob ? 'Submitting...' : 'Create Job And Execute'}
                  </button>
                </div>
              </div>

              <div className="card shadow-sm border-0">
                <div className="card-body">
                  <div className="d-flex justify-content-between align-items-center mb-3">
                    <div>
                      <h4 className="h6 mb-1">Job Status</h4>
                      <p className="text-muted small mb-0">
                        Polling the persisted analysis job after execution starts.
                      </p>
                    </div>
                    {selectedActiveJob && (
                      <span className={`badge ${getStatusBadgeClass(selectedActiveJob.status)}`}>
                        {selectedActiveJob.status}
                      </span>
                    )}
                  </div>

                  {!activeJobId && (
                    <div className="text-muted">Select a recent job or create a new one.</div>
                  )}

                  {activeJobId && !selectedActiveJob && (
                    <div className="text-muted">Loading job status...</div>
                  )}

                  {selectedActiveJob && (
                    <div className="d-flex flex-column gap-2 small">
                      <div>
                        <strong>Job ID:</strong>{' '}
                        <span className="text-break">{selectedActiveJob.job_id}</span>
                      </div>
                      <div>
                        <strong>Current Step:</strong> {selectedActiveJob.current_step ?? '-'}
                      </div>
                      <div>
                        <strong>Error:</strong> {selectedActiveJob.error_message ?? '-'}
                      </div>
                      <div>
                        <strong>Created:</strong> {formatDateTime(selectedActiveJob.created_at)}
                      </div>
                      <div>
                        <strong>Started:</strong> {formatDateTime(selectedActiveJob.started_at)}
                      </div>
                      <div>
                        <strong>Completed:</strong> {formatDateTime(selectedActiveJob.completed_at)}
                      </div>
                      {isPollingJob && <div className="text-muted">Refreshing status...</div>}
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
                  <h4 className="h6 mb-1">Recent Analysis Jobs</h4>
                  <p className="text-muted small mb-0">
                    Recent persisted analysis jobs for the current cluster scope.
                  </p>
                </div>
              </div>

              {isLoadingJobs ? (
                <div className="text-muted">Loading analysis jobs...</div>
              ) : jobItems.length === 0 ? (
                <div className="text-muted">No analysis jobs found for this cluster.</div>
              ) : (
                <div className="table-responsive">
                  <table className="table align-middle mb-0">
                    <thead className="table-light">
                      <tr>
                        <th>Job ID</th>
                        <th>Status</th>
                        <th>Current Step</th>
                        <th>Created</th>
                        <th>Selected Scans</th>
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
            <h3 className="h5 mb-3">Top Recommendations</h3>
            <ChokePointList />
          </div>
        </div>
      )}
    </div>
  );
};

export default RiskPage;
