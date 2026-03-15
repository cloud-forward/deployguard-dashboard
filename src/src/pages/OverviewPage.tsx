// ============================================================
// src/pages/OverviewPage.tsx — 이미지 기준 리디자인
// "OPERATIONAL INTELLIGENCE" 스타일
// ============================================================
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from 'recharts';
import {
  AlertTriangle, RefreshCw, Download, MoreHorizontal, ShieldCheck,
} from 'lucide-react';
import { useDashboardOverview } from '../api/hooks';
import type { AttackPath } from '../types';

// ── 더미 이상 징후 데이터 (테이블용) ───────────────────────
const ANOMALIES = [
  { id: 'PX-7729-D', status: 'active',     threat: 'critical', vector: 'SQL Injection Payload',    time: '12:44:02 PM' },
  { id: 'NODE-B1-9', status: 'quarantine', threat: 'elevated', vector: 'Brute Force Auth',         time: '11:58:31 AM' },
  { id: 'CLOUD-SY-4',status: 'resolved',   threat: 'low',      vector: 'Port Scan Detected',       time: '09:12:05 AM' },
  { id: 'SA-IRSA-11',status: 'active',     threat: 'critical', vector: 'IRSA Token Exfiltration',  time: '09:01:44 AM' },
  { id: 'EKS-POD-03',status: 'quarantine', threat: 'elevated', vector: 'Privileged Container Exec', time: '08:33:17 AM' },
];

const STATUS_DOT: Record<string, string> = {
  active:     '#4ade80',
  quarantine: '#fb923c',
  resolved:   '#555',
};

