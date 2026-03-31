import React from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { useGetAnalysisResultApiV1AnalysisJobIdResultGet } from '../api/generated/analysis/analysis';
import type { AnalysisResultResponse } from '../api/model';
import StatusChip from '../components/StatusChip';

// ── pure helpers ──────────────────────────────────────────────────────────────

const formatDateTime = (value?: string | null) => {
  if (!value) return '-';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString('ko-KR');
};

// ── micro-components ──────────────────────────────────────────────────────────

const Card: React.FC<{ children: React.ReactNode; className?: string }> = ({
  children,
  className = '',
}) => (
  <div className={`card border-0 shadow-sm ${className}`}>
    <div className="card-body">{children}</div>
  </div>
);

const SectionTitle: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <h2 className="h6 fw-semibold mb-3" style={{ color: 'var(--text-accent, #93c5fd)' }}>
    {children}
  </h2>
);

const FieldRow: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
  <div className="d-flex flex-column flex-sm-row gap-1 gap-sm-3 small">
    <span className="text-muted flex-shrink-0" style={{ minWidth: '9rem' }}>
      {label}
    </span>
    <span className="text-break fw-semibold">{value ?? '-'}</span>
  </div>
);

const KpiCard: React.FC<{ label: string; value: React.ReactNode; accent?: boolean }> = ({
  label,
  value,
  accent,
}) => (
  <div
    className="d-flex flex-column justify-content-between p-3 rounded-3 h-100"
    style={{
      background: 'rgba(255,255,255,0.03)',
      border: `1px solid ${accent ? 'rgba(59,130,246,0.35)' : 'var(--border-subtle)'}`,
    }}
  >
    <div className="text-muted small mb-2">{label}</div>
    <div
      className="fw-bold"
      style={{ fontSize: '1.25rem', color: accent ? 'var(--text-accent, #93c5fd)' : undefined }}
    >
      {value ?? '-'}
    </div>
  </div>
);

// ── page ──────────────────────────────────────────────────────────────────────

