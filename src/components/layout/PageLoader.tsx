import React from 'react';

interface PageLoaderProps {
  label?: string;
  minHeight?: number | string;
  compact?: boolean;
}

const PageLoader: React.FC<PageLoaderProps> = ({
  label = '페이지를 불러오는 중...',
  minHeight = 320,
  compact = false,
}) => {
  const spinnerSize = compact ? 44 : 56;
  const captionWidth = compact ? 180 : 220;

  return (
    <>
      <style>{`
        @keyframes dg-page-loader-spin {
          to {
            transform: rotate(360deg);
          }
        }
        @keyframes dg-page-loader-shimmer {
          0% {
            background-position: 200% 0;
          }
          100% {
            background-position: -200% 0;
          }
        }
      `}</style>
      <div
        className="d-flex flex-column align-items-center justify-content-center"
        style={{
          minHeight,
          width: '100%',
          gap: compact ? '0.75rem' : '0.9rem',
          color: 'var(--dg-text-secondary, rgba(148, 163, 184, 0.78))',
        }}
        role="status"
        aria-live="polite"
      >
        <div
          aria-hidden="true"
          style={{
            width: spinnerSize,
            height: spinnerSize,
            borderRadius: '999px',
            border: '3px solid rgba(148, 163, 184, 0.16)',
            borderTopColor: 'var(--dg-accent, #3b82f6)',
            animation: 'dg-page-loader-spin 0.9s linear infinite',
            boxShadow: '0 0 0 1px rgba(15, 23, 42, 0.2)',
          }}
        />
        <div
          aria-hidden="true"
          style={{
            width: captionWidth,
            maxWidth: '60%',
            height: 10,
            borderRadius: 999,
            background:
              'linear-gradient(90deg, rgba(148, 163, 184, 0.08) 0%, rgba(148, 163, 184, 0.16) 50%, rgba(148, 163, 184, 0.08) 100%)',
            backgroundSize: '200% 100%',
            animation: 'dg-page-loader-shimmer 1.4s ease-in-out infinite',
          }}
        />
        <span className="small">{label}</span>
      </div>
    </>
  );
};

export default PageLoader;
