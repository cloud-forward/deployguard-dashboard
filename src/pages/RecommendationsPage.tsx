// ============================================================
// src/pages/RecommendationsPage.tsx
// Set Cover 최적화 결과 — "최소 수정으로 최대 위험 제거"
//
// 핵심 UX:
// 1. "지금 이것만 고치면 됩니다" 상위 카드 강조
// 2. 수정 코드 스니펫 (YAML 패치) 표시
// 3. "적용하기" 버튼 → useApplyRecommendation 뮤테이션
// ============================================================
import { useState } from 'react';
import { CheckCircle, ChevronDown, ChevronRight, Code, Shield, TrendingDown } from 'lucide-react';
import { useRecommendations, useApplyRecommendation } from '../api/hooks';
import { useDashboardStore } from '../store';
import type { Recommendation, RemediationType } from '../types';

const TYPE_META: Record<RemediationType, { label: string; color: string }> = {
  rbac_reduce:      { label: 'RBAC 축소',     color: 'text-purple-400' },
  image_patch:      { label: '이미지 패치',   color: 'text-blue-400' },
  network_policy:   { label: 'NetworkPolicy', color: 'text-cyan-400' },
  irsa_scope:       { label: 'IRSA 범위 축소', color: 'text-yellow-400' },
  s3_policy:        { label: 'S3 정책 강화',  color: 'text-green-400' },
  security_context: { label: 'SecurityContext', color: 'text-orange-400' },
};

const EFFORT_META = {
  low:    { label: '쉬움',   color: 'text-green-400' },
  medium: { label: '보통',   color: 'text-yellow-400' },
  high:   { label: '어려움', color: 'text-red-400' },
};

