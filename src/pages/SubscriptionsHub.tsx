import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, Search, DollarSign, Calendar, RefreshCw, X, Building2
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { getSubscriptions, createSubscription, updateSubscription, getAllUsers } from '../lib/api';
import { Drawer } from '../components/Drawer';

const DS = {
  bg: '#0f172a',
  card: '#131b2e',
  border: 'rgba(14,165,233,0.12)',
  primary: '#0ea5e9',
  text: '#dae2fd',
  muted: '#88929b',
  surface: '#0b1326',
};

const Badge = ({ status }: { status: string }) => {
  const map: Record<string, { bg: string; color: string }> = {
    'active':    { bg: 'rgba(74,222,128,0.15)', color: '#4ade80' },
    'cancelled': { bg: 'rgba(255,68,68,0.15)',  color: '#ff4444' },
  };
  const s = map[status?.toLowerCase()] || map['active'];
  return (
    <span style={{
      ...s,
      padding: '4px 12px', borderRadius: '9999px',
      fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em',
    }}>
      {status}
    </span>
  );
};

export const SubscriptionsHub = () => {
  const [subscriptions, setSubscriptions] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    service_name: '', cost: '', billing_cycle: 'Monthly', next_due_date: '', owner_id: '', status: 'Active', comment: ''
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const subs = await getSubscriptions();
      setSubscriptions(subs || []);
    } catch (e) {
      console.error('Failed to load subscriptions:', e);
    }
    try {
      const usrs = await getAllUsers();
      setUsers(usrs || []);
    } catch (e) {
      console.error('Failed to load users:', e);
    }
    setLoading(false);
  };

  const handleEdit = (sub: any) => {
    setEditingId(sub.id);
    setFormData({
      service_name: sub.service_name,
      cost: sub.cost,
      billing_cycle: sub.billing_cycle,
      next_due_date: sub.next_due_date,
      owner_id: sub.owner_id || '',
      status: sub.status,
      comment: sub.comment || ''
    });
    setShowModal(true);
  };

  const handleAddNew = () => {
    setEditingId(null);
    setFormData({ service_name: '', cost: '', billing_cycle: 'Monthly', next_due_date: '', owner_id: '', status: 'Active', comment: '' });
    setShowModal(true);
  };

  const handleSubmit = async () => {
    try {
      const payload = {
        service_name: formData.service_name,
        cost: formData.cost,
        billing_cycle: formData.billing_cycle,
        next_due_date: formData.next_due_date,
        owner_id: formData.owner_id || null,
        status: formData.status,
        comment: formData.comment || null
      };
      
      if (editingId) {
        await updateSubscription(editingId, payload);
      } else {
        await createSubscription(payload);
      }
      setShowModal(false);
      fetchData();
    } catch (e) {
      console.error(e);
      alert('Failed to save subscription');
    }
  };

  const handleRenew = async (id: string, currentDueDate: string, cycle: string) => {
    try {
      let nextDate = new Date(currentDueDate);
      if (cycle === 'Monthly') nextDate.setMonth(nextDate.getMonth() + 1);
      else if (cycle === 'Quarterly') nextDate.setMonth(nextDate.getMonth() + 3);
      else if (cycle === 'Yearly') nextDate.setFullYear(nextDate.getFullYear() + 1);
      
      await updateSubscription(id, { next_due_date: nextDate.toISOString().split('T')[0] });
      fetchData();
    } catch (e) {
      console.error(e);
      alert('Failed to renew subscription');
    }
  };

  const filtered = subscriptions.filter(s => 
    s.service_name?.toLowerCase().includes(search.toLowerCase()) ||
    s.owner?.name?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div style={{ padding: '32px', fontFamily: "'Inter', sans-serif" }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 style={{ color: DS.text, fontSize: '1.75rem', fontWeight: 800, margin: 0, letterSpacing: '-0.02em' }}>Subscriptions Hub</h1>
          <p style={{ color: DS.muted, fontSize: '0.875rem', marginTop: '4px' }}>Manage all software and infrastructure subscriptions.</p>
        </div>
        <button
          onClick={handleAddNew}
          style={{
            background: 'linear-gradient(135deg, #0ea5e9, #0284c7)', color: '#fff', border: 'none', borderRadius: '12px',
            padding: '12px 20px', fontWeight: 700, fontSize: '0.875rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px',
            boxShadow: '0 8px 24px rgba(14,165,233,0.35)',
          }}
        >
          <Plus size={18} /> Add Subscription
        </button>
      </div>

      <div style={{ background: DS.card, borderRadius: '20px', border: `1px solid ${DS.border}`, overflow: 'hidden' }}>
        <div style={{ padding: '20px 24px', borderBottom: `1px solid ${DS.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: DS.surface, border: `1px solid ${DS.border}`, borderRadius: '10px', padding: '8px 14px' }}>
            <Search size={14} color={DS.muted} />
            <input
              type="text" placeholder="Search services..."
              value={search} onChange={e => setSearch(e.target.value)}
              style={{ background: 'none', border: 'none', outline: 'none', color: DS.text, fontSize: '0.8rem', width: '200px' }}
            />
          </div>
          <button onClick={fetchData} style={{ width: '36px', height: '36px', borderRadius: '10px', background: DS.surface, border: `1px solid ${DS.border}`, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: DS.muted }}>
            <RefreshCw size={14} />
          </button>
        </div>

        {loading ? (
          <div style={{ padding: '48px', textAlign: 'center', color: DS.muted }}>Loading...</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'rgba(14,165,233,0.04)' }}>
                {['Service', 'Owner', 'Cost', 'Cycle', 'Next Due', 'Status', 'Comment', 'Actions'].map(h => (
                  <th key={h} style={{ padding: '12px 24px', textAlign: 'left', fontSize: '0.68rem', fontWeight: 700, color: DS.muted, letterSpacing: '0.08em', textTransform: 'uppercase' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(s => (
                <tr key={s.id} style={{ borderTop: `1px solid ${DS.border}` }}>
                  <td style={{ padding: '16px 24px', color: DS.text, fontWeight: 700, fontSize: '0.875rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(14,165,233,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <DollarSign size={16} color="#89ceff" />
                      </div>
                      {s.service_name}
                    </div>
                  </td>
                  <td style={{ padding: '16px 24px', color: DS.muted, fontSize: '0.8rem' }}>{s.owner?.name || 'Unassigned'}</td>
                  <td style={{ padding: '16px 24px', color: '#4ade80', fontWeight: 800, fontSize: '0.875rem' }}>₹{s.cost}</td>
                  <td style={{ padding: '16px 24px', color: DS.muted, fontSize: '0.8rem' }}>{s.billing_cycle}</td>
                  <td style={{ padding: '16px 24px', color: DS.text, fontSize: '0.8rem', fontWeight: 600 }}>{s.next_due_date}</td>
                  <td style={{ padding: '16px 24px' }}><Badge status={s.status} /></td>
                  <td style={{ padding: '16px 24px', color: DS.muted, fontSize: '0.75rem', maxWidth: '150px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={s.comment}>{s.comment || '—'}</td>
                  <td style={{ padding: '16px 24px' }}>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button onClick={() => handleRenew(s.id, s.next_due_date, s.billing_cycle)} style={{ background: 'rgba(74,222,128,0.1)', color: '#4ade80', border: 'none', borderRadius: '8px', padding: '6px 12px', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer' }}>
                        Mark Paid & Renew
                      </button>
                      <button onClick={() => handleEdit(s)} style={{ background: DS.surface, color: DS.text, border: `1px solid ${DS.border}`, borderRadius: '8px', padding: '6px 12px', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer' }}>
                        Edit
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} style={{ padding: '48px', textAlign: 'center', color: DS.muted }}>No subscriptions found.</td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      <Drawer
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editingId ? 'Edit Subscription' : 'New Subscription'}
        subtitle={editingId ? `Update details for ${formData.service_name}` : 'Register a new service subscription'}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{ color: DS.muted, fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Service Name</label>
              <input 
                type="text" 
                value={formData.service_name} 
                onChange={e => setFormData({ ...formData, service_name: e.target.value })} 
                placeholder="e.g. AWS, Slack, GitHub"
                style={{ width: '100%', background: DS.surface, color: DS.text, border: `1px solid ${DS.border}`, padding: '14px', borderRadius: '12px', outline: 'none' }} 
              />
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{ color: DS.muted, fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Cost (₹)</label>
              <div style={{ position: 'relative' }}>
                <DollarSign size={16} color={DS.muted} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)' }} />
                <input 
                  type="number" 
                  value={formData.cost} 
                  onChange={e => setFormData({ ...formData, cost: e.target.value })} 
                  style={{ width: '100%', background: DS.surface, color: DS.text, border: `1px solid ${DS.border}`, padding: '14px 14px 14px 40px', borderRadius: '12px', outline: 'none' }} 
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label style={{ color: DS.muted, fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Billing Cycle</label>
                <select 
                  value={formData.billing_cycle} 
                  onChange={e => setFormData({ ...formData, billing_cycle: e.target.value })} 
                  style={{ width: '100%', background: DS.surface, color: DS.text, border: `1px solid ${DS.border}`, padding: '14px', borderRadius: '12px', outline: 'none' }}
                >
                  <option>Monthly</option><option>Quarterly</option><option>Yearly</option>
                </select>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label style={{ color: DS.muted, fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Next Due Date</label>
                <input 
                  type="date" 
                  value={formData.next_due_date} 
                  onChange={e => setFormData({ ...formData, next_due_date: e.target.value })} 
                  style={{ width: '100%', background: DS.surface, color: DS.text, border: `1px solid ${DS.border}`, padding: '14px', borderRadius: '12px', outline: 'none' }} 
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label style={{ color: DS.muted, fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Owner (Employee)</label>
                <select 
                  value={formData.owner_id} 
                  onChange={e => setFormData({ ...formData, owner_id: e.target.value })} 
                  style={{ width: '100%', background: DS.surface, color: DS.text, border: `1px solid ${DS.border}`, padding: '14px', borderRadius: '12px', outline: 'none' }}
                >
                  <option value="">Unassigned</option>
                  {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label style={{ color: DS.muted, fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Status</label>
                <select 
                  value={formData.status} 
                  onChange={e => setFormData({ ...formData, status: e.target.value })} 
                  style={{ width: '100%', background: DS.surface, color: DS.text, border: `1px solid ${DS.border}`, padding: '14px', borderRadius: '12px', outline: 'none' }}
                >
                  <option>Active</option><option>Cancelled</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{ color: DS.muted, fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Comments / Discontinuation Reason</label>
              <textarea 
                value={formData.comment} 
                onChange={e => setFormData({ ...formData, comment: e.target.value })} 
                placeholder="Add any internal notes or reasoning..."
                rows={4} 
                style={{ width: '100%', background: DS.surface, color: DS.text, border: `1px solid ${DS.border}`, padding: '14px', borderRadius: '12px', outline: 'none', resize: 'none' }} 
              />
            </div>
          </div>

          <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
            <button 
              onClick={() => setShowModal(false)} 
              style={{ flex: 1, padding: '16px', background: 'transparent', color: DS.muted, border: `1px solid ${DS.border}`, borderRadius: '12px', cursor: 'pointer', fontWeight: 700 }}
            >
              Cancel
            </button>
            <button 
              onClick={handleSubmit} 
              style={{ flex: 2, padding: '16px', background: 'linear-gradient(135deg, #0ea5e9, #0284c7)', color: '#fff', border: 'none', borderRadius: '12px', cursor: 'pointer', fontWeight: 800, boxShadow: '0 8px 24px rgba(14,165,233,0.3)' }}
            >
              {editingId ? 'Update Subscription' : 'Register Subscription'}
            </button>
          </div>
        </div>
      </Drawer>
    </div>
  );
};
