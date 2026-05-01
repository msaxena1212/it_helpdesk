import { useState, useEffect } from 'react';
import { AlertTriangle, X, ChevronRight } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/AuthContext';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';

const DS = {
  bg: '#0f172a', card: '#131b2e', cardHigh: '#222a3d',
  border: 'rgba(14,165,233,0.12)', primary: '#0ea5e9',
  text: '#dae2fd', muted: '#88929b', surface: '#0b1326',
  success: '#4ade80', danger: '#ff4444', warning: '#ffb86e',
};

interface AlertItem { label: string; count: number; }

export const GlobalHeader = () => {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [actionUrl, setActionUrl] = useState('/tickets');
  const [showAttention, setShowAttention] = useState(true);
  const [employeeStats, setEmployeeStats] = useState<{ active: number; resolvedWeek: number } | null>(null);


  useEffect(() => {
    setShowAttention(true);
    fetchAlerts();
  }, [profile]);

  const fetchAlerts = async () => {
    if (!profile) return;
    const role = profile.role;
    const newAlerts: AlertItem[] = [];

    try {
      if (role === 'admin' || role === 'superadmin') {
        const { data } = await supabase
          .from('tickets')
          .select('status, priority, assigned_to, sla_deadline')
          .not('status', 'in', '("Resolved","Closed")');
        if (data) {
          const unassigned = data.filter(t => !t.assigned_to && t.status === 'Open').length;
          const critical = data.filter(t => t.priority === 'Critical').length;
          const slaBreaching = data.filter(t =>
            t.sla_deadline &&
            new Date(t.sla_deadline).getTime() - Date.now() < 2 * 3600 * 1000 &&
            new Date(t.sla_deadline).getTime() > Date.now()
          ).length;
          if (unassigned > 0) newAlerts.push({ label: `${unassigned} Unassigned`, count: unassigned });
          if (critical > 0) newAlerts.push({ label: `${critical} Critical`, count: critical });
          if (slaBreaching > 0) newAlerts.push({ label: `${slaBreaching} SLA Breaching Soon`, count: slaBreaching });
        }
        setActionUrl('/tickets?status=Open');

      } else if (role === 'devops') {
        const { data } = await supabase
          .from('tickets')
          .select('status, issue_type')
          .in('issue_type', ['Deployment Request', 'GitLab Access'])
          .not('status', 'in', '("Resolved","Closed")');
        if (data) {
          const pendingDeploy = data.filter(t => t.issue_type === 'Deployment Request' && t.status === 'Open').length;
          const openAccess = data.filter(t => t.issue_type === 'GitLab Access' && t.status === 'Open').length;
          if (pendingDeploy > 0) newAlerts.push({ label: `${pendingDeploy} Pending Deployments`, count: pendingDeploy });
          if (openAccess > 0) newAlerts.push({ label: `${openAccess} Access Requests`, count: openAccess });
        }
        setActionUrl('/tickets?status=Open');

      } else if (role === 'inventory_manager') {
        const { data } = await supabase
          .from('tickets')
          .select('status, priority')
          .or('status.eq.Waiting for Inventory,procurement_status.not.is.null')
          .not('status', 'in', '("Resolved","Closed")');
        if (data) {
          const waiting = data.filter(t => t.status === 'Waiting for Inventory').length;
          const urgent = data.filter(t => t.priority === 'Critical' || t.priority === 'High').length;
          if (waiting > 0) newAlerts.push({ label: `${waiting} Awaiting Fulfilment`, count: waiting });
          if (urgent > 0) newAlerts.push({ label: `${urgent} High Priority`, count: urgent });
        }
        setActionUrl('/tickets?status=Waiting+for+Inventory');

      } else {
        // Employee: only their own tickets
        const { data } = await supabase
          .from('tickets')
          .select('status, updated_at')
          .eq('employee_id', profile.id);
        if (data) {
          const active = data.filter(t => ['Open', 'In Progress', 'Waiting for User', 'Waiting for Inventory'].includes(t.status)).length;
          
          const oneWeekAgo = new Date();
          oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
          const resolvedWeek = data.filter(t => 
            (t.status === 'Resolved' || t.status === 'Closed') && 
            new Date(t.updated_at) > oneWeekAgo
          ).length;

          setEmployeeStats({ active, resolvedWeek });
        }
        setActionUrl('/tickets');
      }
    } catch (e) {
      console.error(e);
    }

    setAlerts(newAlerts);
  };


  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100%', zIndex: 50 }}>
      {/* Universal Attention Bar / Friendly Banner */}
      <AnimatePresence>
        {showAttention && (
          profile?.role === 'employee' ? (
            employeeStats && (employeeStats.active > 0 || employeeStats.resolvedWeek > 0) && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                style={{ background: DS.cardHigh, padding: '12px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: `1px solid ${DS.border}` }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '24px', fontSize: '0.85rem', fontWeight: 600 }}>
                  {employeeStats.active > 0 && <span style={{ color: DS.text }}>🟡 You have {employeeStats.active} request{employeeStats.active !== 1 ? 's' : ''} in progress</span>}
                  {employeeStats.resolvedWeek > 0 && <span style={{ color: DS.text }}>🟢 {employeeStats.resolvedWeek} request{employeeStats.resolvedWeek !== 1 ? 's' : ''} resolved this week</span>}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <button onClick={() => navigate('/tickets?status=Active')} style={{ background: 'transparent', border: `1px solid ${DS.border}`, borderRadius: '6px', padding: '6px 12px', color: DS.text, fontWeight: 700, fontSize: '0.75rem', cursor: 'pointer' }}>
                    View Active
                  </button>
                  <button onClick={() => navigate('/tickets/new')} style={{ background: DS.primary, border: 'none', borderRadius: '6px', padding: '6px 12px', color: '#fff', fontWeight: 700, fontSize: '0.75rem', cursor: 'pointer' }}>
                    Raise New Request
                  </button>
                  <button onClick={() => setShowAttention(false)} style={{ background: 'transparent', border: 'none', color: DS.muted, cursor: 'pointer', padding: '4px' }}>
                    <X size={16} />
                  </button>
                </div>
              </motion.div>
            )
          ) : (
            alerts.length > 0 && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                style={{ background: 'linear-gradient(90deg, #ff4444 0%, #ffb86e 100%)', padding: '10px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: '#000' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', fontWeight: 800, fontSize: '0.82rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <AlertTriangle size={16} /> ACTION REQUIRED:
                  </div>
                  <div style={{ display: 'flex', gap: '12px', fontWeight: 600 }}>
                    {alerts.map((a, i) => (
                      <span key={i}>• {a.label}</span>
                    ))}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <button
                    onClick={() => navigate(actionUrl)}
                    style={{ background: 'rgba(0,0,0,0.2)', border: 'none', borderRadius: '6px', padding: '6px 12px', color: '#000', fontWeight: 800, fontSize: '0.75rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                  >
                    Resolve Now <ChevronRight size={14} />
                  </button>
                  <button
                    onClick={() => setShowAttention(false)}
                    style={{ background: 'transparent', border: 'none', color: 'rgba(0,0,0,0.5)', cursor: 'pointer', padding: '4px' }}
                  >
                    <X size={16} />
                  </button>
                </div>
              </motion.div>
            )
          )
        )}
      </AnimatePresence>
    </div>
  );
};
