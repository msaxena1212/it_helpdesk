import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';

interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}

const DS = {
  bg: '#0f172a',
  card: '#131b2e',
  border: 'rgba(14,165,233,0.1)',
  text: '#dae2fd',
  muted: '#88929b',
};

export const Drawer: React.FC<DrawerProps> = ({ isOpen, onClose, title, subtitle, children }) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0, 0, 0, 0.7)',
              backdropFilter: 'blur(4px)',
              zIndex: 100,
            }}
          />

          {/* Drawer Content */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            style={{
              position: 'fixed',
              top: 0,
              right: 0,
              bottom: 0,
              width: '100%',
              maxWidth: '480px',
              background: DS.card,
              borderLeft: `1px solid ${DS.border}`,
              boxShadow: '-10px 0 30px rgba(0, 0, 0, 0.5)',
              zIndex: 101,
              display: 'flex',
              flexDirection: 'column',
              fontFamily: "'Inter', sans-serif",
            }}
          >
            {/* Header */}
            <div style={{ padding: '32px', borderBottom: `1px solid ${DS.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <h3 style={{ fontSize: '1.5rem', fontWeight: 800, color: DS.text, letterSpacing: '-0.02em', margin: 0 }}>{title}</h3>
                {subtitle && <p style={{ fontSize: '0.85rem', color: DS.muted, marginTop: '4px', margin: 0 }}>{subtitle}</p>}
              </div>
              <button
                onClick={onClose}
                style={{
                  background: 'rgba(14,165,233,0.05)',
                  border: 'none',
                  borderRadius: '12px',
                  padding: '10px',
                  cursor: 'pointer',
                  color: DS.muted,
                  transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = '#fff')}
                onMouseLeave={(e) => (e.currentTarget.style.color = DS.muted)}
              >
                <X size={24} />
              </button>
            </div>

            {/* Body */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '32px' }}>
              {children}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
