import { useState } from 'react';
import { motion } from 'framer-motion';
import { Settings, Shield, Bell, Clock, Layers, Activity, Save, CheckCircle, User, LogOut } from 'lucide-react';
import { useAuth } from '../lib/AuthContext';
import { useNavigate } from 'react-router-dom';

const DS = {
  bg: '#0f172a', card: '#131b2e', cardHigh: '#222a3d',
  border: 'rgba(14,165,233,0.12)', primary: '#0ea5e9',
  text: '#dae2fd', muted: '#88929b', surface: '#0b1326',
};

const slaDefaults: Record<string, number> = {
  critical: 4, high: 12, medium: 24, low: 48,
};

export const SettingsHub = () => {
  const { user, profile, signOut } = useAuth();
  const navigate = useNavigate();
  
  const role = profile?.role || 'employee';
  const isSuper = role === 'superadmin' || user?.email === 'superadmin@elitemindz.co';
  const isAdmin = role === 'admin' || isSuper;

  const sections = [
    { id: 'profile', name: 'Profile', icon: User },
    ...(isAdmin ? [{ id: 'sla', name: 'SLA Configuration', icon: Clock }] : []),
    ...(isSuper ? [{ id: 'permissions', name: 'Roles & Permissions', icon: Shield }] : []),
    { id: 'notifications', name: 'Notifications', icon: Bell },
    ...(isSuper ? [{ id: 'logs', name: 'System Logs', icon: Activity }] : []),
  ];

  const [activeSection, setActiveSection] = useState('profile');
  const [sla, setSla] = useState(slaDefaults);
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  const InputField = ({ label, value, type = 'text', onChange }: any) => (
    <div>
      <label style={{ display: 'block', color: DS.muted, fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '8px' }}>
        {label}
      </label>
      <input
        type={type} value={value} onChange={onChange}
        style={{
          width: '100%', background: DS.surface, border: `1px solid ${DS.border}`,
          borderRadius: '10px', padding: '11px 14px', color: DS.text,
          fontSize: '0.875rem', outline: 'none', boxSizing: 'border-box',
        }}
        onFocus={e => (e.target.style.borderColor = 'rgba(14,165,233,0.5)')}
        onBlur={e => (e.target.style.borderColor = DS.border)}
      />
    </div>
  );

  const renderContent = () => {
    switch (activeSection) {
      case 'profile':
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '20px', padding: '24px', background: DS.surface, borderRadius: '16px', border: `1px solid ${DS.border}` }}>
              <div style={{ width: '64px', height: '64px', borderRadius: '16px', background: 'linear-gradient(135deg, #0ea5e9, #1e3a5f)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '20px', fontWeight: 800 }}>
                {(user?.email || 'U').substring(0, 2).toUpperCase()}
              </div>
              <div>
                <h3 style={{ color: DS.text, fontWeight: 800, fontSize: '1.1rem' }}>{user?.email?.split('@')[0] || 'User'}</h3>
                <p style={{ color: DS.muted, fontSize: '0.8rem' }}>{user?.email}</p>
                <span style={{ display: 'inline-block', marginTop: '6px', padding: '2px 10px', borderRadius: '99px', background: 'rgba(14,165,233,0.15)', color: '#89ceff', fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  {role}
                </span>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <InputField label="Display Name" value={user?.email?.split('@')[0] || ''} onChange={() => {}} />
              <InputField label="Email" value={user?.email || ''} type="email" onChange={() => {}} />
            </div>
            <InputField label="Department" value={profile?.department || 'General'} onChange={() => {}} />

            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={handleSave}
                style={{
                  background: saved ? 'rgba(74,222,128,0.2)' : 'linear-gradient(135deg, #0ea5e9, #0284c7)',
                  border: saved ? '1px solid rgba(74,222,128,0.3)' : 'none',
                  borderRadius: '12px', padding: '12px 24px', color: saved ? '#4ade80' : '#fff',
                  fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: '8px', letterSpacing: '0.06em',
                  boxShadow: saved ? 'none' : '0 6px 16px rgba(14,165,233,0.3)',
                  transition: 'all 0.3s',
                }}
              >
                {saved ? <CheckCircle size={16} /> : <Save size={16} />}
                {saved ? 'Saved!' : 'Save Changes'}
              </button>
              <button
                onClick={handleSignOut}
                style={{ background: 'rgba(255,180,171,0.1)', border: '1px solid rgba(255,180,171,0.2)', borderRadius: '12px', padding: '12px 24px', color: '#ffb4ab', fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', letterSpacing: '0.06em' }}
              >
                <LogOut size={16} /> Sign Out
              </button>
            </div>
          </div>
        );

      case 'sla':
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ background: DS.surface, borderRadius: '16px', padding: '24px', border: `1px solid ${DS.border}` }}>
              <h4 style={{ color: DS.text, fontWeight: 700, marginBottom: '6px' }}>Global SLA Targets</h4>
              <p style={{ color: DS.muted, fontSize: '0.8rem', marginBottom: '24px' }}>Resolution windows applied globally across the organization.</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {Object.entries(sla).map(([priority, hours]) => (
                  <div key={priority} style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '16px', background: DS.card, borderRadius: '12px', border: `1px solid ${DS.border}` }}>
                    <div style={{ width: '90px' }}>
                      <span style={{
                        padding: '4px 12px', borderRadius: '99px', fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase',
                        background: priority === 'critical' ? 'rgba(255,68,68,0.15)' : priority === 'high' ? 'rgba(255,184,110,0.15)' : priority === 'medium' ? 'rgba(14,165,233,0.15)' : 'rgba(74,222,128,0.15)',
                        color: priority === 'critical' ? '#ff4444' : priority === 'high' ? '#ffb86e' : priority === 'medium' ? '#89ceff' : '#4ade80',
                      }}>
                        {priority}
                      </span>
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={{ color: DS.muted, fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>Resolution Goal (Hours)</label>
                      <input
                        type="number"
                        value={hours}
                        onChange={e => setSla(prev => ({ ...prev, [priority]: Number(e.target.value) }))}
                        style={{
                          width: '120px', background: DS.surface, border: `1px solid ${DS.border}`,
                          borderRadius: '8px', padding: '8px 12px', color: DS.text,
                          fontSize: '0.875rem', outline: 'none',
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <button onClick={handleSave} style={{ alignSelf: 'flex-start', background: 'linear-gradient(135deg, #0ea5e9, #0284c7)', border: 'none', borderRadius: '12px', padding: '12px 24px', color: '#fff', fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 6px 16px rgba(14,165,233,0.3)' }}>
              {saved ? <CheckCircle size={16} /> : <Save size={16} />} {saved ? 'Saved!' : 'Save SLA Config'}
            </button>
          </div>
        );

      case 'notifications':
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {[
              { label: 'SLA Breach Alerts', desc: 'Get notified when a ticket exceeds its SLA threshold', enabled: true },
              { label: 'New Ticket Assignments', desc: 'Alert when a ticket is assigned to you', enabled: true },
              { label: 'Ticket Status Updates', desc: 'Notification when ticket status changes', enabled: false },
              { label: 'System Maintenance Alerts', desc: 'Infrastructure and downtime notifications', enabled: false },
            ].map((n, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px', background: DS.surface, borderRadius: '14px', border: `1px solid ${DS.border}` }}>
                <div>
                  <h4 style={{ color: DS.text, fontWeight: 700, fontSize: '0.9rem', marginBottom: '4px' }}>{n.label}</h4>
                  <p style={{ color: DS.muted, fontSize: '0.78rem' }}>{n.desc}</p>
                </div>
                <div
                  style={{
                    width: '48px', height: '26px', borderRadius: '99px',
                    background: n.enabled ? '#0ea5e9' : 'rgba(136,146,155,0.3)',
                    position: 'relative', cursor: 'pointer', transition: 'background 0.2s',
                    flexShrink: 0,
                  }}
                >
                  <div style={{
                    position: 'absolute', top: '3px', left: n.enabled ? '25px' : '3px',
                    width: '20px', height: '20px', borderRadius: '50%', background: '#fff',
                    transition: 'left 0.2s', boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
                  }} />
                </div>
              </div>
            ))}
          </div>
        );

      case 'permissions':
        return (
          <div style={{ background: DS.surface, borderRadius: '16px', border: `1px solid ${DS.border}`, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'rgba(14,165,233,0.04)' }}>
                  {['Permission', 'Employee', 'Admin', 'Super Admin'].map(h => (
                    <th key={h} style={{ padding: '14px 20px', textAlign: 'left', fontSize: '0.65rem', fontWeight: 700, color: DS.muted, letterSpacing: '0.1em', textTransform: 'uppercase' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  { perm: 'Create Tickets', emp: true, adm: true, sup: true },
                  { perm: 'View All Tickets', emp: false, adm: true, sup: true },
                  { perm: 'Assign Tickets', emp: false, adm: true, sup: true },
                  { perm: 'Manage Assets', emp: false, adm: true, sup: true },
                  { perm: 'View Analytics', emp: false, adm: true, sup: true },
                  { perm: 'Configure SLA', emp: false, adm: false, sup: true },
                  { perm: 'Manage Admins', emp: false, adm: false, sup: true },
                ].map(row => (
                  <tr key={row.perm} style={{ borderTop: `1px solid ${DS.border}` }}>
                    <td style={{ padding: '14px 20px', color: DS.text, fontWeight: 600, fontSize: '0.85rem' }}>{row.perm}</td>
                    {[row.emp, row.adm, row.sup].map((v, i) => (
                      <td key={i} style={{ padding: '14px 20px' }}>
                        <CheckCircle size={18} color={v ? '#4ade80' : 'rgba(136,146,155,0.3)'} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );

      case 'logs':
        return (
          <div style={{ background: DS.surface, borderRadius: '16px', padding: '24px', border: `1px solid ${DS.border}` }}>
            <p style={{ color: DS.muted, fontFamily: 'monospace', fontSize: '0.78rem', lineHeight: 2 }}>
              {[
                '[2025-04-23 14:33:12] INFO  — User superadmin@elitemindz.co logged in',
                '[2025-04-23 14:30:00] INFO  — Ticket TC-1024 status changed: open → in_progress',
                '[2025-04-23 14:15:42] WARN  — SLA breach detected for ticket TC-1019',
                '[2025-04-23 14:00:00] INFO  — Scheduled backup completed successfully',
                '[2025-04-23 13:45:18] INFO  — New user onboarded: support1@elitemindz.co',
                '[2025-04-23 13:22:01] ERROR — Failed asset sync for device AST-8822',
              ].map((log, i) => (
                <div key={i} style={{ color: log.includes('ERROR') ? '#ffb4ab' : log.includes('WARN') ? '#ffb86e' : DS.muted }}>{log}</div>
              ))}
            </p>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: DS.bg, padding: '32px', fontFamily: "'Inter', sans-serif" }}>
      <div style={{ maxWidth: '1100px', margin: '0 auto' }}>

        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} style={{ marginBottom: '28px' }}>
          <p style={{ color: DS.muted, fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '4px' }}>Configuration</p>
          <h1 style={{ color: DS.text, fontSize: '1.875rem', fontWeight: 800, letterSpacing: '-0.02em' }}>Settings</h1>
        </motion.div>

        <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: '24px' }}>
          {/* Left Nav */}
          <div style={{ background: DS.card, borderRadius: '16px', padding: '12px', border: `1px solid ${DS.border}`, height: 'fit-content' }}>
            {sections.map(s => (
              <button
                key={s.id}
                onClick={() => setActiveSection(s.id)}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: '10px',
                  padding: '11px 14px', borderRadius: '10px', border: 'none', cursor: 'pointer',
                  marginBottom: '4px', textAlign: 'left',
                  background: activeSection === s.id ? 'rgba(14,165,233,0.15)' : 'transparent',
                  color: activeSection === s.id ? '#89ceff' : DS.muted,
                  fontWeight: activeSection === s.id ? 700 : 600,
                  fontSize: '0.82rem',
                  transition: 'all 0.15s',
                }}
              >
                <s.icon size={16} />
                {s.name}
              </button>
            ))}
          </div>

          {/* Content */}
          <motion.div key={activeSection} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            {renderContent()}
          </motion.div>
        </div>
      </div>
    </div>
  );
};
