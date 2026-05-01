import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { getTickets, updateProcurementStatus } from '../lib/api';
import { 
  Package, Search, Filter, Loader2, CheckCircle2, 
  Clock, Truck, ChevronRight, AlertCircle, ShoppingCart, X, Users,
  TrendingUp, PackageCheck, Box, AlertTriangle, MapPin, BarChart3, Wrench, ShieldAlert, RefreshCw
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { Drawer } from '../components/Drawer';
import { useAuth } from '../lib/AuthContext';
import { CalendarView, MiniCalendar, CalendarEvent } from '../components/CalendarView';
import { isSameDay } from 'date-fns';

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
  const [filterMode, setFilterMode] = useState<'Active' | 'Pending' | 'Completed'>('Active');
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
  const [selectedDayEvents, setSelectedDayEvents] = useState<CalendarEvent[]>([]);
  const [showDayModal, setShowDayModal] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

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
      
      setTickets(data || []);

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

  const handleDateClick = (date: Date) => {
    const dayEvents = calendarEvents.filter(e => isSameDay(e.date, date));
    if (dayEvents.length > 0) {
      setSelectedDate(date);
      setSelectedDayEvents(dayEvents);
      setShowDayModal(true);
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

  const filteredTickets = tickets.filter(t => {
    const matchSearch = t.title.toLowerCase().includes(search.toLowerCase()) || t.id.toLowerCase().includes(search.toLowerCase());
    let matchFilter = true;
    if (filterMode === 'Active') {
      matchFilter = !t.procurement_status || ['Requested', 'Procuring', 'Handover Pending'].includes(t.procurement_status);
    } else if (filterMode === 'Pending') {
      matchFilter = t.status === 'Open' || t.status === 'Waiting for User' || t.procurement_status === 'Requested';
    } else if (filterMode === 'Completed') {
      matchFilter = t.procurement_status === 'Completed' || t.status === 'Resolved';
    }
    return matchSearch && matchFilter;
  });

  if (loading && tickets.length === 0) return (
    <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: DS.bg }}>
      <Loader2 className="animate-spin" color={DS.primary} size={32} />
    </div>
  );

  return (
    <>
      <div style={{ minHeight: '100vh', background: DS.bg, color: DS.text, padding: '32px', fontFamily: "'Inter', sans-serif" }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        
        {/* Header - Minimal & Action Oriented */}
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: DS.primary, marginBottom: '4px' }}>
              <Package size={16} />
              <span style={{ fontSize: '0.65rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Assets & Logistics</span>
            </div>
            <h1 style={{ color: DS.text, fontSize: '2rem', fontWeight: 900, letterSpacing: '-0.04em', margin: 0 }}>Inventory Control</h1>
          </div>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <button onClick={fetchInventoryTickets} style={{ width: '42px', height: '42px', borderRadius: '12px', background: DS.card, border: `1px solid ${DS.border}`, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: DS.muted }}>
              <RefreshCw size={18} className={loading || updating ? 'animate-spin' : ''} />
            </button>
          </div>
        </header>

        {/* 🔝 ALERT STRIP */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '40px' }}>
          <div style={{ background: 'linear-gradient(135deg, rgba(255,68,68,0.1) 0%, rgba(255,68,68,0.02) 100%)', border: '1px solid rgba(255,68,68,0.2)', borderRadius: '24px', padding: '24px', display: 'flex', alignItems: 'center', gap: '16px' }}>
             <div style={{ background: 'rgba(255,68,68,0.2)', padding: '12px', borderRadius: '12px' }}><AlertTriangle color="#ff4444" size={24} /></div>
             <div>
               <p style={{ fontSize: '0.75rem', fontWeight: 800, color: '#ff4444', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>Low Stock Items</p>
               <h3 style={{ fontSize: '1.5rem', fontWeight: 900, color: DS.text, margin: 0 }}>4</h3>
               <p style={{ fontSize: '0.7rem', color: '#ff4444', fontWeight: 700, marginTop: '4px' }}>Will run out in 3 days</p>
             </div>
          </div>
          <div style={{ background: 'linear-gradient(135deg, rgba(255,184,110,0.1) 0%, rgba(255,184,110,0.02) 100%)', border: '1px solid rgba(255,184,110,0.2)', borderRadius: '24px', padding: '24px', display: 'flex', alignItems: 'center', gap: '16px' }}>
             <div style={{ background: 'rgba(255,184,110,0.2)', padding: '12px', borderRadius: '12px' }}><Clock color="#ffb86e" size={24} /></div>
             <div>
               <p style={{ fontSize: '0.75rem', fontWeight: 800, color: '#ffb86e', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>Pending Approvals</p>
               <h3 style={{ fontSize: '1.5rem', fontWeight: 900, color: DS.text, margin: 0 }}>{tickets.filter(t => t.status === 'Open').length}</h3>
             </div>
          </div>
          <div style={{ background: 'linear-gradient(135deg, rgba(14,165,233,0.1) 0%, rgba(14,165,233,0.02) 100%)', border: '1px solid rgba(14,165,233,0.2)', borderRadius: '24px', padding: '24px', display: 'flex', alignItems: 'center', gap: '16px' }}>
             <div style={{ background: 'rgba(14,165,233,0.2)', padding: '12px', borderRadius: '12px' }}><Truck color="#0ea5e9" size={24} /></div>
             <div>
               <p style={{ fontSize: '0.75rem', fontWeight: 800, color: '#0ea5e9', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>Delayed Deliveries</p>
               <h3 style={{ fontSize: '1.5rem', fontWeight: 900, color: DS.text, margin: 0 }}>1</h3>
             </div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '24px', marginBottom: '40px' }}>
           
           <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              {/* 📊 INVENTORY OVERVIEW */}
              <div style={{ background: DS.card, borderRadius: '32px', padding: '32px', border: `1px solid ${DS.border}` }}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 900, marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '8px' }}><Package size={20} color={DS.primary} /> Inventory Overview</h3>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                   <div style={{ flex: 1, background: DS.surface, border: `1px solid ${DS.border}`, borderRadius: '20px', padding: '16px', textAlign: 'center' }}>
                      <p style={{ fontSize: '0.65rem', color: DS.muted, fontWeight: 800, textTransform: 'uppercase', marginBottom: '8px' }}>Issued</p>
                      <p style={{ fontSize: '1.4rem', fontWeight: 900, color: DS.success }}>284</p>
                   </div>
                   <ChevronRight size={16} color={DS.muted} />
                   <div style={{ flex: 1, background: DS.surface, border: `1px solid ${DS.border}`, borderRadius: '20px', padding: '16px', textAlign: 'center' }}>
                      <p style={{ fontSize: '0.65rem', color: DS.muted, fontWeight: 800, textTransform: 'uppercase', marginBottom: '8px' }}>In Use</p>
                      <p style={{ fontSize: '1.4rem', fontWeight: 900, color: DS.primary }}>89</p>
                   </div>
                   <ChevronRight size={16} color={DS.muted} />
                   <div style={{ flex: 1, background: DS.surface, border: `1px solid ${DS.border}`, borderRadius: '20px', padding: '16px', textAlign: 'center' }}>
                      <p style={{ fontSize: '0.65rem', color: DS.muted, fontWeight: 800, textTransform: 'uppercase', marginBottom: '8px' }}>Repair</p>
                      <p style={{ fontSize: '1.4rem', fontWeight: 900, color: DS.warning }}>12</p>
                   </div>
                   <ChevronRight size={16} color={DS.muted} />
                   <div style={{ flex: 1, background: DS.surface, border: `1px solid ${DS.border}`, borderRadius: '20px', padding: '16px', textAlign: 'center' }}>
                      <p style={{ fontSize: '0.65rem', color: DS.muted, fontWeight: 800, textTransform: 'uppercase', marginBottom: '8px' }}>Retired</p>
                      <p style={{ fontSize: '1.4rem', fontWeight: 900, color: DS.danger }}>45</p>
                   </div>
                </div>
              </div>

              {/* 💰 PROCUREMENT PANEL */}
              <div style={{ background: DS.card, borderRadius: '32px', padding: '32px', border: `1px solid ${DS.border}` }}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 900, marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '8px' }}><ShoppingCart size={20} color={DS.primary} /> Procurement Spend</h3>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                   <div>
                      <p style={{ fontSize: '0.75rem', fontWeight: 800, color: DS.muted, textTransform: 'uppercase', marginBottom: '4px' }}>Monthly Spend</p>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px' }}>
                        <h2 style={{ fontSize: '2.5rem', fontWeight: 900, color: DS.text, margin: 0 }}>₹{tickets.reduce((acc, t) => acc + (parseFloat(t.procurement_cost) || 0), 0).toLocaleString()}</h2>
                        <span style={{ fontSize: '0.8rem', fontWeight: 700, color: DS.danger, background: 'rgba(255,68,68,0.1)', padding: '4px 8px', borderRadius: '8px' }}>+15% from last month</span>
                      </div>
                   </div>
                   <div style={{ textAlign: 'right' }}>
                      <p style={{ fontSize: '0.75rem', fontWeight: 800, color: DS.muted, textTransform: 'uppercase', marginBottom: '4px' }}>Budget Utilized</p>
                      <h2 style={{ fontSize: '1.5rem', fontWeight: 900, color: DS.success, margin: 0 }}>42%</h2>
                   </div>
                </div>
                <div style={{ height: '8px', background: DS.surface, borderRadius: '4px', overflow: 'hidden', display: 'flex' }}>
                   <div style={{ width: '60%', background: DS.success }} />
                   <div style={{ width: '20%', background: DS.warning }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '12px' }}>
                   <span style={{ fontSize: '0.75rem', color: DS.success, fontWeight: 700 }}>60% Approved</span>
                   <span style={{ fontSize: '0.75rem', color: DS.warning, fontWeight: 700 }}>20% Pending</span>
                </div>
              </div>
           </div>

           <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              {/* 🚚 LOGISTICS HUB */}
              <div style={{ background: DS.card, borderRadius: '32px', padding: '32px', border: `1px solid ${DS.border}` }}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 900, marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '8px' }}><MapPin size={20} color={DS.primary} /> Logistics Hub</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {tickets.filter(t => t.status === 'Procuring').slice(0, 3).map(t => (
                    <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: '16px', background: DS.surface, padding: '16px', borderRadius: '16px', border: `1px solid ${DS.border}` }}>
                       <div style={{ background: 'rgba(14,165,233,0.1)', padding: '10px', borderRadius: '12px' }}><Truck size={18} color={DS.primary} /></div>
                       <div style={{ flex: 1 }}>
                          <p style={{ fontSize: '0.85rem', fontWeight: 700, color: DS.text }}>{t.title}</p>
                          <p style={{ fontSize: '0.75rem', color: DS.muted, fontWeight: 600 }}>ETA: {t.procurement_expected_date ? format(new Date(t.procurement_expected_date), 'MMM do') : 'TBD'}</p>
                       </div>
                       <span style={{ fontSize: '0.7rem', fontWeight: 800, color: DS.primary, background: 'rgba(14,165,233,0.1)', padding: '4px 8px', borderRadius: '6px' }}>In Transit</span>
                    </div>
                  ))}
                  {tickets.filter(t => t.status === 'Procuring').length === 0 && <p style={{ fontSize: '0.85rem', color: DS.muted, fontStyle: 'italic' }}>No active deliveries.</p>}
                </div>
              </div>

              {/* 📈 INSIGHTS */}
              <div style={{ background: DS.card, borderRadius: '32px', padding: '32px', border: `1px solid ${DS.border}`, flex: 1 }}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 900, marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '8px' }}><BarChart3 size={20} color={DS.primary} /> Insights</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                   <div style={{ background: DS.surface, padding: '16px', borderRadius: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                       <div>
                         <p style={{ fontSize: '0.85rem', fontWeight: 700, color: DS.text }}>MacBook Pro 16"</p>
                         <p style={{ fontSize: '0.7rem', color: DS.primary, fontWeight: 700 }}>Demand increased 40% this month</p>
                       </div>
                      <span style={{ fontSize: '0.8rem', fontWeight: 800, color: DS.primary }}>12 reqs</span>
                   </div>
                   <div style={{ background: DS.surface, padding: '16px', borderRadius: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <p style={{ fontSize: '0.85rem', fontWeight: 700, color: DS.text }}>Logitech MX Master</p>
                        <p style={{ fontSize: '0.7rem', color: DS.muted }}>Fast-Moving Stock</p>
                      </div>
                      <span style={{ fontSize: '0.8rem', fontWeight: 800, color: DS.success }}>48 units/mo</span>
                   </div>
                   <div style={{ background: DS.surface, padding: '16px', borderRadius: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <p style={{ fontSize: '0.85rem', fontWeight: 700, color: DS.text }}>VGA Cables</p>
                        <p style={{ fontSize: '0.7rem', color: DS.muted }}>Dead Stock Alert</p>
                      </div>
                      <span style={{ fontSize: '0.8rem', fontWeight: 800, color: DS.danger }}>0 movement</span>
                   </div>
                </div>
              </div>
           </div>
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
              Recent Requests
            </button>
            <button 
              onClick={() => setFilterMode('Pending')}
              style={{ padding: '8px 24px', borderRadius: '8px', border: 'none', background: filterMode === 'Pending' ? DS.warning : 'transparent', color: filterMode === 'Pending' ? '#000' : DS.muted, fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s' }}
            >
              Approval Pending
            </button>
            <button 
              onClick={() => setFilterMode('Completed')}
              style={{ padding: '8px 24px', borderRadius: '8px', border: 'none', background: filterMode === 'Completed' ? DS.success : 'transparent', color: filterMode === 'Completed' ? '#000' : DS.muted, fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s' }}
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
                    {(ticket.employee?.name || ticket.guest_name || 'Guest') !== (profile?.name || 'Guest User') && (
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

        <Drawer
          isOpen={showDayModal}
          onClose={() => setShowDayModal(false)}
          title="Logistics & Deliveries"
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
                  <span style={{ fontSize: '0.65rem', fontWeight: 800, color: DS.muted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Logistics</span>
                </div>
                <p style={{ fontSize: '0.95rem', fontWeight: 600, color: DS.text, margin: 0 }}>{event.title}</p>
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '12px' }}>
                  <span style={{ fontSize: '0.7rem', color: DS.primary, fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>
                    View Inventory Ticket <ChevronRight size={12} />
                  </span>
                </div>
              </div>
            ))}
          </div>
        </Drawer>

        {/* Procurement Update Drawer */}
        <Drawer
          isOpen={showProcModal}
          onClose={() => setShowProcModal(false)}
          title={nextStatus === 'Procuring' ? 'Initiate Procurement' : 'Logistics Handover'}
          subtitle={selectedTicket && `Update for Ticket #${selectedTicket.id.substring(0, 8).toUpperCase()}`}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {selectedTicket && (
              <div style={{ background: 'rgba(14,165,233,0.03)', border: `1px solid ${DS.border}`, borderRadius: '20px', padding: '20px' }}>
                <p style={{ fontSize: '0.65rem', fontWeight: 800, color: DS.muted, textTransform: 'uppercase', marginBottom: '8px' }}>Currently Managing</p>
                <p style={{ fontSize: '1rem', fontWeight: 700, color: DS.text }}>{selectedTicket.title}</p>
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 800, color: DS.muted, textTransform: 'uppercase' }}>Expected Delivery Date</label>
                <input 
                  type="date" 
                  value={procDetails.expectedDate} 
                  onChange={e => setProcDetails({...procDetails, expectedDate: e.target.value})}
                  style={{ width: '100%', padding: '14px', borderRadius: '12px', background: DS.surface, border: `1px solid ${DS.border}`, color: DS.text, fontSize: '0.9rem' }}
                />
              </div>

              {nextStatus === 'Handover Pending' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 800, color: DS.muted, textTransform: 'uppercase' }}>Upload Invoice / Asset Photo</label>
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
                      style={{ width: '100%', padding: '12px', borderRadius: '12px', background: DS.surface, border: `1px dashed ${DS.border}`, color: DS.muted, fontSize: '0.85rem', cursor: 'pointer' }}
                    />
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 800, color: DS.muted, textTransform: 'uppercase' }}>
                  {nextStatus === 'Procuring' ? 'Inventory Tracking Remarks' : 'Condition & Handover Notes'}
                </label>
                <textarea 
                  value={procDetails.remarks} 
                  onChange={e => setProcDetails({...procDetails, remarks: e.target.value})}
                  placeholder={nextStatus === 'Procuring' ? "Enter tracking ID or procurement updates..." : "Enter serial numbers, condition details, etc..."}
                  style={{ width: '100%', height: '120px', padding: '14px', borderRadius: '12px', background: DS.surface, border: `1px solid ${DS.border}`, color: DS.text, fontSize: '0.9rem', resize: 'none' }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
              <button onClick={() => setShowProcModal(false)} style={{ flex: 1, padding: '16px', borderRadius: '12px', background: 'transparent', border: `1px solid ${DS.border}`, color: DS.muted, fontWeight: 700, cursor: 'pointer' }}>Cancel</button>
              <button 
                disabled={updating}
                onClick={handleExecuteUpdate}
                style={{ flex: 2, padding: '16px', borderRadius: '12px', background: nextStatus === 'Procuring' ? DS.primary : DS.success, border: 'none', color: '#fff', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', boxShadow: `0 8px 24px ${nextStatus === 'Procuring' ? 'rgba(14,165,233,0.3)' : 'rgba(74,222,128,0.3)'}` }}
              >
                {updating && <Loader2 size={18} className="animate-spin" />}
                {nextStatus === 'Procuring' ? 'Confirm Procurement' : 'Ready for Handover'}
              </button>
            </div>
          </div>
        </Drawer>
    </>
  );
};
