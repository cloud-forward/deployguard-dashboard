// ============================================================
// src/api/mock.ts
// 백엔드 없이 UI를 개발/확인할 때 쓰는 더미 데이터
//
// 실제 공격 시나리오를 그대로 재현:
// "프론트엔드 Pod → SA → IAM Role → S3 비밀 파일 다운로드"
// ============================================================
import type {
  DashboardOverview,
  GraphData,
  AttackPath,
  Recommendation,
  EvidenceEvent,
  ClusterSummary,
  Asset,
  Edge,
} from '../types';

// ─────────────────────────────────────────────
// 클러스터 목록
// ─────────────────────────────────────────────
export const mockClusters: ClusterSummary[] = [
  {
    cluster_id: 'eks-prod-ap-northeast-2',
    cluster_name: 'prod-cluster (서울)',
    aws_account_id: '123456789012',
    region: 'ap-northeast-2',
    total_assets: 247,
    critical_assets: 12,
    attack_paths_count: 34,
    critical_paths_count: 8,
    overall_risk_score: 0.73,
    last_scanned_at: new Date(Date.now() - 1000 * 60 * 8).toISOString(), // 8분 전
    scanner_status: 'healthy',
  },
  {
    cluster_id: 'eks-staging-ap-northeast-2',
    cluster_name: 'staging-cluster (서울)',
    aws_account_id: '123456789012',
    region: 'ap-northeast-2',
    total_assets: 98,
    critical_assets: 3,
    attack_paths_count: 11,
    critical_paths_count: 2,
    overall_risk_score: 0.41,
    last_scanned_at: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
    scanner_status: 'healthy',
  },
  {
    cluster_id: 'eks-dev-us-east-1',
    cluster_name: 'dev-cluster (버지니아)',
    aws_account_id: '123456789012',
    region: 'us-east-1',
    total_assets: 52,
    critical_assets: 1,
    attack_paths_count: 4,
    critical_paths_count: 0,
    overall_risk_score: 0.22,
    last_scanned_at: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
    scanner_status: 'warning',
  },
];

// ─────────────────────────────────────────────
// 대시보드 개요
// ─────────────────────────────────────────────
export const mockOverview: DashboardOverview = {
  clusters: mockClusters,
  total_attack_paths: 49,
  critical_attack_paths: 10,
  top_recommendations: [], // 아래에서 채움
  // 최근 30일 위험도 추이 (날짜별)
  risk_trend: Array.from({ length: 30 }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() - (29 - i));
    // 완만하게 감소하다가 중간에 스파이크 있는 패턴
    const base = 0.75 - i * 0.008;
    const spike = i === 12 ? 0.15 : i === 13 ? 0.1 : 0;
    const noise = (Math.sin(i * 1.3) * 0.05);
    return {
      date: date.toISOString().slice(0, 10),
      score: Math.max(0.1, Math.min(1, base + spike + noise)),
    };
  }),
};

