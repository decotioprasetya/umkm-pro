
import React, { useState, useEffect } from 'react';
import { useApp } from '../store';
import { LogIn, UserPlus, Lock, Mail, Eye, EyeOff, AlertCircle, ArrowLeft } from 'lucide-react';

interface LoginProps {
  onBack?: () => void;
}

const Login: React.FC<LoginProps> = ({ onBack }) => {
  const { state, signIn, signUp } = useApp();
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Jika user berhasil login, otomatis kembali
  useEffect(() => {
    if (state.user && onBack) {
      onBack();
    }
  }, [state.user, onBack]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMessage(null);

    try {
      let resultError: string | null = null;
      if (isRegister) {
        resultError = await signUp(email, password);
        if (!resultError) {
          alert("Pendaftaran Berhasil! Silahkan login dengan akun baru Anda.");
          setIsRegister(false);
        }
      } else {
        resultError = await signIn(email, password);
      }

      if (resultError) {
        setErrorMessage(resultError);
      }
    } catch (err) {
      setErrorMessage("Terjadi kesalahan sistem. Coba lagi nanti.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-6 font-sans transition-colors duration-500">
      {/* Back Button */}
      {onBack && (
        <button 
          onClick={onBack}
          className="fixed top-8 left-8 flex items-center gap-2 text-[10px] font-black text-slate-400 hover:text-blue-600 uppercase tracking-widest transition-all group"
        >
          <div className="p-2 bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-100 dark:border-slate-800 group-hover:border-blue-500/30">
            <ArrowLeft size={16} />
          </div>
          <span>Kembali ke Aplikasi</span>
        </button>
      )}

      <div className="w-full max-w-md space-y-8">
        <div className="text-center space-y-4">
          <div className="w-20 h-20 bg-blue-600 rounded-[2rem] flex items-center justify-center text-white mx-auto shadow-2xl shadow-blue-500/20 animate-in zoom-in duration-700">
            {isRegister ? <UserPlus size={40} strokeWidth={2.5} /> : <LogIn size={40} strokeWidth={2.5} />}
          </div>
          <div className="animate-in fade-in slide-in-from-top-4 duration-700">
            <h1 className="text-3xl font-black text-slate-900 dark:text-white uppercase tracking-tighter">{state.settings.businessName}</h1>
            <p className="text-slate-500 dark:text-slate-400 text-[10px] font-black uppercase tracking-[0.3em] mt-2">Smart Inventory System</p>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-xl shadow-slate-200/50 dark:shadow-none space-y-6 animate-in slide-in-from-bottom-8 duration-700">
          <div className="space-y-2 text-center">
            <h2 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-tight">
              {isRegister ? 'Buat Akun Baru' : 'Masuk Ke Sistem'}
            </h2>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
              {isRegister ? 'Lengkapi data untuk mulai sinkronisasi cloud' : 'Masukkan kredensial Anda untuk akses data'}
            </p>
          </div>

          {errorMessage && (
            <div className="bg-rose-50 dark:bg-rose-500/10 border border-rose-100 dark:border-rose-500/20 p-4 rounded-2xl flex items-start gap-3 animate-bounce-short">
              <AlertCircle className="text-rose-500 shrink-0 mt-0.5" size={18} />
              <p className="text-[10px] font-black text-rose-600 dark:text-rose-400 uppercase leading-relaxed">
                {errorMessage}
              </p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Email Bisnis</label>
              <div className="relative group">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors" size={18} />
                <input 
                  required
                  type="email" 
                  placeholder="admin@bisnis.com"
                  className="w-full pl-12 pr-4 py-4 bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-800 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white dark:focus:bg-slate-700 text-xs font-black text-slate-900 dark:text-white transition-all"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Kata Sandi</label>
              <div className="relative group">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors" size={18} />
                <input 
                  required
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  className="w-full pl-12 pr-12 py-4 bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-800 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white dark:focus:bg-slate-700 text-xs font-black text-slate-900 dark:text-white transition-all"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button 
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <button 
              disabled={loading}
              type="submit"
              className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-2xl shadow-lg shadow-blue-500/20 transition-all active:scale-95 uppercase text-[10px] tracking-[0.2em] flex items-center justify-center gap-2"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  {isRegister ? <UserPlus size={18} /> : <LogIn size={18} />}
                  <span>{isRegister ? 'Daftar Sekarang' : 'Masuk Sistem'}</span>
                </>
              )}
            </button>
          </form>

          <div className="pt-4 flex flex-col items-center gap-4">
             <button 
               onClick={() => {
                 setIsRegister(!isRegister);
                 setErrorMessage(null);
               }}
               className="text-[10px] font-black text-blue-600 hover:text-blue-700 uppercase tracking-widest transition-colors"
             >
               {isRegister ? 'Sudah punya akun? Masuk di sini' : 'Belum punya akun? Daftar gratis'}
             </button>
             <div className="flex items-center gap-3 w-full opacity-40">
                <span className="flex-1 h-[1px] bg-slate-300 dark:bg-slate-700"></span>
                <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest tracking-[0.2em]">Secure Access</span>
                <span className="flex-1 h-[1px] bg-slate-300 dark:bg-slate-700"></span>
             </div>
          </div>
          
          {!onBack && (
            <p className="text-[9px] text-slate-400 dark:text-slate-500 font-bold uppercase leading-relaxed text-center px-4">
              Akses cloud memerlukan koneksi internet stabil dan konfigurasi Supabase yang valid di file sistem.
            </p>
          )}
        </div>

        <div className="text-center">
          <p className="text-[9px] text-slate-400 font-black uppercase tracking-[0.3em] opacity-40">
             BUILD 2025.05 • ENTERPRISE VERSION
          </p>
        </div>
      </div>
      
      <style>{`
        @keyframes bounce-short {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-4px); }
        }
        .animate-bounce-short {
          animation: bounce-short 0.3s ease-in-out 2;
        }
      `}</style>
    </div>
  );
};

export default Login;
