import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import CytoscapeComponent from 'react-cytoscapejs';
import cytoscape, { type ElementDefinition, type LayoutOptions } from 'cytoscape';
import fcose from 'cytoscape-fcose';
import dagre from 'cytoscape-dagre';
import type { NodeData } from './mockGraphData';
import { attackGraphDefaultLayout, attackGraphStylesheet } from './attackGraph';

cytoscape.use(fcose);
cytoscape.use(dagre);

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
  initialFitPadding?: number;
  minFitPadding?: number;
  onLayoutComplete?: (cy: cytoscape.Core) => void;
  focusNodeId?: string | null;
  focusRequestKey?: string | null;
  onFocusHandled?: (result: { found: boolean; nodeId: string }) => void;
  selectedPathNodeIds: string[];
  selectedPathEdgeIds: string[];
  selectedNodeId: string | null;
  selectedEdgeId: string | null;
  searchMatchedNodeIds?: string[];
  searchMatchedEdgeIds?: string[];
  searchContextNodeIds?: string[];
  searchContextEdgeIds?: string[];
  showLabels?: boolean;
  onNodeClick: (node: NodeData) => void;
  onEdgeClick: (edge: EdgeData) => void;
  onCanvasClick?: () => void;
}

const getLayoutPadding = (layout: LayoutOptions): number => {
  const rawPadding = (layout as LayoutOptions & { padding?: unknown }).padding;
  return typeof rawPadding === 'number' ? rawPadding : 24;
};

const FOCUS_BLINK_INTERVAL_MS = 600;
const FOCUS_TARGET_ZOOM = 1.08;
const FOCUS_REPEAT_ZOOM_DELTA = 0.08;
const FOCUS_MAX_KICK_ZOOM = 1.18;
const FOCUS_ANIMATION_DURATION_MS = 520;
const MIN_GRAPH_ZOOM = 0.16;
const MAX_GRAPH_ZOOM = 2.6;
const MIN_FIT_PADDING = 120;
type ChainDepthClass = 'chain-depth-1' | 'chain-depth-2' | 'chain-depth-3plus';
const SELECTION_STATE_CLASSES =
  'dimmed path-active selected-node selected-edge search-match search-dimmed search-context context-dimmed selected-neighborhood-edge selected-neighbor selected-chain-node selected-chain-edge chain-depth-1 chain-depth-2 chain-depth-3plus';

const normalizeSelectionSet = (ids: string[] | null | undefined): Set<string> => {
  return new Set(Array.isArray(ids) ? ids : []);
};

const toNodeType = (value: unknown): NodeData['type'] => {
  const type = String(value);
  if (type === 'S3') return 'S3Bucket';
  return (type as NodeData['type']) || 'Pod';
};

const getChainDepthClass = (depth: number): ChainDepthClass => {
  if (depth <= 1) return 'chain-depth-1';
  if (depth === 2) return 'chain-depth-2';
  return 'chain-depth-3plus';
};

const mergeDepth = (target: Map<string, number>, source: Map<string, number>) => {
  source.forEach((depth, id) => {
    const currentDepth = target.get(id);
    if (currentDepth == null || depth < currentDepth) {
      target.set(id, depth);
    }
  });
};

const collectDirectionalChain = (
  startNode: cytoscape.NodeSingular,
  direction: 'out' | 'in',
): {
  nodeDepths: Map<string, number>;
  edgeDepths: Map<string, number>;
} => {
  const nodeDepths = new Map<string, number>();
  const edgeDepths = new Map<string, number>();
  const visited = new Set<string>([startNode.id()]);
  const queue: Array<{ node: cytoscape.NodeSingular; depth: number }> = [{ node: startNode, depth: 0 }];

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) {
      continue;
    }

    const edges = direction === 'out' ? current.node.outgoers('edge') : current.node.incomers('edge');
    edges.forEach((edge) => {
      const nextNode = direction === 'out' ? edge.target() : edge.source();
      if (nextNode.empty()) {
        return;
      }

      const nextDepth = current.depth + 1;
      const currentEdgeDepth = edgeDepths.get(edge.id());
      if (currentEdgeDepth == null || nextDepth < currentEdgeDepth) {
        edgeDepths.set(edge.id(), nextDepth);
      }

      const currentNodeDepth = nodeDepths.get(nextNode.id());
      if (currentNodeDepth == null || nextDepth < currentNodeDepth) {
        nodeDepths.set(nextNode.id(), nextDepth);
      }

      if (!visited.has(nextNode.id())) {
        visited.add(nextNode.id());
        queue.push({ node: nextNode, depth: nextDepth });
      }
    });
  }

  return { nodeDepths, edgeDepths };
};

