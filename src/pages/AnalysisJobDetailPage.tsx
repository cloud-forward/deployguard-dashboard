import React from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { useGetAnalysisResultApiV1AnalysisJobIdResultGet } from '../api/generated/analysis/analysis';
import type { AnalysisResultResponse } from '../api/model';
import type { AttackPathDetailResponse } from '../api/model/attackPathDetailResponse';
import { RiskLevelBadge } from '../components/graph/attackPathVisuals';
import {
  blockedPathCount,
  formatCoveredRisk,
  formatFixType,
  formatReduction,
} from '../components/risk/recommendationFormatters';
import StatusChip from '../components/StatusChip';

// ── pure helpers ──────────────────────────────────────────────────────────────

const formatDateTime = (value?: string | null) => {
  if (!value) return '-';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString('ko-KR');
};

const formatNumber = (value?: number | null) => {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return '-';
  }

  return value.toLocaleString('ko-KR');
};

const normalizeLlmStatus = (value?: string | null) => {
  if (!value) return '-';
  return value.replace(/_/g, ' ');
};

const isAttackPathDetail = (value: unknown): value is AttackPathDetailResponse => {
  if (!value || typeof value !== 'object') {
    return false;
  }

  return 'edge_ids' in value || 'edges' in value;
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

const CompactMetaValue: React.FC<{ value?: string | null }> = ({ value }) => {
  if (!value) {
    return <span className="text-muted">-</span>;
  }

  return (
    <code
      className="d-block"
      title={value}
      style={{
        fontSize: '0.76rem',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
      }}
    >
      {value}
    </code>
  );
};

const CompactMetaRow: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
  <div className="d-flex align-items-center gap-3 small">
    <div
      className="text-muted flex-shrink-0"
      style={{ width: '5.5rem', lineHeight: 1.2 }}
    >
      {label}
    </div>
    <div className="flex-grow-1 min-w-0 overflow-hidden fw-semibold" style={{ lineHeight: 1.2 }}>
      {value}
    </div>
  </div>
);

