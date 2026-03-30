import React, { Suspense, useMemo, useState } from 'react';
import type { ElementDefinition, LayoutOptions } from 'cytoscape';
import { Link, useParams } from 'react-router-dom';
import {
  useGetAttackPathDetailApiV1ClustersClusterIdAttackPathsPathIdGet,
} from '../api/generated/clusters/clusters';
import type {
  AttackPathDetailEnvelopeResponse,
  AttackPathDetailResponse,
  AttackPathEdgeSequenceResponse,
} from '../api/model';
import GraphView from '../components/graph/GraphView';
import type { NodeData } from '../components/graph/mockGraphData';
import { attackGraphStylesheet } from '../components/graph/attackGraph';
import PageLoader from '../components/layout/PageLoader';
import {
  formatEdgeTypeLabel,
  getRiskLevelMeta,
  getThreatLabel,
  NodeIdentity,
  parseAttackPathNode,
  RiskLevelBadge,
} from '../components/graph/attackPathVisuals';

type EdgeData = {
  id: string;
  source: string;
  target: string;
  label?: string;
  relation?: string;
  reason?: string;
  sourceLabel?: string;
  targetLabel?: string;
};

type StepViewModel = {
  id: string;
  index: number;
  sourceId: string;
  targetId: string;
  label: string;
  reason: string | null;
};

const isAttackPathDetailEnvelope = (value: unknown): value is AttackPathDetailEnvelopeResponse =>
  Boolean(value && typeof value === 'object' && 'cluster_id' in value);

const formatDecimal = (value?: number | null, digits = 3) =>
  typeof value === 'number' && Number.isFinite(value) ? value.toFixed(digits) : '-';

const formatDateTime = (value?: string | null) => {
  if (!value) return '-';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(parsed);
};

const toErrorMessage = (error: unknown) => {
  if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string' && error.message.trim()) {
    return error.message;
  }
  return 'Persisted attack path detail could not be loaded.';
};

const inferGraphNodeType = (nodeId: string) => {
  const normalized = nodeId.toLowerCase();
  if (normalized.startsWith('ingress:')) return 'Ingress';
  if (normalized.startsWith('service:')) return 'Service';
  if (normalized.startsWith('pod:')) return 'Pod';
  if (normalized.startsWith('sa:') || normalized.startsWith('service_account:') || normalized.startsWith('serviceaccount:')) {
    return 'ServiceAccount';
  }
  if (normalized.startsWith('iam:')) return 'IAMRole';
  if (normalized.startsWith('s3:')) return 'S3';
  if (normalized.startsWith('rds:')) return 'RDS';
  return 'Unknown';
};

const summarizeMetadata = (metadata?: AttackPathEdgeSequenceResponse['metadata']) => {
  if (!metadata || typeof metadata !== 'object') return null;
  const entries = Object.entries(metadata).filter(([, value]) => value !== null && value !== undefined && `${value}`.trim() !== '');
  if (entries.length === 0) return null;
  return entries
    .slice(0, 2)
    .map(([key, value]) => `${key.replace(/_/g, ' ')}: ${String(value)}`)
    .join(' | ');
};

const getOrderedNodeIds = (path: AttackPathDetailResponse | null) => {
  const ordered = Array.isArray(path?.node_ids) ? path.node_ids.filter((item): item is string => Boolean(item?.trim())) : [];
  if (ordered.length > 0) return ordered;
  const collected: string[] = [];
  for (const edge of Array.isArray(path?.edges) ? path.edges : []) {
    if (edge.source_node_id && !collected.includes(edge.source_node_id)) collected.push(edge.source_node_id);
    if (edge.target_node_id && !collected.includes(edge.target_node_id)) collected.push(edge.target_node_id);
  }
  return collected;
};

