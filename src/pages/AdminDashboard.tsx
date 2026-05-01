import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Plus, Search, Filter, ChevronRight, Ticket, CheckCircle2,
  Clock, AlertTriangle, RefreshCw, Users, TrendingUp, Shield
} from 'lucide-react';
import { format } from 'date-fns';
import { supabase } from '../lib/supabase';
import { CalendarView, MiniCalendar, CalendarEvent } from '../components/CalendarView';
import { getLeaveRequests, getSubscriptions } from '../lib/api';
import { useAuth } from '../lib/AuthContext';

const DS = {
  bg: '#0f172a', card: '#131b2e', cardHigh: '#222a3d',
  border: 'rgba(14,165,233,0.12)', primary: '#0ea5e9',
  text: '#dae2fd', muted: '#88929b', surface: '#0b1326',
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
      t.id?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all' || t.status === statusFilter;
    return matchSearch && matchStatus;
  });

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

        {/* Contextual Awareness: High Priority Alerts & Workload */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 280px', gap: '20px', marginBottom: '32px' }}>
          <div style={{ background: 'rgba(255,68,68,0.03)', borderRadius: '24px', padding: '24px', border: '1px solid rgba(255,68,68,0.1)', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '16px' }}>
            <div>
              <h3 style={{ fontSize: '0.75rem', fontWeight: 800, color: '#ff4444', textTransform: 'uppercase', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px', letterSpacing: '0.05em' }}>
                <Shield size={16} color="#ff4444" /> High Priority Breach Risk
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {tickets.filter(t => t.priority === 'Critical' && !['Resolved', 'Closed'].includes(t.status)).slice(0, 2).map(t => (
                  <div key={t.id} onClick={() => navigate(`/tickets/${t.id}`)} style={{ background: DS.surface, padding: '10px 14px', borderRadius: '14px', cursor: 'pointer', border: `1px solid ${DS.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <p style={{ fontSize: '0.85rem', fontWeight: 700, color: DS.text }}>{t.title}</p>
                      <p style={{ fontSize: '0.7rem', color: DS.muted }}>SLA: {t.sla_deadline ? format(new Date(t.sla_deadline), 'MMM d, h:mm a') : 'No SLA'}</p>
                    </div>
                    <ChevronRight size={14} color={DS.muted} />
                  </div>
                ))}
                {tickets.filter(t => t.priority === 'Critical' && !['Resolved', 'Closed'].includes(t.status)).length === 0 && (
                  <p style={{ fontSize: '0.8rem', color: DS.muted, fontStyle: 'italic' }}>No critical tickets at risk currently.</p>
                )}
              </div>
            </div>

            {tickets.some(t => t.status === 'Waiting for User' && t.employee_id === profile?.id) && (
              <div style={{ background: 'rgba(255,184,110,0.05)', borderRadius: '16px', padding: '16px', border: '1px solid rgba(255,184,110,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Clock size={16} color="#ffb86e" />
                  <div>
                    <p style={{ fontSize: '0.75rem', fontWeight: 800, color: '#ffb86e', margin: 0 }}>Action Required</p>
                    <p style={{ fontSize: '0.65rem', color: DS.muted, margin: 0 }}>Ticket waiting for your response</p>
                  </div>
                </div>
                <button onClick={() => navigate('/ess')} style={{ background: '#ffb86e', color: '#000', border: 'none', borderRadius: '8px', padding: '6px 12px', fontSize: '0.65rem', fontWeight: 800, cursor: 'pointer' }}>Review</button>
              </div>
            )}
          </div>

          <div style={{ background: DS.card, borderRadius: '24px', padding: '24px', border: `1px solid ${DS.border}`, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <h3 style={{ fontSize: '0.75rem', fontWeight: 800, color: DS.text, textTransform: 'uppercase', marginBottom: '16px', letterSpacing: '0.05em' }}>Team Workload</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.8rem', color: DS.muted }}>Unassigned Pool</span>
                <span style={{ background: 'rgba(14,165,233,0.1)', color: DS.primary, padding: '2px 8px', borderRadius: '6px', fontSize: '0.7rem', fontWeight: 800 }}>
                  {tickets.filter(t => !t.assigned_to && t.status === 'Open').length}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.8rem', color: DS.muted }}>Active In-Progress</span>
                <span style={{ background: 'rgba(255,184,110,0.1)', color: '#ffb86e', padding: '2px 8px', borderRadius: '6px', fontSize: '0.7rem', fontWeight: 800 }}>
                  {tickets.filter(t => t.status === 'In Progress').length}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.8rem', color: DS.muted }}>Pending Leaves</span>
                <span style={{ background: 'rgba(192,132,252,0.1)', color: '#c084fc', padding: '2px 8px', borderRadius: '6px', fontSize: '0.7rem', fontWeight: 800 }}>
                  {calendarEvents.filter(e => e.type === 'leave').length}
                </span>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'stretch' }}>
            <MiniCalendar events={calendarEvents} />
          </div>
        </div>

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div>
            <p style={{ color: DS.muted, fontSize: '0.65rem', fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '4px' }}>Support Management</p>
            <h1 style={{ color: DS.text, fontSize: '1.75rem', fontWeight: 800, letterSpacing: '-0.02em', margin: 0 }}>Ticket Queue</h1>
          </div>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <button onClick={fetchData} style={{ width: '42px', height: '42px', borderRadius: '12px', background: DS.card, border: `1px solid ${DS.border}`, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: DS.muted }}>
              <RefreshCw size={16} />
            </button>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => navigate('/tickets/new')}
              style={{
                background: 'linear-gradient(135deg, #0ea5e9, #0284c7)',
                color: '#fff', border: 'none', borderRadius: '12px',
                padding: '10px 20px', fontWeight: 700, fontSize: '0.8rem',
                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px',
                boxShadow: '0 8px 20px rgba(14,165,233,0.3)',
              }}
            >
              <Plus size={16} /> New Ticket
            </motion.button>
          </div>
        </header>
      </motion.div>

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
    </div>
  );
};
