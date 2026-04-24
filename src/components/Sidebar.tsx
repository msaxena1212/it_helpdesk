import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Ticket,
  BarChart3,
  Settings,
  HelpCircle,
  Plus,
  Monitor,
  LogOut,
  Columns3,
  Users,
  History,
  ClipboardCheck,
} from 'lucide-react';
import { useAuth } from '../lib/AuthContext';

const S = {
  sidebar: {
    width: '240px',
    background: '#131b2e',
    borderRight: '1px solid rgba(14,165,233,0.1)',
    height: '100vh',
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'stretch',
    padding: '24px 16px',
    gap: '8px',
    position: 'sticky' as const,
    top: 0,
    zIndex: 40,
    fontFamily: "'Inter', sans-serif",
  },
};

const NavItem = ({ link }: { link: any }) => (
  <NavLink
    to={link.path}
    end={link.path === '/'}
    style={({ isActive }) => ({
      width: '100%', height: '44px',
      display: 'flex', alignItems: 'center', gap: '12px',
      padding: '0 12px',
      borderRadius: '10px',
      color: isActive ? '#0ea5e9' : '#88929b',
      background: isActive ? 'rgba(14,165,233,0.12)' : 'transparent',
      transition: 'all 0.2s',
      textDecoration: 'none',
      fontWeight: isActive ? 700 : 600,
      fontSize: '0.875rem',
    })}
  >
    <link.icon size={18} />
    {link.name}
  </NavLink>
);

export const Sidebar = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const role = user?.user_metadata?.role || 'employee';

  const mainLinks = [
    { name: 'Dashboard', path: '/', icon: LayoutDashboard },
    { name: 'Tickets', path: '/tickets', icon: Ticket },
    { name: 'Kanban', path: '/kanban', icon: Columns3 },
    { name: 'Analytics', path: '/analytics', icon: BarChart3 },
  ];

  const assetLinks = [
    { name: 'Assets Inventory', path: '/assets', icon: Monitor },
    { name: 'Asset Audit', path: '/assets/audit', icon: History },
    { name: 'Audit Session', path: '/assets/audit-session', icon: ClipboardCheck },
  ];

  const systemLinks = [
    ...(role === 'superadmin' ? [{ name: 'Team Management', path: '/admin', icon: Users }] : []),
    { name: 'Settings', path: '/settings', icon: Settings },
  ];

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  const initials = (user?.email || 'U').substring(0, 2).toUpperCase();

  return (
    <aside style={S.sidebar}>
      {/* Logo */}
      <div style={{ padding: '0 0 20px', display: 'flex', alignItems: 'center', gap: '12px', borderBottom: '1px solid rgba(14,165,233,0.1)', marginBottom: '12px' }}>
        <img
          src="/logo.webp"
          alt="Zyno by Elite Mindz"
          style={{ width: '42px', height: '42px', objectFit: 'contain' }}
        />
        <div>
          <h2 style={{ color: '#fff', fontSize: '1.1rem', fontWeight: 800, margin: 0, letterSpacing: '-0.02em' }}>ZYNO</h2>
          <p style={{ color: '#88929b', fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.1em', margin: 0, fontWeight: 700 }}>by Elite Mindz</p>
        </div>
      </div>

      {/* New Ticket quick action */}
      <button
        onClick={() => navigate('/tickets/new')}
        style={{
          width: '100%', height: '44px',
          background: 'linear-gradient(135deg, #0ea5e9, #0284c7)',
          borderRadius: '12px',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
          color: '#fff', border: 'none', cursor: 'pointer',
          boxShadow: '0 4px 16px rgba(14,165,233,0.4)',
          marginBottom: '16px',
          fontWeight: 700, fontSize: '0.85rem'
        }}
      >
        <Plus size={18} /> Raise Ticket
      </button>

      {/* Nav Links */}
      <nav style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px', overflowY: 'auto' }}>
        <p style={{ color: '#88929b', fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 800, margin: '8px 0 4px 8px' }}>Menu</p>
        {mainLinks.map((link) => <NavItem key={link.path} link={link} />)}

        <p style={{ color: '#88929b', fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 800, margin: '16px 0 4px 8px' }}>Asset Management</p>
        {assetLinks.map((link) => <NavItem key={link.path} link={link} />)}

        <p style={{ color: '#88929b', fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 800, margin: '16px 0 4px 8px' }}>System</p>
        {systemLinks.map((link) => <NavItem key={link.path} link={link} />)}
      </nav>

      {/* Bottom: User + Signout */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', borderTop: '1px solid rgba(14,165,233,0.1)', paddingTop: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '8px' }}>
          <div
            title={user?.email || ''}
            style={{
              width: '36px', height: '36px', borderRadius: '10px',
              background: 'linear-gradient(135deg, #0ea5e9, #1e3a5f)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#fff', fontSize: '11px', fontWeight: 800,
              flexShrink: 0
            }}
          >
            {initials}
          </div>
          <div style={{ flex: 1, overflow: 'hidden' }}>
            <p style={{ color: '#dae2fd', fontSize: '0.8rem', fontWeight: 700, margin: 0, whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
              {user?.email?.split('@')[0] || 'User'}
            </p>
            <p style={{ color: '#88929b', fontSize: '0.7rem', margin: 0, textTransform: 'capitalize' }}>
              {role}
            </p>
          </div>
        </div>

        <button
          onClick={handleSignOut}
          style={{ width: '100%', height: '40px', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '12px', padding: '0 12px', color: '#88929b', background: 'transparent', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: '0.875rem', transition: 'color 0.2s' }}
          onMouseEnter={e => e.currentTarget.style.color = '#ffb4ab'}
          onMouseLeave={e => e.currentTarget.style.color = '#88929b'}
        >
          <LogOut size={18} /> Sign Out
        </button>
      </div>
    </aside>
  );
};
