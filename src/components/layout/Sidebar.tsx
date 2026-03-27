import React, { useMemo, useState } from 'react';
import { NavLink, useMatch } from 'react-router-dom';
import { Settings } from 'lucide-react';
import { useListClustersApiV1ClustersGet } from '../../api/generated/clusters/clusters';
import LlmSettingsModal from './LlmSettingsModal';

const Sidebar: React.FC = () => {
  const inventoryMatch = useMatch('/clusters/:clusterId/inventory');
  const isInventoryActive = inventoryMatch !== null;

  const { data: clustersResponse } = useListClustersApiV1ClustersGet();
  const firstClusterId = useMemo(() => {
    const list = Array.isArray(clustersResponse) ? clustersResponse : [];
    return list[0]?.id ?? '';
  }, [clustersResponse]);

  const inventoryHref = inventoryMatch
    ? `/clusters/${inventoryMatch.params.clusterId}/inventory`
    : firstClusterId
      ? `/clusters/${firstClusterId}/inventory`
      : '/clusters';
  const [isLlmSettingsOpen, setIsLlmSettingsOpen] = useState(false);

  const navItems = [
    { badge: 'OV', label: '개요',            path: '/dashboard',    exact: true },
    { badge: 'AG', label: '공격 경로 그래프', path: '/attack-graph', exact: true },
    { badge: 'CL', label: '클러스터',         path: '/clusters',     exact: true },
    { badge: 'SC', label: '스캐너',           path: '/scans',        exact: true },
    { badge: 'RO', label: '위험 최적화',      path: '/risk',         exact: true },
    { badge: 'IV', label: '인벤토리',         path: inventoryHref,   exact: false, forceActive: isInventoryActive },
  ];

  return (
    <nav
      id="sidebarMenu"
      className="dg-sidebar d-md-block collapse"
      aria-label="메인 내비게이션"
    >
      <style>{`
        .dg-sidebar {
          background: #0d1b2a;
          border-right: 1px solid var(--dg-border, #1f2937);
          width: 64px;
          min-width: 64px;
          flex-shrink: 0;
          min-height: calc(100vh - 54px);
          overflow: hidden;
          transition: width 0.22s ease;
        }
        .dg-sidebar:hover {
          width: 220px;
        }
        @media (max-width: 767.98px) {
          .dg-sidebar {
            width: 100%;
            min-width: 0;
          }
          .dg-sidebar-label {
            opacity: 1 !important;
          }
        }
        .dg-sidebar-shell {
          padding: 0.75rem 0;
          min-height: calc(100vh - 54px);
          display: flex;
          flex-direction: column;
        }
        .dg-sidebar-list {
          list-style: none;
          padding: 0;
          margin: 0;
          display: flex;
          flex-direction: column;
          gap: 1px;
        }
        .dg-sidebar-list--main {
          flex: 1;
        }
        .dg-sidebar-link {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 0.62rem 0.9rem;
          color: #64748b;
          text-decoration: none;
          border-left: 3px solid transparent;
          white-space: nowrap;
          transition: background 0.15s ease, color 0.15s ease, border-color 0.15s ease;
        }
        .dg-sidebar-link:hover {
          background: rgba(59, 130, 246, 0.08);
          color: #cbd5e1;
          border-left-color: rgba(59, 130, 246, 0.35);
        }
        .dg-sidebar-link.is-active {
          border-left-color: var(--dg-accent, #3b82f6);
          background: rgba(59, 130, 246, 0.14);
          color: #f9fafb;
        }
        .dg-sidebar-badge {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 2rem;
          width: 2rem;
          height: 2rem;
          border-radius: 0.45rem;
          background: #1e2d3d;
          color: #7dd3fc;
          font-size: 0.67rem;
          font-weight: 700;
          letter-spacing: 0.03em;
          flex-shrink: 0;
          border: 1px solid #334155;
          transition: background 0.15s ease, color 0.15s ease, border-color 0.15s ease;
        }
        .dg-sidebar-link.is-active .dg-sidebar-badge {
          background: var(--dg-accent, #3b82f6);
          color: #fff;
          border-color: #2563eb;
        }
        .dg-sidebar-link:hover .dg-sidebar-badge {
          background: #1e3a5f;
          color: #93c5fd;
          border-color: #3b82f6;
        }
        .dg-sidebar-label {
          font-size: 0.83rem;
          font-weight: 500;
          letter-spacing: 0.01em;
          line-height: 1.2;
          opacity: 0;
          transition: opacity 0.18s ease;
          pointer-events: none;
        }
        .dg-sidebar:hover .dg-sidebar-label {
          opacity: 1;
        }
        .dg-sidebar-divider {
          height: 1px;
          background: var(--dg-border, #1f2937);
          margin: 0.5rem 0.9rem;
          opacity: 0.6;
        }
        .dg-sidebar-action {
          width: 100%;
          background: transparent;
          border: 0;
          text-align: left;
        }
      `}</style>
      <div className="dg-sidebar-shell">
        <ul className="dg-sidebar-list dg-sidebar-list--main">
          {navItems.map((item) => (
            <li key={item.badge}>
              <NavLink
                to={item.path}
                end={item.exact}
                className={({ isActive }) =>
                  `dg-sidebar-link${(item.forceActive ?? isActive) ? ' is-active' : ''}`
                }
              >
                <span className="dg-sidebar-badge" aria-hidden="true">
                  {item.badge}
                </span>
                <span className="dg-sidebar-label">{item.label}</span>
              </NavLink>
            </li>
          ))}
        </ul>
        <div className="dg-sidebar-divider" />
        <ul className="dg-sidebar-list">
          <li>
            <button
              type="button"
              className="dg-sidebar-link dg-sidebar-action"
              onClick={() => setIsLlmSettingsOpen(true)}
            >
              <span className="dg-sidebar-badge" aria-hidden="true">
                <Settings size={15} />
              </span>
              <span className="dg-sidebar-label">LLM 설정</span>
            </button>
          </li>
        </ul>
      </div>
      <LlmSettingsModal isOpen={isLlmSettingsOpen} onClose={() => setIsLlmSettingsOpen(false)} />
    </nav>
  );
};

export default Sidebar;
