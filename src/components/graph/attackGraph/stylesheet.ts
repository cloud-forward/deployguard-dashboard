interface RiskStyle {
  borderColor: string;
  borderWidth: number;
}

type NodeTypeStyle = {
  backgroundColor: string;
  shape: string;
};

const NODE_TYPE_STYLES: Record<string, NodeTypeStyle> = {
  Ingress: { backgroundColor: '#6c757d', shape: 'diamond' },
  Pod: { backgroundColor: '#0d6efd', shape: 'round-rectangle' },
  ServiceAccount: { backgroundColor: '#6f42c1', shape: 'hexagon' },
  Role: { backgroundColor: '#fd7e14', shape: 'rectangle' },
  ClusterRole: { backgroundColor: '#fd7e14', shape: 'rectangle' },
  RoleBinding: { backgroundColor: '#ffc078', shape: 'vee' },
  ClusterRoleBinding: { backgroundColor: '#ffc078', shape: 'vee' },
  Secret: { backgroundColor: '#dc3545', shape: 'octagon' },
  Service: { backgroundColor: '#6c757d', shape: 'round-rectangle' },
  Node: { backgroundColor: '#0b5ed7', shape: 'rectangle' },
  ContainerImage: { backgroundColor: '#b197fc', shape: 'barrel' },
  IAMRole: { backgroundColor: '#ffc107', shape: 'rectangle' },
  IAMUser: { backgroundColor: '#ffe066', shape: 'ellipse' },
  EC2Instance: { backgroundColor: '#74c0fc', shape: 'round-rectangle' },
  SecurityGroup: { backgroundColor: '#ff8cc8', shape: 'tag' },
  S3: { backgroundColor: '#198754', shape: 'barrel' },
  RDS: { backgroundColor: '#2f9e44', shape: 'barrel' },
  Unknown: { backgroundColor: '#adb5bd', shape: 'ellipse' },
};

const SEVERITY_STYLES: Record<string, RiskStyle> = {
  critical: { borderColor: '#dc2626', borderWidth: 4 },
  high: { borderColor: '#f97316', borderWidth: 3 },
  medium: { borderColor: '#eab308', borderWidth: 3 },
  low: { borderColor: '#16a34a', borderWidth: 2 },
  unknown: { borderColor: '#adb5bd', borderWidth: 2 },
  none: { borderColor: '#adb5bd', borderWidth: 2 },
};

const nodeTypeSelectors = Object.entries(NODE_TYPE_STYLES).map(([type, style]) => ({
  selector: `node[type = "${type}"]`,
  style: {
    'background-color': style.backgroundColor,
    shape: style.shape,
  },
}));

const severitySelectors = Object.entries(SEVERITY_STYLES).map(([severity, style]) => ({
  selector: `node[severity = "${severity}"]`,
  style: {
    'border-color': style.borderColor,
    'border-width': style.borderWidth,
  },
}));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const attackGraphStylesheet: any[] = [
  {
    selector: 'node',
    style: {
      label: 'data(label)',
      'text-valign': 'bottom',
      'text-halign': 'center',
      'font-size': 11,
      'text-margin-y': 4,
      width: 48,
      height: 48,
      shape: 'ellipse',
      'border-width': 2,
      'border-color': '#adb5bd',
      color: '#212529',
      'text-outline-width': 0,
      'background-color': '#adb5bd',
    },
  },
  ...nodeTypeSelectors,
  ...severitySelectors,
  {
    selector: 'node[isEntryPoint = true], node[isEntryPoint = "true"]',
    style: {
      'underlay-color': '#0dcaf0',
      'underlay-opacity': 0.18,
      'underlay-padding': 8,
    },
  },
  {
    selector: 'node[isCrownJewel = true], node[isCrownJewel = "true"]',
    style: {
      'border-color': '#f59f00',
      'border-width': 5,
    },
  },
  {
    // Runtime evidence is expressed as a glow so it does not override base fill or border.
    selector: 'node[hasRuntimeEvidence = true], node[hasRuntimeEvidence = "true"]',
    style: {
      'shadow-blur': 20,
      'shadow-color': '#ffc107',
      'shadow-opacity': 0.75,
      'shadow-offset-x': 0,
      'shadow-offset-y': 0,
    },
  },
  {
    selector: 'node:active',
    style: {
      'border-width': 3,
      'border-color': '#212529',
    },
  },
  {
    selector: '.dimmed',
    style: {
      opacity: 0.2,
    },
  },
  {
    selector: 'node.path-active',
    style: {
      opacity: 1,
    },
  },
  {
    selector: 'edge.path-active',
    style: {
      opacity: 1,
    },
  },
  {
    selector: 'node.selected-node',
    style: {
      'border-width': 4,
      'border-color': '#212529',
    },
  },
  {
    selector: 'edge.selected-edge',
    style: {
      width: 3.5,
      'line-color': '#212529',
      'target-arrow-color': '#212529',
      'line-style': 'solid',
      'text-background-color': '#f8f9fa',
      'text-background-opacity': 1,
    },
  },
  {
    selector: 'edge.path-active:not(.selected-edge)',
    style: {
      'line-color': '#495057',
      'target-arrow-color': '#495057',
      width: 2.5,
      opacity: 1,
    },
  },
  {
    selector: 'edge',
    style: {
      label: 'data(label)',
      'font-size': 10,
      'curve-style': 'bezier',
      'target-arrow-shape': 'triangle',
      'line-color': '#adb5bd',
      'target-arrow-color': '#adb5bd',
      color: '#6c757d',
      'text-background-color': '#fff',
      'text-background-opacity': 1,
      'text-background-padding': '2px',
      width: 2,
    },
  },
  {
    selector: 'edge[relation = "escapes_to"]',
    style: {
      'line-color': '#ef4444',
      'target-arrow-color': '#ef4444',
      width: 3,
      'line-style': 'dashed',
      'line-dash-pattern': [4, 4],
    },
  },
];

export default attackGraphStylesheet;
