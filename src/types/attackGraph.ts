export type AttackGraphResourceType =
  | 'Ingress'
  | 'Pod'
  | 'ServiceAccount'
  | 'Role'
  | 'ClusterRole'
  | 'RoleBinding'
  | 'ClusterRoleBinding'
  | 'Secret'
  | 'Service'
  | 'Node'
  | 'ContainerImage'
  | 'IAMRole'
  | 'IAMUser'
  | 'EC2Instance'
  | 'SecurityGroup'
  | 'S3'
  | 'RDS'
  | 'Unknown';

export type AttackGraphRiskSeverity = 'critical' | 'high' | 'medium' | 'low' | 'unknown';

export type AttackGraphEdgeRelation =
  | 'uses'
  | 'bound_to'
  | 'grants'
  | 'escapes_to'
  | 'assumes'
  | 'accesses'
  | 'allows'
  | 'runs'
  | 'unknown';

export interface AttackGraphNodeMarkerFlags {
  isEntryPoint: boolean;
  isCrownJewel: boolean;
}

export interface AttackGraphNodeRuntimeState {
  hasEvidence: boolean;
}

export interface AttackGraphNode {
  id: string;
  label: string;
  resourceType: AttackGraphResourceType;
  namespace?: string | null;
  severity: AttackGraphRiskSeverity;
  markerFlags: AttackGraphNodeMarkerFlags;
  runtime: AttackGraphNodeRuntimeState;
  details: Record<string, string>;
  /** Backend data preserved for later feature usage (detail panel and debugging). */
  raw: Record<string, unknown>;
}

export interface AttackGraphEdge {
  id: string;
  source: string;
  target: string;
  relationType: AttackGraphEdgeRelation;
  label?: string;
  /** Backend data preserved for later feature usage (detail panel and debugging). */
  raw: Record<string, unknown>;
}

export interface AttackGraphPath {
  id: string;
  label?: string;
  nodeIds: string[];
  edgeIds: string[];
  severity?: AttackGraphRiskSeverity;
  raw: Record<string, unknown>;
}

export interface AttackGraphMetadata {
  clusterId?: string | null;
  scanId?: string | null;
  generatedAt?: string | null;
  source?: string | null;
}

export interface AttackGraphGraphData {
  nodes: AttackGraphNode[];
  edges: AttackGraphEdge[];
  paths: AttackGraphPath[];
  metadata?: AttackGraphMetadata;
}

export interface CytoscapeElementModel {
  data: Record<string, string | number | boolean | string[] | null>;
  classes?: string | string[];
}

export interface AttackGraphElements {
  elements: CytoscapeElementModel[];
}

export interface AttackGraphGraphViewModel {
  graph: AttackGraphGraphData;
  elements: AttackGraphElements;
  raw: AttackGraphApiResponse;
}

export interface AttackGraphApiNode {
  id: string;
  label?: string;
  resource_type?: string;
  namespace?: string | null;
  severity?: string | null;
  is_entry_point?: boolean;
  is_crown_jewel?: boolean;
  has_runtime_evidence?: boolean;
  details?: Record<string, unknown>;
}

export interface AttackGraphApiEdge {
  id: string;
  source: string;
  target: string;
  relation?: string;
  label?: string;
}

export interface AttackGraphApiPath {
  id: string;
  label?: string;
  node_ids?: string[];
  edge_ids?: string[];
  severity?: string | null;
}

export interface AttackGraphApiResponse {
  nodes: AttackGraphApiNode[];
  edges: AttackGraphApiEdge[];
  paths?: AttackGraphApiPath[];
  metadata?: AttackGraphMetadata;
}

export interface AttackGraphFilters {
  nodeTypes?: AttackGraphResourceType[];
  relationTypes?: AttackGraphEdgeRelation[];
  severities?: AttackGraphRiskSeverity[];
  runtimeEvidenceOnly?: boolean;
  search?: string;
}
