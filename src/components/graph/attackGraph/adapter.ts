import type {
  AttackGraphApiResponse,
  AttackGraphApiPath,
  AttackGraphEdgeRelation,
  AttackGraphFilters,
  AttackGraphGraphData,
  AttackGraphGraphViewModel,
  AttackGraphMetadata,
  AttackGraphResourceType,
  AttackGraphRiskSeverity,
  AttackGraphNode,
  AttackGraphEdge,
  AttackGraphPath,
} from '../../../types/attackGraph';

import type { ElementDefinition } from 'cytoscape';

const UNKNOWN = 'unknown' as const;

const normalizeResourceType = (value?: string | null): AttackGraphResourceType => {
  if (!value) return 'Unknown';

  const normalized = value.toLowerCase();

  switch (normalized) {
    case 'ingress':
      return 'Ingress';
    case 'pod':
      return 'Pod';
    case 'serviceaccount':
      return 'ServiceAccount';
    case 'role':
      return 'Role';
    case 'clusterrole':
      return 'ClusterRole';
    case 'rolebinding':
      return 'RoleBinding';
    case 'clusterrolebinding':
      return 'ClusterRoleBinding';
    case 'secret':
      return 'Secret';
    case 'service':
      return 'Service';
    case 'node':
      return 'Node';
    case 'containerimage':
    case 'container_image':
    case 'container image':
      return 'ContainerImage';
    case 'iamrole':
    case 'iam_role':
      return 'IAMRole';
    case 'iamuser':
    case 'iam_user':
      return 'IAMUser';
    case 'ec2instance':
    case 'ec2_instance':
      return 'EC2Instance';
    case 'securitygroup':
    case 'security_group':
      return 'SecurityGroup';
    case 's3':
      return 'S3';
    case 'rds':
      return 'RDS';
    default:
      return 'Unknown';
  }
};

const normalizeSeverity = (value?: string | null): AttackGraphRiskSeverity => {
  if (!value) return 'unknown';

  const normalized = value.toLowerCase();

  if (normalized === 'critical') return 'critical';
  if (normalized === 'high') return 'high';
  if (normalized === 'medium') return 'medium';
  if (normalized === 'low') return 'low';

  return 'unknown';
};

const normalizeRelationType = (value?: string | null): AttackGraphEdgeRelation => {
  if (!value) return UNKNOWN;

  const normalized = value.toLowerCase();

  switch (normalized) {
    case 'uses':
    case 'bound_to':
    case 'boundto':
    case 'grants':
    case 'escapes_to':
    case 'assumes':
    case 'accesses':
    case 'allows':
    case 'runs':
      return normalized === 'boundto' ? 'bound_to' : (normalized as AttackGraphEdgeRelation);
    default:
      return UNKNOWN;
  }
};

const toStringRecord = (value: Record<string, unknown> | undefined): Record<string, string> => {
  if (!value) return {};

  return Object.fromEntries(
    Object.entries(value).map(([key, rawValue]) => [key, rawValue == null ? '' : String(rawValue)]),
  ) as Record<string, string>;
};

const toPathRecord = (
  raw: AttackGraphApiPath,
): { nodeIds: string[]; edgeIds: string[]; severity: AttackGraphRiskSeverity; label?: string } => {
  return {
    nodeIds: Array.isArray(raw.node_ids) ? raw.node_ids : [],
    edgeIds: Array.isArray(raw.edge_ids) ? raw.edge_ids : [],
    severity: normalizeSeverity(raw.severity),
    label: raw.label,
  };
};

export const toCytoscapeNode = (node: AttackGraphNode): ElementDefinition => {
  return {
    data: {
      id: node.id,
      label: node.label,
      type: node.resourceType,
      severity: node.severity,
      hasRuntimeEvidence: node.runtime.hasEvidence,
      isEntryPoint: node.markerFlags.isEntryPoint,
      isCrownJewel: node.markerFlags.isCrownJewel,
    },
  };
};

export const toCytoscapeEdge = (edge: AttackGraphEdge): ElementDefinition => {
  return {
    data: {
      id: edge.id,
      source: edge.source,
      target: edge.target,
      relation: edge.relationType,
      label: edge.label ?? edge.id,
    },
  };
};

