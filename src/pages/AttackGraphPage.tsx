import React, { useEffect, useMemo, useState } from 'react';
import GraphView from '../components/graph/GraphView';
import NodeDetailPanel from '../components/graph/NodeDetailPanel';
import BlastRadiusPanel from '../components/graph/BlastRadiusPanel';
import GraphFilters from '../components/graph/GraphFilters';
import type { NodeData, NodeType } from '../components/graph/mockGraphData';
import { mockElements } from '../components/graph/mockGraphData';
import {
  toAttackGraphViewModel,
  filterAttackGraphElements,
  toAttackGraphElements,
  type AttackGraphApiEdge,
  type AttackGraphApiNode,
  type AttackGraphApiResponse,
  type AttackGraphEdgeRelation,
  type AttackGraphPath,
  type AttackGraphFilters,
  type AttackGraphResourceType,
  type AttackGraphRiskSeverity,
} from '../components/graph/attackGraph';
import type { ElementDefinition } from 'cytoscape';

const LARGE_GRAPH_THRESHOLD = 180;

type SelectionMode = 'none' | 'path' | 'node' | 'edge';

interface EdgeData {
  id: string;
  source: string;
  target: string;
  label?: string;
  relation?: string;
}

const mapLegacyTypeToAttackGraphType = (nodeType: string): string => {
  if (nodeType === 'S3Bucket') return 'S3';
  return nodeType;
};

const mapLegacyNodeToPanelNode = (node: Record<string, unknown>): NodeData | null => {
  if (!node || typeof node !== 'object') return null;

  const detailsValue = node.details as Record<string, unknown> | undefined;
  const blastRadiusValue = node.blastRadius as NodeData['blastRadius'] | undefined;
  const id = typeof node.id === 'string' ? node.id : '';
  if (!id) return null;

  return {
    id,
    label: typeof node.label === 'string' ? node.label : String(node.id),
    type: String(node.type ?? '') as NodeType,
    namespace: typeof node.namespace === 'string' ? node.namespace : undefined,
    details:
      detailsValue && typeof detailsValue === 'object'
        ? (Object.entries(detailsValue).reduce<Record<string, string>>((acc, [key, value]) => {
            acc[key] = value == null ? '' : String(value);
            return acc;
          }, {} as Record<string, string>))
        : {},
    blastRadius:
      blastRadiusValue && typeof blastRadiusValue === 'object'
        ? blastRadiusValue
        : { pods: 0, secrets: 0, databases: 0, adminPrivilege: false },
  };
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
        label: 'Attack path from Pod to S3',
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

const AttackGraphPage: React.FC = () => {
  const [filters, setFilters] = useState<AttackGraphFilters>({});
  const [selectedNode, setSelectedNode] = useState<NodeData | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<EdgeData | null>(null);
  const [selectedPathId, setSelectedPathId] = useState<string | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [selectedMode, setSelectedMode] = useState<SelectionMode>('none');
  const attackGraphViewModel = useMemo(() => toAttackGraphViewModel(toAttackGraphPayload), []);

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
    for (const element of mockElements) {
      if (typeof element.data === 'object' && element.data !== null && !('source' in element.data)) {
        const mapped = mapLegacyNodeToPanelNode(element.data as Record<string, unknown>);
        if (mapped) {
          map.set(mapped.id, mapped);
        }
      }
    }
    return map;
  }, []);

  const shouldShowNodeDetails = selectedMode === 'node' && selectedNode;
  const shouldShowEdgeDetails = selectedMode === 'edge' && selectedEdge;

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-1">
        <div>
          <h1 className="h3 mb-1">Attack Graph</h1>
          <p className="dg-subtitle-text mb-0 small">Visualization of potential attack vectors.</p>
        </div>
      </div>

      <div className="card border-0 shadow-sm mb-1">
        <div className="card-body py-1 px-2">
          <GraphFilters
            filters={filters}
            availableResourceTypes={availableResourceTypes}
            availableEdgeRelations={availableEdgeRelations}
            availableSeverities={availableSeverities}
            onFiltersChange={setFilters}
          />
        </div>
      </div>

      <div className="card" style={{ height: 600, position: 'relative' }}>
        <div className="px-2 py-1 bg-light border-bottom small">
          <div className="d-flex align-items-center gap-2 flex-nowrap overflow-auto">
            <span className="text-muted fw-semibold">Attack Paths:</span>
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
                  {path.label || `Path ${path.id}`}
                </button>
              ))}
              {attackPaths.length === 0 ? <span className="text-muted">No paths available.</span> : null}
            </div>
          </div>
        </div>
        <GraphView
          showLabels={filteredGraph.nodes.length + filteredGraph.edges.length <= LARGE_GRAPH_THRESHOLD}
          elements={filteredElements}
          selectedPathNodeIds={selectedPathNodeIds}
          selectedPathEdgeIds={selectedPathEdgeIds}
          selectedNodeId={selectedNodeId}
          selectedEdgeId={selectedEdgeId}
          onNodeClick={(node) => {
            const clicked = selectedNodeLookup.get(String((node as { id?: unknown }).id ?? ''));
            setSelectedNode(clicked ?? null);
            setSelectedNodeId((node as { id?: unknown }).id ? String((node as { id?: unknown }).id) : null);
            setSelectedEdgeId(null);
            setSelectedEdge(null);
            setSelectedPathId(null);
            setSelectedMode('node');
          }}
          onEdgeClick={(edge) => {
            setSelectedEdge(edge);
            setSelectedEdgeId(edge.id);
            setSelectedNodeId(null);
            setSelectedNode(null);
            setSelectedPathId(null);
            setSelectedMode('edge');
          }}
        />
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
              <strong>Edge Details</strong>
              <button
                type="button"
                className="btn-close btn-close-white"
                aria-label="Close"
                onClick={() => {
                  setSelectedMode('none');
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
                    <td>{selectedEdge?.relation || 'n/a'}</td>
                  </tr>
                  <tr>
                    <td className="text-muted fw-semibold">Source</td>
                    <td>{selectedEdge?.source}</td>
                  </tr>
                  <tr>
                    <td className="text-muted fw-semibold">Target</td>
                    <td>{selectedEdge?.target}</td>
                  </tr>
                  <tr>
                    <td className="text-muted fw-semibold">Label</td>
                    <td>{selectedEdge?.label || selectedEdge?.id}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        ) : null}
      </div>

      <div className="mt-2 d-flex gap-3 flex-wrap">
        <span className="text-muted small">
          <strong>{filteredGraph.nodes.length}</strong> nodes ·
          <strong>{filteredGraph.edges.length}</strong> edges
        </span>
        <span className="text-muted small">
          Mode: <strong>{selectedMode}</strong>
          {selectedMode === 'node' && selectedNode ? ` · node ${selectedNode.label}` : null}
          {selectedMode === 'edge' && selectedEdge ? ` · edge ${selectedEdge.id}` : null}
          {selectedMode === 'path' && selectedPath ? ` · path ${selectedPath.label || selectedPath.id}` : null}
        </span>
      </div>

      {/* TODO Step5: advanced filters (critical paths only, escape-only, AWS pivot-only) are not supported by the current mock model */}
      {/* TODO Step5: cleanup of temporary compatibility bridges (legacy NodeData lookup and mock payload) */}
      {/* TODO Step5: replace static attack-graph mock payload with real API source */}
    </div>
  );
};

export default AttackGraphPage;
