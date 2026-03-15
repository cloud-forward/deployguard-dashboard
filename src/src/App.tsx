// ============================================================
// src/App.tsx — 이미지 기준 리디자인
// 스타일: near-black, 대문자 라벨, 회색 카드 테두리
// ============================================================
import { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import {
  LayoutDashboard, GitBranch, Shield, Activity, Settings,
  Network, Lock, Target, Bell, Grid3X3, Search,
} from 'lucide-react';
import { useDashboardStore } from './store';
import { useClusters } from './api/hooks';
import { OverviewPage } from './pages/OverviewPage';
import { AttackGraphPage } from './pages/AttackGraphPage';
import { RecommendationsPage } from './pages/RecommendationsPage';
import { EvidencePage } from './pages/EvidencePage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 2, staleTime: 5 * 60 * 1000, refetchOnWindowFocus: false },
  },
});

type PageId = 'overview' | 'attack-graph' | 'recommendations' | 'evidence' | 'settings';

const MAIN_NAV: { id: PageId; label: string; icon: React.ReactNode }[] = [
  { id: 'overview',     label: '대시보드',    icon: <LayoutDashboard size={15} /> },
  { id: 'attack-graph', label: 'Network Ops', icon: <Network size={15} /> },
  { id: 'evidence',     label: 'Encrypted Logs', icon: <Lock size={15} /> },
  { id: 'recommendations', label: 'Intrusions',  icon: <Target size={15} /> },
];
const UTIL_NAV: { id: PageId; label: string; icon: React.ReactNode }[] = [
  { id: 'evidence',  label: 'Heuristics',    icon: <Activity size={15} /> },
  { id: 'settings',  label: 'Access Control', icon: <Shield size={15} /> },
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
  const { isSidebarOpen } = useDashboardStore();

  return (
    <div className="flex flex-col h-screen overflow-hidden" style={{ background: '#0d0d0d' }}>
      {/* ── 상단 헤더 ── */}
      <TopBar />

      <div className="flex flex-1 overflow-hidden">
        {/* ── 사이드바 ── */}
        <aside
          className="flex flex-col border-r shrink-0 overflow-hidden transition-all duration-200"
          style={{
            width: isSidebarOpen ? 220 : 52,
            background: '#111111',
            borderColor: '#222222',
          }}
        >
          {/* 로고 */}
          <div
            className="flex items-center gap-3 px-4 py-5 border-b"
            style={{ borderColor: '#222222' }}
          >
            <div
              className="w-7 h-7 rounded flex items-center justify-center flex-shrink-0"
              style={{ background: '#f0f0f0' }}
            >
              <Shield size={14} style={{ color: '#0d0d0d' }} />
            </div>
            {isSidebarOpen && (
              <span className="font-display font-bold text-sm tracking-wide" style={{ color: '#f0f0f0' }}>
                앞으로구름
              </span>
            )}
          </div>

          {/* MAIN TERMINAL 섹션 */}
          <nav className="flex-1 py-4 overflow-y-auto">
            {isSidebarOpen && (
              <div className="px-4 mb-2 dg-label">Main Terminal</div>
            )}
            <div className="space-y-0.5 px-2">
              {MAIN_NAV.map((item) => (
                <NavButton
                  key={item.id}
                  item={item}
                  active={currentPage === item.id}
                  collapsed={!isSidebarOpen}
                  onClick={() => setCurrentPage(item.id)}
                />
              ))}
            </div>

            <div className="mt-6">
              {isSidebarOpen && (
                <div className="px-4 mb-2 dg-label">System Utilities</div>
              )}
              <div className="space-y-0.5 px-2">
                {UTIL_NAV.map((item) => (
                  <NavButton
                    key={item.label}
                    item={item}
                    active={false}
                    collapsed={!isSidebarOpen}
                    onClick={() => setCurrentPage(item.id)}
                  />
                ))}
              </div>
            </div>
          </nav>

          {/* 하단: System Load */}
          {isSidebarOpen && (
            <div className="p-4 border-t" style={{ borderColor: '#222222' }}>
              <div
                className="rounded-card p-3"
                style={{ background: '#1a1a1a', border: '1px solid #2a2a2a' }}
              >
                <div className="dg-label mb-2">System Load</div>
                <div className="dg-progress-track mb-1.5">
                  <div
                    className="dg-progress-fill"
                    style={{ width: '42%', background: '#f0f0f0' }}
                  />
                </div>
                <div className="text-xs font-mono" style={{ color: '#888' }}>42% Latency</div>
              </div>
            </div>
          )}
        </aside>

        {/* ── 메인 콘텐츠 ── */}
        <main className="flex-1 overflow-auto" style={{ background: '#0d0d0d' }}>
          <PageRenderer currentPage={currentPage} />
        </main>
      </div>
    </div>
  );
}

