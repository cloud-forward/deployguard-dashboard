import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import CytoscapeComponent from 'react-cytoscapejs';
import type { ElementDefinition } from 'cytoscape';
import type { NodeData } from './mockGraphData';
import { attackGraphStylesheet } from './attackGraph';

interface EdgeData {
  id: string;
  source: string;
  target: string;
  label?: string;
  relation?: string;
}

interface GraphViewProps {
  elements: ElementDefinition[];
  selectedPathNodeIds: string[];
  selectedPathEdgeIds: string[];
  selectedNodeId: string | null;
  selectedEdgeId: string | null;
  showLabels?: boolean;
  onNodeClick: (node: NodeData) => void;
  onEdgeClick: (edge: EdgeData) => void;
}

const normalizeSelectionSet = (ids: string[] | null | undefined): Set<string> => {
  return new Set(Array.isArray(ids) ? ids : []);
};

const toNodeType = (value: unknown): NodeData['type'] => {
  const type = String(value);
  if (type === 'S3') return 'S3Bucket';
  return (type as NodeData['type']) || 'Pod';
};

const GraphView: React.FC<GraphViewProps> = ({
  elements,
  selectedPathNodeIds,
  selectedPathEdgeIds,
  selectedNodeId,
  selectedEdgeId,
  showLabels = true,
  onNodeClick,
  onEdgeClick,
}) => {
  const graphStylesheet = useMemo(() => {
    if (showLabels) {
      return attackGraphStylesheet;
    }

    return [
      ...attackGraphStylesheet,
      {
        selector: 'node',
        style: {
          label: '',
          'text-opacity': 0,
        },
      },
      {
        selector: 'edge',
        style: {
          label: '',
          'text-opacity': 0,
        },
      },
      {
        selector: 'edge[relation = "escapes_to"]',
        style: {
          label: '',
        },
      },
    ];
  }, [showLabels]);

  const pathNodeIds = normalizeSelectionSet(selectedPathNodeIds);
  const pathEdgeIds = normalizeSelectionSet(selectedPathEdgeIds);
  const cyRef = useRef<cytoscape.Core | null>(null);

  const updateSelectionState = useCallback(
    (
      cy: cytoscape.Core,
      pathNodes: Set<string>,
      pathEdges: Set<string>,
      selectedNode: string | null,
      selectedEdge: string | null,
    ) => {
      cy.elements().removeClass('dimmed path-active selected-node selected-edge');
      const hasPathSelection = pathNodes.size > 0 || pathEdges.size > 0;

      if (!hasPathSelection && !selectedNode && !selectedEdge) {
        return;
      }

      if (hasPathSelection) {
        let pathNodeElements = cy.collection();
        let pathEdgeElements = cy.collection();

        pathNodes.forEach((id) => {
          const node = cy.getElementById(id);
          if (node.nonempty()) {
            pathNodeElements = pathNodeElements.add(node);
          }
        });

        pathEdges.forEach((id) => {
          const edge = cy.getElementById(id);
          if (edge.nonempty()) {
            pathEdgeElements = pathEdgeElements.add(edge);
          }
        });

        cy.elements().addClass('dimmed');
        pathNodeElements.removeClass('dimmed').addClass('path-active');
        pathEdgeElements.removeClass('dimmed').addClass('path-active');
      }

      if (selectedNode) {
        cy.getElementById(selectedNode).removeClass('dimmed').addClass('selected-node');
      }

      if (selectedEdge) {
        cy.getElementById(selectedEdge).removeClass('dimmed').addClass('selected-edge');
      }
    },
    [],
  );

  const handleCy = useCallback(
    (cy: cytoscape.Core) => {
      cyRef.current = cy;
      cy.removeAllListeners();
      cy.elements().removeClass('dimmed selected-node selected-edge path-active');

      cy.on('tap', 'node', (evt) => {
        const raw = evt.target.data() as Record<string, unknown>;
        const rawId = String(raw.id ?? '');
        const nodeHasPathSelection = pathNodeIds.size > 0;
        if (nodeHasPathSelection) {
          const isInPath = pathNodeIds.has(rawId);
          if (!isInPath) {
            return;
          }
        }

        // TODO Step4: move full payload mapping out of this component when detail contract is migrated.
        const legacyNode: NodeData = {
          id: rawId,
          label: String(raw.label ?? ''),
          type: toNodeType(raw.type),
          namespace: typeof raw.namespace === 'string' ? raw.namespace : undefined,
          details: {},
          blastRadius: {
            pods: 0,
            secrets: 0,
            databases: 0,
            adminPrivilege: false,
          },
        };
        onNodeClick(legacyNode);
      });

      cy.on('tap', 'edge', (evt) => {
        const raw = evt.target.data() as Record<string, unknown>;
        onEdgeClick({
          id: String(raw.id ?? ''),
          source: String(raw.source ?? ''),
          target: String(raw.target ?? ''),
          relation: typeof raw.relation === 'string' ? raw.relation : undefined,
          label: typeof raw.label === 'string' ? raw.label : undefined,
        });
      });

      // keep classes in sync for first paint
      updateSelectionState(cy, pathNodeIds, pathEdgeIds, selectedNodeId, selectedEdgeId);
    },
    [onNodeClick, onEdgeClick, pathNodeIds, pathEdgeIds, selectedNodeId, selectedEdgeId],
  );

  useEffect(() => {
    const cy = cyRef.current;
    if (!cy) return;

    updateSelectionState(cy, pathNodeIds, pathEdgeIds, selectedNodeId, selectedEdgeId);
  }, [updateSelectionState, pathNodeIds, pathEdgeIds, selectedNodeId, selectedEdgeId]);

  const graphLayout = useMemo<
    cytoscape.BreadthFirstLayoutOptions & {
      transform: (node: cytoscape.NodeSingular, position: { x: number; y: number }) => { x: number; y: number };
    }
  >(
    () => ({
      name: 'breadthfirst',
      directed: true,
      padding: 40,
      transform: (_node, position) => ({
        x: position.y,
        y: -position.x,
      }),
    }),
    [],
  );

  return (
    <CytoscapeComponent
      elements={elements}
      stylesheet={graphStylesheet}
      layout={graphLayout}
      style={{ width: '100%', height: '100%' }}
      cy={handleCy}
    />
  );
};

export default GraphView;
