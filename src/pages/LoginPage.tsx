import React, { useState } from 'react';
import { Bot, Mail, Lock, ArrowRight, AlertCircle, Loader2 } from 'lucide-react';
import { AuthService } from '../services/firebaseService';

interface LoginPageProps {
  onSuccess: () => void;
  onNavigateRegister: () => void;
  onNavigateHome: () => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({
  onSuccess,
  onNavigateRegister,
  onNavigateHome
}) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await AuthService.loginUser(email, password);
      onSuccess();
    } catch (err: any) {
      console.warn('Login notice:', err.code || err.message);
      let msg = err.message || 'Xatolik yuz berdi. Iltimos qaytadan urinib ko\'ring.';
      if (err.code === 'auth/operation-not-allowed' || (err.message && err.message.includes('auth/operation-not-allowed'))) {
        msg = 'Firebase Authentication xizmatida "Email/Password" usuli hali yoqilmagan. Iltimos, Firebase Console (https://console.firebase.google.com) -> Authentication -> Sign-in method bo\'limiga o\'tib, "Email/Password" provayderini "Enable" qilib saqlang.';
      } else if (
        err.code === 'auth/user-not-found' ||
        err.code === 'auth/wrong-password' ||
        err.code === 'auth/invalid-credential'
      ) {
        msg = 'Email yoki parol noto\'g\'ri kiritildi.';
      } else if (err.code === 'auth/invalid-email') {
        msg = 'Noto\'g\'ri email formati kiritildi.';
      }
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center p-4">
      {/* Brand logo */}
      <button
        onClick={onNavigateHome}
        className="flex items-center gap-2.5 mb-8 hover:opacity-85 transition-opacity"
      >
        <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-sky-500 to-indigo-600 text-white flex items-center justify-center font-bold shadow-md shadow-sky-500/20">
          <Bot className="w-6 h-6" />
        </div>
        <span className="text-xl font-bold text-slate-900 tracking-tight">AI SavdoBot</span>
      </button>

      {/* Login Card */}
      <div className="w-full max-w-md bg-white rounded-3xl p-7 sm:p-9 shadow-xl border border-slate-200/80 text-slate-900">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-slate-900">Tizimga Kirish</h1>
          <p className="text-xs text-slate-500 mt-1.5">
            Do'koningiz va CRM boshqaruv paneliga kiring
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Email manzil *</label>
            <div className="relative">
              <Mail className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="email"
                required
                placeholder="savdogar@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500 text-xs font-medium"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Parol *</label>
            <div className="relative">
              <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="password"
                required
                placeholder="Parolingizni kiriting"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500 text-xs font-medium"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 py-3 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Tekshirilmoqda...
              </>
            ) : (
              <>
                Kirish <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        <div className="mt-6 text-center text-xs text-slate-500 pt-4 border-t border-slate-100">
          <p>
            Do'koningiz hali yo'qmi?{' '}
            <button
              onClick={onNavigateRegister}
              className="font-bold text-sky-600 hover:underline"
            >
              Yangi biznes ro'yxatdan o'tkazish
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};
