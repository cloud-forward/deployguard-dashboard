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
    { badge: 'OV', label: 'Overview',         path: '/dashboard',    exact: true },
    { badge: 'CL', label: 'Clusters',         path: '/clusters',     exact: true },
    { badge: 'SC', label: 'Scans',            path: '/scans',        exact: true },
    { badge: 'AG', label: 'Attack Graph',     path: '/attack-graph', exact: true },
    { badge: 'RO', label: 'Risk Optimaztion', path: '/risk',         exact: true },
    { badge: 'IV', label: 'Inventory',        path: inventoryHref,   exact: false, forceActive: isInventoryActive },
    { badge: 'RM', label: 'Runtime Monitoring', path: '/activity',   exact: true },
  ];


  return (
    <nav
      id="sidebarMenu"
      className="dg-sidebar d-md-block collapse"
      aria-label="메인 내비게이션"
    >
      <style>{`
        .dg-sidebar {
          background: rgba(11, 15, 26, 0.95);
          border-right: 1px solid var(--border-subtle);
          width: 72px;
          min-width: 72px;
          flex-shrink: 0;
          min-height: calc(100vh - 54px);
          position: sticky;
          top: 54px;
          align-self: flex-start;
          max-height: calc(100vh - 54px);
          overflow-y: auto;
          overflow-x: hidden;
          transition: width 0.22s ease;
        }
        .dg-sidebar:hover {
          width: 236px;
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
          color: var(--text-secondary);
          text-decoration: none;
          border-left: 3px solid transparent;
          white-space: nowrap;
          transition: background 0.15s ease, color 0.15s ease, border-color 0.15s ease;
        }
        .dg-sidebar-link:hover {
          background: rgba(59, 130, 246, 0.1);
          color: var(--text-accent);
          border-left-color: rgba(59, 130, 246, 0.35);
        }
        .dg-sidebar-link.is-active {
          border-left-color: var(--border-accent-blue);
          background: rgba(59, 130, 246, 0.15);
          color: var(--text-accent);
        }
        .dg-sidebar-badge {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 2rem;
          width: 2rem;
          height: 2rem;
          border-radius: 0.45rem;
          background: rgba(30, 41, 59, 0.92);
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
          background: rgba(30, 58, 95, 0.98);
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
