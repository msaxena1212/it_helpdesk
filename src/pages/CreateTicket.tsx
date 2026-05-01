import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { createTicket, getAllUsers } from '../lib/api';
import {
  CheckCircle2, ChevronRight, ChevronLeft,
  AlertCircle, Cpu, Type, FileText, Paperclip,
  ShieldAlert, Send, Loader2, X, Calendar, User, Mail, Building2, Activity, Clock
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const DS = {
  bg: '#0f172a', card: '#131b2e', cardHigh: '#222a3d',
  border: 'rgba(14,165,233,0.12)', primary: '#0ea5e9',
  text: '#dae2fd', muted: '#88929b', surface: '#0b1326',
};

import { useAuth } from '../lib/AuthContext';

const categories = ['Hardware', 'Software', 'Network', 'Access / Login', 'Deployment Request', 'GitLab Access', 'Other'];
const departmentsList = ['Engineering', 'Product', 'HR', 'Sales', 'Marketing', 'Finance', 'Other'];
const priorities = [
  { label: 'Low', color: '#4ade80', bg: 'rgba(74,222,128,0.12)' },
  { label: 'Medium', color: '#89ceff', bg: 'rgba(14,165,233,0.12)' },
  { label: 'High', color: '#ffb86e', bg: 'rgba(255,184,110,0.12)' },
  { label: 'Critical', color: '#ff4444', bg: 'rgba(255,68,68,0.12)' },
];
const frequencies = ['One-Time', 'Intermittent', 'Always'];

const FieldLabel = ({ children, required }: { children: React.ReactNode, required?: boolean }) => (
  <label style={{ display: 'block', color: DS.muted, fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '8px' }}>
    {children} {required && <span style={{ color: '#ff4444' }}>*</span>}
  </label>
);

const inputStyle = {
  width: '100%', background: DS.surface, border: `1px solid ${DS.border}`,
  borderRadius: '10px', padding: '12px 14px', color: DS.text,
  fontSize: '0.875rem', outline: 'none', boxSizing: 'border-box' as const,
  fontFamily: "'Inter', sans-serif", transition: 'border-color 0.2s',
};

export const CreateTicket = () => {
  const navigate = useNavigate();
  const { user, profile } = useAuth();

  // Must be declared before any state that depends on it
  const canCreateOnBehalf = profile?.role === 'admin' || profile?.role === 'superadmin' || profile?.role === 'network_engineer' || user?.email === 'superadmin@elitemindz.co';
  const totalSteps = canCreateOnBehalf ? 4 : 3;

  // Non-privileged users skip step 1 (User Info is auto-filled from profile)
  const [step, setStep] = useState(1);
  const startStep = canCreateOnBehalf ? 1 : 2;
  const visibleStep = canCreateOnBehalf ? step : step - 1;

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [users, setUsers] = useState<any[]>([]);

  const [formData, setFormData] = useState({
    employee_id: '',
    name: '',
    email: '',
    department: '',
    title: '',
    description: '',
    category: '',
    priority: 'Medium',
    is_blocked: 'No',
    issue_start_date: '',
    frequency: '',
    target_environment: 'Staging',
    branch_tag_name: '',
    release_notes: '',
    rollback_plan: '',
    gitlab_repo_url: '',
    requested_role: 'Developer',
    justification: ''
  });


  useEffect(() => {
    if (canCreateOnBehalf) {
      getAllUsers().then(data => setUsers(data || [])).catch(console.error);
    } else if (user) {
      // Pre-fill for standard user and skip to step 2
      setFormData(prev => ({
        ...prev,
        employee_id: user.id,
        name: profile?.name || user.user_metadata?.name || user.email?.split('@')[0] || '',
        email: user.email || '',
        department: profile?.department || user.user_metadata?.department || ''
      }));
      setStep(2); // skip User Info step for regular users
    }
  }, [user, profile, canCreateOnBehalf]);

  const handleUserSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedId = e.target.value;
    if (!selectedId) {
      setFormData(prev => ({ ...prev, employee_id: '', name: '', email: '', department: '' }));
      return;
    }
    const user = users.find(u => u.id === selectedId);
    if (user) {
      setFormData(prev => ({
        ...prev,
        employee_id: user.id,
        name: user.name || '',
        email: user.email || '',
        department: user.department || ''
      }));
    }
  };

  const nextStep = () => {
    // Validation
    if (step === 1 && canCreateOnBehalf) {
      if (!formData.name || !formData.email || !formData.department) {
        setError("Please fill all required user details");
        return;
      }
    }
    if (step === 2) {
      const isDevOps = ['GitLab Access', 'Deployment Request'].includes(formData.category);
      if (!formData.title || !formData.description || !formData.category || (!isDevOps && !formData.frequency)) {
        setError("Please fill all required issue details");
        return;
      }
    }
    setError(null);
    setStep(s => Math.min(s + 1, 4));
  };
  
  const prevStep = () => setStep(s => Math.max(s - 1, canCreateOnBehalf ? 1 : 2));

  const handleSubmit = async () => {
    try {
      setLoading(true);
      setError(null);
      await createTicket({
        employee_id: formData.employee_id || undefined, // undefined will fallback to auth user
        title: formData.title,
        description: formData.description,
        issue_type: formData.category,
        sub_type: 'General',
        priority: formData.priority,
        is_blocked: formData.is_blocked === 'Yes',
        issue_start_date: formData.issue_start_date || null,
        frequency: formData.frequency,
        department: formData.department,
        guest_name: formData.employee_id ? undefined : formData.name,
        guest_email: formData.employee_id ? undefined : formData.email,
        custom_fields: formData.category === 'Deployment Request' ? {
          target_environment: formData.target_environment,
          branch_tag_name: formData.branch_tag_name,
          release_notes: formData.release_notes,
          rollback_plan: formData.rollback_plan
        } : formData.category === 'GitLab Access' ? {
          gitlab_repo_url: formData.gitlab_repo_url,
          requested_role: profile?.role || 'User',
          justification: formData.justification
        } : {}
      });
      setSuccess(true);
      setTimeout(() => navigate('/'), 2000);
    } catch (err: any) {
      setError(err.message || 'Failed to create ticket');
    } finally {
      setLoading(false);
    }
  };

  const allStepLabels = ['User Info', 'Issue Details', 'Impact & Priority', 'Review'];
  const stepLabels = canCreateOnBehalf ? allStepLabels : allStepLabels.slice(1);

  const renderStep = () => {
    switch (step) {
      case 1:
        return (
          <motion.div key="step1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
            style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}
          >
            {canCreateOnBehalf && users.length > 0 && (
              <div>
                <FieldLabel>Select User (Optional)</FieldLabel>
                <select
                  value={formData.employee_id}
                  onChange={handleUserSelect}
                  style={{ ...inputStyle, cursor: 'pointer', border: '1px solid rgba(14,165,233,0.3)' }}
                  onFocus={e => (e.target.style.borderColor = 'rgba(14,165,233,0.5)')}
                  onBlur={e => (e.target.style.borderColor = 'rgba(14,165,233,0.3)')}
                >
                  <option value="" style={{ background: DS.surface }}>-- Autofill from existing user --</option>
                  {users.map(u => (
                    <option key={u.id} value={u.id} style={{ background: DS.surface }}>{u.name} | {u.email}</option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <FieldLabel required>Full Name</FieldLabel>
              <div style={{ position: 'relative' }}>
                <User size={16} color={DS.muted} style={{ position: 'absolute', left: '14px', top: '14px' }} />
                <input
                  type="text" placeholder="Enter your full name"
                  value={formData.name}
                  readOnly={!canCreateOnBehalf}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  style={{ ...inputStyle, paddingLeft: '40px', opacity: !canCreateOnBehalf ? 0.7 : 1 }}
                  onFocus={e => (e.target.style.borderColor = 'rgba(14,165,233,0.5)')}
                  onBlur={e => (e.target.style.borderColor = DS.border)}
                />
              </div>
            </div>
            <div>
              <FieldLabel required>Email Address</FieldLabel>
              <div style={{ position: 'relative' }}>
                <Mail size={16} color={DS.muted} style={{ position: 'absolute', left: '14px', top: '14px' }} />
                <input
                  type="email" placeholder="Use your official company email"
                  value={formData.email}
                  readOnly={!canCreateOnBehalf}
                  onChange={e => setFormData({ ...formData, email: e.target.value })}
                  style={{ ...inputStyle, paddingLeft: '40px', opacity: !canCreateOnBehalf ? 0.7 : 1 }}
                  onFocus={e => (e.target.style.borderColor = 'rgba(14,165,233,0.5)')}
                  onBlur={e => (e.target.style.borderColor = DS.border)}
                />
              </div>
            </div>
            <div>
              <FieldLabel required>Department</FieldLabel>
              <div style={{ position: 'relative' }}>
                <Building2 size={16} color={DS.muted} style={{ position: 'absolute', left: '14px', top: '14px' }} />
                <select
                  value={formData.department}
                  disabled={!canCreateOnBehalf}
                  onChange={e => setFormData({ ...formData, department: e.target.value })}
                  style={{ ...inputStyle, paddingLeft: '40px', cursor: !canCreateOnBehalf ? 'default' : 'pointer', opacity: !canCreateOnBehalf ? 0.7 : 1 }}
                  onFocus={e => (e.target.style.borderColor = 'rgba(14,165,233,0.5)')}
                  onBlur={e => (e.target.style.borderColor = DS.border)}
                >
                  <option value="" style={{ background: DS.surface }}>Select Department</option>
                  {departmentsList.map(d => (
                    <option key={d} value={d} style={{ background: DS.surface }}>{d}</option>
                  ))}
                </select>
              </div>
            </div>
          </motion.div>
        );

      case 2:
        return (
          <motion.div key="step2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
            style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}
          >
            <div>
              <FieldLabel required>Issue Title</FieldLabel>
              <input
                type="text" placeholder="e.g. Laptop not turning on"
                value={formData.title}
                onChange={e => setFormData({ ...formData, title: e.target.value })}
                style={inputStyle}
                onFocus={e => (e.target.style.borderColor = 'rgba(14,165,233,0.5)')}
                onBlur={e => (e.target.style.borderColor = DS.border)}
              />
            </div>
            <div>
              <FieldLabel required>Issue Type</FieldLabel>
              <select
                value={formData.category}
                onChange={e => setFormData({ ...formData, category: e.target.value })}
                style={{ ...inputStyle, cursor: 'pointer' }}
                onFocus={e => (e.target.style.borderColor = 'rgba(14,165,233,0.5)')}
                onBlur={e => (e.target.style.borderColor = DS.border)}
              >
                <option value="" style={{ background: DS.surface }}>Select a category...</option>
                {categories.map(c => (
                  <option key={c} value={c} style={{ background: DS.surface }}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <FieldLabel required>Describe the Issue</FieldLabel>
              <textarea
                rows={4}
                placeholder="Explain the problem in detail"
                value={formData.description}
                onChange={e => setFormData({ ...formData, description: e.target.value })}
                style={{ ...inputStyle, resize: 'vertical', minHeight: '100px' }}
                onFocus={e => (e.target.style.borderColor = 'rgba(14,165,233,0.5)')}
                onBlur={e => (e.target.style.borderColor = DS.border)}
              />
            </div>

            {formData.category === 'Deployment Request' && (
              <>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <div style={{ flex: 1 }}>
                    <FieldLabel required>Target Environment</FieldLabel>
                    <select value={formData.target_environment} onChange={e => setFormData({ ...formData, target_environment: e.target.value })} style={inputStyle}>
                      <option>Staging</option><option>Production</option>
                    </select>
                  </div>
                  <div style={{ flex: 1 }}>
                    <FieldLabel required>Branch / Tag Name</FieldLabel>
                    <input type="text" value={formData.branch_tag_name} onChange={e => setFormData({ ...formData, branch_tag_name: e.target.value })} placeholder="e.g. main, v1.2" style={inputStyle} />
                  </div>
                </div>
                <div>
                  <FieldLabel required>Release Notes</FieldLabel>
                  <textarea rows={2} value={formData.release_notes} onChange={e => setFormData({ ...formData, release_notes: e.target.value })} placeholder="What features/fixes are in this release?" style={{ ...inputStyle, resize: 'vertical' }} />
                </div>
                <div>
                  <FieldLabel required>Rollback Plan</FieldLabel>
                  <textarea rows={2} value={formData.rollback_plan} onChange={e => setFormData({ ...formData, rollback_plan: e.target.value })} placeholder="Steps to revert if deployment fails" style={{ ...inputStyle, resize: 'vertical' }} />
                </div>
              </>
            )}

            {formData.category === 'GitLab Access' && (
              <>
                <div>
                  <FieldLabel required>GitLab Repo URL</FieldLabel>
                  <input type="text" value={formData.gitlab_repo_url} onChange={e => setFormData({ ...formData, gitlab_repo_url: e.target.value })} placeholder="https://gitlab.com/org/repo" style={inputStyle} />
                </div>
                <div>
                  <FieldLabel required>Justification</FieldLabel>
                  <textarea rows={2} value={formData.justification} onChange={e => setFormData({ ...formData, justification: e.target.value })} placeholder="Why do you need access?" style={{ ...inputStyle, resize: 'vertical' }} />
                </div>
              </>
            )}

            {!['GitLab Access', 'Deployment Request'].includes(formData.category) && (
              <div>
                <FieldLabel required>Frequency of Issue</FieldLabel>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {frequencies.map(f => (
                    <button
                      key={f}
                      onClick={() => setFormData({ ...formData, frequency: f })}
                      style={{
                        flex: 1, padding: '10px', borderRadius: '10px', border: 'none',
                        background: formData.frequency === f ? 'rgba(14,165,233,0.15)' : 'rgba(255,255,255,0.04)',
                        color: formData.frequency === f ? '#89ceff' : DS.muted,
                        fontWeight: formData.frequency === f ? 700 : 600, fontSize: '0.75rem',
                        outline: formData.frequency === f ? `1px solid rgba(14,165,233,0.5)` : '1px solid transparent',
                        cursor: 'pointer', transition: 'all 0.15s',
                      }}
                    >
                      {f}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        );

      case 3:
        return (
          <motion.div key="step3" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
            style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}
          >
            <div>
              <FieldLabel required>Priority / Impact</FieldLabel>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
                {priorities.map(p => (
                  <button
                    key={p.label}
                    onClick={() => setFormData({ ...formData, priority: p.label })}
                    style={{
                      padding: '12px 8px', borderRadius: '10px', border: 'none',
                      background: formData.priority === p.label ? p.bg : 'rgba(255,255,255,0.04)',
                      color: formData.priority === p.label ? p.color : DS.muted,
                      fontWeight: 800, fontSize: '0.72rem', letterSpacing: '0.06em',
                      textTransform: 'uppercase', cursor: 'pointer',
                      outline: formData.priority === p.label ? `2px solid ${p.color}` : '2px solid transparent',
                      transition: 'all 0.15s',
                    }}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <FieldLabel required>Is your work completely blocked?</FieldLabel>
              <div style={{ display: 'flex', gap: '8px' }}>
                {['Yes', 'No'].map(opt => (
                  <button
                    key={opt}
                    onClick={() => setFormData({ ...formData, is_blocked: opt })}
                    style={{
                      flex: 1, padding: '12px', borderRadius: '10px', border: 'none',
                      background: formData.is_blocked === opt ? (opt === 'Yes' ? 'rgba(255,68,68,0.15)' : 'rgba(14,165,233,0.15)') : 'rgba(255,255,255,0.04)',
                      color: formData.is_blocked === opt ? (opt === 'Yes' ? '#ffb4ab' : '#89ceff') : DS.muted,
                      fontWeight: 800, fontSize: '0.8rem', cursor: 'pointer',
                      outline: formData.is_blocked === opt ? `1px solid ${opt === 'Yes' ? 'rgba(255,68,68,0.5)' : 'rgba(14,165,233,0.5)'}` : '1px solid transparent',
                      transition: 'all 0.15s',
                    }}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>

            {!['GitLab Access', 'Deployment Request'].includes(formData.category) && (
              <div>
                <FieldLabel>When did this issue start?</FieldLabel>
                <div style={{ position: 'relative' }}>
                  <Calendar size={16} color={DS.muted} style={{ position: 'absolute', left: '14px', top: '14px' }} />
                  <input
                    type="date"
                    value={formData.issue_start_date}
                    onChange={e => setFormData({ ...formData, issue_start_date: e.target.value })}
                    style={{ ...inputStyle, paddingLeft: '40px', cursor: 'pointer' }}
                    onFocus={e => (e.target.style.borderColor = 'rgba(14,165,233,0.5)')}
                    onBlur={e => (e.target.style.borderColor = DS.border)}
                  />
                </div>
              </div>
            )}
          </motion.div>
        );

      case 4:
        return (
          <motion.div key="step4" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
            style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}
          >
            {error && (
              <div style={{ padding: '12px 16px', background: 'rgba(255,180,171,0.08)', border: '1px solid rgba(255,180,171,0.2)', borderRadius: '10px', display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                <AlertCircle size={16} color="#ffb4ab" style={{ flexShrink: 0, marginTop: '1px' }} />
                <span style={{ color: '#ffb4ab', fontSize: '0.8rem' }}>{error}</span>
                <button onClick={() => setError(null)} style={{ marginLeft: 'auto', color: DS.muted, background: 'none', border: 'none', cursor: 'pointer' }}><X size={14} /></button>
              </div>
            )}
            {success && (
              <div style={{ padding: '16px', background: 'rgba(74,222,128,0.08)', border: '1px solid rgba(74,222,128,0.2)', borderRadius: '10px', display: 'flex', gap: '10px', alignItems: 'center' }}>
                <CheckCircle2 size={18} color="#4ade80" />
                <span style={{ color: '#4ade80', fontWeight: 700, fontSize: '0.875rem' }}>Ticket submitted! Redirecting...</span>
              </div>
            )}

            {/* Summary Card */}
            <div style={{ background: DS.surface, borderRadius: '16px', padding: '20px', border: `1px solid ${DS.border}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                <div>
                  <h4 style={{ color: DS.text, fontWeight: 800, fontSize: '1rem', marginBottom: '4px' }}>{formData.title || 'Untitled Issue'}</h4>
                  <p style={{ color: DS.muted, fontSize: '0.78rem', textTransform: 'capitalize' }}>{formData.category || 'No category'}</p>
                </div>
                <span style={{
                  padding: '4px 12px', borderRadius: '99px', fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase',
                  background: priorities.find(p => p.label === formData.priority)?.bg || 'rgba(14,165,233,0.12)',
                  color: priorities.find(p => p.label === formData.priority)?.color || '#89ceff',
                }}>
                  {formData.priority}
                </span>
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px', background: 'rgba(255,255,255,0.02)', padding: '12px', borderRadius: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: DS.text, fontSize: '0.75rem' }}>
                  <User size={14} color={DS.muted} /> {formData.name} ({formData.department})
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: DS.text, fontSize: '0.75rem' }}>
                  <Mail size={14} color={DS.muted} /> {formData.email}
                </div>
                {formData.is_blocked === 'Yes' && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#ffb4ab', fontSize: '0.75rem', fontWeight: 700 }}>
                    <ShieldAlert size={14} /> Work is completely blocked
                  </div>
                )}
                {formData.issue_start_date && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: DS.text, fontSize: '0.75rem' }}>
                    <Clock size={14} color={DS.muted} /> Started: {formData.issue_start_date}
                  </div>
                )}
              </div>

              {formData.description && (
                <p style={{ color: DS.muted, fontSize: '0.8rem', lineHeight: 1.6, borderTop: `1px solid ${DS.border}`, paddingTop: '12px', fontStyle: 'italic' }}>
                  "{formData.description}"
                </p>
              )}
            </div>

            {/* Attachment area */}
            <div style={{
              border: `2px dashed rgba(14,165,233,0.2)`, borderRadius: '14px',
              padding: '24px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '10px',
              cursor: 'pointer', transition: 'border-color 0.2s',
            }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(14,165,233,0.5)')}
              onMouseLeave={e => (e.currentTarget.style.borderColor = 'rgba(14,165,233,0.2)')}
            >
              <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'rgba(14,165,233,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Paperclip size={18} color="#89ceff" />
              </div>
              <p style={{ color: DS.muted, fontWeight: 700, fontSize: '0.75rem' }}>Click to attach files (Optional)</p>
            </div>
          </motion.div>
        );
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: DS.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '32px', fontFamily: "'Inter', sans-serif" }}>
      <div style={{ width: '100%', maxWidth: '600px', background: DS.card, borderRadius: '24px', border: `1px solid ${DS.border}`, overflow: 'hidden', boxShadow: '0 32px 80px rgba(0,0,0,0.5)' }}>

        {/* Header */}
        <div style={{ padding: '28px 32px', borderBottom: `1px solid ${DS.border}`, background: 'rgba(14,165,233,0.04)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <div>
              <p style={{ color: DS.muted, fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '4px' }}>New Request</p>
              <h2 style={{ color: DS.text, fontSize: '1.375rem', fontWeight: 800, letterSpacing: '-0.01em' }}>Raise IT Support Ticket</h2>
            </div>
            {/* Step indicators */}
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
              {Array.from({ length: totalSteps }, (_, i) => i + 1).map(s => (
                <div key={s} style={{
                  height: '6px', borderRadius: '99px',
                  width: visibleStep === s ? '32px' : '16px',
                  background: s <= visibleStep ? '#0ea5e9' : 'rgba(255,255,255,0.1)',
                  transition: 'all 0.3s',
                }} />
              ))}
            </div>
          </div>
          {/* Step label */}
          <p style={{ color: '#89ceff', fontSize: '0.75rem', fontWeight: 700 }}>
            Step {visibleStep} of {totalSteps} — {stepLabels[visibleStep - 1]}
          </p>
        </div>

        {/* Content */}
        <div style={{ padding: '28px 32px', minHeight: '380px' }}>
          <AnimatePresence mode="wait">
            {renderStep()}
          </AnimatePresence>
        </div>

        {/* Footer */}
        <div style={{ padding: '20px 32px', borderTop: `1px solid ${DS.border}`, background: 'rgba(0,0,0,0.2)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <button
            onClick={prevStep}
            disabled={step === startStep}
            style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '10px 18px', borderRadius: '10px',
              background: step === startStep ? 'transparent' : DS.surface,
              border: step === startStep ? 'none' : `1px solid ${DS.border}`,
              color: step === startStep ? 'transparent' : DS.text,
              fontWeight: 700, fontSize: '0.8rem', cursor: step === startStep ? 'default' : 'pointer',
              letterSpacing: '0.04em', pointerEvents: step === startStep ? 'none' : 'auto',
            }}
          >
            <ChevronLeft size={16} /> Back
          </button>

          {error && step < 4 && <div style={{ color: '#ffb4ab', fontSize: '0.75rem', fontWeight: 600, maxWidth: '200px', textAlign: 'center' }}>{error}</div>}

          {step < 4 ? (
            <motion.button
              whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
              onClick={nextStep}
              style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                background: 'linear-gradient(135deg, #0ea5e9, #0284c7)',
                border: 'none', borderRadius: '10px',
                padding: '10px 24px', color: '#fff', fontWeight: 700,
                fontSize: '0.8rem', cursor: 'pointer', letterSpacing: '0.06em',
                boxShadow: '0 6px 16px rgba(14,165,233,0.3)',
              }}
            >
              Continue <ChevronRight size={16} />
            </motion.button>
          ) : (
            <motion.button
              whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
              onClick={handleSubmit}
              disabled={loading || success}
              style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                background: success ? 'rgba(74,222,128,0.2)' : 'linear-gradient(135deg, #4ade80, #22c55e)',
                border: success ? '1px solid rgba(74,222,128,0.3)' : 'none',
                borderRadius: '10px', padding: '10px 24px',
                color: success ? '#4ade80' : '#fff',
                fontWeight: 700, fontSize: '0.8rem',
                cursor: loading || success ? 'not-allowed' : 'pointer',
                letterSpacing: '0.06em', opacity: loading && !success ? 0.7 : 1,
                boxShadow: success ? 'none' : '0 6px 16px rgba(74,222,128,0.3)',
              }}
            >
              {loading ? <Loader2 size={16} style={{ animation: 'spin 0.8s linear infinite' }} /> : <Send size={16} />}
              {loading ? 'Submitting...' : success ? 'Submitted!' : 'Submit Ticket'}
            </motion.button>
          )}
        </div>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
};
