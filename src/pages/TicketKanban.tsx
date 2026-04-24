import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Search, Plus, Clock, Loader2, GripVertical, RefreshCw } from 'lucide-react';
import { getTickets, updateStatus } from '../lib/api';
import { formatDistanceToNow } from 'date-fns';

const DS = {
  bg: '#0f172a', card: '#131b2e', cardHigh: '#222a3d',
  border: 'rgba(14,165,233,0.12)', primary: '#0ea5e9',
  text: '#dae2fd', muted: '#88929b', surface: '#0b1326',
};

const columns = [
  { id: 'Open', title: 'New / Open', dotColor: '#0ea5e9', headerBg: 'rgba(14,165,233,0.08)' },
  { id: 'In Progress', title: 'In Progress', dotColor: '#ffb86e', headerBg: 'rgba(255,184,110,0.08)' },
  { id: 'Waiting for User', title: 'Waiting', dotColor: '#c084fc', headerBg: 'rgba(192,132,252,0.08)' },
  { id: 'Resolved', title: 'Resolved', dotColor: '#4ade80', headerBg: 'rgba(74,222,128,0.08)' },
];

const PriorityBadge = ({ priority }: { priority: string }) => {
  const map: Record<string, { bg: string; color: string }> = {
    critical: { bg: 'rgba(255,68,68,0.15)', color: '#ff4444' },
    high: { bg: 'rgba(255,184,110,0.15)', color: '#ffb86e' },
    medium: { bg: 'rgba(14,165,233,0.15)', color: '#89ceff' },
    low: { bg: 'rgba(74,222,128,0.15)', color: '#4ade80' },
  };
  const s = map[priority?.toLowerCase()] || map['medium'];
  return (
    <span style={{ ...s, padding: '2px 8px', borderRadius: '9999px', fontSize: '0.6rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
      {priority}
    </span>
  );
};

export const TicketKanban = () => {
  const navigate = useNavigate();
  const [tickets, setTickets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => { fetchTickets(); }, []);

  const fetchTickets = async () => {
    setLoading(true);
    try {
      const data = await getTickets();
      setTickets(data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleDragStart = (e: React.DragEvent, ticketId: string, currentStatus: string) => {
    e.dataTransfer.setData('ticketId', ticketId);
    e.dataTransfer.setData('currentStatus', currentStatus);
    (e.currentTarget as HTMLElement).style.opacity = '0.5';
  };

  const handleDragEnd = (e: React.DragEvent) => {
    (e.currentTarget as HTMLElement).style.opacity = '1';
  };

  const handleDrop = async (e: React.DragEvent, targetStatus: string) => {
    e.preventDefault();
    const ticketId = e.dataTransfer.getData('ticketId');
    const currentStatus = e.dataTransfer.getData('currentStatus');
    if (currentStatus === targetStatus) return;
    setTickets(prev => prev.map(t => t.id === ticketId ? { ...t, status: targetStatus } : t));
    try {
      await updateStatus(ticketId, currentStatus, targetStatus);
    } catch {
      fetchTickets();
    }
  };

  const filtered = (status: string) =>
    tickets.filter(t => t.status === status && (
      !search || t.title?.toLowerCase().includes(search.toLowerCase())
    ));

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: DS.bg, fontFamily: "'Inter', sans-serif", overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ padding: '24px 32px', borderBottom: `1px solid ${DS.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: DS.card, flexShrink: 0 }}>
        <div>
          <p style={{ color: DS.muted, fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '2px' }}>Workflow</p>
          <h2 style={{ color: DS.text, fontSize: '1.5rem', fontWeight: 800, letterSpacing: '-0.01em', margin: 0 }}>Ticket Pipeline</h2>
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: DS.surface, border: `1px solid ${DS.border}`, borderRadius: '10px', padding: '9px 14px' }}>
            <Search size={14} color={DS.muted} />
            <input
              type="text" placeholder="Filter board..."
              value={search} onChange={e => setSearch(e.target.value)}
              style={{ background: 'none', border: 'none', outline: 'none', color: DS.text, fontSize: '0.8rem', width: '160px' }}
            />
          </div>
          <button onClick={fetchTickets} style={{ width: '40px', height: '40px', borderRadius: '10px', background: DS.surface, border: `1px solid ${DS.border}`, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: DS.muted }}>
            <RefreshCw size={14} />
          </button>
          <motion.button
            whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
            onClick={() => navigate('/tickets/new')}
            style={{
              background: 'linear-gradient(135deg, #0ea5e9, #0284c7)',
              color: '#fff', border: 'none', borderRadius: '10px',
              padding: '10px 18px', fontWeight: 700, fontSize: '0.8rem',
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '7px',
              boxShadow: '0 6px 16px rgba(14,165,233,0.3)',
            }}
          >
            <Plus size={16} /> New Ticket
          </motion.button>
        </div>
      </div>

      {/* Board */}
      <div style={{ flex: 1, overflowX: 'auto', padding: '24px 32px' }}>
        <div style={{ display: 'flex', gap: '16px', height: '100%', minWidth: 'max-content' }}>
          {columns.map(col => {
            const colTickets = filtered(col.id);
            return (
              <div key={col.id} style={{ width: '300px', display: 'flex', flexDirection: 'column', gap: '12px', height: '100%' }}>
                {/* Column Header */}
                <div style={{ padding: '12px 16px', borderRadius: '12px', background: col.headerBg, border: `1px solid rgba(255,255,255,0.05)`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: col.dotColor }} />
                    <span style={{ color: DS.text, fontWeight: 700, fontSize: '0.85rem' }}>{col.title}</span>
                  </div>
                  <span style={{ background: 'rgba(255,255,255,0.08)', color: DS.muted, fontSize: '0.7rem', fontWeight: 700, padding: '2px 8px', borderRadius: '99px' }}>
                    {colTickets.length}
                  </span>
                </div>

                {/* Drop Zone with internal scroll */}
                <div
                  onDragOver={e => { e.preventDefault(); (e.currentTarget as HTMLElement).style.background = 'rgba(14,165,233,0.06)'; }}
                  onDragLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                  onDrop={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; handleDrop(e, col.id); }}
                  style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '10px', overflowY: 'auto', padding: '4px', borderRadius: '12px', transition: 'background 0.15s', minHeight: 0 }}
                >
                  {loading ? (
                    <div style={{ display: 'flex', justifyContent: 'center', padding: '24px' }}>
                      <Loader2 size={24} className="animate-spin" color={DS.muted} />
                    </div>
                  ) : colTickets.length === 0 ? (
                    <div style={{ flex: 1, border: `2px dashed rgba(14,165,233,0.15)`, borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: DS.muted, fontSize: '0.75rem', fontWeight: 600, minHeight: '100px' }}>
                      Drop here
                    </div>
                  ) : (
                    colTickets.map(ticket => (
                      <motion.div
                        key={ticket.id}
                        layoutId={ticket.id}
                        draggable
                        onDragStart={e => handleDragStart(e as any, ticket.id, ticket.status)}
                        onDragEnd={handleDragEnd as any}
                        whileHover={{ y: -2 }}
                        onClick={() => navigate(`/tickets/${ticket.id}`)}
                        style={{
                          background: DS.card, borderRadius: '14px', padding: '16px',
                          border: `1px solid ${DS.border}`, cursor: 'grab',
                          transition: 'box-shadow 0.2s',
                          boxShadow: '0 2px 12px rgba(0,0,0,0.2)',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                          <PriorityBadge priority={ticket.priority} />
                          <span style={{ fontSize: '0.65rem', fontFamily: 'monospace', color: DS.muted, fontWeight: 700 }}>
                            #{ticket.id?.substring(0, 6).toUpperCase()}
                          </span>
                        </div>
                        <h5 style={{ color: DS.text, fontWeight: 700, fontSize: '0.875rem', lineHeight: 1.4, marginBottom: '14px' }}>
                          {ticket.title}
                        </h5>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '12px', borderTop: `1px solid rgba(255,255,255,0.04)` }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <div style={{ width: '24px', height: '24px', borderRadius: '8px', background: 'linear-gradient(135deg, #0ea5e9, #1e3a5f)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '9px', fontWeight: 800 }}>
                              {ticket.issue_type?.[0]?.toUpperCase() || 'T'}
                            </div>
                            <span style={{ color: DS.muted, fontSize: '0.7rem', textTransform: 'capitalize' }}>{ticket.issue_type || 'General'}</span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: DS.muted }}>
                            <Clock size={11} />
                            <span style={{ fontSize: '0.68rem', fontWeight: 600 }}>
                              {ticket.created_at ? formatDistanceToNow(new Date(ticket.created_at), { addSuffix: true }) : '—'}
                            </span>
                          </div>
                        </div>
                      </motion.div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
