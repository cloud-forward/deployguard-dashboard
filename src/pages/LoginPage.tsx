import React, { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useLoginApiV1AuthLoginPost } from '../api/generated/auth/auth';
import type { LoginResponse } from '../api/model';
import { useAuth } from '../auth/AuthProvider';
import {
  clearRememberedIdentifier,
  getRememberedIdentifier,
  setRememberedIdentifier,
} from '../auth/session';

type NavigationState = {
  from?: {
    pathname?: string;
  };
  prefillEmail?: string;
  signupSuccess?: boolean;
} | null;

const isLoginResponse = (value: unknown): value is LoginResponse =>
  Boolean(
    value &&
      typeof value === 'object' &&
      'access_token' in value &&
      'token_type' in value &&
      'user' in value,
  );

const getErrorMessage = (error: unknown, fallback: string) => {
  if (error && typeof error === 'object') {
    if ('response' in error) {
      const response = (error as { response?: { data?: { detail?: unknown } } }).response;
      if (typeof response?.data?.detail === 'string' && response.data.detail.trim()) {
        return response.data.detail;
      }
    }

    if ('message' in error && typeof error.message === 'string' && error.message.trim()) {
      return error.message;
    }
  }

  return fallback;
};

const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();
  const rememberedIdentifier = useMemo(() => getRememberedIdentifier(), []);
  const navigationState = location.state as NavigationState;
  const [email, setEmail] = useState(navigationState?.prefillEmail ?? rememberedIdentifier);
  const [password, setPassword] = useState('');
  const [rememberId, setRememberId] = useState(
    Boolean(navigationState?.prefillEmail ?? rememberedIdentifier),
  );
  const [formError, setFormError] = useState('');
  const [sessionNotice, setSessionNotice] = useState('');

  const redirectTo = navigationState?.from?.pathname || '/dashboard';

  const { mutate: loginMutation, isPending } = useLoginApiV1AuthLoginPost();

  useEffect(() => {
    if (navigationState?.signupSuccess) {
      setSessionNotice('회원가입이 완료되었습니다. 로그인해 주세요.');
    } else {
      setSessionNotice('');
    }
  }, [navigationState?.signupSuccess]);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError('');
    setSessionNotice('');

    loginMutation(
      {
        data: {
          email: email.trim(),
          password,
        },
      },
      {
        onSuccess: (response) => {
          if (!isLoginResponse(response)) {
            setFormError('로그인 응답 형식을 확인할 수 없습니다.');
            return;
          }

          if (rememberId) {
            setRememberedIdentifier(email.trim());
          } else {
            clearRememberedIdentifier();
          }

          login(response);
          navigate(redirectTo, { replace: true });
        },
        onError: (error) => {
          setFormError(getErrorMessage(error, '로그인에 실패했습니다.'));
        },
      },
    );
  };

  return (
    <div className="min-vh-100 d-flex align-items-center justify-content-center bg-body-tertiary px-3">
      <div className="card shadow-sm border-0" style={{ width: '100%', maxWidth: 440 }}>
        <div className="card-body p-4 p-md-5">
          <div className="mb-4">
            <h1 className="h3 mb-2 fw-bold">DeployGuard 로그인</h1>
            <p className="text-muted mb-0">대시보드에 접근하려면 로그인해야 합니다.</p>
          </div>

          {sessionNotice ? (
            <div className="alert alert-success" role="alert">
              {sessionNotice}
            </div>
          ) : null}

          {location.state && !navigationState?.signupSuccess ? (
            <div className="alert alert-warning" role="alert">
              로그인 세션이 필요합니다.
            </div>
          ) : null}

          {formError ? (
            <div className="alert alert-danger" role="alert">
              {formError}
            </div>
          ) : null}

          <form onSubmit={handleSubmit} className="d-flex flex-column gap-3">
            <div>
              <label htmlFor="login-email" className="form-label">
                이메일
              </label>
              <input
                id="login-email"
                type="email"
                className="form-control"
                autoComplete="username"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </div>

            <div>
              <label htmlFor="login-password" className="form-label">
                비밀번호
              </label>
              <input
                id="login-password"
                type="password"
                className="form-control"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
            </div>

            <div className="form-check">
              <input
                id="remember-id"
                type="checkbox"
                className="form-check-input"
                checked={rememberId}
                onChange={(event) => setRememberId(event.target.checked)}
              />
              <label htmlFor="remember-id" className="form-check-label">
                아이디 기억하기
              </label>
            </div>

            <button type="submit" className="btn btn-sm dg-dashboard-action-btn dg-dashboard-action-btn--primary w-100" disabled={isPending}>
              {isPending ? '로그인 중…' : '로그인'}
            </button>
          </form>

          <div className="d-flex justify-content-between align-items-center mt-4 pt-3 border-top">
            <span className="text-muted small">계정이 없나요?</span>
            <Link to="/signup" className="btn btn-outline-secondary btn-sm">
              회원가입
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
