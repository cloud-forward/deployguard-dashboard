import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import NodeDetailPanel from '../components/graph/NodeDetailPanel';
import GraphFilters from '../components/graph/GraphFilters';
import type { NodeData, NodeType } from '../components/graph/mockGraphData';
import PageLoader from '../components/layout/PageLoader';
import {
  useGetAttackPathDetailApiV1ClustersClusterIdAttackPathsPathIdGet,
  useGetAttackPathsApiV1ClustersClusterIdAttackPathsGet,
  useListClustersApiV1ClustersGet,
} from '../api/generated/clusters/clusters';
import type { AttackPathListItemResponse } from '../api/model';
import { useGetClusterAttackGraph } from '../api/attackGraph';
import {
  attackGraphDefaultLayout,
  filterAttackGraphElements,
  filterIsolatedAttackGraphNodes,
  toAttackGraphElements,
  toAttackGraphViewModel,
  type AttackGraphApiResponse,
  type AttackGraphEdgeRelation,
  type AttackGraphFilters,
  type AttackGraphNode,
  type AttackGraphPath,
  type AttackGraphResourceType,
  type AttackGraphRiskSeverity,
} from '../components/graph/attackGraph';
import { getAttackGraphEdgeVisualStyle, getAttackGraphNodeTypeStyle } from '../components/graph/attackGraph/stylesheet';
import {
  getNodeTypeMeta,
  getThreatLabel,
  getRiskSortOrder,
  NodeTypeBadge,
  parseAttackPathNode,
  RiskLevelBadge,
  ThreatTypeBadge,
} from '../components/graph/attackPathVisuals';

const GraphView = React.lazy(() => import('../components/graph/GraphView'));

const LARGE_GRAPH_THRESHOLD = 180;
const GRAPH_CONTROLS_MIN_X = 12;
const GRAPH_CONTROLS_MIN_Y = 12;
const GRAPH_CONTROLS_DEFAULT_POSITION = { x: 16, y: 12 };
const DETAIL_PANEL_MIN_X = 12;
const DETAIL_PANEL_MIN_Y = 12;
const DETAIL_PANEL_DEFAULT_TOP = 12;
const DETAIL_PANEL_DEFAULT_RIGHT_MARGIN = 16;
const DETAIL_PANEL_EXPANDED_WIDTH = 340;
const DETAIL_PANEL_COLLAPSED_WIDTH = 252;
const DETAIL_PANEL_EXPANDED_HEIGHT = 360;
const DETAIL_PANEL_COLLAPSED_HEIGHT = 72;
const EMPTY_ATTACK_GRAPH: AttackGraphApiResponse = {
  nodes: [],
  edges: [],
  paths: [],
};

type SelectionMode = 'none' | 'path' | 'node' | 'edge';
type AttackGraphInnerTab = 'graph' | 'attack-paths';
type AttackGraphDetailValue =
  | string
  | number
  | boolean
  | null
  | AttackGraphDetailValue[]
  | Record<string, unknown>;
type SearchResultKind = 'node' | 'edge' | 'path';

interface SearchResult {
  key: string;
  kind: SearchResultKind;
  id: string;
  label: string;
  focusNodeId: string | null;
}

interface EdgeData {
  id: string;
  source: string;
  target: string;
  label?: string;
  relation?: string;
  reason?: string;
  sourceLabel?: string;
  targetLabel?: string;
}

const ATTACK_GRAPH_RESOURCE_ICONS: Record<AttackGraphResourceType, string> = {
  Ingress: '🚪',
  Pod: '🐳',
  ServiceAccount: '👤',
  Role: '🧩',
  ClusterRole: '🧩',
  RoleBinding: '🔗',
  ClusterRoleBinding: '🔗',
  Secret: '🔒',
  Service: '🧪',
  Node: '🖧',
  ContainerImage: '🧱',
  IAMRole: '🔑',
  IAMUser: '👥',
  EC2Instance: '🖥️',
  SecurityGroup: '🛡️',
  S3: '🪣',
  RDS: '🗄️',
  Unknown: '❔',
};

const mapLegacyTypeToAttackGraphType = (nodeType: string): string => {
  if (nodeType === 'S3Bucket') return 'S3';
  return nodeType;
};

const sortAndNormalize = <T,>(values: T[]): T[] =>
  [...values]
    .reduce((acc, value) => {
      if (!acc.includes(value)) {
        acc.push(value);
      }
      return acc;
    }, [] as T[])
    .sort();

const toErrorMessage = (error: unknown, fallback: string) => {
  if (error && typeof error === 'object' && 'message' in error) {
    const message = error.message;
    if (typeof message === 'string' && message.trim()) {
      return message;
    }
  }

  return fallback;
};

const toDisplayLabel = (key: string) =>
  key
    .replace(/_/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/\b\w/g, (character) => character.toUpperCase());

const toSearchTokens = (value?: string) =>
  (value ?? '')
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);

const toSearchableString = (...values: Array<string | number | null | undefined>) =>
  values
    .filter((value) => value != null && String(value).trim())
    .map((value) => String(value).toLowerCase())
    .join(' ');

const coerceAttackGraphApiResponse = (value: unknown): AttackGraphApiResponse => {
  if (!value || typeof value !== 'object') {
    return EMPTY_ATTACK_GRAPH;
  }

  const record = value as Record<string, unknown>;

  return {
    cluster_id: typeof record.cluster_id === 'string' ? record.cluster_id : undefined,
    analysis_run_id: typeof record.analysis_run_id === 'string' ? record.analysis_run_id : null,
    generated_at: typeof record.generated_at === 'string' ? record.generated_at : null,
    summary: typeof record.summary === 'string' ? record.summary : null,
    evidence_count: typeof record.evidence_count === 'number' ? record.evidence_count : null,
    metadata:
      typeof record.metadata === 'object' && record.metadata !== null
        ? (record.metadata as AttackGraphApiResponse['metadata'])
        : undefined,
    nodes: Array.isArray(record.nodes) ? (record.nodes as AttackGraphApiResponse['nodes']) : [],
    edges: Array.isArray(record.edges) ? (record.edges as AttackGraphApiResponse['edges']) : [],
    paths: Array.isArray(record.paths) ? (record.paths as AttackGraphApiResponse['paths']) : [],
  };
};

const mapAttackGraphNodeToPanelNode = (node: AttackGraphNode): NodeData => {
  const normalizedType = mapLegacyTypeToAttackGraphType(node.resourceType ?? 'Unknown');
  let panelType: NodeType = 'Pod';

  if (normalizedType === 'ServiceAccount') panelType = 'ServiceAccount';
  if (normalizedType === 'IAMRole') panelType = 'IAMRole';
  if (normalizedType === 'S3') panelType = 'S3Bucket';

  return {
    id: node.id,
    label: node.label,
    type: panelType,
    namespace: node.namespace ?? undefined,
    details: Object.entries(node.details ?? {}).reduce<Record<string, string>>((acc, [key, value]) => {
      acc[toDisplayLabel(key)] = value ?? '';
      return acc;
    }, {}),
    blastRadius: {
      pods: 0,
      secrets: 0,
      databases: 0,
      adminPrivilege: false,
    },
  };
};

const toDetailValue = (value: unknown): AttackGraphDetailValue => {
  if (value == null) return null;
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => toDetailValue(item));
  }

  if (typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, nestedValue]) => [key, toDetailValue(nestedValue)]),
    );
  }

  return String(value);
};

const getSearchResultKindLabel = (kind: SearchResultKind) => {
  if (kind === 'node') return '노드';
  if (kind === 'edge') return '엣지';
  return '경로';
};

const getSelectionModeLabel = (mode: SelectionMode) => {
  if (mode === 'node') return '노드';
  if (mode === 'edge') return '엣지';
  if (mode === 'path') return '경로';
  return '없음';
};

