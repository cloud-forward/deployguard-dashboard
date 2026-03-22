import React, { useMemo, useState } from 'react';
import { useListClustersApiV1ClustersGet } from '../api/generated/clusters/clusters';
import type {
  ClusterScanListResponse,
  RawScanResultUrlResponse,
  ScanDetailResponse,
  ScanStatusResponse,
} from '../api/model';
import {
  useGetRawResultDownloadUrlApiV1ScansScanIdRawResultUrlGet,
  useGetScanDetailApiV1ScansScanIdGet,
  useGetScanStatusApiV1ScansScanIdStatusGet,
  useListClusterScansApiV1ClustersClusterIdScansGet,
} from '../api/generated/scans/scans';

type ClusterOption = {
  id: string;
  name: string;
};

const statusBadgeClass: Record<string, string> = {
  queued: 'bg-secondary',
  created: 'bg-secondary',
  running: 'bg-primary',
  processing: 'bg-primary',
  uploading: 'bg-info text-dark',
  completed: 'bg-success',
  failed: 'bg-danger',
};

const statusLabel: Record<string, string> = {
  queued: 'Queued',
  created: 'Queued',
  running: 'Running',
  processing: 'Processing',
  uploading: 'Uploading',
  completed: 'Completed',
  failed: 'Failed',
};

