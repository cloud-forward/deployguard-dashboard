import React from 'react';
import { Globe, User } from 'lucide-react';

type RiskSeverity = 'Critical' | 'High' | 'Medium' | 'Low' | string;

export type RiskSpotlightEntryPoint = {
  name: string;
  attackPaths: number;
  crownJewels: number;
  severity: RiskSeverity;
};

export type RiskSpotlightCrownJewel = {
  name: string;
  attackPaths: number;
  severity: RiskSeverity;
};

type RiskSpotlightPanelProps = {
  entryPoints: RiskSpotlightEntryPoint[];
  crownJewels: RiskSpotlightCrownJewel[];
};

const getSeverityTone = (severity: RiskSeverity) => {
  switch (severity) {
    case 'Critical':
      return {
        text: '#fca5a5',
        background: 'rgba(127, 29, 29, 0.34)',
        border: 'rgba(248, 113, 113, 0.26)',
      };
    case 'High':
      return {
        text: '#fdba74',
        background: 'rgba(124, 45, 18, 0.3)',
        border: 'rgba(251, 146, 60, 0.24)',
      };
    case 'Medium':
      return {
        text: '#93c5fd',
        background: 'rgba(30, 64, 175, 0.28)',
        border: 'rgba(96, 165, 250, 0.24)',
      };
    case 'Low':
      return {
        text: '#86efac',
        background: 'rgba(20, 83, 45, 0.3)',
        border: 'rgba(74, 222, 128, 0.24)',
      };
    default:
      return {
        text: '#cbd5e1',
        background: 'rgba(51, 65, 85, 0.55)',
        border: 'rgba(148, 163, 184, 0.2)',
      };
  }
};

const sectionStyle: React.CSSProperties = {
  background: 'linear-gradient(180deg, rgba(13, 17, 23, 0.98) 0%, rgba(17, 24, 39, 0.96) 100%)',
  border: '1px solid rgba(148, 163, 184, 0.14)',
  borderRadius: '1.25rem',
  padding: '1rem',
  boxShadow: '0 18px 40px rgba(2, 6, 23, 0.34)',
};

const cardStyle: React.CSSProperties = {
  background: 'linear-gradient(180deg, rgba(15, 23, 42, 0.9) 0%, rgba(15, 23, 42, 0.72) 100%)',
  border: '1px solid rgba(148, 163, 184, 0.14)',
  borderRadius: '1rem',
  padding: '1rem',
};

const iconFrameStyle: React.CSSProperties = {
  width: 42,
  height: 42,
  borderRadius: '0.9rem',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  border: '1px solid rgba(148, 163, 184, 0.16)',
  background: 'rgba(30, 41, 59, 0.55)',
  flexShrink: 0,
};

const metaStyle: React.CSSProperties = {
  color: '#94a3b8',
  fontSize: '0.84rem',
  lineHeight: 1.45,
};

const SeverityBadge: React.FC<{ severity: RiskSeverity }> = ({ severity }) => {
  const tone = getSeverityTone(severity);

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '0.32rem 0.7rem',
        borderRadius: 999,
        fontSize: '0.75rem',
        fontWeight: 700,
        color: tone.text,
        background: tone.background,
        border: `1px solid ${tone.border}`,
        whiteSpace: 'nowrap',
      }}
    >
      {severity}
    </span>
  );
};

const EmptyState: React.FC<{ message: string }> = ({ message }) => (
  <div
    style={{
      ...cardStyle,
      minHeight: 120,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: '#94a3b8',
      textAlign: 'center',
    }}
  >
    {message}
  </div>
);

const RiskSpotlightPanel: React.FC<RiskSpotlightPanelProps> = ({ entryPoints, crownJewels }) => {
  return (
    <section
      style={{
        background: '#0d1117',
        border: '1px solid rgba(148, 163, 184, 0.14)',
        borderRadius: '1.5rem',
        padding: '1.25rem',
        boxShadow: '0 22px 50px rgba(2, 6, 23, 0.38)',
      }}
    >
      <div className="mb-4">
        <h2
          style={{
            color: '#f8fafc',
            fontSize: '1.2rem',
            fontWeight: 700,
            margin: 0,
          }}
        >
          Risk Spotlight
        </h2>
        <p
          style={{
            color: '#94a3b8',
            fontSize: '0.9rem',
            marginTop: '0.45rem',
            marginBottom: 0,
          }}
        >
          Entry Points와 Crown Jewels를 빠르게 확인합니다.
        </p>
      </div>

      <div className="row g-3">
        <div className="col-12 col-xl-6">
          <div style={sectionStyle}>
            <div className="mb-3" style={{ color: '#f8fafc', fontSize: '1rem', fontWeight: 700 }}>
              Entry Points
            </div>
            <div className="d-flex flex-column gap-3">
              {entryPoints.length === 0 ? (
                <EmptyState message="표시할 Entry Points가 없습니다." />
              ) : (
                entryPoints.map((item) => (
                  <div key={item.name} style={cardStyle}>
                    <div className="d-flex align-items-start justify-content-between gap-3 mb-3">
                      <div className="d-flex align-items-center gap-3">
                        <span style={{ ...iconFrameStyle, color: '#93c5fd' }}>
                          <Globe size={18} />
                        </span>
                        <div
                          style={{
                            color: '#f8fafc',
                            fontSize: '0.98rem',
                            fontWeight: 700,
                            lineHeight: 1.35,
                            overflowWrap: 'anywhere',
                          }}
                        >
                          {item.name}
                        </div>
                      </div>
                      <SeverityBadge severity={item.severity} />
                    </div>
                    <div className="d-flex flex-column gap-1">
                      <div style={metaStyle}>Attack Paths {item.attackPaths}</div>
                      <div style={metaStyle}>Reachable Crown Jewels {item.crownJewels}</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="col-12 col-xl-6">
          <div style={sectionStyle}>
            <div className="mb-3" style={{ color: '#f8fafc', fontSize: '1rem', fontWeight: 700 }}>
              Crown Jewels
            </div>
            <div className="d-flex flex-column gap-3">
              {crownJewels.length === 0 ? (
                <EmptyState message="표시할 Crown Jewels가 없습니다." />
              ) : (
                crownJewels.map((item) => (
                  <div key={item.name} style={cardStyle}>
                    <div className="d-flex align-items-start justify-content-between gap-3 mb-3">
                      <div className="d-flex align-items-center gap-3">
                        <span style={{ ...iconFrameStyle, color: '#fca5a5' }}>
                          <User size={18} />
                        </span>
                        <div
                          style={{
                            color: '#f8fafc',
                            fontSize: '0.98rem',
                            fontWeight: 700,
                            lineHeight: 1.35,
                            overflowWrap: 'anywhere',
                          }}
                        >
                          {item.name}
                        </div>
                      </div>
                      <SeverityBadge severity={item.severity} />
                    </div>
                    <div className="d-flex flex-column gap-1">
                      <div style={metaStyle}>Attack Paths {item.attackPaths}</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default RiskSpotlightPanel;
