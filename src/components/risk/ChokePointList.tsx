import React from 'react';
import { Link } from 'react-router-dom';
import { useGetRemediationRecommendationsApiV1ClustersClusterIdRemediationRecommendationsGet } from '../../api/generated/clusters/clusters';
import type { RemediationRecommendationListItemResponse } from '../../api/model';

const formatFixType = (fixType?: string | null): string => {
  if (!fixType) return '조치 필요';
  const map: Record<string, string> = {
    change_service_account: '서비스 어카운트 변경',
    remove_role_binding: '권한 바인딩 제거',
    delete_role_binding: '권한 바인딩 삭제',
    remove_cluster_role_binding: '클러스터 권한 바인딩 제거',
    rotate_secret: 'Secret 자격 증명 교체',
    restrict_pod_security: 'Pod 보안 정책 강화',
    remove_permission: '권한 제거',
    add_network_policy: '네트워크 정책 추가',
  };
  return map[fixType] ?? fixType.replace(/_/g, ' ');
};

const formatEdgeType = (edgeType?: string | null): string => {
  if (!edgeType) return '-';
  const map: Record<string, string> = {
    bound_to: '바인딩',
    has_secret: 'Secret 보유',
    can_exec: '실행 가능',
    can_mount: '마운트 가능',
    has_permission: '권한 보유',
    can_assume: '역할 위임',
  };
  return map[edgeType] ?? edgeType.replace(/_/g, ' ');
};

const abbreviate = (value?: string | null, maxLen = 28): string => {
  if (!value) return '-';
  if (value.length <= maxLen) return value;
  return `${value.slice(0, maxLen - 1)}…`;
};

const formatRisk = (value?: number | null): string => {
  if (value == null) return '-';
  return value.toLocaleString('ko-KR', { maximumFractionDigits: 4 });
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

  const maxCoveredRisk = Math.max(...items.map((item) => item.covered_risk ?? 0), 1);

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
          className="btn btn-outline-secondary btn-sm"
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
    <div className="row g-3">
      {items.map((item) => {
        const riskPct =
          maxCoveredRisk > 0
            ? Math.round(((item.covered_risk ?? 0) / maxCoveredRisk) * 100)
            : 0;

        const title = formatFixType(item.fix_type);
        const summary =
          item.fix_description
            ? item.fix_description
            : `${abbreviate(item.edge_source)} → ${abbreviate(item.edge_target)}`;

        return (
          <div key={item.recommendation_id} className="col-12 col-md-6 col-lg-4">
            <div className="card h-100 border-0 shadow-sm border-start border-primary border-4">
              <div className="card-body">
                {item.recommendation_rank != null && (
                  <span className="badge bg-secondary mb-2">#{item.recommendation_rank + 1}</span>
                )}
                <h5 className="card-title text-primary mb-1">{title}</h5>
                <p className="text-muted small mb-3" style={{ minHeight: '2.5rem' }}>
                  {summary}
                </p>
                <div className="d-flex flex-column gap-2 mb-3">
                  <div className="d-flex justify-content-between align-items-center">
                    <span className="text-muted small">커버된 위험</span>
                    <span className="badge bg-danger rounded-pill">
                      {formatRisk(item.covered_risk)}
                    </span>
                  </div>
                  <div className="d-flex justify-content-between align-items-center">
                    <span className="text-muted small">누적 위험 감소</span>
                    <span className="fw-bold text-success">
                      {formatRisk(item.cumulative_risk_reduction)}
                    </span>
                  </div>
                  {item.fix_cost != null && (
                    <div className="d-flex justify-content-between align-items-center">
                      <span className="text-muted small">조치 비용</span>
                      <span className="text-muted small">{formatRisk(item.fix_cost)}</span>
                    </div>
                  )}
                </div>
                <div className="mb-2">
                  <div className="progress" style={{ height: '6px' }}>
                    <div
                      className="progress-bar bg-success"
                      role="progressbar"
                      style={{ width: `${riskPct}%` }}
                      aria-valuenow={riskPct}
                      aria-valuemin={0}
                      aria-valuemax={100}
                    />
                  </div>
                </div>
                {(item.edge_type || item.edge_source || item.edge_target) && (
                  <div className="d-flex flex-wrap gap-2 mt-2">
                    {item.edge_type && (
                      <span className="badge bg-secondary-subtle text-secondary-emphasis">
                        {formatEdgeType(item.edge_type)}
                      </span>
                    )}
                    {(item.edge_source || item.edge_target) && (
                      <span className="text-muted" style={{ fontSize: '0.7rem' }}>
                        {abbreviate(item.edge_source, 18)} → {abbreviate(item.edge_target, 18)}
                      </span>
                    )}
                  </div>
                )}
              </div>
              <div className="card-footer bg-transparent border-0 pt-0">
                <Link
                  to={`/clusters/${clusterId}/recommendations/${item.recommendation_id}`}
                  className="btn btn-outline-primary btn-sm w-100"
                >
                  자세히 보기
                </Link>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default ChokePointList;
