import React, { Suspense } from 'react';
import { createBrowserRouter, Navigate } from 'react-router-dom';
import { PublicOnlyRoute, RequireAuth } from '../components/auth/RouteGuards';
import PageLoader from '../components/layout/PageLoader';

const DashboardLayout = React.lazy(() => import('../components/layout/DashboardLayout'));
const LoginPage = React.lazy(() => import('../pages/LoginPage'));
const SignupPage = React.lazy(() => import('../pages/SignupPage'));
const DashboardPage = React.lazy(() => import('../pages/DashboardPage'));
const AttackGraphPage = React.lazy(() => import('../pages/AttackGraphPage'));
const AttackPathDetailPage = React.lazy(() => import('../pages/AttackPathDetailPage'));
const ClustersPage = React.lazy(() => import('../pages/ClustersPage'));
const RemediationRecommendationDetailPage = React.lazy(() => import('../pages/RemediationRecommendationDetailPage'));
const ScansPage = React.lazy(() => import('../pages/ScansPage'));
const RiskPage = React.lazy(() => import('../pages/RiskPage'));
const RemediationPage = React.lazy(() => import('../pages/RemediationPage'));
const RiskOptimizationPage = React.lazy(() => import('../pages/RiskOptimizationPage'));
const WorkloadSecurityPage = React.lazy(() => import('../pages/WorkloadSecurityPage'));
const InventoryPage = React.lazy(() => import('../pages/InventoryPage'));
const ActivityPage = React.lazy(() => import('../pages/ActivityPage'));
const AnalysisJobDetailPage = React.lazy(() => import('../pages/AnalysisJobDetailPage'));

const withFallback = (element: React.ReactNode, label: string) => (
  <Suspense fallback={<PageLoader label={label} minHeight="100vh" />}>{element}</Suspense>
);

export const router = createBrowserRouter([
  {
    path: '/login',
    element: (
      <PublicOnlyRoute>
        {withFallback(<LoginPage />, '로그인 페이지를 불러오는 중...')}
      </PublicOnlyRoute>
    ),
  },
  {
    path: '/signup',
    element: (
      <PublicOnlyRoute>
        {withFallback(<SignupPage />, '회원가입 페이지를 불러오는 중...')}
      </PublicOnlyRoute>
    ),
  },
  {
    path: '/',
    element: (
      <RequireAuth>
        {withFallback(<DashboardLayout />, '대시보드 레이아웃을 준비하는 중...')}
      </RequireAuth>
    ),
    children: [
      {
        index: true,
        element: <Navigate to="/dashboard" replace />,
      },
      {
        path: 'dashboard',
        element: <DashboardPage />,
      },
      {
        path: 'attack-graph',
        element: <AttackGraphPage />,
      },
      {
        path: 'clusters/:clusterId/graph',
        element: <AttackGraphPage />,
      },
      {
        path: 'clusters/:clusterId/attack-paths/:pathId',
        element: <AttackPathDetailPage />,
      },
      {
        path: 'clusters/:clusterId/recommendations/:recommendationId',
        element: <RemediationRecommendationDetailPage />,
      },
      {
        path: 'workload-security',
        element: <WorkloadSecurityPage />,
      },
      {
        path: 'clusters',
        element: <ClustersPage />,
      },
      {
        path: 'scans',
        element: <ScansPage />,
      },
      {
        path: 'risk-optimization',
        element: <RiskOptimizationPage />,
      },
      {
        path: 'risk',
        element: <RiskPage />,
      },
      {
        path: 'clusters/:clusterId/risk',
        element: <RiskPage />,
      },
      {
        path: 'remediation',
        element: <RemediationPage />,
      },
      {
        path: 'clusters/:clusterId/inventory',
        element: <InventoryPage />,
      },
      {
        path: 'activity',
        element: <ActivityPage />,
      },
      {
        path: 'analysis/jobs/:jobId',
        element: <AnalysisJobDetailPage />,
      },
    ],
  },
  {
    path: '*',
    element: <Navigate to="/" replace />,
  },
]);
