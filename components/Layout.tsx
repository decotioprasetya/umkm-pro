
import React, { useState } from 'react';
import { useApp } from '../store';
import { 
  LayoutDashboard, Package, Factory, ShoppingCart, 
  Menu, X, Wallet, FileSpreadsheet, Settings as SettingsIcon, RefreshCw, Cloud, LogOut, User, LogIn, CheckCircle2
} from 'lucide-react';

interface LayoutProps {
  children: React.ReactNode;
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

const Layout: React.FC<LayoutProps> = ({ children, activeTab, setActiveTab }) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const { state, logout } = useApp();

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'finance', label: 'Keuangan', icon: Wallet },
    { id: 'sales', label: 'Penjualan', icon: ShoppingCart },
    { id: 'inventory', label: 'Stok', icon: Package },
    { id: 'production', label: 'Produksi', icon: Factory },
    { id: 'reports', label: 'Laporan', icon: FileSpreadsheet },
    { id: 'settings', label: 'Pengaturan', icon: SettingsIcon },
  ];

  const userAvatar = state.user?.user_metadata?.avatar_url;
  const userName = state.user ? (state.user?.user_metadata?.full_name || state.user?.email?.split('@')[0]) : 'Guest User';

  const formatLastSync = (ts?: number) => {
    if (!ts) return '';
    return new Date(ts).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  return (
    <div className="min-h-screen flex bg-slate-50 dark:bg-slate-950 transition-colors">
      {/* Mobile Sidebar Overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed inset-y-0 left-0 w-64 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white transform transition-transform duration-300 ease-in-out z-50
        lg:translate-x-0 lg:static lg:inset-0
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="p-6 flex flex-col">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-black flex items-center gap-2 text-slate-900 dark:text-white uppercase tracking-tighter">
              <span className="truncate max-w-[190px]">{state.settings.businessName}</span>
            </h1>
            <button className="lg:hidden p-1 text-slate-400" onClick={() => setIsSidebarOpen(false)}>
              <X size={20} />
            </button>
          </div>
          <p className="text-slate-500 dark:text-slate-400 text-[10px] mt-1 font-black uppercase tracking-widest">Smart Inventory</p>
        </div>

        <nav className="mt-6 px-4 space-y-1.5">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  setActiveTab(item.id);
                  setIsSidebarOpen(false);
                }}
                className={`
                  w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200
                  ${isActive 
                    ? 'bg-blue-600 dark:bg-blue-500 text-white font-black shadow-lg shadow-blue-500/20' 
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-blue-600 font-bold'}
                `}
              >
                <Icon size={20} strokeWidth={isActive ? 3 : 2} />
                <span className="text-[11px] uppercase tracking-wider">{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="absolute bottom-0 left-0 w-full p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
          <div className="flex items-center gap-3 p-2 group relative">
            {state.user ? (
              <>
                {userAvatar ? (
                  <img src={userAvatar} className="h-9 w-9 rounded-full border-2 border-slate-200 dark:border-slate-700" alt="Avatar" />
                ) : (
                  <div className="h-9 w-9 bg-slate-900 dark:bg-white rounded-full flex items-center justify-center text-white dark:text-slate-900 text-sm font-black uppercase">
                    {userName?.charAt(0)}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-black text-slate-900 dark:text-white truncate uppercase">{userName}</p>
                  <p className="text-[8px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-widest truncate">{state.user?.email}</p>
                </div>
                <button 
                  onClick={logout}
                  className="p-2 hover:bg-rose-50 dark:hover:bg-rose-500/10 text-slate-400 hover:text-rose-500 rounded-lg transition-colors"
                  title="Logout"
                >
                  <LogOut size={16} />
                </button>
              </>
            ) : (
              <>
                <div className="h-9 w-9 bg-slate-200 dark:bg-slate-800 rounded-full flex items-center justify-center text-slate-400">
                  <User size={18} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-black text-slate-900 dark:text-white truncate uppercase">Guest Mode</p>
                  <p className="text-[8px] text-slate-400 font-bold uppercase tracking-widest truncate">Data Tersimpan Lokal</p>
                </div>
                <button 
                  onClick={() => setActiveTab('login')}
                  className="p-2 hover:bg-blue-50 dark:hover:bg-blue-500/10 text-slate-400 hover:text-blue-600 rounded-lg transition-colors"
                  title="Login ke Cloud"
                >
                  <LogIn size={16} />
                </button>
              </>
            )}
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="h-16 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-6 sticky top-0 z-30 transition-colors">
          <div className="flex items-center gap-4">
            <button className="lg:hidden p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors text-slate-600 dark:text-slate-400" onClick={() => setIsSidebarOpen(true)}>
              <Menu size={24} />
            </button>
            <div className="hidden lg:block text-slate-800 dark:text-white font-black text-sm uppercase tracking-widest">
              {menuItems.find(i => i.id === activeTab)?.label || 'Aplikasi'}
            </div>
          </div>

          <div className="flex items-center gap-6">
            {state.isSyncing ? (
              <div className="flex items-center gap-2 text-blue-500 animate-pulse">
                <RefreshCw size={14} className="animate-spin" />
                <span className="text-[9px] font-black uppercase tracking-widest">Auto-Syncing...</span>
              </div>
            ) : state.settings.useCloud && state.user && state.lastSyncTime ? (
              <div className="flex items-center gap-2 text-emerald-500 group relative">
                <CheckCircle2 size={14} />
                <div className="flex flex-col">
                  <span className="text-[9px] font-black uppercase tracking-widest leading-none">Cloud Synced</span>
                  <span className="text-[7px] font-bold text-slate-400 uppercase tracking-tighter mt-0.5">@ {formatLastSync(state.lastSyncTime)}</span>
                </div>
                <div className="absolute top-full right-0 mt-2 hidden group-hover:block bg-slate-900 text-white p-3 rounded-xl shadow-2xl z-50 min-w-[200px] border border-slate-700">
                  <p className="text-[8px] font-black uppercase tracking-widest">Sinkronisasi Otomatis Aktif</p>
                  <p className="text-[7px] font-bold text-slate-400 uppercase mt-1 leading-relaxed">Sistem mendeteksi aktivitas Anda dan menyimpan perubahan ke cloud secara otomatis dalam 2 detik.</p>
                </div>
              </div>
            ) : state.settings.useCloud && state.user && (
               <div className="flex items-center gap-2 text-blue-400">
                <Cloud size={14} className="animate-pulse" />
                <span className="text-[9px] font-black uppercase tracking-widest">Ready to Sync</span>
              </div>
            )}
            
            <div className="flex flex-col items-end">
              <p className="text-[10px] text-slate-400 dark:text-slate-500 font-black uppercase tracking-wider leading-none">{state.settings.businessName}</p>
              <div className="flex items-center gap-1.5 mt-1">
                <span className={`w-1.5 h-1.5 rounded-full animate-pulse ${state.user ? 'bg-emerald-500' : 'bg-slate-300'}`}></span>
                <p className="text-[9px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-widest">
                  {state.user ? 'Cloud Live' : 'Local Only'}
                </p>
              </div>
            </div>
          </div>
        </header>

        <div className="p-6 lg:p-8 overflow-y-auto flex-1 dark:text-white no-scrollbar">
          {children}
        </div>
      </main>
    </div>
  );
};

export default Layout;
