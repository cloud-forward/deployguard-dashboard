import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useListClustersApiV1ClustersGet } from '../api/generated/clusters/clusters';
import ChokePointList from '../components/risk/ChokePointList';

type ClusterOption = {
  id: string;
  name: string;
};

const RemediationPage: React.FC = () => {
  const location = useLocation();
  const highlightId = (location.state as { highlightId?: string; clusterId?: string } | null)?.highlightId;
  const stateClusterId = (location.state as { highlightId?: string; clusterId?: string } | null)?.clusterId;
  const highlightRef = useRef<HTMLDivElement>(null);
  const { data: clustersData, isLoading: isLoadingClusters } = useListClustersApiV1ClustersGet();
  const clusters = (Array.isArray(clustersData) ? clustersData : []) as ClusterOption[];

  const firstClusterId = useMemo(() => clusters[0]?.id ?? '', [clusters]);
  const [selectedClusterId, setSelectedClusterId] = useState('');

  const activeClusterId =
    selectedClusterId && clusters.some((c) => c.id === selectedClusterId)
      ? selectedClusterId
      : firstClusterId;

  useEffect(() => {
    if (stateClusterId && clusters.some((cluster) => cluster.id === stateClusterId)) {
      setSelectedClusterId(stateClusterId);
    }
  }, [clusters, stateClusterId]);

  useEffect(() => {
    if (!highlightRef.current || !highlightId || !activeClusterId) {
      return;
    }

    const container = highlightRef.current;
    const cards = Array.from(container.querySelectorAll('.dg-recommendation-list-card')) as HTMLDivElement[];
    for (const card of cards) {
      card.style.border = '1px solid rgba(255,255,255,0.1)';
      card.style.boxShadow = 'none';
      card.style.scrollMarginTop = '80px';
    }

    const link = container.querySelector(
      `a[href="/clusters/${activeClusterId}/recommendations/${highlightId}"]`,
    ) as HTMLAnchorElement | null;
    const card = link?.closest('.dg-recommendation-list-card') as HTMLDivElement | null;

    if (card) {
      card.style.border = '2px solid #ef4444';
      card.style.boxShadow = '0 0 0 3px rgba(239,68,68,0.2)';
      card.style.scrollMarginTop = '80px';
      card.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    }
  }, [activeClusterId, highlightId]);

  return (
    <div className="dg-page-shell">
      <div className="dg-page-header">
        <div className="dg-page-heading">
          <h1 className="dg-page-title">권장 사항</h1>
          <p className="dg-page-description">
            분석 결과를 바탕으로 생성된 보안 개선 권장 사항을 확인합니다
          </p>
        </div>
        <div className="d-flex align-items-center gap-2 flex-wrap" style={{ minWidth: 280 }}>
          <label
            htmlFor="remediation-cluster-select"
            className="form-label mb-0 text-nowrap small"
          >
            클러스터
          </label>
          <select
            id="remediation-cluster-select"
            className="form-select form-select-sm"
            style={{ minWidth: 220, flex: '1 1 220px' }}
            value={activeClusterId}
            onChange={(event) => setSelectedClusterId(event.target.value)}
            disabled={isLoadingClusters || clusters.length === 0}
          >
            {clusters.length === 0 ? (
              <option value="">사용 가능한 클러스터 없음</option>
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
      <div ref={highlightRef}>
        <ChokePointList clusterId={activeClusterId} />
      </div>
    </div>
  );
};

export default RemediationPage;
