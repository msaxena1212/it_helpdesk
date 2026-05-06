import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, Search, DollarSign, Calendar, RefreshCw, X, Building2,
  FileText, Upload, CheckCircle2, Loader2, Link2, ChevronDown
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
  success: '#4ade80',
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
  const [showNotifyDropdown, setShowNotifyDropdown] = useState(false);
  
  const [formData, setFormData] = useState({
    service_name: '', cost: '', billing_cycle: 'Monthly', next_due_date: '', owner_id: '', notify_user_ids: [] as string[], status: 'Active', comment: ''
  });

  const [showPaymentDrawer, setShowPaymentDrawer] = useState(false);
  const [selectedSub, setSelectedSub] = useState<any>(null);
  const [paymentComment, setPaymentComment] = useState('');
  const [paymentFile, setPaymentFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [subs, usrs, { data: { user } }] = await Promise.all([
        getSubscriptions(),
        getAllUsers(),
        supabase.auth.getUser()
      ]);
      setSubscriptions(subs || []);
      setUsers(usrs || []);
      if (user && !formData.owner_id) {
        setFormData(prev => ({ ...prev, owner_id: user.id }));
      }
    } catch (e) {
      console.error('Failed to load data:', e);
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
      notify_user_ids: sub.notify_user_ids || [],
      status: sub.status,
      comment: sub.comment || ''
    });
    setShowModal(true);
  };

  const handleAddNew = () => {
    setEditingId(null);
    setFormData({ service_name: '', cost: '', billing_cycle: 'Monthly', next_due_date: '', owner_id: '', notify_user_ids: [], status: 'Active', comment: '' });
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
        notify_user_ids: formData.notify_user_ids || [],
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
      
      let proofUrl = null;
      if (paymentFile) {
        setUploading(true);
        const fileExt = paymentFile.name.split('.').pop();
        const fileName = `${id}_${Date.now()}.${fileExt}`;
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('payment-proofs')
          .upload(fileName, paymentFile);
        
        if (uploadError) throw uploadError;
        
        const { data: { publicUrl } } = supabase.storage
          .from('payment-proofs')
          .getPublicUrl(fileName);
        proofUrl = publicUrl;
      }

      await updateSubscription(id, { 
        next_due_date: nextDate.toISOString().split('T')[0],
        comment: paymentComment ? (selectedSub?.comment ? `${selectedSub.comment}\n---\nPayment Notes: ${paymentComment}` : paymentComment) : selectedSub?.comment,
        payment_proof_url: proofUrl || selectedSub?.payment_proof_url
      });

      setShowPaymentDrawer(false);
      setPaymentComment('');
      setPaymentFile(null);
      fetchData();
    } catch (e) {
      console.error(e);
      alert('Failed to process payment & renew');
    } finally {
      setUploading(false);
    }
  };

  const openPaymentDrawer = (sub: any) => {
    setSelectedSub(sub);
    setPaymentComment('');
    setPaymentFile(null);
    setShowPaymentDrawer(true);
  };

  const toggleNotifyUser = (userId: string) => {
    setFormData(prev => {
      const ids = prev.notify_user_ids.includes(userId)
        ? prev.notify_user_ids.filter(id => id !== userId)
        : [...prev.notify_user_ids, userId];
      return { ...prev, notify_user_ids: ids };
    });
  };

  const filtered = subscriptions.filter(s => 
    s.service_name?.toLowerCase().includes(search.toLowerCase()) ||
    s.comment?.toLowerCase().includes(search.toLowerCase())
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
                  <td style={{ padding: '16px 24px', color: DS.muted, fontSize: '0.75rem', maxWidth: '150px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={s.comment}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {s.payment_proof_url && (
                        <a href={s.payment_proof_url} target="_blank" rel="noreferrer" style={{ color: DS.primary, display: 'flex' }} title="View Proof">
                          <Link2 size={14} />
                        </a>
                      )}
                      {s.comment || '—'}
                    </div>
                  </td>
                  <td style={{ padding: '16px 24px' }}>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button onClick={() => openPaymentDrawer(s)} style={{ background: 'rgba(74,222,128,0.1)', color: '#4ade80', border: 'none', borderRadius: '8px', padding: '6px 12px', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer' }}>
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
                  <td colSpan={8} style={{ padding: '48px', textAlign: 'center', color: DS.muted }}>No subscriptions found.</td>
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
              <label style={{ color: DS.muted, fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase' }}>Cost (₹)</label>
              <div style={{ position: 'relative' }}>
                <div style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: DS.muted }}>₹</div>
                <input 
                  type="number" 
                  value={formData.cost} 
                  onChange={e => setFormData({ ...formData, cost: e.target.value })} 
                  placeholder="0.00" 
                  style={{ width: '100%', background: DS.surface, color: DS.text, border: `1px solid ${DS.border}`, padding: '14px 14px 14px 32px', borderRadius: '12px', outline: 'none' }} 
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

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', position: 'relative' }}>
              <label style={{ color: DS.muted, fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase' }}>Notify Users (For Reminders)</label>
              <div 
                onClick={() => setShowNotifyDropdown(!showNotifyDropdown)}
                style={{ 
                  width: '100%', background: DS.surface, color: DS.text, border: `1px solid ${DS.border}`, 
                  padding: '12px', borderRadius: '10px', cursor: 'pointer', fontSize: '0.85rem',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                }}
              >
                <span>
                  {formData.notify_user_ids.length === 0 
                    ? "Select recipients..." 
                    : `${formData.notify_user_ids.length} selected`}
                </span>
                <ChevronDown size={14} style={{ transform: showNotifyDropdown ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
              </div>

              {showNotifyDropdown && (
                <div style={{ 
                  position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100, marginTop: '4px',
                  maxHeight: '200px', overflowY: 'auto', background: DS.card, 
                  border: `1px solid ${DS.border}`, borderRadius: '12px', padding: '8px',
                  boxShadow: '0 12px 32px rgba(0,0,0,0.4)',
                  display: 'flex', flexDirection: 'column', gap: '4px'
                }}>
                  {users.map(u => (
                    <div 
                      key={u.id} 
                      onClick={(e) => { e.stopPropagation(); toggleNotifyUser(u.id); }}
                      style={{ 
                        padding: '8px 12px', borderRadius: '8px', cursor: 'pointer',
                        background: formData.notify_user_ids.includes(u.id) ? 'rgba(14,165,233,0.1)' : 'transparent',
                        color: formData.notify_user_ids.includes(u.id) ? DS.primary : DS.text,
                        fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '10px'
                      }}
                    >
                      <input 
                        type="checkbox" 
                        checked={formData.notify_user_ids.includes(u.id)}
                        readOnly
                        style={{ accentColor: DS.primary }}
                      />
                      {u.name}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label style={{ color: DS.muted, fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase' }}>Status</label>
                <select 
                  value={formData.status} 
                  onChange={e => setFormData({ ...formData, status: e.target.value })}
                  style={{ width: '100%', background: DS.surface, color: DS.text, border: `1px solid ${DS.border}`, padding: '12px', borderRadius: '10px', outline: 'none' }}
                >
                  <option value="Active">Active</option>
                  <option value="Pending">Pending</option>
                  <option value="Cancelled">Cancelled</option>
                </select>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{ color: DS.muted, fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase' }}>Comment / Reason</label>
              <textarea 
                value={formData.comment} 
                onChange={e => setFormData({ ...formData, comment: e.target.value })} 
                placeholder="Internal notes or reasoning..."
                rows={3} 
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

      <Drawer
        isOpen={showPaymentDrawer}
        onClose={() => !uploading && setShowPaymentDrawer(false)}
        title="Confirm Payment"
        subtitle={selectedSub ? `Renewing ${selectedSub.service_name} for ₹${selectedSub.cost}` : ''}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div style={{ background: 'rgba(14,165,233,0.05)', border: `1px solid ${DS.border}`, borderRadius: '16px', padding: '20px' }}>
             <p style={{ color: DS.muted, fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', marginBottom: '12px' }}>Subscription Details</p>
             <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
               <span style={{ color: DS.text, fontSize: '0.85rem' }}>Current Due</span>
               <span style={{ color: DS.text, fontSize: '0.85rem', fontWeight: 700 }}>{selectedSub?.next_due_date}</span>
             </div>
             <div style={{ display: 'flex', justifyContent: 'space-between' }}>
               <span style={{ color: DS.text, fontSize: '0.85rem' }}>Amount</span>
               <span style={{ color: '#4ade80', fontSize: '0.85rem', fontWeight: 900 }}>₹{selectedSub?.cost}</span>
             </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label style={{ color: DS.muted, fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase' }}>Payment Remarks</label>
            <textarea 
              value={paymentComment} 
              onChange={e => setPaymentComment(e.target.value)} 
              placeholder="e.g. Paid via Corporate Credit Card, Transaction ID #..."
              rows={3} 
              style={{ width: '100%', background: DS.surface, color: DS.text, border: `1px solid ${DS.border}`, padding: '14px', borderRadius: '12px', outline: 'none', resize: 'none' }} 
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label style={{ color: DS.muted, fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase' }}>Proof of Payment</label>
            <div 
              onClick={() => document.getElementById('payment-file')?.click()}
              style={{ 
                border: `2px dashed ${paymentFile ? DS.success : DS.border}`, 
                borderRadius: '16px', padding: '32px', textAlign: 'center', cursor: 'pointer',
                background: paymentFile ? 'rgba(74,222,128,0.05)' : 'transparent',
                transition: 'all 0.2s'
              }}
            >
              <input 
                id="payment-file" type="file" hidden 
                onChange={e => setPaymentFile(e.target.files?.[0] || null)} 
                accept="image/*,.pdf,.doc,.docx"
              />
              {paymentFile ? (
                <div style={{ color: DS.success, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                  <CheckCircle2 size={32} />
                  <p style={{ fontSize: '0.85rem', fontWeight: 700, margin: 0 }}>{paymentFile.name}</p>
                  <p style={{ fontSize: '0.7rem', color: DS.muted }}>Click to change file</p>
                </div>
              ) : (
                <div style={{ color: DS.muted, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                  <Upload size={32} />
                  <p style={{ fontSize: '0.85rem', fontWeight: 700, margin: 0 }}>Click to upload proof</p>
                  <p style={{ fontSize: '0.7rem' }}>Image, PDF, or Document (Max 5MB)</p>
                </div>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
            <button 
              disabled={uploading}
              onClick={() => setShowPaymentDrawer(false)} 
              style={{ flex: 1, padding: '16px', background: 'transparent', color: DS.muted, border: `1px solid ${DS.border}`, borderRadius: '12px', cursor: 'pointer', fontWeight: 700 }}
            >
              Cancel
            </button>
            <button 
              disabled={uploading}
              onClick={() => handleRenew(selectedSub.id, selectedSub.next_due_date, selectedSub.billing_cycle)} 
              style={{ flex: 2, padding: '16px', background: 'linear-gradient(135deg, #0ea5e9, #0284c7)', color: '#fff', border: 'none', borderRadius: '12px', cursor: 'pointer', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
            >
              {uploading ? <Loader2 size={18} className="animate-spin" /> : 'Confirm & Renew'}
            </button>
          </div>
        </div>
      </Drawer>
    </div>
  );
};
