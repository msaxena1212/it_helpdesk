import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users, UserPlus, ShieldCheck, Mail, Building2, Loader2,
  Search, Filter, MoreVertical, Edit2, Trash2, ChevronRight,
  Shield, UserCheck, UserCog, Building, X, Monitor, History,
  ArrowRightLeft, AlertCircle, ClipboardList, RotateCcw, Send
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { format } from 'date-fns';
import { getAllActivityLogs } from '../lib/api';

const DS = {
  bg: '#0f172a', card: '#131b2e', cardHigh: '#222a3d',
  border: 'rgba(14,165,233,0.12)', primary: '#0ea5e9',
  text: '#dae2fd', muted: '#88929b', surface: '#0b1326',
};

const departments = [
  { name: 'Engineering', color: '#0ea5e9' },
  { name: 'Sales', color: '#ffb86e' },
  { name: 'HR', color: '#4ade80' },
  { name: 'Operations', color: '#c084fc' },
];

export const SuperAdminDashboard = () => {
  const navigate = useNavigate();
  const [activeView, setActiveView] = useState('directory');
  const [showUserModal, setShowUserModal] = useState(false);
  const [users, setUsers] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchingAudit, setFetchingAudit] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [search, setSearch] = useState('');

  // Portfolio State
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [userAssets, setUserAssets] = useState<any[]>([]);
  const [userHistory, setUserHistory] = useState<any[]>([]);
  const [fetchingPortfolio, setFetchingPortfolio] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(null);

  useEffect(() => {
    fetchUsers();
  }, []);

  useEffect(() => {
    if (activeView === 'audit') fetchAudit();
  }, [activeView]);

  const fetchAudit = async () => {
    setFetchingAudit(true);
    try {
      const logs = await getAllActivityLogs(100);
      setAuditLogs(logs);
    } catch (e) {
      console.error(e);
    } finally {
      setFetchingAudit(false);
    }
  };

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*, assets:assets!assigned_to(id)')
        .order('name', { ascending: true });
      if (error) throw error;
      setUsers(data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const fetchPortfolio = async (user: any) => {
    setSelectedUser(user);
    setFetchingPortfolio(true);
    try {
      const [{ data: assets }, { data: history }] = await Promise.all([
        supabase.from('assets').select('*').eq('assigned_to', user.id),
        // Join with assets to get device details in history
        supabase.from('asset_history').select('*, assets(device_name, device_id)').eq('employee_id', user.id).order('created_at', { ascending: false })
      ]);
      setUserAssets(assets || []);
      setUserHistory(history || []);
    } catch (e) {
      console.error(e);
    } finally {
      setFetchingPortfolio(false);
    }
  };

  const handleCreateUser = async () => {
    if (!newUser.name || !newUser.email) return;
    setSubmitting(true);
    try {
      const { error } = await supabase.from('profiles').upsert({
        id: crypto.randomUUID(),
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
        department: newUser.department,
        updated_at: new Date().toISOString(),
      });
      if (error) throw error;
      
      setShowUserModal(false);
      setNewUser({ name: '', email: '', role: 'employee', department: 'Engineering' });
      fetchUsers();
    } catch (e: any) {
      console.error(e);
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateUser = async () => {
    if (!editingUser) return;
    setSubmitting(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          role: editingUser.role,
          department: editingUser.department,
          updated_at: new Date().toISOString()
        })
        .eq('id', editingUser.id);
      
      if (error) throw error;
      setEditingUser(null);
      fetchUsers();
    } catch (e: any) {
      console.error(e);
    } finally {
      setSubmitting(false);
    }
  };

  const handleResetEmail = async (email: string) => {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      alert('Reset/Invite email sent successfully!');
    } catch (e: any) {
      alert('Error sending email: ' + e.message);
    }
  };

  const handleInviteUser = async (user: any) => {
    // This calls the Edge Function we are setting up
    try {
      const { data, error } = await supabase.functions.invoke('invite-user', {
        body: { email: user.email, name: user.name }
      });
      if (error) throw error;
      alert('Official invitation sent!');
    } catch (e: any) {
      // Fallback to reset email flow if function not deployed
      handleResetEmail(user.email);
    }
  };

  const [newUser, setNewUser] = useState({
    name: '',
    email: '',
    role: 'employee',
    department: 'Engineering'
  });

  const filteredUsers = users.filter(u => 
    u.name?.toLowerCase().includes(search.toLowerCase()) || 
    u.email?.toLowerCase().includes(search.toLowerCase()) ||
    u.department?.toLowerCase().includes(search.toLowerCase())
  );

  const stats = [
    { label: 'Total Members', value: users.length, icon: Users, color: '#89ceff', bg: 'rgba(14,165,233,0.12)' },
    { label: 'IT Admins', value: users.filter(u => u.role === 'admin').length, icon: UserCog, color: '#c084fc', bg: 'rgba(192,132,252,0.12)' },
    { label: 'Super Admins', value: users.filter(u => u.role === 'superadmin').length, icon: ShieldCheck, color: '#ffb4ab', bg: 'rgba(255,180,171,0.12)' },
    { label: 'Departments', value: Array.from(new Set(users.map(u => u.department))).length, icon: Building, color: '#4ade80', bg: 'rgba(74,222,128,0.12)' },
  ];

  if (loading) {
    return (
      <div style={{ height: '100vh', background: DS.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Loader2 className="animate-spin" color={DS.primary} size={32} />
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: DS.bg, padding: '32px', fontFamily: "'Inter', sans-serif" }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>

        {/* Contextual Awareness: System Integrity & Latest Audit */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: '24px', marginBottom: '32px' }}>
          <div style={{ background: DS.card, borderRadius: '24px', padding: '24px', border: `1px solid ${DS.border}` }}>
            <h3 style={{ fontSize: '0.875rem', fontWeight: 800, color: DS.text, textTransform: 'uppercase', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ShieldCheck size={18} color={DS.primary} /> System Integrity
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.85rem', color: DS.muted }}>Auth Service</span>
                <span style={{ color: '#4ade80', fontSize: '0.8rem', fontWeight: 700 }}>Active</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.85rem', color: DS.muted }}>Database Pool</span>
                <span style={{ color: '#4ade80', fontSize: '0.8rem', fontWeight: 700 }}>99.9% Up</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.85rem', color: DS.muted }}>Webhook Sync</span>
                <span style={{ color: '#4ade80', fontSize: '0.8rem', fontWeight: 700 }}>Enabled</span>
              </div>
            </div>
          </div>

          <div style={{ background: 'rgba(192,132,252,0.03)', borderRadius: '24px', padding: '24px', border: '1px solid rgba(192,132,252,0.1)' }}>
            <h3 style={{ fontSize: '0.875rem', fontWeight: 800, color: '#c084fc', textTransform: 'uppercase', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <History size={18} /> Latest Governance Event
            </h3>
            {auditLogs.length > 0 ? (
              <div style={{ background: DS.surface, padding: '12px 16px', borderRadius: '12px', border: `1px solid ${DS.border}` }}>
                <p style={{ fontSize: '0.85rem', fontWeight: 700, color: DS.text }}>{auditLogs[0].action}</p>
                <p style={{ fontSize: '0.75rem', color: DS.muted }}>By: {auditLogs[0].performer?.name || 'System'} • {format(new Date(auditLogs[0].created_at), 'HH:mm:ss')}</p>
              </div>
            ) : (
              <p style={{ fontSize: '0.85rem', color: DS.muted, fontStyle: 'italic' }}>Monitoring system events...</p>
            )}
            <button onClick={() => setActiveView('audit')} style={{ marginTop: '12px', background: 'none', border: 'none', color: '#c084fc', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
              View Audit Logs <ArrowRightLeft size={12} />
            </button>
          </div>
        </div>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '32px' }}>
          <div>
            <p style={{ color: DS.muted, fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '4px' }}>Administrative Control</p>
            <h1 style={{ color: DS.text, fontSize: '2rem', fontWeight: 800, letterSpacing: '-0.02em', marginBottom: '6px' }}>
              {activeView === 'directory' ? 'Team Directory' : 'System Audit Log'}
            </h1>
            <p style={{ color: DS.muted, fontSize: '0.875rem' }}>
              {activeView === 'directory' 
                ? 'Manage organization members, assign roles, and control access permissions.'
                : 'Complete transparency of all system-wide actions and governance events.'}
            </p>
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <div style={{ display: 'flex', gap: '4px', background: DS.card, borderRadius: '12px', padding: '6px', border: `1px solid ${DS.border}` }}>
              <button 
                onClick={() => setActiveView('directory')}
                style={{ padding: '8px 16px', borderRadius: '8px', border: 'none', background: activeView === 'directory' ? 'rgba(14,165,233,0.2)' : 'transparent', color: activeView === 'directory' ? DS.primary : DS.muted, fontWeight: 700, fontSize: '0.75rem', cursor: 'pointer' }}
              >
                Directory
              </button>
              <button 
                onClick={() => setActiveView('audit')}
                style={{ padding: '8px 16px', borderRadius: '8px', border: 'none', background: activeView === 'audit' ? 'rgba(14,165,233,0.2)' : 'transparent', color: activeView === 'audit' ? DS.primary : DS.muted, fontWeight: 700, fontSize: '0.75rem', cursor: 'pointer' }}
              >
                Audit Logs
              </button>
            </div>
            {activeView === 'directory' && (
              <motion.button 
                whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }} 
                onClick={() => setShowUserModal(true)} 
                style={{ background: 'linear-gradient(135deg, #0ea5e9, #0284c7)', color: '#fff', border: 'none', borderRadius: '12px', padding: '12px 24px', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px', boxShadow: '0 8px 20px rgba(14,165,233,0.3)' }}
              >
                <UserPlus size={18} /> Add Member
              </motion.button>
            )}
          </div>
        </div>

        {/* Stats Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '32px' }}>
          {stats.map((s, i) => (
            <motion.div key={s.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }} style={{ background: DS.card, borderRadius: '16px', padding: '22px', border: `1px solid ${DS.border}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
                <p style={{ color: DS.muted, fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' }}>{s.label}</p>
                <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: s.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <s.icon size={18} color={s.color} />
                </div>
              </div>
              <h3 style={{ color: DS.text, fontSize: '2.25rem', fontWeight: 800, lineHeight: 1 }}>{s.value}</h3>
            </motion.div>
          ))}
        </div>

        {/* Search Bar */}
        <div style={{ background: DS.card, borderRadius: '16px', padding: '16px 20px', border: `1px solid ${DS.border}`, marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: DS.surface, border: `1px solid ${DS.border}`, borderRadius: '10px', padding: '10px 16px', flex: 1 }}>
            <Search size={16} color={DS.muted} />
            <input 
              type="text" placeholder={activeView === 'directory' ? "Search by name, email or department..." : "Search actions, tickets or performers..."}
              value={search} onChange={e => setSearch(e.target.value)}
              style={{ background: 'none', border: 'none', outline: 'none', color: DS.text, fontSize: '0.85rem', width: '100%' }}
            />
          </div>
        </div>

        {activeView === 'directory' ? (
          <div style={{ background: DS.card, borderRadius: '20px', border: `1px solid ${DS.border}`, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'rgba(14,165,233,0.04)' }}>
                  {['Team Member', 'System Role', 'Department', 'Assets', 'Actions'].map(h => (
                    <th key={h} style={{ padding: '14px 20px', textAlign: 'left', fontSize: '0.65rem', fontWeight: 700, color: DS.muted, letterSpacing: '0.1em', textTransform: 'uppercase' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map(u => (
                  <tr 
                    key={u.id} 
                    onClick={() => fetchPortfolio(u)}
                    style={{ borderTop: `1px solid ${DS.border}`, transition: 'background 0.2s', cursor: 'pointer' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(14,165,233,0.04)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <td style={{ padding: '16px 20px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'linear-gradient(135deg, #0ea5e9, #1e3a5f)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '11px', fontWeight: 800 }}>
                          {u.name?.[0] || u.email?.[0]?.toUpperCase() || '?'}
                        </div>
                        <div>
                          <p style={{ color: DS.text, fontWeight: 700, fontSize: '0.875rem', marginBottom: '2px' }}>{u.name || 'Pending Onboarding'}</p>
                          <p style={{ color: DS.muted, fontSize: '0.75rem' }}>{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '16px 20px' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.7rem', fontWeight: 800, color: u.role === 'superadmin' ? '#c084fc' : u.role === 'admin' ? DS.primary : DS.muted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        <ShieldCheck size={14} /> {u.role}
                      </span>
                    </td>
                    <td style={{ padding: '16px 20px' }}>
                      <span style={{ color: DS.text, fontSize: '0.85rem', fontWeight: 600 }}>{u.department || 'General'}</span>
                    </td>
                    <td style={{ padding: '16px 20px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: DS.primary, fontWeight: 700, fontSize: '0.8rem' }}>
                        <Monitor size={14} /> {u.assets?.length || 0}
                      </div>
                    </td>
                    <td style={{ padding: '16px 20px' }}>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button 
                          onClick={(e) => { e.stopPropagation(); handleInviteUser(u); }}
                          title="Send Welcome Email"
                          style={{ width: '32px', height: '32px', borderRadius: '8px', border: `1px solid ${DS.border}`, background: 'transparent', color: DS.primary, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        >
                          <Send size={14} />
                        </button>
                        <button 
                          onClick={(e) => { e.stopPropagation(); handleResetEmail(u.email); }}
                          title="Resend Reset Link"
                          style={{ width: '32px', height: '32px', borderRadius: '8px', border: `1px solid ${DS.border}`, background: 'transparent', color: '#ffb86e', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        >
                          <RotateCcw size={14} />
                        </button>
                        <button 
                          onClick={(e) => { e.stopPropagation(); setEditingUser(u); }}
                          style={{ width: '32px', height: '32px', borderRadius: '8px', border: `1px solid ${DS.border}`, background: 'transparent', color: DS.muted, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        >
                          <Edit2 size={14} />
                        </button>
                        <button 
                          onClick={(e) => { e.stopPropagation(); /* delete logic */ }}
                          style={{ width: '32px', height: '32px', borderRadius: '8px', border: `1px solid ${DS.border}`, background: 'transparent', color: '#ff4444', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <>
            {/* Audit Stats Bar */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '16px' }}>
              {[
                { label: 'Total Events', value: auditLogs.length, color: DS.primary },
                { label: 'SLA / Escalations', value: auditLogs.filter(l => l.action.includes('Breach') || l.action.includes('Escalation')).length, color: '#ff4444' },
                { label: 'Status Changes', value: auditLogs.filter(l => l.action.includes('Status')).length, color: '#ffb86e' },
                { label: 'System Actions', value: auditLogs.filter(l => !l.performer).length, color: '#88929b' },
              ].map(s => (
                <div key={s.label} style={{ background: DS.card, borderRadius: '14px', padding: '16px 20px', border: `1px solid ${DS.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <p style={{ color: DS.muted, fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase' }}>{s.label}</p>
                  <p style={{ color: s.color, fontSize: '1.25rem', fontWeight: 800 }}>{s.value}</p>
                </div>
              ))}
            </div>

            <div style={{ background: DS.card, borderRadius: '20px', border: `1px solid ${DS.border}`, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'rgba(14,165,233,0.04)' }}>
                    {['Timestamp', 'Performer', 'Action Event', 'Linked Ticket'].map(h => (
                      <th key={h} style={{ padding: '14px 20px', textAlign: 'left', fontSize: '0.65rem', fontWeight: 700, color: DS.muted, letterSpacing: '0.1em', textTransform: 'uppercase' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {fetchingAudit ? (
                    <tr><td colSpan={4} style={{ padding: '48px', textAlign: 'center' }}>
                      <Loader2 className="animate-spin" color={DS.primary} size={24} style={{ margin: '0 auto' }} />
                    </td></tr>
                  ) : (() => {
                    const filtered = auditLogs.filter(log =>
                      !search ||
                      log.action.toLowerCase().includes(search.toLowerCase()) ||
                      log.performer?.name?.toLowerCase().includes(search.toLowerCase()) ||
                      log.ticket?.title?.toLowerCase().includes(search.toLowerCase())
                    );

                    if (filtered.length === 0) return (
                      <tr><td colSpan={4} style={{ padding: '48px', textAlign: 'center' }}>
                        <ClipboardList size={40} color="rgba(14,165,233,0.2)" style={{ margin: '0 auto 12px' }} />
                        <p style={{ color: DS.muted, fontSize: '0.85rem', fontWeight: 600 }}>
                          {search ? 'No events match your search' : 'No audit events recorded yet'}
                        </p>
                      </td></tr>
                    );

                    return filtered.map(log => {
                      const isCritical = log.action.includes('Breach') || log.action.includes('L2 Escalation');
                      const isWarning = log.action.includes('L1 Escalation') || log.action.includes('Assign');
                      const badgeBg = isCritical ? 'rgba(255,68,68,0.12)' : isWarning ? 'rgba(255,184,110,0.12)' : 'rgba(14,165,233,0.1)';
                      const badgeColor = isCritical ? '#ff4444' : isWarning ? '#ffb86e' : DS.primary;

                      return (
                        <tr
                          key={log.id}
                          style={{ borderTop: `1px solid ${DS.border}`, transition: 'background 0.15s' }}
                          onMouseEnter={e => e.currentTarget.style.background = 'rgba(14,165,233,0.03)'}
                          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                        >
                          <td style={{ padding: '14px 20px', color: DS.muted, fontSize: '0.72rem', whiteSpace: 'nowrap' }}>
                            {format(new Date(log.created_at), 'MMM d, HH:mm:ss')}
                          </td>
                          <td style={{ padding: '14px 20px' }}>
                            <p style={{ color: DS.text, fontWeight: 700, fontSize: '0.8rem' }}>
                              {log.performer?.name || 'System Automation'}
                            </p>
                            <p style={{ color: DS.muted, fontSize: '0.65rem' }}>
                              {log.performer?.email || 'system@helpdesk.internal'}
                            </p>
                          </td>
                          <td style={{ padding: '14px 20px' }}>
                            <span style={{ padding: '4px 10px', borderRadius: '6px', fontSize: '0.68rem', fontWeight: 700, background: badgeBg, color: badgeColor, whiteSpace: 'nowrap' }}>
                              {log.action}
                            </span>
                          </td>
                          <td style={{ padding: '14px 20px' }}>
                            {log.ticket_id ? (
                              <div
                                onClick={() => navigate(`/tickets/${log.ticket_id}`)}
                                style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', color: DS.text, fontSize: '0.75rem', fontWeight: 600 }}
                                onMouseEnter={e => (e.currentTarget.style.color = DS.primary)}
                                onMouseLeave={e => (e.currentTarget.style.color = DS.text)}
                              >
                                {log.ticket?.title || `Ticket #${log.ticket_id?.substring(0,8).toUpperCase()}`}
                                <ArrowRightLeft size={11} color={DS.muted} />
                              </div>
                            ) : (
                              <span style={{ color: DS.muted, fontSize: '0.75rem' }}>System Action</span>
                            )}
                          </td>
                        </tr>
                      );
                    });
                  })()}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* User Asset Portfolio Slide-over */}
      <AnimatePresence>
        {selectedUser && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 300 }}>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setSelectedUser(null)} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }} />
            <motion.div initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'spring', damping: 25, stiffness: 200 }} style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: '480px', background: DS.card, borderLeft: `1px solid ${DS.border}`, padding: '40px', overflowY: 'auto' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '32px' }}>
                <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                  <div style={{ width: '56px', height: '56px', borderRadius: '16px', background: 'linear-gradient(135deg, #0ea5e9, #1e3a5f)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '1.25rem', fontWeight: 800 }}>
                    {selectedUser.name?.[0]}
                  </div>
                  <div>
                    <h2 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0 }}>{selectedUser.name}</h2>
                    <p style={{ color: DS.muted, fontSize: '0.85rem' }}>{selectedUser.department} • {selectedUser.role}</p>
                  </div>
                </div>
                <button onClick={() => setSelectedUser(null)} style={{ background: 'none', border: 'none', color: DS.muted, cursor: 'pointer' }}><X size={24} /></button>
              </div>

              {fetchingPortfolio ? (
                <div style={{ padding: '64px', textAlign: 'center' }}><Loader2 className="animate-spin" color={DS.primary} size={32} style={{ margin: '0 auto' }} /></div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
                  
                  {/* Current Assets */}
                  <section>
                    <h3 style={{ fontSize: '0.75rem', fontWeight: 800, color: DS.primary, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Monitor size={16} /> Currently Assigned
                    </h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {userAssets.map(asset => (
                        <div key={asset.id} style={{ padding: '16px', borderRadius: '16px', border: `1px solid ${DS.border}`, background: DS.surface }}>
                          <p style={{ fontSize: '0.875rem', fontWeight: 700, margin: '0 0 4px' }}>{asset.device_name}</p>
                          <p style={{ fontSize: '0.7rem', color: DS.primary, fontFamily: 'monospace' }}>{asset.device_id}</p>
                        </div>
                      ))}
                      {userAssets.length === 0 && (
                        <div style={{ padding: '24px', textAlign: 'center', border: `1px dashed ${DS.border}`, borderRadius: '16px' }}>
                          <p style={{ color: DS.muted, fontSize: '0.8rem', fontStyle: 'italic' }}>No assets currently assigned</p>
                        </div>
                      )}
                    </div>
                  </section>

                  {/* Asset History */}
                  <section>
                    <h3 style={{ fontSize: '0.75rem', fontWeight: 800, color: DS.primary, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <History size={16} /> Allocation History
                    </h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', position: 'relative' }}>
                      {userHistory.length > 1 && <div style={{ position: 'absolute', left: '9px', top: '20px', bottom: '20px', width: '2px', background: DS.border }} />}
                      {userHistory.map((h, i) => (
                        <div key={h.id} style={{ display: 'flex', gap: '16px', position: 'relative', zIndex: 1 }}>
                          <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: h.action === 'allocate' ? '#4ade80' : '#ff4444', border: `4px solid ${DS.card}`, flexShrink: 0 }} />
                          <div>
                            <p style={{ fontSize: '0.85rem', fontWeight: 700, margin: '0 0 4px' }}>
                              {h.action === 'allocate' ? 'Allocated' : 'Deallocated'} {h.assets?.device_name}
                            </p>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span style={{ fontSize: '0.75rem', color: DS.muted }}>{format(new Date(h.created_at), 'MMM d, yyyy')}</span>
                              <span style={{ fontSize: '0.7rem', color: DS.primary, fontWeight: 700 }}>• ID: {h.assets?.device_id}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                      {userHistory.length === 0 && (
                        <p style={{ color: DS.muted, fontSize: '0.8rem', textAlign: 'center', padding: '20px' }}>No historical transactions found</p>
                      )}
                    </div>
                  </section>

                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Add User Modal */}
      <AnimatePresence>
        {showUserModal && (
          <div style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 }}>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowUserModal(false)} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)' }} />
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} style={{ position: 'relative', width: '500px', background: DS.card, borderRadius: '24px', border: `1px solid ${DS.border}`, padding: '32px', boxShadow: '0 24px 64px rgba(0,0,0,0.5)' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '12px' }}><UserPlus size={24} color={DS.primary} /> Add Team Member</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <label style={{ fontSize: '0.7rem', fontWeight: 800, color: DS.muted, textTransform: 'uppercase' }}>Full Name</label>
                  <input type="text" value={newUser.name} onChange={e => setNewUser({...newUser, name: e.target.value})} placeholder="e.g. John Doe" style={{ width: '100%', padding: '12px', borderRadius: '12px', background: DS.surface, border: `1px solid ${DS.border}`, color: DS.text, fontSize: '0.85rem', outline: 'none' }} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <label style={{ fontSize: '0.7rem', fontWeight: 800, color: DS.muted, textTransform: 'uppercase' }}>Email Address</label>
                  <input type="email" value={newUser.email} onChange={e => setNewUser({...newUser, email: e.target.value})} placeholder="e.g. john@company.com" style={{ width: '100%', padding: '12px', borderRadius: '12px', background: DS.surface, border: `1px solid ${DS.border}`, color: DS.text, fontSize: '0.85rem', outline: 'none' }} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <label style={{ fontSize: '0.7rem', fontWeight: 800, color: DS.muted, textTransform: 'uppercase' }}>Assigned Role</label>
                    <select value={newUser.role} onChange={e => setNewUser({...newUser, role: e.target.value})} style={{ width: '100%', padding: '12px', borderRadius: '12px', background: DS.surface, border: `1px solid ${DS.border}`, color: DS.text, fontSize: '0.85rem', outline: 'none' }}>
                      <option value="employee">Employee</option>
                      <option value="admin">IT Admin</option>
                      <option value="inventory_manager">Inventory Manager</option>
                      <option value="devops">DevOps</option>
                      <option value="superadmin">Super Admin</option>
                    </select>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <label style={{ fontSize: '0.7rem', fontWeight: 800, color: DS.muted, textTransform: 'uppercase' }}>Department</label>
                    <select value={newUser.department} onChange={e => setNewUser({...newUser, department: e.target.value})} style={{ width: '100%', padding: '12px', borderRadius: '12px', background: DS.surface, border: `1px solid ${DS.border}`, color: DS.text, fontSize: '0.85rem', outline: 'none' }}>
                      {departments.map(d => <option key={d.name} value={d.name}>{d.name}</option>)}
                    </select>
                  </div>
                </div>
              </div>
              <button onClick={handleCreateUser} disabled={submitting} style={{ width: '100%', marginTop: '32px', background: 'linear-gradient(135deg, #0ea5e9, #0284c7)', border: 'none', borderRadius: '12px', padding: '14px', color: '#fff', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
                {submitting ? <Loader2 size={18} className="animate-spin" /> : <UserPlus size={18} />}
                {submitting ? 'Adding Member...' : 'Confirm & Add Member'}
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Edit User Modal */}
      <AnimatePresence>
        {editingUser && (
          <div style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 }}>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setEditingUser(null)} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)' }} />
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} style={{ position: 'relative', width: '500px', background: DS.card, borderRadius: '24px', border: `1px solid ${DS.border}`, padding: '32px', boxShadow: '0 24px 64px rgba(0,0,0,0.5)' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '12px' }}><UserCog size={24} color={DS.primary} /> Edit Member Details</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div style={{ padding: '16px', borderRadius: '16px', background: DS.surface, border: `1px solid ${DS.border}` }}>
                  <p style={{ color: DS.text, fontWeight: 700, fontSize: '0.9rem' }}>{editingUser.name || editingUser.email}</p>
                  <p style={{ color: DS.muted, fontSize: '0.75rem' }}>{editingUser.email}</p>
                </div>
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <label style={{ fontSize: '0.7rem', fontWeight: 800, color: DS.muted, textTransform: 'uppercase' }}>System Role</label>
                    <select value={editingUser.role} onChange={e => setEditingUser({...editingUser, role: e.target.value})} style={{ width: '100%', padding: '12px', borderRadius: '12px', background: DS.surface, border: `1px solid ${DS.border}`, color: DS.text, fontSize: '0.85rem', outline: 'none' }}>
                      <option value="employee">Employee</option>
                      <option value="admin">IT Admin</option>
                      <option value="inventory_manager">Inventory Manager</option>
                      <option value="devops">DevOps</option>
                      <option value="superadmin">Super Admin</option>
                    </select>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <label style={{ fontSize: '0.7rem', fontWeight: 800, color: DS.muted, textTransform: 'uppercase' }}>Department</label>
                    <select value={editingUser.department} onChange={e => setEditingUser({...editingUser, department: e.target.value})} style={{ width: '100%', padding: '12px', borderRadius: '12px', background: DS.surface, border: `1px solid ${DS.border}`, color: DS.text, fontSize: '0.85rem', outline: 'none' }}>
                      {departments.map(d => <option key={d.name} value={d.name}>{d.name}</option>)}
                    </select>
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '12px', marginTop: '32px' }}>
                <button onClick={() => setEditingUser(null)} style={{ flex: 1, padding: '14px', borderRadius: '12px', background: 'transparent', border: `1px solid ${DS.border}`, color: DS.muted, fontWeight: 700, cursor: 'pointer' }}>Cancel</button>
                <button onClick={handleUpdateUser} disabled={submitting} style={{ flex: 2, background: 'linear-gradient(135deg, #0ea5e9, #0284c7)', border: 'none', borderRadius: '12px', padding: '14px', color: '#fff', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
                  {submitting ? <Loader2 size={18} className="animate-spin" /> : <ShieldCheck size={18} />}
                  {submitting ? 'Updating...' : 'Save Changes'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
