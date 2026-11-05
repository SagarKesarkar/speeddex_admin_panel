import type { ReactNode } from 'react';
import { createBrowserRouter, Navigate, RouterProvider } from 'react-router';
import { useAuth } from './auth';
import { Layout } from './components/Layout';
import { Empty, Spinner } from './components/ui';
import { AuditLog } from './pages/AuditLog';
import { CardMaker } from './pages/CardMaker';
import { CaptureView, Captures } from './pages/Captures';
import { AiProposals, ProposalReview } from './pages/AiProposals';
import { Catalog, ModelView } from './pages/Catalog';
import { Dashboard } from './pages/Dashboard';
import { Login } from './pages/Login';
import { Reports } from './pages/Reports';
import { ReviewQueue } from './pages/ReviewQueue';
import { Store } from './pages/Store';
import { UserView, Users } from './pages/Users';

/** Hides admin-only pages from moderators. The API refuses them anyway. */
function AdminOnly({ children }: { children: ReactNode }) {
  return useAuth().me?.role === 'admin' ? children : <Empty title="Admins only">Ask an admin if you need this page.</Empty>;
}

const router = createBrowserRouter(
  [
    {
      element: <Layout />,
      children: [
        { index: true, element: <Dashboard /> },
        { path: 'review', element: <ReviewQueue /> },
        { path: 'captures', element: <Captures /> },
        { path: 'captures/:id', element: <CaptureView /> },
        { path: 'reports', element: <Reports /> },
        { path: 'users', element: <Users /> },
        { path: 'users/:id', element: <UserView /> },
        { path: 'catalog', element: <Catalog /> },
        { path: 'catalog/models/:id', element: <ModelView /> },
        { path: 'catalog/ai', element: <AdminOnly><AiProposals /></AdminOnly> },
        { path: 'catalog/ai/:id', element: <AdminOnly><ProposalReview /></AdminOnly> },
        { path: 'card-maker', element: <CardMaker /> },
        { path: 'store', element: <AdminOnly><Store /></AdminOnly> },
        { path: 'audit', element: <AdminOnly><AuditLog /></AdminOnly> },
        { path: '*', element: <Navigate to="/" replace /> },
      ],
    },
  ],
  { basename: '/admin' },
);

export function App() {
  const { me, ready } = useAuth();
  if (!ready) return <div className="login"><Spinner /></div>;
  if (!me) return <Login />;
  return <RouterProvider router={router} />;
}
