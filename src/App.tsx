import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect } from 'react';
import { Layout } from './components/Layout';
import { Login } from './pages/Login';
import { ResetPassword } from './pages/ResetPassword';
import { EmployeeDashboard } from './pages/EmployeeDashboard';
import { AdminDashboard } from './pages/AdminDashboard';
import { TicketList } from './pages/TicketList';
import { SuperAdminDashboard } from './pages/SuperAdminDashboard';
import { AnalyticsHub } from './pages/AnalyticsHub';
import { SettingsHub } from './pages/SettingsHub';
import { AssetHub } from './pages/AssetHub';
import { AssetAudit } from './pages/AssetAudit';
import { AuditSession } from './pages/AuditSession';
import { TicketKanban } from './pages/TicketKanban';
import { CreateTicket } from './pages/CreateTicket';
import { TicketDetail } from './pages/TicketDetail';
import { Assets } from './pages/Assets';
import { InventoryDashboard } from './pages/InventoryDashboard';
import { DevOpsDashboard } from './pages/DevOpsDashboard';
import { SubscriptionsHub } from './pages/SubscriptionsHub';
import './index.css';

import { AuthProvider, useAuth } from './lib/AuthContext';
import { checkSLABreaches } from './lib/api';

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  
  if (loading) return (
    <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0b1326', flexDirection: 'column', gap: '16px' }}>
      <img src="/logo.webp" alt="Zyno" style={{ width: '60px', opacity: 0.8 }} />
      <div style={{ color: '#88929b', fontSize: '0.8rem', letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 600 }}>Loading...</div>
    </div>
  );
  if (!user) return <Navigate to="/login" replace />;
  
  return <>{children}</>;
};

function AppRoutes() {
  const { user, profile } = useAuth();
  const userRole = (user?.email === 'superadmin@elitemindz.co') ? 'superadmin' : (profile?.role || 'employee');

  // USP #2: SLA Escalation Engine — polls every 5 minutes when authenticated
  useEffect(() => {
    if (!user) return;

    const runCheck = async () => {
      try {
        await checkSLABreaches();
      } catch (e) {
        console.warn('SLA check error (non-blocking):', e);
      }
    };

    runCheck(); // Run immediately on login
    const interval = setInterval(runCheck, 5 * 60 * 1000); // Then every 5 minutes
    return () => clearInterval(interval);
  }, [user]);

  const renderDashboard = () => {
    switch (userRole) {
      case 'superadmin': return <AdminDashboard />;
      case 'admin': return <AdminDashboard />;
      case 'inventory_manager': return <InventoryDashboard />;
      case 'devops': return <DevOpsDashboard />;
      default: return <EmployeeDashboard />;
    }
  };

  return (
    <Routes>
      <Route path="/login" element={!user ? <Login /> : <Navigate to="/" />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      
      <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route path="/" element={renderDashboard()} />
        <Route path="/tickets" element={<TicketList />} />
        <Route path="/admin" element={<SuperAdminDashboard />} />
        <Route path="/dashboard" element={<AdminDashboard />} />
        <Route path="/analytics" element={<AnalyticsHub />} />
        <Route path="/settings" element={<SettingsHub />} />
        <Route path="/assets" element={<AssetHub />} />
        <Route path="/assets/audit" element={<AssetAudit />} />
        <Route path="/assets/audit-session" element={<AuditSession />} />
        <Route path="/kanban" element={<TicketKanban />} />
        <Route path="/create-ticket" element={<CreateTicket />} />
        <Route path="/tickets/new" element={<CreateTicket />} />
        <Route path="/tickets/:id" element={<TicketDetail />} />
        <Route path="/inventory" element={<InventoryDashboard />} />
        <Route path="/subscriptions" element={<SubscriptionsHub />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <AuthProvider>
      <Router>
        <AppRoutes />
      </Router>
    </AuthProvider>
  );
}

export default App;
