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
          --dg-bg-primary: #0a1021;
          --dg-bg-secondary: #0f172a;
          --dg-surface: rgba(15, 23, 42, 0.82);
          --dg-surface-strong: rgba(15, 23, 42, 0.94);
          --dg-surface-hover: rgba(30, 41, 59, 0.82);
          --dg-border: rgba(148, 163, 184, 0.18);
          --dg-border-strong: rgba(148, 163, 184, 0.3);
          --dg-divider: rgba(148, 163, 184, 0.12);
          --dg-text-primary: rgba(226, 232, 240, 1);
          --dg-text-secondary: rgba(148, 163, 184, 0.7);
          --dg-text-muted: rgba(148, 163, 184, 0.5);
          --dg-accent: #3b82f6;
          --dg-accent-soft: rgba(59, 130, 246, 0.14);
          --bg-card: rgba(17, 24, 39, 0.75);
          --border-subtle: rgba(255, 255, 255, 0.08);
          --text-primary: rgba(226, 232, 240, 1);
          --text-secondary: rgba(148, 163, 184, 0.7);
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
          background: var(--bg-surface);
          border-left: 1px solid var(--border-subtle);
        }
        .dg-dashboard-panel {
          background: var(--dg-surface-strong, #111827);
          border: 1px solid var(--dg-border, #1f2937);
          border-radius: 16px;
          width: min(100%, var(--dg-content-max-width));
          margin: 0 auto;
          padding: clamp(1rem, 1.45vw, 1.35rem) clamp(1rem, 1.7vw, 1.7rem) clamp(1.15rem, 1.75vw, 1.55rem);
          min-height: calc(100vh - 54px - 2.5rem);
          max-height: calc(100vh - 54px - 2.5rem);
          overflow-y: auto;
          box-shadow: 0 18px 35px -32px rgba(0,0,0,0.8), inset 0 1px 0 rgba(255,255,255,0.03);
          backdrop-filter: blur(8px);
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
          color: var(--dg-text-secondary);
          max-width: none;
        }
        .dg-dashboard-panel .card {
          background: var(--bg-card);
          border: 1px solid var(--border-default);
          border-radius: 12px;
          color: var(--text-primary);
          box-shadow: var(--shadow-card) !important;
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
        }
        .dg-dashboard-panel .card:hover {
          border-color: var(--border-accent-blue);
        }
        .dg-dashboard-panel .card.border-0 {
          border-color: var(--border-default) !important;
        }
        .dg-dashboard-shell .list-group-item,
        .dg-dashboard-shell .modal-content {
          background: var(--bg-card);
          border: 1px solid var(--border-default);
          color: var(--text-primary);
          box-shadow: var(--shadow-card);
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
        }
        .dg-dashboard-shell .modal-header,
        .dg-dashboard-shell .modal-footer,
        .dg-dashboard-shell .card-header,
        .dg-dashboard-shell .card-footer {
          background: var(--bg-card-hover);
          border-color: var(--border-subtle);
        }
        .dg-dashboard-panel .card .text-muted,
        .dg-dashboard-panel .small.text-muted,
        .dg-dashboard-panel .form-label,
        .dg-dashboard-panel .form-text {
          color: var(--dg-text-secondary) !important;
        }
        .dg-dashboard-shell .text-muted,
        .dg-dashboard-shell .text-secondary,
        .dg-dashboard-shell .text-body-secondary {
          color: var(--dg-text-secondary) !important;
        }
        .dg-dashboard-shell .text-dark,
        .dg-dashboard-shell .text-black,
        .dg-dashboard-shell .text-body {
          color: var(--dg-text-primary) !important;
        }
        .dg-dashboard-shell .table {
          --bs-table-bg: transparent;
          --bs-table-color: var(--text-primary);
          --bs-table-border-color: var(--border-subtle);
          --bs-table-hover-color: var(--text-primary);
          --bs-table-hover-bg: rgba(255, 255, 255, 0.04);
          color: var(--text-primary);
          margin-bottom: 0;
        }
        .dg-dashboard-shell .table thead {
          background: rgba(255, 255, 255, 0.04);
          border-bottom: 1px solid var(--border-subtle);
        }
        .dg-dashboard-shell .table thead th {
          color: var(--text-secondary);
          font-size: 12px;
          font-weight: 500;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          border-bottom: 0;
          background: transparent;
        }
        .dg-dashboard-shell .bg-body-tertiary {
          background-color: rgba(30, 41, 59, 0.5) !important;
        }
        .dg-dashboard-shell .table tbody tr {
          border-bottom: 1px solid var(--border-subtle);
          transition: background 0.15s;
        }
        .dg-dashboard-shell .table tbody tr:hover {
          background: rgba(255, 255, 255, 0.04);
        }
        .dg-dashboard-shell .table tbody td,
        .dg-dashboard-shell .table tbody th {
          color: var(--text-primary);
          border-color: transparent;
        }
        .dg-dashboard-shell .table-responsive {
          border-radius: 10px;
          border: 1px solid var(--border-subtle);
          background: var(--bg-card);
          overflow: hidden;
        }
        .dg-dashboard-panel .form-control,
        .dg-dashboard-panel .form-select {
          background-color: rgba(15, 23, 42, 0.82);
          border-color: var(--dg-border);
          color: var(--dg-text-primary);
        }
        .dg-dashboard-panel .form-control:focus,
        .dg-dashboard-panel .form-select:focus {
          border-color: rgba(59, 130, 246, 0.45);
          box-shadow: 0 0 0 0.2rem rgba(59, 130, 246, 0.15);
        }
        .dg-dashboard-panel .form-control::placeholder {
          color: var(--dg-text-muted);
        }
        .dg-dashboard-panel .badge.text-bg-light,
        .dg-dashboard-panel .bg-light,
        .dg-dashboard-panel .bg-white,
        .dg-dashboard-panel .bg-light-subtle {
          background: rgba(255, 255, 255, 0.06) !important;
          color: var(--dg-text-primary) !important;
          border-color: var(--dg-border) !important;
        }
        .dg-dashboard-shell .bg-light,
        .dg-dashboard-shell .bg-white,
        .dg-dashboard-shell .bg-light-subtle {
          background: rgba(255, 255, 255, 0.06) !important;
          color: var(--dg-text-primary) !important;
          border-color: var(--dg-border) !important;
        }
        .dg-dashboard-shell .alert {
          color: var(--dg-text-primary);
          border-width: 1px;
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.025);
        }
        .dg-dashboard-shell .alert-secondary {
          background: rgba(148, 163, 184, 0.12);
          border-color: rgba(148, 163, 184, 0.22);
        }
        .dg-dashboard-shell .alert-info {
          background: rgba(59, 130, 246, 0.14);
          border-color: rgba(59, 130, 246, 0.24);
        }
        .dg-dashboard-shell .alert-success {
          background: rgba(34, 197, 94, 0.14);
          border-color: rgba(34, 197, 94, 0.24);
        }
        .dg-dashboard-shell .alert-warning {
          background: rgba(245, 158, 11, 0.14);
          border-color: rgba(245, 158, 11, 0.24);
        }
        .dg-dashboard-shell .alert-danger {
          background: rgba(239, 68, 68, 0.14);
          border-color: rgba(239, 68, 68, 0.26);
        }
        .dg-dashboard-panel .nav-tabs {
          --bs-nav-tabs-border-color: var(--dg-divider);
          --bs-nav-tabs-link-active-bg: rgba(255, 255, 255, 0.04);
          --bs-nav-tabs-link-active-color: var(--dg-text-primary);
          --bs-nav-tabs-link-active-border-color: var(--dg-divider) var(--dg-divider) transparent;
        }
        .dg-dashboard-panel .nav-tabs .nav-link {
          color: var(--dg-text-secondary);
          border-color: transparent;
        }
        .dg-dashboard-panel .nav-tabs .nav-link:hover {
          color: var(--dg-text-primary);
          border-color: transparent transparent var(--dg-divider);
        }
        .dg-dashboard-panel .nav-tabs .nav-link.active {
          color: var(--dg-text-primary);
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