const AnalysisResultHeader: React.FC<{
  result: AnalysisResultResponse;
  backTarget: string;
}> = ({ result, backTarget }) => {
  const { job } = result;

  return (
    <Card>
      <div className="d-flex flex-column gap-3">
        <div className="d-flex justify-content-between align-items-start gap-3 flex-wrap">
          <div className="min-w-0">
            <div className="d-flex align-items-baseline gap-3 flex-wrap mb-2">
              <h1 className="dg-page-title mb-0">분석 결과 상세</h1>
              <span className="text-muted small">이번 분석 실행의 결과를 요약해 보여줍니다.</span>
            </div>
            <div className="d-flex flex-wrap align-items-center gap-2">
              <StatusChip status={job.status} />
              {job.completed_at ? (
                <span
                  className="small fw-semibold"
                  title={formatDateTime(job.completed_at)}
                  style={{
                    color: '#dbeafe',
                    background: 'rgba(255, 255, 255, 0.04)',
                    border: '1px solid rgba(148, 163, 184, 0.18)',
                    borderRadius: '999px',
                    padding: '0.28rem 0.72rem',
                  }}
                >
                  완료 {formatDateTime(job.completed_at)}
                </span>
              ) : null}
            </div>
          </div>
          <Link
            to={backTarget}
            className="btn btn-sm dg-dashboard-action-btn dg-dashboard-action-btn--secondary"
          >
            ← 목록으로
          </Link>
        </div>

        <div
          className="rounded-3 p-3"
          style={{
            width: '100%',
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid var(--border-subtle)',
          }}
        >
          <div className="text-muted small mb-2">실행 메타데이터</div>
          <div className="row g-2 gx-2">
            <div className="col-12 col-md-6">
              <div
                className="rounded-3 p-2 h-100"
                style={{
                  background: 'rgba(255,255,255,0.02)',
                  border: '1px solid rgba(148, 163, 184, 0.14)',
                }}
              >
                <div className="d-flex flex-column gap-2">
                  <CompactMetaRow label="작업 ID" value={<CompactMetaValue value={job.job_id} />} />
                  <CompactMetaRow label="클러스터 ID" value={<CompactMetaValue value={job.cluster_id} />} />
                  <CompactMetaRow label="그래프 ID" value={<CompactMetaValue value={job.graph_id} />} />
                </div>
              </div>
            </div>
            <div className="col-12 col-md-6">
              <div
                className="rounded-3 p-2 h-100"
                style={{
                  background: 'rgba(255,255,255,0.02)',
                  border: '1px solid rgba(148, 163, 184, 0.14)',
                }}
              >
                <div className="d-flex flex-column gap-2">
                  <CompactMetaRow label="K8s" value={<CompactMetaValue value={job.k8s_scan_id} />} />
                  <CompactMetaRow label="AWS" value={<CompactMetaValue value={job.aws_scan_id} />} />
                  <CompactMetaRow label="Image" value={<CompactMetaValue value={job.image_scan_id} />} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
};

const AnalysisResultSummaryCards: React.FC<{ result: AnalysisResultResponse }> = ({ result }) => {
  const { summary, stats } = result;

  const items = [
    {
      label: '노드 수',
      value: summary.node_count ?? stats?.graph?.nodes,
    },
    {
      label: '엣지 수',
      value: summary.edge_count ?? stats?.graph?.edges,
    },
    {
      label: '진입점 수',
      value: summary.entry_point_count ?? stats?.graph?.entry_points,
      accent: true,
    },
    {
      label: '핵심 자산 수',
      value: summary.crown_jewel_count ?? stats?.graph?.crown_jewels,
      accent: true,
    },
    {
      label: '공격 경로 수',
      value: summary.attack_path_count ?? stats?.paths?.returned,
      accent: true,
    },
    {
      label: '권고사항 수',
      value: summary.remediation_recommendation_count,
    },
    {
      label: 'Fact 수',
      value: stats?.facts?.total,
    },
    {
      label: '총 경로 수 / 반환 경로 수',
      value:
        typeof stats?.paths?.total === 'number' || typeof stats?.paths?.returned === 'number'
          ? `${formatNumber(stats?.paths?.total)} / ${formatNumber(stats?.paths?.returned)}`
          : '-',
    },
  ];

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center gap-3 mb-3">
        <div>
          <h2 className="h6 fw-semibold mb-1" style={{ color: 'var(--text-accent, #93c5fd)' }}>
            요약 지표
          </h2>
          <p className="text-muted small mb-0">이번 분석 실행의 핵심 수치를 먼저 확인합니다.</p>
        </div>
      </div>
      <div className="row g-3">
        {items.map(({ label, value, accent }) => (
          <div key={label} className="col-6 col-md-4 col-xxl-3">
            <KpiCard label={label} value={typeof value === 'string' ? value : formatNumber(value)} accent={accent} />
          </div>
        ))}
      </div>
    </div>
  );
};

