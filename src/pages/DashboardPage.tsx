import React, { Suspense, useEffect, useMemo, useState } from 'react';
import type { ElementDefinition } from 'cytoscape';
import { useNavigate } from 'react-router-dom';
import { useGetMyAssetsApiV1MeAssetsGet, useGetMyOverviewApiV1MeOverviewGet } from '../api/generated/auth/auth';
import {
  useGetAnalysisResultApiV1AnalysisJobIdResultGet,
  useListAnalysisJobsApiV1ClustersClusterIdAnalysisJobsGet,
} from '../api/generated/analysis/analysis';
import {
  useGetAttackPathDetailApiV1ClustersClusterIdAttackPathsPathIdGet,
  useGetAttackPathsApiV1ClustersClusterIdAttackPathsGet,
  useListClustersApiV1ClustersGet,
} from '../api/generated/clusters/clusters';
import PageLoader from '../components/layout/PageLoader';
import type {
  AttackPathDetailEnvelopeResponse,
  AttackPathDetailResponse,
  AttackPathListItemResponse,
  AnalysisJobSummaryResponse,
  AnalysisResultResponse,
  ClusterResponse,
  MeAssetInventoryItemResponse,
  MeAssetInventoryListResponse,
  RemediationRecommendationListItemResponse,
  UserOverviewResponse,
} from '../api/model';
import RecommendationOverviewCard from '../components/dashboard/RecommendationOverviewCard';
import StatCard from '../components/dashboard/StatCard';

const GraphView = React.lazy(() => import('../components/graph/GraphView'));

const getDomainBadgeClass = (domain?: string | null) => {
  if (domain === 'k8s') {
    return 'dg-badge dg-badge--info';
  }

  if (domain === 'aws') {
    return 'dg-badge dg-badge--notable';
  }

  return 'dg-badge dg-badge--tag';
};

const getAssetTypeBadgeClass = (assetType?: string | null) => {
  const normalized = (assetType ?? '').toLowerCase();

  if (
    normalized.includes('pod') ||
    normalized.includes('service_account') ||
    normalized.includes('serviceaccount') ||
    normalized.includes('cluster_role') ||
    normalized.includes('clusterrole') ||
    normalized.includes('secret') ||
    normalized === 'service'
  ) {
    return 'dg-badge dg-badge--info';
  }

  if (normalized.includes('iam') || normalized.includes('security_group') || normalized.includes('securitygroup')) {
    return 'dg-badge dg-badge--notable';
  }

  return 'dg-badge dg-badge--low';
};

const getClusterChipClass = () => 'dg-badge dg-badge--cluster';

const isUserOverviewResponse = (value: unknown): value is UserOverviewResponse =>
  Boolean(value && typeof value === 'object');

const isMeAssetInventoryListResponse = (value: unknown): value is MeAssetInventoryListResponse =>
  Boolean(value && typeof value === 'object' && 'items' in value);

const isAttackPathDetailEnvelope = (value: unknown): value is AttackPathDetailEnvelopeResponse =>
  Boolean(value && typeof value === 'object' && 'cluster_id' in value);

const isAnalysisJobSummary = (value: unknown): value is AnalysisJobSummaryResponse =>
  Boolean(value && typeof value === 'object' && 'job_id' in value && 'status' in value);

const isAnalysisResultResponse = (value: unknown): value is AnalysisResultResponse =>
  Boolean(value && typeof value === 'object' && 'job' in value && 'links' in value);

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

const getGraphNodeTypeFromId = (nodeId: string) => {
  const normalized = nodeId.toLowerCase();
  if (normalized.startsWith('pod:')) return 'Pod';
  if (normalized.startsWith('sa:')) return 'ServiceAccount';
  if (normalized.startsWith('iam:')) return 'IAMRole';
  if (normalized.startsWith('s3:')) return 'S3';
  if (normalized.startsWith('rds:')) return 'RDS';
  if (normalized.startsWith('service:')) return 'Service';
  if (normalized.startsWith('ingress:')) return 'Ingress';
  if (normalized.startsWith('cluster_role:')) return 'ClusterRole';
  return 'Pod';
};

const DASHBOARD_PATH_X_STEP = 150;
const DASHBOARD_PATH_Y_PATTERN = [0, 60, -30, 55, -20];
const DASHBOARD_PREVIEW_INITIAL_FIT_PADDING = 24;

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
      type: getGraphNodeTypeFromId(nodeId),
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