const buildGraphData = (payload: AttackGraphApiResponse): AttackGraphGraphData => {
  const nodes = (payload.nodes ?? []).map((node) => ({
    id: node.id,
    label: node.label ?? node.id,
    resourceType: normalizeResourceType(node.resource_type),
    namespace: node.namespace ?? null,
    severity: normalizeSeverity(node.severity),
    markerFlags: {
      isEntryPoint: Boolean(node.is_entry_point),
      isCrownJewel: Boolean(node.is_crown_jewel),
    },
    runtime: {
      hasEvidence: Boolean(node.has_runtime_evidence),
    },
    details: toStringRecord(node.details),
    raw: node as unknown as Record<string, unknown>,
  }));

  const edges = (payload.edges ?? []).map((edge) => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
    relationType: normalizeRelationType(edge.relation),
    label: edge.label,
    raw: edge as unknown as Record<string, unknown>,
  }));

  const paths = (payload.paths ?? []).map((path) => ({
    id: path.id,
    label: path.label,
    nodeIds: toPathRecord(path).nodeIds,
    edgeIds: toPathRecord(path).edgeIds,
    severity: toPathRecord(path).severity,
    raw: path as unknown as Record<string, unknown>,
  }));

  return {
    nodes,
    edges,
    paths,
  };
};

export const toAttackGraphViewModel = (payload: AttackGraphApiResponse): AttackGraphGraphViewModel => {
  const graph = buildGraphData(payload);
  const elements: ElementDefinition[] = toAttackGraphElements(graph);

  return {
    graph,
    elements: {
      elements,
    },
    raw: payload,
  };
};

export const toAttackGraphElements = (graph: AttackGraphGraphData): ElementDefinition[] => {
  return [...graph.nodes.map(toCytoscapeNode), ...graph.edges.map(toCytoscapeEdge)];
};

export const isKnownEdgeRelation = (relation: string): relation is AttackGraphEdgeRelation => {
  const normalized = normalizeRelationType(relation);
  return normalized !== 'unknown';
};

export const getMetadata = (payload: AttackGraphApiResponse): AttackGraphMetadata => {
  return payload.metadata ?? {};
};

export const isKnownResourceType = (value?: string | null): value is AttackGraphResourceType => {
  return normalizeResourceType(value) !== 'Unknown';
};

const toSearchTokens = (value?: string): string[] => {
  if (!value) return [];

  const trimmed = value.trim().toLowerCase();
  if (!trimmed) return [];

  return trimmed.split(/\s+/).filter(Boolean);
};

export const filterAttackGraphElements = (
  graph: AttackGraphGraphData,
  filters: AttackGraphFilters,
): AttackGraphGraphData => {
  const nodeTypeFilter = new Set(filters.nodeTypes ?? []);
  const edgeTypeFilter = new Set(filters.relationTypes ?? []);
  const severityFilter = new Set(filters.severities ?? []);
  const searchTokens = toSearchTokens(filters.search);

  const includeNode = (node: AttackGraphNode): boolean => {
    const passesType = nodeTypeFilter.size === 0 || nodeTypeFilter.has(node.resourceType);
    const passesRisk = severityFilter.size === 0 || severityFilter.has(node.severity);
    const passesEvidence = !filters.runtimeEvidenceOnly || node.runtime.hasEvidence;
    if (!passesType || !passesRisk || !passesEvidence) return false;
    if (searchTokens.length === 0) return true;

    const searchable = `${node.id} ${node.label}`.toLowerCase();
    return searchTokens.every((token) => searchable.includes(token));
  };

  const filteredNodes = graph.nodes.filter(includeNode);
  const visibleNodeIds = new Set(filteredNodes.map((node) => node.id));
  const evidenceNodeIds = new Set(filteredNodes.filter((node) => node.runtime.hasEvidence).map((node) => node.id));

  const includeEdge = (edge: AttackGraphEdge): boolean => {
    if (!visibleNodeIds.has(edge.source) || !visibleNodeIds.has(edge.target)) return false;
    if (edgeTypeFilter.size > 0 && !edgeTypeFilter.has(edge.relationType)) return false;
    if (searchTokens.length === 0) return true;

    const searchable = `${edge.id} ${edge.label ?? ''} ${edge.relationType}`.toLowerCase();
    return searchTokens.every((token) => searchable.includes(token));
  };

  const filteredEdges = graph.edges.filter(includeEdge);
  const visibleEdgeIds = new Set(filteredEdges.map((edge) => edge.id));

  const filteredPaths: AttackGraphPath[] = graph.paths
    .filter((path) => {
      if (!path.nodeIds.every((id) => visibleNodeIds.has(id))) return false;
      if (!path.edgeIds.every((id) => visibleEdgeIds.has(id))) return false;

      if (severityFilter.size > 0 && path.severity && !severityFilter.has(path.severity)) return false;

      if (filters.runtimeEvidenceOnly) {
        const hasEvidenceInPath = path.nodeIds.some((id) => evidenceNodeIds.has(id));
        if (!hasEvidenceInPath) return false;
      }

      if (searchTokens.length === 0) return true;
      const searchable = `${path.id} ${path.label ?? ''}`.toLowerCase();
      return searchTokens.every((token) => searchable.includes(token));
    })
    .map((path) => ({ ...path }));

  return {
    nodes: filteredNodes,
    edges: filteredEdges,
    paths: filteredPaths,
    metadata: graph.metadata,
  };
};
