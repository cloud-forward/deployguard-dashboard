import React, { useMemo, useState } from 'react';
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
  InvScannerStatusResponse,
  InvSummaryResponse,
} from '../api/model';
import {
  useGetInventoryAssetsApiV1ClustersClusterIdInventoryAssetsGet,
  useGetInventoryRiskSpotlightApiV1ClustersClusterIdInventoryRiskSpotlightGet,
  useGetInventoryScannerStatusApiV1ClustersClusterIdInventoryScannerStatusGet,
  useGetInventorySummaryApiV1ClustersClusterIdInventorySummaryGet,
} from '../api/generated/inventory/inventory';
import ClusterFlowNav from '../components/layout/ClusterFlowNav';

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

const PAGE_SIZE = 20;
const DEFAULT_SCANNERS = ['k8s', 'aws', 'image'];

const formatDateTime = (value?: string | null, fallback = '-') =>
  value ? new Date(value).toLocaleString('ko-KR') : fallback;

const sumResources = (value?: Record<string, number> | null) =>
  Object.values(value ?? {}).reduce((acc, item) => acc + item, 0);

const getRiskMeta = (baseRisk?: number | null) => {
  if (baseRisk == null) return null;
  if (baseRisk >= 80) return { label: 'Critical', className: 'bg-danger-subtle text-danger border border-danger-subtle' };
  if (baseRisk >= 60) return { label: 'High', className: 'bg-warning-subtle text-warning-emphasis border border-warning-subtle' };
  if (baseRisk >= 40) return { label: 'Medium', className: 'bg-info-subtle text-info-emphasis border border-info-subtle' };
  return { label: 'Low', className: 'bg-success-subtle text-success border border-success-subtle' };
};

