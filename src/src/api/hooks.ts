// ============================================================
// src/api/hooks.ts
// React Query 훅 — mock 모드 스위치 내장
//
// .env 파일에서 VITE_USE_MOCK=true 설정하면
// 백엔드 없이 바로 UI 확인 가능
// ============================================================
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from './client';
import {
  mockOverview, mockClusters, mockGraphData,
  mockAttackPaths, mockRecommendations, mockEvidence,
} from './mock';
import type {
  DashboardOverview, GraphData, AttackPath, Recommendation,
  BlastRadiusResult, LeastPrivilegeResult, EvidenceEvent,
  ClusterSummary, ApiResponse,
} from '../types';

const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true';
const delay = (ms = 400) => new Promise<void>((r) => setTimeout(r, ms));

export const QueryKeys = {
  overview:        ['dashboard', 'overview'] as const,
  clusters:        ['clusters'] as const,
  cluster:         (id: string) => ['clusters', id] as const,
  graph:           (id: string) => ['graph', id] as const,
  attackPaths:     (id: string) => ['attack_paths', id] as const,
  recommendations: (id: string) => ['recommendations', id] as const,
  blastRadius:     (id: string) => ['blast_radius', id] as const,
  leastPrivilege:  (id: string) => ['least_privilege', id] as const,
  evidence:        (id: string) => ['evidence', id] as const,
};

export function useDashboardOverview() {
  return useQuery({
    queryKey: QueryKeys.overview,
    queryFn: async (): Promise<DashboardOverview> => {
      if (USE_MOCK) { await delay(600); return mockOverview; }
      const { data } = await apiClient.get<ApiResponse<DashboardOverview>>('/dashboard/overview');
      return data.data;
    },
    staleTime: 5 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
  });
}

export function useClusters() {
  return useQuery({
    queryKey: QueryKeys.clusters,
    queryFn: async (): Promise<ClusterSummary[]> => {
      if (USE_MOCK) { await delay(300); return mockClusters; }
      const { data } = await apiClient.get<ApiResponse<ClusterSummary[]>>('/dashboard/clusters');
      return data.data;
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useAttackGraph(clusterId: string) {
  return useQuery({
    queryKey: QueryKeys.graph(clusterId),
    queryFn: async (): Promise<GraphData> => {
      if (USE_MOCK) { await delay(800); return mockGraphData; }
      const { data } = await apiClient.get<ApiResponse<GraphData>>(
        `/dashboard/clusters/${clusterId}/graph`
      );
      return data.data;
    },
    enabled: !!clusterId,
    staleTime: 10 * 60 * 1000,
  });
}

export function useAttackPaths(clusterId: string) {
  return useQuery({
    queryKey: QueryKeys.attackPaths(clusterId),
    queryFn: async (): Promise<AttackPath[]> => {
      if (USE_MOCK) { await delay(400); return mockAttackPaths; }
      const { data } = await apiClient.get<ApiResponse<AttackPath[]>>(
        `/dashboard/clusters/${clusterId}/attack-paths`
      );
      return data.data;
    },
    enabled: !!clusterId,
  });
}

export function useRecommendations(clusterId: string) {
  return useQuery({
    queryKey: QueryKeys.recommendations(clusterId),
    queryFn: async (): Promise<Recommendation[]> => {
      if (USE_MOCK) { await delay(500); return mockRecommendations; }
      const { data } = await apiClient.get<ApiResponse<Recommendation[]>>(
        `/dashboard/clusters/${clusterId}/recommendations`
      );
      return data.data;
    },
    enabled: !!clusterId,
  });
}

export function useBlastRadius(assetId: string | null) {
  return useQuery({
    queryKey: QueryKeys.blastRadius(assetId ?? ''),
    queryFn: async (): Promise<BlastRadiusResult> => {
      if (USE_MOCK) {
        await delay(300);
        return {
          asset_id: assetId!,
          affected_asset_count: 7,
          affected_paths_count: 12,
          blast_score: 0.84,
          affected_assets: mockGraphData.nodes.slice(0, 7).map((n) => n.id),
          computed_at: new Date().toISOString(),
        };
      }
      const { data } = await apiClient.get<ApiResponse<BlastRadiusResult>>(
        `/dashboard/assets/${assetId}/blast-radius`
      );
      return data.data;
    },
    enabled: !!assetId,
  });
}

export function useLeastPrivilege(clusterId: string) {
  return useQuery({
    queryKey: QueryKeys.leastPrivilege(clusterId),
    queryFn: async (): Promise<LeastPrivilegeResult[]> => {
      if (USE_MOCK) {
        await delay(400);
        return [
          {
            asset_id: 'sa:default:api-sa',
            asset_name: 'api-sa',
            granted_permissions: ['s3:*', 'rds:*', 'ec2:Describe*', 'iam:List*'],
            used_permissions: ['s3:GetObject', 's3:ListBucket'],
            excess_permissions: ['s3:PutObject', 's3:DeleteObject', 'rds:*', 'ec2:Describe*', 'iam:List*'],
            excess_ratio: 0.87,
          },
          {
            asset_id: 'iam:role:api-role',
            asset_name: 'api-role',
            granted_permissions: ['s3:*', 'secretsmanager:GetSecretValue'],
            used_permissions: ['s3:GetObject'],
            excess_permissions: ['s3:PutObject', 's3:DeleteObject', 'secretsmanager:GetSecretValue'],
            excess_ratio: 0.79,
          },
        ];
      }
      const { data } = await apiClient.get<ApiResponse<LeastPrivilegeResult[]>>(
        `/dashboard/clusters/${clusterId}/least-privilege`
      );
      return data.data;
    },
    enabled: !!clusterId,
  });
}

export function useEvidenceByPath(attackPathId: string | null) {
  return useQuery({
    queryKey: QueryKeys.evidence(attackPathId ?? ''),
    queryFn: async (): Promise<EvidenceEvent[]> => {
      if (USE_MOCK) {
        await delay(400);
        return mockEvidence[attackPathId!] ?? [];
      }
      const { data } = await apiClient.get<ApiResponse<EvidenceEvent[]>>(
        `/dashboard/attack-paths/${attackPathId}/evidence`
      );
      return data.data;
    },
    enabled: !!attackPathId,
  });
}

export function useApplyRecommendation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ clusterId, recommendationId }: {
      clusterId: string;
      recommendationId: string;
    }) => {
      if (USE_MOCK) {
        await delay(800);
        const rec = mockRecommendations.find((r) => r.id === recommendationId);
        if (rec) rec.is_applied = true;
        return { success: true };
      }
      const { data } = await apiClient.post(
        `/dashboard/clusters/${clusterId}/recommendations/${recommendationId}/apply`
      );
      return data;
    },
    onSuccess: (_data, { clusterId }) => {
      queryClient.invalidateQueries({ queryKey: QueryKeys.recommendations(clusterId) });
      queryClient.invalidateQueries({ queryKey: QueryKeys.overview });
    },
  });
}
