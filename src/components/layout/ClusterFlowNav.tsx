import React from 'react';
import { NavLink } from 'react-router-dom';

type ClusterFlowStep = 'inventory' | 'graph' | 'risk';

interface ClusterFlowNavProps {
  clusterId: string;
  current: ClusterFlowStep;
}

const steps: Array<{ key: ClusterFlowStep; label: string; description: string; to: (clusterId: string) => string }> = [
  {
    key: 'inventory',
    label: 'Inventory',
    description: '자산 파악',
    to: (clusterId) => `/clusters/${clusterId}/inventory`,
  },
  {
    key: 'graph',
    label: 'Attack Graph',
    description: '공격 경로 분석',
    to: (clusterId) => `/clusters/${clusterId}/graph`,
  },
  {
    key: 'risk',
    label: 'Recommendations',
    description: '수정 제안',
    to: (clusterId) => `/clusters/${clusterId}/risk`,
  },
];

const ClusterFlowNav: React.FC<ClusterFlowNavProps> = ({ clusterId, current }) => {
  if (!clusterId) {
    return null;
  }

  return (
    <>
      <style>{`
        .dg-cluster-flow {
          display: flex;
          flex-wrap: wrap;
          gap: 0.85rem;
          margin-bottom: 1.25rem;
        }
        .dg-cluster-flow-item {
          min-width: 180px;
          padding: 0.9rem 1rem;
          border-radius: 1rem;
          border: 1px solid #334155;
          background: rgba(15, 23, 42, 0.74);
          color: #dbeafe;
          text-decoration: none;
          transition: all 0.18s ease;
        }
        .dg-cluster-flow-item:hover {
          border-color: #4f46e5;
          background: rgba(49, 46, 129, 0.32);
          color: #ffffff;
          transform: translateY(-1px);
        }
        .dg-cluster-flow-item.is-current {
          border-color: #4f46e5;
          background: linear-gradient(135deg, rgba(79, 70, 229, 0.28), rgba(67, 56, 202, 0.42));
          box-shadow: 0 10px 24px -18px rgba(79, 70, 229, 0.85);
        }
        .dg-cluster-flow-step {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 1.6rem;
          height: 1.6rem;
          margin-bottom: 0.55rem;
          border-radius: 999px;
          background: rgba(148, 163, 184, 0.18);
          color: #f8fafc;
          font-size: 0.8rem;
          font-weight: 700;
        }
        .dg-cluster-flow-item.is-current .dg-cluster-flow-step {
          background: rgba(255, 255, 255, 0.18);
        }
        .dg-cluster-flow-label {
          display: block;
          font-weight: 700;
          color: #f8fafc;
          margin-bottom: 0.2rem;
        }
        .dg-cluster-flow-description {
          display: block;
          font-size: 0.85rem;
          color: #cbd5e1;
        }
      `}</style>
      <nav className="dg-cluster-flow" aria-label="Cluster analysis flow">
        {steps.map((step, index) => {
          const isCurrent = step.key === current;

          return (
            <NavLink
              key={step.key}
              to={step.to(clusterId)}
              className={`dg-cluster-flow-item ${isCurrent ? 'is-current' : ''}`}
              aria-current={isCurrent ? 'page' : undefined}
            >
              <span className="dg-cluster-flow-step">{index + 1}</span>
              <span className="dg-cluster-flow-label">{step.label}</span>
              <span className="dg-cluster-flow-description">{step.description}</span>
            </NavLink>
          );
        })}
      </nav>
    </>
  );
};

export default ClusterFlowNav;
