import React, { useEffect, useMemo, useState } from 'react';
import { FileText } from 'lucide-react';
import { useListClustersApiV1ClustersGet } from '../api/generated/clusters/clusters';
import {
  useGetInventoryRiskSpotlightApiV1ClustersClusterIdInventoryRiskSpotlightGet,
  useGetInventoryScannerStatusApiV1ClustersClusterIdInventoryScannerStatusGet,
  useGetInventorySummaryApiV1ClustersClusterIdInventorySummaryGet,
} from '../api/generated/inventory/inventory';
import type {
  ClusterResponse,
  InvRiskSpotlightResponse,
  InvScannerItem,
  InvScannerStatusResponse,
  InvSummaryResponse,
} from '../api/model';
import StatCard from '../components/dashboard/StatCard';

/* ─── helpers ────────────────────────────────────────────────────────────── */

const sumResourceCounts = (resources?: Record<string, number>) =>
  Object.values(resources ?? {}).reduce((total, count) => total + count, 0);

const formatDateTime = (value?: string | null) => {
  if (!value) return '-';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
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
    case 'k8s': return 'K8s';
    case 'aws': return 'AWS';
    case 'image': return '이미지';
    default: return value;
  }
};

const isInventorySummaryResponse = (v: unknown): v is InvSummaryResponse =>
  Boolean(v && typeof v === 'object' && 'total_node_count' in v);

const isInventoryRiskSpotlightResponse = (v: unknown): v is InvRiskSpotlightResponse =>
  Boolean(v && typeof v === 'object' && 'entry_points' in v && 'crown_jewels' in v);

const isInventoryScannerStatusResponse = (v: unknown): v is InvScannerStatusResponse =>
  Boolean(v && typeof v === 'object' && 'scanners' in v);