// ── 상단 헤더 바 ────────────────────────────────────────────
function TopBar() {
  return (
    <header
      className="flex items-center gap-4 px-5 h-14 border-b shrink-0"
      style={{ background: '#111111', borderColor: '#222222' }}
    >
      {/* 검색 */}
      <div
        className="flex items-center gap-2 flex-1 max-w-sm rounded-card px-3 h-8"
        style={{ background: '#1a1a1a', border: '1px solid #2a2a2a' }}
      >
        <Search size={13} style={{ color: '#555' }} />
        <input
          type="text"
          placeholder="Scan System ID..."
          className="flex-1 bg-transparent text-xs outline-none font-mono placeholder:text-txt-muted"
          style={{ color: '#f0f0f0' }}
        />
      </div>

      <div className="ml-auto flex items-center gap-3">
        <ClusterSelector />
        <IconBtn><Bell size={15} /></IconBtn>
        <IconBtn><Grid3X3 size={15} /></IconBtn>
        <IconBtn><Settings size={15} /></IconBtn>
        {/* 아바타 */}
        <div
          className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold"
          style={{ background: '#2a2a2a', color: '#f0f0f0' }}
        >
          A
        </div>
      </div>
    </header>
  );
}

function IconBtn({ children }: { children: React.ReactNode }) {
  return (
    <button
      className="w-8 h-8 rounded-card flex items-center justify-center transition-colors"
      style={{ color: '#555', border: '1px solid #2a2a2a', background: 'transparent' }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLButtonElement).style.color = '#f0f0f0';
        (e.currentTarget as HTMLButtonElement).style.borderColor = '#3a3a3a';
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLButtonElement).style.color = '#555';
        (e.currentTarget as HTMLButtonElement).style.borderColor = '#2a2a2a';
      }}
    >
      {children}
    </button>
  );
}

function ClusterSelector() {
  const { selectedClusterId, setSelectedClusterId } = useDashboardStore();
  const { data: clusters } = useClusters();

  return (
    <select
      value={selectedClusterId ?? ''}
      onChange={(e) => setSelectedClusterId(e.target.value || null)}
      className="h-8 rounded-card text-xs font-mono px-3 pr-7 focus:outline-none"
      style={{
        background: '#1a1a1a',
        border: '1px solid #2a2a2a',
        color: '#888',
      }}
    >
      <option value="">All Clusters</option>
      {(clusters ?? []).map((c) => (
        <option key={c.cluster_id} value={c.cluster_id}>{c.cluster_name}</option>
      ))}
    </select>
  );
}

function NavButton({
  item, active, collapsed, onClick,
}: {
  item: { label: string; icon: React.ReactNode };
  active: boolean;
  collapsed: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      title={collapsed ? item.label : undefined}
      className="w-full flex items-center gap-3 px-3 py-2 rounded-card text-xs font-display font-medium transition-all"
      style={{
        background: active ? '#1f1f1f' : 'transparent',
        color: active ? '#f0f0f0' : '#555',
        border: active ? '1px solid #2a2a2a' : '1px solid transparent',
      }}
      onMouseEnter={(e) => {
        if (!active) (e.currentTarget as HTMLButtonElement).style.color = '#aaa';
      }}
      onMouseLeave={(e) => {
        if (!active) (e.currentTarget as HTMLButtonElement).style.color = '#555';
      }}
    >
      <span className="flex-shrink-0">{item.icon}</span>
      {!collapsed && <span className="truncate">{item.label}</span>}
    </button>
  );
}

function PageRenderer({ currentPage }: { currentPage: PageId }) {
  switch (currentPage) {
    case 'overview':        return <OverviewPage />;
    case 'attack-graph':    return <AttackGraphPage />;
    case 'recommendations': return <RecommendationsPage />;
    case 'evidence':        return <EvidencePage />;
    default:                return <OverviewPage />;
  }
}