// ─────────────────────────────────────────────
// 공격 그래프 노드 (prod-cluster 기준)
// 실제 시나리오: 외부 노출 Pod → IRSA → S3 민감 파일
// ─────────────────────────────────────────────
export const mockAssets: Asset[] = [
  // Entry Points (공격 시작 가능 노드 — 외부 노출)
  {
    id: 'pod:default:frontend-6d8f9',
    name: 'frontend-6d8f9',
    type: 'POD',
    namespace: 'default',
    cluster_id: 'eks-prod-ap-northeast-2',
    risk_score: 0.62,
    risk_level: 'high',
    is_entry_point: true,
    is_crown_jewel: false,
    metadata: { image: 'nginx:1.21', node: 'ip-10-0-1-101' },
    last_seen: new Date().toISOString(),
  },
  {
    id: 'pod:default:api-server-7c4b2',
    name: 'api-server-7c4b2',
    type: 'POD',
    namespace: 'default',
    cluster_id: 'eks-prod-ap-northeast-2',
    risk_score: 0.78,
    risk_level: 'high',
    is_entry_point: true,
    is_crown_jewel: false,
    metadata: { image: 'myapp:v2.1.0', node: 'ip-10-0-1-101' },
    last_seen: new Date().toISOString(),
  },

  // ServiceAccount
  {
    id: 'sa:default:api-sa',
    name: 'api-sa',
    type: 'SERVICE_ACCOUNT',
    namespace: 'default',
    cluster_id: 'eks-prod-ap-northeast-2',
    risk_score: 0.85,
    risk_level: 'critical',
    is_entry_point: false,
    is_crown_jewel: false,
    metadata: {
      annotations: { 'eks.amazonaws.com/role-arn': 'arn:aws:iam::123456789012:role/api-role' },
    },
    last_seen: new Date().toISOString(),
  },
  {
    id: 'sa:default:default',
    name: 'default',
    type: 'SERVICE_ACCOUNT',
    namespace: 'default',
    cluster_id: 'eks-prod-ap-northeast-2',
    risk_score: 0.45,
    risk_level: 'medium',
    is_entry_point: false,
    is_crown_jewel: false,
    metadata: {},
    last_seen: new Date().toISOString(),
  },

  // Roles
  {
    id: 'role:default:secret-reader',
    name: 'secret-reader',
    type: 'ROLE',
    namespace: 'default',
    cluster_id: 'eks-prod-ap-northeast-2',
    risk_score: 0.70,
    risk_level: 'high',
    is_entry_point: false,
    is_crown_jewel: false,
    metadata: { rules: [{ resources: ['secrets'], verbs: ['get', 'list'] }] },
    last_seen: new Date().toISOString(),
  },

  // Secrets (Crown Jewel 후보)
  {
    id: 'secret:default:db-credentials',
    name: 'db-credentials',
    type: 'SECRET',
    namespace: 'default',
    cluster_id: 'eks-prod-ap-northeast-2',
    risk_score: 0.95,
    risk_level: 'critical',
    is_entry_point: false,
    is_crown_jewel: true,
    metadata: { keys: ['DB_PASSWORD', 'DB_HOST', 'DB_USER'] },
    last_seen: new Date().toISOString(),
  },

  // IAM Role (AWS 경계 넘기)
  {
    id: 'iam:role:api-role',
    name: 'api-role',
    type: 'IAM_ROLE',
    cluster_id: 'eks-prod-ap-northeast-2',
    risk_score: 0.88,
    risk_level: 'critical',
    is_entry_point: false,
    is_crown_jewel: false,
    metadata: { arn: 'arn:aws:iam::123456789012:role/api-role' },
    last_seen: new Date().toISOString(),
  },

  // S3 Bucket (Crown Jewel — 최종 목표)
  {
    id: 's3:prod-secrets-bucket',
    name: 'prod-secrets-bucket',
    type: 'S3_BUCKET',
    cluster_id: 'eks-prod-ap-northeast-2',
    risk_score: 0.98,
    risk_level: 'critical',
    is_entry_point: false,
    is_crown_jewel: true,
    metadata: { region: 'ap-northeast-2', public_access_blocked: false },
    last_seen: new Date().toISOString(),
  },

  // Worker Node (컨테이너 탈출 경로)
  {
    id: 'node:ip-10-0-1-101',
    name: 'ip-10-0-1-101',
    type: 'NODE',
    cluster_id: 'eks-prod-ap-northeast-2',
    risk_score: 0.55,
    risk_level: 'medium',
    is_entry_point: false,
    is_crown_jewel: false,
    metadata: { instance_type: 't3.xlarge', os: 'Amazon Linux 2' },
    last_seen: new Date().toISOString(),
  },

  // 특권 컨테이너 (탈출 가능)
  {
    id: 'pod:monitoring:log-collector-priv',
    name: 'log-collector-priv',
    type: 'POD',
    namespace: 'monitoring',
    cluster_id: 'eks-prod-ap-northeast-2',
    risk_score: 0.82,
    risk_level: 'critical',
    is_entry_point: false,
    is_crown_jewel: false,
    metadata: { privileged: true, image: 'fluentd:v1.16' },
    last_seen: new Date().toISOString(),
  },
];

