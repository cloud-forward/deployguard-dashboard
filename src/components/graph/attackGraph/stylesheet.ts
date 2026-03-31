interface RiskStyle {
  borderColor: string;
  borderWidth: number;
}

export type AttackGraphNodeVisualStyle = {
  backgroundColor: string;
  shape: string;
};

export type AttackGraphEdgeVisualStyle = {
  lineColor: string;
  width: number;
  lineStyle?: 'solid' | 'dashed' | 'dotted';
  lineDashPattern?: number[];
  opacity?: number;
  arrowScale?: number;
};

export const ATTACK_GRAPH_NODE_TYPE_STYLES: Record<string, AttackGraphNodeVisualStyle> = {
  Ingress: { backgroundColor: '#5b6b89', shape: 'diamond' },
  Pod: { backgroundColor: '#2f7df6', shape: 'round-rectangle' },
  ServiceAccount: { backgroundColor: '#7c5cff', shape: 'hexagon' },
  Role: { backgroundColor: '#f59e0b', shape: 'rectangle' },
  ClusterRole: { backgroundColor: '#f59e0b', shape: 'rectangle' },
  RoleBinding: { backgroundColor: '#f6c453', shape: 'vee' },
  ClusterRoleBinding: { backgroundColor: '#f6c453', shape: 'vee' },
  Secret: { backgroundColor: '#ef476f', shape: 'octagon' },
  Service: { backgroundColor: '#38bdf8', shape: 'round-rectangle' },
  Node: { backgroundColor: '#4c6fff', shape: 'rectangle' },
  ContainerImage: { backgroundColor: '#9b8afc', shape: 'barrel' },
  IAMRole: { backgroundColor: '#ffb703', shape: 'rectangle' },
  IAMUser: { backgroundColor: '#ffd166', shape: 'ellipse' },
  EC2Instance: { backgroundColor: '#59c3ff', shape: 'round-rectangle' },
  SecurityGroup: { backgroundColor: '#f472b6', shape: 'tag' },
  S3: { backgroundColor: '#2fbf71', shape: 'barrel' },
  RDS: { backgroundColor: '#22c55e', shape: 'barrel' },
  Unknown: { backgroundColor: '#94a3b8', shape: 'ellipse' },
};

export const ATTACK_GRAPH_SEVERITY_STYLES: Record<string, RiskStyle> = {
  critical: { borderColor: '#ff4d6d', borderWidth: 6 },
  high: { borderColor: '#ff7a18', borderWidth: 5 },
  medium: { borderColor: '#facc15', borderWidth: 4 },
  low: { borderColor: '#22c55e', borderWidth: 3 },
  unknown: { borderColor: '#94a3b8', borderWidth: 2.5 },
  none: { borderColor: '#64748b', borderWidth: 2.5 },
};

const DEFAULT_EDGE_STYLE: AttackGraphEdgeVisualStyle = {
  lineColor: '#6b7b94',
  width: 1.2,
  opacity: 0.22,
  arrowScale: 0.88,
};

const toRestingEdgeStyle = (style: AttackGraphEdgeVisualStyle): AttackGraphEdgeVisualStyle => ({
  ...style,
  width: Math.max(DEFAULT_EDGE_STYLE.width, style.width - 0.35),
  opacity: Math.max(DEFAULT_EDGE_STYLE.opacity ?? 0.22, (style.opacity ?? DEFAULT_EDGE_STYLE.opacity ?? 0.22) - 0.14),
  arrowScale: Math.max(DEFAULT_EDGE_STYLE.arrowScale ?? 0.88, (style.arrowScale ?? 1) - 0.06),
});

