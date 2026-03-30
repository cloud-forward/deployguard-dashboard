import React, { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import {
  getGetRemediationRecommendationDetailApiV1ClustersClusterIdRemediationRecommendationsRecommendationIdGetQueryKey,
  getGetRemediationRecommendationsApiV1ClustersClusterIdRemediationRecommendationsGetQueryKey,
  useExplainRemediationRecommendationApiV1ClustersClusterIdRemediationRecommendationsRecommendationIdExplanationPost,
  useGetRemediationRecommendationDetailApiV1ClustersClusterIdRemediationRecommendationsRecommendationIdGet,
} from '../api/generated/clusters/clusters';
import type {
  RecommendationExplanationResponse,
  RemediationRecommendationDetailEnvelopeResponse,
  RemediationRecommendationDetailResponse,
} from '../api/model';
import {
  blockedPathCount,
  clampPercent,
  costLabel,
  formatCoveredRisk,
  formatFixType,
  formatReduction,
  formatResource,
} from '../components/risk/recommendationFormatters';

// ── pure helpers ─────────────────────────────────────────────────────────────

const formatDateTime = (value?: string | null) => {
  if (!value) return '-';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString('ko-KR');
};

const toErrorMessage = (error: unknown, fallback: string) => {
  if (error && typeof error === 'object' && 'message' in error) {
    const msg = (error as { message: unknown }).message;
    if (typeof msg === 'string' && msg.trim()) return msg;
  }
  return fallback;
};

const normalizeLlmStatus = (value?: string | null): 'not_generated' | 'generated' | 'failed' => {
  if (value === 'generated' || value === 'failed') return value;
  return 'not_generated';
};

const isRemediationRecommendationEnvelope = (
  value: unknown,
): value is RemediationRecommendationDetailEnvelopeResponse =>
  Boolean(value && typeof value === 'object' && 'cluster_id' in value);

/** Strip common raw path-id prefixes and shorten UUID-like segments. */
const formatPathId = (id: string): string => {
  let s = id
    .replace(/^attack[_-]?path::/i, '')
    .replace(/^path::/i, '')
    .replace(/^[a-z0-9-]+::/i, ''); // strip first namespace segment like "cluster-1::"

  // If still looks like a plain UUID, keep first 8 chars for brevity
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)) {
    return s.slice(0, 8) + '…';
  }

  // Shorten each segment separated by :: or /
  const segments = s.split(/::|\//);
  return segments
    .map((seg) => {
      // Truncate UUID-like segments
      if (/^[0-9a-f]{8}-[0-9a-f]{4}/i.test(seg)) return seg.slice(0, 8) + '…';
      // Trim trailing hash suffixes like -abc12-def34
      return seg.replace(/-[a-z0-9]{5,}(?:-[a-z0-9]{4,})?$/, '');
    })
    .filter(Boolean)
    .join(' → ');
};

const renderValue = (value: unknown): string => {
  if (value == null) return '-';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
};

// ── shared micro-components ──────────────────────────────────────────────────

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

const CollapseControl: React.FC<{
  expanded: boolean;
  onToggle: () => void;
}> = ({ expanded, onToggle }) => (
  <button
    type="button"
    onClick={onToggle}
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: '0.25rem',
      padding: '0.22rem 0.75rem',
      background: 'rgba(255,255,255,0.05)',
      border: '1px solid rgba(148,163,184,0.22)',
      borderRadius: '999px',
      color: 'rgba(191,219,254,0.88)',
      fontSize: '0.75rem',
      fontWeight: 500,
      lineHeight: 1.4,
      cursor: 'pointer',
      flexShrink: 0,
    }}
  >
    {expanded ? '접기 ↑' : '더보기 ↓'}
  </button>
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
      {value}
    </div>
  </div>
);

const FieldRow: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
  <div className="d-flex flex-column flex-sm-row gap-1 gap-sm-3 small">
    <span className="text-muted flex-shrink-0" style={{ minWidth: '8rem' }}>
      {label}
    </span>
    <span className="text-break fw-semibold">{value ?? '-'}</span>
  </div>
);

// ── section components ───────────────────────────────────────────────────────

