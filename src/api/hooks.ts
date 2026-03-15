// ============================================================
// src/api/hooks.ts
// React Query 훅 - 모든 API 호출을 여기서 관리
//
// 사용법:
//   const { data, isLoading } = useDashboardOverview();
//   const { data: graph } = useAttackGraph('my-cluster-id');
// ============================================================
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from './client';
import type {
  DashboardOverview,
  GraphData,
  AttackPath,
  Recommendation,
  BlastRadiusResult,
  LeastPrivilegeResult,
  EvidenceEvent,
  ClusterSummary,
  ApiResponse,
} from '../types';

// -------- Query Key 상수 (캐시 무효화할 때 사용) --------
export const QueryKeys = {
  overview: ['dashboard', 'overview'] as const,
  clusters: ['clusters'] as const,
  cluster: (id: string) => ['clusters', id] as const,
  graph: (clusterId: string) => ['graph', clusterId] as const,
  attackPaths: (clusterId: string) => ['attack_paths', clusterId] as const,
  recommendations: (clusterId: string) => ['recommendations', clusterId] as const,
  blastRadius: (assetId: string) => ['blast_radius', assetId] as const,
  leastPrivilege: (clusterId: string) => ['least_privilege', clusterId] as const,
  evidence: (pathId: string) => ['evidence', pathId] as const,
};

// -------- 대시보드 전체 요약 --------
export function useDashboardOverview() {
  return useQuery({
    queryKey: QueryKeys.overview,
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<DashboardOverview>>('/dashboard/overview');
      return data.data;
    },
    staleTime: 5 * 60 * 1000, // 5분 캐시
    refetchInterval: 5 * 60 * 1000, // 5분마다 자동 갱신
  });
}

// -------- 클러스터 목록 --------
export function useClusters() {
  return useQuery({
    queryKey: QueryKeys.clusters,
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<ClusterSummary[]>>('/dashboard/clusters');
      return data.data;
    },
    staleTime: 5 * 60 * 1000,
  });
}

// -------- 공격 그래프 데이터 (Cytoscape.js 입력용) --------
export function useAttackGraph(clusterId: string) {
  return useQuery({
    queryKey: QueryKeys.graph(clusterId),
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<GraphData>>(
        `/dashboard/clusters/${clusterId}/graph`
      );
      return data.data;
    },
    enabled: !!clusterId, // clusterId가 있을 때만 요청
    staleTime: 10 * 60 * 1000,
  });
}

// -------- 공격 경로 목록 (위험도 내림차순) --------
export function useAttackPaths(clusterId: string) {
  return useQuery({
    queryKey: QueryKeys.attackPaths(clusterId),
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<AttackPath[]>>(
        `/dashboard/clusters/${clusterId}/attack-paths`
      );
      return data.data;
    },
    enabled: !!clusterId,
  });
}

// -------- 권고사항 (Set Cover 최적화 결과) --------
export function useRecommendations(clusterId: string) {
  return useQuery({
    queryKey: QueryKeys.recommendations(clusterId),
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<Recommendation[]>>(
        `/dashboard/clusters/${clusterId}/recommendations`
      );
      return data.data;
    },
    enabled: !!clusterId,
  });
}

// -------- Blast Radius (특정 자산 기준) --------
export function useBlastRadius(assetId: string | null) {
  return useQuery({
    queryKey: QueryKeys.blastRadius(assetId ?? ''),
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<BlastRadiusResult>>(
        `/dashboard/assets/${assetId}/blast-radius`
      );
      return data.data;
    },
    enabled: !!assetId,
  });
}

// -------- Least Privilege 분석 목록 --------
export function useLeastPrivilege(clusterId: string) {
  return useQuery({
    queryKey: QueryKeys.leastPrivilege(clusterId),
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<LeastPrivilegeResult[]>>(
        `/dashboard/clusters/${clusterId}/least-privilege`
      );
      return data.data;
    },
    enabled: !!clusterId,
  });
}

// -------- 공격 경로별 런타임 증거 --------
export function useEvidenceByPath(attackPathId: string | null) {
  return useQuery({
    queryKey: QueryKeys.evidence(attackPathId ?? ''),
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<EvidenceEvent[]>>(
        `/dashboard/attack-paths/${attackPathId}/evidence`
      );
      return data.data;
    },
    enabled: !!attackPathId,
  });
}

// -------- 권고사항 적용 (Mutation) --------
export function useApplyRecommendation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ clusterId, recommendationId }: {
      clusterId: string;
      recommendationId: string;
    }) => {
      const { data } = await apiClient.post(
        `/dashboard/clusters/${clusterId}/recommendations/${recommendationId}/apply`
      );
      return data;
    },
    onSuccess: (_data, { clusterId }) => {
      // 적용 후 관련 쿼리 캐시 무효화 → 자동 재요청
      queryClient.invalidateQueries({ queryKey: QueryKeys.recommendations(clusterId) });
      queryClient.invalidateQueries({ queryKey: QueryKeys.overview });
    },
  });
}
