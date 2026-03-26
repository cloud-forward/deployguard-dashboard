import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useSignupApiV1AuthSignupPost } from '../api/generated/auth/auth';
import type { SignupResponse } from '../api/model';

const isSignupResponse = (value: unknown): value is SignupResponse =>
  Boolean(value && typeof value === 'object' && 'user' in value);

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

const SignupPage: React.FC = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [formError, setFormError] = useState('');

  const { mutate: signupMutation, isPending } = useSignupApiV1AuthSignupPost();

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError('');

    if (password !== confirmPassword) {
      setFormError('비밀번호 확인이 일치하지 않습니다.');
      return;
    }

    signupMutation(
      {
        data: {
          email: email.trim(),
          password,
        },
      },
      {
        onSuccess: (response) => {
          if (!isSignupResponse(response)) {
            setFormError('회원가입 응답 형식을 확인할 수 없습니다.');
            return;
          }

          navigate('/login', {
            replace: true,
            state: {
              signupSuccess: true,
              prefillEmail: email.trim(),
            },
          });
        },
        onError: (error) => {
          setFormError(getErrorMessage(error, '회원가입에 실패했습니다.'));
        },
      },
    );
  };

  return (
    <div className="min-vh-100 d-flex align-items-center justify-content-center bg-body-tertiary px-3">
      <div className="card shadow-sm border-0" style={{ width: '100%', maxWidth: 480 }}>
        <div className="card-body p-4 p-md-5">
          <div className="mb-4">
            <h1 className="h3 mb-2 fw-bold">회원가입</h1>
            <p className="text-muted mb-0">생성된 계정으로 로그인 후 기존 대시보드를 사용할 수 있습니다.</p>
          </div>

          {formError ? (
            <div className="alert alert-danger" role="alert">
              {formError}
            </div>
          ) : null}

          <form onSubmit={handleSubmit} className="d-flex flex-column gap-3">
            <div>
              <label htmlFor="signup-email" className="form-label">
                이메일
              </label>
              <input
                id="signup-email"
                type="email"
                className="form-control"
                autoComplete="username"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </div>

            <div>
              <label htmlFor="signup-password" className="form-label">
                비밀번호
              </label>
              <input
                id="signup-password"
                type="password"
                className="form-control"
                autoComplete="new-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
            </div>

            <div>
              <label htmlFor="signup-password-confirm" className="form-label">
                비밀번호 확인
              </label>
              <input
                id="signup-password-confirm"
                type="password"
                className="form-control"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                required
              />
            </div>

            <button type="submit" className="btn btn-primary w-100" disabled={isPending}>
              {isPending ? '가입 중…' : '회원가입'}
            </button>
          </form>

          <div className="d-flex justify-content-between align-items-center mt-4 pt-3 border-top">
            <span className="text-muted small">이미 계정이 있나요?</span>
            <Link to="/login" className="btn btn-outline-secondary btn-sm">
              로그인으로 이동
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SignupPage;