const toAttackGraphDetailMap = (node: AttackGraphNode | null): Record<string, AttackGraphDetailValue> => {
  if (!node) return {};

  const rawDetails =
    typeof node.raw.details === 'object' && node.raw.details !== null ? (node.raw.details as Record<string, unknown>) : {};
  const rawMetadata =
    typeof node.raw.metadata === 'object' && node.raw.metadata !== null
      ? (node.raw.metadata as Record<string, unknown>)
      : {};

  const merged: Record<string, unknown> = {
    ...rawDetails,
    ...rawMetadata,
  };

  if (typeof node.raw.evidence_count === 'number') {
    merged.evidence_count = node.raw.evidence_count;
  }

  if (node.namespace && merged.namespace == null) {
    merged.namespace = node.namespace;
  }

  return Object.entries(merged).reduce<Record<string, AttackGraphDetailValue>>((acc, [key, value]) => {
    acc[toDisplayLabel(key)] = toDetailValue(value);
    return acc;
  }, {});
};

interface AttackGraphContentProps {
  payload: AttackGraphApiResponse;
  filters: AttackGraphFilters;
  onFiltersChange: React.Dispatch<React.SetStateAction<AttackGraphFilters>>;
  emptyStateTitle?: string;
  emptyStateBody?: string;
  liveSummary?: string | null;
  liveEvidenceCount?: number | null;
}

const formatNumber = (value?: number | null) => {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return '-';
  }

  return value.toLocaleString();
};

const getFallbackRiskScore = (riskLevel?: string | null) => {
  const normalized = riskLevel?.trim().toLowerCase();
  if (normalized === 'critical') return 100;
  if (normalized === 'high') return 90;
  if (normalized === 'medium') return 60;
  if (normalized === 'low') return 30;
  return 0;
};

const getAttackPathRiskScore = (item: AttackPathListItemResponse) =>
  typeof item.risk_score === 'number' && Number.isFinite(item.risk_score)
    ? item.risk_score
    : getFallbackRiskScore(item.risk_level);

type RiskScoreSortDirection = 'asc' | 'desc';

const getHopColor = (count?: number | null) => {
  if (typeof count !== 'number' || Number.isNaN(count)) {
    return '#94a3b8';
  }

  if (count >= 2 && count <= 3) return '#ef4444';
  if (count === 4) return '#f59e0b';
  return '#9ca3af';
};

const getThreatAccentBorder = (target?: string | null) => {
  const parsed = parseAttackPathNode(target);
  const threatTypes = new Set(['iam', 's3', 'rds']);
  return threatTypes.has(parsed.type) ? getNodeTypeMeta(parsed.type).background : 'transparent';
};

const PathNodeText: React.FC<{
  value?: string | null;
  compact?: boolean;
  showThreat?: boolean;
}> = ({ value, compact = false, showThreat = false }) => {
  const parsed = parseAttackPathNode(value);
  const threatLabel = showThreat ? getThreatLabel(parsed.type) : null;

  return (
    <div className="d-flex align-items-start gap-2" title={parsed.raw} style={{ minWidth: 0 }}>
      <NodeTypeBadge type={parsed.type} />
      <div className="d-flex flex-column" style={{ minWidth: 0, flex: 1 }}>
        <span
          className="fw-semibold"
          style={
            compact
              ? {
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }
              : undefined
          }
        >
          {parsed.name}
        </span>
        {threatLabel ? <span className="small text-muted">{threatLabel}</span> : null}
      </div>
    </div>
  );
};

const AttackPathDetailPanel: React.FC<{
  clusterId: string;
  pathId: string | null;
  enabled: boolean;
  onClose: () => void;
}> = ({ clusterId, pathId, enabled, onClose }) => {
  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
  } = useGetAttackPathDetailApiV1ClustersClusterIdAttackPathsPathIdGet(clusterId, pathId ?? '', {
    query: {
      enabled,
      retry: false,
    },
  });

  const detail =
    data && typeof data === 'object' && 'path' in data
      ? data.path ?? null
      : null;
  const entryNode = parseAttackPathNode(detail?.entry_node_id);
  const targetNode = parseAttackPathNode(detail?.target_node_id);
  const threatAccent = getThreatAccentBorder(detail?.target_node_id);
  const visibleNodeIds = Array.isArray(detail?.node_ids) ? detail.node_ids.filter((item) => item?.trim()) : [];
  const visibleEdgeIds = Array.isArray(detail?.edge_ids) ? detail.edge_ids.filter((item) => item?.trim()) : [];
  const riskScore = formatNumber(detail?.risk_score);
  const rawFinalRisk = formatNumber(detail?.raw_final_risk);

  return (
    <>
      <button
        type="button"
        aria-label="공격 경로 상세 패널 닫기"
        className="border-0"
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, background: 'rgba(2, 6, 23, 0.3)', zIndex: 1040 }}
      />
      <aside
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          width: 'min(460px, 100vw)',
          height: '100vh',
          zIndex: 1050,
          overflowY: 'auto',
          background: 'rgba(15, 23, 42, 0.8)',
          borderLeft: '1px solid rgba(148, 163, 184, 0.18)',
          boxShadow: '-18px 0 50px rgba(15, 23, 42, 0.4)',
          backdropFilter: 'blur(18px)',
        }}
      >
        <div className="p-4 border-bottom d-flex justify-content-between align-items-start gap-3">
          <div className="w-100">
            <div className="small text-uppercase text-muted mb-2">공격 경로 상세</div>
            {detail ? (
              <div className="d-flex flex-wrap align-items-center gap-2 text-white">
                <RiskLevelBadge level={detail.risk_level} />
                <ThreatTypeBadge type={targetNode.type} />
                <span className="text-muted small">|</span>
                <span className="small text-muted">시작</span>
                <NodeTypeBadge type={entryNode.type} />
                <span className="fw-semibold text-break">{entryNode.name}</span>
                <span className="small text-muted">목표</span>
                <NodeTypeBadge type={targetNode.type} />
                <span className="fw-semibold text-break">{targetNode.name}</span>
              </div>
            ) : (
              <h2 className="h4 mb-0 text-white text-break">{pathId ?? '선택한 경로'}</h2>
            )}
          </div>
          <button type="button" className="btn-close btn-close-white" aria-label="닫기" onClick={onClose} />
        </div>

        <div className="p-4 d-flex flex-column gap-4 text-light">
          {isLoading ? (
            <div className="text-muted">저장된 공격 경로 상세 정보를 불러오는 중입니다...</div>
          ) : isError ? (
            <div>
              <div className="alert alert-danger mb-3" role="alert">
                {toErrorMessage(error, '저장된 공격 경로 상세 정보를 불러오지 못했습니다.')}
              </div>
              <button type="button" className="btn btn-sm dg-dashboard-action-btn dg-dashboard-action-btn--secondary" onClick={() => refetch()}>
                다시 시도
              </button>
            </div>
          ) : !detail ? (
            <div className="text-muted">저장된 공격 경로 상세 정보가 없습니다.</div>
          ) : (
            <>
              <div
                className="rounded-4 p-3"
                style={{
                  background: 'rgba(15, 23, 42, 0.6)',
                  border: '1px solid rgba(148, 163, 184, 0.18)',
                  borderLeft: `2px solid ${threatAccent}`,
                }}
              >
                <div className="small text-muted mb-1">경로 ID</div>
                <code className="d-block small text-break user-select-all" style={{ color: '#cbd5e1' }}>
                  {detail.path_id}
                </code>
              </div>

              <div className="row g-3">
                <div className="col-12 col-sm-6">
                  <div className="small text-muted mb-1">경유 수</div>
                  <div className="fw-semibold" style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}>
                    {detail.hop_count ?? '-'}
                  </div>
                </div>
                {riskScore !== '-' ? (
                  <div className="col-12 col-sm-6">
                    <div className="small text-muted mb-1">위험도 점수</div>
                    <div className="fw-semibold">{riskScore}</div>
                  </div>
                ) : null}
                {rawFinalRisk !== '-' ? (
                  <div className="col-12 col-sm-6">
                    <div className="small text-muted mb-1">최종 위험도 원시값</div>
                    <div className="fw-semibold">{rawFinalRisk}</div>
                  </div>
                ) : null}
              </div>

              {visibleNodeIds.length > 0 ? (
                <div>
                  <h3 className="h6 mb-2">노드 ID</h3>
                  <ol className="mb-0 ps-3 small">
                    {visibleNodeIds.map((item) => (
                      <li key={item} className="mb-1 text-break" style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}>
                        {item}
                      </li>
                    ))}
                  </ol>
                </div>
              ) : null}

              {visibleEdgeIds.length > 0 ? (
                <div>
                  <h3 className="h6 mb-2">{`엣지 ID (${visibleEdgeIds.length}개)`}</h3>
                  <ol className="mb-0 ps-3 small">
                    {visibleEdgeIds.map((item) => (
                      <li key={item} className="mb-1 text-break" style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}>
                        {item}
                      </li>
                    ))}
                  </ol>
                </div>
              ) : null}
            </>
          )}
        </div>
      </aside>
    </>
  );
};