const formatDateTime = (value?: string | null) => {
  if (!value) {
    return '-';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString();
};

const toErrorMessage = (error: unknown, fallback: string) => {
  if (error && typeof error === 'object' && 'message' in error) {
    const message = error.message;
    if (typeof message === 'string' && message.trim()) {
      return message;
    }
  }

  return fallback;
};

const renderList = (values?: string[]) => {
  if (!values || values.length === 0) {
    return <span className="text-muted">-</span>;
  }

  return (
    <div className="d-flex flex-column gap-1">
      {values.map((value) => (
        <code key={value} className="small text-break">
          {value}
        </code>
      ))}
    </div>
  );
};

const isClusterScanListResponse = (value: unknown): value is ClusterScanListResponse =>
  Boolean(value && typeof value === 'object' && 'total' in value);

const isScanDetailResponse = (value: unknown): value is ScanDetailResponse =>
  Boolean(value && typeof value === 'object' && 'scan_id' in value && 'scanner_type' in value);

const isScanStatusResponse = (value: unknown): value is ScanStatusResponse =>
  Boolean(value && typeof value === 'object' && 'scan_id' in value && 'status' in value);

const isRawScanResultUrlResponse = (value: unknown): value is RawScanResultUrlResponse =>
  Boolean(value && typeof value === 'object' && 'download_url' in value);

const ScansPage: React.FC = () => {
  const {
    data: clustersResponse,
    isLoading: isClustersLoading,
    isError: isClustersError,
    error: clustersError,
  } = useListClustersApiV1ClustersGet();
  const clusters = useMemo<ClusterOption[]>(
    () => {
      const clusterList = Array.isArray(clustersResponse)
        ? clustersResponse
        : (clustersResponse?.data ?? []);

      return clusterList.map((cluster) => ({
        id: cluster.id,
        name: cluster.name,
      }));
    },
    [clustersResponse],
  );
  const [selectedClusterId, setSelectedClusterId] = useState('');
  const [expandedScanId, setExpandedScanId] = useState('');
  const [shouldLoadRawResult, setShouldLoadRawResult] = useState(false);
  const activeClusterId =
    (selectedClusterId && clusters.some((cluster) => cluster.id === selectedClusterId)
      ? selectedClusterId
      : clusters[0]?.id) ?? '';
  const selectedCluster = clusters.find((cluster) => cluster.id === activeClusterId) ?? null;
  const {
    data: scansResponse,
    isLoading: isScansLoading,
    isError: isScansError,
    error: scansError,
  } = useListClusterScansApiV1ClustersClusterIdScansGet(activeClusterId, {
    query: {
      enabled: Boolean(activeClusterId),
    },
  });
  const scanList = isClusterScanListResponse(scansResponse) ? scansResponse : null;
  const scans = scanList?.items ?? [];
  const expandedScan = scans.find((scan) => scan.scan_id === expandedScanId) ?? null;

  const {
    data: scanDetailResponse,
    isLoading: isScanDetailLoading,
    isError: isScanDetailError,
    error: scanDetailError,
  } = useGetScanDetailApiV1ScansScanIdGet(expandedScanId, {
    query: {
      enabled: Boolean(expandedScanId),
    },
  });
  const {
    data: scanStatusResponse,
    isLoading: isScanStatusLoading,
    isError: isScanStatusError,
    error: scanStatusError,
  } = useGetScanStatusApiV1ScansScanIdStatusGet(expandedScanId, {
    query: {
      enabled: Boolean(expandedScanId),
      refetchInterval: (query) => {
        const nextStatus = isScanStatusResponse(query.state.data)
          ? query.state.data.status
          : null;
        return nextStatus && ['completed', 'failed'].includes(nextStatus) ? false : 10000;
      },
    },
  });
  const {
    data: rawResultResponse,
    isLoading: isRawResultLoading,
    isError: isRawResultError,
    error: rawResultError,
  } = useGetRawResultDownloadUrlApiV1ScansScanIdRawResultUrlGet(expandedScanId, {
    query: {
      enabled: Boolean(expandedScanId) && shouldLoadRawResult,
      retry: false,
    },
  });

  const detail = isScanDetailResponse(scanDetailResponse) ? scanDetailResponse : null;
  const status = isScanStatusResponse(scanStatusResponse) ? scanStatusResponse : null;
  const rawResult = isRawScanResultUrlResponse(rawResultResponse)
    ? rawResultResponse
    : null;
  const effectiveStatus = status?.status ?? detail?.status ?? expandedScan?.status ?? '';

  return (
    <div>
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-3 mb-4">
        <div>
          <h1 className="h2 mb-1">Scans</h1>
          <p className="dg-subtitle-text mb-0">
            Recent scan requests and processing status by cluster.
          </p>
        </div>
        <div style={{ minWidth: 280 }}>
          <label htmlFor="scan-cluster-select" className="form-label mb-1">
            Cluster
          </label>
          <select
            id="scan-cluster-select"
            className="form-select"
            value={activeClusterId}
            onChange={(event) => {
              setSelectedClusterId(event.target.value);
              setExpandedScanId('');
              setShouldLoadRawResult(false);
            }}
            disabled={isClustersLoading || clusters.length === 0}
          >
            {clusters.length === 0 ? (
              <option value="">No clusters available</option>
            ) : (
              clusters.map((cluster) => (
                <option key={cluster.id} value={cluster.id}>
                  {cluster.name} ({cluster.id})
                </option>
              ))
            )}
          </select>
        </div>
      </div>

      {isClustersLoading && (
        <div className="alert alert-secondary" role="status">
          Loading clusters...
        </div>
      )}

      {isClustersError && (
        <div className="alert alert-danger" role="alert">
          {toErrorMessage(clustersError, 'Failed to load clusters.')}
        </div>
      )}

      {!isClustersLoading && !isClustersError && clusters.length === 0 && (
        <div className="alert alert-info mb-0" role="alert">
          No clusters found. Create a cluster first to view scan history.
        </div>
      )}

      {!isClustersLoading && !isClustersError && clusters.length > 0 && (
        <div className="card shadow-sm">
          <div className="card-body p-0">
            <div className="d-flex justify-content-between align-items-center px-3 py-3 border-bottom">
              <div>
                <h2 className="h6 mb-1">Scan History</h2>
                <p className="text-muted small mb-0">
                  {selectedCluster ? `${selectedCluster.name} (${selectedCluster.id})` : 'Selected cluster'}
                </p>
              </div>
              <span className="badge text-bg-dark">
                {scanList?.total ?? scans.length} total
              </span>
            </div>

            {isScansLoading && (
              <div className="p-4 text-center text-muted">Loading scan history...</div>
            )}

            {isScansError && (
              <div className="p-4">
                <div className="alert alert-danger mb-0" role="alert">
                  {toErrorMessage(scansError, 'Failed to load scan history.')}
                </div>
              </div>
            )}

            {!isScansLoading && !isScansError && scans.length === 0 && (
              <div className="p-4 text-center text-muted">
                No scan history found for this cluster.
              </div>
            )}

            {!isScansLoading && !isScansError && scans.length > 0 && (
              <div className="table-responsive">
                <table className="table table-hover mb-0 align-middle">
                  <thead className="table-light">
                    <tr>
                      <th>Cluster</th>
                      <th>Scanner Type</th>
                      <th>Status</th>
                      <th>Requested At</th>
                      <th>Completed At</th>
                      <th className="text-end">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {scans.map((scan) => {
                      const isExpanded = scan.scan_id === expandedScanId;
                      const badgeClass = statusBadgeClass[scan.status] ?? 'bg-secondary';
                      const badgeText = statusLabel[scan.status] ?? scan.status;

                      return (
                        <React.Fragment key={scan.scan_id}>
                          <tr>
                            <td>
                              <div className="fw-semibold">{selectedCluster?.name ?? activeClusterId}</div>
                              <div className="text-muted small">{activeClusterId}</div>
                            </td>
                            <td className="text-nowrap">{scan.scanner_type}</td>
                            <td>
                              <span className={`badge ${badgeClass}`}>
                                {badgeText}
                              </span>
                            </td>
                            <td className="text-nowrap">{formatDateTime(scan.created_at)}</td>
                            <td className="text-nowrap">{formatDateTime(scan.completed_at)}</td>
                            <td className="text-end">
                              <button
                                type="button"
                                className={`btn btn-sm ${isExpanded ? 'btn-secondary' : 'btn-outline-secondary'}`}
                                onClick={() => {
                                  if (isExpanded) {
                                    setExpandedScanId('');
                                    setShouldLoadRawResult(false);
                                    return;
                                  }

                                  setExpandedScanId(scan.scan_id);
                                  setShouldLoadRawResult(false);
                                }}
                              >
                                {isExpanded ? 'Hide Details' : 'View Details'}
                              </button>
                            </td>
                          </tr>
                          {isExpanded && (
                            <tr>
                              <td colSpan={6} className="bg-body-tertiary">
                                <div className="p-3">
                                  <div className="d-flex flex-wrap justify-content-between align-items-start gap-3 mb-3">
                                    <div>
                                      <h3 className="h6 mb-1">Scan Detail</h3>
                                      <p className="text-muted small mb-0">
                                        Live detail and status for {scan.scan_id}
                                      </p>
                                    </div>
                                    <div className="d-flex gap-2">
                                      <span className={`badge ${statusBadgeClass[effectiveStatus] ?? 'bg-secondary'}`}>
                                        {(statusLabel[effectiveStatus] ?? effectiveStatus) || 'Unknown'}
                                      </span>
                                      <button
                                        type="button"
                                        className="btn btn-sm btn-outline-primary"
                                        onClick={() => setShouldLoadRawResult(true)}
                                        disabled={isRawResultLoading}
                                      >
                                        {isRawResultLoading ? 'Loading Raw Result...' : 'Get Raw Result Link'}
                                      </button>
                                    </div>
                                  </div>

                                  {(isScanDetailLoading || isScanStatusLoading) && (
                                    <div className="text-muted small mb-3">Loading scan details...</div>
                                  )}

                                  {(isScanDetailError || isScanStatusError) && (
                                    <div className="alert alert-danger py-2 mb-3" role="alert">
                                      {isScanDetailError
                                        ? toErrorMessage(scanDetailError, 'Failed to load scan detail.')
                                        : toErrorMessage(scanStatusError, 'Failed to load scan status.')}
                                    </div>
                                  )}

                                  <div className="row g-3 small">
                                    <div className="col-12 col-md-6">
                                      <div className="text-muted mb-1">Scan ID</div>
                                      <code className="text-break">{detail?.scan_id ?? status?.scan_id ?? scan.scan_id}</code>
                                    </div>
                                    <div className="col-12 col-md-6">
                                      <div className="text-muted mb-1">Scanner Type</div>
                                      <div>{detail?.scanner_type ?? status?.scanner_type ?? scan.scanner_type}</div>
                                    </div>
                                    <div className="col-12 col-md-6">
                                      <div className="text-muted mb-1">Status</div>
                                      <div>{(statusLabel[effectiveStatus] ?? effectiveStatus) || '-'}</div>
                                    </div>
                                    <div className="col-12 col-md-6">
                                      <div className="text-muted mb-1">Cluster ID</div>
                                      <div className="text-break">{detail?.cluster_id ?? status?.cluster_id ?? activeClusterId}</div>
                                    </div>
                                    <div className="col-12 col-md-6">
                                      <div className="text-muted mb-1">Requested At</div>
                                      <div>{formatDateTime(detail?.created_at ?? status?.created_at ?? scan.created_at)}</div>
                                    </div>
                                    <div className="col-12 col-md-6">
                                      <div className="text-muted mb-1">Started At</div>
                                      <div className="text-muted">Not available from current API</div>
                                    </div>
                                    <div className="col-12 col-md-6">
                                      <div className="text-muted mb-1">Completed At</div>
                                      <div>{formatDateTime(detail?.completed_at ?? status?.completed_at ?? scan.completed_at)}</div>
                                    </div>
                                    <div className="col-12 col-md-6">
                                      <div className="text-muted mb-1">Error Message</div>
                                      <div className="text-muted">Not available from current API</div>
                                    </div>
                                    <div className="col-12">
                                      <div className="text-muted mb-1">Stored S3 Keys</div>
                                      {renderList(detail?.s3_keys)}
                                    </div>
                                    <div className="col-12">
                                      <div className="text-muted mb-1">Uploaded Files</div>
                                      {renderList(status?.files)}
                                    </div>
                                  </div>

                                  {shouldLoadRawResult && rawResult?.download_url && (
                                    <div className="alert alert-success d-flex flex-wrap justify-content-between align-items-center gap-2 mt-3 mb-0">
                                      <div>
                                        Raw result link is ready
                                        {rawResult.expires_in
                                          ? ` (${rawResult.expires_in}s expiry)`
                                          : ''}
                                        .
                                      </div>
                                      <a
                                        href={rawResult.download_url}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="btn btn-sm btn-success"
                                      >
                                        Open Raw Result
                                      </a>
                                    </div>
                                  )}

                                  {shouldLoadRawResult && isRawResultError && (
                                    <div className="alert alert-warning mt-3 mb-0" role="alert">
                                      {toErrorMessage(
                                        rawResultError,
                                        'Raw result link is not available for this scan yet.',
                                      )}
                                    </div>
                                  )}
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ScansPage;
