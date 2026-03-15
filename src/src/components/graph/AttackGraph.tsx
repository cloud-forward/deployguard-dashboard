// ============================================================
// src/components/graph/AttackGraph.tsx
// Cytoscape.js 기반 공격 경로 그래프 시각화
//
// 주요 기능:
// 1. 노드를 타입(Pod, ServiceAccount, IAM Role 등)별로 다른 모양/색으로 표시
// 2. 엣지를 관계 종류(lateral_move, escapes_to 등)별로 다른 스타일로 표시
// 3. 공격 경로 선택 시 해당 경로만 하이라이트
// 4. 노드 클릭 시 Blast Radius 패널 열기
// ============================================================
import { useEffect, useRef } from 'react';
import cytoscape from 'cytoscape';
import dagre from 'cytoscape-dagre';
import type { GraphData, AttackPath } from '../../types';
import { useDashboardStore } from '../../store';

// dagre 레이아웃 플러그인 등록 (최초 1회만 필요)
cytoscape.use(dagre);

interface AttackGraphProps {
  graphData: GraphData;
}

export function AttackGraph({ graphData }: AttackGraphProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<cytoscape.Core | null>(null);

  const { selectedAttackPath, setSelectedAsset, graphLayout } = useDashboardStore();

  // ── 1. 그래프 초기화 ──────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current || !graphData) return;

    cyRef.current = cytoscape({
      container: containerRef.current,
      elements: transformToElements(graphData),
      layout: {
        name: 'dagre',
        rankDir: graphLayout, // 'LR' = 왼쪽→오른쪽, 'TB' = 위→아래
        padding: 60,
        spacingFactor: 1.3,
        nodeSep: 50,
        rankSep: 100,
      } as cytoscape.LayoutOptions,
      style: getGraphStylesheet(),
      minZoom: 0.1,
      maxZoom: 4,
      wheelSensitivity: 0.3,
    });

    // 노드 클릭 → 해당 자산 선택 (Blast Radius 패널 열림)
    cyRef.current.on('tap', 'node', (evt) => {
      const node = evt.target;
      const assetData = node.data('asset');
      if (assetData) setSelectedAsset(assetData);
    });

    // 배경 클릭 → 선택 해제
    cyRef.current.on('tap', (evt) => {
      if (evt.target === cyRef.current) setSelectedAsset(null);
    });

    return () => {
      cyRef.current?.destroy();
      cyRef.current = null;
    };
  }, [graphData, graphLayout, setSelectedAsset]);

  // ── 2. 공격 경로 하이라이트 ───────────────────────────────
  useEffect(() => {
    if (!cyRef.current) return;

    // 모든 하이라이트 초기화
    cyRef.current.elements().removeClass('highlighted dimmed path-edge');

    if (selectedAttackPath?.path_nodes) {
      const { path_nodes } = selectedAttackPath;

      // 경로에 속한 노드 하이라이트
      path_nodes.forEach((nodeId, idx) => {
        cyRef.current!.getElementById(nodeId).addClass('highlighted');

        // 경로의 엣지도 하이라이트
        if (idx < path_nodes.length - 1) {
          const nextId = path_nodes[idx + 1];
          cyRef.current!
            .edges(`[source = "${nodeId}"][target = "${nextId}"]`)
            .addClass('highlighted path-edge');
        }
      });

      // 나머지는 흐리게
      cyRef.current.elements().not('.highlighted, .path-edge').addClass('dimmed');

      // 선택된 경로의 첫 노드로 카메라 이동
      const firstNode = cyRef.current.getElementById(path_nodes[0]);
      if (firstNode.length > 0) {
        cyRef.current.animate({
          fit: {
            eles: cyRef.current.elements('.highlighted'),
            padding: 80,
          },
          duration: 600,
          easing: 'ease-in-out-cubic',
        });
      }
    }
  }, [selectedAttackPath]);

  return (
    <div
      ref={containerRef}
      className="w-full h-full rounded-lg"
      style={{ background: '#0d1117' }}
    />
  );
}

