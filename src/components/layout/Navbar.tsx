import React, { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useGetMeApiV1MeGet } from '../../api/generated/auth/auth';
import { useListClustersApiV1ClustersGet } from '../../api/generated/clusters/clusters';
import { useListClusterScansApiV1ClustersClusterIdScansGet } from '../../api/generated/scans/scans';
import { useAuth } from '../../auth/AuthProvider';
import type { ClusterScanListResponse } from '../../api/model';

/* ─── helpers ────────────────────────────────────────────────────────────── */

const isClusterScanListResponse = (v: unknown): v is ClusterScanListResponse =>
  Boolean(v && typeof v === 'object' && 'total' in v);

interface ClusterOption {
  id: string;
  name: string;
}

/* ─── per-cluster status pill ────────────────────────────────────────────── */

const ClusterScanPill: React.FC<ClusterOption> = ({ id, name }) => {
  const { data } = useListClusterScansApiV1ClustersClusterIdScansGet(id, {
    query: { enabled: Boolean(id), staleTime: 30_000 },
  });

  const items = isClusterScanListResponse(data) ? (data.items ?? []) : [];
  const latestStatus = (items[0]?.status as string | undefined) ?? '';

  let dotColor = '#6b7280';
  let statusText = '미연결';

  if (latestStatus === 'completed') {
    dotColor = '#22c55e';
    statusText = '스캔완료';
  } else if (latestStatus === 'failed') {
    dotColor = '#ef4444';
    statusText = '스캔실패';
  } else if (
    ['running', 'processing', 'queued', 'created', 'uploading'].includes(latestStatus)
  ) {
    dotColor = '#f59e0b';
    statusText = '스캔중';
  }

  const swallowPointerIntent = (
    event:
      | React.MouseEvent<HTMLDivElement>
      | React.PointerEvent<HTMLDivElement>
      | React.UIEvent<HTMLDivElement>,
  ) => {
    event.preventDefault();
    event.stopPropagation();
    if ('nativeEvent' in event && typeof event.nativeEvent === 'object') {
      const nativeEvent = event.nativeEvent as Event & { stopImmediatePropagation?: () => void };
      nativeEvent.stopImmediatePropagation?.();
    }
  };

  return (
    <div
      className="dg-scan-pill"
      aria-label={`${name} ${statusText}`}
      role="presentation"
      onClickCapture={swallowPointerIntent}
      onClick={swallowPointerIntent}
      onMouseDownCapture={swallowPointerIntent}
      onMouseUpCapture={swallowPointerIntent}
      onAuxClickCapture={swallowPointerIntent}
      onPointerDownCapture={swallowPointerIntent}
      onPointerUpCapture={swallowPointerIntent}
    >
      <span className="dg-scan-pill-name">{name}</span>
      <span className="dg-scan-pill-sep" aria-hidden="true">•</span>
      <span
        className="dg-scan-pill-dot"
        aria-hidden="true"
        style={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          display: 'inline-block',
          backgroundColor: dotColor,
        }}
      />
      <span className="dg-scan-pill-status" style={{ color: dotColor }}>{statusText}</span>
    </div>
  );
};

/* ─── navbar ─────────────────────────────────────────────────────────────── */

