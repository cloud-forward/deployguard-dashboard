import type { RemediationRecommendationListItemResponse } from '../../api/model';

export const FIX_TYPE_LABEL: Record<string, string> = {
  change_service_account: '서비스 어카운트 변경',
  restrict_iam_policy: 'IAM 정책 제한',
  remove_role_binding: '권한 바인딩 제거',
  delete_role_binding: '권한 바인딩 삭제',
  remove_cluster_role_binding: '클러스터 권한 바인딩 제거',
  rotate_secret: 'Secret 자격 증명 교체',
  restrict_pod_security: 'Pod 보안 정책 강화',
  remove_permission: '권한 제거',
  add_network_policy: '네트워크 정책 추가',
};

export const formatFixType = (fixType?: string | null): string => {
  if (!fixType) return '조치 필요';
  return FIX_TYPE_LABEL[fixType] ?? fixType.replace(/_/g, ' ');
};

export const clampPercent = (value?: number | null): number => {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return 0;
  }

  const normalized = value <= 1 ? value * 100 : value;
  return Math.max(0, Math.min(normalized, 100));
};

export const formatCoveredRisk = (value?: number | null): string => {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return '-';
  }

  return value.toLocaleString('ko-KR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

export const formatReduction = (value?: number | null): string => {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return '-';
  }

  return `${clampPercent(value).toFixed(1)}%`;
};

export const blockedPathCount = (item: RemediationRecommendationListItemResponse): number => {
  if (Array.isArray(item.blocked_path_ids) && item.blocked_path_ids.length > 0) {
    return item.blocked_path_ids.length;
  }

  if (Array.isArray(item.blocked_path_indices)) {
    return item.blocked_path_indices.length;
  }

  return 0;
};

export const costLabel = (cost: number): string => {
  if (cost <= 1) return '낮음';
  if (cost <= 3) return '보통';
  return '높음';
};

const inferResourceType = (id: string): string => {
  const normalized = id.toLowerCase();

  if (
    normalized.includes('serviceaccount') ||
    normalized.startsWith('sa-') ||
    normalized.startsWith('sa:') ||
    normalized.includes('/sa/') ||
    normalized.includes(':sa:')
  ) {
    return 'ServiceAccount';
  }

  if (
    normalized.includes('iam') ||
    normalized.startsWith('iam:') ||
    normalized.includes(':role/') ||
    normalized.includes('role/')
  ) {
    return 'IAM Role';
  }

  if (
    normalized.includes('s3') ||
    normalized.includes('bucket') ||
    normalized.startsWith('arn:aws:s3') ||
    normalized.startsWith('s3:')
  ) {
    return 'S3';
  }

  return 'Pod';
};

const normalizePodName = (value: string): string => value.replace(/-[a-z0-9]{5,}(?:-[a-z0-9]{4,})?$/, '');

const extractResourceName = (id: string): string => {
  const trimmed = id.trim();

  if (!trimmed) {
    return '-';
  }

  if (trimmed.startsWith('arn:aws:iam::') && trimmed.includes(':role/')) {
    return trimmed.split(':role/').pop() ?? trimmed;
  }

  if (trimmed.startsWith('arn:aws:s3:::')) {
    return trimmed.replace('arn:aws:s3:::', '');
  }

  const segments = trimmed.split(/[/:]/).filter(Boolean);
  const resourceType = inferResourceType(trimmed);
  const candidate = segments[segments.length - 1] ?? trimmed;

  if (resourceType === 'Pod') {
    return normalizePodName(candidate);
  }

  return candidate;
};

export const formatResource = (id: string): string => {
  const trimmed = id.trim();

  if (!trimmed) {
    return '-';
  }

  const type = inferResourceType(trimmed);
  const name = extractResourceName(trimmed);
  return `${name} ${type}`;
};
