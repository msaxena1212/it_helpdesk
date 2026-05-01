import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Plus, Search, Filter, ChevronRight, Ticket, CheckCircle2,
  Clock, AlertTriangle, RefreshCw, Users, TrendingUp, Shield, X,
  Activity, Inbox, AlertCircle, Play, UserPlus, Zap, BarChart3
} from 'lucide-react';
import { format } from 'date-fns';
import { supabase } from '../lib/supabase';
import { CalendarView, MiniCalendar, CalendarEvent } from '../components/CalendarView';
import { getLeaveRequests, getSubscriptions } from '../lib/api';
import { useAuth } from '../lib/AuthContext';
import { isSameDay } from 'date-fns';
import { AnimatePresence } from 'framer-motion';
import { Drawer } from '../components/Drawer';

const DS = {
  bg: '#0f172a', card: '#131b2e', cardHigh: '#222a3d',
  border: 'rgba(14,165,233,0.12)', primary: '#0ea5e9',
  text: '#dae2fd', muted: '#88929b', surface: '#0b1326',
  success: '#4ade80', danger: '#ff4444', warning: '#ffb86e',
};

const Badge = ({ status }: { status: string }) => {
  const map: Record<string, { bg: string; color: string }> = {
    'Open': { bg: 'rgba(14,165,233,0.15)', color: '#89ceff' },
    'In Progress': { bg: 'rgba(255,184,110,0.15)', color: '#ffb86e' },
    'Waiting for User': { bg: 'rgba(255,184,110,0.15)', color: '#ffb86e' },
    'Resolved': { bg: 'rgba(74,222,128,0.15)', color: '#4ade80' },
    'Access Given': { bg: 'rgba(74,222,128,0.15)', color: '#4ade80' },
    'Deployed': { bg: 'rgba(74,222,128,0.15)', color: '#4ade80' },
    'Rejected': { bg: 'rgba(255,68,68,0.15)', color: '#ff4444' },
    'Error': { bg: 'rgba(255,68,68,0.15)', color: '#ff4444' },
    'Closed': { bg: 'rgba(136,146,155,0.15)', color: '#88929b' },
  };
  const s = map[status] || map['Open'];
  return (
    <span style={{
      ...s, padding: '2px 10px', borderRadius: '9999px',
      fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em',
    }}>
      {status?.replace('_', ' ')}
    </span>
  );
};

const PriorityDot = ({ priority }: { priority: string }) => {
  const colors: Record<string, string> = {
    Critical: '#ff4444', High: '#ffb86e', Medium: '#0ea5e9', Low: '#4ade80',
  };
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
      <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: colors[priority] || '#88929b', flexShrink: 0 }} />
      <span style={{ fontSize: '0.75rem', color: DS.text, fontWeight: 600 }}>{priority}</span>
    </div>
  );
};


