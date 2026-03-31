import type { ElementDefinition } from 'cytoscape';
import type { DagreLayoutOptions } from 'cytoscape-dagre';
import type { AttackPathDetailResponse } from '../api/model';
import type { AttackPathVisualNodeType } from '../components/graph/attackPathVisuals';

export type ParsedNodeId = {
  type: AttackPathVisualNodeType;
  displayName: string;
  fullId: string;
};

const normalizeParsedType = (rawType: string): AttackPathVisualNodeType => {
  const normalized = rawType.trim().toLowerCase();

  if (normalized === 'pod') return 'pod';
  if (normalized === 'service') return 'service';
  if (normalized === 'ingress') return 'ingress';
  if (normalized === 'sa' || normalized === 'serviceaccount' || normalized === 'service_account') {
    return 'sa';
  }
  if (normalized === 'clusterrole' || normalized === 'cluster_role') return 'cluster_role';
  if (normalized === 'role') return 'role';
  if (normalized === 'secret') return 'secret';
  if (normalized === 'node') return 'node';
  if (normalized.startsWith('iam')) return 'iam';
  if (normalized.startsWith('s3')) return 's3';
  if (normalized.startsWith('rds')) return 'rds';

  return 'unknown';
};

const toCytoscapeNodeType = (type: AttackPathVisualNodeType): string => {
  switch (type) {
    case 'pod':
      return 'Pod';
    case 'sa':
      return 'ServiceAccount';
    case 'iam':
      return 'IAMRole';
    case 's3':
      return 'S3';
    case 'rds':
      return 'RDS';
    case 'ingress':
      return 'Ingress';
    case 'service':
      return 'Service';
    case 'cluster_role':
      return 'ClusterRole';
    case 'role':
      return 'Role';
    case 'secret':
      return 'Secret';
    case 'node':
      return 'Node';
    default:
      return 'Unknown';
  }
};

export const parseNodeId = (nodeId: string): ParsedNodeId => {
  const fullId = typeof nodeId === 'string' && nodeId.trim() ? nodeId.trim() : '-';
  const segments = fullId.split(':').filter(Boolean);
  const type = normalizeParsedType(segments[0] ?? 'unknown');
  const displayName = segments[segments.length - 1] ?? fullId;

  return {
    type,
    displayName,
    fullId,
  };
};

const getOrderedUniqueNodeIds = (path: AttackPathDetailResponse): string[] => {
  const ordered: string[] = [];
  const seen = new Set<string>();

  for (const edge of Array.isArray(path.edges) ? path.edges : []) {
    for (const nodeId of [edge.source_node_id, edge.target_node_id]) {
      if (!nodeId || seen.has(nodeId)) {
        continue;
      }

      seen.add(nodeId);
      ordered.push(nodeId);
    }
  }

  if (ordered.length > 0) {
    return ordered;
  }

  for (const nodeId of Array.isArray(path.node_ids) ? path.node_ids : []) {
    if (!nodeId || seen.has(nodeId)) {
      continue;
    }

    seen.add(nodeId);
    ordered.push(nodeId);
  }

  return ordered;
};

export const buildCytoscapeElements = (path: AttackPathDetailResponse): ElementDefinition[] => {
  const nodes: ElementDefinition[] = getOrderedUniqueNodeIds(path).map((nodeId) => {
    const parsed = parseNodeId(nodeId);

    return {
      data: {
        id: nodeId,
        label: parsed.displayName,
        fullLabel: parsed.fullId,
        type: toCytoscapeNodeType(parsed.type),
        attackPathType: parsed.type,
      },
    };
  });

  const edges: ElementDefinition[] = (Array.isArray(path.edges) ? path.edges : []).map((edge) => ({
    data: {
      id: edge.edge_id,
      source: edge.source_node_id,
      target: edge.target_node_id,
      relation: edge.edge_type,
      label: getEdgeTypeLabel(edge.edge_type),
    },
  }));

  return [...nodes, ...edges];
};

export const getImpactLabel = (targetNodeType: string): string => {
  switch (targetNodeType) {
    case 'iam':
      return '권한 상승';
    case 's3':
    case 'rds':
      return '데이터 유출';
    default:
      return '측면 이동';
  }
};

export const getRiskColor = (riskLevel: string): 'danger' | 'warning' | 'success' => {
  switch ((riskLevel ?? '').toLowerCase()) {
    case 'high':
    case 'critical':
      return 'danger';
    case 'medium':
      return 'warning';
    default:
      return 'success';
  }
};

export const getEdgeTypeLabel = (edgeType: string): string => {
  switch (edgeType) {
    case 'pod_uses_service_account':
      return '서비스 어카운트 사용';
    case 'service_account_assumes_iam_role':
      return 'IAM 역할 획득';
    case 'iam_role_access_resource':
      return '리소스 직접 접근';
    case 'ingress_exposes_service':
      return '외부 노출';
    case 'service_targets_pod':
      return '서비스 대상';
    case 'lateral_move':
      return '측면 이동';
    case 'role_grants_resource':
      return '권한 부여';
    case 'service_account_bound_cluster_role':
      return '클러스터 역할 바인딩';
    default:
      return edgeType;
  }
};

export const getOrderedUniquePathNodes = (path: AttackPathDetailResponse): ParsedNodeId[] =>
  getOrderedUniqueNodeIds(path).map(parseNodeId);

export const attackPathDetailGraphLayout: DagreLayoutOptions = {
  name: 'dagre',
  rankDir: 'LR',
  nodeSep: 80,
  rankSep: 120,
  fit: true,
  padding: 60,
};
