// ============================================================
// src/store/index.ts
// Zustand 전역 상태 관리
//
// 왜 Zustand를 쓰나요?
// React Query는 "서버 데이터 캐싱"을 담당,
// Zustand는 "UI 상태 (선택된 항목, 필터, 패널 열림 등)"를 담당합니다.
// ============================================================
import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type { AttackPath, Asset, RiskLevel } from '../types';

// -------- 타입 정의 --------
interface DashboardState {
  // 현재 선택된 클러스터
  selectedClusterId: string | null;
  setSelectedClusterId: (id: string | null) => void;

  // 공격 그래프: 선택된 경로 (하이라이트용)
  selectedAttackPath: AttackPath | null;
  setSelectedAttackPath: (path: AttackPath | null) => void;

  // Blast Radius 패널: 선택된 노드
  selectedAsset: Asset | null;
  setSelectedAsset: (asset: Asset | null) => void;

  // 공격 경로 필터
  riskFilter: RiskLevel | 'all';
  setRiskFilter: (level: RiskLevel | 'all') => void;

  // 런타임 증거 패널 열림 여부
  isEvidencePanelOpen: boolean;
  setEvidencePanelOpen: (open: boolean) => void;

  // 사이드바 열림 여부
  isSidebarOpen: boolean;
  toggleSidebar: () => void;

  // 그래프 레이아웃 방향
  graphLayout: 'LR' | 'TB';
  setGraphLayout: (layout: 'LR' | 'TB') => void;
}

// -------- 스토어 생성 --------
export const useDashboardStore = create<DashboardState>()(
  devtools(
    (set) => ({
      // 초기값
      selectedClusterId: null,
      setSelectedClusterId: (id) => set({ selectedClusterId: id }),

      selectedAttackPath: null,
      setSelectedAttackPath: (path) => set({ selectedAttackPath: path }),

      selectedAsset: null,
      setSelectedAsset: (asset) => set({ selectedAsset: asset }),

      riskFilter: 'all',
      setRiskFilter: (level) => set({ riskFilter: level }),

      isEvidencePanelOpen: false,
      setEvidencePanelOpen: (open) => set({ isEvidencePanelOpen: open }),

      isSidebarOpen: true,
      toggleSidebar: () => set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),

      graphLayout: 'LR',
      setGraphLayout: (layout) => set({ graphLayout: layout }),
    }),
    { name: 'DeployGuard Dashboard' } // Redux DevTools에서 보이는 이름
  )
);
