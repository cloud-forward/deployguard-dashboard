import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  useListClustersApiV1ClustersGet,
} from '../api/generated/clusters/clusters';
import {
  useListClusterScansApiV1ClustersClusterIdScansGet,
} from '../api/generated/scans/scans';
import StatusChip from '../components/StatusChip';

type ClusterItem = {
  id: string;
  name: string;
  cluster_type?: string | null;
};

type ScanItem = {
  scan_id: string;
  scanner_type?: string | null;
  status: string;
  created_at?: string | null;
};

const formatDateTime = (value?: string | null) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
};

const clusterTypeBadge = (type?: string | null) => {
  if (type === 'eks') return 'dg-badge dg-badge--info';
  if (type === 'aws') return 'dg-badge dg-badge--notable';
  return 'dg-badge dg-badge--tag';
};

const WorkloadSecurityPage: React.FC = () => {
  const { data: clustersData, isLoading: isLoadingClusters } = useListClustersApiV1ClustersGet();
  const clusters = (Array.isArray(clustersData) ? clustersData : []) as ClusterItem[];

  const firstClusterId = useMemo(() => clusters[0]?.id ?? '', [clusters]);

  const { data: scansData, isLoading: isLoadingScans } =
    useListClusterScansApiV1ClustersClusterIdScansGet(firstClusterId, {
      query: { enabled: Boolean(firstClusterId) },
    });

  const recentScans = useMemo<ScanItem[]>(() => {
    const items = (scansData as { items?: unknown[] } | undefined)?.items;
    if (!Array.isArray(items)) return [];
    return (items as ScanItem[]).slice(0, 3);
  }, [scansData]);

  return (
    <div className="dg-page-shell">
      <div className="dg-page-header">
        <div className="dg-page-heading">
          <h1 className="dg-page-title">Workload Security</h1>
          <p className="dg-page-description">
            클러스터 자산과 워크로드를 탐색하고, 스캔을 통해 보안 상태를 확인합니다.
          </p>
        </div>
      </div>

      <div className="row g-4">
        {/* Clusters card */}
        <div className="col-12 col-md-6">
          <div className="card border-0 shadow-sm h-100">
            <div className="card-body d-flex flex-column gap-3 p-4">
              <div className="d-flex align-items-center gap-3">
                <span
                  className="dg-sidebar-badge"
                  style={{
                    minWidth: '2.4rem',
                    width: '2.4rem',
                    height: '2.4rem',
                    fontSize: '0.72rem',
                  }}
                  aria-hidden="true"
                >
                  CL
                </span>
                <div>
                  <h2 className="h5 mb-0">Clusters</h2>
                  <p className="text-muted small mb-0">
                    클러스터별 자산 구조와 관계를 확인합니다.
                  </p>
                </div>
              </div>

              <div className="flex-grow-1">
                {isLoadingClusters ? (
                  <div className="text-muted small">클러스터 불러오는 중…</div>
                ) : clusters.length === 0 ? (
                  <div className="text-muted small">등록된 클러스터가 없습니다.</div>
                ) : (
                  <>
                    <div className="text-muted small mb-2">
                      <span className="fw-semibold text-body">{clusters.length}</span>개 클러스터 등록됨
                    </div>
                    <div className="d-flex flex-column gap-2">
                      {clusters.slice(0, 4).map((cluster) => (
                        <div
                          key={cluster.id}
                          className="d-flex justify-content-between align-items-center px-3 py-2 rounded-3"
                          style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-subtle)' }}
                        >
                          <div className="min-w-0">
                            <div className="fw-semibold small text-truncate">{cluster.name}</div>
                            <div className="text-muted" style={{ fontSize: '0.72rem' }}>{cluster.id}</div>
                          </div>
                          {cluster.cluster_type && (
                            <span className={`${clusterTypeBadge(cluster.cluster_type)} ms-2 flex-shrink-0`}>
                              {cluster.cluster_type}
                            </span>
                          )}
                        </div>
                      ))}
                      {clusters.length > 4 && (
                        <div className="text-muted small text-center">
                          +{clusters.length - 4}개 더 있음
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>

              <Link to="/clusters" className="btn btn-sm dg-dashboard-action-btn dg-dashboard-action-btn--primary mt-auto">
                Clusters 보기
              </Link>
            </div>
          </div>
        </div>

        {/* Scans card */}
        <div className="col-12 col-md-6">
          <div className="card border-0 shadow-sm h-100">
            <div className="card-body d-flex flex-column gap-3 p-4">
              <div className="d-flex align-items-center gap-3">
                <span
                  className="dg-sidebar-badge"
                  style={{
                    minWidth: '2.4rem',
                    width: '2.4rem',
                    height: '2.4rem',
                    fontSize: '0.72rem',
                  }}
                  aria-hidden="true"
                >
                  SC
                </span>
                <div>
                  <h2 className="h5 mb-0">Scans</h2>
                  <p className="text-muted small mb-0">
                    스캔 실행 및 결과를 통해 취약점을 분석합니다.
                  </p>
                </div>
              </div>

              <div className="flex-grow-1">
                {!firstClusterId ? (
                  <div className="text-muted small">스캔 미리보기를 표시하려면 클러스터를 먼저 등록하세요.</div>
                ) : isLoadingScans ? (
                  <div className="text-muted small">최근 스캔 불러오는 중…</div>
                ) : recentScans.length === 0 ? (
                  <div className="text-muted small">최근 스캔 기록이 없습니다.</div>
                ) : (
                  <>
                    <div className="text-muted small mb-2">
                      최근 스캔 ({clusters[0]?.name ?? firstClusterId})
                    </div>
                    <div className="d-flex flex-column gap-2">
                      {recentScans.map((scan) => (
                        <div
                          key={scan.scan_id}
                          className="d-flex justify-content-between align-items-center px-3 py-2 rounded-3"
                          style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-subtle)' }}
                        >
                          <div className="min-w-0">
                            <div className="text-muted" style={{ fontSize: '0.72rem' }}>
                              {scan.scanner_type ?? '-'} · {formatDateTime(scan.created_at)}
                            </div>
                            <div className="fw-semibold small text-truncate" style={{ maxWidth: '200px' }}>
                              {scan.scan_id}
                            </div>
                          </div>
                          <StatusChip status={scan.status} />
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>

              <Link to="/scans" className="btn btn-sm dg-dashboard-action-btn dg-dashboard-action-btn--primary mt-auto">
                Scans 보기
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WorkloadSecurityPage;