const getOrderedSteps = (path: AttackPathDetailResponse | null): StepViewModel[] => {
  if (!path) return [];
  const edges = Array.isArray(path.edges) ? [...path.edges].sort((a, b) => a.edge_index - b.edge_index) : [];
  if (edges.length > 0) {
    return edges.map((edge) => ({
      id: edge.edge_id,
      index: edge.edge_index,
      sourceId: edge.source_node_id,
      targetId: edge.target_node_id,
      label: formatEdgeTypeLabel(edge.edge_type),
      reason: summarizeMetadata(edge.metadata),
    }));
  }

  const nodeIds = getOrderedNodeIds(path);
  return nodeIds.slice(0, -1).map((sourceId, index) => ({
    id: `${path.path_id}-step-${index}`,
    index,
    sourceId,
    targetId: nodeIds[index + 1] ?? '',
    label: `Path Step ${index + 1}`,
    reason: null,
  }));
};

const buildGraphElements = (path: AttackPathDetailResponse): ElementDefinition[] => {
  const nodeIds = getOrderedNodeIds(path);
  const steps = getOrderedSteps(path);
  const yPattern = nodeIds.length <= 3 ? [0, 52, -22] : [0, 66, -30, 52, -12];

  const nodes: ElementDefinition[] = nodeIds.map((nodeId, index) => {
    const parsed = parseAttackPathNode(nodeId);
    return {
      data: {
        id: nodeId,
        label: parsed.name,
        fullLabel: parsed.raw,
        type: inferGraphNodeType(nodeId),
        severity: path.risk_level ?? 'unknown',
        namespace: parsed.namespace ?? '',
        isEntryPoint: nodeId === path.entry_node_id,
        isCrownJewel: nodeId === path.target_node_id,
        hasRuntimeEvidence: false,
        pathIndex: index,
        details: {
          Identifier: parsed.raw,
          Namespace: parsed.namespace ?? '-',
        },
        blastRadius: { pods: 0, secrets: 0, databases: 0, adminPrivilege: false },
      },
      position: {
        x: index * 190,
        y: yPattern[index % yPattern.length] ?? 0,
      },
    };
  });

  const edges: ElementDefinition[] = steps.map((step) => ({
    data: {
      id: step.id,
      source: step.sourceId,
      target: step.targetId,
      label: step.label,
      relation: step.label,
      reason: step.reason ?? undefined,
      sourceLabel: parseAttackPathNode(step.sourceId).name,
      targetLabel: parseAttackPathNode(step.targetId).name,
    },
  }));

  return [...nodes, ...edges];
};

const detailGraphStylesheet = [
  ...attackGraphStylesheet,
  {
    selector: 'node',
    style: {
      width: 28,
      height: 28,
      'font-size': 9,
      'text-wrap': 'wrap',
      'text-max-width': 110,
      'text-margin-y': 12,
    },
  },
  {
    selector: 'edge',
    style: {
      'curve-style': 'taxi',
      'taxi-direction': 'rightward',
      'taxi-turn': '28px',
      'edge-distances': 'node-position',
      'font-size': 9,
      'text-background-color': 'rgba(15, 23, 42, 0.92)',
      'text-background-opacity': 1,
      'text-background-padding': '3px',
      'text-margin-y': -10,
      'text-rotation': 'autorotate',
      'control-point-step-size': 36,
    },
  },
];

const StatChip: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
  <div className="rounded-4 border px-3 py-2" style={{ borderColor: 'rgba(148, 163, 184, 0.18)', background: 'rgba(15, 23, 42, 0.42)' }}>
    <div className="small text-uppercase text-muted mb-1" style={{ letterSpacing: '0.06em' }}>{label}</div>
    <div className="fw-semibold">{value}</div>
  </div>
);

const DetailRow: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
  <div className="d-flex flex-column gap-1">
    <div className="small text-uppercase text-muted" style={{ letterSpacing: '0.05em' }}>{label}</div>
    <div className="fw-semibold text-break" style={{ wordBreak: 'break-word' }}>{value}</div>
  </div>
);

