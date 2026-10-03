import React, { useState } from 'react';
import {
  ArrowLeft,
  Boxes,
  Save,
  Image as ImageIcon,
  Warehouse as WarehouseIcon,
  AlertCircle,
  Loader2
} from 'lucide-react';
import { Product, Warehouse } from '../types';

interface ProductNewPageProps {
  warehouses: Warehouse[];
  onBack: () => void;
  onSubmit: (product: Product) => Promise<void>;
}

export const ProductNewPage: React.FC<ProductNewPageProps> = ({
  warehouses,
  onBack,
  onSubmit,
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form Fields as specified in Section 5 of Brief:
  // Product name, SKU, Category, Brand, Model, Description, Selling price, Cost price, Initial stock, Low stock threshold, Warehouse
  const [name, setName] = useState('');
  const [sku, setSku] = useState(`SKU-${Date.now().toString().slice(-6)}`);
  const [category, setCategory] = useState('Telefonlar');
  const [brand, setBrand] = useState('');
  const [model, setModel] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState<number | ''>('');
  const [costPrice, setCostPrice] = useState<number | ''>('');
  const [stock, setStock] = useState<number | ''>(1);
  const [lowStockThreshold, setLowStockThreshold] = useState<number | ''>(2);
  const [warehouseId, setWarehouseId] = useState(warehouses[0]?.id || 'wh_default');
  const [imageUrl, setImageUrl] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Mahsulot nomini kiriting.');
      return;
    }
    if (price === '' || Number(price) <= 0) {
      setError('Sotish narxini to\'g\'ri kiriting.');
      return;
    }
    if (!warehouseId) {
      setError('Omborni tanlang.');
      return;
    }

    setLoading(true);
    setError(null);

    const now = Date.now();
    const newProd: Product = {
      id: `prod_${now}_${Math.random().toString(36).slice(2, 6)}`,
      businessId: '', // populated in service
      warehouseId,
      name: name.trim(),
      sku: sku.trim() || `SKU-${Date.now().toString().slice(-6)}`,
      category: category.trim(),
      brand: brand.trim(),
      model: model.trim(),
      description: description.trim(),
      price: Number(price),
      costPrice: Number(costPrice || 0),
      stock: Number(stock || 0),
      lowStockThreshold: Number(lowStockThreshold || 2),
      imageUrl: imageUrl.trim() || undefined,
      active: true,
      createdAt: now,
      updatedAt: now,
    };

    try {
      await onSubmit(newProd);
      onBack();
    } catch (err: any) {
      console.error('Error creating product:', err);
      setError(err.message || 'Xatolik yuz berdi');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Top Bar */}
      <div className="flex items-center justify-between bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 text-slate-500 hover:text-slate-900 rounded-xl hover:bg-slate-100 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">Yangi Mahsulot Qo'shish</h1>
            <p className="text-xs text-slate-500">(/products/new)</p>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Product Form */}
      <form onSubmit={handleSubmit} className="bg-white rounded-2xl p-6 sm:p-8 border border-slate-200/80 shadow-xs space-y-5 text-xs">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label className="block font-semibold text-slate-700 mb-1">Mahsulot nomi (Product name) *</label>
            <input
              type="text"
              required
              placeholder="Masalan: Samsung Galaxy S25 Ultra"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500 font-medium text-slate-900"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">SKU kodi *</label>
            <input
              type="text"
              required
              value={sku}
              onChange={(e) => setSku(e.target.value)}
              className="w-full p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500 font-mono font-medium"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Kategoriya</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500 font-medium text-slate-700"
            >
              <option value="Telefonlar">Telefonlar</option>
              <option value="Noutbuklar">Noutbuklar</option>
              <option value="Aksessuarlar">Aksessuarlar</option>
              <option value="Smart soatlar">Smart soatlar</option>
              <option value="Maishiy texnika">Maishiy texnika</option>
              <option value="Boshqa">Boshqa</option>
            </select>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Brend (Brand)</label>
            <input
              type="text"
              placeholder="Samsung, Apple, Xiaomi..."
              value={brand}
              onChange={(e) => setBrand(e.target.value)}
              className="w-full p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500 font-medium"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Model</label>
            <input
              type="text"
              placeholder="Galaxy S25 Ultra, 15 Pro..."
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="w-full p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500 font-medium"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Sotish narxi (Selling price) *</label>
            <input
              type="number"
              required
              min="0"
              placeholder="so'm"
              value={price}
              onChange={(e) => setPrice(e.target.value === '' ? '' : Number(e.target.value))}
              className="w-full p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500 font-bold text-slate-900"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Tannarxi (Cost price)</label>
            <input
              type="number"
              min="0"
              placeholder="so'm"
              value={costPrice}
              onChange={(e) => setCostPrice(e.target.value === '' ? '' : Number(e.target.value))}
              className="w-full p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500 font-medium"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Boshlang'ich qoldiq (Initial stock) *</label>
            <input
              type="number"
              required
              min="0"
              placeholder="dona"
              value={stock}
              onChange={(e) => setStock(e.target.value === '' ? '' : Number(e.target.value))}
              className="w-full p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500 font-bold"
            />
            <span className="text-[10px] text-slate-400 mt-0.5 block">
              Agar 0 dan katta bo'lsa, avtomatik STOCK_IN yozuvi shakllantiriladi.
            </span>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Kam qoldiq chegarasi (Low stock threshold)</label>
            <input
              type="number"
              min="0"
              value={lowStockThreshold}
              onChange={(e) => setLowStockThreshold(e.target.value === '' ? '' : Number(e.target.value))}
              className="w-full p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500 font-medium"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="block font-semibold text-slate-700 mb-1">Ombor (Warehouse) *</label>
            <select
              value={warehouseId}
              onChange={(e) => setWarehouseId(e.target.value)}
              className="w-full p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500 font-medium text-slate-700"
            >
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name} {w.address ? `(${w.address})` : ''}
                </option>
              ))}
            </select>
          </div>

          <div className="sm:col-span-2">
            <label className="block font-semibold text-slate-700 mb-1">Rasm havolasi (Image URL)</label>
            <input
              type="url"
              placeholder="https://images.unsplash.com/..."
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              className="w-full p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500 font-medium"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="block font-semibold text-slate-700 mb-1">Tavsif (Description)</label>
            <textarea
              rows={3}
              placeholder="Mahsulot haqida qo'shimcha ma'lumotlar..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500 font-medium"
            />
          </div>
        </div>

        {/* Action Buttons as specified: [Saqlash] [Bekor qilish] */}
        <div className="flex items-center justify-end gap-3 pt-5 border-t border-slate-100">
          <button
            type="button"
            onClick={onBack}
            className="px-5 py-2.5 font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
          >
            Bekor qilish
          </button>
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-2.5 font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-xl shadow-xs transition-all flex items-center gap-2 disabled:opacity-50"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Saqlanmoqda...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                Saqlash
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};
