import React, { useEffect, useMemo, useState } from 'react';
import { NavLink, useMatch } from 'react-router-dom';
import { ChevronDown, ChevronUp, Settings } from 'lucide-react';
import { useListClustersApiV1ClustersGet } from '../../api/generated/clusters/clusters';
import LlmSettingsModal from './LlmSettingsModal';

type SidebarLeafItem = {
  badge: string;
  label: string;
  path: string;
  exact: boolean;
  forceActive?: boolean;
};

type SidebarItem = SidebarLeafItem & {
  children?: SidebarLeafItem[];
};

const Sidebar: React.FC = () => {
  const inventoryMatch = useMatch('/clusters/:clusterId/inventory');
  const clustersMatch = useMatch('/clusters');
  const scansMatch = useMatch('/scans');
  const riskMatch = useMatch('/risk');
  const clusterRiskMatch = useMatch('/clusters/:clusterId/risk');
  const remediationMatch = useMatch('/remediation');
  const isInventoryActive = inventoryMatch !== null;
  const isWorkloadSecurityActive = clustersMatch !== null || scansMatch !== null;
  const isRiskOptimizationActive =
    riskMatch !== null || clusterRiskMatch !== null || remediationMatch !== null;

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
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({ WS: true, RO: true });
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(false);

  useEffect(() => {
    if (isWorkloadSecurityActive) {
      setOpenGroups((prev) => ({ ...prev, WS: true }));
    }
  }, [isWorkloadSecurityActive]);

  useEffect(() => {
    if (isRiskOptimizationActive) {
      setOpenGroups((prev) => ({ ...prev, RO: true }));
    }
  }, [isRiskOptimizationActive]);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(max-width: 767.98px)');

    const syncSidebarExpanded = (event?: MediaQueryListEvent) => {
      const matches = event ? event.matches : mediaQuery.matches;
      setIsSidebarExpanded(matches);
    };

    syncSidebarExpanded();
    mediaQuery.addEventListener('change', syncSidebarExpanded);

    return () => {
      mediaQuery.removeEventListener('change', syncSidebarExpanded);
    };
  }, []);

  const navItems: SidebarItem[] = [
    { badge: 'OV', label: 'Overview',         path: '/dashboard',    exact: true },
    {
      badge: 'WS',
      label: 'Workload Security',
      path: '/clusters',
      exact: true,
      forceActive: isWorkloadSecurityActive,
      children: [
        { badge: 'CL', label: 'Clusters', path: '/clusters', exact: true },
        { badge: 'SC', label: 'Scans', path: '/scans', exact: true },
      ],
    },
    { badge: 'AG', label: 'Attack Graph',     path: '/attack-graph', exact: true },
    {
      badge: 'RO',
      label: 'Risk Optimization',
      path: '/risk',
      exact: true,
      forceActive: isRiskOptimizationActive,
      children: [
        { badge: 'AN', label: 'Analysis',    path: '/risk',         exact: true },
        { badge: 'RE', label: 'Remediation', path: '/remediation',  exact: true },
      ],
    },
    { badge: 'IV', label: 'Inventory',        path: inventoryHref,   exact: false, forceActive: isInventoryActive },
    { badge: 'RM', label: 'Runtime Monitoring', path: '/activity',   exact: true },
  ];


  return (
    <nav
      id="sidebarMenu"
      className="dg-sidebar d-md-block collapse"
      aria-label="메인 내비게이션"
      onMouseEnter={() => setIsSidebarExpanded(true)}
      onMouseLeave={() => setIsSidebarExpanded(window.matchMedia('(max-width: 767.98px)').matches)}
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
        .dg-sidebar-item-children {
          list-style: none;
          padding: 0;
          margin: 0;
          display: flex;
          flex-direction: column;
          gap: 1px;
        }
        .dg-sidebar-group-row {
          display: flex;
          align-items: stretch;
        }
        .dg-sidebar-group-row .dg-sidebar-link {
          flex: 1;
          min-width: 0;
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
        .dg-sidebar-toggle {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 2.2rem;
          margin-left: auto;
          border: 0;
          border-left: 1px solid rgba(148, 163, 184, 0.08);
          background: transparent;
          color: rgba(148, 163, 184, 0.72);
          opacity: 0;
          transition: background 0.15s ease, color 0.15s ease, opacity 0.18s ease;
        }
        .dg-sidebar-group-row:hover .dg-sidebar-toggle,
        .dg-sidebar-toggle:focus-visible {
          opacity: 1;
        }
        .dg-sidebar-toggle:hover,
        .dg-sidebar-toggle:focus-visible {
          background: rgba(59, 130, 246, 0.08);
          color: rgba(226, 232, 240, 0.96);
          outline: none;
        }
        .dg-sidebar-link--child {
          padding-left: 1.65rem;
          color: rgba(148, 163, 184, 0.62);
        }
        .dg-sidebar-link--child:hover {
          color: rgba(226, 232, 240, 0.92);
        }
        .dg-sidebar-link--child.is-active {
          color: rgba(226, 232, 240, 0.96);
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
        .dg-sidebar-badge--child {
          min-width: 1.65rem;
          width: 1.65rem;
          height: 1.65rem;
          font-size: 0.58rem;
          color: rgba(125, 211, 252, 0.72);
          border-color: rgba(51, 65, 85, 0.85);
          background: rgba(30, 41, 59, 0.7);
        }
        .dg-sidebar-link--child:hover .dg-sidebar-badge--child {
          color: #93c5fd;
          background: rgba(30, 58, 95, 0.86);
          border-color: #3b82f6;
        }
        .dg-sidebar-link--child.is-active .dg-sidebar-badge--child {
          background: rgba(59, 130, 246, 0.82);
          color: #fff;
          border-color: #2563eb;
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
        .dg-sidebar-label--child {
          font-size: 0.76rem;
          opacity: 0.82;
        }
        .dg-sidebar-link--child.is-active .dg-sidebar-label--child {
          opacity: 0.96;
        }
        .dg-sidebar:hover .dg-sidebar-label {
          opacity: 1;
        }
        .dg-sidebar:hover .dg-sidebar-toggle {
          opacity: 1;
        }
        @media (max-width: 767.98px) {
          .dg-sidebar-toggle {
            opacity: 1 !important;
          }
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
              {item.children ? (
                <>
                  <div className="dg-sidebar-group-row">
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
                    <button
                      type="button"
                      className="dg-sidebar-toggle"
                      aria-label={`${(openGroups[item.badge] ?? true) ? 'Collapse' : 'Expand'} ${item.label}`}
                      aria-expanded={openGroups[item.badge] ?? true}
                      aria-controls={`${item.badge.toLowerCase()}-submenu`}
                      onClick={() =>
                        setOpenGroups((prev) => ({
                          ...prev,
                          [item.badge]: !(prev[item.badge] ?? true),
                        }))
                      }
                    >
                      {isSidebarExpanded ? (
                        (openGroups[item.badge] ?? true) ? (
                          <ChevronUp size={14} aria-hidden="true" />
                        ) : (
                          <ChevronDown size={14} aria-hidden="true" />
                        )
                      ) : null}
                    </button>
                  </div>
                  {(openGroups[item.badge] ?? true) ? (
                    <ul className="dg-sidebar-item-children" id={`${item.badge.toLowerCase()}-submenu`}>
                      {item.children.map((child) => (
                        <li key={child.badge}>
                          <NavLink
                            to={child.path}
                            end={child.exact}
                            className={({ isActive }) =>
                              `dg-sidebar-link dg-sidebar-link--child${isActive ? ' is-active' : ''}`
                            }
                          >
                            <span className="dg-sidebar-badge dg-sidebar-badge--child" aria-hidden="true">
                              {child.badge}
                            </span>
                            <span className="dg-sidebar-label dg-sidebar-label--child">{child.label}</span>
                          </NavLink>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </>
              ) : (
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
              )}
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
