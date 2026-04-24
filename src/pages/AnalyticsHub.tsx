import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { utils, write } from 'xlsx';
import {
  BarChart2, Clock, Users, FileText, Download,
  TrendingUp, TrendingDown, ArrowUpRight, AlertTriangle, Shield
} from 'lucide-react';
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement,
  Title, Tooltip, Legend, PointElement, LineElement, ArcElement
} from 'chart.js';
import { Bar, Line, Doughnut } from 'react-chartjs-2';
import { supabase } from '../lib/supabase';

ChartJS.register(CategoryScale, LinearScale, BarElement, PointElement, LineElement, ArcElement, Title, Tooltip, Legend);

const DS = {
  bg: '#0f172a', card: '#131b2e', cardHigh: '#222a3d',
  border: 'rgba(14,165,233,0.12)', primary: '#0ea5e9',
  text: '#dae2fd', muted: '#88929b', surface: '#0b1326',
  danger: '#ff4444', warning: '#ffb86e', success: '#4ade80'
};

const chartDefaults = {
  plugins: { legend: { labels: { color: '#88929b', font: { size: 11, family: 'Inter' } } } },
  scales: {
    x: { ticks: { color: '#88929b', font: { size: 11 } }, grid: { color: 'rgba(255,255,255,0.04)' } },
    y: { ticks: { color: '#88929b', font: { size: 11 } }, grid: { color: 'rgba(255,255,255,0.04)' } },
  },
};

const views = [
  { id: 'overview', name: 'Overview', icon: BarChart2 },
  { id: 'sla', name: 'Resolution & SLA', icon: Clock },
  { id: 'agents', name: 'Agent Performance', icon: Users },
  { id: 'categories', name: 'Category Analysis', icon: FileText },
];

