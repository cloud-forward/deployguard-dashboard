import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import CytoscapeComponent from 'react-cytoscapejs';
import cytoscape, { type ElementDefinition, type LayoutOptions } from 'cytoscape';
import fcose from 'cytoscape-fcose';
import type { NodeData } from './mockGraphData';
import { attackGraphDefaultLayout, attackGraphStylesheet } from './attackGraph';

cytoscape.use(fcose);

interface EdgeData {
  id: string;
  source: string;
  target: string;
  label?: string;
  relation?: string;
  sourceLabel?: string;
  targetLabel?: string;
}

interface GraphViewProps {
  elements: ElementDefinition[];
  layout?: LayoutOptions;
  stylesheet?: Array<Record<string, unknown>>;
  viewportRefreshKey?: string;
  selectedPathNodeIds: string[];
  selectedPathEdgeIds: string[];
  selectedNodeId: string | null;
  selectedEdgeId: string | null;
  showLabels?: boolean;
  onNodeClick: (node: NodeData) => void;
  onEdgeClick: (edge: EdgeData) => void;
}

const getLayoutPadding = (layout: LayoutOptions): number => {
  const rawPadding = (layout as LayoutOptions & { padding?: unknown }).padding;
  return typeof rawPadding === 'number' ? rawPadding : 24;
};

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
  layout = attackGraphDefaultLayout,
  stylesheet = attackGraphStylesheet,
  viewportRefreshKey,
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
      return stylesheet;
    }

    return [
      ...stylesheet,
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
  }, [showLabels, stylesheet]);

  const pathNodeIds = normalizeSelectionSet(selectedPathNodeIds);
  const pathEdgeIds = normalizeSelectionSet(selectedPathEdgeIds);
  const cyRef = useRef<cytoscape.Core | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const resizeFrameRef = useRef<number | null>(null);
  const [hoveredEdge, setHoveredEdge] = useState<{
    edge: EdgeData;
    position: { x: number; y: number };
  } | null>(null);
  const nodeLookup = useMemo(() => {
    const map = new Map<string, { id: string; label: string }>();

    for (const element of elements) {
      const data = element.data as Record<string, unknown>;
      if (typeof data.source === 'string') {
        continue;
      }

      const id = String(data.id ?? '');
      map.set(id, {
        id,
        label: String(data.fullLabel ?? data.label ?? id),
      });
    }

    return map;
  }, [elements]);

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
          label: String(raw.fullLabel ?? raw.label ?? ''),
          type: toNodeType(raw.type),
          namespace: typeof raw.namespace === 'string' ? raw.namespace : undefined,
          details:
            typeof raw.details === 'object' && raw.details !== null
              ? Object.entries(raw.details as Record<string, unknown>).reduce<Record<string, string>>((acc, [key, value]) => {
                  acc[key] = value == null ? '' : String(value);
                  return acc;
                }, {})
              : {},
          blastRadius:
            typeof raw.blastRadius === 'object' && raw.blastRadius !== null
              ? {
                  pods: Number((raw.blastRadius as Record<string, unknown>).pods ?? 0),
                  secrets: Number((raw.blastRadius as Record<string, unknown>).secrets ?? 0),
                  databases: Number((raw.blastRadius as Record<string, unknown>).databases ?? 0),
                  adminPrivilege: Boolean((raw.blastRadius as Record<string, unknown>).adminPrivilege),
                }
              : {
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
        const sourceId = String(raw.source ?? '');
        const targetId = String(raw.target ?? '');
        onEdgeClick({
          id: String(raw.id ?? ''),
          source: sourceId,
          target: targetId,
          relation: typeof raw.relation === 'string' ? raw.relation : undefined,
          label: typeof raw.label === 'string' ? raw.label : undefined,
          sourceLabel: nodeLookup.get(sourceId)?.label ?? sourceId,
          targetLabel: nodeLookup.get(targetId)?.label ?? targetId,
        });
      });

      const updateHoveredEdge = (evt: cytoscape.EventObject) => {
        const raw = evt.target.data() as Record<string, unknown>;
        const sourceId = String(raw.source ?? '');
        const targetId = String(raw.target ?? '');
        const container = containerRef.current;
        const renderedPosition = evt.renderedPosition ?? evt.target.renderedMidpoint();
        const width = container?.clientWidth ?? 0;
        const height = container?.clientHeight ?? 0;
        const x = Math.max(12, Math.min(renderedPosition.x + 14, Math.max(12, width - 260)));
        const y = Math.max(12, Math.min(renderedPosition.y + 14, Math.max(12, height - 120)));

        setHoveredEdge({
          edge: {
            id: String(raw.id ?? ''),
            source: sourceId,
            target: targetId,
            relation: typeof raw.relation === 'string' ? raw.relation : undefined,
            label: typeof raw.label === 'string' ? raw.label : undefined,
            sourceLabel: nodeLookup.get(sourceId)?.label ?? sourceId,
            targetLabel: nodeLookup.get(targetId)?.label ?? targetId,
          },
          position: { x, y },
        });
      };

      cy.on('mouseover', 'edge', updateHoveredEdge);
      cy.on('mousemove', 'edge', updateHoveredEdge);
      cy.on('mouseout', 'edge', () => {
        setHoveredEdge(null);
      });
      cy.on('tap', (evt) => {
        if (evt.target === cy) {
          setHoveredEdge(null);
        }
      });

      // keep classes in sync for first paint
      updateSelectionState(cy, pathNodeIds, pathEdgeIds, selectedNodeId, selectedEdgeId);
    },
    [nodeLookup, onNodeClick, onEdgeClick, pathNodeIds, pathEdgeIds, selectedNodeId, selectedEdgeId, updateSelectionState],
  );

  useEffect(() => {
    const cy = cyRef.current;
    if (!cy) return;

    updateSelectionState(cy, pathNodeIds, pathEdgeIds, selectedNodeId, selectedEdgeId);
  }, [updateSelectionState, pathNodeIds, pathEdgeIds, selectedNodeId, selectedEdgeId]);

  useEffect(() => {
    const cy = cyRef.current;
    const container = containerRef.current;
    if (!cy || !container || elements.length === 0) {
      return;
    }

    const refreshViewport = () => {
      const width = container.clientWidth;
      const height = container.clientHeight;
      if (width === 0 || height === 0) {
        return;
      }

      cy.resize();
      cy.layout(layout).run();
      cy.fit(undefined, getLayoutPadding(layout));
    };

    const queueRefresh = () => {
      if (resizeFrameRef.current != null) {
        cancelAnimationFrame(resizeFrameRef.current);
      }

      resizeFrameRef.current = window.requestAnimationFrame(() => {
        resizeFrameRef.current = window.requestAnimationFrame(refreshViewport);
      });
    };

    queueRefresh();

    const observer = new ResizeObserver(() => {
      queueRefresh();
    });

    observer.observe(container);

    return () => {
      observer.disconnect();
      if (resizeFrameRef.current != null) {
        cancelAnimationFrame(resizeFrameRef.current);
        resizeFrameRef.current = null;
      }
    };
  }, [elements, layout, viewportRefreshKey]);

  useEffect(() => {
    setHoveredEdge(null);
  }, [elements, selectedNodeId, selectedEdgeId, selectedPathNodeIds, selectedPathEdgeIds]);

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%', position: 'relative' }}>
      <CytoscapeComponent
        elements={elements}
        stylesheet={graphStylesheet}
        layout={layout}
        style={{ width: '100%', height: '100%' }}
        cy={handleCy}
      />
      {hoveredEdge ? (
        <div
          className="card shadow-sm"
          style={{
            position: 'absolute',
            left: hoveredEdge.position.x,
            top: hoveredEdge.position.y,
            width: 240,
            zIndex: 20,
            pointerEvents: 'none',
          }}
        >
          <div className="card-body p-2 small">
            <div className="fw-semibold mb-1">{hoveredEdge.edge.relation ?? hoveredEdge.edge.label ?? hoveredEdge.edge.id}</div>
            <div className="text-muted">Source</div>
            <div className="text-break mb-1">
              {hoveredEdge.edge.sourceLabel ?? hoveredEdge.edge.source} ({hoveredEdge.edge.source})
            </div>
            <div className="text-muted">Target</div>
            <div className="text-break">
              {hoveredEdge.edge.targetLabel ?? hoveredEdge.edge.target} ({hoveredEdge.edge.target})
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default GraphView;