const EDGE_RELATION_STYLE_MAP: Record<string, AttackGraphEdgeVisualStyle> = {
  role_grants_resource: toRestingEdgeStyle({ lineColor: '#fb8b73', width: 2.2, opacity: 0.62, arrowScale: 1.04 }),
  role_grants_pod_exec: toRestingEdgeStyle({ lineColor: '#f97316', width: 2.65, opacity: 0.74, arrowScale: 1.08 }),
  grants: toRestingEdgeStyle({ lineColor: '#fb8b73', width: 2.2, opacity: 0.62, arrowScale: 1.04 }),
  service_account_assumes_iam_role: toRestingEdgeStyle({ lineColor: '#f59e0b', width: 2.75, opacity: 0.72, arrowScale: 1.08 }),
  instance_profile_assumes: toRestingEdgeStyle({ lineColor: '#fbbf24', width: 2.6, opacity: 0.7, arrowScale: 1.07 }),
  assumes: toRestingEdgeStyle({ lineColor: '#f59e0b', width: 2.7, opacity: 0.7, arrowScale: 1.07 }),
  iam_role_access_resource: toRestingEdgeStyle({ lineColor: '#38bdf8', width: 2.45, opacity: 0.68, arrowScale: 1.05 }),
  iam_user_access_resource: toRestingEdgeStyle({ lineColor: '#7dd3fc', width: 2.35, opacity: 0.64, arrowScale: 1.04 }),
  accesses: toRestingEdgeStyle({ lineColor: '#38bdf8', width: 2.45, opacity: 0.68, arrowScale: 1.05 }),
  lateral_move: toRestingEdgeStyle({ lineColor: '#8b5cf6', width: 2.45, opacity: 0.63, arrowScale: 1.05 }),
  security_group_allows: toRestingEdgeStyle({ lineColor: '#818cf8', width: 2.3, opacity: 0.58, arrowScale: 1.03 }),
  allows: toRestingEdgeStyle({ lineColor: '#818cf8', width: 2.3, opacity: 0.58, arrowScale: 1.03 }),
  service_targets_pod: toRestingEdgeStyle({ lineColor: '#60a5fa', width: 2.2, opacity: 0.62, arrowScale: 1.02 }),
  ingress_exposes_service: toRestingEdgeStyle({ lineColor: '#3b82f6', width: 2.35, opacity: 0.66, arrowScale: 1.03 }),
  exposes_token: toRestingEdgeStyle({ lineColor: '#14b8a6', width: 2.3, opacity: 0.64, arrowScale: 1.03 }),
  pod_uses_service_account: toRestingEdgeStyle({ lineColor: '#2dd4bf', width: 2.15, opacity: 0.61, arrowScale: 1.02 }),
  service_account_bound_cluster_role: toRestingEdgeStyle({ lineColor: '#0f766e', width: 2.3, opacity: 0.62, arrowScale: 1.02 }),
  service_account_bound_role: toRestingEdgeStyle({ lineColor: '#0f766e', width: 2.3, opacity: 0.62, arrowScale: 1.02 }),
  pod_uses_env_from_secret: toRestingEdgeStyle({ lineColor: '#34d399', width: 2.25, opacity: 0.64, arrowScale: 1.02 }),
  pod_mounts_secret: toRestingEdgeStyle({ lineColor: '#10b981', width: 2.25, opacity: 0.64, arrowScale: 1.02 }),
  uses_image: toRestingEdgeStyle({ lineColor: '#7c8aa4', width: 1.7, opacity: 0.38, arrowScale: 0.98 }),
  uses: toRestingEdgeStyle({ lineColor: '#7c8aa4', width: 1.7, opacity: 0.38, arrowScale: 0.98 }),
  bound_to: toRestingEdgeStyle({ lineColor: '#0f766e', width: 2.3, opacity: 0.62, arrowScale: 1.02 }),
  runs: toRestingEdgeStyle({ lineColor: '#60a5fa', width: 2, opacity: 0.54, arrowScale: 1 }),
  escapes_to: toRestingEdgeStyle({
    lineColor: '#f43f5e',
    width: 3.1,
    lineStyle: 'dashed',
    lineDashPattern: [7, 5],
    opacity: 0.82,
    arrowScale: 1.1,
  }),
};

