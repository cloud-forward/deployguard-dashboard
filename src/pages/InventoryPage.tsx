import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Box,
  Check,
  Database,
  Globe,
  HelpCircle,
  Key,
  KeyRound,
  Layers,
  Lock,
  Network,
  Server,
  Shield,
  ShieldCheck,
  User,
  X,
} from 'lucide-react';
import type {
  GetInventoryAssetsApiV1ClustersClusterIdInventoryAssetsGetParams,
  InvAssetItem,
  InvAssetListResponse,
  InvRiskSpotlightItem,
  InvRiskSpotlightResponse,
  InvSummaryResponse,
} from '../api/model';
import { useListClustersApiV1ClustersGet } from '../api/generated/clusters/clusters';
import {
  useGetInventoryAssetsApiV1ClustersClusterIdInventoryAssetsGet,
  useGetInventoryRiskSpotlightApiV1ClustersClusterIdInventoryRiskSpotlightGet,
  useGetInventorySummaryApiV1ClustersClusterIdInventorySummaryGet,
} from '../api/generated/inventory/inventory';

type InventoryTab = 'all' | 'k8s' | 'aws' | 'entry-points' | 'crown-jewels';

type DetailAsset = {
  node_id: string;
  node_type: string;
  domain: string;
  name: string;
  namespace?: string | null;
  base_risk?: number | null;
  is_entry_point?: boolean;
  is_crown_jewel?: boolean;
  scanner_coverage?: Record<string, string>;
};

const DEFAULT_SCANNERS = ['k8s', 'aws', 'image'];
const FULL_ASSET_PAGE_SIZE = 1000;

const formatDateTime = (value?: string | null, fallback = '-') =>
  value ? new Date(value).toLocaleString('ko-KR') : fallback;

const sumResources = (value?: Record<string, number> | null) =>
  Object.values(value ?? {}).reduce((acc, item) => acc + item, 0);

const getRiskMeta = (baseRisk?: number | null) => {
  if (baseRisk == null) return null;
  if (baseRisk >= 80) return { label: 'Critical', className: 'dg-badge dg-badge--high' };
  if (baseRisk >= 60) return { label: 'High', className: 'dg-badge dg-badge--medium' };
  if (baseRisk >= 40) return { label: 'Medium', className: 'dg-badge dg-badge--info' };
  return { label: 'Low', className: 'dg-badge dg-badge--low' };
};

const getDomainClass = (domain?: string | null) => {
  if (domain === 'k8s') return 'dg-badge dg-badge--info';
  if (domain === 'aws') return 'dg-badge dg-badge--notable';
  return 'dg-badge dg-badge--tag';
};

const getNodeTypeMeta = (nodeType?: string | null) => {
  switch (nodeType) {
    case 'pod':
      return { Icon: Box, color: '#3b82f6' };
    case 'service':
      return { Icon: Network, color: '#3b82f6' };
    case 'service_account':
      return { Icon: KeyRound, color: '#3b82f6' };
    case 'node':
      return { Icon: Server, color: '#3b82f6' };
    case 'secret':
      return { Icon: Lock, color: '#3b82f6' };
    case 'ingress':
      return { Icon: Globe, color: '#3b82f6' };
    case 'role':
    case 'cluster_role':
      return { Icon: Shield, color: '#3b82f6' };
    case 'ec2_instance':
      return { Icon: Server, color: '#f97316' };
    case 's3_bucket':
    case 'rds':
      return { Icon: Database, color: '#f97316' };
    case 'iam_role':
      return { Icon: Key, color: '#f97316' };
    case 'iam_user':
      return { Icon: User, color: '#f97316' };
    case 'security_group':
      return { Icon: ShieldCheck, color: '#f97316' };
    case 'container_image':
      return { Icon: Layers, color: '#8b5cf6' };
    default:
      return { Icon: HelpCircle, color: '#94a3b8' };
  }
};

const toDetailAsset = (asset: InvAssetItem): DetailAsset => ({
  node_id: asset.node_id,
  node_type: asset.node_type,
  domain: asset.domain,
  name: asset.name,
  namespace: asset.namespace,
  base_risk: asset.base_risk,
  is_entry_point: asset.is_entry_point,
  is_crown_jewel: asset.is_crown_jewel,
  scanner_coverage: asset.scanner_coverage ?? undefined,
});

