import React from 'react';
import type { RemediationRecommendationListItemResponse } from '../../api/model';
import {
  blockedPathCount,
  formatCoveredRisk,
  formatFixType,
  formatReduction,
  formatResource,
} from '../risk/recommendationFormatters';

interface RecommendationOverviewCardProps {
  recommendations: RemediationRecommendationListItemResponse[];
  isLoading?: boolean;
  isError?: boolean;
  onOpenList: () => void;
  onOpenDetail: (recommendationId: string) => void;
}

const buildSummaryLine = (recommendations: RemediationRecommendationListItemResponse[]): string => {
  if (recommendations.length === 0) {
    return '표시할 권고사항이 없습니다';
  }

  if (recommendations.length >= 3) {
    const topThree = recommendations[Math.min(2, recommendations.length - 1)];
    if (typeof topThree?.cumulative_risk_reduction === 'number') {
      return `3개 권고로 전체 위험 ${formatReduction(topThree.cumulative_risk_reduction)} 감소 가능`;
    }
  }

  const top = recommendations[0];
  const pathCount = blockedPathCount(top);
  if (pathCount > 0) {
    return `상위 1개 조치로 ${pathCount}개 공격 경로 차단`;
  }

  return `상위 1개 조치로 위험 ${formatCoveredRisk(top.covered_risk)} 감소`;
};

const RecommendationOverviewCard: React.FC<RecommendationOverviewCardProps> = ({
  recommendations,
  isLoading = false,
  isError = false,
  onOpenList,
  onOpenDetail,
}) => {
  const topRecommendation = recommendations[0] ?? null;
  const summaryLine = buildSummaryLine(recommendations);
  const detailDisabled = !topRecommendation || isLoading || isError;

  const handleCardClick = () => {
    onOpenList();
  };

  const handleCardKeyDown: React.KeyboardEventHandler<HTMLDivElement> = (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onOpenList();
    }
  };

  return (
    <div
      className={`card border-0 shadow-sm h-100 dg-dashboard-bottom-card dg-dashboard-bottom-panel ${
        'dg-dashboard-recommendation-card--interactive'
      }`}
      role="button"
      tabIndex={0}
      onClick={handleCardClick}
      onKeyDown={handleCardKeyDown}
    >
      <div className="card-body d-flex flex-column">
        <div className="d-flex justify-content-between align-items-start gap-3 mb-3">
          <div>
            <h2 className="h5 dg-dashboard-panel-title mb-1">보안 권고사항</h2>
            <div className="text-muted small">개요에서 바로 우선 조치를 확인하고 이동합니다.</div>
          </div>
          <span className="dg-badge dg-badge--tag">우선 조치</span>
        </div>

        {isLoading ? (
          <div className="flex-grow-1 d-flex flex-column justify-content-center">
            <div className="placeholder-glow">
              <span className="placeholder col-10 d-block mb-3" />
              <span className="placeholder col-8 d-block mb-2" />
              <span className="placeholder col-6 d-block" />
            </div>
          </div>
        ) : isError ? (
          <div className="flex-grow-1 d-flex align-items-center">
            <div className="alert alert-danger mb-0 w-100 small" role="alert">
              권고사항 요약을 불러오지 못했습니다.
            </div>
          </div>
        ) : topRecommendation ? (
          <>
            <div className="dg-dashboard-recommendation-summary mb-3">{summaryLine}</div>

            <div className="dg-dashboard-recommendation-preview flex-grow-1">
              <div className="text-primary fw-semibold mb-2">
                {formatFixType(topRecommendation.fix_type)}
              </div>
              <div className="text-muted small mb-3">
                <span className="fw-semibold text-body">{formatResource(topRecommendation.edge_source ?? '')}</span>
                <span className="mx-2">→</span>
                <span className="fw-semibold text-body">{formatResource(topRecommendation.edge_target ?? '')}</span>
              </div>
              <div className="d-flex flex-wrap gap-2">
                <span className="dg-dashboard-chip dg-badge dg-badge--info">
                  차단 경로 {blockedPathCount(topRecommendation)}개
                </span>
                <span className="dg-dashboard-chip dg-badge dg-badge--notable">
                  위험 감소 {formatCoveredRisk(topRecommendation.covered_risk)}
                </span>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-grow-1 d-flex flex-column justify-content-center">
            <div className="dg-dashboard-recommendation-summary mb-2">{summaryLine}</div>
            <div className="text-muted small">분석 결과가 생성되면 우선 검토할 권고가 표시됩니다.</div>
          </div>
        )}

        <div className="dg-dashboard-recommendation-actions d-flex justify-content-end gap-2 mt-4">
          <button
            type="button"
            className="btn btn-sm dg-dashboard-action-btn dg-dashboard-action-btn--primary"
            onClick={(event) => {
              event.stopPropagation();
              onOpenList();
            }}
          >
            권고사항 전체 보기
          </button>
          <button
            type="button"
            className="btn btn-sm dg-dashboard-action-btn dg-dashboard-action-btn--secondary"
            onClick={(event) => {
              event.stopPropagation();
              if (topRecommendation) {
                onOpenDetail(topRecommendation.recommendation_id);
              }
            }}
            disabled={detailDisabled}
          >
            자세히 보기
          </button>
        </div>
      </div>
    </div>
  );
};

export default RecommendationOverviewCard;
