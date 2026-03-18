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
                클러스터가 등록되었습니다. 아래 스캐너 설치를 완료하면 보안 분석을 시작할 수 있습니다.
              </p>
              <p className="mb-2">
                <strong>클러스터 이름:</strong> {clusterName}
              </p>
              <p className="mb-2">
                <strong>클러스터 유형:</strong> {clusterType}
              </p>
              <p className="mb-3 small">
                {isAws ? (
                  <>
                    <strong>AWS</strong>는 <strong>Docker run</strong> 모드로 외부 스캐너
                    워커를 실행합니다.
                  </>
                ) : (
                  <>
                    <strong>Kubernetes</strong>는 <strong>Helm install</strong>로 클러스터 내부 에이전트
                    형태로 실행합니다.
                  </>
                )}
              </p>
              <div className="alert alert-warning mb-3" role="alert">
                이 API token은 한 번만 표시되며 스캐너 설치에 필수입니다. 창을 닫기 전에 지금 바로
                복사해 안전하게 보관해 주세요.
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
              <button type="button" className="btn btn-secondary" onClick={onClose}>
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
