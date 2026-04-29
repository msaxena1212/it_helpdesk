import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Terminal, Shield, GitBranch, Cpu, Search, 
  RefreshCw, CheckCircle2, Clock, AlertTriangle, 
  ChevronRight, ArrowUpRight, Activity
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';

const DS = {
  bg: '#0f172a', card: '#131b2e', cardHigh: '#222a3d',
  border: 'rgba(14,165,233,0.12)', primary: '#0ea5e9',
  text: '#dae2fd', muted: '#88929b', surface: '#0b1326',
};

const Badge = ({ status }: { status: string }) => {
  const map: Record<string, { bg: string; color: string }> = {
    'Open': { bg: 'rgba(14,165,233,0.15)', color: '#89ceff' },
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

export const DevOpsDashboard = () => {
  const navigate = useNavigate();
  const [tickets, setTickets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

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
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const filtered = tickets.filter(t => 
    t.title?.toLowerCase().includes(search.toLowerCase()) ||
    t.id?.toLowerCase().includes(search.toLowerCase())
  );

  const stats = [
    { label: 'Pending Deployments', value: tickets.filter(t => t.issue_type === 'Deployment Request' && t.status !== 'Resolved').length, icon: GitBranch, color: '#0ea5e9' },
    { label: 'Access Requests', value: tickets.filter(t => t.issue_type === 'GitLab Access' && t.status !== 'Resolved').length, icon: Shield, color: '#a855f7' },
    { label: 'SLA Breached', value: tickets.filter(t => t.sla_deadline && new Date(t.sla_deadline) < new Date() && t.status !== 'Resolved').length, icon: AlertTriangle, color: '#ef4444' },
    { label: 'Active Pipeline', value: tickets.filter(t => t.status === 'In Progress').length, icon: Activity, color: '#22c55e' },
  ];

  return (
    <div style={{ minHeight: '100vh', background: DS.bg, padding: '32px', fontFamily: "'Inter', sans-serif" }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        
        {/* Contextual Awareness: System Health & Pipeline Monitor */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '24px', marginBottom: '32px' }}>
          <div style={{ background: DS.card, borderRadius: '24px', padding: '24px', border: `1px solid ${DS.border}`, display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <h3 style={{ fontSize: '0.875rem', fontWeight: 800, color: DS.text, textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Cpu size={18} color={DS.primary} /> Infrastructure Pulse
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
              {[
                { label: 'GitLab', status: 'Operational', color: '#22c55e' },
                { label: 'AWS Prod', status: 'Healthy', color: '#22c55e' },
                { label: 'K8s Cluster', status: 'Optimal', color: '#22c55e' }
              ].map(sys => (
                <div key={sys.label} style={{ background: DS.surface, padding: '12px', borderRadius: '14px', border: `1px solid ${DS.border}` }}>
                  <p style={{ fontSize: '0.65rem', color: DS.muted, textTransform: 'uppercase', fontWeight: 800 }}>{sys.label}</p>
                  <p style={{ fontSize: '0.85rem', color: sys.color, fontWeight: 700 }}>{sys.status}</p>
                </div>
              ))}
            </div>
          </div>

          <div style={{ background: 'rgba(14,165,233,0.03)', borderRadius: '24px', padding: '24px', border: `1px solid ${DS.border}` }}>
            <h3 style={{ fontSize: '0.875rem', fontWeight: 800, color: DS.text, textTransform: 'uppercase', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <GitBranch size={18} /> Active Pipeline
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#22c55e', boxShadow: '0 0 8px #22c55e' }} />
                <span style={{ fontSize: '0.85rem', color: DS.text }}>prod-frontend-sync: <b style={{ color: '#22c55e' }}>Success</b></span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: DS.primary, animation: 'pulse 1.5s infinite' }} />
                <span style={{ fontSize: '0.85rem', color: DS.text }}>api-v2-deploy: <b style={{ color: DS.primary }}>In Transit</b></span>
              </div>
            </div>
          </div>
        </div>

        {/* Header */}
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: DS.primary, marginBottom: '4px' }}>
              <Terminal size={18} />
              <span style={{ fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Infrastructure Operations</span>
            </div>
            <h1 style={{ color: DS.text, fontSize: '2rem', fontWeight: 800, letterSpacing: '-0.02em' }}>DevOps Control Center</h1>
          </div>
          <button onClick={fetchDevOpsTickets} style={{ padding: '10px', borderRadius: '12px', background: DS.card, border: `1px solid ${DS.border}`, color: DS.muted, cursor: 'pointer' }}>
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
          </button>
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

        {/* Content Tabs / Filter */}
        <div style={{ background: DS.card, borderRadius: '20px', border: `1px solid ${DS.border}`, padding: '16px', marginBottom: '24px', display: 'flex', gap: '12px' }}>
          <div style={{ flex: 1, background: DS.surface, border: `1px solid ${DS.border}`, borderRadius: '12px', display: 'flex', alignItems: 'center', padding: '0 16px' }}>
            <Search size={18} color={DS.muted} />
            <input 
              type="text" placeholder="Search by Ticket ID or environment..."
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
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                    <span style={{ fontSize: '0.65rem', fontWeight: 800, background: 'rgba(14,165,233,0.1)', color: DS.primary, padding: '4px 8px', borderRadius: '4px' }}>
                      #{ticket.id.substring(0,8).toUpperCase()}
                    </span>
                    <Badge status={ticket.status} />
                    <span style={{ fontSize: '0.75rem', color: DS.muted }}>• {ticket.issue_type}</span>
                  </div>
                  <h4 style={{ color: DS.text, fontSize: '1.1rem', fontWeight: 700, marginBottom: '4px' }}>{ticket.title}</h4>
                  <div style={{ display: 'flex', gap: '16px', color: DS.muted, fontSize: '0.8rem' }}>
                    <span>By: {ticket.employee?.name}</span>
                    {ticket.custom_fields?.target_environment && (
                      <span style={{ color: '#ffb86e', fontWeight: 700 }}>Env: {ticket.custom_fields.target_environment}</span>
                    )}
                    {ticket.custom_fields?.branch_tag_name && (
                      <span style={{ color: DS.primary }}>Branch: {ticket.custom_fields.branch_tag_name}</span>
                    )}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
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
              <h3 style={{ color: DS.muted, fontWeight: 700 }}>No active deployment or access requests</h3>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
