import React from 'react';

interface ChokePoint {
  id: string;
  recommendation: string;
  blocksAttackPaths: number;
  riskReduction: number;
}

const ChokePointList: React.FC = () => {
  const recommendations: ChokePoint[] = [
    {
      id: '1',
      recommendation: 'Remove RoleBinding admin-binding',
      blocksAttackPaths: 12,
      riskReduction: 38,
    },
    {
      id: '2',
      recommendation: 'Update Secret policy for pod-execution',
      blocksAttackPaths: 8,
      riskReduction: 25,
    },
    {
      id: '3',
      recommendation: 'Isolate sensitive namespace-prod-a',
      blocksAttackPaths: 5,
      riskReduction: 15,
    },
  ];

  return (
    <div className="row g-3">
      {recommendations.map((item) => (
        <div key={item.id} className="col-12 col-md-6 col-lg-4">
          <div className="card h-100 border-0 shadow-sm border-start border-primary border-4">
            <div className="card-body">
              <h5 className="card-title text-primary mb-3">
                {item.recommendation}
              </h5>
              <div className="d-flex flex-column gap-2">
                <div className="d-flex justify-content-between align-items-center">
                  <span className="text-muted small">Blocks attack paths</span>
                  <span className="badge bg-danger rounded-pill">
                    {item.blocksAttackPaths} paths
                  </span>
                </div>
                <div className="d-flex justify-content-between align-items-center">
                  <span className="text-muted small">Risk reduction</span>
                  <span className="fw-bold text-success">
                    {item.riskReduction}%
                  </span>
                </div>
              </div>
              <div className="mt-4">
                <div className="progress" style={{ height: '8px' }}>
                  <div
                    className="progress-bar bg-success"
                    role="progressbar"
                    style={{ width: `${item.riskReduction}%` }}
                    aria-valuenow={item.riskReduction}
                    aria-valuemin={0}
                    aria-valuemax={100}
                  ></div>
                </div>
              </div>
            </div>
            <div className="card-footer bg-transparent border-0 pt-0">
              <button className="btn btn-outline-primary btn-sm w-100">
                View Details
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default ChokePointList;
