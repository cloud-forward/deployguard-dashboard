// ============================================================
// src/pages/AttackGraphPage.tsx
// 공격 경로 시각화 메인 페이지
//
// 레이아웃:
// ┌────────────────────────────┬──────────────────┐
// │  Cytoscape.js 공격 그래프  │  공격 경로 목록  │
// │  (클릭 → 경로 하이라이트)  │  (위험도 순 정렬)│
// └────────────────────────────┴──────────────────┘
// ============================================================
import { useState } from 'react';
import { AlertTriangle, Zap, LayoutTemplate, ArrowLeftRight } from 'lucide-react';
import { useAttackGraph, useAttackPaths } from '../api/hooks';
import { AttackGraph } from '../components/graph/AttackGraph';
import { useDashboardStore } from '../store';
import type { AttackPath, RiskLevel } from '../types';

const RISK_META: Record<RiskLevel, { label: string; color: string; bg: string }> = {
  critical: { label: 'CRITICAL', color: 'text-red-400',    bg: 'bg-red-500/10 border-red-500/20' },
  high:     { label: 'HIGH',     color: 'text-yellow-400', bg: 'bg-yellow-500/10 border-yellow-500/20' },
  medium:   { label: 'MEDIUM',   color: 'text-blue-400',   bg: 'bg-blue-500/10 border-blue-500/20' },
  low:      { label: 'LOW',      color: 'text-green-400',  bg: 'bg-green-500/10 border-green-500/20' },
};

export function AttackGraphPage() {
  const {
    selectedClusterId,
    selectedAttackPath,
    setSelectedAttackPath,
    riskFilter,
    setRiskFilter,
    graphLayout,
    setGraphLayout,
  } = useDashboardStore();

  const { data: graphData, isLoading: graphLoading } = useAttackGraph(selectedClusterId ?? '');
  const { data: attackPaths } = useAttackPaths(selectedClusterId ?? '');

  // 필터링된 공격 경로
  const filteredPaths = (attackPaths ?? []).filter(
    (p) => riskFilter === 'all' || p.risk_level === riskFilter
  );

  if (!selectedClusterId) {
    return (
      <EmptyState message="왼쪽 사이드바에서 클러스터를 선택하세요" />
    );
  }

  if (graphLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center space-y-3">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-slate-400 text-sm">공격 그래프 로딩 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full overflow-hidden">
      {/* ── 그래프 영역 ── */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* 툴바 */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-800 bg-slate-900">
          <span className="text-slate-400 text-sm">레이아웃:</span>
          <button
            onClick={() => setGraphLayout('LR')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs transition-colors ${
              graphLayout === 'LR'
                ? 'bg-blue-600 text-white'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            <ArrowLeftRight size={13} /> 좌→우
          </button>
          <button
            onClick={() => setGraphLayout('TB')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs transition-colors ${
              graphLayout === 'TB'
                ? 'bg-blue-600 text-white'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            <LayoutTemplate size={13} /> 위→아래
          </button>

          <div className="ml-auto flex items-center gap-4 text-xs text-slate-500">
            <LegendItem color="border-green-500 border-dashed" label="Entry Point (공격 시작)" />
            <LegendItem color="border-red-500 border-double" label="Crown Jewel (공격 목표)" />
            <LegendItem color="bg-red-500" label="escapes_to" />
            <LegendItem color="bg-yellow-500" label="lateral_move" />
          </div>
        </div>

        {/* Cytoscape 캔버스 */}
        <div className="flex-1 cy-container">
          {graphData ? (
            <AttackGraph graphData={graphData} />
          ) : (
            <EmptyState message="그래프 데이터가 없습니다" />
          )}
        </div>
      </div>

      {/* ── 공격 경로 목록 패널 ── */}
      <aside className="w-80 border-l border-slate-800 bg-slate-900 flex flex-col overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-800">
          <h2 className="text-slate-200 font-semibold text-sm mb-3">
            공격 경로 목록
            <span className="ml-2 text-xs text-slate-500 font-normal">
              ({filteredPaths.length}개)
            </span>
          </h2>

          {/* 위험도 필터 탭 */}
          <div className="flex gap-1">
            {(['all', 'critical', 'high', 'medium', 'low'] as const).map((level) => (
              <button
                key={level}
                onClick={() => setRiskFilter(level)}
                className={`px-2 py-1 rounded text-xs transition-colors ${
                  riskFilter === level
                    ? 'bg-slate-700 text-slate-100'
                    : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                {level === 'all' ? '전체' : level.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        {/* 경로 카드 목록 */}
        <div className="flex-1 overflow-y-auto p-2 space-y-2">
          {filteredPaths.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-slate-500 text-sm">
              해당하는 공격 경로가 없습니다
            </div>
          ) : (
            filteredPaths.map((path) => (
              <AttackPathCard
                key={path.id}
                path={path}
                isSelected={selectedAttackPath?.id === path.id}
                onClick={() =>
                  setSelectedAttackPath(
                    selectedAttackPath?.id === path.id ? null : path
                  )
                }
              />
            ))
          )}
        </div>
      </aside>
    </div>
  );
}

// ── 공격 경로 카드 ────────────────────────────────────────
function AttackPathCard({
  path,
  isSelected,
  onClick,
}: {
  path: AttackPath;
  isSelected: boolean;
  onClick: () => void;
}) {
  const meta = RISK_META[path.risk_level];

  return (
    <button
      onClick={onClick}
      className={`w-full text-left p-3 rounded-lg border transition-all ${
        isSelected
          ? 'border-yellow-500/50 bg-yellow-500/5'
          : `border ${meta.bg} hover:border-opacity-60`
      }`}
    >
      {/* 헤더: 위험도 배지 + 증거 아이콘 */}
      <div className="flex items-center justify-between mb-2">
        <span className={`text-xs font-bold font-mono ${meta.color}`}>
          {meta.label}
        </span>
        <div className="flex items-center gap-2">
          {path.has_runtime_evidence && (
            <span className="flex items-center gap-1 text-xs text-orange-400">
              <Zap size={11} /> 증거 {path.evidence_count}
            </span>
          )}
          <span className={`text-xs font-mono font-bold ${meta.color}`}>
            {Math.round(path.final_risk * 100)}%
          </span>
        </div>
      </div>

      {/* 경로 표시 (노드 ID 축약) */}
      <div className="text-slate-400 text-xs font-mono leading-relaxed mb-2 truncate">
        {path.path_nodes.map((n) => n.split(':').slice(-1)[0]).join(' → ')}
      </div>

      {/* 풋터: 홉 수 */}
      <div className="flex items-center gap-1 text-slate-500 text-xs">
        <AlertTriangle size={10} />
        <span>{path.hop_count}단계 경로</span>
      </div>
    </button>
  );
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <div className={`w-4 h-4 rounded border-2 ${color}`} />
      <span>{label}</span>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex items-center justify-center h-full text-slate-500 text-sm">
      {message}
    </div>
  );
}
