import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  ArrowDownLeft,
  ArrowUpRight,
  Package,
  Warehouse as WarehouseIcon,
  Tag,
  History,
  Calendar,
  AlertTriangle,
  Save,
  Trash2,
  CheckCircle2,
  X,
  Loader2,
  AlertCircle
} from 'lucide-react';
import { Product, Warehouse, StockMovement } from '../types';
import { FirestoreService } from '../services/firebaseService';

interface ProductDetailPageProps {
  productId: string;
  businessId: string;
  warehouses: Warehouse[];
  onBack: () => void;
  onUpdateProduct: (product: Product) => Promise<void>;
  onDeleteProduct: (productId: string) => Promise<void>;
}

export const ProductDetailPage: React.FC<ProductDetailPageProps> = ({
  productId,
  businessId,
  warehouses,
  onBack,
  onUpdateProduct,
  onDeleteProduct,
}) => {
  const [product, setProduct] = useState<Product | null>(null);
  const [stockMovements, setStockMovements] = useState<StockMovement[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);

  // Edit form state
  const [editName, setEditName] = useState('');
  const [editPrice, setEditPrice] = useState<number>(0);
  const [editCostPrice, setEditCostPrice] = useState<number>(0);
  const [editThreshold, setEditThreshold] = useState<number>(2);
  const [editWarehouseId, setEditWarehouseId] = useState('');
  const [editDescription, setEditDescription] = useState('');

  // Stock Adjustment Modal state: "Kirim qilish" or "Chiqim qilish"
  const [adjustModalType, setAdjustModalType] = useState<'KIRIM' | 'CHIQIM' | null>(null);
  const [adjustQty, setAdjustQty] = useState<number>(1);
  const [adjustReason, setAdjustReason] = useState<string>('');
  const [adjustLoading, setAdjustLoading] = useState(false);
  const [adjustError, setAdjustError] = useState<string | null>(null);

  // Fetch product and movements
  const reloadData = async () => {
    try {
      const [prod, movs] = await Promise.all([
        FirestoreService.getProduct(businessId, productId),
        FirestoreService.getStockMovements(businessId, productId),
      ]);
      if (prod) {
        setProduct(prod);
        setEditName(prod.name);
        setEditPrice(prod.price);
        setEditCostPrice(prod.costPrice || 0);
        setEditThreshold(prod.lowStockThreshold || 2);
        setEditWarehouseId(prod.warehouseId);
        setEditDescription(prod.description || '');
      }
      setStockMovements(movs);
    } catch (err) {
      console.error('Error loading product details:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    reloadData();
  }, [productId, businessId]);

  if (loading || !product) {
    return (
      <div className="py-24 text-center text-slate-400 text-xs flex flex-col items-center justify-center gap-3">
        <div className="w-8 h-8 border-3 border-sky-500 border-t-transparent rounded-full animate-spin"></div>
        <span>Mahsulot ma'lumotlari yuklanmoqda...</span>
      </div>
    );
  }

  const warehouse = warehouses.find((w) => w.id === product.warehouseId);
  const isOutOfStock = product.stock === 0;
  const isLowStock = product.stock > 0 && product.stock <= product.lowStockThreshold;

  // Handle Edit save
  const handleSaveEdit = async () => {
    const updated: Product = {
      ...product,
      name: editName.trim(),
      price: Number(editPrice),
      costPrice: Number(editCostPrice),
      lowStockThreshold: Number(editThreshold),
      warehouseId: editWarehouseId,
      description: editDescription.trim(),
      updatedAt: Date.now(),
    };

    await onUpdateProduct(updated);
    setProduct(updated);
    setIsEditing(false);
  };

  // Handle Kirim / Chiqim
  const handleConfirmStockAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (adjustQty <= 0) {
      setAdjustError('Miqdor 0 dan katta bo\'lishi kerak');
      return;
    }

    if (adjustModalType === 'CHIQIM' && adjustQty > product.stock) {
      setAdjustError(`Omborda yetarli qoldiq mavjud emas! Hozirgi qoldiq: ${product.stock} dona.`);
      return;
    }

    setAdjustLoading(true);
    setAdjustError(null);

    const delta = adjustModalType === 'KIRIM' ? adjustQty : -adjustQty;
    const movementType = adjustModalType === 'KIRIM' ? 'STOCK_IN' : 'STOCK_OUT';

    try {
      await FirestoreService.addStockMovement(businessId, {
        warehouseId: product.warehouseId,
        productId: product.id,
        productName: product.name,
        type: movementType,
        quantity: delta,
        reason: adjustReason.trim() || (adjustModalType === 'KIRIM' ? 'Qo\'shimcha kirim' : 'Chiqim / Kamayish'),
        createdBy: 'Admin',
      });

      setAdjustModalType(null);
      setAdjustQty(1);
      setAdjustReason('');
      await reloadData();
    } catch (err: any) {
      console.error('Stock adjustment error:', err);
      setAdjustError(err.message || 'Xatolik yuz berdi');
    } finally {
      setAdjustLoading(false);
    }
  };

  const handleDelete = async () => {
    if (window.confirm(`"${product.name}" mahsulotini o'chirishni xohlaysizmi?`)) {
      await onDeleteProduct(product.id);
      onBack();
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 text-slate-500 hover:text-slate-900 rounded-xl hover:bg-slate-100 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">{product.name}</h1>
              {isOutOfStock ? (
                <span className="px-2 py-0.5 text-[10px] font-bold bg-rose-100 text-rose-800 rounded-full">
                  Tugagan
                </span>
              ) : isLowStock ? (
                <span className="px-2 py-0.5 text-[10px] font-bold bg-amber-100 text-amber-800 rounded-full">
                  Kam qoldi
                </span>
              ) : (
                <span className="px-2 py-0.5 text-[10px] font-bold bg-emerald-100 text-emerald-800 rounded-full">
                  Mavjud
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-0.5 font-mono">SKU: {product.sku}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Kirim qilish button (Section 9 Requirement) */}
          <button
            onClick={() => {
              setAdjustModalType('KIRIM');
              setAdjustQty(1);
              setAdjustReason('Qo\'shimcha kirim');
              setAdjustError(null);
            }}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-xs transition-all"
          >
            <ArrowDownLeft className="w-4 h-4" />
            + Kirim qilish
          </button>

          {/* Chiqim qilish button (Section 10 Requirement) */}
          <button
            onClick={() => {
              setAdjustModalType('CHIQIM');
              setAdjustQty(1);
              setAdjustReason('Tovar chiqimi / kamayish');
              setAdjustError(null);
            }}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-xs transition-all"
          >
            <ArrowUpRight className="w-4 h-4" />
            - Chiqim qilish
          </button>

          <button
            onClick={() => setIsEditing(!isEditing)}
            className="px-3 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl transition-all"
          >
            {isEditing ? 'Yopish' : 'Tahrirlash'}
          </button>

          <button
            onClick={handleDelete}
            className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all"
            title="O'chirish"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Info Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-xs">
          <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider block">
            Joriy Qoldiq (Current stock)
          </span>
          <div className="text-2xl font-extrabold text-slate-900 mt-1">
            {product.stock}{' '}
            <span className="text-xs font-medium text-slate-500">dona</span>
          </div>
          <span className="text-[11px] text-slate-400 mt-1 block">
            Chegara: {product.lowStockThreshold} dona
          </span>
        </div>

        <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-xs">
          <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider block">
            Sotish Narxi (Selling price)
          </span>
          <div className="text-2xl font-extrabold text-slate-900 mt-1">
            {product.price.toLocaleString()}{' '}
            <span className="text-xs font-medium text-slate-500">so'm</span>
          </div>
          <span className="text-[11px] text-slate-400 mt-1 block">
            Tannarxi: {product.costPrice ? `${product.costPrice.toLocaleString()} so'm` : '-'}
          </span>
        </div>

        <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-xs">
          <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider block">
            Ombor (Warehouse)
          </span>
          <div className="text-base font-bold text-slate-900 mt-1.5 truncate">
            {warehouse ? warehouse.name : 'Asosiy ombor'}
          </div>
          <span className="text-[11px] text-slate-400 mt-0.5 block truncate">
            {warehouse?.address || 'Toshkent sh.'}
          </span>
        </div>

        <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-xs">
          <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider block">
            Kategoriya va Brend
          </span>
          <div className="text-base font-bold text-slate-900 mt-1.5 truncate">
            {product.category}
          </div>
          <span className="text-[11px] text-slate-400 mt-0.5 block">
            {product.brand || 'Brendsiz'} {product.model ? `• ${product.model}` : ''}
          </span>
        </div>
      </div>

      {/* Edit Form Drawer / Card */}
      {isEditing && (
        <div className="bg-white p-6 rounded-2xl border border-slate-300 shadow-sm space-y-4 text-xs animate-in fade-in duration-150">
          <h3 className="font-bold text-slate-900 text-sm">Mahsulot ma'lumotlarini tahrirlash</h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Nomi</label>
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-slate-200 font-medium"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Ombor</label>
              <select
                value={editWarehouseId}
                onChange={(e) => setEditWarehouseId(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-slate-200 font-medium"
              >
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>{w.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Sotish narxi (so'm)</label>
              <input
                type="number"
                value={editPrice}
                onChange={(e) => setEditPrice(Number(e.target.value))}
                className="w-full p-2.5 rounded-xl border border-slate-200 font-bold"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Tannarx (so'm)</label>
              <input
                type="number"
                value={editCostPrice}
                onChange={(e) => setEditCostPrice(Number(e.target.value))}
                className="w-full p-2.5 rounded-xl border border-slate-200 font-medium"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Kam qoldiq chegarasi</label>
              <input
                type="number"
                value={editThreshold}
                onChange={(e) => setEditThreshold(Number(e.target.value))}
                className="w-full p-2.5 rounded-xl border border-slate-200 font-medium"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Tavsif</label>
              <input
                type="text"
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-slate-200 font-medium"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              onClick={() => setIsEditing(false)}
              className="px-4 py-2 font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
            >
              Bekor qilish
            </button>
            <button
              onClick={handleSaveEdit}
              className="px-5 py-2 font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-xl shadow-xs"
            >
              Saqlash
            </button>
          </div>
        </div>
      )}

      {/* Stock History (Section 8 Requirement) */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-sky-600" />
            <h3 className="font-bold text-slate-900 text-sm">Ombor Harakati Tarixi (Stock History)</h3>
          </div>
          <span className="text-xs text-slate-500 font-medium">{stockMovements.length} ta operatsiya</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/60 text-slate-400 uppercase font-semibold">
                <th className="py-3 pl-5">Vaqt / Sana</th>
                <th className="py-3">Harakat Turi</th>
                <th className="py-3">Miqdor</th>
                <th className="py-3">Sabab / Izoh</th>
                <th className="py-3 pr-5">Mas'ul</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {stockMovements.map((mov) => {
                const isPositive = mov.quantity > 0;
                return (
                  <tr key={mov.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3 pl-5 font-mono text-slate-500">
                      {new Date(mov.createdAt).toLocaleString('uz-UZ', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                    <td className="py-3">
                      <span
                        className={`inline-flex px-2 py-0.5 text-[10px] font-bold rounded-full ${
                          mov.type === 'STOCK_IN' || mov.type === 'IN' || mov.type === 'RETURN'
                            ? 'bg-emerald-50 text-emerald-700'
                            : mov.type === 'SALE'
                            ? 'bg-sky-50 text-sky-700'
                            : 'bg-rose-50 text-rose-700'
                        }`}
                      >
                        {mov.type}
                      </span>
                    </td>
                    <td className="py-3 font-mono font-bold">
                      <span className={isPositive ? 'text-emerald-600' : 'text-rose-600'}>
                        {isPositive ? `+${mov.quantity}` : mov.quantity} dona
                      </span>
                    </td>
                    <td className="py-3 text-slate-700 font-medium">{mov.reason}</td>
                    <td className="py-3 pr-5 text-slate-500">{mov.createdBy || 'Admin'}</td>
                  </tr>
                );
              })}

              {stockMovements.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-400 text-xs">
                    Hozircha ombor harakatlari qayd etilmagan.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Kirim / Chiqim Modal (Section 9 & 10 Requirements) */}
      {adjustModalType && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white rounded-2xl p-6 shadow-xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                {adjustModalType === 'KIRIM' ? (
                  <>
                    <ArrowDownLeft className="w-4 h-4 text-emerald-600" />
                    Omborga Kirim Qilish
                  </>
                ) : (
                  <>
                    <ArrowUpRight className="w-4 h-4 text-rose-600" />
                    Ombordan Chiqim Qilish
                  </>
                )}
              </h3>
              <button
                onClick={() => setAdjustModalType(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {adjustError && (
              <div className="my-3 p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{adjustError}</span>
              </div>
            )}

            <form onSubmit={handleConfirmStockAdjustment} className="my-4 space-y-3.5 text-xs">
              <div className="p-3 bg-slate-50 rounded-xl">
                <span className="text-slate-500 block">Mahsulot:</span>
                <span className="font-bold text-slate-900">{product.name}</span>
                <span className="text-slate-400 block text-[11px] mt-0.5">
                  Hozirgi qoldiq: <strong>{product.stock} dona</strong>
                </span>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Miqdor (dona) *
                </label>
                <input
                  type="number"
                  min="1"
                  required
                  value={adjustQty}
                  onChange={(e) => setAdjustQty(Number(e.target.value))}
                  className="w-full p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500 font-bold text-sm"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Sabab / Izoh *
                </label>
                <input
                  type="text"
                  required
                  placeholder={
                    adjustModalType === 'KIRIM'
                      ? 'Masalan: Yangi partiya yetkazib berildi'
                      : 'Masalan: Nuqsonli tovar / Yaroqsiz'
                  }
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500 font-medium"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setAdjustModalType(null)}
                  className="px-4 py-2 font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Bekor qilish
                </button>
                <button
                  type="submit"
                  disabled={adjustLoading}
                  className={`px-5 py-2 font-bold text-white rounded-xl shadow-xs transition-all flex items-center gap-2 ${
                    adjustModalType === 'KIRIM'
                      ? 'bg-emerald-600 hover:bg-emerald-700'
                      : 'bg-rose-600 hover:bg-rose-700'
                  }`}
                >
                  {adjustLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Bajarilmoqda...
                    </>
                  ) : adjustModalType === 'KIRIM' ? (
                    'Kirimni tasdiqlash'
                  ) : (
                    'Chiqimni tasdiqlash'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
