import React, { useState, useMemo, useEffect } from 'react';
import {
  Users,
  Search,
  Filter,
  Flame,
  Phone,
  MessageSquare,
  Sparkles,
  ShoppingBag,
  Clock,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  Send,
  Calendar,
  Package,
  ChevronRight,
  ExternalLink,
  RefreshCw
} from 'lucide-react';
import { Customer, CustomerStatus, Order, SalesRecommendation, SalesAssistantAction } from '../types';
import { generateAdminDraft } from '../services/aiService';
import { SalesIntelligenceService, SalesActionGenerator } from '../services/salesIntelligenceService';
import { getOrderStatusBadge, getInventoryStatusBadge } from './OrdersView';

export const ACTION_LABELS: Record<string, string> = {
  follow_up: 'Mijoz bilan bog‘lanish',
  product_recommendation: 'Mahsulot tavsiyasi',
  price_follow_up: 'Narx bo‘yicha follow-up',
  order_follow_up: 'Buyurtma follow-up',
  repeat_purchase: 'Qayta xarid',
  no_action: 'Harakat kerak emas',
};

interface CustomersViewProps {
  customers: Customer[];
  orders: Order[];
  onSaveCustomer: (customer: Customer) => Promise<void>;
  onOpenCustomerProfile?: (customer: Customer) => void;
}

