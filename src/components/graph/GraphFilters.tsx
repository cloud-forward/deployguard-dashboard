import React from 'react';
import type { NodeType } from './mockGraphData';
import { nodeTypeColors, nodeTypeIcons } from './mockGraphData';

const ALL_TYPES: NodeType[] = ['Pod', 'ServiceAccount', 'IAMRole', 'S3Bucket'];

interface GraphFiltersProps {
  activeTypes: NodeType[];
  onChange: (types: NodeType[]) => void;
}

const GraphFilters: React.FC<GraphFiltersProps> = ({ activeTypes, onChange }) => {
  const toggle = (type: NodeType) => {
    if (activeTypes.includes(type)) {
      onChange(activeTypes.filter((t) => t !== type));
    } else {
      onChange([...activeTypes, type]);
    }
  };

  return (
    <div className="d-flex align-items-center gap-2 flex-wrap">
      <span className="text-muted small fw-semibold me-1">Filter:</span>
      {ALL_TYPES.map((type) => {
        const active = activeTypes.includes(type);
        const color = nodeTypeColors[type];
        return (
          <button
            key={type}
            type="button"
            onClick={() => toggle(type)}
            className="btn btn-sm"
            style={{
              backgroundColor: active ? color : 'transparent',
              color: active ? '#fff' : color,
              border: `1px solid ${color}`,
              transition: 'all 0.15s',
            }}
          >
            <span className="me-1">{nodeTypeIcons[type]}</span>
            {type}
          </button>
        );
      })}
    </div>
  );
};

export default GraphFilters;
