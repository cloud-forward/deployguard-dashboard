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
import { getAttackGraphEdgeVisualStyle, getAttackGraphNodeTypeStyle } from '../components/graph/attackGraph/stylesheet';
import { ThreatTypeBadge, getThreatLabel, parseAttackPathNode, type AttackPathVisualNodeType } from '../components/graph/attackPathVisuals';
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

type AttackPathPresentationMode = 'summary' | 'graph';
type RiskTone = 'high' | 'medium' | 'low' | 'unknown';
type HeroDetailPanelMode = 'node' | 'edge' | 'none';

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
const HERO_DETAIL_PANEL_MIN_X = 16;
const HERO_DETAIL_PANEL_MIN_Y = 16;
const HERO_DETAIL_PANEL_DEFAULT_TOP = 92;
const HERO_DETAIL_PANEL_DEFAULT_RIGHT_MARGIN = 18;
const HERO_DETAIL_PANEL_EXPANDED_WIDTH = 392;
const HERO_DETAIL_PANEL_COLLAPSED_WIDTH = 276;
const HERO_DETAIL_PANEL_EXPANDED_HEIGHT = 420;
const HERO_DETAIL_PANEL_COLLAPSED_HEIGHT = 78;
const HERO_SWAP_TRANSITION = '420ms cubic-bezier(0.22, 1, 0.36, 1)';

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