export function OverviewPage() {
  const { data: overview, isLoading, refetch } = useDashboardOverview();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full gap-3">
        <div
          className="w-5 h-5 rounded-full border-2 animate-spin"
          style={{ borderColor: '#2a2a2a', borderTopColor: '#f0f0f0' }}
        />
        <span className="text-xs font-mono" style={{ color: '#555' }}>
          Initializing threat matrix...
        </span>
      </div>
    );
  }

  // AreaChart 데이터: 24h 시뮬레이션
  const areaData = Array.from({ length: 24 }, (_, i) => {
    const h = String(i).padStart(2, '0');
    const base = 200 + Math.sin(i * 0.5) * 80 + Math.sin(i * 0.9) * 40;
    const spike = i >= 15 && i <= 18 ? (i - 14) * 90 : 0;
    return { time: `${h}:00`, value: Math.max(50, Math.round(base + spike)) };
  });

  // 섹터별 위험도
  const sectors = [
    { name: 'CLOUD ASSETS',      risk: 84 },
    { name: 'LOCAL MAINFRAME',   risk: 32 },
    { name: 'PERIPHERAL IOT',    risk: 68 },
    { name: 'REMOTE TERMINALS',  risk: 15 },
  ];

  const totalPaths = overview?.total_attack_paths ?? 49;
  const criticalPaths = overview?.critical_attack_paths ?? 10;

  return (
    <div className="p-6 space-y-5" style={{ background: '#0d0d0d' }}>

      {/* ── 페이지 헤더 ── */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-display font-bold text-3xl tracking-tight" style={{ color: '#f0f0f0' }}>
            OPERATIONAL{' '}
            <span style={{ color: '#555' }}>INTELLIGENCE</span>
          </h1>
          <p className="text-xs font-mono mt-1" style={{ color: '#555' }}>
            Global node synchronization active. Last update 12s ago.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button className="dg-btn gap-1.5">
            <Download size={12} /> 리포트 다운로드
          </button>
          <button
            className="dg-btn-primary gap-1.5"
            onClick={() => refetch()}
          >
            <RefreshCw size={12} /> Refresh Cluster
          </button>
        </div>
      </div>

      {/* ── 상단 스탯 카드 4개 ── */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard
          icon={<AlertTriangle size={16} style={{ color: '#555' }} />}
          label="Active Threats"
          value={`0,${totalPaths.toString().padStart(3, '0')}`}
          sub={`↑ +4.2% from peak`}
          subColor="#555"
        />
        <StatCard
          icon={<span className="text-xs font-mono" style={{ color: '#555' }}>(·)</span>}
          label="Nodes Active"
          value="82.1k"
          sub="⊙ Optimal performance"
          subColor="#4ade80"
        />
        <StatCard
          icon={<span className="text-xs font-mono" style={{ color: '#555' }}>⊟</span>}
          label="Data Integrity"
          value="99.98%"
          sub="🔒 SHA-512 Secure"
          subColor="#555"
        />
        <StatCard
          icon={<span className="text-xs font-mono" style={{ color: '#555' }}>↻</span>}
          label="Mean Response"
          value="18ms"
          sub="↘ -2ms from baseline"
          subColor="#4ade80"
        />
      </div>

      {/* ── 중간 차트 영역 ── */}
      <div className="grid grid-cols-5 gap-4">

        {/* Attack Surface Dynamics — AreaChart */}
        <div className="col-span-3 dg-card p-5">
          <div className="flex items-start justify-between mb-4">
            <div>
              <div className="font-display font-bold text-sm tracking-wider uppercase" style={{ color: '#f0f0f0' }}>
                Attack Surface Dynamics
              </div>
              <div className="text-xs font-mono mt-0.5" style={{ color: '#555' }}>
                Intrusion attempts identified over last 24h
              </div>
            </div>
            <div
              className="text-xs font-mono px-3 py-1 rounded-card"
              style={{ background: '#1f1f1f', border: '1px solid #2a2a2a', color: '#888' }}
            >
              Last 24 Hours
            </div>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={areaData} margin={{ top: 5, right: 0, bottom: 0, left: -20 }}>
              <defs>
                <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#f0f0f0" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#f0f0f0" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="#1f1f1f" strokeDasharray="0" vertical={false} />
              <XAxis
                dataKey="time"
                tick={{ fill: '#3a3a3a', fontSize: 10, fontFamily: 'JetBrains Mono' }}
                axisLine={false}
                tickLine={false}
                interval={5}
              />
              <YAxis
                tick={{ fill: '#3a3a3a', fontSize: 10, fontFamily: 'JetBrains Mono' }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                contentStyle={{
                  background: '#1a1a1a',
                  border: '1px solid #2a2a2a',
                  borderRadius: 6,
                  fontFamily: 'JetBrains Mono',
                  fontSize: 11,
                  color: '#f0f0f0',
                }}
                cursor={{ stroke: '#2a2a2a', strokeWidth: 1 }}
              />
              <Area
                type="monotone"
                dataKey="value"
                stroke="#f0f0f0"
                strokeWidth={1.5}
                fill="url(#areaGrad)"
                dot={false}
                activeDot={{ r: 3, fill: '#f0f0f0', strokeWidth: 0 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Vulnerability by Sector */}
        <div className="col-span-2 dg-card p-5">
          <div className="flex items-start justify-between mb-5">
            <div>
              <div className="font-display font-bold text-sm tracking-wider uppercase" style={{ color: '#f0f0f0' }}>
                Vulnerability by Sector
              </div>
              <div className="text-xs font-mono mt-0.5" style={{ color: '#555' }}>
                Aggregated risk score by network segment
              </div>
            </div>
            <button style={{ color: '#555' }}>
              <MoreHorizontal size={15} />
            </button>
          </div>
          <div className="space-y-4">
            {sectors.map((s) => (
              <SectorRow key={s.name} name={s.name} risk={s.risk} />
            ))}
          </div>
        </div>
      </div>

      {/* ── Recent Anomalies 테이블 ── */}
      <div className="dg-card overflow-hidden">
        <div
          className="flex items-center justify-between px-5 py-4 border-b"
          style={{ borderColor: '#222' }}
        >
          <div className="font-display font-bold text-sm tracking-wider uppercase" style={{ color: '#f0f0f0' }}>
            Recent Anomalies
          </div>
          <button className="text-xs font-mono tracking-wider" style={{ color: '#555' }}>
            VIEW MASTER LOG
          </button>
        </div>
        <table className="w-full">
          <thead>
            <tr style={{ borderBottom: '1px solid #1f1f1f' }}>
              {['STATUS', 'SYSTEM ID', 'THREAT LEVEL', 'VECTOR', 'TIMESTAMP', 'ACTION'].map((h) => (
                <th
                  key={h}
                  className="px-5 py-3 text-left dg-label"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ANOMALIES.map((row) => (
              <tr key={row.id} className="dg-row">
                {/* Status */}
                <td className="px-5 py-3.5">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-1.5 h-1.5 rounded-full"
                      style={{ background: STATUS_DOT[row.status] }}
                    />
                    <span className="text-xs font-mono capitalize" style={{ color: '#888' }}>
                      {row.status === 'quarantine' ? 'Quarantined' :
                       row.status === 'active' ? 'Active' : 'Resolved'}
                    </span>
                  </div>
                </td>
                {/* System ID */}
                <td className="px-5 py-3.5">
                  <span className="text-xs font-mono font-bold" style={{ color: '#f0f0f0' }}>
                    {row.id}
                  </span>
                </td>
                {/* Threat Level */}
                <td className="px-5 py-3.5">
                  <span className={`dg-badge-${row.threat}`}>
                    {row.threat}
                  </span>
                </td>
                {/* Vector */}
                <td className="px-5 py-3.5">
                  <span className="text-xs font-mono" style={{ color: '#888' }}>{row.vector}</span>
                </td>
                {/* Timestamp */}
                <td className="px-5 py-3.5">
                  <span className="text-xs font-mono" style={{ color: '#555' }}>{row.time}</span>
                </td>
                {/* Action */}
                <td className="px-5 py-3.5">
                  <button
                    className="w-7 h-7 rounded flex items-center justify-center transition-colors"
                    style={{ background: '#1f1f1f', border: '1px solid #2a2a2a', color: '#555' }}
                    onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.color = '#f0f0f0')}
                    onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.color = '#555')}
                  >
                    <ShieldCheck size={13} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── 서브 컴포넌트 ────────────────────────────────────────────

function StatCard({
  icon, label, value, sub, subColor,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub: string;
  subColor: string;
}) {
  return (
    <div className="dg-card p-5 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        {icon}
        <span className="dg-label">{label}</span>
      </div>
      <div className="font-display font-bold text-4xl leading-none tracking-tight" style={{ color: '#f0f0f0' }}>
        {value}
      </div>
      <div className="text-2xs font-mono" style={{ color: subColor }}>
        {sub}
      </div>
    </div>
  );
}

function SectorRow({ name, risk }: { name: string; risk: number }) {
  // 위험도에 따른 진행 바 색상 (이미지처럼 흰색~회색 그라디언트)
  const fillColor = risk >= 70 ? '#d4d4d4' : risk >= 40 ? '#888' : '#444';

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="dg-label">{name}</span>
        <span className="text-2xs font-mono font-bold" style={{ color: '#888' }}>
          {risk}% RISK
        </span>
      </div>
      <div className="dg-progress-track">
        <div
          className="dg-progress-fill"
          style={{ width: `${risk}%`, background: fillColor }}
        />
      </div>
    </div>
  );
}
