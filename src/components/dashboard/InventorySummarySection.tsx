import React, { useEffect, useMemo, useState } from 'react';
import { useListClustersApiV1ClustersGet } from '../../api/generated/clusters/clusters';
import {
  useGetInventoryRiskSpotlightApiV1ClustersClusterIdInventoryRiskSpotlightGet,
  useGetInventoryScannerStatusApiV1ClustersClusterIdInventoryScannerStatusGet,
  useGetInventorySummaryApiV1ClustersClusterIdInventorySummaryGet,
} from '../../api/generated/inventory/inventory';
import type {
  ClusterResponse,
  InvRiskSpotlightResponse,
  InvScannerItem,
  InvScannerStatusResponse,
  InvSummaryResponse,
} from '../../api/model';
import StatCard from './StatCard';

const sumResourceCounts = (resources?: Record<string, number>) =>
  Object.values(resources ?? {}).reduce((total, count) => total + count, 0);

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

const getBadgeClass = (status?: string) => {
  switch (status) {
    case 'active':
    case 'covered':
      return 'bg-success';
    case 'partial':
      return 'bg-warning text-dark';
    case 'inactive':
    case 'not_covered':
      return 'bg-secondary';
    default:
      return 'bg-secondary';
  }
};

const formatScannerType = (value: string) => {
  switch (value) {
    case 'k8s':
      return 'K8s';
    case 'aws':
      return 'AWS';
    case 'image':
      return '이미지';
    default:
      return value;
  }
};

const isInventorySummaryResponse = (value: unknown): value is InvSummaryResponse =>
  Boolean(value && typeof value === 'object' && 'total_node_count' in value);

const isInventoryRiskSpotlightResponse = (value: unknown): value is InvRiskSpotlightResponse =>
  Boolean(value && typeof value === 'object' && 'entry_points' in value && 'crown_jewels' in value);

const isInventoryScannerStatusResponse = (value: unknown): value is InvScannerStatusResponse =>
  Boolean(value && typeof value === 'object' && 'scanners' in value);

const renderResourceBadges = (resources?: Record<string, number>) => {
  const entries = Object.entries(resources ?? {}).sort((left, right) => right[1] - left[1]);

  if (entries.length === 0) {
    return <span className="text-muted small">데이터 없음</span>;
  }

  return (
    <div className="d-flex flex-wrap gap-2">
      {entries.map(([name, count]) => (
        <span key={name} className="badge rounded-pill text-bg-light border">
          {name}: {count}
        </span>
      ))}
    </div>
  );
};

