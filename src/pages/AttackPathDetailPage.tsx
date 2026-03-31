import React, { useMemo } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import type { ElementDefinition } from 'cytoscape';
import {
  useGetAttackPathDetailApiV1ClustersClusterIdAttackPathsPathIdGet,
  useGetRemediationRecommendationsApiV1ClustersClusterIdRemediationRecommendationsGet,
} from '../api/generated/clusters/clusters';
import GraphView from '../components/graph/GraphView';
import NodeDetailPanel from '../components/graph/NodeDetailPanel';
import { attackGraphStylesheet } from '../components/graph/attackGraph';
import { NodeIdentity, NodeTypeBadge, ThreatTypeBadge, parseAttackPathNode } from '../components/graph/attackPathVisuals';
import type {
  AttackPathDetailEnvelopeResponse,
  AttackPathDetailResponse,
  AttackPathEdgeSequenceResponse,
  RemediationRecommendationListItemResponse,
} from '../api/model';
import type { NodeData, NodeType } from '../components/graph/mockGraphData';

type MatchedRemediationItem = {
  recommendation_rank: number;
  fix_type: string;
  blocked_path_ids: string[];
  covered_risk: number;
  recommendation_id: string;
};

type PathSequenceStep = {
  id: string;
  index: number;
  sourceNodeId: string;
  targetNodeId: string;
  edge: AttackPathEdgeSequenceResponse | null;
};

interface EdgeDetailData {
  id: string;
  source: string;
  target: string;
  label?: string;
  relation?: string;
  reason?: string;
  sourceLabel?: string;
  targetLabel?: string;
}

type RiskTone = 'high' | 'medium' | 'low' | 'unknown';

const EDGE_TYPE_KR: Record<string, string> = {
  pod_uses_service_account: '서비스 계정 사용',
  service_account_assumes_iam_role: 'IAM 역할 획득',
  iam_role_access_resource: '리소스 접근',
  service_targets_pod: '서비스가 Pod 선택',
  lateral_move: '수평 이동',
  ingress_exposes_service: 'Ingress 노출',
  role_grants_resource: '역할 권한 부여',
  service_account_bound_cluster_role: '클러스터 역할 바인딩',
};

const formatDateTime = (value?: string | null) => {
  if (!value) return '-';
  const timestamp = new Date(value);
  if (Number.isNaN(timestamp.getTime())) return value;
  return timestamp.toLocaleString('ko-KR');
};

const formatRiskPercent = (value?: number | null) => {
  if (typeof value !== 'number' || Number.isNaN(value)) return '-';
  return `${(value * 100).toFixed(1)}%`;
};

const formatRawRisk = (value?: number | null) => {
  if (typeof value !== 'number' || Number.isNaN(value)) return '-';
  return value.toFixed(4);
};

const truncateMiddle = (value: string, maxLength: number) => {
  if (value.length <= maxLength) return value;
  const head = Math.ceil((maxLength - 1) / 2);
  const tail = Math.floor((maxLength - 1) / 2);
  return `${value.slice(0, head)}…${value.slice(-tail)}`;
};

const toErrorMessage = (error: unknown, fallback: string) => {
  if (error && typeof error === 'object' && 'message' in error) {
    const message = error.message;
    if (typeof message === 'string' && message.trim()) return message;
  }
  return fallback;
};

const isAttackPathDetailEnvelope = (value: unknown): value is AttackPathDetailEnvelopeResponse =>
  Boolean(value && typeof value === 'object' && 'cluster_id' in value);

const getRiskTone = (riskLevel?: string | null): RiskTone => {
  const normalized = riskLevel?.trim().toLowerCase();
  if (normalized === 'critical' || normalized === 'high') return 'high';
  if (normalized === 'medium') return 'medium';
  if (normalized === 'low') return 'low';
  return 'unknown';
};

const getRiskLabelKo = (riskLevel?: string | null) => {
  const tone = getRiskTone(riskLevel);
  if (tone === 'high') return '위험';
  if (tone === 'medium') return '보통';
  if (tone === 'low') return '낮음';
  return '미확인';
};

