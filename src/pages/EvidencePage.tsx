// ============================================================
// src/pages/EvidencePage.tsx
// 런타임 증거 — eBPF + CloudTrail 실제 공격 행위 로그
//
// 핵심 포인트:
// - eBPF는 "컨테이너 안에서 무슨 명령어 실행됐나"를 실시간 수집
// - CloudTrail은 "AWS API를 실제로 호출했나"를 S3 로그에서 수집
// - 둘을 결합하면 "IMDS에서 토큰 훔쳐서 → S3에서 파일 다운로드"
//   같은 완전한 공격 증거 구성 가능
// ============================================================
import { useState } from 'react';
import { Activity, Zap, Cloud, Clock, ChevronDown, ChevronRight } from 'lucide-react';
import { useAttackPaths, useEvidenceByPath } from '../api/hooks';
import { useDashboardStore } from '../store';
import type { EvidenceEvent, EvidenceType } from '../types';

const EVIDENCE_META: Record<EvidenceType, { label: string; color: string; icon: string }> = {
  imds_access:      { label: 'IMDS 접근',      color: 'text-red-400',    icon: '🔑' },
  sa_token_read:    { label: 'SA 토큰 탈취',   color: 'text-orange-400', icon: '🪪' },
  sensitive_file:   { label: '민감 파일 접근', color: 'text-yellow-400', icon: '📄' },
  suspicious_exec:  { label: '의심 프로세스',  color: 'text-purple-400', icon: '⚡' },
  external_connect: { label: '외부 연결',      color: 'text-blue-400',   icon: '🌐' },
  cloudtrail_api:   { label: 'CloudTrail API', color: 'text-cyan-400',   icon: '☁️' },
};