const SummaryBanner: React.FC<{ rec: RemediationRecommendationDetailResponse }> = ({ rec }) => {
  const pathCount = blockedPathCount(rec);
  const coveredRisk = formatCoveredRisk(rec.covered_risk);
  const reduction = formatReduction(rec.cumulative_risk_reduction);

  return (
    <div
      className="rounded-3 px-4 py-3"
      style={{
        background: 'rgba(59,130,246,0.08)',
        border: '1px solid rgba(59,130,246,0.25)',
      }}
    >
      <p className="mb-0" style={{ lineHeight: 1.7 }}>
        이 조치 하나로{' '}
        <strong style={{ color: 'var(--text-accent, #93c5fd)' }}>{pathCount}개 공격 경로</strong>를
        차단하고, 위험을{' '}
        <strong style={{ color: 'var(--text-accent, #93c5fd)' }}>{coveredRisk}</strong> 줄이며,
        누적 위험을{' '}
        <strong className="text-success">{reduction}</strong> 감소시킵니다.
      </p>
    </div>
  );
};

const WhatWillChangeSection: React.FC<{ rec: RemediationRecommendationDetailResponse }> = ({
  rec,
}) => {
  const meta = (rec.metadata ?? {}) as Record<string, unknown>;
  const baseAction = typeof meta.base_action === 'string' ? meta.base_action : null;

  return (
    <Card>
      <SectionTitle>무엇이 변경되나요?</SectionTitle>
      <div className="d-flex flex-column gap-4">
        <div>
          <div className="text-muted small mb-2 fw-semibold">변경 대상</div>
          <div
            className="rounded-3 p-3 d-flex flex-column gap-2"
            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-subtle)' }}
          >
            <FieldRow
              label="출발 리소스"
              value={rec.edge_source ? formatResource(rec.edge_source) : '-'}
            />
            <FieldRow
              label="대상 리소스"
              value={rec.edge_target ? formatResource(rec.edge_target) : '-'}
            />
            <FieldRow label="관계 유형" value={rec.edge_type} />
          </div>
        </div>
        {baseAction && (
          <div>
            <div className="text-muted small mb-2 fw-semibold">권장 조치</div>
            <div
              className="rounded-3 p-3 small"
              style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-subtle)' }}
            >
              {baseAction}
            </div>
          </div>
        )}
      </div>
    </Card>
  );
};

const WhyItMattersSection: React.FC<{ rec: RemediationRecommendationDetailResponse }> = ({
  rec,
}) => {
  const meta = (rec.metadata ?? {}) as Record<string, unknown>;
  const impactReason = typeof meta.impact_reason === 'string' ? meta.impact_reason : null;

  if (!impactReason) return null;

  return (
    <Card>
      <SectionTitle>왜 중요한가요?</SectionTitle>
      <p
        className="mb-0 small"
        style={{ lineHeight: 1.8, whiteSpace: 'pre-wrap' }}
      >
        {impactReason}
      </p>
    </Card>
  );
};

const KpiSection: React.FC<{ rec: RemediationRecommendationDetailResponse }> = ({ rec }) => {
  const pathCount = blockedPathCount(rec);
  const reductionPct = clampPercent(rec.cumulative_risk_reduction);
  const cost =
    typeof rec.fix_cost === 'number' && !Number.isNaN(rec.fix_cost)
      ? costLabel(rec.fix_cost)
      : '-';
  const edgeScore =
    typeof rec.edge_score === 'number' && !Number.isNaN(rec.edge_score)
      ? rec.edge_score.toFixed(2)
      : '-';

  return (
    <div className="row g-3">
      <div className="col-6 col-md-4 col-xl">
        <KpiCard label="차단 경로 수" value={pathCount} />
      </div>
      <div className="col-6 col-md-4 col-xl">
        <KpiCard label="감소 위험" value={formatCoveredRisk(rec.covered_risk)} />
      </div>
      <div className="col-6 col-md-4 col-xl">
        <KpiCard label="누적 감소율" value={formatReduction(rec.cumulative_risk_reduction)} accent />
      </div>
      <div className="col-6 col-md-4 col-xl">
        <KpiCard label="조치 비용" value={cost} />
      </div>
      <div className="col-6 col-md-4 col-xl">
        <KpiCard label="효율 점수" value={edgeScore} />
      </div>
    </div>
  );
};

