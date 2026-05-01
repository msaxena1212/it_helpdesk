import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, ChevronDown, Clock, ShieldAlert, User, Mail, Building2, 
  Activity, CheckSquare, AlertCircle, Loader2, Calendar, Tag as TagIcon,
  CheckCircle2, History, UserPlus, X, Upload, MessageSquare, Camera,
  ShoppingCart, Truck, Package, Tag, RefreshCw
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../lib/supabase';
import { 
  updateStatus, assignTicket, getAllUsers, VALID_TRANSITIONS, 
  getActivityLogs, addComment, requestInventory, updateProcurementStatus,
  updateDevOpsStatus, resubmitForDevOps
} from '../lib/api';
import { useAuth } from '../lib/AuthContext';
import { format } from 'date-fns';

const DS = {
  bg: '#0f172a', card: '#131b2e', cardHigh: '#1e293b',
  border: 'rgba(14,165,233,0.12)', primary: '#0ea5e9',
  text: '#dae2fd', muted: '#88929b', surface: '#0b1326',
  accent: '#0ea5e9', success: '#4ade80', warning: '#ffb86e', danger: '#ff4444'
};

export const TicketDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [ticket, setTicket] = useState<any>(null);
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<any[]>([]);
  const [updating, setUpdating] = useState(false);
  const { profile } = useAuth();
  const userRole = profile?.role || 'employee';

  // Inventory Request Modal State
  const [showInvModal, setShowInvModal] = useState(false);
  const [invManagerId, setInvManagerId] = useState('');
  const [invRemarks, setInvRemarks] = useState('');

  // Status Change Modal State
  const [showResModal, setShowResModal] = useState(false);
  const [pendingStatus, setPendingStatus] = useState('');
  const [remarks, setRemarks] = useState('');
  const [image, setImage] = useState<File | null>(null);

  // DevOps Action Modal State
  const [showDevOpsModal, setShowDevOpsModal] = useState(false);
  const [devOpsAction, setDevOpsAction] = useState('');
  const [devOpsRemarks, setDevOpsRemarks] = useState('');
  const [errorLogs, setErrorLogs] = useState('');
  const [errorScreenshot, setErrorScreenshot] = useState<File | null>(null);

  useEffect(() => {
    fetchTicket();
    fetchUsers();
    fetchLogs();
  }, [id]);

  const fetchTicket = async () => {
    try {
      const { data, error } = await supabase
        .from('tickets')
        .select(`
          *,
          employee:profiles!employee_id(name, email, department, role),
          assigned:profiles!assigned_to(name, email)
        `)
        .eq('id', id)
        .single();
      
      if (error) throw error;
      setTicket(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const fetchLogs = async () => {
    try {
      const data = await getActivityLogs(id as string);
      setLogs(data || []);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchUsers = async () => {
    const data = await getAllUsers();
    setUsers(data || []);
  };

  const handleStatusUpdate = (newStatus: string) => {
    if (newStatus === 'Waiting for Inventory') {
      setShowInvModal(true);
      return;
    }
    const restricted = ['Waiting for User', 'Resolved', 'Closed'];
    if (restricted.includes(newStatus)) {
      setPendingStatus(newStatus);
      setShowResModal(true);
    } else {
      executeStatusUpdate(newStatus);
    }
  };

  const handleRequestInventory = async () => {
    if (!invManagerId || !invRemarks) return;
    setUpdating(true);
    try {
      await requestInventory(ticket.id, invManagerId, invRemarks);
      setShowInvModal(false);
      setInvRemarks('');
      await Promise.all([fetchTicket(), fetchLogs()]);
    } catch (e: any) {
      alert(e.message);
    } finally {
      setUpdating(false);
    }
  };

  const handleProcurementAction = async (nextStatus: string) => {
    setUpdating(true);
    try {
      await updateProcurementStatus(ticket.id, nextStatus);
      await Promise.all([fetchTicket(), fetchLogs()]);
    } catch (e: any) {
      alert(e.message);
    } finally {
      setUpdating(false);
    }
  };

  const executeStatusUpdate = async (newStatus: string, finalRemarks?: string) => {
    setUpdating(true);
    try {
      await updateStatus(ticket.id, ticket.status, newStatus);
      
      // If there are remarks, add them as a comment
      if (finalRemarks) {
        await addComment(ticket.id, `[Status Update: ${newStatus}] ${finalRemarks}`);
      }

      setShowResModal(false);
      setRemarks('');
      setImage(null);
      await Promise.all([fetchTicket(), fetchLogs()]);
    } catch (e: any) {
      alert(e.message);
    } finally {
      setUpdating(false);
    }
  };

  const handleAssign = async (adminId: string) => {
    setUpdating(true);
    try {
      await assignTicket(ticket.id, adminId);
      await Promise.all([fetchTicket(), fetchLogs()]);
    } catch (e: any) {
      alert(e.message);
    } finally {
      setUpdating(false);
    }
  };

  const handleDevOpsAction = (action: string) => {
    // For Error status, always show modal for logs/screenshot
    // For others, show modal for optional remarks
    setDevOpsAction(action);
    setDevOpsRemarks('');
    setErrorLogs('');
    setErrorScreenshot(null);
    setShowDevOpsModal(true);
  };

  const handleResubmit = async () => {
    const note = prompt('Add a note about your fix (optional):');
    setUpdating(true);
    try {
      await resubmitForDevOps(ticket.id, note || '');
      await Promise.all([fetchTicket(), fetchLogs()]);
      alert('Ticket resubmitted for deployment.');
    } catch (e: any) {
      alert(e.message);
    } finally {
      setUpdating(false);
    }
  };

  const executeDevOpsAction = async () => {
    setUpdating(true);
    try {
      await updateDevOpsStatus(ticket.id, devOpsAction, {
        remarks: devOpsRemarks || undefined,
        error_logs: errorLogs || undefined,
      });
      setShowDevOpsModal(false);
      await Promise.all([fetchTicket(), fetchLogs()]);
    } catch (e: any) {
      alert(e.message);
    } finally {
      setUpdating(false);
    }
  };

  if (loading) return (
    <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: DS.bg }}>
      <Loader2 className="animate-spin" color={DS.primary} size={32} />
    </div>
  );

  if (!ticket) return (
    <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: DS.bg, color: DS.text }}>
      Ticket not found
    </div>
  );

  const availableTransitions = VALID_TRANSITIONS[ticket.status] || [];
  const isSlaBreached = ticket.sla_deadline 
    ? new Date(ticket.sla_deadline) < new Date() && ticket.status !== 'Resolved' && ticket.status !== 'Closed'
    : false;

  return (
    <div style={{ minHeight: '100vh', background: DS.bg, color: DS.text, fontFamily: "'Inter', sans-serif" }}>
      {/* Header */}
      <header style={{ height: '72px', borderBottom: `1px solid ${DS.border}`, display: 'flex', alignItems: 'center', padding: '0 32px', background: DS.card, position: 'sticky', top: 0, zIndex: 10 }}>
        <button onClick={() => navigate(-1)} style={{ padding: '8px', border: 'none', background: 'none', color: DS.muted, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600, fontSize: '0.85rem' }}>
          <ArrowLeft size={18} /> Back to Dashboard
        </button>
        <div style={{ width: '1px', height: '24px', background: DS.border, margin: '0 24px' }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '0.7rem', fontWeight: 800, background: 'rgba(255,255,255,0.05)', padding: '4px 10px', borderRadius: '6px', color: DS.primary, border: `1px solid ${DS.border}` }}>
            #{ticket.id?.substring(0, 8).toUpperCase()}
          </span>
          <h1 style={{ fontSize: '1rem', fontWeight: 700 }}>{ticket.title}</h1>
        </div>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: '32px', padding: '32px', maxWidth: '1400px', margin: '0 auto' }}>
        
        {/* Main Content */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
          
          {/* Ticket Body */}
          <div style={{ background: DS.card, borderRadius: '24px', border: `1px solid ${DS.border}`, padding: '32px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
              <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                <div style={{ width: '48px', height: '48px', borderRadius: '16px', background: 'linear-gradient(135deg, #0ea5e9, #0284c7)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '1.2rem', fontWeight: 800 }}>
                  {(ticket.employee?.name || ticket.guest_name || 'U')[0]}
                </div>
                <div>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '2px' }}>{ticket.employee?.name || ticket.guest_name || 'Guest User'}</h3>
                  <p style={{ fontSize: '0.8rem', color: DS.muted }}>{ticket.employee?.email || ticket.guest_email || 'No email provided'} • <span style={{ color: DS.primary, fontWeight: 700, textTransform: 'uppercase', fontSize: '0.75rem' }}>{ticket.employee?.role || 'Guest'}</span></p>
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <p style={{ fontSize: '0.85rem', fontWeight: 600 }}>{ticket.created_at ? format(new Date(ticket.created_at), 'PPP p') : 'N/A'}</p>
              </div>
            </div>

            <div style={{ background: 'rgba(0,0,0,0.2)', borderRadius: '16px', padding: '24px', marginBottom: '32px', border: `1px solid ${DS.border}` }}>
              <h4 style={{ fontSize: '0.75rem', fontWeight: 800, color: DS.primary, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '12px' }}>Issue Description</h4>
              <p style={{ fontSize: '0.95rem', lineHeight: 1.7, color: DS.text }}>{ticket.description || 'No description provided'}</p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px' }}>
              <div style={{ padding: '16px', borderRadius: '14px', border: `1px solid ${DS.border}`, background: DS.surface }}>
                <label style={{ display: 'block', fontSize: '0.65rem', fontWeight: 700, color: DS.muted, textTransform: 'uppercase', marginBottom: '8px' }}>Category</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600, fontSize: '0.85rem' }}>
                  <TagIcon size={14} color={DS.primary} /> {ticket.issue_type}
                </div>
              </div>
              <div style={{ padding: '16px', borderRadius: '14px', border: `1px solid ${DS.border}`, background: DS.surface }}>
                <label style={{ display: 'block', fontSize: '0.65rem', fontWeight: 700, color: DS.muted, textTransform: 'uppercase', marginBottom: '8px' }}>Department</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600, fontSize: '0.85rem' }}>
                  <Building2 size={14} color={DS.primary} /> {ticket.department || ticket.employee?.department || 'General'}
                </div>
              </div>
              <div style={{ padding: '16px', borderRadius: '14px', border: `1px solid ${DS.border}`, background: DS.surface }}>
                <label style={{ display: 'block', fontSize: '0.65rem', fontWeight: 700, color: DS.muted, textTransform: 'uppercase', marginBottom: '8px' }}>Asset ID</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600, fontSize: '0.85rem' }}>
                  <CheckCircle2 size={14} color={DS.primary} /> {ticket.device_id || 'N/A'}
                </div>
              </div>
            </div>

            {ticket.custom_fields && Object.keys(ticket.custom_fields).length > 0 && (
              <div style={{ marginTop: '24px', background: 'rgba(0,0,0,0.2)', borderRadius: '16px', padding: '24px', border: `1px solid ${DS.border}` }}>
                <h4 style={{ fontSize: '0.75rem', fontWeight: 800, color: DS.primary, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '16px' }}>Request Details</h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
                  {Object.entries(ticket.custom_fields)
                    .filter(([key]) => ![
                      'requested_role', 'devops_updated_by', 'devops_updated_at', 
                      'devops_status', 'devops_remarks', 'error_logs', 'error_screenshot'
                    ].includes(key))
                    .map(([key, value]) => (
                      <div key={key}>
                        <span style={{ display: 'block', fontSize: '0.65rem', fontWeight: 700, color: DS.muted, textTransform: 'uppercase', marginBottom: '4px' }}>
                          {key.replace(/_/g, ' ')}
                        </span>
                        <span style={{ fontSize: '0.85rem', fontWeight: 600, color: DS.text }}>
                          {String(value) || '—'}
                        </span>
                      </div>
                    ))}
                </div>

                {/* Technical/DevOps Feedback Section (If any) */}
                {(ticket.custom_fields.devops_remarks || ticket.custom_fields.error_logs) && (
                  <div style={{ marginTop: '24px', paddingTop: '24px', borderTop: `1px solid ${DS.border}` }}>
                    {ticket.custom_fields.devops_remarks && (
                      <div style={{ marginBottom: '16px' }}>
                        <span style={{ display: 'block', fontSize: '0.65rem', fontWeight: 700, color: DS.warning, textTransform: 'uppercase', marginBottom: '8px' }}>DevOps Remarks</span>
                        <p style={{ fontSize: '0.85rem', background: DS.surface, padding: '12px', borderRadius: '10px', border: `1px solid ${DS.border}`, color: DS.text }}>{ticket.custom_fields.devops_remarks}</p>
                      </div>
                    )}
                    {ticket.custom_fields.error_logs && (
                      <div>
                        <span style={{ display: 'block', fontSize: '0.65rem', fontWeight: 700, color: DS.danger, textTransform: 'uppercase', marginBottom: '8px' }}>Error Logs</span>
                        <pre style={{ fontSize: '0.75rem', background: '#000', padding: '16px', borderRadius: '10px', overflowX: 'auto', border: `1px solid ${DS.border}`, color: '#ff4444', whiteSpace: 'pre-wrap' }}>{ticket.custom_fields.error_logs}</pre>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Procurement Workflow UI */}
          {ticket.status === 'Waiting for Inventory' && (
            <div style={{ background: DS.card, borderRadius: '24px', border: `1px solid ${DS.border}`, padding: '32px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
                <h4 style={{ fontSize: '1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <ShoppingCart size={20} color={DS.primary} /> Procurement Lifecycle
                </h4>
                <div style={{ padding: '6px 12px', borderRadius: '8px', background: 'rgba(14,165,233,0.1)', color: DS.primary, fontSize: '0.75rem', fontWeight: 700 }}>
                  Current: {ticket.procurement_status || 'Requested'}
                </div>
              </div>

              <div style={{ position: 'relative' }}>
                <div style={{ position: 'absolute', top: 0, bottom: 0, left: '20px', width: '2px', background: DS.border }} />
                {[
                  { step: 'Requested', icon: Clock, desc: 'Inventory requested and waiting for manager review' },
                  { step: 'Procuring', icon: ShoppingCart, desc: 'Items are currently being procured from suppliers' },
                  { step: 'Handover Pending', icon: Truck, desc: 'Items received, waiting for physical handover' }
                ].map((phase, idx) => {
                  const statuses = ['Requested', 'Procuring', 'Handover Pending'];
                  const currentIdx = statuses.indexOf(ticket.procurement_status || 'Requested');
                  const isPast = idx < currentIdx;
                  const isCurrent = idx === currentIdx;
                  
                  return (
                    <div key={phase.step} style={{ display: 'flex', gap: '20px', marginBottom: idx === 2 ? 0 : '32px', position: 'relative', opacity: isPast || isCurrent ? 1 : 0.4 }}>
                      <div style={{ width: '42px', height: '42px', borderRadius: '50%', background: isCurrent ? DS.primary : isPast ? DS.success : DS.surface, border: `2px solid ${isCurrent ? DS.primary : isPast ? DS.success : DS.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2 }}>
                        <phase.icon size={18} color={isCurrent || isPast ? '#fff' : DS.muted} />
                      </div>
                      <div style={{ paddingTop: '8px' }}>
                        <h5 style={{ fontSize: '0.95rem', fontWeight: 700, color: isCurrent ? DS.primary : isPast ? DS.success : DS.text, marginBottom: '4px' }}>{phase.step}</h5>
                        <p style={{ fontSize: '0.8rem', color: DS.muted }}>{phase.desc}</p>
                      </div>
                    </div>
                  );
                })}
              </div>

              {profile?.role === 'inventory_manager' && ticket.procurement_status !== 'Handover Pending' && (
                <button
                  onClick={() => handleProcurementAction(ticket.procurement_status === 'Requested' ? 'Procuring' : 'Handover Pending')}
                  style={{ width: '100%', padding: '16px', borderRadius: '12px', background: DS.primary, border: 'none', color: '#fff', fontWeight: 800, marginTop: '32px', cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}
                >
                  <ShoppingCart size={18} /> Move to {ticket.procurement_status === 'Requested' ? 'Procuring' : 'Handover Pending'}
                </button>
              )}
            </div>
          )}

          {/* Activity Timeline */}
          <div style={{ background: DS.card, borderRadius: '24px', border: `1px solid ${DS.border}`, padding: '32px' }}>
            <h4 style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '1rem', fontWeight: 700, marginBottom: '24px' }}>
              <History size={20} color={DS.primary} /> Activity Timeline
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              {logs.map(log => {
                const isSystem = log.performer?.name === 'System';
                return (
                  <div key={log.id} style={{ display: 'flex', gap: '16px' }}>
                    <div style={{ width: '36px', height: '36px', borderRadius: '12px', background: isSystem ? 'rgba(14,165,233,0.1)' : DS.surface, display: 'flex', alignItems: 'center', justifyContent: 'center', border: `1px solid ${DS.border}` }}>
                      {isSystem ? <History size={16} color={DS.primary} /> : <div style={{ fontSize: '0.8rem', fontWeight: 800 }}>{(log.performer?.name || 'U')[0]}</div>}
                    </div>
                    <div style={{ flex: 1 }}>
                      <p style={{ fontSize: '0.9rem', marginBottom: '4px' }}>{log.action}</p>
                      <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.75rem', color: DS.muted }}>{log.created_at ? format(new Date(log.created_at), 'PPP p') : 'N/A'}</span>
                        <span style={{ fontSize: '0.7rem', color: DS.primary, fontWeight: 700 }}>• {log.performer?.name || 'System'}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Sidebar: Management Actions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* Status & Priority Card */}
          <div style={{ background: DS.card, borderRadius: '24px', border: `1px solid ${DS.border}`, padding: '24px' }}>
            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 800, color: DS.muted, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '12px' }}>Current Status</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 16px', background: DS.surface, borderRadius: '12px', border: `1px solid ${DS.border}` }}>
                {(() => {
                  const devopsStatus = ticket.custom_fields?.devops_status;
                  const displayStatus = devopsStatus || ticket.status;
                  const dotColor = (displayStatus === 'Resolved' || displayStatus === 'Access Given' || displayStatus === 'Deployed' || displayStatus === 'Resubmitted') 
                    ? DS.success 
                    : (displayStatus === 'Rejected' || displayStatus === 'Error') 
                    ? DS.danger 
                    : displayStatus === 'Open' ? DS.primary : DS.warning;
                  
                  return (
                    <>
                      <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: dotColor }} />
                      <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>{displayStatus}</span>
                    </>
                  );
                })()}
              </div>
            </div>

            <div style={{ marginBottom: '24px' }}>
              {!(userRole === 'employee' && ticket.sub_type === 'Payslip') && (
                <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 800, color: DS.muted, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '12px' }}>Quick Actions</label>
              )}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {/* GitLab Access: DevOps workflow — Access Given / Rejected */}
                {(userRole === 'admin' || userRole === 'superadmin' || userRole === 'devops') && ticket.issue_type === 'GitLab Access' && !['Resolved', 'Closed'].includes(ticket.status) && (
                  <>
                    <button
                      disabled={updating}
                      onClick={() => handleDevOpsAction('Access Given')}
                      style={{ flex: 1, minWidth: '120px', padding: '12px', borderRadius: '10px', background: 'rgba(74,222,128,0.1)', border: `1px solid rgba(74,222,128,0.3)`, color: DS.success, fontSize: '0.8rem', fontWeight: 800, cursor: 'pointer', transition: 'all 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                      onMouseEnter={e => (e.currentTarget.style.borderColor = DS.success)}
                      onMouseLeave={e => (e.currentTarget.style.borderColor = 'rgba(74,222,128,0.3)')}
                    >
                      <CheckCircle2 size={16} /> Access Given
                    </button>
                    <button
                      disabled={updating}
                      onClick={() => handleDevOpsAction('Rejected')}
                      style={{ flex: 1, minWidth: '120px', padding: '12px', borderRadius: '10px', background: 'rgba(255,68,68,0.1)', border: `1px solid rgba(255,68,68,0.3)`, color: DS.danger, fontSize: '0.8rem', fontWeight: 800, cursor: 'pointer', transition: 'all 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                      onMouseEnter={e => (e.currentTarget.style.borderColor = DS.danger)}
                      onMouseLeave={e => (e.currentTarget.style.borderColor = 'rgba(255,68,68,0.3)')}
                    >
                      <X size={16} /> Rejected
                    </button>
                  </>
                )}
                {(userRole === 'admin' || userRole === 'superadmin' || userRole === 'devops') && ticket.issue_type === 'GitLab Access' && ['Resolved', 'Closed'].includes(ticket.status) && (
                  <div style={{ 
                    width: '100%', padding: '12px', 
                    background: ticket.custom_fields?.devops_status === 'Rejected' ? 'rgba(255,68,68,0.06)' : 'rgba(74,222,128,0.06)', 
                    borderRadius: '10px', 
                    border: `1px solid ${ticket.custom_fields?.devops_status === 'Rejected' ? 'rgba(255,68,68,0.15)' : 'rgba(74,222,128,0.15)'}` 
                  }}>
                    <p style={{ fontSize: '0.75rem', fontWeight: 700, color: ticket.custom_fields?.devops_status === 'Rejected' ? DS.danger : DS.success, display: 'flex', alignItems: 'center', gap: '6px' }}>
                      {ticket.custom_fields?.devops_status === 'Rejected' ? <X size={14} /> : <CheckCircle2 size={14} />} 
                      {ticket.custom_fields?.devops_status || 'Decision recorded'}
                    </p>
                  </div>
                )}

                {/* Deployment Request: DevOps workflow — Deployed / Error */}
                {(userRole === 'admin' || userRole === 'superadmin' || userRole === 'devops') && ticket.issue_type === 'Deployment Request' && !['Resolved', 'Closed'].includes(ticket.status) && (
                  <>
                    <button
                      disabled={updating}
                      onClick={() => handleDevOpsAction('Deployed')}
                      style={{ flex: 1, minWidth: '120px', padding: '12px', borderRadius: '10px', background: 'rgba(74,222,128,0.1)', border: `1px solid rgba(74,222,128,0.3)`, color: DS.success, fontSize: '0.8rem', fontWeight: 800, cursor: 'pointer', transition: 'all 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                      onMouseEnter={e => (e.currentTarget.style.borderColor = DS.success)}
                      onMouseLeave={e => (e.currentTarget.style.borderColor = 'rgba(74,222,128,0.3)')}
                    >
                      <CheckCircle2 size={16} /> Deployed
                    </button>
                    <button
                      disabled={updating}
                      onClick={() => handleDevOpsAction('Error')}
                      style={{ flex: 1, minWidth: '120px', padding: '12px', borderRadius: '10px', background: 'rgba(255,68,68,0.1)', border: `1px solid rgba(255,68,68,0.3)`, color: DS.danger, fontSize: '0.8rem', fontWeight: 800, cursor: 'pointer', transition: 'all 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                      onMouseEnter={e => (e.currentTarget.style.borderColor = DS.danger)}
                      onMouseLeave={e => (e.currentTarget.style.borderColor = 'rgba(255,68,68,0.3)')}
                    >
                      <AlertCircle size={16} /> Error
                    </button>
                  </>
                )}
                {(userRole === 'admin' || userRole === 'superadmin' || userRole === 'devops') && ticket.issue_type === 'Deployment Request' && ['Resolved', 'Closed'].includes(ticket.status) && (
                  <div style={{ width: '100%', padding: '12px', background: ticket.custom_fields?.devops_status === 'Error' ? 'rgba(255,68,68,0.06)' : 'rgba(74,222,128,0.06)', borderRadius: '10px', border: `1px solid ${ticket.custom_fields?.devops_status === 'Error' ? 'rgba(255,68,68,0.15)' : 'rgba(74,222,128,0.15)'}` }}>
                    <p style={{ fontSize: '0.75rem', fontWeight: 700, color: ticket.custom_fields?.devops_status === 'Error' ? DS.danger : DS.success, display: 'flex', alignItems: 'center', gap: '6px' }}>
                      {ticket.custom_fields?.devops_status === 'Error' ? <AlertCircle size={14} /> : <CheckCircle2 size={14} />} {ticket.custom_fields?.devops_status || 'Decision recorded'}
                    </p>
                  </div>
                )}

                {/* Deployment Error Recovery: Requester can resubmit after fix */}
                {ticket.issue_type === 'Deployment Request' && ticket.custom_fields?.devops_status === 'Error' && ticket.employee_id === profile?.id && userRole !== 'devops' && (
                  <button
                    disabled={updating}
                    onClick={handleResubmit}
                    style={{ width: '100%', padding: '14px', borderRadius: '12px', background: 'linear-gradient(135deg, #0ea5e9, #0284c7)', border: 'none', color: '#fff', fontSize: '0.85rem', fontWeight: 800, cursor: 'pointer', transition: 'all 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', marginBottom: '16px' }}
                  >
                    <RefreshCw size={18} className={updating ? 'animate-spin' : ''} /> Fix Applied - Resubmit for Deployment
                  </button>
                )}

                {/* Standard tickets: generic status transitions */}
                {(userRole === 'admin' || userRole === 'superadmin') && !['GitLab Access', 'Deployment Request'].includes(ticket.issue_type) && availableTransitions.map(s => (
                  <button
                    key={s}
                    disabled={updating}
                    onClick={() => handleStatusUpdate(s)}
                    style={{ flex: 1, minWidth: '120px', padding: '10px', borderRadius: '10px', background: DS.surface, border: `1px solid ${DS.border}`, color: DS.text, fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s' }}
                    onMouseEnter={e => (e.currentTarget.style.borderColor = DS.primary)}
                    onMouseLeave={e => (e.currentTarget.style.borderColor = DS.border)}
                  >
                    Move to {s}
                  </button>
                ))}
                
                {userRole === 'hr' && ticket.sub_type === 'Payslip' && ticket.status !== 'Closed' && (
                  <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div style={{ padding: '16px', background: 'rgba(14,165,233,0.1)', borderRadius: '16px', border: `1px solid ${DS.primary}` }}>
                      <p style={{ fontSize: '0.8rem', fontWeight: 700, color: DS.primary, marginBottom: '12px' }}>UPLOAD PAYSLIP (PDF ONLY)</p>
                      <input 
                        type="file" 
                        accept=".pdf"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            setUpdating(true);
                            try {
                              // Simulate upload & Close ticket
                              await addComment(ticket.id, `Payslip uploaded by HR: ${file.name}`);
                              await updateStatus(ticket.id, ticket.status, 'Closed');
                              alert('Payslip uploaded and ticket closed successfully.');
                              fetchTicket();
                              fetchLogs();
                            } catch (err) {
                              console.error(err);
                            } finally {
                              setUpdating(false);
                            }
                          }
                        }}
                        style={{ width: '100%', fontSize: '0.75rem', color: DS.text }}
                      />
                    </div>
                  </div>
                )}

                {userRole === 'employee' && ticket.sub_type !== 'Payslip' && (
                  <p style={{ fontSize: '0.75rem', fontStyle: 'italic', color: DS.muted }}>Only comments and attachments allowed for employees.</p>
                )}
                
                {(userRole === 'admin' || userRole === 'superadmin') && !['GitLab Access', 'Deployment Request'].includes(ticket.issue_type) && availableTransitions.length === 0 && <p style={{ fontSize: '0.75rem', fontStyle: 'italic', color: DS.muted }}>No further transitions possible</p>}
              </div>
            </div>

            {(userRole === 'admin' || userRole === 'superadmin') ? (
              <div>
                <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 800, color: DS.muted, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '12px' }}>Assign Agent</label>
                <select
                  disabled={updating}
                  value={ticket.assigned_to || ''}
                  onChange={(e) => handleAssign(e.target.value)}
                  style={{ width: '100%', padding: '12px', borderRadius: '12px', background: DS.surface, border: `1px solid ${DS.border}`, color: DS.text, fontSize: '0.85rem', fontWeight: 600, outline: 'none' }}
                >
                  <option value="">Unassigned</option>
                  {users.map(u => (
                    <option key={u.id} value={u.id}>{u.name}</option>
                  ))}
                </select>
              </div>
            ) : (
              <div>
                <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 800, color: DS.muted, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '12px' }}>Assigned To</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ padding: '12px 16px', background: DS.surface, borderRadius: '12px', border: `1px solid ${DS.border}`, fontSize: '0.85rem', fontWeight: 700, color: DS.primary }}>
                    {ticket.assigned?.name || 'Unassigned'}
                  </div>
                  
                  {userRole === 'devops' && !ticket.assigned_to && ['Deployment Request', 'GitLab Access'].includes(ticket.issue_type) && (
                    <button
                      disabled={updating}
                      onClick={() => handleAssign(profile?.id || '')}
                      style={{ width: '100%', padding: '10px', borderRadius: '10px', background: 'rgba(14,165,233,0.1)', border: `1px solid ${DS.primary}`, color: DS.primary, fontSize: '0.75rem', fontWeight: 800, cursor: 'pointer', transition: 'all 0.2s' }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(14,165,233,0.2)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'rgba(14,165,233,0.1)')}
                    >
                      Claim Ticket
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* SLA Card */}
          <div style={{ background: isSlaBreached ? 'rgba(255,68,68,0.05)' : DS.card, borderRadius: '24px', border: `1px solid ${isSlaBreached ? 'rgba(255,68,68,0.2)' : DS.border}`, padding: '24px' }}>
            <h4 style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.75rem', fontWeight: 800, color: isSlaBreached ? DS.danger : DS.primary, textTransform: 'uppercase', marginBottom: '16px' }}>
              <Clock size={16} /> SLA Management
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                <span style={{ color: DS.muted }}>Resolution Target:</span>
                <span style={{ fontWeight: 700 }}>{ticket.sla_deadline ? format(new Date(ticket.sla_deadline), 'MMM d, h:mm a') : 'N/A'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                <span style={{ color: DS.muted }}>Priority:</span>
                <span style={{ fontWeight: 800, color: ticket.priority === 'Critical' ? DS.danger : DS.warning }}>{ticket.priority}</span>
              </div>
              {isSlaBreached && (
                <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ padding: '12px', background: 'rgba(255,68,68,0.1)', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '8px', color: DS.danger, fontSize: '0.75rem', fontWeight: 700 }}>
                    <ShieldAlert size={16} /> SLA BREACHED
                  </div>
                  
                  {ticket.escalation_level >= 1 && (
                    <div style={{ padding: '10px', background: 'rgba(255,184,110,0.1)', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '8px', color: DS.warning, fontSize: '0.7rem', fontWeight: 700 }}>
                      <AlertCircle size={14} /> LEVEL 1: AUTO-CRITICAL
                    </div>
                  )}
                  
                  {ticket.escalation_level >= 2 && (
                    <div style={{ padding: '10px', background: 'rgba(255,68,68,0.15)', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '8px', color: DS.danger, fontSize: '0.7rem', fontWeight: 800 }}>
                      <ShieldAlert size={14} /> LEVEL 2: MGMT NOTIFIED
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Resolution/Status Change Modal */}
      <AnimatePresence>
        {showResModal && (
          <div style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: '20px' }}>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowResModal(false)} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)' }} />
            <motion.div initial={{ scale: 0.95, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 20 }} style={{ position: 'relative', width: '100%', maxWidth: '540px', background: DS.card, borderRadius: '28px', border: `1px solid ${DS.border}`, padding: '32px', boxShadow: '0 24px 64px rgba(0,0,0,0.6)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <MessageSquare size={24} color={DS.primary} /> Update to {pendingStatus}
                </h2>
                <button onClick={() => setShowResModal(false)} style={{ background: 'none', border: 'none', color: DS.muted, cursor: 'pointer' }}><X size={20} /></button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 800, color: DS.muted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Closing Remarks <span style={{ color: DS.danger }}>*</span></label>
                  <textarea 
                    value={remarks}
                    onChange={e => setRemarks(e.target.value)}
                    placeholder="Provide details about the resolution or reason for the wait..."
                    style={{ width: '100%', height: '120px', padding: '16px', borderRadius: '16px', background: DS.surface, border: `1px solid ${DS.border}`, color: DS.text, fontSize: '0.9rem', outline: 'none', resize: 'none', lineHeight: 1.5 }}
                  />
                  <p style={{ fontSize: '0.7rem', color: remarks.length < 10 ? DS.danger : DS.muted, textAlign: 'right' }}>
                    {remarks.length < 10 ? `Need at least ${10 - remarks.length} more characters` : 'Remark meets requirement'}
                  </p>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 800, color: DS.muted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Evidence (Optional)</label>
                  <div style={{ position: 'relative', padding: '24px', borderRadius: '16px', border: `2px dashed ${DS.border}`, background: DS.surface, textAlign: 'center' }}>
                    <input 
                      type="file" 
                      accept="image/*"
                      onChange={e => setImage(e.target.files?.[0] || null)}
                      style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer' }} 
                    />
                    {image ? (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', color: DS.success }}>
                        <Camera size={20} />
                        <span style={{ fontSize: '0.85rem', fontWeight: 700 }}>{image.name} attached</span>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', color: DS.muted }}>
                        <Upload size={24} />
                        <p style={{ fontSize: '0.8rem', fontWeight: 600 }}>Click or drag image to upload proof</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '12px', marginTop: '32px' }}>
                <button onClick={() => setShowResModal(false)} style={{ flex: 1, padding: '14px', borderRadius: '14px', background: 'transparent', border: `1px solid ${DS.border}`, color: DS.text, fontWeight: 700, cursor: 'pointer' }}>Cancel</button>
                <button 
                  disabled={remarks.length < 10 || updating}
                  onClick={() => executeStatusUpdate(pendingStatus, remarks)}
                  style={{ 
                    flex: 2, padding: '14px', borderRadius: '14px', 
                    background: remarks.length < 10 ? DS.muted : 'linear-gradient(135deg, #0ea5e9, #0284c7)', 
                    border: 'none', color: '#fff', fontWeight: 800, cursor: remarks.length < 10 ? 'not-allowed' : 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px'
                  }}
                >
                  {updating ? <Loader2 size={18} className="animate-spin" /> : <CheckCircle2 size={18} />}
                  Confirm Status Update
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Inventory Request Modal */}
      <AnimatePresence>
        {showInvModal && (
          <div style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: '20px' }}>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowInvModal(false)} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)' }} />
            <motion.div initial={{ scale: 0.95, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 20 }} style={{ position: 'relative', width: '100%', maxWidth: '500px', background: DS.card, borderRadius: '28px', border: `1px solid ${DS.border}`, padding: '32px', boxShadow: '0 24px 64px rgba(0,0,0,0.6)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <Package size={24} color={DS.primary} /> Request Inventory
                </h2>
                <button onClick={() => setShowInvModal(false)} style={{ background: 'none', border: 'none', color: DS.muted, cursor: 'pointer' }}><X size={20} /></button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 800, color: DS.muted, textTransform: 'uppercase' }}>Select Inventory Manager</label>
                  <select 
                    value={invManagerId} 
                    onChange={e => setInvManagerId(e.target.value)}
                    style={{ width: '100%', padding: '12px', borderRadius: '12px', background: DS.surface, border: `1px solid ${DS.border}`, color: DS.text, fontSize: '0.85rem' }}
                  >
                    <option value="">Choose a manager...</option>
                    {users.filter(u => u.role === 'inventory_manager' || u.role === 'superadmin').map(u => (
                      <option key={u.id} value={u.id}>{u.name} ({u.email})</option>
                    ))}
                  </select>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 800, color: DS.muted, textTransform: 'uppercase' }}>Part Details & Remarks</label>
                  <textarea 
                    value={invRemarks} 
                    onChange={e => setInvRemarks(e.target.value)}
                    placeholder="Describe the component or part needed..."
                    style={{ width: '100%', height: '100px', padding: '12px', borderRadius: '12px', background: DS.surface, border: `1px solid ${DS.border}`, color: DS.text, fontSize: '0.85rem', resize: 'none' }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '12px', marginTop: '32px' }}>
                <button onClick={() => setShowInvModal(false)} style={{ flex: 1, padding: '12px', borderRadius: '12px', background: 'transparent', border: `1px solid ${DS.border}`, color: DS.text, fontWeight: 700, cursor: 'pointer' }}>Cancel</button>
                <button 
                  disabled={!invManagerId || !invRemarks || updating}
                  onClick={handleRequestInventory}
                  style={{ flex: 2, padding: '12px', borderRadius: '12px', background: DS.primary, border: 'none', color: '#fff', fontWeight: 800, cursor: 'pointer' }}
                >
                  Send Request
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* DevOps Action Modal */}
      <AnimatePresence>
        {showDevOpsModal && (
          <div style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: '20px' }}>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowDevOpsModal(false)} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)' }} />
            <motion.div initial={{ scale: 0.95, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 20 }} style={{ position: 'relative', width: '100%', maxWidth: '560px', background: DS.card, borderRadius: '28px', border: `1px solid ${DS.border}`, padding: '32px', boxShadow: '0 24px 64px rgba(0,0,0,0.6)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '12px' }}>
                  {devOpsAction === 'Error' ? <AlertCircle size={24} color={DS.danger} /> : devOpsAction === 'Rejected' ? <X size={24} color={DS.danger} /> : <CheckCircle2 size={24} color={DS.success} />}
                  {devOpsAction === 'Access Given' ? 'Grant Access' : devOpsAction === 'Deployed' ? 'Confirm Deployment' : devOpsAction === 'Error' ? 'Report Deployment Error' : 'Reject Access'}
                </h2>
                <button onClick={() => setShowDevOpsModal(false)} style={{ background: 'none', border: 'none', color: DS.muted, cursor: 'pointer' }}><X size={20} /></button>
              </div>

              {/* Status indicator */}
              <div style={{ padding: '12px 16px', borderRadius: '12px', marginBottom: '24px', background: devOpsAction === 'Error' || devOpsAction === 'Rejected' ? 'rgba(255,68,68,0.08)' : 'rgba(74,222,128,0.08)', border: `1px solid ${devOpsAction === 'Error' || devOpsAction === 'Rejected' ? 'rgba(255,68,68,0.2)' : 'rgba(74,222,128,0.2)'}` }}>
                <p style={{ fontSize: '0.8rem', fontWeight: 700, color: devOpsAction === 'Error' || devOpsAction === 'Rejected' ? DS.danger : DS.success }}>
                  Ticket will be moved to: {devOpsAction === 'Access Given' || devOpsAction === 'Deployed' ? 'Resolved' : devOpsAction === 'Rejected' ? 'Closed' : 'In Progress'}
                </p>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                {/* Remarks */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 800, color: DS.muted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Remarks {devOpsAction === 'Error' || devOpsAction === 'Rejected' ? <span style={{ color: DS.danger }}>*</span> : '(Optional)'}
                  </label>
                  <textarea
                    value={devOpsRemarks}
                    onChange={e => setDevOpsRemarks(e.target.value)}
                    placeholder={devOpsAction === 'Error' ? 'Describe what went wrong...' : devOpsAction === 'Rejected' ? 'Reason for rejection...' : 'Add any notes...'}
                    style={{ width: '100%', height: '100px', padding: '16px', borderRadius: '16px', background: DS.surface, border: `1px solid ${DS.border}`, color: DS.text, fontSize: '0.9rem', outline: 'none', resize: 'none', lineHeight: 1.5, boxSizing: 'border-box' }}
                  />
                </div>

                {/* Error-specific: Logs and Screenshot */}
                {devOpsAction === 'Error' && (
                  <>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      <label style={{ fontSize: '0.75rem', fontWeight: 800, color: DS.muted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        Error Logs <span style={{ color: DS.danger }}>*</span>
                      </label>
                      <textarea
                        value={errorLogs}
                        onChange={e => setErrorLogs(e.target.value)}
                        placeholder="Paste the error logs here..."
                        style={{ width: '100%', height: '160px', padding: '16px', borderRadius: '16px', background: '#0c0c1a', border: `1px solid rgba(255,68,68,0.2)`, color: '#ff9999', fontSize: '0.8rem', outline: 'none', resize: 'vertical', lineHeight: 1.6, fontFamily: "'JetBrains Mono', 'Fira Code', monospace", boxSizing: 'border-box' }}
                      />
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      <label style={{ fontSize: '0.75rem', fontWeight: 800, color: DS.muted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Error Screenshot (Optional)</label>
                      <div style={{ position: 'relative', padding: '24px', borderRadius: '16px', border: `2px dashed rgba(255,68,68,0.25)`, background: DS.surface, textAlign: 'center' }}>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={e => setErrorScreenshot(e.target.files?.[0] || null)}
                          style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer' }}
                        />
                        {errorScreenshot ? (
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', color: DS.success }}>
                            <Camera size={20} />
                            <span style={{ fontSize: '0.85rem', fontWeight: 700 }}>{errorScreenshot.name}</span>
                          </div>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', color: DS.muted }}>
                            <Upload size={24} />
                            <p style={{ fontSize: '0.8rem', fontWeight: 600 }}>Click to upload error screenshot</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </div>

              <div style={{ display: 'flex', gap: '12px', marginTop: '32px' }}>
                <button onClick={() => setShowDevOpsModal(false)} style={{ flex: 1, padding: '14px', borderRadius: '14px', background: 'transparent', border: `1px solid ${DS.border}`, color: DS.text, fontWeight: 700, cursor: 'pointer' }}>Cancel</button>
                <button
                  disabled={updating || ((devOpsAction === 'Error') && (!devOpsRemarks || !errorLogs)) || (devOpsAction === 'Rejected' && !devOpsRemarks)}
                  onClick={executeDevOpsAction}
                  style={{
                    flex: 2, padding: '14px', borderRadius: '14px',
                    background: (devOpsAction === 'Error' || devOpsAction === 'Rejected')
                      ? ((devOpsAction === 'Error' && (!devOpsRemarks || !errorLogs)) || (devOpsAction === 'Rejected' && !devOpsRemarks) ? DS.muted : 'linear-gradient(135deg, #ef4444, #dc2626)')
                      : 'linear-gradient(135deg, #4ade80, #22c55e)',
                    border: 'none', color: '#fff', fontWeight: 800,
                    cursor: ((devOpsAction === 'Error' && (!devOpsRemarks || !errorLogs)) || (devOpsAction === 'Rejected' && !devOpsRemarks)) ? 'not-allowed' : 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px'
                  }}
                >
                  {updating ? <Loader2 size={18} className="animate-spin" /> : <CheckCircle2 size={18} />}
                  {devOpsAction === 'Error' ? 'Report Error' : devOpsAction === 'Rejected' ? 'Reject Access' : `Confirm ${devOpsAction}`}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
