import React, { useState } from 'react';
import {
  ShoppingBag,
  Search,
  Package,
  Clock,
  CheckCircle2,
  Truck,
  XCircle,
  AlertTriangle,
  Send,
  Eye,
  Calendar,
  Layers,
  User,
  Phone,
  MapPin,
  DollarSign
} from 'lucide-react';
import { Order, OrderStatus, PaymentStatus, Product, Customer } from '../types';
import { OrderDomainStatus, OrderInventoryStatus } from '../types/orders';

interface OrdersViewProps {
  orders: Order[];
  products: Product[];
  customers: Customer[];
  onUpdateStatus: (orderId: string, status: OrderStatus | any, paymentStatus?: PaymentStatus | any) => Promise<void>;
  onCreateOrder?: (order: Order) => Promise<void>;
}

export function getOrderStatusBadge(status?: string): {
  key: string;
  label: string;
  className: string;
  icon: React.ReactNode;
} {
  const s = (status || 'confirmed').toLowerCase();

  switch (s) {
    case 'pending_confirmation':
    case 'yangi':
      return {
        key: 'pending_confirmation',
        label: 'Kutilmoqda',
        className: 'bg-amber-50 text-amber-700 border border-amber-200/80',
        icon: <Clock className="w-3 h-3 text-amber-600" />,
      };
    case 'confirmed':
    case 'tasdiqlandi':
      return {
        key: 'confirmed',
        label: 'Tasdiqlangan',
        className: 'bg-emerald-50 text-emerald-700 border border-emerald-200/80',
        icon: <CheckCircle2 className="w-3 h-3 text-emerald-600" />,
      };
    case 'processing':
    case 'tayyorlanmoqda':
      return {
        key: 'processing',
        label: 'Tayyorlanmoqda',
        className: 'bg-indigo-50 text-indigo-700 border border-indigo-200/80',
        icon: <Layers className="w-3 h-3 text-indigo-600" />,
      };
    case 'completed':
    case 'yetkazildi':
      return {
        key: 'completed',
        label: 'Yetkazildi',
        className: 'bg-teal-50 text-teal-700 border border-teal-200/80',
        icon: <CheckCircle2 className="w-3 h-3 text-teal-600" />,
      };
    case 'cancelled':
    case 'bekor qilindi':
      return {
        key: 'cancelled',
        label: 'Bekor qilingan',
        className: 'bg-rose-50 text-rose-700 border border-rose-200/80',
        icon: <XCircle className="w-3 h-3 text-rose-600" />,
      };
    case 'yetkazilmoqda':
      return {
        key: 'shipping',
        label: 'Yetkazilmoqda',
        className: 'bg-sky-50 text-sky-700 border border-sky-200/80',
        icon: <Truck className="w-3 h-3 text-sky-600" />,
      };
    default:
      return {
        key: s,
        label: status || 'Noma\'lum',
        className: 'bg-slate-50 text-slate-700 border border-slate-200',
        icon: <Clock className="w-3 h-3 text-slate-500" />,
      };
  }
}

export function getInventoryStatusBadge(status?: string): {
  label: string;
  className: string;
  icon: React.ReactNode;
} {
  switch (status) {
    case 'completed':
      return {
        label: 'Ombor: Yechildi',
        className: 'bg-emerald-50 text-emerald-700 border border-emerald-200/80',
        icon: <CheckCircle2 className="w-3 h-3 text-emerald-600" />,
      };
    case 'pending':
      return {
        label: 'Ombor: Kutilmoqda',
        className: 'bg-amber-50 text-amber-700 border border-amber-200/80',
        icon: <Clock className="w-3 h-3 text-amber-600" />,
      };
    case 'insufficient_stock':
      return {
        label: 'Ombor: Yetarli emas',
        className: 'bg-orange-50 text-orange-700 border border-orange-200/80',
        icon: <AlertTriangle className="w-3 h-3 text-orange-600" />,
      };
    case 'failed':
      return {
        label: 'Ombor: Xatolik',
        className: 'bg-rose-50 text-rose-700 border border-rose-200/80',
        icon: <XCircle className="w-3 h-3 text-rose-600" />,
      };
    default:
      return {
        label: 'Ombor: Kutilmoqda',
        className: 'bg-slate-50 text-slate-600 border border-slate-200',
        icon: <Clock className="w-3 h-3 text-slate-400" />,
      };
  }
}

