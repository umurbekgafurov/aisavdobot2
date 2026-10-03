import React, { useState } from 'react';
import {
  Bot,
  Sparkles,
  Send,
  CheckCircle2,
  Clock,
  ArrowRight,
  TrendingUp,
  BrainCircuit,
  MessageSquare,
  ShieldAlert
} from 'lucide-react';
import { Customer, AIFollowupRecommendation, Product } from '../types';
import { generateAdminDraft } from '../services/aiService';

interface AIRecommendationsViewProps {
  customers: Customer[];
  followups: AIFollowupRecommendation[];
  products: Product[];
  onUpdateFollowupStatus: (id: string, status: 'sent' | 'dismissed') => Promise<void>;
}

export const AIRecommendationsView: React.FC<AIRecommendationsViewProps> = ({
  customers,
  followups,
  products,
  onUpdateFollowupStatus,
}) => {
  const [selectedFollowup, setSelectedFollowup] = useState<AIFollowupRecommendation | null>(null);
  const [customDraft, setCustomDraft] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [successSent, setSuccessSent] = useState(false);

  const handleOpenDraft = (fup: AIFollowupRecommendation) => {
    setSelectedFollowup(fup);
    setCustomDraft(fup.suggestedMessage);
    setSuccessSent(false);
  };

  const handleSendFollowup = async () => {
    if (!selectedFollowup) return;
    setIsSending(true);
    try {
      await onUpdateFollowupStatus(selectedFollowup.id, 'sent');
      setSuccessSent(true);
      setTimeout(() => {
        setSelectedFollowup(null);
        setSuccessSent(false);
      }, 1500);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-indigo-900 via-indigo-800 to-sky-900 rounded-2xl p-6 text-white shadow-md relative overflow-hidden">
        <div className="relative z-10 max-w-2xl">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-white/10 backdrop-blur-md rounded-full text-xs font-semibold text-sky-200 mb-3">
            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
            AI Savdo Tavsiyalari & Follow-up
          </div>
          <h2 className="text-2xl font-bold tracking-tight">
            Mijozlarni Yo'qotmang: AI Qayta Aloqa Tizimi
          </h2>
          <p className="text-xs text-indigo-100/90 mt-1 leading-relaxed">
            Tovarni so'rab, hali xarid qilmagan mijozlar uchun AI o'zbek tilida moslashtirilgan xabarlar tayyorlaydi. Savdo konversiyasini +28% gacha oshiring.
          </p>
        </div>
      </div>

      {/* Grid: Followups list + Action card */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Followups list (2 cols) */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-slate-900">Qayta Aloqa Qilish Kerak (Follow-up)</h3>
            <span className="text-xs font-semibold text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-full">
              {followups.filter((f) => f.status === 'pending').length} ta tavsiya
            </span>
          </div>

          <div className="space-y-3">
            {followups
              .filter((f) => f.status === 'pending')
              .map((item) => (
                <div
                  key={item.id}
                  className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs hover:border-indigo-300 transition-all space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-indigo-50 text-indigo-600 font-bold flex items-center justify-center text-xs">
                        {item.customerName.charAt(0)}
                      </div>
                      <div>
                        <div className="font-bold text-slate-900 text-sm">{item.customerName}</div>
                        <div className="text-[11px] text-slate-400 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {item.lastInteractionDays} kun oldin qiziqqan
                        </div>
                      </div>
                    </div>
                    <span className="text-xs font-bold text-sky-700 bg-sky-50 px-2.5 py-1 rounded-lg">
                      {item.productName}
                    </span>
                  </div>

                  <p className="text-xs text-slate-600 bg-slate-50 p-3 rounded-xl border border-slate-100">
                    <strong>Tahlil:</strong> {item.reason}
                  </p>

                  <div className="p-3 bg-indigo-50/50 rounded-xl border border-indigo-100 text-xs text-indigo-950 font-sans leading-relaxed">
                    <span className="font-bold text-indigo-600 block text-[10px] uppercase mb-1">
                      Tavsiya etilgan xabar:
                    </span>
                    "{item.suggestedMessage}"
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                    <button
                      onClick={() => onUpdateFollowupStatus(item.id, 'dismissed')}
                      className="px-3 py-1.5 text-xs font-semibold text-slate-500 hover:text-slate-700"
                    >
                      Bekor qilish
                    </button>
                    <button
                      onClick={() => handleOpenDraft(item)}
                      className="px-4 py-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-xs transition-all flex items-center gap-1.5"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      AI yozib bersin / Yuborish
                    </button>
                  </div>
                </div>
              ))}

            {followups.filter((f) => f.status === 'pending').length === 0 && (
              <div className="p-12 text-center bg-white rounded-2xl border border-slate-200 text-slate-400 text-xs">
                Hozirda yangi follow-up tavsiyalar mavjud emas. Barcha mijozlar bilan aloqa o'rnatilgan.
              </div>
            )}
          </div>
        </div>

        {/* Right Column: AI Lead Scoring Info & Quick Sender */}
        <div className="space-y-4">
          {/* Scoring Methodology Card */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-3">
            <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
              <BrainCircuit className="w-4 h-4 text-indigo-600" />
              AI Lead Scoring Tizimi
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Mijozning Telegram orqali bergan har bir savoli uning xarid qilish ehtimolini oshiradi:
            </p>

            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50">
                <span>Narx va chegirma so'rash</span>
                <span className="font-bold text-emerald-600">+25 ball</span>
              </div>
              <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50">
                <span>Omborda mavjudligini so'rash</span>
                <span className="font-bold text-emerald-600">+20 ball</span>
              </div>
              <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50">
                <span>Yetkazib berish shartlari</span>
                <span className="font-bold text-emerald-600">+20 ball</span>
              </div>
              <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50">
                <span>Telefon raqamini yuborish</span>
                <span className="font-bold text-emerald-600">+35 ball</span>
              </div>
            </div>

            <div className="p-2.5 bg-amber-50 rounded-xl border border-amber-200 text-[11px] text-amber-800">
              Score 80 dan oshganda tizim avtomatik ravishda <strong>"Issiq lead"</strong> tamg'asini beradi.
            </div>
          </div>
        </div>
      </div>

      {/* Follow-up Sending Modal */}
      {selectedFollowup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="w-full max-w-lg bg-white rounded-2xl p-6 shadow-xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">Follow-up Xabari</h3>
                  <p className="text-xs text-slate-500">Mijoz: {selectedFollowup.customerName}</p>
                </div>
              </div>
              <button onClick={() => setSelectedFollowup(null)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>

            <div className="my-4 space-y-3 text-xs">
              <label className="block font-semibold text-slate-700">
                Telegram orqali yuboriladigan matn:
              </label>
              <textarea
                rows={5}
                value={customDraft}
                onChange={(e) => setCustomDraft(e.target.value)}
                className="w-full p-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 leading-relaxed font-sans"
              />

              {successSent && (
                <div className="p-3 bg-emerald-50 text-emerald-700 rounded-xl font-semibold flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4" />
                  Mijozga Telegram orqali yuborildi!
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                onClick={() => setSelectedFollowup(null)}
                className="px-4 py-2 font-semibold text-slate-600 hover:bg-slate-100 rounded-xl text-xs"
              >
                Bekor qilish
              </button>
              <button
                disabled={isSending || !customDraft}
                onClick={handleSendFollowup}
                className="px-4 py-2 font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-xs transition-all flex items-center gap-1.5 text-xs disabled:opacity-50"
              >
                <Send className="w-3.5 h-3.5" />
                Telegramga Yuborish
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
