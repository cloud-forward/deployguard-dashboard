import React, { useEffect, useMemo, useState } from 'react';
import { Box } from 'lucide-react';
import type {
  CloudTrailEvent,
  CloudTrailEventListResponse,
  RuntimeActivityItemResponse,
  RuntimeActivityListResponse,
} from '../api/model';
import { useListClustersApiV1ClustersGet } from '../api/generated/clusters/clusters';
import {
  useGetCloudtrailEventsApiV1CloudtrailEventsGet,
  useGetRuntimeActivitiesApiV1ClustersClusterIdRuntimeActivitiesGet,
} from '../api/generated/runtime/runtime';

const formatDateTime = (value?: string | null, fallback = '-') =>
  value ? new Date(value).toLocaleString('ko-KR') : fallback;

const isRuntimeActivityListResponse = (value: unknown): value is RuntimeActivityListResponse =>
  Boolean(value && typeof value === 'object' && 'items' in value);

const isCloudTrailEventListResponse = (value: unknown): value is CloudTrailEventListResponse =>
  Boolean(value && typeof value === 'object' && 'items' in value);

const SummarySkeleton: React.FC = () => (
  <div className="dg-activity-summary-grid placeholder-glow">
    {Array.from({ length: 4 }).map((_, index) => (
      <div className="dg-activity-card dg-activity-summary-card" key={index}>
        <span className="placeholder col-5 d-block mb-3" />
        <span className="placeholder placeholder-lg col-6 d-block" />
      </div>
    ))}
  </div>
);

const RuntimeSkeleton: React.FC = () => (
  <div className="dg-activity-list placeholder-glow">
    {Array.from({ length: 5 }).map((_, index) => (
      <div className="dg-activity-card dg-activity-runtime-item" key={index}>
        <div className="d-flex justify-content-between gap-3 mb-3">
          <span className="placeholder col-4" />
          <span className="placeholder col-2" />
        </div>
        <span className="placeholder col-8 d-block mb-2" />
        <span className="placeholder col-6 d-block" />
      </div>
    ))}
  </div>
);

const CloudTrailSkeleton: React.FC = () => (
  <div className="dg-activity-list placeholder-glow">
    {Array.from({ length: 6 }).map((_, index) => (
      <div className="dg-activity-cloudtrail-row" key={index}>
        <div className="d-flex justify-content-between gap-3">
          <div className="flex-grow-1">
            <span className="placeholder col-5 d-block mb-2" />
            <span className="placeholder col-4 d-block" />
          </div>
          <div style={{ minWidth: 140 }}>
            <span className="placeholder col-8 d-block ms-auto mb-2" />
            <span className="placeholder col-6 d-block ms-auto" />
          </div>
        </div>
      </div>
    ))}
  </div>
);

const SectionError: React.FC<{ message: string; onRetry: () => void }> = ({ message, onRetry }) => (
  <div className="dg-activity-card dg-activity-state-card">
    <div className="mb-3" style={{ color: 'var(--dg-activity-high)' }}>
      {message}
    </div>
    <button type="button" className="btn btn-outline-light btn-sm" onClick={onRetry}>
      Retry
    </button>
  </div>
);

const EmptyState: React.FC<{ message: string }> = ({ message }) => (
  <div className="dg-activity-card dg-activity-state-card">
    <div className="text-center dg-activity-muted">{message}</div>
  </div>
);

const getSeverityClassName = (severity?: string | null) =>
  severity === 'high' ? 'dg-activity-severity-badge is-high' : 'dg-activity-severity-badge';

