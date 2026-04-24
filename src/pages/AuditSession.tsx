import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ClipboardCheck, Search, Filter, CheckCircle2, AlertCircle, 
  Loader2, X, ChevronRight, Monitor, Package, MapPin, 
  History, CheckSquare, Square, Save, Play, StopCircle,
  AlertTriangle, Flag
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { format } from 'date-fns';

const DS = {
  bg: '#0f172a', card: '#131b2e', cardHigh: '#222a3d',
  border: 'rgba(14,165,233,0.12)', primary: '#0ea5e9',
  text: '#dae2fd', muted: '#88929b', surface: '#0b1326',
  success: '#4ade80', warning: '#ffb86e', danger: '#ff4444'
};

export const AuditSession = () => {
  const navigate = useNavigate();
  const [assets, setAssets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [sessionActive, setSessionActive] = useState(false);
  const [verifiedIds, setVerifiedIds] = useState<string[]>([]);
  const [missingIds, setMissingIds] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [showSummary, setShowSummary] = useState(false);

  useEffect(() => {
    fetchAssets();
  }, []);

  const fetchAssets = async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from('assets')
        .select('*, assigned:profiles!assigned_to(name, department)')
        .order('device_name');
      setAssets(data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleVerify = (id: string) => {
    if (missingIds.includes(id)) return; // Can't verify if marked missing
    setVerifiedIds(prev => 
      prev.includes(id) ? prev.filter(v => v !== id) : [...prev, id]
    );
  };

  const handleFlagMissing = async (asset: any) => {
    if (!window.confirm(`Flag ${asset.device_name} as MISSING? This will automatically raise a high-priority investigation ticket.`)) return;
    
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      // 1. Raise Investigation Ticket
      const { error: ticketError } = await supabase.from('tickets').insert([{
        title: `MISSING ASSET: ${asset.device_name}`,
        description: `Asset ${asset.device_name} (Serial: ${asset.device_id}) was reported missing during an audit session on ${format(new Date(), 'PPP')}. \n\nLast Assigned to: ${asset.assigned?.name || 'In Inventory'}\nAuditor: ${user?.id}`,
        priority: 'Critical',
        issue_type: 'Hardware',
        employee_id: asset.assigned_to || user?.id, // Raised on behalf of user or current admin
        status: 'Open'
      }]);

      if (ticketError) throw ticketError;

      // 2. Update Asset Status
      await supabase.from('assets').update({ status: 'missing' }).eq('id', asset.id);

      // 3. Log History
      await supabase.from('asset_history').insert([{
        asset_id: asset.id,
        action: 'missing',
        performed_by: user?.id,
        remarks: 'Asset flagged as missing during audit session. Investigation ticket raised.'
      }]);

      // 4. Sync to Google Sheets
      const googleWebhookUrl = import.meta.env.VITE_GOOGLE_WEBHOOK_URL;
      if (googleWebhookUrl) {
        fetch(googleWebhookUrl, {
          method: 'POST',
          mode: 'no-cors',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'audit',
            asset_name: asset.device_name,
            asset_id: asset.device_id,
            action: 'MISSING',
            performer: user?.email,
            remarks: 'FLAGGED MISSING DURING AUDIT. Investigation ticket raised.'
          })
        }).catch(console.error);
      }

      setMissingIds(prev => [...prev, asset.id]);
      setVerifiedIds(prev => prev.filter(v => v !== asset.id));
    } catch (e: any) {
      alert(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleFinishAudit = async () => {
    if (!window.confirm(`Finalize audit? ${verifiedIds.length} verified, ${missingIds.length} missing.`)) return;
    
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      // Batch insert verified into history
      if (verifiedIds.length > 0) {
        const historyRecords = verifiedIds.map(id => ({
          asset_id: id,
          action: 'audit',
          performed_by: user?.id,
          remarks: 'Verified during audit session'
        }));
        await supabase.from('asset_history').insert(historyRecords);

        // Sync to Google Sheets
        const googleWebhookUrl = import.meta.env.VITE_GOOGLE_WEBHOOK_URL;
        if (googleWebhookUrl) {
          verifiedIds.forEach(id => {
            const asset = assets.find(a => a.id === id);
            if (asset) {
              fetch(googleWebhookUrl, {
                method: 'POST',
                mode: 'no-cors',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  type: 'audit',
                  asset_name: asset.device_name,
                  asset_id: asset.device_id,
                  action: 'Verified',
                  performer: user?.email,
                  remarks: 'Batch verified during audit session'
                })
              }).catch(console.error);
            }
          });
        }
      }

      setShowSummary(true);
    } catch (e: any) {
      alert(e.message);
    } finally {
      setLoading(false);
    }
  };

  const filtered = assets.filter(a => 
    a.device_name.toLowerCase().includes(search.toLowerCase()) || 
    a.device_id.toLowerCase().includes(search.toLowerCase())
  );

  const progress = ((verifiedIds.length + missingIds.length) / assets.length) * 100;

  if (loading && !sessionActive) return (
    <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: DS.bg }}>
      <Loader2 className="animate-spin" color={DS.primary} size={32} />
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', background: DS.bg, padding: '32px', fontFamily: "'Inter', sans-serif" }}>
      <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
        
        {!sessionActive ? (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} style={{ textAlign: 'center', padding: '100px 20px' }}>
             <div style={{ width: '80px', height: '80px', borderRadius: '24px', background: 'rgba(14,165,233,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: DS.primary, margin: '0 auto 24px' }}>
                <ClipboardCheck size={40} />
             </div>
             <h1 style={{ color: DS.text, fontSize: '2.5rem', fontWeight: 800, marginBottom: '16px' }}>Ready to start Audit?</h1>
             <p style={{ color: DS.muted, fontSize: '1.1rem', marginBottom: '40px', maxWidth: '500px', margin: '0 auto 40px' }}>
               Initiate a complete inventory verification session. Flag missing assets to trigger automated investigation protocols.
             </p>
             <button 
               onClick={() => setSessionActive(true)}
               style={{ background: 'linear-gradient(135deg, #0ea5e9, #0284c7)', color: '#fff', border: 'none', borderRadius: '16px', padding: '16px 40px', fontSize: '1rem', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '12px', margin: '0 auto', boxShadow: '0 8px 24px rgba(14,165,233,0.3)' }}
             >
               <Play size={20} /> Begin Organization Audit
             </button>
          </motion.div>
        ) : (
          <div>
            {/* Active Session Header */}
            <div style={{ position: 'sticky', top: '32px', zIndex: 50, background: DS.bg, paddingBottom: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <div>
                  <h2 style={{ color: DS.text, fontSize: '1.5rem', fontWeight: 800, margin: 0 }}>Active Audit Session</h2>
                  <p style={{ color: DS.muted, fontSize: '0.875rem' }}>Processing {assets.length} items in organization inventory</p>
                </div>
                <div style={{ display: 'flex', gap: '12px' }}>
                   <button 
                    onClick={handleFinishAudit}
                    disabled={verifiedIds.length === 0 && missingIds.length === 0}
                    style={{ background: (verifiedIds.length + missingIds.length) > 0 ? DS.success : DS.muted, color: '#fff', border: 'none', borderRadius: '12px', padding: '12px 24px', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px' }}
                  >
                    <CheckCircle2 size={18} /> Finalize Session
                  </button>
                </div>
              </div>

              {/* Progress Bar */}
              <div style={{ height: '8px', background: DS.surface, borderRadius: '4px', overflow: 'hidden', marginBottom: '24px' }}>
                <motion.div initial={{ width: 0 }} animate={{ width: `${progress}%` }} style={{ height: '100%', background: DS.primary }} />
              </div>

              {/* Quick Filter */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', background: DS.card, padding: '12px 16px', borderRadius: '16px', border: `1px solid ${DS.border}` }}>
                 <Search size={16} color={DS.muted} />
                 <input 
                   type="text" placeholder="Quick search asset or serial..." 
                   value={search} onChange={e => setSearch(e.target.value)}
                   style={{ background: 'none', border: 'none', outline: 'none', color: DS.text, fontSize: '0.9rem', width: '100%' }}
                 />
              </div>
            </div>

            {/* Verification List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '32px' }}>
              {filtered.map(asset => {
                const isVerified = verifiedIds.includes(asset.id);
                const isMissing = missingIds.includes(asset.id) || asset.status === 'missing';
                
                return (
                  <motion.div 
                    key={asset.id} 
                    style={{ 
                      padding: '20px', background: isMissing ? 'rgba(255,68,68,0.05)' : isVerified ? 'rgba(74,222,128,0.05)' : DS.card, 
                      borderRadius: '16px', border: `1px solid ${isMissing ? DS.danger : isVerified ? DS.success : DS.border}`, 
                      display: 'flex', alignItems: 'center', gap: '20px', transition: 'all 0.2s'
                    }}
                  >
                    <div onClick={() => handleToggleVerify(asset.id)} style={{ cursor: isMissing ? 'not-allowed' : 'pointer' }}>
                      {isVerified ? <CheckSquare size={24} color={DS.success} /> : <Square size={24} color={DS.muted} />}
                    </div>
                    
                    <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(14,165,233,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: DS.primary }}>
                      <Monitor size={20} />
                    </div>
                    
                    <div style={{ flex: 1 }}>
                      <h4 style={{ color: DS.text, fontWeight: 700, fontSize: '1rem', margin: 0 }}>{asset.device_name}</h4>
                      <p style={{ color: DS.primary, fontSize: '0.75rem', fontFamily: 'monospace', margin: 0 }}>{asset.device_id}</p>
                    </div>

                    <div style={{ textAlign: 'right', display: 'flex', alignItems: 'center', gap: '20px' }}>
                       <div>
                         <p style={{ color: DS.text, fontSize: '0.8rem', fontWeight: 700, margin: 0 }}>{asset.assigned?.name || 'In Inventory'}</p>
                         <p style={{ color: DS.muted, fontSize: '0.7rem', margin: 0 }}>{asset.assigned?.department || '—'}</p>
                       </div>
                       
                       {!isVerified && !isMissing && (
                         <button 
                          onClick={(e) => { e.stopPropagation(); handleFlagMissing(asset); }}
                          style={{ background: 'rgba(255,68,68,0.1)', color: DS.danger, border: `1px solid ${DS.danger}33`, borderRadius: '8px', padding: '8px 12px', fontSize: '0.7rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                         >
                           <Flag size={14} /> Mark Missing
                         </button>
                       )}
                       
                       {isMissing && (
                         <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: DS.danger, fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase' }}>
                           <AlertTriangle size={14} /> Missing
                         </div>
                       )}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        )}

        {/* Summary Modal */}
        <AnimatePresence>
          {showSummary && (
            <div style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(10px)' }} />
              <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} style={{ position: 'relative', width: '100%', maxWidth: '480px', background: DS.card, borderRadius: '28px', border: `1px solid ${DS.border}`, padding: '40px', textAlign: 'center' }}>
                <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: 'rgba(74,222,128,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: DS.success, margin: '0 auto 24px' }}>
                  <CheckCircle2 size={40} />
                </div>
                <h2 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '12px' }}>Audit Finalized!</h2>
                <div style={{ display: 'flex', justifyContent: 'center', gap: '20px', marginBottom: '24px' }}>
                   <div style={{ textAlign: 'center' }}>
                      <p style={{ fontSize: '1.5rem', fontWeight: 800, margin: 0, color: DS.success }}>{verifiedIds.length}</p>
                      <p style={{ fontSize: '0.65rem', color: DS.muted, textTransform: 'uppercase' }}>Verified</p>
                   </div>
                   <div style={{ textAlign: 'center' }}>
                      <p style={{ fontSize: '1.5rem', fontWeight: 800, margin: 0, color: DS.danger }}>{missingIds.length}</p>
                      <p style={{ fontSize: '0.65rem', color: DS.muted, textTransform: 'uppercase' }}>Missing</p>
                   </div>
                </div>
                <p style={{ color: DS.muted, marginBottom: '32px', fontSize: '0.9rem' }}>
                  Critical investigation tickets have been raised for all missing equipment. Inventory records have been updated.
                </p>
                <button 
                  onClick={() => navigate('/assets/audit')}
                  style={{ width: '100%', background: 'linear-gradient(135deg, #0ea5e9, #0284c7)', color: '#fff', border: 'none', borderRadius: '14px', padding: '16px', fontWeight: 800, cursor: 'pointer' }}
                >
                  View Lifecycle Ledger
                </button>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