const getRiskBadgeStyle = (riskLevel?: string | null) => {
  const tone = getRiskTone(riskLevel);
  if (tone === 'high') {
    return {
      background: 'rgba(239, 68, 68, 0.18)',
      color: '#fecaca',
      border: '1px solid rgba(248, 113, 113, 0.35)',
      boxShadow: '0 0 18px rgba(239, 68, 68, 0.12)',
    };
  }
  if (tone === 'medium') {
    return {
      background: 'rgba(245, 158, 11, 0.18)',
      color: '#fde68a',
      border: '1px solid rgba(245, 158, 11, 0.34)',
      boxShadow: '0 0 18px rgba(245, 158, 11, 0.08)',
    };
  }
  if (tone === 'low') {
    return {
      background: 'rgba(34, 197, 94, 0.18)',
      color: '#bbf7d0',
      border: '1px solid rgba(74, 222, 128, 0.28)',
      boxShadow: '0 0 18px rgba(34, 197, 94, 0.08)',
    };
  }
  return {
    background: 'rgba(100, 116, 139, 0.16)',
    color: '#cbd5e1',
    border: '1px solid rgba(148, 163, 184, 0.22)',
    boxShadow: 'none',
  };
};

const toKoreanEdgeType = (value?: string | null) => {
  const raw = typeof value === 'string' && value.trim() ? value.trim() : 'unknown';
  return EDGE_TYPE_KR[raw] ?? raw.replace(/_/g, ' ');
};

const getPanelNodeTypeFromId = (nodeId: string): NodeType => {
  const n = nodeId.toLowerCase();
  if (n.startsWith('sa:') || n.includes('serviceaccount') || n.includes('service_account')) return 'ServiceAccount';
  if (n.startsWith('iam:')) return 'IAMRole';
  if (n.startsWith('s3:')) return 'S3Bucket';
  return 'Pod';
};

const getGraphNodeTypeFromId = (nodeId: string): string => {
  const n = nodeId.toLowerCase();
  if (n.startsWith('pod:')) return 'Pod';
  if (n.startsWith('sa:')) return 'ServiceAccount';
  if (n.startsWith('iam:')) return 'IAMRole';
  if (n.startsWith('s3:')) return 'S3';
  if (n.startsWith('rds:')) return 'RDS';
  if (n.startsWith('service:')) return 'Service';
  if (n.startsWith('ingress:')) return 'Ingress';
  if (n.startsWith('cluster_role:')) return 'ClusterRole';
  return 'Pod';
};

const getNodeLastSegment = (value?: string | null) => {
  const raw = typeof value === 'string' && value.trim() ? value.trim() : '-';
  const segments = raw.split(':').filter(Boolean);
  return segments[segments.length - 1] ?? raw;
};

const toCompactNodeLabel = (value: string): string => {
  const normalized = value.trim();
  if (normalized.length <= 10) {
    return normalized;
  }

  return `${normalized.slice(0, 10)}...`;
};

const DASHBOARD_PATH_X_STEP = 150;
const DASHBOARD_PATH_Y_PATTERN = [0, 60, -30, 55, -20];

const getDashboardPathPosition = (index: number) => ({
  x: index * DASHBOARD_PATH_X_STEP,
  y: DASHBOARD_PATH_Y_PATTERN[index % DASHBOARD_PATH_Y_PATTERN.length] ?? 0,
});

const getOrderedPathSteps = (path: AttackPathDetailResponse): PathSequenceStep[] => {
  const orderedEdges = Array.isArray(path.edges)
    ? [...path.edges].sort((left, right) => left.edge_index - right.edge_index)
    : [];

  if (orderedEdges.length > 0) {
    return orderedEdges.map((edge, index) => ({
      id: edge.edge_id,
      index,
      sourceNodeId: path.node_ids?.[index] ?? edge.source_node_id,
      targetNodeId: path.node_ids?.[index + 1] ?? edge.target_node_id,
      edge,
    }));
  }

  const orderedNodes = Array.isArray(path.node_ids) ? path.node_ids.filter(Boolean) : [];
  return orderedNodes.slice(0, -1).map((nodeId, index) => ({
    id: path.edge_ids?.[index] ?? `${nodeId}-${orderedNodes[index + 1] ?? index}`,
    index,
    sourceNodeId: nodeId,
    targetNodeId: orderedNodes[index + 1] ?? '',
    edge: null,
  }));
};