export function EvidencePage() {
  const { selectedClusterId } = useDashboardStore();
  const { data: attackPaths } = useAttackPaths(selectedClusterId ?? '');
  const [selectedPathId, setSelectedPathId] = useState<string | null>(null);

  // 증거가 있는 경로만 필터링
  const pathsWithEvidence = (attackPaths ?? []).filter((p) => p.has_runtime_evidence);

  const { data: evidence, isLoading: evidenceLoading } = useEvidenceByPath(selectedPathId);

  if (!selectedClusterId) {
    return <div className="flex items-center justify-center h-full text-slate-500 text-sm">클러스터를 선택하세요</div>;
  }

  return (
    <div className="flex h-full overflow-hidden">
      {/* ── 좌측: 증거 있는 경로 목록 ── */}
      <aside className="w-72 border-r border-slate-800 bg-slate-900 flex flex-col overflow-hidden">
        <div className="px-4 py-4 border-b border-slate-800">
          <h2 className="text-slate-200 font-semibold text-sm">
            런타임 증거 경로
          </h2>
          <p className="text-slate-500 text-xs mt-1">
            eBPF/CloudTrail 증거가 있는 공격 경로
          </p>
        </div>

        {pathsWithEvidence.length === 0 ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center text-slate-500 text-sm p-4">
              <Activity size={32} className="mx-auto mb-2 opacity-30" />
              런타임 증거 없음
              <div className="text-xs mt-1 text-slate-600">
                DG-Runtime이 설치된 경우 여기에 표시됩니다
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {pathsWithEvidence.map((path) => (
              <button
                key={path.id}
                onClick={() => setSelectedPathId(path.id)}
                className={`w-full text-left px-3 py-3 rounded-lg transition-colors ${
                  selectedPathId === path.id
                    ? 'bg-orange-500/10 border border-orange-500/30'
                    : 'hover:bg-slate-800 border border-transparent'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-mono font-bold text-red-400">
                    {path.risk_level.toUpperCase()}
                  </span>
                  <span className="flex items-center gap-1 text-xs text-orange-400">
                    <Zap size={10} /> {path.evidence_count}건
                  </span>
                </div>
                <div className="text-slate-400 text-xs font-mono truncate">
                  {path.path_nodes.map((n) => n.split(':').slice(-1)[0]).join(' → ')}
                </div>
              </button>
            ))}
          </div>
        )}
      </aside>

      {/* ── 우측: 증거 타임라인 ── */}
      <main className="flex-1 overflow-auto p-6">
        {!selectedPathId ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-slate-500">
            <Activity size={40} className="opacity-30" />
            <span className="text-sm">왼쪽에서 공격 경로를 선택하세요</span>
          </div>
        ) : evidenceLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <EvidenceTimeline events={evidence ?? []} />
        )}
      </main>
    </div>
  );
}

// ── 증거 타임라인 ─────────────────────────────────────────
function EvidenceTimeline({ events }: { events: EvidenceEvent[] }) {
  const sorted = [...events].sort(
    (a, b) => new Date(a.occurred_at).getTime() - new Date(b.occurred_at).getTime()
  );

  return (
    <div>
      <div className="flex items-center gap-2 mb-6">
        <h2 className="text-slate-200 font-semibold">공격 증거 타임라인</h2>
        <span className="text-xs text-slate-500 bg-slate-800 px-2 py-0.5 rounded-full">
          {events.length}건
        </span>
      </div>

      {/* 소스 구분 범례 */}
      <div className="flex gap-4 mb-6">
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <Zap size={12} className="text-orange-400" />
          <span>eBPF (컨테이너 내부 이벤트)</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <Cloud size={12} className="text-cyan-400" />
          <span>CloudTrail (AWS API 호출)</span>
        </div>
      </div>

      <div className="space-y-0">
        {sorted.map((event, index) => (
          <EvidenceEventRow
            key={event.id}
            event={event}
            isLast={index === sorted.length - 1}
          />
        ))}
      </div>
    </div>
  );
}

function EvidenceEventRow({
  event,
  isLast,
}: {
  event: EvidenceEvent;
  isLast: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const meta = EVIDENCE_META[event.evidence_type];

  return (
    <div className="flex gap-4">
      {/* 타임라인 선 */}
      <div className="flex flex-col items-center">
        <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-sm border ${
          event.source === 'ebpf'
            ? 'bg-orange-500/10 border-orange-500/30'
            : 'bg-cyan-500/10 border-cyan-500/30'
        }`}>
          {meta.icon}
        </div>
        {!isLast && <div className="w-px h-full bg-slate-800 my-1" />}
      </div>

      {/* 이벤트 카드 */}
      <div className="flex-1 pb-4">
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full text-left"
        >
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="flex items-center gap-2 mb-0.5">
                <span className={`text-xs font-bold font-mono ${meta.color}`}>
                  {meta.label}
                </span>
                <span className={`text-xs px-1.5 py-0.5 rounded font-mono ${
                  event.source === 'ebpf'
                    ? 'bg-orange-500/10 text-orange-400'
                    : 'bg-cyan-500/10 text-cyan-400'
                }`}>
                  {event.source === 'ebpf' ? 'eBPF' : 'CloudTrail'}
                </span>
              </div>
              <p className="text-slate-300 text-sm">{event.description}</p>
              <div className="flex items-center gap-1 mt-1 text-xs text-slate-500">
                <Clock size={10} />
                {new Date(event.occurred_at).toLocaleString('ko-KR')}
              </div>
            </div>
            {expanded ? <ChevronDown size={14} className="text-slate-500 mt-1 flex-shrink-0" /> : <ChevronRight size={14} className="text-slate-500 mt-1 flex-shrink-0" />}
          </div>
        </button>

        {/* 원시 데이터 */}
        {expanded && (
          <pre className="mt-2 text-xs text-slate-400 bg-slate-950 border border-slate-800 rounded-lg p-3 overflow-x-auto font-mono">
            {JSON.stringify(event.raw_data, null, 2)}
          </pre>
        )}
      </div>
    </div>
  );
}
