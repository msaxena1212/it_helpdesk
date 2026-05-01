import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { utils, write } from 'xlsx';
import {
  Search, Filter, ChevronRight, Ticket, RefreshCw, 
  Download, ArrowUpDown, FilterX
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/AuthContext';

const DS = {
  bg: '#0f172a', card: '#131b2e', cardHigh: '#222a3d',
  border: 'rgba(14,165,233,0.12)', primary: '#0ea5e9',
  text: '#dae2fd', muted: '#88929b', surface: '#0b1326',
};

const Badge = ({ status, customFields }: { status: string; customFields?: any }) => {
  const displayStatus = customFields?.devops_status || status;
  const map: Record<string, { bg: string; color: string }> = {
    'Open': { bg: 'rgba(14,165,233,0.15)', color: '#89ceff' },
    'Assigned': { bg: 'rgba(14,165,233,0.15)', color: '#89ceff' },
    'In Progress': { bg: 'rgba(255,184,110,0.15)', color: '#ffb86e' },
    'Waiting for User': { bg: 'rgba(255,184,110,0.15)', color: '#ffb86e' },
    'Resolved': { bg: 'rgba(74,222,128,0.15)', color: '#4ade80' },
    'Access Given': { bg: 'rgba(74,222,128,0.15)', color: '#4ade80' },
    'Deployed': { bg: 'rgba(74,222,128,0.15)', color: '#4ade80' },
    'Rejected': { bg: 'rgba(255,68,68,0.15)', color: '#ff4444' },
    'Error': { bg: 'rgba(255,68,68,0.15)', color: '#ff4444' },
    'Closed': { bg: 'rgba(136,146,155,0.15)', color: '#88929b' },
  };
  const s = map[displayStatus] || map['Open'];
  return (
    <span style={{
      ...s, padding: '2px 10px', borderRadius: '9999px',
      fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em',
    }}>
      {displayStatus?.replace('_', ' ')}
    </span>
  );
};

const EscalationBadge = ({ level }: { level: number }) => {
  if (!level) return null;
  return (
    <span style={{
      padding: '2px 8px', borderRadius: '6px',
      fontSize: '0.6rem', fontWeight: 800, 
      background: level >= 2 ? 'rgba(255,68,68,0.2)' : 'rgba(255,184,110,0.2)',
      color: level >= 2 ? '#ff4444' : '#ffb86e',
      marginLeft: '8px', border: `1px solid ${level >= 2 ? '#ff4444' : '#ffb86e'}33`
    }}>
      L{level} ESCALATED
    </span>
  );
};

export const TicketList = () => {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [tickets, setTickets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');

  useEffect(() => { 
    fetchTickets(); 
  }, [profile]);

  const fetchTickets = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('tickets')
      .select(`
        *,
        employee:profiles!employee_id(name, email, department),
        assigned:profiles!assigned_to(name)
      `)
      .order('created_at', { ascending: false });
    setTickets(data || []);
    setLoading(false);
  };

  const filtered = tickets.filter(t => {
    const matchSearch = t.title?.toLowerCase().includes(search.toLowerCase()) ||
      t.id?.toLowerCase().includes(search.toLowerCase()) ||
      t.status?.toLowerCase().includes(search.toLowerCase()) ||
      (t.employee?.name || t.guest_name || '')?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all' || t.status === statusFilter;
    const matchCategory = categoryFilter === 'all' || t.issue_type === categoryFilter;
    
    // Employee security: Only see own tickets unless admin/manager
    const isEmployee = profile?.role === 'employee';
    const matchUser = !isEmployee || t.employee_id === profile?.id;

    // DevOps security/relevance: only see devops-related tickets
    const isDevOps = profile?.role === 'devops';
    const matchDevOps = !isDevOps || ['Deployment Request', 'GitLab Access'].includes(t.issue_type);

    return matchSearch && matchStatus && matchCategory && matchUser && matchDevOps;
  });

  const loggedInName = profile?.name || user?.user_metadata?.name || user?.email?.split('@')[0] || '';
  const hideRequester = filtered.length > 0 && filtered.every(t => (t.employee?.name || t.guest_name || 'Guest') === loggedInName);

  const handleExportExcel = () => {
    const wb = utils.book_new();
    const rows = filtered.map(t => ({
      'Ticket ID': t.id.substring(0, 8).toUpperCase(),
      'Requester': t.employee?.name || t.guest_name || 'Guest',
      'Department': t.department || t.employee?.department || 'General',
      'Subject': t.title,
      'Issue Type': t.issue_type || 'Other',
      'Sub Type': t.sub_type || 'General',
      'Status': t.status,
      'Priority': t.priority,
      'SLA Breached': t.sla_breached ? 'YES' : 'No',
      'Escalation Level': t.escalation_level || 0,
      'Assigned To': t.assigned?.name || 'Unassigned',
      'Created At': new Date(t.created_at).toLocaleString(),
      'SLA Deadline': t.sla_deadline ? new Date(t.sla_deadline).toLocaleString() : 'N/A',
    }));

    const ws = utils.json_to_sheet(rows);
    utils.book_append_sheet(wb, ws, 'Tickets');

    const wbout = write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([wbout], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `ticket_export_${new Date().toISOString().split('T')[0]}.xlsx`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div style={{ minHeight: '100vh', background: DS.bg, padding: '32px', fontFamily: "'Inter', sans-serif" }}>
      <div style={{ maxWidth: '1400px', margin: '0 auto' }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '32px' }}>
          <div>
            <p style={{ color: DS.muted, fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '4px' }}>Operational View</p>
            <h1 style={{ color: DS.text, fontSize: '2rem', fontWeight: 800, letterSpacing: '-0.02em', marginBottom: '4px' }}>Ticket Management Hub</h1>
            <p style={{ color: DS.muted, fontSize: '0.875rem' }}>Browse, filter, and manage all organization support requests.</p>
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
             <button 
              onClick={handleExportExcel}
              style={{ padding: '10px 18px', borderRadius: '12px', background: DS.card, border: `1px solid ${DS.border}`, color: DS.text, fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
               <Download size={16} /> Export Excel
             </button>
             <button onClick={fetchTickets} style={{ width: '42px', height: '42px', borderRadius: '12px', background: DS.card, border: `1px solid ${DS.border}`, color: DS.muted, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
               <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
             </button>
          </div>
        </div>

        {/* Advanced Filter Bar */}
        <div style={{ background: DS.card, borderRadius: '20px', padding: '20px', border: `1px solid ${DS.border}`, marginBottom: '24px', display: 'flex', gap: '16px', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: DS.surface, border: `1px solid ${DS.border}`, borderRadius: '12px', padding: '10px 16px', flex: 1 }}>
            <Search size={16} color={DS.muted} />
            <input 
              type="text" placeholder="Search by ID, Subject, or Requester Name..." 
              value={search} onChange={e => setSearch(e.target.value)}
              style={{ background: 'none', border: 'none', outline: 'none', color: DS.text, fontSize: '0.875rem', width: '100%' }}
            />
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            {['all', 'Open', 'In Progress', 'Waiting for User', 'Resolved', 'Closed'].map(s => (
              <button 
                key={s} 
                onClick={() => setStatusFilter(s)}
                style={{ 
                  padding: '10px 16px', borderRadius: '10px', border: 'none', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer',
                  background: statusFilter === s ? 'rgba(14,165,233,0.15)' : 'transparent',
                  color: statusFilter === s ? DS.primary : DS.muted,
                }}
              >
                {s}
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: '8px', borderLeft: `1px solid ${DS.border}`, paddingLeft: '16px' }}>
            {['all', 'Hardware', 'Software', 'Deployment Request', 'GitLab Access']
              .filter(c => {
                if (profile?.role === 'devops') {
                  return ['all', 'Deployment Request', 'GitLab Access'].includes(c);
                }
                return true;
              })
              .map(c => (
                <button 
                  key={c} 
                  onClick={() => setCategoryFilter(c)}
                  style={{ 
                    padding: '10px 16px', borderRadius: '10px', border: 'none', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer',
                    background: categoryFilter === c ? 'rgba(14,165,233,0.15)' : 'transparent',
                    color: categoryFilter === c ? DS.primary : DS.muted,
                  }}
                >
                  {c === 'all' ? 'All Types' : c}
                </button>
              ))}
          </div>
        </div>

        {/* High Density Table */}
        <div style={{ background: DS.card, borderRadius: '24px', border: `1px solid ${DS.border}`, overflow: 'hidden', boxShadow: '0 12px 40px rgba(0,0,0,0.3)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'rgba(14,165,233,0.03)' }}>
                {['ID', ...(!hideRequester ? ['Requester'] : []), 'Subject', 'Status', 'Priority', 'Assigned To', 'Date'].map(h => (
                  <th key={h} style={{ padding: '16px 20px', textAlign: 'left', fontSize: '0.65rem', fontWeight: 800, color: DS.muted, textTransform: 'uppercase', letterSpacing: '0.1em' }}>{h}</th>
                ))}
                <th style={{ padding: '16px 20px' }}></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(t => (
                <tr 
                  key={t.id} 
                  onClick={() => navigate(`/tickets/${t.id}`)}
                  style={{ borderTop: `1px solid ${DS.border}`, cursor: 'pointer', transition: 'background 0.2s' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(14,165,233,0.03)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <td style={{ padding: '18px 20px' }}>
                    <span style={{ fontFamily: 'monospace', fontSize: '0.75rem', fontWeight: 700, color: DS.primary }}>#{t.id.substring(0,8).toUpperCase()}</span>
                  </td>
                  {!hideRequester && (
                    <td style={{ padding: '18px 20px' }}>
                      <p style={{ fontSize: '0.85rem', fontWeight: 700, color: DS.text }}>{t.employee?.name || t.guest_name || 'Guest'}</p>
                      <p style={{ fontSize: '0.7rem', color: DS.muted }}>{t.department || t.employee?.department || (t.guest_name ? 'External' : 'Unknown')}</p>
                    </td>
                  )}
                  <td style={{ padding: '18px 20px', maxWidth: '300px' }}>
                    <p style={{ fontSize: '0.875rem', fontWeight: 600, color: DS.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.title}</p>
                    <p style={{ fontSize: '0.7rem', color: DS.muted, textTransform: 'capitalize' }}>{t.issue_type} • {t.sub_type || 'General'}</p>
                  </td>
                  <td style={{ padding: '18px 20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      <Badge status={t.status} customFields={t.custom_fields} />
                      <EscalationBadge level={t.escalation_level} />
                    </div>
                  </td>
                  <td style={{ padding: '18px 20px' }}>
                    <span style={{ 
                      fontSize: '0.7rem', fontWeight: 800, 
                      color: t.priority === 'Critical' ? '#ff4444' : t.priority === 'High' ? '#ffb86e' : DS.muted 
                    }}>
                      {t.priority}
                    </span>
                  </td>
                  <td style={{ padding: '18px 20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: t.assigned?.name ? DS.text : DS.muted, fontSize: '0.8rem', fontWeight: 600 }}>
                      <div style={{ width: '24px', height: '24px', borderRadius: '6px', background: t.assigned?.name ? 'rgba(14,165,233,0.1)' : 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px' }}>
                        {t.assigned?.name?.[0] || '?'}
                      </div>
                      {t.assigned?.name || 'Unassigned'}
                    </div>
                  </td>
                  <td style={{ padding: '18px 20px', color: DS.muted, fontSize: '0.8rem' }}>
                    {new Date(t.created_at).toLocaleDateString()}
                  </td>
                  <td style={{ padding: '18px 20px', textAlign: 'right' }}>
                    <ChevronRight size={18} color={DS.muted} />
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && !loading && (
                <tr>
                  <td colSpan={8} style={{ padding: '80px', textAlign: 'center' }}>
                    <FilterX size={48} color="rgba(14,165,233,0.1)" style={{ margin: '0 auto 16px' }} />
                    <p style={{ color: DS.muted, fontWeight: 600 }}>No tickets found matching your current filters.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
