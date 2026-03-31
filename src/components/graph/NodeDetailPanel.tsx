import React from 'react';
import type { NodeData } from './mockGraphData';
import { nodeTypeColors, nodeTypeIcons } from './mockGraphData';

export type DetailValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | DetailValue[]
  | Record<string, unknown>;

interface NodeDetailPanelProps {
  node: NodeData | null;
  onClose: () => void;
  style?: React.CSSProperties;
  tone?: 'light' | 'dark';
  accentColor?: string;
  icon?: string;
  typeLabel?: string;
  details?: Record<string, DetailValue>;
  panelTitle?: string;
  panelDescription?: string;
  subjectLabel?: string;
  detailLabelWidth?: string;
}

const DETAIL_PANEL_WIDTH = 340;

const getTextWrapStyle = (color: string): React.CSSProperties => ({
  color,
  whiteSpace: 'normal',
  wordBreak: 'break-word',
  overflowWrap: 'break-word',
});

const getDepthTone = (isDark: boolean) => ({
  borderColor: isDark ? 'rgba(148, 163, 184, 0.14)' : 'rgba(148, 163, 184, 0.24)',
});

const renderDetailValue = (
  value: DetailValue,
  options: {
    isDark: boolean;
    mutedColor: string;
    textColor: string;
    depth?: number;
  },
): React.ReactNode => {
  const { isDark, mutedColor, textColor, depth = 0 } = options;
  const depthTone = getDepthTone(isDark);
  const valueTextStyle = getTextWrapStyle(textColor);

  if (value == null || value === '') {
    return <span style={{ color: mutedColor }}>-</span>;
  }

  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return <span style={valueTextStyle}>{String(value)}</span>;
  }

  if (Array.isArray(value)) {
    if (value.length === 0) {
      return <span style={{ color: mutedColor }}>[]</span>;
    }

    return (
      <div className="d-flex flex-column gap-2" style={{ minWidth: 0 }}>
        {value.map((item, index) => (
          <div
            key={index}
            className="d-flex align-items-start gap-2"
            style={{
              minWidth: 0,
              paddingLeft: depth > 0 ? '0.55rem' : 0,
              borderLeft: depth > 0 ? `1px solid ${depthTone.borderColor}` : undefined,
            }}
          >
            <span
              aria-hidden="true"
              style={{
                color: mutedColor,
                fontSize: '0.72rem',
                lineHeight: 1.4,
                paddingTop: 1,
                minWidth: 18,
                flexShrink: 0,
              }}
            >
              {`${index + 1}.`}
            </span>
            <div style={{ minWidth: 0, flex: 1 }}>
              {renderDetailValue(item as DetailValue, { ...options, depth: depth + 1 })}
            </div>
          </div>
        ))}
      </div>
    );
  }

  const entries = Object.entries(value);
  if (entries.length === 0) {
    return <span style={{ color: mutedColor }}>{'{}'}</span>;
  }

  return (
    <div className="d-flex flex-column gap-2" style={{ minWidth: 0 }}>
      {entries.map(([entryKey, entryValue]) => (
        <div
          key={entryKey}
          className="d-flex flex-column gap-1"
          style={{
            minWidth: 0,
            paddingLeft: depth > 0 ? '0.55rem' : 0,
            borderLeft: depth > 0 ? `1px solid ${depthTone.borderColor}` : undefined,
          }}
        >
          <span
            style={{
              color: mutedColor,
              fontSize: '0.74rem',
              lineHeight: 1.2,
              fontWeight: 600,
              letterSpacing: '0.01em',
            }}
          >
            {entryKey}
          </span>
          <div style={{ minWidth: 0 }}>{renderDetailValue(entryValue as DetailValue, { ...options, depth: depth + 1 })}</div>
        </div>
      ))}
    </div>
  );
};

