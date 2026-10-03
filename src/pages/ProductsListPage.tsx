import React, { useState } from 'react';
import {
  Boxes,
  Plus,
  Search,
  Filter,
  Eye,
  Edit2,
  Trash2,
  Package,
  AlertTriangle,
  ArrowRight,
  Warehouse as WarehouseIcon,
  Tag
} from 'lucide-react';
import { Product, Warehouse } from '../types';

interface ProductsListPageProps {
  products: Product[];
  warehouses: Warehouse[];
  onNavigateNew: () => void;
  onNavigateDetail: (productId: string) => void;
  onDeleteProduct: (productId: string) => Promise<void>;
}

export const ProductsListPage: React.FC<ProductsListPageProps> = ({
  products,
  warehouses,
  onNavigateNew,
  onNavigateDetail,
  onDeleteProduct,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>('All');
  const [stockStatusFilter, setStockStatusFilter] = useState<'All' | 'in_stock' | 'low_stock' | 'out_of_stock'>('All');

  // Categories list
  const categories = ['All', 'Telefonlar', 'Noutbuklar', 'Aksessuarlar', 'Smart soatlar', 'Maishiy texnika'];

  // Filtering
  const filteredProducts = products.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.brand && p.brand.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (p.model && p.model.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesCategory = selectedCategory === 'All' || p.category === selectedCategory;
    const matchesWarehouse = selectedWarehouseId === 'All' || p.warehouseId === selectedWarehouseId;

    let matchesStock = true;
    if (stockStatusFilter === 'out_of_stock') {
      matchesStock = p.stock === 0;
    } else if (stockStatusFilter === 'low_stock') {
      matchesStock = p.stock > 0 && p.stock <= p.lowStockThreshold;
    } else if (stockStatusFilter === 'in_stock') {
      matchesStock = p.stock > p.lowStockThreshold;
    }

    return matchesSearch && matchesCategory && matchesWarehouse && matchesStock;
  });

  const handleDelete = async (p: Product, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm(`"${p.name}" mahsulotini ro'yxatdan o'chirishni tasdiqlaysizmi?`)) {
      try {
        await onDeleteProduct(p.id);
      } catch (err: any) {
        alert('O\'chirishda xatolik: ' + err.message);
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Mahsulotlar (/products)</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Katalogingizdagi tovarlar, ombor qoldiqlari va narxlar
          </p>
        </div>
        <button
          onClick={onNavigateNew}
          className="flex items-center justify-center gap-1.5 px-4 py-2.5 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-xl shadow-xs transition-all"
        >
          <Plus className="w-4 h-4" />
          Yangi mahsulot qo'shish
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          {/* Search */}
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Nomi, SKU yoki brend..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500 text-xs"
            />
          </div>

          {/* Category Filter */}
          <div>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full p-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500 text-xs font-medium text-slate-700"
            >
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c === 'All' ? 'Barcha kategoriyalar' : c}
                </option>
              ))}
            </select>
          </div>

          {/* Warehouse Filter */}
          <div>
            <select
              value={selectedWarehouseId}
              onChange={(e) => setSelectedWarehouseId(e.target.value)}
              className="w-full p-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500 text-xs font-medium text-slate-700"
            >
              <option value="All">Barcha omborlar</option>
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
          </div>

          {/* Stock Status Filter */}
          <div>
            <select
              value={stockStatusFilter}
              onChange={(e) => setStockStatusFilter(e.target.value as any)}
              className="w-full p-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500 text-xs font-medium text-slate-700"
            >
              <option value="All">Barcha qoldiq holatlari</option>
              <option value="in_stock">Yetarli qoldiq</option>
              <option value="low_stock">Kam qoldi (&lt;= chegara)</option>
              <option value="out_of_stock">Tugagan (0 dona)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Products Table (Section 4 Requirements) */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/60 text-slate-400 uppercase font-semibold">
                <th className="py-3.5 pl-4">Mahsulot</th>
                <th className="py-3.5">SKU</th>
                <th className="py-3.5">Sotish Narxi</th>
                <th className="py-3.5">Ombor</th>
                <th className="py-3.5">Qoldiq</th>
                <th className="py-3.5">Holat</th>
                <th className="py-3.5 pr-4 text-right">Amallar</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredProducts.map((p) => {
                const wh = warehouses.find((w) => w.id === p.warehouseId);
                const isOutOfStock = p.stock === 0;
                const isLowStock = p.stock > 0 && p.stock <= p.lowStockThreshold;

                return (
                  <tr
                    key={p.id}
                    onClick={() => onNavigateDetail(p.id)}
                    className="hover:bg-slate-50/80 cursor-pointer transition-colors group"
                  >
                    <td className="py-3.5 pl-4">
                      <div className="flex items-center gap-3">
                        <img
                          src={
                            p.imageUrl ||
                            p.photos?.[0] ||
                            'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&w=100&q=80'
                          }
                          alt={p.name}
                          className="w-10 h-10 object-cover rounded-xl border border-slate-200 shrink-0"
                        />
                        <div>
                          <div className="font-bold text-slate-900 text-sm group-hover:text-sky-600 transition-colors">
                            {p.name}
                          </div>
                          <div className="text-[11px] text-slate-400">
                            {p.brand ? `${p.brand} • ` : ''}
                            {p.category}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 font-mono text-slate-700 font-semibold">{p.sku}</td>
                    <td className="py-3.5 font-bold text-slate-900">
                      {p.price.toLocaleString()} so'm
                    </td>
                    <td className="py-3.5 text-slate-600 font-medium">
                      {wh ? wh.name : 'Asosiy'}
                    </td>
                    <td className="py-3.5">
                      <span className="font-bold text-slate-900 font-mono text-sm">{p.stock}</span>{' '}
                      <span className="text-slate-400 text-[11px]">dona</span>
                    </td>
                    <td className="py-3.5">
                      {isOutOfStock ? (
                        <span className="inline-flex px-2 py-0.5 text-[11px] font-bold bg-rose-50 text-rose-700 rounded-full">
                          Tugagan
                        </span>
                      ) : isLowStock ? (
                        <span className="inline-flex px-2 py-0.5 text-[11px] font-bold bg-amber-50 text-amber-700 rounded-full">
                          Kam qoldi
                        </span>
                      ) : (
                        <span className="inline-flex px-2 py-0.5 text-[11px] font-bold bg-emerald-50 text-emerald-700 rounded-full">
                          Mavjud
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 pr-4 text-right">
                      <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => onNavigateDetail(p.id)}
                          className="px-2.5 py-1 text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg font-medium transition-all"
                        >
                          Ko'rish
                        </button>
                        <button
                          onClick={(e) => handleDelete(p, e)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                          title="O'chirish"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {filteredProducts.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400 text-xs">
                    Mahsulotlar topilmadi.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
