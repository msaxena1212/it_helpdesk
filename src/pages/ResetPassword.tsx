import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Lock, Eye, EyeOff, ArrowRight, CheckCircle, AlertCircle } from 'lucide-react';
import { motion } from 'framer-motion';

export const ResetPassword = () => {
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    // Check if we have a session (Supabase automatically signs in after recovery link click)
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate('/login');
      }
    };
    checkSession();
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setSuccess(true);
      setTimeout(() => navigate('/login'), 3000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6" style={{ background: '#0b1326' }}>
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        style={{
          width: '100%',
          maxWidth: '440px',
          background: '#131b2e',
          borderRadius: '28px',
          padding: '48px 40px',
          border: '1px solid rgba(14,165,233,0.12)',
          boxShadow: '0 32px 80px rgba(0,0,0,0.4)',
        }}
      >
        <div style={{ marginBottom: '32px' }}>
          <h2 style={{ color: '#dae2fd', fontSize: '1.75rem', fontWeight: 800, letterSpacing: '-0.02em', marginBottom: '6px' }}>
            Set New Password
          </h2>
          <p style={{ color: '#88929b', fontSize: '0.875rem' }}>
            Enter your new secure password below.
          </p>
        </div>

        {error && (
          <div style={{ background: 'rgba(255,180,171,0.08)', border: '1px solid rgba(255,180,171,0.2)', borderRadius: '12px', padding: '12px', marginBottom: '20px', display: 'flex', gap: '10px', color: '#ffb4ab', fontSize: '0.8rem' }}>
            <AlertCircle size={16} />
            {error}
          </div>
        )}

        {success ? (
          <div style={{ textAlign: 'center', padding: '20px' }}>
            <CheckCircle size={48} color="#4ade80" style={{ margin: '0 auto 16px' }} />
            <h3 style={{ color: '#dae2fd', marginBottom: '8px' }}>Password Updated!</h3>
            <p style={{ color: '#88929b' }}>Redirecting to login...</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div>
              <label style={{ display: 'block', color: '#88929b', fontSize: '0.7rem', fontWeight: 700, marginBottom: '8px' }}>NEW PASSWORD</label>
              <div style={{ position: 'relative' }}>
                <Lock size={16} color="#3e4850" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)' }} />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  style={{ width: '100%', background: '#0b1326', border: '1px solid #3e4850', borderRadius: '12px', padding: '13px 44px 13px 40px', color: '#dae2fd', outline: 'none' }}
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)} style={{ position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#3e4850' }}>
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div>
              <label style={{ display: 'block', color: '#88929b', fontSize: '0.7rem', fontWeight: 700, marginBottom: '8px' }}>CONFIRM PASSWORD</label>
              <div style={{ position: 'relative' }}>
                <Lock size={16} color="#3e4850" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)' }} />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  style={{ width: '100%', background: '#0b1326', border: '1px solid #3e4850', borderRadius: '12px', padding: '13px 44px 13px 40px', color: '#dae2fd', outline: 'none' }}
                />
              </div>
            </div>

            <motion.button
              type="submit"
              disabled={loading}
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.98 }}
              style={{
                width: '100%',
                background: 'linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%)',
                border: 'none',
                borderRadius: '12px',
                padding: '14px',
                color: '#fff',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                cursor: loading ? 'not-allowed' : 'pointer',
              }}
            >
              {loading ? 'Updating...' : 'Update Password'}
              <ArrowRight size={16} />
            </motion.button>
          </form>
        )}
      </motion.div>
    </div>
  );
};