const getDomainClass = (domain?: string | null) => {
  if (domain === 'k8s') return 'bg-primary-subtle text-primary border border-primary-subtle';
  if (domain === 'aws') return 'bg-warning-subtle text-warning-emphasis border border-warning-subtle';
  return 'bg-secondary-subtle text-secondary border border-secondary-subtle';
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

const isScannerStatusResponse = (value: unknown): value is InvScannerStatusResponse =>
  Boolean(value && typeof value === 'object' && 'scanners' in value);

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
    <div className="card-body">
      <div className="row g-3 placeholder-glow">
        {Array.from({ length: 7 }).map((_, index) => (
          <div className="col-12 col-sm-6 col-xl" key={index}>
            <div className="border rounded-4 p-3">
              <span className="placeholder col-5 d-block mb-2" />
              <span className="placeholder col-8 placeholder-lg d-block" />
            </div>
          </div>
        ))}
      </div>
      <div className="d-flex flex-wrap gap-3 mt-4 placeholder-glow">
        {Array.from({ length: 3 }).map((_, index) => (
          <div className="border rounded-pill px-4 py-3" style={{ minWidth: 220 }} key={index}>
            <span className="placeholder col-10 d-block" />
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
  const [page, setPage] = useState(1);
  const [selectedAsset, setSelectedAsset] = useState<DetailAsset | null>(null);

  const assetParams = useMemo<GetInventoryAssetsApiV1ClustersClusterIdInventoryAssetsGetParams>(() => {
    const base = { page, page_size: PAGE_SIZE };
    if (activeTab === 'k8s') return { ...base, domain: 'k8s' };
    if (activeTab === 'aws') return { ...base, domain: 'aws' };
    if (activeTab === 'entry-points') return { ...base, is_entry_point: true };
    if (activeTab === 'crown-jewels') return { ...base, is_crown_jewel: true };
    return base;
  }, [activeTab, page]);

  const summaryQuery = useGetInventorySummaryApiV1ClustersClusterIdInventorySummaryGet(clusterId, {
    query: { enabled: Boolean(clusterId), retry: false },
  });
  const scannerQuery = useGetInventoryScannerStatusApiV1ClustersClusterIdInventoryScannerStatusGet(clusterId, {
    query: { enabled: Boolean(clusterId), retry: false },
  });
  const assetsQuery = useGetInventoryAssetsApiV1ClustersClusterIdInventoryAssetsGet(clusterId, assetParams, {
    query: { enabled: Boolean(clusterId), retry: false },
  });
  const spotlightQuery = useGetInventoryRiskSpotlightApiV1ClustersClusterIdInventoryRiskSpotlightGet(clusterId, {
    query: { enabled: Boolean(clusterId), retry: false },
  });

  const summary = isSummaryResponse(summaryQuery.data) ? summaryQuery.data : undefined;
  const scannerStatus = isScannerStatusResponse(scannerQuery.data) ? scannerQuery.data : undefined;
  const assetList = isAssetListResponse(assetsQuery.data) ? assetsQuery.data : undefined;
  const spotlight = isRiskSpotlightResponse(spotlightQuery.data) ? spotlightQuery.data : undefined;

  const scanners = Array.isArray(scannerStatus?.scanners) ? scannerStatus.scanners : [];
  const assets = Array.isArray(assetList?.assets) ? assetList.assets : [];
  const entryPoints = Array.isArray(spotlight?.entry_points) ? spotlight.entry_points : [];
  const crownJewels = Array.isArray(spotlight?.crown_jewels) ? spotlight.crown_jewels : [];

  const scannerTypes = useMemo(() => {
    const merged = new Set<string>(DEFAULT_SCANNERS);
    scanners.forEach((scanner) => merged.add(scanner.scanner_type));
    return Array.from(merged);
  }, [scanners]);

  const totalPages = Math.max(1, Math.ceil((assetList?.total_count ?? 0) / PAGE_SIZE));
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
    setPage(1);
  };

  if (!clusterId) {
    return <div className="alert alert-warning">Cluster ID가 없어 Inventory를 불러올 수 없습니다.</div>;
  }

  return (
    <div className="position-relative">
      <div className="d-flex align-items-baseline gap-3 mb-4">
        <h1 className="h2 mb-0 fw-bold">인벤토리</h1>
        <span className="fs-6" style={{ color: '#f2f2f2' }}>클러스터, 자산 요약, 자산 그리드, 위험 포인트</span>
      </div>

      <ClusterFlowNav clusterId={clusterId} current="inventory" />

      <div className="d-flex flex-column gap-4">
        {summaryQuery.isLoading || scannerQuery.isLoading ? (
          <SummarySkeleton />
        ) : summaryQuery.isError || scannerQuery.isError ? (
          <div className="card shadow-sm border-0">
            <SectionError onRetry={() => { summaryQuery.refetch(); scannerQuery.refetch(); }} />
          </div>
        ) : (
          <div className="card shadow-sm border-0">
            <div className="card-body">
              <div className="row g-3">
                {summaryCards.map(([label, value]) => (
                  <div className="col-12 col-sm-6 col-xl" key={label}>
                    <div className="border rounded-4 p-3 h-100">
                      <div className="small text-uppercase text-muted mb-2">{label}</div>
                      <div className="fs-4 fw-semibold">{value}</div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="d-flex flex-wrap gap-3 mt-4">
                {scanners.slice(0, 3).map((scanner) => (
                  <div className="border rounded-pill px-3 py-2 d-flex align-items-center gap-3" key={scanner.scanner_type}>
                    <span
                      className={`rounded-circle ${scanner.status === 'active' ? 'bg-success' : 'bg-secondary'}`}
                      style={{ width: 10, height: 10 }}
                    />
                    <div>
                      <div className="fw-semibold">{scanner.display_name}</div>
                      <div className="small text-muted">
                        {scanner.status === 'active' ? `Active · ${formatDateTime(scanner.last_scan_at)}` : 'Not Connected'}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        <div className="card shadow-sm border-0">
          <div className="card-body p-0">
            <div className="p-4 border-bottom d-flex justify-content-between align-items-center gap-3 flex-wrap">
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

            {assetsQuery.isLoading ? (
              <div className="p-4"><AssetSkeleton /></div>
            ) : assetsQuery.isError ? (
              <SectionError onRetry={() => assetsQuery.refetch()} />
            ) : assets.length === 0 ? (
              <div className="p-5 text-center text-muted">아직 스캔 결과가 없습니다</div>
            ) : (
              <>
                <div className="table-responsive">
                  <table className="table table-hover align-middle mb-0">
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
                              <div className="d-flex align-items-center gap-3">
                                <span className="d-inline-flex align-items-center justify-content-center rounded-3 border" style={{ width: 32, height: 32, color }}>
                                  <Icon size={18} />
                                </span>
                                <span className="fw-semibold">{asset.name}</span>
                              </div>
                            </td>
                            <td>{asset.node_type}</td>
                            <td><span className={`badge ${getDomainClass(asset.domain)}`}>{asset.domain}</span></td>
                            <td>{asset.namespace ?? '-'}</td>
                            <td>{riskMeta ? <span className={`badge ${riskMeta.className}`}>{riskMeta.label}</span> : '-'}</td>
                            <td>
                              <div className="d-flex flex-wrap gap-2">
                                {asset.is_entry_point ? <span className="badge bg-danger-subtle text-danger border border-danger-subtle">Entry Point</span> : null}
                                {asset.is_crown_jewel ? <span className="badge bg-warning-subtle text-warning-emphasis border border-warning-subtle">Crown Jewel</span> : null}
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
                                      className={`badge d-inline-flex align-items-center gap-1 ${
                                        isCovered
                                          ? 'bg-success-subtle text-success border border-success-subtle'
                                          : isNotCovered
                                            ? 'bg-secondary-subtle text-secondary border border-secondary-subtle'
                                            : 'bg-dark-subtle text-light border border-secondary-subtle'
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
                <div className="d-flex justify-content-between align-items-center p-4 border-top flex-wrap gap-3">
                  <div className="small text-muted">페이지 {page} / {totalPages}</div>
                  <div className="d-flex gap-2">
                    <button type="button" className="btn btn-outline-secondary" disabled={page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>
                      이전
                    </button>
                    <button type="button" className="btn btn-outline-secondary" disabled={page >= totalPages} onClick={() => setPage((current) => Math.min(totalPages, current + 1))}>
                      다음
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        <div className="card shadow-sm border-0">
          <div className="card-body">
            <div className="mb-4">
              <h3 className="h5 mb-1">Risk Spotlight</h3>
              <p className="text-muted mb-0">Entry Points와 Crown Jewels를 좌우 섹션으로 나눠 표시합니다.</p>
            </div>
            {spotlightQuery.isLoading ? (
              <SpotlightSkeleton />
            ) : spotlightQuery.isError ? (
              <SectionError onRetry={() => spotlightQuery.refetch()} />
            ) : spotlightEmpty ? (
              <div className="py-5 text-center text-muted">
                아직 분석 결과가 없습니다. 분석이 완료되면 위험 자산이 표시됩니다.
              </div>
            ) : (
              <div className="row g-4">
                <div className="col-12 col-xl-6">
                  <div className="card shadow-sm border-0 h-100">
                    <div className="card-body">
                      <h4 className="h6 mb-3">Entry Points</h4>
                      {entryPoints.length === 0 ? (
                        <div className="text-muted">아직 분석 결과가 없습니다</div>
                      ) : (
                        <div className="d-flex flex-column gap-3">
                          {entryPoints.map((item) => {
                            const { Icon, color } = getNodeTypeMeta(item.node_type);
                            const riskMeta = getRiskMeta(item.base_risk);

                            return (
                              <button type="button" className="btn btn-outline-secondary text-start rounded-4 p-3" key={item.node_id} onClick={() => setSelectedAsset(toDetailSpotlight(item, 'entry-point'))}>
                                <div className="d-flex align-items-start gap-3">
                                  <span className="d-inline-flex align-items-center justify-content-center rounded-3 border" style={{ width: 32, height: 32, color }}>
                                    <Icon size={18} />
                                  </span>
                                  <div className="flex-grow-1">
                                    <div className="d-flex justify-content-between gap-3 flex-wrap">
                                      <div className="fw-semibold">{item.name}</div>
                                      <div>{riskMeta ? <span className={`badge ${riskMeta.className}`}>{riskMeta.label}</span> : '-'}</div>
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
                  </div>
                </div>
                <div className="col-12 col-xl-6">
                  <div className="card shadow-sm border-0 h-100">
                    <div className="card-body">
                      <h4 className="h6 mb-3">Crown Jewels</h4>
                      {crownJewels.length === 0 ? (
                        <div className="text-muted">아직 분석 결과가 없습니다</div>
                      ) : (
                        <div className="d-flex flex-column gap-3">
                          {crownJewels.map((item) => {
                            const { Icon, color } = getNodeTypeMeta(item.node_type);
                            const riskMeta = getRiskMeta(item.base_risk);

                            return (
                              <button type="button" className="btn btn-outline-secondary text-start rounded-4 p-3" key={item.node_id} onClick={() => setSelectedAsset(toDetailSpotlight(item, 'crown-jewel'))}>
                                <div className="d-flex align-items-start gap-3">
                                  <span className="d-inline-flex align-items-center justify-content-center rounded-3 border" style={{ width: 32, height: 32, color }}>
                                    <Icon size={18} />
                                  </span>
                                  <div className="flex-grow-1">
                                    <div className="d-flex justify-content-between gap-3 flex-wrap">
                                      <div className="fw-semibold">{item.name}</div>
                                      <div>{riskMeta ? <span className={`badge ${riskMeta.className}`}>{riskMeta.label}</span> : '-'}</div>
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
                </div>
              </div>
            )}
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
                    <span className={`badge ${getRiskMeta(selectedAsset.base_risk)?.className}`}>{getRiskMeta(selectedAsset.base_risk)?.label}</span>
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
