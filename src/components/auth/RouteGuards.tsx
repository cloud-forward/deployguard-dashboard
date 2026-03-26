import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../auth/AuthProvider';

export const RequireAuth: React.FC<React.PropsWithChildren> = ({ children }) => {
  const { isAuthenticated, isHydrated } = useAuth();
  const location = useLocation();

  if (!isHydrated) {
    return (
      <div className="min-vh-100 d-flex align-items-center justify-content-center bg-body-tertiary">
        <div className="text-center">
          <div className="spinner-border text-primary mb-3" role="status" aria-hidden="true" />
          <div className="text-muted">세션 확인 중…</div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return children ?? <Outlet />;
};

export const PublicOnlyRoute: React.FC<React.PropsWithChildren> = ({ children }) => {
  const { isAuthenticated, isHydrated } = useAuth();

  if (!isHydrated) {
    return (
      <div className="min-vh-100 d-flex align-items-center justify-content-center bg-body-tertiary">
        <div className="text-center">
          <div className="spinner-border text-primary mb-3" role="status" aria-hidden="true" />
          <div className="text-muted">세션 확인 중…</div>
        </div>
      </div>
    );
  }

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  return children ?? <Outlet />;
};
