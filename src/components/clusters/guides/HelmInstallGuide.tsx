import React, { useState } from 'react';

type HelmInstallGuideProps = {
  clusterId: string;
  apiToken: string;
  apiEndpoint: string;
};

const HelmInstallGuide: React.FC<HelmInstallGuideProps> = ({ clusterId, apiToken, apiEndpoint }) => {
  const command = `helm upgrade --install deployguard-scanner deployguard/scanner --set config.clusterId="${clusterId}" --set config.apiToken="${apiToken}" --set config.serverUrl="${apiEndpoint}"`;
  const [tokenCopied, setTokenCopied] = useState(false);
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
      <h6 className="fw-semibold">Helm 설치</h6>
      <p className="small text-body-secondary mb-2">
        클러스터 내부 Kubernetes 환경에서 아래 Helm 명령을 실행하세요. 스캐너가 클러스터 내부 에이전트로
        배포되어 연동된 클러스터 자격정보로 분석을 시작합니다.
      </p>
      <p className="mb-2"><strong>클러스터 ID:</strong> <code>{clusterId}</code></p>
      <p className="mb-2">
        <strong>API Token:</strong>
        <span className="d-flex gap-2 align-items-start mt-1">
          <code className="bg-dark border border-secondary-subtle rounded p-1 flex-grow-1 text-break text-light">
            {apiToken}
          </code>
          <button
            type="button"
            className="btn btn-outline-secondary btn-sm"
            onClick={() => copyToClipboard(apiToken, setTokenCopied)}
          >
            복사
          </button>
        </span>
      </p>
      <p className="mb-2"><strong>API Endpoint:</strong> <code>{apiEndpoint}</code></p>
      <div className="mb-0">
        <label className="form-label fw-semibold">설치 명령어</label>
        <div className="d-flex gap-2 align-items-start mb-1">
          <pre className="bg-dark border border-secondary-subtle text-light rounded p-2 text-break flex-grow-1 mb-0">
            <code>{command}</code>
          </pre>
          <button
            type="button"
            className="btn btn-outline-secondary btn-sm"
            onClick={() => copyToClipboard(command, setCommandCopied)}
          >
            복사
          </button>
        </div>
        {commandCopied && <div className="small text-success">복사됨!</div>}
        {tokenCopied && <div className="small text-success">복사됨!</div>}
      </div>
    </div>
  );
};

export default HelmInstallGuide;
