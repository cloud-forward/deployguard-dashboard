// src/pages/RecommendationsPage.tsx — 리디자인
import { useState } from 'react';
import { CheckCircle, ChevronDown, ChevronRight, TrendingDown, Shield } from 'lucide-react';
import { useRecommendations, useApplyRecommendation } from '../api/hooks';
import { useDashboardStore } from '../store';
import type { Recommendation, RemediationType } from '../types';

const TYPE_LABEL: Record<RemediationType, string> = {
  rbac_reduce: 'RBAC', image_patch: 'IMAGE', network_policy: 'NETPOL',
  irsa_scope: 'IRSA', s3_policy: 'S3', security_context: 'SECCTX',
};
const EFFORT_LABEL = { low: 'EASY', medium: 'MEDIUM', high: 'HARD' };

export function RecommendationsPage() {
  const { selectedClusterId } = useDashboardStore();
  const { data: recs, isLoading } = useRecommendations(selectedClusterId ?? '');
  const applyMutation = useApplyRecommendation();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (!selectedClusterId) return <Empty msg="클러스터를 선택하세요" />;
  if (isLoading) return <Loading />;

  const sorted = [...(recs ?? [])].sort((a, b) => b.priority_score - a.priority_score);
  const totalReduction = sorted.reduce((s, r) => s + r.risk_reduction, 0) / Math.max(sorted.length, 1);

  return (
    <div className="p-6 space-y-5 max-w-4xl" style={{ background: '#0d0d0d' }}>
      <div>
        <h1 className="font-display font-bold text-3xl tracking-tight uppercase" style={{ color: '#f0f0f0' }}>
          Remediation <span style={{ color: '#555' }}>Intelligence</span>
        </h1>
        <p className="text-xs font-mono mt-1" style={{ color: '#555' }}>
          Set Cover optimization — minimum patches, maximum risk reduction
        </p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total Advisories', value: `${sorted.length}`, icon: <Shield size={16} style={{ color: '#555' }} /> },
          { label: 'Risk Reduction', value: `${Math.round(totalReduction * 100)}%`, icon: <TrendingDown size={16} style={{ color: '#4ade80' }} /> },
          { label: 'Paths Blocked', value: `${sorted.reduce((s, r) => s + r.paths_blocked, 0)}`, icon: <CheckCircle size={16} style={{ color: '#888' }} /> },
        ].map((c) => (
          <div key={c.label} className="dg-card p-4 flex items-center gap-4">
            {c.icon}
            <div>
              <div className="font-display font-bold text-2xl leading-none" style={{ color: '#f0f0f0' }}>{c.value}</div>
              <div className="dg-label mt-1">{c.label}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="space-y-2">
        {sorted.map((rec, i) => (
          <RecCard
            key={rec.id} rec={rec} rank={i + 1}
            expanded={expandedId === rec.id}
            onToggle={() => setExpandedId(expandedId === rec.id ? null : rec.id)}
            onApply={() => applyMutation.mutate({ clusterId: selectedClusterId, recommendationId: rec.id })}
            applying={applyMutation.isPending && applyMutation.variables?.recommendationId === rec.id}
          />
        ))}
      </div>
    </div>
  );
}

function RecCard({ rec, rank, expanded, onToggle, onApply, applying }:
  { rec: Recommendation; rank: number; expanded: boolean; onToggle: () => void; onApply: () => void; applying: boolean }) {
  return (
    <div className="dg-card overflow-hidden" style={{ opacity: rec.is_applied ? 0.5 : 1 }}>
      <button onClick={onToggle} className="w-full flex items-center gap-4 px-5 py-4 text-left">
        <div className="w-7 h-7 rounded flex items-center justify-center text-xs font-mono font-bold shrink-0"
          style={{ background: rank <= 3 ? '#f0f0f0' : '#1f1f1f', color: rank <= 3 ? '#0d0d0d' : '#555', border: '1px solid #2a2a2a' }}>
          {rank}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="dg-label text-txt-secondary">{TYPE_LABEL[rec.remediation_type]}</span>
            {rec.is_applied && <span className="dg-label" style={{ color: '#4ade80' }}>✓ APPLIED</span>}
          </div>
          <div className="text-sm font-display font-semibold truncate" style={{ color: '#f0f0f0' }}>{rec.title}</div>
        </div>
        <div className="flex items-center gap-6 shrink-0">
          <div className="text-center">
            <div className="font-mono font-bold text-sm" style={{ color: '#f0f0f0' }}>{Math.round(rec.risk_reduction * 100)}%</div>
            <div className="dg-label">reduction</div>
          </div>
          <div className="text-center">
            <div className="font-mono font-bold text-sm" style={{ color: '#f0f0f0' }}>{rec.paths_blocked}</div>
            <div className="dg-label">blocked</div>
          </div>
          <div className="dg-label">{EFFORT_LABEL[rec.effort]}</div>
        </div>
        {expanded ? <ChevronDown size={14} style={{ color: '#555', flexShrink: 0 }} /> : <ChevronRight size={14} style={{ color: '#555', flexShrink: 0 }} />}
      </button>

      {expanded && (
        <div className="px-5 pb-5 space-y-4 border-t" style={{ borderColor: '#222' }}>
          <p className="text-xs font-mono pt-4" style={{ color: '#888' }}>{rec.description}</p>
          {rec.code_snippet && (
            <pre className="text-xs font-mono p-4 rounded-card overflow-x-auto leading-relaxed"
              style={{ background: '#0d0d0d', border: '1px solid #222', color: '#888' }}>
              {rec.code_snippet}
            </pre>
          )}
          {!rec.is_applied && (
            <button
              onClick={onApply}
              disabled={applying}
              className="dg-btn-primary text-xs"
            >
              {applying ? '...' : <><CheckCircle size={12} /> Mark as Applied</>}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function Empty({ msg }: { msg: string }) {
  return <div className="flex items-center justify-center h-full text-xs font-mono" style={{ color: '#444' }}>{msg}</div>;
}
function Loading() {
  return (
    <div className="flex items-center justify-center h-full gap-3">
      <div className="w-4 h-4 rounded-full border-2 animate-spin" style={{ borderColor: '#2a2a2a', borderTopColor: '#f0f0f0' }} />
      <span className="text-xs font-mono" style={{ color: '#555' }}>Loading...</span>
    </div>
  );
}
