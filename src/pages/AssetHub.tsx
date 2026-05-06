import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Plus, Search, Monitor, History, Edit2, 
  CheckCircle, Clock, Package, Download, LayoutGrid,
  FileUp, Trash2, UserPlus, ClipboardCheck, X, CheckCircle2,
  AlertCircle, Loader2
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { format } from 'date-fns';
import { utils, write, readFile } from 'xlsx';
import { Drawer } from '../components/Drawer';

const DS = {
  bg: '#0f172a', card: '#131b2e', cardHigh: '#222a3d',
  border: 'rgba(14,165,233,0.12)', primary: '#0ea5e9',
  text: '#dae2fd', muted: '#88929b', surface: '#0b1326',
  success: '#4ade80', danger: '#ff4444', warning: '#ffb86e',
};

export const AssetHub = () => {
  const [assets, setAssets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [showAllocModal, setShowAllocModal] = useState(false);
  const [showAuditModal, setShowAuditModal] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [allocUser, setAllocUser] = useState('');
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [bulkInput, setBulkInput] = useState('');

  const [assetForm, setAssetForm] = useState({
    device_name: '',
    device_id: '',
    purchase_date: '',
    status: 'active'
  });

  const [auditForm, setAuditForm] = useState({
    condition: 'good',
    location: 'Office',
    remarks: '',
    verified: false
  });

  useEffect(() => {
    fetchAssets();
    fetchUsers();
  }, []);

  const fetchAssets = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('assets')
        .select(`
          *,
          assigned:profiles!assigned_to(name, department)
        `)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setAssets(data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    const { data } = await supabase.from('profiles').select('id, name, department');
    setUsers(data || []);
  };

  const handleAddAsset = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from('assets')
        .insert([assetForm])
        .select()
        .single();
      if (error) throw error;
      
      // Log history
      await supabase.from('asset_history').insert({
        asset_id: data.id,
        action: 'register',
        performed_by: user?.id,
        remarks: 'Initial hardware registration'
      });

      setShowAddModal(false);
      resetForm();
      fetchAssets();
    } catch (e) {
      console.error(e);
    }
  };

  const handleUpdateAsset = async () => {
    if (!selectedAsset) return;
    try {
      const { error } = await supabase
        .from('assets')
        .update(assetForm)
        .eq('id', selectedAsset.id);
      if (error) throw error;
      setShowEditModal(false);
      fetchAssets();
    } catch (e) {
      console.error(e);
    }
  };

  const handleAllocate = async () => {
    if (!selectedAsset || !allocUser) return;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase
        .from('assets')
        .update({ assigned_to: allocUser })
        .eq('id', selectedAsset.id);
      
      if (error) throw error;

      await supabase.from('asset_history').insert({
        asset_id: selectedAsset.id,
        action: 'allocate',
        employee_id: allocUser,
        performed_by: user?.id,
        remarks: 'Hardware assignment'
      });

      setShowAllocModal(false);
      setAllocUser('');
      fetchAssets();
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeallocate = async (asset: any) => {
    if (!confirm('Release this asset back to inventory?')) return;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase
        .from('assets')
        .update({ assigned_to: null })
        .eq('id', asset.id);
      
      if (error) throw error;

      await supabase.from('asset_history').insert({
        asset_id: asset.id,
        action: 'deallocate',
        employee_id: asset.assigned_to,
        performed_by: user?.id,
        remarks: 'Asset returned to pool'
      });

      fetchAssets();
    } catch (e) {
      console.error(e);
    }
  };

  const handleAuditAsset = async () => {
    if (!selectedAsset) return;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { error: updateError } = await supabase
        .from('assets')
        .update({ 
          last_audited: new Date().toISOString(),
          status: auditForm.condition === 'damaged' ? 'repair' : selectedAsset.status
        })
        .eq('id', selectedAsset.id);

      if (updateError) throw updateError;

      await supabase.from('asset_history').insert({
        asset_id: selectedAsset.id,
        action: 'audit',
        performed_by: user?.id,
        remarks: `Physical Audit: ${auditForm.condition.toUpperCase()} at ${auditForm.location}. ${auditForm.remarks}`
      });

      setShowAuditModal(false);
      setAuditForm({ condition: 'good', location: 'Office', remarks: '', verified: false });
      fetchAssets();
    } catch (e) {
      console.error(e);
    }
  };

  const handleExportExcel = () => {
    const wb = utils.book_new();
    const rows = assets.map(a => ({
      "Model Name": a.device_name,
      "Serial ID": a.device_id,
      "Current Owner": a.assigned?.name || 'In Inventory',
      "Department": a.assigned?.department || 'N/A',
      "Purchase Date": a.purchase_date || 'N/A',
      "Status": a.status,
      "Last Audited": a.last_audited ? format(new Date(a.last_audited), 'yyyy-MM-dd') : 'Never'
    }));
    const ws = utils.json_to_sheet(rows);
    utils.book_append_sheet(wb, ws, "Assets");
    const wbout = write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([wbout], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `asset_inventory_${new Date().toISOString().split('T')[0]}.xlsx`;
    link.click();
  };

  const handleExcelUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const bstr = evt.target?.result;
      const wb = readFile(bstr as any, { type: 'binary' });
      const wsname = wb.SheetNames[0];
      const ws = wb.Sheets[wsname];
      const data = utils.sheet_to_json(ws, { header: 1 });
      const csv = data.map((row: any) => row.join(',')).join('\n');
      setBulkInput(csv);
    };
    reader.readAsBinaryString(file);
  };

  const handleDownloadSample = () => {
    const wb = utils.book_new();
    const sample = [
      ["Model Name", "Serial ID", "Purchase Date (YYYY-MM-DD)", "Status"],
      ["MacBook Pro M3", "SN-992-EM", "2024-01-15", "active"],
      ["Dell XPS 15", "SN-112-EM", "2023-11-20", "active"]
    ];
    const ws = utils.json_to_sheet(sample, { skipHeader: true });
    utils.book_append_sheet(wb, ws, "Sample");
    const wbout = write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([wbout], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "asset_bulk_template.xlsx";
    link.click();
  };

  const handleBulkAdd = async () => {
    if (!bulkInput.trim()) return;
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const lines = bulkInput.split('\n').filter(l => l.trim().length > 0);
      
      const assetsToInsert = lines.map(line => {
        const parts = line.includes('\t') ? line.split('\t') : line.split(',');
        
        // Parse date (support various formats)
        let purchaseDate = null;
        if (parts[2]?.trim()) {
          const d = new Date(parts[2].trim());
          if (!isNaN(d.getTime())) purchaseDate = d.toISOString().split('T')[0];
        }

        return {
          device_name: parts[0]?.trim() || 'Unknown Device',
          device_id: parts[1]?.trim() || `SN-${Math.random().toString(36).substring(7).toUpperCase()}`,
          purchase_date: purchaseDate,
          status: (parts[3]?.trim()?.toLowerCase() || 'active') as any
        };
      });

      const { data: insertedAssets, error: insertError } = await supabase
        .from('assets')
        .insert(assetsToInsert)
        .select();

      if (insertError) throw insertError;

      // Log history
      const historyLogs = insertedAssets.map(asset => ({
        asset_id: asset.id,
        action: 'register',
        performed_by: user?.id,
        remarks: 'Bulk import from spreadsheet'
      }));

      await supabase.from('asset_history').insert(historyLogs);
      setShowBulkModal(false);
      setBulkInput('');
      fetchAssets();
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const fetchHistory = async (asset: any) => {
    setSelectedAsset(asset);
    setShowHistory(true);
    try {
      const { data, error } = await supabase
        .from('asset_history')
        .select(`
          id, 
          action, 
          remarks, 
          created_at,
          performer:profiles!performed_by(name),
          employee:profiles!employee_id(name)
        `)
        .eq('asset_id', asset.id)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      setHistory(data || []);
    } catch (e) {
      console.error(e);
    }
  };

  const openEdit = (asset: any) => {
    setSelectedAsset(asset);
    setAssetForm({
      device_name: asset.device_name,
      device_id: asset.device_id,
      purchase_date: asset.purchase_date || '',
      status: asset.status || 'active'
    });
    setShowEditModal(true);
  };

  const resetForm = () => setAssetForm({ device_name: '', device_id: '', purchase_date: '', status: 'active' });

  const filtered = assets.filter(a => 
    a.device_name.toLowerCase().includes(search.toLowerCase()) || 
    a.device_id.toLowerCase().includes(search.toLowerCase()) ||
    a.assigned?.name?.toLowerCase().includes(search.toLowerCase())
  );

  const stats = [
    { label: 'Total Assets', value: assets.length, icon: Package, color: '#89ceff', bg: 'rgba(14,165,233,0.12)' },
    { label: 'Allocated', value: assets.filter(a => a.assigned_to).length, icon: CheckCircle, color: '#4ade80', bg: 'rgba(74,222,128,0.12)' },
    { label: 'Available', value: assets.filter(a => !a.assigned_to).length, icon: Clock, color: '#ffb86e', bg: 'rgba(255,184,110,0.12)' },
  ];

  if (loading) return (
    <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: DS.bg }}>
      <Loader2 className="animate-spin" color={DS.primary} size={32} />
    </div>
  );

  return (
    <>
      <div style={{ minHeight: '100vh', background: DS.bg, padding: '32px', fontFamily: "'Inter', sans-serif" }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>

          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '32px' }}>
            <div>
              <p style={{ color: DS.muted, fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '4px' }}>Hardware Inventory</p>
              <h1 style={{ color: DS.text, fontSize: '2rem', fontWeight: 800, letterSpacing: '-0.02em', marginBottom: '6px' }}>Asset Management</h1>
              <p style={{ color: DS.muted, fontSize: '0.875rem' }}>Track device lifecycle, allocations, and service history across the organization.</p>
            </div>
            <div style={{ display: 'flex', gap: '12px' }}>
              <motion.button 
                whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                onClick={handleExportExcel}
                style={{ background: DS.surface, color: DS.text, border: `1px solid ${DS.border}`, borderRadius: '12px', padding: '12px 24px', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
              >
                <Download size={18} /> Export Excel
              </motion.button>
              <motion.button 
                whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                onClick={() => setShowBulkModal(true)}
                style={{ background: DS.card, color: DS.text, border: `1px solid ${DS.border}`, borderRadius: '12px', padding: '12px 24px', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
              >
                <LayoutGrid size={18} /> Bulk Add
              </motion.button>
              <motion.button 
                whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                onClick={() => { resetForm(); setShowAddModal(true); }}
                style={{ background: 'linear-gradient(135deg, #0ea5e9, #0284c7)', color: '#fff', border: 'none', borderRadius: '12px', padding: '12px 24px', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 8px 20px rgba(14,165,233,0.3)' }}
              >
                <Plus size={18} /> Register Asset
              </motion.button>
            </div>
          </div>

          {/* Stats Ribbon */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '32px' }}>
            {stats.map((s, i) => (
              <motion.div key={s.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }} style={{ background: DS.card, borderRadius: '16px', padding: '20px', border: `1px solid ${DS.border}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <p style={{ color: DS.muted, fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' }}>{s.label}</p>
                  <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: s.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <s.icon size={18} color={s.color} />
                  </div>
                </div>
                <h3 style={{ color: DS.text, fontSize: '2rem', fontWeight: 800, lineHeight: 1 }}>{s.value}</h3>
              </motion.div>
            ))}
          </div>

          {/* Filter Bar */}
          <div style={{ background: DS.card, borderRadius: '16px', padding: '16px 20px', border: `1px solid ${DS.border}`, marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: DS.surface, border: `1px solid ${DS.border}`, borderRadius: '10px', padding: '10px 16px', flex: 1 }}>
              <Search size={16} color={DS.muted} />
              <input 
                type="text" placeholder="Search by Device Name, Serial ID, or Owner..." 
                value={search} onChange={e => setSearch(e.target.value)}
                style={{ background: 'none', border: 'none', outline: 'none', color: DS.text, fontSize: '0.85rem', width: '100%' }}
              />
            </div>
          </div>

          {/* Asset Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '20px' }}>
            {filtered.map((asset, i) => (
              <motion.div 
                key={asset.id} 
                initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                style={{ background: DS.card, borderRadius: '24px', border: `1px solid ${DS.border}`, padding: '24px', position: 'relative', overflow: 'hidden' }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
                  <div style={{ width: '48px', height: '48px', borderRadius: '14px', background: 'rgba(14,165,233,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: DS.primary }}>
                    <Monitor size={24} />
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button title="Audit Verification" onClick={() => { setSelectedAsset(asset); setShowAuditModal(true); }} style={{ padding: '8px', borderRadius: '8px', border: `1px solid ${DS.border}`, background: 'rgba(74,222,128,0.05)', color: DS.success, cursor: 'pointer' }}><ClipboardCheck size={16} /></button>
                    <button title="Lifecycle History" onClick={() => fetchHistory(asset)} style={{ padding: '8px', borderRadius: '8px', border: `1px solid ${DS.border}`, background: 'transparent', color: DS.muted, cursor: 'pointer' }}><History size={16} /></button>
                    <button title="Edit Details" onClick={() => openEdit(asset)} style={{ padding: '8px', borderRadius: '8px', border: `1px solid ${DS.border}`, background: 'transparent', color: DS.muted, cursor: 'pointer' }}><Edit2 size={16} /></button>
                  </div>
                </div>

                <div style={{ marginBottom: '20px' }}>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 800, marginBottom: '4px' }}>{asset.device_name}</h3>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <p style={{ fontSize: '0.75rem', fontFamily: 'monospace', color: DS.primary, fontWeight: 700, margin: 0 }}>{asset.device_id}</p>
                    {asset.last_audited && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: DS.success, fontSize: '0.65rem', fontWeight: 700 }}>
                          <CheckCircle2 size={10} /> Verified {format(new Date(asset.last_audited), 'MMM d')}
                      </div>
                    )}
                  </div>
                </div>

                {/* Assignment State */}
                <div style={{ background: 'rgba(0,0,0,0.2)', borderRadius: '16px', padding: '16px', marginBottom: '20px', border: `1px solid ${DS.border}` }}>
                  {asset.assigned ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'linear-gradient(135deg, #0ea5e9, #1e3a5f)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '10px', fontWeight: 800 }}>
                        {asset.assigned.name?.[0]}
                      </div>
                      <div style={{ flex: 1 }}>
                        <p style={{ fontSize: '0.8rem', fontWeight: 700, margin: 0 }}>{asset.assigned.name}</p>
                        <p style={{ fontSize: '0.65rem', color: DS.muted, margin: 0 }}>{asset.assigned.department}</p>
                      </div>
                      <button onClick={() => handleDeallocate(asset)} style={{ padding: '6px 12px', borderRadius: '8px', border: `1px solid ${DS.border}`, background: 'transparent', color: DS.danger, fontSize: '0.7rem', fontWeight: 700, cursor: 'pointer' }}>Release</button>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: DS.muted }}>
                        <AlertCircle size={14} />
                        <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>Unassigned Inventory</span>
                      </div>
                      <button 
                        onClick={() => { setSelectedAsset(asset); setShowAllocModal(true); }}
                        style={{ padding: '6px 16px', borderRadius: '8px', background: 'rgba(14,165,233,0.1)', border: `1px solid ${DS.primary}`, color: DS.primary, fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer' }}
                      >
                        Allocate Now
                      </button>
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: DS.muted }}>
                  <span>Status: <b style={{ color: asset.status === 'active' ? DS.success : asset.status === 'repair' ? DS.warning : DS.danger, textTransform: 'uppercase' }}>{asset.status}</b></span>
                  <span>Purchased: <b>{asset.purchase_date ? format(new Date(asset.purchase_date), 'MMM yyyy') : 'N/A'}</b></span>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>

      {/* Audit Drawer */}
      <Drawer
        isOpen={showAuditModal}
        onClose={() => setShowAuditModal(false)}
        title="Physical Audit"
        subtitle={`Verifying condition of ${selectedAsset?.device_name}`}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div style={{ marginBottom: '8px', padding: '16px', background: 'rgba(14,165,233,0.05)', borderRadius: '16px', border: `1px solid ${DS.border}` }}>
            <p style={{ color: DS.muted, fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', marginBottom: '4px' }}>Auditing Asset</p>
            <p style={{ color: DS.text, fontWeight: 700, margin: 0 }}>{selectedAsset?.device_name}</p>
            <p style={{ color: DS.primary, fontSize: '0.75rem', fontFamily: 'monospace', margin: 0 }}>{selectedAsset?.device_id}</p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label style={{ fontSize: '0.7rem', fontWeight: 800, color: DS.muted, textTransform: 'uppercase' }}>Asset Condition</label>
                <select value={auditForm.condition} onChange={e => setAuditForm({...auditForm, condition: e.target.value})} style={{ width: '100%', padding: '12px', borderRadius: '12px', background: DS.surface, border: `1px solid ${DS.border}`, color: DS.text, outline: 'none' }}>
                  <option value="pristine">✨ Pristine</option>
                  <option value="good">✅ Good</option>
                  <option value="fair">🟡 Fair</option>
                  <option value="damaged">🔴 Damaged</option>
                </select>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label style={{ fontSize: '0.7rem', fontWeight: 800, color: DS.muted, textTransform: 'uppercase' }}>Current Location</label>
                <select value={auditForm.location} onChange={e => setAuditForm({...auditForm, location: e.target.value})} style={{ width: '100%', padding: '12px', borderRadius: '12px', background: DS.surface, border: `1px solid ${DS.border}`, color: DS.text, outline: 'none' }}>
                  <option value="Office">Office HQ</option>
                  <option value="Remote">Remote / Home</option>
                  <option value="Satellite">Satellite Office</option>
                  <option value="Repair">Repair Center</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{ fontSize: '0.7rem', fontWeight: 800, color: DS.muted, textTransform: 'uppercase' }}>Audit Remarks</label>
              <textarea value={auditForm.remarks} onChange={e => setAuditForm({...auditForm, remarks: e.target.value})} placeholder="Any observations during physical verification..." style={{ width: '100%', padding: '12px', borderRadius: '12px', background: DS.surface, border: `1px solid ${DS.border}`, color: DS.text, outline: 'none', height: '120px', resize: 'none' }} />
            </div>

            <label style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', padding: '16px', borderRadius: '12px', background: auditForm.verified ? 'rgba(74,222,128,0.05)' : 'transparent', border: `1px solid ${auditForm.verified ? DS.success : DS.border}`, transition: 'all 0.2s' }}>
              <input type="checkbox" checked={auditForm.verified} onChange={e => setAuditForm({...auditForm, verified: e.target.checked})} style={{ width: '20px', height: '20px', accentColor: DS.success }} />
              <span style={{ fontSize: '0.9rem', color: DS.text, fontWeight: 600 }}>I have physically verified this asset</span>
            </label>
          </div>

          <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
            <button onClick={() => setShowAuditModal(false)} style={{ flex: 1, padding: '16px', borderRadius: '12px', background: 'transparent', border: `1px solid ${DS.border}`, color: DS.muted, fontWeight: 700, cursor: 'pointer' }}>Cancel</button>
            <button 
              onClick={handleAuditAsset} 
              disabled={!auditForm.verified}
              style={{ flex: 2, background: auditForm.verified ? 'linear-gradient(135deg, #4ade80, #22c55e)' : DS.muted, border: 'none', borderRadius: '14px', padding: '16px', color: '#fff', fontWeight: 800, cursor: auditForm.verified ? 'pointer' : 'not-allowed', boxShadow: auditForm.verified ? '0 8px 20px rgba(74,222,128,0.3)' : 'none' }}
            >
              Complete Verification
            </button>
          </div>
        </div>
      </Drawer>

      {/* Add / Edit Asset Drawer */}
      <Drawer
        isOpen={showAddModal || showEditModal}
        onClose={() => { setShowAddModal(false); setShowEditModal(false); }}
        title={showAddModal ? 'Register New Device' : 'Edit Device Details'}
        subtitle={showAddModal ? 'Add a new hardware asset to the inventory' : `Updating details for ${assetForm.device_name}`}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{ fontSize: '0.7rem', fontWeight: 800, color: DS.muted, textTransform: 'uppercase' }}>Model Name</label>
              <input type="text" value={assetForm.device_name} onChange={e => setAssetForm({...assetForm, device_name: e.target.value})} placeholder="e.g. MacBook Pro M3" style={{ width: '100%', padding: '14px', borderRadius: '12px', background: DS.surface, border: `1px solid ${DS.border}`, color: DS.text, outline: 'none' }} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{ fontSize: '0.7rem', fontWeight: 800, color: DS.muted, textTransform: 'uppercase' }}>Serial Number / ID</label>
              <input type="text" value={assetForm.device_id} onChange={e => setAssetForm({...assetForm, device_id: e.target.value})} placeholder="e.g. EM-MB-2024-001" style={{ width: '100%', padding: '14px', borderRadius: '12px', background: DS.surface, border: `1px solid ${DS.border}`, color: DS.text, outline: 'none' }} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
               <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                 <label style={{ fontSize: '0.7rem', fontWeight: 800, color: DS.muted, textTransform: 'uppercase' }}>Purchase Date</label>
                 <input type="date" value={assetForm.purchase_date} onChange={e => setAssetForm({...assetForm, purchase_date: e.target.value})} style={{ width: '100%', padding: '14px', borderRadius: '12px', background: DS.surface, border: `1px solid ${DS.border}`, color: DS.text, outline: 'none' }} />
               </div>
               <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                 <label style={{ fontSize: '0.7rem', fontWeight: 800, color: DS.muted, textTransform: 'uppercase' }}>Current Status</label>
                 <select value={assetForm.status} onChange={e => setAssetForm({...assetForm, status: e.target.value})} style={{ width: '100%', padding: '14px', borderRadius: '12px', background: DS.surface, border: `1px solid ${DS.border}`, color: DS.text, outline: 'none' }}>
                   <option value="active">Active</option>
                   <option value="repair">Under Repair</option>
                   <option value="retired">Retired</option>
                 </select>
               </div>
            </div>
          </div>
          
          <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
            <button onClick={() => { setShowAddModal(false); setShowEditModal(false); }} style={{ flex: 1, padding: '16px', borderRadius: '12px', background: 'transparent', border: `1px solid ${DS.border}`, color: DS.muted, fontWeight: 700, cursor: 'pointer' }}>Cancel</button>
            <button 
              onClick={showAddModal ? handleAddAsset : handleUpdateAsset} 
              style={{ flex: 2, background: 'linear-gradient(135deg, #0ea5e9, #0284c7)', border: 'none', borderRadius: '14px', padding: '16px', color: '#fff', fontWeight: 800, cursor: 'pointer', boxShadow: '0 8px 24px rgba(14,165,233,0.3)' }}
            >
              {showAddModal ? 'Complete Registration' : 'Save Changes'}
            </button>
          </div>
        </div>
      </Drawer>

      {/* Bulk Add Drawer */}
      <Drawer
        isOpen={showBulkModal}
        onClose={() => setShowBulkModal(false)}
        title="Bulk Register Assets"
        subtitle="Upload Excel or paste multiple device records"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <p style={{ color: DS.muted, fontSize: '0.85rem', margin: 0 }}>
            Upload an Excel file or paste data directly (one per line):<br/>
            <code style={{ color: DS.primary, background: 'rgba(0,0,0,0.3)', padding: '2px 4px', borderRadius: '4px' }}>Model, Serial, Purchase Date, Status</code>
          </p>

          <input 
            type="file" accept=".xlsx, .xls, .csv" 
            ref={fileInputRef} onChange={handleExcelUpload} 
            style={{ display: 'none' }} 
          />

          <div style={{ display: 'flex', gap: '12px' }}>
            <motion.button
              whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
              onClick={() => fileInputRef.current?.click()}
              style={{ flex: 1, background: 'rgba(14,165,233,0.1)', border: `1px dashed ${DS.primary}`, borderRadius: '14px', padding: '16px', color: DS.primary, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}
            >
              <FileUp size={20} /> Upload File
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
              onClick={handleDownloadSample}
              style={{ flex: 1, background: 'rgba(74,222,128,0.1)', border: `1px solid ${DS.success}`, borderRadius: '14px', padding: '16px', color: DS.success, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}
            >
              <Download size={20} /> Template
            </motion.button>
          </div>

          <textarea 
            value={bulkInput}
            onChange={e => setBulkInput(e.target.value)}
            placeholder="Or paste data here...&#10;MacBook Pro, SN-123, 2024-01-01, active"
            style={{ width: '100%', height: '200px', padding: '16px', borderRadius: '16px', background: DS.surface, border: `1px solid ${DS.border}`, color: DS.text, outline: 'none', resize: 'none', fontFamily: 'monospace', fontSize: '0.85rem' }}
          />

          <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
            <button onClick={() => setShowBulkModal(false)} style={{ flex: 1, padding: '16px', borderRadius: '12px', background: 'transparent', border: `1px solid ${DS.border}`, color: DS.muted, fontWeight: 700, cursor: 'pointer' }}>Cancel</button>
            <button 
              onClick={handleBulkAdd} 
              style={{ flex: 2, background: 'linear-gradient(135deg, #0ea5e9, #0284c7)', border: 'none', borderRadius: '14px', padding: '16px', color: '#fff', fontWeight: 800, cursor: 'pointer', boxShadow: '0 8px 24px rgba(14,165,233,0.3)' }}
            >
              Import Assets
            </button>
          </div>
        </div>
      </Drawer>

      {/* Allocation Drawer */}
      <Drawer
        isOpen={showAllocModal}
        onClose={() => setShowAllocModal(false)}
        title="Allocate Asset"
        subtitle={`Assigning ${selectedAsset?.device_name} to a team member`}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div style={{ padding: '16px', background: 'rgba(14,165,233,0.05)', borderRadius: '16px', border: `1px solid ${DS.border}` }}>
            <p style={{ color: DS.muted, fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', marginBottom: '4px' }}>Target Device</p>
            <p style={{ color: DS.text, fontWeight: 700, margin: 0 }}>{selectedAsset?.device_name}</p>
            <p style={{ color: DS.primary, fontSize: '0.75rem', fontFamily: 'monospace', margin: 0 }}>{selectedAsset?.device_id}</p>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <label style={{ fontSize: '0.75rem', fontWeight: 800, color: DS.muted, textTransform: 'uppercase' }}>Select Employee</label>
            <select value={allocUser} onChange={e => setAllocUser(e.target.value)} style={{ width: '100%', padding: '16px', borderRadius: '14px', background: DS.surface, border: `1px solid ${DS.border}`, color: DS.text, outline: 'none' }}>
              <option value="">Choose team member...</option>
              {users.map(u => <option key={u.id} value={u.id}>{u.name} ({u.department})</option>)}
            </select>
          </div>

          <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
            <button onClick={() => setShowAllocModal(false)} style={{ flex: 1, padding: '16px', borderRadius: '12px', background: 'transparent', border: `1px solid ${DS.border}`, color: DS.muted, fontWeight: 700, cursor: 'pointer' }}>Cancel</button>
            <button 
              onClick={handleAllocate} 
              style={{ flex: 2, background: 'linear-gradient(135deg, #0ea5e9, #0284c7)', border: 'none', borderRadius: '14px', padding: '16px', color: '#fff', fontWeight: 800, cursor: 'pointer', boxShadow: '0 8px 24px rgba(14,165,233,0.3)' }}
            >
              Confirm Allocation
            </button>
          </div>
        </div>
      </Drawer>

      {/* History Slide-over */}
      <AnimatePresence>
        {showHistory && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 150 }}>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowHistory(false)} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }} />
            <motion.div initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'spring', damping: 25, stiffness: 200 }} style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: '400px', background: DS.card, borderLeft: `1px solid ${DS.border}`, padding: '32px', overflowY: 'auto' }}>
               <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
                 <h2 style={{ fontSize: '1.25rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '12px' }}><History size={24} color={DS.primary} /> Lifecycle Audit</h2>
                 <button onClick={() => setShowHistory(false)} style={{ background: 'none', border: 'none', color: DS.muted, cursor: 'pointer' }}><X size={24} /></button>
               </div>
               
               <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                 {history.map((h, i) => (
                   <div key={h.id} style={{ display: 'flex', gap: '16px', position: 'relative' }}>
                     {i < history.length - 1 && <div style={{ position: 'absolute', left: '11px', top: '24px', bottom: '-24px', width: '2px', background: DS.border }} />}
                     <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: h.action === 'allocate' ? DS.success : h.action === 'register' ? DS.primary : h.action === 'audit' ? DS.success : DS.danger, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, border: `4px solid ${DS.card}`, zIndex: 1 }}>
                       {h.action === 'audit' ? <ClipboardCheck size={12} color="#fff" /> : <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#fff' }} />}
                     </div>
                     <div style={{ flex: 1 }}>
                       <p style={{ color: DS.text, fontSize: '0.875rem', fontWeight: 700, margin: '0 0 4px' }}>
                        {h.action === 'register' ? 'Asset Registered' : 
                         h.action === 'allocate' ? `Allocated to ${h.employee?.name || 'User'}` : 
                         h.action === 'audit' ? 'Physical Audit Verification' :
                         `Released from ${h.employee?.name || 'User'}`}
                       </p>
                       <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                         <p style={{ fontSize: '0.75rem', color: DS.muted, margin: 0, fontStyle: 'italic' }}>{h.remarks}</p>
                         <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                           <span style={{ fontSize: '0.7rem', color: DS.muted }}>{format(new Date(h.created_at), 'PPP p')}</span>
                           <span style={{ fontSize: '0.7rem', color: DS.primary, fontWeight: 700 }}>• By {h.performer?.name || 'System'}</span>
                         </div>
                       </div>
                     </div>
                   </div>
                 ))}
                 {history.length === 0 && <p style={{ color: DS.muted, textAlign: 'center', padding: '40px' }}>No lifecycle events found for this asset.</p>}
               </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
};
