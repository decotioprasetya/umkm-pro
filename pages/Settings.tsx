import React, { useState } from 'react';
import { useApp } from '../store';
import { Store, Sun, Moon, Info, Cloud, CloudOff, RefreshCw, LogIn } from 'lucide-react';

interface SettingsProps {
  onLoginClick?: () => void;
}

const Settings: React.FC<SettingsProps> = ({ onLoginClick }) => {
  const { state, updateSettings, syncLocalToCloud } = useApp();
  const [name, setName] = useState(state.settings.businessName);
  const [success, setSuccess] = useState(false);

  const handleSaveIdentitas = (e: React.FormEvent) => {
    e.preventDefault();
    updateSettings({ businessName: name });
    setSuccess(true);
    setTimeout(() => setSuccess(false), 3000);
  };

  const toggleCloud = () => {
    updateSettings({ useCloud: !state.settings.useCloud });
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight uppercase">Pengaturan Sistem</h2>
          <p className="text-slate-500 dark:text-slate-400 text-[10px] font-bold uppercase tracking-wider">Kelola identitas, tampilan, dan sinkronisasi data</p>
        </div>
        <div className={`flex items-center gap-2 px-4 py-2 rounded-full border ${state.user ? 'bg-emerald-50 border-emerald-100 text-emerald-600' : 'bg-slate-100 border-slate-200 text-slate-400'}`}>
          {state.user ? <Cloud size={16} /> : <CloudOff size={16} />}
          <span className="text-[9px] font-black uppercase tracking-widest">{state.user ? 'Akun Terhubung' : 'Offline'}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Cloud Sync Status */}
        <div className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-sm space-y-6">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-xl">
              <Cloud size={20} />
            </div>
            <h3 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-widest">Sinkronisasi Cloud</h3>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl">
              <div className="flex flex-col">
                <span className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase leading-none">Status Cloud</span>
                <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                  {state.settings.useCloud ? 'Aktif' : 'Nonaktif'}
                </span>
              </div>
              <button 
                onClick={toggleCloud}
                className={`w-12 h-6 rounded-full transition-colors relative ${state.settings.useCloud ? 'bg-blue-600' : 'bg-slate-300 dark:bg-slate-700'}`}
              >
                <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${state.settings.useCloud ? 'left-7' : 'left-1'}`} />
              </button>
            </div>

            {state.user && state.settings.useCloud && (
              <button 
                // Fix: Wrap syncLocalToCloud in an arrow function to prevent the MouseEvent from being passed as the 'silent' boolean parameter.
                onClick={() => syncLocalToCloud(false)}
                disabled={state.isSyncing}
                className="w-full py-4 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-2xl flex flex-col items-center justify-center gap-2 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all group"
              >
                <RefreshCw size={24} className={`text-slate-400 group-hover:text-blue-500 ${state.isSyncing ? 'animate-spin' : ''}`} />
                <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Sinkronkan Data Sekarang</span>
              </button>
            )}

            {!state.user && (
              <div className="p-6 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800 space-y-4">
                <p className="text-[9px] text-slate-500 dark:text-slate-400 font-bold uppercase leading-relaxed tracking-wider text-center">
                  Anda belum masuk. Hubungkan akun untuk mencadangkan data ke cloud secara otomatis.
                </p>
                <button 
                  onClick={onLoginClick}
                  className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-xl text-[9px] uppercase tracking-widest flex items-center justify-center gap-2 transition-all shadow-lg shadow-blue-500/20 active:scale-95"
                >
                  <LogIn size={14} strokeWidth={3} />
                  Masuk / Daftar Akun
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Identitas & Tampilan */}
        <div className="space-y-8">
          <div className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-sm space-y-6">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-xl">
                <Store size={20} />
              </div>
              <h3 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-widest">Identitas Usaha</h3>
            </div>
            <form onSubmit={handleSaveIdentitas} className="space-y-4">
              <input 
                required
                type="text" 
                className="w-full px-5 py-3 bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-800 rounded-2xl uppercase text-black dark:text-white font-black text-xs"
                value={name}
                onChange={(e) => setName(e.target.value.toUpperCase())}
              />
              <button type="submit" className="w-full py-3 bg-slate-900 dark:bg-blue-600 text-white font-black rounded-xl text-[9px] uppercase tracking-widest transition-all hover:bg-black dark:hover:bg-blue-500 active:scale-95">
                Update Nama Usaha
              </button>
            </form>
          </div>

          <div className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-sm space-y-6">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400 rounded-xl">
                {state.settings.theme === 'light' ? <Sun size={20} /> : <Moon size={20} />}
              </div>
              <h3 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-widest">Tampilan</h3>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <button onClick={() => updateSettings({ theme: 'light' })} className={`py-4 rounded-xl border-2 font-black text-[9px] uppercase transition-all ${state.settings.theme === 'light' ? 'border-blue-600 bg-blue-50 text-blue-700 shadow-md' : 'border-slate-100 dark:border-slate-800 text-slate-400'}`}>Light</button>
              <button onClick={() => updateSettings({ theme: 'dark' })} className={`py-4 rounded-xl border-2 font-black text-[9px] uppercase transition-all ${state.settings.theme === 'dark' ? 'border-blue-600 bg-slate-800 text-blue-400 shadow-md' : 'border-slate-100 dark:border-slate-800 text-slate-400'}`}>Dark</button>
            </div>
          </div>
        </div>
      </div>

      <div className="p-6 bg-amber-50 dark:bg-amber-900/10 rounded-3xl border border-amber-100 dark:border-amber-900/20 flex gap-4">
        <Info size={24} className="text-amber-600 shrink-0" />
        <div className="space-y-1">
          <p className="text-[10px] font-black text-amber-900 dark:text-amber-200 uppercase">Informasi Akun & Cloud</p>
          <p className="text-[9px] text-amber-800 dark:text-amber-300 font-bold uppercase leading-relaxed opacity-80">
            Data lokal tersimpan aman di browser Anda. Fitur Cloud memungkinkan sinkronisasi antar perangkat dan cadangan data permanen di server Supabase.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Settings;