const NodeDetailPanel: React.FC<NodeDetailPanelProps> = ({
  node,
  onClose,
  style,
  tone = 'light',
  accentColor,
  icon: iconOverride,
  typeLabel,
  details,
  panelTitle = 'Node Detail',
  panelDescription = 'Selected node details',
  subjectLabel,
  detailLabelWidth = '34%',
}) => {
  if (!node) return null;

  const color = accentColor ?? nodeTypeColors[node.type];
  const icon = iconOverride ?? nodeTypeIcons[node.type];
  const isDark = tone === 'dark';
  const cardBackground = isDark ? 'rgba(8, 15, 32, 0.94)' : '#ffffff';
  const cardBorder = isDark ? '1px solid rgba(96, 165, 250, 0.14)' : '1px solid rgba(15, 23, 42, 0.08)';
  const textColor = isDark ? '#e2e8f0' : '#0f172a';
  const mutedColor = isDark ? '#93a8c7' : '#64748b';
  const detailMap = details ?? node.details;
  const heading = subjectLabel ?? node.label;
  const tableValueStyle: React.CSSProperties = getTextWrapStyle(textColor);

  return (
    <div
      className="card shadow border-0"
      style={{
        position: 'absolute',
        top: 16,
        right: 16,
        width: DETAIL_PANEL_WIDTH,
        zIndex: 10,
        border: cardBorder,
        background: cardBackground,
        color: textColor,
        backdropFilter: isDark ? 'blur(16px)' : undefined,
        maxHeight: 'calc(100vh - 7rem)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        ...style,
      }}
    >
      <div
        className="card-header d-flex justify-content-between align-items-center"
        style={{
          background: isDark ? 'rgba(15, 23, 42, 0.9)' : '#f8fafc',
          color: isDark ? '#f8fafc' : textColor,
          borderBottom: isDark ? '1px solid rgba(148, 163, 184, 0.12)' : '1px solid rgba(15, 23, 42, 0.06)',
          borderTop: `4px solid ${color}`,
        }}
      >
        <strong>{panelTitle}</strong>
        <button
          type="button"
          className={isDark ? 'btn-close btn-close-white' : 'btn-close'}
          aria-label="Close"
          onClick={onClose}
        />
      </div>
      <div
        className="card-body d-flex flex-column gap-3"
        style={{
          overflowY: 'auto',
          flex: '1 1 auto',
          minHeight: 0,
        }}
      >
        <p className="small mb-0" style={{ color: mutedColor }}>
          {panelDescription}
        </p>
        <div
          className="rounded-4 p-3 d-flex align-items-start gap-3"
          style={{
            background: isDark ? 'rgba(15, 23, 42, 0.76)' : '#f8fafc',
            border: isDark ? '1px solid rgba(148, 163, 184, 0.14)' : '1px solid rgba(148, 163, 184, 0.2)',
            minWidth: 0,
          }}
        >
          <span
            aria-hidden="true"
            className="d-inline-flex align-items-center justify-content-center rounded-circle flex-shrink-0"
            style={{
              width: 32,
              height: 32,
              background: `${color}22`,
              color,
              fontSize: '1rem',
            }}
          >
            {icon}
          </span>
          <div className="d-flex flex-column gap-2" style={{ minWidth: 0, flex: 1 }}>
            <strong style={tableValueStyle}>{heading}</strong>
            <div className="d-flex flex-wrap gap-2">
              <span className="badge" style={{ backgroundColor: color }}>
                {typeLabel ?? node.type}
              </span>
            </div>
          </div>
        </div>
        <table className="table table-sm table-borderless mb-0 align-top">
          <tbody>
            {Object.entries(detailMap).map(([key, value]) => (
              <tr key={key}>
                <td className="fw-semibold" style={{ width: detailLabelWidth, color: mutedColor, paddingRight: '0.75rem' }}>
                  {key}
                </td>
                <td style={tableValueStyle}>{renderDetailValue(value, { isDark, mutedColor, textColor })}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default NodeDetailPanel;
