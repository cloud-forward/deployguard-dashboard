import React from 'react';

const Navbar: React.FC = () => {
  return (
    <header className="dg-navbar navbar navbar-dark sticky-top flex-md-nowrap">
      <style>{`
        .dg-navbar {
          background: linear-gradient(90deg, #111827 0%, #1f2937 100%);
          border-bottom: 1px solid rgba(148, 163, 184, 0.24);
          padding-top: 0.55rem;
          padding-bottom: 0.55rem;
          box-shadow: 0 8px 30px -20px rgba(2, 6, 23, 0.45);
        }
        .dg-navbar .dg-brand {
          min-height: 3rem;
          gap: 0.65rem;
          padding-inline: 1rem;
          color: #f8fafc !important;
          letter-spacing: 0.01em;
          font-size: 1.04rem;
          display: inline-flex;
          align-items: center;
          text-decoration: none;
          font-weight: 600;
        }
        .dg-navbar .dg-brand-mark {
          width: 1.9rem;
          height: 1.9rem;
          border-radius: 0.55rem;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(140deg, #6366f1, #8b5cf6);
          color: #ffffff;
          font-size: 0.82rem;
          font-weight: 700;
          letter-spacing: 0.08em;
        }
        .dg-navbar .dg-brand-text {
          color: #ffffff;
          font-size: 1rem;
          line-height: 1;
        }
        .dg-navbar .dg-brand-sub {
          color: #cbd5e1;
          font-size: 0.68rem;
          line-height: 1;
          display: block;
          margin-top: 0.15rem;
          letter-spacing: 0.09em;
          text-transform: uppercase;
        }
        .dg-navbar .dg-nav-title {
          color: #e5e7eb !important;
          font-size: 0.9rem;
          letter-spacing: 0.01em;
          font-weight: 500;
        }
        .dg-navbar .navbar-toggler {
          border: 0;
          border-radius: 0.55rem;
          width: 2.25rem;
          height: 2.25rem;
          margin-left: 0.35rem;
          margin-right: 0.55rem;
          transition: background-color 0.2s ease;
        }
        .dg-navbar .navbar-toggler:hover {
          background: rgba(255, 255, 255, 0.12);
        }
      `}</style>
      <a className="navbar-brand col-md-3 col-lg-2 me-0 dg-brand" href="/">
        <span className="dg-brand-mark" aria-hidden="true">DG</span>
        <span>
          <span className="dg-brand-text">DeployGuard</span>
          <span className="dg-brand-sub">Security Console</span>
        </span>
      </a>
      <button
        className="navbar-toggler position-absolute d-md-none collapsed"
        type="button"
        data-bs-toggle="collapse"
        data-bs-target="#sidebarMenu"
        aria-controls="sidebarMenu"
        aria-expanded="false"
        aria-label="Toggle navigation"
      >
        <span className="navbar-toggler-icon"></span>
      </button>
      <div className="navbar-nav w-100">
        <div className="nav-item text-nowrap">
          <span className="nav-link px-3 dg-nav-title">Security Dashboard</span>
        </div>
      </div>
    </header>
  );
};

export default Navbar;
