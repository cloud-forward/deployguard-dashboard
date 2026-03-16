export interface Cluster {
  id: string;
  name: string;
  type: 'Kubernetes' | 'Docker' | 'Cloud';
  status: 'Active' | 'Inactive' | 'Pending';
  nodeCount: number;
  lastScan: string;
}
