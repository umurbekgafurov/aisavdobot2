import React, { useState } from 'react';
import {
  Settings as SettingsIcon,
  Store,
  Truck,
  CreditCard,
  Bot,
  Save,
  CheckCircle2,
  Key
} from 'lucide-react';
import { Business } from '../types';

interface SettingsViewProps {
  business: Business;
  onSaveBusiness: (business: Business) => Promise<void>;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  business,
  onSaveBusiness,
}) => {
  const [formData, setFormData] = useState<Business>(business);
  const [isSaved, setIsSaved] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSaveBusiness(formData);
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2500);
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">Do'kon va AI Sozlamalari</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Yetkazib berish, to'lov usullari va Telegram AI botining ishlash qoidalari
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Do'kon Ma'lumotlari */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4 text-xs">
          <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
            <Store className="w-4 h-4 text-sky-600" />
            Biznes va Do'kon Ma'lumotlari
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Do'kon nomi *</label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500 font-medium"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Aloqa telefoni *</label>
              <input
                type="text"
                required
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500 font-medium"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block font-semibold text-slate-700 mb-1">Do'kon manzili</label>
              <input
                type="text"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                className="w-full p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500 font-medium"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Ish vaqti</label>
              <input
                type="text"
                value={formData.workingHours}
                onChange={(e) => setFormData({ ...formData, workingHours: e.target.value })}
                className="w-full p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500 font-medium"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Valyuta</label>
              <input
                type="text"
                disabled
                value={formData.currency}
                className="w-full p-2.5 rounded-xl border border-slate-200 bg-slate-50 font-bold"
              />
            </div>
          </div>
        </div>

        {/* Yetkazib Berish Shartlari */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4 text-xs">
          <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
            <Truck className="w-4 h-4 text-emerald-600" />
            Yetkazib Berish va To'lov Shartlari (AI foydalanadi)
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Yetkazib berish narxi (so'm)</label>
              <input
                type="number"
                value={formData.deliveryPrice}
                onChange={(e) => setFormData({ ...formData, deliveryPrice: Number(e.target.value) })}
                className="w-full p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500 font-medium"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Bepul yetkazish chegarasi (so'm)</label>
              <input
                type="number"
                value={formData.freeDeliveryThreshold || 0}
                onChange={(e) => setFormData({ ...formData, freeDeliveryThreshold: Number(e.target.value) })}
                className="w-full p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500 font-medium"
              />
            </div>
          </div>
        </div>

        {/* AI Qoidalari va Xulq-atvori */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4 text-xs">
          <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
            <Bot className="w-4 h-4 text-indigo-600" />
            AI Xulq-atvori va Avtomatlashtirish
          </h3>

          <div className="space-y-3">
            <label className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100 cursor-pointer">
              <div>
                <span className="font-bold text-slate-800 block">Avtomatik javob berish (Auto Reply)</span>
                <span className="text-slate-500 text-[11px]">
                  Mijoz savol berganda AI mahsulot katalogi asosida darhol javob beradi
                </span>
              </div>
              <input
                type="checkbox"
                checked={formData.settings.autoReply}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    settings: { ...formData.settings, autoReply: e.target.checked },
                  })
                }
                className="w-5 h-5 text-sky-600 rounded-md focus:ring-sky-500"
              />
            </label>

            <label className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100 cursor-pointer">
              <div>
                <span className="font-bold text-slate-800 block">Telegram guruhlarda javob berish</span>
                <span className="text-slate-500 text-[11px]">
                  Bot ulangan guruhlardagi savollarga ham avtomatik tarzda xushmuomala javob qaytaradi
                </span>
              </div>
              <input
                type="checkbox"
                checked={formData.settings.groupAutoReply}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    settings: { ...formData.settings, groupAutoReply: e.target.checked },
                  })
                }
                className="w-5 h-5 text-sky-600 rounded-md focus:ring-sky-500"
              />
            </label>

            <label className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100 cursor-pointer">
              <div>
                <span className="font-bold text-slate-800 block">AI Follow-up tavsiyalari</span>
                <span className="text-slate-500 text-[11px]">
                  Xarid qilmagan mijozlarni aniqlab, admin boshqaruv panelida qayta aloqa xatlarini tayyorlaydi
                </span>
              </div>
              <input
                type="checkbox"
                checked={formData.settings.followUp}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    settings: { ...formData.settings, followUp: e.target.checked },
                  })
                }
                className="w-5 h-5 text-sky-600 rounded-md focus:ring-sky-500"
              />
            </label>
          </div>
        </div>

        {/* Submit */}
        <div className="flex items-center justify-between pt-2">
          {isSaved ? (
            <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600">
              <CheckCircle2 className="w-4 h-4" />
              Sozlamalar muvaffaqiyatli saqlandi!
            </div>
          ) : <div />}

          <button
            type="submit"
            className="flex items-center gap-2 px-5 py-2.5 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-xl shadow-xs transition-all"
          >
            <Save className="w-4 h-4" />
            Sozlamalarni Saqlash
          </button>
        </div>
      </form>
    </div>
  );
};
