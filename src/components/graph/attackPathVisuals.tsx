import React from 'react';
import { getAttackGraphEdgeVisualStyle, getAttackGraphNodeTypeStyle, getAttackGraphRiskStyle } from './attackGraph/stylesheet';
import type { AttackGraphResourceType } from '../../types/attackGraph';

export type AttackPathVisualNodeType =
  | 'pod'
  | 'service'
  | 'ingress'
  | 'sa'
  | 'iam'
  | 's3'
  | 'rds'
  | 'cluster_role'
  | 'role'
  | 'secret'
  | 'node'
  | 'unknown';
export type AttackPathRiskLevel = 'critical' | 'high' | 'medium' | 'low' | 'unknown';

export type ParsedAttackPathNode = {
  type: AttackPathVisualNodeType;
  namespace: string | null;
  name: string;
  raw: string;
};

type NodeTypeMeta = {
  label: string;
  background: string;
  color: string;
  glow?: string;
};

type ThreatMeta = {
  label: string;
  description: string;
  badgeClassName: string;
};

const ATTACK_PATH_NODE_TYPE_LABELS: Record<AttackPathVisualNodeType, string> = {
  pod: 'POD',
  service: 'SVC',
  ingress: 'ING',
  sa: 'SA',
  iam: 'IAM',
  s3: 'S3',
  rds: 'RDS',
  cluster_role: 'CR',
  role: 'ROLE',
  secret: 'SECRET',
  node: 'NODE',
  unknown: 'NODE',
};

const ATTACK_PATH_NODE_TYPE_TO_GRAPH_RESOURCE_TYPE: Record<AttackPathVisualNodeType, AttackGraphResourceType> = {
  pod: 'Pod',
  service: 'Service',
  ingress: 'Ingress',
  sa: 'ServiceAccount',
  iam: 'IAMRole',
  s3: 'S3',
  rds: 'RDS',
  cluster_role: 'ClusterRole',
  role: 'Role',
  secret: 'Secret',
  node: 'Node',
  unknown: 'Unknown',
};

const THREAT_META: Partial<Record<AttackPathVisualNodeType, ThreatMeta>> = {
  iam: { label: '권한 상승', description: 'IAM 권한 상승 경로', badgeClassName: 'dg-badge dg-badge--high' },
  s3: { label: '데이터 유출', description: 'S3 데이터 접근 경로', badgeClassName: 'dg-badge dg-badge--notable' },
  rds: { label: '데이터베이스 접근', description: '데이터베이스 자산 도달 경로', badgeClassName: 'dg-badge dg-badge--info' },
};

const RISK_META: Record<
  AttackPathRiskLevel,
  {
    label: string;
    order: number;
  }
> = {
  critical: { label: 'CRIT', order: 0 },
  high: { label: 'HIGH', order: 1 },
  medium: { label: 'MED', order: 2 },
  low: { label: 'LOW', order: 3 },
  unknown: { label: '-', order: 4 },
};

const hexToRgba = (hex: string, alpha: number) => {
  const normalized = hex.replace('#', '');
  if (normalized.length !== 6) {
    return hex;
  }

  const red = Number.parseInt(normalized.slice(0, 2), 16);
  const green = Number.parseInt(normalized.slice(2, 4), 16);
  const blue = Number.parseInt(normalized.slice(4, 6), 16);
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
};

const normalizeNodeType = (rawType: string): AttackPathVisualNodeType => {
  const normalized = rawType.trim().toLowerCase();
  if (normalized === 'pod') return 'pod';
  if (normalized === 'service') return 'service';
  if (normalized === 'ingress') return 'ingress';
  if (normalized === 'sa' || normalized === 'serviceaccount' || normalized === 'service_account') return 'sa';
  if (normalized === 'clusterrole' || normalized === 'cluster_role') return 'cluster_role';
  if (normalized === 'role') return 'role';
  if (normalized === 'secret') return 'secret';
  if (normalized === 'node') return 'node';
  if (normalized.startsWith('iam')) return 'iam';
  if (normalized.startsWith('s3')) return 's3';
  if (normalized.startsWith('rds')) return 'rds';
  return 'unknown';
};

export const parseAttackPathNode = (value?: string | null): ParsedAttackPathNode => {
  const raw = typeof value === 'string' && value.trim() ? value.trim() : '-';
  const parts = raw.split(':').filter(Boolean);

  return {
    type: normalizeNodeType(parts[0] ?? raw),
    namespace: parts.length >= 3 ? parts[1] : null,
    name: parts[parts.length - 1] ?? raw,
    raw,
  };
};

export const formatEdgeTypeLabel = (value?: string | null) => {
  const raw = typeof value === 'string' && value.trim() ? value.trim() : 'Unknown';
  return raw.replace(/_/g, ' ').replace(/\b\w/g, (character) => character.toUpperCase());
};

export const getThreatMeta = (type: AttackPathVisualNodeType) => THREAT_META[type] ?? null;
export const getThreatLabel = (type: AttackPathVisualNodeType) => THREAT_META[type]?.label ?? null;
export const toAttackGraphResourceType = (type: AttackPathVisualNodeType): AttackGraphResourceType =>
  ATTACK_PATH_NODE_TYPE_TO_GRAPH_RESOURCE_TYPE[type];