const AttackPathsPanel: React.FC<{
  clusterId: string;
  enabled: boolean;
}> = ({ clusterId, enabled }) => {
  const [selectedPathId, setSelectedPathId] = useState<string | null>(null);
  const [riskScoreSortDirection, setRiskScoreSortDirection] = useState<RiskScoreSortDirection>('desc');
  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
  } = useGetAttackPathsApiV1ClustersClusterIdAttackPathsGet(clusterId, {
    query: {
      enabled,
      retry: false,
    },
  });

  const items = useMemo(
    () =>
      (
        Array.isArray((data as { items?: AttackPathListItemResponse[] } | undefined)?.items)
          ? ((data as { items?: AttackPathListItemResponse[] }).items ?? [])
          : []
      ).slice().sort((left, right) => {
        const leftScore = getAttackPathRiskScore(left);
        const rightScore = getAttackPathRiskScore(right);
        const scoreGap =
          riskScoreSortDirection === 'desc' ? rightScore - leftScore : leftScore - rightScore;
        if (scoreGap !== 0) {
          return scoreGap;
        }

        const riskGap = getRiskSortOrder(left.risk_level) - getRiskSortOrder(right.risk_level);
        if (riskGap !== 0) {
          return riskGap;
        }

        const hopGap = (left.hop_count ?? 0) - (right.hop_count ?? 0);
        if (hopGap !== 0) {
          return hopGap;
        }

        return left.path_id.localeCompare(right.path_id);
      }),
    [data, riskScoreSortDirection],
  );
  const resolvedSelectedPathId =
    enabled && items.some((item) => item.path_id === selectedPathId) ? selectedPathId : null;
  const shouldLoadDetail = enabled && Boolean(clusterId) && Boolean(resolvedSelectedPathId);
  const isAttackPathDetailOpen = Boolean(resolvedSelectedPathId);

  if (isLoading) {
    return (
      <div className="card border-0 shadow-sm">
        <div className="card-body py-5 text-center text-muted">탐지된 공격 경로를 불러오는 중입니다...</div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="card border-0 shadow-sm">
        <div className="card-body py-4">
          <div className="alert alert-danger mb-3" role="alert">
            {toErrorMessage(error, '탐지된 공격 경로를 불러오지 못했습니다.')}
          </div>
          <button type="button" className="btn btn-sm dg-dashboard-action-btn dg-dashboard-action-btn--secondary" onClick={() => refetch()}>
            다시 시도
          </button>
        </div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="card border-0 shadow-sm">
        <div className="card-body py-5 text-center">
          <h2 className="h5 mb-2">탐지된 공격 경로가 없습니다.</h2>
          <p className="text-muted mb-0">분석 데이터가 준비되면 탐지된 공격 경로가 여기에 표시됩니다.</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="card border-0 shadow-sm">
        <div className="card-body py-3">
          <div className="d-flex justify-content-between align-items-center gap-3 mb-3">
            <div>
              <h2 className="h5 mb-1">탐지된 공격 경로</h2>
              <p className="text-muted mb-0 small">{items.length}개 경로</p>
            </div>
          </div>
          <div className="table-responsive">
            <table className="table align-middle mb-0 small dg-attack-paths-table">
              <thead className="table-light">
                <tr>
                  <th style={{ width: 120 }}>
                    <button
                      type="button"
                      className="dg-table-sort-button"
                      onClick={() =>
                        setRiskScoreSortDirection((current) => (current === 'desc' ? 'asc' : 'desc'))
                      }
                      aria-label={`위험도 점수 ${riskScoreSortDirection === 'desc' ? '오름차순' : '내림차순'} 정렬`}
                    >
                      <span>위험도 점수</span>
                      <span className="dg-table-sort-indicator" aria-hidden="true">
                        {riskScoreSortDirection === 'desc' ? '↓' : '↑'}
                      </span>
                    </button>
                  </th>
                  <th>위험</th>
                  <th>시작 노드</th>
                  <th>목표 자산</th>
                  <th>단계</th>
                  <th>상세</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => {
                  const isSelected = item.path_id === resolvedSelectedPathId;
                  const entryNode = parseAttackPathNode(item.entry_node_id);
                  const targetNode = parseAttackPathNode(item.target_node_id);
                  const hopCount = item.hop_count ?? item.node_ids?.length ?? null;
                  const riskScore = getAttackPathRiskScore(item);
                  const threatAccent = getThreatAccentBorder(item.target_node_id);
                  const isHighRisk = item.risk_level?.toLowerCase() === 'high';

                  return (
                    <tr
                      key={item.path_id}
                      role="button"
                      className={isSelected ? 'dg-attack-path-row table-active' : 'dg-attack-path-row'}
                      onClick={() => setSelectedPathId(item.path_id)}
                      style={{
                        cursor: 'pointer',
                        backgroundColor: isHighRisk ? 'rgba(239, 68, 68, 0.05)' : undefined,
                        boxShadow: `inset 2px 0 0 ${threatAccent}`,
                        transition: 'background-color 160ms ease',
                      }}
                    >
                      <td
                        style={{
                          width: 120,
                          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                          fontWeight: 700,
                          color: '#f8fafc',
                        }}
                      >
                        {formatNumber(riskScore)}
                      </td>
                      <td style={{ width: 92 }}>
                        <RiskLevelBadge level={item.risk_level} />
                      </td>
                      <td style={{ maxWidth: 240 }}>
                        <div title={entryNode.raw}>
                          <PathNodeText value={item.entry_node_id} compact />
                        </div>
                      </td>
                      <td style={{ maxWidth: 260 }}>
                        <div title={targetNode.raw}>
                          <PathNodeText value={item.target_node_id} compact showThreat />
                        </div>
                      </td>
                      <td
                        style={{
                          width: 72,
                          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                          color: getHopColor(hopCount),
                          fontWeight: 700,
                        }}
                      >
                        {hopCount ?? '-'}
                      </td>
                      <td>
                        <Link
                          to={`/clusters/${clusterId}/attack-paths/${item.path_id}`}
                          className="btn btn-sm dg-dashboard-action-btn dg-dashboard-action-btn--secondary"
                          onClick={(event) => event.stopPropagation()}
                        >
                          보기
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      {isAttackPathDetailOpen ? (
        <AttackPathDetailPanel
          clusterId={clusterId}
          pathId={resolvedSelectedPathId}
          enabled={shouldLoadDetail}
          onClose={() => setSelectedPathId(null)}
        />
      ) : null}
    </>
  );
};

const AttackGraphContent: React.FC<AttackGraphContentProps> = ({
  payload,
  filters,
  onFiltersChange,
  emptyStateTitle = '공격 그래프 데이터가 없습니다.',
  emptyStateBody = '현재 선택에 사용 가능한 노드 또는 엣지가 없습니다.',
  liveSummary,
  liveEvidenceCount,
}) => {
  const [selectedPathId, setSelectedPathId] = useState<string | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [searchNavigationState, setSearchNavigationState] = useState<{ key: string; index: number }>({
    key: '',
    index: 0,
  });
  const [controlsCollapsed, setControlsCollapsed] = useState(false);
  const [controlsPosition, setControlsPosition] = useState(GRAPH_CONTROLS_DEFAULT_POSITION);
  const [controlsMaxHeight, setControlsMaxHeight] = useState<number>();
  const [detailPanelCollapsed, setDetailPanelCollapsed] = useState(false);
  const [detailPanelPosition, setDetailPanelPosition] = useState({ x: 16, y: DETAIL_PANEL_DEFAULT_TOP });
  const [detailPanelMaxHeight, setDetailPanelMaxHeight] = useState<number>();
  const graphCardRef = useRef<HTMLDivElement | null>(null);
  const graphControlsRef = useRef<HTMLDivElement | null>(null);
  const detailPanelRef = useRef<HTMLDivElement | null>(null);
  const dragOffsetRef = useRef<{ x: number; y: number } | null>(null);
  const detailPanelDragOffsetRef = useRef<{ x: number; y: number } | null>(null);
  const controlsPositionRef = useRef(controlsPosition);
  const detailPanelPositionRef = useRef(detailPanelPosition);
  const previousDetailPanelModeRef = useRef<SelectionMode>('none');
  const searchStepFocusOnlyRef = useRef(false);
  const attackGraphViewModel = useMemo(() => toAttackGraphViewModel(payload), [payload]);
  const searchTokens = useMemo(() => toSearchTokens(filters.search), [filters.search]);

  const attackGraph = useMemo(() => attackGraphViewModel.graph, [attackGraphViewModel.graph]);

  const availableResourceTypes = useMemo(
    () =>
      sortAndNormalize(
        attackGraph.nodes
          .map((node) => node.resourceType)
          .filter((type) => type !== 'Unknown') as AttackGraphResourceType[],
      ),
    [attackGraph.nodes],
  );
  const availableEdgeRelations = useMemo(
    () =>
      sortAndNormalize(
        attackGraph.edges
          .map((edge) => edge.relationType)
          .filter((relation): relation is AttackGraphEdgeRelation => relation !== 'unknown'),
      ),
    [attackGraph.edges],
  );
  const availableSeverities = useMemo(
    () =>
      sortAndNormalize(
        attackGraph.nodes
          .map((node) => node.severity)
          .concat(attackGraph.paths.map((path) => path.severity ?? 'unknown'))
          .filter((severity): severity is AttackGraphRiskSeverity => severity != null),
      ),
    [attackGraph.nodes, attackGraph.paths],
  );
  const structuralFilters = useMemo(
    () => ({
      ...filters,
      search: '',
    }),
    [filters],
  );
  const filteredGraph = useMemo(
    () => filterAttackGraphElements(attackGraph, structuralFilters),
    [attackGraph, structuralFilters],
  );
  const renderedGraph = useMemo(() => filterIsolatedAttackGraphNodes(filteredGraph), [filteredGraph]);

  const searchState = useMemo(() => {
    const matchedNodeIds = new Set<string>();
    const matchedEdgeIds = new Set<string>();
    const matchedPathIds = new Set<string>();
    const contextNodeIds = new Set<string>();
    const contextEdgeIds = new Set<string>();
    const searchResults: SearchResult[] = [];

    if (searchTokens.length === 0) {
      return {
        matchedNodeIds: [] as string[],
        matchedEdgeIds: [] as string[],
        matchedPathIds: [] as string[],
        contextNodeIds: [] as string[],
        contextEdgeIds: [] as string[],
        searchResults: [] as SearchResult[],
        focusNodeId: null as string | null,
        summary: null as string | null,
      };
    }

    const matchesTokens = (searchable: string) => searchTokens.every((token) => searchable.includes(token));

    for (const node of renderedGraph.nodes) {
      const searchable = toSearchableString(
        node.id,
        node.label,
        node.resourceType,
        node.namespace,
      );

      if (matchesTokens(searchable)) {
        matchedNodeIds.add(node.id);
        searchResults.push({
          key: `node:${node.id}`,
          kind: 'node',
          id: node.id,
          label: node.label,
          focusNodeId: node.id,
        });
      }
    }

    for (const edge of renderedGraph.edges) {
      const searchable = toSearchableString(edge.id, edge.label, edge.relationType);

      if (matchesTokens(searchable)) {
        matchedEdgeIds.add(edge.id);
        contextNodeIds.add(edge.source);
        contextNodeIds.add(edge.target);
        searchResults.push({
          key: `edge:${edge.id}`,
          kind: 'edge',
          id: edge.id,
          label: edge.label ?? edge.relationType,
          focusNodeId: edge.source,
        });
      }
    }

    for (const path of renderedGraph.paths) {
      const rawPath = path.raw as Record<string, unknown>;
      const searchable = toSearchableString(
        path.id,
        path.label,
        typeof rawPath.path_id === 'string' ? rawPath.path_id : '',
      );

      if (matchesTokens(searchable)) {
        matchedPathIds.add(path.id);
        path.nodeIds.forEach((id) => matchedNodeIds.add(id));
        path.edgeIds.forEach((id) => matchedEdgeIds.add(id));
        searchResults.push({
          key: `path:${path.id}`,
          kind: 'path',
          id: path.id,
          label: path.label ?? path.id,
          focusNodeId: path.nodeIds[0] ?? null,
        });
      }
    }

    for (const edge of renderedGraph.edges) {
      if (matchedNodeIds.has(edge.source) || matchedNodeIds.has(edge.target)) {
        contextEdgeIds.add(edge.id);
        contextNodeIds.add(edge.source);
        contextNodeIds.add(edge.target);
      }
    }

    for (const path of renderedGraph.paths) {
      if (path.nodeIds.some((id) => matchedNodeIds.has(id)) || path.edgeIds.some((id) => matchedEdgeIds.has(id))) {
        path.nodeIds.forEach((id) => contextNodeIds.add(id));
        path.edgeIds.forEach((id) => contextEdgeIds.add(id));
      }
    }

    const focusNodeId =
      searchResults.find((result) => result.focusNodeId)?.focusNodeId ??
      null;

    const summary =
      matchedNodeIds.size === 0 && matchedEdgeIds.size === 0 && matchedPathIds.size === 0
        ? `라이브 그래프에서 "${filters.search?.trim()}"와 일치하는 항목이 없습니다.`
        : `노드 ${matchedNodeIds.size}개, 엣지 ${matchedEdgeIds.size}개, 경로 ${matchedPathIds.size}개가 일치합니다.`;

    return {
      matchedNodeIds: [...matchedNodeIds],
      matchedEdgeIds: [...matchedEdgeIds],
      matchedPathIds: [...matchedPathIds],
      contextNodeIds: [...contextNodeIds].filter((id) => !matchedNodeIds.has(id)),
      contextEdgeIds: [...contextEdgeIds].filter((id) => !matchedEdgeIds.has(id)),
      searchResults,
      focusNodeId,
      summary,
    };
  }, [filters.search, renderedGraph.edges, renderedGraph.nodes, renderedGraph.paths, searchTokens]);

  const attackPaths = useMemo<AttackGraphPath[]>(() => renderedGraph.paths, [renderedGraph.paths]);
  const filteredElements = useMemo(() => toAttackGraphElements(renderedGraph), [renderedGraph]);
  const hasRenderableGraph = renderedGraph.nodes.length > 0 || renderedGraph.edges.length > 0;
  const hasAttackPaths = attackPaths.length > 0;
  const visibleNodeIds = useMemo(() => new Set(renderedGraph.nodes.map((node) => node.id)), [renderedGraph.nodes]);
  const visibleEdgeIds = useMemo(() => new Set(renderedGraph.edges.map((edge) => edge.id)), [renderedGraph.edges]);
  const validPathIds = useMemo(() => new Set(attackPaths.map((path) => path.id)), [attackPaths]);
  const resolvedSelectedPathId = hasAttackPaths && selectedPathId && validPathIds.has(selectedPathId) ? selectedPathId : null;
  const resolvedSelectedNodeId = selectedNodeId && visibleNodeIds.has(selectedNodeId) ? selectedNodeId : null;
  const resolvedSelectedEdgeId = selectedEdgeId && visibleEdgeIds.has(selectedEdgeId) ? selectedEdgeId : null;
  const selectedMode: SelectionMode = resolvedSelectedNodeId
    ? 'node'
    : resolvedSelectedEdgeId
    ? 'edge'
    : resolvedSelectedPathId
    ? 'path'
    : 'none';
  const selectedPath = useMemo(
    () => attackPaths.find((path) => path.id === resolvedSelectedPathId) || null,
    [attackPaths, resolvedSelectedPathId],
  );

  const selectedPathNodeIds = selectedMode === 'path' && selectedPath ? selectedPath.nodeIds : [];
  const selectedPathEdgeIds = selectedMode === 'path' && selectedPath ? selectedPath.edgeIds : [];
  const selectedNodeLookup = useMemo(() => {
    const map = new Map<string, NodeData>();
    for (const node of attackGraph.nodes) {
      map.set(node.id, mapAttackGraphNodeToPanelNode(node));
    }
    return map;
  }, [attackGraph.nodes]);
  const selectedNodeLabelLookup = useMemo(() => {
    const map = new Map<string, string>();
    for (const node of attackGraph.nodes) {
      map.set(node.id, node.label);
    }
    return map;
  }, [attackGraph.nodes]);
  const selectedEdgeLookup = useMemo(() => {
    const map = new Map<string, EdgeData>();
    for (const edge of attackGraph.edges) {
      const rawMetadata =
        typeof edge.raw.metadata === 'object' && edge.raw.metadata !== null
          ? (edge.raw.metadata as Record<string, unknown>)
          : undefined;

      map.set(edge.id, {
        id: edge.id,
        source: edge.source,
        target: edge.target,
        relation: edge.relationType,
        label: edge.label ?? edge.relationType,
        reason: typeof rawMetadata?.reason === 'string' && rawMetadata.reason.trim() ? rawMetadata.reason : undefined,
        sourceLabel: selectedNodeLabelLookup.get(edge.source) ?? edge.source,
        targetLabel: selectedNodeLabelLookup.get(edge.target) ?? edge.target,
      });
    }
    return map;
  }, [attackGraph.edges, selectedNodeLabelLookup]);
  const attackGraphNodeLookup = useMemo(() => {
    const map = new Map<string, AttackGraphNode>();
    for (const node of attackGraph.nodes) {
      map.set(node.id, node);
    }
    return map;
  }, [attackGraph.nodes]);
  const selectedNode = resolvedSelectedNodeId ? selectedNodeLookup.get(resolvedSelectedNodeId) ?? null : null;
  const selectedEdge = resolvedSelectedEdgeId ? selectedEdgeLookup.get(resolvedSelectedEdgeId) ?? null : null;
  const shouldShowNodeDetails = selectedMode === 'node' && selectedNode;
  const shouldShowEdgeDetails = selectedMode === 'edge' && selectedEdge;
  const selectedAttackGraphNode = resolvedSelectedNodeId ? attackGraphNodeLookup.get(resolvedSelectedNodeId) ?? null : null;
  const selectedNodeDetails = useMemo(
    () => toAttackGraphDetailMap(selectedAttackGraphNode),
    [selectedAttackGraphNode],
  );
  const selectedNodeVisual = selectedAttackGraphNode
    ? getAttackGraphNodeTypeStyle(selectedAttackGraphNode.resourceType)
    : null;
  const selectedEdgeVisual = selectedEdge ? getAttackGraphEdgeVisualStyle(selectedEdge.relation) : null;
  const selectedEdgeDetails = useMemo<Record<string, AttackGraphDetailValue>>(() => {
    if (!selectedEdge) {
      return {};
    }

    const edgeDetails: Record<string, AttackGraphDetailValue> = {
      관계: selectedEdge.relation || '-',
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
  const searchNavigationKey = useMemo(
    () => `${filters.search ?? ''}::${searchState.searchResults.map((result) => result.key).join('|')}`,
    [filters.search, searchState.searchResults],
  );
  const resolvedSearchResultIndex =
    searchState.searchResults.length === 0
      ? 0
      : searchNavigationState.key === searchNavigationKey
      ? Math.min(searchNavigationState.index, searchState.searchResults.length - 1)
      : 0;
  const activeSearchResult =
    searchState.searchResults.length > 0
      ? searchState.searchResults[resolvedSearchResultIndex] ?? searchState.searchResults[0]
      : null;
  const searchNavigator = activeSearchResult
    ? {
        current: resolvedSearchResultIndex + 1,
        total: searchState.searchResults.length,
        currentLabel: `${getSearchResultKindLabel(activeSearchResult.kind)} · ${activeSearchResult.label}`,
      }
    : null;
  const focusRequestKey =
    !resolvedSelectedNodeId &&
    !resolvedSelectedEdgeId &&
    searchTokens.length > 0 &&
    (activeSearchResult?.focusNodeId ?? searchState.focusNodeId)
      ? `${searchTokens.join(':')}::${activeSearchResult?.key ?? 'search'}::${resolvedSearchResultIndex}::${
          activeSearchResult?.focusNodeId ?? searchState.focusNodeId
        }::${searchState.matchedNodeIds.length}::${searchState.matchedEdgeIds.length}`
      : null;
  const focusSearchResult = useCallback(
    (direction: 1 | -1) => {
      if (searchState.searchResults.length === 0) {
        return;
      }

      searchStepFocusOnlyRef.current = true;
      setSelectedNodeId(null);
      setSelectedEdgeId(null);
      setSelectedPathId(null);
      setSearchNavigationState((current) => {
        const total = searchState.searchResults.length;
        const currentIndex =
          current.key === searchNavigationKey ? Math.min(current.index, total - 1) : 0;

        return {
          key: searchNavigationKey,
          index: (currentIndex + direction + total) % total,
        };
      });
    },
    [searchNavigationKey, searchState.searchResults.length],
  );
  const handleGraphNodeClick = useCallback(
    (node: NodeData) => {
      searchStepFocusOnlyRef.current = false;
      const nextNodeId = node.id ? String(node.id) : null;
      setDetailPanelCollapsed(false);
      setSelectedNodeId((current) => (current === nextNodeId ? null : nextNodeId));
      setSelectedEdgeId(null);
      setSelectedPathId(null);
    },
    [],
  );
  const handleGraphEdgeClick = useCallback((edge: EdgeData) => {
    searchStepFocusOnlyRef.current = false;
    setDetailPanelCollapsed(false);
    setSelectedEdgeId(edge.id);
    setSelectedNodeId(null);
    setSelectedPathId(null);
  }, []);
  const handleSearchFocusHandled = useCallback(
    ({ found, nodeId }: { found: boolean; nodeId: string }) => {
      const isNavigatorStepFocus = searchStepFocusOnlyRef.current;
      searchStepFocusOnlyRef.current = false;

      if (!found || !nodeId || searchTokens.length === 0 || resolvedSelectedPathId) {
        return;
      }

      if (isNavigatorStepFocus) {
        return;
      }

      setSelectedPathId(null);
      setSelectedEdgeId(null);
      setDetailPanelCollapsed(false);
      setSelectedNodeId((current) => (current === nodeId ? current : nodeId));
    },
    [resolvedSelectedPathId, searchTokens.length],
  );
  const clampControlsPosition = useCallback(
    (
      nextPosition: { x: number; y: number },
      options?: {
        cardWidth?: number;
        cardHeight?: number;
        overlayWidth?: number;
        overlayHeight?: number;
      },
    ) => {
      const card = graphCardRef.current;
      const overlay = graphControlsRef.current;
      const cardWidth = options?.cardWidth ?? card?.clientWidth ?? 0;
      const cardHeight = options?.cardHeight ?? card?.clientHeight ?? 0;
      const overlayWidth = options?.overlayWidth ?? overlay?.offsetWidth ?? (controlsCollapsed ? 224 : 368);
      const overlayHeight = options?.overlayHeight ?? overlay?.offsetHeight ?? (controlsCollapsed ? 72 : 360);

      if (cardWidth <= 0 || cardHeight <= 0) {
        return nextPosition;
      }

      const maxX = Math.max(GRAPH_CONTROLS_MIN_X, cardWidth - overlayWidth - GRAPH_CONTROLS_MIN_X);
      const maxY = Math.max(GRAPH_CONTROLS_MIN_Y, cardHeight - overlayHeight - GRAPH_CONTROLS_MIN_Y);

      return {
        x: Math.min(Math.max(GRAPH_CONTROLS_MIN_X, nextPosition.x), maxX),
        y: Math.min(Math.max(GRAPH_CONTROLS_MIN_Y, nextPosition.y), maxY),
      };
    },
    [controlsCollapsed],
  );
  const detailPanelMode: SelectionMode =
    shouldShowNodeDetails ? 'node' : shouldShowEdgeDetails ? 'edge' : 'none';
  const clampDetailPanelPosition = useCallback(
    (
      nextPosition: { x: number; y: number },
      options?: {
        cardWidth?: number;
        cardHeight?: number;
        overlayWidth?: number;
        overlayHeight?: number;
      },
    ) => {
      const card = graphCardRef.current;
      const overlay = detailPanelRef.current;
      const cardWidth = options?.cardWidth ?? card?.clientWidth ?? 0;
      const cardHeight = options?.cardHeight ?? card?.clientHeight ?? 0;
      const overlayWidth =
        options?.overlayWidth ??
        overlay?.offsetWidth ??
        (detailPanelCollapsed ? DETAIL_PANEL_COLLAPSED_WIDTH : DETAIL_PANEL_EXPANDED_WIDTH);
      const overlayHeight =
        options?.overlayHeight ??
        overlay?.offsetHeight ??
        (detailPanelCollapsed ? DETAIL_PANEL_COLLAPSED_HEIGHT : DETAIL_PANEL_EXPANDED_HEIGHT);

      if (cardWidth <= 0 || cardHeight <= 0) {
        return nextPosition;
      }

      const maxX = Math.max(DETAIL_PANEL_MIN_X, cardWidth - overlayWidth - DETAIL_PANEL_MIN_X);
      const maxY = Math.max(DETAIL_PANEL_MIN_Y, cardHeight - overlayHeight - DETAIL_PANEL_MIN_Y);

      return {
        x: Math.min(Math.max(DETAIL_PANEL_MIN_X, nextPosition.x), maxX),
        y: Math.min(Math.max(DETAIL_PANEL_MIN_Y, nextPosition.y), maxY),
      };
    },
    [detailPanelCollapsed],
  );

  useEffect(() => {
    controlsPositionRef.current = controlsPosition;
  }, [controlsPosition]);

  useEffect(() => {
    detailPanelPositionRef.current = detailPanelPosition;
  }, [detailPanelPosition]);

  useEffect(() => {
    const card = graphCardRef.current;
    if (!card) {
      return;
    }

    const updateOverlayBounds = () => {
      const overlay = graphControlsRef.current;
      const cardWidth = card.clientWidth;
      const cardHeight = card.clientHeight;
      const overlayWidth = overlay?.offsetWidth ?? (controlsCollapsed ? 224 : 368);
      const overlayHeight = overlay?.offsetHeight ?? (controlsCollapsed ? 72 : 360);
      const clamped = clampControlsPosition(controlsPositionRef.current, {
        cardWidth,
        cardHeight,
        overlayWidth,
        overlayHeight,
      });

      setControlsPosition((current) =>
        current.x === clamped.x && current.y === clamped.y ? current : clamped,
      );
      setControlsMaxHeight(Math.max(208, cardHeight - clamped.y - GRAPH_CONTROLS_MIN_Y));
    };

    updateOverlayBounds();

    const observer = new ResizeObserver(() => {
      updateOverlayBounds();
    });

    observer.observe(card);
    if (graphControlsRef.current) {
      observer.observe(graphControlsRef.current);
    }

    return () => {
      observer.disconnect();
    };
  }, [clampControlsPosition, controlsCollapsed]);

  useEffect(() => {
    const card = graphCardRef.current;
    if (!card) {
      return;
    }

    setControlsMaxHeight(Math.max(208, card.clientHeight - controlsPosition.y - GRAPH_CONTROLS_MIN_Y));
  }, [controlsPosition.y]);

  useEffect(() => {
    const previousMode = previousDetailPanelModeRef.current;
    previousDetailPanelModeRef.current = detailPanelMode;

    if (detailPanelMode === 'none') {
      return;
    }

    if (previousMode !== 'none') {
      return;
    }

    const card = graphCardRef.current;
    const overlay = detailPanelRef.current;
    if (!card) {
      return;
    }

    const overlayWidth = overlay?.offsetWidth ?? DETAIL_PANEL_EXPANDED_WIDTH;
    const overlayHeight = overlay?.offsetHeight ?? DETAIL_PANEL_EXPANDED_HEIGHT;
    const next = clampDetailPanelPosition(
      {
        x: card.clientWidth - overlayWidth - DETAIL_PANEL_DEFAULT_RIGHT_MARGIN,
        y: DETAIL_PANEL_DEFAULT_TOP,
      },
      {
        cardWidth: card.clientWidth,
        cardHeight: card.clientHeight,
        overlayWidth,
        overlayHeight,
      },
    );

    setDetailPanelPosition(next);
  }, [clampDetailPanelPosition, detailPanelMode]);

  useEffect(() => {
    if (detailPanelMode === 'none') {
      return;
    }

    const card = graphCardRef.current;
    if (!card) {
      return;
    }

    const updateOverlayBounds = () => {
      const overlay = detailPanelRef.current;
      const cardWidth = card.clientWidth;
      const cardHeight = card.clientHeight;
      const overlayWidth =
        overlay?.offsetWidth ??
        (detailPanelCollapsed ? DETAIL_PANEL_COLLAPSED_WIDTH : DETAIL_PANEL_EXPANDED_WIDTH);
      const overlayHeight =
        overlay?.offsetHeight ??
        (detailPanelCollapsed ? DETAIL_PANEL_COLLAPSED_HEIGHT : DETAIL_PANEL_EXPANDED_HEIGHT);
      const clamped = clampDetailPanelPosition(detailPanelPositionRef.current, {
        cardWidth,
        cardHeight,
        overlayWidth,
        overlayHeight,
      });

      setDetailPanelPosition((current) =>
        current.x === clamped.x && current.y === clamped.y ? current : clamped,
      );
      setDetailPanelMaxHeight(Math.max(120, cardHeight - clamped.y - DETAIL_PANEL_MIN_Y));
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
  }, [clampDetailPanelPosition, detailPanelCollapsed, detailPanelMode]);

  useEffect(() => {
    if (detailPanelMode === 'none') {
      return;
    }

    const card = graphCardRef.current;
    if (!card) {
      return;
    }

    setDetailPanelMaxHeight(Math.max(120, card.clientHeight - detailPanelPosition.y - DETAIL_PANEL_MIN_Y));
  }, [detailPanelMode, detailPanelPosition.y]);

  useEffect(() => {
    const handleMouseMove = (event: MouseEvent) => {
      const card = graphCardRef.current;
      const dragOffset = dragOffsetRef.current;
      const detailDragOffset = detailPanelDragOffsetRef.current;
      if (!card || (!dragOffset && !detailDragOffset)) {
        return;
      }

      const rect = card.getBoundingClientRect();

      if (dragOffset) {
        const next = clampControlsPosition({
          x: event.clientX - rect.left - dragOffset.x,
          y: event.clientY - rect.top - dragOffset.y,
        });

        setControlsPosition(next);
      }

      if (detailDragOffset) {
        const next = clampDetailPanelPosition({
          x: event.clientX - rect.left - detailDragOffset.x,
          y: event.clientY - rect.top - detailDragOffset.y,
        });

        setDetailPanelPosition(next);
      }
    };

    const handleMouseUp = () => {
      dragOffsetRef.current = null;
      detailPanelDragOffsetRef.current = null;
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [clampControlsPosition, clampDetailPanelPosition]);

  const handleControlsDragStart = useCallback<React.MouseEventHandler<HTMLDivElement>>((event) => {
    if (event.button !== 0) {
      return;
    }

    const card = graphCardRef.current;
    if (!card) {
      return;
    }

    const rect = card.getBoundingClientRect();
    dragOffsetRef.current = {
      x: event.clientX - rect.left - controlsPosition.x,
      y: event.clientY - rect.top - controlsPosition.y,
    };
    event.preventDefault();
  }, [controlsPosition.x, controlsPosition.y]);
  const handleDetailPanelDragStart = useCallback<React.MouseEventHandler<HTMLDivElement>>((event) => {
    if (event.button !== 0) {
      return;
    }

    const card = graphCardRef.current;
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

  return (
    <>
      {liveSummary || typeof liveEvidenceCount === 'number' ? (
        <div className="card border-0 shadow-sm mb-1">
          <div className="card-body py-1 px-2 d-flex flex-wrap gap-3 align-items-center small">
            {liveSummary ? (
              <span className="text-muted">
                요약: <strong className="text-dark">{liveSummary}</strong>
              </span>
            ) : null}
            {typeof liveEvidenceCount === 'number' ? (
              <span className="text-muted">
                증거 수: <strong className="text-dark">{liveEvidenceCount}</strong>
              </span>
            ) : null}
          </div>
        </div>
      ) : null}

      <div
        className="card border-0 shadow-sm dg-attack-graph-canvas-card"
        style={{ position: 'relative', overflow: 'visible' }}
        ref={graphCardRef}
      >
        <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
          {hasRenderableGraph ? (
            <Suspense fallback={<PageLoader label="공격 그래프를 준비하는 중..." minHeight="100%" compact />}>
              <GraphView
                showLabels={renderedGraph.nodes.length + renderedGraph.edges.length <= LARGE_GRAPH_THRESHOLD}
                elements={filteredElements}
                layout={attackGraphDefaultLayout}
                focusNodeId={!resolvedSelectedNodeId && !resolvedSelectedEdgeId ? activeSearchResult?.focusNodeId ?? searchState.focusNodeId : null}
                focusRequestKey={focusRequestKey}
                onFocusHandled={handleSearchFocusHandled}
                selectedPathNodeIds={selectedPathNodeIds}
                selectedPathEdgeIds={selectedPathEdgeIds}
                selectedNodeId={resolvedSelectedNodeId}
                selectedEdgeId={resolvedSelectedEdgeId}
                searchMatchedNodeIds={searchState.matchedNodeIds}
                searchMatchedEdgeIds={searchState.matchedEdgeIds}
                searchContextNodeIds={searchState.contextNodeIds}
                searchContextEdgeIds={searchState.contextEdgeIds}
                onNodeClick={handleGraphNodeClick}
                onEdgeClick={handleGraphEdgeClick}
              />
            </Suspense>
          ) : (
            <div className="d-flex flex-column justify-content-center align-items-center h-100 text-center px-4">
              <strong className="mb-2">{emptyStateTitle}</strong>
              <p className="text-muted mb-0 small">{emptyStateBody}</p>
            </div>
          )}
        </div>
        <div
          className="dg-attack-graph-controls-overlay"
          ref={graphControlsRef}
          style={{
            left: controlsPosition.x,
            top: controlsPosition.y,
          }}
        >
          <GraphFilters
            filters={filters}
            availableResourceTypes={availableResourceTypes}
            availableEdgeRelations={availableEdgeRelations}
            availableSeverities={availableSeverities}
            onFiltersChange={onFiltersChange}
            searchSummary={searchState.summary}
            searchNavigator={searchNavigator}
            onPreviousSearchResult={() => focusSearchResult(-1)}
            onNextSearchResult={() => focusSearchResult(1)}
            collapsed={controlsCollapsed}
            onToggleCollapsed={() => setControlsCollapsed((current) => !current)}
            onDragHandleMouseDown={handleControlsDragStart}
            bodyMaxHeight={controlsMaxHeight}
          />
        </div>
        {shouldShowNodeDetails ? (
          <div
            ref={detailPanelRef}
            style={{
              position: 'absolute',
              left: detailPanelPosition.x,
              top: detailPanelPosition.y,
              zIndex: 13,
              display: 'flex',
              minHeight: 0,
            }}
          >
            <NodeDetailPanel
              node={selectedNode}
              onClose={() => {
                setDetailPanelCollapsed(false);
                setSelectedNodeId(null);
              }}
              tone="dark"
              collapsed={detailPanelCollapsed}
              onToggleCollapsed={() => setDetailPanelCollapsed((current) => !current)}
              onDragHandleMouseDown={handleDetailPanelDragStart}
              panelTitle="노드 상세 정보"
              panelDescription="선택한 노드의 세부 정보입니다."
              accentColor={selectedNodeVisual?.backgroundColor}
              icon={selectedAttackGraphNode ? ATTACK_GRAPH_RESOURCE_ICONS[selectedAttackGraphNode.resourceType] : undefined}
              typeLabel={selectedAttackGraphNode?.resourceType}
              details={selectedNodeDetails}
              style={{
                position: 'relative',
                top: 0,
                right: 0,
                maxHeight: detailPanelMaxHeight ? `${detailPanelMaxHeight}px` : 'calc(100vh - 7rem)',
              }}
            />
          </div>
        ) : null}
        {shouldShowEdgeDetails ? (
          <div
            ref={detailPanelRef}
            style={{
              position: 'absolute',
              left: detailPanelPosition.x,
              top: detailPanelPosition.y,
              zIndex: 13,
              display: 'flex',
              minHeight: 0,
            }}
          >
            <NodeDetailPanel
              node={selectedEdgePanelNode}
              onClose={() => {
                setDetailPanelCollapsed(false);
                setSelectedEdgeId(null);
              }}
              tone="dark"
              collapsed={detailPanelCollapsed}
              onToggleCollapsed={() => setDetailPanelCollapsed((current) => !current)}
              onDragHandleMouseDown={handleDetailPanelDragStart}
              panelTitle="엣지 상세 정보"
              panelDescription="선택한 엣지의 세부 정보입니다."
              subjectLabel={selectedEdge?.relation || selectedEdge?.label || selectedEdge?.id}
              accentColor={selectedEdgeVisual?.lineColor ?? '#93c5fd'}
              icon="↗"
              typeLabel="관계"
              details={selectedEdgeDetails}
              style={{
                position: 'relative',
                top: 0,
                right: 0,
                maxHeight: detailPanelMaxHeight ? `${detailPanelMaxHeight}px` : 'calc(100vh - 7rem)',
              }}
            />
          </div>
        ) : null}
      </div>

      <div className="mt-2 d-flex gap-3 flex-wrap">
        <span className="text-muted small">
          <strong>{filteredGraph.nodes.length}</strong>개 노드 / <strong>{filteredGraph.edges.length}</strong>개 엣지
        </span>
        {searchTokens.length > 0 ? (
          <span className="text-muted small">
            검색:
            <strong>{` 노드 ${searchState.matchedNodeIds.length}개 / 엣지 ${searchState.matchedEdgeIds.length}개 / 경로 ${searchState.matchedPathIds.length}개`}</strong>
          </span>
        ) : null}
        <span className="text-muted small">
          모드: <strong>{getSelectionModeLabel(selectedMode)}</strong>
          {selectedMode === 'node' && selectedNode ? ` / 노드 ${selectedNode.label}` : null}
          {selectedMode === 'edge' && selectedEdge ? ` / 엣지 ${selectedEdge.id}` : null}
          {selectedMode === 'path' && selectedPath ? ` / 경로 ${selectedPath.label || selectedPath.id}` : null}
        </span>
      </div>
    </>
  );
};

const AttackGraphPage: React.FC = () => {
  const { clusterId: routeClusterId = '' } = useParams();
  const [activeTab, setActiveTab] = useState<AttackGraphInnerTab>('graph');
  const [liveFilters, setLiveFilters] = useState<AttackGraphFilters>({});
  const [selectedClusterId, setSelectedClusterId] = useState(routeClusterId);

  const {
    data: clustersResponse,
    isLoading: isClustersLoading,
    isError: isClustersError,
    error: clustersError,
  } = useListClustersApiV1ClustersGet();
  const clusters = useMemo(
    () =>
      (Array.isArray(clustersResponse) ? clustersResponse : []).map((cluster) => ({
        id: cluster.id,
        name: cluster.name,
      })),
    [clustersResponse],
  );

  const activeClusterId =
    (routeClusterId && clusters.some((cluster) => cluster.id === routeClusterId)
      ? routeClusterId
      : selectedClusterId && clusters.some((cluster) => cluster.id === selectedClusterId)
      ? selectedClusterId
      : clusters[0]?.id) ?? '';

  const {
    data: liveAttackGraphResponse,
    isLoading: isLiveGraphLoading,
    isError: isLiveGraphError,
    error: liveGraphError,
  } = useGetClusterAttackGraph(activeClusterId, {
    query: {
      enabled: Boolean(activeClusterId),
      retry: false,
    },
  });

  const livePayload = coerceAttackGraphApiResponse(liveAttackGraphResponse);
  const shouldLoadAttackPaths = activeTab === 'attack-paths' && Boolean(activeClusterId);

  return (
    <div>
      <style>{`
        .dg-attack-graph-page {
          --dg-attack-graph-canvas-height: clamp(29rem, calc(100vh - 16rem), 40rem);
        }
        .dg-attack-graph-page .dg-attack-graph-canvas-card {
          height: var(--dg-attack-graph-canvas-height);
          background:
            radial-gradient(circle at top left, rgba(37, 99, 235, 0.16), transparent 28%),
            radial-gradient(circle at bottom right, rgba(6, 182, 212, 0.12), transparent 34%),
            linear-gradient(180deg, rgba(10, 20, 40, 0.98) 0%, rgba(8, 15, 32, 0.98) 100%);
          border: 1px solid rgba(96, 165, 250, 0.08);
        }
        .dg-attack-graph-page .dg-attack-graph-controls-overlay {
          position: absolute;
          z-index: 12;
          max-width: min(25rem, calc(100% - 24px));
        }
        .dg-attack-graph-page .dg-attack-graph-canvas-card .card-body {
          background: transparent;
        }
        .dg-attack-graph-page .form-control::placeholder {
          color: #6b7d99;
        }
        @media (max-width: 991.98px) {
          .dg-attack-graph-page {
            --dg-attack-graph-canvas-height: 34rem;
          }
        }
        @media (max-width: 767.98px) {
          .dg-attack-graph-page {
            --dg-attack-graph-canvas-height: 30rem;
          }
          .dg-attack-graph-page .dg-attack-graph-controls-overlay {
            max-width: calc(100% - 24px);
          }
        }
      `}</style>
      <div className="dg-attack-graph-page dg-page-shell">
      <div className="dg-page-header">
        <div className="dg-page-heading">
          <h1 className="dg-page-title">공격 그래프</h1>
          <p className="dg-page-description">선택한 클러스터의 연결 자산과 저장된 공격 경로를 확인합니다.</p>
        </div>
      </div>

      <div className="card border-0 shadow-sm mb-3">
        <div className="card-body py-1 px-2 d-flex flex-wrap gap-3 justify-content-between align-items-end">
          <ul className="nav nav-tabs mb-0 flex-shrink-0">
            <li className="nav-item">
              <button
                type="button"
                className={`nav-link ${activeTab === 'graph' ? 'active' : ''}`}
                onClick={() => setActiveTab('graph')}
              >
                그래프
              </button>
            </li>
            <li className="nav-item">
              <button
                type="button"
                className={`nav-link ${activeTab === 'attack-paths' ? 'active' : ''}`}
                onClick={() => setActiveTab('attack-paths')}
              >
                공격 경로
              </button>
            </li>
          </ul>

          <div className="d-flex align-items-center gap-2 ms-auto">
            <span className="text-muted small text-nowrap">클러스터</span>
            <select
              id="attack-graph-cluster-select"
              className="form-select form-select-sm"
              style={{ minWidth: 320 }}
              value={activeClusterId}
              onChange={(event) => {
                setSelectedClusterId(event.target.value);
                setLiveFilters({});
              }}
              disabled={isClustersLoading || clusters.length === 0}
            >
              {clusters.length === 0 ? (
                <option value="">사용 가능한 클러스터가 없습니다</option>
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
      </div>
      {isClustersError ? (
        <div className="alert alert-danger mb-1" role="alert">
          {toErrorMessage(clustersError, '공격 그래프용 클러스터를 불러오지 못했습니다.')}
        </div>
      ) : null}
      {activeTab === 'graph' ? (
        <AttackGraphContent
          payload={livePayload}
          filters={liveFilters}
          onFiltersChange={setLiveFilters}
          liveSummary={livePayload.summary ?? null}
          liveEvidenceCount={livePayload.evidence_count ?? null}
          emptyStateTitle={
            isClustersLoading
              ? '공격 그래프를 불러오는 중입니다...'
              : !activeClusterId
                ? '선택된 클러스터가 없습니다.'
                : isLiveGraphError
                  ? '공격 그래프를 사용할 수 없습니다.'
                  : '공격 그래프 데이터가 없습니다.'
          }
          emptyStateBody={
            isClustersLoading
              ? '공격 그래프용 클러스터 목록을 불러오는 중입니다.'
              : !activeClusterId
                ? '클러스터를 선택하면 /api/v1/clusters/{cluster_id}/attack-graph 를 요청합니다.'
                : isLiveGraphLoading
                  ? '백엔드에서 그래프 데이터를 불러오는 중입니다.'
                  : isLiveGraphError
                    ? toErrorMessage(liveGraphError, '공격 그래프 요청에 실패했습니다.')
                    : '선택한 클러스터에 대해 백엔드가 노드 또는 엣지를 반환하지 않았습니다.'
          }
        />
      ) : null}
      {activeTab === 'attack-paths' ? (
        <AttackPathsPanel clusterId={activeClusterId} enabled={shouldLoadAttackPaths} />
      ) : null}

      {/* TODO Step5: cleanup of temporary compatibility bridges (legacy NodeData contracts remain in place) */}
      </div>
    </div>
  );
};

export default AttackGraphPage;
