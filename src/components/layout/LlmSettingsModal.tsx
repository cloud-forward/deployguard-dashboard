import React, { useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { createPortal } from 'react-dom';
import {
  getListLlmProviderConfigsApiV1LlmProviderConfigsGetQueryKey,
  useListLlmProviderConfigsApiV1LlmProviderConfigsGet,
  useUpsertLlmProviderConfigApiV1LlmProviderConfigsProviderPut,
} from '../../api/generated/llm/llm';
import { ExplanationProviderName, type ExplanationProviderName as ExplanationProviderNameType } from '../../api/model';

type SaveStatus = 'idle' | 'saving' | 'success' | 'error';

interface LlmSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const providerOptions = Object.values(ExplanationProviderName);

const formatProviderLabel = (provider: string) => {
  if (provider === 'openai') return 'OpenAI';
  if (provider === 'xai') return 'xAI';
  return provider;
};

const formatDateTime = (value?: string | null) => {
  if (!value) return '-';
  return new Date(value).toLocaleString();
};

const LlmSettingsModal: React.FC<LlmSettingsModalProps> = ({ isOpen, onClose }) => {
  const queryClient = useQueryClient();
  const [selectedProvider, setSelectedProvider] = useState<ExplanationProviderNameType>(providerOptions[0]);
  const [apiKey, setApiKey] = useState('');
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const {
    data: providerConfigs,
    isLoading: isLoadingConfigs,
    isError: isConfigsError,
  } = useListLlmProviderConfigsApiV1LlmProviderConfigsGet({
    query: {
      enabled: isOpen,
      retry: false,
    },
  });

  const configItems = Array.isArray(providerConfigs?.items) ? (providerConfigs?.items ?? []) : [];

  const selectedConfig = useMemo(
    () => configItems.find((item) => item.provider === selectedProvider) ?? null,
    [configItems, selectedProvider],
  );

  const { mutate: upsertProviderConfig } = useUpsertLlmProviderConfigApiV1LlmProviderConfigsProviderPut({
    mutation: {
      onMutate: () => {
        setSaveStatus('saving');
        setErrorMessage(null);
      },
      onSuccess: async () => {
        setApiKey('');
        setSaveStatus('success');
        await queryClient.invalidateQueries({
          queryKey: getListLlmProviderConfigsApiV1LlmProviderConfigsGetQueryKey(),
        });
      },
      onError: (error) => {
        const detail =
          error && typeof error === 'object' && 'detail' in error
            ? (error as { detail?: unknown }).detail
            : null;
        const nextMessage =
          typeof detail === 'string' && detail.trim()
            ? detail
            : 'LLM 프로바이더 설정을 저장할 수 없습니다.';
        setErrorMessage(nextMessage);
        setSaveStatus('error');
      },
    },
  });

  useEffect(() => {
    if (!isOpen) {
      setApiKey('');
      setSaveStatus('idle');
      setErrorMessage(null);
    }
  }, [isOpen]);

  useEffect(() => {
    setApiKey('');
    setSaveStatus('idle');
    setErrorMessage(null);
  }, [selectedProvider]);

  if (!isOpen) {
    return null;
  }

  const handleSave = () => {
    if (!apiKey.trim()) {
      setSaveStatus('error');
      setErrorMessage('API 키를 입력해주세요.');
      return;
    }

    upsertProviderConfig({
      provider: selectedProvider,
      data: {
        api_key: apiKey.trim(),
        is_active: true,
        default_model: selectedConfig?.default_model ?? null,
      },
    });
  };

  return createPortal(
    <>
      <div className="modal-backdrop fade show" onClick={onClose} />
      <div className="dg-dashboard-shell modal show d-block" tabIndex={-1} role="dialog" aria-modal="true">
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content">
            <div className="modal-header">
              <div>
                <h5 className="modal-title">LLM 설정</h5>
                <div className="small text-muted">설명 기반 기능을 위한 프로바이더 설정</div>
              </div>
              <button type="button" className="btn-close" aria-label="닫기" onClick={onClose} />
            </div>
            <div className="modal-body">
              <div className="d-flex flex-column gap-3">
                <div>
                  <label htmlFor="llm-provider-select" className="form-label">
                    프로바이더
                  </label>
                  <select
                    id="llm-provider-select"
                    className="form-select"
                    value={selectedProvider}
                    onChange={(event) => setSelectedProvider(event.target.value as ExplanationProviderNameType)}
                  >
                    {providerOptions.map((provider) => (
                      <option key={provider} value={provider}>
                        {formatProviderLabel(provider)}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="llm-api-key" className="form-label">
                    API 키
                  </label>
                  <input
                    id="llm-api-key"
                    type="password"
                    className="form-control"
                    value={apiKey}
                    placeholder="프로바이더 API 키를 입력하세요"
                    autoComplete="off"
                    onChange={(event) => setApiKey(event.target.value)}
                  />
                </div>

                <div className="card">
                  <div className="card-body py-3">
                    <div className="small text-muted mb-2">현재 프로바이더 상태</div>
                    {isLoadingConfigs ? (
                      <div className="small text-muted">현재 설정을 불러오는 중…</div>
                    ) : isConfigsError ? (
                      <div className="small text-danger">현재 설정을 불러올 수 없습니다.</div>
                    ) : selectedConfig ? (
                      <div className="d-flex flex-column gap-1 small">
                        <div><strong>프로바이더:</strong> {formatProviderLabel(selectedConfig.provider)}</div>
                        <div><strong>API 키 저장됨:</strong> {selectedConfig.has_api_key ? '예' : '아니오'}</div>
                        <div><strong>활성화:</strong> {selectedConfig.is_active ? '예' : '아니오'}</div>
                        <div><strong>기본 모델:</strong> {selectedConfig.default_model ?? '-'}</div>
                        <div><strong>업데이트됨:</strong> {formatDateTime(selectedConfig.updated_at)}</div>
                      </div>
                    ) : (
                      <div className="small text-muted">이 프로바이더에 대한 저장된 설정이 없습니다.</div>
                    )}
                  </div>
                </div>

                {saveStatus === 'success' ? (
                  <div className="alert alert-success mb-0" role="alert">
                    프로바이더 설정이 저장되었습니다.
                  </div>
                ) : null}
                {saveStatus === 'error' && errorMessage ? (
                  <div className="alert alert-danger mb-0" role="alert">
                    {errorMessage}
                  </div>
                ) : null}
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-sm dg-dashboard-action-btn dg-dashboard-action-btn--secondary" onClick={onClose}>
                닫기
              </button>
              <button
                type="button"
                className="btn btn-sm dg-dashboard-action-btn dg-dashboard-action-btn--primary"
                onClick={handleSave}
                disabled={saveStatus === 'saving'}
              >
                {saveStatus === 'saving' ? '저장 중…' : '저장'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>,
    document.body,
  );
};

export default LlmSettingsModal;
