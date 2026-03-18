import React from 'react';
import ChokePointList from '../components/risk/ChokePointList';

const RiskPage: React.FC = () => {
  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h1 className="h2 mb-1">Risk Optimization</h1>
          <p className="dg-subtitle-text mb-0">
            Analysis of security risks and recommended mitigations.
          </p>
        </div>
      </div>

      <div className="mb-4">
        <h3 className="h5 mb-3">Top Recommendations</h3>
        <ChokePointList />
      </div>
    </div>
  );
};

export default RiskPage;
