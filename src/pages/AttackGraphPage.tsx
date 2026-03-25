import React, { useEffect, useMemo, useState } from 'react';
import type { ElementDefinition } from 'cytoscape';
import { useParams } from 'react-router-dom';
import GraphView from '../components/graph/GraphView';
import NodeDetailPanel from '../components/graph/NodeDetailPanel';
import BlastRadiusPanel from '../components/graph/BlastRadiusPanel';
import GraphFilters from '../components/graph/GraphFilters';
import ClusterFlowNav from '../components/layout/ClusterFlowNav';
import type { NodeData, NodeType } from '../components/graph/mockGraphData';
import { mockElements } from '../components/graph/mockGraphData';
import { useListClustersApiV1ClustersGet } from '../api/generated/clusters/clusters';
import { useGetClusterAttackGraph } from '../api/attackGraph';
import {
  filterAttackGraphElements,
  toAttackGraphElements,
  toAttackGraphViewModel,
  type AttackGraphApiEdge,
  type AttackGraphApiNode,
  type AttackGraphApiResponse,
  type AttackGraphEdgeRelation,
  type AttackGraphFilters,
  type AttackGraphPath,
  type AttackGraphResourceType,
  type AttackGraphRiskSeverity,
} from '../components/graph/attackGraph';

const LARGE_GRAPH_THRESHOLD = 180;
const EMPTY_ATTACK_GRAPH: AttackGraphApiResponse = {
  nodes: [],
  edges: [],
  paths: [],
};

type SelectionMode = 'none' | 'path' | 'node' | 'edge';
type AttackGraphDataSource = 'mock' | 'live';

interface EdgeData {
  id: string;
  source: string;
  target: string;
  label?: string;
  relation?: string;
  reason?: string;
}

const mapLegacyTypeToAttackGraphType = (nodeType: string): string => {
  if (nodeType === 'S3Bucket') return 'S3';
  return nodeType;
};

const mapLegacyType = (value: unknown): string => {
  return String(value);
};

const buildAttackGraphApiPayload = (elements: ElementDefinition[]): AttackGraphApiResponse => {
  const nodes: AttackGraphApiNode[] = [];
  const edges: AttackGraphApiEdge[] = [];

  for (const element of elements) {
    const data = element.data as Record<string, unknown>;
    if (typeof data.source === 'string') {
      edges.push({
        id: String(data.id),
        source: String(data.source),
        target: String(data.target),
        relation: data.label ? String(data.label) : undefined,
        label: data.label ? String(data.label) : undefined,
      });
      continue;
    }

    nodes.push({
      id: String(data.id),
      label: data.label ? String(data.label) : String(data.id),
      resource_type: mapLegacyTypeToAttackGraphType(mapLegacyType(data.type)),
      namespace: typeof data.namespace === 'string' ? data.namespace : null,
      severity: 'unknown',
      is_entry_point: false,
      is_crown_jewel: false,
      has_runtime_evidence: false,
      details: typeof data.details === 'object' && data.details !== null ? (data.details as Record<string, unknown>) : {},
    });
  }

  return {
    nodes,
    edges,
    paths: [
      {
        id: 'mock-path-1',
        label: '파드에서 S3로의 어택 경로',
        node_ids: ['pod-1', 'sa-1', 'iam-1', 's3-1'],
        edge_ids: ['e1', 'e2', 'e3'],
        severity: 'high',
      },
    ],
  };
};

const toAttackGraphPayload = buildAttackGraphApiPayload(mockElements);

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

const isAttackGraphApiResponse = (value: unknown): value is AttackGraphApiResponse =>
  Boolean(value && typeof value === 'object' && 'nodes' in value && 'edges' in value);