export const CustomersView: React.FC<CustomersViewProps> = ({
  customers,
  orders,
  onSaveCustomer,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [activeOrder, setActiveOrder] = useState<Order | null>(null);

  // Sales Intelligence AI recommendation state (on-demand only for selected customer)
  const [aiRecommendation, setAiRecommendation] = useState<SalesRecommendation | null>(null);
  const [isLoadingRecommendation, setIsLoadingRecommendation] = useState<boolean>(false);

  // Draft follow up
  const [isDrafting, setIsDrafting] = useState(false);
  const [draftMessage, setDraftMessage] = useState('');
  const [draftSent, setDraftSent] = useState(false);

  const statuses: (CustomerStatus | 'All')[] = [
    'All',
    'Yangi',
    'Faol',
    'Qiziqmoqda',
    'Buyurtma berdi',
    'Sotib oldi',
    'Yo\'qotilgan'
  ];

  const filteredCustomers = customers.filter((c) => {
    const matchesSearch =
      c.firstName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.lastName && c.lastName.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (c.telegramUsername && c.telegramUsername.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (c.phone && c.phone.includes(searchQuery));
    const matchesStatus = statusFilter === 'All' || c.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleOpenProfile = (customer: Customer) => {
    setSelectedCustomer(customer);
    setDraftSent(false);
    setAiRecommendation(null);
  };

  const handleGenerateAIDraft = async () => {
    if (!selectedCustomer) return;
    setIsDrafting(true);
    try {
      const draft = await generateAdminDraft(
        selectedCustomer.firstName,
        selectedCustomer.notes || 'Smartfonlar haqida qiziqqan',
        'Telefon Market & Gadgets'
      );
      setDraftMessage(draft);
    } finally {
      setIsDrafting(false);
    }
  };

  // Filter orders strictly for the selected customer and matching tenant, sorted newest to oldest
  const customerOrders = selectedCustomer
    ? orders
        .filter((order) => {
          if (order.customerId !== selectedCustomer.id) return false;
          if (selectedCustomer.businessId && order.businessId && order.businessId !== selectedCustomer.businessId) return false;
          return true;
        })
        .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
    : [];

  // Deterministically compute Sales Intelligence for the selected customer only
  const salesInsight = useMemo(() => {
    return SalesIntelligenceService.computeCustomerInsight(selectedCustomer, customerOrders);
  }, [selectedCustomer, customerOrders]);

  // Reset recommendation whenever selected customer switches
  useEffect(() => {
    setAiRecommendation(null);
  }, [selectedCustomer?.id]);

  // Derived SalesAssistantAction via M6.7 Action Generator
  const assistantAction: SalesAssistantAction | null = useMemo(() => {
    if (!salesInsight || !aiRecommendation) return null;
    return SalesActionGenerator.generateAction(salesInsight, aiRecommendation);
  }, [salesInsight, aiRecommendation]);

  const handleGetRecommendation = async () => {
    if (!salesInsight) return;
    setIsLoadingRecommendation(true);
    try {
      const rec = await SalesIntelligenceService.generateCustomerRecommendation(salesInsight);
      setAiRecommendation(rec);
    } catch (err) {
      console.error('Error generating AI recommendation:', err);
    } finally {
      setIsLoadingRecommendation(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">Mijozlar Bazasi (CRM)</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Telegram orqali murojaat qilgan barcha mijozlar, AI lead ballari va xaridlar tarixi
          </p>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Ism, Telegram username yoki telefon..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500"
          />
        </div>

        <div className="flex items-center gap-1 overflow-x-auto w-full sm:w-auto">
          {statuses.map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-xl whitespace-nowrap transition-all ${
                statusFilter === st
                  ? 'bg-sky-50 text-sky-700 border border-sky-200'
                  : 'text-slate-600 hover:bg-slate-50 border border-transparent'
              }`}
            >
              {st === 'All' ? 'Barchasi' : st}
            </button>
          ))}
        </div>
      </div>

      {/* Customers List & Selected Profile Side-by-side */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Customer List (2 cols on large screen) */}
        <div className={`bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden ${selectedCustomer ? 'lg:col-span-2' : 'lg:col-span-3'}`}>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/50 text-slate-400 uppercase font-semibold">
                  <th className="py-3.5 pl-4">Mijoz</th>
                  <th className="py-3.5">Telefon</th>
                  <th className="py-3.5">AI Lead Ball</th>
                  <th className="py-3.5">Holat</th>
                  <th className="py-3.5">Teglar</th>
                  <th className="py-3.5">Xaridlar</th>
                  <th className="py-3.5 pr-4 text-right">Profil</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredCustomers.map((cust) => {
                  const isHot = (cust.leadScore || 0) >= 80;
                  return (
                    <tr
                      key={cust.id}
                      onClick={() => handleOpenProfile(cust)}
                      className={`hover:bg-slate-50/80 cursor-pointer transition-colors ${
                        selectedCustomer?.id === cust.id ? 'bg-sky-50/50' : ''
                      }`}
                    >
                      <td className="py-3.5 pl-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-sky-400 to-indigo-600 text-white font-bold flex items-center justify-center text-xs">
                            {cust.firstName.charAt(0)}
                          </div>
                          <div>
                            <div className="font-bold text-slate-900">{cust.firstName} {cust.lastName || ''}</div>
                            <div className="text-[11px] text-sky-600 font-medium">
                              @{cust.telegramUsername || 'telegram_user'}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 text-slate-600 font-medium">{cust.phone || '-'}</td>
                      <td className="py-3.5">
                        <div className="flex items-center gap-1.5">
                          <div
                            className={`font-bold flex items-center gap-1 ${
                              isHot ? 'text-amber-600' : 'text-slate-700'
                            }`}
                          >
                            {isHot && <Flame className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />}
                            {cust.leadScore}/100
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5">
                        <span
                          className={`inline-flex px-2 py-0.5 text-[11px] font-semibold rounded-full ${
                            cust.status === 'Sotib oldi'
                              ? 'bg-emerald-50 text-emerald-700'
                              : cust.status === 'Buyurtma berdi'
                              ? 'bg-sky-50 text-sky-700'
                              : cust.status === 'Qiziqmoqda'
                              ? 'bg-amber-50 text-amber-700'
                              : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {cust.status}
                        </span>
                      </td>
                      <td className="py-3.5">
                        <div className="flex flex-wrap gap-1 max-w-[140px]">
                          {(cust.tags || []).map((t, idx) => (
                            <span
                              key={idx}
                              className={`text-[10px] px-1.5 py-0.5 rounded-md font-medium ${
                                t.includes('VIP')
                                  ? 'bg-purple-50 text-purple-700 border border-purple-200'
                                  : 'bg-slate-100 text-slate-600'
                              }`}
                            >
                              {t}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="py-3.5 font-bold text-slate-900">
                        {cust.totalSpent > 0 ? `${cust.totalSpent.toLocaleString()} so'm` : '-'}
                      </td>
                      <td className="py-3.5 pr-4 text-right">
                        <span className="text-sky-600 font-semibold flex items-center justify-end gap-1">
                          Ko'rish <ArrowRight className="w-3.5 h-3.5" />
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* CUSTOMER PROFILE CARD */}
        {selectedCustomer && (
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-sm">Mijoz Profili</h3>
              <button
                onClick={() => setSelectedCustomer(null)}
                className="text-slate-400 hover:text-slate-600 text-xs font-semibold p-1 hover:bg-slate-100 rounded-lg transition-colors"
              >
                Yopish ✕
              </button>
            </div>

            {/* Top Identity */}
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-sky-500 to-indigo-600 text-white font-bold text-base flex items-center justify-center">
                {selectedCustomer.firstName.charAt(0)}
              </div>
              <div>
                <div className="font-bold text-slate-900 text-base">
                  {selectedCustomer.firstName} {selectedCustomer.lastName || ''}
                </div>
                <div className="text-xs text-sky-600">@{selectedCustomer.telegramUsername || 'username'}</div>
                <div className="text-xs text-slate-500 mt-0.5">{selectedCustomer.phone || 'Telefon kiritilmagan'}</div>
              </div>
            </div>

            {/* SALES INTELLIGENCE (M6.6 Section) */}
            {!salesInsight ? (
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-center text-slate-400 text-xs font-medium">
                Sales Intelligence mavjud emas
              </div>
            ) : (
              <div className="p-4 bg-gradient-to-br from-indigo-50/60 via-sky-50/40 to-purple-50/50 rounded-2xl border border-indigo-100/90 shadow-xs space-y-3">
                {/* Header: Title & Intent Level Badge */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-indigo-600" />
                    <span className="font-bold text-slate-900 text-xs tracking-tight">Savdo Intellekti (Sales Intelligence)</span>
                  </div>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border uppercase tracking-wider flex items-center gap-1 ${
                      salesInsight.intentLevel === 'high'
                        ? 'bg-rose-50 text-rose-700 border-rose-200'
                        : salesInsight.intentLevel === 'medium'
                        ? 'bg-amber-50 text-amber-700 border-amber-200'
                        : 'bg-slate-100 text-slate-700 border-slate-200'
                    }`}
                  >
                    <Flame
                      className={`w-3 h-3 ${
                        salesInsight.intentLevel === 'high'
                          ? 'fill-rose-500 text-rose-500'
                          : salesInsight.intentLevel === 'medium'
                          ? 'fill-amber-500 text-amber-500'
                          : 'text-slate-400'
                      }`}
                    />
                    <span>{salesInsight.intentLevel.toUpperCase()} INTENT</span>
                  </span>
                </div>

                {/* Intent Score Bar */}
                <div className="bg-white/90 p-3 rounded-xl border border-indigo-100/70 shadow-2xs space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-600 text-[11px]">Xarid Niyati Bali (Intent Score):</span>
                    <span className="font-extrabold text-indigo-900 text-sm font-mono">{salesInsight.intentScore} / 100</span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        salesInsight.intentScore >= 70
                          ? 'bg-gradient-to-r from-rose-500 to-amber-500'
                          : salesInsight.intentScore >= 40
                          ? 'bg-gradient-to-r from-amber-400 to-amber-500'
                          : 'bg-slate-400'
                      }`}
                      style={{ width: `${Math.max(4, salesInsight.intentScore)}%` }}
                    />
                  </div>
                </div>

                {/* Signals Badges */}
                <div className="space-y-1">
                  <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block">Savdo Signallari:</span>
                  <div className="flex flex-wrap gap-1.5">
                    {salesInsight.signals.length === 0 ? (
                      <span className="text-xs text-slate-400 italic">Signallar mavjud emas</span>
                    ) : (
                      salesInsight.signals.map((sig, idx) => (
                        <span
                          key={idx}
                          className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-white text-slate-700 border border-slate-200 shadow-2xs flex items-center gap-1"
                        >
                          {sig === 'active_order' && '🛒 Faol buyurtma'}
                          {sig === 'purchase_intent_detected' && '🎯 Xarid niyati'}
                          {sig === 'repeat_customer' && '🔁 Doimiy xaridor'}
                          {sig === 'completed_order' && '✅ Yetkazilgan buyurtma'}
                          {sig === 'product_inquiry_detected' && '📦 Mahsulot so‘rovi'}
                          {sig === 'price_inquiry_detected' && '💰 Narx so‘rovi'}
                          {sig === 'stock_inquiry_detected' && '🏬 Ombor so‘rovi'}
                          {sig === 'cancelled_order' && '❌ Bekor qilingan'}
                          {!['active_order', 'purchase_intent_detected', 'repeat_customer', 'completed_order', 'product_inquiry_detected', 'price_inquiry_detected', 'stock_inquiry_detected', 'cancelled_order'].includes(sig) && sig}
                        </span>
                      ))
                    )}
                  </div>
                </div>

                {/* Order Statistics Grid */}
                <div className="grid grid-cols-4 gap-2 text-center text-xs">
                  <div className="p-2 bg-white/90 rounded-xl border border-slate-100 shadow-2xs">
                    <div className="text-[10px] text-slate-400 font-semibold uppercase">Jami</div>
                    <div className="text-sm font-bold text-slate-800">{salesInsight.totalOrders} ta</div>
                  </div>
                  <div className="p-2 bg-emerald-50/80 rounded-xl border border-emerald-100 shadow-2xs">
                    <div className="text-[10px] text-emerald-700 font-semibold uppercase">Yetkazildi</div>
                    <div className="text-sm font-bold text-emerald-900">{salesInsight.completedOrders} ta</div>
                  </div>
                  <div className="p-2 bg-rose-50/80 rounded-xl border border-rose-100 shadow-2xs">
                    <div className="text-[10px] text-rose-700 font-semibold uppercase">Bekor</div>
                    <div className="text-sm font-bold text-rose-900">{salesInsight.cancelledOrders} ta</div>
                  </div>
                  <div className="p-2 bg-indigo-50/80 rounded-xl border border-indigo-100 shadow-2xs">
                    <div className="text-[10px] text-indigo-700 font-semibold uppercase">Xarid</div>
                    <div className="text-xs font-bold text-indigo-950 truncate" title={`${salesInsight.totalSpent.toLocaleString()} so'm`}>
                      {salesInsight.totalSpent.toLocaleString()} so'm
                    </div>
                  </div>
                </div>

                {/* Timestamps: Last Order & Last Interaction */}
                <div className="grid grid-cols-2 gap-2 text-[11px] bg-white/80 p-2.5 rounded-xl border border-slate-100">
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-semibold">Oxirgi Buyurtma:</span>
                    <span className="font-semibold text-slate-700">
                      {salesInsight.lastOrderAt
                        ? new Date(salesInsight.lastOrderAt).toLocaleString('uz-UZ', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })
                        : 'Buyurtma berilmagan'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-semibold">Oxirgi Muloqot:</span>
                    <span className="font-semibold text-slate-700">
                      {salesInsight.lastInteractionAt
                        ? new Date(salesInsight.lastInteractionAt).toLocaleString('uz-UZ', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })
                        : 'Muloqot yo‘q'}
                    </span>
                  </div>
                </div>

                {/* AI Sales Assistant Action Preview (M6.7 Section) */}
                <div className="pt-2 border-t border-indigo-100/70 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-800 flex items-center gap-1">
                      <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                      AI Sales Assistant Action Preview
                    </span>
                    <button
                      onClick={handleGetRecommendation}
                      disabled={isLoadingRecommendation}
                      className="text-[10px] font-semibold text-indigo-600 hover:text-indigo-800 bg-white hover:bg-indigo-50 border border-indigo-200 px-2 py-1 rounded-lg transition-colors flex items-center gap-1 disabled:opacity-50 cursor-pointer"
                    >
                      {isLoadingRecommendation ? (
                        <>
                          <RefreshCw className="w-3 h-3 animate-spin" />
                          Tahlil qilinmoqda...
                        </>
                      ) : assistantAction ? (
                        <>
                          <RefreshCw className="w-3 h-3" />
                          Tavsiyani yangilash
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-3 h-3" />
                          Action olish
                        </>
                      )}
                    </button>
                  </div>

                  {!assistantAction ? (
                    <div className="p-3 bg-white/70 rounded-xl border border-slate-100 text-center text-xs text-slate-400 font-medium">
                      AI Sales Assistant tavsiyasi mavjud emas
                    </div>
                  ) : (
                    <div className="p-3 bg-white rounded-xl border border-indigo-100 shadow-2xs space-y-2.5">
                      {/* Action & Confidence */}
                      <div className="flex items-center justify-between gap-2">
                        <span className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 tracking-wide flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-indigo-600"></span>
                          {ACTION_LABELS[assistantAction.action] || assistantAction.action}
                        </span>
                        <span className="text-[10px] font-medium text-slate-500 bg-slate-50 px-2 py-0.5 rounded-md border border-slate-200">
                          Ishonch: {Math.round(assistantAction.confidence * 100)}%
                        </span>
                      </div>

                      {/* Reason */}
                      <div className="space-y-0.5">
                        <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                          Sabab (Reason):
                        </span>
                        <p className="text-xs text-slate-700 leading-relaxed font-medium">
                          {assistantAction.reason}
                        </p>
                      </div>

                      {/* Suggested Text */}
                      <div className="space-y-1 pt-1.5 border-t border-slate-100">
                        <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                          Tavsiya etilgan matn (Suggested Text):
                        </span>
                        {assistantAction.action === 'no_action' ? (
                          <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200/80 text-xs text-slate-500 italic">
                            Hozircha avtomatik harakat tavsiya etilmaydi
                          </div>
                        ) : assistantAction.suggestedText ? (
                          <div className="p-2.5 bg-sky-50/60 rounded-xl border border-sky-100 text-xs text-slate-800 space-y-2">
                            <p className="leading-relaxed font-sans">{assistantAction.suggestedText}</p>
                            <div className="flex justify-end">
                              <button
                                type="button"
                                onClick={() => setDraftMessage(assistantAction.suggestedText)}
                                className="text-[10px] font-bold text-sky-700 hover:text-sky-900 bg-white hover:bg-sky-100/70 border border-sky-200 px-2 py-1 rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                                title="Ushbu matnni quyidagi javob qoralamasiga nusxalash"
                              >
                                <Send className="w-2.5 h-2.5" />
                                Qoralamaga ko‘chirish
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="p-2 bg-slate-50 rounded-lg border border-slate-200 text-xs text-slate-400 italic">
                            Matn mavjud emas
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* BUYURTMALAR TARIXI (M5.4.1 Section) */}
            <div className="space-y-2.5 pt-2 border-t border-slate-100">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                  <ShoppingBag className="w-3.5 h-3.5 text-sky-600" />
                  Buyurtmalar tarixi ({customerOrders.length})
                </span>
                {customerOrders.length > 0 && (
                  <span className="text-[10px] text-slate-400 font-medium">
                    Eng yangisi yuqorida
                  </span>
                )}
              </div>

              {customerOrders.length === 0 ? (
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 text-center text-slate-400 text-xs">
                  <ShoppingBag className="w-6 h-6 mx-auto mb-1 text-slate-300 stroke-1" />
                  Hozircha buyurtmalar mavjud emas
                </div>
              ) : (
                <div className="space-y-2 max-h-72 overflow-y-auto pr-0.5">
                  {customerOrders.map((ord) => {
                    const statusBadge = getOrderStatusBadge(ord.status || ord.orderStatus);
                    const inventoryBadge = getInventoryStatusBadge(ord.inventoryStatus);
                    const currency = ord.currency || "so'm";
                    const formattedDate = new Date(ord.createdAt).toLocaleString('uz-UZ', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    });

                    return (
                      <div
                        key={ord.id}
                        onClick={() => setActiveOrder(ord)}
                        className="p-3 bg-slate-50/80 hover:bg-sky-50/70 rounded-xl border border-slate-200/70 transition-all cursor-pointer group"
                      >
                        {/* Header: ID, Date, Chevron */}
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono font-bold text-slate-800 text-xs group-hover:text-sky-700 transition-colors">
                              #{ord.id}
                            </span>
                            <span className="text-[10px] text-slate-400 flex items-center gap-0.5">
                              <Calendar className="w-2.5 h-2.5" />
                              {formattedDate}
                            </span>
                          </div>
                          <span className="text-[10px] font-semibold text-sky-600 group-hover:translate-x-0.5 transition-transform flex items-center gap-0.5">
                            Batafsil <ChevronRight className="w-3 h-3" />
                          </span>
                        </div>

                        {/* Products preview */}
                        <div className="text-xs font-semibold text-slate-800 mb-1.5 truncate">
                          {ord.items && ord.items.length > 0
                            ? ord.items.map((i) => `${i.productName} × ${i.quantity}`).join(', ')
                            : 'Mahsulot yo\'q'}
                        </div>

                        {/* Price & Badges Footer */}
                        <div className="flex items-center justify-between gap-1 pt-1.5 border-t border-slate-200/60 text-xs">
                          <span className="font-bold text-slate-900">
                            {ord.total?.toLocaleString() ?? 0} {currency}
                          </span>
                          <div className="flex items-center gap-1">
                            <span
                              className={`inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-semibold rounded-md ${statusBadge.className}`}
                            >
                              {statusBadge.icon}
                              {statusBadge.label}
                            </span>
                            <span
                              className={`inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-semibold rounded-md ${inventoryBadge.className}`}
                            >
                              {inventoryBadge.icon}
                              {inventoryBadge.label}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* AI Summary Section */}
            <div className="p-3.5 bg-indigo-50/70 rounded-xl border border-indigo-100/80 text-xs">
              <div className="font-bold text-indigo-950 flex items-center gap-1.5 mb-1">
                <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                AI Xulosa (Conversation Summary)
              </div>
              <p className="text-indigo-900/90 leading-relaxed">
                {selectedCustomer.aiSummary ||
                  'Mijoz flagman smartfonlar narxi bilan qiziqdi. Hozirda administrator taklifi kutilmoqda.'}
              </p>
            </div>

            {/* Interested Products */}
            <div className="text-xs space-y-1">
              <span className="font-semibold text-slate-700 block">Qiziqqan mahsulotlari:</span>
              <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200/70 text-slate-800 font-medium">
                📱 {selectedCustomer.notes || 'Samsung Galaxy S25 Ultra, iPhone 15 Pro'}
              </div>
            </div>

            {/* AI Follow-up action */}
            <div className="pt-2 border-t border-slate-100 space-y-2">
              <button
                onClick={handleGenerateAIDraft}
                className="w-full py-2.5 px-3 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-xs transition-all flex items-center justify-center gap-1.5"
              >
                <Sparkles className="w-3.5 h-3.5" />
                AI Javob yoki Taklif Yozsin
              </button>

              {draftMessage && (
                <div className="space-y-2 text-xs">
                  <textarea
                    rows={4}
                    value={draftMessage}
                    onChange={(e) => setDraftMessage(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 leading-relaxed"
                  />
                  <button
                    onClick={() => {
                      setDraftSent(true);
                      setTimeout(() => setDraftSent(false), 2000);
                    }}
                    className="w-full py-2 text-xs font-bold text-white bg-sky-600 hover:bg-sky-700 rounded-xl shadow-xs flex items-center justify-center gap-1.5"
                  >
                    <Send className="w-3.5 h-3.5" />
                    Telegram orqali yuborish
                  </button>
                  {draftSent && (
                    <div className="text-center text-emerald-600 font-semibold text-xs flex items-center justify-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Yuborildi!
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Reusable Order Detail Modal */}
      {activeOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="w-full max-w-lg bg-white rounded-2xl p-6 shadow-xl border border-slate-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between pb-3 border-b border-slate-100">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-slate-900 text-sm">Buyurtma #{activeOrder.id}</h3>
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded-md ${
                      getOrderStatusBadge(activeOrder.status || activeOrder.orderStatus).className
                    }`}
                  >
                    {getOrderStatusBadge(activeOrder.status || activeOrder.orderStatus).icon}
                    {getOrderStatusBadge(activeOrder.status || activeOrder.orderStatus).label}
                  </span>
                </div>
                <span className="text-xs text-slate-400 mt-0.5 block">
                  {new Date(activeOrder.createdAt).toLocaleString('uz-UZ')}
                </span>
              </div>
              <button
                onClick={() => setActiveOrder(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition-colors"
              >
                ✕
              </button>
            </div>

            <div className="my-4 space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                <div>
                  <span className="text-[10px] text-slate-400 block mb-0.5">Ombor holati:</span>
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold rounded-md ${
                      getInventoryStatusBadge(activeOrder.inventoryStatus).className
                    }`}
                  >
                    {getInventoryStatusBadge(activeOrder.inventoryStatus).icon}
                    {getInventoryStatusBadge(activeOrder.inventoryStatus).label}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block mb-0.5">Admin xabari:</span>
                  <span className="text-[11px] font-semibold text-slate-700">
                    {activeOrder.adminNotificationSent ? 'Telegram xabari yuborilgan' : 'Yuborilmagan'}
                  </span>
                </div>
              </div>

              <div>
                <h4 className="font-bold text-slate-900 mb-1.5 flex items-center gap-1">
                  <Package className="w-3.5 h-3.5 text-slate-500" />
                  Tarkibi ({activeOrder.items?.length || 0} ta mahsulot):
                </h4>
                <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
                  {activeOrder.items?.map((i, idx) => {
                    const currency = activeOrder.currency || "so'm";
                    return (
                      <div key={idx} className="p-2.5 flex items-center justify-between bg-white">
                        <div>
                          <div className="font-semibold text-slate-800">{i.productName}</div>
                          <div className="text-[11px] text-slate-400">
                            {i.quantity} dona × {i.unitPrice?.toLocaleString()} {currency}
                            {i.sku && ` (SKU: ${i.sku})`}
                          </div>
                        </div>
                        <div className="font-bold text-slate-900">
                          {((i.lineTotal ?? i.totalPrice ?? (i.unitPrice * i.quantity))).toLocaleString()} {currency}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-1 text-slate-600">
                <div className="flex justify-between">
                  <span>Mahsulotlar (Subtotal):</span>
                  <span className="font-medium text-slate-800">
                    {activeOrder.subtotal?.toLocaleString() ?? 0} {activeOrder.currency || "so'm"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Yetkazib berish:</span>
                  <span className="font-medium text-slate-800">
                    {(activeOrder.deliveryFee || activeOrder.deliveryPrice || 0).toLocaleString()} {activeOrder.currency || "so'm"}
                  </span>
                </div>
                <div className="flex justify-between font-bold text-slate-900 text-sm pt-1.5 border-t border-slate-200">
                  <span>Jami:</span>
                  <span className="text-emerald-700">
                    {activeOrder.total?.toLocaleString() ?? 0} {activeOrder.currency || "so'm"}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-3 border-t border-slate-100">
              <button
                onClick={() => setActiveOrder(null)}
                className="px-4 py-2 font-semibold text-slate-600 hover:bg-slate-100 rounded-xl text-xs transition-colors"
              >
                Yopish
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
