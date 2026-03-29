import React, { useMemo, useState, useEffect } from 'react';
import { NavLink, useMatch, useLocation } from 'react-router-dom';
import { Settings, ChevronDown } from 'lucide-react';
import { useListClustersApiV1ClustersGet } from '../../api/generated/clusters/clusters';
import LlmSettingsModal from './LlmSettingsModal';

const Sidebar: React.FC = () => {
  const inventoryMatch = useMatch('/clusters/:clusterId/inventory');
  const isInventoryActive = inventoryMatch !== null;
  const location = useLocation();
  const isScansActive = location.pathname === '/scans';
  const isClustersRouteActive = location.pathname.startsWith('/clusters');

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
  const [isClustersOpen, setIsClustersOpen] = useState(isScansActive);

  useEffect(() => {
    if (isScansActive) {
      setIsClustersOpen(true);
    }
  }, [isScansActive]);

  const navItems = [
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
        .dg-sidebar-chevron {
          margin-left: auto;
          flex-shrink: 0;
          opacity: 0;
          transition: opacity 0.18s ease, transform 0.22s ease;
          color: var(--text-secondary);
        }
        .dg-sidebar:hover .dg-sidebar-chevron {
          opacity: 1;
        }
        .dg-sidebar-chevron.is-open {
          transform: rotate(180deg);
        }
        .dg-sidebar-sub-list {
          list-style: none;
          padding: 0;
          margin: 0;
          display: flex;
          flex-direction: column;
          gap: 1px;
          overflow: hidden;
        }
        .dg-sidebar-sub-link {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 0.5rem 0.9rem 0.5rem 1.1rem;
          color: var(--text-secondary);
          text-decoration: none;
          border-left: 3px solid transparent;
          white-space: nowrap;
          font-size: 0.8rem;
          transition: background 0.15s ease, color 0.15s ease, border-color 0.15s ease;
        }
        .dg-sidebar-sub-link:hover {
          background: rgba(59, 130, 246, 0.1);
          color: var(--text-accent);
          border-left-color: rgba(59, 130, 246, 0.35);
        }
        .dg-sidebar-sub-link.is-active {
          border-left-color: var(--border-accent-blue);
          background: rgba(59, 130, 246, 0.15);
          color: var(--text-accent);
        }
        .dg-sidebar-sub-badge {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 1.7rem;
          width: 1.7rem;
          height: 1.7rem;
          border-radius: 0.35rem;
          background: rgba(30, 41, 59, 0.7);
          color: #7dd3fc;
          font-size: 0.6rem;
          font-weight: 700;
          letter-spacing: 0.03em;
          flex-shrink: 0;
          border: 1px solid #334155;
          transition: background 0.15s ease, color 0.15s ease, border-color 0.15s ease;
        }
        .dg-sidebar-sub-link.is-active .dg-sidebar-sub-badge {
          background: var(--dg-accent, #3b82f6);
          color: #fff;
          border-color: #2563eb;
        }
        .dg-sidebar-sub-link:hover .dg-sidebar-sub-badge {
          background: rgba(30, 58, 95, 0.98);
          color: #93c5fd;
          border-color: #3b82f6;
        }
      `}</style>
      <div className="dg-sidebar-shell">
        <ul className="dg-sidebar-list dg-sidebar-list--main">
          {/* Overview */}
          <li>
            <NavLink
              to="/dashboard"
              end
              className={({ isActive }) => `dg-sidebar-link${isActive ? ' is-active' : ''}`}
            >
              <span className="dg-sidebar-badge" aria-hidden="true">OV</span>
              <span className="dg-sidebar-label">Overview</span>
            </NavLink>
          </li>

          {/* Clusters dropdown */}
          <li>
            <button
              type="button"
              className={`dg-sidebar-link dg-sidebar-action${isClustersRouteActive || isScansActive ? ' is-active' : ''}`}
              onClick={() => setIsClustersOpen(prev => !prev)}
              aria-expanded={isClustersOpen}
            >
              <span className="dg-sidebar-badge" aria-hidden="true">CL</span>
              <span className="dg-sidebar-label">Cluster & Scan</span>
              <ChevronDown
                size={14}
                className={`dg-sidebar-chevron${isClustersOpen ? ' is-open' : ''}`}
                aria-hidden="true"
              />
            </button>
            {isClustersOpen && (
              <ul className="dg-sidebar-sub-list">
                <li>
                  <NavLink
                    to="/clusters"
                    end
                    className={({ isActive }) => `dg-sidebar-sub-link${isActive ? ' is-active' : ''}`}
                  >
                    <span className="dg-sidebar-sub-badge" aria-hidden="true">CL</span>
                    <span className="dg-sidebar-label">Clusters</span>
                  </NavLink>
                </li>
                <li>
                  <NavLink
                    to="/scans"
                    end
                    className={({ isActive }) => `dg-sidebar-sub-link${isActive ? ' is-active' : ''}`}
                  >
                    <span className="dg-sidebar-sub-badge" aria-hidden="true">SC</span>
                    <span className="dg-sidebar-label">Scans</span>
                  </NavLink>
                </li>
              </ul>
            )}
          </li>

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
