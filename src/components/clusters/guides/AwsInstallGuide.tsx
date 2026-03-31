import React, { useState } from 'react';

type AwsInstallGuideProps = {
  clusterId: string;
  apiToken: string;
  apiEndpoint: string;
};

const AwsInstallGuide: React.FC<AwsInstallGuideProps> = ({ clusterId, apiToken, apiEndpoint }) => {
  const copyButtonStyle = { height: 36, minWidth: 64, paddingInline: 12, fontSize: 14 } as const;
  const registryHost = '189060532132.dkr.ecr.ap-northeast-2.amazonaws.com';
  const imageUri = `${registryHost}/deployguard-aws-scanner:latest`;
  const removeOldCommand = 'docker rm -f deployguard-aws-scanner 2>/dev/null || true';
  const loginCommand = `aws ecr get-login-password --region ap-northeast-2 | docker login --username AWS --password-stdin ${registryHost}`;
  const pullCommand = `docker pull ${imageUri}`;
  const runCommand = `docker run -d \\
  --name deployguard-aws-scanner \\
  --restart unless-stopped \\
  -e DG_API_ENDPOINT=https://analysis.deployguard.org \\
  -e API_URL=https://analysis.deployguard.org \\
  -e SCANNER_TYPE=aws \\
  -e DG_SAVE_LOCAL_COPY=false \\
  -e DG_API_TOKEN={DG_API_TOKEN} \\
  -e DG_CLUSTER_ID={DG_CLUSTER_ID} \\
  -e AWS_REGION={AWS_REGION} \\
  -e DG_ROLE_ARN={DG_ROLE_ARN} \\
  ${imageUri} \\
  worker`;
  const [tokenCopied, setTokenCopied] = useState(false);
  const [clusterIdCopied, setClusterIdCopied] = useState(false);
  const [removeCopied, setRemoveCopied] = useState(false);
  const [loginCopied, setLoginCopied] = useState(false);
  const [pullCopied, setPullCopied] = useState(false);
  const [runCopied, setRunCopied] = useState(false);

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
      <h6 className="fw-semibold">AWS 스캐너 설치</h6>
      <p className="small text-body-secondary mb-2">
        AWS 스캐너는 클러스터 내부가 아니라 Docker 컨테이너로 외부 worker를 실행하는 방식입니다.
        아래 값을 준비한 뒤 순서대로 실행하세요.
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
        이 이미지는 DeployGuard의 private ECR(account <code>189060532132</code>)에 있습니다. ECR owner
        계정으로 로그인해야 하는 것은 아니고, 현재 호스트의 AWS 자격증명이 이 레지스트리에 접근할 권한만
        있으면 됩니다. 이미 같은 레지스트리에 로그인되어 있고 세션이 유효하면 재로그인은 건너뛸 수 있습니다.
      </div>
      <div className="mb-3">
        <label className="form-label fw-semibold">1. 기존 컨테이너 정리</label>
        <div className="d-flex gap-2 align-items-center mb-1">
          <pre className="bg-dark border border-secondary-subtle text-light rounded p-2 text-break flex-grow-1 mb-0">
            <code>{removeOldCommand}</code>
          </pre>
          <button
            type="button"
            className="btn btn-sm dg-dashboard-action-btn dg-dashboard-action-btn--secondary"
            style={copyButtonStyle}
            onClick={() => copyToClipboard(removeOldCommand, setRemoveCopied)}
          >
            복사
          </button>
        </div>
        {removeCopied && <div className="small text-success">복사됨!</div>}
      </div>
      <div className="mb-3">
        <label className="form-label fw-semibold">2. ECR 로그인</label>
        <div className="d-flex gap-2 align-items-center mb-1">
          <pre className="bg-dark border border-secondary-subtle text-light rounded p-2 text-break flex-grow-1 mb-0">
            <code>{loginCommand}</code>
          </pre>
          <button
            type="button"
            className="btn btn-sm dg-dashboard-action-btn dg-dashboard-action-btn--secondary"
            style={copyButtonStyle}
            onClick={() => copyToClipboard(loginCommand, setLoginCopied)}
          >
            복사
          </button>
        </div>
        {loginCopied && <div className="small text-success">복사됨!</div>}
      </div>
      <div className="mb-3">
        <label className="form-label fw-semibold">3. 스캐너 이미지 pull</label>
        <div className="d-flex gap-2 align-items-center mb-1">
          <pre className="bg-dark border border-secondary-subtle text-light rounded p-2 text-break flex-grow-1 mb-0">
            <code>{pullCommand}</code>
          </pre>
          <button
            type="button"
            className="btn btn-sm dg-dashboard-action-btn dg-dashboard-action-btn--secondary"
            style={copyButtonStyle}
            onClick={() => copyToClipboard(pullCommand, setPullCopied)}
          >
            복사
          </button>
        </div>
        {pullCopied && <div className="small text-success">복사됨!</div>}
      </div>
      <div className="mb-3">
        <label className="form-label fw-semibold">4. worker 실행</label>
        <div className="d-flex gap-2 align-items-center mb-1">
          <pre className="bg-dark border border-secondary-subtle text-light rounded p-2 text-break flex-grow-1 mb-0">
            <code>{runCommand}</code>
          </pre>
          <button
            type="button"
            className="btn btn-sm dg-dashboard-action-btn dg-dashboard-action-btn--primary"
            style={copyButtonStyle}
            onClick={() => copyToClipboard(runCommand, setRunCopied)}
          >
            복사
          </button>
        </div>
        {runCopied && <div className="small text-success">복사됨!</div>}
      </div>
      <div className="alert alert-warning mb-0" role="alert">
        <strong>필수 입력값:</strong> <code>{'{DG_API_TOKEN}'}</code>, <code>{'{DG_CLUSTER_ID}'}</code>,{' '}
        <code>{'{AWS_REGION}'}</code>, <code>{'{DG_ROLE_ARN}'}</code>. 실행 전에 placeholder를 실제 값으로
        바꿔 넣으세요.
      </div>
    </div>
  );
};

export default AwsInstallGuide;