const collectSelectedChain = (
  cy: cytoscape.Core,
  selectedNodeId: string,
): {
  nodeDepths: Map<string, number>;
  edgeDepths: Map<string, number>;
} => {
  const startNode = cy.getElementById(selectedNodeId);
  if (startNode.empty() || !startNode.isNode()) {
    return {
      nodeDepths: new Map<string, number>(),
      edgeDepths: new Map<string, number>(),
    };
  }

  const outgoing = collectDirectionalChain(startNode, 'out');
  const incoming = collectDirectionalChain(startNode, 'in');
  const nodeDepths = new Map<string, number>();
  const edgeDepths = new Map<string, number>();

  mergeDepth(nodeDepths, outgoing.nodeDepths);
  mergeDepth(nodeDepths, incoming.nodeDepths);
  mergeDepth(edgeDepths, outgoing.edgeDepths);
  mergeDepth(edgeDepths, incoming.edgeDepths);

  nodeDepths.delete(selectedNodeId);

  return { nodeDepths, edgeDepths };
};

const collectSelectedEdgeChain = (
  cy: cytoscape.Core,
  selectedEdgeId: string,
): {
  nodeDepths: Map<string, number>;
  edgeDepths: Map<string, number>;
} => {
  const edge = cy.getElementById(selectedEdgeId);
  if (edge.empty() || !edge.isEdge()) {
    return {
      nodeDepths: new Map<string, number>(),
      edgeDepths: new Map<string, number>(),
    };
  }

  const sourceNode = edge.source();
  const targetNode = edge.target();
  if (sourceNode.empty() || targetNode.empty()) {
    return {
      nodeDepths: new Map<string, number>(),
      edgeDepths: new Map<string, number>(),
    };
  }

  const sourceChain = collectSelectedChain(cy, sourceNode.id());
  const targetChain = collectSelectedChain(cy, targetNode.id());
  const nodeDepths = new Map<string, number>();
  const edgeDepths = new Map<string, number>();

  mergeDepth(nodeDepths, sourceChain.nodeDepths);
  mergeDepth(nodeDepths, targetChain.nodeDepths);
  mergeDepth(edgeDepths, sourceChain.edgeDepths);
  mergeDepth(edgeDepths, targetChain.edgeDepths);

  nodeDepths.delete(sourceNode.id());
  nodeDepths.delete(targetNode.id());
  edgeDepths.delete(selectedEdgeId);

  return {
    nodeDepths,
    edgeDepths,
  };
};