export const AnalyticsHub = () => {
  const [activeView, setActiveView] = useState('overview');
  const [tickets, setTickets] = useState<any[]>([]);
  const [teamCount, setTeamCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [{ data: ticketData }, { count: profilesCount }] = await Promise.all([
        supabase.from('tickets').select(`
          *,
          assigned:profiles!assigned_to(name)
        `).order('created_at', { ascending: false }),
        supabase.from('profiles').select('id', { count: 'exact', head: true })
      ]);
      setTickets(ticketData || []);
      setTeamCount(profilesCount || 0);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const getSlaBreachRate = () => {
    if (tickets.length === 0) return 0;
    const breached = tickets.filter(t => t.sla_breached).length;
    return (breached / tickets.length) * 100;
  };

  const getAvgResolutionTime = () => {
    const resolved = tickets.filter(t => (t.status === 'Resolved' || t.status === 'Closed') && t.updated_at);
    if (resolved.length === 0) return 0;
    
    const totalTime = resolved.reduce((acc, t) => {
      const start = new Date(t.created_at).getTime();
      const end = new Date(t.updated_at).getTime();
      return acc + (end - start);
    }, 0);

    return (totalTime / resolved.length) / (1000 * 60 * 60); // In hours
  };

  const getAgentStats = () => {
    const stats: Record<string, any> = {};
    tickets.forEach(t => {
      const agentName = t.assigned?.name || 'Unassigned';
      if (!stats[agentName]) {
        stats[agentName] = { name: agentName, total: 0, resolved: 0, breached: 0 };
      }
      stats[agentName].total++;
      if (t.status === 'Resolved' || t.status === 'Closed') stats[agentName].resolved++;
      if (t.sla_breached) stats[agentName].breached++;
    });
    return Object.values(stats).sort((a, b) => b.total - a.total);
  };

  const getResolutionTrend = () => {
    if (tickets.length === 0) return { val: '0%', up: true };
    const now = new Date();
    const last7Days = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const prev7Days = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

    const recentResolved = tickets.filter(t => (t.status === 'Resolved' || t.status === 'Closed') && new Date(t.updated_at) >= last7Days).length;
    const pastResolved = tickets.filter(t => (t.status === 'Resolved' || t.status === 'Closed') && new Date(t.updated_at) < last7Days && new Date(t.updated_at) >= prev7Days).length;

    if (pastResolved === 0) return { val: recentResolved > 0 ? '+100%' : '0%', up: true };
    const diff = ((recentResolved - pastResolved) / pastResolved) * 100;
    return { val: `${diff >= 0 ? '+' : ''}${diff.toFixed(0)}%`, up: diff >= 0 };
  };

  const trend = getResolutionTrend();
  const avgResTime = getAvgResolutionTime();
  const agentStats = getAgentStats();

  const kpis = [
    { label: 'Total Tickets', value: tickets.length, trend: '+12%', up: true, color: '#89ceff' },
    { label: 'SLA Breach Rate', value: `${getSlaBreachRate().toFixed(1)}%`, trend: '-2.1%', up: true, color: '#ffb4ab' },
    { label: 'Avg Resolution', value: `${avgResTime.toFixed(1)}h`, trend: 'Target: 8h', up: avgResTime <= 8, color: DS.success },
    { label: 'Agent Count', value: agentStats.filter(a => a.name !== 'Unassigned').length, trend: 'Active', up: true, color: '#c084fc' },
  ];

  const handleExportExcel = () => {
    const wb = utils.book_new();
    
    // Sheet 1: Raw Ticket Data
    const ticketRows = tickets.map(t => ({
      ID: t.id,
      Title: t.title,
      Department: t.department || t.employee?.department || 'General',
      Status: t.status,
      Priority: t.priority,
      Type: t.issue_type,
      "SLA Deadline": t.sla_deadline,
      Created: t.created_at
    }));
    const wsTickets = utils.json_to_sheet(ticketRows);
    utils.book_append_sheet(wb, wsTickets, "All Tickets");

    // Sheet 2: Agent Performance
    const agentRows = agentStats.map(a => ({
      "Agent Name": a.name,
      "Total Assigned": a.total,
      "Resolved": a.resolved,
      "Resolution Rate": `${((a.resolved / a.total) * 100).toFixed(1)}%`,
      "SLA Breaches": a.breached
    }));
    const wsAgents = utils.json_to_sheet(agentRows);
    utils.book_append_sheet(wb, wsAgents, "Agent Performance");

    const wbout = write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([wbout], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `analytics_report_${new Date().toISOString().split('T')[0]}.xlsx`;
    link.click();
  };

  const statusCounts = {
    open: tickets.filter(t => t.status === 'Open').length,
    in_progress: tickets.filter(t => t.status === 'In Progress').length,
    resolved: tickets.filter(t => t.status === 'Resolved' || t.status === 'Closed').length,
  };

  const categoryMap: Record<string, number> = {};
  tickets.forEach(t => {
    const c = t.issue_type || 'Other';
    categoryMap[c] = (categoryMap[c] || 0) + 1;
  });

  const barData = {
    labels: ['Open', 'In Progress', 'Resolved'],
    datasets: [{
      label: 'Tickets',
      data: [statusCounts.open, statusCounts.in_progress, statusCounts.resolved],
      backgroundColor: ['rgba(14,165,233,0.7)', 'rgba(255,184,110,0.7)', 'rgba(74,222,128,0.7)'],
      borderRadius: 8,
    }],
  };

  return (
    <div style={{ minHeight: '100vh', background: DS.bg, padding: '32px', fontFamily: "'Inter', sans-serif" }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }}
          style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '28px' }}
        >
          <div>
            <p style={{ color: DS.muted, fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '4px' }}>Insights</p>
            <h1 style={{ color: DS.text, fontSize: '1.875rem', fontWeight: 800, letterSpacing: '-0.02em' }}>Analytics Hub</h1>
          </div>
          <button 
            onClick={handleExportExcel}
            style={{ display: 'flex', alignItems: 'center', gap: '8px', background: DS.card, border: `1px solid ${DS.border}`, borderRadius: '12px', padding: '10px 18px', color: DS.text, fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer' }}
          >
            <Download size={16} /> Export Excel
          </button>
        </motion.div>

        {/* KPI Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
          {kpis.map((k, i) => (
            <motion.div
              key={k.label}
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }}
              style={{ background: DS.card, borderRadius: '16px', padding: '22px', border: `1px solid ${DS.border}` }}
            >
              <p style={{ color: DS.muted, fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '12px' }}>{k.label}</p>
              <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
                <h3 style={{ color: k.color, fontSize: '2.25rem', fontWeight: 800, lineHeight: 1 }}>{loading ? '—' : k.value}</h3>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: k.up ? DS.success : '#ffb4ab', fontSize: '0.75rem', fontWeight: 700 }}>
                  {k.up ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                  {k.trend}
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* View Tabs */}
        <div style={{ display: 'flex', gap: '4px', background: DS.card, borderRadius: '12px', padding: '6px', border: `1px solid ${DS.border}`, marginBottom: '24px', width: 'fit-content' }}>
          {views.map(v => (
            <button
              key={v.id}
              onClick={() => setActiveView(v.id)}
              style={{
                padding: '8px 18px', borderRadius: '8px', border: 'none', cursor: 'pointer',
                fontSize: '0.78rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px',
                background: activeView === v.id ? 'rgba(14,165,233,0.2)' : 'transparent',
                color: activeView === v.id ? '#89ceff' : DS.muted,
                transition: 'all 0.15s',
              }}
            >
              <v.icon size={14} /> {v.name}
            </button>
          ))}
        </div>

        {/* Charts */}
        {activeView === 'overview' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
            <div style={{ background: DS.card, borderRadius: '20px', padding: '24px', border: `1px solid ${DS.border}` }}>
              <h3 style={{ color: DS.text, fontWeight: 700, marginBottom: '20px' }}>Current Workload</h3>
              <Bar data={barData} options={{ ...chartDefaults, responsive: true }} />
            </div>
            <div style={{ background: DS.card, borderRadius: '20px', padding: '24px', border: `1px solid ${DS.border}` }}>
              <h3 style={{ color: DS.text, fontWeight: 700, marginBottom: '20px' }}>New Ticket Volume (Last 7 Days)</h3>
              <Line 
                data={{
                  labels: [...Array(7)].map((_, i) => {
                    const d = new Date();
                    d.setDate(d.getDate() - (6 - i));
                    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                  }),
                  datasets: [{
                    label: 'New Tickets',
                    data: [...Array(7)].map((_, i) => {
                      const d = new Date();
                      d.setDate(d.getDate() - (6 - i));
                      const dateStr = d.toISOString().split('T')[0];
                      return tickets.filter(t => t.created_at.startsWith(dateStr)).length;
                    }),
                    borderColor: DS.primary,
                    backgroundColor: 'rgba(14,165,233,0.1)',
                    fill: true,
                    tension: 0.4,
                    pointBackgroundColor: DS.primary,
                    pointRadius: 4,
                  }]
                }} 
                options={{ 
                  ...chartDefaults, 
                  responsive: true,
                  plugins: {
                    legend: { display: false }
                  }
                }} 
              />
            </div>
          </div>
        )}

        {activeView === 'sla' && (
          <div style={{ background: DS.card, borderRadius: '20px', padding: '32px', border: `1px solid ${DS.border}`, textAlign: 'center' }}>
            <Clock size={48} color="rgba(14,165,233,0.3)" style={{ margin: '0 auto 16px' }} />
            <h3 style={{ color: DS.text, fontWeight: 700, fontSize: '1.25rem', marginBottom: '8px' }}>Response & Resolution Efficiency</h3>
            <p style={{ color: DS.muted }}>Measuring the speed of service against organizational SLA targets.</p>
            <div style={{ marginTop: '32px', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
              {[
                { label: 'Avg Resolution Time', value: `${avgResTime.toFixed(1)}h`, good: avgResTime <= 8 },
                { label: 'SLA Breach Rate', value: `${getSlaBreachRate().toFixed(1)}%`, good: getSlaBreachRate() < 5 },
                { label: 'Escalation Rate', value: `${((tickets.filter(t => t.escalation_level > 0).length / (tickets.length || 1)) * 100).toFixed(1)}%`, good: false },
              ].map(s => (
                <div key={s.label} style={{ background: DS.surface, borderRadius: '14px', padding: '20px', border: `1px solid ${DS.border}` }}>
                  <p style={{ color: DS.muted, fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '8px' }}>{s.label}</p>
                  <h3 style={{ color: s.good ? DS.success : (s.label.includes('Breach') ? '#ffb4ab' : '#89ceff'), fontSize: '1.75rem', fontWeight: 800 }}>{s.value}</h3>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeView === 'agents' && (
          <div style={{ background: DS.card, borderRadius: '20px', padding: '24px', border: `1px solid ${DS.border}` }}>
            <h3 style={{ color: DS.text, fontWeight: 700, marginBottom: '20px' }}>Agent Performance Matrix</h3>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ textAlign: 'left', borderBottom: `1px solid ${DS.border}` }}>
                    {['Agent Name', 'Total Assigned', 'Resolved', 'Resolution Rate', 'SLA Breaches'].map(h => (
                      <th key={h} style={{ padding: '12px', fontSize: '0.65rem', fontWeight: 800, color: DS.muted, textTransform: 'uppercase' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {agentStats.map(a => (
                    <tr key={a.name} style={{ borderBottom: `1px solid ${DS.border}` }}>
                      <td style={{ padding: '16px 12px', color: DS.text, fontWeight: 700, fontSize: '0.875rem' }}>{a.name}</td>
                      <td style={{ padding: '16px 12px', color: DS.text }}>{a.total}</td>
                      <td style={{ padding: '16px 12px', color: DS.text }}>{a.resolved}</td>
                      <td style={{ padding: '16px 12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div style={{ width: '60px', height: '6px', background: 'rgba(255,255,255,0.05)', borderRadius: '3px', overflow: 'hidden' }}>
                            <div style={{ width: `${(a.resolved / (a.total || 1)) * 100}%`, height: '100%', background: DS.success }} />
                          </div>
                          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: DS.success }}>{((a.resolved / (a.total || 1)) * 100).toFixed(0)}%</span>
                        </div>
                      </td>
                      <td style={{ padding: '16px 12px' }}>
                        <span style={{ color: a.breached > 0 ? '#ffb4ab' : DS.success, fontWeight: 700 }}>{a.breached}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeView === 'categories' && (
          <div style={{ background: DS.card, borderRadius: '20px', padding: '24px', border: `1px solid ${DS.border}` }}>
            <h3 style={{ color: DS.text, fontWeight: 700, marginBottom: '20px' }}>Issue Distribution</h3>
            {Object.keys(categoryMap).length > 0 ? (
              <Bar data={{
                labels: Object.keys(categoryMap),
                datasets: [{
                  label: 'Tickets',
                  data: Object.values(categoryMap),
                  backgroundColor: 'rgba(14,165,233,0.7)',
                  borderRadius: 6,
                }]
              }} options={{ ...chartDefaults, responsive: true, indexAxis: 'y' as const }} />
            ) : (
              <div style={{ padding: '32px', textAlign: 'center', color: DS.muted }}>No category data available yet.</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
