import React from 'react';
import {
  TrendingUp,
  ShoppingBag,
  Users,
  Package,
  ArrowUpRight,
  PieChart as PieIcon,
  BarChart2,
  Calendar
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { Product, Order, Customer } from '../types';

interface AnalyticsViewProps {
  products: Product[];
  orders: Order[];
  customers: Customer[];
}

const CATEGORY_COLORS = ['#0ea5e9', '#6366f1', '#10b981', '#f59e0b', '#ec4899'];

export const AnalyticsView: React.FC<AnalyticsViewProps> = ({
  products,
  orders,
  customers,
}) => {
  const totalRevenue = orders.reduce((sum, o) => sum + (o.total || 0), 0);
  const averageOrderValue = orders.length > 0 ? Math.round(totalRevenue / orders.length) : 0;
  const returningCustomers = customers.filter(c => c.totalOrders > 1).length;

  const categoryBreakdown = [
    { name: 'Telefonlar', value: 45 },
    { name: 'Noutbuklar', value: 25 },
    { name: 'Aksessuarlar', value: 18 },
    { name: 'Smart soatlar', value: 12 },
  ];

  const weeklyOrdersData = [
    { day: 'Dush', count: 12, sum: 18500000 },
    { day: 'Sesh', count: 15, sum: 22400000 },
    { day: 'Chor', count: 9, sum: 16200000 },
    { day: 'Pay', count: 19, sum: 29800000 },
    { day: 'Jum', count: 22, sum: 34100000 },
    { day: 'Shan', count: 28, sum: 41200000 },
    { day: 'Yak', count: 16, sum: 31450000 },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">Savdo va CRM Statistikasi</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Telegram kanali orqali tushumlar, o'rtacha chek va mijozlar konversiyasi tahlili
          </p>
        </div>
      </div>

      {/* Top Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 bg-white rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Jami Tushum</div>
          <div className="text-2xl font-bold text-slate-900 mt-2">
            {totalRevenue.toLocaleString()} so'm
          </div>
          <div className="text-xs text-emerald-600 font-medium flex items-center gap-1 mt-1">
            <ArrowUpRight className="w-3.5 h-3.5" />
            +24% o'tgan oyga nisbatan
          </div>
        </div>

        <div className="p-5 bg-white rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">O'rtacha Chek (AOV)</div>
          <div className="text-2xl font-bold text-slate-900 mt-2">
            {averageOrderValue.toLocaleString()} so'm
          </div>
          <div className="text-xs text-slate-500 mt-1">
            Har bir buyurtmaga to'g'ri keluvchi
          </div>
        </div>

        <div className="p-5 bg-white rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Doimiy Mijozlar</div>
          <div className="text-2xl font-bold text-slate-900 mt-2">
            {returningCustomers} ta ({customers.length > 0 ? Math.round((returningCustomers / customers.length) * 100) : 35}%)
          </div>
          <div className="text-xs text-sky-600 font-medium mt-1">
            Qayta xarid qilganlar
          </div>
        </div>

        <div className="p-5 bg-white rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">AI Konversiya</div>
          <div className="text-2xl font-bold text-emerald-600 mt-2">
            42.8%
          </div>
          <div className="text-xs text-emerald-700 font-medium mt-1">
            Savoldan buyurtmagacha o'tganlar
          </div>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Weekly Bar Chart (2 cols) */}
        <div className="lg:col-span-2 p-5 bg-white rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-bold text-slate-900">Haftalik Buyurtmalar Soni</h3>
              <p className="text-xs text-slate-500">Kunlar kesimida tasdiqlangan buyurtmalar</p>
            </div>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weeklyOrdersData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b' }} />
                <Tooltip
                  formatter={(val: any) => [`${val} ta`, 'Buyurtmalar']}
                  contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0' }}
                />
                <Bar dataKey="count" fill="#0ea5e9" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Category Breakdown (1 col) */}
        <div className="p-5 bg-white rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-900 mb-1">Kategoriyalar Ulushi</h3>
            <p className="text-xs text-slate-500 mb-4">Sotuv hajmi bo'yicha toifalar taqsimoti</p>

            <div className="h-44 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categoryBreakdown}
                    innerRadius={50}
                    outerRadius={75}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {categoryBreakdown.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={CATEGORY_COLORS[index % CATEGORY_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className="space-y-1.5 mt-2 text-xs">
              {categoryBreakdown.map((item, idx) => (
                <div key={idx} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: CATEGORY_COLORS[idx] }}
                    ></span>
                    <span className="text-slate-700 font-medium">{item.name}</span>
                  </div>
                  <span className="font-bold text-slate-900">{item.value}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