const Navbar: React.FC = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { data: clustersResponse } = useListClustersApiV1ClustersGet();
  const { data: meResponse } = useGetMeApiV1MeGet({
    query: {
      enabled: Boolean(user),
      retry: false,
      staleTime: 60_000,
    },
  });

  const clusters = useMemo<ClusterOption[]>(() => {
    const list = Array.isArray(clustersResponse) ? clustersResponse : [];
    return list.slice(0, 3).map((c) => ({ id: c.id, name: c.name }));
  }, [clustersResponse]);
  const canonicalUser = meResponse && typeof meResponse === 'object' && 'email' in meResponse
    ? meResponse
    : null;
  const displayUser = canonicalUser ?? user;
  const displayName = displayUser?.name?.trim() || displayUser?.email || '로그인 사용자';

  return (
    <header className="dg-navbar navbar navbar-dark sticky-top flex-md-nowrap">
      <style>{`
        .dg-navbar {
          background: rgba(11, 15, 26, 0.9);
          border-bottom: 1px solid var(--border-subtle);
          padding: 0;
          height: 54px;
          min-height: 54px;
          box-shadow: 0 1px 0 rgba(255,255,255,0.04);
        }
        .dg-navbar .dg-brand {
          display: inline-flex;
          align-items: center;
          gap: 0.65rem;
          padding: 0 1rem;
          height: 54px;
          min-width: 64px;
          color: var(--text-primary);
          text-decoration: none;
          font-weight: 600;
          border-right: 1px solid var(--border-subtle);
          flex-shrink: 0;
          transition: background 0.15s;
        }
        .dg-navbar .dg-brand:hover {
          background: rgba(59,130,246,0.08);
        }
        .dg-navbar .dg-brand-mark {
          width: 1.85rem;
          height: 1.85rem;
          border-radius: 0.5rem;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(140deg, #3b82f6, #6366f1);
          color: #fff;
          font-size: 0.78rem;
          font-weight: 800;
          letter-spacing: 0.06em;
          flex-shrink: 0;
        }
        .dg-navbar .dg-brand-text {
          color: var(--text-primary);
          font-size: 0.95rem;
          font-weight: 700;
          line-height: 1;
          white-space: nowrap;
        }
        .dg-navbar .dg-brand-sub {
          color: var(--text-secondary);
          font-size: 0.62rem;
          line-height: 1;
          display: block;
          margin-top: 0.18rem;
          letter-spacing: 0.04em;
          white-space: nowrap;
        }
        .dg-navbar .dg-navbar-right {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0 1rem;
          flex-wrap: wrap;
          margin-left: auto;
          overflow: hidden;
        }
        .dg-user-meta {
          display: inline-flex;
          align-items: center;
          gap: 0.6rem;
          padding-left: 0.5rem;
          margin-left: 0.25rem;
          border-left: 1px solid rgba(255,255,255,0.12);
        }
        .dg-user-email {
          color: var(--text-primary);
          font-size: 0.78rem;
          max-width: 220px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .dg-scan-pill {
          display: inline-flex;
          align-items: center;
          gap: 0.3rem;
          padding: 0.2rem 0.65rem;
          border-radius: 999px;
          background: rgba(255,255,255,0.04);
          border: 1px solid var(--border-subtle);
          font-size: 0.72rem;
          color: rgba(148, 163, 184, 0.7);
          white-space: nowrap;
          line-height: 1.4;
          cursor: default;
          user-select: none;
          transition: background 0.18s ease, border-color 0.18s ease, box-shadow 0.18s ease;
        }
        .dg-scan-pill:hover {
          background: rgba(255,255,255,0.065);
          border-color: rgba(148, 163, 184, 0.22);
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.03);
        }
        .dg-scan-pill-name {
          color: rgba(226, 232, 240, 0.92);
          font-weight: 600;
        }
        .dg-scan-pill-sep {
          color: var(--text-muted);
          font-size: 0.6rem;
        }
        .dg-scan-pill-dot {
          font-size: 0.55rem;
          line-height: 1;
        }
        .dg-scan-pill-status {
          color: var(--text-secondary);
        }
        .dg-navbar .navbar-toggler {
          border: none;
          border-radius: 0.45rem;
          width: 2.2rem;
          height: 2.2rem;
          margin: 0 0.5rem;
          transition: background 0.2s;
        }
        .dg-navbar .navbar-toggler:hover {
          background: rgba(255,255,255,0.1);
        }
        .dg-mobile-actions {
          margin-left: auto;
          padding-right: 0.75rem;
        }
      `}</style>

      <Link className="dg-brand navbar-brand" to="/dashboard">
        <div className="d-flex align-items-center gap-2">
          <div className="dg-brand-mark" aria-hidden="true">DG</div>
          <div className="d-flex align-items-baseline gap-2">
            <span className="dg-brand-text fw-bold text-white">DeployGuard</span>
            <small className="dg-brand-sub" style={{ color: '#9ca3af' }}>공격 경로 분석 엔진</small>
          </div>
        </div>
      </Link>

      <button
        className="navbar-toggler position-absolute d-md-none collapsed"
        type="button"
        data-bs-toggle="collapse"
        data-bs-target="#sidebarMenu"
        aria-controls="sidebarMenu"
        aria-expanded="false"
        aria-label="내비게이션 열기"
      >
        <span className="navbar-toggler-icon" />
      </button>

      <div className="dg-mobile-actions d-md-none">
        <button
          type="button"
          className="btn btn-sm dg-dashboard-action-btn dg-dashboard-action-btn--secondary"
          onClick={() => {
            logout();
            navigate('/login', { replace: true });
          }}
        >
          로그아웃
        </button>
      </div>

      {(clusters.length > 0 || user) && (
        <div className="dg-navbar-right d-none d-md-flex">
          {clusters.map((c) => (
            <ClusterScanPill key={c.id} id={c.id} name={c.name} />
          ))}
          <div className="dg-user-meta">
            <span className="dg-user-email" title={displayUser?.email ?? displayName}>
              {displayName}
            </span>
            <button
              type="button"
              className="btn btn-sm dg-dashboard-action-btn dg-dashboard-action-btn--secondary"
              onClick={() => {
                logout();
                navigate('/login', { replace: true });
              }}
            >
              로그아웃
            </button>
          </div>
        </div>
      )}
    </header>
  );
};

export default Navbar;