const RiskReductionBar: React.FC<{ rec: RemediationRecommendationDetailResponse }> = ({ rec }) => {
  const pct = clampPercent(rec.cumulative_risk_reduction);

  return (
    <Card>
      <SectionTitle>위험 감소 현황</SectionTitle>
      <div className="d-flex justify-content-between align-items-center mb-2 small">
        <span className="text-muted">누적 위험 감소율</span>
        <span className="fw-bold text-success">{formatReduction(rec.cumulative_risk_reduction)}</span>
      </div>
      <div
        className="rounded-pill overflow-hidden"
        style={{ height: '12px', background: 'rgba(255,255,255,0.08)' }}
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`누적 위험 감소율 ${formatReduction(rec.cumulative_risk_reduction)}`}
      >
        <div
          className="h-100 bg-success"
          style={{ width: `${pct}%`, borderRadius: 'inherit', transition: 'width 0.4s ease' }}
        />
      </div>
    </Card>
  );
};

const PATHS_INITIAL = 10;

const BlockedPathsSection: React.FC<{ rec: RemediationRecommendationDetailResponse }> = ({
  rec,
}) => {
  const [expanded, setExpanded] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const pathIds = Array.isArray(rec.blocked_path_ids) ? rec.blocked_path_ids : [];
  const total = pathIds.length;
  const displayed = showAll ? pathIds : pathIds.slice(0, PATHS_INITIAL);
  const previewPath = pathIds[0] ? formatPathId(pathIds[0]) : '';

  const handleToggle = () => {
    setExpanded((prev) => {
      if (prev) setShowAll(false);
      return !prev;
    });
  };

  return (
    <Card>
      <div className="d-flex justify-content-between align-items-start mb-3 gap-2">
        <div>
          <SectionTitle>차단되는 공격 경로</SectionTitle>
          <div className="text-muted small" style={{ marginTop: '-0.55rem' }}>
            이 권고를 적용하면 차단되는 공격 경로 목록입니다.
          </div>
        </div>
        <div className="d-flex align-items-center gap-2 flex-shrink-0" style={{ marginTop: '-0.1rem' }}>
          <span className="dg-badge dg-badge--tag">총 {total}개</span>
          {expanded && total > 0 && (
            <CollapseControl expanded={true} onToggle={handleToggle} />
          )}
        </div>
      </div>

      {total === 0 ? (
        <div className="text-muted small">차단된 공격 경로 정보가 없습니다.</div>
      ) : expanded ? (
        <>
          <div className="d-flex flex-column gap-2">
            {displayed.map((id, i) => (
              <div
                key={id}
                className="d-flex align-items-start gap-3 rounded-3 px-3 py-2 small"
                style={{
                  background: 'rgba(255,255,255,0.02)',
                  border: '1px solid var(--border-subtle)',
                }}
              >
                <span
                  className="text-muted flex-shrink-0 fw-semibold"
                  style={{ minWidth: '2rem', paddingTop: '1px', fontSize: '0.7rem' }}
                >
                  #{i + 1}
                </span>
                <span className="text-break" style={{ lineHeight: 1.6 }}>
                  {formatPathId(id)}
                </span>
              </div>
            ))}
          </div>
          {total > PATHS_INITIAL && (
            <div className="mt-3">
              <button
                type="button"
                className="btn btn-outline-secondary btn-sm"
                onClick={() => setShowAll((v) => !v)}
              >
                {showAll ? '목록 줄이기' : `더 보기 (+${total - PATHS_INITIAL}개)`}
              </button>
            </div>
          )}
        </>
      ) : (
        <>
          <div
            className="rounded-3 px-3 py-2 small text-muted text-break"
            style={{
              background: 'rgba(255,255,255,0.02)',
              border: '1px solid var(--border-subtle)',
              lineHeight: 1.6,
            }}
          >
            {previewPath}
          </div>
          <div className="d-flex justify-content-end mt-3">
            <CollapseControl expanded={false} onToggle={handleToggle} />
          </div>
        </>
      )}
    </Card>
  );
};

