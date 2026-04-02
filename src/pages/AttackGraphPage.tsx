import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import NodeDetailPanel from '../components/graph/NodeDetailPanel';
import GraphFilters from '../components/graph/GraphFilters';
import type { NodeData, NodeType } from '../components/graph/mockGraphData';
import PageLoader from '../components/layout/PageLoader';
import {
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
  getRiskLevelRowTint,
  getRiskSortOrder,
  NodeTypeBadge,
  parseAttackPathNode,
  RiskLevelBadge,
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
const ALLOWED_ATTACK_GRAPH_CLUSTER_LABELS = ['dg-eks-demo', 'k8s+image scanner'] as const;
const ALLOWED_ATTACK_GRAPH_CLUSTER_SET = new Set<string>(ALLOWED_ATTACK_GRAPH_CLUSTER_LABELS);

type SelectionMode = 'none' | 'path' | 'node' | 'edge';
type AttackGraphInnerTab = 'graph' | 'attack-paths';

const resolveAttackGraphInnerTab = (rawTab: string | null): AttackGraphInnerTab =>
  rawTab === 'attack-paths' ? 'attack-paths' : 'graph';
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

const normalizeSearchParam = (value?: string | null) => {
  const normalized = value?.trim();
  return normalized ? normalized : null;
};

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

const getAttackGraphControlsAnchorX = () => Math.max(GRAPH_CONTROLS_MIN_X, GRAPH_CONTROLS_DEFAULT_POSITION.x);

const getAttackGraphDetailAnchorX = (cardWidth: number, overlayWidth: number) =>
  Math.max(DETAIL_PANEL_MIN_X, cardWidth - overlayWidth - DETAIL_PANEL_DEFAULT_RIGHT_MARGIN);

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
  selectedPathIdFromUrl?: string | null;
  highlightName?: string | null;
  onClearHighlight?: () => void;
  emptyStateTitle?: string;
  emptyStateBody?: string;
  liveSummary?: string | null;
  liveEvidenceCount?: number | null;
}

const formatRiskScoreDisplay = (value?: number | null) => {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return '-';
  }

  return value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
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

const getAttackPathHopCount = (item: AttackPathListItemResponse) => item.hop_count ?? item.node_ids?.length ?? 0;

type SortDirection = 'asc' | 'desc';

const compareNumbersByDirection = (left: number, right: number, direction: SortDirection) =>
  direction === 'desc' ? right - left : left - right;

const compareRiskSeverityByDirection = (
  leftRiskLevel: AttackPathListItemResponse['risk_level'],
  rightRiskLevel: AttackPathListItemResponse['risk_level'],
  direction: SortDirection,
) => {
  const gap = getRiskSortOrder(leftRiskLevel) - getRiskSortOrder(rightRiskLevel);
  return direction === 'desc' ? gap : -gap;
};

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

