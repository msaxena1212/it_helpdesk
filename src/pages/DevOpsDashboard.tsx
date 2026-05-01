import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Terminal, Shield, GitBranch, Cpu, Search, 
  RefreshCw, CheckCircle2, Clock, AlertTriangle, 
  ChevronRight, ArrowUpRight, Activity, AlertCircle, X, Filter
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';
import { CalendarView, MiniCalendar, CalendarEvent } from '../components/CalendarView';
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
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 280px', gap: '20px', marginBottom: '32px' }}>
          <div style={{ background: DS.card, borderRadius: '24px', padding: '24px', border: `1px solid ${DS.border}`, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '16px' }}>
            <div>
              <h3 style={{ fontSize: '0.75rem', fontWeight: 800, color: DS.text, textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px', letterSpacing: '0.05em' }}>
                <Cpu size={16} color={DS.primary} /> Infrastructure Pulse
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
                {[
                  { label: 'GitLab', status: 'Operational', color: '#22c55e' },
                  { label: 'AWS Prod', status: 'Healthy', color: '#22c55e' },
                  { label: 'K8s Cluster', status: 'Optimal', color: '#22c55e' }
                ].map(sys => (
                  <div key={sys.label} style={{ background: DS.surface, padding: '12px 8px', borderRadius: '16px', border: `1px solid ${DS.border}` }}>
                    <p style={{ fontSize: '0.6rem', color: DS.muted, textTransform: 'uppercase', fontWeight: 800 }}>{sys.label}</p>
                    <p style={{ fontSize: '0.8rem', color: sys.color, fontWeight: 700 }}>{sys.status}</p>
                  </div>
                ))}
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

          <div style={{ background: 'rgba(14,165,233,0.03)', borderRadius: '24px', padding: '24px', border: `1px solid ${DS.border}`, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <h3 style={{ fontSize: '0.75rem', fontWeight: 800, color: DS.text, textTransform: 'uppercase', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '10px', letterSpacing: '0.05em' }}>
              <GitBranch size={16} /> Active Pipeline
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#22c55e', boxShadow: '0 0 8px #22c55e' }} />
                <span style={{ fontSize: '0.8rem', color: DS.text }}>prod-frontend-sync: <b style={{ color: '#22c55e' }}>Success</b></span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: DS.primary, animation: 'pulse 1.5s infinite' }} />
                <span style={{ fontSize: '0.8rem', color: DS.text }}>api-v2-deploy: <b style={{ color: DS.primary }}>In Transit</b></span>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'stretch' }}>
            <MiniCalendar events={calendarEvents} />
          </div>
        </div>

        {/* Header */}
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: DS.primary, marginBottom: '4px' }}>
              <Terminal size={16} />
              <span style={{ fontSize: '0.65rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Infrastructure Operations</span>
            </div>
            <h1 style={{ color: DS.text, fontSize: '1.75rem', fontWeight: 800, letterSpacing: '-0.02em', margin: 0 }}>DevOps Control</h1>
            <p style={{ color: DS.muted, fontSize: '0.85rem', marginTop: '4px' }}>Manage deployments and access requests.</p>
          </div>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <button onClick={fetchDevOpsTickets} style={{ width: '42px', height: '42px', borderRadius: '12px', background: DS.card, border: `1px solid ${DS.border}`, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: DS.muted }}>
              <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
        </header>

        {/* Stats Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '32px' }}>
          {stats.map((s, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              style={{ background: DS.card, borderRadius: '20px', padding: '24px', border: `1px solid ${DS.border}`, position: 'relative', overflow: 'hidden' }}
            >
              <div style={{ position: 'absolute', top: '-10px', right: '-10px', opacity: 0.05 }}>
                <s.icon size={80} color={s.color} />
              </div>
              <p style={{ color: DS.muted, fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', marginBottom: '12px' }}>{s.label}</p>
              <h3 style={{ color: DS.text, fontSize: '2.25rem', fontWeight: 800 }}>{s.value}</h3>
            </motion.div>
          ))}
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
                      {(ticket.employee?.name || ticket.guest_name || 'Guest') !== (profile?.name || user?.user_metadata?.name || user?.email?.split('@')[0]) && (
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
      </div>
    </div>
  );
};
