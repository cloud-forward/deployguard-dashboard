import React, { useState } from 'react';

type HelmInstallGuideProps = {
  clusterId: string;
  apiToken: string;
  apiEndpoint: string;
};

const HelmInstallGuide: React.FC<HelmInstallGuideProps> = ({ clusterId, apiToken, apiEndpoint }) => {
  const copyButtonStyle = { height: 36, minWidth: 64, paddingInline: 12, fontSize: 14 } as const;
  const registryAccount = '189060532132';
  const imageRepository =
    '189060532132.dkr.ecr.ap-northeast-2.amazonaws.com/deployguard-agent-scanner';
  const namespaceCommand =
    'kubectl create namespace {NAMESPACE} --dry-run=client -o yaml | kubectl apply -f -';
  const helmCommand = `helm upgrade --install deployguard-scanner {CHART_REF} \\
  --namespace {NAMESPACE} \\
  --create-namespace \\
  --set config.clusterId={DG_CLUSTER_ID} \\
  --set config.apiToken={DG_API_TOKEN} \\
  --set config.apiEndpoint=https://analysis.deployguard.org \\
  --set image.repository=${imageRepository} \\
  --set image.tag={IMAGE_TAG} \\
  --set imagePullSecrets[0].name={IMAGE_PULL_SECRET}`;
  const [tokenCopied, setTokenCopied] = useState(false);
  const [clusterIdCopied, setClusterIdCopied] = useState(false);
  const [namespaceCopied, setNamespaceCopied] = useState(false);
  const [commandCopied, setCommandCopied] = useState(false);

  const copyToClipboard = async (
    value: string,
    onSuccess: React.Dispatch<React.SetStateAction<boolean>>,
  ) => {
    if (!value) {
      return;
    }
    if (!navigator?.clipboard?.writeText) {
      return;
    }

    try {
      await navigator.clipboard.writeText(value);
      onSuccess(true);
      window.setTimeout(() => onSuccess(false), 1500);
    } catch {
      onSuccess(false);
    }
  };

  return (
    <div className="mt-3">
      <h6 className="fw-semibold">Kubernetes 스캐너 설치</h6>
      <p className="small text-body-secondary mb-2">
        Kubernetes 노드 또는 <code>imagePullSecret</code>이 DeployGuard private ECR(account{' '}
        <code>{registryAccount}</code>)에서 이미지를 pull할 권한이 있어야 합니다. 아래 순서대로 namespace를
        준비한 뒤 Helm 명령을 실행하세요.
      </p>
      <div className="card border mb-3">
        <div className="card-body">
          <h6 className="fw-semibold mb-3">현재 값</h6>
          <p className="mb-2"><strong>DG_API_ENDPOINT / API_URL:</strong> <code>{apiEndpoint}</code></p>
          <p className="mb-2">
            <strong>DG_CLUSTER_ID:</strong>
            <span className="d-flex gap-2 align-items-center mt-1">
              <code className="bg-dark border border-secondary-subtle rounded px-2 py-2 flex-grow-1 text-break text-light">
                {clusterId}
              </code>
              <button
                type="button"
                className="btn btn-sm dg-dashboard-action-btn dg-dashboard-action-btn--secondary"
                style={copyButtonStyle}
                onClick={() => copyToClipboard(clusterId, setClusterIdCopied)}
              >
                복사
              </button>
            </span>
          </p>
          <p className="mb-0">
            <strong>DG_API_TOKEN:</strong>
            <span className="d-flex gap-2 align-items-center mt-1">
              <code className="bg-dark border border-secondary-subtle rounded px-2 py-2 flex-grow-1 text-break text-light">
                {apiToken}
              </code>
              <button
                type="button"
                className="btn btn-sm dg-dashboard-action-btn dg-dashboard-action-btn--secondary"
                style={copyButtonStyle}
                onClick={() => copyToClipboard(apiToken, setTokenCopied)}
              >
                복사
              </button>
            </span>
          </p>
          {clusterIdCopied && <div className="small text-success mt-2">클러스터 ID 복사됨!</div>}
          {tokenCopied && <div className="small text-success mt-2">API token 복사됨!</div>}
        </div>
      </div>
      <div className="alert alert-info mb-3" role="alert">
        <strong>고정값:</strong> <code>config.apiEndpoint=https://analysis.deployguard.org</code>,{' '}
        <code>image.repository={imageRepository}</code>
      </div>
      <div className="mb-3">
        <label className="form-label fw-semibold">1. 네임스페이스 준비</label>
        <div className="d-flex gap-2 align-items-center mb-1">
          <pre className="bg-dark border border-secondary-subtle text-light rounded p-2 text-break flex-grow-1 mb-0">
            <code>{namespaceCommand}</code>
          </pre>
          <button
            type="button"
            className="btn btn-sm dg-dashboard-action-btn dg-dashboard-action-btn--secondary"
            style={copyButtonStyle}
            onClick={() => copyToClipboard(namespaceCommand, setNamespaceCopied)}
          >
            복사
          </button>
        </div>
        {namespaceCopied && <div className="small text-success">복사됨!</div>}
      </div>
      <div className="mb-0">
        <label className="form-label fw-semibold">2. Helm 설치</label>
        <div className="d-flex gap-2 align-items-center mb-1">
          <pre className="bg-dark border border-secondary-subtle text-light rounded p-2 text-break flex-grow-1 mb-0">
            <code>{helmCommand}</code>
          </pre>
          <button
            type="button"
            className="btn btn-sm dg-dashboard-action-btn dg-dashboard-action-btn--primary"
            style={copyButtonStyle}
            onClick={() => copyToClipboard(helmCommand, setCommandCopied)}
          >
            복사
          </button>
        </div>
        {commandCopied && <div className="small text-success">복사됨!</div>}
      </div>
      <div className="alert alert-warning mt-3 mb-0" role="alert">
        <strong>필수 placeholder:</strong> <code>{'{NAMESPACE}'}</code>, <code>{'{CHART_REF}'}</code>,{' '}
        <code>{'{IMAGE_TAG}'}</code>, <code>{'{IMAGE_PULL_SECRET}'}</code>,{' '}
        <code>{'{DG_CLUSTER_ID}'}</code>, <code>{'{DG_API_TOKEN}'}</code>.
      </div>
    </div>
  );
};

export default HelmInstallGuide;