const AttackPathsPanel: React.FC<{
  clusterId: string;
  enabled: boolean;
}> = ({ clusterId, enabled }) => {
  const stickyHeaderCellStyle: React.CSSProperties = {
    position: 'sticky',
    top: 0,
    zIndex: 2,
    background: 'rgba(17, 24, 39, 0.96)',
    boxShadow: 'inset 0 -1px 0 rgba(148, 163, 184, 0.18), 0 10px 20px rgba(2, 6, 23, 0.2)',
    backdropFilter: 'blur(10px)',
    verticalAlign: 'middle',
  };
  const [riskScoreSortDirection, setRiskScoreSortDirection] = useState<SortDirection>('desc');
  const [hopCountSortDirection, setHopCountSortDirection] = useState<SortDirection>('asc');
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
        const scoreGap = compareNumbersByDirection(leftScore, rightScore, riskScoreSortDirection);
        if (scoreGap !== 0) {
          return scoreGap;
        }

        const leftHopCount = getAttackPathHopCount(left);
        const rightHopCount = getAttackPathHopCount(right);
        const hopGap = compareNumbersByDirection(leftHopCount, rightHopCount, hopCountSortDirection);
        if (hopGap !== 0) {
          return hopGap;
        }

        const riskGap = compareRiskSeverityByDirection(left.risk_level, right.risk_level, riskScoreSortDirection);
        if (riskGap !== 0) {
          return riskGap;
        }

        return left.path_id.localeCompare(right.path_id);
      }),
    [data, hopCountSortDirection, riskScoreSortDirection],
  );

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
            <div className="d-flex flex-wrap align-items-center gap-2">
              <h2 className="h5 mb-0">탐지된 공격 경로</h2>
              <span className="text-muted small">{items.length}개 경로</span>
            </div>
          </div>
          <div
            className="table-responsive"
            style={{
              maxHeight: 'clamp(18rem, calc(100vh - 20rem), 32rem)',
              overflow: 'auto',
              overscrollBehavior: 'contain',
            }}
          >
            <table className="table align-middle mb-0 small dg-attack-paths-table">
              <thead className="table-light">
                <tr>
                  <th
                    style={{ ...stickyHeaderCellStyle, width: 120 }}
                    aria-sort={riskScoreSortDirection === 'desc' ? 'descending' : 'ascending'}
                  >
                    <button
                      type="button"
                      className="dg-table-sort-button"
                      onClick={() =>
                        setRiskScoreSortDirection((current) => (current === 'desc' ? 'asc' : 'desc'))
                      }
                      aria-label={`위험도 점수 기준 현재 ${riskScoreSortDirection === 'desc' ? '내림차순' : '오름차순'} 정렬. 같은 점수는 단계 ${hopCountSortDirection === 'desc' ? '내림차순' : '오름차순'} 후 위험 등급 순으로 정렬됩니다.`}
                    >
                      <span>위험도 점수</span>
                      <span className="dg-table-sort-indicator" aria-hidden="true">
                        {riskScoreSortDirection === 'desc' ? '↓' : '↑'}
                      </span>
                    </button>
                  </th>
                  <th style={stickyHeaderCellStyle}>위험</th>
                  <th style={stickyHeaderCellStyle}>시작 노드</th>
                  <th style={stickyHeaderCellStyle}>목표 자산</th>
                  <th
                    style={{ ...stickyHeaderCellStyle, width: 72 }}
                    aria-sort={hopCountSortDirection === 'desc' ? 'descending' : 'ascending'}
                  >
                    <button
                      type="button"
                      className="dg-table-sort-button"
                      onClick={() =>
                        setHopCountSortDirection((current) => (current === 'desc' ? 'asc' : 'desc'))
                      }
                      aria-label={`단계 기준 현재 ${hopCountSortDirection === 'desc' ? '내림차순' : '오름차순'} 보조 정렬. 위험도 점수가 같은 경로에만 적용됩니다.`}
                    >
                      <span>단계</span>
                      <span className="dg-table-sort-indicator" aria-hidden="true">
                        {hopCountSortDirection === 'desc' ? '↓' : '↑'}
                      </span>
                    </button>
                  </th>
                  <th style={stickyHeaderCellStyle}>상세</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => {
                  const entryNode = parseAttackPathNode(item.entry_node_id);
                  const targetNode = parseAttackPathNode(item.target_node_id);
                  const hopCount = getAttackPathHopCount(item);
                  const riskScore = getAttackPathRiskScore(item);
                  const threatAccent = getThreatAccentBorder(item.target_node_id);
                  const semanticRowTint = getRiskLevelRowTint(item.risk_level);

                  return (
                    <tr
                      key={item.path_id}
                      className="dg-attack-path-row"
                      style={{
                        backgroundColor: semanticRowTint,
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
                        {formatRiskScoreDisplay(riskScore)}
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
                        >
                          상세 보기
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
    </>
  );
};

const AttackGraphContent: React.FC<AttackGraphContentProps> = ({
  payload,
  filters,
  onFiltersChange,
  selectedPathIdFromUrl,
  highlightName,
  onClearHighlight,
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
  const [controlsCollapsed, setControlsCollapsed] = useState(true);
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
  const effectiveSearchTerm = highlightName?.trim() || filters.search || '';
  const searchTokens = useMemo(() => toSearchTokens(effectiveSearchTerm), [effectiveSearchTerm]);

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
        ? `라이브 그래프에서 "${effectiveSearchTerm}"와 일치하는 항목이 없습니다.`
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
  }, [effectiveSearchTerm, renderedGraph.edges, renderedGraph.nodes, renderedGraph.paths, searchTokens]);

  const attackPaths = useMemo<AttackGraphPath[]>(() => renderedGraph.paths, [renderedGraph.paths]);
  const filteredElements = useMemo(() => toAttackGraphElements(renderedGraph), [renderedGraph]);
  const hasRenderableGraph = renderedGraph.nodes.length > 0 || renderedGraph.edges.length > 0;
  const hasAttackPaths = attackPaths.length > 0;
  const requestedSelectedPathId = normalizeSearchParam(selectedPathIdFromUrl);
  const visibleNodeIds = useMemo(() => new Set(renderedGraph.nodes.map((node) => node.id)), [renderedGraph.nodes]);
  const visibleEdgeIds = useMemo(() => new Set(renderedGraph.edges.map((edge) => edge.id)), [renderedGraph.edges]);
  const resolvedAttackPathIds = useMemo(() => {
    const map = new Map<string, string>();

    for (const path of attackPaths) {
      map.set(path.id, path.id);

      const rawPathId =
        typeof path.raw.path_id === 'string' && path.raw.path_id.trim() ? path.raw.path_id.trim() : null;

      if (rawPathId) {
        map.set(rawPathId, path.id);
      }
    }

    return map;
  }, [attackPaths]);
  const resolvedUrlSelectedPathId =
    hasAttackPaths && requestedSelectedPathId
      ? resolvedAttackPathIds.get(requestedSelectedPathId) ?? null
      : null;
  const resolvedLocalSelectedPathId =
    hasAttackPaths && selectedPathId ? resolvedAttackPathIds.get(selectedPathId) ?? null : null;
  const resolvedSelectedPathId = resolvedUrlSelectedPathId ?? resolvedLocalSelectedPathId;
  const resolvedSelectedNodeId =
    resolvedUrlSelectedPathId || !selectedNodeId || !visibleNodeIds.has(selectedNodeId) ? null : selectedNodeId;
  const resolvedSelectedEdgeId =
    resolvedUrlSelectedPathId || !selectedEdgeId || !visibleEdgeIds.has(selectedEdgeId) ? null : selectedEdgeId;
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
    () => `${effectiveSearchTerm}::${searchState.searchResults.map((result) => result.key).join('|')}`,
    [effectiveSearchTerm, searchState.searchResults],
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
      onClearHighlight?.();
      searchStepFocusOnlyRef.current = false;
      const nextNodeId = node.id ? String(node.id) : null;
      setDetailPanelCollapsed(false);
      setSelectedNodeId((current) => (current === nextNodeId ? null : nextNodeId));
      setSelectedEdgeId(null);
      setSelectedPathId(null);
    },
    [onClearHighlight],
  );
  const handleGraphEdgeClick = useCallback((edge: EdgeData) => {
    onClearHighlight?.();
    searchStepFocusOnlyRef.current = false;
    setDetailPanelCollapsed(false);
    setSelectedEdgeId(edge.id);
    setSelectedNodeId(null);
    setSelectedPathId(null);
  }, [onClearHighlight]);
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

      if (highlightName) {
        return;
      }

      setSelectedPathId(null);
      setSelectedEdgeId(null);
      setDetailPanelCollapsed(false);
      setSelectedNodeId((current) => (current === nodeId ? current : nodeId));
    },
    [highlightName, resolvedSelectedPathId, searchTokens.length],
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
      const overlayHeight = options?.overlayHeight ?? overlay?.offsetHeight ?? (controlsCollapsed ? 72 : 360);

      if (cardWidth <= 0 || cardHeight <= 0) {
        return nextPosition;
      }

      const anchoredX = getAttackGraphControlsAnchorX();
      const maxY = Math.max(GRAPH_CONTROLS_MIN_Y, cardHeight - overlayHeight - GRAPH_CONTROLS_MIN_Y);

      return {
        x: anchoredX,
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

      const anchoredX = getAttackGraphDetailAnchorX(cardWidth, overlayWidth);
      const maxY = Math.max(DETAIL_PANEL_MIN_Y, cardHeight - overlayHeight - DETAIL_PANEL_MIN_Y);

      return {
        x: anchoredX,
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
        x: getAttackGraphDetailAnchorX(card.clientWidth, overlayWidth),
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
                onCanvasClick={onClearHighlight}
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
  const [searchParams, setSearchParams] = useSearchParams();
  const [liveFilters, setLiveFilters] = useState<AttackGraphFilters>({});
  const [selectedClusterId, setSelectedClusterId] = useState(routeClusterId);
  const activeTab = resolveAttackGraphInnerTab(searchParams.get('tab'));
  const selectedPathIdFromUrl = searchParams.get('selectedPathId');
  const highlightName = searchParams.get('highlight');
  const handleTabChange = useCallback((nextTab: AttackGraphInnerTab) => {
    const nextParams = new URLSearchParams(searchParams);
    if (nextTab === 'attack-paths') {
      nextParams.set('tab', 'attack-paths');
    } else {
      nextParams.delete('tab');
    }
    setSearchParams(nextParams, { replace: true });
  }, [searchParams, setSearchParams]);
  const clearHighlight = useCallback(() => {
    if (!searchParams.has('highlight')) {
      return;
    }
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete('highlight');
    setSearchParams(nextParams, { replace: true });
  }, [searchParams, setSearchParams]);

  const {
    data: clustersResponse,
    isLoading: isClustersLoading,
    isError: isClustersError,
    error: clustersError,
  } = useListClustersApiV1ClustersGet();
  const clusters = useMemo(
    () =>
      (Array.isArray(clustersResponse) ? clustersResponse : [])
        .filter((cluster) => {
          const clusterId = typeof cluster.id === 'string' ? cluster.id.trim() : '';
          const clusterName = typeof cluster.name === 'string' ? cluster.name.trim() : '';

          return (
            ALLOWED_ATTACK_GRAPH_CLUSTER_SET.has(clusterId) ||
            ALLOWED_ATTACK_GRAPH_CLUSTER_SET.has(clusterName)
          );
        })
        .map((cluster) => {
          const clusterId = cluster.id.trim();
          const clusterName = cluster.name.trim();
          const displayName =
            ALLOWED_ATTACK_GRAPH_CLUSTER_SET.has(clusterName)
              ? clusterName
              : ALLOWED_ATTACK_GRAPH_CLUSTER_SET.has(clusterId)
              ? clusterId
              : cluster.name;

          return {
            id: clusterId,
            name: displayName,
          };
        }),
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
                onClick={() => handleTabChange('graph')}
              >
                그래프
              </button>
            </li>
            <li className="nav-item">
              <button
                type="button"
                className={`nav-link ${activeTab === 'attack-paths' ? 'active' : ''}`}
                onClick={() => handleTabChange('attack-paths')}
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
          selectedPathIdFromUrl={selectedPathIdFromUrl}
          highlightName={highlightName}
          onClearHighlight={clearHighlight}
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