// ── 헬퍼: GraphData → Cytoscape elements 변환 ──────────────
function transformToElements(data: GraphData): cytoscape.ElementDefinition[] {
  const elements: cytoscape.ElementDefinition[] = [];

  data.nodes.forEach((asset) => {
    // 위험도에 따른 CSS 클래스
    const riskClass = `risk-${asset.risk_level}`;
    const specialClass = [
      asset.is_entry_point ? 'entry-point' : '',
      asset.is_crown_jewel ? 'crown-jewel' : '',
    ]
      .filter(Boolean)
      .join(' ');

    elements.push({
      data: {
        id: asset.id,
        label: asset.name,
        asset,                        // 클릭 시 원본 데이터 접근용
        riskScore: asset.risk_score,
      },
      classes: `${asset.type.toLowerCase().replace('_', '-')} ${riskClass} ${specialClass}`.trim(),
    });
  });

  data.edges.forEach((edge) => {
    elements.push({
      data: {
        id: edge.id || `${edge.source}-${edge.target}`,
        source: edge.source,
        target: edge.target,
        label: edge.relation,
      },
      classes: edge.relation.replace('_', '-'),
    });
  });

  return elements;
}

// ── 헬퍼: Cytoscape 스타일시트 ─────────────────────────────
function getGraphStylesheet(): cytoscape.StylesheetStyle[] {
  return [
    // 기본 노드
    {
      selector: 'node',
      style: {
        label: 'data(label)',
        color: '#e6edf3',
        'font-size': 10,
        'font-family': 'JetBrains Mono, monospace',
        'text-valign': 'bottom',
        'text-margin-y': 8,
        'text-wrap': 'ellipsis',
        'text-max-width': '100px',
        width: 36,
        height: 36,
        'background-color': '#21262d',
        'border-width': 2,
        'border-color': '#30363d',
      },
    },

    // 기본 엣지
    {
      selector: 'edge',
      style: {
        'curve-style': 'bezier',
        'target-arrow-shape': 'triangle',
        label: 'data(label)',
        'font-size': 9,
        color: '#7d8590',
        'line-color': '#30363d',
        'target-arrow-color': '#30363d',
        width: 1.5,
        'font-family': 'JetBrains Mono, monospace',
      },
    },

    // ── 노드 타입별 모양 / 색상 ──
    { selector: 'node.pod', style: { shape: 'ellipse', 'background-color': '#1f6feb' } },
    { selector: 'node.service-account', style: { shape: 'diamond', 'background-color': '#8957e5' } },
    { selector: 'node.secret', style: { shape: 'star', 'background-color': '#da3633' } },
    { selector: 'node.role, node.cluster-role', style: { shape: 'pentagon', 'background-color': '#388bfd' } },
    { selector: 'node.iam-role', style: { shape: 'hexagon', 'background-color': '#d29922' } },
    { selector: 'node.s3-bucket', style: { shape: 'barrel', 'background-color': '#2ea043' } },
    { selector: 'node.rds', style: { shape: 'rectangle', 'background-color': '#1f6feb' } },
    { selector: 'node.node', style: { shape: 'round-rectangle', 'background-color': '#4d2d90' } },

    // ── 특수 노드 ──
    {
      selector: 'node.entry-point',
      style: {
        'border-color': '#3fb950',
        'border-width': 4,
        'border-style': 'dashed',
      },
    },
    {
      selector: 'node.crown-jewel',
      style: {
        'border-color': '#f85149',
        'border-width': 5,
        'border-style': 'double',
      },
    },

    // ── 위험도별 글로우 ──
    {
      selector: 'node.risk-critical',
      style: {
        'overlay-color': '#f85149',
        'overlay-opacity': 0.15,
        'overlay-padding': 8,
      },
    },
    {
      selector: 'node.risk-high',
      style: {
        'overlay-color': '#d29922',
        'overlay-opacity': 0.1,
        'overlay-padding': 5,
      },
    },

    // ── 엣지 타입별 ──
    {
      selector: 'edge.escapes-to',
      style: { 'line-color': '#f85149', 'target-arrow-color': '#f85149', 'line-style': 'dashed', width: 3 },
    },
    {
      selector: 'edge.lateral-move',
      style: { 'line-color': '#d29922', 'target-arrow-color': '#d29922', 'line-style': 'dotted', width: 2 },
    },
    {
      selector: 'edge.contains-credentials',
      style: { 'line-color': '#db6d28', 'target-arrow-color': '#db6d28', width: 3 },
    },
    {
      selector: 'edge.assumes',
      style: { 'line-color': '#8957e5', 'target-arrow-color': '#8957e5', width: 2 },
    },

    // ── 하이라이트 / 딤 ──
    {
      selector: '.highlighted',
      style: {
        'border-color': '#e3b341',
        'border-width': 4,
        'z-index': 999,
      },
    },
    {
      selector: '.path-edge',
      style: {
        'line-color': '#e3b341',
        'target-arrow-color': '#e3b341',
        width: 3,
        'z-index': 999,
      },
    },
    {
      selector: '.dimmed',
      style: { opacity: 0.15 },
    },
  ];
}