// ─────────────────────────────────────────────
// 엣지 (공격 경로 연결)
// ─────────────────────────────────────────────
export const mockEdges: Edge[] = [
  // Pod → ServiceAccount
  { id: 'e1', source: 'pod:default:api-server-7c4b2', target: 'sa:default:api-sa',       relation: 'uses',         risk_score: 0.8, metadata: {} },
  { id: 'e2', source: 'pod:default:frontend-6d8f9',   target: 'sa:default:default',       relation: 'uses',         risk_score: 0.4, metadata: {} },

  // ServiceAccount → Role
  { id: 'e3', source: 'sa:default:api-sa',            target: 'role:default:secret-reader', relation: 'bound_to',  risk_score: 0.7, metadata: {} },

  // Role → Secret (RBAC 권한)
  { id: 'e4', source: 'role:default:secret-reader',   target: 'secret:default:db-credentials', relation: 'grants', risk_score: 0.9, metadata: {} },

  // IRSA: ServiceAccount → IAM Role (K8s → AWS 경계 넘기)
  { id: 'e5', source: 'sa:default:api-sa',            target: 'iam:role:api-role',         relation: 'assumes',     risk_score: 0.85, metadata: { via: 'IRSA OIDC' } },

  // IAM Role → S3 (AWS 권한)
  { id: 'e6', source: 'iam:role:api-role',            target: 's3:prod-secrets-bucket',    relation: 'has_permission', risk_score: 0.95, metadata: { actions: ['s3:GetObject', 's3:ListBucket'] } },

  // 컨테이너 탈출: Privileged Pod → Node
  { id: 'e7', source: 'pod:monitoring:log-collector-priv', target: 'node:ip-10-0-1-101', relation: 'escapes_to',  risk_score: 0.8, metadata: { reason: 'privileged=true' } },

  // 수평 이동: Node → api-server Pod (노드 장악 후)
  { id: 'e8', source: 'node:ip-10-0-1-101',          target: 'pod:default:api-server-7c4b2', relation: 'lateral_move', risk_score: 0.7, metadata: { reason: 'node_credential_reuse' } },
];

// ─────────────────────────────────────────────
// 공격 경로 (Attack Paths)
// ─────────────────────────────────────────────
export const mockAttackPaths: AttackPath[] = [
  {
    id: 'path-001',
    cluster_id: 'eks-prod-ap-northeast-2',
    path_nodes: [
      'pod:default:api-server-7c4b2',
      'sa:default:api-sa',
      'iam:role:api-role',
      's3:prod-secrets-bucket',
    ],
    hop_count: 3,
    base_risk: 0.87,
    final_risk: 0.94, // eBPF 증거로 높아짐
    risk_level: 'critical',
    has_runtime_evidence: true,
    evidence_count: 3,
    created_at: new Date().toISOString(),
  },
  {
    id: 'path-002',
    cluster_id: 'eks-prod-ap-northeast-2',
    path_nodes: [
      'pod:default:api-server-7c4b2',
      'sa:default:api-sa',
      'role:default:secret-reader',
      'secret:default:db-credentials',
    ],
    hop_count: 3,
    base_risk: 0.82,
    final_risk: 0.89,
    risk_level: 'critical',
    has_runtime_evidence: true,
    evidence_count: 1,
    created_at: new Date().toISOString(),
  },
  {
    id: 'path-003',
    cluster_id: 'eks-prod-ap-northeast-2',
    path_nodes: [
      'pod:monitoring:log-collector-priv',
      'node:ip-10-0-1-101',
      'pod:default:api-server-7c4b2',
      'sa:default:api-sa',
      's3:prod-secrets-bucket',
    ],
    hop_count: 4,
    base_risk: 0.76,
    final_risk: 0.81,
    risk_level: 'critical',
    has_runtime_evidence: false,
    evidence_count: 0,
    created_at: new Date().toISOString(),
  },
  {
    id: 'path-004',
    cluster_id: 'eks-prod-ap-northeast-2',
    path_nodes: [
      'pod:default:frontend-6d8f9',
      'sa:default:default',
      'secret:default:db-credentials',
    ],
    hop_count: 2,
    base_risk: 0.54,
    final_risk: 0.54,
    risk_level: 'high',
    has_runtime_evidence: false,
    evidence_count: 0,
    created_at: new Date().toISOString(),
  },
];

