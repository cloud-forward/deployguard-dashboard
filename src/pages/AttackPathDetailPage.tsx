import React, { useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { ElementDefinition } from 'cytoscape';
import { useGetAttackPathDetailApiV1ClustersClusterIdAttackPathsPathIdGet } from '../api/generated/clusters/clusters';
import GraphView from '../components/graph/GraphView';
import NodeDetailPanel from '../components/graph/NodeDetailPanel';
import { attackGraphStylesheet } from '../components/graph/attackGraph';
import {
  formatEdgeTypeLabel,
  getThreatLabel,
  NodeIdentity,
  NodeTypeBadge,
  parseAttackPathNode,
  RiskLevelBadge,
  ThreatTypeBadge,
} from '../components/graph/attackPathVisuals';
import type {
  AttackPathDetailEnvelopeResponse,
  AttackPathDetailResponse,
  AttackPathEdgeSequenceResponse,
} from '../api/model';
import type { NodeData, NodeType } from '../components/graph/mockGraphData';

const formatNumber = (value?: number | null) => {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return '-';
  }

  return value.toLocaleString();
};

const formatDateTime = (value?: string | null) => {
  if (!value) {
    return '-';
  }

  const timestamp = new Date(value);
  if (Number.isNaN(timestamp.getTime())) {
    return value;
  }

  return timestamp.toLocaleString('ko-KR');
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

const isAttackPathDetailEnvelope = (value: unknown): value is AttackPathDetailEnvelopeResponse =>
  Boolean(value && typeof value === 'object' && 'cluster_id' in value);

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

const inferNodeType = (nodeId: string): NodeType => {
  const normalized = nodeId.toLowerCase();
  if (normalized.includes('serviceaccount') || normalized.startsWith('sa-')) return 'ServiceAccount';
  if (normalized.includes('iam')) return 'IAMRole';
  if (normalized.includes('s3')) return 'S3Bucket';
  return 'Pod';
};

const toCompactNodeLabel = (value: string): string => {
  const normalized = value.trim();
  if (normalized.length <= 10) {
    return normalized;
  }

  return `${normalized.slice(0, 10)}...`;
};

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

const buildAttackPathGraphElements = (path: AttackPathDetailResponse): ElementDefinition[] => {
  const steps = getOrderedPathSteps(path).filter((step) => step.sourceNodeId && step.targetNodeId);
  const connectedNodeIds = new Set<string>();

  for (const step of steps) {
    connectedNodeIds.add(step.sourceNodeId);
    connectedNodeIds.add(step.targetNodeId);
  }

  const orderedNodeIds = (Array.isArray(path.node_ids) ? path.node_ids : []).filter((nodeId) => connectedNodeIds.has(nodeId));
  const fallbackNodeIds = Array.from(connectedNodeIds).filter((nodeId) => !orderedNodeIds.includes(nodeId));
  const nodeElements: ElementDefinition[] = [...orderedNodeIds, ...fallbackNodeIds].map((nodeId) => ({
    data: {
      id: nodeId,
      label: toCompactNodeLabel(nodeId),
      fullLabel: nodeId,
      type: inferNodeType(nodeId),
      severity: path.risk_level ?? 'unknown',
      isEntryPoint: nodeId === path.entry_node_id,
      isCrownJewel: nodeId === path.target_node_id,
      hasRuntimeEvidence: false,
      pathIndex: orderedNodeIds.indexOf(nodeId),
      details: {
        'Full Node ID': nodeId,
        'Display Label': toCompactNodeLabel(nodeId),
        'Path Position':
          nodeId === path.entry_node_id
            ? 'Entry Point'
            : nodeId === path.target_node_id
              ? 'Target'
              : 'Intermediate',
        'Risk Level': path.risk_level,
      },
      blastRadius: {
        pods: 0,
        secrets: 0,
        databases: 0,
        adminPrivilege: false,
      },
    },
  }));

  const edgeElements: ElementDefinition[] = steps.map((step) => ({
    data: {
      id: step.edge?.edge_id ?? `path-edge-${step.index}`,
      source: step.sourceNodeId,
      target: step.targetNodeId,
      relation: step.edge?.edge_type ?? 'path_step',
      label: step.edge?.edge_type ?? `step ${step.index + 1}`,
      reason:
        step.edge?.metadata && Object.keys(step.edge.metadata).length > 0
          ? renderValue(step.edge.metadata)
          : undefined,
    },
  }));

  return [...nodeElements, ...edgeElements];
};

const attackPathGraphStylesheet = [
  ...attackGraphStylesheet,
  {
    selector: 'node',
    style: {
      width: 30,
      height: 30,
      'font-size': 9,
      'text-wrap': 'wrap',
      'text-max-width': 72,
      'text-margin-y': 12,
    },
  },
  {
    selector: 'edge',
    style: {
      'font-size': 9,
      'text-background-padding': '2px',
      'text-margin-y': -8,
      'text-rotation': 'autorotate',
      'control-point-step-size': 36,
    },
  },
];

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

const getHopAccent = (count?: number | null) => {
  if (typeof count !== 'number' || Number.isNaN(count)) return '#94a3b8';
  if (count >= 2 && count <= 3) return '#ef4444';
  if (count === 4) return '#f59e0b';
  return '#9ca3af';
};

const SummaryCard: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
  <div className="col-12 col-md-6 col-xl-3">
    <div className="border rounded-4 p-3 h-100 bg-card-surface">
      <div className="text-muted small text-uppercase mb-2">{label}</div>
      <div className="fw-semibold text-break">{value}</div>
    </div>
  </div>
);

