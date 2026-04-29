import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, Search, Ticket, CheckCircle2,
  Clock, RefreshCw, Calendar, FileText,
  AlertTriangle, DollarSign, X, CalendarDays
} from 'lucide-react';
import { useAuth } from '../lib/AuthContext';
import { supabase } from '../lib/supabase';
import { getLeaveRequests, createLeaveRequest, getSubscriptions, createSubscription, createTicket } from '../lib/api';

const DS = {
  bg: '#0f172a',
  card: '#131b2e',
  cardHigh: '#222a3d',
  border: 'rgba(14,165,233,0.12)',
  primary: '#0ea5e9',
  text: '#dae2fd',
  muted: '#88929b',
  surface: '#0b1326',
};

const Badge = ({ status }: { status: string }) => {
  const map: Record<string, { bg: string; color: string }> = {
    'open':        { bg: 'rgba(14,165,233,0.15)',  color: '#89ceff' },
    'in_progress': { bg: 'rgba(255,184,110,0.15)', color: '#ffb86e' },
    'resolved':    { bg: 'rgba(74,222,128,0.15)',  color: '#4ade80' },
    'closed':      { bg: 'rgba(136,146,155,0.15)', color: '#88929b' },
    'pending':     { bg: 'rgba(255,184,110,0.15)', color: '#ffb86e' },
    'approved':    { bg: 'rgba(74,222,128,0.15)',  color: '#4ade80' },
    'rejected':    { bg: 'rgba(255,68,68,0.15)',   color: '#ff4444' },
    'active':      { bg: 'rgba(74,222,128,0.15)',  color: '#4ade80' },
    'cancelled':   { bg: 'rgba(136,146,155,0.15)', color: '#88929b' },
  };
  const s = map[status?.toLowerCase()] || map['open'];
  return (
    <span style={{
      ...s,
      padding: '2px 10px', borderRadius: '9999px',
      fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em',
    }}>
      {status?.replace('_', ' ')}
    </span>
  );
};

const PriorityDot = ({ priority }: { priority: string }) => {
  const colors: Record<string, string> = {
    critical: '#ff4444', high: '#ffb86e', medium: '#0ea5e9', low: '#4ade80',
  };
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
      <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: colors[priority?.toLowerCase()] || '#88929b' }} />
      <span style={{ fontSize: '0.75rem', color: DS.text, fontWeight: 600, textTransform: 'capitalize' }}>{priority}</span>
    </div>
  );
};

