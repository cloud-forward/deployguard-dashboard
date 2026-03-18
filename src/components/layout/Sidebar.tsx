import React from 'react';
import { NavLink } from 'react-router-dom';

const navItems = [
  { path: '/dashboard', label: 'Dashboard', icon: 'DB' },
  { path: '/attack-graph', label: 'Attack Graph', icon: 'AG' },
  { path: '/clusters', label: 'Clusters', icon: 'CL' },
  { path: '/scans', label: 'Scans', icon: 'SC' },
  { path: '/risk', label: 'Risk Optimization', icon: 'RO' },
];

const Sidebar: React.FC = () => {
  return (
    <nav
      id="sidebarMenu"
      className="col-md-3 col-lg-2 d-md-block collapse dg-sidebar"
      style={{ minHeight: '100vh' }}
    >
      <style>{`
        .dg-sidebar {
          background: linear-gradient(180deg, #f8fafd 0%, #eef2f7 100%);
          border-right: 1px solid #e5e7eb;
        }
        .dg-sidebar-shell {
          padding-top: 1.25rem;
          padding-bottom: 1.25rem;
        }
        .dg-sidebar-heading {
          font-size: 0.72rem;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: #6c757d;
          margin: 0 1rem 0.75rem;
          font-weight: 700;
        }
        .dg-sidebar-list {
          gap: 0.35rem;
        }
        .dg-sidebar-link {
          border-radius: 0.85rem;
          margin: 0 0.45rem;
          padding: 0.58rem 0.78rem;
          color: #334155 !important;
          display: flex;
          align-items: center;
          gap: 0.65rem;
          font-size: 0.98rem;
          font-weight: 500;
          letter-spacing: 0.01em;
          line-height: 1.25rem;
          transition: all 0.2s ease;
          border: 1px solid transparent;
        }
        .dg-sidebar-link:hover {
          background: rgba(99, 102, 241, 0.07);
          color: #1e293b !important;
          transform: translateY(-1px);
          border-color: rgba(99, 102, 241, 0.12);
        }
        .dg-sidebar-link.is-active {
          background: linear-gradient(135deg, #4f46e5, #4338ca);
          color: #ffffff !important;
          border-color: #3730a3;
          box-shadow: 0 6px 20px -10px rgba(79, 70, 229, 0.6);
        }
        .dg-sidebar-link.is-active .dg-sidebar-icon,
        .dg-sidebar-link:hover .dg-sidebar-icon {
          background: #ffffff22;
          color: #ffffff;
          border-color: rgba(255, 255, 255, 0.35);
        }
        .dg-sidebar-link.is-active .dg-sidebar-text {
          font-weight: 600;
        }
        .dg-sidebar-icon {
          width: 1.95rem;
          height: 1.95rem;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border-radius: 0.5rem;
          background: #e2e8f0;
          color: #334155;
          font-size: 0.76rem;
          font-weight: 700;
          letter-spacing: 0.02em;
          border: 1px solid #cbd5f5;
          font-family: inherit;
          transition: all 0.2s ease;
        }
        .dg-sidebar-link.active:focus-visible,
        .dg-sidebar-link:focus-visible {
          outline: 2px solid #4f46e5;
          outline-offset: 2px;
        }
      `}</style>
      <div className="position-sticky pt-3 dg-sidebar-shell">
        <div className="mb-3">
          <p className="dg-sidebar-heading">Navigation</p>
        </div>
        <ul className="nav flex-column dg-sidebar-list">
          {navItems.map((item) => (
            <li className="nav-item" key={item.path}>
              <NavLink
                to={item.path}
                className={({ isActive }) =>
                  `nav-link dg-sidebar-link ${isActive ? 'is-active' : ''}`
                }
              >
                <span className="dg-sidebar-icon" aria-hidden="true">
                  {item.icon}
                </span>
                <span className="dg-sidebar-text">{item.label}</span>
              </NavLink>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  );
};

export default Sidebar;
