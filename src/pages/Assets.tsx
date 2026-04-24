import { Search, Plus, Filter, MoreVertical, Laptop, Smartphone, Monitor } from 'lucide-react';

const assets = [
  { id: 'MBP-2023-001', name: 'MacBook Pro 16"', user: 'Rahul S.', type: 'Laptop', warranty: 'Dec 2024', status: 'In Use', icon: Laptop },
  { id: 'IPH-14-992', name: 'iPhone 14 Pro', user: 'Rahul S.', type: 'Mobile', warranty: 'Aug 2024', status: 'In Use', icon: Smartphone },
  { id: 'MON-27-042', name: 'Dell UltraSharp 27"', user: 'Rahul S.', type: 'Monitor', warranty: 'May 2025', status: 'In Use', icon: Monitor },
  { id: 'MBP-2022-088', name: 'MacBook Air M2', user: 'Available', type: 'Laptop', warranty: 'Expired', status: 'Maintenance', icon: Laptop },
];

export const Assets = () => {
  return (
    <div className="space-y-8 animate-fade-in">
      <header className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold">Asset Inventory</h2>
          <p className="text-text-secondary mt-1">Track company hardware, software licenses, and assignments.</p>
        </div>
        <button className="btn btn-primary px-6">
          <Plus size={18} />
          Add Asset
        </button>
      </header>

      <div className="glass-card overflow-hidden">
        <div className="p-6 border-b border-white/5 flex flex-wrap gap-4 items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 bg-bg-tertiary px-3 py-2 rounded-xl border border-white/5 w-80">
              <Search size={16} className="text-text-muted" />
              <input type="text" placeholder="Search by ID, name or user..." className="bg-transparent border-none outline-none text-sm w-full" />
            </div>
            <button className="btn btn-secondary py-2 text-xs uppercase tracking-widest font-bold">
              <Filter size={14} />
              Filters
            </button>
          </div>
          
          <div className="flex items-center gap-2">
            <span className="text-xs text-text-muted uppercase tracking-widest font-bold">Sort by:</span>
            <select className="bg-transparent border-none text-xs font-bold text-text-primary outline-none cursor-pointer">
              <option>Recently Added</option>
              <option>Warranty Expiry</option>
              <option>Status</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-bg-tertiary/30">
                <th className="px-6 py-4 text-[10px] font-bold text-text-muted uppercase tracking-widest">Device Details</th>
                <th className="px-6 py-4 text-[10px] font-bold text-text-muted uppercase tracking-widest">Assigned User</th>
                <th className="px-6 py-4 text-[10px] font-bold text-text-muted uppercase tracking-widest">Warranty</th>
                <th className="px-6 py-4 text-[10px] font-bold text-text-muted uppercase tracking-widest">Status</th>
                <th className="px-6 py-4 text-[10px] font-bold text-text-muted uppercase tracking-widest"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {assets.map((asset) => (
                <tr key={asset.id} className="hover:bg-white/[0.02] transition-colors group">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-4">
                      <div className="p-3 bg-bg-tertiary rounded-xl border border-white/5 text-indigo-400">
                        <asset.icon size={20} />
                      </div>
                      <div>
                        <p className="text-sm font-semibold">{asset.name}</p>
                        <p className="text-[10px] font-mono text-text-muted uppercase tracking-wider">{asset.id}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-indigo-500/10 flex items-center justify-center text-[10px] font-bold text-indigo-400">
                        {asset.user[0]}
                      </div>
                      <span className="text-sm font-medium">{asset.user}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-medium ${asset.warranty === 'Expired' ? 'text-red-400' : 'text-text-primary'}`}>
                        {asset.warranty}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`
                      px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider
                      ${asset.status === 'In Use' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'}
                    `}>
                      {asset.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button className="p-2 hover:bg-white/5 rounded-lg text-text-muted transition-colors">
                      <MoreVertical size={18} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