const EDGE_RELATION_SELECTORS = Object.entries(EDGE_RELATION_STYLE_MAP).map(([relation, style]) => ({
  selector: `edge[relation = "${relation}"]`,
  style: {
    'line-color': style.lineColor,
    'target-arrow-color': style.lineColor,
    width: style.width,
    opacity: style.opacity ?? DEFAULT_EDGE_STYLE.opacity,
    'line-style': style.lineStyle ?? 'solid',
    'line-dash-pattern': style.lineDashPattern ?? [],
    'arrow-scale': style.arrowScale ?? 1,
  },
}));

const nodeTypeSelectors = Object.entries(ATTACK_GRAPH_NODE_TYPE_STYLES).map(([type, style]) => ({
  selector: `node[type = "${type}"]`,
  style: {
    'background-color': style.backgroundColor,
    shape: style.shape,
  },
}));

const severitySelectors = Object.entries(ATTACK_GRAPH_SEVERITY_STYLES).map(([severity, style]) => ({
  selector: `node[severity = "${severity}"]`,
  style: {
    'border-color': style.borderColor,
    'border-width': style.borderWidth,
  },
}));

export const getAttackGraphNodeTypeStyle = (type?: string | null): AttackGraphNodeVisualStyle => {
  if (!type) {
    return ATTACK_GRAPH_NODE_TYPE_STYLES.Unknown;
  }

  return ATTACK_GRAPH_NODE_TYPE_STYLES[type] ?? ATTACK_GRAPH_NODE_TYPE_STYLES.Unknown;
};

export const getAttackGraphRiskStyle = (severity?: string | null): RiskStyle => {
  if (!severity) {
    return ATTACK_GRAPH_SEVERITY_STYLES.unknown;
  }

  return ATTACK_GRAPH_SEVERITY_STYLES[severity] ?? ATTACK_GRAPH_SEVERITY_STYLES.unknown;
};

