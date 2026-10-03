import React, { useState } from 'react';
import { Bot, Store, Warehouse, Package, Send, CheckCircle2, ArrowRight } from 'lucide-react';
import { Warehouse as WarehouseType, Product } from '../types';

interface OnboardingModalProps {
  onComplete: (data: { businessName: string; warehouseName: string }) => Promise<void>;
  onClose: () => void;
}

export const OnboardingModal: React.FC<OnboardingModalProps> = ({ onComplete, onClose }) => {
  const [step, setStep] = useState(1);
  const [bizName, setBizName] = useState('Telefon Market & Gadgets');
  const [whName, setWhName] = useState('Asosiy ombor (Toshkent)');

  const handleFinish = async () => {
    await onComplete({ businessName: bizName, warehouseName: whName });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="w-full max-w-md bg-white rounded-3xl p-6 sm:p-8 shadow-2xl border border-slate-100 text-slate-900">
        {/* Step Indicator */}
        <div className="flex items-center justify-between mb-6 pb-3 border-b border-slate-100">
          <span className="text-xs font-bold text-sky-600 uppercase tracking-wider">
            Qadam {step} / 3
          </span>
          <div className="flex gap-1.5">
            {[1, 2, 3].map((s) => (
              <span
                key={s}
                className={`w-6 h-1.5 rounded-full transition-all ${
                  s === step ? 'bg-sky-500' : s < step ? 'bg-emerald-500' : 'bg-slate-200'
                }`}
              />
            ))}
          </div>
        </div>

        {/* Step 1: Business Name */}
        {step === 1 && (
          <div className="space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-sky-100 text-sky-600 flex items-center justify-center">
              <Store className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900">Biznesingiz nomi nima?</h3>
              <p className="text-xs text-slate-500 mt-1">
                Telegram bot va hisobotlarda ko'rinadigan do'kon brendini kiriting.
              </p>
            </div>
            <input
              type="text"
              value={bizName}
              onChange={(e) => setBizName(e.target.value)}
              placeholder="Masalan: Telefon Market"
              className="w-full p-3 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500 font-medium"
            />
            <button
              onClick={() => setStep(2)}
              disabled={!bizName.trim()}
              className="w-full py-3 bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center justify-center gap-2"
            >
              Keyingisi <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Step 2: Warehouse Name */}
        {step === 2 && (
          <div className="space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-indigo-100 text-indigo-600 flex items-center justify-center">
              <Warehouse className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900">Boshlang'ich omborni nomlang</h3>
              <p className="text-xs text-slate-500 mt-1">
                Tovarlar qoldig'i hisobini yuritish uchun asosiy filialingiz yoki omboringiz nomi.
              </p>
            </div>
            <input
              type="text"
              value={whName}
              onChange={(e) => setWhName(e.target.value)}
              placeholder="Masalan: Asosiy ombor (Toshkent)"
              className="w-full p-3 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500 font-medium"
            />
            <div className="flex gap-2">
              <button
                onClick={() => setStep(1)}
                className="w-1/3 py-3 border border-slate-200 text-slate-600 font-semibold text-xs rounded-xl hover:bg-slate-50"
              >
                Orqaga
              </button>
              <button
                onClick={() => setStep(3)}
                disabled={!whName.trim()}
                className="w-2/3 py-3 bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center justify-center gap-2"
              >
                Keyingisi <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Telegram Bot Ready Test */}
        {step === 3 && (
          <div className="space-y-4 text-center">
            <div className="w-14 h-14 mx-auto rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900">AI SavdoBot Tayyor! 🚀</h3>
              <p className="text-xs text-slate-500 mt-1">
                Biznes va ombor sozlandi. Test savoli orqali AI javobini tekshirib ko'ring:
              </p>
            </div>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl text-left text-xs space-y-2">
              <div className="text-slate-500 font-semibold">Mijoz: "Redmi Note 14 Pro bormi?"</div>
              <div className="p-2.5 bg-sky-50 text-sky-900 rounded-xl font-medium border border-sky-100">
                AI SavdoBot: "Ha, mavjud. Narxi 3 200 000 so'm. Hozir 5 dona bor."
              </div>
            </div>

            <button
              onClick={handleFinish}
              className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-xs transition-all"
            >
              Boshqaruv Paneliga O'tish
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
