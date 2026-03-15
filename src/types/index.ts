// ============================================================
// DeployGuard v4.0 - 핵심 타입 정의
// 백엔드 DB2(분석 결과 DB)의 테이블 구조를 그대로 반영
// ============================================================

// -------- 자산 (Asset) --------
export type AssetType =
  | 'POD'
  | 'SERVICE_ACCOUNT'
  | 'SECRET'
  | 'ROLE'
  | 'CLUSTER_ROLE'
  | 'IAM_ROLE'
  | 'S3_BUCKET'
  | 'RDS'
  | 'NODE'
  | 'NAMESPACE';

export type RiskLevel = 'critical' | 'high' | 'medium' | 'low';

export interface Asset {
  id: string;              // 예) "pod:default:nginx"
  name: string;
  type: AssetType;
  namespace?: string;
  cluster_id: string;
  risk_score: number;      // 0.0 ~ 1.0
  risk_level: RiskLevel;
  is_entry_point: boolean; // 공격 시작 가능 노드
  is_crown_jewel: boolean; // 공격 최종 목표 (S3, RDS, 민감 Secret)
  metadata: Record<string, unknown>;
  last_seen: string;       // ISO 8601
}

// -------- 엣지 (Edge) --------
export type EdgeRelation =
  | 'uses'              // Pod -> ServiceAccount
  | 'bound_to'          // ServiceAccount -> Role
  | 'grants'            // Role -> Secret
  | 'assumes'           // ServiceAccount -> IAM Role (IRSA)
  | 'has_permission'    // IAM Role -> S3/RDS
  | 'escapes_to'        // Privileged Pod -> Node (컨테이너 탈출)
  | 'lateral_move'      // Pod -> Pod (수평 이동)
  | 'contains_credentials'; // 자격증명 포함

export interface Edge {
  id: string;
  source: string;       // Asset.id
  target: string;       // Asset.id
  relation: EdgeRelation;
  risk_score: number;
  metadata: Record<string, unknown>;
}

// -------- 공격 경로 (Attack Path) --------
export interface AttackPath {
  id: string;
  cluster_id: string;
  path_nodes: string[]; // Asset.id 순서 배열 (시작 -> 목표)
  hop_count: number;
  base_risk: number;    // 0.0 ~ 1.0
  final_risk: number;   // 런타임 증거 반영 후 최종 위험도
  risk_level: RiskLevel;
  has_runtime_evidence: boolean;
  evidence_count: number;
  created_at: string;
}

// -------- 권고사항 (Recommendation) --------
export type RemediationType =
  | 'rbac_reduce'        // 과도 RBAC 권한 축소
  | 'image_patch'        // CVE 이미지 패치
  | 'network_policy'     // NetworkPolicy 추가
  | 'irsa_scope'         // IRSA 권한 범위 축소
  | 's3_policy'          // S3 버킷 정책 강화
  | 'security_context';  // Pod securityContext 설정

export interface Recommendation {
  id: string;
  cluster_id: string;
  title: string;
  description: string;
  remediation_type: RemediationType;
  affected_asset_ids: string[];
  paths_blocked: number;  // 적용 시 차단 가능한 공격 경로 수
  risk_reduction: number; // 0.0 ~ 1.0 (위험 감소율)
  effort: 'low' | 'medium' | 'high';
  priority_score: number; // Set Cover 최적화 결과
  is_applied: boolean;
  code_snippet?: string;  // YAML / Policy 수정안
}

// -------- Blast Radius --------
export interface BlastRadiusResult {
  asset_id: string;
  affected_asset_count: number;
  affected_paths_count: number;
  blast_score: number;   // 0.0 ~ 1.0
  affected_assets: string[];
  computed_at: string;
}

// -------- Least Privilege --------
export interface LeastPrivilegeResult {
  asset_id: string;       // ServiceAccount 또는 IAM Role
  asset_name: string;
  granted_permissions: string[];
  used_permissions: string[];   // CloudTrail/eBPF 실제 사용 목록
  excess_permissions: string[]; // 사용 안 한 과도 권한
  excess_ratio: number;         // 0.0 ~ 1.0 (예: 0.98 = 98% 과도)
}

// -------- 런타임 증거 (Evidence) --------
export type EvidenceType =
  | 'imds_access'       // 169.254.169.254 접근 (IMDS)
  | 'sa_token_read'     // ServiceAccount 토큰 읽기
  | 'sensitive_file'    // /etc/shadow 등 민감 파일 접근
  | 'suspicious_exec'   // curl, wget, nc 등 실행
  | 'external_connect'  // 비정상 외부 연결
  | 'cloudtrail_api';   // CloudTrail API 이벤트

export interface EvidenceEvent {
  id: string;
  attack_path_id: string;
  asset_id: string;
  evidence_type: EvidenceType;
  source: 'ebpf' | 'cloudtrail';
  description: string;
  raw_data: Record<string, unknown>;
  occurred_at: string;
}

// -------- 클러스터 요약 --------
export interface ClusterSummary {
  cluster_id: string;
  cluster_name: string;
  aws_account_id: string;
  region: string;
  total_assets: number;
  critical_assets: number;
  attack_paths_count: number;
  critical_paths_count: number;
  overall_risk_score: number; // 0.0 ~ 1.0
  last_scanned_at: string;
  scanner_status: 'healthy' | 'warning' | 'error';
}

// -------- 대시보드 요약 API 응답 --------
export interface DashboardOverview {
  clusters: ClusterSummary[];
  total_attack_paths: number;
  critical_attack_paths: number;
  top_recommendations: Recommendation[];
  risk_trend: { date: string; score: number }[]; // 최근 30일 위험도 추이
}

// -------- 공격 그래프 API 응답 --------
export interface GraphData {
  nodes: Asset[];
  edges: Edge[];
  attack_paths: AttackPath[];
}

// -------- API 공통 응답 래퍼 --------
export interface ApiResponse<T> {
  data: T;
  meta?: {
    total: number;
    page: number;
    per_page: number;
  };
}