const AnalysisMetricsSection: React.FC<{ result: AnalysisResultResponse }> = ({ result }) => {
  const { summary, stats } = result;
  const attackPathScores =
    Array.isArray(result.attack_paths) && result.attack_paths.length > 0
      ? result.attack_paths
          .map((item) => item.risk_score)
          .filter((value): value is number => typeof value === 'number' && !Number.isNaN(value))
      : [];
  const coveredRiskValues =
    Array.isArray(result.remediation_recommendations) && result.remediation_recommendations.length > 0
      ? result.remediation_recommendations
          .map((item) => item.covered_risk)
          .filter((value): value is number => typeof value === 'number' && !Number.isNaN(value))
      : [];
  const averageRiskScore =
    attackPathScores.length > 0
      ? attackPathScores.reduce((sum, value) => sum + value, 0) / attackPathScores.length
      : null;

  const factGraphItems = [
    {
      label: 'Facts',
      value: stats?.facts?.total,
      description: '분석에 사용된 정규화 fact 수',
    },
    {
      label: 'Nodes',
      value: stats?.graph?.nodes,
      description: '그래프 내 리소스 수',
    },
    {
      label: 'Edges',
      value: stats?.graph?.edges,
      description: '리소스 간 관계로 기록된 엣지 수',
    },
    {
      label: 'Entry Points',
      value: stats?.graph?.entry_points,
      description: '공격 시작점으로 분류된 노드 수',
    },
    {
      label: 'Crown Jewels',
      value: stats?.graph?.crown_jewels,
      description: '민감 자산으로 분류된 노드 수',
    },
  ];

  const pathItems = [
    {
      label: 'stats.paths.total',
      value: stats?.paths?.total,
      description: '엔진이 계산한 전체 경로 수',
    },
    {
      label: 'stats.paths.returned',
      value: stats?.paths?.returned,
      description: '최종 결과에 포함된 경로 수',
    },
    {
      label: 'summary.attack_path_count',
      value: summary.attack_path_count,
      description: '요약 응답에 반영된 공격 경로 수',
    },
  ];

  const riskItems = [
    {
      label: 'max risk_score',
      value: attackPathScores.length > 0 ? Math.max(...attackPathScores) : null,
      description: 'risk_score: 경로의 종합 위험도 지표',
    },
    {
      label: 'min risk_score',
      value: attackPathScores.length > 0 ? Math.min(...attackPathScores) : null,
      description: 'raw_final_risk와 함께 경로 위험 분포를 읽는 기준',
    },
    {
      label: 'avg risk_score',
      value: averageRiskScore,
      description: '공격 경로 전반의 평균 위험 수준',
    },
    {
      label: 'max covered_risk',
      value: coveredRiskValues.length > 0 ? Math.max(...coveredRiskValues) : null,
      description: 'covered_risk: 해당 조치로 감소 가능한 위험 규모',
    },
  ];

  return (
    <div className="d-flex flex-column gap-3">
      <div>
        <h2 className="h6 fw-semibold mb-1" style={{ color: 'var(--text-accent, #93c5fd)' }}>
          분석 해석
        </h2>
        <p className="text-muted small mb-0">집계값과 경량 계산값으로 결과의 맥락을 짧게 읽습니다.</p>
      </div>

      <div className="row g-3">
        <div className="col-12 col-xl-4">
          <Card className="h-100">
            <div className="d-flex flex-column gap-3">
              <div>
                <h3 className="h6 fw-semibold mb-1">Facts &amp; Graph</h3>
                <p className="text-muted small mb-0">분석 입력 규모와 그래프 구조를 함께 보여줍니다.</p>
              </div>
              <div className="d-flex flex-column gap-3">
                {factGraphItems.map((item) => (
                  <div
                    key={item.label}
                    className="rounded-3 p-3"
                    style={{
                      background: 'rgba(255,255,255,0.03)',
                      border: '1px solid var(--border-subtle)',
                    }}
                  >
                    <div className="d-flex justify-content-between align-items-start gap-3">
                      <div className="fw-semibold">{item.label}</div>
                      <div className="fw-bold">{formatNumber(item.value)}</div>
                    </div>
                    <div className="text-muted small mt-2">{item.description}</div>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        </div>

        <div className="col-12 col-xl-4">
          <Card className="h-100">
            <div className="d-flex flex-column gap-3">
              <div>
                <h3 className="h6 fw-semibold mb-1">Paths Insight</h3>
                <p className="text-muted small mb-0">계산된 전체 경로와 실제 결과 반영 경로를 비교합니다.</p>
              </div>
              <div className="d-flex flex-column gap-3">
                {pathItems.map((item) => (
                  <div
                    key={item.label}
                    className="rounded-3 p-3"
                    style={{
                      background: 'rgba(255,255,255,0.03)',
                      border: '1px solid var(--border-subtle)',
                    }}
                  >
                    <div className="d-flex justify-content-between align-items-start gap-3">
                      <div className="fw-semibold">{item.label}</div>
                      <div className="fw-bold">{formatNumber(item.value)}</div>
                    </div>
                    <div className="text-muted small mt-2">{item.description}</div>
                  </div>
                ))}
              </div>
              <div
                className="rounded-3 p-3"
                style={{
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid var(--border-subtle)',
                }}
              >
                <div className="text-muted small">
                  total은 엔진이 계산한 전체 경로 수이고, returned는 그중 최종 결과에 포함된 경로 수입니다.
                  returned paths는 현재 상세 화면과 후속 탭에 실제로 반영된 경로를 의미합니다.
                </div>
              </div>
            </div>
          </Card>
        </div>

        <div className="col-12 col-xl-4">
          <Card className="h-100">
            <div className="d-flex flex-column gap-3">
              <div>
                <h3 className="h6 fw-semibold mb-1">Risk Signals</h3>
                <p className="text-muted small mb-0">공격 경로와 선택 권고안에서 읽히는 위험 신호입니다.</p>
              </div>
              <div className="d-flex flex-column gap-3">
                {riskItems.map((item) => (
                  <div
                    key={item.label}
                    className="rounded-3 p-3"
                    style={{
                      background: 'rgba(255,255,255,0.03)',
                      border: '1px solid var(--border-subtle)',
                    }}
                  >
                    <div className="d-flex justify-content-between align-items-start gap-3">
                      <div className="fw-semibold">{item.label}</div>
                      <div className="fw-bold">
                        {typeof item.value === 'number' ? item.value.toLocaleString('ko-KR', { maximumFractionDigits: 2 }) : '-'}
                      </div>
                    </div>
                    <div className="text-muted small mt-2">{item.description}</div>
                  </div>
                ))}
              </div>
              <div
                className="rounded-3 p-3"
                style={{
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid var(--border-subtle)',
                }}
              >
                <div className="text-muted small">
                  risk_score는 경로의 종합 위험도 지표이고, raw_final_risk는 최종 계산된 리스크 값입니다.
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

type ResultTab = 'overview' | 'attack-paths' | 'recommendations';

const EmptyPlaceholder: React.FC<{ title: string; description: string }> = ({ title, description }) => (
  <div
    className="rounded-3 p-4 text-center"
    style={{
      background: 'rgba(255,255,255,0.03)',
      border: '1px solid var(--border-subtle)',
    }}
  >
    <div className="fw-semibold mb-2">{title}</div>
    <div className="text-muted small">{description}</div>
  </div>
);

const OverviewAttackPathsPreview: React.FC<{ result: AnalysisResultResponse }> = ({ result }) => {
  const items =
    Array.isArray(result.attack_paths_preview) && result.attack_paths_preview.length > 0
      ? result.attack_paths_preview.slice(0, 3)
      : Array.isArray(result.attack_paths) && result.attack_paths.length > 0
        ? result.attack_paths.slice(0, 3)
        : [];

  return (
    <div className="d-flex flex-column gap-3">
      <div>
        <h3 className="h6 fw-semibold mb-1">공격 경로 미리보기</h3>
        <p className="text-muted small mb-0">이번 결과를 대표하는 상위 경로 몇 건만 간단히 확인합니다.</p>
      </div>

      {items.length === 0 ? (
        <EmptyPlaceholder
          title="표시할 공격 경로가 없습니다."
          description="대표 경로가 준비되면 이 영역에 미리보기가 표시됩니다."
        />
      ) : (
        <div className="row g-3">
          {items.map((item) => (
            <div key={item.path_id} className="col-12 col-xl-4">
              <Card className="h-100">
                <div className="d-flex flex-column gap-3">
                  <div className="d-flex justify-content-between align-items-start gap-2">
                    <RiskLevelBadge level={item.risk_level} />
                    <div className="text-muted small text-end">hop {formatNumber(item.hop_count)}</div>
                  </div>
                  <div>
                    <div className="text-muted small mb-1">경로 ID</div>
                    <code className="d-block" title={item.path_id} style={{ fontSize: '0.78rem', wordBreak: 'break-all' }}>
                      {item.path_id}
                    </code>
                  </div>
                  <div className="row g-2 small">
                    <div className="col-6">
                      <div className="text-muted mb-1">risk_score</div>
                      <div className="fw-semibold">{formatNumber(item.risk_score)}</div>
                    </div>
                    <div className="col-6">
                      <div className="text-muted mb-1">raw_final_risk</div>
                      <div className="fw-semibold">{formatNumber(item.raw_final_risk)}</div>
                    </div>
                  </div>
                  <div className="d-flex flex-column gap-2 small">
                    <div>
                      <div className="text-muted mb-1">entry_node_id</div>
                      <code className="d-block" title={item.entry_node_id ?? '-'} style={{ fontSize: '0.76rem', wordBreak: 'break-all' }}>
                        {item.entry_node_id ?? '-'}
                      </code>
                    </div>
                    <div>
                      <div className="text-muted mb-1">target_node_id</div>
                      <code className="d-block" title={item.target_node_id ?? '-'} style={{ fontSize: '0.76rem', wordBreak: 'break-all' }}>
                        {item.target_node_id ?? '-'}
                      </code>
                    </div>
                  </div>
                </div>
              </Card>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const OverviewRecommendationsPreview: React.FC<{ result: AnalysisResultResponse }> = ({ result }) => {
  const items =
    Array.isArray(result.remediation_preview) && result.remediation_preview.length > 0
      ? result.remediation_preview.slice(0, 3)
      : Array.isArray(result.remediation_recommendations) && result.remediation_recommendations.length > 0
        ? result.remediation_recommendations.slice(0, 3)
        : [];

  return (
    <div className="d-flex flex-column gap-3">
      <div>
        <h3 className="h6 fw-semibold mb-1">권고사항 미리보기</h3>
        <p className="text-muted small mb-0">이번 분석에서 우선순위가 높은 권고안만 간단히 요약합니다.</p>
      </div>

      {items.length === 0 ? (
        <EmptyPlaceholder
          title="표시할 권고사항이 없습니다."
          description="대표 권고안이 준비되면 이 영역에 미리보기가 표시됩니다."
        />
      ) : (
        <div className="row g-3">
          {items.map((item) => (
            <div key={item.recommendation_id} className="col-12 col-xl-4">
              <Card className="h-100">
                <div className="d-flex flex-column gap-3">
                  <div className="d-flex justify-content-between align-items-start gap-2">
                    <div>
                      <div className="text-muted small mb-1">순위</div>
                      <div className="fw-semibold">#{typeof item.recommendation_rank === 'number' ? item.recommendation_rank + 1 : '-'}</div>
                    </div>
                    {item.llm_status ? <span className="dg-badge dg-badge--tag">{normalizeLlmStatus(item.llm_status)}</span> : null}
                  </div>
                  <div>
                    <div className="text-muted small mb-1">fix_type</div>
                    <div className="fw-semibold">{formatFixType(item.fix_type)}</div>
                  </div>
                  <div className="row g-2 small">
                    <div className="col-6">
                      <div className="text-muted mb-1">차단 경로</div>
                      <div className="fw-semibold">{blockedPathCount(item)}</div>
                    </div>
                    <div className="col-6">
                      <div className="text-muted mb-1">covered_risk</div>
                      <div className="fw-semibold">{formatCoveredRisk(item.covered_risk)}</div>
                    </div>
                    <div className="col-12">
                      <div className="text-muted mb-1">cumulative_risk_reduction</div>
                      <div className="fw-semibold text-success">{formatReduction(item.cumulative_risk_reduction)}</div>
                    </div>
                  </div>
                </div>
              </Card>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const AttackPathsTabContent: React.FC<{ result: AnalysisResultResponse }> = ({ result }) => {
  const [expandedPathIds, setExpandedPathIds] = React.useState<Record<string, boolean>>({});
  const items =
    Array.isArray(result.attack_paths) && result.attack_paths.length > 0
      ? result.attack_paths
      : Array.isArray(result.attack_paths_preview) && result.attack_paths_preview.length > 0
        ? result.attack_paths_preview
        : [];

  const toggleExpanded = (pathId: string) => {
    setExpandedPathIds((current) => ({
      ...current,
      [pathId]: !current[pathId],
    }));
  };

  if (items.length === 0) {
    return (
      <EmptyPlaceholder
        title="표시할 공격 경로가 없습니다."
        description="공격 경로 데이터가 준비되면 이 탭에서 전체 목록을 확인할 수 있습니다."
      />
    );
  }

  return (
    <div className="d-flex flex-column gap-3">
      <div>
        <h3 className="h6 fw-semibold mb-1">Attack Paths</h3>
        <p className="text-muted small mb-0">이번 분석 실행에서 결과로 남은 공격 경로를 근거 중심으로 보여줍니다.</p>
      </div>

      <div className="d-flex flex-column gap-3">
        {items.map((item) => {
          const isExpanded = Boolean(expandedPathIds[item.path_id]);
          const detailItem = isAttackPathDetail(item) ? item : null;
          const hasDetail = Boolean(
            item.title ||
              (Array.isArray(item.node_ids) && item.node_ids.length > 0) ||
              (detailItem?.edge_ids && detailItem.edge_ids.length > 0) ||
              (detailItem?.edges && detailItem.edges.length > 0),
          );

          return (
            <Card key={item.path_id}>
              <div className="d-flex flex-column gap-3">
                <div className="d-flex justify-content-between align-items-start gap-3 flex-wrap">
                  <div className="d-flex flex-column gap-2 min-w-0">
                    <div className="d-flex align-items-center gap-2 flex-wrap">
                      <RiskLevelBadge level={item.risk_level} />
                      <span className="text-muted small">path_id</span>
                      <code
                        className="d-inline-block mw-100"
                        title={item.path_id}
                        style={{ fontSize: '0.78rem', wordBreak: 'break-all' }}
                      >
                        {item.path_id}
                      </code>
                    </div>
                    {'title' in item && item.title ? (
                      <div className="small fw-semibold text-truncate" title={item.title}>
                        {item.title}
                      </div>
                    ) : null}
                  </div>

                  {hasDetail ? (
                    <button
                      type="button"
                      className="btn btn-sm dg-dashboard-action-btn dg-dashboard-action-btn--secondary"
                      onClick={() => toggleExpanded(item.path_id)}
                    >
                      {isExpanded ? '접기' : '상세 보기'}
                    </button>
                  ) : null}
                </div>

                <div className="row g-3 small">
                  <div className="col-6 col-lg-2">
                    <div className="text-muted mb-1">risk_score</div>
                    <div className="fw-semibold">{formatNumber(item.risk_score)}</div>
                  </div>
                  <div className="col-6 col-lg-2">
                    <div className="text-muted mb-1">raw_final_risk</div>
                    <div className="fw-semibold">{formatNumber(item.raw_final_risk)}</div>
                  </div>
                  <div className="col-6 col-lg-2">
                    <div className="text-muted mb-1">hop_count</div>
                    <div className="fw-semibold">{formatNumber(item.hop_count)}</div>
                  </div>
                  <div className="col-12 col-lg-3">
                    <div className="text-muted mb-1">entry_node_id</div>
                    <code
                      className="d-block"
                      title={item.entry_node_id ?? '-'}
                      style={{ fontSize: '0.76rem', wordBreak: 'break-all' }}
                    >
                      {item.entry_node_id ?? '-'}
                    </code>
                  </div>
                  <div className="col-12 col-lg-3">
                    <div className="text-muted mb-1">target_node_id</div>
                    <code
                      className="d-block"
                      title={item.target_node_id ?? '-'}
                      style={{ fontSize: '0.76rem', wordBreak: 'break-all' }}
                    >
                      {item.target_node_id ?? '-'}
                    </code>
                  </div>
                </div>

                {isExpanded ? (
                  <div
                    className="rounded-3 p-3"
                    style={{
                      background: 'rgba(255,255,255,0.03)',
                      border: '1px solid var(--border-subtle)',
                    }}
                  >
                    <div className="row g-3">
                      <div className="col-12">
                        <div className="text-muted small mb-1">title</div>
                        <div className="fw-semibold">{('title' in item && item.title) ? item.title : '-'}</div>
                      </div>

                      <div className="col-12 col-xl-6">
                        <div className="text-muted small mb-2">node_ids</div>
                        {'node_ids' in item && Array.isArray(item.node_ids) && item.node_ids.length > 0 ? (
                          <div className="d-flex flex-column gap-2">
                            {item.node_ids.map((nodeId, index) => (
                              <code
                                key={`${item.path_id}-node-${index}`}
                                className="d-block"
                                title={nodeId}
                                style={{ fontSize: '0.76rem', wordBreak: 'break-all' }}
                              >
                                {nodeId}
                              </code>
                            ))}
                          </div>
                        ) : (
                          <div className="text-muted small">-</div>
                        )}
                      </div>

                      <div className="col-12 col-xl-6">
                        <div className="text-muted small mb-2">edge_ids</div>
                        {detailItem?.edge_ids && detailItem.edge_ids.length > 0 ? (
                          <div className="d-flex flex-column gap-2">
                            {detailItem.edge_ids.map((edgeId, index) => (
                              <code
                                key={`${item.path_id}-edge-${index}`}
                                className="d-block"
                                title={edgeId}
                                style={{ fontSize: '0.76rem', wordBreak: 'break-all' }}
                              >
                                {edgeId}
                              </code>
                            ))}
                          </div>
                        ) : (
                          <div className="text-muted small">-</div>
                        )}
                      </div>

                      <div className="col-12">
                        <div className="text-muted small mb-2">edges</div>
                        {detailItem?.edges && detailItem.edges.length > 0 ? (
                          <ol className="mb-0 ps-3 d-flex flex-column gap-2">
                            {detailItem.edges.map((edge) => (
                              <li key={edge.edge_id} className="small">
                                <span className="fw-semibold">{edge.source_node_id}</span>
                                <span className="text-muted"> {'->'} </span>
                                <span className="dg-badge dg-badge--tag mx-1">{edge.edge_type}</span>
                                <span className="text-muted"> {'->'} </span>
                                <span className="fw-semibold">{edge.target_node_id}</span>
                              </li>
                            ))}
                          </ol>
                        ) : (
                          <div className="text-muted small">-</div>
                        )}
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
};

const RecommendationsTabContent: React.FC<{ result: AnalysisResultResponse }> = ({ result }) => {
  const items =
    Array.isArray(result.remediation_recommendations) && result.remediation_recommendations.length > 0
      ? result.remediation_recommendations
      : [];

  if (items.length === 0) {
    return (
      <EmptyPlaceholder
        title="표시할 권고사항이 없습니다."
        description="이번 분석에서 도출된 권고사항이 준비되면 이 탭에서 요약을 확인할 수 있습니다."
      />
    );
  }

  return (
    <div className="d-flex flex-column gap-3">
      <div>
        <h3 className="h6 fw-semibold mb-1">이번 분석에서 도출된 권고사항 요약</h3>
        <p className="text-muted small mb-0">
          운영용 remediation 화면을 대체하지 않고, 이번 분석에서 선택된 권고안만 요약해서 보여줍니다.
        </p>
      </div>

      <div className="d-flex flex-column gap-3">
        {items.map((item) => (
          <Card key={item.recommendation_id}>
            <div className="d-flex flex-column gap-3">
              <div className="d-flex justify-content-between align-items-start gap-3 flex-wrap">
                <div className="d-flex flex-column gap-2 min-w-0">
                  <div className="d-flex align-items-center gap-2 flex-wrap">
                    <span className="dg-badge dg-badge--tag">
                      #{typeof item.recommendation_rank === 'number' ? item.recommendation_rank + 1 : '-'}
                    </span>
                    <span className="text-muted small">recommendation_id</span>
                    <code
                      className="d-inline-block"
                      title={item.recommendation_id}
                      style={{
                        maxWidth: '100%',
                        fontSize: '0.78rem',
                        overflowWrap: 'anywhere',
                      }}
                    >
                      {item.recommendation_id}
                    </code>
                  </div>

                  <div className="d-flex align-items-center gap-2 flex-wrap small">
                    <span className="fw-semibold">{formatFixType(item.fix_type)}</span>
                    <span className="text-muted">|</span>
                    <span title={item.edge_source ?? '-'} className="text-truncate" style={{ maxWidth: '16rem' }}>
                      {item.edge_source ?? '-'}
                    </span>
                    <span className="text-muted">{'->'}</span>
                    <span className="dg-badge dg-badge--tag">{item.edge_type ?? '-'}</span>
                    <span className="text-muted">{'->'}</span>
                    <span title={item.edge_target ?? '-'} className="text-truncate" style={{ maxWidth: '16rem' }}>
                      {item.edge_target ?? '-'}
                    </span>
                  </div>
                </div>

                <div className="d-flex align-items-center gap-2 flex-wrap">
                  {item.llm_status ? (
                    <span className="dg-badge dg-badge--tag">{normalizeLlmStatus(item.llm_status)}</span>
                  ) : (
                    <span className="text-muted small">llm_status -</span>
                  )}
                </div>
              </div>

              <div className="row g-3 small">
                <div className="col-6 col-lg-2">
                  <div className="text-muted mb-1">blocked_paths</div>
                  <div className="fw-semibold">{blockedPathCount(item)}</div>
                </div>
                <div className="col-6 col-lg-2">
                  <div className="text-muted mb-1">covered_risk</div>
                  <div className="fw-semibold">{formatCoveredRisk(item.covered_risk)}</div>
                </div>
                <div className="col-6 col-lg-3">
                  <div className="text-muted mb-1">cumulative_risk_reduction</div>
                  <div className="fw-semibold text-success">
                    {formatReduction(item.cumulative_risk_reduction)}
                  </div>
                </div>
                <div className="col-12 col-lg-4">
                  <div className="text-muted mb-1">edge_type</div>
                  <div className="fw-semibold">{item.edge_type ?? '-'}</div>
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
};

const AnalysisResultTabbedSection: React.FC<{ result: AnalysisResultResponse }> = ({ result }) => {
  const [activeTab, setActiveTab] = React.useState<ResultTab>('overview');

  return (
    <Card>
      <div className="d-flex flex-column gap-4">
        <div className="d-flex justify-content-between align-items-end gap-3 flex-wrap">
          <div>
            <h2 className="h6 fw-semibold mb-1" style={{ color: 'var(--text-accent, #93c5fd)' }}>
              결과 상세
            </h2>
            <p className="text-muted small mb-0">개요는 요약, 탭은 범주별 결과를 읽는 영역입니다.</p>
          </div>
          <ul className="nav nav-tabs mb-0">
            <li className="nav-item">
              <button
                type="button"
                className={`nav-link ${activeTab === 'overview' ? 'active' : ''}`}
                onClick={() => setActiveTab('overview')}
              >
                Overview
              </button>
            </li>
            <li className="nav-item">
              <button
                type="button"
                className={`nav-link ${activeTab === 'attack-paths' ? 'active' : ''}`}
                onClick={() => setActiveTab('attack-paths')}
              >
                Attack Paths
              </button>
            </li>
            <li className="nav-item">
              <button
                type="button"
                className={`nav-link ${activeTab === 'recommendations' ? 'active' : ''}`}
                onClick={() => setActiveTab('recommendations')}
              >
                Recommendations
              </button>
            </li>
          </ul>
        </div>

        {activeTab === 'overview' ? (
          <div className="d-flex flex-column gap-4">
            <OverviewAttackPathsPreview result={result} />
            <OverviewRecommendationsPreview result={result} />
          </div>
        ) : null}

        {activeTab === 'attack-paths' ? (
          <AttackPathsTabContent result={result} />
        ) : null}

        {activeTab === 'recommendations' ? (
          <RecommendationsTabContent result={result} />
        ) : null}
      </div>
    </Card>
  );
};

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

  const { job } = result;
  const clusterId = job.cluster_id;
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

  return (
    <div className="dg-page-shell">
      <div className="d-flex flex-column gap-4">
        <AnalysisResultHeader result={result} backTarget={backTarget} />
        <AnalysisResultSummaryCards result={result} />
        <AnalysisMetricsSection result={result} />
        <AnalysisResultTabbedSection result={result} />
      </div>
    </div>
  );
};

export default AnalysisJobDetailPage;
