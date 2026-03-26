import React from 'react';
import type { AttackGraphEdgeRelation, AttackGraphFilters, AttackGraphResourceType, AttackGraphRiskSeverity } from './attackGraph';
import { nodeTypeIcons } from './mockGraphData';

const SeverityColor: Record<string, string> = {
  critical: '#dc2626',
  high: '#f97316',
  medium: '#eab308',
  low: '#16a34a',
  unknown: '#6c757d',
};

const ResourceLabel: Record<AttackGraphResourceType, string> = {
  Ingress: 'Ingress',
  Pod: 'Pod',
  ServiceAccount: 'ServiceAccount',
  Role: 'Role',
  ClusterRole: 'ClusterRole',
  RoleBinding: 'RoleBinding',
  ClusterRoleBinding: 'ClusterRoleBinding',
  Secret: 'Secret',
  Service: 'Service',
  Node: 'Node',
  ContainerImage: 'ContainerImage',
  IAMRole: 'IAMRole',
  IAMUser: 'IAMUser',
  EC2Instance: 'EC2',
  SecurityGroup: 'SecurityGroup',
  S3: 'S3',
  RDS: 'RDS',
  Unknown: 'Unknown',
};

const ResourceIcon: Record<AttackGraphResourceType, string> = {
  Ingress: '🚪',
  Pod: nodeTypeIcons.Pod,
  ServiceAccount: '👤',
  Role: '🧩',
  ClusterRole: '🧩',
  RoleBinding: '🔗',
  ClusterRoleBinding: '🔗',
  Secret: '🔒',
  Service: '🧪',
  Node: '🖧',
  ContainerImage: '🧱',
  IAMRole: '🔑',
  IAMUser: '👥',
  EC2Instance: '🖥️',
  SecurityGroup: '🛡️',
  S3: '🪣',
  RDS: '🗄️',
  Unknown: '❔',
};

const PRIORITY_EDGE_TYPES = [
  'service_targets_pod',
  'pod_uses_service_account',
  'service_account_assumes_iam_role',
  'secret_contains_credentials',
  'iam_role_access_resource',
] as const;
const PRIORITY_EDGE_TYPE_SET = new Set<string>(PRIORITY_EDGE_TYPES);

const formatRelationLabel = (relation: string) =>
  relation
    .replace(/_/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2');

interface GraphFiltersProps {
  filters: AttackGraphFilters;
  availableResourceTypes: AttackGraphResourceType[];
  availableEdgeRelations: AttackGraphEdgeRelation[];
  availableSeverities: AttackGraphRiskSeverity[];
  onFiltersChange: (next: AttackGraphFilters) => void;
}

const GraphFilters: React.FC<GraphFiltersProps> = ({
  filters,
  availableResourceTypes,
  availableEdgeRelations,
  availableSeverities,
  onFiltersChange,
}) => {
  const toggle = <T extends string>(value: T, selected: T[] = [], on: (next: T[]) => void) => {
    if (selected.includes(value)) {
      on(selected.filter((item) => item !== value));
    } else {
      on([...selected, value]);
    }
  };

  const updateNodeTypes = (next: AttackGraphResourceType[]) => {
    onFiltersChange({
      ...filters,
      nodeTypes: next,
    });
  };

  const updateRelations = (next: AttackGraphEdgeRelation[]) => {
    onFiltersChange({
      ...filters,
      relationTypes: next,
    });
  };

  const updateSeverities = (next: AttackGraphRiskSeverity[]) => {
    onFiltersChange({
      ...filters,
      severities: next,
    });
  };

  const updateSearch = (next: string) => {
    onFiltersChange({
      ...filters,
      search: next,
    });
  };

  const toggleRuntimeOnly = (checked: boolean) => {
    onFiltersChange({
      ...filters,
      runtimeEvidenceOnly: checked,
    });
  };

  const edgeRelationOptions = [
    ...PRIORITY_EDGE_TYPES.filter((relation) => availableEdgeRelations.includes(relation)),
    ...availableEdgeRelations.filter((relation) => !PRIORITY_EDGE_TYPE_SET.has(relation)),
  ];

  const groupDividerStyle: React.CSSProperties = {
    paddingRight: '0.9rem',
    marginRight: '0.9rem',
    borderRight: `1px solid var(--bs-border-color, #dee2e6)`,
  };

  return (
    <div className="d-flex align-items-center gap-3 small flex-wrap">
      <div className="d-flex align-items-center gap-1" style={groupDividerStyle}>
        <span className="text-muted fw-semibold">Resource:</span>
        {availableResourceTypes.map((type) => {
          const active = filters.nodeTypes?.includes(type) ?? false;
          return (
            <button
              key={type}
              type="button"
              onClick={() => toggle(type, filters.nodeTypes ?? [], updateNodeTypes)}
              className={`btn btn-sm py-0 px-2 ${active ? 'btn-primary' : 'btn-outline-primary'}`}
              aria-pressed={active}
            >
              <span className="me-1" aria-hidden="true">
                {ResourceIcon[type] ?? '◉'}
              </span>
              {ResourceLabel[type]}
            </button>
          );
        })}
      </div>

      <div className="d-flex align-items-center gap-1" style={groupDividerStyle}>
        <span className="text-muted fw-semibold">Risk:</span>
        {availableSeverities.map((severity) => {
          const active = filters.severities?.includes(severity) ?? false;
          const color = SeverityColor[severity];
          return (
            <button
              key={severity}
              type="button"
              onClick={() => toggle(severity, filters.severities ?? [], updateSeverities)}
              className="btn btn-sm py-0 px-2"
              style={{
                backgroundColor: active ? color : 'transparent',
                color: active ? '#fff' : color,
                border: `1px solid ${color}`,
              }}
            >
              {severity}
            </button>
          );
        })}
      </div>

      <div className="d-flex align-items-center gap-1" style={groupDividerStyle}>
        <span className="text-muted fw-semibold">Edge:</span>
        {edgeRelationOptions.map((relation) => (
          <button
            key={relation}
            type="button"
            onClick={() => toggle(relation, filters.relationTypes ?? [], updateRelations)}
            className={`btn btn-sm py-0 px-2 ${
              filters.relationTypes?.includes(relation) ? 'btn-secondary' : 'btn-outline-secondary'
            }`}
            aria-pressed={filters.relationTypes?.includes(relation) ?? false}
          >
            {formatRelationLabel(relation)}
          </button>
        ))}
      </div>

      <div className="d-flex align-items-center gap-2" style={groupDividerStyle}>
        <label className="form-check d-flex align-items-center gap-1 text-muted mb-0">
          <input
            type="checkbox"
            className="form-check-input m-0"
            checked={filters.runtimeEvidenceOnly ?? false}
            onChange={(evt) => toggleRuntimeOnly(evt.target.checked)}
          />
          <span className="small">Runtime evidence only</span>
        </label>
      </div>
      <div className="d-flex align-items-center gap-2">
        <input
          type="search"
          className="form-control form-control-sm py-0"
          style={{ maxWidth: 220, minWidth: 180 }}
          value={filters.search ?? ''}
          placeholder="Search nodes, edges, paths"
          onChange={(evt) => updateSearch(evt.target.value)}
        />
      </div>
    </div>
  );
};

export default GraphFilters;