const renderValue = (value: unknown): string => {
  if (value == null) return '-';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
};

const buildAttackPathGraphElements = (path: AttackPathDetailResponse): ElementDefinition[] => {
  const steps = getOrderedPathSteps(path).filter((step) => step.sourceNodeId && step.targetNodeId);
  const connectedNodeIds = new Set<string>();

  for (const step of steps) {
    connectedNodeIds.add(step.sourceNodeId);
    connectedNodeIds.add(step.targetNodeId);
  }

  const orderedNodeIds = (Array.isArray(path.node_ids) ? path.node_ids : []).filter((nodeId) => connectedNodeIds.has(nodeId));
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
        node_id: nodeId,
        display_name: getNodeLastSegment(nodeId),
        path_role: nodeId === path.entry_node_id ? '시작 노드' : nodeId === path.target_node_id ? '목표 자산' : '중간 단계',
        risk_level: getRiskLabelKo(path.risk_level),
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
      id: step.edge?.edge_id ?? `path-edge-${step.index}`,
      source: step.sourceNodeId,
      target: step.targetNodeId,
      relation: step.edge?.edge_type ?? 'path_step',
      label: toKoreanEdgeType(step.edge?.edge_type),
      reason: step.edge?.metadata && Object.keys(step.edge.metadata).length > 0 ? renderValue(step.edge.metadata) : undefined,
    },
  }));

  return [...nodeElements, ...edgeElements];
};

const attackPathGraphStylesheet = [
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

const getHopAccent = (count?: number | null) => {
  if (typeof count !== 'number' || Number.isNaN(count)) return '#94a3b8';
  if (count <= 3) return '#ef4444';
  if (count >= 4) return '#f59e0b';
  return '#94a3b8';
};

const SectionCard: React.FC<{ title: string; children: React.ReactNode; className?: string }> = ({ title, children, className }) => (
  <div className={`card border-0 shadow-sm ${className ?? ''}`}>
    <div className="card-body">
      <h2 className="h5 mb-3">{title}</h2>
      {children}
    </div>
  </div>
);

const DangerMetric: React.FC<{ label: string; value: React.ReactNode; accent?: string }> = ({ label, value, accent = '#f8fafc' }) => (
  <div
    className="rounded-4 p-3"
    style={{
      background: 'rgba(15, 23, 42, 0.5)',
      border: '1px solid rgba(148, 163, 184, 0.18)',
      minWidth: 140,
    }}
  >
    <div className="small text-muted mb-1">{label}</div>
    <div className="fw-semibold" style={{ color: accent }}>
      {value}
    </div>
  </div>
);

const DetailField: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
  <div className="col-12 col-md-6 col-xl-4">
    <div className="border rounded-4 p-3 h-100 bg-card-surface">
      <div className="text-muted small mb-1">{label}</div>
      <div className="text-break">{value}</div>
    </div>
  </div>
);

const KoreanRiskBadge: React.FC<{ level?: string | null }> = ({ level }) => {
  const style = getRiskBadgeStyle(level);
  return (
    <span
      className="d-inline-flex align-items-center justify-content-center"
      style={{
        ...style,
        minWidth: 74,
        padding: '6px 12px',
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 800,
        letterSpacing: '0.04em',
        lineHeight: 1.1,
      }}
    >
      {getRiskLabelKo(level)}
    </span>
  );
};

