import React, { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useListClustersApiV1ClustersGet } from '../api/generated/clusters/clusters';
import type {
  ClusterScanListResponse,
  RawScanResultUrlResponse,
  ScanDetailResponse,
  ScanStatusResponse,
} from '../api/model';
import {
  getGetScanDetailApiV1ScansScanIdGetQueryKey,
  getGetScanStatusApiV1ScansScanIdStatusGetQueryKey,
  getListClusterScansApiV1ClustersClusterIdScansGetQueryKey,
  useFailScanApiV1ScansScanIdFailPost,
  useGetRawResultDownloadUrlApiV1ScansScanIdRawResultUrlGet,
  useGetScanDetailApiV1ScansScanIdGet,
  useGetScanStatusApiV1ScansScanIdStatusGet,
  useListClusterScansApiV1ClustersClusterIdScansGet,
} from '../api/generated/scans/scans';
import StatusChip from '../components/StatusChip';

type ClusterOption = {
  id: string;
  name: string;
};

const scannerBadgeStyle: Record<string, React.CSSProperties> = {
  k8s: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '0.2em 0.6em',
    fontSize: '0.72rem',
    fontWeight: 600,
    lineHeight: 1.4,
    borderRadius: '999px',
    whiteSpace: 'nowrap',
    letterSpacing: '0.01em',
    background: 'rgba(59, 130, 246, 0.15)',
    color: '#93c5fd',
    border: '1px solid rgba(59, 130, 246, 0.6)',
  },
  aws: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '0.2em 0.6em',
    fontSize: '0.72rem',
    fontWeight: 600,
    lineHeight: 1.4,
    borderRadius: '999px',
    whiteSpace: 'nowrap',
    letterSpacing: '0.01em',
    background: 'rgba(249, 115, 22, 0.15)',
    color: '#fdba74',
    border: '1px solid rgba(249, 115, 22, 0.6)',
  },
  image: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '0.2em 0.6em',
    fontSize: '0.72rem',
    fontWeight: 600,
    lineHeight: 1.4,
    borderRadius: '999px',
    whiteSpace: 'nowrap',
    letterSpacing: '0.01em',
    background: 'rgba(168, 85, 247, 0.15)',
    color: '#d8b4fe',
    border: '1px solid rgba(168, 85, 247, 0.6)',
  },
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

const canManuallyFailScan = (status: string) =>
  status === 'created' || status === 'processing' || status === 'uploading';

const renderScannerBadge = (scannerType?: string) => {
  const normalizedScannerType = scannerType ?? '';
  const badgeStyle = scannerBadgeStyle[normalizedScannerType];

  if (badgeStyle) {
    return (
      <span style={badgeStyle}>
        {normalizedScannerType}
      </span>
    );
  }

  return (
    <span className="dg-badge dg-badge--low">
      {normalizedScannerType || '-'}
    </span>
  );
};

