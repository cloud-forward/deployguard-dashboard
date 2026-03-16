import React from 'react';

interface StatCardProps {
  title: string;
  value: string | number;
  icon?: React.ReactNode;
}

const StatCard: React.FC<StatCardProps> = ({ title, value, icon }) => {
  return (
    <div className="card shadow-sm h-100 border-0">
      <div className="card-body d-flex align-items-center">
        {icon && (
          <div className="me-3 p-3 bg-light rounded-circle text-primary">
            {icon}
          </div>
        )}
        <div>
          <h6 className="card-subtitle mb-1 text-muted text-uppercase small font-weight-bold">
            {title}
          </h6>
          <h3 className="card-title mb-0 fw-bold">{value}</h3>
        </div>
      </div>
    </div>
  );
};

export default StatCard;