const ActivityPage: React.FC = () => {
  const [clusterId, setClusterId] = useState('');

  const { data: clustersResponse, isLoading: isClustersLoading } = useListClustersApiV1ClustersGet({
    query: { retry: false },
  });

  const clusters = useMemo(
    () =>
      (Array.isArray(clustersResponse) ? clustersResponse : [])
        .filter((cluster) => cluster.cluster_type !== 'aws')
        .map((cluster) => ({
          id: cluster.id,
          name: cluster.name,
        })),
    [clustersResponse],
  );

  useEffect(() => {
    if (clusters.length === 0) {
      setClusterId('');
      return;
    }

    if (clusterId && clusters.some((cluster) => cluster.id === clusterId)) {
      return;
    }

    setClusterId(clusters[0].id);
  }, [clusterId, clusters]);

  const runtimeQuery = useGetRuntimeActivitiesApiV1ClustersClusterIdRuntimeActivitiesGet(
    clusterId,
    { snapshot_limit: 3, limit: 50 },
    { query: { enabled: Boolean(clusterId), retry: false } },
  );

  const cloudtrailQuery = useGetCloudtrailEventsApiV1CloudtrailEventsGet(
    { hours: 5 },
    { query: { retry: false } },
  );

  const runtimeResponse = isRuntimeActivityListResponse(runtimeQuery.data) ? runtimeQuery.data : undefined;
  const cloudtrailResponse = isCloudTrailEventListResponse(cloudtrailQuery.data) ? cloudtrailQuery.data : undefined;

  const runtimeItems = useMemo(() => {
    const items = Array.isArray(runtimeResponse?.items) ? [...runtimeResponse.items] : [];

    return items.sort((left, right) => {
      const notableDelta = Number(Boolean(right.notable)) - Number(Boolean(left.notable));
      if (notableDelta !== 0) {
        return notableDelta;
      }

      return new Date(right.observed_at).getTime() - new Date(left.observed_at).getTime();
    });
  }, [runtimeResponse]);

  const cloudtrailItems = useMemo(
    () =>
      Array.isArray(cloudtrailResponse?.items)
        ? [...cloudtrailResponse.items].sort(
            (left, right) => new Date(right.event_time).getTime() - new Date(left.event_time).getTime(),
          )
        : [],
    [cloudtrailResponse],
  );

  const summaryCards = useMemo(
    () => [
      {
        key: 'high',
        label: 'HIGH 이벤트',
        value: runtimeItems.filter((item) => item.severity === 'high').length,
        color: 'var(--dg-activity-high)',
      },
      {
        key: 'notable',
        label: 'NOTABLE 이벤트',
        value: runtimeItems.filter((item) => item.notable === true).length,
        color: 'var(--dg-activity-notable)',
      },
      {
        key: 'cloudtrail',
        label: 'CloudTrail 이벤트',
        value: cloudtrailItems.length,
        color: 'var(--dg-activity-cloudtrail)',
      },
      {
        key: 'error',
        label: '에러 이벤트',
        value: cloudtrailItems.filter((item) => item.error_code != null).length,
        color: 'var(--dg-activity-error)',
      },
    ],
    [cloudtrailItems, runtimeItems],
  );

  const isSummaryLoading = (Boolean(clusterId) && runtimeQuery.isLoading) || cloudtrailQuery.isLoading;

  return (
    <div className="position-relative dg-activity-page dg-page-shell">
      <style>{`
        .dg-activity-page {
          --dg-activity-high: #ef4444;
          --dg-activity-notable: #f97316;
          --dg-activity-cloudtrail: #3b82f6;
          --dg-activity-error: #a855f7;
          --dg-activity-text: rgba(226, 232, 240, 1);
          --dg-activity-muted: rgba(148, 163, 184, 0.7);
          --dg-activity-muted-soft: rgba(148, 163, 184, 0.5);
          --dg-activity-muted-faint: rgba(148, 163, 184, 0.4);
          --dg-activity-scroll-thumb: rgba(148, 163, 184, 0.2);
          --dg-activity-scroll-track: rgba(15, 23, 42, 0.24);
          --dg-activity-hover-bg: rgba(30, 41, 59, 0.82);
          --dg-activity-lower-panel-height: 39.5rem;
          min-height: 100%;
          overflow: hidden;
        }
        .dg-activity-card {
          background: rgba(15, 23, 42, 0.75);
          border: 1px solid rgba(148, 163, 184, 0.12);
          border-radius: 16px;
          backdrop-filter: blur(8px);
        }
        .dg-activity-card:hover {
          border-color: rgba(148, 163, 184, 0.25);
        }
        .dg-activity-cluster-picker {
          display: flex;
          align-items: center;
          gap: 0.7rem;
          min-width: 320px;
        }
        .dg-activity-cluster-label {
          margin: 0;
          color: var(--dg-activity-text);
          font-size: 0.84rem;
          font-weight: 600;
          white-space: nowrap;
        }
        .dg-activity-summary-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 0.9rem;
        }
        .dg-activity-summary-card {
          border-top-width: 2px;
          padding: 1rem 1.1rem;
          min-height: 124px;
        }
        .dg-activity-summary-label {
          font-size: 0.7rem;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: var(--dg-activity-muted);
          margin-bottom: 0.65rem;
        }
        .dg-activity-summary-value {
          font-size: 2.2rem;
          font-weight: 700;
          line-height: 1;
        }
        .dg-activity-panel {
          display: flex;
          flex-direction: column;
          min-height: 0;
          overflow: hidden;
          height: var(--dg-activity-lower-panel-height);
        }
        .dg-activity-panel-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 1rem;
          padding: 1rem 1.25rem 0.95rem;
          border-bottom: 1px solid rgba(148, 163, 184, 0.1);
        }
        .dg-activity-panel-body {
          flex: 1 1 auto;
          display: flex;
          flex-direction: column;
          min-height: 0;
          padding: 1rem 1.25rem 1.1rem;
          overflow: hidden;
        }
        .dg-activity-section-title {
          display: flex;
          align-items: center;
          gap: 0.55rem;
          margin-bottom: 0.35rem;
        }
        .dg-activity-live-dot {
          width: 10px;
          height: 10px;
          border-radius: 999px;
          display: inline-block;
          animation: live-pulse 1.5s ease-in-out infinite;
        }
        .dg-activity-live-dot.is-runtime {
          background: rgba(34, 197, 94, 1);
          box-shadow: 0 0 6px rgba(34, 197, 94, 0.9);
        }
        .dg-activity-live-dot.is-cloudtrail {
          background: var(--dg-activity-cloudtrail);
          box-shadow: 0 0 6px rgba(59, 130, 246, 0.9);
        }
        .dg-activity-panel-description,
        .dg-activity-muted {
          color: var(--dg-activity-muted);
        }
        .dg-activity-list {
          flex: 1 1 auto;
          min-height: 0;
          overflow-y: auto;
          padding-right: 0.25rem;
        }
        .dg-activity-list::-webkit-scrollbar {
          width: 10px;
        }
        .dg-activity-list::-webkit-scrollbar-track {
          background: var(--dg-activity-scroll-track);
          border-radius: 999px;
        }
        .dg-activity-list::-webkit-scrollbar-thumb {
          background: var(--dg-activity-scroll-thumb);
          border-radius: 999px;
        }
        .dg-activity-list::-webkit-scrollbar-thumb:hover {
          background: rgba(148, 163, 184, 0.32);
        }
        .dg-activity-runtime-item {
          padding: 1rem 1.25rem;
          transition: background-color 0.18s ease, border-color 0.18s ease;
        }
        .dg-activity-runtime-item + .dg-activity-runtime-item {
          margin-top: 0.85rem;
        }
        .dg-activity-runtime-item:hover {
          background: var(--dg-activity-hover-bg);
        }
        .dg-activity-runtime-item.is-notable {
          border-left: 3px solid var(--dg-activity-high);
        }
        .dg-activity-runtime-title {
          color: var(--dg-activity-text);
        }
        .dg-activity-runtime-meta {
          display: inline-flex;
          align-items: center;
          gap: 0.35rem;
          color: var(--dg-activity-muted-soft);
          font-size: 0.82rem;
        }
        .dg-activity-time {
          color: var(--dg-activity-muted-soft);
          font-size: 0.78rem;
          white-space: nowrap;
        }
        .dg-activity-severity-badge {
          background: rgba(148, 163, 184, 0.1);
          color: rgba(148, 163, 184, 0.7);
          border: 1px solid rgba(148, 163, 184, 0.2);
          border-radius: 6px;
          font-size: 0.7rem;
          padding: 2px 10px;
          text-transform: uppercase;
        }
        .dg-activity-severity-badge.is-high {
          background: rgba(239, 68, 68, 0.15);
          color: #f87171;
          border-color: rgba(239, 68, 68, 0.3);
        }
        .dg-activity-tag {
          background: rgba(59, 130, 246, 0.1);
          color: #60a5fa;
          border: 1px solid rgba(59, 130, 246, 0.25);
          border-radius: 6px;
          font-size: 0.7rem;
          padding: 2px 8px;
        }
        .dg-activity-cloudtrail-row {
          border-bottom: 1px solid rgba(148, 163, 184, 0.07);
          padding: 0.8rem 0;
          transition: background-color 0.18s ease;
        }
        .dg-activity-cloudtrail-row:hover {
          background: rgba(255, 255, 255, 0.02);
        }
        .dg-activity-cloudtrail-row:last-child {
          border-bottom: 0;
        }
        .dg-activity-cloudtrail-name {
          color: var(--dg-activity-text);
          font-weight: 600;
        }
        .dg-activity-cloudtrail-sub {
          color: var(--dg-activity-muted-soft);
          font-size: 0.82rem;
        }
        .dg-activity-identity-badge {
          background: rgba(99, 102, 241, 0.12);
          color: #818cf8;
          border: 1px solid rgba(99, 102, 241, 0.25);
          border-radius: 6px;
          font-size: 0.7rem;
          padding: 2px 8px;
        }
        .dg-activity-error-badge {
          background: rgba(239, 68, 68, 0.12);
          color: #f87171;
          border: 1px solid rgba(239, 68, 68, 0.25);
          border-radius: 6px;
          font-size: 0.7rem;
          padding: 2px 8px;
        }
        .dg-activity-state-card {
          display: flex;
          min-height: 220px;
          align-items: center;
          justify-content: center;
          flex-direction: column;
          padding: 1.5rem;
        }
        @media (max-width: 991.98px) {
          .dg-activity-summary-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
          .dg-activity-cluster-picker {
            min-width: 0;
            width: 100%;
          }
          .dg-activity-panel {
            height: auto;
          }
        }
        @media (max-width: 575.98px) {
          .dg-activity-summary-grid {
            grid-template-columns: 1fr;
          }
          .dg-activity-panel-header {
            flex-direction: column;
          }
        }
      `}</style>

      <div className="dg-page-header">
        <div className="dg-page-heading">
          <h1 className="dg-page-title">활동 모니터</h1>
          <p className="dg-page-description">런타임 이벤트 및 AWS 감사 로그를 한눈에 보여줍니다/
          </p>
        </div>
        <div className="dg-activity-cluster-picker">
          <label htmlFor="activity-cluster-select" className="dg-activity-cluster-label">
            클러스터
          </label>
          <select
            id="activity-cluster-select"
            className="form-select"
            value={clusterId}
            onChange={(event) => setClusterId(event.target.value)}
            disabled={isClustersLoading || clusters.length === 0}
          >
            {clusters.length === 0 ? (
              <option value="">사용 가능한 클러스터가 없습니다</option>
            ) : (
              clusters.map((cluster) => (
                <option key={cluster.id} value={cluster.id}>
                  {cluster.name}
                </option>
              ))
            )}
          </select>
        </div>
      </div>

      <div className="d-flex flex-column gap-3 flex-grow-1 min-h-0 overflow-hidden">
        {isSummaryLoading ? (
          <SummarySkeleton />
        ) : (
          <div className="dg-activity-summary-grid">
            {summaryCards.map((card) => (
              <div
                key={card.key}
                className="dg-activity-card dg-activity-summary-card"
                style={{ borderTopColor: card.color }}
              >
                <div className="dg-activity-summary-label">{card.label}</div>
                <div className="dg-activity-summary-value" style={{ color: card.color }}>
                  {card.value}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="row g-4 flex-grow-1 min-h-0">
          <div className="col-12 col-xl-6">
            <div className="dg-activity-card dg-activity-panel h-100">
              <div className="dg-activity-panel-header">
                <div>
                  <div className="dg-activity-section-title">
                    <h3 className="h5 mb-0">런타임 이벤트</h3>
                    <span aria-hidden="true" className="dg-activity-live-dot is-runtime" />
                  </div>
                  <p className="mb-0 dg-activity-panel-description">
                    선택된 클러스터 기준 최근 이벤트
                  </p>
                </div>
              </div>
              <div className="dg-activity-panel-body">
                {clusters.length === 0 ? (
                  <EmptyState message="사용 가능한 클러스터가 없습니다" />
                ) : runtimeQuery.isLoading ? (
                  <RuntimeSkeleton />
                ) : runtimeQuery.isError ? (
                  <SectionError message="런타임 이벤트를 불러오지 못했습니다" onRetry={() => runtimeQuery.refetch()} />
                ) : runtimeItems.length === 0 ? (
                  <EmptyState message="표시할 런타임 이벤트가 없습니다" />
                ) : (
                  <div className="dg-activity-list">
                    {runtimeItems.map((item: RuntimeActivityItemResponse, index) => (
                      <div
                        className={`dg-activity-card dg-activity-runtime-item${item.notable ? ' is-notable' : ''}`}
                        key={`${item.observed_at}-${item.title}-${index}`}
                      >
                        <div className="d-flex justify-content-between align-items-start gap-3 mb-3">
                          <div className="min-w-0 flex-grow-1">
                            <div className="d-flex align-items-center gap-2 flex-wrap mb-2">
                              <span className={getSeverityClassName(item.severity)}>
                                {(item.severity ?? 'info').toUpperCase()}
                              </span>
                              <span className="fw-semibold text-truncate dg-activity-runtime-title">{item.title}</span>
                            </div>
                          </div>
                          <div className="dg-activity-time text-end">{formatDateTime(item.observed_at)}</div>
                        </div>

                        <div className="d-flex justify-content-between align-items-end gap-3 flex-wrap">
                          <div className="d-flex align-items-center gap-2 flex-wrap">
                            <span className="dg-activity-runtime-meta">
                              <Box size={14} />
                              {item.pod_name ?? '-'}
                              <span>/</span>
                              {item.namespace ?? '-'}
                            </span>
                          </div>

                          <div className="d-flex align-items-center gap-2 flex-wrap justify-content-end">
                            {(item.scenario_tags ?? []).map((tag) => (
                              <span key={tag} className="dg-activity-tag">
                                {tag}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="col-12 col-xl-6">
            <div className="dg-activity-card dg-activity-panel h-100">
              <div className="dg-activity-panel-header">
                <div>
                  <div className="dg-activity-section-title">
                    <h3 className="h5 mb-0">AWS CloudTrail</h3>
                    <span aria-hidden="true" className="dg-activity-live-dot is-cloudtrail" />
                  </div>
                  <p className="mb-0 dg-activity-panel-description">최근 5시간 감사 이벤트</p>
                </div>
              </div>
              <div className="dg-activity-panel-body">
                {cloudtrailQuery.isLoading ? (
                  <CloudTrailSkeleton />
                ) : cloudtrailQuery.isError ? (
                  <SectionError
                    message="CloudTrail 이벤트를 불러오지 못했습니다"
                    onRetry={() => cloudtrailQuery.refetch()}
                  />
                ) : cloudtrailItems.length === 0 ? (
                  <EmptyState message="표시할 CloudTrail 이벤트가 없습니다" />
                ) : (
                  <div className="dg-activity-list">
                    {cloudtrailItems.map((item: CloudTrailEvent) => (
                      <div className="dg-activity-cloudtrail-row" key={item.event_id}>
                        <div className="d-flex justify-content-between align-items-start gap-3">
                          <div className="min-w-0 flex-grow-1">
                            <div className="dg-activity-cloudtrail-name mb-1">{item.event_name}</div>
                            <div className="dg-activity-cloudtrail-sub">{item.source_ip ?? '-'}</div>
                          </div>

                          <div className="d-flex flex-column align-items-end gap-2 text-end">
                            <div className="d-flex align-items-center gap-2 flex-wrap justify-content-end">
                              <span className="dg-activity-identity-badge">
                                {item.user_identity_type ?? 'Unknown'}
                              </span>
                              {item.error_code ? (
                                <span className="dg-activity-error-badge">{item.error_code}</span>
                              ) : null}
                            </div>
                            <div className="dg-activity-time" style={{ color: 'var(--dg-activity-muted-faint)' }}>
                              {formatDateTime(item.event_time)}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ActivityPage;
