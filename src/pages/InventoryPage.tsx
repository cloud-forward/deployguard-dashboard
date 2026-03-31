import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Box, Check, Clock3, Crown, Database, Globe, HelpCircle, Key, KeyRound, Layers, Lock, Network, Server, Shield, ShieldAlert, ShieldCheck, User, X,
} from 'lucide-react';
import type {
  GetInventoryAssetsApiV1ClustersClusterIdInventoryAssetsGetParams, InvAssetItem, InvAssetListResponse, InvRiskSpotlightResponse, InvSummaryResponse,
} from '../api/model';
import { useListClustersApiV1ClustersGet } from '../api/generated/clusters/clusters';
import {
  useGetInventoryAssetsApiV1ClustersClusterIdInventoryAssetsGet,
  useGetInventoryRiskSpotlightApiV1ClustersClusterIdInventoryRiskSpotlightGet,
  useGetInventorySummaryApiV1ClustersClusterIdInventorySummaryGet,
} from '../api/generated/inventory/inventory';

type InventoryTab = 'all' | 'k8s' | 'aws' | 'entry-points' | 'crown-jewels';
type InventoryPageProps = { totalAssets?: number; k8sAssets?: number; awsAssets?: number; entryPointsCount?: number; crownJewelsCount?: number; criticalPathsCount?: number; lastAnalyzedAt?: string; assetList?: InvAssetItem[]; assetTotalCount?: number; };
type StatCardConfig = { key: string; label: string; value: string; icon: React.ComponentType<{ size?: number }>; accent?: 'blue' | 'amber' | 'red' | 'green'; wide?: boolean; };

const DEFAULT_SCANNERS = ['k8s', 'aws', 'image'];
const FULL_ASSET_PAGE_SIZE = 1000;
const TABS: Array<{ key: InventoryTab; label: string }> = [
  { key: 'all', label: 'All' }, { key: 'k8s', label: 'K8s' }, { key: 'aws', label: 'AWS' }, { key: 'entry-points', label: 'Entry Points' }, { key: 'crown-jewels', label: 'Crown Jewels' },
];

const formatDateTime = (value?: string | null, fallback = '-') => {
  if (!value) return fallback;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString('ko-KR');
};
const formatCompactTimestamp = (value: string) => value.replace(' 오전 ', '\n오전 ').replace(' 오후 ', '\n오후 ');
const formatNumber = (value: number) => new Intl.NumberFormat('ko-KR').format(value);
const sumResources = (value?: Record<string, number> | null) => Object.values(value ?? {}).reduce((acc, item) => acc + item, 0);
const isSummaryResponse = (value: unknown): value is InvSummaryResponse => Boolean(value && typeof value === 'object' && 'total_node_count' in value);
const isAssetListResponse = (value: unknown): value is InvAssetListResponse => Boolean(value && typeof value === 'object' && 'assets' in value && 'total_count' in value);
const isRiskSpotlightResponse = (value: unknown): value is InvRiskSpotlightResponse => Boolean(value && typeof value === 'object' && ('entry_points' in value || 'crown_jewels' in value));
const filterAssetsByTab = (assets: InvAssetItem[], tab: InventoryTab) => tab === 'k8s' ? assets.filter((asset) => asset.domain === 'k8s') : tab === 'aws' ? assets.filter((asset) => asset.domain === 'aws') : tab === 'entry-points' ? assets.filter((asset) => asset.is_entry_point) : tab === 'crown-jewels' ? assets.filter((asset) => asset.is_crown_jewel) : assets;

const getRiskMeta = (baseRisk?: number | null) => {
  if (baseRisk == null) return null;
  if (baseRisk >= 80) return { label: 'Critical', className: 'dg-badge dg-badge--high' };
  if (baseRisk >= 60) return { label: 'High', className: 'dg-badge dg-badge--medium' };
  if (baseRisk >= 40) return { label: 'Medium', className: 'dg-badge dg-badge--info' };
  return { label: 'Low', className: 'dg-badge dg-badge--low' };
};

const getDomainClass = (domain?: string | null) => (domain === 'k8s' ? 'dg-badge dg-badge--info' : domain === 'aws' ? 'dg-badge dg-badge--notable' : 'dg-badge dg-badge--tag');

