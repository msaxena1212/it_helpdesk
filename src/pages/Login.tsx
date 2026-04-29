import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  CheckCircle,
  BarChart3,
  Cpu,
  Ticket,
  Clock,
  AlertCircle,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const features = [
  {
    icon: Ticket,
    label: 'Ticket Management',
    desc: 'Unified request routing with AI-powered triaging.',
  },
  {
    icon: Cpu,
    label: 'Asset Tracking',
    desc: 'Real-time lifecycle monitoring of global hardware.',
  },
  {
    icon: BarChart3,
    label: 'Analytics',
    desc: 'Advanced reporting on infrastructure health.',
  },
  {
    icon: Clock,
    label: 'SLA Monitoring',
    desc: 'Precision tracking of response and resolution times.',
  },
];

export const Login = () => {
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleForgotPassword = async () => {
    if (!email) {
      setError('Please enter your email address first.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      setSuccess('Password reset link sent! Check your email.');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);

    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (signInError) throw signInError;
      navigate('/');
    } catch (err: any) {
      setError(err.message || 'An error occurred during authentication.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex overflow-hidden"
      style={{ background: '#0b1326', fontFamily: "'Inter', sans-serif" }}
    >
      {/* ─── LEFT: Branding Panel ─── */}
      <div
        className="hidden lg:flex w-1/2 flex-col justify-between relative overflow-hidden"
        style={{
          background: 'linear-gradient(145deg, #0f172a 0%, #1e3a5f 60%, #0ea5e9 160%)',
          padding: '56px 64px',
        }}
      >
        {/* Ambient glow blobs */}
        <div
          style={{
            position: 'absolute', top: '-80px', right: '-80px',
            width: '400px', height: '400px',
            background: 'radial-gradient(circle, rgba(14,165,233,0.18) 0%, transparent 70%)',
            borderRadius: '50%', pointerEvents: 'none',
          }}
        />
        <div
          style={{
            position: 'absolute', bottom: '60px', left: '-60px',
            width: '320px', height: '320px',
            background: 'radial-gradient(circle, rgba(14,165,233,0.10) 0%, transparent 70%)',
            borderRadius: '50%', pointerEvents: 'none',
          }}
        />

        {/* Logo */}
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-8">
            <div
              style={{
                background: 'rgba(14,165,233,0.15)',
                backdropFilter: 'blur(12px)',
                border: '1px solid rgba(14,165,233,0.3)',
                borderRadius: '16px',
                padding: '10px 16px',
              }}
            >
              <img src="/logo.webp" alt="Elite Mindz" style={{ height: '40px', objectFit: 'contain' }} />
            </div>
          </div>

          <h1
            style={{
              fontSize: '2.5rem',
              fontWeight: 800,
              color: '#fff',
              lineHeight: 1.15,
              letterSpacing: '-0.02em',
              marginBottom: '16px',
            }}
          >
            Enterprise IT Support,<br />
            <span style={{ color: '#89ceff' }}>Simplified.</span>
          </h1>
          <p style={{ color: '#adc8f5', fontSize: '1rem', lineHeight: 1.6, maxWidth: '380px', marginBottom: '48px' }}>
            The next generation of asset tracking and ticket orchestration for the modern hybrid workspace.
          </p>

          {/* Feature cards */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            {features.map((f, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 * i + 0.3, duration: 0.5 }}
                style={{
                  background: 'rgba(255,255,255,0.05)',
                  backdropFilter: 'blur(16px)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: '16px',
                  padding: '20px',
                  cursor: 'default',
                }}
              >
                <div
                  style={{
                    width: '36px', height: '36px',
                    background: 'rgba(14,165,233,0.18)',
                    borderRadius: '10px',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    marginBottom: '10px',
                  }}
                >
                  <f.icon size={18} color="#89ceff" />
                </div>
                <div style={{ color: '#fff', fontWeight: 700, fontSize: '0.85rem', marginBottom: '4px' }}>
                  {f.label}
                </div>
                <div style={{ color: '#adc8f5', fontSize: '0.72rem', lineHeight: 1.5 }}>
                  {f.desc}
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="relative z-10" style={{ color: '#4a7fa5', fontSize: '0.68rem', letterSpacing: '0.08em', fontWeight: 600 }}>
          © 2025 ELITE MINDZ • ENTERPRISE v2.6.0
        </div>
      </div>

      {/* ─── RIGHT: Auth Form ─── */}
      <div
        className="w-full lg:w-1/2 flex items-center justify-center p-6"
        style={{ background: '#0b1326' }}
      >
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          style={{
            width: '100%',
            maxWidth: '440px',
            background: '#131b2e',
            borderRadius: '28px',
            padding: '48px 40px',
            border: '1px solid rgba(14,165,233,0.12)',
            boxShadow: '0 32px 80px rgba(0,0,0,0.4), 0 0 0 1px rgba(14,165,233,0.05)',
          }}
        >
          {/* Mobile logo */}
          <div className="lg:hidden mb-8 flex justify-center">
            <img src="/logo.webp" alt="Elite Mindz" style={{ height: '36px', objectFit: 'contain' }} />
          </div>

          {/* Heading */}
          <div style={{ marginBottom: '32px' }}>
            <h2 style={{ color: '#dae2fd', fontSize: '1.75rem', fontWeight: 800, letterSpacing: '-0.02em', marginBottom: '6px' }}>
              Welcome Back
            </h2>
            <p style={{ color: '#88929b', fontSize: '0.875rem' }}>
              Sign in to your corporate workspace
            </p>
          </div>

          {/* Alerts */}
          <AnimatePresence mode="wait">
            {error && (
              <motion.div
                key="error"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                style={{
                  background: 'rgba(255,180,171,0.08)',
                  border: '1px solid rgba(255,180,171,0.2)',
                  borderRadius: '12px',
                  padding: '12px 14px',
                  marginBottom: '20px',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '10px',
                }}
              >
                <AlertCircle size={16} color="#ffb4ab" style={{ marginTop: '1px', flexShrink: 0 }} />
                <span style={{ color: '#ffb4ab', fontSize: '0.8rem', lineHeight: 1.5 }}>{error}</span>
                <button type="button" onClick={() => setError(null)} style={{ marginLeft: 'auto', color: '#88929b', background: 'none', border: 'none' }}>
                  <X size={14} />
                </button>
              </motion.div>
            )}
            {success && (
              <motion.div
                key="success"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                style={{
                  background: 'rgba(34,197,94,0.08)',
                  border: '1px solid rgba(34,197,94,0.2)',
                  borderRadius: '12px',
                  padding: '12px 14px',
                  marginBottom: '20px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                }}
              >
                <CheckCircle size={16} color="#4ade80" style={{ flexShrink: 0 }} />
                <span style={{ color: '#4ade80', fontSize: '0.8rem' }}>{success}</span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Form */}
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Email */}
            <div>
              <label style={{ display: 'block', color: '#88929b', fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '8px' }}>
                Email Address
              </label>
              <div style={{ position: 'relative' }}>
                <Mail
                  size={16}
                  color="#3e4850"
                  style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)' }}
                />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="name@elitemindz.co"
                  style={{
                    width: '100%',
                    background: '#0b1326',
                    border: '1px solid #3e4850',
                    borderRadius: '12px',
                    padding: '13px 14px 13px 40px',
                    color: '#dae2fd',
                    fontSize: '0.9rem',
                    outline: 'none',
                    transition: 'border-color 0.2s',
                    boxSizing: 'border-box',
                  }}
                  onFocus={(e) => (e.target.style.borderColor = 'rgba(14,165,233,0.5)')}
                  onBlur={(e) => (e.target.style.borderColor = '#3e4850')}
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <label style={{ color: '#88929b', fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                  Password
                </label>
                <button type="button" onClick={handleForgotPassword} style={{ color: '#0ea5e9', fontSize: '0.72rem', fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer' }}>
                  Forgot Password?
                </button>
              </div>
              <div style={{ position: 'relative' }}>
                <Lock
                  size={16}
                  color="#3e4850"
                  style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)' }}
                />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="••••••••••"
                  style={{
                    width: '100%',
                    background: '#0b1326',
                    border: '1px solid #3e4850',
                    borderRadius: '12px',
                    padding: '13px 44px 13px 40px',
                    color: '#dae2fd',
                    fontSize: '0.9rem',
                    outline: 'none',
                    transition: 'border-color 0.2s',
                    boxSizing: 'border-box',
                  }}
                  onFocus={(e) => (e.target.style.borderColor = 'rgba(14,165,233,0.5)')}
                  onBlur={(e) => (e.target.style.borderColor = '#3e4850')}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    position: 'absolute', right: '14px', top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: '#3e4850',
                  }}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Submit button */}
            <motion.button
              type="submit"
              disabled={loading}
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.98 }}
              style={{
                width: '100%',
                background: loading ? 'rgba(14,165,233,0.5)' : 'linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%)',
                border: 'none',
                borderRadius: '12px',
                padding: '14px',
                color: '#fff',
                fontWeight: 700,
                fontSize: '0.85rem',
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                cursor: loading ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                boxShadow: '0 8px 24px rgba(14,165,233,0.3)',
                transition: 'background 0.2s',
                marginTop: '4px',
              }}
            >
              {loading ? (
                <>
                  <span style={{ display: 'inline-block', width: '14px', height: '14px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                  Processing...
                </>
              ) : (
                <>
                  Sign In to Dashboard
                  <ArrowRight size={16} />
                </>
              )}
            </motion.button>
          </form>

          {/* Legal link */}
          <div style={{ textAlign: 'center', marginTop: '24px' }}>
            <span style={{ color: '#4a7fa5', fontSize: '0.7rem', fontWeight: 600 }}>
              ACCESS RESTRICTED TO AUTHORIZED PERSONNEL
            </span>
          </div>
        </motion.div>
      </div>

      {/* Spin animation */}
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
};