const GraphView: React.FC<GraphViewProps> = ({
  elements,
  layout = attackGraphDefaultLayout,
  stylesheet = attackGraphStylesheet,
  viewportRefreshKey,
  initialFitPadding,
  minFitPadding = MIN_FIT_PADDING,
  onLayoutComplete,
  focusNodeId,
  focusRequestKey,
  onFocusHandled,
  selectedPathNodeIds,
  selectedPathEdgeIds,
  selectedNodeId,
  selectedEdgeId,
  searchMatchedNodeIds = [],
  searchMatchedEdgeIds = [],
  searchContextNodeIds = [],
  searchContextEdgeIds = [],
  showLabels = true,
  onNodeClick,
  onEdgeClick,
  onCanvasClick,
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
  const searchNodeIds = normalizeSelectionSet(searchMatchedNodeIds);
  const searchEdgeIds = normalizeSelectionSet(searchMatchedEdgeIds);
  const searchContextNodes = normalizeSelectionSet(searchContextNodeIds);
  const searchContextEdges = normalizeSelectionSet(searchContextEdgeIds);
  const cyRef = useRef<cytoscape.Core | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const resizeFrameRef = useRef<number | null>(null);
  const focusPulseIntervalRef = useRef<number | null>(null);
  const focusedNodeIdRef = useRef<string | null>(null);
  const handledFocusKeyRef = useRef<string | null>(null);
  const completedFocusKeyRef = useRef<string | null>(null);
  const isLayoutRunningRef = useRef(false);
  const [hoveredEdge, setHoveredEdge] = useState<{
    edge: EdgeData;
    position: { x: number; y: number };
  } | null>(null);
  const clearHoveredEdge = useCallback(() => {
    setHoveredEdge(null);
  }, []);
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

  const clearFocusedNode = useCallback((cy?: cytoscape.Core | null) => {
    const graph = cy ?? cyRef.current;

    if (focusPulseIntervalRef.current != null) {
      window.clearInterval(focusPulseIntervalRef.current);
      focusPulseIntervalRef.current = null;
    }

    if (!graph || !focusedNodeIdRef.current) {
      focusedNodeIdRef.current = null;
      return;
    }

    graph.getElementById(focusedNodeIdRef.current).removeClass('focus-target focus-target-emphasis');
    focusedNodeIdRef.current = null;
  }, []);

  const applyFocusHighlight = useCallback(
    (cy: cytoscape.Core, nodeId: string, requestKey: string) => {
      if (handledFocusKeyRef.current === requestKey) {
        return true;
      }

      const node = cy.getElementById(nodeId);
      if (node.empty()) {
        handledFocusKeyRef.current = requestKey;
        onFocusHandled?.({ found: false, nodeId });
        return false;
      }

      handledFocusKeyRef.current = requestKey;
      clearFocusedNode(cy);
      focusedNodeIdRef.current = nodeId;
      node.addClass('focus-target focus-target-emphasis');

      const runFocusAnimation = () => {
        const freshNode = cy.getElementById(nodeId);
        if (freshNode.empty() || freshNode.removed()) {
          return;
        }

        const freshPosition = freshNode.position();
        const nextZoom = Math.min(
          cy.maxZoom(),
          Math.max(
            cy.minZoom(),
            Math.min(FOCUS_MAX_KICK_ZOOM, Math.max(FOCUS_TARGET_ZOOM, cy.zoom() + FOCUS_REPEAT_ZOOM_DELTA)),
          ),
        );
        const nextPan = {
          x: cy.width() / 2 - freshPosition.x * nextZoom,
          y: cy.height() / 2 - freshPosition.y * nextZoom,
        };

        cy.stop();
        cy.animate({
          pan: nextPan,
          zoom: nextZoom,
          duration: FOCUS_ANIMATION_DURATION_MS,
          easing: 'ease-in-out-cubic',
        });
        completedFocusKeyRef.current = requestKey;
        onFocusHandled?.({ found: true, nodeId });
      };

      if (isLayoutRunningRef.current) {
        cy.one('layoutstop', runFocusAnimation);
      } else {
        runFocusAnimation();
      }

      let isEmphasized = true;
      focusPulseIntervalRef.current = window.setInterval(() => {
        if (node.removed()) {
          clearFocusedNode(cy);
          return;
        }

        isEmphasized = !isEmphasized;
        node.toggleClass('focus-target-emphasis', isEmphasized);
      }, FOCUS_BLINK_INTERVAL_MS);
      return true;
    },
    [clearFocusedNode, onFocusHandled],
  );

  const updateSelectionState = useCallback(
    (
      cy: cytoscape.Core,
      pathNodes: Set<string>,
      pathEdges: Set<string>,
      selectedNode: string | null,
      selectedEdge: string | null,
      matchedNodes: Set<string>,
      matchedEdges: Set<string>,
      contextNodes: Set<string>,
      contextEdges: Set<string>,
    ) => {
      clearHoveredEdge();
      cy.batch(() => {
        cy.elements().removeClass(SELECTION_STATE_CLASSES);
        const hasPathSelection = pathNodes.size > 0 || pathEdges.size > 0;
        const hasSearchContext =
          matchedNodes.size > 0 || matchedEdges.size > 0 || contextNodes.size > 0 || contextEdges.size > 0;

        if (!hasPathSelection && !selectedNode && !selectedEdge && !hasSearchContext) {
          return;
        }

        if (hasSearchContext) {
          let matchedNodeElements = cy.collection();
          let matchedEdgeElements = cy.collection();
          let contextNodeElements = cy.collection();
          let contextEdgeElements = cy.collection();

          matchedNodes.forEach((id) => {
            const node = cy.getElementById(id);
            if (node.nonempty()) {
              matchedNodeElements = matchedNodeElements.add(node);
            }
          });

          matchedEdges.forEach((id) => {
            const edge = cy.getElementById(id);
            if (edge.nonempty()) {
              matchedEdgeElements = matchedEdgeElements.add(edge);
            }
          });

          contextNodes.forEach((id) => {
            const node = cy.getElementById(id);
            if (node.nonempty()) {
              contextNodeElements = contextNodeElements.add(node);
            }
          });

          contextEdges.forEach((id) => {
            const edge = cy.getElementById(id);
            if (edge.nonempty()) {
              contextEdgeElements = contextEdgeElements.add(edge);
            }
          });

          cy.elements().addClass('search-dimmed');
          contextNodeElements.removeClass('search-dimmed').addClass('search-context');
          contextEdgeElements.removeClass('search-dimmed').addClass('search-context');
          matchedNodeElements.removeClass('search-dimmed search-context').addClass('search-match');
          matchedEdgeElements.removeClass('search-dimmed search-context').addClass('search-match');
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
          const node = cy.getElementById(selectedNode);
          if (node.nonempty()) {
            const { nodeDepths, edgeDepths } = collectSelectedChain(cy, selectedNode);

            cy.elements().addClass('context-dimmed');
            node.removeClass('dimmed search-dimmed context-dimmed').addClass('selected-node');

            nodeDepths.forEach((depth, nodeId) => {
              const chainNode = cy.getElementById(nodeId);
              if (chainNode.nonempty()) {
                chainNode
                  .removeClass('dimmed search-dimmed context-dimmed')
                  .addClass(`selected-chain-node ${getChainDepthClass(depth)}`);
              }
            });

            edgeDepths.forEach((depth, edgeId) => {
              const chainEdge = cy.getElementById(edgeId);
              if (chainEdge.nonempty()) {
                chainEdge
                  .removeClass('dimmed search-dimmed context-dimmed')
                  .addClass(`selected-chain-edge ${getChainDepthClass(depth)}`);
              }
            });
          }
        }

        if (selectedEdge) {
          const edge = cy.getElementById(selectedEdge);
          if (edge.nonempty()) {
            const { nodeDepths, edgeDepths } = collectSelectedEdgeChain(cy, selectedEdge);
            cy.elements().addClass('context-dimmed');
            edge.removeClass('dimmed search-dimmed context-dimmed').addClass('selected-edge');
            edge.connectedNodes().removeClass('dimmed search-dimmed context-dimmed').addClass('selected-neighbor');

            nodeDepths.forEach((depth, nodeId) => {
              const chainNode = cy.getElementById(nodeId);
              if (chainNode.nonempty()) {
                chainNode
                  .removeClass('dimmed search-dimmed context-dimmed')
                  .addClass(`selected-chain-node ${getChainDepthClass(depth)}`);
              }
            });

            edgeDepths.forEach((depth, edgeId) => {
              const chainEdge = cy.getElementById(edgeId);
              if (chainEdge.nonempty()) {
                chainEdge
                  .removeClass('dimmed search-dimmed context-dimmed')
                  .addClass(`selected-chain-edge ${getChainDepthClass(depth)}`);
              }
            });
          }
        }
      });
    },
    [clearHoveredEdge],
  );

  const handleCy = useCallback(
    (cy: cytoscape.Core) => {
      cyRef.current = cy;
      cy.removeAllListeners();
      cy
        .elements()
        .removeClass(SELECTION_STATE_CLASSES);
      cy.minZoom(MIN_GRAPH_ZOOM);
      cy.maxZoom(MAX_GRAPH_ZOOM);

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
      cy.on('mouseout', 'edge', clearHoveredEdge);
      cy.on('tap', (evt) => {
        if (evt.target === cy) {
          clearHoveredEdge();
          onCanvasClick?.();
        }
      });

      // keep classes in sync for first paint
      updateSelectionState(
        cy,
        pathNodeIds,
        pathEdgeIds,
        selectedNodeId,
        selectedEdgeId,
        searchNodeIds,
        searchEdgeIds,
        searchContextNodes,
        searchContextEdges,
      );
    },
    [
      nodeLookup,
      onNodeClick,
      onEdgeClick,
      pathNodeIds,
      pathEdgeIds,
      selectedNodeId,
      selectedEdgeId,
      searchNodeIds,
      searchEdgeIds,
      searchContextNodes,
      searchContextEdges,
      clearHoveredEdge,
      updateSelectionState,
      onCanvasClick,
    ],
  );

  useEffect(() => {
    const cy = cyRef.current;
    if (!cy) return;

    updateSelectionState(
      cy,
      pathNodeIds,
      pathEdgeIds,
      selectedNodeId,
      selectedEdgeId,
      searchNodeIds,
      searchEdgeIds,
      searchContextNodes,
      searchContextEdges,
    );
  }, [
    updateSelectionState,
    pathNodeIds,
    pathEdgeIds,
    selectedNodeId,
    selectedEdgeId,
    searchNodeIds,
    searchEdgeIds,
    searchContextNodes,
    searchContextEdges,
  ]);

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
      cy.minZoom(MIN_GRAPH_ZOOM);
      cy.maxZoom(MAX_GRAPH_ZOOM);
      if (focusNodeId && focusRequestKey && completedFocusKeyRef.current === focusRequestKey) {
        return;
      }

      const layoutInstance = cy.layout(layout);
      isLayoutRunningRef.current = true;
      layoutInstance.one('layoutstop', () => {
        isLayoutRunningRef.current = false;
        onLayoutComplete?.(cy);
        cy.fit(undefined, initialFitPadding ?? Math.max(getLayoutPadding(layout), minFitPadding));

        if (focusNodeId && focusRequestKey) {
          applyFocusHighlight(cy, focusNodeId, focusRequestKey);
        }
      });
      layoutInstance.run();
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
  }, [
    elements,
    layout,
    minFitPadding,
    initialFitPadding,
    onLayoutComplete,
    viewportRefreshKey,
    focusNodeId,
    focusRequestKey,
    applyFocusHighlight,
  ]);

  useEffect(() => {
    const cy = cyRef.current;
    if (!cy || !focusNodeId || !focusRequestKey) {
      completedFocusKeyRef.current = null;
      clearFocusedNode(cy);
      return;
    }

    const runFocus = () => {
      window.setTimeout(() => {
        applyFocusHighlight(cy, focusNodeId, focusRequestKey);
      }, 0);
    };

    const frame = window.requestAnimationFrame(() => {
      if (isLayoutRunningRef.current) {
        cy.one('layoutstop', runFocus);
        return;
      }

      runFocus();
    });

    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, [applyFocusHighlight, clearFocusedNode, focusNodeId, focusRequestKey]);

  useEffect(() => {
    return () => {
      clearFocusedNode();
    };
  }, [clearFocusedNode]);

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
          className="card shadow-sm border-0"
          style={{
            position: 'absolute',
            left: hoveredEdge.position.x,
            top: hoveredEdge.position.y,
            width: 240,
            zIndex: 20,
            pointerEvents: 'none',
            background: 'rgba(8, 15, 32, 0.94)',
            border: '1px solid rgba(96, 165, 250, 0.12)',
            color: '#e2e8f0',
            backdropFilter: 'blur(12px)',
          }}
        >
          <div className="card-body p-2 small">
            <div className="fw-semibold mb-1">{hoveredEdge.edge.relation ?? hoveredEdge.edge.label ?? hoveredEdge.edge.id}</div>
            <div style={{ color: '#93a8c7' }}>출발</div>
            <div className="text-break mb-1">
              {hoveredEdge.edge.sourceLabel ?? hoveredEdge.edge.source} ({hoveredEdge.edge.source})
            </div>
            <div style={{ color: '#93a8c7' }}>도착</div>
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