const getNodeTypeMeta = (nodeType?: string | null) => {
  switch (nodeType) {
    case 'pod': return { Icon: Box, color: '#3b82f6' };
    case 'service': return { Icon: Network, color: '#3b82f6' };
    case 'service_account': return { Icon: KeyRound, color: '#3b82f6' };
    case 'node': return { Icon: Server, color: '#3b82f6' };
    case 'secret': return { Icon: Lock, color: '#3b82f6' };
    case 'ingress': return { Icon: Globe, color: '#3b82f6' };
    case 'role':
    case 'cluster_role': return { Icon: Shield, color: '#3b82f6' };
    case 'ec2_instance': return { Icon: Server, color: '#f59e0b' };
    case 's3_bucket':
    case 'rds': return { Icon: Database, color: '#f59e0b' };
    case 'iam_role': return { Icon: Key, color: '#f59e0b' };
    case 'iam_user': return { Icon: User, color: '#f59e0b' };
    case 'security_group': return { Icon: ShieldCheck, color: '#f59e0b' };
    case 'container_image': return { Icon: Layers, color: '#3b82f6' };
    default: return { Icon: HelpCircle, color: '#6b7280' };
  }
};

const SectionError: React.FC<{ onRetry: () => void }> = ({ onRetry }) => (
  <div className="p-4">
    <div className="alert alert-danger mb-3" role="alert">데이터를 불러오지 못했습니다.</div>
    <button type="button" className="btn btn-sm dg-dashboard-action-btn dg-dashboard-action-btn--secondary" onClick={onRetry}>다시 시도</button>
  </div>
);

const SummarySkeleton: React.FC = () => (
  <div className="dg-inventory-stat-grid placeholder-glow">
    {Array.from({ length: 7 }).map((_, index) => <div className="dg-inventory-stat-card" key={index}><span className="placeholder col-5 d-block mb-2" /><span className="placeholder col-7 d-block" /></div>)}
  </div>
);

const AssetSkeleton: React.FC = () => (
  <div className="table-responsive">
    <table className="table align-middle mb-0">
      <thead className="table-light"><tr><th>이름</th><th>타입</th><th>도메인</th><th>Namespace</th><th>Risk</th><th>분류</th><th>Coverage</th></tr></thead>
      <tbody className="placeholder-glow">{Array.from({ length: 5 }).map((_, rowIndex) => <tr key={rowIndex}>{Array.from({ length: 7 }).map((__, cellIndex) => <td key={cellIndex}><span className="placeholder col-8 d-block" /></td>)}</tr>)}</tbody>
    </table>
  </div>
);

const SpotlightSkeleton: React.FC = () => (
  <div className="row g-4 placeholder-glow">
    {Array.from({ length: 2 }).map((_, index) => <div className="col-12 col-xl-6" key={index}><div className="card shadow-sm border-0 h-100"><div className="card-body"><span className="placeholder col-4 d-block mb-3" />{Array.from({ length: 3 }).map((__, cardIndex) => <div className="border rounded-4 p-3 mb-3" key={cardIndex}><span className="placeholder col-8 d-block mb-2" /><span className="placeholder col-5 d-block mb-2" /><span className="placeholder col-6 d-block" /></div>)}</div></div></div>)}
  </div>
);