export const getAttackGraphEdgeVisualStyle = (relation?: string | null): AttackGraphEdgeVisualStyle => {
  if (!relation) {
    return DEFAULT_EDGE_STYLE;
  }

  return EDGE_RELATION_STYLE_MAP[relation] ?? DEFAULT_EDGE_STYLE;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const attackGraphStylesheet: any[] = [
  {
    selector: 'node',
    style: {
      label: 'data(label)',
      'text-valign': 'bottom',
      'text-halign': 'center',
      'font-size': 11,
      'font-weight': 600,
      'text-wrap': 'wrap',
      'text-max-width': 148,
      'text-margin-y': 8,
      width: 54,
      height: 54,
      shape: 'ellipse',
      'border-width': 2.5,
      'border-color': ATTACK_GRAPH_SEVERITY_STYLES.unknown.borderColor,
      color: '#dbe8ff',
      'text-outline-width': 0,
      'background-color': ATTACK_GRAPH_NODE_TYPE_STYLES.Unknown.backgroundColor,
      'overlay-opacity': 0,
      opacity: 0.95,
      'z-compound-depth': 'top',
      'transition-property': 'opacity underlay-opacity underlay-padding shadow-blur shadow-opacity',
      'transition-duration': 150,
      'transition-timing-function': 'ease-out',
    },
  },
  ...nodeTypeSelectors,
  ...severitySelectors,
  {
    selector: 'node[isEntryPoint = true], node[isEntryPoint = "true"]',
    style: {
      'underlay-color': '#38bdf8',
      'underlay-opacity': 0.18,
      'underlay-padding': 10,
    },
  },
  {
    selector: 'node[isCrownJewel = true], node[isCrownJewel = "true"]',
    style: {
      'overlay-color': '#fde047',
      'overlay-opacity': 0.1,
      'overlay-padding': 6,
    },
  },
  {
    selector: 'node[hasRuntimeEvidence = true], node[hasRuntimeEvidence = "true"]',
    style: {
      'shadow-blur': 22,
      'shadow-color': '#7dd3fc',
      'shadow-opacity': 0.85,
      'shadow-offset-x': 0,
      'shadow-offset-y': 0,
    },
  },
  {
    selector: 'node:active',
    style: {
      'border-color': '#93c5fd',
      'border-width': 5,
    },
  },
  {
    selector: '.dimmed, .search-dimmed, .context-dimmed',
    style: {
      opacity: 0.12,
    },
  },
  {
    selector: '.search-context',
    style: {
      opacity: 0.28,
    },
  },
  {
    selector: 'node.path-active, node.search-match, node.selected-neighbor, node.selected-node, node.selected-chain-node',
    style: {
      opacity: 1,
    },
  },
  {
    selector: 'edge.path-active, edge.search-match, edge.selected-neighborhood-edge, edge.selected-edge, edge.selected-chain-edge',
    style: {
      opacity: 1,
    },
  },
  {
    selector: 'node.path-active',
    style: {
      'underlay-color': '#60a5fa',
      'underlay-opacity': 0.14,
      'underlay-padding': 12,
    },
  },
  {
    selector: 'node.selected-node',
    style: {
      'shadow-blur': 42,
      'shadow-color': '#60a5fa',
      'shadow-opacity': 1,
      'underlay-color': '#1d4ed8',
      'underlay-opacity': 0.34,
      'underlay-padding': 24,
    },
  },
  {
    selector: 'node.selected-chain-node',
    style: {
      'underlay-color': '#38bdf8',
      'underlay-opacity': 0.12,
      'underlay-padding': 10,
      'shadow-blur': 15,
      'shadow-color': '#38bdf8',
      'shadow-opacity': 0.26,
    },
  },
  {
    selector: 'node.selected-chain-node.chain-depth-1',
    style: {
      'underlay-opacity': 0.26,
      'underlay-padding': 18,
      'shadow-blur': 26,
      'shadow-opacity': 0.58,
      'transition-delay': 70,
    },
  },
  {
    selector: 'node.selected-chain-node.chain-depth-2',
    style: {
      'underlay-opacity': 0.22,
      'underlay-padding': 15,
      'shadow-blur': 22,
      'shadow-opacity': 0.48,
      'transition-delay': 150,
    },
  },
  {
    selector: 'node.selected-chain-node.chain-depth-3plus',
    style: {
      'underlay-opacity': 0.14,
      'underlay-padding': 12,
      'shadow-blur': 17,
      'shadow-opacity': 0.32,
      'transition-delay': 230,
    },
  },
  {
    selector: 'node.selected-neighbor',
    style: {
      'underlay-color': '#38bdf8',
      'underlay-opacity': 0.14,
      'underlay-padding': 10,
      'shadow-blur': 16,
      'shadow-color': '#38bdf8',
      'shadow-opacity': 0.42,
    },
  },
  {
    selector: 'edge.selected-neighborhood-edge',
    style: {
      width: 4.8,
      'line-color': '#e0f2fe',
      'target-arrow-color': '#e0f2fe',
      'source-arrow-color': '#e0f2fe',
      opacity: 1,
      'shadow-blur': 16,
      'shadow-color': '#60a5fa',
      'shadow-opacity': 0.75,
      'text-background-color': 'rgba(8, 15, 32, 0.94)',
      'text-background-opacity': 1,
      'text-border-width': 1,
      'text-border-color': 'rgba(96, 165, 250, 0.55)',
    },
  },
  {
    selector: 'edge.selected-chain-edge, edge.selected-chain-edge[relation]',
    style: {
      width: 4.1,
      opacity: 0.96,
      'arrow-scale': 1.08,
      'underlay-color': '#dbeafe',
      'underlay-opacity': 0.12,
      'underlay-padding': 3,
      'shadow-blur': 16,
      'shadow-color': '#7dd3fc',
      'shadow-opacity': 0.5,
      'text-background-color': 'rgba(8, 15, 32, 0.9)',
      'text-background-opacity': 1,
    },
  },
  {
    selector: 'edge.selected-chain-edge.chain-depth-1, edge.selected-chain-edge.chain-depth-1[relation]',
    style: {
      width: 5.4,
      opacity: 1,
      'arrow-scale': 1.12,
      'underlay-opacity': 0.2,
      'underlay-padding': 5,
      'shadow-blur': 22,
      'shadow-opacity': 0.84,
      'transition-delay': 35,
    },
  },
  {
    selector: 'edge.selected-chain-edge.chain-depth-2, edge.selected-chain-edge.chain-depth-2[relation]',
    style: {
      width: 4.7,
      opacity: 0.98,
      'arrow-scale': 1.1,
      'underlay-opacity': 0.15,
      'underlay-padding': 4,
      'shadow-blur': 18,
      'shadow-opacity': 0.62,
      'transition-delay': 115,
    },
  },
  {
    selector: 'edge.selected-chain-edge.chain-depth-3plus, edge.selected-chain-edge.chain-depth-3plus[relation]',
    style: {
      width: 4,
      opacity: 0.9,
      'arrow-scale': 1.06,
      'underlay-opacity': 0.1,
      'underlay-padding': 3,
      'shadow-blur': 14,
      'shadow-opacity': 0.42,
      'transition-delay': 195,
    },
  },
  {
    selector: 'node.search-match',
    style: {
      'shadow-blur': 24,
      'shadow-color': '#f8fafc',
      'shadow-opacity': 0.55,
      'underlay-color': '#f8fafc',
      'underlay-opacity': 0.1,
      'underlay-padding': 14,
    },
  },
  {
    selector: 'edge.search-match, edge.search-match[relation]',
    style: {
      width: 4.2,
      'line-color': '#f8fafc',
      'target-arrow-color': '#f8fafc',
      opacity: 1,
      'shadow-blur': 12,
      'shadow-color': '#f8fafc',
      'shadow-opacity': 0.45,
      'text-background-color': 'rgba(8, 15, 32, 0.94)',
      'text-background-opacity': 1,
    },
  },
  {
    selector: 'node.focus-target',
    style: {
      'shadow-blur': 34,
      'shadow-color': '#f59e0b',
      'shadow-opacity': 0.95,
      'shadow-offset-x': 0,
      'shadow-offset-y': 0,
      'underlay-color': '#fde68a',
      'underlay-opacity': 0.22,
      'underlay-padding': 18,
      'z-compound-depth': 'top',
    },
  },
  {
    selector: 'node.focus-target-emphasis',
    style: {
      'shadow-blur': 44,
      'shadow-color': '#fff7d6',
      'shadow-opacity': 1,
      'underlay-opacity': 0.36,
      'underlay-padding': 26,
    },
  },
  {
    selector: 'edge.selected-edge, edge.selected-edge[relation]',
    style: {
      width: 4.6,
      opacity: 1,
      'line-color': '#f8fafc',
      'target-arrow-color': '#f8fafc',
      'shadow-blur': 14,
      'shadow-color': '#60a5fa',
      'shadow-opacity': 0.8,
      'text-background-color': 'rgba(8, 15, 32, 0.94)',
      'text-background-opacity': 1,
      'text-border-width': 1,
      'text-border-color': 'rgba(148, 163, 184, 0.35)',
    },
  },
  {
    selector: 'edge',
    style: {
      label: 'data(label)',
      'font-size': 10,
      'font-weight': 600,
      'curve-style': 'bezier',
      'target-arrow-shape': 'triangle',
      'arrow-scale': DEFAULT_EDGE_STYLE.arrowScale,
      'line-color': DEFAULT_EDGE_STYLE.lineColor,
      'target-arrow-color': DEFAULT_EDGE_STYLE.lineColor,
      color: '#b7c4d8',
      'text-rotation': 'autorotate',
      'text-background-color': 'rgba(8, 15, 32, 0.82)',
      'text-background-opacity': 1,
      'text-background-padding': '3px',
      'text-border-width': 1,
      'text-border-color': 'rgba(51, 65, 85, 0.45)',
      'text-border-opacity': 1,
      opacity: DEFAULT_EDGE_STYLE.opacity,
      width: DEFAULT_EDGE_STYLE.width,
      'line-style': 'solid',
      'transition-property': 'opacity width underlay-opacity underlay-padding shadow-blur shadow-opacity arrow-scale',
      'transition-duration': 150,
      'transition-timing-function': 'ease-out',
    },
  },
  ...EDGE_RELATION_SELECTORS,
  {
    selector: 'edge.path-active:not(.selected-edge):not(.selected-neighborhood-edge), edge.path-active[relation]:not(.selected-edge):not(.selected-neighborhood-edge)',
    style: {
      width: 3.1,
      'line-color': '#93c5fd',
      'target-arrow-color': '#93c5fd',
      opacity: 0.95,
    },
  },
  {
    selector: 'edge.search-match, edge.search-match[relation]',
    style: {
      width: 4.4,
      opacity: 1,
      'arrow-scale': 1.12,
      'shadow-blur': 14,
      'shadow-opacity': 0.52,
      'underlay-opacity': 0.12,
      'underlay-padding': 4,
    },
  },
  {
    selector: 'edge.selected-neighborhood-edge, edge.selected-neighborhood-edge[relation]',
    style: {
      width: 5,
      opacity: 1,
      'arrow-scale': 1.14,
      'shadow-blur': 18,
      'shadow-opacity': 0.82,
      'underlay-opacity': 0.14,
      'underlay-padding': 4,
    },
  },
  {
    selector: 'edge.selected-edge, edge.selected-edge[relation]',
    style: {
      width: 4.9,
      opacity: 1,
      'arrow-scale': 1.14,
      'shadow-blur': 16,
      'shadow-opacity': 0.88,
      'underlay-opacity': 0.14,
      'underlay-padding': 4,
    },
  },
  {
    selector: 'edge.selected-chain-edge, edge.selected-chain-edge[relation]',
    style: {
      width: 4.5,
      opacity: 0.98,
      'arrow-scale': 1.12,
      'underlay-opacity': 0.16,
      'underlay-padding': 4,
      'shadow-blur': 18,
      'shadow-opacity': 0.64,
      'text-background-opacity': 1,
    },
  },
  {
    selector: 'edge.selected-chain-edge.chain-depth-1, edge.selected-chain-edge.chain-depth-1[relation]',
    style: {
      width: 5.8,
      opacity: 1,
      'arrow-scale': 1.16,
      'underlay-opacity': 0.24,
      'underlay-padding': 6,
      'shadow-blur': 24,
      'shadow-opacity': 0.9,
      'transition-delay': 35,
    },
  },
  {
    selector: 'edge.selected-chain-edge.chain-depth-2, edge.selected-chain-edge.chain-depth-2[relation]',
    style: {
      width: 5,
      opacity: 0.99,
      'arrow-scale': 1.13,
      'underlay-opacity': 0.18,
      'underlay-padding': 5,
      'shadow-blur': 20,
      'shadow-opacity': 0.72,
      'transition-delay': 125,
    },
  },
  {
    selector: 'edge.selected-chain-edge.chain-depth-3plus, edge.selected-chain-edge.chain-depth-3plus[relation]',
    style: {
      width: 4.4,
      opacity: 0.94,
      'arrow-scale': 1.09,
      'underlay-opacity': 0.13,
      'underlay-padding': 4,
      'shadow-blur': 16,
      'shadow-opacity': 0.5,
      'transition-delay': 215,
    },
  },
];

export default attackGraphStylesheet;
