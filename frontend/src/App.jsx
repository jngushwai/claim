import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ToastProvider } from './components/ui/Toast';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Sessions from './pages/Sessions';
import Claims from './pages/Claims';
import Modules from './pages/Modules';
import Classes from './pages/Classes';
import Profile from './pages/Profile';
import Timetable from './pages/Timetable';
import Admin from './pages/Admin';

function Guard({ children, requireSuperAdmin = false }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="flex items-center justify-center h-screen text-gray-400">Loading…</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (requireSuperAdmin && user.role !== 'super_admin') return <Navigate to="/" replace />;
  return <Layout>{children}</Layout>;
}

function AppRoutes() {
  const { user } = useAuth();
  const homePath = user?.role === 'super_admin' ? '/admin' : '/';
  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to={homePath} replace /> : <Login />} />
      <Route path="/" element={<Guard><Dashboard /></Guard>} />
      <Route path="/admin" element={<Guard requireSuperAdmin><Admin /></Guard>} />
      <Route path="/sessions" element={<Guard><Sessions /></Guard>} />
      <Route path="/timetable" element={<Guard><Timetable /></Guard>} />
      <Route path="/claims" element={<Guard><Claims /></Guard>} />
      <Route path="/modules" element={<Guard><Modules /></Guard>} />
      <Route path="/classes" element={<Guard><Classes /></Guard>} />
      <Route path="/profile" element={<Guard><Profile /></Guard>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <AppRoutes />
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
