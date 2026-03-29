import React, { useEffect, useMemo, useState } from 'react';
import type { ElementDefinition } from 'cytoscape';
import { useGetMyAssetsApiV1MeAssetsGet, useGetMyOverviewApiV1MeOverviewGet } from '../api/generated/auth/auth';
import {
  useGetAttackPathDetailApiV1ClustersClusterIdAttackPathsPathIdGet,
  useGetAttackPathsApiV1ClustersClusterIdAttackPathsGet,
  useListClustersApiV1ClustersGet,
} from '../api/generated/clusters/clusters';
import GraphView from '../components/graph/GraphView';
import { attackGraphStylesheet } from '../components/graph/attackGraph';
import type {
  AttackPathDetailEnvelopeResponse,
  AttackPathDetailResponse,
  AttackPathListItemResponse,
  ClusterResponse,
  MeAssetInventoryItemResponse,
  MeAssetInventoryListResponse,
  UserOverviewResponse,
} from '../api/model';
import StatCard from '../components/dashboard/StatCard';

const getDomainBadgeClass = (domain?: string | null) => {
  if (domain === 'k8s') {
    return 'bg-primary-subtle text-primary border border-primary-subtle';
  }

  if (domain === 'aws') {
    return 'bg-warning-subtle text-warning-emphasis border border-warning-subtle';
  }

  return 'bg-secondary-subtle text-secondary border border-secondary-subtle';
};

const isUserOverviewResponse = (value: unknown): value is UserOverviewResponse =>
  Boolean(value && typeof value === 'object');

const isMeAssetInventoryListResponse = (value: unknown): value is MeAssetInventoryListResponse =>
  Boolean(value && typeof value === 'object' && 'items' in value);

const isAttackPathDetailEnvelope = (value: unknown): value is AttackPathDetailEnvelopeResponse =>
  Boolean(value && typeof value === 'object' && 'cluster_id' in value);

