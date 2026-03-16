import type { ElementDefinition } from 'cytoscape';

export type NodeType = 'Pod' | 'ServiceAccount' | 'IAMRole' | 'S3Bucket';

export interface NodeData {
  id: string;
  label: string;
  type: NodeType;
  namespace?: string;
  details: Record<string, string>;
  blastRadius: {
    pods: number;
    secrets: number;
    databases: number;
    adminPrivilege: boolean;
  };
}

export const mockElements: ElementDefinition[] = [
  {
    data: {
      id: 'pod-1',
      label: 'nginx-pod',
      type: 'Pod',
      namespace: 'default',
      details: {
        Namespace: 'default',
        Image: 'nginx:1.25',
        Status: 'Running',
        'Created At': '2024-01-10',
      },
      blastRadius: {
        pods: 3,
        secrets: 1,
        databases: 0,
        adminPrivilege: false,
      },
    },
  },
  {
    data: {
      id: 'sa-1',
      label: 'app-service-account',
      type: 'ServiceAccount',
      namespace: 'default',
      details: {
        Namespace: 'default',
        'Bound Pods': '1',
        'Created At': '2024-01-05',
      },
      blastRadius: {
        pods: 5,
        secrets: 2,
        databases: 1,
        adminPrivilege: true,
      },
    },
  },
  {
    data: {
      id: 'iam-1',
      label: 'app-iam-role',
      type: 'IAMRole',
      details: {
        ARN: 'arn:aws:iam::123456789012:role/app-iam-role',
        'Trust Policy': 'EKS OIDC',
        Permissions: 'S3:GetObject, S3:PutObject',
      },
      blastRadius: {
        pods: 1,
        secrets: 4,
        databases: 2,
        adminPrivilege: false,
      },
    },
  },
  {
    data: {
      id: 's3-1',
      label: 'my-app-bucket',
      type: 'S3Bucket',
      details: {
        ARN: 'arn:aws:s3:::my-app-bucket',
        Region: 'us-east-1',
        'Access Level': 'Private',
      },
      blastRadius: {
        pods: 0,
        secrets: 0,
        databases: 0,
        adminPrivilege: false,
      },
    },
  },
  { data: { id: 'e1', source: 'pod-1', target: 'sa-1', label: 'uses' } },
  { data: { id: 'e2', source: 'sa-1', target: 'iam-1', label: 'annotated with' } },
  { data: { id: 'e3', source: 'iam-1', target: 's3-1', label: 'has access to' } },
];

export const nodeTypeColors: Record<NodeType, string> = {
  Pod: '#0d6efd',
  ServiceAccount: '#6f42c1',
  IAMRole: '#fd7e14',
  S3Bucket: '#198754',
};

export const nodeTypeIcons: Record<NodeType, string> = {
  Pod: '🐳',
  ServiceAccount: '👤',
  IAMRole: '🔑',
  S3Bucket: '🪣',
};