// ─────────────────────────────────────────────
// 권고사항 (Set Cover 최적화 결과)
// ─────────────────────────────────────────────
export const mockRecommendations: Recommendation[] = [
  {
    id: 'rec-001',
    cluster_id: 'eks-prod-ap-northeast-2',
    title: 'api-sa의 IRSA 권한을 s3:GetObject로 최소화',
    description:
      'api-role은 현재 s3:* 전체 권한을 갖고 있습니다. 실제 사용 API는 s3:GetObject와 s3:ListBucket뿐입니다 (CloudTrail 분석 결과). 이 하나만 수정하면 경로 path-001, path-003을 모두 차단할 수 있습니다.',
    remediation_type: 'irsa_scope',
    affected_asset_ids: ['iam:role:api-role', 'sa:default:api-sa'],
    paths_blocked: 18,
    risk_reduction: 0.52,
    effort: 'low',
    priority_score: 9.4,
    is_applied: false,
    code_snippet: `# IAM 정책 수정 (api-role에 연결)
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:GetObject",
        "s3:ListBucket"
      ],
      "Resource": [
        "arn:aws:s3:::prod-secrets-bucket",
        "arn:aws:s3:::prod-secrets-bucket/*"
      ]
    }
  ]
}`,
  },
  {
    id: 'rec-002',
    cluster_id: 'eks-prod-ap-northeast-2',
    title: 'log-collector-priv Pod의 privileged: true 제거',
    description:
      'monitoring 네임스페이스의 log-collector-priv Pod가 privileged 모드로 실행 중입니다. 이는 워커 노드 전체를 장악할 수 있는 컨테이너 탈출 경로(path-003)의 시작점입니다. securityContext를 수정하면 됩니다.',
    remediation_type: 'security_context',
    affected_asset_ids: ['pod:monitoring:log-collector-priv', 'node:ip-10-0-1-101'],
    paths_blocked: 7,
    risk_reduction: 0.28,
    effort: 'low',
    priority_score: 7.8,
    is_applied: false,
    code_snippet: `# fluentd DaemonSet 수정
spec:
  template:
    spec:
      containers:
      - name: fluentd
        securityContext:
          privileged: false          # true → false
          allowPrivilegeEscalation: false  # 추가
          readOnlyRootFilesystem: true     # 추가
          runAsNonRoot: true               # 추가
          capabilities:
            drop: ["ALL"]`,
  },
  {
    id: 'rec-003',
    cluster_id: 'eks-prod-ap-northeast-2',
    title: 'secret-reader Role의 verbs를 ["get"]으로 제한',
    description:
      'secret-reader Role은 현재 secrets에 대해 get과 list 권한을 모두 갖습니다. list 권한은 네임스페이스 내 모든 Secret 이름을 열거할 수 있어 정찰에 활용됩니다. get만 허용하고 resourceNames로 특정 Secret만 지정하세요.',
    remediation_type: 'rbac_reduce',
    affected_asset_ids: ['role:default:secret-reader', 'sa:default:api-sa'],
    paths_blocked: 5,
    risk_reduction: 0.18,
    effort: 'low',
    priority_score: 6.2,
    is_applied: false,
    code_snippet: `# Role 수정 (kubectl apply)
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: secret-reader
  namespace: default
rules:
- apiGroups: [""]
  resources: ["secrets"]
  resourceNames: ["db-credentials"]  # 특정 Secret만 허용
  verbs: ["get"]                      # list 제거`,
  },
  {
    id: 'rec-004',
    cluster_id: 'eks-prod-ap-northeast-2',
    title: 'prod-secrets-bucket S3 퍼블릭 액세스 차단 활성화',
    description:
      'prod-secrets-bucket의 Public Access Block이 비활성화되어 있습니다. 즉시 활성화하세요.',
    remediation_type: 's3_policy',
    affected_asset_ids: ['s3:prod-secrets-bucket'],
    paths_blocked: 3,
    risk_reduction: 0.12,
    effort: 'low',
    priority_score: 5.5,
    is_applied: false,
    code_snippet: `# AWS CLI
aws s3api put-public-access-block \\
  --bucket prod-secrets-bucket \\
  --public-access-block-configuration \\
    "BlockPublicAcls=true,IgnorePublicAcls=true,\\
     BlockPublicPolicy=true,RestrictPublicBuckets=true"`,
  },
];