const DescriptionSection: React.FC<{ rec: RemediationRecommendationDetailResponse }> = ({
  rec,
}) => {
  return (
    <Card className="h-100">
      <SectionTitle>원본 설명</SectionTitle>
      {rec.fix_description?.trim() ? (
        <p className="mb-0 small" style={{ lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>
          {rec.fix_description}
        </p>
      ) : (
        <div className="text-muted small">원본 설명 정보가 없습니다.</div>
      )}
    </Card>
  );
};

const AiExplanationSection: React.FC<{
  rec: RemediationRecommendationDetailResponse;
  isGenerating: boolean;
  errorMessage: string | null;
  onGenerate: () => void;
  latestExplanation: RecommendationExplanationResponse | null;
}> = ({ rec, isGenerating, errorMessage, onGenerate, latestExplanation }) => {
  const llmStatus = normalizeLlmStatus(rec.llm_status);
  const displayedExplanation =
    rec.llm_explanation?.trim() ||
    latestExplanation?.final_explanation?.trim() ||
    latestExplanation?.base_explanation?.trim() ||
    '';
  const providerModel = [rec.llm_provider, rec.llm_model].filter(Boolean).join(' / ');
  const persistedError = llmStatus === 'failed' ? rec.llm_error_message?.trim() || null : null;
  const effectiveError = errorMessage || persistedError;
  const showGenerateButton = llmStatus !== 'generated' || Boolean(persistedError);

  return (
    <Card className="h-100">
      <div className="d-flex flex-wrap justify-content-between align-items-start gap-3 mb-4">
        <div>
          <SectionTitle>AI 설명</SectionTitle>
          <p className="text-muted small mb-0">
            이 권고사항에 대한 AI 생성 설명입니다.
          </p>
        </div>
        {showGenerateButton && (
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={onGenerate}
            disabled={isGenerating}
          >
            {isGenerating
              ? 'AI 설명 생성 중…'
              : llmStatus === 'failed'
                ? 'AI 설명 다시 생성'
                : 'AI 설명 생성'}
          </button>
        )}
      </div>

      {effectiveError && (
        <div className="alert alert-danger py-2 mb-3" role="alert">
          {effectiveError}
        </div>
      )}

      {isGenerating ? (
        <div className="d-flex align-items-center gap-2 text-muted small">
          <div className="spinner-border spinner-border-sm" role="status" aria-hidden="true" />
          설명을 생성하고 있습니다. 잠시 후 자동으로 새로고침됩니다.
        </div>
      ) : llmStatus === 'generated' && displayedExplanation ? (
        <div className="d-flex flex-column gap-3">
          <div
            className="rounded-3 p-3 small"
            style={{
              background: 'rgba(59,130,246,0.06)',
              border: '1px solid rgba(59,130,246,0.2)',
              whiteSpace: 'pre-wrap',
              lineHeight: 1.8,
            }}
          >
            {displayedExplanation}
          </div>
          <div className="d-flex flex-wrap gap-2">
            {providerModel && (
              <span className="dg-badge dg-badge--tag">{providerModel}</span>
            )}
            {rec.llm_generated_at && (
              <span className="dg-badge dg-badge--tag">
                생성 시각: {formatDateTime(rec.llm_generated_at)}
              </span>
            )}
          </div>
        </div>
      ) : llmStatus === 'failed' ? (
        <div className="text-muted small">설명 생성에 실패했습니다. 다시 시도해 주세요.</div>
      ) : (
        <div className="text-muted small">AI 설명이 아직 생성되지 않았습니다.</div>
      )}
    </Card>
  );
};

const TechnicalDetailsSection: React.FC<{
  rec: RemediationRecommendationDetailResponse;
  clusterId: string;
  envelope: RemediationRecommendationDetailEnvelopeResponse;
}> = ({ rec, clusterId, envelope }) => {
  const [expanded, setExpanded] = useState(false);
  const meta = (rec.metadata ?? {}) as Record<string, unknown>;
  const fields: Array<{ label: string; value: unknown }> = [
    { label: 'recommendation_id', value: rec.recommendation_id },
    { label: 'cluster_id', value: clusterId },
    { label: 'analysis_run_id', value: envelope.analysis_run_id },
    { label: 'edge_source', value: rec.edge_source },
    { label: 'edge_target', value: rec.edge_target },
    { label: 'edge_type', value: rec.edge_type },
    { label: 'fix_type', value: rec.fix_type },
    { label: 'blocked_path_indices', value: rec.blocked_path_indices?.join(', ') },
    { label: 'metadata.edge_source_type', value: meta.edge_source_type },
    { label: 'metadata.edge_target_type', value: meta.edge_target_type },
    { label: 'metadata.effective_fix_cost', value: meta.effective_fix_cost },
  ];
  const previewLine =
    rec.edge_source || rec.edge_target
      ? `${formatResource(rec.edge_source ?? '')} → ${formatResource(rec.edge_target ?? '')}`
      : `recommendation_id: ${renderValue(rec.recommendation_id)}`;

  return (
    <Card>
      <div className="d-flex justify-content-between align-items-start mb-3 gap-2">
        <div>
          <SectionTitle>기술 상세 정보</SectionTitle>
          <div className="text-muted small" style={{ marginTop: '-0.55rem' }}>
            권고사항 계산에 사용된 원본 식별자와 세부 속성입니다.
          </div>
        </div>
        {expanded && (
          <CollapseControl
            expanded={true}
            onToggle={() => setExpanded(false)}
          />
        )}
      </div>

      {expanded ? (
        <div className="d-flex flex-column gap-2">
          {fields.map(({ label, value }) => (
            <div
              key={label}
              className="d-flex flex-column flex-sm-row gap-1 gap-sm-3 small px-3 py-2 rounded-3"
              style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-subtle)' }}
            >
              <code
                className="text-muted flex-shrink-0"
                style={{ minWidth: '18rem', fontSize: '0.72rem' }}
              >
                {label}
              </code>
              <span className="text-break">{renderValue(value)}</span>
            </div>
          ))}
        </div>
      ) : (
        <>
          <div
            className="rounded-3 px-3 py-2 small text-muted text-break"
            style={{
              background: 'rgba(255,255,255,0.02)',
              border: '1px solid var(--border-subtle)',
              lineHeight: 1.6,
            }}
          >
            {previewLine}
          </div>
          <div className="d-flex justify-content-end mt-3">
            <CollapseControl
              expanded={false}
              onToggle={() => setExpanded(true)}
            />
          </div>
        </>
      )}
    </Card>
  );
};

// ── page ─────────────────────────────────────────────────────────────────────

const RemediationRecommendationDetailPage: React.FC = () => {
  const { clusterId = '', recommendationId = '' } = useParams();
  const queryClient = useQueryClient();
  const [latestExplanation, setLatestExplanation] =
    useState<RecommendationExplanationResponse | null>(null);
  const [explanationError, setExplanationError] = useState<string | null>(null);
  const [isRefreshingExplanation, setIsRefreshingExplanation] = useState(false);

  const query =
    useGetRemediationRecommendationDetailApiV1ClustersClusterIdRemediationRecommendationsRecommendationIdGet(
      clusterId,
      recommendationId,
      { query: { enabled: Boolean(clusterId && recommendationId), retry: false } },
    );

  const explainMutation =
    useExplainRemediationRecommendationApiV1ClustersClusterIdRemediationRecommendationsRecommendationIdExplanationPost(
      { mutation: { retry: false } },
    );

  const envelope = isRemediationRecommendationEnvelope(query.data) ? query.data : null;
  const recommendation = envelope?.recommendation ?? null;

  const resetExplanationMutation = explainMutation.reset;
  useEffect(() => {
    setLatestExplanation(null);
    setExplanationError(null);
    setIsRefreshingExplanation(false);
    resetExplanationMutation();
  }, [clusterId, recommendationId, resetExplanationMutation]);

  const handleGenerateExplanation = async () => {
    if (!clusterId || !recommendationId || explainMutation.isPending || isRefreshingExplanation) {
      return;
    }
    setExplanationError(null);
    setLatestExplanation(null);
    setIsRefreshingExplanation(true);
    try {
      const response = await explainMutation.mutateAsync({
        clusterId,
        recommendationId,
        data: {},
      });
      setLatestExplanation(response as RecommendationExplanationResponse);
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey:
            getGetRemediationRecommendationDetailApiV1ClustersClusterIdRemediationRecommendationsRecommendationIdGetQueryKey(
              clusterId,
              recommendationId,
            ),
        }),
        queryClient.invalidateQueries({
          queryKey:
            getGetRemediationRecommendationsApiV1ClustersClusterIdRemediationRecommendationsGetQueryKey(
              clusterId,
            ),
        }),
      ]);
      await Promise.all([
        queryClient.refetchQueries({
          queryKey:
            getGetRemediationRecommendationDetailApiV1ClustersClusterIdRemediationRecommendationsRecommendationIdGetQueryKey(
              clusterId,
              recommendationId,
            ),
          type: 'active',
        }),
        queryClient.refetchQueries({
          queryKey:
            getGetRemediationRecommendationsApiV1ClustersClusterIdRemediationRecommendationsGetQueryKey(
              clusterId,
            ),
          type: 'active',
        }),
      ]);
    } catch (error) {
      setExplanationError(
        toErrorMessage(error, 'AI 설명 생성에 실패했습니다. 다시 시도해 주세요.'),
      );
    } finally {
      setIsRefreshingExplanation(false);
    }
  };

  // ── loading / error / empty states ──────────────────────────────────────

  if (query.isLoading) {
    return (
      <div className="dg-page-shell">
        <div className="card border-0 shadow-sm">
          <div className="card-body py-5 text-center text-muted">
            권고사항 상세 정보를 불러오는 중…
          </div>
        </div>
      </div>
    );
  }

  if (query.isError) {
    return (
      <div className="dg-page-shell">
        <div className="card border-0 shadow-sm">
          <div className="card-body py-4">
            <div className="alert alert-danger mb-3" role="alert">
              {toErrorMessage(query.error, '권고사항 상세 정보를 불러오지 못했습니다.')}
            </div>
            <button
              type="button"
              className="btn btn-outline-secondary btn-sm"
              onClick={() => query.refetch()}
            >
              다시 시도
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!envelope || !recommendation) {
    return (
      <div className="dg-page-shell">
        <div className="card border-0 shadow-sm">
          <div className="card-body py-5 text-center">
            <h1 className="h5 mb-2">권고사항을 찾을 수 없습니다.</h1>
            <p className="text-muted small mb-3">
              이 권고사항에 대한 상세 정보가 반환되지 않았습니다.
            </p>
            <Link to="/remediation" className="btn btn-outline-secondary btn-sm">
              목록으로 돌아가기
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const isGenerating = explainMutation.isPending || isRefreshingExplanation;
  const title = formatFixType(recommendation.fix_type);
  const rank = recommendation.recommendation_rank + 1;

  // ── main render ──────────────────────────────────────────────────────────

  return (
    <div className="dg-page-shell">
      {/* [1] Page header */}
      <div className="dg-page-header">
        <div className="d-flex flex-column gap-2 flex-grow-1 min-w-0">
          <div className="d-flex justify-content-between align-items-start gap-3">
            <div className="min-w-0">
              <h1 className="dg-page-title mb-0">권고사항 상세</h1>
            </div>
            <Link to="/remediation" className="btn btn-outline-secondary btn-sm flex-shrink-0">
              ← 목록으로
            </Link>
          </div>
          <div className="d-flex flex-wrap align-items-center gap-2">
            <span
              className="d-inline-flex align-items-center rounded-pill"
              style={{
                padding: '0.32rem 0.72rem',
                background: 'rgba(59, 130, 246, 0.16)',
                border: '1px solid rgba(96, 165, 250, 0.32)',
                color: '#dbeafe',
                fontSize: '0.83rem',
                fontWeight: 600,
                lineHeight: 1.2,
              }}
            >
              우선순위 #{rank}
            </span>
            <span
              className="d-inline-flex align-items-center rounded-pill"
              style={{
                padding: '0.32rem 0.72rem',
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid var(--border-subtle)',
                color: 'rgba(226, 232, 240, 0.92)',
                fontSize: '0.83rem',
                fontWeight: 500,
                lineHeight: 1.2,
              }}
            >
              {title}
            </span>
          </div>
          <div className="d-flex justify-content-end">
            <span className="text-muted small">
              생성 시각 {formatDateTime(envelope.generated_at)}
            </span>
          </div>
        </div>
      </div>

      <div className="d-flex flex-column gap-4">
        <div className="d-flex flex-column gap-3">
          {/* [2] Summary banner */}
          <SummaryBanner rec={recommendation} />

          {/* [3] KPI cards */}
          <KpiSection rec={recommendation} />

          {/* [4] Risk reduction bar */}
          <RiskReductionBar rec={recommendation} />
        </div>

        {/* [5] What will change */}
        <WhatWillChangeSection rec={recommendation} />

        {/* [6] Why it matters */}
        <WhyItMattersSection rec={recommendation} />

        {/* [7] Explanation row */}
        <div className="row g-4 align-items-stretch">
          <div className="col-12 col-xl-6">
            <DescriptionSection rec={recommendation} />
          </div>
          <div className="col-12 col-xl-6">
            <AiExplanationSection
              rec={recommendation}
              isGenerating={isGenerating}
              errorMessage={explanationError}
              onGenerate={handleGenerateExplanation}
              latestExplanation={latestExplanation}
            />
          </div>
        </div>

        {/* [7] Blocked attack paths */}
        <BlockedPathsSection rec={recommendation} />

        {/* [10] Technical details (collapsible) */}
        <TechnicalDetailsSection
          rec={recommendation}
          clusterId={clusterId}
          envelope={envelope}
        />
      </div>
    </div>
  );
};

export default RemediationRecommendationDetailPage;