const toDetailSpotlight = (
  item: InvRiskSpotlightItem,
  mode: 'entry-point' | 'crown-jewel',
): DetailAsset => ({
  node_id: item.node_id,
  node_type: item.node_type,
  domain: item.domain,
  name: item.name,
  namespace: item.namespace,
  base_risk: item.base_risk,
  is_entry_point: mode === 'entry-point',
  is_crown_jewel: mode === 'crown-jewel',
});

const isSummaryResponse = (value: unknown): value is InvSummaryResponse =>
  Boolean(value && typeof value === 'object' && 'total_node_count' in value);

const isAssetListResponse = (value: unknown): value is InvAssetListResponse =>
  Boolean(value && typeof value === 'object' && 'assets' in value && 'total_count' in value);

const isRiskSpotlightResponse = (value: unknown): value is InvRiskSpotlightResponse =>
  Boolean(value && typeof value === 'object' && ('entry_points' in value || 'crown_jewels' in value));

const SectionError: React.FC<{ onRetry: () => void }> = ({ onRetry }) => (
  <div className="p-4">
    <div className="alert alert-danger mb-3" role="alert">
      데이터를 불러오지 못했습니다
    </div>
    <button type="button" className="btn btn-outline-light" onClick={onRetry}>
      다시 시도
    </button>
  </div>
);

const SummarySkeleton: React.FC = () => (
  <div className="card shadow-sm border-0">
    <div className="card-body py-3">
      <div className="row g-3 placeholder-glow">
        {Array.from({ length: 7 }).map((_, index) => (
          <div className="col-12 col-sm-6 col-xl" key={index}>
            <div className="border rounded-4 p-3">
              <span className="placeholder col-5 d-block mb-2" />
              <span className="placeholder col-8 d-block" />
            </div>
          </div>
        ))}
      </div>
    </div>
  </div>
);

