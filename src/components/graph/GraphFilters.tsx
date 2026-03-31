import React from 'react';
import type {
  AttackGraphEdgeRelation,
  AttackGraphFilters,
  AttackGraphResourceType,
  AttackGraphRiskSeverity,
} from './attackGraph';
import { nodeTypeIcons } from './mockGraphData';
import {
  ATTACK_GRAPH_SEVERITY_STYLES,
  getAttackGraphEdgeVisualStyle,
  getAttackGraphNodeTypeStyle,
} from './attackGraph/stylesheet';

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
  'role_grants_pod_exec',
  'role_grants_resource',
  'escapes_to',
] as const;

const PRIORITY_EDGE_TYPE_SET = new Set<string>(PRIORITY_EDGE_TYPES);
const SECOND_RESOURCE_ROW_TYPES: AttackGraphResourceType[] = [
  'Secret',
  'SecurityGroup',
  'Service',
  'ServiceAccount',
];
const SECOND_RESOURCE_ROW_TYPE_SET = new Set<AttackGraphResourceType>(SECOND_RESOURCE_ROW_TYPES);

const formatRelationLabel = (relation: string) =>
  relation
    .replace(/_/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/\b\w/g, (character) => character.toUpperCase());

interface GraphFiltersProps {
  filters: AttackGraphFilters;
  availableResourceTypes: AttackGraphResourceType[];
  availableEdgeRelations: AttackGraphEdgeRelation[];
  availableSeverities: AttackGraphRiskSeverity[];
  onFiltersChange: (next: AttackGraphFilters) => void;
  searchSummary?: string | null;
  searchNavigator?: {
    current: number;
    total: number;
    currentLabel?: string | null;
  } | null;
  onPreviousSearchResult?: () => void;
  onNextSearchResult?: () => void;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  onDragHandleMouseDown: React.MouseEventHandler<HTMLDivElement>;
  bodyMaxHeight?: number;
}

const cardButtonBaseStyle: React.CSSProperties = {
  position: 'relative',
  display: 'flex',
  alignItems: 'center',
  gap: '0.5rem',
  minHeight: 38,
  padding: '0.5rem 0.75rem',
  borderRadius: 14,
  border: '1px solid rgba(148, 163, 184, 0.18)',
  background: 'rgba(8, 15, 32, 0.3)',
  color: '#dbe8ff',
  fontSize: '0.79rem',
  lineHeight: 1.15,
  fontWeight: 600,
  textAlign: 'left',
  transition: 'all 160ms ease',
  backdropFilter: 'blur(10px)',
  boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.04)',
};

