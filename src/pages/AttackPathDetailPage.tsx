import React, { useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useGetAttackPathDetailApiV1ClustersClusterIdAttackPathsPathIdGet } from '../api/generated/clusters/clusters';
import type {
  AttackPathDetailEnvelopeResponse,
  AttackPathDetailResponse,
  AttackPathEdgeSequenceResponse,
} from '../api/model';

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

const SummaryField: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
  <div className="col-12 col-md-6 col-xl-3">
    <div className="border rounded-3 p-3 h-100 bg-white">
      <div className="text-muted small mb-1">{label}</div>
      <div className="fw-semibold text-break">{value}</div>
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
  const steps = useMemo(() => {
    const edges = Array.isArray(path.edges) ? [...path.edges].sort((left, right) => left.edge_index - right.edge_index) : [];

    if (edges.length > 0) {
      return edges.map((edge, index) => {
        const nextNodeId = path.node_ids?.[index + 1] ?? edge.target_node_id;
        return {
          id: edge.edge_id,
          index,
          sourceNodeId: path.node_ids?.[index] ?? edge.source_node_id,
          targetNodeId: nextNodeId,
          edge,
        };
      });
    }

    const nodes = Array.isArray(path.node_ids) ? path.node_ids : [];
    return nodes.slice(0, -1).map((nodeId, index) => ({
      id: `${nodeId}-${nodes[index + 1] ?? index}`,
      index,
      sourceNodeId: nodeId,
      targetNodeId: nodes[index + 1] ?? '-',
      edge: null,
    }));
  }, [path]);

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
          {steps.map((step) => (
            <div key={step.id} className="border rounded-3 p-3 bg-white">
              <div className="small text-muted mb-2">Step {step.index + 1}</div>
              <div className="fw-semibold text-break">{step.sourceNodeId}</div>
              <div className="small text-muted my-2">
                {step.edge ? `${step.edge.edge_type} (${step.edge.edge_id})` : 'connects to'}
              </div>
              <div className="fw-semibold text-break">{step.targetNodeId}</div>
              {step.edge?.metadata && Object.keys(step.edge.metadata).length > 0 ? (
                <div className="mt-3">
                  <div className="small text-muted mb-1">Edge Metadata</div>
                  <pre className="mb-0 small text-wrap" style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                    {renderValue(step.edge.metadata)}
                  </pre>
                </div>
              ) : null}
            </div>
          ))}
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
                <td>{edge.edge_type}</td>
                <td className="text-break">{edge.source_node_id}</td>
                <td className="text-break">{edge.target_node_id}</td>
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
  const query = useGetAttackPathDetailApiV1ClustersClusterIdAttackPathsPathIdGet(clusterId, pathId, {
    query: {
      enabled: Boolean(clusterId && pathId),
      retry: false,
    },
  });

  const envelope = isAttackPathDetailEnvelope(query.data) ? query.data : null;
  const path = envelope?.path ?? null;
  const orderedEdges = Array.isArray(path?.edges)
    ? [...path.edges].sort((left, right) => left.edge_index - right.edge_index)
    : [];
  const nodeIds = Array.isArray(path?.node_ids) ? path.node_ids : [];
  const edgeIds = Array.isArray(path?.edge_ids) ? path.edge_ids : [];

  if (query.isLoading) {
    return (
      <div className="container-fluid py-4">
        <div className="card border-0 shadow-sm">
          <div className="card-body py-5 text-center text-muted">Attack path detail loading…</div>
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
            <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => query.refetch()}>
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
              <Link to={`/clusters/${clusterId}/graph`} className="btn btn-outline-secondary btn-sm">
                Back to Attack Graph
              </Link>
            ) : null}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container-fluid py-4">
      <div className="d-flex flex-wrap justify-content-between align-items-start gap-3 mb-4">
        <div>
          <div className="text-muted small text-uppercase mb-2">Attack Path Detail</div>
          <h1 className="h3 mb-2 text-break">{path.title || path.path_id}</h1>
          <div className="text-muted small text-break">
            Cluster <strong>{envelope.cluster_id}</strong> / Path <strong>{path.path_id}</strong>
          </div>
        </div>
        {clusterId ? (
          <Link to={`/clusters/${clusterId}/graph`} className="btn btn-outline-secondary btn-sm">
            Back to Attack Graph
          </Link>
        ) : null}
      </div>

      <div className="row g-3 mb-4">
        <SummaryField label="Cluster ID" value={envelope.cluster_id} />
        <SummaryField label="Path ID" value={path.path_id} />
        <SummaryField label="Risk Level" value={path.risk_level} />
        <SummaryField label="Risk Score" value={formatNumber(path.risk_score)} />
        <SummaryField label="Raw Final Risk" value={formatNumber(path.raw_final_risk)} />
        <SummaryField label="Hop Count" value={formatNumber(path.hop_count)} />
        <SummaryField label="Entry Node" value={path.entry_node_id ?? '-'} />
        <SummaryField label="Target Node" value={path.target_node_id ?? '-'} />
        <SummaryField label="Analysis Run ID" value={envelope.analysis_run_id ?? '-'} />
        <SummaryField label="Generated At" value={formatDateTime(envelope.generated_at)} />
      </div>

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
