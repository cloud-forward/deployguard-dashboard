import { useQuery } from '@tanstack/react-query';
import type { UseQueryOptions, UseQueryResult } from '@tanstack/react-query';
import { apiClient } from './client';
import type { AttackGraphApiResponse } from '../types/attackGraph';

export const getClusterAttackGraphUrl = (clusterId: string) => `/api/v1/clusters/${clusterId}/attack-graph`;

export const getClusterAttackGraph = async (
  clusterId: string,
  options?: RequestInit,
): Promise<AttackGraphApiResponse> => {
  return apiClient<AttackGraphApiResponse>(getClusterAttackGraphUrl(clusterId), {
    ...options,
    method: 'GET',
  });
};

export const getClusterAttackGraphQueryKey = (clusterId: string) => [getClusterAttackGraphUrl(clusterId)] as const;

export const useGetClusterAttackGraph = (
  clusterId: string,
  options?: {
    query?: Omit<UseQueryOptions<AttackGraphApiResponse, unknown>, 'queryKey' | 'queryFn'>;
    request?: RequestInit;
  },
): UseQueryResult<AttackGraphApiResponse, unknown> => {
  const { query: queryOptions, request: requestOptions } = options ?? {};

  return useQuery({
    queryKey: getClusterAttackGraphQueryKey(clusterId),
    queryFn: ({ signal }) => getClusterAttackGraph(clusterId, { signal, ...requestOptions }),
    enabled: Boolean(clusterId),
    ...queryOptions,
  });
};