export function RecommendationsPage() {
  const { selectedClusterId } = useDashboardStore();
  const { data: recommendations, isLoading } = useRecommendations(selectedClusterId ?? '');
  const applyMutation = useApplyRecommendation();

  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (!selectedClusterId) {
    return <div className="flex items-center justify-center h-full text-slate-500 text-sm">클러스터를 선택하세요</div>;
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const sorted = (recommendations ?? []).sort((a, b) => b.priority_score - a.priority_score);
  const totalRiskReduction = sorted.reduce((sum, r) => sum + r.risk_reduction, 0) / Math.max(sorted.length, 1);
  const totalPathsBlocked = sorted.reduce((sum, r) => sum + r.paths_blocked, 0);

  return (
    <div className="p-6 space-y-6 max-w-5xl">
      {/* 타이틀 + 요약 */}
      <div>
        <h1 className="text-2xl font-bold text-slate-100">권고사항</h1>
        <p className="text-slate-400 text-sm mt-1">
          Set Cover 알고리즘이 계산한 최소 수정 세트입니다 — 아래 항목을 순서대로 적용하면 최대 효과를 얻습니다
        </p>
      </div>

      {/* 효과 요약 배너 */}
      <div className="grid grid-cols-3 gap-4">
        <SummaryCard
          icon={<Shield size={18} className="text-blue-400" />}
          label="총 권고 수"
          value={`${sorted.length}개`}
        />
        <SummaryCard
          icon={<TrendingDown size={18} className="text-green-400" />}
          label="예상 위험 감소"
          value={`${Math.round(totalRiskReduction * 100)}%`}
          highlight
        />
        <SummaryCard
          icon={<CheckCircle size={18} className="text-yellow-400" />}
          label="차단 가능 공격 경로"
          value={`${totalPathsBlocked}개`}
        />
      </div>

      {/* 권고사항 카드 목록 */}
      <div className="space-y-3">
        {sorted.map((rec, index) => (
          <RecommendationCard
            key={rec.id}
            rec={rec}
            rank={index + 1}
            isExpanded={expandedId === rec.id}
            onToggle={() => setExpandedId(expandedId === rec.id ? null : rec.id)}
            onApply={() => applyMutation.mutate({ clusterId: selectedClusterId, recommendationId: rec.id })}
            isApplying={applyMutation.isPending && applyMutation.variables?.recommendationId === rec.id}
          />
        ))}
      </div>
    </div>
  );
}

// ── 권고사항 카드 컴포넌트 ─────────────────────────────────
function RecommendationCard({
  rec, rank, isExpanded, onToggle, onApply, isApplying,
}: {
  rec: Recommendation;
  rank: number;
  isExpanded: boolean;
  onToggle: () => void;
  onApply: () => void;
  isApplying: boolean;
}) {
  const typeMeta = TYPE_META[rec.remediation_type];
  const effortMeta = EFFORT_META[rec.effort];

  return (
    <div className={`border rounded-xl overflow-hidden transition-colors ${
      rec.is_applied
        ? 'border-green-500/20 bg-green-500/5'
        : 'border-slate-700 bg-slate-900 hover:border-slate-600'
    }`}>
      {/* 카드 헤더 */}
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-4 px-5 py-4 text-left"
      >
        {/* 순위 배지 */}
        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
          rank <= 3 ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400'
        }`}>
          {rank}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={`text-xs font-mono font-bold ${typeMeta.color}`}>
              {typeMeta.label}
            </span>
            {rec.is_applied && (
              <span className="text-xs text-green-400 flex items-center gap-1">
                <CheckCircle size={11} /> 적용됨
              </span>
            )}
          </div>
          <div className="text-slate-200 text-sm font-medium truncate">{rec.title}</div>
        </div>

        {/* 메트릭 */}
        <div className="flex items-center gap-6 text-xs flex-shrink-0 mr-2">
          <div className="text-center">
            <div className="text-slate-100 font-bold font-mono">
              {Math.round(rec.risk_reduction * 100)}%
            </div>
            <div className="text-slate-500">위험 감소</div>
          </div>
          <div className="text-center">
            <div className="text-slate-100 font-bold font-mono">{rec.paths_blocked}</div>
            <div className="text-slate-500">경로 차단</div>
          </div>
          <div className="text-center">
            <div className={`font-bold ${effortMeta.color}`}>{effortMeta.label}</div>
            <div className="text-slate-500">난이도</div>
          </div>
        </div>

        {isExpanded ? (
          <ChevronDown size={16} className="text-slate-400 flex-shrink-0" />
        ) : (
          <ChevronRight size={16} className="text-slate-400 flex-shrink-0" />
        )}
      </button>

      {/* 확장 영역 */}
      {isExpanded && (
        <div className="px-5 pb-5 space-y-4 border-t border-slate-800">
          <p className="text-slate-400 text-sm pt-4">{rec.description}</p>

          {/* 영향 받는 자산 */}
          <div>
            <div className="text-slate-500 text-xs mb-2">영향 자산</div>
            <div className="flex flex-wrap gap-1.5">
              {rec.affected_asset_ids.slice(0, 6).map((id) => (
                <span
                  key={id}
                  className="text-xs font-mono bg-slate-800 text-slate-300 px-2 py-0.5 rounded border border-slate-700"
                >
                  {id.split(':').slice(-1)[0]}
                </span>
              ))}
              {rec.affected_asset_ids.length > 6 && (
                <span className="text-xs text-slate-500">
                  +{rec.affected_asset_ids.length - 6}개 더
                </span>
              )}
            </div>
          </div>

          {/* 코드 스니펫 */}
          {rec.code_snippet && (
            <div>
              <div className="flex items-center gap-1.5 text-slate-500 text-xs mb-2">
                <Code size={12} /> 수정 방법 (YAML/Policy)
              </div>
              <pre className="text-xs text-slate-300 bg-slate-950 border border-slate-700 rounded-lg p-4 overflow-x-auto font-mono leading-relaxed">
                {rec.code_snippet}
              </pre>
            </div>
          )}

          {/* 적용 버튼 */}
          {!rec.is_applied && (
            <button
              onClick={onApply}
              disabled={isApplying}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm rounded-lg transition-colors font-medium"
            >
              {isApplying ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  적용 중...
                </>
              ) : (
                <>
                  <CheckCircle size={15} /> 적용 완료로 표시
                </>
              )}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function SummaryCard({
  icon, label, value, highlight,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className={`border rounded-xl p-4 flex items-center gap-4 ${
      highlight ? 'border-green-500/30 bg-green-500/5' : 'border-slate-700 bg-slate-900'
    }`}>
      {icon}
      <div>
        <div className="text-xl font-bold text-slate-100 font-mono">{value}</div>
        <div className="text-slate-400 text-xs">{label}</div>
      </div>
    </div>
  );
}
