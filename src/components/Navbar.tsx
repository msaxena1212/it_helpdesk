import { Bell, Search, User } from 'lucide-react';

export const Navbar = () => {
  return (
    <header className="h-16 border-b border-[rgba(255,255,255,0.05)] bg-[#0a0b10]/80 backdrop-blur-md flex items-center justify-between px-8 sticky top-0 z-10">
      <div className="flex items-center gap-4 bg-bg-tertiary px-4 py-2 rounded-full border border-border-color w-96">
        <Search size={18} className="text-text-muted" />
        <input 
          type="text" 
          placeholder="Search tickets, assets..." 
          className="bg-transparent border-none outline-none text-sm w-full text-text-primary"
        />
      </div>

      <div className="flex items-center gap-6">
        <button className="relative text-text-secondary hover:text-text-primary transition-colors">
          <Bell size={20} />
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-accent-primary text-[10px] text-white flex items-center justify-center rounded-full border-2 border-bg-primary">
            3
          </span>
        </button>

        <div className="flex items-center gap-3 pl-6 border-l border-[rgba(255,255,255,0.05)]">
          <div className="text-right hidden sm:block">
            <p className="text-sm font-semibold text-text-primary">Kunal Baghel</p>
            <p className="text-[10px] text-text-muted uppercase tracking-wider">IT Administrator</p>
          </div>
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 p-[2px]">
            <div className="w-full h-full rounded-full bg-bg-secondary flex items-center justify-center overflow-hidden">
              <User size={24} className="text-text-secondary" />
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
