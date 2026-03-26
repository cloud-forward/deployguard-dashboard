import React, { useMemo } from 'react';
import { useGetMyAssetsApiV1MeAssetsGet, useGetMyOverviewApiV1MeOverviewGet } from '../api/generated/auth/auth';
import type { MeAssetInventoryItemResponse, MeAssetInventoryListResponse, UserOverviewResponse } from '../api/model';
import StatCard from '../components/dashboard/StatCard';

const getRiskBadge = (baseRisk?: number | null) => {
  if (baseRisk == null) {
    return <span className="text-muted small">-</span>;
  }

  if (baseRisk >= 80) {
    return <span className="badge bg-danger-subtle text-danger border border-danger-subtle">Critical</span>;
  }

  if (baseRisk >= 60) {
    return <span className="badge bg-warning-subtle text-warning-emphasis border border-warning-subtle">High</span>;
  }

  if (baseRisk >= 40) {
    return <span className="badge bg-info-subtle text-info-emphasis border border-info-subtle">Medium</span>;
  }

  return <span className="badge bg-success-subtle text-success border border-success-subtle">Low</span>;
};

const getDomainBadgeClass = (domain?: string | null) => {
  if (domain === 'k8s') {
    return 'bg-primary-subtle text-primary border border-primary-subtle';
  }

  if (domain === 'aws') {
    return 'bg-warning-subtle text-warning-emphasis border border-warning-subtle';
  }

  return 'bg-secondary-subtle text-secondary border border-secondary-subtle';
};

const isUserOverviewResponse = (value: unknown): value is UserOverviewResponse =>
  Boolean(value && typeof value === 'object');

const isMeAssetInventoryListResponse = (value: unknown): value is MeAssetInventoryListResponse =>
  Boolean(value && typeof value === 'object' && 'items' in value);

