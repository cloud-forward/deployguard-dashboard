import { createBrowserRouter, Navigate } from 'react-router-dom';
import { PublicOnlyRoute, RequireAuth } from '../components/auth/RouteGuards';
import DashboardLayout from '../components/layout/DashboardLayout';
import LoginPage from '../pages/LoginPage';
import SignupPage from '../pages/SignupPage';
import DashboardPage from '../pages/DashboardPage';
import AttackGraphPage from '../pages/AttackGraphPage';
import AttackPathDetailPage from '../pages/AttackPathDetailPage';
import ClustersPage from '../pages/ClustersPage';
import RemediationRecommendationDetailPage from '../pages/RemediationRecommendationDetailPage';
import ScansPage from '../pages/ScansPage';
import RiskPage from '../pages/RiskPage';
import RemediationPage from '../pages/RemediationPage';
import RiskOptimizationPage from '../pages/RiskOptimizationPage';
import WorkloadSecurityPage from '../pages/WorkloadSecurityPage';
import InventoryPage from '../pages/InventoryPage';
import ActivityPage from '../pages/ActivityPage';

export const router = createBrowserRouter([
  {
    path: '/login',
    element: (
      <PublicOnlyRoute>
        <LoginPage />
      </PublicOnlyRoute>
    ),
  },
  {
    path: '/signup',
    element: (
      <PublicOnlyRoute>
        <SignupPage />
      </PublicOnlyRoute>
    ),
  },
  {
    path: '/',
    element: (
      <RequireAuth>
        <DashboardLayout />
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
    ],
  },
  {
    path: '*',
    element: <Navigate to="/" replace />,
  },
]);
