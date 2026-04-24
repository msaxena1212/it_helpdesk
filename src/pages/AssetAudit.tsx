import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { utils, write } from 'xlsx';
import { 
  History, Search, Filter, Download, ArrowRightLeft, 
  UserPlus, UserMinus, Package, Loader2, Calendar, Clock,
  ArrowUpRight, ArrowDownRight, Tag
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { format } from 'date-fns';

const DS = {
  bg: '#0f172a', card: '#131b2e', cardHigh: '#222a3d',
  border: 'rgba(14,165,233,0.12)', primary: '#0ea5e9',
  text: '#dae2fd', muted: '#88929b', surface: '#0b1326',
  success: '#4ade80', danger: '#ff4444', info: '#38bdf8'
};

export const AssetAudit = () => {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterAction, setFilterAction] = useState('all');

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('asset_history')
        .select(`
          *,
          asset:assets(device_name, device_id),
          performer:profiles!performed_by(name),
          employee:profiles!employee_id(name, department)
        `)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      setLogs(data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const filteredLogs = logs.filter(log => {
    const matchesSearch = 
      log.asset?.device_name?.toLowerCase().includes(search.toLowerCase()) ||
      log.asset?.device_id?.toLowerCase().includes(search.toLowerCase()) ||
      log.employee?.name?.toLowerCase().includes(search.toLowerCase()) ||
      log.performer?.name?.toLowerCase().includes(search.toLowerCase());
    
    const matchesAction = filterAction === 'all' || log.action === filterAction;
    
    return matchesSearch && matchesAction;
  });

  const getActionBadge = (action: string) => {
    const styles: any = {
      allocate: { icon: UserPlus, color: DS.success, label: 'Allocation', bg: 'rgba(74,222,128,0.1)' },
      deallocate: { icon: UserMinus, color: DS.danger, label: 'Release', bg: 'rgba(255,68,68,0.1)' },
      register: { icon: Package, color: DS.info, label: 'Registration', bg: 'rgba(56,189,248,0.1)' },
    };
    const s = styles[action] || { icon: ArrowRightLeft, color: DS.muted, label: action, bg: 'rgba(255,255,255,0.05)' };
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 12px', borderRadius: '8px', background: s.bg, border: `1px solid ${s.color}33` }}>
        <s.icon size={14} color={s.color} />
        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: s.color, textTransform: 'uppercase' }}>{s.label}</span>
      </div>
    );
  };

  const handleExportExcel = () => {
    const wb = utils.book_new();
    const rows = filteredLogs.map(log => ({
      Timestamp: format(new Date(log.created_at), 'yyyy-MM-dd HH:mm:ss'),
      Action: log.action.toUpperCase(),
      "Asset Name": log.asset?.device_name || 'Deleted Asset',
      "Serial ID": log.asset?.device_id || 'N/A',
      "Employee Name": log.employee?.name || 'N/A',
      "Department": log.employee?.department || 'N/A',
      "Performed By": log.performer?.name || 'System',
      Remarks: log.remarks || ''
    }));

    const ws = utils.json_to_sheet(rows);
    utils.book_append_sheet(wb, ws, "Audit Ledger");

    const wbout = write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([wbout], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `audit_ledger_${new Date().toISOString().split('T')[0]}.xlsx`;
    link.click();
  };

  if (loading) return (
    <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: DS.bg }}>
      <Loader2 className="animate-spin" color={DS.primary} size={32} />
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', background: DS.bg, padding: '32px', fontFamily: "'Inter', sans-serif" }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '32px' }}>
          <div>
            <p style={{ color: DS.muted, fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '4px' }}>Governance & Audit</p>
            <h1 style={{ color: DS.text, fontSize: '2rem', fontWeight: 800, letterSpacing: '-0.02em', marginBottom: '6px' }}>Lifecycle Audit</h1>
            <p style={{ color: DS.muted, fontSize: '0.875rem' }}>Master ledger of all hardware transactions, movements, and ownership changes.</p>
          </div>
          <button 
            onClick={handleExportExcel}
            style={{ background: DS.surface, color: DS.text, border: `1px solid ${DS.border}`, borderRadius: '12px', padding: '12px 20px', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            <Download size={16} /> Export Excel
          </button>
        </div>

        {/* Filters */}
        <div style={{ background: DS.card, borderRadius: '20px', padding: '20px', border: `1px solid ${DS.border}`, marginBottom: '24px', display: 'flex', gap: '16px', alignItems: 'center' }}>
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '12px', background: DS.surface, border: `1px solid ${DS.border}`, borderRadius: '12px', padding: '10px 16px' }}>
            <Search size={16} color={DS.muted} />
            <input 
              type="text" placeholder="Search by Asset ID, Employee Name, or Admin..." 
              value={search} onChange={e => setSearch(e.target.value)}
              style={{ background: 'none', border: 'none', outline: 'none', color: DS.text, fontSize: '0.85rem', width: '100%' }}
            />
          </div>
          <select 
            value={filterAction} onChange={e => setFilterAction(e.target.value)}
            style={{ padding: '10px 16px', borderRadius: '12px', background: DS.surface, border: `1px solid ${DS.border}`, color: DS.text, fontSize: '0.85rem', outline: 'none' }}
          >
            <option value="all">All Transactions</option>
            <option value="allocate">Allocations Only</option>
            <option value="deallocate">Releases Only</option>
            <option value="register">Registrations</option>
          </select>
        </div>

        {/* Audit Table */}
        <div style={{ background: DS.card, borderRadius: '24px', border: `1px solid ${DS.border}`, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'rgba(14,165,233,0.04)' }}>
                {['Timestamp', 'Transaction', 'Asset Details', 'Target Employee', 'Performed By'].map(h => (
                  <th key={h} style={{ padding: '16px 20px', textAlign: 'left', fontSize: '0.65rem', fontWeight: 800, color: DS.muted, letterSpacing: '0.1em', textTransform: 'uppercase' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredLogs.map((log, i) => (
                <motion.tr 
                  key={log.id} 
                  initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
                  style={{ borderTop: `1px solid ${DS.border}`, transition: 'background 0.2s' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.01)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <td style={{ padding: '20px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ color: DS.text, fontSize: '0.85rem', fontWeight: 700 }}>{format(new Date(log.created_at), 'MMM d, yyyy')}</span>
                      <span style={{ color: DS.muted, fontSize: '0.7rem' }}>{format(new Date(log.created_at), 'HH:mm:ss')}</span>
                    </div>
                  </td>
                  <td style={{ padding: '20px' }}>
                    {getActionBadge(log.action)}
                  </td>
                  <td style={{ padding: '20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(14,165,233,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: DS.primary }}>
                        <Package size={18} />
                      </div>
                      <div>
                        <p style={{ color: DS.text, fontWeight: 700, fontSize: '0.875rem', margin: 0 }}>{log.asset?.device_name || 'Deleted Asset'}</p>
                        <p style={{ color: DS.primary, fontSize: '0.7rem', fontFamily: 'monospace', margin: 0 }}>{log.asset?.device_id}</p>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '20px' }}>
                    {log.employee ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ width: '28px', height: '28px', borderRadius: '8px', background: 'linear-gradient(135deg, #0ea5e9, #1e3a5f)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '10px', fontWeight: 800 }}>
                          {log.employee.name?.[0]}
                        </div>
                        <div>
                          <p style={{ color: DS.text, fontWeight: 700, fontSize: '0.8rem', margin: 0 }}>{log.employee.name}</p>
                          <p style={{ color: DS.muted, fontSize: '0.65rem', margin: 0 }}>{log.employee.department}</p>
                        </div>
                      </div>
                    ) : (
                      <span style={{ color: DS.muted, fontSize: '0.75rem', fontStyle: 'italic' }}>— Inventory —</span>
                    )}
                  </td>
                  <td style={{ padding: '20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: DS.primary }} />
                      <span style={{ color: DS.text, fontSize: '0.8rem', fontWeight: 600 }}>{log.performer?.name || 'System'}</span>
                    </div>
                  </td>
                </motion.tr>
              ))}
              {filteredLogs.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ padding: '80px', textAlign: 'center' }}>
                    <History size={48} color="rgba(14,165,233,0.1)" style={{ margin: '0 auto 16px' }} />
                    <p style={{ color: DS.muted, fontWeight: 600 }}>No audit logs found for the selected criteria.</p>
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
