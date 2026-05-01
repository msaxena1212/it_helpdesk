import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Terminal, Shield, GitBranch, Cpu, Search, 
  RefreshCw, CheckCircle2, Clock, AlertTriangle, 
  ChevronRight, ArrowUpRight, Activity, AlertCircle, X, Filter,
  ServerCrash, GitMerge, RotateCcw, ShieldAlert, Zap, Key
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';
import { CalendarView, MiniCalendar, CalendarEvent } from '../components/CalendarView';
import { isSameDay, format } from 'date-fns';
import { Drawer } from '../components/Drawer';
import { AnimatePresence } from 'framer-motion';
import { useAuth } from '../lib/AuthContext';

const DS = {
  bg: '#0f172a', card: '#131b2e', cardHigh: '#222a3d',
  border: 'rgba(14,165,233,0.12)', primary: '#0ea5e9',
  text: '#dae2fd', muted: '#88929b', surface: '#0b1326',
  success: '#4ade80', danger: '#ff4444', warning: '#ffb86e',
};

const Badge = ({ status }: { status: string }) => {
  const map: Record<string, { bg: string; color: string }> = {
    'Open': { bg: 'rgba(14,165,233,0.15)', color: '#89ceff' },
    'Assigned': { bg: 'rgba(168,85,247,0.15)', color: '#c084fc' },
    'In Progress': { bg: 'rgba(255,184,110,0.15)', color: '#ffb86e' },
    'Resolved': { bg: 'rgba(74,222,128,0.15)', color: '#4ade80' },
    'Closed': { bg: 'rgba(136,146,155,0.15)', color: '#88929b' },
  };
  const s = map[status] || map['Open'];
  return (
    <span style={{
      ...s, padding: '2px 10px', borderRadius: '9999px',
      fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em',
    }}>
      {status}
    </span>
  );
};

const DevOpsBadge = ({ status }: { status?: string }) => {
  if (!status) return null;
  const map: Record<string, { bg: string; color: string; icon: any }> = {
    'Access Given': { bg: 'rgba(74,222,128,0.12)', color: '#4ade80', icon: CheckCircle2 },
    'Deployed': { bg: 'rgba(74,222,128,0.12)', color: '#4ade80', icon: CheckCircle2 },
    'Rejected': { bg: 'rgba(255,68,68,0.12)', color: '#ff4444', icon: X },
    'Error': { bg: 'rgba(255,68,68,0.12)', color: '#ff4444', icon: AlertCircle },
  };
  const s = map[status] || { bg: 'rgba(14,165,233,0.12)', color: '#89ceff', icon: Clock };
  return (
    <span style={{
      background: s.bg, color: s.color, padding: '2px 10px', borderRadius: '9999px',
      fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em',
      display: 'inline-flex', alignItems: 'center', gap: '4px',
    }}>
      <s.icon size={11} /> {status}
    </span>
  );
};

type FilterTab = 'all' | 'gitlab' | 'deploy' | 'pending' | 'completed';


