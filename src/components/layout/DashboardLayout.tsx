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
          background: radial-gradient(circle at 0 0, #f8fbff 0%, #f2f5f9 36%, #f6f7fb 100%);
          color: #111827;
        }
        .dg-dashboard-shell .dg-dashboard-frame {
          display: flex;
          flex-direction: column;
          min-height: calc(100vh - 58px);
        }
        .dg-dashboard-shell .dg-dashboard-row {
          margin: 0;
          padding: 0;
          flex: 1;
          --bs-gutter-x: 0;
          --bs-gutter-y: 0;
          align-items: stretch;
        }
        .dg-dashboard-shell .dg-dashboard-main {
          padding: 1.25rem 1rem 1.5rem;
          background: linear-gradient(180deg, rgba(255, 255, 255, 0.85), rgba(248, 250, 252, 0.9));
          border-left: 1px solid #e5e7eb;
          min-height: calc(100vh - 58px);
        }
        .dg-dashboard-shell .dg-dashboard-panel {
          background: #ffffff;
          border: 1px solid #e5e7eb;
          border-radius: 14px;
          padding: 1.1rem 1.1rem 1.4rem;
          min-height: calc(100vh - 58px - 2.5rem);
          box-shadow: 0 18px 35px -32px rgba(15, 23, 42, 0.45);
        }
        @media (max-width: 767.98px) {
          .dg-dashboard-shell .dg-dashboard-main {
            padding: 0.85rem 0.8rem 1.2rem;
            border-left: 0;
          }
          .dg-dashboard-shell .dg-dashboard-panel {
            border-radius: 12px 12px 0 0;
            border-bottom: 0;
            min-height: auto;
            padding: 0.95rem 0.9rem 1.2rem;
          }
        }
      `}</style>
      <Navbar />
      <div className="container-fluid p-0 dg-dashboard-frame">
        <div className="row dg-dashboard-row">
          <Sidebar />
          <main className="col-md-9 ms-sm-auto col-lg-10 px-md-0 dg-dashboard-main">
            <section className="h-100">
              <div className="dg-dashboard-panel">
                <Outlet />
              </div>
            </section>
          </main>
        </div>
      </div>
    </div>
  );
};

export default DashboardLayout;
