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

const normalizeToken = (value?: string | null): string => {
  if (!value) return '';

  return value.trim().toLowerCase().replace(/[\s-]+/g, '_');
};

const normalizeResourceType = (value?: string | null): AttackGraphResourceType => {
  if (!value) return 'Unknown';

  const normalized = normalizeToken(value);

  switch (normalized) {
    case 'ingress':
      return 'Ingress';
    case 'pod':
      return 'Pod';
    case 'service_account':
    case 'serviceaccount':
      return 'ServiceAccount';
    case 'role':
      return 'Role';
    case 'cluster_role':
    case 'clusterrole':
      return 'ClusterRole';
    case 'role_binding':
    case 'rolebinding':
      return 'RoleBinding';
    case 'cluster_role_binding':
    case 'clusterrolebinding':
      return 'ClusterRoleBinding';
    case 'secret':
      return 'Secret';
    case 'service':
      return 'Service';
    case 'node':
      return 'Node';
    case 'container_image':
    case 'containerimage':
      return 'ContainerImage';
    case 'iam_role':
    case 'iamrole':
      return 'IAMRole';
    case 'iam_user':
    case 'iamuser':
      return 'IAMUser';
    case 'ec2_instance':
    case 'ec2instance':
      return 'EC2Instance';
    case 'security_group':
    case 'securitygroup':
      return 'SecurityGroup';
    case 's3':
    case 's3_bucket':
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
  if (normalized === 'none') return 'none';

  return 'unknown';
};

const normalizeRelationType = (value?: string | null): AttackGraphEdgeRelation => {
  if (!value) return UNKNOWN;

  const normalized = normalizeToken(value);

  switch (normalized) {
    case 'boundto':
      return 'bound_to';
    default:
      return normalized || UNKNOWN;
  }
};

const toSearchableString = (value: unknown): string => {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);

  if (Array.isArray(value)) {
    return value
      .map((item) => toSearchableString(item))
      .filter(Boolean)
      .join(', ');
  }

  if (typeof value === 'object') {
    try {
      return JSON.stringify(value);
    } catch {
      return '[unserializable]';
    }
  }

  return String(value);
};

const toStringRecord = (value: Record<string, unknown> | undefined): Record<string, string> => {
  if (!value) return {};

  return Object.fromEntries(
    Object.entries(value).map(([key, rawValue]) => [key, toSearchableString(rawValue)]),
  ) as Record<string, string>;
};

const toPathRecord = (
  raw: AttackGraphApiPath,
): { nodeIds: string[]; edgeIds: string[]; severity: AttackGraphRiskSeverity; label?: string } => {
  return {
    nodeIds: Array.isArray(raw.node_ids) ? raw.node_ids : [],
    edgeIds: Array.isArray(raw.edge_ids) ? raw.edge_ids : [],
    severity: normalizeSeverity(raw.severity),
    label: raw.label ?? raw.title ?? raw.summary,
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
    resourceType: normalizeResourceType(node.resource_type ?? node.type),
    namespace:
      node.namespace ??
      (typeof node.metadata?.namespace === 'string' ? node.metadata.namespace : null),
    severity: normalizeSeverity(node.severity),
    markerFlags: {
      isEntryPoint: Boolean(node.is_entry_point),
      isCrownJewel: Boolean(node.is_crown_jewel),
    },
    runtime: {
      hasEvidence: Boolean(node.has_runtime_evidence),
    },
    details: toStringRecord({
      ...(node.details ?? {}),
      ...(node.metadata ?? {}),
      ...(typeof node.evidence_count === 'number' ? { evidence_count: node.evidence_count } : {}),
    }),
    raw: node as unknown as Record<string, unknown>,
  }));

  const edges = (payload.edges ?? []).map((edge) => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
    relationType: normalizeRelationType(edge.relation ?? edge.type),
    label: edge.label ?? edge.relation ?? edge.type,
    raw: edge as unknown as Record<string, unknown>,
  }));

  const paths = (payload.paths ?? []).map((path) => {
    const normalizedPath = toPathRecord(path);

    return {
      id: path.id,
      label: normalizedPath.label,
      nodeIds: normalizedPath.nodeIds,
      edgeIds: normalizedPath.edgeIds,
      severity: normalizedPath.severity,
      raw: path as unknown as Record<string, unknown>,
    };
  });

  return {
    nodes,
    edges,
    paths,
    metadata: payload.metadata,
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

export const filterIsolatedAttackGraphNodes = (
  graph: AttackGraphGraphData,
  options?: {
    includeIsolatedNodes?: boolean;
  },
): AttackGraphGraphData => {
  if (options?.includeIsolatedNodes) {
    return graph;
  }

  const connectedNodeIds = new Set<string>();

  for (const edge of graph.edges) {
    connectedNodeIds.add(edge.source);
    connectedNodeIds.add(edge.target);
  }

  return {
    ...graph,
    nodes: graph.nodes.filter((node) => connectedNodeIds.has(node.id)),
  };
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
    if (!passesType || !passesRisk) return false;
    if (searchTokens.length === 0) return true;

    const searchable = `${node.id} ${node.label}`.toLowerCase();
    return searchTokens.every((token) => searchable.includes(token));
  };

  const filteredNodes = graph.nodes.filter(includeNode);
  const visibleNodeIds = new Set(filteredNodes.map((node) => node.id));

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
