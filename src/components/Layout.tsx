import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { GlobalHeader } from './GlobalHeader';

export const Layout = () => {
  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#0b1326', color: '#dae2fd', overflow: 'hidden', fontFamily: "'Inter', sans-serif" }}>
      <Sidebar />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, background: '#0f172a', height: '100vh', position: 'relative', overflowY: 'auto' }}>
        <GlobalHeader />
        <main style={{ flex: 1 }}>
          <Outlet />
        </main>
      </div>
    </div>
  );
};
