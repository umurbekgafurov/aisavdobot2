import React, { useState } from 'react';
import { Bot, Mail, Lock, Store, User, ArrowRight, AlertCircle, Loader2 } from 'lucide-react';
import { AuthService } from '../services/firebaseService';
import { firebaseConfig } from '../lib/firebase';

interface RegisterPageProps {
  onSuccess: () => void;
  onNavigateLogin: () => void;
  onNavigateHome: () => void;
}

export const RegisterPage: React.FC<RegisterPageProps> = ({
  onSuccess,
  onNavigateLogin,
  onNavigateHome
}) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [failedStep, setFailedStep] = useState<'auth' | 'firestore' | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setErrorCode(null);
    setFailedStep(null);

    if (!businessName.trim()) {
      setError('Iltimos, do\'kon yoki biznesingiz nomini kiriting.');
      return;
    }

    setLoading(true);

    try {
      // Calls AuthService.registerUser which saves userId, businessId, businessName, createdAt in Firestore
      await AuthService.registerUser(email, password, businessName.trim(), ownerName.trim());
      onSuccess();
    } catch (err: any) {
      const code = err.code || 'unknown-error';
      const step = err.step || (code.startsWith('firestore') ? 'firestore' : 'auth');
      console.warn(`[Registration Error in Simulator] Step: ${step}, Code: ${code}, Message: ${err.message}`);
      
      setErrorCode(code);
      setFailedStep(step);

      let msg = err.message || 'Xatolik yuz berdi. Iltimos qaytadan urinib ko\'ring.';
      if (code === 'auth/operation-not-allowed') {
        msg = `Firebase Authentication xizmatida "Email/Password" usuli o'chirilgan (PASSWORD_LOGIN_DISABLED). Loyiha ID: ${firebaseConfig.projectId}. Iltimos, Firebase Console (https://console.firebase.google.com/project/${firebaseConfig.projectId}/authentication/providers) sahifasida "Email/Password" provayderini "Enable" qilib saqlang.`;
      } else if (code === 'auth/email-already-in-use') {
        msg = 'Bu email manzili allaqachon ro\'yxatdan o\'tgan. Iltimos, tizimga kiring.';
      } else if (code === 'auth/weak-password') {
        msg = 'Parol kamida 6 ta belgidan iborat bo\'lishi kerak.';
      } else if (code === 'auth/invalid-email') {
        msg = 'Noto\'g\'ri email formati kiritildi.';
      } else if (code === 'auth/network-request-failed') {
        msg = 'Tarmoq ulanishida xatolik yuz berdi. Iltimos internetingizni tekshiring.';
      } else if (code === 'auth/invalid-api-key') {
        msg = 'Firebase API kaliti yaroqsiz.';
      } else if (step === 'firestore') {
        msg = `Firebase Auth hisobi muvaffaqiyatli yaratildi, lekin Firestore profilini yozishda xatolik yuz berdi (${code}).`;
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

      {/* Register Card */}
      <div className="w-full max-w-md bg-white rounded-3xl p-7 sm:p-9 shadow-xl border border-slate-200/80 text-slate-900">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-slate-900">Do'kon Ochish</h1>
          <p className="text-xs text-slate-500 mt-1.5">
            O'z biznesingizni ro'yxatdan o'tkazing va Firestore bazasini ulaymiz
          </p>
        </div>

        {error && (
          <div className="mb-5 p-4 bg-rose-50 border border-rose-200 rounded-2xl text-rose-900 text-xs flex flex-col gap-2">
            <div className="flex items-center gap-2 font-bold text-rose-700">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>Firebase Xatolik Kodi: <code className="bg-rose-100 px-1.5 py-0.5 rounded font-mono text-rose-800">{errorCode || 'unknown'}</code></span>
            </div>
            <div className="text-[11px] text-slate-700 bg-white/70 p-2.5 rounded-xl border border-rose-100 space-y-1">
              <p><strong>Operatsiya:</strong> {failedStep === 'firestore' ? 'B) Firestore (users/businesses profil yozish)' : 'A) Firebase Authentication (createUserWithEmailAndPassword)'}</p>
              <p><strong>Loyiha ID:</strong> <code className="font-mono font-semibold">{firebaseConfig.projectId}</code></p>
              <p><strong>Tafsilot:</strong> {error}</p>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Do'kon yoki Biznes nomi *
            </label>
            <div className="relative">
              <Store className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                required
                placeholder="Masalan: Telefon Market"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500 text-xs font-medium"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Ismingiz (Do'kon rahbari)
            </label>
            <div className="relative">
              <User className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Masalan: Akmal"
                value={ownerName}
                onChange={(e) => setOwnerName(e.target.value)}
                className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500 text-xs font-medium"
              />
            </div>
          </div>

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
                minLength={6}
                placeholder="Kamida 6 ta belgi"
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
                Biznes yaratilmoqda...
              </>
            ) : (
              <>
                Do'konni Ochish <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        <div className="mt-6 text-center text-xs text-slate-500 pt-4 border-t border-slate-100">
          <p>
            Allaqachon do'koningiz bormi?{' '}
            <button
              onClick={onNavigateLogin}
              className="font-bold text-sky-600 hover:underline"
            >
              Tizimga kirish
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};
