import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  useListClustersApiV1ClustersGet,
  useGetRemediationRecommendationsApiV1ClustersClusterIdRemediationRecommendationsGet,
} from '../api/generated/clusters/clusters';
import { useListAnalysisJobsApiV1ClustersClusterIdAnalysisJobsGet } from '../api/generated/analysis/analysis';
import type { AnalysisJobSummaryResponse, RemediationRecommendationListItemResponse } from '../api/model';
import StatusChip from '../components/StatusChip';
import {
  blockedPathCount,
  formatFixType,
  formatReduction,
} from '../components/risk/recommendationFormatters';

const isAnalysisJobSummary = (v: unknown): v is AnalysisJobSummaryResponse =>
  Boolean(v && typeof v === 'object' && 'job_id' in v && 'status' in v);

const isRecommendationItem = (v: unknown): v is RemediationRecommendationListItemResponse =>
  Boolean(v && typeof v === 'object' && 'recommendation_id' in v);

const formatDateTime = (value?: string | null) => {
  if (!value) return '-';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString();
};

const previewRowStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.03)',
  border: '1px solid var(--border-subtle)',
  borderRadius: '0.5rem',
  padding: '0.625rem 0.875rem',
};

const metaStyle: React.CSSProperties = { fontSize: '0.72rem' };

// ── sub-components ──────────────────────────────────────────────────────────

const AnalysisPreview: React.FC<{ clusterId: string }> = ({ clusterId }) => {
  const { data, isLoading } = useListAnalysisJobsApiV1ClustersClusterIdAnalysisJobsGet(
    clusterId,
    undefined,
    { query: { enabled: Boolean(clusterId) } },
  );

  const jobs = useMemo<AnalysisJobSummaryResponse[]>(() => {
    const items = (data as { items?: unknown[] } | undefined)?.items ?? [];
    return (Array.isArray(items) ? items : []).filter(isAnalysisJobSummary).slice(0, 3);
  }, [data]);

  if (!clusterId) {
    return <PlaceholderRows text="클러스터를 등록하면 분석 현황이 표시됩니다." />;
  }

  if (isLoading) {
    return <div className="text-muted small">분석 작업 불러오는 중…</div>;
  }

  if (jobs.length === 0) {
    return <PlaceholderRows text="아직 실행된 분석 작업이 없습니다." />;
  }

  return (
    <div className="d-flex flex-column gap-2">
      {jobs.map((job) => (
        <div key={job.job_id} style={previewRowStyle}>
          <div className="d-flex justify-content-between align-items-center gap-2 mb-1">
            <StatusChip status={job.status} />
            <span className="text-muted" style={metaStyle}>
              {formatDateTime(job.created_at)}
            </span>
          </div>
          <div className="text-muted text-truncate" style={metaStyle}>
            {job.current_step ? `단계: ${job.current_step}` : job.job_id}
          </div>
        </div>
      ))}
    </div>
  );
};

const RemediationPreview: React.FC<{ clusterId: string }> = ({ clusterId }) => {
  const { data, isLoading } =
    useGetRemediationRecommendationsApiV1ClustersClusterIdRemediationRecommendationsGet(
      clusterId,
      { query: { enabled: Boolean(clusterId), retry: false } },
    );

  const items = useMemo<RemediationRecommendationListItemResponse[]>(() => {
    const raw = (data as { items?: unknown[] } | undefined)?.items ?? [];
    return (Array.isArray(raw) ? raw : []).filter(isRecommendationItem).slice(0, 3);
  }, [data]);

  if (!clusterId) {
    return <PlaceholderRows text="클러스터를 등록하면 권고사항이 표시됩니다." />;
  }

  if (isLoading) {
    return <div className="text-muted small">권고사항 불러오는 중…</div>;
  }

  if (items.length === 0) {
    return <PlaceholderRows text="분석이 완료되면 권고사항이 생성됩니다." />;
  }

  return (
    <div className="d-flex flex-column gap-2">
      {items.map((item) => (
        <div key={item.recommendation_id} style={previewRowStyle}>
          <div className="fw-semibold small mb-1">{formatFixType(item.fix_type)}</div>
          <div className="d-flex gap-3" style={metaStyle}>
            <span className="text-muted">
              차단 경로{' '}
              <span className="fw-semibold text-body">{blockedPathCount(item)}</span>
            </span>
            <span className="text-muted">
              위험 감소{' '}
              <span className="fw-semibold text-success">{formatReduction(item.cumulative_risk_reduction)}</span>
            </span>
          </div>
        </div>
      ))}
    </div>
  );
};