const buildCountMap = (
  assets: MeAssetInventoryItemResponse[],
  getKey: (asset: MeAssetInventoryItemResponse) => string | null | undefined,
) => {
  const counts = new Map<string, number>();

  for (const asset of assets) {
    const key = getKey(asset);
    if (!key) {
      continue;
    }

    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  return Array.from(counts.entries())
    .sort((left, right) => right[1] - left[1])
    .map(([label, count]) => ({ label, count }));
};

const DashboardPage: React.FC = () => {
  const overviewQuery = useGetMyOverviewApiV1MeOverviewGet({
    query: {
      retry: false,
    },
  });

  const assetsQuery = useGetMyAssetsApiV1MeAssetsGet({
    query: {
      retry: false,
    },
  });

  const overview = isUserOverviewResponse(overviewQuery.data) ? overviewQuery.data : null;
  const assetList = isMeAssetInventoryListResponse(assetsQuery.data) ? assetsQuery.data : null;
  const assets = Array.isArray(assetList?.items) ? assetList.items : [];

  const statRows = [
    { title: '전체 자산', value: overview?.total_assets ?? 0 },
    { title: 'K8s 자산', value: overview?.k8s_assets ?? 0 },
    { title: 'AWS 자산', value: overview?.aws_assets ?? 0 },
    { title: 'Public 자산', value: overview?.public_assets ?? 0 },
    { title: '진입점', value: overview?.entry_point_assets ?? 0 },
    { title: '핵심 자산', value: overview?.crown_jewel_assets ?? 0 },
  ];

  const assetTypeCounts = useMemo(
    () => buildCountMap(assets, (asset) => asset.asset_type).slice(0, 8),
    [assets],
  );
  const domainCounts = useMemo(
    () => buildCountMap(assets, (asset) => asset.asset_domain ?? 'unknown'),
    [assets],
  );
  const clusterCounts = useMemo(
    () => buildCountMap(assets, (asset) => asset.cluster_name).slice(0, 6),
    [assets],
  );
  const flaggedCounts = useMemo(
    () => [
      { label: 'Public', count: assets.filter((asset) => Boolean(asset.is_public)).length, className: 'bg-info-subtle text-info-emphasis border border-info-subtle' },
      { label: 'Entry Point', count: assets.filter((asset) => Boolean(asset.is_entry_point)).length, className: 'bg-danger-subtle text-danger border border-danger-subtle' },
      { label: 'Crown Jewel', count: assets.filter((asset) => Boolean(asset.is_crown_jewel)).length, className: 'bg-warning-subtle text-warning-emphasis border border-warning-subtle' },
      { label: 'High Risk', count: assets.filter((asset) => (asset.base_risk ?? 0) >= 60).length, className: 'bg-light text-dark border' },
    ],
    [assets],
  );

  return (
    <div>
      <div className="d-flex align-items-baseline gap-3 mb-4">
        <h4 className="mb-0 fw-bold">대시보드 개요</h4>
        <span className="fs-6" style={{ color: '#f2f2f2' }}>사용자 기준 자산 요약</span>
      </div>

      {overviewQuery.isLoading ? (
        <div className="row g-3 mb-4">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="col-6 col-sm-4 col-xl-2">
              <div className="card border-0 shadow-sm h-100">
                <div className="card-body placeholder-glow">
                  <span className="placeholder col-7 d-block mb-2" />
                  <span className="placeholder placeholder-lg col-5 d-block" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : overviewQuery.isError ? (
        <div className="alert alert-danger mb-4" role="alert">
          사용자 개요를 불러오지 못했습니다.
        </div>
      ) : (
        <div className="row g-3 mb-4">
          {statRows.map((card) => (
            <div key={card.title} className="col-6 col-sm-4 col-xl-2">
              <StatCard title={card.title} value={card.value} />
            </div>
          ))}
        </div>
      )}

      <div className="card border-0 shadow-sm mb-4">
        <div className="card-body">
          {(() => {
            const liveStatus = (overview?.entry_point_assets ?? 0) > 0 || (overview?.crown_jewel_assets ?? 0) > 0
              ? 'warning'
              : (overview?.public_assets ?? 0) > 0
                ? 'threat'
                : 'safe';
            const liveConfig = {
              safe: { color: '#22c55e' },
              warning: { color: '#f59e0b' },
              threat: { color: '#ef4444' },
            };
            const { color } = liveConfig[liveStatus];

            return (
              <div className="d-flex align-items-center gap-2 mb-3">
                <h6 className="mb-0 fw-bold">공격경로</h6>
                <div className="d-flex align-items-center gap-1">
                  <span
                    aria-hidden="true"
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: '50%',
                      backgroundColor: color,
                      display: 'inline-block',
                      boxShadow: `0 0 6px ${color}`,
                      animation: 'live-pulse 1.5s ease-in-out infinite',
                    }}
                  />
                  <span className="small fw-semibold" style={{ color }}>Live</span>
                </div>
              </div>
            );
          })()}
          <div
            className="d-flex justify-content-center align-items-center rounded border"
            style={{
              height: 280,
              background: 'rgba(10, 16, 33, 0.5)',
              borderStyle: 'dashed',
            }}
          >
            <span className="text-muted small">그래프 데이터를 불러오는 중…</span>
          </div>
        </div>
      </div>

      <div className="row g-4">
        <div className="col-12 col-xl-7">
          <div className="card border-0 shadow-sm h-100">
            <div className="card-body">
              <div className="d-flex justify-content-between align-items-start gap-3 mb-3">
                <div>
                  <h2 className="h5 mb-1">자산 분포</h2>
                  <p className="text-muted small mb-0">
                    사용자 기준 전체 자산을 유형과 도메인으로 묶은 요약입니다.
                  </p>
                </div>
                {assetsQuery.isLoading ? (
                  <span className="badge text-bg-light border">불러오는 중…</span>
                ) : null}
              </div>

              {assetsQuery.isError ? (
                <div className="alert alert-danger mb-0" role="alert">
                  자산 요약을 불러오지 못했습니다.
                </div>
              ) : assets.length === 0 ? (
                <p className="text-muted small mb-0">표시할 자산이 없습니다.</p>
              ) : (
                <div className="d-flex flex-column gap-4">
                  <div>
                    <div className="small text-muted mb-2">Asset Type</div>
                    <div className="d-flex flex-wrap gap-2">
                      {assetTypeCounts.map((item) => (
                        <span key={item.label} className="badge rounded-pill text-bg-light border px-3 py-2">
                          {item.label}: {item.count}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div>
                    <div className="small text-muted mb-2">Domain</div>
                    <div className="d-flex flex-wrap gap-2">
                      {domainCounts.map((item) => (
                        <span key={item.label} className={`badge rounded-pill px-3 py-2 ${getDomainBadgeClass(item.label)}`}>
                          {item.label}: {item.count}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div>
                    <div className="small text-muted mb-2">상위 클러스터</div>
                    <div className="d-flex flex-wrap gap-2">
                      {clusterCounts.length === 0 ? (
                        <span className="text-muted small">클러스터 정보 없음</span>
                      ) : (
                        clusterCounts.map((item) => (
                          <span key={item.label} className="badge rounded-pill text-bg-light border px-3 py-2">
                            {item.label}: {item.count}
                          </span>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="col-12 col-xl-5">
          <div className="card border-0 shadow-sm h-100">
            <div className="card-body">
              <div className="d-flex justify-content-between align-items-start gap-3 mb-3">
                <div>
                  <h2 className="h5 mb-1">주요 분류</h2>
                  <p className="text-muted small mb-0">
                    `/api/v1/me/assets` 기반 플래그 및 위험도 집계입니다.
                  </p>
                </div>
                {assetsQuery.isLoading ? (
                  <span className="badge text-bg-light border">불러오는 중…</span>
                ) : null}
              </div>

              {assetsQuery.isError ? (
                <div className="alert alert-danger mb-0" role="alert">
                  자산 분류 집계를 불러오지 못했습니다.
                </div>
              ) : assets.length === 0 ? (
                <p className="text-muted small mb-0">표시할 자산이 없습니다.</p>
              ) : (
                <div className="d-flex flex-column gap-3">
                  {flaggedCounts.map((item) => (
                    <div key={item.label} className="border rounded p-3">
                      <div className="d-flex justify-content-between align-items-center gap-3">
                        <span className={`badge ${item.className}`}>{item.label}</span>
                        <div className="fw-semibold fs-5">{item.count}</div>
                      </div>
                    </div>
                  ))}

                  <div className="pt-2 border-top">
                    <div className="small text-muted mb-2">고위험 샘플</div>
                    <div className="d-flex flex-wrap gap-2">
                      {assets
                        .filter((asset) => (asset.base_risk ?? 0) >= 60)
                        .sort((left, right) => (right.base_risk ?? 0) - (left.base_risk ?? 0))
                        .slice(0, 6)
                        .map((asset) => (
                          <span key={asset.asset_id} className="badge rounded-pill text-bg-light border px-3 py-2">
                            {asset.name} {getRiskBadge(asset.base_risk)}
                          </span>
                        ))}
                      {assets.filter((asset) => (asset.base_risk ?? 0) >= 60).length === 0 ? (
                        <span className="text-muted small">고위험 자산 없음</span>
                      ) : null}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;
