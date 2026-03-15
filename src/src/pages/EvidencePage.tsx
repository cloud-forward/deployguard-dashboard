// src/pages/EvidencePage.tsx — 리디자인
import { useState } from 'react';
import { Zap, Cloud, Clock, ChevronDown, ChevronRight, Activity } from 'lucide-react';
import { useAttackPaths, useEvidenceByPath } from '../api/hooks';
import { useDashboardStore } from '../store';
import type { EvidenceEvent, EvidenceType } from '../types';

const EV_META: Record<EvidenceType, { label: string; icon: string }> = {
  imds_access:      { label: 'IMDS ACCESS',      icon: '🔑' },
  sa_token_read:    { label: 'SA TOKEN READ',    icon: '🪪' },
  sensitive_file:   { label: 'SENSITIVE FILE',   icon: '📄' },
  suspicious_exec:  { label: 'SUSPICIOUS EXEC',  icon: '⚡' },
  external_connect: { label: 'EXTERNAL CONNECT', icon: '🌐' },
  cloudtrail_api:   { label: 'CLOUDTRAIL API',   icon: '☁️' },
};

export function EvidencePage() {
  const { selectedClusterId } = useDashboardStore();
  const { data: paths } = useAttackPaths(selectedClusterId ?? '');
  const [selPathId, setSelPathId] = useState<string | null>(null);
  const { data: evidence, isLoading } = useEvidenceByPath(selPathId);

  const evidencePaths = (paths ?? []).filter((p) => p.has_runtime_evidence);

  return (
    <div className="flex h-full overflow-hidden">
      {/* 왼쪽 경로 목록 */}
      <aside className="w-72 border-r flex flex-col overflow-hidden" style={{ borderColor: '#222', background: '#111' }}>
        <div className="px-4 py-4 border-b" style={{ borderColor: '#222' }}>
          <div className="font-display font-bold text-sm uppercase tracking-wider mb-1" style={{ color: '#f0f0f0' }}>
            Encrypted Logs
          </div>
          <div className="dg-label">Runtime evidence streams</div>
        </div>
        {evidencePaths.length === 0 ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <Activity size={28} style={{ color: '#2a2a2a', margin: '0 auto 8px' }} />
              <div className="text-xs font-mono" style={{ color: '#444' }}>No runtime evidence</div>
              <div className="text-2xs font-mono mt-1" style={{ color: '#333' }}>DG-Runtime required</div>
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {evidencePaths.map((p) => (
              <button
                key={p.id}
                onClick={() => setSelPathId(p.id)}
                className="w-full text-left p-3 rounded-card transition-all"
                style={{
                  background: selPathId === p.id ? '#1a1a1a' : '#141414',
                  border: `1px solid ${selPathId === p.id ? '#fb923c44' : '#222'}`,
                }}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-2xs font-mono font-bold uppercase" style={{ color: '#f87171' }}>
                    {p.risk_level}
                  </span>
                  <span className="text-2xs font-mono flex items-center gap-1" style={{ color: '#fb923c' }}>
                    <Zap size={9} /> {p.evidence_count}
                  </span>
                </div>
                <div className="text-2xs font-mono truncate" style={{ color: '#555' }}>
                  {p.path_nodes.map((n) => n.split(':').pop()).join(' → ')}
                </div>
              </button>
            ))}
          </div>
        )}
      </aside>

      {/* 오른쪽 타임라인 */}
      <main className="flex-1 overflow-auto p-6" style={{ background: '#0d0d0d' }}>
        {!selPathId ? (
          <div className="flex flex-col items-center justify-center h-full gap-3" style={{ color: '#333' }}>
            <Activity size={36} />
            <span className="text-xs font-mono">Select an attack path to view evidence</span>
          </div>
        ) : isLoading ? (
          <div className="flex items-center justify-center h-full gap-3">
            <div className="w-4 h-4 rounded-full border-2 animate-spin" style={{ borderColor: '#2a2a2a', borderTopColor: '#f0f0f0' }} />
          </div>
        ) : (
          <>
            <div className="flex items-center gap-3 mb-6">
              <h2 className="font-display font-bold text-xl uppercase tracking-wider" style={{ color: '#f0f0f0' }}>
                Evidence Timeline
              </h2>
              <span className="dg-label px-2 py-1 rounded-card" style={{ background: '#1a1a1a', border: '1px solid #2a2a2a' }}>
                {evidence?.length ?? 0} events
              </span>
              <div className="ml-auto flex items-center gap-4 dg-label">
                <span className="flex items-center gap-1.5"><Zap size={10} style={{ color: '#fb923c' }} /> eBPF</span>
                <span className="flex items-center gap-1.5"><Cloud size={10} style={{ color: '#888' }} /> CloudTrail</span>
              </div>
            </div>
            <div className="space-y-0">
              {[...(evidence ?? [])].sort((a, b) =>
                new Date(a.occurred_at).getTime() - new Date(b.occurred_at).getTime()
              ).map((ev, i, arr) => (
                <EvidenceRow key={ev.id} ev={ev} isLast={i === arr.length - 1} />
              ))}
            </div>
          </>
        )}
      </main>
    </div>
  );
}

function EvidenceRow({ ev, isLast }: { ev: EvidenceEvent; isLast: boolean }) {
  const [open, setOpen] = useState(false);
  const meta = EV_META[ev.evidence_type];
  const isEbpf = ev.source === 'ebpf';

  return (
    <div className="flex gap-4">
      {/* 타임라인 선 */}
      <div className="flex flex-col items-center">
        <div className="w-8 h-8 rounded-card flex items-center justify-center shrink-0 text-sm"
          style={{
            background: isEbpf ? '#fb923c11' : '#88888811',
            border: `1px solid ${isEbpf ? '#fb923c33' : '#33333'}`,
          }}>
          {meta.icon}
        </div>
        {!isLast && <div className="w-px flex-1 my-1" style={{ background: '#1f1f1f' }} />}
      </div>

      {/* 카드 */}
      <div className="flex-1 pb-4">
        <button onClick={() => setOpen(!open)} className="w-full text-left">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-2xs font-mono font-bold uppercase tracking-wider"
                  style={{ color: isEbpf ? '#fb923c' : '#888' }}>
                  {meta.label}
                </span>
                <span className="text-2xs font-mono px-1.5 py-0.5 rounded"
                  style={{
                    background: isEbpf ? '#fb923c11' : '#88888811',
                    color: isEbpf ? '#fb923c' : '#888',
                    border: `1px solid ${isEbpf ? '#fb923c22' : '#33333'}`,
                  }}>
                  {isEbpf ? 'eBPF' : 'CloudTrail'}
                </span>
              </div>
              <p className="text-xs font-mono" style={{ color: '#888' }}>{ev.description}</p>
              <div className="flex items-center gap-1 mt-1 text-2xs font-mono" style={{ color: '#444' }}>
                <Clock size={9} /> {new Date(ev.occurred_at).toLocaleString('ko-KR')}
              </div>
            </div>
            {open ? <ChevronDown size={13} style={{ color: '#444', flexShrink: 0, marginTop: 2 }} />
                  : <ChevronRight size={13} style={{ color: '#444', flexShrink: 0, marginTop: 2 }} />}
          </div>
        </button>
        {open && (
          <pre className="mt-2 text-2xs font-mono p-3 rounded-card overflow-x-auto leading-relaxed"
            style={{ background: '#0a0a0a', border: '1px solid #1f1f1f', color: '#555' }}>
            {JSON.stringify(ev.raw_data, null, 2)}
          </pre>
        )}
      </div>
    </div>
  );
}
