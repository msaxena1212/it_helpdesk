import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { getTickets, updateProcurementStatus } from '../lib/api';
import { 
  Package, Search, Filter, Loader2, CheckCircle2, 
  Clock, Truck, ChevronRight, AlertCircle, ShoppingCart, X, Users
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';
import { CalendarView, MiniCalendar, CalendarEvent } from '../components/CalendarView';

const DS = {
  bg: '#0f172a', card: '#131b2e', cardHigh: '#1e293b',
  border: 'rgba(14,165,233,0.12)', primary: '#0ea5e9',
  text: '#dae2fd', muted: '#88929b', surface: '#0b1326',
  accent: '#0ea5e9', success: '#4ade80', warning: '#ffb86e', danger: '#ff4444'
};

export const InventoryDashboard = () => {
  const [tickets, setTickets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [updating, setUpdating] = useState(false);
  const [filterMode, setFilterMode] = useState<'Active' | 'Completed'>('Active');
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);

  const [selectedTicket, setSelectedTicket] = useState<any>(null);
  const [showProcModal, setShowProcModal] = useState(false);
  const [nextStatus, setNextStatus] = useState('');
  const [procDetails, setProcDetails] = useState({
    supplier: '',
    cost: '',
    expectedDate: '',
    remarks: ''
  });

  const { profile } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    fetchInventoryTickets();
  }, [profile, filterMode]);

  const fetchInventoryTickets = async () => {
    try {
      setLoading(true);
      let query = supabase
        .from('tickets')
        .select('*, employee:profiles!employee_id(name, email, department)')
        .or('status.eq.Waiting for Inventory,procurement_status.not.is.null')
        .order('updated_at', { ascending: false });

      if (profile?.role === 'inventory_manager') {
        query = query.eq('inventory_manager_id', profile.id);
      }

      const { data, error } = await query;
      
      if (error) throw error;
      
      const finalData = (data || []).filter(t => {
        const isProcCompleted = t.procurement_status === 'Completed' || t.procurement_status === 'Handover Pending';
        if (filterMode === 'Completed') return isProcCompleted;
        // Active means not completed
        return !isProcCompleted;
      });

       setTickets(finalData);

      // Prepare calendar events
      const events: CalendarEvent[] = (data || []).filter(t => t.procurement_expected_date && t.procurement_status !== 'Completed').map(t => ({
        id: t.id,
        date: new Date(t.procurement_expected_date),
        title: `🚚 ${t.title}`,
        type: 'leave' as const, // Reusing color logic
        color: '#ffb86e'
      }));
      setCalendarEvents(events);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (ticket: any, status: string) => {
    setSelectedTicket(ticket);
    setNextStatus(status);
    setProcDetails({
      supplier: ticket.procurement_supplier || '',
      cost: ticket.procurement_cost || '',
      expectedDate: ticket.procurement_expected_date || '',
      remarks: ticket.inventory_remarks || ''
    });
    setShowProcModal(true);
  };

  const handleExecuteUpdate = async () => {
    if (!selectedTicket) return;
    setUpdating(true);
    try {
      await updateProcurementStatus(selectedTicket.id, nextStatus, procDetails);
      setShowProcModal(false);
      fetchInventoryTickets();
    } catch (e) {
      console.error(e);
    } finally {
      setUpdating(false);
    }
  };

  const filteredTickets = tickets.filter(t => 
    t.title.toLowerCase().includes(search.toLowerCase()) ||
    t.id.toLowerCase().includes(search.toLowerCase())
  );

  if (loading && tickets.length === 0) return (
    <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: DS.bg }}>
      <Loader2 className="animate-spin" color={DS.primary} size={32} />
    </div>
  );

  return (
    <>
      <div style={{ minHeight: '100vh', background: DS.bg, color: DS.text, padding: '32px', fontFamily: "'Inter', sans-serif" }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        
        {/* Contextual Awareness: Budget & Logistics */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 280px', gap: '20px', marginBottom: '32px' }}>
          <div style={{ background: 'rgba(74,222,128,0.03)', borderRadius: '24px', padding: '24px', border: '1px solid rgba(74,222,128,0.1)', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '16px' }}>
            <div>
              <h3 style={{ fontSize: '0.75rem', fontWeight: 800, color: '#4ade80', textTransform: 'uppercase', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px', letterSpacing: '0.05em' }}>
                <ShoppingCart size={16} /> Procurement Budget
              </h3>
              <p style={{ fontSize: '0.7rem', color: DS.muted, marginBottom: '2px' }}>Active Requests Total</p>
              <h2 style={{ fontSize: '2.25rem', fontWeight: 800, color: DS.text, letterSpacing: '-0.02em' }}>
                ₹ {tickets.reduce((acc, t) => acc + (parseFloat(t.procurement_cost) || 0), 0).toLocaleString()}
              </h2>
              <p style={{ fontSize: '0.65rem', color: DS.muted, marginTop: '8px' }}>Tracking across {tickets.length} active inventory tickets.</p>
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
            <h3 style={{ fontSize: '0.75rem', fontWeight: 800, color: DS.text, textTransform: 'uppercase', marginBottom: '16px', letterSpacing: '0.05em' }}>Logistics Quick Links</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
              {[
                { name: 'Amazon Business', icon: Truck },
                { name: 'Local Vendors', icon: Users },
                { name: 'Stock Audit', icon: Package }
              ].map(link => (
                <div key={link.name} style={{ background: DS.surface, padding: '12px 8px', borderRadius: '16px', border: `1px solid ${DS.border}`, textAlign: 'center', cursor: 'pointer', transition: 'all 0.2s' }} onMouseEnter={e => e.currentTarget.style.borderColor = DS.primary} onMouseLeave={e => e.currentTarget.style.borderColor = DS.border}>
                  <link.icon size={16} color={DS.primary} style={{ margin: '0 auto 8px' }} />
                  <p style={{ fontSize: '0.65rem', color: DS.text, fontWeight: 700 }}>{link.name}</p>
                </div>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'stretch' }}>
            <MiniCalendar events={calendarEvents} />
          </div>
        </div>

        <header style={{ marginBottom: '32px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                <Package color={DS.primary} size={20} />
                <span style={{ fontSize: '0.7rem', fontWeight: 800, color: DS.primary, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Supply Chain Control</span>
              </div>
              <h1 style={{ fontSize: '2rem', fontWeight: 800, letterSpacing: '-0.02em' }}>Inventory Management</h1>
              <p style={{ color: DS.muted, fontSize: '0.9rem' }}>Manage and procure components required for active service tickets.</p>
            </div>
          </div>
        </header>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '32px' }}>
          {[
            { label: 'Pending Requests', value: tickets.filter(t => t.procurement_status === 'Requested' || !t.procurement_status).length, icon: AlertCircle, color: DS.warning },
            { label: 'Currently Procuring', value: tickets.filter(t => t.procurement_status === 'Procuring').length, icon: ShoppingCart, color: DS.primary },
            { label: 'Ready for Handover', value: tickets.filter(t => t.procurement_status === 'Handover Pending').length, icon: Truck, color: DS.success },
            { label: filterMode === 'Completed' ? 'Total Completed' : 'Total Active', value: tickets.length, icon: Package, color: DS.text },
          ].map((stat, i) => (
            <div key={i} style={{ background: DS.card, borderRadius: '20px', padding: '24px', border: `1px solid ${DS.border}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                <p style={{ fontSize: '0.7rem', fontWeight: 700, color: DS.muted, textTransform: 'uppercase' }}>{stat.label}</p>
                <stat.icon size={18} color={stat.color} />
              </div>
              <h3 style={{ fontSize: '2rem', fontWeight: 800 }}>{stat.value}</h3>
            </div>
          ))}
        </div>

        <div style={{ background: DS.card, borderRadius: '24px', border: `1px solid ${DS.border}`, padding: '20px', marginBottom: '24px', display: 'flex', gap: '12px', alignItems: 'center' }}>
          <div style={{ flex: 1, background: DS.surface, border: `1px solid ${DS.border}`, borderRadius: '12px', display: 'flex', alignItems: 'center', padding: '0 16px' }}>
            <Search size={18} color={DS.muted} />
            <input 
              type="text" 
              placeholder="Search by Ticket ID or Title..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ background: 'none', border: 'none', outline: 'none', color: DS.text, padding: '14px', width: '100%', fontSize: '0.9rem' }}
            />
          </div>
          <div style={{ display: 'flex', background: DS.surface, borderRadius: '12px', padding: '6px', border: `1px solid ${DS.border}` }}>
            <button 
              onClick={() => setFilterMode('Active')}
              style={{ padding: '8px 24px', borderRadius: '8px', border: 'none', background: filterMode === 'Active' ? DS.primary : 'transparent', color: filterMode === 'Active' ? '#fff' : DS.muted, fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s' }}
            >
              Active
            </button>
            <button 
              onClick={() => setFilterMode('Completed')}
              style={{ padding: '8px 24px', borderRadius: '8px', border: 'none', background: filterMode === 'Completed' ? DS.primary : 'transparent', color: filterMode === 'Completed' ? '#fff' : DS.muted, fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s' }}
            >
              Completed
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {filteredTickets.map(ticket => (
            <motion.div 
              layout 
              key={ticket.id} 
              style={{ background: DS.card, borderRadius: '20px', border: `1px solid ${DS.border}`, overflow: 'hidden' }}
            >
              <div style={{ padding: '24px', display: 'grid', gridTemplateColumns: '1fr 200px 200px', gap: '24px', alignItems: 'center' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                    <span style={{ fontSize: '0.65rem', fontWeight: 800, background: 'rgba(14,165,233,0.1)', color: DS.primary, padding: '4px 8px', borderRadius: '4px' }}>#{ticket.id.substring(0,8).toUpperCase()}</span>
                    {(ticket.employee?.name || ticket.guest_name || 'Guest') !== (profile?.name || user?.user_metadata?.name || user?.email?.split('@')[0]) && (
                      <span style={{ fontSize: '0.75rem', fontWeight: 600, color: DS.muted }}>{ticket.employee?.name || 'Guest User'}</span>
                    )}
                  </div>
                  <h4 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '6px' }}>{ticket.title}</h4>
                  <p style={{ fontSize: '0.85rem', color: DS.muted, fontStyle: 'italic' }}>" {ticket.inventory_remarks} "</p>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.65rem', fontWeight: 700, color: DS.muted, textTransform: 'uppercase', marginBottom: '8px' }}>Procurement Status</label>
                  <div style={{ 
                    display: 'inline-flex', alignItems: 'center', gap: '8px', 
                    padding: '6px 12px', borderRadius: '8px', 
                    background: ticket.procurement_status === 'Handover Pending' || ticket.procurement_status === 'Completed' ? 'rgba(74,222,128,0.1)' : 'rgba(14,165,233,0.1)',
                    color: ticket.procurement_status === 'Handover Pending' || ticket.procurement_status === 'Completed' ? DS.success : DS.primary,
                    fontWeight: 700, fontSize: '0.8rem'
                  }}>
                    {(!ticket.procurement_status || ticket.procurement_status === 'Requested') && <Clock size={14} />}
                    {ticket.procurement_status === 'Procuring' && <ShoppingCart size={14} />}
                    {ticket.procurement_status === 'Handover Pending' && <Truck size={14} />}
                    {ticket.procurement_status === 'Completed' && <CheckCircle2 size={14} />}
                    {ticket.procurement_status || 'Requested'}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                  {(!ticket.procurement_status || ticket.procurement_status === 'Requested') && (
                    <button 
                      onClick={() => handleOpenModal(ticket, 'Procuring')}
                      style={{ background: DS.primary, border: 'none', borderRadius: '10px', padding: '10px 16px', color: '#fff', fontWeight: 700, cursor: 'pointer' }}
                    >
                      Start Procurement
                    </button>
                  )}
                  {ticket.procurement_status === 'Procuring' && (
                    <button 
                      onClick={() => handleOpenModal(ticket, 'Handover Pending')}
                      style={{ background: DS.success, border: 'none', borderRadius: '10px', padding: '10px 16px', color: '#fff', fontWeight: 700, cursor: 'pointer' }}
                    >
                      Ready for Handover
                    </button>
                  )}
                  <button 
                    onClick={() => navigate(`/tickets/${ticket.id}`)}
                    style={{ background: 'transparent', border: `1px solid ${DS.border}`, borderRadius: '10px', padding: '10px', color: DS.muted, cursor: 'pointer' }}
                  >
                    <ChevronRight size={20} />
                  </button>
                </div>
              </div>
              
              <div style={{ background: 'rgba(0,0,0,0.1)', padding: '12px 24px', borderTop: `1px solid ${DS.border}`, display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.75rem', color: DS.muted }}>Requested: {format(new Date(ticket.updated_at), 'MMM d, h:mm a')}</span>
                <span style={{ fontSize: '0.75rem', color: DS.muted }}>Priority: <b style={{ color: ticket.priority === 'Critical' ? DS.danger : DS.warning }}>{ticket.priority}</b></span>
              </div>
            </motion.div>
          ))}

          {filteredTickets.length === 0 && (
            <div style={{ padding: '80px', textAlign: 'center', background: DS.card, borderRadius: '24px', border: `1px dashed ${DS.border}` }}>
              <Package size={48} color={DS.border} style={{ margin: '0 auto 16px' }} />
              <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: DS.muted }}>No pending inventory requests</h3>
              <p style={{ color: DS.muted, fontSize: '0.9rem' }}>All parts have been procured and handed over.</p>
            </div>
          )}
          </div>
        </div>
      </div>

      <AnimatePresence>
        {showProcModal && (
          <div style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: '20px' }}>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowProcModal(false)} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)' }} />
            <motion.div initial={{ scale: 0.95, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 20 }} style={{ position: 'relative', width: '100%', maxWidth: '500px', background: DS.card, borderRadius: '28px', border: `1px solid ${DS.border}`, padding: '32px', boxShadow: '0 24px 64px rgba(0,0,0,0.6)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '12px' }}>
                  {nextStatus === 'Procuring' ? <ShoppingCart size={24} color={DS.primary} /> : <Truck size={24} color={DS.success} />} 
                  {nextStatus === 'Procuring' ? 'Start Procurement' : 'Confirm Handover'}
                </h2>
                <button onClick={() => setShowProcModal(false)} style={{ background: 'none', border: 'none', color: DS.muted, cursor: 'pointer' }}><X size={20} /></button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  {nextStatus === 'Procuring' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <label style={{ fontSize: '0.75rem', fontWeight: 800, color: DS.muted, textTransform: 'uppercase' }}>Supplier Name</label>
                      <input 
                        type="text"
                        value={procDetails.supplier}
                        onChange={e => setProcDetails({...procDetails, supplier: e.target.value})}
                        placeholder="e.g. Amazon, Local Vendor"
                        style={{ width: '100%', padding: '12px', borderRadius: '12px', background: DS.surface, border: `1px solid ${DS.border}`, color: DS.text, fontSize: '0.85rem' }}
                      />
                    </div>
                  )}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', gridColumn: nextStatus === 'Handover Pending' ? '1 / -1' : 'auto' }}>
                    <label style={{ fontSize: '0.75rem', fontWeight: 800, color: DS.muted, textTransform: 'uppercase' }}>{nextStatus === 'Procuring' ? 'Est. Cost (₹)' : 'Final Cost (₹)'}</label>
                    <input 
                      type="number"
                      value={procDetails.cost}
                      onChange={e => setProcDetails({...procDetails, cost: e.target.value})}
                      placeholder="0.00"
                      style={{ width: '100%', padding: '12px', borderRadius: '12px', background: DS.surface, border: `1px solid ${DS.border}`, color: DS.text, fontSize: '0.85rem' }}
                    />
                  </div>
                </div>

                {nextStatus === 'Procuring' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <label style={{ fontSize: '0.75rem', fontWeight: 800, color: DS.muted, textTransform: 'uppercase' }}>Expected Arrival Date</label>
                    <input 
                      type="date"
                      value={procDetails.expectedDate}
                      onChange={e => setProcDetails({...procDetails, expectedDate: e.target.value})}
                      style={{ width: '100%', padding: '12px', borderRadius: '12px', background: DS.surface, border: `1px solid ${DS.border}`, color: DS.text, fontSize: '0.85rem' }}
                    />
                  </div>
                )}

                {nextStatus === 'Handover Pending' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <label style={{ fontSize: '0.75rem', fontWeight: 800, color: DS.muted, textTransform: 'uppercase' }}>Upload Invoice / Item Image</label>
                    <div style={{ position: 'relative', width: '100%' }}>
                      <input 
                        type="file"
                        accept="image/*"
                        onChange={(e) => {
                          if (e.target.files && e.target.files[0]) {
                            const file = e.target.files[0];
                            setProcDetails(prev => ({...prev, remarks: prev.remarks + `\n[Attached: ${file.name}]` }));
                          }
                        }}
                        style={{ width: '100%', padding: '10px', borderRadius: '12px', background: DS.surface, border: `1px dashed ${DS.border}`, color: DS.muted, fontSize: '0.8rem', cursor: 'pointer' }}
                      />
                    </div>
                  </div>
                )}

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 800, color: DS.muted, textTransform: 'uppercase' }}>
                    {nextStatus === 'Procuring' ? 'Inventory Remarks / Tracking' : 'Handover Notes'}
                  </label>
                  <textarea 
                    value={procDetails.remarks} 
                    onChange={e => setProcDetails({...procDetails, remarks: e.target.value})}
                    placeholder={nextStatus === 'Procuring' ? "Enter tracking ID or procurement updates..." : "Enter condition details, serial numbers, etc..."}
                    style={{ width: '100%', height: '100px', padding: '12px', borderRadius: '12px', background: DS.surface, border: `1px solid ${DS.border}`, color: DS.text, fontSize: '0.85rem', resize: 'none' }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '12px', marginTop: '32px' }}>
                <button onClick={() => setShowProcModal(false)} style={{ flex: 1, padding: '12px', borderRadius: '12px', background: 'transparent', border: `1px solid ${DS.border}`, color: DS.text, fontWeight: 700, cursor: 'pointer' }}>Cancel</button>
                <button 
                  disabled={updating}
                  onClick={handleExecuteUpdate}
                  style={{ flex: 2, padding: '12px', borderRadius: '12px', background: nextStatus === 'Procuring' ? DS.primary : DS.success, border: 'none', color: '#fff', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                >
                  {updating && <Loader2 size={18} className="animate-spin" />}
                  {nextStatus === 'Procuring' ? 'Confirm & Update' : 'Ready for Handover'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
};
