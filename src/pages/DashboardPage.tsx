import React from 'react';
import StatCard from '../components/dashboard/StatCard';

const DashboardPage: React.FC = () => {
  const stats = [
    { title: 'Total Clusters', value: 12 },
    { title: 'Total Scans', value: 145 },
    { title: 'Attack Paths', value: 3 },
    { title: 'High Risk Nodes', value: 24 },
  ];

  return (
    <div>
      <h1 className="h2 mb-4">Overview</h1>
      
      <div className="row g-4">
        {stats.map((stat, index) => (
          <div key={index} className="col-12 col-sm-6 col-lg-3">
            <StatCard title={stat.title} value={stat.value} />
          </div>
        ))}
      </div>

      <div className="mt-5">
        <p className="text-muted">Overview of DeployGuard security status.</p>
      </div>
    </div>
  );
};

export default DashboardPage;