const buildCountMap = (
  assets: MeAssetInventoryItemResponse[],
  getKey: (asset: MeAssetInventoryItemResponse) => string | null | undefined,
) => {
  const counts = new Map<string, number>();

  for (const asset of assets) {
    const key = getKey(asset);
    if (!key) {
      continue;
    }

    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  return Array.from(counts.entries())
    .sort((left, right) => right[1] - left[1])
    .map(([label, count]) => ({ label, count }));
};

const getAttackPathLength = (path: Pick<AttackPathListItemResponse, 'hop_count' | 'node_ids'>) =>
  typeof path.hop_count === 'number' ? path.hop_count : Math.max(0, (path.node_ids?.length ?? 0) - 1);

const toCompactNodeLabel = (value: string): string => {
  const normalized = value.trim();
  if (normalized.length <= 10) {
    return normalized;
  }

  return `${normalized.slice(0, 10)}...`;
};

const toCompactWidgetLabel = (value: string, maxLength = 15): string => {
  const normalized = value.trim();
  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, maxLength)}...`;
};

const inferNodeType = (nodeId: string) => {
  const normalized = nodeId.toLowerCase();
  if (normalized.includes('serviceaccount') || normalized.startsWith('sa-')) return 'ServiceAccount';
  if (normalized.includes('iam')) return 'IAMRole';
  if (normalized.includes('s3')) return 'S3Bucket';
  return 'Pod';
};

const DASHBOARD_PATH_X_STEP = 150;
const DASHBOARD_PATH_Y_PATTERN = [0, 60, -30, 55, -20];

const getDashboardPathPosition = (index: number) => ({
  x: index * DASHBOARD_PATH_X_STEP,
  y: DASHBOARD_PATH_Y_PATTERN[index % DASHBOARD_PATH_Y_PATTERN.length] ?? 0,
});

const buildDashboardAttackPathElements = (path: AttackPathDetailResponse): ElementDefinition[] => {
  const orderedEdges = Array.isArray(path.edges)
    ? [...path.edges].sort((left, right) => left.edge_index - right.edge_index)
    : [];

  const steps =
    orderedEdges.length > 0
      ? orderedEdges
          .map((edge, index) => ({
            index,
            edge,
            sourceNodeId: path.node_ids?.[index] ?? edge.source_node_id,
            targetNodeId: path.node_ids?.[index + 1] ?? edge.target_node_id,
          }))
          .filter((step) => step.sourceNodeId && step.targetNodeId)
      : (path.node_ids ?? [])
          .slice(0, -1)
          .map((nodeId, index) => ({
            index,
            edge: null,
            sourceNodeId: nodeId,
            targetNodeId: path.node_ids?.[index + 1] ?? '',
          }))
          .filter((step) => step.sourceNodeId && step.targetNodeId);

  const connectedNodeIds = new Set<string>();
  for (const step of steps) {
    connectedNodeIds.add(step.sourceNodeId);
    connectedNodeIds.add(step.targetNodeId);
  }

  const orderedNodeIds = (path.node_ids ?? []).filter((nodeId) => connectedNodeIds.has(nodeId));
  const fallbackNodeIds = Array.from(connectedNodeIds).filter((nodeId) => !orderedNodeIds.includes(nodeId));

  const nodeSequence = [...orderedNodeIds, ...fallbackNodeIds];

  const nodeElements: ElementDefinition[] = nodeSequence.map((nodeId, index) => ({
    data: {
      id: nodeId,
      label: toCompactNodeLabel(nodeId),
      fullLabel: nodeId,
      type: inferNodeType(nodeId),
      severity: path.risk_level ?? 'unknown',
      isEntryPoint: nodeId === path.entry_node_id,
      isCrownJewel: nodeId === path.target_node_id,
      hasRuntimeEvidence: false,
      pathIndex: index,
      details: {
        'Full Node ID': nodeId,
      },
      blastRadius: {
        pods: 0,
        secrets: 0,
        databases: 0,
        adminPrivilege: false,
      },
    },
    position: getDashboardPathPosition(index),
  }));

  const edgeElements: ElementDefinition[] = steps.map((step) => ({
    data: {
      id: step.edge?.edge_id ?? `dashboard-path-edge-${step.index}`,
      source: step.sourceNodeId,
      target: step.targetNodeId,
      relation: step.edge?.edge_type ?? 'path_step',
      label: step.edge?.edge_type ?? `step ${step.index + 1}`,
    },
  }));

  return [...nodeElements, ...edgeElements];
};

const dashboardAttackPathStylesheet = [
  ...attackGraphStylesheet,
  {
    selector: 'node',
    style: {
      width: 24,
      height: 24,
      'font-size': 8,
      'text-wrap': 'wrap',
      'text-max-width': 64,
      'text-margin-y': 10,
    },
  },
  {
    selector: 'edge',
    style: {
      'font-size': 8,
      'text-background-color': 'transparent',
      'text-background-opacity': 0,
      'text-background-padding': '0px',
      'text-margin-y': -8,
      'text-rotation': 'autorotate',
      'control-point-step-size': 34,
    },
  },
];

const DashboardAttackPathSection: React.FC<{
  clusterCounts: Array<{ label: string; count: number }>;
}> = ({ clusterCounts }) => {
  const [selectedClusterId, setSelectedClusterId] = useState('');
  const [selectedPathId, setSelectedPathId] = useState('');
  const clustersQuery = useListClustersApiV1ClustersGet({
    query: {
      retry: false,
    },
  });

  const clusters = Array.isArray(clustersQuery.data) ? (clustersQuery.data as ClusterResponse[]) : [];
  const sortedClusters = useMemo(() => {
    const clusterCountMap = new Map(clusterCounts.map((item) => [item.label, item.count]));

    return [...clusters].sort((left, right) => {
      const countDelta = (clusterCountMap.get(right.name) ?? -1) - (clusterCountMap.get(left.name) ?? -1);
      if (countDelta !== 0) {
        return countDelta;
      }

      return left.name.localeCompare(right.name);
    });
  }, [clusterCounts, clusters]);

  useEffect(() => {
    if (sortedClusters.length === 0) {
      setSelectedClusterId('');
      return;
    }

    if (selectedClusterId && sortedClusters.some((cluster) => cluster.id === selectedClusterId)) {
      return;
    }

    const firstEksCluster = sortedClusters.find((cluster) => cluster.cluster_type === 'eks');
    setSelectedClusterId(firstEksCluster?.id ?? sortedClusters[0].id);
  }, [selectedClusterId, sortedClusters]);

  const attackPathsQuery = useGetAttackPathsApiV1ClustersClusterIdAttackPathsGet(selectedClusterId, {
    query: {
      enabled: Boolean(selectedClusterId),
      retry: false,
    },
  });

  const pathItems = Array.isArray((attackPathsQuery.data as { items?: AttackPathListItemResponse[] } | undefined)?.items)
    ? (((attackPathsQuery.data as { items?: AttackPathListItemResponse[] }).items ?? []) as AttackPathListItemResponse[])
    : [];

  const sortedPaths = useMemo(
    () =>
      [...pathItems].sort((left, right) => {
        const lengthDelta = getAttackPathLength(right) - getAttackPathLength(left);
        if (lengthDelta !== 0) {
          return lengthDelta;
        }

        return (right.risk_score ?? 0) - (left.risk_score ?? 0);
      }),
    [pathItems],
  );

  useEffect(() => {
    if (sortedPaths.length === 0) {
      setSelectedPathId('');
      return;
    }

    if (selectedPathId && sortedPaths.some((item) => item.path_id === selectedPathId)) {
      return;
    }

    setSelectedPathId(sortedPaths[0].path_id);
  }, [selectedPathId, sortedPaths]);

  const attackPathDetailQuery = useGetAttackPathDetailApiV1ClustersClusterIdAttackPathsPathIdGet(
    selectedClusterId,
    selectedPathId,
    {
      query: {
        enabled: Boolean(selectedClusterId && selectedPathId),
        retry: false,
      },
    },
  );

  const detailEnvelope = isAttackPathDetailEnvelope(attackPathDetailQuery.data) ? attackPathDetailQuery.data : null;
  const detailPath = detailEnvelope?.path ?? null;
  const graphElements = useMemo(() => (detailPath ? buildDashboardAttackPathElements(detailPath) : []), [detailPath]);
  const attackPathLayout = useMemo(
    () => ({
      name: 'preset',
      animate: false,
      fit: true,
      padding: 48,
    }),
    [],
  );

  const buildOptionLabel = (path: AttackPathListItemResponse) => {
    const length = getAttackPathLength(path);
    const summary =
      path.entry_node_id && path.target_node_id
        ? `${toCompactNodeLabel(path.entry_node_id)} -> ${toCompactNodeLabel(path.target_node_id)}`
        : path.title || path.path_id;

    return toCompactWidgetLabel(`${length} hops · ${summary}`);
  };

  return (
    <div className="card border-0 shadow-sm h-100 dg-dashboard-graph-card">
      <div className="card-body">
        <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-2">
          <div className="d-flex align-items-center gap-2">
            <h6 className="mb-0 fw-bold">공격경로</h6>
            <div className="d-flex align-items-center gap-1">
              <span
                aria-hidden="true"
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: '50%',
                  backgroundColor: '#22c55e',
                  display: 'inline-block',
                  boxShadow: '0 0 6px #22c55e',
                  animation: 'live-pulse 1.5s ease-in-out infinite',
                }}
              />
              <span className="small fw-semibold" style={{ color: '#22c55e' }}>Live</span>
            </div>
          </div>
          <div className="d-flex flex-column flex-sm-row gap-2" style={{ minWidth: 280 }}>
            <div style={{ minWidth: 160 }}>
              <select
                id="dashboard-cluster-select"
                className="form-select form-select-sm"
                value={selectedClusterId}
                onChange={(event) => setSelectedClusterId(event.target.value)}
                disabled={sortedClusters.length === 0 || clustersQuery.isLoading}
                aria-label="Cluster selection"
              >
                {sortedClusters.length === 0 ? <option value="">No clusters available</option> : null}
                {sortedClusters.map((cluster) => (
                  <option
                    key={cluster.id}
                    value={cluster.id}
                    title={`${cluster.name}${cluster.cluster_type === 'eks' ? ' (EKS)' : ''}`}
                  >
                    {toCompactWidgetLabel(`${cluster.name}${cluster.cluster_type === 'eks' ? ' (EKS)' : ''}`)}
                  </option>
                ))}
              </select>
            </div>
            <div style={{ minWidth: 220 }}>
              <select
                id="dashboard-attack-path-select"
                className="form-select form-select-sm"
                value={selectedPathId}
                onChange={(event) => setSelectedPathId(event.target.value)}
                disabled={sortedPaths.length === 0 || attackPathsQuery.isLoading}
                aria-label="Attack path selection"
              >
                {sortedPaths.length === 0 ? <option value="">No paths available</option> : null}
                {sortedPaths.map((path) => (
                  <option key={path.path_id} value={path.path_id} title={buildOptionLabel(path)}>
                    {buildOptionLabel(path)}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="dg-dashboard-graph-preview">
          {clustersQuery.isLoading || attackPathsQuery.isLoading ? (
            <span className="text-muted small">공격 경로 데이터를 불러오는 중…</span>
          ) : clustersQuery.isError || attackPathsQuery.isError ? (
            <div className="alert alert-danger mb-0 small" role="alert">
              공격 경로 데이터를 불러오지 못했습니다.
            </div>
          ) : !selectedClusterId ? (
            <span className="text-muted small">사용 가능한 클러스터가 없습니다.</span>
          ) : sortedPaths.length === 0 ? (
            <span className="text-muted small">표시할 공격 경로가 없습니다.</span>
          ) : attackPathDetailQuery.isLoading ? (
            <span className="text-muted small">선택한 경로를 불러오는 중…</span>
          ) : attackPathDetailQuery.isError ? (
            <div className="alert alert-danger mb-0 small" role="alert">
              선택한 공격 경로 상세를 불러오지 못했습니다.
            </div>
          ) : !detailPath || graphElements.length === 0 ? (
            <span className="text-muted small">선택한 공격 경로를 그래프로 표시할 수 없습니다.</span>
          ) : (
            <div style={{ width: '100%', height: '100%' }}>
              <GraphView
                elements={graphElements}
                layout={attackPathLayout}
                stylesheet={dashboardAttackPathStylesheet}
                viewportRefreshKey={`${selectedClusterId}:${selectedPathId}:${graphElements.length}`}
                selectedPathNodeIds={[]}
                selectedPathEdgeIds={[]}
                selectedNodeId={null}
                selectedEdgeId={null}
                showLabels
                onNodeClick={() => {}}
                onEdgeClick={() => {}}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const DashboardPage: React.FC = () => {
  const overviewQuery = useGetMyOverviewApiV1MeOverviewGet({
    query: {
      retry: false,
    },
  });

  const assetsQuery = useGetMyAssetsApiV1MeAssetsGet({
    query: {
      retry: false,
    },
  });

  const overview = isUserOverviewResponse(overviewQuery.data) ? overviewQuery.data : null;
  const assetList = isMeAssetInventoryListResponse(assetsQuery.data) ? assetsQuery.data : null;
  const assets = Array.isArray(assetList?.items) ? assetList.items : [];

  const statRows = [
    { title: '전체 자산', value: overview?.total_assets ?? 0 },
    { title: 'Public 자산', value: overview?.public_assets ?? 0 },
    { title: 'K8s 자산', value: overview?.k8s_assets ?? 0 },
    { title: 'AWS 자산', value: overview?.aws_assets ?? 0 },
    { title: '진입점', value: overview?.entry_point_assets ?? 0 },
    { title: '핵심 자산', value: overview?.crown_jewel_assets ?? 0 },
  ];

  const assetTypeCounts = useMemo(
    () => buildCountMap(assets, (asset) => asset.asset_type).slice(0, 8),
    [assets],
  );
  const domainCounts = useMemo(
    () => buildCountMap(assets, (asset) => asset.asset_domain ?? 'unknown'),
    [assets],
  );
  const clusterCounts = useMemo(
    () => buildCountMap(assets, (asset) => asset.cluster_name).slice(0, 6),
    [assets],
  );
  return (
    <div className="dg-page-shell dg-dashboard-page">
      <style>{`
        .dg-dashboard-page {
          gap: 0.8rem;
        }
        .dg-dashboard-top {
        }
        .dg-dashboard-stat-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 0.9rem;
        }
        .dg-dashboard-graph-card .card-body {
          display: flex;
          flex-direction: column;
          height: 100%;
          min-height: 0;
          padding-top: 0.85rem;
          padding-bottom: 0.85rem;
        }
        .dg-dashboard-graph-preview {
          display: flex;
          justify-content: center;
          align-items: center;
          flex: 1 1 auto;
          min-height: 208px;
          border-radius: 0.75rem;
          border: 1px dashed rgba(148, 163, 184, 0.28);
          background: #eef2f6;
          overflow: hidden;
          padding: 0.5rem;
        }
        .dg-dashboard-bottom-card .card-body {
          display: flex;
          flex-direction: column;
          min-height: 0;
          padding-top: 0.85rem;
          padding-bottom: 0.65rem;
        }
        .dg-dashboard-bottom-panel {
          height: 24.5rem;
        }
        .dg-dashboard-bottom-scroll {
          flex: 1 1 auto;
          min-height: 0;
          overflow-y: auto;
          overflow-x: hidden;
          padding-right: 0.25rem;
        }
        .dg-dashboard-panel-title {
          display: flex;
          align-items: baseline;
          gap: 0.5rem;
          flex-wrap: wrap;
          margin-bottom: 0;
        }
        .dg-dashboard-section {
          display: flex;
          flex-direction: column;
          gap: 0.45rem;
        }
        .dg-dashboard-section-label {
          font-size: 0.77rem;
          color: #94a3b8;
          margin: 0;
        }
        .dg-dashboard-chip-group {
          display: flex;
          flex-wrap: wrap;
          gap: 0.35rem;
          align-content: flex-start;
        }
        .dg-dashboard-chip-group.is-asset-type {
          max-height: 3.4rem;
          overflow: hidden;
        }
        .dg-dashboard-chip {
          display: inline-flex;
          align-items: center;
          max-width: 100%;
          padding: 0.35rem 0.65rem;
          font-size: 0.74rem;
          line-height: 1.05;
          white-space: nowrap;
        }
        @media (min-width: 1200px) {
          .dg-dashboard-top {
            align-items: stretch;
          }
          .dg-dashboard-graph-card {
            height: 100%;
          }
          .dg-dashboard-graph-preview {
            min-height: 0;
          }
        }
        @media (max-width: 575.98px) {
          .dg-dashboard-stat-grid {
            grid-template-columns: 1fr;
          }
          .dg-dashboard-graph-preview {
            min-height: 220px;
          }
          .dg-dashboard-bottom-panel {
            height: auto;
          }
          .dg-dashboard-chip-group.is-asset-type {
            max-height: none;
          }
        }
      `}</style>
      <div className="dg-page-header">
        <div className="dg-page-heading">
          <h1 className="dg-page-title">대시보드 오버뷰</h1>
          <p className="dg-page-description">한눈에 보는 클러스터 보안 현황과 분석 결과 요약</p>
        </div>
      </div>

      <div className="row g-3 dg-dashboard-top">
        <div className="col-12 col-xl-4">
          {overviewQuery.isLoading ? (
            <div className="dg-dashboard-stat-grid">
              {Array.from({ length: 6 }).map((_, index) => (
                <div key={index} className="card border-0 shadow-sm h-100">
                  <div className="card-body placeholder-glow py-3 px-3">
                    <span className="placeholder col-7 d-block mb-2" />
                    <span className="placeholder placeholder-lg col-5 d-block" />
                  </div>
                </div>
              ))}
            </div>
          ) : overviewQuery.isError ? (
            <div className="alert alert-danger mb-0" role="alert">
              사용자 개요를 불러오지 못했습니다.
            </div>
          ) : (
            <div className="dg-dashboard-stat-grid">
              {statRows.map((card) => (
                <StatCard key={card.title} title={card.title} value={card.value} compact />
              ))}
            </div>
          )}
        </div>

        <div className="col-12 col-xl-8">
          <DashboardAttackPathSection clusterCounts={clusterCounts} />
        </div>
      </div>

      <div className="row g-3">
        <div className="col-12 col-xl-6">
          <div className="card border-0 shadow-sm h-100 dg-dashboard-bottom-card dg-dashboard-bottom-panel">
            <div className="card-body">
              <div className="d-flex justify-content-between align-items-start gap-3 mb-2">
                <div>
                  <h2 className="h5 dg-dashboard-panel-title">자산 분포</h2>
                </div>
                {assetsQuery.isLoading ? (
                  <span className="badge text-bg-light border">불러오는 중…</span>
                ) : null}
              </div>

              <div className="dg-dashboard-bottom-scroll">
                {assetsQuery.isError ? (
                  <div className="alert alert-danger mb-0" role="alert">
                    자산 요약을 불러오지 못했습니다.
                  </div>
                ) : assets.length === 0 ? (
                  <p className="text-muted small mb-0">표시할 자산이 없습니다.</p>
                ) : (
                  <div className="d-flex flex-column gap-2">
                    <div className="dg-dashboard-section">
                      <div className="dg-dashboard-section-label">Asset Type</div>
                      <div className="dg-dashboard-chip-group is-asset-type">
                        {assetTypeCounts.map((item) => (
                          <span key={item.label} className="badge rounded-pill text-bg-light border dg-dashboard-chip">
                            {item.label}: {item.count}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="dg-dashboard-section">
                      <div className="dg-dashboard-section-label">Domain</div>
                      <div className="dg-dashboard-chip-group">
                        {domainCounts.map((item) => (
                          <span key={item.label} className={`badge rounded-pill dg-dashboard-chip ${getDomainBadgeClass(item.label)}`}>
                            {item.label}: {item.count}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="dg-dashboard-section">
                      <div className="dg-dashboard-section-label">상위 클러스터</div>
                      <div className="dg-dashboard-chip-group">
                        {clusterCounts.length === 0 ? (
                          <span className="text-muted small">클러스터 정보 없음</span>
                        ) : (
                          clusterCounts.map((item) => (
                            <span key={item.label} className="badge rounded-pill text-bg-light border dg-dashboard-chip">
                              {item.label}: {item.count}
                            </span>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="col-12 col-xl-6">
          <div className="card border-0 shadow-sm h-100 dg-dashboard-bottom-card dg-dashboard-bottom-panel" aria-hidden="true">
            <div className="card-body" />
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;