const getAttackPathGraphStylesheet = (isGraphFrontMode: boolean) => [
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
      'text-background-color': isGraphFrontMode ? 'rgba(8, 15, 32, 0.88)' : 'transparent',
      'text-background-opacity': isGraphFrontMode ? 1 : 0,
      'text-background-padding': isGraphFrontMode ? '2px' : '0px',
      'text-border-width': isGraphFrontMode ? 1 : 0,
      'text-border-color': isGraphFrontMode ? 'rgba(96, 165, 250, 0.24)' : 'transparent',
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

const DangerMetric: React.FC<{ label: string; value: React.ReactNode; accent?: string; surfaceStyle?: React.CSSProperties }> = ({
  label,
  value,
  accent = '#f8fafc',
  surfaceStyle,
}) => (
  <div
    className="rounded-4 p-3"
    style={{
      background: 'rgba(15, 23, 42, 0.5)',
      border: '1px solid rgba(148, 163, 184, 0.18)',
      boxShadow: '0 16px 32px rgba(2, 6, 23, 0.18)',
      backdropFilter: 'blur(16px)',
      minWidth: 140,
      transition: `background ${HERO_SWAP_TRANSITION}, border-color ${HERO_SWAP_TRANSITION}, box-shadow ${HERO_SWAP_TRANSITION}, transform ${HERO_SWAP_TRANSITION}, opacity ${HERO_SWAP_TRANSITION}`,
      ...surfaceStyle,
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

const getAttackPathBadgeLabel = (type: AttackPathVisualNodeType) => {
  switch (type) {
    case 'pod':
      return 'POD';
    case 'service':
      return 'SVC';
    case 'ingress':
      return 'ING';
    case 'sa':
      return 'SA';
    case 'iam':
      return 'IAM';
    case 's3':
      return 'S3';
    case 'rds':
      return 'RDS';
    case 'cluster_role':
      return 'CR';
    case 'role':
      return 'ROLE';
    case 'secret':
      return 'SECRET';
    case 'node':
      return 'NODE';
    default:
      return 'NODE';
  }
};

const toAttackGraphColorType = (type: AttackPathVisualNodeType): string => {
  switch (type) {
    case 'pod':
      return 'Pod';
    case 'service':
      return 'Service';
    case 'ingress':
      return 'Ingress';
    case 'sa':
      return 'ServiceAccount';
    case 'iam':
      return 'IAMRole';
    case 's3':
      return 'S3';
    case 'rds':
      return 'RDS';
    case 'cluster_role':
      return 'ClusterRole';
    case 'role':
      return 'Role';
    case 'secret':
      return 'Secret';
    case 'node':
      return 'Node';
    default:
      return 'Unknown';
  }
};

const AttackGraphAlignedTypeBadge: React.FC<{ type: AttackPathVisualNodeType }> = ({ type }) => {
  const accentColor = getAttackGraphNodeTypeStyle(toAttackGraphColorType(type)).backgroundColor;

  return (
    <span
      className="d-inline-flex align-items-center justify-content-center"
      style={{
        background: accentColor,
        color: '#eff6ff',
        fontSize: 11,
        fontWeight: 800,
        padding: '2px 7px',
        borderRadius: 999,
        letterSpacing: '0.05em',
        lineHeight: 1.2,
        minWidth: 38,
        boxShadow: `0 0 18px ${accentColor}33`,
      }}
    >
      {getAttackPathBadgeLabel(type)}
    </span>
  );
};

const AttackGraphAlignedNodeIdentity: React.FC<{
  value?: string | null;
  compact?: boolean;
  showThreat?: boolean;
  showGlow?: boolean;
}> = ({ value, compact = false, showThreat = false, showGlow = false }) => {
  const parsed = parseAttackPathNode(value);
  const accentColor = getAttackGraphNodeTypeStyle(toAttackGraphColorType(parsed.type)).backgroundColor;
  const threatLabel = showThreat ? getThreatLabel(parsed.type) : null;

  return (
    <div
      className="d-flex align-items-start gap-2"
      style={
        showGlow
          ? {
              padding: '0.2rem 0.35rem',
              borderRadius: 12,
              boxShadow: `0 0 24px ${accentColor}26`,
            }
          : undefined
      }
      title={parsed.raw}
    >
      <AttackGraphAlignedTypeBadge type={parsed.type} />
      <div className="d-flex flex-column" style={{ minWidth: 0 }}>
        <span
          className="fw-semibold"
          style={{
            overflow: compact ? 'hidden' : undefined,
            textOverflow: compact ? 'ellipsis' : undefined,
            whiteSpace: compact ? 'nowrap' : undefined,
          }}
        >
          {parsed.name}
        </span>
        {threatLabel ? <span className="small text-muted">{threatLabel}</span> : null}
      </div>
    </div>
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
                    <AttackGraphAlignedTypeBadge type={sourceNode.type} />
                    <span className="fw-semibold text-break">{sourceNode.name}</span>
                  </div>
                  <div className="small" style={{ color: '#fbbf24', fontWeight: 700 }}>
                    {step.edge ? toKoreanEdgeType(step.edge.edge_type) : '연결'}
                  </div>
                  <div className="d-flex flex-wrap align-items-center gap-2" title={targetNode.raw}>
                    <span className="small text-muted">도착</span>
                    <AttackGraphAlignedTypeBadge type={targetNode.type} />
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
              <td style={{ minWidth: 220 }}><AttackGraphAlignedNodeIdentity value={edge.source_node_id} compact showThreat /></td>
              <td style={{ minWidth: 220 }}><AttackGraphAlignedNodeIdentity value={edge.target_node_id} compact showThreat showGlow /></td>
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
  const [presentationMode, setPresentationMode] = React.useState<AttackPathPresentationMode>('summary');
  const [selectedNode, setSelectedNode] = React.useState<NodeData | null>(null);
  const [selectedNodeId, setSelectedNodeId] = React.useState<string | null>(null);
  const [selectedEdge, setSelectedEdge] = React.useState<EdgeDetailData | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = React.useState<string | null>(null);
  const [detailPanelCollapsed, setDetailPanelCollapsed] = React.useState(false);
  const [detailPanelPosition, setDetailPanelPosition] = React.useState({ x: HERO_DETAIL_PANEL_MIN_X, y: HERO_DETAIL_PANEL_DEFAULT_TOP });
  const [detailPanelMaxHeight, setDetailPanelMaxHeight] = React.useState<number>();
  const heroCardRef = React.useRef<HTMLDivElement | null>(null);
  const detailPanelRef = React.useRef<HTMLDivElement | null>(null);
  const detailPanelDragOffsetRef = React.useRef<{ x: number; y: number } | null>(null);
  const detailPanelPositionRef = React.useRef(detailPanelPosition);
  const previousDetailPanelModeRef = React.useRef<HeroDetailPanelMode>('none');
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
  const isGraphFrontMode = presentationMode === 'graph';
  const attackPathGraphStylesheet = useMemo(() => getAttackPathGraphStylesheet(isGraphFrontMode), [isGraphFrontMode]);
  const detailPanelMode: HeroDetailPanelMode = !isGraphFrontMode
    ? 'none'
    : selectedNode
    ? 'node'
    : selectedEdge
    ? 'edge'
    : 'none';
  const selectedNodeAccentColor = useMemo(
    () => (selectedNode ? getAttackGraphNodeTypeStyle(getGraphNodeTypeFromId(selectedNode.id)).backgroundColor : undefined),
    [selectedNode],
  );
  const selectedEdgeVisual = useMemo(() => getAttackGraphEdgeVisualStyle(selectedEdge?.relation), [selectedEdge]);
  const selectedEdgeDetails = useMemo<Record<string, string>>(() => {
    if (!selectedEdge) {
      return {};
    }

    const edgeDetails: Record<string, string> = {
      관계: toKoreanEdgeType(selectedEdge.relation),
      출발: `${selectedEdge.sourceLabel ?? selectedEdge.source} (${selectedEdge.source})`,
      도착: `${selectedEdge.targetLabel ?? selectedEdge.target} (${selectedEdge.target})`,
      레이블: selectedEdge.label || selectedEdge.id,
      사유: selectedEdge.reason || '-',
    };

    return edgeDetails;
  }, [selectedEdge]);
  const selectedEdgePanelNode = useMemo<NodeData | null>(
    () =>
      selectedEdge
        ? {
            id: selectedEdge.id,
            label: selectedEdge.label || selectedEdge.relation || selectedEdge.id,
            type: 'Pod',
            details: {},
            blastRadius: {
              pods: 0,
              secrets: 0,
              databases: 0,
              adminPrivilege: false,
            },
          }
        : null,
    [selectedEdge],
  );

  const clampDetailPanelPosition = React.useCallback(
    (
      nextPosition: { x: number; y: number },
      options?: {
        cardWidth?: number;
        cardHeight?: number;
        overlayWidth?: number;
        overlayHeight?: number;
      },
    ) => {
      const card = heroCardRef.current;
      const overlay = detailPanelRef.current;
      const cardWidth = options?.cardWidth ?? card?.clientWidth ?? 0;
      const cardHeight = options?.cardHeight ?? card?.clientHeight ?? 0;
      const overlayWidth =
        options?.overlayWidth ??
        overlay?.offsetWidth ??
        (detailPanelCollapsed ? HERO_DETAIL_PANEL_COLLAPSED_WIDTH : HERO_DETAIL_PANEL_EXPANDED_WIDTH);
      const overlayHeight =
        options?.overlayHeight ??
        overlay?.offsetHeight ??
        (detailPanelCollapsed ? HERO_DETAIL_PANEL_COLLAPSED_HEIGHT : HERO_DETAIL_PANEL_EXPANDED_HEIGHT);

      if (cardWidth <= 0 || cardHeight <= 0) {
        return nextPosition;
      }

      const maxX = Math.max(HERO_DETAIL_PANEL_MIN_X, cardWidth - overlayWidth - HERO_DETAIL_PANEL_MIN_X);
      const maxY = Math.max(HERO_DETAIL_PANEL_MIN_Y, cardHeight - overlayHeight - HERO_DETAIL_PANEL_MIN_Y);

      return {
        x: Math.min(Math.max(HERO_DETAIL_PANEL_MIN_X, nextPosition.x), maxX),
        y: Math.min(Math.max(HERO_DETAIL_PANEL_MIN_Y, nextPosition.y), maxY),
      };
    },
    [detailPanelCollapsed],
  );

  const handleDetailPanelDragStart = React.useCallback<React.MouseEventHandler<HTMLDivElement>>((event) => {
    if (event.button !== 0) {
      return;
    }

    const card = heroCardRef.current;
    if (!card) {
      return;
    }

    const rect = card.getBoundingClientRect();
    detailPanelDragOffsetRef.current = {
      x: event.clientX - rect.left - detailPanelPosition.x,
      y: event.clientY - rect.top - detailPanelPosition.y,
    };
    event.preventDefault();
  }, [detailPanelPosition.x, detailPanelPosition.y]);

  React.useEffect(() => {
    detailPanelPositionRef.current = detailPanelPosition;
  }, [detailPanelPosition]);

  React.useEffect(() => {
    setSelectedNode(null);
    setSelectedNodeId(null);
    setSelectedEdge(null);
    setSelectedEdgeId(null);
    setDetailPanelCollapsed(false);
  }, [pathId, path]);

  React.useEffect(() => {
    if (!isGraphFrontMode) {
      previousDetailPanelModeRef.current = 'none';
      detailPanelDragOffsetRef.current = null;
      setDetailPanelCollapsed(false);
      return;
    }

    const previousMode = previousDetailPanelModeRef.current;
    previousDetailPanelModeRef.current = detailPanelMode;

    if (detailPanelMode === 'none') {
      setDetailPanelCollapsed(false);
      return;
    }

    if (previousMode !== 'none') {
      return;
    }

    const card = heroCardRef.current;
    const overlay = detailPanelRef.current;
    if (!card) {
      return;
    }

    const overlayWidth = overlay?.offsetWidth ?? HERO_DETAIL_PANEL_EXPANDED_WIDTH;
    const overlayHeight = overlay?.offsetHeight ?? HERO_DETAIL_PANEL_EXPANDED_HEIGHT;
    const next = clampDetailPanelPosition(
      {
        x: card.clientWidth - overlayWidth - HERO_DETAIL_PANEL_DEFAULT_RIGHT_MARGIN,
        y: HERO_DETAIL_PANEL_DEFAULT_TOP,
      },
      {
        cardWidth: card.clientWidth,
        cardHeight: card.clientHeight,
        overlayWidth,
        overlayHeight,
      },
    );

    setDetailPanelPosition(next);
  }, [clampDetailPanelPosition, detailPanelMode, isGraphFrontMode]);

  React.useEffect(() => {
    if (!isGraphFrontMode || detailPanelMode === 'none') {
      return;
    }

    const card = heroCardRef.current;
    if (!card) {
      return;
    }

    const updateOverlayBounds = () => {
      const overlay = detailPanelRef.current;
      const cardWidth = card.clientWidth;
      const cardHeight = card.clientHeight;
      const overlayWidth =
        overlay?.offsetWidth ??
        (detailPanelCollapsed ? HERO_DETAIL_PANEL_COLLAPSED_WIDTH : HERO_DETAIL_PANEL_EXPANDED_WIDTH);
      const overlayHeight =
        overlay?.offsetHeight ??
        (detailPanelCollapsed ? HERO_DETAIL_PANEL_COLLAPSED_HEIGHT : HERO_DETAIL_PANEL_EXPANDED_HEIGHT);
      const clamped = clampDetailPanelPosition(detailPanelPositionRef.current, {
        cardWidth,
        cardHeight,
        overlayWidth,
        overlayHeight,
      });

      setDetailPanelPosition((current) => (current.x === clamped.x && current.y === clamped.y ? current : clamped));
      setDetailPanelMaxHeight(Math.max(160, cardHeight - clamped.y - HERO_DETAIL_PANEL_MIN_Y));
    };

    updateOverlayBounds();

    const observer = new ResizeObserver(() => {
      updateOverlayBounds();
    });

    observer.observe(card);
    if (detailPanelRef.current) {
      observer.observe(detailPanelRef.current);
    }

    return () => {
      observer.disconnect();
    };
  }, [clampDetailPanelPosition, detailPanelCollapsed, detailPanelMode, isGraphFrontMode]);

  React.useEffect(() => {
    if (!isGraphFrontMode || detailPanelMode === 'none') {
      setDetailPanelMaxHeight(undefined);
      return;
    }

    const card = heroCardRef.current;
    if (!card) {
      return;
    }

    setDetailPanelMaxHeight(Math.max(160, card.clientHeight - detailPanelPosition.y - HERO_DETAIL_PANEL_MIN_Y));
  }, [detailPanelMode, detailPanelPosition.y, isGraphFrontMode]);

  React.useEffect(() => {
    const handleMouseMove = (event: MouseEvent) => {
      const card = heroCardRef.current;
      const detailDragOffset = detailPanelDragOffsetRef.current;
      if (!card || !detailDragOffset) {
        return;
      }

      const rect = card.getBoundingClientRect();
      const next = clampDetailPanelPosition({
        x: event.clientX - rect.left - detailDragOffset.x,
        y: event.clientY - rect.top - detailDragOffset.y,
      });

      setDetailPanelPosition(next);
    };

    const handleMouseUp = () => {
      detailPanelDragOffsetRef.current = null;
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [clampDetailPanelPosition]);

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
  const hasPathGraph = pathGraphElements.length > 0;
  const truncatedPathId = truncateMiddle(path.path_id, 52);

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
  const shouldShowHeroDetailPanel = detailPanelMode !== 'none';
  const heroGraphLayerStyle: React.CSSProperties = {
    position: 'absolute',
    inset: 0,
    zIndex: isGraphFrontMode ? 3 : 1,
    pointerEvents: isGraphFrontMode ? 'auto' : 'none',
    transition: `transform ${HERO_SWAP_TRANSITION}, opacity ${HERO_SWAP_TRANSITION}`,
  };
  const heroGraphCanvasStyle: React.CSSProperties = {
    position: 'absolute',
    inset: 0,
    opacity: isGraphFrontMode ? 1 : 0.58,
    transform: isGraphFrontMode ? 'scale(1.015)' : 'scale(0.985)',
    filter: isGraphFrontMode ? 'blur(0px) saturate(1.08) brightness(1.04)' : 'blur(11px) saturate(0.74) brightness(0.64)',
    transition: `opacity ${HERO_SWAP_TRANSITION}, transform ${HERO_SWAP_TRANSITION}, filter ${HERO_SWAP_TRANSITION}`,
  };
  const heroGraphTintStyle: React.CSSProperties = {
    position: 'absolute',
    inset: 0,
    pointerEvents: 'none',
    background: isGraphFrontMode
      ? `
        radial-gradient(circle at top left, rgba(248, 113, 113, 0.18), transparent 24%),
        radial-gradient(circle at 76% 18%, rgba(248, 113, 113, 0.12), transparent 26%),
        radial-gradient(circle at bottom right, rgba(96, 165, 250, 0.14), transparent 32%),
        linear-gradient(180deg, rgba(8, 15, 32, 0.05) 0%, rgba(8, 15, 32, 0.12) 28%, rgba(8, 15, 32, 0.3) 100%)
      `
      : `
        radial-gradient(circle at top left, rgba(248, 113, 113, 0.12), transparent 22%),
        radial-gradient(circle at bottom right, rgba(96, 165, 250, 0.1), transparent 30%),
        linear-gradient(180deg, rgba(8, 15, 32, 0.42) 0%, rgba(8, 15, 32, 0.66) 34%, rgba(8, 15, 32, 0.82) 100%)
      `,
    transition: `background ${HERO_SWAP_TRANSITION}, opacity ${HERO_SWAP_TRANSITION}`,
  };
  const heroSummaryLayerStyle: React.CSSProperties = {
    position: 'absolute',
    inset: 0,
    zIndex: isGraphFrontMode ? 1 : 4,
    padding: '1.5rem',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    gap: '1rem',
    opacity: isGraphFrontMode ? 0.08 : 1,
    transform: isGraphFrontMode ? 'translateY(1.4rem) scale(0.958)' : 'translateY(0) scale(1)',
    filter: isGraphFrontMode ? 'blur(18px) saturate(0.82)' : 'blur(0px)',
    transition: `opacity ${HERO_SWAP_TRANSITION}, transform ${HERO_SWAP_TRANSITION}, filter ${HERO_SWAP_TRANSITION}`,
    pointerEvents: 'none',
  };
  const heroSummaryShellStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
    maxWidth: isGraphFrontMode ? 'min(22rem, calc(100% - 1rem))' : 'min(52rem, 100%)',
    transition: `max-width ${HERO_SWAP_TRANSITION}`,
  };
  const heroTitleShellStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
    maxWidth: isGraphFrontMode ? 'min(20rem, 100%)' : 'min(44rem, 100%)',
    transition: `max-width ${HERO_SWAP_TRANSITION}`,
  };
  const heroPathChipStyle: React.CSSProperties = {
    margin: 0,
    padding: '0.34rem 0.72rem',
    borderRadius: 999,
    background: isGraphFrontMode ? 'rgba(8, 15, 32, 0.1)' : 'rgba(8, 15, 32, 0.78)',
    border: isGraphFrontMode ? '1px solid rgba(248, 113, 113, 0.08)' : '1px solid rgba(248, 113, 113, 0.28)',
    color: '#fecaca',
    backdropFilter: isGraphFrontMode ? 'blur(6px)' : 'blur(14px)',
    boxShadow: isGraphFrontMode ? 'none' : '0 14px 28px rgba(2, 6, 23, 0.22)',
    transition: `background ${HERO_SWAP_TRANSITION}, border-color ${HERO_SWAP_TRANSITION}, backdrop-filter ${HERO_SWAP_TRANSITION}, box-shadow ${HERO_SWAP_TRANSITION}`,
  };
  const heroStartTargetStyle: React.CSSProperties = {
    maxWidth: isGraphFrontMode ? 'min(20rem, calc(100% - 1rem))' : 'min(52rem, 100%)',
    background: isGraphFrontMode ? 'rgba(8, 15, 32, 0.12)' : 'rgba(8, 15, 32, 0.76)',
    border: isGraphFrontMode ? '1px solid rgba(248, 113, 113, 0.06)' : '1px solid rgba(248, 113, 113, 0.24)',
    boxShadow: isGraphFrontMode ? 'none' : '0 22px 38px rgba(2, 6, 23, 0.26)',
    backdropFilter: isGraphFrontMode ? 'blur(6px)' : 'blur(18px)',
    transition: `max-width ${HERO_SWAP_TRANSITION}, background ${HERO_SWAP_TRANSITION}, border-color ${HERO_SWAP_TRANSITION}, box-shadow ${HERO_SWAP_TRANSITION}, backdrop-filter ${HERO_SWAP_TRANSITION}`,
  };
  const heroMetricSurfaceStyle: React.CSSProperties = {
    background: isGraphFrontMode ? 'rgba(8, 15, 32, 0.12)' : 'rgba(8, 15, 32, 0.66)',
    border: isGraphFrontMode ? '1px solid rgba(148, 163, 184, 0.08)' : '1px solid rgba(148, 163, 184, 0.22)',
    boxShadow: isGraphFrontMode ? 'none' : '0 18px 34px rgba(2, 6, 23, 0.24)',
    backdropFilter: isGraphFrontMode ? 'blur(6px)' : 'blur(18px)',
  };
  const heroControlLayerStyle: React.CSSProperties = {
    position: 'absolute',
    top: 18,
    right: 18,
    zIndex: 6,
    display: 'flex',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    gap: 10,
  };
  const modeToggleShellStyle: React.CSSProperties = {
    background: isGraphFrontMode ? 'rgba(8, 15, 32, 0.82)' : 'rgba(8, 15, 32, 0.78)',
    border: isGraphFrontMode ? '1px solid rgba(96, 165, 250, 0.22)' : '1px solid rgba(248, 113, 113, 0.18)',
    backdropFilter: 'blur(18px)',
    boxShadow: isGraphFrontMode ? '0 16px 34px rgba(2, 6, 23, 0.28)' : '0 16px 32px rgba(2, 6, 23, 0.24)',
    transition: `background ${HERO_SWAP_TRANSITION}, border-color ${HERO_SWAP_TRANSITION}, box-shadow ${HERO_SWAP_TRANSITION}`,
  };
  const getModeToggleButtonStyle = (mode: AttackPathPresentationMode): React.CSSProperties => {
    const isActive = presentationMode === mode;

    return {
      minWidth: mode === 'summary' ? 92 : 88,
      borderRadius: 999,
      padding: '0.5rem 0.95rem',
      border: isActive ? '1px solid rgba(248, 113, 113, 0.3)' : '1px solid rgba(148, 163, 184, 0.12)',
      background: isActive
        ? 'linear-gradient(180deg, rgba(127, 29, 29, 0.44) 0%, rgba(30, 41, 59, 0.92) 100%)'
        : 'rgba(8, 15, 32, 0.14)',
      color: isActive ? '#fff1f2' : '#dbeafe',
      boxShadow: isActive
        ? 'inset 0 1px 0 rgba(254, 226, 226, 0.12), 0 0 0 1px rgba(248, 113, 113, 0.08), 0 10px 24px rgba(127, 29, 29, 0.16)'
        : 'none',
      transform: isActive ? 'translateY(-1px)' : 'translateY(0)',
      transition: `background ${HERO_SWAP_TRANSITION}, border-color ${HERO_SWAP_TRANSITION}, box-shadow ${HERO_SWAP_TRANSITION}, color ${HERO_SWAP_TRANSITION}, transform ${HERO_SWAP_TRANSITION}`,
    };
  };
  const heroDetailOverlayStyle: React.CSSProperties = {
    position: 'absolute',
    left: detailPanelPosition.x,
    top: detailPanelPosition.y,
    zIndex: 5,
    display: 'flex',
    minHeight: 0,
    pointerEvents: 'auto',
  };

  return (
    <div className="container-fluid py-4">
      <div className="dg-page-shell">
        <div className="dg-page-header">
          <div className="dg-page-heading">
            <h1 className="dg-page-title">공격 그래프</h1>
            <p className="dg-page-description">선택한 클러스터의 연결 자산과 저장된 공격 경로를 확인합니다.</p>
          </div>
          {clusterId ? (
            <div className="d-flex flex-wrap gap-2">
              <Link to={`/clusters/${clusterId}/graph`} className="btn btn-sm dg-dashboard-action-btn dg-dashboard-action-btn--secondary">
                공격 그래프로 돌아가기
              </Link>
              <Link to={`/clusters/${clusterId}/graph?tab=attack-paths`} className="btn btn-sm dg-dashboard-action-btn dg-dashboard-action-btn--secondary">
                공격 패스로 돌아가기
              </Link>
            </div>
          ) : null}
        </div>
        <div
          className="card border-0 shadow-sm mb-4"
          style={{
            position: 'relative',
            minHeight: hasPathGraph ? '30rem' : undefined,
            background: 'linear-gradient(135deg, rgba(127, 29, 29, 0.88) 0%, rgba(69, 10, 10, 0.7) 38%, rgba(15, 23, 42, 0.96) 100%)',
            boxShadow: '0 20px 50px rgba(15, 23, 42, 0.35)',
            overflow: 'hidden',
          }}
        >
          <div ref={heroCardRef} style={{ position: 'relative', minHeight: hasPathGraph ? '30rem' : '24rem' }}>
            {hasPathGraph ? (
              <div style={heroGraphLayerStyle}>
                <div style={heroGraphCanvasStyle}>
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
                <div aria-hidden="true" style={heroGraphTintStyle} />
              </div>
            ) : null}
            <div style={heroSummaryLayerStyle}>
              <div style={heroSummaryShellStyle}>
                <div style={heroTitleShellStyle}>
                  <div className="small text-uppercase" style={{ color: '#fca5a5', letterSpacing: '0.08em' }}>공격 경로 상세</div>
                  <div className="d-flex flex-wrap align-items-center gap-2 gap-lg-3">
                    <h2 className="h3 mb-0 text-white">공격 경로 상세</h2>
                    <code className="small text-break" style={heroPathChipStyle}>
                      {truncatedPathId}
                    </code>
                  </div>
                  <p className="mb-0 text-muted">선택한 경로의 위험도, 이동 단계, 목표 자산 도달 흐름을 확인합니다.</p>
                  {!hasPathGraph ? <div className="small text-muted">그래프로 표시할 수 있는 경로 데이터가 충분하지 않습니다.</div> : null}
                </div>

                <div className="d-flex flex-wrap align-items-start gap-3">
                  <KoreanRiskBadge level={path.risk_level} />
                  <DangerMetric
                    label="위험도 점수"
                    surfaceStyle={heroMetricSurfaceStyle}
                    value={<span style={{ fontSize: '2rem', fontWeight: 800, lineHeight: 1, color: '#ffffff' }}>{formatRiskPercent(path.risk_score)}</span>}
                  />
                  <DangerMetric
                    label="경유 단계"
                    accent={getHopAccent(path.hop_count)}
                    surfaceStyle={heroMetricSurfaceStyle}
                    value={<span style={{ fontSize: '1.7rem', fontWeight: 800, lineHeight: 1 }}>{`${path.hop_count ?? '-'} 단계`}</span>}
                  />
                </div>
              </div>

              <div className="rounded-4 p-4" style={heroStartTargetStyle}>
                <div className="d-flex flex-column gap-2">
                  <div className="small text-uppercase" style={{ color: '#fca5a5', letterSpacing: '0.08em' }}>시작 노드 및 목표 자산</div>
                  <div className="d-flex flex-wrap align-items-center gap-2 gap-lg-3 text-break">
                    <span className="small text-muted">시작 노드</span>
                    <AttackGraphAlignedTypeBadge type={entryNode.type} />
                    <span className="fw-semibold">{entryNode.name}</span>
                    <span className="fw-semibold" style={{ color: '#fca5a5' }}>→</span>
                    <span className="small text-muted">목표 자산</span>
                    <AttackGraphAlignedTypeBadge type={targetNode.type} />
                    <span className="fw-semibold">{targetNode.name}</span>
                    <ThreatTypeBadge type={targetNode.type} />
                  </div>
                  <div className="small text-muted text-break">{`${entryNode.raw} → ${targetNode.raw}`}</div>
                </div>
              </div>
            </div>
            <div style={heroControlLayerStyle}>
              <div
                className="d-inline-flex align-items-center gap-1 rounded-pill p-1"
                style={modeToggleShellStyle}
              >
                <button
                  type="button"
                  className={`btn btn-sm dg-dashboard-action-btn ${presentationMode === 'summary' ? 'dg-dashboard-action-btn--primary' : 'dg-dashboard-action-btn--secondary'}`}
                  onClick={() => setPresentationMode('summary')}
                  style={getModeToggleButtonStyle('summary')}
                >
                  요약 보기
                </button>
                <button
                  type="button"
                  className={`btn btn-sm dg-dashboard-action-btn ${presentationMode === 'graph' ? 'dg-dashboard-action-btn--primary' : 'dg-dashboard-action-btn--secondary'}`}
                  onClick={() => setPresentationMode('graph')}
                  style={getModeToggleButtonStyle('graph')}
                >
                  경로 보기
                </button>
              </div>
            </div>
            {shouldShowHeroDetailPanel ? (
              <div ref={detailPanelRef} style={heroDetailOverlayStyle}>
                {selectedNode ? (
                  <NodeDetailPanel
                    node={selectedNode}
                    onClose={() => {
                      setDetailPanelCollapsed(false);
                      setSelectedNode(null);
                      setSelectedNodeId(null);
                    }}
                    tone="dark"
                    collapsed={detailPanelCollapsed}
                    onToggleCollapsed={() => setDetailPanelCollapsed((current) => !current)}
                    onDragHandleMouseDown={handleDetailPanelDragStart}
                    accentColor={selectedNodeAccentColor}
                    typeLabel={getGraphNodeTypeFromId(selectedNode.id)}
                    panelTitle="노드 상세 정보"
                    panelDescription="선택한 노드의 세부 정보입니다."
                    style={{
                      position: 'relative',
                      top: 0,
                      right: 0,
                      width: detailPanelCollapsed ? `${HERO_DETAIL_PANEL_COLLAPSED_WIDTH}px` : `${HERO_DETAIL_PANEL_EXPANDED_WIDTH}px`,
                      maxHeight: detailPanelMaxHeight ? `${detailPanelMaxHeight}px` : 'calc(100vh - 7rem)',
                    }}
                  />
                ) : null}
                {selectedEdge ? (
                  <NodeDetailPanel
                    node={selectedEdgePanelNode}
                    onClose={() => {
                      setDetailPanelCollapsed(false);
                      setSelectedEdge(null);
                      setSelectedEdgeId(null);
                    }}
                    tone="dark"
                    collapsed={detailPanelCollapsed}
                    onToggleCollapsed={() => setDetailPanelCollapsed((current) => !current)}
                    onDragHandleMouseDown={handleDetailPanelDragStart}
                    panelTitle="엣지 상세 정보"
                    panelDescription="선택한 엣지의 세부 정보입니다."
                    subjectLabel={selectedEdge.relation || selectedEdge.label || selectedEdge.id}
                    accentColor={selectedEdgeVisual.lineColor}
                    icon="↗"
                    typeLabel="관계"
                    details={selectedEdgeDetails}
                    style={{
                      position: 'relative',
                      top: 0,
                      right: 0,
                      width: detailPanelCollapsed ? `${HERO_DETAIL_PANEL_COLLAPSED_WIDTH}px` : `${HERO_DETAIL_PANEL_EXPANDED_WIDTH}px`,
                      maxHeight: detailPanelMaxHeight ? `${detailPanelMaxHeight}px` : 'calc(100vh - 7rem)',
                    }}
                  />
                ) : null}
              </div>
            ) : null}
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
                    <AttackGraphAlignedTypeBadge type={parseAttackPathNode(nodeId).type} />
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

        <div className="mb-4"><StepList path={path} /></div>

        {!isGraphFrontMode ? (
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
        ) : null}

        {orderedEdges.length > 0 ? <div className="mb-4"><EdgeList edges={orderedEdges} /></div> : null}
      </div>
    </div>
  );
};

export default AttackPathDetailPage;