export const OrdersView: React.FC<OrdersViewProps> = ({
  orders,
  products,
  customers,
  onUpdateStatus,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState<string>('all');
  const [activeOrder, setActiveOrder] = useState<Order | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);

  const filterTabs = [
    { key: 'all', label: 'Barchasi' },
    { key: 'confirmed', label: 'Tasdiqlangan' },
    { key: 'pending_confirmation', label: 'Kutilmoqda' },
    { key: 'processing', label: 'Tayyorlanmoqda' },
    { key: 'completed', label: 'Yetkazildi' },
    { key: 'cancelled', label: 'Bekor qilingan' },
  ];

  const filteredOrders = orders.filter((o) => {
    const query = searchQuery.toLowerCase().trim();
    const matchesSearch =
      !query ||
      o.id.toLowerCase().includes(query) ||
      (o.customerName && o.customerName.toLowerCase().includes(query)) ||
      (o.customerPhone && o.customerPhone.includes(query)) ||
      (o.items && o.items.some((i) => i.productName.toLowerCase().includes(query) || (i.sku && i.sku.toLowerCase().includes(query))));

    if (!matchesSearch) return false;
    if (selectedFilter === 'all') return true;

    const ordStatus = (o.status || o.orderStatus || '').toLowerCase();
    if (selectedFilter === 'confirmed') {
      return ordStatus === 'confirmed' || ordStatus === 'tasdiqlandi';
    }
    if (selectedFilter === 'pending_confirmation') {
      return ordStatus === 'pending_confirmation' || ordStatus === 'yangi';
    }
    if (selectedFilter === 'processing') {
      return ordStatus === 'processing' || ordStatus === 'tayyorlanmoqda';
    }
    if (selectedFilter === 'completed') {
      return ordStatus === 'completed' || ordStatus === 'yetkazildi';
    }
    if (selectedFilter === 'cancelled') {
      return ordStatus === 'cancelled' || ordStatus === 'bekor qilindi';
    }
    return ordStatus === selectedFilter;
  });

  // Summary Metrics
  const totalRevenue = orders.reduce((sum, o) => sum + (o.total || 0), 0);
  const confirmedCount = orders.filter((o) => {
    const s = (o.status || o.orderStatus || '').toLowerCase();
    return s === 'confirmed' || s === 'tasdiqlandi' || s === 'completed' || s === 'yetkazildi';
  }).length;
  const inventoryCompletedCount = orders.filter((o) => o.inventoryStatus === 'completed').length;

  const handleStatusChange = async (newStatus: OrderDomainStatus, legacyLabel?: string) => {
    if (!activeOrder || isUpdating) return;
    setIsUpdating(true);
    try {
      await onUpdateStatus(activeOrder.id, newStatus as any, legacyLabel as any);
      setActiveOrder({
        ...activeOrder,
        status: newStatus,
        orderStatus: legacyLabel || newStatus,
        updatedAt: Date.now(),
      });
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-3">
          <div className="p-2.5 bg-sky-50 text-sky-600 rounded-xl">
            <ShoppingBag className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] font-medium text-slate-500">Jami buyurtmalar</div>
            <div className="text-lg font-bold text-slate-900">{orders.length} ta</div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-3">
          <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] font-medium text-slate-500">Tasdiqlangan buyurtmalar</div>
            <div className="text-lg font-bold text-emerald-700">{confirmedCount} ta</div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-3">
          <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl">
            <Package className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] font-medium text-slate-500">Ombori yechilgan</div>
            <div className="text-lg font-bold text-indigo-700">{inventoryCompletedCount} ta</div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-3">
          <div className="p-2.5 bg-teal-50 text-teal-600 rounded-xl">
            <DollarSign className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] font-medium text-slate-500">Jami aylanma</div>
            <div className="text-lg font-bold text-slate-900 truncate">
              {totalRevenue.toLocaleString()} {orders[0]?.currency || "so'm"}
            </div>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Buyurtma ID, mijoz, mahsulot yoki SKU..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
          {filterTabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setSelectedFilter(tab.key)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-xl whitespace-nowrap transition-all ${
                selectedFilter === tab.key
                  ? 'bg-sky-50 text-sky-700 border border-sky-200 shadow-xs'
                  : 'text-slate-600 hover:bg-slate-50 border border-transparent'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Orders Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/60 text-slate-400 uppercase font-semibold tracking-wider">
                <th className="py-3.5 pl-4">Order ID & Sana</th>
                <th className="py-3.5">Mijoz</th>
                <th className="py-3.5">Mahsulotlar</th>
                <th className="py-3.5">Jami Summa</th>
                <th className="py-3.5">Buyurtma Holati</th>
                <th className="py-3.5">Ombor Holati</th>
                <th className="py-3.5">Admin Xabari</th>
                <th className="py-3.5 pr-4 text-right">Amal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <ShoppingBag className="w-8 h-8 mx-auto mb-2 text-slate-300 stroke-1" />
                    Mos keluvchi buyurtmalar topilmadi.
                  </td>
                </tr>
              ) : (
                filteredOrders.map((ord) => {
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
                    <tr key={ord.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 pl-4">
                        <div className="font-mono font-bold text-slate-900 truncate max-w-[130px]">
                          #{ord.id}
                        </div>
                        <div className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                          <Calendar className="w-3 h-3 text-slate-400 shrink-0" />
                          <span>{formattedDate}</span>
                        </div>
                      </td>

                      <td className="py-3.5">
                        <div className="font-semibold text-slate-900">
                          {ord.customerName || (ord.customerId ? `Mijoz (${ord.customerId.slice(0, 8)})` : 'Telegram mijoz')}
                        </div>
                        <div className="text-slate-400 text-[11px]">
                          {ord.customerPhone || 'Telegram'}
                        </div>
                      </td>

                      <td className="py-3.5 max-w-[220px]">
                        <div className="font-medium text-slate-800 truncate">
                          {ord.items && ord.items.length > 0
                            ? ord.items.map((i) => `${i.productName} (${i.quantity} dona)`).join(', ')
                            : 'Mahsulot yo\'q'}
                        </div>
                        <div className="text-[11px] text-slate-400">
                          {ord.items?.length || 0} ta pozitsiya
                        </div>
                      </td>

                      <td className="py-3.5">
                        <div className="font-bold text-slate-900">
                          {ord.total?.toLocaleString() ?? 0} {currency}
                        </div>
                        {ord.subtotal && ord.subtotal !== ord.total && (
                          <div className="text-[10px] text-slate-400">
                            Subtotal: {ord.subtotal.toLocaleString()} {currency}
                          </div>
                        )}
                      </td>

                      <td className="py-3.5">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-semibold rounded-lg ${statusBadge.className}`}
                        >
                          {statusBadge.icon}
                          {statusBadge.label}
                        </span>
                      </td>

                      <td className="py-3.5">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-semibold rounded-lg ${inventoryBadge.className}`}
                        >
                          {inventoryBadge.icon}
                          {inventoryBadge.label}
                        </span>
                      </td>

                      <td className="py-3.5">
                        {ord.adminNotificationSent ? (
                          <span
                            className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold rounded-md bg-sky-50 text-sky-700 border border-sky-200"
                            title={`Admin Telegram xabari yuborilgan${ord.adminNotificationSentAt ? ` (${new Date(ord.adminNotificationSentAt).toLocaleTimeString('uz-UZ')})` : ''}`}
                          >
                            <Send className="w-2.5 h-2.5 text-sky-600" />
                            Xabardor
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium rounded-md bg-slate-50 text-slate-500 border border-slate-200">
                            Yuborilmagan
                          </span>
                        )}
                      </td>

                      <td className="py-3.5 pr-4 text-right">
                        <button
                          onClick={() => setActiveOrder(ord)}
                          className="px-2.5 py-1 text-xs text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg font-medium transition-all inline-flex items-center gap-1"
                        >
                          <Eye className="w-3.5 h-3.5" />
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

      {/* Order Detail Modal */}
      {activeOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="w-full max-w-xl bg-white rounded-2xl p-6 shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-start justify-between pb-4 border-b border-slate-100">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-slate-900 text-base">Buyurtma #{activeOrder.id}</h3>
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded-md ${
                      getOrderStatusBadge(activeOrder.status || activeOrder.orderStatus).className
                    }`}
                  >
                    {getOrderStatusBadge(activeOrder.status || activeOrder.orderStatus).icon}
                    {getOrderStatusBadge(activeOrder.status || activeOrder.orderStatus).label}
                  </span>
                </div>
                <div className="text-xs text-slate-400 mt-1 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5" />
                  <span>
                    Yaratilgan: {new Date(activeOrder.createdAt).toLocaleString('uz-UZ')}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setActiveOrder(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition-colors"
              >
                ✕
              </button>
            </div>

            <div className="my-4 space-y-4 text-xs">
              {/* Status Badges Row */}
              <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3 rounded-xl border border-slate-100">
                <div>
                  <span className="text-[11px] text-slate-500 block mb-1">Ombor holati:</span>
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-semibold rounded-md ${
                      getInventoryStatusBadge(activeOrder.inventoryStatus).className
                    }`}
                  >
                    {getInventoryStatusBadge(activeOrder.inventoryStatus).icon}
                    {getInventoryStatusBadge(activeOrder.inventoryStatus).label}
                  </span>
                </div>
                <div>
                  <span className="text-[11px] text-slate-500 block mb-1">Admin Telegram xabari:</span>
                  {activeOrder.adminNotificationSent ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-semibold rounded-md bg-sky-50 text-sky-700 border border-sky-200">
                      <Send className="w-3 h-3 text-sky-600" />
                      Muvaffaqiyatli yuborilgan
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium rounded-md bg-slate-100 text-slate-600">
                      Yuborilmagan
                    </span>
                  )}
                </div>
              </div>

              {/* Customer Box */}
              <div className="p-3 bg-slate-50/70 rounded-xl border border-slate-100 space-y-1.5">
                <div className="flex items-center gap-2 text-slate-800">
                  <User className="w-3.5 h-3.5 text-slate-400" />
                  <strong>Mijoz:</strong> {activeOrder.customerName || (activeOrder.customerId ? `ID: ${activeOrder.customerId}` : 'Mijoz')}
                </div>
                <div className="flex items-center gap-2 text-slate-800">
                  <Phone className="w-3.5 h-3.5 text-slate-400" />
                  <strong>Bog'lanish:</strong> {activeOrder.customerPhone || 'Telegram chat'}
                </div>
                <div className="flex items-center gap-2 text-slate-800">
                  <MapPin className="w-3.5 h-3.5 text-slate-400" />
                  <strong>Manzil / Izoh:</strong>{' '}
                  {activeOrder.deliveryAddress || activeOrder.customerNote || activeOrder.notes || 'Do\'kondan olib ketish'}
                </div>
              </div>

              {/* Products Breakdown Table */}
              <div>
                <h4 className="font-bold text-slate-900 mb-2 flex items-center gap-1.5">
                  <Package className="w-4 h-4 text-slate-500" />
                  Buyurtma tarkibi ({activeOrder.items?.length || 0} ta mahsulot):
                </h4>
                <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100">
                  <div className="grid grid-cols-12 bg-slate-50/80 p-2.5 font-semibold text-slate-500 text-[11px]">
                    <div className="col-span-6">Mahsulot & SKU</div>
                    <div className="col-span-2 text-center">Miqdor</div>
                    <div className="col-span-2 text-right">Dona narxi</div>
                    <div className="col-span-2 text-right">Jami</div>
                  </div>
                  {activeOrder.items?.map((item, idx) => {
                    const currency = activeOrder.currency || "so'm";
                    const lineTotal = item.lineTotal ?? item.totalPrice ?? item.unitPrice * item.quantity;

                    return (
                      <div key={idx} className="grid grid-cols-12 p-2.5 items-center bg-white text-xs">
                        <div className="col-span-6">
                          <div className="font-semibold text-slate-800">{item.productName}</div>
                          {item.sku && (
                            <div className="font-mono text-[10px] text-slate-400">SKU: {item.sku}</div>
                          )}
                        </div>
                        <div className="col-span-2 text-center font-bold text-slate-900">
                          {item.quantity} dona
                        </div>
                        <div className="col-span-2 text-right text-slate-600">
                          {item.unitPrice?.toLocaleString()} {currency}
                        </div>
                        <div className="col-span-2 text-right font-bold text-slate-900">
                          {lineTotal?.toLocaleString()} {currency}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Financial Calculation */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-1.5 text-slate-600">
                <div className="flex justify-between">
                  <span>Mahsulotlar summasi (Subtotal):</span>
                  <span className="font-semibold text-slate-800">
                    {activeOrder.subtotal?.toLocaleString() ?? 0} {activeOrder.currency || "so'm"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Yetkazib berish haqi:</span>
                  <span className="font-semibold text-slate-800">
                    {(activeOrder.deliveryPrice || activeOrder.deliveryFee || 0).toLocaleString()} {activeOrder.currency || "so'm"}
                  </span>
                </div>
                <div className="flex justify-between font-bold text-slate-900 text-sm pt-2 border-t border-slate-200">
                  <span>Jami to'lov:</span>
                  <span className="text-emerald-700">
                    {activeOrder.total?.toLocaleString() ?? 0} {activeOrder.currency || "so'm"}
                  </span>
                </div>
              </div>

              {/* Status Update Controls */}
              <div className="space-y-1.5 pt-1">
                <label className="block font-semibold text-slate-700">Holatni yangilash:</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    disabled={isUpdating}
                    onClick={() => handleStatusChange('processing', 'Tayyorlanmoqda')}
                    className="p-2 text-xs font-semibold rounded-xl bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 transition-colors disabled:opacity-50"
                  >
                    Tayyorlanmoqda
                  </button>
                  <button
                    disabled={isUpdating}
                    onClick={() => handleStatusChange('completed', 'Yetkazildi')}
                    className="p-2 text-xs font-semibold rounded-xl bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 transition-colors disabled:opacity-50"
                  >
                    Yetkazildi
                  </button>
                  <button
                    disabled={isUpdating}
                    onClick={() => handleStatusChange('cancelled', 'Bekor qilindi')}
                    className="p-2 text-xs font-semibold rounded-xl bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 transition-colors disabled:opacity-50"
                  >
                    Bekor qilish
                  </button>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
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