const renderResourceBadges = (resources?: Record<string, number>) => {
  const entries = Object.entries(resources ?? {}).sort((a, b) => b[1] - a[1]);
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

/* ─── stat row data ──────────────────────────────────────────────────────── */

interface StatRow {
  title: string;
  value: number;
}

/* ─── page ──────────────────────────────────────────────────────────────── */

const DashboardPage: React.FC = () => {
  const [period, setPeriod] = useState('최근 7일');
  const [selectedClusterId, setSelectedClusterId] = useState('');

  /* clusters */
  const {
    data: clustersResponse,
    isLoading: isClustersLoading,
  } = useListClustersApiV1ClustersGet();

  const clusters = useMemo<ClusterResponse[]>(
    () => (Array.isArray(clustersResponse) ? clustersResponse : []),
    [clustersResponse],
  );

  useEffect(() => {
    if (!selectedClusterId && clusters.length > 0) {
      setSelectedClusterId(clusters[0].id);
    }
  }, [clusters, selectedClusterId]);

  const activeClusterId =
    (selectedClusterId && clusters.some((c) => c.id === selectedClusterId)
      ? selectedClusterId
      : clusters[0]?.id) ?? '';

  const selectedCluster = clusters.find((c) => c.id === activeClusterId) ?? null;

  /* inventory */
  const { data: summaryResponse, isLoading: isSummaryLoading } =
    useGetInventorySummaryApiV1ClustersClusterIdInventorySummaryGet(activeClusterId, {
      query: { enabled: Boolean(activeClusterId) },
    });

  const { data: spotlightResponse, isLoading: isSpotlightLoading } =
    useGetInventoryRiskSpotlightApiV1ClustersClusterIdInventoryRiskSpotlightGet(
      activeClusterId,
      { query: { enabled: Boolean(activeClusterId) } },
    );

  const { data: scannerStatusResponse, isLoading: isScannerStatusLoading } =
    useGetInventoryScannerStatusApiV1ClustersClusterIdInventoryScannerStatusGet(
      activeClusterId,
      { query: { enabled: Boolean(activeClusterId) } },
    );

  /* derived */
  const summary = isInventorySummaryResponse(summaryResponse) ? summaryResponse : null;
  const spotlight = isInventoryRiskSpotlightResponse(spotlightResponse) ? spotlightResponse : null;
  const scannerStatus = isInventoryScannerStatusResponse(scannerStatusResponse)
    ? scannerStatusResponse
    : null;
  const scanners = Array.isArray(scannerStatus?.scanners) ? scannerStatus.scanners : [];

  const statRows: StatRow[] = [
    { title: '전체 자산', value: summary?.total_node_count ?? 0 },
    { title: 'K8s 자산', value: sumResourceCounts(summary?.k8s_resources) },
    { title: 'AWS 자산', value: sumResourceCounts(summary?.aws_resources) },
    {
      title: '진입점',
      value:
        summary?.risk_summary?.entry_point_count ??
        spotlight?.entry_points?.length ??
        0,
    },
    {
      title: '핵심 자산',
      value:
        summary?.risk_summary?.crown_jewel_count ??
        spotlight?.crown_jewels?.length ??
        0,
    },
    { title: '치명적 경로', value: summary?.risk_summary?.critical_path_count ?? 0 },
  ];

  return (
    <div>
      {/* ── Header bar ─────────────────────────────────────────────────── */}
      <div className="d-flex align-items-center justify-content-between mb-4">
        {/* Left */}
        <div className="d-flex align-items-baseline gap-3">
          <h4 className="mb-0 fw-bold">대시보드 개요</h4>
          <span className="fs-6" style={{ color: '#f2f2f2' }}>클러스터 보안 현황 요약</span>
          <select
            className="form-select form-select-sm w-auto"
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            aria-label="기간 선택"
          >
            <option>최근 7일</option>
            <option>최근 30일</option>
            <option>최근 90일</option>
          </select>
        </div>

        {/* Right */}
        <div className="d-flex align-items-center gap-3">
          <span className="text-muted small">클러스터</span>
          <select
            className="form-select form-select-sm"
            style={{ minWidth: 320 }}
            value={activeClusterId}
            onChange={(e) => setSelectedClusterId(e.target.value)}
            disabled={isClustersLoading || clusters.length === 0}
            aria-label="클러스터 선택"
          >
            {clusters.length === 0 ? (
              <option value="">사용 가능한 클러스터 없음</option>
            ) : (
              clusters.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))
            )}
          </select>
          <button
            type="button"
            className="btn btn-primary d-flex align-items-center gap-2 text-nowrap"
            style={{ whiteSpace: 'nowrap' }}
            onClick={() => alert('보고서 생성 기능 준비 중입니다.')}
          >
            <FileText size={20} />
            보고서 생성
          </button>
        </div>
      </div>

      {/* ── Stat cards ─────────────────────────────────────────────────── */}
      {selectedCluster && (
        <div className="row g-3 mb-4">
          {statRows.map((card) => (
            <div key={card.title} className="col-6 col-sm-4 col-xl-2">
              <StatCard title={card.title} value={card.value} />
            </div>
          ))}
        </div>
      )}

      {/* ── Section A — 공격경로 ────────────────────────────────────────── */}
      <div className="card border-0 shadow-sm mb-4">
        <div className="card-body">
          <div className="mb-3">
            <h2 className="h5 mb-1">공격경로</h2>
            <p className="text-muted small mb-0">파드에서 S3로의 공격 경로</p>
          </div>
          <div
            className="d-flex justify-content-center align-items-center rounded border"
            style={{
              height: 280,
              background: 'rgba(10, 16, 33, 0.5)',
              borderStyle: 'dashed',
            }}
          >
            <span className="text-muted small">그래프 데이터를 불러오는 중…</span>
          </div>
        </div>
      </div>

      {/* ── Section B — 2-column grid ───────────────────────────────────── */}
      <div className="row g-4">
        {/* Left — 리소스 분류 */}
        <div className="col-12 col-xl-7">
          <div className="card border-0 shadow-sm h-100">
            <div className="card-body">
              <div className="d-flex justify-content-between align-items-start gap-3 mb-3">
                <div>
                  <h2 className="h5 mb-1">리소스 분류</h2>
                  <p className="text-muted small mb-0">
                    {selectedCluster
                      ? `${selectedCluster.name}의 인벤토리 집계`
                      : '클러스터를 선택하세요'}
                  </p>
                </div>
                {(isSummaryLoading || isSpotlightLoading) && (
                  <span className="badge text-bg-light border">불러오는 중…</span>
                )}
              </div>

              {selectedCluster ? (
                <>
                  <div className="mb-3">
                    <div className="small text-muted mb-2">Kubernetes</div>
                    {renderResourceBadges(summary?.k8s_resources)}
                  </div>
                  <div>
                    <div className="small text-muted mb-2">AWS</div>
                    {renderResourceBadges(summary?.aws_resources)}
                  </div>
                </>
              ) : (
                <p className="text-muted small mb-0">
                  클러스터를 선택하면 인벤토리가 표시됩니다.
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Right — 스캐너 상태 */}
        <div className="col-12 col-xl-5">
          <div className="card border-0 shadow-sm h-100">
            <div className="card-body">
              <div className="d-flex justify-content-between align-items-start gap-3 mb-3">
                <div>
                  <h2 className="h5 mb-1">스캐너 상태</h2>
                  <p className="text-muted small mb-0">
                    선택된 클러스터의 최신 스캐너 커버리지
                  </p>
                </div>
                {isScannerStatusLoading && (
                  <span className="badge text-bg-light border">불러오는 중…</span>
                )}
              </div>

              {!selectedCluster ? (
                <p className="text-muted small mb-0">
                  클러스터를 선택하면 스캐너 상태가 표시됩니다.
                </p>
              ) : scanners.length === 0 ? (
                <p className="text-muted small mb-0">사용 가능한 스캐너 상태 없음.</p>
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
                        <div className="d-flex gap-2 flex-shrink-0">
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
    </div>
  );
};

export default DashboardPage;