const AssetSkeleton: React.FC = () => (
  <div className="table-responsive">
    <table className="table align-middle mb-0">
      <thead className="table-light">
        <tr>
          <th>이름</th>
          <th>타입</th>
          <th>도메인</th>
          <th>Namespace</th>
          <th>Risk</th>
          <th>분류</th>
          <th>Coverage</th>
        </tr>
      </thead>
      <tbody className="placeholder-glow">
        {Array.from({ length: 5 }).map((_, rowIndex) => (
          <tr key={rowIndex}>
            {Array.from({ length: 7 }).map((__, cellIndex) => (
              <td key={cellIndex}>
                <span className="placeholder col-8 d-block" />
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

const SpotlightSkeleton: React.FC = () => (
  <div className="row g-4 placeholder-glow">
    {Array.from({ length: 2 }).map((_, index) => (
      <div className="col-12 col-xl-6" key={index}>
        <div className="card shadow-sm border-0 h-100">
          <div className="card-body">
            <span className="placeholder col-4 d-block mb-3" />
            {Array.from({ length: 3 }).map((__, cardIndex) => (
              <div className="border rounded-4 p-3 mb-3" key={cardIndex}>
                <span className="placeholder col-8 d-block mb-2" />
                <span className="placeholder col-5 d-block mb-2" />
                <span className="placeholder col-6 d-block" />
              </div>
            ))}
          </div>
        </div>
      </div>
    ))}
  </div>
);

const InventoryPage: React.FC = () => {
  const navigate = useNavigate();
  const { clusterId = '' } = useParams();
  const [activeTab, setActiveTab] = useState<InventoryTab>('all');
  const [selectedAsset, setSelectedAsset] = useState<DetailAsset | null>(null);
  const { data: clustersResponse, isLoading: isClustersLoading } = useListClustersApiV1ClustersGet();
  const clusters = useMemo(
    () => (Array.isArray(clustersResponse) ? clustersResponse : []).map((cluster) => ({
      id: cluster.id,
      name: cluster.name,
    })),
    [clustersResponse],
  );
  const selectedCluster = clusters.find((cluster) => cluster.id === clusterId) ?? null;

  const assetParams = useMemo<GetInventoryAssetsApiV1ClustersClusterIdInventoryAssetsGetParams>(() => {
    const base = { page: 1, page_size: FULL_ASSET_PAGE_SIZE };
    if (activeTab === 'k8s') return { ...base, domain: 'k8s' };
    if (activeTab === 'aws') return { ...base, domain: 'aws' };
    if (activeTab === 'entry-points') return { ...base, is_entry_point: true };
    if (activeTab === 'crown-jewels') return { ...base, is_crown_jewel: true };
    return base;
  }, [activeTab]);

  const summaryQuery = useGetInventorySummaryApiV1ClustersClusterIdInventorySummaryGet(clusterId, {
    query: { enabled: Boolean(clusterId), retry: false },
  });
  const assetsQuery = useGetInventoryAssetsApiV1ClustersClusterIdInventoryAssetsGet(clusterId, assetParams, {
    query: { enabled: Boolean(clusterId), retry: false },
  });
  const spotlightQuery = useGetInventoryRiskSpotlightApiV1ClustersClusterIdInventoryRiskSpotlightGet(clusterId, {
    query: { enabled: Boolean(clusterId), retry: false },
  });

  const summary = isSummaryResponse(summaryQuery.data) ? summaryQuery.data : undefined;
  const assetList = isAssetListResponse(assetsQuery.data) ? assetsQuery.data : undefined;
  const spotlight = isRiskSpotlightResponse(spotlightQuery.data) ? spotlightQuery.data : undefined;
  const assets = Array.isArray(assetList?.assets) ? assetList.assets : [];
  const entryPoints = Array.isArray(spotlight?.entry_points) ? spotlight.entry_points : [];
  const crownJewels = Array.isArray(spotlight?.crown_jewels) ? spotlight.crown_jewels : [];

  const scannerTypes = useMemo(() => {
    const merged = new Set<string>(DEFAULT_SCANNERS);
    assets.forEach((asset) => {
      Object.keys(asset.scanner_coverage ?? {}).forEach((scannerType) => merged.add(scannerType));
    });
    return Array.from(merged);
  }, [assets]);
  const spotlightEmpty = entryPoints.length === 0 && crownJewels.length === 0;
  const summaryCards = [
    ['전체 자산', summary?.total_node_count ?? 0],
    ['K8s 자산', sumResources(summary?.k8s_resources)],
    ['AWS 자산', sumResources(summary?.aws_resources)],
    ['Entry Points', summary?.risk_summary?.entry_point_count ?? 0],
    ['Crown Jewels', summary?.risk_summary?.crown_jewel_count ?? 0],
    ['Critical Paths', summary?.risk_summary?.critical_path_count ?? 0],
    ['마지막 분석', summary?.last_analysis_at ? formatDateTime(summary.last_analysis_at) : '분석 미완료'],
  ];

  const handleTabChange = (tab: InventoryTab) => {
    setActiveTab(tab);
  };

  useEffect(() => {
    setActiveTab('all');
    setSelectedAsset(null);
  }, [clusterId]);

  if (!clusterId) {
    return <div className="alert alert-warning">Cluster ID가 없어 Inventory를 불러올 수 없습니다.</div>;
  }

  return (
    <div className="position-relative dg-inventory-page dg-page-shell">
      <style>{`
        .dg-inventory-page {
          --dg-inventory-asset-height: clamp(23rem, calc(100vh - 28rem), 29rem);
          --dg-inventory-spotlight-height: clamp(18rem, calc(100vh - 33rem), 24rem);
        }
        .dg-inventory-heading {
          display: flex;
          align-items: baseline;
          gap: 0.75rem;
          flex-wrap: wrap;
        }
        .dg-inventory-subtitle {
          color: #cbd5e1;
          font-size: 0.92rem;
          line-height: 1.35;
        }
        .dg-inventory-cluster-picker {
          display: flex;
          align-items: center;
          gap: 0.55rem;
          min-width: 320px;
          flex-wrap: wrap;
        }
        .dg-inventory-cluster-label {
          margin: 0;
          color: #e2e8f0;
          font-size: 0.84rem;
          font-weight: 600;
          white-space: nowrap;
        }
        .dg-inventory-summary-grid {
          display: grid;
          grid-template-columns: repeat(7, minmax(0, 1fr));
          gap: 0.75rem;
        }
        .dg-inventory-summary-item {
          border: 1px solid rgba(51, 65, 85, 0.88);
          border-radius: 1rem;
          padding: 0.9rem 1rem;
          background: linear-gradient(180deg, rgba(8, 15, 30, 0.96), rgba(15, 23, 42, 0.96));
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.02);
        }
        .dg-inventory-summary-item .dg-summary-label {
          font-size: 0.72rem;
          font-weight: 600;
          letter-spacing: 0.04em;
          text-transform: uppercase;
          color: #cbd5e1;
          margin-bottom: 0.35rem;
        }
        .dg-inventory-summary-item .dg-summary-value {
          font-size: 1.1rem;
          font-weight: 700;
          line-height: 1.25;
          color: #f8fafc;
          word-break: break-word;
        }
        .dg-inventory-panel {
          display: flex;
          flex-direction: column;
          min-height: 0;
        }
        .dg-inventory-panel-header {
          padding: 1rem 1.1rem;
          border-bottom: 1px solid rgba(148, 163, 184, 0.14);
        }
        .dg-inventory-panel-body {
          flex: 1 1 auto;
          min-height: 0;
          overflow: hidden;
        }
        .dg-inventory-asset-scroll {
          max-height: var(--dg-inventory-asset-height);
          overflow: auto;
        }
        .dg-inventory-asset-table {
          table-layout: fixed;
          width: 100%;
          margin-bottom: 0;
        }
        .dg-inventory-asset-table th,
        .dg-inventory-asset-table td {
          padding: 0.7rem 0.75rem;
          vertical-align: middle;
        }
        .dg-inventory-asset-table tbody tr,
        .dg-inventory-asset-table tbody tr > td {
          background-color: var(--bg-card);
        }
        .dg-inventory-asset-table tbody tr:hover > td {
          background-color: var(--bg-card-hover);
        }
        .dg-inventory-asset-table th:nth-child(1),
        .dg-inventory-asset-table td:nth-child(1) {
          width: 24%;
        }
        .dg-inventory-asset-table th:nth-child(2),
        .dg-inventory-asset-table td:nth-child(2) {
          width: 11%;
        }
        .dg-inventory-asset-table th:nth-child(3),
        .dg-inventory-asset-table td:nth-child(3) {
          width: 9%;
        }
        .dg-inventory-asset-table th:nth-child(4),
        .dg-inventory-asset-table td:nth-child(4) {
          width: 13%;
        }
        .dg-inventory-asset-table th:nth-child(5),
        .dg-inventory-asset-table td:nth-child(5) {
          width: 10%;
        }
        .dg-inventory-asset-table th:nth-child(6),
        .dg-inventory-asset-table td:nth-child(6) {
          width: 13%;
        }
        .dg-inventory-asset-table th:nth-child(7),
        .dg-inventory-asset-table td:nth-child(7) {
          width: 20%;
        }
        .dg-inventory-asset-name {
          min-width: 0;
        }
        .dg-inventory-asset-name-text {
          display: block;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .dg-inventory-asset-scroll thead th {
          position: sticky;
          top: 0;
          z-index: 1;
          background: rgba(15, 23, 42, 0.94);
          color: var(--text-secondary);
          box-shadow: inset 0 -1px 0 var(--border-subtle);
        }
        .dg-inventory-asset-scroll .table-responsive,
        .dg-inventory-asset-scroll .table {
          margin-bottom: 0;
        }
        .dg-inventory-spotlight-scroll {
          max-height: var(--dg-inventory-spotlight-height);
          overflow: auto;
          padding: 1rem 1.1rem 1.1rem;
        }
        .dg-inventory-spotlight-section {
          border: 1px solid var(--border-default);
          border-radius: 1rem;
          padding: 0.95rem;
          background: var(--bg-card);
          color: var(--text-primary);
          box-shadow: var(--shadow-card);
        }
        .dg-inventory-spotlight-section .text-muted {
          color: var(--text-secondary) !important;
        }
        .dg-inventory-spotlight-card {
          background: var(--bg-card);
          border-color: var(--border-default);
          color: var(--text-primary);
        }
        .dg-inventory-spotlight-card:hover,
        .dg-inventory-spotlight-card:focus {
          background: var(--bg-card-hover);
          border-color: var(--border-default);
          color: var(--text-primary);
        }
        @media (max-width: 1399.98px) {
          .dg-inventory-summary-grid {
            grid-template-columns: repeat(4, minmax(0, 1fr));
          }
        }
        @media (max-width: 991.98px) {
          .dg-inventory-summary-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
          .dg-inventory-cluster-picker {
            min-width: 0;
            width: 100%;
          }
          .dg-inventory-asset-scroll,
          .dg-inventory-spotlight-scroll {
            max-height: none;
          }
        }
        @media (max-width: 575.98px) {
          .dg-inventory-summary-grid {
            grid-template-columns: 1fr;
          }
          .dg-inventory-cluster-picker {
            min-width: 100%;
          }
        }
      `}</style>

      <div className="dg-page-header">
        <div className="dg-page-heading dg-inventory-heading">
          <h1 className="dg-page-title">자산 현황</h1>
          <p className="dg-page-description dg-inventory-subtitle">클러스터 자산 현황과 위험 요소를 한눈에 확인합니다</p>
        </div>
        <div className="dg-inventory-cluster-picker">
          <label htmlFor="inventory-cluster-select" className="dg-inventory-cluster-label">
            클러스터
          </label>
          <select
            id="inventory-cluster-select"
            className="form-select form-select-sm"
            style={{ minWidth: 220, flex: '1 1 220px' }}
            value={clusterId}
            onChange={(event) => {
              const nextClusterId = event.target.value;
              if (!nextClusterId || nextClusterId === clusterId) {
                return;
              }
              navigate(`/clusters/${nextClusterId}/inventory`);
            }}
            disabled={isClustersLoading || clusters.length === 0}
          >
            {clusters.length === 0 ? (
              <option value={clusterId}>{selectedCluster?.name ?? '사용 가능한 클러스터 없음'}</option>
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

      <div className="d-flex flex-column gap-3">
        {summaryQuery.isLoading ? (
          <SummarySkeleton />
        ) : summaryQuery.isError ? (
          <div className="card shadow-sm border-0">
            <SectionError onRetry={() => { summaryQuery.refetch(); }} />
          </div>
        ) : (
          <div className="card shadow-sm border-0">
            <div className="card-body py-3">
              <div className="dg-inventory-summary-grid">
                {summaryCards.map(([label, value]) => (
                  <div className="dg-inventory-summary-item" key={label}>
                    <div className="dg-summary-label">{label}</div>
                    <div className="dg-summary-value">{value}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        <div className="d-flex flex-column gap-3">
          <div>
            <div className="card shadow-sm border-0 dg-inventory-panel">
              <div className="dg-inventory-panel-header d-flex justify-content-between align-items-center gap-3 flex-wrap">
                <div>
                  <h3 className="h5 mb-1">Asset Grid</h3>
                  <p className="text-muted mb-0">총 {assetList?.total_count ?? 0}개 자산</p>
                </div>
                <div className="btn-group flex-wrap" role="tablist" aria-label="Asset filters">
                  {[
                    ['all', 'All'],
                    ['k8s', 'K8s'],
                    ['aws', 'AWS'],
                    ['entry-points', 'Entry Points'],
                    ['crown-jewels', 'Crown Jewels'],
                  ].map(([key, label]) => (
                    <button
                      key={key}
                      type="button"
                      className={`btn ${activeTab === key ? 'btn-primary' : 'btn-outline-secondary'}`}
                      onClick={() => handleTabChange(key as InventoryTab)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="dg-inventory-panel-body">
                {assetsQuery.isLoading ? (
                  <div className="p-4"><AssetSkeleton /></div>
                ) : assetsQuery.isError ? (
                  <SectionError onRetry={() => assetsQuery.refetch()} />
                ) : assets.length === 0 ? (
                  <div className="p-5 text-center text-muted">아직 스캔 결과가 없습니다</div>
                ) : (
                  <div className="dg-inventory-asset-scroll">
                    <div className="table-responsive">
                      <table className="table table-hover align-middle dg-inventory-asset-table">
                        <thead className="table-light">
                          <tr>
                            <th>이름</th>
                            <th>타입</th>
                            <th>도메인</th>
                            <th>Namespace</th>
                            <th>Risk</th>
                            <th>분류</th>
                            <th>Coverage</th>
                          </tr>
                        </thead>
                        <tbody>
                          {assets.map((asset) => {
                            const { Icon, color } = getNodeTypeMeta(asset.node_type);
                            const riskMeta = getRiskMeta(asset.base_risk);

                            return (
                              <tr key={asset.node_id} role="button" onClick={() => setSelectedAsset(toDetailAsset(asset))}>
                                <td>
                                  <div className="d-flex align-items-center gap-2 dg-inventory-asset-name">
                                    <span className="d-inline-flex align-items-center justify-content-center rounded-3 border" style={{ width: 32, height: 32, color }}>
                                      <Icon size={18} />
                                    </span>
                                    <span className="fw-semibold dg-inventory-asset-name-text" title={asset.name}>
                                      {asset.name.length > 15 ? `${asset.name.slice(0, 15)}...` : asset.name}
                                    </span>
                                  </div>
                                </td>
                                <td>{asset.node_type}</td>
                                <td><span className={`${getDomainClass(asset.domain)}`}>{asset.domain}</span></td>
                                <td>{asset.namespace ?? '-'}</td>
                                <td>{riskMeta ? <span className={`${riskMeta.className}`}>{riskMeta.label}</span> : '-'}</td>
                                <td>
                                  <div className="d-flex flex-wrap gap-2">
                                    {asset.is_entry_point ? <span className="dg-badge dg-badge--high">Entry Point</span> : null}
                                    {asset.is_crown_jewel ? <span className="dg-badge dg-badge--notable">Crown Jewel</span> : null}
                                    {!asset.is_entry_point && !asset.is_crown_jewel ? '-' : null}
                                  </div>
                                </td>
                                <td>
                                  <div className="d-flex flex-wrap gap-2">
                                    {scannerTypes.map((scannerType) => {
                                      const coverage = asset.scanner_coverage?.[scannerType];
                                      const isCovered = coverage === 'covered';
                                      const isNotCovered = coverage === 'not_covered';

                                      return (
                                        <span
                                          key={scannerType}
                                          className={`dg-badge d-inline-flex align-items-center gap-1 ${
                                            isCovered
                                              ? 'dg-badge--success'
                                              : isNotCovered
                                                ? 'dg-badge--low'
                                                : 'dg-badge--tag'
                                          }`}
                                        >
                                          {scannerType}
                                          {isCovered ? <Check size={12} /> : isNotCovered ? <X size={12} /> : 'N/A'}
                                        </span>
                                      );
                                    })}
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div>
            <div className="card shadow-sm border-0 dg-inventory-panel">
              <div className="dg-inventory-panel-header">
                <h3 className="h5 mb-1">Risk Spotlight</h3>
                <p className="text-muted mb-0">Entry Points와 Crown Jewels를 빠르게 확인합니다.</p>
              </div>

              <div className="dg-inventory-panel-body">
                {spotlightQuery.isLoading ? (
                  <div className="p-4"><SpotlightSkeleton /></div>
                ) : spotlightQuery.isError ? (
                  <SectionError onRetry={() => spotlightQuery.refetch()} />
                ) : spotlightEmpty ? (
                  <div className="py-5 text-center text-muted">
                    아직 분석 결과가 없습니다. 분석이 완료되면 위험 자산이 표시됩니다.
                  </div>
                ) : (
                  <div className="dg-inventory-spotlight-scroll d-flex flex-column gap-3">
                    <div className="dg-inventory-spotlight-section">
                      <h4 className="h6 mb-3">Entry Points</h4>
                      {entryPoints.length === 0 ? (
                        <div className="text-muted">아직 분석 결과가 없습니다</div>
                      ) : (
                        <div className="d-flex flex-column gap-3">
                          {entryPoints.map((item) => {
                            const { Icon, color } = getNodeTypeMeta(item.node_type);
                            const riskMeta = getRiskMeta(item.base_risk);

                            return (
                              <button type="button" className="btn btn-outline-secondary text-start rounded-4 p-3 dg-inventory-spotlight-card" key={item.node_id} onClick={() => setSelectedAsset(toDetailSpotlight(item, 'entry-point'))}>
                                <div className="d-flex align-items-start gap-3">
                                  <span className="d-inline-flex align-items-center justify-content-center rounded-3 border" style={{ width: 32, height: 32, color }}>
                                    <Icon size={18} />
                                  </span>
                                  <div className="flex-grow-1">
                                    <div className="d-flex justify-content-between gap-3 flex-wrap">
                                      <div className="fw-semibold">{item.name}</div>
                                      <div>{riskMeta ? <span className={`${riskMeta.className}`}>{riskMeta.label}</span> : '-'}</div>
                                    </div>
                                    <div className="small text-muted mt-2">공격 경로 {item.attack_path_count ?? 0}개</div>
                                    {item.reachable_crown_jewel_count != null ? (
                                      <div className="small text-muted mt-1">Crown Jewel {item.reachable_crown_jewel_count}개 도달 가능</div>
                                    ) : null}
                                  </div>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    <div className="dg-inventory-spotlight-section">
                      <h4 className="h6 mb-3">Crown Jewels</h4>
                      {crownJewels.length === 0 ? (
                        <div className="text-muted">아직 분석 결과가 없습니다</div>
                      ) : (
                        <div className="d-flex flex-column gap-3">
                          {crownJewels.map((item) => {
                            const { Icon, color } = getNodeTypeMeta(item.node_type);
                            const riskMeta = getRiskMeta(item.base_risk);

                            return (
                              <button type="button" className="btn btn-outline-secondary text-start rounded-4 p-3 dg-inventory-spotlight-card" key={item.node_id} onClick={() => setSelectedAsset(toDetailSpotlight(item, 'crown-jewel'))}>
                                <div className="d-flex align-items-start gap-3">
                                  <span className="d-inline-flex align-items-center justify-content-center rounded-3 border" style={{ width: 32, height: 32, color }}>
                                    <Icon size={18} />
                                  </span>
                                  <div className="flex-grow-1">
                                    <div className="d-flex justify-content-between gap-3 flex-wrap">
                                      <div className="fw-semibold">{item.name}</div>
                                      <div>{riskMeta ? <span className={`${riskMeta.className}`}>{riskMeta.label}</span> : '-'}</div>
                                    </div>
                                    <div className="small text-muted mt-2">공격 경로 {item.attack_path_count ?? 0}개</div>
                                  </div>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {selectedAsset ? (
        <>
          <button
            type="button"
            aria-label="Close detail panel"
            className="border-0"
            onClick={() => setSelectedAsset(null)}
            style={{ position: 'fixed', inset: 0, background: 'rgba(2, 6, 23, 0.45)', zIndex: 1040 }}
          />
          <aside
            style={{
              position: 'fixed',
              top: 0,
              right: 0,
              width: 'min(420px, 100vw)',
              height: '100vh',
              zIndex: 1050,
              overflowY: 'auto',
              background: '#0f172a',
              borderLeft: '1px solid rgba(148, 163, 184, 0.18)',
              boxShadow: '-18px 0 50px rgba(15, 23, 42, 0.4)',
            }}
          >
            <div className="p-4 border-bottom d-flex justify-content-between align-items-start gap-3">
              <div>
                <div className="small text-uppercase text-muted mb-2">Asset Detail</div>
                <h3 className="h4 mb-0">{selectedAsset.name}</h3>
              </div>
              <button type="button" className="btn-close btn-close-white" onClick={() => setSelectedAsset(null)} />
            </div>
            <div className="p-4 d-flex flex-column gap-4">
              <div className="d-flex flex-column gap-2">
                <div><strong>자산명:</strong> {selectedAsset.name}</div>
                <div><strong>타입:</strong> {selectedAsset.node_type}</div>
                <div><strong>도메인:</strong> {selectedAsset.domain}</div>
                <div><strong>Namespace:</strong> {selectedAsset.namespace ?? '-'}</div>
                <div>
                  <strong>Risk:</strong>{' '}
                  {getRiskMeta(selectedAsset.base_risk) ? (
                    <span className={getRiskMeta(selectedAsset.base_risk)?.className}>{getRiskMeta(selectedAsset.base_risk)?.label}</span>
                  ) : (
                    '-'
                  )}
                </div>
              </div>
              <div>
                <h4 className="h6 mb-3">Scanner Coverage</h4>
                <div className="d-flex flex-column gap-2">
                  {scannerTypes.map((scannerType) => {
                    const coverage = selectedAsset.scanner_coverage?.[scannerType];
                    const statusText = coverage === 'covered' ? 'covered' : coverage === 'not_covered' ? 'not covered' : 'N/A';
                    return (
                      <div className="d-flex justify-content-between align-items-center border rounded-3 px-3 py-2" key={scannerType}>
                        <span>{scannerType}</span>
                        <span className={coverage === 'covered' ? 'text-success' : coverage === 'not_covered' ? 'text-secondary' : 'text-muted'}>
                          {statusText}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className="d-grid gap-2">
                <button type="button" className="btn btn-primary" onClick={() => navigate(`/clusters/${clusterId}/graph`)}>
                  Attack Graph에서 보기
                </button>
                <button type="button" className="btn btn-outline-light" onClick={() => navigate(`/clusters/${clusterId}/risk`)}>
                  Recommendations 보기
                </button>
              </div>
            </div>
          </aside>
        </>
      ) : null}
    </div>
  );
};

export default InventoryPage;