export const getNodeTypeMeta = (type: AttackPathVisualNodeType): NodeTypeMeta => {
  const accentColor = getAttackGraphNodeTypeStyle(toAttackGraphResourceType(type)).backgroundColor;

  return {
    label: ATTACK_PATH_NODE_TYPE_LABELS[type],
    background: accentColor,
    color: '#eff6ff',
    glow: `0 0 24px ${hexToRgba(accentColor, 0.2)}`,
  };
};

export const normalizeRiskLevel = (level?: string | null): AttackPathRiskLevel => {
  const normalized = typeof level === 'string' ? level.trim().toLowerCase() : 'unknown';
  if (normalized === 'critical') return 'critical';
  if (normalized === 'high') return 'high';
  if (normalized === 'medium') return 'medium';
  if (normalized === 'low') return 'low';
  return 'unknown';
};

export const getRiskLevelMeta = (level?: string | null) => {
  const normalizedLevel = normalizeRiskLevel(level);
  const meta = RISK_META[normalizedLevel];
  const accentColor = getAttackGraphRiskStyle(normalizedLevel).borderColor;

  return {
    ...meta,
    accentColor,
    background: accentColor,
    color: '#ffffff',
  };
};

export const getRiskLevelSurfaceStyle = (level?: string | null) => {
  const accentColor = getRiskLevelMeta(level).accentColor;

  return {
    background: hexToRgba(accentColor, 0.16),
    color: accentColor,
    border: `1px solid ${hexToRgba(accentColor, 0.34)}`,
    boxShadow: `0 0 18px ${hexToRgba(accentColor, 0.12)}`,
  };
};

export const getRiskLevelRowTint = (level?: string | null) => {
  const normalizedLevel = normalizeRiskLevel(level);
  if (normalizedLevel === 'unknown') {
    return undefined;
  }

  return hexToRgba(getRiskLevelMeta(level).accentColor, normalizedLevel === 'low' ? 0.03 : 0.05);
};

export const getRelationLabelStyle = (relation?: string | null) => {
  const accentColor = getAttackGraphEdgeVisualStyle(relation).lineColor;

  return {
    color: accentColor,
    background: hexToRgba(accentColor, 0.14),
    border: `1px solid ${hexToRgba(accentColor, 0.28)}`,
    boxShadow: `0 0 16px ${hexToRgba(accentColor, 0.1)}`,
  };
};

export const getRiskSortOrder = (level?: string | null) => getRiskLevelMeta(level).order;

export const NodeTypeBadge: React.FC<{ type: AttackPathVisualNodeType }> = ({ type }) => {
  const meta = getNodeTypeMeta(type);

  return (
    <span
      className="d-inline-flex align-items-center justify-content-center"
      style={{
        background: meta.background,
        color: meta.color,
        fontSize: 11,
        fontWeight: 700,
        padding: '2px 6px',
        borderRadius: 4,
        letterSpacing: '0.05em',
        lineHeight: 1.2,
        minWidth: 36,
      }}
    >
      {meta.label}
    </span>
  );
};

export const ThreatTypeBadge: React.FC<{ type: AttackPathVisualNodeType }> = ({ type }) => {
  const meta = getThreatMeta(type);
  if (!meta) {
    return null;
  }

  return (
    <span className="d-inline-flex align-items-center gap-2">
      <span className={meta.badgeClassName}>{meta.label}</span>
      <span className="small text-muted">{meta.description}</span>
    </span>
  );
};

export const NodeIdentity: React.FC<{
  value?: string | null;
  compact?: boolean;
  showThreat?: boolean;
  showGlow?: boolean;
  showRaw?: boolean;
  threatAsBadge?: boolean;
}> = ({ value, compact = false, showThreat = false, showGlow = false, showRaw = false, threatAsBadge = false }) => {
  const parsed = parseAttackPathNode(value);
  const threatMeta = showThreat ? getThreatMeta(parsed.type) : null;
  const meta = getNodeTypeMeta(parsed.type);

  return (
    <div
      className="d-flex align-items-start gap-2"
      style={
        showGlow && meta.glow
          ? {
              padding: '0.2rem 0.35rem',
              borderRadius: 12,
              boxShadow: meta.glow,
            }
          : undefined
      }
      title={parsed.raw}
    >
      <NodeTypeBadge type={parsed.type} />
      <div className="d-flex flex-column" style={{ minWidth: 0 }}>
        <span
          className="fw-semibold"
          style={{
            overflow: compact ? 'hidden' : undefined,
            textOverflow: compact ? 'ellipsis' : undefined,
            whiteSpace: compact ? 'nowrap' : undefined,
          }}
        >
          {parsed.name}
        </span>
        {threatMeta && !threatAsBadge ? <span className="small text-muted">{threatMeta.label}</span> : null}
        {threatMeta && threatAsBadge ? <ThreatTypeBadge type={parsed.type} /> : null}
        {showRaw ? <span className="small text-muted text-break">{parsed.raw}</span> : null}
      </div>
    </div>
  );
};

export const RiskLevelBadge: React.FC<{ level?: string | null }> = ({ level }) => {
  const meta = getRiskLevelMeta(level);

  return (
    <span
      className="d-inline-flex align-items-center justify-content-center"
      style={{
        background: meta.background,
        color: '#ffffff',
        fontWeight: 800,
        fontSize: 11,
        padding: '3px 8px',
        borderRadius: 999,
        letterSpacing: '0.06em',
        lineHeight: 1.2,
        minWidth: 50,
      }}
    >
      {meta.label}
    </span>
  );
};