const mapAttackGraphNodeToPanelNode = (node: AttackGraphApiNode): NodeData => {
  const normalizedType = mapLegacyTypeToAttackGraphType(node.resource_type ?? 'Unknown');
  let panelType: NodeType = 'Pod';

  if (normalizedType === 'ServiceAccount') panelType = 'ServiceAccount';
  if (normalizedType === 'IAMRole') panelType = 'IAMRole';
  if (normalizedType === 'S3') panelType = 'S3Bucket';

  return {
    id: node.id,
    label: node.label ?? node.id,
    type: panelType,
    namespace: node.namespace ?? undefined,
    details: Object.entries({
      ...(node.details ?? {}),
      ...(node.metadata ?? {}),
      ...(typeof node.evidence_count === 'number' ? { evidence_count: node.evidence_count } : {}),
    }).reduce<Record<string, string>>((acc, [key, value]) => {
      acc[toDisplayLabel(key)] = value == null ? '' : String(value);
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

const mapAttackGraphEdgeToPanelEdge = (edge: AttackGraphApiEdge): EdgeData => ({
  id: edge.id,
  source: edge.source,
  target: edge.target,
  relation: edge.relation ? String(edge.relation) : undefined,
  label: edge.label ? String(edge.label) : undefined,
  reason:
    edge.metadata && typeof edge.metadata.reason === 'string' && edge.metadata.reason.trim()
      ? edge.metadata.reason
      : undefined,
});

interface AttackGraphContentProps {
  payload: AttackGraphApiResponse;
  filters: AttackGraphFilters;
  onFiltersChange: React.Dispatch<React.SetStateAction<AttackGraphFilters>>;
  emptyStateTitle?: string;
  emptyStateBody?: string;
  liveSummary?: string | null;
  liveEvidenceCount?: number | null;
}

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

  const attackPaths = useMemo<AttackGraphPath[]>(() => filteredGraph.paths, [filteredGraph.paths]);
  const filteredElements = useMemo(() => toAttackGraphElements(filteredGraph), [filteredGraph]);
  const hasRenderableGraph = filteredGraph.nodes.length > 0 || filteredGraph.edges.length > 0;
  const visibleNodeIds = useMemo(() => new Set(filteredGraph.nodes.map((node) => node.id)), [filteredGraph.nodes]);
  const visibleEdgeIds = useMemo(() => new Set(filteredGraph.edges.map((edge) => edge.id)), [filteredGraph.edges]);
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
    for (const node of payload.nodes ?? []) {
      map.set(node.id, mapAttackGraphNodeToPanelNode(node));
    }
    return map;
  }, [payload.nodes]);
  const selectedEdgeLookup = useMemo(() => {
    const map = new Map<string, EdgeData>();
    for (const edge of payload.edges ?? []) {
      map.set(edge.id, mapAttackGraphEdgeToPanelEdge(edge));
    }
    return map;
  }, [payload.edges]);

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

      <div className="card" style={{ height: 600, position: 'relative' }}>
        <div className="px-2 py-1 bg-light border-bottom small">
          <div className="d-flex align-items-center gap-2 flex-nowrap overflow-auto">
            <span className="text-muted fw-semibold">어택 경로:</span>
            <div
              className="d-flex align-items-center gap-1 overflow-auto flex-nowrap"
              style={{ maxHeight: 28, whiteSpace: 'nowrap', width: '100%' }}
            >
              {attackPaths.map((path) => (
                <button
                  key={path.id}
                  type="button"
                  className={`btn btn-sm py-0 px-2 ${
                    selectedPathId === path.id ? 'btn-dark text-white' : 'btn-outline-secondary'
                  }`}
                  onClick={() => {
                    const next = path.id === selectedPathId ? null : path.id;
                    setSelectedPathId(next);
                    setSelectedMode(next ? 'path' : 'none');
                    setSelectedNodeId(null);
                    setSelectedEdgeId(null);
                    setSelectedNode(null);
                    setSelectedEdge(null);
                  }}
                >
                  {path.label || `경로 ${path.id}`}
                </button>
              ))}
              {attackPaths.length === 0 ? <span className="text-muted">사용 가능한 경로 없음.</span> : null}
            </div>
          </div>
        </div>
        {hasRenderableGraph ? (
          <GraphView
            showLabels={filteredGraph.nodes.length + filteredGraph.edges.length <= LARGE_GRAPH_THRESHOLD}
            elements={filteredElements}
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
        ) : (
          <div className="d-flex flex-column justify-content-center align-items-center h-100 text-center px-4">
            <strong className="mb-2">{emptyStateTitle}</strong>
            <p className="text-muted mb-0 small">{emptyStateBody}</p>
          </div>
        )}
        {shouldShowNodeDetails ? (
          <div
            className="d-flex flex-column"
            style={{ position: 'absolute', top: 12, right: 16, width: 300, zIndex: 10, gap: '8px' }}
          >
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
            <BlastRadiusPanel
              node={selectedNode}
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
                    <td>{selectedEdge?.source}</td>
                  </tr>
                  <tr>
                    <td className="text-muted fw-semibold">도착지</td>
                    <td>{selectedEdge?.target}</td>
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
  const [activeSource, setActiveSource] = useState<AttackGraphDataSource>(
    routeClusterId ? 'live' : 'mock',
  );
  const [mockFilters, setMockFilters] = useState<AttackGraphFilters>({});
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
      setActiveSource('live');
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
      enabled: activeSource === 'live' && Boolean(activeClusterId),
      retry: false,
    },
  });

  const livePayload = isAttackGraphApiResponse(liveAttackGraphResponse) ? liveAttackGraphResponse : EMPTY_ATTACK_GRAPH;

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-1">
        <div>
          <h1 className="h3 mb-1">어택 그래프</h1>
          <p className="dg-subtitle-text mb-0 small">잠재적 어택 벡터 시각화.</p>
        </div>
      </div>

      {routeClusterId ? <ClusterFlowNav clusterId={routeClusterId} current="graph" /> : null}

      <div className="card border-0 shadow-sm mb-1">
        <div className="card-body py-1 px-2 d-flex flex-wrap gap-3 justify-content-between align-items-center">
          <div className="btn-group btn-group-sm" role="tablist" aria-label="어택 그래프 데이터 소스">
            <button
              type="button"
              className={`btn ${activeSource === 'mock' ? 'btn-dark' : 'btn-outline-secondary'}`}
              onClick={() => setActiveSource('mock')}
            >
              모의
            </button>
            <button
              type="button"
              className={`btn ${activeSource === 'live' ? 'btn-dark' : 'btn-outline-secondary'}`}
              onClick={() => setActiveSource('live')}
            >
              실시간
            </button>
          </div>
          {activeSource === 'live' ? (
            <div style={{ minWidth: 280 }}>
              <label htmlFor="attack-graph-cluster-select" className="form-label mb-1 small text-muted">
                클러스터
              </label>
              <select
                id="attack-graph-cluster-select"
                className="form-select form-select-sm"
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
          ) : null}
        </div>
      </div>

      {activeSource === 'mock' ? (
        <AttackGraphContent payload={toAttackGraphPayload} filters={mockFilters} onFiltersChange={setMockFilters} />
      ) : (
        <>
          {isClustersError ? (
            <div className="alert alert-danger mb-1" role="alert">
              {toErrorMessage(clustersError, '실시간 어택 그래프용 클러스터를 불러오지 못했습니다.')}
            </div>
          ) : null}
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
        </>
      )}

      {/* TODO Step5: advanced filters (critical paths only, escape-only, AWS pivot-only) are not supported by the current mock model */}
      {/* TODO Step5: cleanup of temporary compatibility bridges (legacy NodeData/BlastRadius panel contracts remain in place) */}
      {/* TODO Step5: remove the mock payload once the live graph becomes the default source */}
    </div>
  );
};

export default AttackGraphPage;