const GraphFilters: React.FC<GraphFiltersProps> = ({
  filters,
  availableResourceTypes,
  availableEdgeRelations,
  availableSeverities,
  onFiltersChange,
  searchSummary,
  searchNavigator,
  onPreviousSearchResult,
  onNextSearchResult,
  collapsed,
  onToggleCollapsed,
  onDragHandleMouseDown,
  bodyMaxHeight,
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

  const edgeRelationOptions = [
    ...PRIORITY_EDGE_TYPES.filter((relation) => availableEdgeRelations.includes(relation)),
    ...availableEdgeRelations.filter((relation) => !PRIORITY_EDGE_TYPE_SET.has(relation)),
  ];
  const firstRowResourceTypes = availableResourceTypes.filter((type) => !SECOND_RESOURCE_ROW_TYPE_SET.has(type));
  const secondRowResourceTypes = SECOND_RESOURCE_ROW_TYPES.filter((type) => availableResourceTypes.includes(type));

  const renderResourceButton = (type: AttackGraphResourceType) => {
    const active = filters.nodeTypes?.includes(type) ?? false;
    const nodeStyle = getAttackGraphNodeTypeStyle(type);

    return (
      <button
        key={type}
        type="button"
        onClick={() => toggle(type, filters.nodeTypes ?? [], updateNodeTypes)}
        aria-pressed={active}
        style={{
          ...cardButtonBaseStyle,
          borderColor: active ? `${nodeStyle.backgroundColor}aa` : 'rgba(148, 163, 184, 0.2)',
          background: active ? 'rgba(14, 28, 54, 0.54)' : 'rgba(8, 15, 32, 0.28)',
          boxShadow: active
            ? `0 0 0 1px ${nodeStyle.backgroundColor}55, 0 10px 22px rgba(2, 6, 23, 0.24)`
            : cardButtonBaseStyle.boxShadow,
        }}
      >
        <span
          aria-hidden="true"
          style={{
            width: 12,
            height: 12,
            minWidth: 12,
            borderRadius: 999,
            background: nodeStyle.backgroundColor,
            border: `1px solid ${nodeStyle.backgroundColor}`,
            boxShadow: active ? `0 0 14px ${nodeStyle.backgroundColor}` : 'none',
          }}
        />
        <span aria-hidden="true" style={{ opacity: 0.88 }}>
          {ResourceIcon[type] ?? '◉'}
        </span>
        <span>{ResourceLabel[type]}</span>
      </button>
    );
  };

  return (
    <div
      className="d-flex flex-column gap-3"
      style={{
        width: collapsed ? 224 : 'min(25rem, calc(100vw - 3.5rem))',
        maxHeight: collapsed ? undefined : bodyMaxHeight,
        padding: collapsed ? '0.8rem 0.85rem' : '0.85rem',
        borderRadius: 18,
        border: '1px solid rgba(96, 165, 250, 0.2)',
        background:
          'linear-gradient(180deg, rgba(8, 17, 34, 0.62) 0%, rgba(8, 15, 32, 0.5) 100%)',
        boxShadow: '0 18px 42px rgba(2, 6, 23, 0.24)',
        backdropFilter: 'blur(12px)',
        overflow: 'hidden',
      }}
    >
      <div
        className="d-flex align-items-start justify-content-between gap-3"
        style={{ cursor: collapsed ? 'grab' : 'default' }}
      >
        <div
          className="d-flex align-items-start gap-3"
          style={{ minWidth: 0, flex: 1, cursor: 'grab', userSelect: 'none' }}
          onMouseDown={onDragHandleMouseDown}
        >
          <div
            aria-hidden="true"
            className="d-flex flex-column justify-content-center gap-1"
            style={{ paddingTop: 3, opacity: 0.8 }}
          >
            <span style={{ width: 4, height: 4, borderRadius: 999, background: '#93c5fd' }} />
            <span style={{ width: 4, height: 4, borderRadius: 999, background: '#93c5fd' }} />
            <span style={{ width: 4, height: 4, borderRadius: 999, background: '#93c5fd' }} />
          </div>
          <div style={{ minWidth: 0 }}>
            <div
              className="small text-uppercase fw-semibold"
              style={{ letterSpacing: '0.08em', color: '#bfdbfe' }}
            >
              그래프 컨트롤
            </div>
            <div className="small" style={{ color: '#9fb0ca' }}>
              {collapsed ? '드래그로 이동하고 펼쳐서 검색 및 필터를 사용합니다.' : '라이브 공격 그래프를 필터링하고 검색하며 포커스를 이동합니다.'}
            </div>
          </div>
        </div>
        <div className="d-flex align-items-center gap-2 flex-shrink-0">
          {(filters.nodeTypes?.length || filters.relationTypes?.length || filters.severities?.length || filters.search?.trim()) && !collapsed ? (
            <button
              type="button"
              className="btn btn-sm dg-dashboard-action-btn dg-dashboard-action-btn--secondary"
              onClick={() => onFiltersChange({})}
              style={{
                borderRadius: 999,
                border: '1px solid rgba(148, 163, 184, 0.22)',
                color: '#dbe8ff',
                background: 'rgba(15, 23, 42, 0.38)',
              }}
            >
              초기화
            </button>
          ) : null}
          <button
            type="button"
            className="btn btn-sm dg-dashboard-action-btn dg-dashboard-action-btn--secondary"
            aria-expanded={!collapsed}
            aria-label={collapsed ? '그래프 컨트롤 펼치기' : '그래프 컨트롤 접기'}
            onClick={onToggleCollapsed}
            style={{
              borderRadius: 999,
              minWidth: 34,
              border: '1px solid rgba(148, 163, 184, 0.24)',
              color: '#dbe8ff',
              background: 'rgba(15, 23, 42, 0.34)',
            }}
          >
            {collapsed ? '+' : '−'}
          </button>
        </div>
      </div>

      {collapsed ? null : (
      <div
        className="d-flex flex-column gap-3"
        style={{
          overflowY: 'auto',
          maxHeight: bodyMaxHeight ? Math.max(128, bodyMaxHeight - 92) : undefined,
          paddingRight: 2,
        }}
      >
      <div className="d-flex flex-column gap-2">
        <label className="small fw-semibold" style={{ color: '#cbd5e1' }}>
          검색
        </label>
        <input
          type="search"
          className="form-control form-control-sm"
          value={filters.search ?? ''}
          placeholder="노드, 엣지, 경로 검색"
          onChange={(evt) => updateSearch(evt.target.value)}
          style={{
            minHeight: 40,
            borderRadius: 14,
            borderColor: 'rgba(148, 163, 184, 0.26)',
            background: 'rgba(8, 15, 32, 0.36)',
            color: '#e2e8f0',
            boxShadow: 'none',
          }}
        />
        {searchSummary ? (
          <div className="small" style={{ color: '#93c5fd' }}>
            {searchSummary}
          </div>
        ) : (
          <div className="small" style={{ color: '#7f8da5' }}>
            검색 결과는 일치하는 노드, 엣지, 경로 구간을 현재 그래프에서 강조합니다.
          </div>
        )}
        {searchNavigator && searchNavigator.total > 0 ? (
          <div
            className="d-flex align-items-center justify-content-between gap-2"
            style={{
              padding: '0.55rem 0.7rem',
              borderRadius: 14,
              border: '1px solid rgba(148, 163, 184, 0.16)',
              background: 'rgba(8, 15, 32, 0.26)',
            }}
          >
            <div style={{ minWidth: 0 }}>
              <div className="small fw-semibold" style={{ color: '#dbe8ff' }}>
                {`${searchNavigator.current} / ${searchNavigator.total}`}
              </div>
              <div className="small text-truncate" style={{ color: '#93a8c7' }}>
                {searchNavigator.currentLabel ?? '포커스된 검색 결과'}
              </div>
            </div>
            <div className="d-flex align-items-center gap-2 flex-shrink-0">
              <button
                type="button"
                className="btn btn-sm dg-dashboard-action-btn dg-dashboard-action-btn--secondary"
                onClick={onPreviousSearchResult}
                disabled={searchNavigator.total <= 1}
                aria-label="이전 검색 결과"
                style={{
                  borderRadius: 999,
                  minWidth: 34,
                  border: '1px solid rgba(148, 163, 184, 0.24)',
                  color: '#dbe8ff',
                  background: 'rgba(15, 23, 42, 0.34)',
                }}
              >
                ‹
              </button>
              <button
                type="button"
                className="btn btn-sm dg-dashboard-action-btn dg-dashboard-action-btn--secondary"
                onClick={onNextSearchResult}
                disabled={searchNavigator.total <= 1}
                aria-label="다음 검색 결과"
                style={{
                  borderRadius: 999,
                  minWidth: 34,
                  border: '1px solid rgba(148, 163, 184, 0.24)',
                  color: '#dbe8ff',
                  background: 'rgba(15, 23, 42, 0.34)',
                }}
              >
                ›
              </button>
            </div>
          </div>
        ) : null}
      </div>

      <div className="d-flex flex-column gap-2">
        <div className="small fw-semibold" style={{ color: '#cbd5e1' }}>
          리소스 유형
        </div>
        <div className="d-flex flex-wrap gap-2">{firstRowResourceTypes.map(renderResourceButton)}</div>
        {secondRowResourceTypes.length > 0 ? (
          <div className="d-flex flex-wrap gap-2">{secondRowResourceTypes.map(renderResourceButton)}</div>
        ) : null}
      </div>

      <div className="d-flex flex-column gap-2">
        <div className="small fw-semibold" style={{ color: '#cbd5e1' }}>
          위험도 테두리
        </div>
        <div className="d-flex flex-wrap gap-2">
          {availableSeverities.map((severity) => {
            const active = filters.severities?.includes(severity) ?? false;
            const color = ATTACK_GRAPH_SEVERITY_STYLES[severity].borderColor;
            const borderWidth = ATTACK_GRAPH_SEVERITY_STYLES[severity].borderWidth;

            return (
              <button
                key={severity}
                type="button"
                onClick={() => toggle(severity, filters.severities ?? [], updateSeverities)}
                aria-pressed={active}
                style={{
                  ...cardButtonBaseStyle,
                  minHeight: 36,
                  padding: '0.45rem 0.7rem',
                  borderColor: active ? `${color}cc` : 'rgba(148, 163, 184, 0.2)',
                  borderWidth,
                  background: active ? 'rgba(22, 33, 59, 0.56)' : 'rgba(8, 15, 32, 0.28)',
                  textTransform: 'capitalize',
                }}
              >
                <span
                  aria-hidden="true"
                  style={{
                    width: 10,
                    height: 10,
                    minWidth: 10,
                    borderRadius: 999,
                    background: color,
                  }}
                />
                <span>{severity}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="d-flex flex-column gap-2">
        <div className="small fw-semibold" style={{ color: '#cbd5e1' }}>
          엣지 관계
        </div>
        <div className="d-flex flex-wrap gap-2">
          {edgeRelationOptions.map((relation) => {
            const active = filters.relationTypes?.includes(relation) ?? false;
            const edgeStyle = getAttackGraphEdgeVisualStyle(relation);

            return (
              <button
                key={relation}
                type="button"
                onClick={() => toggle(relation, filters.relationTypes ?? [], updateRelations)}
                aria-pressed={active}
                style={{
                  ...cardButtonBaseStyle,
                  minHeight: 36,
                  padding: '0.45rem 0.7rem',
                  borderColor: active ? `${edgeStyle.lineColor}cc` : 'rgba(148, 163, 184, 0.2)',
                  background: active ? 'rgba(14, 28, 54, 0.52)' : 'rgba(8, 15, 32, 0.28)',
                }}
                title={formatRelationLabel(relation)}
              >
                <span
                  aria-hidden="true"
                  style={{
                    position: 'relative',
                    width: 18,
                    minWidth: 18,
                    height: 10,
                    display: 'inline-flex',
                    alignItems: 'center',
                  }}
                >
                  <span
                    style={{
                      width: '100%',
                      height: edgeStyle.width >= 3 ? 3 : 2,
                      borderRadius: 999,
                      background: edgeStyle.lineColor,
                      opacity: edgeStyle.opacity ?? 1,
                    }}
                  />
                </span>
                <span>{formatRelationLabel(relation)}</span>
              </button>
            );
          })}
        </div>
      </div>
      </div>
      )}
    </div>
  );
};

export default GraphFilters;