const AnalysisJobDetailPage: React.FC = () => {
  const { jobId } = useParams<{ jobId: string }>();
  const location = useLocation();

  const query = useGetAnalysisResultApiV1AnalysisJobIdResultGet(jobId ?? '', {
    query: { enabled: Boolean(jobId) },
  });

  if (query.isLoading) {
    return (
      <div className="dg-page-shell">
        <div className="d-flex justify-content-center align-items-center py-5">
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">불러오는 중...</span>
          </div>
        </div>
      </div>
    );
  }

  if (query.isError) {
    return (
      <div className="dg-page-shell">
        <Card>
          <div className="alert alert-danger mb-3" role="alert">
            분석 결과를 불러오지 못했습니다.
          </div>
          <button
            type="button"
            className="btn btn-sm dg-dashboard-action-btn dg-dashboard-action-btn--secondary"
            onClick={() => query.refetch()}
          >
            다시 시도
          </button>
        </Card>
      </div>
    );
  }

  const result = query.data as AnalysisResultResponse | undefined;

  if (!result) {
    return (
      <div className="dg-page-shell">
        <Card>
          <div className="py-5 text-center">
            <h1 className="h5 mb-2">분석 결과를 찾을 수 없습니다.</h1>
            <p className="text-muted small mb-3">이 작업에 대한 결과가 반환되지 않았습니다.</p>
            <Link to="/risk" className="btn btn-sm dg-dashboard-action-btn dg-dashboard-action-btn--secondary">
              목록으로 돌아가기
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  const { job, summary } = result;
  const clusterId = job.cluster_id;
  const isCompleted = job.status === 'completed';
  const backTarget =
    typeof location.state === 'object' &&
    location.state !== null &&
    'from' in location.state &&
    typeof location.state.from === 'string' &&
    location.state.from
      ? location.state.from
      : clusterId
        ? `/clusters/${clusterId}/risk`
        : '/risk';

  const kpiItems = [
    { label: '노드 수', value: summary.node_count, accent: false },
    { label: '엣지 수', value: summary.edge_count, accent: false },
    { label: '진입점', value: summary.entry_point_count, accent: true },
    { label: '핵심 자산', value: summary.crown_jewel_count, accent: true },
    { label: '공격 경로', value: summary.attack_path_count, accent: true },
    { label: '권고사항', value: summary.remediation_recommendation_count, accent: false },
  ];

  return (
    <div className="dg-page-shell">
      {/* [A] Header */}
      <div className="dg-page-header">
        <div className="d-flex flex-column gap-2 flex-grow-1 min-w-0">
          <div className="d-flex justify-content-between align-items-start gap-3">
            <div className="min-w-0">
              <h1 className="dg-page-title mb-1">분석 상세</h1>
              <code
                className="text-muted"
                style={{ fontSize: '0.78rem', wordBreak: 'break-all' }}
              >
                {job.job_id}
              </code>
            </div>
            <Link to={backTarget} className="btn btn-sm dg-dashboard-action-btn dg-dashboard-action-btn--secondary">
              ← 목록으로
            </Link>
          </div>
          <div className="d-flex flex-wrap align-items-center gap-2 mt-1">
            <StatusChip status={job.status} />
            {isCompleted && job.completed_at ? (
              <>
                <span
                  className="small fw-semibold"
                  style={{
                    color: '#bfdbfe',
                    background: 'rgba(59, 130, 246, 0.12)',
                    border: '1px solid rgba(96, 165, 250, 0.28)',
                    borderRadius: '999px',
                    padding: '0.28rem 0.72rem',
                  }}
                >
                  완료 시간 {formatDateTime(job.completed_at)}
                </span>
                <span
                  className="text-muted small"
                  style={{ borderLeft: '1px solid var(--border-subtle)', paddingLeft: '0.75rem' }}
                >
                  생성 {formatDateTime(job.created_at)}
                </span>
                {job.started_at && (
                  <span className="text-muted small">시작 {formatDateTime(job.started_at)}</span>
                )}
              </>
            ) : (
              <>
                <span
                  className="text-muted small"
                  style={{ borderLeft: '1px solid var(--border-subtle)', paddingLeft: '0.75rem' }}
                >
                  생성 {formatDateTime(job.created_at)}
                </span>
                {job.started_at && (
                  <span className="text-muted small">시작 {formatDateTime(job.started_at)}</span>
                )}
                {job.completed_at && (
                  <span className="text-muted small">완료 {formatDateTime(job.completed_at)}</span>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      <div className="d-flex flex-column gap-4">
        {/* [B] Job summary card */}
        <Card>
          <SectionTitle>작업 정보</SectionTitle>
          <div className="d-flex flex-column gap-2">
            <FieldRow
              label="작업 ID"
              value={
                <code style={{ fontSize: '0.8rem', wordBreak: 'break-all' }}>{job.job_id}</code>
              }
            />
            <FieldRow label="상태" value={<StatusChip status={job.status} />} />
            <FieldRow
              label="클러스터 ID"
              value={
                <code style={{ fontSize: '0.8rem', wordBreak: 'break-all' }}>{job.cluster_id}</code>
              }
            />
            {job.graph_id && (
              <FieldRow
                label="그래프 ID"
                value={
                  <code style={{ fontSize: '0.8rem', wordBreak: 'break-all' }}>{job.graph_id}</code>
                }
              />
            )}
            {!isCompleted && job.current_step && <FieldRow label="현재 단계" value={job.current_step} />}
            {job.error_message && (
              <div
                className="mt-2 rounded-3 p-3"
                style={{
                  background: 'rgba(239,68,68,0.08)',
                  border: '1px solid rgba(239,68,68,0.3)',
                }}
              >
                <div className="text-muted small fw-semibold mb-1">오류 메시지</div>
                <p className="mb-0 small" style={{ color: '#fca5a5' }}>
                  {job.error_message}
                </p>
              </div>
            )}
          </div>
        </Card>

        {/* [C] Selected scans */}
        <Card>
          <SectionTitle>스캔 구성</SectionTitle>
          <div className="d-flex flex-column gap-2">
            <FieldRow
              label="K8s 스캔 ID"
              value={
                job.k8s_scan_id ? (
                  <code style={{ fontSize: '0.8rem', wordBreak: 'break-all' }}>
                    {job.k8s_scan_id}
                  </code>
                ) : (
                  <span className="text-muted">-</span>
                )
              }
            />
            <FieldRow
              label="AWS 스캔 ID"
              value={
                job.aws_scan_id ? (
                  <code style={{ fontSize: '0.8rem', wordBreak: 'break-all' }}>
                    {job.aws_scan_id}
                  </code>
                ) : (
                  <span className="text-muted">-</span>
                )
              }
            />
            <FieldRow
              label="이미지 스캔 ID"
              value={
                job.image_scan_id ? (
                  <code style={{ fontSize: '0.8rem', wordBreak: 'break-all' }}>
                    {job.image_scan_id}
                  </code>
                ) : (
                  <span className="text-muted">-</span>
                )
              }
            />
            {job.expected_scans && job.expected_scans.length > 0 && (
              <FieldRow
                label="예상 스캔"
                value={
                  <div className="d-flex flex-wrap gap-1">
                    {job.expected_scans.map((s: string) => (
                      <span
                        key={s}
                        className="badge"
                        style={{
                          background: 'rgba(255,255,255,0.08)',
                          color: 'rgba(226,232,240,0.9)',
                          border: '1px solid rgba(255,255,255,0.15)',
                          fontWeight: 500,
                          fontSize: '0.75rem',
                        }}
                      >
                        {s}
                      </span>
                    ))}
                  </div>
                }
              />
            )}
          </div>
        </Card>

        {/* [D] Result summary KPIs */}
        <div>
          <SectionTitle>분석 결과 요약</SectionTitle>
          <div className="row g-3">
            {kpiItems.map(({ label, value, accent }) => (
              <div key={label} className="col-6 col-md-4 col-xl-2">
                <KpiCard label={label} value={value ?? '-'} accent={accent} />
              </div>
            ))}
          </div>
        </div>

        {/* [E] Next actions */}
        <Card>
          <SectionTitle>다음 단계</SectionTitle>
          <div className="d-flex flex-wrap gap-2">
            <Link
              to={`/clusters/${clusterId}/graph`}
              className="btn btn-sm"
              style={{
                background: 'rgba(59,130,246,0.15)',
                border: '1px solid rgba(59,130,246,0.4)',
                color: '#93c5fd',
              }}
            >
              공격 그래프로 이동 →
            </Link>
            <Link
              to={clusterId ? `/clusters/${clusterId}/risk` : '/risk'}
              className="btn btn-sm"
              style={{
                background: 'rgba(239,68,68,0.1)',
                border: '1px solid rgba(239,68,68,0.35)',
                color: '#fca5a5',
              }}
            >
              공격 경로 및 결과로 이동 →
            </Link>
            <Link
              to="/remediation"
              className="btn btn-sm"
              style={{
                background: 'rgba(102,187,106,0.1)',
                border: '1px solid rgba(102,187,106,0.35)',
                color: '#86efac',
              }}
            >
              권고사항으로 이동 →
            </Link>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default AnalysisJobDetailPage;