export const AdminDashboard = () => {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [tickets, setTickets] = useState<any[]>([]);
  const [teamCount, setTeamCount] = useState(0);
  const [selectedDayEvents, setSelectedDayEvents] = useState<CalendarEvent[]>([]);
  const [showDayModal, setShowDayModal] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);

  useEffect(() => { 
    fetchData(); 
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [{ data: ticketData }, { count: profilesCount }, lData, sData] = await Promise.all([
        supabase.from('tickets').select('*').order('created_at', { ascending: false }),
        supabase.from('profiles').select('id', { count: 'exact', head: true }),
        getLeaveRequests(),
        getSubscriptions()
      ]);
      setTickets(ticketData || []);
      setTeamCount(profilesCount || 0);

      // Prepare calendar events
      const events: CalendarEvent[] = [
        ...ticketData!.filter(t => t.sla_deadline && !['Resolved', 'Closed'].includes(t.status)).map(t => ({
          id: t.id,
          date: new Date(t.sla_deadline),
          title: `SLA: ${t.title}`,
          type: 'ticket' as const,
          color: t.priority === 'Critical' ? '#ff4444' : '#0ea5e9'
        })),
        ...lData.map((l: any) => ({
          id: l.id,
          date: new Date(l.start_date),
          title: `Leave: ${l.employee_name || 'User'}`,
          type: 'leave' as const,
          color: '#ffb86e'
        })),
        ...sData.map((s: any) => ({
          id: s.id,
          date: new Date(s.next_due_date),
          title: `Renew: ${s.service_name}`,
          type: 'subscription' as const,
          color: '#4ade80'
        })),
        ...ticketData!.filter(t => t.sla_deadline && !['Resolved', 'Closed'].includes(t.status)).map(t => ({
          id: t.id,
          date: new Date(t.sla_deadline),
          title: `SLA: ${t.title}`,
          type: 'ticket' as const,
          color: t.priority === 'Critical' ? '#ff4444' : '#0ea5e9'
        }))
      ];
      setCalendarEvents(events);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleDateClick = (date: Date) => {
    const dayEvents = calendarEvents.filter(e => isSameDay(e.date, date));
    if (dayEvents.length > 0) {
      setSelectedDate(date);
      setSelectedDayEvents(dayEvents);
      setShowDayModal(true);
    }
  };

  const getSlaBreachRate = () => {
    if (tickets.length === 0) return '0%';
    const breached = tickets.filter(t => 
      t.sla_deadline &&
      new Date(t.sla_deadline) < new Date() && 
      !['Resolved', 'Closed'].includes(t.status)
    ).length;
    return `${((breached / tickets.length) * 100).toFixed(1)}%`;
  };

  const getResolutionTrend = () => {
    if (tickets.length === 0) return '0%';
    const now = new Date();
    const last7Days = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const prev7Days = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

    const recentResolved = tickets.filter(t => t.status === 'Resolved' && new Date(t.updated_at) >= last7Days).length;
    const pastResolved = tickets.filter(t => t.status === 'Resolved' && new Date(t.updated_at) < last7Days && new Date(t.updated_at) >= prev7Days).length;

    if (pastResolved === 0) return recentResolved > 0 ? '+100%' : '0%';
    const diff = ((recentResolved - pastResolved) / pastResolved) * 100;
    return `${diff >= 0 ? '+' : ''}${diff.toFixed(0)}%`;
  };

  const filtered = tickets.filter(t => {
    const matchSearch = t.title?.toLowerCase().includes(search.toLowerCase()) ||
      t.id?.toLowerCase().includes(search.toLowerCase()) ||
      t.employee?.department?.toLowerCase().includes(search.toLowerCase()) ||
      search.toLowerCase() === 'engineering' || search.toLowerCase() === 'hr' || search.toLowerCase() === 'sales'; // Basic mock filtering for departments
    const matchStatus = statusFilter === 'all' || t.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const slaBreachingCount = tickets.filter(t => t.sla_deadline && new Date(t.sla_deadline).getTime() - new Date().getTime() < 2 * 60 * 60 * 1000 && new Date(t.sla_deadline).getTime() > new Date().getTime() && !['Resolved', 'Closed'].includes(t.status)).length;

  const stats = [
    { label: 'Total Tickets', value: tickets.length, icon: Ticket, color: '#89ceff', bg: 'rgba(14,165,233,0.12)' },
    { label: 'SLA Breach Rate', value: getSlaBreachRate(), icon: AlertTriangle, color: '#ffb4ab', bg: 'rgba(255,180,171,0.12)' },
    { label: 'Resolution Trend', value: getResolutionTrend(), icon: TrendingUp, color: '#4ade80', bg: 'rgba(74,222,128,0.1)' },
    { label: 'Team Size', value: teamCount, icon: Users, color: '#c084fc', bg: 'rgba(192,132,252,0.1)' },
  ];

  const statusTabs = ['all', 'Open', 'In Progress', 'Waiting for User', 'Resolved', 'Closed'];

  return (
    <div style={{ minHeight: '100vh', background: DS.bg, padding: '32px', fontFamily: "'Inter', sans-serif" }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>

        {/* Header */}
        {/* Header - Minimal & Action Oriented */}
        <motion.div initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }}>
          <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: DS.primary, marginBottom: '4px' }}>
                <Shield size={16} />
                <span style={{ fontSize: '0.65rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Governance & Operations</span>
              </div>
              <h1 style={{ color: DS.text, fontSize: '2rem', fontWeight: 900, letterSpacing: '-0.04em', margin: 0 }}>Command Center</h1>
            </div>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
              <button onClick={fetchData} style={{ width: '38px', height: '38px', borderRadius: '10px', background: DS.card, border: `1px solid ${DS.border}`, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: DS.muted }}>
                <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
              </button>
            </div>
          </header>
        </motion.div>

        {/* 🔝 GLOBAL COMMAND STRIP */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '40px' }}>
          <div style={{ background: 'linear-gradient(135deg, rgba(255,68,68,0.1) 0%, rgba(255,68,68,0.02) 100%)', border: '1px solid rgba(255,68,68,0.2)', borderRadius: '24px', padding: '24px', display: 'flex', alignItems: 'center', gap: '16px' }}>
             <div style={{ background: 'rgba(255,68,68,0.2)', padding: '12px', borderRadius: '12px' }}><Clock color="#ff4444" size={24} /></div>
             <div>
               <p style={{ fontSize: '0.75rem', fontWeight: 800, color: '#ff4444', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>SLA Breaching Soon</p>
               <h3 style={{ fontSize: '1.5rem', fontWeight: 900, color: DS.text, margin: 0 }}>{slaBreachingCount}</h3>
             </div>
          </div>
          <div style={{ background: 'linear-gradient(135deg, rgba(255,184,110,0.1) 0%, rgba(255,184,110,0.02) 100%)', border: '1px solid rgba(255,184,110,0.2)', borderRadius: '24px', padding: '24px', display: 'flex', alignItems: 'center', gap: '16px' }}>
             <div style={{ background: 'rgba(255,184,110,0.2)', padding: '12px', borderRadius: '12px' }}><Inbox color="#ffb86e" size={24} /></div>
             <div>
               <p style={{ fontSize: '0.75rem', fontWeight: 800, color: '#ffb86e', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>Unassigned</p>
               <h3 style={{ fontSize: '1.5rem', fontWeight: 900, color: DS.text, margin: 0 }}>{tickets.filter(t => !t.assigned_to && t.status === 'Open').length}</h3>
             </div>
          </div>
          <div style={{ background: 'linear-gradient(135deg, rgba(255,68,68,0.1) 0%, rgba(255,68,68,0.02) 100%)', border: '1px solid rgba(255,68,68,0.2)', borderRadius: '24px', padding: '24px', display: 'flex', alignItems: 'center', gap: '16px' }}>
             <div style={{ background: 'rgba(255,68,68,0.2)', padding: '12px', borderRadius: '12px' }}><AlertCircle color="#ff4444" size={24} /></div>
             <div>
               <p style={{ fontSize: '0.75rem', fontWeight: 800, color: '#ff4444', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>Escalated</p>
               <h3 style={{ fontSize: '1.5rem', fontWeight: 900, color: DS.text, margin: 0 }}>{tickets.filter(t => t.priority === 'Critical' && t.status !== 'Resolved' && t.status !== 'Closed').length}</h3>
             </div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '24px', marginBottom: '40px' }}>
           
           <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              {/* 🌍 SYSTEM OVERVIEW */}
              <div style={{ background: DS.card, borderRadius: '32px', padding: '32px', border: `1px solid ${DS.border}` }}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 900, marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '8px' }}><BarChart3 size={20} color={DS.primary} /> System Overview</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '24px' }}>
                   <div style={{ background: DS.surface, border: `1px solid ${DS.border}`, borderRadius: '20px', padding: '16px', textAlign: 'center', position: 'relative' }}>
                      <p style={{ fontSize: '0.65rem', color: DS.muted, fontWeight: 800, textTransform: 'uppercase', marginBottom: '8px' }}>SLA Compliance</p>
                      <p style={{ fontSize: '1.4rem', fontWeight: 900, color: DS.success }}>94.2%</p>
                      {slaBreachingCount > 0 && <p style={{ fontSize: '0.65rem', color: '#ff4444', fontWeight: 700, position: 'absolute', bottom: '8px', left: 0, right: 0 }}>{slaBreachingCount} tickets breaching in &lt; 2h</p>}
                   </div>
                   <div style={{ background: DS.surface, border: `1px solid ${DS.border}`, borderRadius: '20px', padding: '16px', textAlign: 'center' }}>
                      <p style={{ fontSize: '0.65rem', color: DS.muted, fontWeight: 800, textTransform: 'uppercase', marginBottom: '8px' }}>Avg Resolution</p>
                      <p style={{ fontSize: '1.4rem', fontWeight: 900, color: DS.text }}>1.2d</p>
                   </div>
                   <div style={{ background: DS.surface, border: `1px solid ${DS.border}`, borderRadius: '20px', padding: '16px', textAlign: 'center' }}>
                      <p style={{ fontSize: '0.65rem', color: DS.muted, fontWeight: 800, textTransform: 'uppercase', marginBottom: '8px' }}>Active Users</p>
                      <p style={{ fontSize: '1.4rem', fontWeight: 900, color: DS.primary }}>{teamCount}</p>
                   </div>
                </div>
                
                <h4 style={{ fontSize: '0.8rem', fontWeight: 800, color: DS.muted, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '16px' }}>Department Load</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                   <div onClick={() => setSearch('Engineering')} style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', padding: '4px', borderRadius: '8px' }} onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                      <span style={{ fontSize: '0.8rem', fontWeight: 700, color: DS.text, width: '80px' }}>Engineering</span>
                      <div style={{ flex: 1, height: '6px', background: DS.surface, borderRadius: '3px', overflow: 'hidden' }}>
                         <div style={{ width: '65%', height: '100%', background: DS.primary }} />
                      </div>
                      <span style={{ fontSize: '0.75rem', fontWeight: 800, color: DS.muted }}>65%</span>
                   </div>
                   <div onClick={() => setSearch('HR')} style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', padding: '4px', borderRadius: '8px' }} onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                      <span style={{ fontSize: '0.8rem', fontWeight: 700, color: DS.text, width: '80px' }}>HR</span>
                      <div style={{ flex: 1, height: '6px', background: DS.surface, borderRadius: '3px', overflow: 'hidden' }}>
                         <div style={{ width: '20%', height: '100%', background: '#c084fc' }} />
                      </div>
                      <span style={{ fontSize: '0.75rem', fontWeight: 800, color: DS.muted }}>20%</span>
                   </div>
                   <div onClick={() => setSearch('Sales')} style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', padding: '4px', borderRadius: '8px' }} onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                      <span style={{ fontSize: '0.8rem', fontWeight: 700, color: DS.text, width: '80px' }}>Sales</span>
                      <div style={{ flex: 1, height: '6px', background: DS.surface, borderRadius: '3px', overflow: 'hidden' }}>
                         <div style={{ width: '15%', height: '100%', background: '#4ade80' }} />
                      </div>
                      <span style={{ fontSize: '0.75rem', fontWeight: 800, color: DS.muted }}>15%</span>
                   </div>
                </div>
              </div>

              {/* 🎟️ TICKET TRIAGE PANEL */}
              <div style={{ background: DS.card, borderRadius: '32px', padding: '32px', border: `1px solid ${DS.border}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                   <h3 style={{ fontSize: '1.1rem', fontWeight: 900, display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}><Zap size={20} color={DS.warning} /> Triage Panel</h3>
                   <span style={{ fontSize: '0.7rem', fontWeight: 800, color: DS.warning, background: 'rgba(255,184,110,0.1)', padding: '4px 10px', borderRadius: '8px' }}>Action Needed</span>
                </div>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                  <div>
                    <h4 style={{ fontSize: '0.8rem', fontWeight: 800, color: DS.muted, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '12px' }}>Needs Assignment</h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {tickets.filter(t => !t.assigned_to && t.status === 'Open').slice(0, 2).map(t => (
                         <div key={t.id} style={{ background: DS.surface, border: `1px solid ${DS.border}`, borderRadius: '16px', padding: '16px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                               <p style={{ fontSize: '0.85rem', fontWeight: 700, color: DS.text, margin: 0 }}>{t.title}</p>
                            </div>
                            <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                               <button style={{ flex: 1, background: 'rgba(14,165,233,0.1)', color: DS.primary, border: `1px solid rgba(14,165,233,0.2)`, padding: '6px', borderRadius: '8px', fontWeight: 800, fontSize: '0.7rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}><UserPlus size={14} /> Assign</button>
                               <button onClick={() => navigate(`/tickets/${t.id}`)} style={{ flex: 1, background: DS.card, border: `1px solid ${DS.border}`, color: DS.text, padding: '6px', borderRadius: '8px', fontWeight: 800, fontSize: '0.7rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}><Play size={14} /> Open</button>
                            </div>
                         </div>
                      ))}
                      {tickets.filter(t => !t.assigned_to && t.status === 'Open').length === 0 && <p style={{ fontSize: '0.8rem', color: DS.muted, fontStyle: 'italic' }}>None at the moment.</p>}
                    </div>
                  </div>

                  <div>
                    <h4 style={{ fontSize: '0.8rem', fontWeight: 800, color: DS.muted, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '12px' }}>High Priority</h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {tickets.filter(t => (t.priority === 'High' || t.priority === 'Critical') && t.status !== 'Resolved' && t.status !== 'Closed').slice(0, 2).map(t => (
                         <div key={t.id} style={{ background: DS.surface, border: `1px solid ${DS.border}`, borderRadius: '16px', padding: '16px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                               <p style={{ fontSize: '0.85rem', fontWeight: 700, color: DS.text, margin: 0 }}>{t.title}</p>
                               <PriorityDot priority={t.priority} />
                            </div>
                            <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                               <button onClick={() => navigate(`/tickets/${t.id}`)} style={{ flex: 1, background: 'rgba(255,68,68,0.1)', color: '#ff4444', border: `1px solid rgba(255,68,68,0.2)`, padding: '6px', borderRadius: '8px', fontWeight: 800, fontSize: '0.7rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}><Play size={14} /> Handle</button>
                            </div>
                         </div>
                      ))}
                      {tickets.filter(t => (t.priority === 'High' || t.priority === 'Critical') && t.status !== 'Resolved' && t.status !== 'Closed').length === 0 && <p style={{ fontSize: '0.8rem', color: DS.muted, fontStyle: 'italic' }}>No active high priority items.</p>}
                    </div>
                  </div>
                </div>
              </div>
           </div>

           <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              {/* 📌 SYSTEM STATUS */}
              <div style={{ background: DS.card, borderRadius: '32px', padding: '32px', border: `1px solid ${DS.border}` }}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 900, marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '8px' }}><Activity size={20} color={DS.primary} /> System Status</h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div style={{ background: DS.surface, padding: '20px', borderRadius: '20px', border: `1px solid ${DS.border}` }}>
                    <p style={{ fontSize: '0.75rem', color: DS.muted, textTransform: 'uppercase', fontWeight: 800, marginBottom: '8px' }}>Open Tickets</p>
                    <p style={{ fontSize: '1.75rem', fontWeight: 900, color: DS.text }}>{tickets.filter(t => t.status !== 'Resolved' && t.status !== 'Closed').length}</p>
                  </div>
                  <div style={{ background: DS.surface, padding: '20px', borderRadius: '20px', border: `1px solid ${DS.border}` }}>
                    <p style={{ fontSize: '0.75rem', color: DS.muted, textTransform: 'uppercase', fontWeight: 800, marginBottom: '8px' }}>Pending Approvals</p>
                    <p style={{ fontSize: '1.75rem', fontWeight: 900, color: DS.warning }}>{tickets.filter(t => t.status === 'Waiting for User').length}</p>
                  </div>
                </div>
              </div>

              {/* 📊 SYSTEM INSIGHTS */}
              <div style={{ background: DS.card, borderRadius: '32px', padding: '32px', border: `1px solid ${DS.border}` }}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 900, marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '8px' }}><TrendingUp size={20} color={DS.primary} /> System Insights</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: DS.surface, padding: '20px', borderRadius: '20px' }}>
                    <span style={{ fontSize: '0.85rem', color: DS.muted, fontWeight: 700 }}>Tickets this month</span>
                    <span style={{ fontSize: '1.4rem', fontWeight: 900, color: DS.text }}>{tickets.filter(t => new Date(t.created_at).getMonth() === new Date().getMonth()).length}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: DS.surface, padding: '20px', borderRadius: '20px' }}>
                    <span style={{ fontSize: '0.85rem', color: DS.muted, fontWeight: 700 }}>Most frequent issue</span>
                    <span style={{ fontSize: '1rem', fontWeight: 900, color: DS.warning }}>Access Request</span>
                  </div>
                </div>
              </div>
              {/* 👥 TEAM ACTIVITY */}
              <div style={{ background: DS.card, borderRadius: '32px', padding: '32px', border: `1px solid ${DS.border}`, flex: 1 }}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 900, marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '8px' }}><Users size={20} color={DS.primary} /> Team Activity</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                   <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
                     <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'rgba(14,165,233,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: DS.primary, fontWeight: 800, fontSize: '0.8rem' }}>AS</div>
                     <div>
                       <p style={{ fontSize: '0.9rem', fontWeight: 700, color: DS.text, marginBottom: '2px' }}>Alex assigned Ticket #829</p>
                       <p style={{ fontSize: '0.75rem', color: DS.muted, fontWeight: 600 }}>10 mins ago</p>
                     </div>
                   </div>
                   <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
                     <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'rgba(74,222,128,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: DS.success, fontWeight: 800, fontSize: '0.8rem' }}>MJ</div>
                     <div>
                       <p style={{ fontSize: '0.9rem', fontWeight: 700, color: DS.text, marginBottom: '2px' }}>Mike resolved Network Issue</p>
                       <p style={{ fontSize: '0.75rem', color: DS.muted, fontWeight: 600 }}>45 mins ago</p>
                     </div>
                   </div>
                   <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
                     <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'rgba(255,184,110,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: DS.warning, fontWeight: 800, fontSize: '0.8rem' }}>SJ</div>
                     <div>
                       <p style={{ fontSize: '0.9rem', fontWeight: 700, color: DS.text, marginBottom: '2px' }}>Sarah escalated Database Alert</p>
                       <p style={{ fontSize: '0.75rem', color: DS.muted, fontWeight: 600 }}>2 hours ago</p>
                     </div>
                   </div>
                </div>

                <div style={{ marginTop: '40px' }}>
                   <h4 style={{ fontSize: '0.8rem', fontWeight: 800, color: DS.muted, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '16px' }}>Schedule</h4>
                   <MiniCalendar events={calendarEvents} onDateClick={(date) => {
                     setSelectedDate(date);
                     setSelectedDayEvents(calendarEvents.filter(e => isSameDay(e.date, date)));
                     setShowDayModal(true);
                   }} />
                </div>
              </div>
           </div>
        </div>



        {/* Stats Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
          {stats.map((s, i) => (
            <motion.div
              key={s.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.07 }}
              style={{ background: DS.card, borderRadius: '16px', padding: '20px', border: `1px solid ${DS.border}` }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <p style={{ color: DS.muted, fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>{s.label}</p>
                <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: s.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <s.icon size={18} color={s.color} />
                </div>
              </div>
              <h3 style={{ color: DS.text, fontSize: '2rem', fontWeight: 800, lineHeight: 1 }}>{loading ? '—' : s.value}</h3>
            </motion.div>
          ))}
        </div>

        {/* Content based on Active View */}

        {/* Content Section */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Filter Bar */}
            <div style={{ background: DS.card, borderRadius: '16px', padding: '16px 20px', border: `1px solid ${DS.border}`, display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: DS.surface, border: `1px solid ${DS.border}`, borderRadius: '10px', padding: '9px 14px', flex: 1, minWidth: '200px' }}>
                <Search size={14} color={DS.muted} />
                <input
                  type="text" placeholder="Search tickets..."
                  value={search} onChange={e => setSearch(e.target.value)}
                  style={{ background: 'none', border: 'none', outline: 'none', color: DS.text, fontSize: '0.85rem', width: '100%' }}
                />
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                {statusTabs.map(s => (
                  <button
                    key={s}
                    onClick={() => setStatusFilter(s)}
                    style={{
                      padding: '7px 14px', borderRadius: '8px', border: 'none',
                      fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.05em',
                      textTransform: 'capitalize', cursor: 'pointer', transition: 'all 0.15s',
                      background: statusFilter === s ? 'rgba(14,165,233,0.2)' : 'transparent',
                      color: statusFilter === s ? '#89ceff' : DS.muted,
                    }}
                  >
                    {s.replace('_', ' ')}
                  </button>
                ))}
              </div>
            </div>
            
            {/* Table */}
            <div style={{ background: DS.card, borderRadius: '20px', border: `1px solid ${DS.border}`, overflow: 'hidden' }}>
              {loading ? (
                <div style={{ padding: '56px', textAlign: 'center', color: DS.muted }}>Loading tickets...</div>
              ) : filtered.length === 0 ? (
                <div style={{ padding: '64px', textAlign: 'center' }}>
                  <Ticket size={48} color="rgba(14,165,233,0.25)" style={{ margin: '0 auto 16px' }} />
                  <p style={{ color: DS.muted, fontWeight: 600 }}>No tickets match your filter</p>
                </div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: 'rgba(14,165,233,0.04)' }}>
                      {['ID', 'Subject', 'Status', 'Priority', 'Date', ''].map(h => (
                        <th key={h} style={{ padding: '13px 20px', textAlign: 'left', fontSize: '0.65rem', fontWeight: 700, color: DS.muted, letterSpacing: '0.1em', textTransform: 'uppercase' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((ticket) => (
                      <tr
                        key={ticket.id}
                        style={{ borderTop: `1px solid ${DS.border}`, cursor: 'pointer', transition: 'background 0.15s' }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'rgba(14,165,233,0.04)')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                        onClick={() => navigate(`/tickets/${ticket.id}`)}
                      >
                        <td style={{ padding: '16px 20px' }}>
                          <span style={{ fontSize: '0.7rem', fontFamily: 'monospace', color: DS.muted, fontWeight: 700 }}>
                            #{ticket.id?.substring(0, 8).toUpperCase()}
                          </span>
                        </td>
                        <td style={{ padding: '16px 20px', maxWidth: '320px' }}>
                          <p style={{ color: DS.text, fontWeight: 600, fontSize: '0.875rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{ticket.title}</p>
                        </td>
                        <td style={{ padding: '16px 20px' }}><Badge status={ticket.status} /></td>
                        <td style={{ padding: '16px 20px' }}><PriorityDot priority={ticket.priority} /></td>
                        <td style={{ padding: '16px 20px', color: DS.muted, fontSize: '0.78rem', whiteSpace: 'nowrap' }}>
                          {ticket.created_at ? new Date(ticket.created_at).toLocaleDateString() : '—'}
                        </td>
                        <td style={{ padding: '16px 20px', textAlign: 'right' }}>
                          <ChevronRight size={16} color={DS.muted} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
      </div>

        {/* Activity Detail Drawer */}
        <Drawer
          isOpen={showDayModal}
          onClose={() => setShowDayModal(false)}
          title="Operational Pulse"
          subtitle={selectedDate ? format(selectedDate, 'EEEE, MMMM do') : undefined}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {selectedDayEvents.map(event => (
              <div 
                key={event.id}
                onClick={() => {
                  if (event.type === 'ticket') navigate(`/tickets/${event.id}`);
                  if (event.type === 'subscription') navigate('/subscriptions');
                  if (event.type === 'leave') navigate('/ess');
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
                    Manage Item <ChevronRight size={12} />
                  </span>
                </div>
              </div>
            ))}
          </div>
        </Drawer>
    </div>
  );
};