export const EmployeeDashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'tickets' | 'leaves' | 'subscriptions'>('tickets');
  
  const [tickets, setTickets] = useState<any[]>([]);
  const [leaves, setLeaves] = useState<any[]>([]);
  const [subscriptions, setSubscriptions] = useState<any[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Modals
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [showSubModal, setShowSubModal] = useState(false);
  const [showPayslipModal, setShowPayslipModal] = useState(false);
  const [showGrievanceModal, setShowGrievanceModal] = useState(false);

  const [leaveData, setLeaveData] = useState({ leave_type: 'Sick', start_date: '', end_date: '', reason: '' });
  const [subData, setSubData] = useState({ service_name: '', cost: '', billing_cycle: 'Monthly', next_due_date: '' });
  const [payslipData, setPayslipData] = useState({ month: new Date().toLocaleString('default', { month: 'long' }), year: new Date().getFullYear().toString() });
  const [grievanceData, setGrievanceData] = useState({ description: '', anonymous: false });

  const name = user?.user_metadata?.name || user?.email?.split('@')[0] || 'User';

  useEffect(() => {
    fetchData();
  }, [user]);

  const fetchData = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data: tData } = await supabase
        .from('tickets')
        .select('*')
        .eq('created_by', user.id)
        .order('created_at', { ascending: false })
        .limit(20);
      setTickets(tData || []);

      const lData = await getLeaveRequests();
      setLeaves(lData.filter((l: any) => l.employee_id === user.id) || []);

      const sData = await getSubscriptions();
      setSubscriptions(sData.filter((s: any) => s.owner_id === user.id) || []);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  const handleLeaveSubmit = async () => {
    try {
      await createLeaveRequest(leaveData);
      setShowLeaveModal(false);
      fetchData();
    } catch (e) {
      console.error(e);
      alert('Failed to submit leave request');
    }
  };

  const handleSubSubmit = async () => {
    try {
      await createSubscription(subData);
      setShowSubModal(false);
      fetchData();
    } catch (e) {
      console.error(e);
      alert('Failed to submit subscription');
    }
  };

  const handlePayslipSubmit = async () => {
    try {
      await createTicket({
        title: `Payslip Request: ${payslipData.month} ${payslipData.year}`,
        description: `Employee requested payslip for ${payslipData.month} ${payslipData.year}.`,
        issue_type: 'HR / Payroll',
        sub_type: 'Payslip',
        priority: 'Low',
        department: user?.user_metadata?.department || 'General',
      });
      setShowPayslipModal(false);
      alert('Payslip request submitted!');
      fetchData();
    } catch (e) {
      console.error(e);
      alert('Failed to submit payslip request');
    }
  };

  const handleGrievanceSubmit = async () => {
    if (!grievanceData.description) return;
    try {
      await createTicket({
        title: grievanceData.anonymous ? 'Anonymous Grievance' : `Grievance: ${name}`,
        description: grievanceData.description,
        issue_type: 'HR / Payroll',
        sub_type: 'Grievance',
        priority: 'Critical',
        department: user?.user_metadata?.department || 'General',
        custom_fields: { anonymous: grievanceData.anonymous }
      });
      setShowGrievanceModal(false);
      setGrievanceData({ description: '', anonymous: false });
      alert('Confidential grievance submitted successfully.');
      fetchData();
    } catch (e) {
      console.error(e);
      alert('Failed to submit grievance');
    }
  };

  const filteredTickets = tickets.filter(t => t.title?.toLowerCase().includes(search.toLowerCase()));

  return (
    <div style={{ minHeight: '100vh', background: DS.bg, padding: '32px', fontFamily: "'Inter', sans-serif" }}>
      <div style={{ maxWidth: '1100px', margin: '0 auto' }}>

        {/* Contextual Awareness: Announcements & Alerts */}
        <div style={{ marginBottom: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ 
            background: 'rgba(14,165,233,0.05)', borderRadius: '14px', padding: '12px 20px', 
            border: `1px solid ${DS.border}`, display: 'flex', alignItems: 'center', gap: '12px' 
          }}>
            <RefreshCw size={16} color={DS.primary} className="animate-spin" />
            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: DS.text }}>
              <span style={{ color: DS.primary, marginRight: '8px' }}>IT UPDATE:</span> 
              System maintenance scheduled for Saturday 11:00 PM. GitLab access may be intermittent.
            </span>
          </div>

          {tickets.some(t => t.status === 'Waiting for User') && (
            <motion.div 
              initial={{ x: -20, opacity: 0 }} animate={{ x: 0, opacity: 1 }}
              style={{ 
                background: 'rgba(255,184,110,0.1)', borderRadius: '16px', padding: '16px 24px', 
                border: '1px solid rgba(255,184,110,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'space-between'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ background: '#ffb86e', borderRadius: '50%', padding: '8px' }}>
                  <Clock size={18} color="#000" />
                </div>
                <div>
                  <h4 style={{ fontSize: '0.9rem', fontWeight: 800, color: '#ffb86e' }}>Needs Your Attention</h4>
                  <p style={{ fontSize: '0.8rem', color: DS.muted }}>You have tickets waiting for your response to proceed.</p>
                </div>
              </div>
              <button 
                onClick={() => setSearch('Waiting for User')}
                style={{ background: '#ffb86e', color: '#000', border: 'none', borderRadius: '10px', padding: '8px 16px', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer' }}
              >
                Review Tickets
              </button>
            </motion.div>
          )}
        </div>

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            background: DS.card, borderRadius: '20px', padding: '24px 32px',
            border: `1px solid ${DS.border}`, marginBottom: '24px',
          }}
        >
          <div>
            <p style={{ color: DS.muted, fontSize: '0.8rem', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '4px' }}>Welcome back</p>
            <h1 style={{ color: DS.text, fontSize: '1.75rem', fontWeight: 800, letterSpacing: '-0.02em' }}>{name}</h1>
            <p style={{ color: DS.muted, fontSize: '0.875rem', marginTop: '4px' }}>ESS Portal: Manage your requests, leaves, and subscriptions.</p>
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <motion.button
              whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
              onClick={() => setShowPayslipModal(true)}
              style={{
                background: DS.surface, color: DS.text, border: `1px solid ${DS.border}`,
                borderRadius: '14px', padding: '14px 20px', fontWeight: 700, fontSize: '0.875rem',
                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px',
              }}
            >
              <FileText size={18} /> Get Payslip
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
              onClick={() => setShowGrievanceModal(true)}
              style={{
                background: 'rgba(255,68,68,0.1)', color: '#ffb4ab', border: '1px solid rgba(255,68,68,0.2)',
                borderRadius: '14px', padding: '14px 20px', fontWeight: 700, fontSize: '0.875rem',
                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px',
              }}
            >
              <AlertTriangle size={18} /> Grievance
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
              onClick={() => navigate('/tickets/new')}
              style={{
                background: 'linear-gradient(135deg, #0ea5e9, #0284c7)',
                color: '#fff', border: 'none', borderRadius: '14px',
                padding: '14px 24px', fontWeight: 700, fontSize: '0.875rem',
                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px',
                boxShadow: '0 8px 24px rgba(14,165,233,0.35)',
              }}
            >
              <Plus size={18} /> Raise Ticket
            </motion.button>
          </div>
        </motion.div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: '16px', marginBottom: '24px', borderBottom: `1px solid ${DS.border}`, paddingBottom: '16px' }}>
          {[
            { id: 'tickets', label: 'IT Support', icon: Ticket },
            { id: 'leaves', label: 'Leaves', icon: CalendarDays },
            { id: 'subscriptions', label: 'My Subscriptions', icon: DollarSign },
          ].map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id as any)}
              style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                padding: '12px 24px', borderRadius: '12px',
                background: activeTab === t.id ? 'rgba(14,165,233,0.1)' : 'transparent',
                color: activeTab === t.id ? '#89ceff' : DS.muted,
                border: `1px solid ${activeTab === t.id ? 'rgba(14,165,233,0.3)' : 'transparent'}`,
                fontWeight: 700, fontSize: '0.875rem', cursor: 'pointer', transition: 'all 0.2s',
              }}
            >
              <t.icon size={18} /> {t.label}
            </button>
          ))}
        </div>

        {/* Main Content */}
        <div style={{ background: DS.card, borderRadius: '20px', border: `1px solid ${DS.border}`, overflow: 'hidden' }}>
          <div style={{ padding: '20px 24px', borderBottom: `1px solid ${DS.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h3 style={{ color: DS.text, fontWeight: 700, fontSize: '1rem', textTransform: 'capitalize' }}>My {activeTab}</h3>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              {activeTab === 'tickets' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: DS.surface, border: `1px solid ${DS.border}`, borderRadius: '10px', padding: '8px 14px' }}>
                  <Search size={14} color={DS.muted} />
                  <input
                    type="text" placeholder="Search..."
                    value={search} onChange={e => setSearch(e.target.value)}
                    style={{ background: 'none', border: 'none', outline: 'none', color: DS.text, fontSize: '0.8rem', width: '160px' }}
                  />
                </div>
              )}
              {activeTab === 'leaves' && (
                <button onClick={() => setShowLeaveModal(true)} style={{ padding: '8px 16px', background: 'rgba(74,222,128,0.1)', color: '#4ade80', border: '1px solid rgba(74,222,128,0.3)', borderRadius: '10px', fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Plus size={14} /> Request Leave
                </button>
              )}
              {activeTab === 'subscriptions' && (
                <button onClick={() => setShowSubModal(true)} style={{ padding: '8px 16px', background: 'rgba(14,165,233,0.1)', color: '#89ceff', border: '1px solid rgba(14,165,233,0.3)', borderRadius: '10px', fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Plus size={14} /> Add Subscription
                </button>
              )}
              <button onClick={fetchData} style={{ width: '36px', height: '36px', borderRadius: '10px', background: DS.surface, border: `1px solid ${DS.border}`, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: DS.muted }}>
                <RefreshCw size={14} />
              </button>
            </div>
          </div>

          {loading ? (
            <div style={{ padding: '48px', textAlign: 'center', color: DS.muted }}>Loading...</div>
          ) : activeTab === 'tickets' ? (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'rgba(14,165,233,0.04)' }}>
                  {['ID', 'Issue', 'Status', 'Priority', 'Raised'].map(h => (
                    <th key={h} style={{ padding: '12px 20px', textAlign: 'left', fontSize: '0.68rem', fontWeight: 700, color: DS.muted, letterSpacing: '0.08em', textTransform: 'uppercase' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredTickets.map(ticket => (
                  <tr key={ticket.id} style={{ borderTop: `1px solid ${DS.border}`, cursor: 'pointer' }} onClick={() => navigate(`/tickets/${ticket.id}`)}>
                    <td style={{ padding: '16px 20px', fontSize: '0.72rem', fontFamily: 'monospace', color: DS.muted, fontWeight: 700 }}>#{ticket.id?.substring(0, 8).toUpperCase()}</td>
                    <td style={{ padding: '16px 20px', color: DS.text, fontWeight: 600, fontSize: '0.875rem' }}>{ticket.title}</td>
                    <td style={{ padding: '16px 20px' }}><Badge status={ticket.status} /></td>
                    <td style={{ padding: '16px 20px' }}><PriorityDot priority={ticket.priority} /></td>
                    <td style={{ padding: '16px 20px', color: DS.muted, fontSize: '0.78rem' }}>{new Date(ticket.created_at).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : activeTab === 'leaves' ? (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'rgba(14,165,233,0.04)' }}>
                  {['Type', 'Dates', 'Reason', 'Status', 'Requested On'].map(h => (
                    <th key={h} style={{ padding: '12px 20px', textAlign: 'left', fontSize: '0.68rem', fontWeight: 700, color: DS.muted, letterSpacing: '0.08em', textTransform: 'uppercase' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {leaves.map(l => (
                  <tr key={l.id} style={{ borderTop: `1px solid ${DS.border}` }}>
                    <td style={{ padding: '16px 20px', color: DS.text, fontWeight: 700, fontSize: '0.875rem' }}>{l.leave_type}</td>
                    <td style={{ padding: '16px 20px', color: DS.muted, fontSize: '0.8rem' }}>{l.start_date} to {l.end_date}</td>
                    <td style={{ padding: '16px 20px', color: DS.muted, fontSize: '0.8rem' }}>{l.reason}</td>
                    <td style={{ padding: '16px 20px' }}><Badge status={l.status} /></td>
                    <td style={{ padding: '16px 20px', color: DS.muted, fontSize: '0.78rem' }}>{new Date(l.created_at).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'rgba(14,165,233,0.04)' }}>
                  {['Service Name', 'Cost', 'Billing Cycle', 'Next Due', 'Status'].map(h => (
                    <th key={h} style={{ padding: '12px 20px', textAlign: 'left', fontSize: '0.68rem', fontWeight: 700, color: DS.muted, letterSpacing: '0.08em', textTransform: 'uppercase' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {subscriptions.map(s => (
                  <tr key={s.id} style={{ borderTop: `1px solid ${DS.border}` }}>
                    <td style={{ padding: '16px 20px', color: DS.text, fontWeight: 700, fontSize: '0.875rem' }}>{s.service_name}</td>
                    <td style={{ padding: '16px 20px', color: '#89ceff', fontWeight: 700, fontSize: '0.875rem' }}>${s.cost}</td>
                    <td style={{ padding: '16px 20px', color: DS.muted, fontSize: '0.8rem' }}>{s.billing_cycle}</td>
                    <td style={{ padding: '16px 20px', color: DS.text, fontSize: '0.8rem' }}>{s.next_due_date}</td>
                    <td style={{ padding: '16px 20px' }}><Badge status={s.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Leave Modal */}
      <AnimatePresence>
        {showLeaveModal && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} style={{ background: DS.card, padding: '32px', borderRadius: '24px', width: '100%', maxWidth: '400px', border: `1px solid ${DS.border}` }}>
              <h3 style={{ color: DS.text, fontSize: '1.25rem', fontWeight: 800, marginBottom: '20px' }}>Request Leave</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                  <label style={{ color: DS.muted, fontSize: '0.75rem', fontWeight: 700, marginBottom: '8px', display: 'block' }}>Leave Type</label>
                  <select value={leaveData.leave_type} onChange={e => setLeaveData({ ...leaveData, leave_type: e.target.value })} style={{ width: '100%', background: DS.surface, color: DS.text, border: `1px solid ${DS.border}`, padding: '12px', borderRadius: '10px' }}>
                    <option>Sick</option><option>Casual</option><option>Privilege</option><option>Unpaid</option>
                  </select>
                </div>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ color: DS.muted, fontSize: '0.75rem', fontWeight: 700, marginBottom: '8px', display: 'block' }}>Start Date</label>
                    <input type="date" value={leaveData.start_date} onChange={e => setLeaveData({ ...leaveData, start_date: e.target.value })} style={{ width: '100%', background: DS.surface, color: DS.text, border: `1px solid ${DS.border}`, padding: '12px', borderRadius: '10px' }} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ color: DS.muted, fontSize: '0.75rem', fontWeight: 700, marginBottom: '8px', display: 'block' }}>End Date</label>
                    <input type="date" value={leaveData.end_date} onChange={e => setLeaveData({ ...leaveData, end_date: e.target.value })} style={{ width: '100%', background: DS.surface, color: DS.text, border: `1px solid ${DS.border}`, padding: '12px', borderRadius: '10px' }} />
                  </div>
                </div>
                <div>
                  <label style={{ color: DS.muted, fontSize: '0.75rem', fontWeight: 700, marginBottom: '8px', display: 'block' }}>Reason</label>
                  <textarea value={leaveData.reason} onChange={e => setLeaveData({ ...leaveData, reason: e.target.value })} rows={3} style={{ width: '100%', background: DS.surface, color: DS.text, border: `1px solid ${DS.border}`, padding: '12px', borderRadius: '10px', resize: 'none' }} />
                </div>
                <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
                  <button onClick={() => setShowLeaveModal(false)} style={{ flex: 1, padding: '12px', background: 'transparent', color: DS.muted, border: 'none', cursor: 'pointer', fontWeight: 700 }}>Cancel</button>
                  <button onClick={handleLeaveSubmit} style={{ flex: 1, padding: '12px', background: '#4ade80', color: '#000', border: 'none', borderRadius: '10px', cursor: 'pointer', fontWeight: 700 }}>Submit</button>
                </div>
              </div>
            </motion.div>
          </div>
        )}

        {/* Subscription Modal */}
        {showSubModal && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} style={{ background: DS.card, padding: '32px', borderRadius: '24px', width: '100%', maxWidth: '400px', border: `1px solid ${DS.border}` }}>
              <h3 style={{ color: DS.text, fontSize: '1.25rem', fontWeight: 800, marginBottom: '20px' }}>Add Subscription</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                  <label style={{ color: DS.muted, fontSize: '0.75rem', fontWeight: 700, marginBottom: '8px', display: 'block' }}>Service Name</label>
                  <input type="text" value={subData.service_name} onChange={e => setSubData({ ...subData, service_name: e.target.value })} placeholder="e.g. AWS, Figma" style={{ width: '100%', background: DS.surface, color: DS.text, border: `1px solid ${DS.border}`, padding: '12px', borderRadius: '10px' }} />
                </div>
                <div>
                  <label style={{ color: DS.muted, fontSize: '0.75rem', fontWeight: 700, marginBottom: '8px', display: 'block' }}>Cost ($)</label>
                  <input type="number" value={subData.cost} onChange={e => setSubData({ ...subData, cost: e.target.value })} style={{ width: '100%', background: DS.surface, color: DS.text, border: `1px solid ${DS.border}`, padding: '12px', borderRadius: '10px' }} />
                </div>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ color: DS.muted, fontSize: '0.75rem', fontWeight: 700, marginBottom: '8px', display: 'block' }}>Billing Cycle</label>
                    <select value={subData.billing_cycle} onChange={e => setSubData({ ...subData, billing_cycle: e.target.value })} style={{ width: '100%', background: DS.surface, color: DS.text, border: `1px solid ${DS.border}`, padding: '12px', borderRadius: '10px' }}>
                      <option>Monthly</option><option>Quarterly</option><option>Yearly</option>
                    </select>
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ color: DS.muted, fontSize: '0.75rem', fontWeight: 700, marginBottom: '8px', display: 'block' }}>Next Due Date</label>
                    <input type="date" value={subData.next_due_date} onChange={e => setSubData({ ...subData, next_due_date: e.target.value })} style={{ width: '100%', background: DS.surface, color: DS.text, border: `1px solid ${DS.border}`, padding: '12px', borderRadius: '10px' }} />
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
                  <button onClick={() => setShowSubModal(false)} style={{ flex: 1, padding: '12px', background: 'transparent', color: DS.muted, border: 'none', cursor: 'pointer', fontWeight: 700 }}>Cancel</button>
                  <button onClick={handleSubSubmit} style={{ flex: 1, padding: '12px', background: '#89ceff', color: '#000', border: 'none', borderRadius: '10px', cursor: 'pointer', fontWeight: 700 }}>Add</button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Payslip Modal */}
      <AnimatePresence>
        {showPayslipModal && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} style={{ background: DS.card, padding: '32px', borderRadius: '24px', width: '100%', maxWidth: '400px', border: `1px solid ${DS.border}` }}>
              <h3 style={{ color: DS.text, fontSize: '1.25rem', fontWeight: 800, marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <FileText color={DS.primary} /> Request Payslip
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                  <label style={{ color: DS.muted, fontSize: '0.75rem', fontWeight: 700, marginBottom: '8px', display: 'block' }}>Month</label>
                  <select value={payslipData.month} onChange={e => setPayslipData({ ...payslipData, month: e.target.value })} style={{ width: '100%', background: DS.surface, color: DS.text, border: `1px solid ${DS.border}`, padding: '12px', borderRadius: '10px' }}>
                    {['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'].map(m => <option key={m}>{m}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ color: DS.muted, fontSize: '0.75rem', fontWeight: 700, marginBottom: '8px', display: 'block' }}>Year</label>
                  <select value={payslipData.year} onChange={e => setPayslipData({ ...payslipData, year: e.target.value })} style={{ width: '100%', background: DS.surface, color: DS.text, border: `1px solid ${DS.border}`, padding: '12px', borderRadius: '10px' }}>
                    {['2023', '2024', '2025', '2026'].map(y => <option key={y}>{y}</option>)}
                  </select>
                </div>
                <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
                  <button onClick={() => setShowPayslipModal(false)} style={{ flex: 1, padding: '12px', background: 'transparent', color: DS.muted, border: 'none', cursor: 'pointer', fontWeight: 700 }}>Cancel</button>
                  <button onClick={handlePayslipSubmit} style={{ flex: 1, padding: '12px', background: DS.primary, color: '#fff', border: 'none', borderRadius: '10px', cursor: 'pointer', fontWeight: 700 }}>Request</button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Grievance Modal */}
      <AnimatePresence>
        {showGrievanceModal && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} style={{ background: DS.card, padding: '32px', borderRadius: '24px', width: '100%', maxWidth: '500px', border: `1px solid ${DS.border}` }}>
              <h3 style={{ color: '#ffb4ab', fontSize: '1.25rem', fontWeight: 800, marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <AlertTriangle /> Confidential Grievance
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <p style={{ color: DS.muted, fontSize: '0.85rem', lineHeight: '1.5' }}>
                  Your grievance will be sent directly to HR and Senior Management. All submissions are handled with strict confidentiality.
                </p>
                <div>
                  <label style={{ color: DS.muted, fontSize: '0.75rem', fontWeight: 700, marginBottom: '8px', display: 'block' }}>Describe your grievance</label>
                  <textarea 
                    value={grievanceData.description} 
                    onChange={e => setGrievanceData({ ...grievanceData, description: e.target.value })} 
                    rows={4} 
                    placeholder="Please provide details..."
                    style={{ width: '100%', background: DS.surface, color: DS.text, border: `1px solid ${DS.border}`, padding: '12px', borderRadius: '10px', resize: 'none' }} 
                  />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <input 
                    type="checkbox" 
                    id="anon" 
                    checked={grievanceData.anonymous} 
                    onChange={e => setGrievanceData({ ...grievanceData, anonymous: e.target.checked })} 
                    style={{ width: '18px', height: '18px' }}
                  />
                  <label htmlFor="anon" style={{ color: DS.text, fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer' }}>Submit Anonymously</label>
                </div>
                <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
                  <button onClick={() => setShowGrievanceModal(false)} style={{ flex: 1, padding: '12px', background: 'transparent', color: DS.muted, border: 'none', cursor: 'pointer', fontWeight: 700 }}>Cancel</button>
                  <button 
                    onClick={handleGrievanceSubmit} 
                    disabled={!grievanceData.description}
                    style={{ flex: 1, padding: '12px', background: '#ff4444', color: '#fff', border: 'none', borderRadius: '10px', cursor: 'pointer', fontWeight: 700, opacity: grievanceData.description ? 1 : 0.5 }}
                  >
                    Submit Grievance
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
