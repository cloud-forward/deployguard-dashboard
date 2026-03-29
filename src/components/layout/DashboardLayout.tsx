import React from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Navbar from './Navbar';

const DashboardLayout: React.FC = () => {
  return (
    <div className="dg-dashboard-shell">
      <style>{`
        .dg-dashboard-shell {
          --dg-content-max-width: 1260px;
          --dg-content-padding-x: clamp(1rem, 3.8vw, 4rem);
          --dg-content-padding-y: clamp(1rem, 2.1vw, 1.9rem);
          min-height: 100vh;
          background: var(--dg-bg-primary, #0a1021);
          color: var(--dg-text-primary, #f9fafb);
        }
        .dg-content-frame {
          display: flex;
          align-items: stretch;
          min-height: calc(100vh - 54px);
          overflow: visible;
        }
        .dg-dashboard-main {
          flex: 1;
          min-width: 0;
          padding: var(--dg-content-padding-y) var(--dg-content-padding-x) calc(var(--dg-content-padding-y) + 0.25rem);
          background: linear-gradient(180deg, rgba(10,16,33,0.97), rgba(14,21,38,0.96));
          border-left: 1px solid var(--dg-border, #1f2937);
        }
        .dg-dashboard-panel {
          background: var(--dg-bg-card, #111827);
          border: 1px solid var(--dg-border, #1f2937);
          border-radius: 14px;
          width: min(100%, var(--dg-content-max-width));
          margin: 0 auto;
          padding: clamp(1rem, 1.45vw, 1.35rem) clamp(1rem, 1.7vw, 1.7rem) clamp(1.15rem, 1.75vw, 1.55rem);
          min-height: calc(100vh - 54px - 2.5rem);
          max-height: calc(100vh - 54px - 2.5rem);
          overflow-y: auto;
          box-shadow: 0 18px 35px -32px rgba(0,0,0,0.8);
        }
        .dg-page-shell {
          display: flex;
          flex-direction: column;
          gap: 1rem;
          min-height: 100%;
        }
        .dg-page-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
          gap: 1rem;
          flex-wrap: wrap;
          margin: 0;
        }
        .dg-page-heading {
          display: flex;
          align-items: baseline;
          gap: 0.75rem;
          flex-wrap: wrap;
          min-width: 0;
        }
        .dg-page-header > :not(.dg-page-heading) {
          align-self: flex-end;
        }
        .dg-page-title {
          margin: 0;
          font-size: clamp(1.7rem, 1.5rem + 0.45vw, 2rem);
          font-weight: 700;
          line-height: 1.2;
          color: rgba(226, 232, 240, 1);
        }
        .dg-page-description {
          margin: 0;
          font-size: 0.92rem;
          line-height: 1.35;
          color: rgba(148, 163, 184, 0.7);
          max-width: none;
        }
        @media (min-width: 1200px) {
          .dg-dashboard-shell {
            --dg-content-padding-x: clamp(1.5rem, 4.8vw, 4.5rem);
          }
        }
        @media (min-width: 1400px) {
          .dg-dashboard-shell {
            --dg-content-max-width: 1320px;
            --dg-content-padding-x: clamp(2rem, 6vw, 5.5rem);
          }
        }
        @media (max-width: 1199.98px) {
          .dg-dashboard-shell {
            --dg-content-max-width: 100%;
            --dg-content-padding-x: clamp(0.95rem, 2.8vw, 2rem);
          }
        }
        @media (max-width: 767.98px) {
          .dg-dashboard-shell {
            --dg-content-padding-x: 0.8rem;
            --dg-content-padding-y: 0.85rem;
          }
          .dg-dashboard-main {
            border-left: none;
          }
          .dg-dashboard-panel {
            border-radius: 12px 12px 0 0;
            border-bottom: none;
            min-height: auto;
            max-height: none;
            overflow-y: visible;
            width: 100%;
            padding: 0.95rem 0.9rem 1.2rem;
          }
          .dg-page-shell {
            gap: 0.85rem;
            min-height: auto;
          }
          .dg-page-heading {
            flex-direction: column;
            align-items: flex-start;
            gap: 0.2rem;
          }
          .dg-page-title {
            font-size: 1.35rem;
          }
          .dg-page-description {
            font-size: 0.85rem;
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