const InventorySummarySection: React.FC = () => {
  const {
    data: clustersResponse,
    isLoading: isClustersLoading,
    isError: isClustersError,
    error: clustersError,
  } = useListClustersApiV1ClustersGet();

  const clusters = useMemo<ClusterResponse[]>(
    () => (Array.isArray(clustersResponse) ? clustersResponse : []),
    [clustersResponse],
  );
  const [selectedClusterId, setSelectedClusterId] = useState('');

  useEffect(() => {
    if (!selectedClusterId && clusters.length > 0) {
      setSelectedClusterId(clusters[0].id);
    }
  }, [clusters, selectedClusterId]);

  const activeClusterId =
    (selectedClusterId && clusters.some((cluster) => cluster.id === selectedClusterId)
      ? selectedClusterId
      : clusters[0]?.id) ?? '';
  const selectedCluster = clusters.find((cluster) => cluster.id === activeClusterId) ?? null;

  const { data: summaryResponse, isLoading: isSummaryLoading, isError: isSummaryError, error: summaryError } =
    useGetInventorySummaryApiV1ClustersClusterIdInventorySummaryGet(activeClusterId, {
      query: { enabled: Boolean(activeClusterId) },
    });
  const {
    data: spotlightResponse,
    isLoading: isSpotlightLoading,
    isError: isSpotlightError,
    error: spotlightError,
  } = useGetInventoryRiskSpotlightApiV1ClustersClusterIdInventoryRiskSpotlightGet(activeClusterId, {
    query: { enabled: Boolean(activeClusterId) },
  });
  const {
    data: scannerStatusResponse,
    isLoading: isScannerStatusLoading,
    isError: isScannerStatusError,
    error: scannerStatusError,
  } = useGetInventoryScannerStatusApiV1ClustersClusterIdInventoryScannerStatusGet(activeClusterId, {
    query: { enabled: Boolean(activeClusterId) },
  });

  const summary = isInventorySummaryResponse(summaryResponse) ? summaryResponse : null;
  const spotlight = isInventoryRiskSpotlightResponse(spotlightResponse) ? spotlightResponse : null;
  const scannerStatus = isInventoryScannerStatusResponse(scannerStatusResponse)
    ? scannerStatusResponse
    : null;
  const scanners = Array.isArray(scannerStatus?.scanners) ? scannerStatus.scanners : [];

  const totalAssets = summary?.total_node_count ?? 0;
  const k8sAssets = sumResourceCounts(summary?.k8s_resources);
  const awsAssets = sumResourceCounts(summary?.aws_resources);
  const entryPoints = summary?.risk_summary?.entry_point_count ?? spotlight?.entry_points?.length ?? 0;
  const crownJewels =
    summary?.risk_summary?.crown_jewel_count ?? spotlight?.crown_jewels?.length ?? 0;
  const criticalPaths = summary?.risk_summary?.critical_path_count ?? 0;

  const toMessage = (error: unknown, fallback: string) =>
    error && typeof error === 'object' && 'message' in error && typeof error.message === 'string'
      ? error.message
      : fallback;

  return (
    <div>
      <div className="d-flex flex-wrap justify-content-between align-items-end gap-3 mb-4">
        <div>
          <h1 className="h2 mb-1">개요</h1>
          <p className="dg-subtitle-text mb-0">
            선택된 클러스터의 실제 인벤토리 요약.
          </p>
        </div>
        <div style={{ minWidth: 320 }}>
          <label htmlFor="dashboard-cluster-select" className="form-label mb-1">
            클러스터
          </label>
          <select
            id="dashboard-cluster-select"
            className="form-select"
            value={activeClusterId}
            onChange={(event) => setSelectedClusterId(event.target.value)}
            disabled={isClustersLoading || clusters.length === 0}
          >
            {clusters.length === 0 ? (
              <option value="">사용 가능한 클러스터 없음</option>
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
          클러스터 불러오는 중…
        </div>
      )}

      {isClustersError && (
        <div className="alert alert-danger" role="alert">
          {toMessage(clustersError, '클러스터를 불러오지 못했습니다.')}
        </div>
      )}

      {!isClustersLoading && !isClustersError && clusters.length === 0 && (
        <div className="alert alert-info" role="alert">
          클러스터 없음. 실제 인벤토리 요약을 보려면 먼저 클러스터를 생성하세요.
        </div>
      )}

      {selectedCluster && (
        <>
          <div className="row g-4 mb-4">
            <div className="col-12 col-sm-6 col-xl-2">
              <StatCard title="전체 자산" value={totalAssets} />
            </div>
            <div className="col-12 col-sm-6 col-xl-2">
              <StatCard title="K8s 자산" value={k8sAssets} />
            </div>
            <div className="col-12 col-sm-6 col-xl-2">
              <StatCard title="AWS 자산" value={awsAssets} />
            </div>
            <div className="col-12 col-sm-6 col-xl-2">
              <StatCard title="진입점" value={entryPoints} />
            </div>
            <div className="col-12 col-sm-6 col-xl-2">
              <StatCard title="핵심 자산" value={crownJewels} />
            </div>
            <div className="col-12 col-sm-6 col-xl-2">
              <StatCard title="치명적 경로" value={criticalPaths} />
            </div>
          </div>

          {(isSummaryError || isSpotlightError || isScannerStatusError) && (
            <div className="d-grid gap-2 mb-4">
              {isSummaryError && (
                <div className="alert alert-danger mb-0" role="alert">
                  {toMessage(summaryError, '인벤토리 요약을 불러오지 못했습니다.')}
                </div>
              )}
              {isSpotlightError && (
                <div className="alert alert-danger mb-0" role="alert">
                  {toMessage(spotlightError, '리스크 스포트라이트를 불러오지 못했습니다.')}
                </div>
              )}
              {isScannerStatusError && (
                <div className="alert alert-danger mb-0" role="alert">
                  {toMessage(scannerStatusError, '스캐너 상태를 불러오지 못했습니다.')}
                </div>
              )}
            </div>
          )}

          <div className="row g-4">
            <div className="col-12 col-xl-7">
              <div className="card shadow-sm h-100">
                <div className="card-body">
                  <div className="d-flex justify-content-between align-items-start gap-3 mb-3">
                    <div>
                      <h2 className="h5 mb-1">리소스 분류</h2>
                      <p className="text-muted small mb-0">
                        {selectedCluster.name}의 인벤토리 집계.
                      </p>
                    </div>
                    {(isSummaryLoading || isSpotlightLoading) && (
                      <span className="badge text-bg-light border">불러오는 중…</span>
                    )}
                  </div>
                  <div className="mb-3">
                    <div className="small text-muted mb-2">Kubernetes</div>
                    {renderResourceBadges(summary?.k8s_resources)}
                  </div>
                  <div>
                    <div className="small text-muted mb-2">AWS</div>
                    {renderResourceBadges(summary?.aws_resources)}
                  </div>
                </div>
              </div>
            </div>

            <div className="col-12 col-xl-5">
              <div className="card shadow-sm h-100">
                <div className="card-body">
                  <div className="d-flex justify-content-between align-items-start gap-3 mb-3">
                    <div>
                      <h2 className="h5 mb-1">스캐너 상태</h2>
                      <p className="text-muted small mb-0">
                        선택된 클러스터의 최신 스캐너 커버리지.
                      </p>
                    </div>
                    {isScannerStatusLoading && (
                      <span className="badge text-bg-light border">불러오는 중…</span>
                    )}
                  </div>
                  {scanners.length === 0 ? (
                    <div className="text-muted small">사용 가능한 스캐너 상태 없음.</div>
                  ) : (
                    <div className="d-flex flex-column gap-2">
                      {scanners.map((scanner: InvScannerItem) => (
                        <div
                          key={`${scanner.scanner_type}-${scanner.scan_id ?? 'none'}`}
                          className="border rounded p-3"
                        >
                          <div className="d-flex justify-content-between align-items-start gap-3">
                            <div>
                              <div className="fw-semibold">{scanner.display_name}</div>
                              <div className="small text-muted">
                                {formatScannerType(scanner.scanner_type)} · 마지막 스캔{' '}
                                {formatDateTime(scanner.last_scan_at)}
                              </div>
                            </div>
                            <div className="d-flex gap-2">
                              <span className={`badge ${getBadgeClass(scanner.status)}`}>
                                {scanner.status}
                              </span>
                              <span className={`badge ${getBadgeClass(scanner.coverage_status)}`}>
                                {scanner.coverage_status}
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default InventorySummarySection;