const AttackPathDetailPage: React.FC = () => {
  const { clusterId = '', pathId = '' } = useParams<{ clusterId: string; pathId: string }>();
  const [selectedNode, setSelectedNode] = useState<NodeData | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<EdgeData | null>(null);

  const query = useGetAttackPathDetailApiV1ClustersClusterIdAttackPathsPathIdGet(clusterId, pathId, {
    query: {
      enabled: Boolean(clusterId && pathId),
      retry: false,
    },
  });

  const envelope = isAttackPathDetailEnvelope(query.data) ? query.data : null;
  const path = envelope?.path ?? null;
  const nodeIds = useMemo(() => getOrderedNodeIds(path), [path]);
  const steps = useMemo(() => getOrderedSteps(path), [path]);
  const graphElements = useMemo(() => (path ? buildGraphElements(path) : []), [path]);
  const graphLayout = useMemo<LayoutOptions>(() => ({ name: 'preset', animate: false, fit: false, padding: 80 }), []);
  const entry = parseAttackPathNode(path?.entry_node_id);
  const target = parseAttackPathNode(path?.target_node_id);
  const threatLabel = getThreatLabel(target.type);
  const riskMeta = getRiskLevelMeta(path?.risk_level);

  if (query.isLoading) {
    return <PageLoader label="Persisted attack path detail is loading..." minHeight="70vh" />;
  }

  if (query.isError || !path) {
    return (
      <div className="container-fluid py-4">
        <div className="alert alert-danger mb-0" role="alert">
          {toErrorMessage(query.error)}
        </div>
      </div>
    );
  }

  return (
    <div className="container-fluid py-4">
      <div className="d-flex flex-column gap-4">
        <section className="rounded-4 border p-4 p-xl-5" style={{ borderColor: 'rgba(148, 163, 184, 0.16)', background: 'linear-gradient(135deg, rgba(15,23,42,0.96), rgba(15,23,42,0.78))', boxShadow: '0 24px 60px rgba(2, 6, 23, 0.32)' }}>
          <div className="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-4">
            <div>
              <Link to={`/clusters/${clusterId}/graph`} className="btn btn-outline-light btn-sm mb-3">Back to Attack Graph</Link>
              <div className="small text-uppercase text-muted mb-2" style={{ letterSpacing: '0.08em' }}>Persisted Attack Path Detail</div>
              <h1 className="h3 mb-2">Risky path from {entry.name} to {target.name}</h1>
              <p className="mb-0 text-muted" style={{ maxWidth: 840 }}>
                <span className="fw-semibold" style={{ color: riskMeta.background }}>{riskMeta.label}</span>
                {' '}risk path reaching{' '}
                <span className="text-light fw-semibold">{target.name}</span>
                {' '}from{' '}
                <span className="text-light fw-semibold">{entry.name}</span>
                {' '}through {path.hop_count ?? '-'} hops and {steps.length} transitions.
              </p>
            </div>
            <div className="d-flex flex-wrap gap-2 align-items-center">
              <RiskLevelBadge level={path.risk_level} />
              {threatLabel ? <span className="dg-badge dg-badge--notable">{threatLabel}</span> : null}
              <span className="dg-badge dg-badge--tag">{path.hop_count ?? '-'} hops</span>
              <span className="dg-badge dg-badge--tag">risk score {formatDecimal(path.risk_score)}</span>
            </div>
          </div>

          <div className="d-flex flex-wrap gap-3 align-items-start">
            <StatChip label="Entry Node" value={<NodeIdentity value={path.entry_node_id} compact />} />
            <StatChip label="Target Node" value={<NodeIdentity value={path.target_node_id} compact showThreat />} />
            <StatChip label="Raw Final Risk" value={formatDecimal(path.raw_final_risk)} />
            <StatChip label="Generated At" value={formatDateTime(envelope?.generated_at)} />
          </div>
        </section>

        <div className="row g-4 align-items-start">
          <div className="col-12 col-xl-8">
            <section className="card border-0 shadow-sm h-100" style={{ minHeight: 560, background: '#0f172a' }}>
              <div className="card-body p-4">
                <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
                  <div>
                    <div className="small text-uppercase text-muted mb-1" style={{ letterSpacing: '0.08em' }}>Attack Path Graph</div>
                    <h2 className="h5 mb-0">Overview-style path visualization</h2>
                  </div>
                  <div className="d-flex flex-wrap gap-2">
                    <span className="dg-badge dg-badge--tag">{nodeIds.length} nodes</span>
                    <span className="dg-badge dg-badge--tag">{steps.length} edges</span>
                  </div>
                </div>
                <div className="rounded-4 border overflow-hidden" style={{ height: 460, borderColor: 'rgba(148, 163, 184, 0.14)', background: 'radial-gradient(circle at top, rgba(59,130,246,0.08), transparent 35%), rgba(2, 6, 23, 0.5)' }}>
                  {graphElements.length === 0 ? (
                    <div className="h-100 d-flex align-items-center justify-content-center text-muted">No graph data was returned for this path.</div>
                  ) : (
                    <Suspense fallback={<PageLoader label="Rendering graph..." minHeight="100%" compact />}>
                      <GraphView
                        elements={graphElements}
                        layout={graphLayout}
                        stylesheet={detailGraphStylesheet}
                        viewportRefreshKey={`${clusterId}:${path.path_id}:${graphElements.length}`}
                        selectedPathNodeIds={nodeIds}
                        selectedPathEdgeIds={steps.map((step) => step.id)}
                        selectedNodeId={selectedNode?.id ?? null}
                        selectedEdgeId={selectedEdge?.id ?? null}
                        showLabels
                        onNodeClick={(node) => {
                          setSelectedEdge(null);
                          setSelectedNode(node);
                        }}
                        onEdgeClick={(edge) => {
                          setSelectedNode(null);
                          setSelectedEdge(edge);
                        }}
                      />
                    </Suspense>
                  )}
                </div>
                {(selectedNode || selectedEdge) ? (
                  <div className="mt-3 rounded-4 border p-3" style={{ borderColor: 'rgba(148, 163, 184, 0.16)', background: 'rgba(15, 23, 42, 0.56)' }}>
                    <div className="small text-uppercase text-muted mb-2" style={{ letterSpacing: '0.06em' }}>Focused Selection</div>
                    {selectedNode ? (
                      <div className="d-flex flex-column gap-2">
                        <NodeIdentity value={selectedNode.id} showRaw />
                        <div className="small text-muted">Selected node from the active persisted attack path.</div>
                      </div>
                    ) : selectedEdge ? (
                      <div className="d-flex flex-column gap-2">
                        <div className="fw-semibold">{selectedEdge.label ?? selectedEdge.relation ?? selectedEdge.id}</div>
                        <div className="small text-muted text-break">{selectedEdge.sourceLabel ?? selectedEdge.source} {'->'} {selectedEdge.targetLabel ?? selectedEdge.target}</div>
                        {selectedEdge.reason ? <div className="small text-muted">{selectedEdge.reason}</div> : null}
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </section>
          </div>

          <div className="col-12 col-xl-4">
            <div className="d-flex flex-column gap-4">
              <section className="card border-0 shadow-sm" style={{ background: '#0f172a' }}>
                <div className="card-body p-4 d-flex flex-column gap-3">
                  <div>
                    <div className="small text-uppercase text-muted mb-1" style={{ letterSpacing: '0.08em' }}>Impact Summary</div>
                    <h2 className="h5 mb-0">Why this path matters</h2>
                  </div>
                  <p className="mb-0 text-muted">
                    {entry.name} can reach {target.name} over {path.hop_count ?? '-'} hops.
                    {threatLabel ? ` The target impact is ${threatLabel.toLowerCase()}.` : ''}
                  </p>
                  <div className="d-flex flex-wrap gap-2">
                    <span className="dg-badge dg-badge--tag">{target.name}</span>
                    <span className="dg-badge dg-badge--tag">{nodeIds.length} path nodes</span>
                    {threatLabel ? <span className="dg-badge dg-badge--notable">{threatLabel}</span> : null}
                  </div>
                </div>
              </section>

              <section className="card border-0 shadow-sm" style={{ background: '#0f172a' }}>
                <div className="card-body p-4 d-flex flex-column gap-3">
                  <div>
                    <div className="small text-uppercase text-muted mb-1" style={{ letterSpacing: '0.08em' }}>Detail Summary</div>
                    <h2 className="h5 mb-0">Core persisted fields</h2>
                  </div>
                  <DetailRow label="Cluster ID" value={envelope?.cluster_id ?? '-'} />
                  <DetailRow label="Path ID" value={<code>{path.path_id}</code>} />
                  <DetailRow label="Risk Score" value={formatDecimal(path.risk_score)} />
                  <DetailRow label="Raw Final Risk" value={formatDecimal(path.raw_final_risk)} />
                  <DetailRow label="Analysis Run ID" value={envelope?.analysis_run_id ?? '-'} />
                  <DetailRow label="Generated At" value={formatDateTime(envelope?.generated_at)} />
                  <DetailRow label="Entry Identifier" value={<code>{path.entry_node_id ?? '-'}</code>} />
                  <DetailRow label="Target Identifier" value={<code>{path.target_node_id ?? '-'}</code>} />
                </div>
              </section>
            </div>
          </div>
        </div>

        <section className="card border-0 shadow-sm" style={{ background: '#0f172a' }}>
          <div className="card-body p-4">
            <div className="small text-uppercase text-muted mb-1" style={{ letterSpacing: '0.08em' }}>Path Progression</div>
            <h2 className="h5 mb-3">Ordered step narrative</h2>
            {steps.length === 0 ? (
              <div className="text-muted">No ordered edge sequence was returned.</div>
            ) : (
              <div className="d-flex flex-column gap-3">
                {steps.map((step) => (
                  <div key={step.id} className="rounded-4 border p-3" style={{ borderColor: 'rgba(148, 163, 184, 0.14)', background: 'rgba(15, 23, 42, 0.42)' }}>
                    <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-2">
                      <span className="small text-uppercase text-muted" style={{ letterSpacing: '0.06em' }}>Step {step.index + 1}</span>
                      <span className="dg-badge dg-badge--tag">{step.label}</span>
                    </div>
                    <div className="fw-semibold mb-2">
                      {parseAttackPathNode(step.sourceId).name} {step.label.toLowerCase()} {parseAttackPathNode(step.targetId).name}
                    </div>
                    <div className="row g-3">
                      <div className="col-12 col-md-6"><NodeIdentity value={step.sourceId} compact /></div>
                      <div className="col-12 col-md-6"><NodeIdentity value={step.targetId} compact showThreat={step.index === steps.length - 1} /></div>
                    </div>
                    {step.reason ? <div className="small text-muted mt-2">{step.reason}</div> : null}
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        <details className="card border-0 shadow-sm" style={{ background: '#0f172a' }}>
          <summary className="card-body p-4 fw-semibold" style={{ cursor: 'pointer' }}>Advanced Details</summary>
          <div className="card-body pt-0 px-4 pb-4">
            <div className="row g-4">
              <div className="col-12 col-lg-5">
                <div className="small text-uppercase text-muted mb-2" style={{ letterSpacing: '0.06em' }}>Ordered Nodes</div>
                {nodeIds.length === 0 ? (
                  <div className="text-muted">No ordered node list was returned.</div>
                ) : (
                  <div className="d-flex flex-column gap-2">
                    {nodeIds.map((nodeId, index) => (
                      <div key={nodeId} className="rounded-4 border p-2" style={{ borderColor: 'rgba(148, 163, 184, 0.12)', background: 'rgba(15, 23, 42, 0.4)' }}>
                        <div className="small text-muted mb-1">Node {index + 1}</div>
                        <NodeIdentity value={nodeId} compact showRaw />
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="col-12 col-lg-7">
                <div className="small text-uppercase text-muted mb-2" style={{ letterSpacing: '0.06em' }}>Edge Sequence</div>
                {Array.isArray(path.edges) && path.edges.length > 0 ? (
                  <div className="table-responsive">
                    <table className="table table-dark table-sm align-middle mb-0">
                      <thead>
                        <tr>
                          <th>Step</th>
                          <th>Relation</th>
                          <th>Flow</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[...path.edges].sort((a, b) => a.edge_index - b.edge_index).map((edge) => (
                          <tr key={edge.edge_id}>
                            <td>{edge.edge_index + 1}</td>
                            <td>{formatEdgeTypeLabel(edge.edge_type)}</td>
                            <td className="text-break">{parseAttackPathNode(edge.source_node_id).name} {'->'} {parseAttackPathNode(edge.target_node_id).name}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-muted">No persisted edge sequence was returned.</div>
                )}
              </div>
            </div>
          </div>
        </details>
      </div>
    </div>
  );
};

export default AttackPathDetailPage;
