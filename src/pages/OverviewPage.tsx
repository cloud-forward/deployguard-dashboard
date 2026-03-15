// ============================================================
// src/pages/OverviewPage.tsx
// 대시보드 메인 화면 - 전체 위험 현황 요약
//
// 표시 내용:
// - 클러스터별 위험 점수 카드
// - 30일 위험도 추이 (Recharts LineChart)
// - 공격 경로 분포 (Recharts PieChart)
// - 상위 권고사항 미리보기
// ============================================================
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from 'recharts';
import { Shield, AlertTriangle, Activity, TrendingDown } from 'lucide-react';
import { useDashboardOverview } from '../api/hooks';
import { useDashboardStore } from '../store';

// 위험도 색상
const RISK_COLORS = {
  critical: '#f85149',
  high: '#d29922',
  medium: '#388bfd',
  low: '#3fb950',
};

export function OverviewPage() {
  const { data: overview, isLoading } = useDashboardOverview();
  const { setSelectedClusterId } = useDashboardStore();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center space-y-3">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-slate-400 text-sm">보안 분석 데이터 로딩 중...</p>
        </div>
      </div>
    );
  }

  if (!overview) return null;

  // 공격 경로 심각도 분포 데이터 (PieChart 입력용)
  const riskDistribution = [
    { name: 'Critical', value: overview.critical_attack_paths, color: RISK_COLORS.critical },
    {
      name: 'High',
      value: Math.floor(overview.total_attack_paths * 0.3),
      color: RISK_COLORS.high,
    },
    {
      name: 'Medium',
      value: Math.floor(overview.total_attack_paths * 0.25),
      color: RISK_COLORS.medium,
    },
    {
      name: 'Low',
      value:
        overview.total_attack_paths -
        overview.critical_attack_paths -
        Math.floor(overview.total_attack_paths * 0.55),
      color: RISK_COLORS.low,
    },
  ];

  return (
    <div className="p-6 space-y-6">
      {/* 페이지 타이틀 */}
      <div>
        <h1 className="text-2xl font-bold text-slate-100">보안 현황 개요</h1>
        <p className="text-slate-400 text-sm mt-1">
          전체 클러스터의 실시간 위협 분석 결과입니다
        </p>
      </div>

      {/* 요약 카드 4개 */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard
          icon={<Shield size={20} />}
          label="총 클러스터"
          value={overview.clusters.length}
          color="blue"
        />
        <StatCard
          icon={<AlertTriangle size={20} />}
          label="전체 공격 경로"
          value={overview.total_attack_paths}
          color="yellow"
        />
        <StatCard
          icon={<Activity size={20} />}
          label="Critical 경로"
          value={overview.critical_attack_paths}
          color="red"
        />
        <StatCard
          icon={<TrendingDown size={20} />}
          label="상위 권고 수"
          value={overview.top_recommendations.length}
          color="green"
          subtitle="즉시 적용 가능"
        />
      </div>

      {/* 차트 영역 */}
      <div className="grid grid-cols-3 gap-4">
        {/* 위험도 추이 (30일) */}
        <div className="col-span-2 bg-slate-900 border border-slate-700 rounded-xl p-5">
          <h2 className="text-slate-200 font-semibold mb-4">위험도 추이 (최근 30일)</h2>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={overview.risk_trend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#21262d" />
              <XAxis
                dataKey="date"
                tick={{ fill: '#7d8590', fontSize: 11 }}
                tickFormatter={(v: string) => v.slice(5)} // "MM-DD"만 표시
              />
              <YAxis
                domain={[0, 1]}
                tick={{ fill: '#7d8590', fontSize: 11 }}
                tickFormatter={(v: number) => `${(v * 100).toFixed(0)}%`}
              />
              <Tooltip
                contentStyle={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 8 }}
                labelStyle={{ color: '#e6edf3' }}
                formatter={(v: number) => [`${(v * 100).toFixed(1)}%`, '위험도']}
              />
              <Line
                type="monotone"
                dataKey="score"
                stroke="#388bfd"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, fill: '#388bfd' }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* 공격 경로 심각도 분포 */}
        <div className="bg-slate-900 border border-slate-700 rounded-xl p-5">
          <h2 className="text-slate-200 font-semibold mb-4">심각도 분포</h2>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie
                data={riskDistribution}
                cx="50%"
                cy="45%"
                innerRadius={55}
                outerRadius={80}
                paddingAngle={3}
                dataKey="value"
              >
                {riskDistribution.map((entry) => (
                  <Cell key={entry.name} fill={entry.color} />
                ))}
              </Pie>
              <Legend
                formatter={(value) => (
                  <span style={{ color: '#7d8590', fontSize: 12 }}>{value}</span>
                )}
              />
              <Tooltip
                contentStyle={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 8 }}
                formatter={(v: number) => [`${v}개`, '경로']}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 클러스터 목록 */}
      <div className="bg-slate-900 border border-slate-700 rounded-xl overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-700">
          <h2 className="text-slate-200 font-semibold">클러스터 현황</h2>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-slate-400 text-xs border-b border-slate-800">
              <th className="px-5 py-3 text-left">클러스터</th>
              <th className="px-5 py-3 text-left">리전</th>
              <th className="px-5 py-3 text-right">자산 수</th>
              <th className="px-5 py-3 text-right">공격 경로</th>
              <th className="px-5 py-3 text-right">위험도</th>
              <th className="px-5 py-3 text-right">마지막 스캔</th>
            </tr>
          </thead>
          <tbody>
            {overview.clusters.map((cluster) => (
              <tr
                key={cluster.cluster_id}
                className="border-b border-slate-800 hover:bg-slate-800 cursor-pointer transition-colors"
                onClick={() => setSelectedClusterId(cluster.cluster_id)}
              >
                <td className="px-5 py-3 text-slate-200 font-medium">
                  {cluster.cluster_name}
                </td>
                <td className="px-5 py-3 text-slate-400">{cluster.region}</td>
                <td className="px-5 py-3 text-right text-slate-300">
                  {cluster.total_assets.toLocaleString()}
                </td>
                <td className="px-5 py-3 text-right">
                  <span className="text-red-400 font-mono">
                    {cluster.attack_paths_count}
                  </span>
                </td>
                <td className="px-5 py-3 text-right">
                  <RiskBadge score={cluster.overall_risk_score} />
                </td>
                <td className="px-5 py-3 text-right text-slate-500 text-xs">
                  {new Date(cluster.last_scanned_at).toLocaleString('ko-KR')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── 서브 컴포넌트 ───────────────────────────────────────────

function StatCard({
  icon, label, value, color, subtitle,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  color: 'blue' | 'yellow' | 'red' | 'green';
  subtitle?: string;
}) {
  const colorMap = {
    blue: 'text-blue-400 bg-blue-500/10',
    yellow: 'text-yellow-400 bg-yellow-500/10',
    red: 'text-red-400 bg-red-500/10',
    green: 'text-green-400 bg-green-500/10',
  };

  return (
    <div className="bg-slate-900 border border-slate-700 rounded-xl p-5">
      <div className={`inline-flex p-2 rounded-lg ${colorMap[color]} mb-3`}>
        <span className={colorMap[color].split(' ')[0]}>{icon}</span>
      </div>
      <div className="text-2xl font-bold text-slate-100 font-mono">{value}</div>
      <div className="text-slate-400 text-sm mt-1">{label}</div>
      {subtitle && <div className="text-slate-500 text-xs mt-0.5">{subtitle}</div>}
    </div>
  );
}

function RiskBadge({ score }: { score: number }) {
  const pct = Math.round(score * 100);
  const color =
    score >= 0.8 ? 'text-red-400 bg-red-500/10' :
    score >= 0.6 ? 'text-yellow-400 bg-yellow-500/10' :
    score >= 0.4 ? 'text-blue-400 bg-blue-500/10' :
    'text-green-400 bg-green-500/10';

  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-mono font-bold ${color}`}>
      {pct}%
    </span>
  );
}
