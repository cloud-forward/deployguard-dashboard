import React, { Suspense, useEffect, useMemo, useState } from 'react';
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

const GraphView = React.lazy(() => import('../components/graph/GraphView'));

const LARGE_GRAPH_THRESHOLD = 180;
const EMPTY_ATTACK_GRAPH: AttackGraphApiResponse = {
  nodes: [],
  edges: [],
  paths: [],
};

type SelectionMode = 'none' | 'path' | 'node' | 'edge';
type AttackGraphInnerTab = 'graph' | 'attack-paths';

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

const formatTruncatedPathId = (pathId: string) => {
  if (pathId.length <= 20) {
    return pathId;
  }

  return `${pathId.slice(0, 20)}...`;
};

const OrderedValueList: React.FC<{
  title: string;
  items?: string[];
  emptyLabel: string;
}> = ({ title, items, emptyLabel }) => {
  const values = Array.isArray(items) ? items.filter((item) => typeof item === 'string' && item.trim()) : [];

  return (
    <div>
      <h3 className="h6 mb-2">{title}</h3>
      {values.length === 0 ? (
        <div className="text-muted small">{emptyLabel}</div>
      ) : (
        <ol className="mb-0 ps-3 small">
          {values.map((item) => (
            <li key={item} className="mb-1 text-break">
              {item}
            </li>
          ))}
        </ol>
      )}
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

  return (
    <>
      <button
        type="button"
        aria-label="Close attack path detail panel"
        className="border-0"
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, background: 'rgba(2, 6, 23, 0.45)', zIndex: 1040 }}
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
          background: '#0f172a',
          borderLeft: '1px solid rgba(148, 163, 184, 0.18)',
          boxShadow: '-18px 0 50px rgba(15, 23, 42, 0.4)',
        }}
      >
        <div className="p-4 border-bottom d-flex justify-content-between align-items-start gap-3">
          <div>
            <div className="small text-uppercase text-muted mb-2">Attack Path Detail</div>
            <h2 className="h4 mb-0 text-white text-break">{pathId ?? 'Selected Path'}</h2>
          </div>
          <button type="button" className="btn-close btn-close-white" onClick={onClose} />
        </div>

        <div className="p-4 d-flex flex-column gap-4 text-light">
          {isLoading ? (
            <div className="text-muted">Persisted attack path detail loading…</div>
          ) : isError ? (
            <div>
              <div className="alert alert-danger mb-3" role="alert">
                {toErrorMessage(error, 'Persisted attack path detail could not be loaded.')}
              </div>
              <button type="button" className="btn btn-outline-light btn-sm" onClick={() => refetch()}>
                Retry
              </button>
            </div>
          ) : !detail ? (
            <div className="text-muted">No persisted attack path detail found.</div>
          ) : (
            <>
              <div className="d-flex flex-column gap-2">
                <div><strong>Path ID:</strong> <span className="text-break">{detail.path_id}</span></div>
                <div><strong>Risk Score:</strong> {formatNumber(detail.risk_score)}</div>
                <div><strong>Raw Final Risk:</strong> {formatNumber(detail.raw_final_risk)}</div>
                <div><strong>Hop Count:</strong> {formatNumber(detail.hop_count)}</div>
              </div>

              <OrderedValueList
                title="Node IDs"
                items={detail.node_ids}
                emptyLabel="No node IDs available."
              />

              <OrderedValueList
                title="Edge IDs"
                items={detail.edge_ids}
                emptyLabel="No edge IDs available."
              />
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

  const items = Array.isArray((data as { items?: AttackPathListItemResponse[] } | undefined)?.items)
    ? ((data as { items?: AttackPathListItemResponse[] }).items ?? [])
    : [];
  const shouldLoadDetail = enabled && Boolean(clusterId) && Boolean(selectedPathId);
  const isAttackPathDetailOpen = Boolean(selectedPathId);

  useEffect(() => {
    if (!enabled) {
      setSelectedPathId(null);
      return;
    }

    if (items.length === 0) {
      setSelectedPathId(null);
      return;
    }

    if (selectedPathId && items.some((item) => item.path_id === selectedPathId)) {
      return;
    }

    if (selectedPathId && !items.some((item) => item.path_id === selectedPathId)) {
      setSelectedPathId(null);
    }
  }, [enabled, items, selectedPathId]);

  if (isLoading) {
    return (
      <div className="card border-0 shadow-sm">
        <div className="card-body py-5 text-center text-muted">Persisted attack paths loading…</div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="card border-0 shadow-sm">
        <div className="card-body py-4">
          <div className="alert alert-danger mb-3" role="alert">
            {toErrorMessage(error, 'Persisted attack paths could not be loaded.')}
          </div>
          <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => refetch()}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="card border-0 shadow-sm">
        <div className="card-body py-5 text-center">
          <h2 className="h5 mb-2">No persisted attack paths found.</h2>
          <p className="text-muted mb-0">Persisted attack path results will appear here when analysis data is available.</p>
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
              <h2 className="h5 mb-1">Persisted Attack Paths</h2>
              <p className="text-muted mb-0 small">총 {items.length}개 경로</p>
            </div>
          </div>
          <div className="table-responsive">
            <table className="table align-middle mb-0 small">
              <thead className="table-light">
                <tr>
                  <th>Path ID</th>
                  <th>Risk Score</th>
                  <th>Raw Final Risk</th>
                  <th>Length</th>
                  <th>Entry</th>
                  <th>Target</th>
                  <th>Open</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => {
                  const isSelected = item.path_id === selectedPathId;

                  return (
                    <tr
                      key={item.path_id}
                      role="button"
                      className={isSelected ? 'table-active' : undefined}
                      onClick={() => setSelectedPathId(item.path_id)}
                    >
                      <td className="text-break" title={item.path_id}>
                        {formatTruncatedPathId(item.path_id)}
                      </td>
                      <td>{formatNumber(item.risk_score)}</td>
                      <td>{formatNumber(item.raw_final_risk)}</td>
                      <td>{formatNumber(item.hop_count ?? item.node_ids?.length ?? null)}</td>
                      <td className="text-break">{item.entry_node_id ?? '-'}</td>
                      <td className="text-break">{item.target_node_id ?? '-'}</td>
                      <td>
                        <Link
                          to={`/clusters/${clusterId}/attack-paths/${item.path_id}`}
                          className="btn btn-outline-secondary btn-sm"
                          onClick={(event) => event.stopPropagation()}
                        >
                          Open
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
          pathId={selectedPathId}
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
  emptyStateTitle = '어택 그래프 데이터 없음.',
  emptyStateBody = '현재 선택에 사용 가능한 노드 또는 엣지가 없습니다.',
  liveSummary,
  liveEvidenceCount,
}) => {
  const [selectedNode, setSelectedNode] = useState<NodeData | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<EdgeData | null>(null);
  const [selectedPathId, setSelectedPathId] = useState<string | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [selectedMode, setSelectedMode] = useState<SelectionMode>('none');
  const attackGraphViewModel = useMemo(() => toAttackGraphViewModel(payload), [payload]);

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
  const filteredGraph = useMemo(() => filterAttackGraphElements(attackGraph, filters), [attackGraph, filters]);
  const renderedGraph = useMemo(() => filterIsolatedAttackGraphNodes(filteredGraph), [filteredGraph]);

  const attackPaths = useMemo<AttackGraphPath[]>(() => renderedGraph.paths, [renderedGraph.paths]);
  const filteredElements = useMemo(() => toAttackGraphElements(renderedGraph), [renderedGraph]);
  const hasRenderableGraph = renderedGraph.nodes.length > 0 || renderedGraph.edges.length > 0;
  const hasAttackPaths = attackPaths.length > 0;
  const visibleNodeIds = useMemo(() => new Set(renderedGraph.nodes.map((node) => node.id)), [renderedGraph.nodes]);
  const visibleEdgeIds = useMemo(() => new Set(renderedGraph.edges.map((edge) => edge.id)), [renderedGraph.edges]);
  const validPathIds = useMemo(() => new Set(attackPaths.map((path) => path.id)), [attackPaths]);

  useEffect(() => {
    if (selectedPathId && !validPathIds.has(selectedPathId)) {
      setSelectedPathId(null);
      if (selectedMode === 'path') {
        setSelectedMode('none');
      }
    }

    if (selectedNodeId && !visibleNodeIds.has(selectedNodeId)) {
      setSelectedNodeId(null);
      setSelectedNode(null);
      if (selectedMode === 'node') {
        setSelectedMode('none');
      }
    }

    if (selectedEdgeId && !visibleEdgeIds.has(selectedEdgeId)) {
      setSelectedEdgeId(null);
      setSelectedEdge(null);
      if (selectedMode === 'edge') {
        setSelectedMode('none');
      }
    }
  }, [selectedPathId, selectedNodeId, selectedEdgeId, validPathIds, visibleNodeIds, visibleEdgeIds, selectedMode]);

  const selectedPath = useMemo(() => attackPaths.find((path) => path.id === selectedPathId) || null, [attackPaths, selectedPathId]);

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

  useEffect(() => {
    if (!hasAttackPaths) {
      setSelectedPathId(null);
      if (selectedMode === 'path') {
        setSelectedMode('none');
      }
    }
  }, [hasAttackPaths, selectedMode]);

  useEffect(() => {
    if (selectedNodeId) {
      setSelectedNode(selectedNodeLookup.get(selectedNodeId) ?? null);
    }
  }, [selectedNodeId, selectedNodeLookup]);

  useEffect(() => {
    if (selectedEdgeId) {
      setSelectedEdge(selectedEdgeLookup.get(selectedEdgeId) ?? null);
    }
  }, [selectedEdgeId, selectedEdgeLookup]);

  useEffect(() => {
    setSelectedNode(null);
    setSelectedEdge(null);
    setSelectedPathId(null);
    setSelectedNodeId(null);
    setSelectedEdgeId(null);
    setSelectedMode('none');
  }, [payload]);

  const shouldShowNodeDetails = selectedMode === 'node' && selectedNode;
  const shouldShowEdgeDetails = selectedMode === 'edge' && selectedEdge;

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

      <div className="card border-0 shadow-sm mb-1">
        <div className="card-body py-1 px-2">
          <GraphFilters
            filters={filters}
            availableResourceTypes={availableResourceTypes}
            availableEdgeRelations={availableEdgeRelations}
            availableSeverities={availableSeverities}
            onFiltersChange={onFiltersChange}
          />
        </div>
      </div>

      <div
        className="card dg-attack-graph-canvas-card"
        style={{ position: 'relative', overflow: 'hidden' }}
      >
        {hasRenderableGraph ? (
          <Suspense fallback={<PageLoader label="공격 그래프를 준비하는 중..." minHeight="100%" compact />}>
            <GraphView
              showLabels={renderedGraph.nodes.length + renderedGraph.edges.length <= LARGE_GRAPH_THRESHOLD}
              elements={filteredElements}
              layout={attackGraphDefaultLayout}
              selectedPathNodeIds={selectedPathNodeIds}
              selectedPathEdgeIds={selectedPathEdgeIds}
              selectedNodeId={selectedNodeId}
              selectedEdgeId={selectedEdgeId}
              onNodeClick={(node) => {
                const nextNodeId = node.id ? String(node.id) : null;
                const clicked = nextNodeId ? selectedNodeLookup.get(nextNodeId) ?? null : null;
                setSelectedNode(clicked);
                setSelectedNodeId(nextNodeId);
                setSelectedEdgeId(null);
                setSelectedEdge(null);
                setSelectedPathId(null);
                setSelectedMode(nextNodeId ? 'node' : 'none');
              }}
              onEdgeClick={(edge) => {
                const clicked = selectedEdgeLookup.get(edge.id) ?? edge;
                setSelectedEdge(clicked);
                setSelectedEdgeId(clicked.id);
                setSelectedNodeId(null);
                setSelectedNode(null);
                setSelectedPathId(null);
                setSelectedMode('edge');
              }}
            />
          </Suspense>
        ) : (
          <div className="d-flex flex-column justify-content-center align-items-center h-100 text-center px-4">
            <strong className="mb-2">{emptyStateTitle}</strong>
            <p className="text-muted mb-0 small">{emptyStateBody}</p>
          </div>
        )}
        {shouldShowNodeDetails ? (
          <div style={{ position: 'absolute', top: 12, right: 16, width: 300, zIndex: 10 }}>
            <NodeDetailPanel
              node={selectedNode}
              onClose={() => {
                setSelectedMode('none');
                setSelectedNode(null);
                setSelectedNodeId(null);
              }}
              style={{
                position: 'relative',
                top: 0,
                right: 0,
              }}
            />
          </div>
        ) : null}
        {shouldShowEdgeDetails ? (
          <div
            className="card shadow"
            style={{
              position: 'absolute',
              top: 16,
              right: 16,
              width: 300,
              zIndex: 10,
            }}
          >
            <div className="card-header bg-dark text-white d-flex justify-content-between align-items-center">
              <strong>엣지 상세</strong>
              <button
                type="button"
                className="btn-close btn-close-white"
                aria-label="닫기"
                onClick={() => {
                  setSelectedMode('none');
                  setSelectedEdge(null);
                  setSelectedEdgeId(null);
                }}
              />
            </div>
            <div className="card-body">
              <p className="small text-muted mb-3">선택된 엣지 상세 정보</p>
              <table className="table table-sm table-borderless mb-0">
                <tbody>
                  <tr>
                    <td className="text-muted fw-semibold">관계</td>
                    <td>{selectedEdge?.relation || 'n/a'}</td>
                  </tr>
                  <tr>
                    <td className="text-muted fw-semibold">출발지</td>
                    <td>{selectedEdge ? `${selectedEdge.sourceLabel ?? selectedEdge.source} (${selectedEdge.source})` : '-'}</td>
                  </tr>
                  <tr>
                    <td className="text-muted fw-semibold">도착지</td>
                    <td>{selectedEdge ? `${selectedEdge.targetLabel ?? selectedEdge.target} (${selectedEdge.target})` : '-'}</td>
                  </tr>
                  <tr>
                    <td className="text-muted fw-semibold">레이블</td>
                    <td>{selectedEdge?.label || selectedEdge?.id}</td>
                  </tr>
                  <tr>
                    <td className="text-muted fw-semibold">이유</td>
                    <td>{selectedEdge?.reason || 'n/a'}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        ) : null}
      </div>

      <div className="mt-2 d-flex gap-3 flex-wrap">
        <span className="text-muted small">
          <strong>{filteredGraph.nodes.length}</strong> 노드 ·<strong>{filteredGraph.edges.length}</strong> 엣지
        </span>
        <span className="text-muted small">
          모드: <strong>{selectedMode}</strong>
          {selectedMode === 'node' && selectedNode ? ` · 노드 ${selectedNode.label}` : null}
          {selectedMode === 'edge' && selectedEdge ? ` · 엣지 ${selectedEdge.id}` : null}
          {selectedMode === 'path' && selectedPath ? ` · 경로 ${selectedPath.label || selectedPath.id}` : null}
        </span>
      </div>
    </>
  );
};

const AttackGraphPage: React.FC = () => {
  const { clusterId: routeClusterId = '' } = useParams();
  const [activeTab, setActiveTab] = useState<AttackGraphInnerTab>('graph');
  const [liveFilters, setLiveFilters] = useState<AttackGraphFilters>({});
  const [selectedClusterId, setSelectedClusterId] = useState('');

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
  useEffect(() => {
    if (routeClusterId) {
      setSelectedClusterId(routeClusterId);
    }
  }, [routeClusterId]);

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
        }
      `}</style>
      <div className="dg-attack-graph-page dg-page-shell">
      <div className="dg-page-header">
        <div className="dg-page-heading">
          <h1 className="dg-page-title">공격 경로 시각화</h1>
          <p className="dg-page-description">리소스 간 연결 관계와 잠재적 공격 경로를 시각화합니다</p>
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
                Graph
              </button>
            </li>
            <li className="nav-item">
              <button
                type="button"
                className={`nav-link ${activeTab === 'attack-paths' ? 'active' : ''}`}
                onClick={() => setActiveTab('attack-paths')}
              >
                Attack Paths
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
      </div>
      {isClustersError ? (
        <div className="alert alert-danger mb-1" role="alert">
          {toErrorMessage(clustersError, '실시간 어택 그래프용 클러스터를 불러오지 못했습니다.')}
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
              ? '실시간 어택 그래프 불러오는 중…'
              : !activeClusterId
                ? '선택된 클러스터 없음.'
                : isLiveGraphError
                  ? '실시간 어택 그래프를 사용할 수 없습니다.'
                  : '실시간 어택 그래프 데이터 없음.'
          }
          emptyStateBody={
            isClustersLoading
              ? '실시간 어택 그래프 불러오기 전 클러스터 옵션을 가져오는 중.'
              : !activeClusterId
                ? '클러스터를 선택하여 /api/v1/clusters/{cluster_id}/attack-graph를 요청하세요.'
                : isLiveGraphLoading
                  ? '백엔드 엔드포인트에서 그래프 데이터를 가져오는 중.'
                  : isLiveGraphError
                    ? toErrorMessage(liveGraphError, '백엔드 어택 그래프 요청이 실패했습니다.')
                    : '백엔드가 이 클러스터에 대한 노드 또는 엣지를 반환하지 않았습니다.'
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
