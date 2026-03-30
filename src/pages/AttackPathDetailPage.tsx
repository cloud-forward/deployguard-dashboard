import React, { useMemo } from 'react';
import { Info } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import {
  useGetAttackPathDetailApiV1ClustersClusterIdAttackPathsPathIdGet,
  useGetRemediationRecommendationsApiV1ClustersClusterIdRemediationRecommendationsGet,
} from '../api/generated/clusters/clusters';
import type {
  AttackPathDetailEnvelopeResponse,
  RemediationRecommendationListItemResponse,
  RemediationRecommendationListResponse,
} from '../api/model';
import GraphView from '../components/graph/GraphView';
import { attackGraphStylesheet } from '../components/graph/attackGraph';
import { NodeTypeBadge, RiskLevelBadge } from '../components/graph/attackPathVisuals';
import PageLoader from '../components/layout/PageLoader';
import {
  attackPathDetailGraphLayout,
  buildCytoscapeElements,
  getEdgeTypeLabel,
  getImpactLabel,
  getRiskColor,
  parseNodeId,
} from './attackPathDetailUtils';

const isAttackPathDetailEnvelope = (value: unknown): value is AttackPathDetailEnvelopeResponse =>
  Boolean(value && typeof value === 'object' && 'cluster_id' in value);

const toRecommendationItems = (value: unknown): RemediationRecommendationListItemResponse[] => {
  if (!value || typeof value !== 'object') {
    return [];
  }

  const response = value as RemediationRecommendationListResponse;
  return Array.isArray(response.items) ? response.items : [];
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

const formatRiskScore = (value?: number | null) => {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return '-';
  }

  return value.toLocaleString(undefined, {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  });
};

const formatCoveredRisk = (value?: number | null) => {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return '-';
  }

  return value.toFixed(2);
};