const PlaceholderRows: React.FC<{ text: string }> = ({ text }) => (
  <div className="text-muted small">{text}</div>
);

// ── page ────────────────────────────────────────────────────────────────────

const RiskOptimizationPage: React.FC = () => {
  const { data: clustersData } = useListClustersApiV1ClustersGet();
  const clusters = Array.isArray(clustersData) ? clustersData : [];
  const firstClusterId: string = (clusters[0] as { id: string } | undefined)?.id ?? '';

  return (
    <div className="dg-page-shell">
      <div className="dg-page-header">
        <div className="dg-page-heading">
          <h1 className="dg-page-title">Risk Optimization</h1>
          <p className="dg-page-description">
            공격 경로를 분석하고 우선 적용할 권고사항을 검토합니다.
            위험을 이해하는 단계와 실제 조치 단계로 나누어 탐색할 수 있습니다.
          </p>
        </div>
      </div>

      <div className="row g-4">
        {/* Analysis card */}
        <div className="col-12 col-md-6">
          <div className="card border-0 shadow-sm h-100">
            <div className="card-body d-flex flex-column gap-3 p-4">
              <div className="d-flex align-items-center gap-3">
                <span
                  className="dg-sidebar-badge"
                  style={{ minWidth: '2.4rem', width: '2.4rem', height: '2.4rem', fontSize: '0.72rem' }}
                  aria-hidden="true"
                >
                  AN
                </span>
                <div>
                  <h2 className="h5 mb-0">Analysis</h2>
                  <p className="text-muted small mb-0">분석 / 결과</p>
                </div>
              </div>

              <p className="text-muted small mb-0">
                선택한 스캔을 기반으로 분석 작업을 생성하고 공격 경로 및 결과를 확인합니다.
              </p>

              <div className="flex-grow-1">
                <div className="text-muted small mb-2">최근 분석 작업</div>
                <AnalysisPreview clusterId={firstClusterId} />
              </div>

              <Link to="/risk" className="btn btn-sm dg-dashboard-action-btn dg-dashboard-action-btn--primary">
                Analysis로 이동
              </Link>
            </div>
          </div>
        </div>

        {/* Remediation card */}
        <div className="col-12 col-md-6">
          <div className="card border-0 shadow-sm h-100">
            <div className="card-body d-flex flex-column gap-3 p-4">
              <div className="d-flex align-items-center gap-3">
                <span
                  className="dg-sidebar-badge"
                  style={{ minWidth: '2.4rem', width: '2.4rem', height: '2.4rem', fontSize: '0.72rem' }}
                  aria-hidden="true"
                >
                  RE
                </span>
                <div>
                  <h2 className="h5 mb-0">Remediation</h2>
                  <p className="text-muted small mb-0">권고사항</p>
                </div>
              </div>

              <p className="text-muted small mb-0">
                우선순위가 높은 조치 항목을 확인하고 상세 권고사항을 검토합니다.
              </p>

              <div className="flex-grow-1">
                <div className="text-muted small mb-2">상위 권고사항</div>
                <RemediationPreview clusterId={firstClusterId} />
              </div>

              <Link to="/remediation" className="btn btn-sm dg-dashboard-action-btn dg-dashboard-action-btn--primary">
                Remediation으로 이동
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RiskOptimizationPage;
