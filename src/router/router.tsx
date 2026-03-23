import { createBrowserRouter, Navigate } from 'react-router-dom';
import DashboardLayout from '../components/layout/DashboardLayout';
import DashboardPage from '../pages/DashboardPage';
import AttackGraphPage from '../pages/AttackGraphPage';
import ClustersPage from '../pages/ClustersPage';
import ScansPage from '../pages/ScansPage';
import RiskPage from '../pages/RiskPage';
import InventoryPage from '../pages/InventoryPage';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <DashboardLayout />,
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
        path: 'clusters',
        element: <ClustersPage />,
      },
      {
        path: 'scans',
        element: <ScansPage />,
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
        path: 'clusters/:clusterId/inventory',
        element: <InventoryPage />,
      },
    ],
  },
]);