const InventoryPage: React.FC<InventoryPageProps> = ({ totalAssets, k8sAssets, awsAssets, entryPointsCount, crownJewelsCount, criticalPathsCount, lastAnalyzedAt, assetList, assetTotalCount }) => {
  const navigate = useNavigate();
  const { clusterId = '' } = useParams();
  const [activeTab, setActiveTab] = useState<InventoryTab>('all');
  const { data: clustersResponse, isLoading: isClustersLoading } = useListClustersApiV1ClustersGet();
  const clusters = useMemo(() => (Array.isArray(clustersResponse) ? clustersResponse : []).map((cluster) => ({ id: cluster.id, name: cluster.name })), [clustersResponse]);
  const selectedCluster = clusters.find((cluster) => cluster.id === clusterId) ?? null;
  const assetParams = useMemo<GetInventoryAssetsApiV1ClustersClusterIdInventoryAssetsGetParams>(() => {
    if (assetList) return { page: 1, page_size: FULL_ASSET_PAGE_SIZE };
    const base = { page: 1, page_size: FULL_ASSET_PAGE_SIZE };
    if (activeTab === 'k8s') return { ...base, domain: 'k8s' };
    if (activeTab === 'aws') return { ...base, domain: 'aws' };
    if (activeTab === 'entry-points') return { ...base, is_entry_point: true };
    if (activeTab === 'crown-jewels') return { ...base, is_crown_jewel: true };
    return base;
  }, [activeTab, assetList]);

  const summaryQuery = useGetInventorySummaryApiV1ClustersClusterIdInventorySummaryGet(clusterId, { query: { enabled: Boolean(clusterId), retry: false } });
  const assetsQuery = useGetInventoryAssetsApiV1ClustersClusterIdInventoryAssetsGet(clusterId, assetParams, { query: { enabled: Boolean(clusterId) && !assetList, retry: false } });
  const spotlightQuery = useGetInventoryRiskSpotlightApiV1ClustersClusterIdInventoryRiskSpotlightGet(clusterId, { query: { enabled: Boolean(clusterId), retry: false } });
  const summary = isSummaryResponse(summaryQuery.data) ? summaryQuery.data : undefined;
  const assetResponse = isAssetListResponse(assetsQuery.data) ? assetsQuery.data : undefined;
  const spotlight = isRiskSpotlightResponse(spotlightQuery.data) ? spotlightQuery.data : undefined;
  const queriedAssets = Array.isArray(assetResponse?.assets) ? assetResponse.assets : [];
  const allAssets = assetList ?? queriedAssets;
  const assets = assetList ? filterAssetsByTab(assetList, activeTab) : queriedAssets;
  const entryPoints = Array.isArray(spotlight?.entry_points) ? spotlight.entry_points : [];
  const crownJewels = Array.isArray(spotlight?.crown_jewels) ? spotlight.crown_jewels : [];
  const total = totalAssets ?? summary?.total_node_count ?? assetTotalCount ?? allAssets.length;
  const k8s = k8sAssets ?? sumResources(summary?.k8s_resources);
  const aws = awsAssets ?? sumResources(summary?.aws_resources);
  const entryPointTotal = entryPointsCount ?? summary?.risk_summary?.entry_point_count ?? 0;
  const crownJewelTotal = crownJewelsCount ?? summary?.risk_summary?.crown_jewel_count ?? 0;
  const criticalPathTotal = criticalPathsCount ?? summary?.risk_summary?.critical_path_count ?? 0;
  const lastAnalysis = formatDateTime(lastAnalyzedAt ?? summary?.last_analysis_at, '분석 기록 없음');
  const listTotal = assetTotalCount ?? (assetList ? assetList.length : assetResponse?.total_count ?? assets.length);
  const scannerTypes = useMemo(() => { const merged = new Set<string>(DEFAULT_SCANNERS); allAssets.forEach((asset) => Object.keys(asset.scanner_coverage ?? {}).forEach((scannerType) => merged.add(scannerType))); return Array.from(merged); }, [allAssets]);
  const statCards: StatCardConfig[] = [
    { key: 'total', label: '전체 자산', value: formatNumber(total), icon: Layers, accent: 'blue' },
    { key: 'k8s', label: 'K8S 자산', value: formatNumber(k8s), icon: Box, accent: 'blue' },
    { key: 'aws', label: 'AWS 자산', value: formatNumber(aws), icon: Database, accent: 'blue' },
    { key: 'entry', label: 'ENTRY POINTS', value: formatNumber(entryPointTotal), icon: Globe, accent: 'amber' },
    { key: 'crown', label: 'CROWN JEWELS', value: formatNumber(crownJewelTotal), icon: Crown, accent: 'amber' },
    { key: 'critical', label: 'CRITICAL PATHS', value: formatNumber(criticalPathTotal), icon: ShieldAlert, accent: criticalPathTotal > 0 ? 'red' : 'green' },
    { key: 'last', label: '마지막 분석', value: formatCompactTimestamp(lastAnalysis), icon: Clock3, wide: true },
  ];
  const spotlightEmpty = entryPoints.length === 0 && crownJewels.length === 0;

  const navigateToAttackGraphHighlight = useCallback((assetName: string) => {
    const searchParams = new URLSearchParams({ highlight: assetName });
    navigate(`/clusters/${clusterId}/graph?${searchParams.toString()}`);
  }, [clusterId, navigate]);

  useEffect(() => { setActiveTab('all'); }, [clusterId]);
  if (!clusterId) return <div className="alert alert-warning">Cluster ID가 없어 Inventory를 불러올 수 없습니다.</div>;

  return (
    <div className="position-relative dg-inventory-page dg-page-shell">
      <style>{`
        .dg-inventory-page{--inventory-surface:#161b27;--inventory-text:#e8eaf0;--inventory-muted:#6b7280;--inventory-border:rgba(255,255,255,.07);--inventory-blue:#3b82f6;--inventory-amber:#f59e0b;--inventory-green:#22c55e;--dg-inventory-asset-height:clamp(22rem,calc(100vh - 30rem),30rem);color:var(--inventory-text)} .dg-inventory-heading{display:flex;align-items:baseline;gap:.75rem;flex-wrap:wrap} .dg-inventory-subtitle{color:var(--inventory-muted);font-size:.92rem;line-height:1.5} .dg-inventory-cluster-picker{display:flex;align-items:center;gap:.55rem;min-width:320px;flex-wrap:wrap} .dg-inventory-cluster-label{margin:0;color:var(--inventory-text);font-size:.84rem;font-weight:600;white-space:nowrap} .dg-inventory-page .form-select{background:#101521;border-color:var(--inventory-border);color:var(--inventory-text)} .dg-inventory-overview{display:flex;flex-direction:column;gap:1.25rem} .dg-inventory-stat-grid{display:grid;grid-template-columns:repeat(6,1fr) 1.8fr;width:100%;gap:0;overflow:hidden;padding:0;margin:0;border:1px solid rgba(255,255,255,.07);border-radius:10px;background:var(--inventory-surface)} .dg-inventory-stat-card{height:70px;min-width:0;display:flex;flex-direction:column;justify-content:center;padding:8px 12px;background:transparent;border:0;border-right:1px solid rgba(255,255,255,.07);border-radius:0;position:relative;overflow:visible} .dg-inventory-stat-card:last-child{border-right:0} .dg-inventory-stat-card::before{content:'';position:absolute;inset:0 auto 0 0;width:4px;background:transparent} .dg-inventory-stat-card--blue::before{background:var(--inventory-blue)} .dg-inventory-stat-card--amber::before{background:var(--inventory-amber)} .dg-inventory-stat-card--red::before{background:#e05555} .dg-inventory-stat-card--green::before{background:var(--inventory-green)} .dg-inventory-stat-card--wide{min-width:0} .dg-inventory-stat-header{display:block;min-width:0} .dg-inventory-stat-label{color:var(--inventory-muted);font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;line-height:1.1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis} .dg-inventory-stat-value{margin-top:6px;font-size:16px;line-height:1.1;font-weight:700;letter-spacing:-.02em;color:var(--inventory-text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis} .dg-inventory-stat-value--time{margin-top:4px;font-size:12px;line-height:1.15;font-weight:700;letter-spacing:0;color:var(--inventory-text);white-space:nowrap;overflow:visible;text-overflow:clip} .dg-inventory-stat-icon,.dg-inventory-stat-meta{display:none} .dg-inventory-panel{display:flex;flex-direction:column;min-height:0;background:var(--inventory-surface)!important;border:1px solid var(--inventory-border)!important;border-radius:12px!important;overflow:hidden} .dg-inventory-panel-header{display:flex;justify-content:space-between;align-items:flex-start;gap:1rem;flex-wrap:wrap;padding:1.25rem 1.25rem 1rem;border-bottom:1px solid var(--inventory-border);background:rgba(255,255,255,.01)} .dg-inventory-panel-title-row{display:flex;align-items:baseline;gap:.6rem;flex-wrap:wrap} .dg-inventory-panel-title{margin:0;font-size:1.05rem;font-weight:700;color:var(--inventory-text)} .dg-inventory-panel-subtitle{margin:0;color:var(--inventory-muted);font-size:.9rem} .dg-inventory-tabs{display:flex;align-items:center;gap:.65rem;flex-wrap:wrap} .dg-inventory-tab{border:1px solid transparent;border-radius:999px;padding:.48rem .9rem;background:transparent;color:#cdd5df;font-size:.88rem;font-weight:600;line-height:1;transition:background-color .16s ease,border-color .16s ease,color .16s ease} .dg-inventory-tab:hover{border-color:var(--inventory-border);background:rgba(255,255,255,.04);color:var(--inventory-text)} .dg-inventory-tab--active{background:var(--inventory-blue);border-color:var(--inventory-blue);color:#f8fbff;box-shadow:0 10px 24px rgba(59,130,246,.22)} .dg-inventory-panel-body{flex:1 1 auto;min-height:0;overflow:hidden} .dg-inventory-asset-scroll{max-height:var(--dg-inventory-asset-height);overflow:auto} .dg-inventory-asset-table{table-layout:fixed;width:100%;margin-bottom:0} .dg-inventory-asset-table th,.dg-inventory-asset-table td{padding:.8rem .85rem;vertical-align:middle} .dg-inventory-asset-table tbody tr,.dg-inventory-asset-table tbody tr>td{background-color:var(--inventory-surface)} .dg-inventory-asset-table tbody tr:hover>td{background-color:rgba(255,255,255,.03)} .dg-inventory-asset-table th:nth-child(1),.dg-inventory-asset-table td:nth-child(1){width:24%} .dg-inventory-asset-table th:nth-child(2),.dg-inventory-asset-table td:nth-child(2){width:11%} .dg-inventory-asset-table th:nth-child(3),.dg-inventory-asset-table td:nth-child(3){width:9%} .dg-inventory-asset-table th:nth-child(4),.dg-inventory-asset-table td:nth-child(4){width:13%} .dg-inventory-asset-table th:nth-child(5),.dg-inventory-asset-table td:nth-child(5){width:10%} .dg-inventory-asset-table th:nth-child(6),.dg-inventory-asset-table td:nth-child(6){width:13%} .dg-inventory-asset-table th:nth-child(7),.dg-inventory-asset-table td:nth-child(7){width:20%} .dg-inventory-asset-name{min-width:0} .dg-inventory-asset-name-text{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap} .dg-inventory-asset-scroll thead th{position:sticky;top:0;z-index:1;background:#121926;color:var(--inventory-muted);box-shadow:inset 0 -1px 0 var(--inventory-border)} .dg-inventory-spotlight-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px;padding:16px} .dg-inventory-spotlight-column{border:1px solid var(--inventory-border);border-radius:16px;background:#121926;min-height:0;overflow:hidden} .dg-inventory-spotlight-column-header{padding:14px 16px;border-bottom:1px solid var(--inventory-border)} .dg-inventory-spotlight-column-title{margin:0;font-size:1rem;font-weight:700;color:var(--inventory-text)} .dg-inventory-spotlight-list{max-height:400px;overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:12px} .dg-inventory-spotlight-empty{padding:16px;color:var(--inventory-muted)} .dg-inventory-spotlight-card{background:var(--inventory-surface);border-color:var(--inventory-border);color:var(--inventory-text)} .dg-inventory-spotlight-card:hover,.dg-inventory-spotlight-card:focus{background:rgba(255,255,255,.03);border-color:var(--inventory-border);color:var(--inventory-text)} @media (max-width:991.98px){.dg-inventory-cluster-picker{min-width:0;width:100%}.dg-inventory-asset-scroll{max-height:none}.dg-inventory-spotlight-grid{grid-template-columns:1fr}} @media (max-width:575.98px){.dg-inventory-cluster-picker{min-width:100%}}
      `}</style>

      <div className="dg-page-header">
        <div className="dg-page-heading dg-inventory-heading">
          <h1 className="dg-page-title">자산 현황</h1>
          <p className="dg-page-description dg-inventory-subtitle">클러스터 자산 현황과 중요 자산 구성을 한 번에 확인합니다.</p>
        </div>
        <div className="dg-inventory-cluster-picker">
          <label htmlFor="inventory-cluster-select" className="dg-inventory-cluster-label">클러스터</label>
          <select id="inventory-cluster-select" className="form-select form-select-sm" style={{ minWidth: 220, flex: '1 1 220px' }} value={clusterId} onChange={(event) => { const nextClusterId = event.target.value; if (!nextClusterId || nextClusterId === clusterId) return; navigate(`/clusters/${nextClusterId}/inventory`); }} disabled={isClustersLoading || clusters.length === 0}>
            {clusters.length === 0 ? <option value={clusterId}>{selectedCluster?.name ?? '사용 가능한 클러스터 없음'}</option> : clusters.map((cluster) => <option key={cluster.id} value={cluster.id}>{cluster.name}</option>)}
          </select>
        </div>
      </div>

      <div className="dg-inventory-overview">
        {summaryQuery.isLoading && !summary ? <SummarySkeleton /> : summaryQuery.isError && !summary && !totalAssets ? <div className="card shadow-sm border-0"><SectionError onRetry={() => summaryQuery.refetch()} /></div> : (
          <section className="dg-inventory-stat-grid" aria-label="Inventory statistics">
            {statCards.map(({ key, label, value, accent, wide }) => <article key={key} className={['dg-inventory-stat-card', accent ? `dg-inventory-stat-card--${accent}` : '', wide ? 'dg-inventory-stat-card--wide' : ''].filter(Boolean).join(' ')}><div className="dg-inventory-stat-header"><div className="dg-inventory-stat-label">{label}</div></div><div className={wide ? 'dg-inventory-stat-value dg-inventory-stat-value--time' : 'dg-inventory-stat-value'}>{value}</div></article>)}
          </section>
        )}

        <div className="d-flex flex-column gap-4">
          <div className="card shadow-sm border-0 dg-inventory-panel">
            <div className="dg-inventory-panel-header">
              <div className="dg-inventory-panel-title-row"><h3 className="dg-inventory-panel-title">Asset Grid</h3><p className="dg-inventory-panel-subtitle">총 {formatNumber(listTotal)}개 자산</p></div>
              <div className="dg-inventory-tabs" role="tablist" aria-label="Asset filters">{TABS.map((tab) => <button key={tab.key} type="button" className={`dg-inventory-tab ${activeTab === tab.key ? 'dg-inventory-tab--active' : ''}`} onClick={() => setActiveTab(tab.key)}>{tab.label}</button>)}</div>
            </div>
            <div className="dg-inventory-panel-body">
              {assetsQuery.isLoading && !assetList ? <div className="p-4"><AssetSkeleton /></div> : assetsQuery.isError && !assetList ? <SectionError onRetry={() => assetsQuery.refetch()} /> : assets.length === 0 ? <div className="p-5 text-center text-muted">표시할 자산이 없습니다.</div> : (
                <div className="dg-inventory-asset-scroll"><div className="table-responsive"><table className="table table-hover align-middle dg-inventory-asset-table"><thead className="table-light"><tr><th>이름</th><th>타입</th><th>도메인</th><th>Namespace</th><th>Risk</th><th>분류</th><th>Coverage</th></tr></thead><tbody>{assets.map((asset) => { const { Icon, color } = getNodeTypeMeta(asset.node_type); const riskMeta = getRiskMeta(asset.base_risk); return <tr key={asset.node_id} role="button" style={{ cursor: 'pointer' }} onClick={() => navigateToAttackGraphHighlight(asset.name)}><td><div className="d-flex align-items-center gap-2 dg-inventory-asset-name"><span className="d-inline-flex align-items-center justify-content-center rounded-3 border" style={{ width: 32, height: 32, color, borderColor: 'rgba(255,255,255,0.07)' }}><Icon size={18} /></span><span className="fw-semibold dg-inventory-asset-name-text" title={asset.name}>{asset.name}</span></div></td><td>{asset.node_type}</td><td><span className={getDomainClass(asset.domain)}>{asset.domain}</span></td><td>{asset.namespace ?? '-'}</td><td>{riskMeta ? <span className={riskMeta.className}>{riskMeta.label}</span> : '-'}</td><td><div className="d-flex flex-wrap gap-2">{asset.is_entry_point ? <span className="dg-badge dg-badge--high">Entry Point</span> : null}{asset.is_crown_jewel ? <span className="dg-badge dg-badge--notable">Crown Jewel</span> : null}{!asset.is_entry_point && !asset.is_crown_jewel ? '-' : null}</div></td><td><div className="d-flex flex-wrap gap-2">{scannerTypes.map((scannerType) => { const coverage = asset.scanner_coverage?.[scannerType]; const isCovered = coverage === 'covered'; const isNotCovered = coverage === 'not_covered'; return <span key={scannerType} className={`dg-badge d-inline-flex align-items-center gap-1 ${isCovered ? 'dg-badge--success' : isNotCovered ? 'dg-badge--low' : 'dg-badge--tag'}`}>{scannerType}{isCovered ? <Check size={12} /> : isNotCovered ? <X size={12} /> : 'N/A'}</span>; })}</div></td></tr>; })}</tbody></table></div></div>
              )}
            </div>
          </div>

          <div className="card shadow-sm border-0 dg-inventory-panel">
            <div className="dg-inventory-panel-header"><div><h3 className="dg-inventory-panel-title">Risk Spotlight</h3><p className="dg-inventory-panel-subtitle">Entry Points와 Crown Jewels를 빠르게 확인합니다.</p></div></div>
            <div className="dg-inventory-panel-body">
              {spotlightQuery.isLoading ? <div className="p-4"><SpotlightSkeleton /></div> : spotlightQuery.isError ? <SectionError onRetry={() => spotlightQuery.refetch()} /> : spotlightEmpty ? <div className="py-5 text-center text-muted">아직 분석 결과가 없습니다. 분석이 완료되면 중요 자산이 표시됩니다.</div> : (
                <div className="dg-inventory-spotlight-grid">
                  <section className="dg-inventory-spotlight-column">
                    <div className="dg-inventory-spotlight-column-header"><h4 className="dg-inventory-spotlight-column-title">Entry Points</h4></div>
                    {entryPoints.length === 0 ? (
                      <div className="dg-inventory-spotlight-empty">아직 분석 결과가 없습니다.</div>
                    ) : (
                      <div className="dg-inventory-spotlight-list">
                        {entryPoints.map((item) => {
                          const riskMeta = getRiskMeta(item.base_risk);
                          return (
                            <button type="button" className="btn btn-outline-secondary text-start rounded-4 p-3 dg-inventory-spotlight-card" key={item.node_id} onClick={() => navigateToAttackGraphHighlight(item.name)}>
                              <div className="d-flex align-items-start gap-3">
                                <span className="d-inline-flex align-items-center justify-content-center rounded-3 border" style={{ width: 32, height: 32, color: '#3b82f6', borderColor: 'rgba(255,255,255,0.07)' }}><Globe size={18} /></span>
                                <div className="flex-grow-1">
                                  <div className="d-flex justify-content-between gap-3 align-items-start">
                                    <div className="fw-semibold">{item.name}</div>
                                    <div className="flex-shrink-0">{riskMeta ? <span className={riskMeta.className}>{riskMeta.label}</span> : '-'}</div>
                                  </div>
                                  <div className="small text-muted mt-2">공격 경로 {item.attack_path_count ?? 0}개</div>
                                  {item.reachable_crown_jewel_count != null ? <div className="small text-muted mt-1">Crown Jewel {item.reachable_crown_jewel_count}개 도달 가능</div> : null}
                                </div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </section>

                  <section className="dg-inventory-spotlight-column">
                    <div className="dg-inventory-spotlight-column-header"><h4 className="dg-inventory-spotlight-column-title">Crown Jewels</h4></div>
                    {crownJewels.length === 0 ? (
                      <div className="dg-inventory-spotlight-empty">아직 분석 결과가 없습니다.</div>
                    ) : (
                      <div className="dg-inventory-spotlight-list">
                        {crownJewels.map((item) => {
                          const riskMeta = getRiskMeta(item.base_risk);
                          return (
                            <button type="button" className="btn btn-outline-secondary text-start rounded-4 p-3 dg-inventory-spotlight-card" key={item.node_id} onClick={() => navigateToAttackGraphHighlight(item.name)}>
                              <div className="d-flex align-items-start gap-3">
                                <span className="d-inline-flex align-items-center justify-content-center rounded-3 border" style={{ width: 32, height: 32, color: '#f59e0b', borderColor: 'rgba(255,255,255,0.07)' }}><User size={18} /></span>
                                <div className="flex-grow-1">
                                  <div className="d-flex justify-content-between gap-3 align-items-start">
                                    <div className="fw-semibold">{item.name}</div>
                                    <div className="flex-shrink-0">{riskMeta ? <span className={riskMeta.className}>{riskMeta.label}</span> : '-'}</div>
                                  </div>
                                  <div className="small text-muted mt-2">공격 경로 {item.attack_path_count ?? 0}개</div>
                                  {item.reachable_crown_jewel_count != null ? <div className="small text-muted mt-1">Crown Jewel {item.reachable_crown_jewel_count}개 도달 가능</div> : null}
                                </div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </section>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

    </div>
  );
};

export default InventoryPage;
