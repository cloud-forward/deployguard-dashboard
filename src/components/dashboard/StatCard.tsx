import React from 'react';

interface StatCardProps {
  title: string;
  value: string | number;
  icon?: React.ReactNode;
  compact?: boolean;
  accentColor?: string;
  className?: string;
}

const StatCard: React.FC<StatCardProps> = ({ title, value, icon, compact = false, accentColor, className = '' }) => {
  return (
    <div
      className={`card shadow-sm h-100 border-0 ${className}`.trim()}
      style={
        accentColor
          ? {
              ['--stat-accent' as string]: accentColor,
            }
          : undefined
      }
    >
      <div className={`card-body d-flex align-items-center ${compact ? 'py-3 px-3' : ''}`}>
        {icon && (
          <div className="me-3 p-3 bg-light rounded-circle text-primary">
            {icon}
          </div>
        )}
        <div>
          <h6 className={`card-subtitle text-muted text-uppercase font-weight-bold ${compact ? 'mb-1 small' : 'mb-1 small'}`}>
            {title}
          </h6>
          <h3 className={`card-title mb-0 fw-bold ${compact ? 'h4' : ''}`}>{value}</h3>
        </div>
      </div>
    </div>
  );
};

export default StatCard;
