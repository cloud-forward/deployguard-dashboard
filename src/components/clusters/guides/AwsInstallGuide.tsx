import React, { useState } from 'react';

type AwsInstallGuideProps = {
  clusterId: string;
  apiToken: string;
  apiEndpoint: string;
};

const AwsInstallGuide: React.FC<AwsInstallGuideProps> = ({ clusterId, apiToken, apiEndpoint }) => {
  const example = `docker run -d \\
  --name deployguard-aws-scanner \\
  -e DG_API_ENDPOINT=${apiEndpoint} \\
  -e DG_API_TOKEN=${apiToken} \\
  -e DG_SCANNER_TYPE=aws \\
  -e DG_RUN_MODE=worker \\
  deployguard/aws-scanner:latest`;
  const [tokenCopied, setTokenCopied] = useState(false);
  const [exampleCopied, setExampleCopied] = useState(false);

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
        Docker로 스캐너를 외부에서 실행하세요. 컨테이너는 API token으로 백엔드에 인증되며,
        AWS 자격증명으로 대상 계정을 탐색해 스캔을 수행합니다.
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
      <div className="mb-3">
        <label className="form-label fw-semibold">Docker run 예시</label>
        <div className="d-flex gap-2 align-items-start mb-1">
          <pre className="bg-dark border border-secondary-subtle text-light rounded p-2 text-break flex-grow-1 mb-0">
            <code>{example}</code>
          </pre>
          <button
            type="button"
            className="btn btn-outline-secondary btn-sm"
            onClick={() => copyToClipboard(example, setExampleCopied)}
          >
            복사
          </button>
        </div>
        {exampleCopied && <div className="small text-success">복사됨!</div>}
        {tokenCopied && <div className="small text-success">복사됨!</div>}
      </div>
      <div className="alert alert-warning mb-0" role="alert">
        AWS 스캐너 워커를 실행하기 전에 필요한 AWS 자격증명 또는 IAM Role 정책을 먼저 준비해야 합니다.
      </div>
    </div>
  );
};

export default AwsInstallGuide;
