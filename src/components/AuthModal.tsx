import React, { useState } from 'react';
import { Bot, Mail, Lock, Store, User, ArrowRight, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { AuthService } from '../services/firebaseService';

interface AuthModalProps {
  onSuccess: () => void;
  defaultMode?: 'login' | 'register';
}

export const AuthModal: React.FC<AuthModalProps> = ({ onSuccess, defaultMode = 'login' }) => {
  const [isLogin, setIsLogin] = useState(defaultMode === 'login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (isLogin) {
        await AuthService.loginUser(email, password);
      } else {
        if (!businessName.trim()) {
          setError('Iltimos, do\'kon yoki biznesingiz nomini kiriting.');
          setLoading(false);
          return;
        }
        await AuthService.registerUser(email, password, businessName, ownerName);
      }
      onSuccess();
    } catch (err: any) {
      console.error('Firebase Auth error:', err);
      let msg = err.message || 'Xatolik yuz berdi. Iltimos qaytadan urinib ko\'ring.';
      if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        msg = 'Email yoki parol noto\'g\'ri kiritildi.';
      } else if (err.code === 'auth/email-already-in-use') {
        msg = 'Bu email manzili allaqachon ro\'yxatdan o\'tgan. Iltimos, tizimga kiring.';
      } else if (err.code === 'auth/weak-password') {
        msg = 'Parol kamida 6 ta belgidan iborat bo\'lishi kerak.';
      } else if (err.code === 'auth/invalid-email') {
        msg = 'Noto\'g\'ri email formati kiritildi.';
      }
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-white rounded-3xl p-6 sm:p-8 shadow-2xl border border-slate-100 text-slate-900">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-sky-500 to-indigo-600 text-white flex items-center justify-center mx-auto mb-3 shadow-md shadow-sky-500/20">
            <Bot className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-bold text-slate-900">
            {isLogin ? 'Tizimga Kirish' : 'Biznes Uchun Ro\'yxatdan O\'tish'}
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            {isLogin
              ? 'AI SavdoBot do\'kon boshqaruv paneliga kiring'
              : 'O\'z do\'koningiz va omboringizni bepul oching'}
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
          {!isLogin && (
            <>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Do'kon yoki Biznes nomi *
                </label>
                <div className="relative">
                  <Store className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    required
                    placeholder="Masalan: Telefon Market"
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500 text-xs font-medium"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Ismingiz (Do'kon egasi)
                </label>
                <div className="relative">
                  <User className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Masalan: Akmal"
                    value={ownerName}
                    onChange={(e) => setOwnerName(e.target.value)}
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500 text-xs font-medium"
                  />
                </div>
              </div>
            </>
          )}

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Email manzil *</label>
            <div className="relative">
              <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="email"
                required
                placeholder="user@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500 text-xs font-medium"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Parol *</label>
            <div className="relative">
              <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="password"
                required
                minLength={6}
                placeholder="Kamida 6 ta belgi"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500 text-xs font-medium"
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
                Bajarilmoqda...
              </>
            ) : isLogin ? (
              <>
                Kirish <ArrowRight className="w-4 h-4" />
              </>
            ) : (
              <>
                Hisob Ochish va Boshlash <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {/* Toggle Mode */}
        <div className="mt-5 text-center text-xs text-slate-500 pt-4 border-t border-slate-100">
          {isLogin ? (
            <p>
              Hisobingiz yo'qmi?{' '}
              <button
                onClick={() => {
                  setIsLogin(false);
                  setError(null);
                }}
                className="font-bold text-sky-600 hover:underline"
              >
                Yangi biznes ro'yxatdan o'tkazish
              </button>
            </p>
          ) : (
            <p>
              Allaqachon hisobingiz bormi?{' '}
              <button
                onClick={() => {
                  setIsLogin(true);
                  setError(null);
                }}
                className="font-bold text-sky-600 hover:underline"
              >
                Tizimga kirish
              </button>
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