const StepList: React.FC<{ path: AttackPathDetailResponse }> = ({ path }) => {
  const steps = useMemo(() => getOrderedPathSteps(path), [path]);

  if (steps.length === 0) {
    return (
      <SectionCard title="공격 단계별 흐름">
        <div className="text-muted small">공격 단계 정보가 없습니다.</div>
      </SectionCard>
    );
  }

  return (
    <SectionCard title="공격 단계별 흐름">
      <div className="d-flex flex-column gap-3">
        {steps.map((step, index) => {
          const sourceNode = parseAttackPathNode(step.sourceNodeId);
          const targetNode = parseAttackPathNode(step.targetNodeId);
          const isFinalTarget = step.targetNodeId === path.target_node_id;

          return (
            <React.Fragment key={step.id}>
              <div className="border rounded-4 p-3" style={{ background: 'rgba(15, 23, 42, 0.52)', borderColor: 'rgba(148, 163, 184, 0.18)' }}>
                <div className="small text-muted mb-2">{`단계 ${step.index + 1}`}</div>
                <div className="d-flex flex-column gap-3">
                  <div className="d-flex flex-wrap align-items-center gap-2" title={sourceNode.raw}>
                    <span className="small text-muted">출발</span>
                    <NodeTypeBadge type={sourceNode.type} />
                    <span className="fw-semibold text-break">{sourceNode.name}</span>
                  </div>
                  <div className="small" style={{ color: '#fbbf24', fontWeight: 700 }}>
                    {step.edge ? toKoreanEdgeType(step.edge.edge_type) : '연결'}
                  </div>
                  <div className="d-flex flex-wrap align-items-center gap-2" title={targetNode.raw}>
                    <span className="small text-muted">도착</span>
                    <NodeTypeBadge type={targetNode.type} />
                    <span className="fw-semibold text-break">{targetNode.name}</span>
                    {isFinalTarget ? (
                      <span className="d-inline-flex align-items-center" style={{ color: '#fecaca', background: 'rgba(127, 29, 29, 0.42)', border: '1px solid rgba(248, 113, 113, 0.34)', borderRadius: 999, padding: '3px 8px', fontSize: 12, fontWeight: 800, lineHeight: 1.2 }}>
                        목표 자산
                      </span>
                    ) : null}
                  </div>
                </div>
                {step.edge?.metadata && Object.keys(step.edge.metadata).length > 0 ? (
                  <details className="mt-3">
                    <summary className="small text-muted" style={{ cursor: 'pointer' }}>세부 메타데이터</summary>
                    <pre className="mb-0 mt-2 small text-wrap" style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{renderValue(step.edge.metadata)}</pre>
                  </details>
                ) : null}
              </div>
              {index < steps.length - 1 ? (
                <div className="text-center text-muted" aria-hidden="true" style={{ fontSize: '1.1rem', lineHeight: 1 }}>↓</div>
              ) : null}
            </React.Fragment>
          );
        })}
      </div>
    </SectionCard>
  );
};

