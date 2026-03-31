import React from 'react';
import AwsInstallGuide from './guides/AwsInstallGuide';
import HelmInstallGuide from './guides/HelmInstallGuide';

type ClusterOnboardingModalProps = {
  isOpen: boolean;
  onClose: () => void;
  clusterId: string;
  clusterName: string;
  clusterType: string;
  apiToken: string;
};

const ClusterOnboardingModal: React.FC<ClusterOnboardingModalProps> = ({
  isOpen,
  onClose,
  clusterId,
  clusterName,
  clusterType,
  apiToken,
}) => {
  if (!isOpen) {
    return null;
  }

  const apiEndpoint = 'https://analysis.deployguard.org';
  const isAws = clusterType === 'aws';
  const clusterTypeLabel =
    clusterType === 'eks'
      ? 'EKS'
      : clusterType === 'self-managed'
        ? 'Self-managed'
        : clusterType === 'aws'
          ? 'AWS'
          : clusterType;

  return (
    <>
      <div
        className="modal-backdrop fade show"
        style={{
          zIndex: 2099,
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.55)',
        }}
      />
      <div
        className="modal show d-block cluster-onboarding-modal"
        tabIndex={-1}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 2100,
        }}
      >
        <div
          className="modal-dialog modal-lg modal-dialog-scrollable"
          style={{ maxHeight: '90vh' }}
        >
          <div className="modal-content" style={{ maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
            <div className="modal-header">
              <h5 className="modal-title">클러스터가 성공적으로 등록되었습니다</h5>
              <button
                type="button"
                className="btn-close"
                aria-label="닫기"
                onClick={onClose}
              />
            </div>
            <div
              className="modal-body"
              style={{
                overflowY: 'auto',
                maxHeight: 'calc(90vh - 132px)',
                flex: '1 1 auto',
                minHeight: 0,
              }}
            >
              <p className="mb-3">
                클러스터가 등록되었습니다. 아래 안내에 따라 스캐너를 연결하면 이 클러스터의
                스캔과 분석을 시작할 수 있습니다.
              </p>
              <div className="card border mb-3">
                <div className="card-body">
                  <h6 className="fw-semibold mb-3">등록 정보</h6>
                  <div className="row g-3 small">
                    <div className="col-12 col-md-6">
                      <div className="text-muted mb-1">클러스터 이름</div>
                      <div className="fw-semibold text-break">{clusterName || '-'}</div>
                    </div>
                    <div className="col-12 col-md-6">
                      <div className="text-muted mb-1">클러스터 유형</div>
                      <div className="fw-semibold">{clusterTypeLabel || '-'}</div>
                    </div>
                    <div className="col-12">
                      <div className="text-muted mb-1">클러스터 ID</div>
                      <code className="d-block bg-body-tertiary border rounded px-2 py-2 text-break">
                        {clusterId || '-'}
                      </code>
                    </div>
                    <div className="col-12">
                      <div className="text-muted mb-1">API Token</div>
                      <code className="d-block bg-body-tertiary border rounded px-2 py-2 text-break">
                        {apiToken || '-'}
                      </code>
                    </div>
                  </div>
                </div>
              </div>
              <p className="mb-3 small">
                {isAws ? (
                  <>
                    <strong>AWS</strong> 클러스터는 Kubernetes 내부 에이전트가 아니라
                    외부 <strong>scanner worker</strong>를 실행해 계정 리소스를 수집합니다. 안내된
                    순서대로 기존 컨테이너 정리, ECR 로그인, 이미지 pull, worker 실행을 진행하세요.
                  </>
                ) : (
                  <>
                    <strong>{clusterTypeLabel}</strong> 클러스터는 클러스터 내부에 스캐너를 배포하는
                    흐름입니다. 아래 namespace 생성과 Helm 설치 명령을 그대로 복사해 사용하세요.
                  </>
                )}
              </p>
              <div className="alert alert-warning mb-3" role="alert">
                이 API token은 생성 직후 한 번만 표시될 수 있습니다. 설치 전에 복사하고,
                비밀값 저장소나 안전한 팀 문서에 보관해 주세요.
              </div>
              <div className="alert alert-info mb-3" role="alert">
                {isAws ? (
                  <>
                    다음 단계: 현재 호스트의 AWS 자격증명이 DeployGuard private ECR과 대상 계정 접근
                    권한을 갖는지 확인한 뒤, 아래 명령으로 worker를 실행하세요.
                  </>
                ) : (
                  <>
                    다음 단계: 대상 클러스터에서 namespace를 준비한 뒤 Helm 명령으로 scanner를 설치하고,
                    이 토큰으로 DeployGuard와 연결하세요.
                  </>
                )}
              </div>
              {isAws ? (
                <AwsInstallGuide
                  clusterId={clusterId}
                  apiToken={apiToken}
                  apiEndpoint={apiEndpoint}
                />
              ) : (
                  <HelmInstallGuide
                    clusterId={clusterId}
                    apiToken={apiToken}
                    apiEndpoint={apiEndpoint}
                  />
                )}
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-sm dg-dashboard-action-btn dg-dashboard-action-btn--secondary" onClick={onClose}>
                닫기
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default ClusterOnboardingModal;
