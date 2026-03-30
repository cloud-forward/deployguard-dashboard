import React, { useMemo, useState } from 'react';
import { useListClustersApiV1ClustersGet } from '../api/generated/clusters/clusters';
import ChokePointList from '../components/risk/ChokePointList';

type ClusterOption = {
  id: string;
  name: string;
};

const RemediationPage: React.FC = () => {
  const { data: clustersData, isLoading: isLoadingClusters } = useListClustersApiV1ClustersGet();
  const clusters = (Array.isArray(clustersData) ? clustersData : []) as ClusterOption[];

  const firstClusterId = useMemo(() => clusters[0]?.id ?? '', [clusters]);
  const [selectedClusterId, setSelectedClusterId] = useState('');

  const activeClusterId =
    selectedClusterId && clusters.some((c) => c.id === selectedClusterId)
      ? selectedClusterId
      : firstClusterId;

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
      <ChokePointList clusterId={activeClusterId} />
    </div>
  );
};

export default RemediationPage;
