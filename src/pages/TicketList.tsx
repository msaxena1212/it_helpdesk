import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { utils, write } from 'xlsx';
import {
  Search, Filter, ChevronRight, Ticket, RefreshCw, 
  Download, ArrowUpDown, FilterX, X
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
  const [searchParams, setSearchParams] = useSearchParams();
  const searchInputRef = useRef<HTMLInputElement>(null);
  
  const [tickets, setTickets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') || '');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [searchFocused, setSearchFocused] = useState(false);
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);

  useEffect(() => {
    const s = searchParams.get('status');
    if (s && s !== statusFilter) setStatusFilter(s);
    const q = searchParams.get('search');
    if (q && q !== search) setSearch(q);
  }, [searchParams]);

  const handleStatusChange = (s: string) => {
    setStatusFilter(s);
    setSearchParams(prev => {
      if (s === 'all') prev.delete('status');
      else prev.set('status', s);
      return prev;
    }, { replace: true });
  };

  const handleSearchChange = (q: string) => {
    setSearch(q);
    setSearchParams(prev => {
      if (!q) prev.delete('search');
      else prev.set('search', q);
      return prev;
    }, { replace: true });
  };

  useEffect(() => { 
    if (profile) {
      if (!statusFilter) setStatusFilter('all');
      
      if (profile.role === 'employee') {
        setTimeout(() => {
          if (searchInputRef.current) searchInputRef.current.focus();
        }, 100);
      }
      fetchTickets(); 
    }
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
    const searchLower = search.toLowerCase();
    const matchSearch = t.title?.toLowerCase().includes(searchLower) ||
      t.id?.toLowerCase().includes(searchLower) ||
      t.status?.toLowerCase().includes(searchLower) ||
      (t.employee?.name || t.guest_name || '')?.toLowerCase().includes(searchLower);
    
    const isEmployee = profile?.role === 'employee';
    const matchUser = !isEmployee || t.employee_id === profile?.id;

    const isDevOps = profile?.role === 'devops';
    const matchDevOps = !isDevOps || ['Deployment Request', 'GitLab Access'].includes(t.issue_type);

    const isInventory = profile?.role === 'inventory_manager';
    const matchInventory = !isInventory || t.status === 'Waiting for Inventory' || t.procurement_status != null || t.issue_type === 'Asset Request';

    let matchStatus = true;
    if (isEmployee) {
       const displayStatus = t.custom_fields?.devops_status || t.status;
       if (statusFilter === 'Active') {
          matchStatus = ['Open', 'In Progress', 'Assigned'].includes(displayStatus) || ['Open', 'In Progress', 'Assigned'].includes(t.status);
       } else if (statusFilter === 'Waiting') {
          matchStatus = ['Waiting for User', 'Waiting for Inventory'].includes(t.status);
       } else if (statusFilter === 'Resolved') {
          matchStatus = ['Resolved', 'Closed', 'Access Given', 'Deployed', 'Rejected', 'Error'].includes(displayStatus);
       } else {
          matchStatus = true;
       }
    } else {
       matchStatus = statusFilter === 'all' || t.status === statusFilter;
    }

    const matchCategory = categoryFilter === 'all' || t.issue_type === categoryFilter;
    
    return matchSearch && matchStatus && matchCategory && matchUser && matchDevOps && matchInventory;
  });

  const isEmployee = profile?.role === 'employee';

  if (isEmployee) {
    filtered.sort((a, b) => {
      const dateA = new Date(a.updated_at || a.created_at).getTime();
      const dateB = new Date(b.updated_at || b.created_at).getTime();
      return dateB - dateA;
    });
  }

  const loggedInName = profile?.name || '';
  const hideRequester = filtered.length > 0 && filtered.every(t => (t.employee?.name || t.guest_name || 'Guest') === loggedInName);
  
  const openAccessRequests = tickets.filter(t => t.issue_type === 'GitLab Access' && t.status === 'Open').length;

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
    <div style={{ minHeight: '100vh', background: DS.bg, padding: '32px 24px', fontFamily: "'Inter', sans-serif" }}>
      <div style={{ maxWidth: '1400px', width: '100%', margin: '0 auto' }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: isEmployee ? 'center' : 'flex-end', marginBottom: '32px' }}>
          <div>
            {!isEmployee && <p style={{ color: DS.muted, fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '4px' }}>Operational View</p>}
            <h1 style={{ color: DS.text, fontSize: '2rem', fontWeight: 800, letterSpacing: '-0.02em', margin: 0, marginBottom: !isEmployee ? '4px' : '0' }}>{isEmployee ? 'My Requests' : 'Ticket Management Hub'}</h1>
            {!isEmployee && <p style={{ color: DS.muted, fontSize: '0.875rem' }}>Browse, filter, and manage all organization support requests.</p>}
          </div>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            {!isEmployee && (
              <button 
                onClick={handleExportExcel}
                style={{ padding: '10px 18px', borderRadius: '12px', background: DS.cardHigh, border: `1px solid ${DS.border}`, color: DS.text, fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Download size={16} /> Export Excel
              </button>
            )}
            <button onClick={fetchTickets} style={{ width: '42px', height: '42px', borderRadius: '12px', background: DS.cardHigh, border: `1px solid ${DS.border}`, color: DS.muted, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>

        {/* HERO SEARCH */}
        <div style={{ position: 'relative', marginBottom: '24px' }}>
          <div style={{ background: DS.card, border: `2px solid ${searchFocused ? DS.primary : DS.border}`, borderRadius: '16px', padding: '16px 20px', display: 'flex', gap: '16px', alignItems: 'center', transition: 'border-color 0.2s', boxShadow: searchFocused ? `0 0 0 4px ${DS.primary}33` : 'none' }}>
             <Search size={24} color={searchFocused ? DS.primary : DS.muted} />
             <input 
                ref={searchInputRef}
                type="text" placeholder={isEmployee ? "Search your requests (e.g. VPN, GitLab, Laptop)..." : "Search by ID, Subject, or Requester Name..."} 
                value={search} onChange={e => handleSearchChange(e.target.value)}
                onFocus={() => setSearchFocused(true)}
                onBlur={() => setTimeout(() => setSearchFocused(false), 200)}
                style={{ background: 'none', border: 'none', outline: 'none', color: DS.text, fontSize: '1.1rem', width: '100%', fontWeight: 500 }}
             />
             {search && (
               <button onClick={() => handleSearchChange('')} style={{ background: 'none', border: 'none', color: DS.muted, cursor: 'pointer', padding: '4px' }}>
                 <X size={18} />
               </button>
             )}
           </div>
        </div>

        {/* COMBINED FILTERS */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: '8px', background: DS.surface, padding: '6px', borderRadius: '16px', border: `1px solid ${DS.border}` }}>
            {(isEmployee ? ['All', 'Active', 'Waiting', 'Resolved'] : ['all', 'Open', 'In Progress', 'Waiting for User', 'Resolved', 'Closed']).map(s => {
              const isActive = (s === 'All' && statusFilter === 'all') || s === statusFilter;
              return (
                <button
                  key={s}
                  onClick={() => handleStatusChange(s === 'All' ? 'all' : s)}
                  style={{ 
                    padding: '10px 20px', borderRadius: '12px', border: 'none', fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap', transition: 'all 0.2s',
                    background: isActive ? DS.primary : 'transparent',
                    color: isActive ? '#fff' : DS.muted,
                  }}
                >
                  {s === 'all' ? 'All' : s}
                </button>
              )
            })}
          </div>

          {/* Optional Category Dropdown */}
          <div style={{ position: 'relative', marginLeft: 'auto' }}>
            <button onClick={() => setShowCategoryDropdown(!showCategoryDropdown)} style={{ background: DS.surface, border: `1px solid ${DS.border}`, borderRadius: '12px', padding: '10px 16px', color: DS.text, fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
              Filter: {categoryFilter === 'all' ? 'All Requests' : categoryFilter} ▼
            </button>
            {showCategoryDropdown && (
              <div style={{ position: 'absolute', top: 'calc(100% + 8px)', right: 0, background: DS.cardHigh, border: `1px solid ${DS.border}`, borderRadius: '12px', padding: '8px', zIndex: 50, width: '200px', boxShadow: '0 10px 30px rgba(0,0,0,0.5)' }}>
                {['all', 'Hardware', 'Software', 'Asset Request', 'Deployment Request', 'GitLab Access', 'HR / Payroll'].filter(c => {
                  if (profile?.role === 'devops') return ['all', 'Deployment Request', 'GitLab Access'].includes(c);
                  return true;
                }).map(c => (
                  <button key={c} onClick={() => { setCategoryFilter(c); setShowCategoryDropdown(false); }} style={{ display: 'block', width: '100%', textAlign: 'left', background: categoryFilter === c ? DS.primary : 'transparent', color: categoryFilter === c ? '#fff' : DS.text, border: 'none', padding: '10px 12px', borderRadius: '8px', fontSize: '0.85rem', cursor: 'pointer' }}>
                    {c === 'all' ? 'All Types' : c}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* QUICK FILTER CHIPS */}
        {(statusFilter !== 'all' || categoryFilter !== 'all' || search) && (
           <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px', fontSize: '0.85rem', color: DS.muted, fontWeight: 600 }}>
             <span>Showing:</span>
             <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
               {(statusFilter !== 'all') && <span style={{ background: DS.surface, border: `1px solid ${DS.border}`, padding: '4px 12px', borderRadius: '99px', color: DS.text }}>{statusFilter === 'all' ? 'All' : statusFilter}</span>}
               {categoryFilter !== 'all' && <span style={{ background: DS.surface, border: `1px solid ${DS.border}`, padding: '4px 12px', borderRadius: '99px', color: DS.text }}>{categoryFilter}</span>}
               {search && <span style={{ background: DS.surface, border: `1px solid ${DS.border}`, padding: '4px 12px', borderRadius: '99px', color: DS.text }}>"{search}"</span>}
             </div>
             <button onClick={() => { handleStatusChange('all'); setCategoryFilter('all'); handleSearchChange(''); }} style={{ background: 'transparent', border: 'none', color: DS.danger, cursor: 'pointer', fontWeight: 700, padding: 0 }}>
               Clear ✕
             </button>
           </div>
        )}

        {filtered.length > 0 ? (
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
              </tbody>
            </table>
          </div>
        ) : null}
        
        {filtered.length === 0 && !loading && (
            <div style={{ textAlign: 'center', padding: '60px 20px', background: DS.card, borderRadius: '16px', border: `1px solid ${DS.border}` }}>
              {tickets.filter(t => !isEmployee || t.employee_id === profile?.id).length === 0 ? (
                <>
                  <div style={{ fontSize: '3rem', marginBottom: '16px' }}>🎉</div>
                  <h3 style={{ color: DS.text, fontSize: '1.2rem', marginBottom: '8px', fontWeight: 700 }}>You're all caught up!</h3>
                  <p style={{ color: DS.muted, fontSize: '0.9rem', marginBottom: '24px' }}>You have no requests right now.</p>
                  {isEmployee && (
                    <button onClick={() => navigate('/tickets/new')} style={{ background: DS.primary, color: '#fff', border: 'none', padding: '12px 24px', borderRadius: '8px', fontWeight: 700, cursor: 'pointer' }}>
                      Raise New Request
                    </button>
                  )}
                </>
              ) : (
                <>
                  <div style={{ fontSize: '3rem', marginBottom: '16px' }}>😕</div>
                  <h3 style={{ color: DS.text, fontSize: '1.2rem', marginBottom: '8px', fontWeight: 700 }}>No matching requests found</h3>
                  <p style={{ color: DS.muted, fontSize: '0.9rem', marginBottom: '24px' }}>Try searching for something else or clear your filters.</p>
                  <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
                    <button onClick={() => { handleSearchChange('VPN'); setSearchParams({ q: 'VPN' }); }} style={{ background: DS.surface, color: DS.text, border: `1px solid ${DS.border}`, padding: '10px 20px', borderRadius: '8px', fontWeight: 600, cursor: 'pointer' }}>
                      Search "VPN"
                    </button>
                    <button onClick={() => { handleStatusChange('all'); setCategoryFilter('all'); handleSearchChange(''); setSearchParams({}); }} style={{ background: DS.surface, color: DS.text, border: `1px solid ${DS.border}`, padding: '10px 20px', borderRadius: '8px', fontWeight: 600, cursor: 'pointer' }}>
                      Clear Filters
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
      </div>
    </div>
  );
};