const ScansPage: React.FC = () => {
  React.useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      .dg-scans-table-container {
        max-height: 618px;
        overflow-y: auto;
        overflow-x: hidden;
        border: 1px solid var(--border-default);
        border-radius: 0.375rem;
      }
      .dg-scans-table-container table {
        margin-bottom: 0;
      }
      .dg-scans-table-container thead th {
        position: sticky;
        top: 0;
        z-index: 10;
        background-color: rgba(15, 23, 42, 0.94);
        border-bottom: 1px solid rgba(148, 163, 184, 0.12);
      }
      @media (max-width: 768px) {
        .dg-scans-table-container {
          max-height: 400px;
        }
      }
    `;
    document.head.appendChild(style);
    return () => {
      document.head.removeChild(style);
    };
  }, []);

  const queryClient = useQueryClient();
  const {
    data: clustersResponse,
    isLoading: isClustersLoading,
    isError: isClustersError,
    error: clustersError,
  } = useListClustersApiV1ClustersGet();
  const clusters = useMemo<ClusterOption[]>(
    () => {
      const clusterList = Array.isArray(clustersResponse) ? clustersResponse : [];

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
  const [failingScanId, setFailingScanId] = useState('');
  const [scanFeedback, setScanFeedback] = useState<{
    type: 'success' | 'danger';
    message: string;
  } | null>(null);
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
  const { mutate: failScan, isPending: isFailingScan } = useFailScanApiV1ScansScanIdFailPost();

  const handleFailScan = (scanId: string) => {
    const confirmed = window.confirm('정말 이 스캔을 취소하시겠습니까?');
    if (!confirmed) {
      return;
    }

    setFailingScanId(scanId);
    setScanFeedback(null);
    failScan(
      { scanId },
      {
        onSuccess: () => {
          setScanFeedback({
            type: 'success',
            message: '스캔이 실패로 표시되었습니다.',
          });
          queryClient.invalidateQueries({
            queryKey: getListClusterScansApiV1ClustersClusterIdScansGetQueryKey(activeClusterId),
          });
          queryClient.invalidateQueries({
            queryKey: getGetScanDetailApiV1ScansScanIdGetQueryKey(scanId),
          });
          queryClient.invalidateQueries({
            queryKey: getGetScanStatusApiV1ScansScanIdStatusGetQueryKey(scanId),
          });
        },
        onError: (error) => {
          setScanFeedback({
            type: 'danger',
            message: toErrorMessage(error, '스캔 실패 표시에 실패했습니다.'),
          });
        },
        onSettled: () => {
          setFailingScanId((current) => (current === scanId ? '' : current));
        },
      },
    );
  };

  return (
    <div className="dg-page-shell">
      <div className="dg-page-header">
        <div className="dg-page-heading">
          <h1 className="dg-page-title">스캔 기록</h1>
          <p className="dg-page-description">클러스터별 스캔 이력과 실행 상태를 확인합니다</p>
        </div>
        <div className="d-flex align-items-center gap-2 flex-wrap" style={{ minWidth: 280 }}>
          <label htmlFor="scan-cluster-select" className="form-label mb-0 text-nowrap small">
            클러스터
          </label>
          <select
            id="scan-cluster-select"
            className="form-select form-select-sm"
            style={{ minWidth: 220, flex: '1 1 220px' }}
            value={activeClusterId}
            onChange={(event) => {
              setSelectedClusterId(event.target.value);
              setExpandedScanId('');
              setShouldLoadRawResult(false);
            }}
            disabled={isClustersLoading || clusters.length === 0}
          >
                {clusters.length === 0 ? (
                  <option value="">사용 가능한 클러스터 없음</option>
                ) : (
                  clusters.map((cluster) => (
                    <option key={cluster.id} value={cluster.id}>
                      {cluster.name}
                    </option>
                  ))
                )}
          </select>
        </div>
      </div>

      {isClustersLoading && (
        <div className="alert alert-secondary" role="status">
          클러스터 불러오는 중…
        </div>
      )}

      {isClustersError && (
        <div className="alert alert-danger" role="alert">
          {toErrorMessage(clustersError, '클러스터를 불러오지 못했습니다.')}
        </div>
      )}

      {!isClustersLoading && !isClustersError && clusters.length === 0 && (
        <div className="alert alert-info mb-0" role="alert">
          클러스터 없음. 스캔 기록을 보려면 먼저 클러스터를 생성하세요.
        </div>
      )}

      {!isClustersLoading && !isClustersError && clusters.length > 0 && (
        <div className="card border-0 shadow-sm h-100">
          <div className="card-body p-0">
            <div className="d-flex justify-content-between align-items-start gap-3 px-3 py-3 border-bottom">
              <div>
                <h2 className="h5 mb-1">스캔 기록</h2>
              </div>
              <span className="dg-badge dg-badge--tag">
                {scanList?.total ?? scans.length}건
              </span>
            </div>

            {scanFeedback && (
              <div className="px-3 pt-3">
                <div className={`alert alert-${scanFeedback.type} mb-0`} role="alert">
                  {scanFeedback.message}
                </div>
              </div>
            )}

            {isScansLoading && (
              <div className="p-4 text-center text-muted">스캔 기록 불러오는 중…</div>
            )}

            {isScansError && (
              <div className="p-4">
                <div className="alert alert-danger mb-0" role="alert">
                  {toErrorMessage(scansError, '스캔 기록을 불러오지 못했습니다.')}
                </div>
              </div>
            )}

            {!isScansLoading && !isScansError && scans.length === 0 && (
              <div className="p-4 text-center text-muted">
                이 클러스터에서 스캔 기록 없음.
              </div>
            )}

            {!isScansLoading && !isScansError && scans.length > 0 && (
              <div className="dg-scans-table-container">
                <table className="table table-hover mb-0 align-middle">
                  <thead className="table-light">
                    <tr>
                      <th>클러스터</th>
                      <th>스캐너 유형</th>
                      <th>상태</th>
                      <th>요청 시각</th>
                      <th>완료 시각</th>
                      <th className="text-end">작업</th>
                    </tr>
                  </thead>
                  <tbody>
                    {scans.map((scan) => {
                      const isExpanded = scan.scan_id === expandedScanId;

                      return (
                        <React.Fragment key={scan.scan_id}>
                          <tr>
                            <td>
                              <div className="fw-semibold">{selectedCluster?.name ?? activeClusterId}</div>
                              <div className="text-muted small">{activeClusterId}</div>
                            </td>
                            <td className="text-nowrap">
                              {renderScannerBadge(scan.scanner_type)}
                            </td>
                            <td>
                              <StatusChip status={scan.status} />
                            </td>
                            <td className="text-nowrap">{formatDateTime(scan.created_at)}</td>
                            <td className="text-nowrap">{formatDateTime(scan.completed_at)}</td>
                            <td className="text-end">
                              <div className="d-inline-flex gap-2">
                                {canManuallyFailScan(scan.status) && (
                                  <button
                                    type="button"
                                    className="btn btn-sm dg-dashboard-action-btn dg-dashboard-action-btn--danger"
                                    onClick={() => handleFailScan(scan.scan_id)}
                                    disabled={isFailingScan && failingScanId === scan.scan_id}
                                  >
                                    {isFailingScan && failingScanId === scan.scan_id
                                      ? '취소 중…'
                                      : '취소'}
                                  </button>
                                )}
                                <button
                                  type="button"
                                  className="btn btn-sm dg-dashboard-action-btn dg-dashboard-action-btn--secondary"
                                  onClick={() => {
                                    setScanFeedback(null);
                                    if (isExpanded) {
                                      setExpandedScanId('');
                                      setShouldLoadRawResult(false);
                                      return;
                                    }

                                    setExpandedScanId(scan.scan_id);
                                    setShouldLoadRawResult(false);
                                  }}
                                >
                                  {isExpanded ? '상세 숨기기' : '상세 보기'}
                                </button>
                              </div>
                            </td>
                          </tr>
                          {isExpanded && (
                            <tr>
                              <td colSpan={6} className="bg-body-tertiary">
                                <div className="p-3">
                                  <div className="d-flex flex-wrap justify-content-between align-items-start gap-3 mb-3">
                                    <div>
                                      <h3 className="h6 mb-1">스캔 상세</h3>
                                      <p className="text-muted small mb-0">
                                        {scan.scan_id}의 실시간 상세 정보 및 상태
                                      </p>
                                    </div>
                                    <div className="d-flex gap-2">
                                      <StatusChip status={effectiveStatus || '알 수 없음'} />
                                      <button
                                        type="button"
                                        className="btn btn-sm dg-dashboard-action-btn dg-dashboard-action-btn--secondary"
                                        onClick={() => setShouldLoadRawResult(true)}
                                        disabled={isRawResultLoading}
                                      >
                                        {isRawResultLoading ? '원본 결과 불러오는 중…' : '원본 결과 링크 가져오기'}
                                      </button>
                                    </div>
                                  </div>

                                  {(isScanDetailLoading || isScanStatusLoading) && (
                                    <div className="text-muted small mb-3">스캔 상세 정보 불러오는 중…</div>
                                  )}

                                  {(isScanDetailError || isScanStatusError) && (
                                    <div className="alert alert-danger py-2 mb-3" role="alert">
                                      {isScanDetailError
                                        ? toErrorMessage(scanDetailError, '스캔 상세 정보를 불러오지 못했습니다.')
                                        : toErrorMessage(scanStatusError, '스캔 상태를 불러오지 못했습니다.')}
                                    </div>
                                  )}

                                  <div className="row g-3 small">
                                    <div className="col-12 col-md-6">
                                      <div className="text-muted mb-1">스캔 ID</div>
                                      <code className="text-break">{detail?.scan_id ?? status?.scan_id ?? scan.scan_id}</code>
                                    </div>
                                    <div className="col-12 col-md-6">
                                      <div className="text-muted mb-1">스캐너 유형</div>
                                      <div>{detail?.scanner_type ?? status?.scanner_type ?? scan.scanner_type}</div>
                                    </div>
                                    <div className="col-12 col-md-6">
                                      <div className="text-muted mb-1">상태</div>
                                      <div><StatusChip status={effectiveStatus} /></div>
                                    </div>
                                    <div className="col-12 col-md-6">
                                      <div className="text-muted mb-1">클러스터 ID</div>
                                      <div className="text-break">{detail?.cluster_id ?? status?.cluster_id ?? activeClusterId}</div>
                                    </div>
                                    <div className="col-12 col-md-6">
                                      <div className="text-muted mb-1">요청 시각</div>
                                      <div>{formatDateTime(detail?.created_at ?? status?.created_at ?? scan.created_at)}</div>
                                    </div>
                                    <div className="col-12 col-md-6">
                                      <div className="text-muted mb-1">시작 시각</div>
                                      <div className="text-muted">현재 API에서 제공되지 않음</div>
                                    </div>
                                    <div className="col-12 col-md-6">
                                      <div className="text-muted mb-1">완료 시각</div>
                                      <div>{formatDateTime(detail?.completed_at ?? status?.completed_at ?? scan.completed_at)}</div>
                                    </div>
                                    <div className="col-12 col-md-6">
                                      <div className="text-muted mb-1">오류 메시지</div>
                                      <div className="text-muted">현재 API에서 제공되지 않음</div>
                                    </div>
                                    <div className="col-12">
                                      <div className="text-muted mb-1">저장된 S3 키</div>
                                      {renderList(detail?.s3_keys)}
                                    </div>
                                    <div className="col-12">
                                      <div className="text-muted mb-1">업로드된 파일</div>
                                      {renderList(status?.s3_keys ?? [])}
                                    </div>
                                  </div>

                                  {shouldLoadRawResult && rawResult?.download_url && (
                                    <div className="alert alert-success d-flex flex-wrap justify-content-between align-items-center gap-2 mt-3 mb-0">
                                      <div>
                                        원본 결과 링크가 준비되었습니다
                                        {rawResult.expires_in
                                          ? ` (유효 기간: ${rawResult.expires_in}초)`
                                          : ''}
                                        .
                                      </div>
                                      <a
                                        href={rawResult.download_url}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="btn btn-sm dg-dashboard-action-btn dg-dashboard-action-btn--secondary"
                                      >
                                        원본 결과 열기
                                      </a>
                                    </div>
                                  )}

                                  {shouldLoadRawResult && isRawResultError && (
                                    <div className="alert alert-warning mt-3 mb-0" role="alert">
                                      {toErrorMessage(
                                        rawResultError,
                                        '이 스캔의 원본 결과 링크가 아직 준비되지 않았습니다.',
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
