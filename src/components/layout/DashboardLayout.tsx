import React from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Navbar from './Navbar';

const DashboardLayout: React.FC = () => {
  return (
    <div className="dg-dashboard-shell">
      <style>{`
        .dg-dashboard-shell {
          min-height: 100vh;
          background: var(--dg-bg-primary, #0a1021);
          color: var(--dg-text-primary, #f9fafb);
        }
        .dg-content-frame {
          display: flex;
          align-items: stretch;
          min-height: calc(100vh - 54px);
        }
        .dg-dashboard-main {
          flex: 1;
          min-width: 0;
          padding: 1.25rem 1.25rem 1.5rem;
          background: linear-gradient(180deg, rgba(10,16,33,0.97), rgba(14,21,38,0.96));
          border-left: 1px solid var(--dg-border, #1f2937);
        }
        .dg-dashboard-panel {
          background: var(--dg-bg-card, #111827);
          border: 1px solid var(--dg-border, #1f2937);
          border-radius: 14px;
          padding: 1.25rem 1.25rem 1.5rem;
          min-height: calc(100vh - 54px - 2.5rem);
          box-shadow: 0 18px 35px -32px rgba(0,0,0,0.8);
        }
        @media (max-width: 767.98px) {
          .dg-dashboard-main {
            padding: 0.85rem 0.8rem 1.2rem;
            border-left: none;
          }
          .dg-dashboard-panel {
            border-radius: 12px 12px 0 0;
            border-bottom: none;
            min-height: auto;
            padding: 0.95rem 0.9rem 1.2rem;
          }
        }
      `}</style>
      <Navbar />
      <div className="dg-content-frame">
        <Sidebar />
        <main className="dg-dashboard-main">
          <div className="dg-dashboard-panel">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;
