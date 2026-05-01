import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, Search, Ticket, CheckCircle2,
  Clock, RefreshCw, Calendar, FileText,
  AlertTriangle, DollarSign, X, CalendarDays, ChevronRight,
  Unlock, Activity, Lightbulb, TrendingUp, Bell, AlertCircle
} from 'lucide-react';
import { useAuth } from '../lib/AuthContext';
import { supabase } from '../lib/supabase';
import { getLeaveRequests, createLeaveRequest, getSubscriptions, createSubscription, createTicket } from '../lib/api';
import { CalendarView, MiniCalendar, CalendarEvent } from '../components/CalendarView';
import { isSameDay, format } from 'date-fns';
import { Drawer } from '../components/Drawer';

const DS = {
  bg: '#0f172a',
  card: '#131b2e',
  cardHigh: '#222a3d',
  border: 'rgba(14,165,233,0.12)',
  primary: '#0ea5e9',
  text: '#dae2fd',
  muted: '#88929b',
  surface: '#0b1326',
  success: '#4ade80', danger: '#ff4444', warning: '#ffb86e',
};

const Badge = ({ status }: { status: string }) => {
  const map: Record<string, { bg: string; color: string }> = {
    'open':        { bg: 'rgba(14,165,233,0.15)',  color: '#89ceff' },
    'in_progress': { bg: 'rgba(255,184,110,0.15)', color: '#ffb86e' },
    'resolved':    { bg: 'rgba(74,222,128,0.15)',  color: '#4ade80' },
    'closed':      { bg: 'rgba(136,146,155,0.15)', color: '#88929b' },
    'waiting for user': { bg: 'rgba(255,184,110,0.15)', color: '#ffb86e' },
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
  const { user, profile } = useAuth();
  const isAdmin = profile?.role === 'admin' || profile?.role === 'superadmin' || user?.email === 'superadmin@elitemindz.co';
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'tickets' | 'leaves' | 'subscriptions' | 'calendar'>('tickets');
  const LEAVE_QUOTA = 18;
  
  const [tickets, setTickets] = useState<any[]>([]);
  const [leaves, setLeaves] = useState<any[]>([]);
  const [subscriptions, setSubscriptions] = useState<any[]>([]);
  const [selectedDayEvents, setSelectedDayEvents] = useState<CalendarEvent[]>([]);
  const [showDayModal, setShowDayModal] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Modals
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [showSubModal, setShowSubModal] = useState(false);
  const [showPayslipModal, setShowPayslipModal] = useState(false);
  const [showGrievanceModal, setShowGrievanceModal] = useState(false);

  const [leaveData, setLeaveData] = useState({ leave_type: 'Sick', start_date: '', end_date: '', reason: '' });
  const [leaveError, setLeaveError] = useState<string | null>(null);
  const [leaveSuccess, setLeaveSuccess] = useState(false);
  const [leaveLoading, setLeaveLoading] = useState(false);
  const [subData, setSubData] = useState({ service_name: '', cost: '', billing_cycle: 'Monthly', next_due_date: '', comment: '' });
  const [payslipData, setPayslipData] = useState({ 
    startMonth: 'January', 
    startYear: new Date().getFullYear().toString(),
    endMonth: 'January',
    endYear: new Date().getFullYear().toString()
  });
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
        .eq('employee_id', user.id)
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

  const calendarEvents: CalendarEvent[] = [
    ...leaves.map(l => ({
      id: l.id,
      date: new Date(l.start_date),
      title: `Leave: ${l.leave_type}`,
      type: 'leave' as const,
      color: '#ffb86e',
      originalData: l
    })),
    ...subscriptions.map(s => ({
      id: s.id,
      date: new Date(s.next_due_date),
      title: `Renew: ${s.service_name}`,
      type: 'subscription' as const,
      color: '#4ade80',
      originalData: s
    })),
    ...tickets.map(t => ({
      id: t.id,
      date: new Date(t.sla_deadline || t.created_at),
      title: `Ticket: ${t.title}`,
      type: 'ticket' as const,
      color: '#0ea5e9',
      originalData: t
    }))
  ];

  const handleDateClick = (date: Date) => {
    const dayEvents = calendarEvents.filter(e => isSameDay(e.date, date));
    if (dayEvents.length > 0) {
      setSelectedDate(date);
      setSelectedDayEvents(dayEvents);
      setShowDayModal(true);
    }
  };

  const handleLeaveSubmit = async () => {
    setLeaveError(null);
    // Validation
    if (!leaveData.start_date || !leaveData.end_date) {
      setLeaveError('Please select both start and end dates.');
      return;
    }
    if (new Date(leaveData.end_date) < new Date(leaveData.start_date)) {
      setLeaveError('End date cannot be before start date.');
      return;
    }
    if (!leaveData.reason.trim()) {
      setLeaveError('Please provide a reason for your leave.');
      return;
    }
    try {
      setLeaveLoading(true);
      await createLeaveRequest(leaveData);
      setLeaveSuccess(true);
      setTimeout(() => {
        setShowLeaveModal(false);
        setLeaveSuccess(false);
        setLeaveData({ leave_type: 'Sick', start_date: '', end_date: '', reason: '' });
        fetchData();
      }, 1500);
    } catch (e: any) {
      console.error(e);
      setLeaveError(e?.message || e?.details || 'Failed to submit leave request. Please try again.');
    } finally {
      setLeaveLoading(false);
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
      // Find HR User to assign to, fallback to Admin if none found
      const { data: hrUsers } = await supabase
        .from('profiles')
        .select('id')
        .eq('role', 'hr')
        .limit(1);

      let targetId = hrUsers?.[0]?.id;

      if (!targetId) {
        const { data: adminUsers } = await supabase
          .from('profiles')
          .select('id')
          .in('role', ['admin', 'superadmin'])
          .limit(1);
        targetId = adminUsers?.[0]?.id;
      }

      await createTicket({
        title: `Payslip Request: ${payslipData.startMonth} ${payslipData.startYear} - ${payslipData.endMonth} ${payslipData.endYear}`,
        description: `Employee requested payslips for the period ${payslipData.startMonth} ${payslipData.startYear} to ${payslipData.endMonth} ${payslipData.endYear}.`,
        issue_type: 'HR / Payroll',
        sub_type: 'Payslip',
        priority: 'Medium',
        name: profile?.name || user?.user_metadata?.name || '',
        email: user?.email || '',
        department: profile?.department || 'General',
        assigned_to: targetId,
        custom_fields: {
          period_start: `${payslipData.startMonth} ${payslipData.startYear}`,
          period_end: `${payslipData.endMonth} ${payslipData.endYear}`
        }
      });
      setShowPayslipModal(false);
      alert('Payslip request submitted to HR!');
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

  const filteredTickets = tickets.filter(t => {
    const matchSearch = t.title?.toLowerCase().includes(search.toLowerCase()) ||
      t.id?.toLowerCase().includes(search.toLowerCase()) ||
      t.status?.toLowerCase().includes(search.toLowerCase());
    return matchSearch;
  });

  return (
    <div style={{ minHeight: '100vh', background: DS.bg, padding: '32px', fontFamily: "'Inter', sans-serif" }}>
      <div style={{ maxWidth: '1100px', margin: '0 auto' }}>

        {/* Header - Minimal */}
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
          <div>
            <p style={{ color: DS.muted, fontSize: '0.65rem', fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '4px' }}>ESS Portal</p>
            <h1 style={{ color: DS.text, fontSize: '2rem', fontWeight: 900, letterSpacing: '-0.04em', margin: 0 }}>Welcome, {name}</h1>
          </div>
          <div>
            <motion.button
              whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
              onClick={() => setShowGrievanceModal(true)}
              style={{
                background: 'rgba(255,68,68,0.1)', color: '#ffb4ab', border: '1px solid rgba(255,68,68,0.2)',
                borderRadius: '14px', padding: '10px 16px', fontWeight: 700, fontSize: '0.8rem',
                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px',
              }}
            >
              <AlertTriangle size={16} /> Grievance
            </motion.button>
          </div>
        </header>

        {/* 🔝 TOP: Personal Action Strip */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '40px' }}>
          <motion.button whileHover={{ y: -4 }} onClick={() => navigate('/tickets/new')} style={{ background: DS.card, border: `1px solid ${DS.border}`, borderRadius: '24px', padding: '24px', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '16px', cursor: 'pointer', boxShadow: '0 12px 24px rgba(0,0,0,0.1)' }}>
             <div style={{ background: 'rgba(14,165,233,0.1)', padding: '14px', borderRadius: '16px' }}><Ticket color={DS.primary} size={24} /></div>
             <span style={{ fontSize: '1rem', fontWeight: 800, color: DS.text }}>Raise Request</span>
          </motion.button>
          <motion.button whileHover={{ y: -4 }} onClick={() => navigate('/tickets/new?type=access')} style={{ background: DS.card, border: `1px solid ${DS.border}`, borderRadius: '24px', padding: '24px', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '16px', cursor: 'pointer', boxShadow: '0 12px 24px rgba(0,0,0,0.1)' }}>
             <div style={{ background: 'rgba(192,132,252,0.1)', padding: '14px', borderRadius: '16px' }}><Unlock color="#c084fc" size={24} /></div>
             <span style={{ fontSize: '1rem', fontWeight: 800, color: DS.text }}>Request Access</span>
          </motion.button>
          <motion.button whileHover={{ y: -4 }} onClick={() => setShowPayslipModal(true)} style={{ background: DS.card, border: `1px solid ${DS.border}`, borderRadius: '24px', padding: '24px', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '16px', cursor: 'pointer', boxShadow: '0 12px 24px rgba(0,0,0,0.1)' }}>
             <div style={{ background: 'rgba(74,222,128,0.1)', padding: '14px', borderRadius: '16px' }}><FileText color="#4ade80" size={24} /></div>
             <span style={{ fontSize: '1rem', fontWeight: 800, color: DS.text }}>Get Payslip</span>
          </motion.button>
          <motion.button whileHover={{ y: -4 }} onClick={() => setShowLeaveModal(true)} style={{ background: DS.card, border: `1px solid ${DS.border}`, borderRadius: '24px', padding: '24px', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '16px', cursor: 'pointer', boxShadow: '0 12px 24px rgba(0,0,0,0.1)' }}>
             <div style={{ background: 'rgba(255,184,110,0.1)', padding: '14px', borderRadius: '16px' }}><CalendarDays color="#ffb86e" size={24} /></div>
             <span style={{ fontSize: '1rem', fontWeight: 800, color: DS.text }}>Apply Leave</span>
          </motion.button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: '16px', marginBottom: '24px', borderBottom: `1px solid ${DS.border}`, paddingBottom: '16px' }}>
          {[
            { id: 'tickets', label: 'IT Support', icon: Ticket },
            { id: 'leaves', label: 'Leaves', icon: CalendarDays },
            ...(isAdmin ? [{ id: 'subscriptions', label: 'My Subscriptions', icon: DollarSign }] : []),
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
              {activeTab === 'subscriptions' && isAdmin && (
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
                    <td style={{ padding: '16px 20px', color: '#89ceff', fontWeight: 700, fontSize: '0.875rem' }}>₹{s.cost}</td>
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

        {/* Leave Drawer */}
        <Drawer 
          isOpen={showLeaveModal} 
          onClose={() => setShowLeaveModal(false)} 
          title="Apply for Leave"
          subtitle="Submit your time-off request for approval"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div style={{ display: 'flex', gap: '16px' }}>
              <div style={{ flex: 1 }}>
                <label style={{ color: DS.muted, fontSize: '0.75rem', fontWeight: 700, marginBottom: '8px', display: 'block', textTransform: 'uppercase' }}>Leave Type</label>
                <select value={leaveData.leave_type} onChange={e => setLeaveData({ ...leaveData, leave_type: e.target.value })} style={{ width: '100%', background: DS.surface, color: DS.text, border: `1px solid ${DS.border}`, padding: '14px', borderRadius: '12px', fontSize: '0.9rem' }}>
                  <option>Sick</option><option>Casual</option><option>Earned</option><option>Maternity/Paternity</option>
                </select>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '16px' }}>
              <div style={{ flex: 1 }}>
                <label style={{ color: DS.muted, fontSize: '0.75rem', fontWeight: 700, marginBottom: '8px', display: 'block', textTransform: 'uppercase' }}>Start Date</label>
                <input type="date" value={leaveData.start_date} onChange={e => setLeaveData({ ...leaveData, start_date: e.target.value })} style={{ width: '100%', background: DS.surface, color: DS.text, border: `1px solid ${DS.border}`, padding: '14px', borderRadius: '12px', fontSize: '0.9rem' }} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ color: DS.muted, fontSize: '0.75rem', fontWeight: 700, marginBottom: '8px', display: 'block', textTransform: 'uppercase' }}>End Date</label>
                <input type="date" value={leaveData.end_date} onChange={e => setLeaveData({ ...leaveData, end_date: e.target.value })} style={{ width: '100%', background: DS.surface, color: DS.text, border: `1px solid ${DS.border}`, padding: '14px', borderRadius: '12px', fontSize: '0.9rem' }} />
              </div>
            </div>
            <div>
              <label style={{ color: DS.muted, fontSize: '0.75rem', fontWeight: 700, marginBottom: '8px', display: 'block', textTransform: 'uppercase' }}>Reason</label>
              <textarea value={leaveData.reason} onChange={e => setLeaveData({ ...leaveData, reason: e.target.value })} rows={4} placeholder="Briefly describe the reason for your leave..." style={{ width: '100%', background: DS.surface, color: DS.text, border: `1px solid ${DS.border}`, padding: '14px', borderRadius: '12px', fontSize: '0.9rem', resize: 'none' }} />
            </div>
            <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
              <button onClick={() => setShowLeaveModal(false)} style={{ flex: 1, padding: '16px', background: 'transparent', color: DS.muted, border: `1px solid ${DS.border}`, borderRadius: '12px', cursor: 'pointer', fontWeight: 700 }}>Cancel</button>
              <button onClick={handleLeaveSubmit} style={{ flex: 1, padding: '16px', background: '#4ade80', color: '#000', border: 'none', borderRadius: '12px', cursor: 'pointer', fontWeight: 800 }}>Submit Application</button>
            </div>
          </div>
        </Drawer>

        {/* Subscription Drawer */}
        <Drawer
          isOpen={showSubModal}
          onClose={() => setShowSubModal(false)}
          title="Add Subscription"
          subtitle="Track recurring IT service costs"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div>
              <label style={{ color: DS.muted, fontSize: '0.75rem', fontWeight: 700, marginBottom: '8px', display: 'block', textTransform: 'uppercase' }}>Service Name</label>
              <input type="text" value={subData.service_name} onChange={e => setSubData({ ...subData, service_name: e.target.value })} placeholder="e.g. AWS, Figma, Zoom" style={{ width: '100%', background: DS.surface, color: DS.text, border: `1px solid ${DS.border}`, padding: '14px', borderRadius: '12px', fontSize: '0.9rem' }} />
            </div>
            <div>
              <label style={{ color: DS.muted, fontSize: '0.75rem', fontWeight: 700, marginBottom: '8px', display: 'block', textTransform: 'uppercase' }}>Cost (₹)</label>
              <input type="number" value={subData.cost} onChange={e => setSubData({ ...subData, cost: e.target.value })} placeholder="Enter amount" style={{ width: '100%', background: DS.surface, color: DS.text, border: `1px solid ${DS.border}`, padding: '14px', borderRadius: '12px', fontSize: '0.9rem' }} />
            </div>
            <div style={{ display: 'flex', gap: '16px' }}>
              <div style={{ flex: 1 }}>
                <label style={{ color: DS.muted, fontSize: '0.75rem', fontWeight: 700, marginBottom: '8px', display: 'block', textTransform: 'uppercase' }}>Billing Cycle</label>
                <select value={subData.billing_cycle} onChange={e => setSubData({ ...subData, billing_cycle: e.target.value })} style={{ width: '100%', background: DS.surface, color: DS.text, border: `1px solid ${DS.border}`, padding: '14px', borderRadius: '12px', fontSize: '0.9rem' }}>
                  <option>Monthly</option><option>Quarterly</option><option>Yearly</option>
                </select>
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ color: DS.muted, fontSize: '0.75rem', fontWeight: 700, marginBottom: '8px', display: 'block', textTransform: 'uppercase' }}>Next Due Date</label>
                <input type="date" value={subData.next_due_date} onChange={e => setSubData({ ...subData, next_due_date: e.target.value })} style={{ width: '100%', background: DS.surface, color: DS.text, border: `1px solid ${DS.border}`, padding: '14px', borderRadius: '12px', fontSize: '0.9rem' }} />
              </div>
            </div>
            <div>
              <label style={{ color: DS.muted, fontSize: '0.75rem', fontWeight: 700, marginBottom: '8px', display: 'block', textTransform: 'uppercase' }}>Comment / Notes</label>
              <textarea value={subData.comment} onChange={e => setSubData({ ...subData, comment: e.target.value })} rows={3} placeholder="Optional notes about this subscription..." style={{ width: '100%', background: DS.surface, color: DS.text, border: `1px solid ${DS.border}`, padding: '14px', borderRadius: '12px', fontSize: '0.9rem', resize: 'none' }} />
            </div>
            <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
              <button onClick={() => setShowSubModal(false)} style={{ flex: 1, padding: '16px', background: 'transparent', color: DS.muted, border: `1px solid ${DS.border}`, borderRadius: '12px', cursor: 'pointer', fontWeight: 700 }}>Cancel</button>
              <button onClick={handleSubSubmit} style={{ flex: 1, padding: '16px', background: '#89ceff', color: '#000', border: 'none', borderRadius: '12px', cursor: 'pointer', fontWeight: 800 }}>Add Subscription</button>
            </div>
          </div>
        </Drawer>

        {/* Payslip Drawer */}
        <Drawer
          isOpen={showPayslipModal}
          onClose={() => setShowPayslipModal(false)}
          title="Request Payslips"
          subtitle="Download historical salary statements"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div style={{ background: DS.surface, border: `1px solid ${DS.border}`, borderRadius: '20px', padding: '24px' }}>
              <label style={{ color: DS.primary, fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', display: 'block', marginBottom: '16px', letterSpacing: '0.1em' }}>Period From</label>
              <div style={{ display: 'flex', gap: '12px' }}>
                <div style={{ flex: 1 }}>
                  <select value={payslipData.startMonth} onChange={e => setPayslipData({ ...payslipData, startMonth: e.target.value })} style={{ width: '100%', background: DS.bg, color: DS.text, border: `1px solid ${DS.border}`, padding: '12px', borderRadius: '10px' }}>
                    {['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'].map(m => <option key={m}>{m}</option>)}
                  </select>
                </div>
                <div style={{ width: '100px' }}>
                  <select value={payslipData.startYear} onChange={e => setPayslipData({ ...payslipData, startYear: e.target.value })} style={{ width: '100%', background: DS.bg, color: DS.text, border: `1px solid ${DS.border}`, padding: '12px', borderRadius: '10px' }}>
                    {['2023', '2024', '2025', '2026'].map(y => <option key={y}>{y}</option>)}
                  </select>
                </div>
              </div>
            </div>

            <div style={{ background: DS.surface, border: `1px solid ${DS.border}`, borderRadius: '20px', padding: '24px' }}>
              <label style={{ color: DS.primary, fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', display: 'block', marginBottom: '16px', letterSpacing: '0.1em' }}>Period To</label>
              <div style={{ display: 'flex', gap: '12px' }}>
                <div style={{ flex: 1 }}>
                  <select value={payslipData.endMonth} onChange={e => setPayslipData({ ...payslipData, endMonth: e.target.value })} style={{ width: '100%', background: DS.bg, color: DS.text, border: `1px solid ${DS.border}`, padding: '12px', borderRadius: '10px' }}>
                    {['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'].map(m => <option key={m}>{m}</option>)}
                  </select>
                </div>
                <div style={{ width: '100px' }}>
                  <select value={payslipData.endYear} onChange={e => setPayslipData({ ...payslipData, endYear: e.target.value })} style={{ width: '100%', background: DS.bg, color: DS.text, border: `1px solid ${DS.border}`, padding: '12px', borderRadius: '10px' }}>
                    {['2023', '2024', '2025', '2026'].map(y => <option key={y}>{y}</option>)}
                  </select>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
              <button onClick={() => setShowPayslipModal(false)} style={{ flex: 1, padding: '16px', background: 'transparent', color: DS.muted, border: `1px solid ${DS.border}`, borderRadius: '12px', cursor: 'pointer', fontWeight: 700 }}>Cancel</button>
              <button onClick={handlePayslipSubmit} style={{ flex: 1, padding: '16px', background: DS.primary, color: '#fff', border: 'none', borderRadius: '12px', cursor: 'pointer', fontWeight: 800 }}>Request Downloads</button>
            </div>
          </div>
        </Drawer>

        {/* Grievance Drawer */}
        <Drawer
          isOpen={showGrievanceModal}
          onClose={() => setShowGrievanceModal(false)}
          title="Confidential Grievance"
          subtitle="Your submission goes directly to HR & Senior Management"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div style={{ background: 'rgba(255,68,68,0.05)', border: '1px solid rgba(255,68,68,0.1)', borderRadius: '16px', padding: '16px', display: 'flex', gap: '12px' }}>
              <AlertTriangle color="#ff4444" size={20} style={{ flexShrink: 0 }} />
              <p style={{ color: DS.muted, fontSize: '0.85rem', margin: 0, lineHeight: 1.5 }}>
                We maintain strict confidentiality for all grievances. If you choose to submit anonymously, your identity will not be shared with anyone.
              </p>
            </div>
            <div>
              <label style={{ color: DS.muted, fontSize: '0.75rem', fontWeight: 700, marginBottom: '8px', display: 'block', textTransform: 'uppercase' }}>Describe the issue</label>
              <textarea 
                value={grievanceData.description} 
                onChange={e => setGrievanceData({ ...grievanceData, description: e.target.value })} 
                rows={6} 
                placeholder="Provide as much detail as possible..."
                style={{ width: '100%', background: DS.surface, color: DS.text, border: `1px solid ${DS.border}`, padding: '14px', borderRadius: '12px', fontSize: '0.9rem', resize: 'none' }} 
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', background: DS.surface, padding: '16px', borderRadius: '12px', border: `1px solid ${DS.border}` }}>
              <input 
                type="checkbox" 
                id="anon" 
                checked={grievanceData.anonymous} 
                onChange={e => setGrievanceData({ ...grievanceData, anonymous: e.target.checked })} 
                style={{ width: '18px', height: '18px', cursor: 'pointer' }}
              />
              <label htmlFor="anon" style={{ color: DS.text, fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer' }}>Submit Anonymously</label>
            </div>
            <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
              <button onClick={() => setShowGrievanceModal(false)} style={{ flex: 1, padding: '16px', background: 'transparent', color: DS.muted, border: `1px solid ${DS.border}`, borderRadius: '12px', cursor: 'pointer', fontWeight: 700 }}>Cancel</button>
              <button 
                onClick={handleGrievanceSubmit} 
                style={{ flex: 1, padding: '16px', background: '#ff4444', color: '#fff', border: 'none', borderRadius: '12px', cursor: 'pointer', fontWeight: 800 }}
              >
                File Grievance
              </button>
            </div>
          </div>
        </Drawer>

        {/* Activity Detail Drawer */}
        <Drawer
          isOpen={showDayModal}
          onClose={() => setShowDayModal(false)}
          title="Daily Activity"
          subtitle={selectedDate ? format(selectedDate, 'EEEE, MMMM do') : undefined}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {selectedDayEvents.map(event => (
              <div 
                key={event.id}
                onClick={() => {
                  if (event.type === 'ticket') navigate(`/tickets/${event.id}`);
                  if (event.type === 'subscription') setActiveTab('subscriptions');
                  if (event.type === 'leave') setActiveTab('leaves');
                  setShowDayModal(false);
                }}
                style={{ background: DS.surface, padding: '20px', borderRadius: '18px', border: `1px solid ${DS.border}`, cursor: 'pointer', transition: 'all 0.2s' }}
                onMouseEnter={e => e.currentTarget.style.borderColor = event.color || DS.primary}
                onMouseLeave={e => e.currentTarget.style.borderColor = DS.border}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: event.color }} />
                  <span style={{ fontSize: '0.65rem', fontWeight: 800, color: DS.muted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{event.type}</span>
                </div>
                <p style={{ fontSize: '0.95rem', fontWeight: 600, color: DS.text, margin: 0 }}>{event.title}</p>
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '12px' }}>
                  <span style={{ fontSize: '0.7rem', color: DS.primary, fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>
                    View Details <ChevronRight size={12} />
                  </span>
                </div>
              </div>
            ))}
          </div>
        </Drawer>
    </div>
  );
};
