import React from 'react';
import { Link } from 'react-router-dom';
import { useGetRemediationRecommendationsApiV1ClustersClusterIdRemediationRecommendationsGet } from '../../api/generated/clusters/clusters';
import type { RemediationRecommendationListItemResponse } from '../../api/model';
import {
  blockedPathCount,
  clampPercent,
  costLabel,
  formatCoveredRisk,
  formatFixType,
  formatReduction,
  formatResource,
} from './recommendationFormatters';

const normalizeLlmStatus = (value?: string | null): 'not_generated' | 'generated' | 'failed' => {
  if (value === 'generated' || value === 'failed') {
    return value;
  }

  return 'not_generated';
};

interface Props {
  clusterId: string;
}

const ChokePointList: React.FC<Props> = ({ clusterId }) => {
  const { data, isLoading, isError, refetch } =
    useGetRemediationRecommendationsApiV1ClustersClusterIdRemediationRecommendationsGet(
      clusterId,
      { query: { enabled: Boolean(clusterId), retry: false } },
    );

  const items: RemediationRecommendationListItemResponse[] = Array.isArray(
    (data as { items?: RemediationRecommendationListItemResponse[] } | undefined)?.items,
  )
    ? ((data as { items?: RemediationRecommendationListItemResponse[] }).items ?? [])
    : [];

  if (!clusterId) {
    return (
      <div className="text-muted py-4 text-center">
        클러스터를 선택하면 권장 사항이 표시됩니다.
      </div>
    );
  }

  if (isLoading) {
    return <div className="text-muted py-4 text-center">권장 사항을 불러오는 중…</div>;
  }

  if (isError) {
    return (
      <div>
        <div className="alert alert-danger mb-3">권장 사항을 불러오지 못했습니다.</div>
        <button
          type="button"
          className="btn btn-sm dg-dashboard-action-btn dg-dashboard-action-btn--secondary"
          onClick={() => refetch()}
        >
          다시 시도
        </button>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="card border-0 shadow-sm">
        <div className="card-body py-5 text-center">
          <h2 className="h5 mb-2">권장 사항 없음</h2>
          <p className="text-muted mb-0">분석 데이터가 생성된 후 권장 사항이 표시됩니다.</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <style>{`
        .dg-recommendation-list-card {
          background: var(--bg-card);
          border: 1px solid var(--border-subtle) !important;
          border-radius: 10px;
          box-shadow: var(--shadow-card);
          overflow: hidden;
        }
        .dg-recommendation-list-card:hover {
          background: rgba(255, 255, 255, 0.04);
        }
        .dg-recommendation-progress {
          height: 8px;
          background: rgba(255, 255, 255, 0.08);
        }
        .dg-recommendation-metric {
          min-width: 0;
          padding: 0.75rem;
          border: 1px solid var(--border-subtle);
          border-radius: 0.75rem;
          background: rgba(255, 255, 255, 0.02);
        }
        .dg-recommendation-metric-value {
          font-size: 1rem;
          font-weight: 700;
          line-height: 1.1;
        }
        .dg-recommendation-target {
          font-size: 0.92rem;
          line-height: 1.35;
        }
      `}</style>
      <div className="row g-3">
      {items.map((item) => {
        const title = formatFixType(item.fix_type);
        const sourceLabel = item.edge_source ? formatResource(item.edge_source) : '-';
        const targetLabel = item.edge_target ? formatResource(item.edge_target) : '-';
        const reductionPercent = clampPercent(item.cumulative_risk_reduction);
        const pathCount = blockedPathCount(item);
        const llmStatus = normalizeLlmStatus(item.llm_status);
        const costBadge =
          typeof item.fix_cost === 'number' && !Number.isNaN(item.fix_cost)
            ? costLabel(item.fix_cost)
            : '-';

        return (
          <div key={item.recommendation_id} className="col-12 col-md-6 col-lg-4">
            <div className="card h-100 border-0 shadow-sm border-start border-primary border-4 dg-recommendation-list-card">
              <div className="card-body d-flex flex-column gap-3">
                <div className="d-flex justify-content-between align-items-start gap-3">
                  <div className="min-w-0">
                    {item.recommendation_rank != null && (
                      <div className="text-muted small mb-1">#{item.recommendation_rank + 1}</div>
                    )}
                    <h5 className="card-title text-primary mb-0">{title}</h5>
                  </div>
                </div>

                <div className="dg-recommendation-target text-muted">
                  <span className="fw-semibold text-body">{sourceLabel}</span>
                  <span className="mx-2">→</span>
                  <span className="fw-semibold text-body">{targetLabel}</span>
                </div>

                <div className="row g-2">
                  <div className="col-4">
                    <div className="dg-recommendation-metric h-100">
                      <div className="text-muted small mb-1">차단 경로</div>
                      <div className="dg-recommendation-metric-value">{pathCount}</div>
                    </div>
                  </div>
                  <div className="col-4">
                    <div className="dg-recommendation-metric h-100">
                      <div className="text-muted small mb-1">커버 위험</div>
                      <div className="dg-recommendation-metric-value">{formatCoveredRisk(item.covered_risk)}</div>
                    </div>
                  </div>
                  <div className="col-4">
                    <div className="dg-recommendation-metric h-100">
                      <div className="text-muted small mb-1">누적 감소</div>
                      <div className="dg-recommendation-metric-value text-success">
                        {formatReduction(item.cumulative_risk_reduction)}
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <div className="d-flex justify-content-between align-items-center mb-1">
                    <span className="text-muted small">누적 위험 감소</span>
                    <span className="small fw-semibold text-success">
                      {formatReduction(item.cumulative_risk_reduction)}
                    </span>
                  </div>
                  <div className="progress dg-recommendation-progress">
                    <div
                      className="progress-bar bg-success"
                      role="progressbar"
                      style={{ width: `${reductionPercent}%` }}
                      aria-valuenow={reductionPercent}
                      aria-valuemin={0}
                      aria-valuemax={100}
                    />
                  </div>
                </div>

                <div className="d-flex flex-wrap gap-2">
                  <span className="dg-badge dg-badge--tag">비용 {costBadge}</span>
                  <span className="dg-badge dg-badge--tag">
                    {llmStatus === 'generated' ? 'AI 설명 있음' : 'AI 설명 없음'}
                  </span>
                </div>
              </div>
              <div className="card-footer bg-transparent border-0 pt-0">
                <Link
                  to={`/clusters/${clusterId}/recommendations/${item.recommendation_id}`}
                  className="btn btn-sm dg-dashboard-action-btn dg-dashboard-action-btn--primary w-100"
                >
                  자세히 보기
                </Link>
              </div>
            </div>
          </div>
        );
      })}
      </div>
    </>
  );
};

export default ChokePointList;