export const DevOpsDashboard = () => {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [tickets, setTickets] = useState<any[]>([]);
  const [selectedDayEvents, setSelectedDayEvents] = useState<CalendarEvent[]>([]);
  const [showDayModal, setShowDayModal] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterTab>('all');
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);

  useEffect(() => {
    fetchDevOpsTickets();
  }, []);

  const fetchDevOpsTickets = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('tickets')
        .select('*, employee:profiles!employee_id(name, email, department)')
        .in('issue_type', ['Deployment Request', 'GitLab Access'])
        .order('created_at', { ascending: false });
      
       if (error) throw error;
      setTickets(data || []);

      // Prepare calendar events
      const events: CalendarEvent[] = (data || []).filter(t => t.sla_deadline && !['Resolved', 'Closed'].includes(t.status)).map(t => ({
        id: t.id,
        date: new Date(t.sla_deadline),
        title: `${t.issue_type === 'GitLab Access' ? '🦊' : '🚀'} ${t.title}`,
        type: 'ticket' as const,
        color: t.issue_type === 'GitLab Access' ? '#f97316' : '#8b5cf6'
      }));
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

  const filtered = tickets.filter(t => {
    const matchSearch = t.title?.toLowerCase().includes(search.toLowerCase()) ||
      t.id?.toLowerCase().includes(search.toLowerCase());
    
    switch (activeFilter) {
      case 'gitlab': return matchSearch && t.issue_type === 'GitLab Access';
      case 'deploy': return matchSearch && t.issue_type === 'Deployment Request';
      case 'pending': return matchSearch && !['Resolved', 'Closed'].includes(t.status);
      case 'completed': return matchSearch && ['Resolved', 'Closed'].includes(t.status);
      default: return matchSearch;
    }
  });

  const stats = [
    { label: 'Pending Deployments', value: tickets.filter(t => t.issue_type === 'Deployment Request' && !['Resolved', 'Closed'].includes(t.status)).length, icon: GitBranch, color: '#0ea5e9' },
    { label: 'Access Requests', value: tickets.filter(t => t.issue_type === 'GitLab Access' && !['Resolved', 'Closed'].includes(t.status)).length, icon: Shield, color: '#a855f7' },
    { label: 'Errors Reported', value: tickets.filter(t => t.custom_fields?.devops_status === 'Error').length, icon: AlertTriangle, color: '#ef4444' },
    { label: 'Completed', value: tickets.filter(t => ['Resolved', 'Closed'].includes(t.status)).length, icon: CheckCircle2, color: '#22c55e' },
  ];

  const filterTabs: { id: FilterTab; label: string; count: number }[] = [
    { id: 'all', label: 'All Requests', count: tickets.length },
    { id: 'gitlab', label: 'GitLab Access', count: tickets.filter(t => t.issue_type === 'GitLab Access').length },
    { id: 'deploy', label: 'Deployments', count: tickets.filter(t => t.issue_type === 'Deployment Request').length },
    { id: 'pending', label: 'Pending', count: tickets.filter(t => !['Resolved', 'Closed'].includes(t.status)).length },
    { id: 'completed', label: 'Completed', count: tickets.filter(t => ['Resolved', 'Closed'].includes(t.status)).length },
  ];

  return (
    <div style={{ minHeight: '100vh', background: DS.bg, padding: '32px', fontFamily: "'Inter', sans-serif" }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        
        {/* Contextual Awareness: System Health & Pipeline Monitor */}
        {/* Header - Minimal & Action Oriented */}
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: DS.primary, marginBottom: '4px' }}>
              <Terminal size={16} />
              <span style={{ fontSize: '0.65rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Infrastructure & CI/CD</span>
            </div>
            <h1 style={{ color: DS.text, fontSize: '2rem', fontWeight: 900, letterSpacing: '-0.04em', margin: 0 }}>DevOps Control</h1>
          </div>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <button onClick={fetchDevOpsTickets} style={{ width: '42px', height: '42px', borderRadius: '12px', background: DS.card, border: `1px solid ${DS.border}`, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: DS.muted }}>
              <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
        </header>

        {/* 📊 METRICS - Data Driven */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '24px' }}>
           <div style={{ background: DS.surface, border: `1px solid ${DS.border}`, borderRadius: '20px', padding: '16px', textAlign: 'center' }}>
              <p style={{ fontSize: '0.65rem', color: DS.muted, fontWeight: 800, textTransform: 'uppercase', marginBottom: '8px' }}>Total Requests</p>
              <p style={{ fontSize: '1.4rem', fontWeight: 900, color: DS.primary }}>{tickets.length}</p>
           </div>
           <div style={{ background: DS.surface, border: `1px solid ${DS.border}`, borderRadius: '20px', padding: '16px', textAlign: 'center' }}>
              <p style={{ fontSize: '0.65rem', color: DS.muted, fontWeight: 800, textTransform: 'uppercase', marginBottom: '8px' }}>Resolved</p>
              <p style={{ fontSize: '1.4rem', fontWeight: 900, color: DS.success }}>{tickets.filter(t => ['Resolved', 'Closed'].includes(t.status)).length}</p>
           </div>
           <div style={{ background: DS.surface, border: `1px solid ${DS.border}`, borderRadius: '20px', padding: '16px', textAlign: 'center' }}>
              <p style={{ fontSize: '0.65rem', color: DS.muted, fontWeight: 800, textTransform: 'uppercase', marginBottom: '8px' }}>In Progress</p>
              <p style={{ fontSize: '1.4rem', fontWeight: 900, color: DS.warning }}>{tickets.filter(t => t.status === 'In Progress').length}</p>
           </div>
           <div style={{ background: DS.surface, border: `1px solid ${DS.border}`, borderRadius: '20px', padding: '16px', textAlign: 'center' }}>
              <p style={{ fontSize: '0.65rem', color: DS.muted, fontWeight: 800, textTransform: 'uppercase', marginBottom: '8px' }}>Errors</p>
              <p style={{ fontSize: '1.4rem', fontWeight: 900, color: DS.danger }}>{tickets.filter(t => t.custom_fields?.devops_status === 'Error').length}</p>
           </div>
        </div>

        {/* 🔝 PRIORITY STRIP */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '40px' }}>
          <div style={{ background: 'linear-gradient(135deg, rgba(255,68,68,0.1) 0%, rgba(255,68,68,0.02) 100%)', border: '1px solid rgba(255,68,68,0.2)', borderRadius: '24px', padding: '24px', display: 'flex', alignItems: 'center', gap: '16px' }}>
             <div style={{ background: 'rgba(255,68,68,0.2)', padding: '12px', borderRadius: '12px' }}><ServerCrash color="#ff4444" size={24} /></div>
             <div>
               <p style={{ fontSize: '0.75rem', fontWeight: 800, color: '#ff4444', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>Failed Deployments</p>
               <h3 style={{ fontSize: '1.5rem', fontWeight: 900, color: DS.text, margin: 0 }}>{tickets.filter(t => t.custom_fields?.devops_status === 'Error' || t.custom_fields?.devops_status === 'Rejected').length}</h3>
             </div>
          </div>
          <div style={{ background: 'linear-gradient(135deg, rgba(255,184,110,0.1) 0%, rgba(255,184,110,0.02) 100%)', border: '1px solid rgba(255,184,110,0.2)', borderRadius: '24px', padding: '24px', display: 'flex', alignItems: 'center', gap: '16px' }}>
             <div style={{ background: 'rgba(255,184,110,0.2)', padding: '12px', borderRadius: '12px' }}><Clock color="#ffb86e" size={24} /></div>
             <div>
               <p style={{ fontSize: '0.75rem', fontWeight: 800, color: '#ffb86e', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>Pending Approvals</p>
               <h3 style={{ fontSize: '1.5rem', fontWeight: 900, color: DS.text, margin: 0 }}>{tickets.filter(t => t.status === 'Waiting for User').length}</h3>
             </div>
          </div>
          <div style={{ background: 'linear-gradient(135deg, rgba(14,165,233,0.1) 0%, rgba(14,165,233,0.02) 100%)', border: '1px solid rgba(14,165,233,0.2)', borderRadius: '24px', padding: '24px', display: 'flex', alignItems: 'center', gap: '16px' }}>
             <div style={{ background: 'rgba(14,165,233,0.2)', padding: '12px', borderRadius: '12px' }}><Key color="#0ea5e9" size={24} /></div>
             <div>
               <p style={{ fontSize: '0.75rem', fontWeight: 800, color: '#0ea5e9', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>Access Requests</p>
               <h3 style={{ fontSize: '1.5rem', fontWeight: 900, color: DS.text, margin: 0 }}>{tickets.filter(t => t.issue_type === 'GitLab Access' && t.status !== 'Resolved' && t.status !== 'Closed').length}</h3>
             </div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1.2fr', gap: '20px', marginBottom: '40px' }}>
           {/* 📅 UPCOMING SCHEDULE - half size */}
           <div style={{ background: DS.card, borderRadius: '16px', padding: '16px', border: `1px solid ${DS.border}` }}>
             <h3 style={{ fontSize: '0.8rem', fontWeight: 900, marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}><Clock size={14} color={DS.primary} /> Schedule</h3>
             <MiniCalendar events={calendarEvents} onDateClick={handleDateClick} />
           </div>

           {/* 📢 RECENT ACTIVITY - half size */}
           <div style={{ background: DS.card, borderRadius: '16px', padding: '16px', border: `1px solid ${DS.border}`, overflowY: 'auto', maxHeight: '420px' }}>
             <h3 style={{ fontSize: '0.8rem', fontWeight: 900, marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}><Activity size={14} color={DS.primary} /> Recent Activity</h3>
             <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
               {tickets.slice(0, 5).map(t => {
                 const isResolved = ['Resolved', 'Closed'].includes(t.status);
                 const isError = t.custom_fields?.devops_status === 'Error' || t.custom_fields?.devops_status === 'Rejected';
                 const dotColor = isResolved ? DS.success : isError ? DS.danger : DS.warning;
                 const statusLabel = t.custom_fields?.devops_status || t.status;
                 const statusColor = isResolved ? DS.success : isError ? DS.danger : DS.warning;
                 return (
                   <div key={t.id} onClick={() => navigate(`/tickets/${t.id}`)} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', cursor: 'pointer', padding: '8px', borderRadius: '10px', transition: 'all 0.2s' }} onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                     <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: dotColor, marginTop: '5px', flexShrink: 0, boxShadow: `0 0 6px ${dotColor}` }} />
                     <div style={{ flex: 1, minWidth: 0 }}>
                       <p style={{ fontSize: '0.78rem', fontWeight: 700, color: DS.text, marginBottom: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.title}</p>
                       <p style={{ fontSize: '0.65rem', color: DS.muted }}>{format(new Date(t.created_at), 'MMM do')} • {t.employee?.name || 'System'}</p>
                     </div>
                     <span style={{ fontSize: '0.6rem', color: statusColor, border: `1px solid ${statusColor}`, padding: '2px 5px', borderRadius: '5px', flexShrink: 0 }}>{statusLabel}</span>
                   </div>
                 );
               })}
               {tickets.length === 0 && <p style={{ fontSize: '0.75rem', color: DS.muted, fontStyle: 'italic' }}>No activity.</p>}
             </div>
           </div>

           {/* RIGHT: GitLab + Deployments */}
           <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* 🦊 GITLAB ACCESS */}
              <div style={{ background: DS.card, borderRadius: '16px', padding: '16px', border: `1px solid ${DS.border}` }}>
                <h3 style={{ fontSize: '0.8rem', fontWeight: 900, marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}><Key size={14} color="#f97316" /> GitLab Access</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {tickets.filter(t => t.issue_type === 'GitLab Access').slice(0, 3).map(t => (
                    <div key={t.id} onClick={() => navigate(`/tickets/${t.id}`)} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: DS.surface, padding: '10px 12px', borderRadius: '10px', border: `1px solid ${DS.border}`, cursor: 'pointer', transition: 'all 0.2s' }} onMouseEnter={e => e.currentTarget.style.borderColor = '#f97316'} onMouseLeave={e => e.currentTarget.style.borderColor = DS.border}>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <p style={{ fontSize: '0.78rem', fontWeight: 700, color: DS.text, marginBottom: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.title}</p>
                        <p style={{ fontSize: '0.65rem', color: DS.muted }}>{t.employee?.name || 'Unknown'} • {format(new Date(t.created_at), 'MMM do')}</p>
                      </div>
                      <DevOpsBadge status={t.custom_fields?.devops_status || t.status} />
                    </div>
                  ))}
                  {tickets.filter(t => t.issue_type === 'GitLab Access').length === 0 && <p style={{ fontSize: '0.75rem', color: DS.muted, fontStyle: 'italic' }}>No access requests.</p>}
                </div>
              </div>

              {/* 🚀 DEPLOYMENTS */}
              <div style={{ background: DS.card, borderRadius: '16px', padding: '16px', border: `1px solid ${DS.border}` }}>
                <h3 style={{ fontSize: '0.8rem', fontWeight: 900, marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}><GitBranch size={14} color="#8b5cf6" /> Deployments</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {tickets.filter(t => t.issue_type === 'Deployment Request').slice(0, 3).map(t => (
                    <div key={t.id} onClick={() => navigate(`/tickets/${t.id}`)} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: DS.surface, padding: '10px 12px', borderRadius: '10px', border: `1px solid ${DS.border}`, cursor: 'pointer', transition: 'all 0.2s' }} onMouseEnter={e => e.currentTarget.style.borderColor = '#8b5cf6'} onMouseLeave={e => e.currentTarget.style.borderColor = DS.border}>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <p style={{ fontSize: '0.78rem', fontWeight: 700, color: DS.text, marginBottom: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.title}</p>
                        <p style={{ fontSize: '0.65rem', color: DS.muted }}>{t.employee?.name || 'Unknown'} • {t.custom_fields?.environment || 'N/A'}</p>
                      </div>
                      <DevOpsBadge status={t.custom_fields?.devops_status || t.status} />
                    </div>
                  ))}
                  {tickets.filter(t => t.issue_type === 'Deployment Request').length === 0 && <p style={{ fontSize: '0.75rem', color: DS.muted, fontStyle: 'italic' }}>No deployments.</p>}
                </div>
              </div>
           </div>
        </div>


        {/* Filter Tabs */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
          {filterTabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveFilter(tab.id)}
              style={{
                padding: '8px 16px', borderRadius: '10px',
                background: activeFilter === tab.id ? 'rgba(14,165,233,0.15)' : 'transparent',
                border: `1px solid ${activeFilter === tab.id ? 'rgba(14,165,233,0.4)' : DS.border}`,
                color: activeFilter === tab.id ? '#89ceff' : DS.muted,
                fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s',
                display: 'flex', alignItems: 'center', gap: '6px',
              }}
            >
              {tab.label}
              <span style={{ background: activeFilter === tab.id ? 'rgba(14,165,233,0.3)' : 'rgba(255,255,255,0.06)', padding: '1px 7px', borderRadius: '6px', fontSize: '0.68rem' }}>{tab.count}</span>
            </button>
          ))}
        </div>

        {/* Search */}
        <div style={{ background: DS.card, borderRadius: '20px', border: `1px solid ${DS.border}`, padding: '16px', marginBottom: '24px', display: 'flex', gap: '12px' }}>
          <div style={{ flex: 1, background: DS.surface, border: `1px solid ${DS.border}`, borderRadius: '12px', display: 'flex', alignItems: 'center', padding: '0 16px' }}>
            <Search size={18} color={DS.muted} />
            <input 
              type="text" placeholder="Search by Ticket ID, title, or environment..."
              value={search} onChange={e => setSearch(e.target.value)}
              style={{ background: 'none', border: 'none', outline: 'none', color: DS.text, padding: '12px', width: '100%', fontSize: '0.9rem' }}
            />
          </div>
        </div>

        {/* Request Queue */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {filtered.map(ticket => (
              <motion.div 
                key={ticket.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                onClick={() => navigate(`/tickets/${ticket.id}`)}
                style={{ background: DS.card, borderRadius: '20px', border: `1px solid ${DS.border}`, padding: '24px', cursor: 'pointer', transition: 'all 0.2s' }}
                onMouseEnter={e => e.currentTarget.style.borderColor = DS.primary}
                onMouseLeave={e => e.currentTarget.style.borderColor = DS.border}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '0.65rem', fontWeight: 800, background: 'rgba(14,165,233,0.1)', color: DS.primary, padding: '4px 8px', borderRadius: '4px' }}>
                        #{ticket.id.substring(0,8).toUpperCase()}
                      </span>
                      <Badge status={ticket.status} />
                      <DevOpsBadge status={ticket.custom_fields?.devops_status} />
                      <span style={{ 
                        fontSize: '0.68rem', fontWeight: 700, 
                        color: ticket.issue_type === 'GitLab Access' ? '#a855f7' : DS.primary,
                        background: ticket.issue_type === 'GitLab Access' ? 'rgba(168,85,247,0.1)' : 'rgba(14,165,233,0.1)',
                        padding: '2px 8px', borderRadius: '6px',
                      }}>
                        {ticket.issue_type === 'GitLab Access' ? '🔑 GitLab Access' : '🚀 Deployment'}
                      </span>
                    </div>
                    <h4 style={{ color: DS.text, fontSize: '1.1rem', fontWeight: 700, marginBottom: '8px' }}>{ticket.title}</h4>
                    <div style={{ display: 'flex', gap: '16px', color: DS.muted, fontSize: '0.8rem', flexWrap: 'wrap' }}>
                      {(ticket.employee?.name || ticket.guest_name || 'Guest') !== (profile?.name || 'Guest User') && (
                        <span>By: {ticket.employee?.name || 'Guest'}</span>
                      )}
                      {ticket.employee?.department && (
                        <span>Dept: {ticket.employee.department}</span>
                      )}
                      {ticket.custom_fields?.target_environment && (
                        <span style={{ color: '#ffb86e', fontWeight: 700 }}>Env: {ticket.custom_fields.target_environment}</span>
                      )}
                      {ticket.custom_fields?.branch_tag_name && (
                        <span style={{ color: DS.primary }}>Branch: {ticket.custom_fields.branch_tag_name}</span>
                      )}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: ticket.priority === 'Critical' ? '#ff4444' : DS.muted, fontSize: '0.75rem', fontWeight: 700, marginBottom: '8px' }}>
                      <Clock size={14} /> {ticket.sla_deadline ? new Date(ticket.sla_deadline).toLocaleDateString() : 'No SLA'}
                    </div>
                    <ArrowUpRight size={20} color={DS.muted} />
                  </div>
                </div>
              </motion.div>
            ))}

            {filtered.length === 0 && (
              <div style={{ padding: '64px', textAlign: 'center', background: 'rgba(0,0,0,0.2)', borderRadius: '24px', border: `1px dashed ${DS.border}` }}>
                <CheckCircle2 size={48} color={DS.border} style={{ margin: '0 auto 16px' }} />
                <h3 style={{ color: DS.muted, fontWeight: 700 }}>
                  {activeFilter === 'all' ? 'No active deployment or access requests' : `No ${activeFilter} requests found`}
                </h3>
              </div>
            )}
          </div>
        {/* Activity Detail Drawer */}
        <Drawer
          isOpen={showDayModal}
          onClose={() => setShowDayModal(false)}
          title="Engineering Tasks"
          subtitle={selectedDate ? format(selectedDate, 'EEEE, MMMM do') : undefined}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {selectedDayEvents.map(event => (
              <div 
                key={event.id}
                onClick={() => {
                  navigate(`/tickets/${event.id}`);
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
                    Open Request <ChevronRight size={12} />
                  </span>
                </div>
              </div>
            ))}
          </div>
        </Drawer>
      </div>
    </div>
  );
};
