import React from 'react';

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

const NODE_TYPE_META: Record<AttackPathVisualNodeType, NodeTypeMeta> = {
  pod: { label: 'POD', background: '#1d4ed8', color: '#eff6ff' },
  service: { label: 'SVC', background: '#065f46', color: '#ecfdf5' },
  ingress: { label: 'ING', background: '#92400e', color: '#fff7ed' },
  sa: { label: 'SA', background: '#0e7490', color: '#ecfeff' },
  iam: { label: 'IAM', background: '#991b1b', color: '#fef2f2', glow: '0 0 24px rgba(220, 38, 38, 0.2)' },
  s3: { label: 'S3', background: '#92400e', color: '#fff7ed', glow: '0 0 24px rgba(146, 64, 14, 0.2)' },
  rds: { label: 'RDS', background: '#581c87', color: '#faf5ff', glow: '0 0 24px rgba(88, 28, 135, 0.2)' },
  cluster_role: { label: 'CR', background: '#c2410c', color: '#fff7ed' },
  role: { label: 'ROLE', background: '#ea580c', color: '#fff7ed' },
  secret: { label: 'SECRET', background: '#be123c', color: '#fff1f2' },
  node: { label: 'NODE', background: '#475569', color: '#f8fafc' },
  unknown: { label: 'NODE', background: '#475569', color: '#f8fafc' },
};

const THREAT_META: Partial<Record<AttackPathVisualNodeType, ThreatMeta>> = {
  iam: { label: 'Privilege Escalation', description: 'IAM privilege escalation path', badgeClassName: 'dg-badge dg-badge--high' },
  s3: { label: 'Data Exfiltration', description: 'Access path to S3 data', badgeClassName: 'dg-badge dg-badge--notable' },
  rds: { label: 'Database Access', description: 'Reachability to database asset', badgeClassName: 'dg-badge dg-badge--info' },
};

const RISK_META: Record<
  AttackPathRiskLevel,
  {
    label: string;
    background: string;
    order: number;
  }
> = {
  critical: { label: 'CRIT', background: '#dc2626', order: 0 },
  high: { label: 'HIGH', background: '#ef4444', order: 1 },
  medium: { label: 'MED', background: '#f59e0b', order: 2 },
  low: { label: 'LOW', background: '#22c55e', order: 3 },
  unknown: { label: '-', background: '#6b7280', order: 4 },
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
export const getNodeTypeMeta = (type: AttackPathVisualNodeType) => NODE_TYPE_META[type];

export const normalizeRiskLevel = (level?: string | null): AttackPathRiskLevel => {
  const normalized = typeof level === 'string' ? level.trim().toLowerCase() : 'unknown';
  if (normalized === 'critical') return 'critical';
  if (normalized === 'high') return 'high';
  if (normalized === 'medium') return 'medium';
  if (normalized === 'low') return 'low';
  return 'unknown';
};

export const getRiskLevelMeta = (level?: string | null) => RISK_META[normalizeRiskLevel(level)];
export const getRiskSortOrder = (level?: string | null) => getRiskLevelMeta(level).order;

export const NodeTypeBadge: React.FC<{ type: AttackPathVisualNodeType }> = ({ type }) => {
  const meta = NODE_TYPE_META[type];

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
  const meta = NODE_TYPE_META[parsed.type];

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