const EdgeList: React.FC<{ edges: AttackPathEdgeSequenceResponse[] }> = ({ edges }) => (
  <SectionCard title="엣지 연결 정보">
    <div className="table-responsive">
      <table className="table table-sm align-middle mb-0">
        <thead className="table-light">
          <tr>
            <th>#</th>
            <th>엣지 ID</th>
            <th>관계 유형</th>
            <th>출발 노드</th>
            <th>도착 노드</th>
          </tr>
        </thead>
        <tbody>
          {edges.map((edge) => (
            <tr key={edge.edge_id}>
              <td>{edge.edge_index + 1}</td>
              <td className="text-break">{edge.edge_id}</td>
              <td>{toKoreanEdgeType(edge.edge_type)}</td>
              <td style={{ minWidth: 220 }}><NodeIdentity value={edge.source_node_id} compact showThreat /></td>
              <td style={{ minWidth: 220 }}><NodeIdentity value={edge.target_node_id} compact showThreat showGlow /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </SectionCard>
);

const AttackPathDetailPage: React.FC<{ matchedRemediation?: MatchedRemediationItem[] }> = ({ matchedRemediation }) => {
  const navigate = useNavigate();
  const { clusterId = '', pathId = '' } = useParams();
  const [selectedNode, setSelectedNode] = React.useState<NodeData | null>(null);
  const [selectedNodeId, setSelectedNodeId] = React.useState<string | null>(null);
  const [selectedEdge, setSelectedEdge] = React.useState<EdgeDetailData | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = React.useState<string | null>(null);
  const query = useGetAttackPathDetailApiV1ClustersClusterIdAttackPathsPathIdGet(clusterId, pathId, {
    query: {
      enabled: Boolean(clusterId && pathId),
      retry: false,
    },
  });
  const remediationQuery = useGetRemediationRecommendationsApiV1ClustersClusterIdRemediationRecommendationsGet(clusterId, {
    query: {
      enabled: Boolean(clusterId),
      retry: false,
    },
  });

  const envelope = isAttackPathDetailEnvelope(query.data) ? query.data : null;
  const path = envelope?.path ?? null;
  const orderedEdges = Array.isArray(path?.edges) ? [...(path.edges ?? [])].sort((left, right) => left.edge_index - right.edge_index) : [];
  const edgeIds = Array.isArray(path?.edge_ids) ? path.edge_ids : [];
  const pathGraphElements = useMemo(() => (path ? buildAttackPathGraphElements(path) : []), [path]);

  const selectedNodeLookup = useMemo(() => {
    const map = new Map<string, NodeData>();
    if (!path) return map;

    for (const element of pathGraphElements) {
      const data = element.data as Record<string, unknown>;
      if (typeof data.source === 'string') continue;
      const id = String(data.id ?? '');
      map.set(id, {
        id,
        label: String(data.fullLabel ?? data.label ?? id),
        type: getPanelNodeTypeFromId(id),
        namespace: typeof data.namespace === 'string' ? data.namespace : undefined,
        details: typeof data.details === 'object' && data.details !== null
          ? Object.entries(data.details as Record<string, unknown>).reduce<Record<string, string>>((acc, [key, value]) => {
              acc[key] = value == null ? '' : String(value);
              return acc;
            }, {})
          : {},
        blastRadius: { pods: 0, secrets: 0, databases: 0, adminPrivilege: false },
      });
    }
    return map;
  }, [path, pathGraphElements]);

  const selectedEdgeLookup = useMemo(() => {
    const map = new Map<string, EdgeDetailData>();
    for (const element of pathGraphElements) {
      const data = element.data as Record<string, unknown>;
      if (typeof data.source !== 'string') continue;
      const sourceId = String(data.source ?? '');
      const targetId = String(data.target ?? '');
      map.set(String(data.id ?? ''), {
        id: String(data.id ?? ''),
        source: sourceId,
        target: targetId,
        relation: typeof data.relation === 'string' ? data.relation : undefined,
        label: typeof data.label === 'string' ? data.label : undefined,
        reason: typeof data.reason === 'string' ? data.reason : undefined,
        sourceLabel: sourceId,
        targetLabel: targetId,
      });
    }
    return map;
  }, [pathGraphElements]);

  const attackPathLayout = useMemo(() => ({
    name: 'preset',
    animate: false,
    fit: true,
    padding: 48,
  }), []);

  React.useEffect(() => {
    setSelectedNode(null);
    setSelectedNodeId(null);
    setSelectedEdge(null);
    setSelectedEdgeId(null);
  }, [pathId, path]);

  if (query.isLoading) {
    return <div className="container-fluid py-4"><div className="card border-0 shadow-sm"><div className="card-body py-5 text-center text-muted">공격 경로 상세 정보를 불러오는 중입니다...</div></div></div>;
  }

  if (query.isError) {
    return (
      <div className="container-fluid py-4">
        <div className="card border-0 shadow-sm">
          <div className="card-body py-4">
            <div className="alert alert-danger mb-3" role="alert">{toErrorMessage(query.error, '공격 경로 상세 정보를 불러오지 못했습니다.')}</div>
            <button type="button" className="btn btn-sm dg-dashboard-action-btn dg-dashboard-action-btn--secondary" onClick={() => query.refetch()}>다시 시도</button>
          </div>
        </div>
      </div>
    );
  }

  if (!envelope || !path) {
    return (
      <div className="container-fluid py-4">
        <div className="card border-0 shadow-sm">
          <div className="card-body py-5 text-center">
            <h1 className="h4 mb-2">공격 경로 상세 정보가 없습니다.</h1>
            <p className="text-muted mb-3">백엔드에서 해당 경로의 상세 데이터를 반환하지 않았습니다.</p>
            {clusterId ? <Link to={`/clusters/${clusterId}/graph`} className="btn btn-sm dg-dashboard-action-btn dg-dashboard-action-btn--secondary">공격 그래프로 돌아가기</Link> : null}
          </div>
        </div>
      </div>
    );
  }

  const entryNode = parseAttackPathNode(path.entry_node_id);
  const targetNode = parseAttackPathNode(path.target_node_id);
  const orderedSteps = getOrderedPathSteps(path);
  const chainNodes: string[] = orderedSteps.length > 0
    ? [orderedSteps[0].sourceNodeId, ...orderedSteps.map((s) => s.targetNodeId)]
    : [path.entry_node_id, path.target_node_id].filter((value): value is string => Boolean(value));

  const tid = path.target_node_id ?? '';
  const targetDangerLabel =
    tid.startsWith('s3:') ? ' S3 데이터 유출 가능' :
    tid.startsWith('rds:') ? ' DB 직접 접근 가능' :
    tid.startsWith('iam:') ? ' IAM 권한 탈취 가능' :
    tid.includes('cluster_role') ? ' 클러스터 권한 상승 가능' :
    ' 위험 자산 접근 가능';

  const remediationList = Array.isArray((remediationQuery.data as { items?: RemediationRecommendationListItemResponse[] } | undefined)?.items)
    ? (((remediationQuery.data as { items?: RemediationRecommendationListItemResponse[] }).items ?? []) as RemediationRecommendationListItemResponse[])
    : matchedRemediation;

  const bestFix = [...(remediationList ?? [])]
    .filter((r) => r.blocked_path_ids?.includes(path.path_id ?? ''))
    .sort((a, b) => a.recommendation_rank - b.recommendation_rank)[0];

  const fixTypeLabel = (t: string) =>
    t === 'change_service_account' ? '서비스 계정 변경' :
    t === 'restrict_iam_policy' ? 'IAM 정책 제한' :
    t;

  return (
    <div className="container-fluid py-4">
      <div className="card border-0 shadow-sm mb-4" style={{ background: 'linear-gradient(135deg, rgba(127, 29, 29, 0.88) 0%, rgba(69, 10, 10, 0.7) 38%, rgba(15, 23, 42, 0.96) 100%)', boxShadow: '0 20px 50px rgba(15, 23, 42, 0.35)', overflow: 'hidden' }}>
        <div className="card-body p-4 p-lg-5">
          <div className="d-flex flex-column gap-4">
            <div className="d-flex flex-wrap justify-content-between align-items-start gap-3">
              <div className="d-flex flex-wrap align-items-center gap-3">
                <KoreanRiskBadge level={path.risk_level} />
                <DangerMetric label="위험도 점수" value={<span style={{ fontSize: '2rem', fontWeight: 800, lineHeight: 1, color: '#ffffff' }}>{formatRiskPercent(path.risk_score)}</span>} />
                <DangerMetric label="경유 단계" accent={getHopAccent(path.hop_count)} value={<span style={{ fontSize: '1.7rem', fontWeight: 800, lineHeight: 1 }}>{`${path.hop_count ?? '-'} 단계`}</span>} />
              </div>
              {clusterId ? <Link to={`/clusters/${clusterId}/graph`} className="btn btn-sm dg-dashboard-action-btn dg-dashboard-action-btn--secondary">공격 그래프로 돌아가기</Link> : null}
            </div>

            <div className="rounded-4 p-4" style={{ background: 'rgba(15, 23, 42, 0.46)', border: '1px solid rgba(248, 113, 113, 0.2)' }}>
              <div className="d-flex flex-column gap-2">
                <div className="small text-uppercase" style={{ color: '#fca5a5', letterSpacing: '0.08em' }}>시작 노드 및 목표 자산</div>
                <div className="d-flex flex-wrap align-items-center gap-2 gap-lg-3 text-break">
                  <span className="small text-muted">시작 노드</span>
                  <NodeTypeBadge type={entryNode.type} />
                  <span className="fw-semibold">{entryNode.name}</span>
                  <span className="fw-semibold" style={{ color: '#fca5a5' }}>→</span>
                  <span className="small text-muted">목표 자산</span>
                  <NodeTypeBadge type={targetNode.type} />
                  <span className="fw-semibold">{targetNode.name}</span>
                  <ThreatTypeBadge type={targetNode.type} />
                </div>
                <div className="small text-muted text-break">{`${entryNode.raw} → ${targetNode.raw}`}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <SectionCard title="왜 위험한가?" className="mb-4">
        <div style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 12, padding: '16px 20px', marginBottom: 16 }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom: 12 }}>
            <span style={{ color:'#ef4444', fontWeight:700, fontSize:'1.1rem' }}>{targetDangerLabel}</span>
            <span style={{ color:'#ef4444', fontWeight:700, fontSize:'1.4rem' }}>{((path.risk_score ?? 0) * 100).toFixed(1)}%</span>
          </div>
          <div style={{ display:'flex', flexWrap:'wrap', alignItems:'center', gap: '4px 6px' }}>
            {chainNodes.map((nodeId, i) => {
              const short = nodeId.split(':').at(-1) ?? nodeId;
              const isLast = i === chainNodes.length - 1;
              return (
                <React.Fragment key={`${nodeId}-${i}`}>
                  {i > 0 && <span style={{ color:'#6b7280', fontSize:'0.85rem' }}>→</span>}
                  <NodeTypeBadge type={parseAttackPathNode(nodeId).type} />
                  <span style={{ fontWeight: isLast ? 700 : 400 }}>{short}</span>
                  {isLast && <span></span>}
                </React.Fragment>
              );
            })}
          </div>
        </div>
      </SectionCard>

      {bestFix && (
        <div style={{ background: 'rgba(239,68,68,0.08)', borderLeft: '3px solid #ef4444', borderRadius: 8, padding: '12px 16px', marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <span style={{ fontSize:'0.875rem' }}>
            이 경로는 <strong>"{fixTypeLabel(bestFix.fix_type ?? '')}"</strong> 조치로 차단할 수 있습니다&nbsp;·&nbsp;
            <span style={{ color:'#9ca3af' }}>
              위험 경로 {bestFix.blocked_path_ids?.length ?? 0}개 차단 가능&nbsp;·&nbsp;위험도 {(bestFix.covered_risk ?? 0).toFixed(2)} 감소
            </span>
          </span>
          <button
            onClick={() => {
              navigate('/remediation', {
                state: {
                  highlightId: bestFix.recommendation_id,
                  clusterId,
                },
              });
            }}
            style={{ border: '1px solid #ef4444', background: 'transparent', color: '#ef4444', borderRadius: 6, padding: '4px 12px', fontSize: '0.875rem', cursor: 'pointer', whiteSpace: 'nowrap' }}
          >
            권장 조치 보기 →
          </button>
        </div>
      )}

      <SectionCard title="공격 경로 시각화" className="mb-4">
        {pathGraphElements.length === 0 ? <div className="text-muted small">그래프로 표시할 수 있는 경로 데이터가 충분하지 않습니다.</div> : (
          <div style={{ minHeight: 340, height: 340 }}>
            <GraphView
              elements={pathGraphElements}
              layout={attackPathLayout}
              stylesheet={attackPathGraphStylesheet}
              selectedPathNodeIds={[]}
              selectedPathEdgeIds={[]}
              selectedNodeId={selectedNodeId}
              selectedEdgeId={selectedEdgeId}
              showLabels
              onNodeClick={(node) => {
                const clicked = selectedNodeLookup.get(node.id) ?? node;
                setSelectedNode(clicked);
                setSelectedNodeId(clicked.id);
                setSelectedEdge(null);
                setSelectedEdgeId(null);
              }}
              onEdgeClick={(edge) => {
                const clicked = selectedEdgeLookup.get(edge.id) ?? edge;
                setSelectedEdge(clicked);
                setSelectedEdgeId(clicked.id);
                setSelectedNode(null);
                setSelectedNodeId(null);
              }}
            />
          </div>
        )}
      </SectionCard>

      {selectedNode ? <div className="mb-4"><NodeDetailPanel node={selectedNode} onClose={() => { setSelectedNode(null); setSelectedNodeId(null); }} style={{ position: 'relative', top: 0, right: 0, width: 320 }} /></div> : null}

      {selectedEdge ? (
        <div className="card shadow mb-4">
          <div className="card-header bg-dark text-white d-flex justify-content-between align-items-center">
            <strong>엣지 상세 정보</strong>
            <button type="button" className="btn-close btn-close-white" aria-label="닫기" onClick={() => { setSelectedEdge(null); setSelectedEdgeId(null); }} />
          </div>
          <div className="card-body">
            <p className="small text-muted mb-3">선택한 엣지의 상세 데이터입니다.</p>
            <table className="table table-sm table-borderless mb-0">
              <tbody>
                <tr><td className="text-muted fw-semibold">관계</td><td>{toKoreanEdgeType(selectedEdge.relation)}</td></tr>
                <tr><td className="text-muted fw-semibold">출발</td><td>{`${selectedEdge.sourceLabel ?? selectedEdge.source} (${selectedEdge.source})`}</td></tr>
                <tr><td className="text-muted fw-semibold">도착</td><td>{`${selectedEdge.targetLabel ?? selectedEdge.target} (${selectedEdge.target})`}</td></tr>
                <tr><td className="text-muted fw-semibold">레이블</td><td>{selectedEdge.label || selectedEdge.id}</td></tr>
                <tr><td className="text-muted fw-semibold">사유</td><td style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{selectedEdge.reason || '-'}</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      <div className="mb-4"><StepList path={path} /></div>

      <div className="accordion mb-4" id="attack-path-detail-accordion">
        <div className="accordion-item border-0 shadow-sm">
          <h2 className="accordion-header" id="attack-path-detail-heading">
            <button className="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#attack-path-detail-collapse" aria-expanded="false" aria-controls="attack-path-detail-collapse">상세 정보</button>
          </h2>
          <div id="attack-path-detail-collapse" className="accordion-collapse collapse" aria-labelledby="attack-path-detail-heading" data-bs-parent="#attack-path-detail-accordion">
            <div className="accordion-body bg-card-surface">
              <div className="row g-3 mb-4">
                <DetailField label="위험도 점수" value={formatRiskPercent(path.risk_score)} />
                <DetailField label="위험도 점수 (raw)" value={formatRawRisk(path.raw_final_risk)} />
                <DetailField label="분석 시각" value={formatDateTime(envelope.generated_at)} />
                <DetailField label="클러스터 ID" value={envelope.cluster_id} />
                <DetailField label="경로 ID" value={<code className="small text-break">{truncateMiddle(path.path_id, 60)}</code>} />
                <DetailField label="분석 실행 ID" value={envelope.analysis_run_id ?? '-'} />
              </div>

              <div className="mb-4">
                <h3 className="h6 mb-2">연결된 엣지 ID</h3>
                {edgeIds.length === 0 ? <div className="text-muted small">연결된 엣지 ID가 없습니다.</div> : (
                  <ol className="mb-0 ps-3">{edgeIds.map((edgeId) => <li key={edgeId} className="mb-2 text-break">{edgeId}</li>)}</ol>
                )}
              </div>

              <div className="d-flex flex-column gap-3">
                {orderedEdges.filter((edge) => edge.metadata && Object.keys(edge.metadata).length > 0).map((edge) => (
                  <details key={edge.edge_id} className="rounded-4 p-3" style={{ background: 'rgba(15, 23, 42, 0.42)', border: '1px solid rgba(148, 163, 184, 0.18)' }}>
                    <summary style={{ cursor: 'pointer', fontWeight: 700 }}>{`엣지 메타데이터 ${edge.edge_id}`}</summary>
                    <pre className="mb-0 mt-3 small text-wrap" style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{renderValue(edge.metadata)}</pre>
                  </details>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {orderedEdges.length > 0 ? <div className="mb-4"><EdgeList edges={orderedEdges} /></div> : null}
    </div>
  );
};

export default AttackPathDetailPage;
