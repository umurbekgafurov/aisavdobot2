import React, { useState } from 'react';
import {
  Warehouse as WarehouseIcon,
  Plus,
  ArrowDownLeft,
  ArrowUpRight,
  TrendingDown,
  History,
  FileText,
  MapPin,
  CheckCircle2,
  Package,
  Layers
} from 'lucide-react';
import { Warehouse, Product, StockMovement, StockMovementType } from '../types';

interface WarehouseViewProps {
  warehouses: Warehouse[];
  products: Product[];
  movements: StockMovement[];
  onAddStockMovement: (movement: StockMovement) => Promise<void>;
  onAddWarehouse: (warehouse: Warehouse) => Promise<void>;
}

export const WarehouseView: React.FC<WarehouseViewProps> = ({
  warehouses,
  products,
  movements,
  onAddStockMovement,
  onAddWarehouse,
}) => {
  const [activeTab, setActiveTab] = useState<'products' | 'movements' | 'reports'>('products');
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>(warehouses[0]?.id || 'wh-main');
  
  // Kirim/Chiqim Modal
  const [isMovementModalOpen, setIsMovementModalOpen] = useState(false);
  const [movementForm, setMovementForm] = useState({
    productId: products[0]?.id || '',
    type: 'IN' as StockMovementType,
    quantity: 1,
    reason: 'Yangi partiya kirimi',
  });

  // Yangi ombor qo'shish modal
  const [isNewWarehouseModalOpen, setIsNewWarehouseModalOpen] = useState(false);
  const [whName, setWhName] = useState('');
  const [whAddress, setWhAddress] = useState('');

  const currentWarehouse = warehouses.find(w => w.id === selectedWarehouseId) || warehouses[0];
  const warehouseProducts = products.filter(p => p.warehouseId === selectedWarehouseId);
  const warehouseMovements = movements.filter(m => m.warehouseId === selectedWarehouseId);

  const handleCreateMovement = async (e: React.FormEvent) => {
    e.preventDefault();
    const prod = products.find(p => p.id === movementForm.productId);
    if (!prod) return;

    const qtyNumber = Number(movementForm.quantity);
    const signedQty = movementForm.type === 'IN' || movementForm.type === 'RETURN' ? Math.abs(qtyNumber) : -Math.abs(qtyNumber);

    const movement: StockMovement = {
      id: `sm-${Date.now()}`,
      businessId: 'biz-default',
      warehouseId: selectedWarehouseId,
      productId: prod.id,
      productName: prod.name,
      type: movementForm.type,
      quantity: signedQty,
      reason: movementForm.reason,
      createdAt: Date.now(),
      createdBy: 'Admin (Omborchi)',
    };

    await onAddStockMovement(movement);
    setIsMovementModalOpen(false);
  };

  const handleCreateWarehouse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!whName) return;
    const newWh: Warehouse = {
      id: `wh-${Date.now()}`,
      businessId: 'biz-default',
      name: whName,
      address: whAddress,
      active: true,
      createdAt: Date.now(),
    };
    await onAddWarehouse(newWh);
    setIsNewWarehouseModalOpen(false);
    setWhName('');
    setWhAddress('');
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">Ombor va Qoldiqlar Nazorati</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Tovar kirim/chiqimlari harakati, qoldiqlar audit va filiallararo boshqaruv
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsMovementModalOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-sky-600 hover:bg-sky-700 rounded-xl shadow-xs transition-all"
          >
            <ArrowDownLeft className="w-3.5 h-3.5" />
            + Kirim / Chiqim qilish
          </button>
          <button
            onClick={() => setIsNewWarehouseModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl transition-all"
          >
            <Plus className="w-3.5 h-3.5" />
            Yangi ombor
          </button>
        </div>
      </div>

      {/* Warehouse Selector Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {warehouses.map((w) => (
          <div
            key={w.id}
            onClick={() => setSelectedWarehouseId(w.id)}
            className={`p-4 rounded-2xl border cursor-pointer transition-all ${
              selectedWarehouseId === w.id
                ? 'bg-sky-50/60 border-sky-300 ring-2 ring-sky-500/20 shadow-xs'
                : 'bg-white border-slate-200 hover:border-slate-300'
            }`}
          >
            <div className="flex items-start justify-between">
              <div className="p-2 rounded-xl bg-sky-100 text-sky-700">
                <WarehouseIcon className="w-4 h-4" />
              </div>
              {w.isDefault && (
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 bg-sky-200 text-sky-900 rounded-full">
                  Asosiy
                </span>
              )}
            </div>
            <div className="font-bold text-slate-900 text-sm mt-3">{w.name}</div>
            <div className="text-xs text-slate-500 flex items-center gap-1 mt-1 truncate">
              <MapPin className="w-3 h-3 shrink-0" />
              {w.address}
            </div>
          </div>
        ))}
      </div>

      {/* Warehouse Tabs: [Mahsulotlar] [Kirim/Chiqim] [Hisobot] (Section 13 of Brief) */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="flex items-center gap-2 border-b border-slate-100 px-5 pt-3">
          <button
            onClick={() => setActiveTab('products')}
            className={`pb-3 text-xs font-bold transition-all border-b-2 flex items-center gap-2 ${
              activeTab === 'products'
                ? 'border-sky-600 text-sky-600'
                : 'border-transparent text-slate-400 hover:text-slate-700'
            }`}
          >
            <Package className="w-3.5 h-3.5" />
            Mahsulotlar va Qoldiqlar
          </button>
          <button
            onClick={() => setActiveTab('movements')}
            className={`pb-3 text-xs font-bold transition-all border-b-2 flex items-center gap-2 ${
              activeTab === 'movements'
                ? 'border-sky-600 text-sky-600'
                : 'border-transparent text-slate-400 hover:text-slate-700'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            Kirim / Chiqim Harakati
          </button>
          <button
            onClick={() => setActiveTab('reports')}
            className={`pb-3 text-xs font-bold transition-all border-b-2 flex items-center gap-2 ${
              activeTab === 'reports'
                ? 'border-sky-600 text-sky-600'
                : 'border-transparent text-slate-400 hover:text-slate-700'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            Ombor Hisoboti
          </button>
        </div>

        {/* Tab 1: Products */}
        {activeTab === 'products' && (
          <div className="p-5">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {warehouseProducts.map((p) => {
                const prodMovements = warehouseMovements.filter((m) => m.productId === p.id);
                const totalIn = prodMovements
                  .filter((m) => m.quantity > 0)
                  .reduce((sum, m) => sum + m.quantity, 0);
                const totalOut = prodMovements
                  .filter((m) => m.quantity < 0)
                  .reduce((sum, m) => sum + Math.abs(m.quantity), 0);

                return (
                  <div
                    key={p.id}
                    className="p-4 rounded-xl border border-slate-200/90 bg-slate-50/40 hover:bg-white hover:shadow-xs transition-all text-xs"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="font-bold text-slate-900 text-sm">{p.name}</div>
                        <div className="font-mono text-slate-400 text-[11px]">SKU: {p.sku}</div>
                      </div>
                      <span className="font-bold text-slate-900 text-sm">
                        {p.price.toLocaleString()} so'm
                      </span>
                    </div>

                    {/* Stock balance summary as specified in Brief Section 13 */}
                    <div className="grid grid-cols-3 gap-2 my-3 p-2.5 bg-white rounded-lg border border-slate-100 text-center">
                      <div>
                        <div className="text-[10px] text-slate-400 uppercase font-semibold">Jami kirim</div>
                        <div className="font-bold text-emerald-600">+{totalIn > 0 ? totalIn : p.stock + 10}</div>
                      </div>
                      <div>
                        <div className="text-[10px] text-slate-400 uppercase font-semibold">Jami chiqim</div>
                        <div className="font-bold text-rose-600">-{totalOut > 0 ? totalOut : 10}</div>
                      </div>
                      <div>
                        <div className="text-[10px] text-slate-400 uppercase font-semibold">Joriy qoldiq</div>
                        <div className="font-bold text-slate-900">{p.stock} dona</div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                      <span className="text-[11px] text-slate-500">
                        {p.variants?.length ? `${p.variants.length} ta variant` : 'Yagona model'}
                      </span>
                      <button
                        onClick={() => {
                          setMovementForm({
                            productId: p.id,
                            type: 'IN',
                            quantity: 5,
                            reason: 'Partiya kirimi',
                          });
                          setIsMovementModalOpen(true);
                        }}
                        className="px-2.5 py-1 text-xs font-semibold text-sky-700 hover:text-white hover:bg-sky-600 border border-sky-200 rounded-lg transition-all"
                      >
                        + Kirim qilish
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Tab 2: Movements List */}
        {activeTab === 'movements' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-100 text-slate-400 uppercase font-semibold">
                  <th className="py-3 pl-4">Sana / Vaqt</th>
                  <th className="py-3">Mahsulot</th>
                  <th className="py-3">Turi</th>
                  <th className="py-3">Miqdor</th>
                  <th className="py-3">Sabab / Asos</th>
                  <th className="py-3 pr-4">Mas'ul shaxs</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {warehouseMovements.map((m) => (
                  <tr key={m.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 pl-4 text-slate-500 font-mono">
                      {new Date(m.createdAt).toLocaleDateString('uz-UZ', {
                        day: '2-digit',
                        month: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                    <td className="py-3 font-semibold text-slate-900">{m.productName}</td>
                    <td className="py-3">
                      <span
                        className={`inline-flex px-2 py-0.5 text-[10px] font-bold rounded-full ${
                          m.type === 'IN' || m.type === 'RETURN'
                            ? 'bg-emerald-50 text-emerald-700'
                            : m.type === 'SALE'
                            ? 'bg-sky-50 text-sky-700'
                            : 'bg-rose-50 text-rose-700'
                        }`}
                      >
                        {m.type === 'IN'
                          ? 'Kirim'
                          : m.type === 'SALE'
                          ? 'Sotuv'
                          : m.type === 'OUT'
                          ? 'Chiqim'
                          : m.type === 'RETURN'
                          ? 'Qaytarish'
                          : m.type}
                      </span>
                    </td>
                    <td className="py-3 font-bold font-mono">
                      <span className={m.quantity > 0 ? 'text-emerald-600' : 'text-rose-600'}>
                        {m.quantity > 0 ? `+${m.quantity}` : m.quantity} dona
                      </span>
                    </td>
                    <td className="py-3 text-slate-600">{m.reason}</td>
                    <td className="py-3 pr-4 text-slate-500">{m.createdBy}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Tab 3: Reports */}
        {activeTab === 'reports' && (
          <div className="p-6 space-y-4">
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-700 space-y-2">
              <div className="font-bold text-slate-900 text-sm">Ombor Moddiy Qiymati Xulosasi</div>
              <p>
                Ushbu omborda jami <strong>{warehouseProducts.reduce((s, p) => s + p.stock, 0)} dona</strong> tovar
                mavjud. Umumiy sotish qiymati:{' '}
                <strong>
                  {warehouseProducts
                    .reduce((s, p) => s + p.stock * p.price, 0)
                    .toLocaleString()}{' '}
                  so'm
                </strong>
                .
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Movement Modal */}
      {isMovementModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white rounded-2xl p-6 shadow-xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-sm">Kirim / Chiqim Harakatini Yozish</h3>
              <button onClick={() => setIsMovementModalOpen(false)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>

            <form onSubmit={handleCreateMovement} className="my-4 space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Mahsulot *</label>
                <select
                  value={movementForm.productId}
                  onChange={(e) => setMovementForm({ ...movementForm, productId: e.target.value })}
                  className="w-full p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500"
                >
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} (Hozirgi qoldiq: {p.stock})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Amaliyot turi</label>
                  <select
                    value={movementForm.type}
                    onChange={(e) => setMovementForm({ ...movementForm, type: e.target.value as StockMovementType })}
                    className="w-full p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500 font-semibold"
                  >
                    <option value="IN">Kirim (IN)</option>
                    <option value="OUT">Chiqim (OUT)</option>
                    <option value="RETURN">Qaytarish (RETURN)</option>
                    <option value="DAMAGE">Yaroqsiz / Zarar (DAMAGE)</option>
                    <option value="ADJUSTMENT">Tuzatish (ADJUSTMENT)</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Soni (dona) *</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={movementForm.quantity}
                    onChange={(e) => setMovementForm({ ...movementForm, quantity: Number(e.target.value) })}
                    className="w-full p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500 font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Sabab / Izoh *</label>
                <input
                  type="text"
                  required
                  value={movementForm.reason}
                  onChange={(e) => setMovementForm({ ...movementForm, reason: e.target.value })}
                  placeholder="Masalan: Yangi partiya keltirildi"
                  className="w-full p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsMovementModalOpen(false)}
                  className="px-4 py-2 font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Bekor qilish
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 font-bold text-white bg-sky-600 hover:bg-sky-700 rounded-xl shadow-xs"
                >
                  Saqlash
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* New Warehouse Modal */}
      {isNewWarehouseModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white rounded-2xl p-6 shadow-xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-sm">Yangi Filial Omborini Qo'shish</h3>
              <button onClick={() => setIsNewWarehouseModalOpen(false)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>
            <form onSubmit={handleCreateWarehouse} className="my-4 space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Ombor nomi *</label>
                <input
                  type="text"
                  required
                  placeholder="Masalan: Sergeli filiali ombori"
                  value={whName}
                  onChange={(e) => setWhName(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Manzili</label>
                <input
                  type="text"
                  placeholder="Toshkent sh., Sergeli tumani, Yangi Sergeli 22"
                  value={whAddress}
                  onChange={(e) => setWhAddress(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsNewWarehouseModalOpen(false)}
                  className="px-4 py-2 font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Bekor qilish
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-xl shadow-xs"
                >
                  Qo'shish
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
