import React, { useState } from 'react';
import {
  TrendingUp,
  Users,
  ShoppingBag,
  AlertTriangle,
  ArrowUpRight,
  Sparkles,
  Send,
  MessageSquare,
  CheckCircle2,
  Clock,
  ChevronRight
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from 'recharts';
import { Product, Customer, Order, AIFollowupRecommendation } from '../types';
import { generateAdminDraft } from '../services/aiService';
import { getOrderStatusBadge, getInventoryStatusBadge } from './OrdersView';

interface DashboardViewProps {
  products: Product[];
  customers: Customer[];
  orders: Order[];
  followups: AIFollowupRecommendation[];
  onOpenCustomer: (customer: Customer) => void;
  onOpenOrder: (order: Order) => void;
  onNavigateTab: (tab: any) => void;
  onTriggerTelegramDemo: () => void;
}

const SALES_DATA_7D = [
  { day: 'Dush', sales: 18500000 },
  { day: 'Sesh', sales: 22400000 },
  { day: 'Chor', sales: 16200000 },
  { day: 'Pay', sales: 29800000 },
  { day: 'Jum', sales: 34100000 },
  { day: 'Shan', sales: 41200000 },
  { day: 'Yak', sales: 31450000 },
];

export const DashboardView: React.FC<DashboardViewProps> = ({
  products,
  customers,
  orders,
  followups,
  onOpenCustomer,
  onOpenOrder,
  onNavigateTab,
  onTriggerTelegramDemo,
}) => {
  const [draftModalCustomer, setDraftModalCustomer] = useState<{ name: string; question: string } | null>(null);
  const [draftResponse, setDraftResponse] = useState<string>('');
  const [isGeneratingDraft, setIsGeneratingDraft] = useState(false);
  const [sentSuccess, setSentSuccess] = useState(false);

  // Compute live KPIs
  const totalSalesToday = orders.reduce((sum, o) => sum + (o.total || 0), 0);
  const lowStockCount = products.filter(p => p.stock <= p.lowStockThreshold).length;

  const handleOpenDraft = async (name: string, question: string) => {
    setDraftModalCustomer({ name, question });
    setIsGeneratingDraft(true);
    setSentSuccess(false);
    try {
      const draft = await generateAdminDraft(name, question, 'Telefon Market & Gadgets');
      setDraftResponse(draft);
    } finally {
      setIsGeneratingDraft(false);
    }
  };

  const handleSendDraft = () => {
    setSentSuccess(true);
    setTimeout(() => {
      setDraftModalCustomer(null);
      setSentSuccess(false);
    }, 1500);
  };

  return (
    <div className="space-y-6">
      {/* Top Welcome Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">
            Assalomu alaykum, Xush kelibsiz! 👋
          </h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Telegram SavdoBot faol: Mijozlar savollariga avtomatik javob bermoqda va yangi buyurtmalarni qabul qilmoqda.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={onTriggerTelegramDemo}
            className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-sky-600 hover:bg-sky-700 rounded-xl shadow-xs transition-all"
          >
            <Send className="w-4 h-4" />
            Telegram Test Chati
          </button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Bugungi Savdo */}
        <div className="p-5 bg-white rounded-2xl border border-slate-200/80 shadow-xs relative overflow-hidden group hover:border-slate-300 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Bugungi Savdo</span>
            <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-slate-900">
              {totalSalesToday > 0 ? totalSalesToday.toLocaleString() : '31 450 000'} so'm
            </div>
            <div className="flex items-center gap-1.5 text-xs font-medium text-emerald-600 mt-1">
              <ArrowUpRight className="w-3.5 h-3.5" />
              <span>+18.4% kechagiga nisbatan</span>
            </div>
          </div>
        </div>

        {/* KPI 2: Yangi Mijozlar */}
        <div className="p-5 bg-white rounded-2xl border border-slate-200/80 shadow-xs relative overflow-hidden group hover:border-slate-300 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Yangi Mijozlar</span>
            <div className="p-2 rounded-xl bg-sky-50 text-sky-600">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-slate-900">
              {customers.length > 0 ? customers.length : 28}
            </div>
            <div className="flex items-center gap-1.5 text-xs font-medium text-sky-600 mt-1">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Telegram orqali kelgan</span>
            </div>
          </div>
        </div>

        {/* KPI 3: Buyurtmalar */}
        <div className="p-5 bg-white rounded-2xl border border-slate-200/80 shadow-xs relative overflow-hidden group hover:border-slate-300 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Buyurtmalar</span>
            <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600">
              <ShoppingBag className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-slate-900">
              {orders.length > 0 ? orders.length : 16}
            </div>
            <div className="flex items-center gap-1.5 text-xs font-medium text-indigo-600 mt-1">
              <span>95% tasdiqlangan</span>
            </div>
          </div>
        </div>

        {/* KPI 4: Kam Qolgan Mahsulotlar */}
        <div className="p-5 bg-white rounded-2xl border border-slate-200/80 shadow-xs relative overflow-hidden group hover:border-slate-300 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Kam Qolgan Mahsulot</span>
            <div className="p-2 rounded-xl bg-amber-50 text-amber-600">
              <AlertTriangle className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-slate-900">
              {lowStockCount > 0 ? lowStockCount : 4}
            </div>
            <div className="flex items-center gap-1.5 text-xs font-medium text-amber-600 mt-1">
              <span>Kirim qilish tavsiya etiladi</span>
            </div>
          </div>
        </div>
      </div>

      {/* Escalated Questions / Attention Alert Section */}
      <div className="p-5 bg-gradient-to-r from-amber-500/10 via-orange-500/5 to-transparent rounded-2xl border border-amber-300/80 shadow-xs">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="p-2.5 bg-amber-500 text-white rounded-xl shadow-xs">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-amber-950">🟠 Admin e'tibori kerak</span>
                <span className="text-xs px-2 py-0.5 font-semibold bg-amber-200 text-amber-900 rounded-full">Yangi so'rov</span>
              </div>
              <p className="text-sm text-amber-900 mt-1">
                <strong>Mijoz:</strong> Akmal Rahimov • <strong>Savol:</strong> "2 dona Samsung S25 Ultra olsam qancha chegirma qilasiz?"
              </p>
              <p className="text-xs text-amber-700 mt-0.5">
                AI chegirma siyosati yo'qligi sababli to'qimadi va mijozga menejer bog'lanishini aytdi.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 self-end md:self-auto">
            <button
              onClick={() => handleOpenDraft('Akmal Rahimov', '2 dona Samsung S25 Ultra olsam qancha chegirma qilasiz?')}
              className="px-3.5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-xs transition-all flex items-center gap-1.5"
            >
              <Sparkles className="w-3.5 h-3.5" />
              AI javob yozsin
            </button>
            <button
              onClick={() => onNavigateTab('telegram')}
              className="px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl transition-all"
            >
              O'zim javob beraman
            </button>
          </div>
        </div>
      </div>

      {/* Main Grid: Chart + AI Recommendations */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Sales Chart (2 cols) */}
        <div className="lg:col-span-2 p-5 bg-white rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
            <div>
              <h3 className="text-base font-bold text-slate-900">Savdo Dinamikasi</h3>
              <p className="text-xs text-slate-500">So'nggi 7 kunlik savdo hajmi va tushum</p>
            </div>
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs font-semibold text-slate-600">
              <button className="px-3 py-1 rounded-lg hover:text-slate-900">Bugun</button>
              <button className="px-3 py-1 bg-white text-slate-900 shadow-xs rounded-lg">7 kun</button>
              <button className="px-3 py-1 hover:text-slate-900">30 kun</button>
            </div>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={SALES_DATA_7D} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="salesGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 11, fill: '#64748b' }}
                  tickFormatter={(val) => `${(val / 1000000).toFixed(0)}M`}
                />
                <Tooltip
                  formatter={(val: any) => [`${Number(val).toLocaleString()} so'm`, 'Savdo']}
                  contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                />
                <Area type="monotone" dataKey="sales" stroke="#0284c7" strokeWidth={2.5} fillOpacity={1} fill="url(#salesGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* AI Recommendations Panel */}
        <div className="p-5 bg-white rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg">
                  <Sparkles className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-bold text-slate-900">AI Follow-up Tavsiyalar</h3>
              </div>
              <span className="text-xs font-semibold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">
                {followups.length} ta
              </span>
            </div>

            <div className="space-y-3">
              {followups.slice(0, 2).map((item) => (
                <div
                  key={item.id}
                  className="p-3.5 rounded-xl border border-slate-100 bg-slate-50/70 hover:bg-slate-50 transition-all text-xs"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-800">{item.customerName}</span>
                    <span className="text-slate-400 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {item.lastInteractionDays} kun oldin
                    </span>
                  </div>
                  <p className="text-slate-600 mt-1 line-clamp-2">{item.reason}</p>
                  <div className="mt-2.5 pt-2 border-t border-slate-200/60 flex items-center justify-between">
                    <span className="text-indigo-600 font-medium truncate max-w-[140px]">
                      {item.productName}
                    </span>
                    <button
                      onClick={() => handleOpenDraft(item.customerName, item.reason)}
                      className="px-2.5 py-1 text-xs font-semibold text-indigo-600 hover:text-white hover:bg-indigo-600 border border-indigo-200 rounded-lg transition-all"
                    >
                      AI javob yozsin
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100">
            <button
              onClick={() => onNavigateTab('ai')}
              className="w-full py-2 text-xs font-semibold text-indigo-600 hover:text-indigo-700 flex items-center justify-center gap-1"
            >
              Barcha tavsiyalarni ko'rish
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Recent Orders Section */}
      <div className="p-5 bg-white rounded-2xl border border-slate-200/80 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base font-bold text-slate-900">So'nggi Buyurtmalar</h3>
            <p className="text-xs text-slate-500">Telegram orqali qabul qilingan va tasdiqlangan buyurtmalar</p>
          </div>
          <button
            onClick={() => onNavigateTab('orders')}
            className="text-xs font-semibold text-sky-600 hover:text-sky-700 flex items-center gap-1"
          >
            Hammasini ko'rish
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-100 text-slate-400 uppercase font-semibold">
                <th className="pb-3 pl-2">Buyurtma ID & Sana</th>
                <th className="pb-3">Mijoz</th>
                <th className="pb-3">Mahsulotlar</th>
                <th className="pb-3">Summa</th>
                <th className="pb-3">Holat</th>
                <th className="pb-3">Ombor</th>
                <th className="pb-3">Admin</th>
                <th className="pb-3 pr-2 text-right">Amal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {orders.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400">
                    Hozircha yangi buyurtmalar mavjud emas
                  </td>
                </tr>
              ) : (
                orders.slice(0, 5).map((order) => {
                  const statusBadge = getOrderStatusBadge(order.status || order.orderStatus);
                  const inventoryBadge = getInventoryStatusBadge(order.inventoryStatus);
                  const currency = order.currency || "so'm";
                  const formattedDate = new Date(order.createdAt).toLocaleString('uz-UZ', {
                    day: '2-digit',
                    month: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                  });

                  return (
                    <tr key={order.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 pl-2">
                        <div className="font-mono font-bold text-slate-800">#{order.id}</div>
                        <div className="text-[10px] text-slate-400 mt-0.5">{formattedDate}</div>
                      </td>
                      <td className="py-3">
                        <div className="font-semibold text-slate-900">
                          {order.customerName || (order.customerId ? `Mijoz (${order.customerId.slice(0, 8)})` : 'Mijoz')}
                        </div>
                        <div className="text-slate-400 text-[11px]">{order.customerPhone || 'Telegram'}</div>
                      </td>
                      <td className="py-3 max-w-[200px] truncate text-slate-700 font-medium">
                        {order.items && order.items.length > 0
                          ? order.items.map((i) => `${i.productName} (${i.quantity}x)`).join(', ')
                          : 'Mahsulot yo\'q'}
                      </td>
                      <td className="py-3 font-bold text-slate-900">
                        {order.total?.toLocaleString() ?? 0} {currency}
                      </td>
                      <td className="py-3">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-semibold rounded-md ${statusBadge.className}`}
                        >
                          {statusBadge.icon}
                          {statusBadge.label}
                        </span>
                      </td>
                      <td className="py-3">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-semibold rounded-md ${inventoryBadge.className}`}
                        >
                          {inventoryBadge.icon}
                          {inventoryBadge.label}
                        </span>
                      </td>
                      <td className="py-3">
                        {order.adminNotificationSent ? (
                          <span
                            className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-semibold rounded-md bg-sky-50 text-sky-700 border border-sky-200"
                            title="Adminlarga Telegram orqali yuborilgan"
                          >
                            <Send className="w-2.5 h-2.5 text-sky-600" />
                            Xabardor
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-400">-</span>
                        )}
                      </td>
                      <td className="py-3 pr-2 text-right">
                        <button
                          onClick={() => onOpenOrder(order)}
                          className="px-2.5 py-1 text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg font-medium transition-all"
                        >
                          Batafsil
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* AI Draft Modal */}
      {draftModalCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="w-full max-w-lg bg-white rounded-2xl p-6 shadow-xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900">AI Javob Qoralamasi</h3>
                  <p className="text-xs text-slate-500">Mijoz: {draftModalCustomer.name}</p>
                </div>
              </div>
              <button
                onClick={() => setDraftModalCustomer(null)}
                className="text-slate-400 hover:text-slate-600 text-sm font-semibold"
              >
                ✕
              </button>
            </div>

            <div className="my-4 space-y-3">
              <div className="p-3 bg-slate-50 rounded-xl text-xs text-slate-600">
                <span className="font-semibold text-slate-800">Mijoz savoli:</span> "{draftModalCustomer.question}"
              </div>

              {isGeneratingDraft ? (
                <div className="py-8 text-center text-slate-500 text-sm flex flex-col items-center justify-center gap-2">
                  <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                  <span>AI professional javob tayyorlamoqda...</span>
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Javob matni (tahrirlashingiz mumkin):
                  </label>
                  <textarea
                    rows={5}
                    value={draftResponse}
                    onChange={(e) => setDraftResponse(e.target.value)}
                    className="w-full p-3 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-sans leading-relaxed"
                  />
                </div>
              )}

              {sentSuccess && (
                <div className="p-3 bg-emerald-50 text-emerald-700 rounded-xl text-xs font-semibold flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4" />
                  Mijozga Telegram orqali muvaffaqiyatli yuborildi!
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                onClick={() => setDraftModalCustomer(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                Bekor qilish
              </button>
              <button
                disabled={isGeneratingDraft || !draftResponse}
                onClick={handleSendDraft}
                className="px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-xs transition-all flex items-center gap-1.5 disabled:opacity-50"
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
