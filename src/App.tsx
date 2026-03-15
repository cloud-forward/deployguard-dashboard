// ============================================================
// src/App.tsx (최종본)
// 레이아웃: 사이드바(클러스터 선택 포함) + 메인 콘텐츠
// ============================================================
import { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import {
  LayoutDashboard, GitBranch, Shield,
  Activity, Settings, ChevronLeft, ChevronRight,
  Server, Circle,
} from 'lucide-react';
import { useDashboardStore } from './store';
import { useClusters } from './api/hooks';
import { OverviewPage } from './pages/OverviewPage';
import { AttackGraphPage } from './pages/AttackGraphPage';
import { RecommendationsPage } from './pages/RecommendationsPage';
import { EvidencePage } from './pages/EvidencePage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      staleTime: 5 * 60 * 1000,
      refetchOnWindowFocus: false,
    },
  },
});

type PageId = 'overview' | 'attack-graph' | 'recommendations' | 'evidence' | 'settings';

const NAV_ITEMS: { id: PageId; label: string; icon: React.ReactNode }[] = [
  { id: 'overview',        label: '보안 현황',   icon: <LayoutDashboard size={16} /> },
  { id: 'attack-graph',    label: '공격 그래프', icon: <GitBranch size={16} /> },
  { id: 'recommendations', label: '권고사항',    icon: <Shield size={16} /> },
  { id: 'evidence',        label: '런타임 증거', icon: <Activity size={16} /> },
  { id: 'settings',        label: '설정',        icon: <Settings size={16} /> },
];

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <DashboardLayout />
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}

function DashboardLayout() {
  const [currentPage, setCurrentPage] = useState<PageId>('overview');
  const { isSidebarOpen, toggleSidebar } = useDashboardStore();

  return (
    <div className="flex h-screen bg-slate-950 text-slate-100 overflow-hidden">
      <aside
        className={`flex flex-col border-r border-slate-800 bg-slate-900 transition-all duration-200 ${
          isSidebarOpen ? 'w-60' : 'w-14'
        }`}
      >
        <div className="flex items-center gap-3 px-3 py-4 border-b border-slate-800">
          <div className="w-7 h-7 bg-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
            <Shield size={15} className="text-white" />
          </div>
          {isSidebarOpen && (
            <div>
              <div className="font-bold text-slate-100 text-sm leading-tight">DeployGuard</div>
              <div className="text-slate-500 text-xs">v4.0</div>
            </div>
          )}
        </div>

        {isSidebarOpen && <ClusterSelector />}

        <nav className="flex-1 p-2 space-y-0.5">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              onClick={() => setCurrentPage(item.id)}
              title={isSidebarOpen ? undefined : item.label}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                currentPage === item.id
                  ? 'bg-blue-600/20 text-blue-400'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              <span className="flex-shrink-0">{item.icon}</span>
              {isSidebarOpen && <span className="truncate">{item.label}</span>}
            </button>
          ))}
        </nav>

        <button
          onClick={toggleSidebar}
          className="flex items-center justify-center p-3 border-t border-slate-800 text-slate-600 hover:text-slate-400 transition-colors"
        >
          {isSidebarOpen ? <ChevronLeft size={15} /> : <ChevronRight size={15} />}
        </button>
      </aside>

      <main className="flex-1 overflow-auto">
        <PageRenderer currentPage={currentPage} />
      </main>
    </div>
  );
}

function ClusterSelector() {
  const { selectedClusterId, setSelectedClusterId } = useDashboardStore();
  const { data: clusters, isLoading } = useClusters();

  return (
    <div className="px-3 py-3 border-b border-slate-800">
      <div className="text-xs text-slate-500 mb-2 flex items-center gap-1.5">
        <Server size={11} /> 클러스터
      </div>
      {isLoading ? (
        <div className="h-8 bg-slate-800 rounded animate-pulse" />
      ) : (
        <select
          value={selectedClusterId ?? ''}
          onChange={(e) => setSelectedClusterId(e.target.value || null)}
          className="w-full bg-slate-800 border border-slate-700 rounded-lg text-slate-200 text-xs px-2 py-1.5 focus:outline-none focus:border-blue-500"
        >
          <option value="">전체 보기</option>
          {(clusters ?? []).map((c) => (
            <option key={c.cluster_id} value={c.cluster_id}>
              {c.cluster_name}
            </option>
          ))}
        </select>
      )}
      {selectedClusterId && clusters && (
        <div className="flex items-center gap-1.5 mt-2">
          <Circle size={6} className="text-green-400 fill-green-400" />
          <span className="text-xs text-slate-500 truncate">
            {clusters.find((c) => c.cluster_id === selectedClusterId)?.cluster_name}
          </span>
        </div>
      )}
    </div>
  );
}

function PageRenderer({ currentPage }: { currentPage: PageId }) {
  switch (currentPage) {
    case 'overview':        return <OverviewPage />;
    case 'attack-graph':    return <AttackGraphPage />;
    case 'recommendations': return <RecommendationsPage />;
    case 'evidence':        return <EvidencePage />;
    case 'settings':        return <SettingsPlaceholder />;
    default:                return null;
  }
}

function SettingsPlaceholder() {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-4 p-8 text-center">
      <Settings size={32} className="text-slate-600" />
      <div>
        <h2 className="text-xl font-semibold text-slate-200">설정</h2>
        <p className="text-slate-400 text-sm mt-1">API 키, 클러스터 연결 관리, 알림 설정</p>
      </div>
    </div>
  );
}