const formatGeneratedAt = (value?: string | null) => {
  if (!value) {
    return '-';
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleString();
};

const getRiskBannerClassName = (riskLevel?: string | null) => {
  const tone = getRiskColor(riskLevel ?? '');

  if (tone === 'danger') {
    return 'border-danger border-opacity-50 bg-danger-subtle';
  }

  if (tone === 'warning') {
    return 'border-warning border-opacity-50 bg-warning-subtle';
  }

  return 'border-success border-opacity-50 bg-success-subtle';
};

const getExposureNodes = (edges: Array<{ target_node_id: string }>) => {
  const allowed = new Set(['iam', 's3', 'rds', 'cluster_role']);
  const ordered: Array<ReturnType<typeof parseNodeId>> = [];
  const seen = new Set<string>();

  for (const edge of edges) {
    const node = parseNodeId(edge.target_node_id);
    if (!allowed.has(node.type) || seen.has(node.fullId)) {
      continue;
    }

    seen.add(node.fullId);
    ordered.push(node);
  }

  return ordered;
};

const AttackPathDetailPage: React.FC = () => {
  const { clusterId = '', pathId = '' } = useParams<{ clusterId: string; pathId: string }>();

  const detailQuery = useGetAttackPathDetailApiV1ClustersClusterIdAttackPathsPathIdGet(
    clusterId,
    pathId,
    {
      query: {
        enabled: Boolean(clusterId && pathId),
        retry: false,
      },
    },
  );

  const recommendationQuery =
    useGetRemediationRecommendationsApiV1ClustersClusterIdRemediationRecommendationsGet(
      clusterId,
      {
        query: {
          enabled: Boolean(clusterId),
          retry: false,
        },
      },
    );

  const envelope = isAttackPathDetailEnvelope(detailQuery.data) ? detailQuery.data : null;
  const path = envelope?.path ?? null;
  const recommendations = useMemo(
    () => toRecommendationItems(recommendationQuery.data),
    [recommendationQuery.data],
  );

  const data = useMemo(
    () => ({
      summary: {
        generated_at: envelope?.generated_at ?? null,
      },
      remediation_recommendations: recommendations,
    }),
    [envelope?.generated_at, recommendations],
  );

  const orderedEdges = useMemo(
    () =>
      [...(Array.isArray(path?.edges) ? path.edges : [])].sort(
        (left, right) => left.edge_index - right.edge_index,
      ),
    [path?.edges],
  );

  const graphElements = useMemo(
    () => (path ? buildCytoscapeElements(path) : []),
    [path],
  );

  const graphNodeCount = useMemo(
    () =>
      graphElements.filter((element) => {
        const data = element.data as { source?: string } | undefined;
        return !data?.source;
      }).length,
    [graphElements],
  );

  const graphEdgeCount = useMemo(
    () =>
      graphElements.filter((element) => {
        const data = element.data as { source?: string } | undefined;
        return Boolean(data?.source);
      }).length,
    [graphElements],
  );

  const entryNode = parseNodeId(path?.entry_node_id ?? '-');
  const targetNode = parseNodeId(path?.target_node_id ?? '-');
  const impactLabel = getImpactLabel(targetNode.type);
  const exposedAssets = useMemo(
    () => getExposureNodes(orderedEdges),
    [orderedEdges],
  );

  const remediation = useMemo(
    () =>
      data.remediation_recommendations.find((item) =>
        Array.isArray(item.blocked_path_ids) && item.blocked_path_ids.includes(pathId),
      ) ?? null,
    [data.remediation_recommendations, pathId],
  );

  if (detailQuery.isLoading) {
    return <PageLoader label="공격 경로 상세 정보를 불러오는 중..." minHeight="70vh" />;
  }

  if (detailQuery.isError || !path) {
    return (
      <div className="dg-page-shell">
        <div className="alert alert-danger mb-0" role="alert">
          {toErrorMessage(detailQuery.error, '공격 경로 상세 정보를 불러오지 못했습니다.')}
        </div>
      </div>
    );
  }

  return (
    <div className="dg-page-shell">
      <div className="d-flex flex-column gap-3">
        <div>
          <Link
            to={`/clusters/${clusterId}/graph`}
            className="btn btn-outline-secondary btn-sm"
          >
            ← 공격 그래프로 돌아가기
          </Link>
        </div>

        <div
          className={`card border-start border-4 shadow-sm ${getRiskBannerClassName(
            path.risk_level,
          )}`}
        >
          <div className="card-body py-4">
            <div className="d-flex flex-wrap align-items-center gap-2 mb-3">
              <RiskLevelBadge level={path.risk_level} />
              <span className="dg-badge dg-badge--notable">{impactLabel}</span>
            </div>
            <div className="h3 fw-bold mb-2 text-break">
              {entryNode.displayName}이(가) {path.hop_count ?? '-'}번의 이동으로
            </div>
            <div className="h3 fw-bold mb-3 text-break">
              {targetNode.displayName}에 접근 권한을 획득할 수 있습니다.
            </div>
            <div className="text-muted small d-flex flex-wrap gap-3">
              <span>리스크 점수 {formatRiskScore(path.risk_score)}</span>
              <span>|</span>
              <span>경로 길이 {path.hop_count ?? '-'} hops</span>
              <span>|</span>
              <span>분석 시각 {formatGeneratedAt(data.summary.generated_at)}</span>
            </div>
          </div>
        </div>

        <div className="row g-3 align-items-start">
          <div className="col-12 col-xl-8">
            <div className="card border-0 shadow-sm">
              <div className="card-body p-2">
                <div className="d-flex justify-content-end mb-2">
                  <span className="text-muted small">
                    {graphNodeCount} 노드 · {graphEdgeCount} 엣지
                  </span>
                </div>
                <div
                  className="border rounded-3 overflow-hidden"
                  style={{ height: 320 }}
                >
                  <GraphView
                    elements={graphElements}
                    layout={attackPathDetailGraphLayout}
                    stylesheet={attackGraphStylesheet}
                    viewportRefreshKey={`${path.path_id}:${graphNodeCount}:${graphEdgeCount}`}
                    onLayoutComplete={(cy) => {
                      cy.fit(cy.elements(), 60);
                    }}
                    selectedPathNodeIds={[]}
                    selectedPathEdgeIds={[]}
                    selectedNodeId={null}
                    selectedEdgeId={null}
                    onNodeClick={() => {}}
                    onEdgeClick={() => {}}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="col-12 col-xl-4">
            {exposedAssets.length > 0 ? (
              <div className="card border-0 shadow-sm">
                <div className="card-body py-3">
                  <h2 className="h5 mb-3">노출되는 자산</h2>
                  <div className="d-flex flex-column gap-3">
                    {exposedAssets.map((asset) => (
                      <div key={asset.fullId} className="border rounded-3 p-3">
                        <div className="d-flex align-items-center gap-2 mb-2">
                          <NodeTypeBadge type={asset.type} />
                          <span className="fw-semibold text-break">{asset.displayName}</span>
                        </div>
                        <div className="mb-2">{getImpactLabel(asset.type)}</div>
                        <div className="small text-muted font-monospace text-break">
                          {asset.fullId}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>

        <div className="card border-0 shadow-sm">
          <div className="card-body py-3">
            <h2 className="h5 mb-3">공격 단계</h2>
            <div className="d-flex flex-column gap-3">
              {orderedEdges.map((edge, index) => {
                const source = parseNodeId(edge.source_node_id);
                const target = parseNodeId(edge.target_node_id);

                return (
                  <div key={edge.edge_id} className="border rounded-3 p-3">
                    <div className="d-flex justify-content-between align-items-center gap-3 mb-3">
                      <div className="fw-semibold">{index + 1}단계</div>
                      <div className="text-muted small">
                        {getEdgeTypeLabel(edge.edge_type)}
                      </div>
                    </div>
                    <div className="d-flex flex-column gap-2 align-items-start">
                      <div className="d-flex align-items-center gap-2">
                        <NodeTypeBadge type={source.type} />
                        <span className="fw-semibold text-break">{source.displayName}</span>
                      </div>
                      <div className="text-muted ps-2">│</div>
                      <div className="text-muted ps-2">↓</div>
                      <div className="d-flex align-items-center gap-2">
                        <NodeTypeBadge type={target.type} />
                        <span className="fw-semibold text-break">{target.displayName}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {remediation ? (
          <Link
            to={`/clusters/${clusterId}/recommendations/${remediation.recommendation_id}`}
            className="alert alert-info mb-0 d-flex align-items-start gap-2 text-decoration-none"
          >
            <Info size={18} className="flex-shrink-0 mt-1" />
            <span className="small">
              이 경로는 권장 조치 #{remediation.recommendation_rank + 1}에 포함됩니다.
              해당 조치를 적용하면 {remediation.blocked_path_ids?.length ?? 0}개 경로를 차단하고
              리스크를 {formatCoveredRisk(remediation.covered_risk)}만큼 줄일 수 있습니다. →
            </span>
          </Link>
        ) : null}
      </div>
    </div>
  );
};

export default AttackPathDetailPage;
