// src/pages/AttackGraphPage.tsx — 리디자인
import { AlertTriangle, Zap, ArrowLeftRight, LayoutTemplate } from 'lucide-react';
import { useAttackGraph, useAttackPaths } from '../api/hooks';
import { AttackGraph } from '../components/graph/AttackGraph';
import { useDashboardStore } from '../store';
import type { AttackPath, RiskLevel } from '../types';

const RISK_STYLE: Record<RiskLevel, { label: string; color: string }> = {
  critical: { label: 'CRITICAL', color: '#f87171' },
  high:     { label: 'HIGH',     color: '#fbbf24' },
  medium:   { label: 'MEDIUM',   color: '#888' },
  low:      { label: 'LOW',      color: '#555' },
};

export function AttackGraphPage() {
  const { selectedClusterId, selectedAttackPath, setSelectedAttackPath, riskFilter, setRiskFilter, graphLayout, setGraphLayout } = useDashboardStore();
  const { data: graphData, isLoading } = useAttackGraph(selectedClusterId ?? '');
  const { data: attackPaths } = useAttackPaths(selectedClusterId ?? '');

  const filtered = (attackPaths ?? []).filter(
    (p) => riskFilter === 'all' || p.risk_level === riskFilter
  );

  if (!selectedClusterId) {
    return <EmptyMsg msg="상단 클러스터 선택기에서 클러스터를 선택하세요" />;
  }
  if (isLoading) {
    return <LoadingSpinner msg="Attack graph loading..." />;
  }

  return (
    <div className="flex h-full overflow-hidden">
      <div className="flex-1 flex flex-col">
        {/* 툴바 */}
        <div className="flex items-center gap-3 px-4 h-11 border-b shrink-0" style={{ borderColor: '#222', background: '#111' }}>
          <span className="dg-label">Layout:</span>
          {(['LR', 'TB'] as const).map((l) => (
            <button
              key={l}
              onClick={() => setGraphLayout(l)}
              className="flex items-center gap-1 px-2.5 py-1 rounded text-xs font-mono transition-colors"
              style={{
                background: graphLayout === l ? '#1f1f1f' : 'transparent',
                border: `1px solid ${graphLayout === l ? '#3a3a3a' : 'transparent'}`,
                color: graphLayout === l ? '#f0f0f0' : '#555',
              }}
            >
              {l === 'LR' ? <ArrowLeftRight size={11} /> : <LayoutTemplate size={11} />}
              {l}
            </button>
          ))}
          <div className="ml-auto flex items-center gap-4 dg-label">
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm border-2 border-dashed" style={{ borderColor: '#4ade80' }} /> Entry Point
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm border-2" style={{ borderColor: '#f87171' }} /> Crown Jewel
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-4 h-0.5" style={{ background: '#f87171' }} /> escapes_to
            </span>
          </div>
        </div>
        <div className="flex-1 cy-container">
          {graphData ? <AttackGraph graphData={graphData} /> : <EmptyMsg msg="그래프 데이터 없음" />}
        </div>
      </div>

      {/* 경로 목록 */}
      <aside className="w-72 border-l flex flex-col overflow-hidden" style={{ borderColor: '#222', background: '#111' }}>
        <div className="px-4 py-3 border-b" style={{ borderColor: '#222' }}>
          <div className="flex items-center justify-between mb-3">
            <span className="font-display font-bold text-sm uppercase tracking-wider" style={{ color: '#f0f0f0' }}>
              Attack Paths
            </span>
            <span className="dg-label">{filtered.length} paths</span>
          </div>
          <div className="flex gap-1">
            {(['all', 'critical', 'high', 'medium', 'low'] as const).map((l) => (
              <button
                key={l}
                onClick={() => setRiskFilter(l)}
                className="px-2 py-1 rounded text-2xs font-mono uppercase tracking-wider transition-colors"
                style={{
                  background: riskFilter === l ? '#1f1f1f' : 'transparent',
                  border: `1px solid ${riskFilter === l ? '#3a3a3a' : 'transparent'}`,
                  color: riskFilter === l ? '#f0f0f0' : '#555',
                }}
              >
                {l === 'all' ? 'ALL' : l.slice(0, 3).toUpperCase()}
              </button>
            ))}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
          {filtered.map((path) => (
            <PathCard
              key={path.id}
              path={path}
              selected={selectedAttackPath?.id === path.id}
              onClick={() => setSelectedAttackPath(selectedAttackPath?.id === path.id ? null : path)}
            />
          ))}
        </div>
      </aside>
    </div>
  );
}

function PathCard({ path, selected, onClick }: { path: AttackPath; selected: boolean; onClick: () => void }) {
  const s = RISK_STYLE[path.risk_level];
  return (
    <button
      onClick={onClick}
      className="w-full text-left p-3 rounded-card transition-all"
      style={{
        background: selected ? '#1a1a1a' : '#141414',
        border: `1px solid ${selected ? '#fbbf24' : '#222'}`,
      }}
    >
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-2xs font-mono font-bold uppercase tracking-wider" style={{ color: s.color }}>{s.label}</span>
        <div className="flex items-center gap-2">
          {path.has_runtime_evidence && (
            <span className="text-2xs font-mono flex items-center gap-1" style={{ color: '#fb923c' }}>
              <Zap size={9} /> {path.evidence_count}
            </span>
          )}
          <span className="text-2xs font-mono font-bold" style={{ color: s.color }}>
            {Math.round(path.final_risk * 100)}%
          </span>
        </div>
      </div>
      <div className="text-2xs font-mono truncate mb-1.5" style={{ color: '#555' }}>
        {path.path_nodes.map((n) => n.split(':').pop()).join(' → ')}
      </div>
      <div className="flex items-center gap-1 text-2xs font-mono" style={{ color: '#444' }}>
        <AlertTriangle size={9} /> {path.hop_count} hops
      </div>
    </button>
  );
}

function EmptyMsg({ msg }: { msg: string }) {
  return (
    <div className="flex items-center justify-center h-full text-xs font-mono" style={{ color: '#444' }}>{msg}</div>
  );
}
function LoadingSpinner({ msg }: { msg: string }) {
  return (
    <div className="flex items-center justify-center h-full gap-3">
      <div className="w-4 h-4 rounded-full border-2 animate-spin" style={{ borderColor: '#2a2a2a', borderTopColor: '#f0f0f0' }} />
      <span className="text-xs font-mono" style={{ color: '#555' }}>{msg}</span>
    </div>
  );
}