const DashboardAttackPathSection: React.FC<{
  clusterCounts: Array<{ label: string; count: number }>;
  onClusterChange?: (clusterId: string) => void;
}> = ({ clusterCounts, onClusterChange }) => {
  const navigate = useNavigate();
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

  useEffect(() => {
    onClusterChange?.(selectedClusterId);
  }, [onClusterChange, selectedClusterId]);

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

  const canOpenDetail = Boolean(selectedClusterId && selectedPathId);
  const openSelectedPathDetail = () => {
    if (!selectedClusterId || !selectedPathId) {
      return;
    }

    navigate(`/clusters/${selectedClusterId}/attack-paths/${selectedPathId}`);
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
          <div className="d-flex flex-wrap align-items-center justify-content-end gap-2" style={{ minWidth: 280 }}>
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
            <button
              type="button"
              className="btn btn-sm dg-dashboard-action-btn dg-dashboard-action-btn--secondary"
              onClick={openSelectedPathDetail}
              disabled={!canOpenDetail}
            >
              상세보기
            </button>
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
              <Suspense fallback={<PageLoader label="그래프 뷰를 준비하는 중..." minHeight="100%" compact />}>
                <GraphView
                  elements={graphElements}
                  layout={attackPathLayout}
                  viewportRefreshKey={`${selectedClusterId}:${selectedPathId}:${graphElements.length}`}
                  initialFitPadding={DASHBOARD_PREVIEW_INITIAL_FIT_PADDING}
                  selectedPathNodeIds={[]}
                  selectedPathEdgeIds={[]}
                  selectedNodeId={null}
                  selectedEdgeId={null}
                  showLabels
                  onNodeClick={() => {}}
                  onEdgeClick={() => {}}
                />
              </Suspense>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
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
  const assets = Array.isArray(assetList?.items) ? (assetList?.items ?? []) : [];
  const [dashboardClusterId, setDashboardClusterId] = useState('');

  const statAccentMap: Record<string, string> = {
    '전체 자산': '#22d3ee',
    'Public 자산': '#f59e0b',
    'K8s 자산': '#3b82f6',
    'AWS 자산': '#f97316',
    '진입점': '#a855f7',
    '핵심 자산': '#ef4444',
  };

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

  const analysisJobsQuery = useListAnalysisJobsApiV1ClustersClusterIdAnalysisJobsGet(
    dashboardClusterId,
    undefined,
    {
      query: {
        enabled: Boolean(dashboardClusterId),
        retry: false,
      },
    },
  );

  const analysisJobItems = Array.isArray((analysisJobsQuery.data as { items?: unknown[] } | undefined)?.items)
    ? ((analysisJobsQuery.data as { items?: unknown[] }).items ?? []).filter(isAnalysisJobSummary)
    : [];

  const latestCompletedJob = useMemo(
    () =>
      [...analysisJobItems]
        .filter((item) => item.status === 'completed')
        .sort((left, right) => {
          const leftTime = new Date(left.completed_at ?? left.created_at).getTime();
          const rightTime = new Date(right.completed_at ?? right.created_at).getTime();
          return rightTime - leftTime;
        })[0] ?? null,
    [analysisJobItems],
  );

  const analysisResultQuery = useGetAnalysisResultApiV1AnalysisJobIdResultGet(latestCompletedJob?.job_id ?? '', {
    query: {
      enabled: Boolean(latestCompletedJob?.job_id),
      retry: false,
    },
  });

  const analysisResult = isAnalysisResultResponse(analysisResultQuery.data) ? analysisResultQuery.data : null;
  const remediationRecommendations: RemediationRecommendationListItemResponse[] = Array.isArray(
    analysisResult?.remediation_preview,
  )
    ? (analysisResult?.remediation_preview ?? [])
    : [];

  const openRemediationList = () => {
    navigate('/remediation');
  };

  const openRemediationDetail = (recommendationId: string) => {
    if (!dashboardClusterId || !recommendationId) {
      navigate('/remediation');
      return;
    }

    navigate(
      `/clusters/${dashboardClusterId}/recommendations/${encodeURIComponent(recommendationId)}`,
    );
  };

  return (
    <div className="dg-page-shell dg-dashboard-page">
      <style>{`
        .dg-dashboard-page {
          gap: 0.8rem;
        }
        .dg-dashboard-page .card {
          background: var(--bg-card);
          border-color: var(--border-default) !important;
          box-shadow: var(--shadow-card) !important;
        }
        .dg-dashboard-page .card:hover {
          border-color: var(--border-accent-blue) !important;
        }
        .dg-dashboard-page .dg-dashboard-graph-card,
        .dg-dashboard-page .dg-dashboard-bottom-card {
          background: var(--bg-card);
        }
        .dg-dashboard-page .dg-dashboard-bottom-card .card-body,
        .dg-dashboard-page .dg-dashboard-graph-card .card-body {
          position: relative;
        }
        .dg-dashboard-page .dg-dashboard-bottom-card .card-body::before,
        .dg-dashboard-page .dg-dashboard-graph-card .card-body::before {
          content: '';
          position: absolute;
          inset: 0;
          border-radius: inherit;
          pointer-events: none;
          box-shadow: inset 0 0 0 1px rgba(255,255,255,0.015);
        }
        .dg-dashboard-top {
        }
        .dg-dashboard-stat-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 0.9rem;
        }
        .dg-dashboard-stat-card {
          position: relative;
          overflow: hidden;
        }
        .dg-dashboard-stat-card::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 4px;
          background: var(--stat-accent, transparent);
          box-shadow: 0 0 18px color-mix(in srgb, var(--stat-accent, transparent) 55%, transparent);
          z-index: 2;
        }
        .dg-dashboard-stat-card::after {
          content: '';
          position: absolute;
          inset: 0;
          border-radius: inherit;
          pointer-events: none;
          box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--stat-accent, transparent) 26%, rgba(255,255,255,0.06));
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
          border: 1px dashed rgba(148, 163, 184, 0.22);
          background: rgba(15, 23, 42, 0.6);
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
          height: 26rem;
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
          gap: 0.55rem;
        }
        .dg-dashboard-section-label {
          font-size: 0.77rem;
          color: #94a3b8;
          margin: 0;
        }
        .dg-dashboard-chip-group {
          display: flex;
          flex-wrap: wrap;
          gap: 0.45rem;
          align-content: flex-start;
        }
        .dg-dashboard-chip-group.is-asset-type {
          max-height: 3.85rem;
          overflow: hidden;
          padding-bottom: 0.2rem;
        }
        .dg-dashboard-chip {
          display: inline-flex;
          align-items: center;
          max-width: 100%;
          padding: 0.38rem 0.72rem;
          font-size: 0.74rem;
          line-height: 1.1;
          white-space: nowrap;
          border-radius: 999px;
          border: 1px solid rgba(255, 255, 255, 0.14);
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.05);
        }
        .dg-dashboard-chip.dg-badge--info {
          background: rgba(59, 130, 246, 0.2);
          border-color: rgba(59, 130, 246, 0.42);
          color: #bfdbfe;
        }
        .dg-dashboard-chip.dg-badge--notable {
          background: rgba(249, 115, 22, 0.2);
          border-color: rgba(249, 115, 22, 0.42);
          color: #fdba74;
        }
        .dg-dashboard-chip.dg-badge--tag {
          background: rgba(234, 179, 8, 0.18);
          border-color: rgba(234, 179, 8, 0.38);
          color: #fde68a;
        }
        .dg-dashboard-chip.dg-badge--low {
          background: rgba(100, 116, 139, 0.22);
          border-color: rgba(148, 163, 184, 0.3);
          color: #cbd5e1;
        }
        .dg-dashboard-chip.dg-badge--cluster {
          background: rgba(51, 65, 85, 0.72);
          border-color: rgba(148, 163, 184, 0.28);
          color: #e2e8f0;
        }
        .dg-dashboard-recommendation-card--interactive {
          cursor: pointer;
        }
        .dg-dashboard-recommendation-card--interactive:focus-visible {
          outline: 2px solid var(--border-accent-blue);
          outline-offset: 2px;
        }
        .dg-dashboard-recommendation-summary {
          padding: 0.8rem 0.9rem;
          border-radius: 0.85rem;
          background: rgba(59, 130, 246, 0.12);
          border: 1px solid rgba(59, 130, 246, 0.22);
          font-size: 0.93rem;
          font-weight: 600;
          line-height: 1.35;
        }
        .dg-dashboard-recommendation-preview {
          padding: 0.9rem;
          border-radius: 0.85rem;
          border: 1px solid rgba(148, 163, 184, 0.18);
          background: rgba(15, 23, 42, 0.42);
        }
        .dg-dashboard-recommendation-actions {
          margin-top: 1rem;
          padding-top: 0.15rem;
        }
        .dg-dashboard-action-btn {
          min-height: 2.25rem;
          padding: 0.45rem 0.9rem;
          border-radius: 0.8rem;
          font-size: 0.84rem;
          font-weight: 600;
          letter-spacing: -0.01em;
          transition: background-color 160ms ease, border-color 160ms ease, box-shadow 160ms ease, color 160ms ease, transform 160ms ease;
        }
        .dg-dashboard-action-btn:hover:not(:disabled) {
          transform: translateY(-1px);
        }
        .dg-dashboard-action-btn:focus-visible {
          outline: none;
          box-shadow: 0 0 0 2px rgba(96, 165, 250, 0.18);
        }
        .dg-dashboard-action-btn:disabled {
          opacity: 0.5;
        }
        .dg-dashboard-action-btn--primary {
          color: #eff6ff;
          background: linear-gradient(180deg, rgba(30, 64, 175, 0.34) 0%, rgba(15, 23, 42, 0.78) 100%);
          border: 1px solid rgba(96, 165, 250, 0.28);
          box-shadow: inset 0 1px 0 rgba(191, 219, 254, 0.08), 0 0 18px rgba(37, 99, 235, 0.12);
        }
        .dg-dashboard-action-btn--primary:hover:not(:disabled) {
          color: #ffffff;
          background: linear-gradient(180deg, rgba(37, 99, 235, 0.3) 0%, rgba(15, 23, 42, 0.82) 100%);
          border-color: rgba(125, 211, 252, 0.36);
          box-shadow: inset 0 1px 0 rgba(191, 219, 254, 0.12), 0 0 20px rgba(59, 130, 246, 0.16);
        }
        .dg-dashboard-action-btn--secondary {
          color: #dbeafe;
          background: rgba(15, 23, 42, 0.32);
          border: 1px solid rgba(96, 165, 250, 0.2);
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04);
        }
        .dg-dashboard-action-btn--secondary:hover:not(:disabled) {
          color: #eff6ff;
          background: rgba(30, 41, 59, 0.55);
          border-color: rgba(96, 165, 250, 0.3);
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.06), 0 0 14px rgba(59, 130, 246, 0.08);
        }
        .dg-dashboard-action-btn--danger {
          color: #fee2e2;
          background: rgba(69, 10, 10, 0.34);
          border: 1px solid rgba(248, 113, 113, 0.28);
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04), 0 0 18px rgba(239, 68, 68, 0.08);
        }
        .dg-dashboard-action-btn--danger:hover:not(:disabled) {
          color: #fff1f2;
          background: rgba(127, 29, 29, 0.46);
          border-color: rgba(248, 113, 113, 0.4);
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.06), 0 0 20px rgba(239, 68, 68, 0.14);
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
          .dg-dashboard-recommendation-actions {
            justify-content: flex-end !important;
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
                <StatCard
                  key={card.title}
                  title={card.title}
                  value={card.value}
                  compact
                  accentColor={statAccentMap[card.title]}
                  className="dg-dashboard-stat-card"
                />
              ))}
            </div>
          )}
        </div>

        <div className="col-12 col-xl-8">
          <DashboardAttackPathSection clusterCounts={clusterCounts} onClusterChange={setDashboardClusterId} />
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
                  <span className="dg-badge dg-badge--tag">불러오는 중…</span>
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
                          <span key={item.label} className={`${getAssetTypeBadgeClass(item.label)} dg-dashboard-chip`}>
                            {item.label}: {item.count}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="dg-dashboard-section">
                      <div className="dg-dashboard-section-label">Domain</div>
                      <div className="dg-dashboard-chip-group">
                        {domainCounts.map((item) => (
                          <span key={item.label} className={`${getDomainBadgeClass(item.label)} dg-dashboard-chip`}>
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
                            <span key={item.label} className={`${getClusterChipClass()} dg-dashboard-chip`}>
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
          <RecommendationOverviewCard
            recommendations={remediationRecommendations}
            isLoading={analysisJobsQuery.isLoading || analysisResultQuery.isLoading}
            isError={analysisJobsQuery.isError || analysisResultQuery.isError}
            onOpenList={openRemediationList}
            onOpenDetail={openRemediationDetail}
          />
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;
