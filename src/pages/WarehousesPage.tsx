import React, { useState } from 'react';
import {
  Warehouse as WarehouseIcon,
  Plus,
  MapPin,
  Edit2,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Package,
  Layers,
  Calendar,
  X
} from 'lucide-react';
import { Warehouse, Product } from '../types';

interface WarehousesPageProps {
  warehouses: Warehouse[];
  products: Product[];
  onCreateWarehouse: (data: { name: string; address: string }) => Promise<void>;
  onUpdateWarehouse: (warehouse: Warehouse) => Promise<void>;
  onDeleteWarehouse: (warehouseId: string) => Promise<void>;
}

export const WarehousesPage: React.FC<WarehousesPageProps> = ({
  warehouses,
  products,
  onCreateWarehouse,
  onUpdateWarehouse,
  onDeleteWarehouse,
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingWarehouse, setEditingWarehouse] = useState<Warehouse | null>(null);
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const openCreateModal = () => {
    setEditingWarehouse(null);
    setName('');
    setAddress('');
    setError(null);
    setIsModalOpen(true);
  };

  const openEditModal = (wh: Warehouse) => {
    setEditingWarehouse(wh);
    setName(wh.name);
    setAddress(wh.address || '');
    setError(null);
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Ombor nomini kiriting.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      if (editingWarehouse) {
        await onUpdateWarehouse({
          ...editingWarehouse,
          name: name.trim(),
          address: address.trim(),
          updatedAt: Date.now(),
        });
      } else {
        await onCreateWarehouse({
          name: name.trim(),
          address: address.trim(),
        });
      }
      setIsModalOpen(false);
    } catch (err: any) {
      console.error('Error saving warehouse:', err);
      setError(err.message || 'Xatolik yuz berdi');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (wh: Warehouse) => {
    const prodsInWh = products.filter((p) => p.warehouseId === wh.id);
    if (prodsInWh.length > 0) {
      if (
        !window.confirm(
          `Ushbu omborda ${prodsInWh.length} ta mahsulot biriktirilgan. Haqiqatan ham o'chirmoqchimisiz?`
        )
      ) {
        return;
      }
    } else {
      if (!window.confirm(`"${wh.name}" omborini o'chirmoqchimisiz?`)) {
        return;
      }
    }

    try {
      await onDeleteWarehouse(wh.id);
    } catch (err: any) {
      alert('Omborni o\'chirishda xatolik: ' + err.message);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Omborlar (/warehouses)</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Do'koningizning filiallari va moddiy omborlarini boshqarish
          </p>
        </div>
        <button
          onClick={openCreateModal}
          className="flex items-center justify-center gap-1.5 px-4 py-2.5 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-xl shadow-xs transition-all"
        >
          <Plus className="w-4 h-4" />
          Yangi ombor qo'shish
        </button>
      </div>

      {/* Warehouses Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {warehouses.map((wh) => {
          const prods = products.filter((p) => p.warehouseId === wh.id);
          const totalStock = prods.reduce((sum, p) => sum + (p.stock || 0), 0);

          return (
            <div
              key={wh.id}
              className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs hover:border-slate-300 transition-all flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between mb-3">
                  <div className="w-10 h-10 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center font-bold">
                    <WarehouseIcon className="w-5 h-5" />
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => openEditModal(wh)}
                      className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-all"
                      title="Tahrirlash"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(wh)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                      title="O'chirish"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <h3 className="font-bold text-slate-900 text-base">{wh.name}</h3>
                <div className="flex items-start gap-1.5 text-xs text-slate-500 mt-1">
                  <MapPin className="w-3.5 h-3.5 shrink-0 text-slate-400 mt-0.5" />
                  <span className="leading-tight">{wh.address || 'Manzil kiritilmagan'}</span>
                </div>
              </div>

              <div className="mt-5 pt-4 border-t border-slate-100 grid grid-cols-2 gap-2 text-xs">
                <div className="p-2.5 bg-slate-50 rounded-xl">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold block">Mahsulot turlari</span>
                  <span className="font-bold text-slate-800 text-sm">{prods.length} ta</span>
                </div>
                <div className="p-2.5 bg-sky-50/60 rounded-xl">
                  <span className="text-[10px] text-sky-600 uppercase font-semibold block">Jami qoldiq</span>
                  <span className="font-bold text-sky-900 text-sm">{totalStock} dona</span>
                </div>
              </div>
            </div>
          );
        })}

        {warehouses.length === 0 && (
          <div className="col-span-full py-16 text-center bg-white rounded-2xl border border-slate-200 p-8">
            <WarehouseIcon className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <h3 className="font-bold text-slate-800 text-sm">Hozircha omborlar yo'q</h3>
            <p className="text-xs text-slate-500 mt-1">
              Tovarlarni joylashtirish uchun birinchi omboringizni yarating.
            </p>
            <button
              onClick={openCreateModal}
              className="mt-4 px-4 py-2 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-xl"
            >
              + Ombor yaratish
            </button>
          </div>
        )}
      </div>

      {/* Create / Edit Warehouse Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white rounded-2xl p-6 shadow-xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-sm">
                {editingWarehouse ? 'Omborni tahrirlash' : 'Yangi ombor qo\'shish'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {error && (
              <div className="my-3 p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="my-4 space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Ombor nomi *</label>
                <input
                  type="text"
                  required
                  placeholder="Masalan: Chilonzor filial ombori"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500 font-medium"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Manzili</label>
                <input
                  type="text"
                  placeholder="Masalan: Toshkent sh., Chilonzor 9-mavze"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500 font-medium"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Bekor qilish
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-5 py-2 font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-xl shadow-xs transition-all disabled:opacity-50"
                >
                  {loading ? 'Saqlanmoqda...' : 'Saqlash'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
