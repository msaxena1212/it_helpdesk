import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Plus, Search, Filter, ChevronRight, Ticket, CheckCircle2,
  Clock, AlertTriangle, TrendingUp, ArrowUpRight, RefreshCw
} from 'lucide-react';
import { useAuth } from '../lib/AuthContext';
import { supabase } from '../lib/supabase';

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
  const [tickets, setTickets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const name = user?.user_metadata?.name || user?.email?.split('@')[0] || 'User';

  useEffect(() => {
    fetchTickets();
  }, [user]);

  const fetchTickets = async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from('tickets')
      .select('*')
      .eq('created_by', user.id)
      .order('created_at', { ascending: false })
      .limit(20);
    setTickets(data || []);
    setLoading(false);
  };

  const filtered = tickets.filter(t =>
    t.title?.toLowerCase().includes(search.toLowerCase()) ||
    t.id?.toLowerCase().includes(search.toLowerCase())
  );

  const stats = [
    { label: 'Active Tickets', value: tickets.filter(t => ['open','in_progress'].includes(t.status)).length, icon: Ticket, color: '#0ea5e9', bg: 'rgba(14,165,233,0.12)' },
    { label: 'Resolved This Month', value: tickets.filter(t => t.status === 'resolved').length, icon: CheckCircle2, color: '#4ade80', bg: 'rgba(74,222,128,0.12)' },
    { label: 'In Progress', value: tickets.filter(t => t.status === 'in_progress').length, icon: Clock, color: '#ffb86e', bg: 'rgba(255,184,110,0.12)' },
  ];

  return (
    <div style={{ minHeight: '100vh', background: DS.bg, padding: '32px', fontFamily: "'Inter', sans-serif" }}>
      <div style={{ maxWidth: '1100px', margin: '0 auto' }}>

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
            <p style={{ color: DS.muted, fontSize: '0.875rem', marginTop: '4px' }}>Here's an overview of your active support requests.</p>
          </div>
          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
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
        </motion.div>

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '24px' }}>
          {stats.map((s, i) => (
            <motion.div
              key={s.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08 }}
              style={{
                background: DS.card, borderRadius: '16px', padding: '24px',
                border: `1px solid ${DS.border}`,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <p style={{ color: DS.muted, fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '8px' }}>{s.label}</p>
                  <h3 style={{ color: DS.text, fontSize: '2.25rem', fontWeight: 800, lineHeight: 1 }}>{loading ? '—' : s.value}</h3>
                </div>
                <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: s.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <s.icon size={20} color={s.color} />
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Tickets Table */}
        <div style={{ background: DS.card, borderRadius: '20px', border: `1px solid ${DS.border}`, overflow: 'hidden' }}>
          <div style={{ padding: '20px 24px', borderBottom: `1px solid ${DS.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h3 style={{ color: DS.text, fontWeight: 700, fontSize: '1rem' }}>My Support History</h3>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: DS.surface, border: `1px solid ${DS.border}`, borderRadius: '10px', padding: '8px 14px' }}>
                <Search size={14} color={DS.muted} />
                <input
                  type="text" placeholder="Search tickets..."
                  value={search} onChange={e => setSearch(e.target.value)}
                  style={{ background: 'none', border: 'none', outline: 'none', color: DS.text, fontSize: '0.8rem', width: '160px' }}
                />
              </div>
              <button onClick={fetchTickets} style={{ width: '36px', height: '36px', borderRadius: '10px', background: DS.surface, border: `1px solid ${DS.border}`, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: DS.muted }}>
                <RefreshCw size={14} />
              </button>
            </div>
          </div>

          {loading ? (
            <div style={{ padding: '48px', textAlign: 'center', color: DS.muted }}>Loading tickets...</div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: '64px', textAlign: 'center' }}>
              <Ticket size={48} color="rgba(14,165,233,0.3)" style={{ margin: '0 auto 16px' }} />
              <p style={{ color: DS.muted, fontWeight: 600 }}>No tickets found</p>
              <button
                onClick={() => navigate('/tickets/new')}
                style={{ marginTop: '16px', background: 'linear-gradient(135deg, #0ea5e9, #0284c7)', color: '#fff', border: 'none', borderRadius: '10px', padding: '10px 20px', cursor: 'pointer', fontWeight: 700, fontSize: '0.8rem' }}
              >
                Raise your first ticket
              </button>
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'rgba(14,165,233,0.04)' }}>
                  {['ID', 'Issue', 'Status', 'Priority', 'Raised', ''].map(h => (
                    <th key={h} style={{ padding: '12px 20px', textAlign: 'left', fontSize: '0.68rem', fontWeight: 700, color: DS.muted, letterSpacing: '0.08em', textTransform: 'uppercase' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((ticket, i) => (
                  <tr
                    key={ticket.id}
                    style={{ borderTop: `1px solid ${DS.border}`, cursor: 'pointer', transition: 'background 0.15s' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(14,165,233,0.04)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    onClick={() => navigate(`/tickets/${ticket.id}`)}
                  >
                    <td style={{ padding: '16px 20px' }}>
                      <span style={{ fontSize: '0.72rem', fontFamily: 'monospace', color: DS.muted, fontWeight: 700 }}>#{ticket.id?.substring(0, 8).toUpperCase()}</span>
                    </td>
                    <td style={{ padding: '16px 20px' }}>
                      <p style={{ color: DS.text, fontWeight: 600, fontSize: '0.875rem' }}>{ticket.title}</p>
                    </td>
                    <td style={{ padding: '16px 20px' }}><Badge status={ticket.status} /></td>
                    <td style={{ padding: '16px 20px' }}><PriorityDot priority={ticket.priority} /></td>
                    <td style={{ padding: '16px 20px', color: DS.muted, fontSize: '0.78rem' }}>
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
  );
};