const NodeSummaryValue: React.FC<{
  value?: string | null;
  showThreatTag?: boolean;
}> = ({ value, showThreatTag = false }) => {
  const parsed = parseAttackPathNode(value);

  return (
    <div className="d-flex flex-column gap-2" title={parsed.raw}>
      <div className="d-flex flex-wrap align-items-center gap-2">
        <NodeTypeBadge type={parsed.type} />
        <span className="fw-semibold text-break">{parsed.name}</span>
        {showThreatTag ? <ThreatTypeBadge type={parsed.type} /> : null}
      </div>
      <div className="small text-muted text-break">{parsed.raw}</div>
    </div>
  );
};

const HopCountValue: React.FC<{ count?: number | null }> = ({ count }) => (
  <span
    style={{
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
      fontSize: '1.75rem',
      fontWeight: 700,
      color: getHopAccent(count),
      lineHeight: 1,
    }}
  >
    {count ?? '-'}
  </span>
);

const DetailField: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
  <div className="col-12 col-md-6 col-xl-4">
    <div className="border rounded-4 p-3 h-100 bg-card-surface">
      <div className="text-muted small text-uppercase mb-1">{label}</div>
      <div className="text-break">{value}</div>
    </div>
  </div>
);

const MetadataBlock: React.FC<{
  title: string;
  metadata?: Record<string, unknown>;
}> = ({ title, metadata }) => {
  const entries = Object.entries(metadata ?? {});

  if (entries.length === 0) {
    return null;
  }

  return (
    <div className="card border-0 shadow-sm">
      <div className="card-body">
        <h2 className="h6 mb-3">{title}</h2>
        <div className="row g-3">
          {entries.map(([key, value]) => (
            <div className="col-12 col-lg-6" key={key}>
              <div className="border rounded-3 p-3 h-100 bg-light">
                <div className="text-muted small mb-1">{key}</div>
                <pre className="mb-0 small text-wrap" style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                  {renderValue(value)}
                </pre>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const StepList: React.FC<{
  path: AttackPathDetailResponse;
}> = ({ path }) => {
  const steps = useMemo(() => getOrderedPathSteps(path), [path]);

  if (steps.length === 0) {
    return (
      <div className="card border-0 shadow-sm">
        <div className="card-body">
          <h2 className="h6 mb-2">Path Progression</h2>
          <div className="text-muted small">Ordered edge progression is not available for this path.</div>
        </div>
      </div>
    );
  }

  return (
    <div className="card border-0 shadow-sm">
      <div className="card-body">
        <h2 className="h6 mb-3">Path Progression</h2>
        <div className="d-flex flex-column gap-3">
          {steps.map((step, index) => {
            const sourceNode = parseAttackPathNode(step.sourceNodeId);
            const targetNode = parseAttackPathNode(step.targetNodeId);
            const isFinalTarget = step.targetNodeId === path.target_node_id;

            return (
              <React.Fragment key={step.id}>
                <div className="border rounded-4 p-3 bg-card-surface">
                  <div className="small text-muted mb-2">Step {step.index + 1}</div>
                  <div className="d-flex flex-column gap-3">
                    <div className="d-flex flex-wrap align-items-center gap-2" title={sourceNode.raw}>
                      <span className="small text-muted">Source</span>
                      <NodeTypeBadge type={sourceNode.type} />
                      <span className="fw-semibold text-break">{sourceNode.name}</span>
                    </div>
                    <div className="small text-muted">
                      {step.edge ? formatEdgeTypeLabel(step.edge.edge_type) : 'Connects To'}
                    </div>
                    <div className="d-flex flex-wrap align-items-center gap-2" title={targetNode.raw}>
                      <span className="small text-muted">Target</span>
                      <NodeTypeBadge type={targetNode.type} />
                      <span className="fw-semibold text-break">{targetNode.name}</span>
                      {isFinalTarget ? <ThreatTypeBadge type={targetNode.type} /> : null}
                    </div>
                  </div>
                  {step.edge?.metadata && Object.keys(step.edge.metadata).length > 0 ? (
                    <div className="mt-3">
                      <div className="small text-muted mb-1">Edge Metadata</div>
                      <pre className="mb-0 small text-wrap" style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                        {renderValue(step.edge.metadata)}
                      </pre>
                    </div>
                  ) : null}
                </div>
                {index < steps.length - 1 ? (
                  <div className="text-center text-muted" aria-hidden="true" style={{ fontSize: '1.1rem', lineHeight: 1 }}>
                    ↓
                  </div>
                ) : null}
              </React.Fragment>
            );
          })}
        </div>
      </div>
    </div>
  );
};

const EdgeList: React.FC<{
  edges: AttackPathEdgeSequenceResponse[];
}> = ({ edges }) => (
  <div className="card border-0 shadow-sm">
    <div className="card-body">
      <h2 className="h6 mb-3">Edge Sequence</h2>
      <div className="table-responsive">
        <table className="table table-sm align-middle mb-0">
          <thead className="table-light">
            <tr>
              <th>#</th>
              <th>Edge ID</th>
              <th>Type</th>
              <th>Source</th>
              <th>Target</th>
            </tr>
          </thead>
          <tbody>
            {edges.map((edge) => (
              <tr key={edge.edge_id}>
                <td>{edge.edge_index + 1}</td>
                <td className="text-break">{edge.edge_id}</td>
                <td>{formatEdgeTypeLabel(edge.edge_type)}</td>
                <td style={{ minWidth: 220 }}><NodeIdentity value={edge.source_node_id} compact showThreat /></td>
                <td style={{ minWidth: 220 }}><NodeIdentity value={edge.target_node_id} compact showThreat showGlow /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  </div>
);

const AttackPathDetailPage: React.FC = () => {
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

  const envelope = isAttackPathDetailEnvelope(query.data) ? query.data : null;
  const path = envelope?.path ?? null;
  const orderedEdges = Array.isArray(path?.edges)
    ? [...(path?.edges ?? [])].sort((left, right) => left.edge_index - right.edge_index)
    : [];
  const nodeIds = Array.isArray(path?.node_ids) ? (path?.node_ids ?? []) : [];
  const edgeIds = Array.isArray(path?.edge_ids) ? (path?.edge_ids ?? []) : [];
  const selectedNodeLookup = useMemo(() => {
    const map = new Map<string, NodeData>();

    if (!path) {
      return map;
    }

    for (const element of buildAttackPathGraphElements(path)) {
      const data = element.data as Record<string, unknown>;
      if (typeof data.source === 'string') {
        continue;
      }

      const id = String(data.id ?? '');
      map.set(id, {
        id,
        label: String(data.fullLabel ?? data.label ?? id),
        type: inferNodeType(id),
        namespace: typeof data.namespace === 'string' ? data.namespace : undefined,
        details:
          typeof data.details === 'object' && data.details !== null
            ? Object.entries(data.details as Record<string, unknown>).reduce<Record<string, string>>((acc, [key, value]) => {
                acc[key] = value == null ? '' : String(value);
                return acc;
              }, {})
            : {},
        blastRadius: {
          pods: 0,
          secrets: 0,
          databases: 0,
          adminPrivilege: false,
        },
      });
    }

    return map;
  }, [path]);
  const pathGraphElements = useMemo(() => (path ? buildAttackPathGraphElements(path) : []), [path]);
  const selectedEdgeLookup = useMemo(() => {
    const map = new Map<string, EdgeDetailData>();

    for (const element of pathGraphElements) {
      const data = element.data as Record<string, unknown>;
      if (typeof data.source !== 'string') {
        continue;
      }

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
  const attackPathLayout = useMemo(
    () => ({
      name: 'breadthfirst',
      directed: true,
      animate: false,
      fit: true,
      padding: 72,
      spacingFactor: 2.8,
      avoidOverlap: true,
      avoidOverlapPadding: 24,
      roots: path?.entry_node_id ? [path.entry_node_id] : undefined,
      transform: (node: { data: (key: string) => unknown }, position: { x: number; y: number }) => {
        const rawIndex = Number(node.data('pathIndex') ?? 0);
        const staggerOffset = rawIndex % 2 === 0 ? -28 : 28;

        return {
          x: position.y,
          y: position.x + staggerOffset,
        };
      },
    }),
    [path?.entry_node_id],
  );

  React.useEffect(() => {
    setSelectedNode(null);
    setSelectedNodeId(null);
    setSelectedEdge(null);
    setSelectedEdgeId(null);
  }, [pathId, path]);

  if (query.isLoading) {
    return (
      <div className="container-fluid py-4">
        <div className="card border-0 shadow-sm">
          <div className="card-body py-5 text-center text-muted">Attack path detail loading...</div>
        </div>
      </div>
    );
  }

  if (query.isError) {
    return (
      <div className="container-fluid py-4">
        <div className="card border-0 shadow-sm">
          <div className="card-body py-4">
            <div className="alert alert-danger mb-3" role="alert">
              {toErrorMessage(query.error, 'Attack path detail could not be loaded.')}
            </div>
            <button type="button" className="btn btn-sm dg-dashboard-action-btn dg-dashboard-action-btn--secondary" onClick={() => query.refetch()}>
              Retry
            </button>
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
            <h1 className="h4 mb-2">No attack path detail found.</h1>
            <p className="text-muted mb-3">The backend returned no detail payload for this path.</p>
            {clusterId ? (
              <Link to={`/clusters/${clusterId}/graph`} className="btn btn-sm dg-dashboard-action-btn dg-dashboard-action-btn--secondary">
                Back to Attack Graph
              </Link>
            ) : null}
          </div>
        </div>
      </div>
    );
  }

  const entryNode = parseAttackPathNode(path.entry_node_id);
  const targetNode = parseAttackPathNode(path.target_node_id);
  const targetThreat = getThreatLabel(targetNode.type);

  return (
    <div className="container-fluid py-4">
      <div className="d-flex flex-wrap justify-content-between align-items-start gap-3 mb-4">
        <div>
          <div className="text-muted small text-uppercase mb-2">Attack Path Detail</div>
          <div className="d-flex flex-wrap align-items-center gap-2 text-break">
            <RiskLevelBadge level={path.risk_level} />
            {targetThreat ? <ThreatTypeBadge type={targetNode.type} /> : null}
            <span className="text-muted small">|</span>
            <span className="small text-muted">Entry:</span>
            <NodeTypeBadge type={entryNode.type} />
            <span className="fw-semibold">{entryNode.name}</span>
            <span className="small text-muted">Target:</span>
            <NodeTypeBadge type={targetNode.type} />
            <span className="fw-semibold">{targetNode.name}</span>
          </div>
        </div>
        {clusterId ? (
          <Link to={`/clusters/${clusterId}/graph`} className="btn btn-sm dg-dashboard-action-btn dg-dashboard-action-btn--secondary">
            Back to Attack Graph
          </Link>
        ) : null}
      </div>

      <div className="row g-3 mb-4">
        <SummaryCard label="Risk Level" value={<RiskLevelBadge level={path.risk_level} />} />
        <SummaryCard label="Entry Node" value={<NodeSummaryValue value={path.entry_node_id} />} />
        <SummaryCard label="Target Node" value={<NodeSummaryValue value={path.target_node_id} showThreatTag />} />
        <SummaryCard label="Hop Count" value={<HopCountValue count={path.hop_count} />} />
      </div>

      <div className="accordion mb-4" id="attack-path-detail-accordion">
        <div className="accordion-item border-0 shadow-sm">
          <h2 className="accordion-header" id="attack-path-detail-heading">
            <button
              className="accordion-button collapsed"
              type="button"
              data-bs-toggle="collapse"
              data-bs-target="#attack-path-detail-collapse"
              aria-expanded="false"
              aria-controls="attack-path-detail-collapse"
            >
              상세 정보
            </button>
          </h2>
          <div
            id="attack-path-detail-collapse"
            className="accordion-collapse collapse"
            aria-labelledby="attack-path-detail-heading"
            data-bs-parent="#attack-path-detail-accordion"
          >
            <div className="accordion-body bg-card-surface">
              <div className="row g-3">
                <DetailField label="Cluster ID" value={envelope.cluster_id} />
                <DetailField label="Path ID" value={<code className="small text-break">{path.path_id}</code>} />
                <DetailField label="Risk Score" value={formatNumber(path.risk_score)} />
                <DetailField label="Raw Final Risk" value={formatNumber(path.raw_final_risk)} />
                <DetailField label="Analysis Run ID" value={envelope.analysis_run_id ?? '-'} />
                <DetailField label="Generated At" value={formatDateTime(envelope.generated_at)} />
              </div>
            </div>
          </div>
        </div>
      </div>
      {selectedNode ? (
        <div className="mb-4">
          <NodeDetailPanel
            node={selectedNode}
            onClose={() => {
              setSelectedNode(null);
              setSelectedNodeId(null);
            }}
            style={{
              position: 'relative',
              top: 0,
              right: 0,
              width: 320,
            }}
          />
        </div>
      ) : null}
      {selectedEdge ? (
        <div className="card shadow mb-4">
          <div className="card-header bg-dark text-white d-flex justify-content-between align-items-center">
            <strong>Edge Detail</strong>
            <button
              type="button"
              className="btn-close btn-close-white"
              aria-label="Close"
              onClick={() => {
                setSelectedEdge(null);
                setSelectedEdgeId(null);
              }}
            />
          </div>
          <div className="card-body">
            <p className="small text-muted mb-3">Selected edge details</p>
            <table className="table table-sm table-borderless mb-0">
              <tbody>
                <tr>
                  <td className="text-muted fw-semibold">Relation</td>
                  <td>{selectedEdge.relation || 'n/a'}</td>
                </tr>
                <tr>
                  <td className="text-muted fw-semibold">Source</td>
                  <td>{`${selectedEdge.sourceLabel ?? selectedEdge.source} (${selectedEdge.source})`}</td>
                </tr>
                <tr>
                  <td className="text-muted fw-semibold">Target</td>
                  <td>{`${selectedEdge.targetLabel ?? selectedEdge.target} (${selectedEdge.target})`}</td>
                </tr>
                <tr>
                  <td className="text-muted fw-semibold">Label</td>
                  <td>{selectedEdge.label || selectedEdge.id}</td>
                </tr>
                <tr>
                  <td className="text-muted fw-semibold">Reason</td>
                  <td style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{selectedEdge.reason || 'n/a'}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      <div className="row g-4 mb-4">
        <div className="col-12 col-xl-7">
          <StepList path={path} />
        </div>
        <div className="col-12 col-xl-5">
          <div className="card border-0 shadow-sm mb-4">
            <div className="card-body">
              <h2 className="h6 mb-3">Ordered Nodes</h2>
              {nodeIds.length === 0 ? (
                <div className="text-muted small">No ordered node list was returned.</div>
              ) : (
                <ol className="mb-0 ps-3">
                  {nodeIds.map((nodeId) => (
                    <li key={nodeId} className="mb-2 text-break">
                      {nodeId}
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </div>
          <div className="card border-0 shadow-sm">
            <div className="card-body">
              <h2 className="h6 mb-3">Persisted Edge IDs</h2>
              {edgeIds.length === 0 ? (
                <div className="text-muted small">No persisted edge ids were returned.</div>
              ) : (
                <ol className="mb-0 ps-3">
                  {edgeIds.map((edgeId) => (
                    <li key={edgeId} className="mb-2 text-break">
                      {edgeId}
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="card border-0 shadow-sm mb-4">
        <div className="card-body">
          <h2 className="h6 mb-3">Attack Path Graph</h2>
          {pathGraphElements.length === 0 ? (
            <div className="text-muted small">This path does not contain enough ordered graph data to render a path-only graph.</div>
          ) : (
            <div style={{ minHeight: 300, height: 320 }}>
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
        </div>
      </div>

      {orderedEdges.length > 0 ? <div className="mb-4"><EdgeList edges={orderedEdges} /></div> : null}
      {orderedEdges.some((edge) => edge.metadata && Object.keys(edge.metadata).length > 0) ? (
        <div className="d-flex flex-column gap-4">
          {orderedEdges.map((edge) => (
            <MetadataBlock key={edge.edge_id} title={`Edge Metadata: ${edge.edge_id}`} metadata={edge.metadata} />
          ))}
        </div>
      ) : null}
    </div>
  );
};

export default AttackPathDetailPage;