// 개요에 top_recommendations 채우기
mockOverview.top_recommendations = mockRecommendations.slice(0, 3);

// ─────────────────────────────────────────────
// 런타임 증거 (eBPF + CloudTrail)
// ─────────────────────────────────────────────
export const mockEvidence: Record<string, EvidenceEvent[]> = {
  'path-001': [
    {
      id: 'ev-001',
      attack_path_id: 'path-001',
      asset_id: 'pod:default:api-server-7c4b2',
      evidence_type: 'imds_access',
      source: 'ebpf',
      description: 'api-server-7c4b2 컨테이너에서 IMDS(169.254.169.254)에 HTTP 요청 감지. curl 프로세스가 IAM 자격증명 경로(/latest/meta-data/iam/security-credentials/)에 접근함.',
      raw_data: {
        pid: 18423,
        process: 'curl',
        args: 'http://169.254.169.254/latest/meta-data/iam/security-credentials/api-role',
        uid: 1000,
        timestamp_ns: Date.now() * 1_000_000,
      },
      occurred_at: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
    },
    {
      id: 'ev-002',
      attack_path_id: 'path-001',
      asset_id: 'sa:default:api-sa',
      evidence_type: 'sa_token_read',
      source: 'ebpf',
      description: 'ServiceAccount 토큰 파일 읽기 감지. /var/run/secrets/kubernetes.io/serviceaccount/token에 대한 open() 시스템 호출이 비정상 프로세스(python3)에서 발생.',
      raw_data: {
        pid: 18501,
        process: 'python3',
        syscall: 'open',
        path: '/var/run/secrets/kubernetes.io/serviceaccount/token',
        flags: 'O_RDONLY',
      },
      occurred_at: new Date(Date.now() - 1000 * 60 * 42).toISOString(),
    },
    {
      id: 'ev-003',
      attack_path_id: 'path-001',
      asset_id: 'iam:role:api-role',
      evidence_type: 'cloudtrail_api',
      source: 'cloudtrail',
      description: 'CloudTrail: api-role로 s3:GetObject 호출 감지. prod-secrets-bucket에서 passwords.txt 파일 다운로드 확인됨. 서울 리전 외부 IP(220.85.x.x)에서 호출.',
      raw_data: {
        eventName: 'GetObject',
        eventSource: 's3.amazonaws.com',
        userIdentity: { type: 'AssumedRole', arn: 'arn:aws:sts::123456789012:assumed-role/api-role/...' },
        requestParameters: { bucketName: 'prod-secrets-bucket', key: 'secrets/passwords.txt' },
        sourceIPAddress: '220.85.112.34',
        awsRegion: 'ap-northeast-2',
      },
      occurred_at: new Date(Date.now() - 1000 * 60 * 38).toISOString(),
    },
  ],
  'path-002': [
    {
      id: 'ev-004',
      attack_path_id: 'path-002',
      asset_id: 'secret:default:db-credentials',
      evidence_type: 'cloudtrail_api',
      source: 'cloudtrail',
      description: 'CloudTrail: AssumeRoleWithWebIdentity 호출 감지. api-sa ServiceAccount 토큰으로 IRSA를 통해 api-role Assume 성공.',
      raw_data: {
        eventName: 'AssumeRoleWithWebIdentity',
        eventSource: 'sts.amazonaws.com',
        requestParameters: { roleArn: 'arn:aws:iam::123456789012:role/api-role' },
        responseElements: { credentials: { expiration: '2024-01-15T12:00:00Z' } },
      },
      occurred_at: new Date(Date.now() - 1000 * 60 * 120).toISOString(),
    },
  ],
};

// ─────────────────────────────────────────────
// 공격 그래프 데이터 (노드 + 엣지 통합)
// ─────────────────────────────────────────────
export const mockGraphData: GraphData = {
  nodes: mockAssets,
  edges: mockEdges,
  attack_paths: mockAttackPaths,
};
