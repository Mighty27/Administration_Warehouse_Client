import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeftRight,
  CheckCircle2,
  Edit3,
  Plus,
  Search,
  Trash2,
  X,
  XCircle,
} from 'lucide-react';
import { useWarehouse } from '../context/WarehouseContext';
import { StockStatus, WarehouseItem } from '../types/warehouse';
import {
  filterInventoryItems,
  getStockStatus,
  getStockStatusLabel,
} from '../utils/warehouseRules';

const DEFAULT_CATEGORIES = [
  'Perangkat Otomasi',
  'Material Packaging',
  'Material Handling',
  'APD & K3',
  'Suku Cadang',
  'Bahan Baku',
];

const DEFAULT_UNITS = ['Pcs', 'Unit', 'Roll', 'Box', 'Pasang', 'Pail', 'Lembar', 'Set'];

export const Inventory: React.FC = () => {
  const { user, items, saveItem, deleteItem } = useWarehouse();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | StockStatus>('ALL');

  // State Modal Tambah / Edit Barang
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<WarehouseItem | null>(null);
  const [sku, setSku] = useState('');
  const [name, setName] = useState('');
  const [category, setCategory] = useState(DEFAULT_CATEGORIES[0]);
  const [rackLocation, setRackLocation] = useState('');
  const [stock, setStock] = useState<string>('0');
  const [minStock, setMinStock] = useState<string>('10');
  const [unit, setUnit] = useState('Pcs');
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Sinkronisasi filter dari query string (?status=MENIPIS)
  useEffect(() => {
    const paramStatus = searchParams.get('status');
    if (
      paramStatus === 'AMAN' ||
      paramStatus === 'MENIPIS' ||
      paramStatus === 'HABIS'
    ) {
      setStatusFilter(paramStatus);
    }
  }, [searchParams]);

  if (!user) return null;

  const filteredItems = filterInventoryItems(
    items,
    user.id,
    searchQuery,
    statusFilter
  );

  const countAll = items.length;
  const countAman = items.filter(
    (i) => getStockStatus(i.stock, i.min_stock) === 'AMAN'
  ).length;
  const countMenipis = items.filter(
    (i) => getStockStatus(i.stock, i.min_stock) === 'MENIPIS'
  ).length;
  const countHabis = items.filter(
    (i) => getStockStatus(i.stock, i.min_stock) === 'HABIS'
  ).length;

  const openAddModal = () => {
    setEditingItem(null);
    setSku(`WH-SKU-${Math.floor(1000 + Math.random() * 9000)}`);
    setName('');
    setCategory(DEFAULT_CATEGORIES[0]);
    setRackLocation('RAK-A01-01');
    setStock('25');
    setMinStock('10');
    setUnit('Pcs');
    setFormError(null);
    setIsModalOpen(true);
  };

  const openEditModal = (item: WarehouseItem) => {
    setEditingItem(item);
    setSku(item.sku);
    setName(item.name);
    setCategory(item.category);
    setRackLocation(item.rack_location);
    setStock(String(item.stock));
    setMinStock(String(item.min_stock));
    setUnit(item.unit);
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleSaveItem = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const parsedStock = Number(stock);
    const parsedMinStock = Number(minStock);

    if (Number.isNaN(parsedStock) || parsedStock < 0) {
      setFormError('Stok saat ini harus berupa angka >= 0.');
      return;
    }
    if (Number.isNaN(parsedMinStock) || parsedMinStock < 0) {
      setFormError('Batas minimum stok harus berupa angka >= 0.');
      return;
    }

    setSaving(true);
    const res = await saveItem({
      id: editingItem?.id,
      sku,
      name,
      category,
      rack_location: rackLocation,
      stock: Math.floor(parsedStock),
      min_stock: Math.floor(parsedMinStock),
      unit,
    });
    setSaving(false);

    if (!res.ok) {
      setFormError(res.error || 'Gagal menyimpan barang.');
      return;
    }

    setIsModalOpen(false);
  };

  const handleFilterChange = (nextStatus: 'ALL' | StockStatus) => {
    setStatusFilter(nextStatus);
    if (nextStatus === 'ALL') {
      searchParams.delete('status');
    } else {
      searchParams.set('status', nextStatus);
    }
    setSearchParams(searchParams, { replace: true });
  };

  const renderStatusIndicator = (itemStock: number, itemMinStock: number) => {
    const status = getStockStatus(itemStock, itemMinStock);
    if (status === 'AMAN') {
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 whitespace-nowrap">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
          <span>{getStockStatusLabel(status)}</span>
        </span>
      );
    }
    if (status === 'MENIPIS') {
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-700 whitespace-nowrap">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
          <span>{getStockStatusLabel(status)}</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-rose-700 whitespace-nowrap">
        <XCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
        <span>{getStockStatusLabel(status)}</span>
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header & Tombol Tambah Barang */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">
            Master Inventaris (Stok Barang)
          </h2>
          <p className="text-sm text-slate-600 mt-0.5">
            Kelola katalog SKU, lokasi rak, dan batas minimum peringatan stok gudang Anda
          </p>
        </div>

        <button
          type="button"
          onClick={openAddModal}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Tambah Barang Baru</span>
        </button>
      </div>

      {/* Bar Pencarian Real-Time & Segmented Filter Status Stok */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="search"
            aria-label="Cari SKU, nama barang, kategori, atau lokasi rak"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari kode SKU, nama barang, kategori, atau nomor rak..."
            className="w-full pl-10 pr-4 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-600"
          />
        </div>

        {/* Interactive Segmented Filter Controls */}
        <div
          role="group"
          aria-label="Filter status stok"
          className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg overflow-x-auto"
        >
          <button
            type="button"
            onClick={() => handleFilterChange('ALL')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              statusFilter === 'ALL'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Semua ({countAll})
          </button>
          <button
            type="button"
            onClick={() => handleFilterChange('AMAN')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              statusFilter === 'AMAN'
                ? 'bg-white text-emerald-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Aman ({countAman})
          </button>
          <button
            type="button"
            onClick={() => handleFilterChange('MENIPIS')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              statusFilter === 'MENIPIS'
                ? 'bg-white text-amber-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Menipis ({countMenipis})
          </button>
          <button
            type="button"
            onClick={() => handleFilterChange('HABIS')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              statusFilter === 'HABIS'
                ? 'bg-white text-rose-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Habis ({countHabis})
          </button>
        </div>
      </div>

      {/* Empty State */}
      {filteredItems.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-10 text-center">
          <p className="text-sm font-semibold text-slate-900">
            Tidak Ada Barang yang Ditemukan
          </p>
          <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
            {items.length === 0
              ? 'Inventaris akun gudang Anda masih kosong. Tambahkan SKU barang pertama untuk memulai pencatatan stok.'
              : 'Tidak ada SKU yang cocok dengan kata kunci pencarian atau filter status stok yang dipilih.'}
          </p>
          <div className="mt-4 flex items-center justify-center gap-3">
            {items.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  handleFilterChange('ALL');
                }}
                className="px-3.5 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
              >
                Reset Filter
              </button>
            )}
            <button
              type="button"
              onClick={openAddModal}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Tambah Barang Baru</span>
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* TAMPILAN DESKTOP: Tabel High-Density (hidden md:block) */}
          <div className="hidden md:block bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/80 text-[11px] font-semibold text-slate-500">
                    <th className="py-3 px-4">Kode SKU</th>
                    <th className="py-3 px-4">Nama Barang</th>
                    <th className="py-3 px-4">Kategori</th>
                    <th className="py-3 px-4">Lokasi Rak</th>
                    <th className="py-3 px-4 text-right">Stok Saat Ini</th>
                    <th className="py-3 px-4">Satuan</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Tindakan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-sm">
                  {filteredItems.map((item) => (
                    <tr
                      key={item.id}
                      className="hover:bg-slate-50/80 transition-colors"
                    >
                      <td className="py-3 px-4 font-mono text-xs font-semibold text-slate-900 whitespace-nowrap">
                        {item.sku}
                      </td>
                      <td className="py-3 px-4 font-medium text-slate-900">
                        <div>{item.name}</div>
                        <div className="text-xs text-slate-500 font-mono">
                          Batas Min: {item.min_stock} {item.unit}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-600 whitespace-nowrap">
                        {item.category}
                      </td>
                      <td className="py-3 px-4 font-mono text-xs text-slate-700 whitespace-nowrap">
                        {item.rack_location}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-slate-900 tabular-nums whitespace-nowrap">
                        {item.stock.toLocaleString('id-ID')}
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-600 whitespace-nowrap">
                        {item.unit}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        {renderStatusIndicator(item.stock, item.min_stock)}
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() =>
                              navigate(`/transactions?item=${item.id}`)
                            }
                            aria-label={`Mutasi stok ${item.name}`}
                            title="Catat Mutasi Inbound/Outbound"
                            className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                          >
                            <ArrowLeftRight className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => openEditModal(item)}
                            aria-label={`Edit barang ${item.name}`}
                            title="Edit Barang"
                            className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteItem(item.id)}
                            aria-label={`Hapus barang ${item.name}`}
                            title="Hapus Barang"
                            className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* TAMPILAN MOBILE: Card List Responsif (md:hidden) */}
          <div className="md:hidden grid grid-cols-1 gap-3">
            {filteredItems.map((item) => (
              <div
                key={item.id}
                className="bg-white border border-slate-200 rounded-xl p-4 space-y-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 text-xs text-slate-500 font-mono">
                      <span className="font-semibold text-slate-900">
                        {item.sku}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>{item.rack_location}</span>
                    </div>
                    <h3 className="text-sm font-bold text-slate-900 mt-1">
                      {item.name}
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {item.category}
                    </p>
                  </div>
                  {renderStatusIndicator(item.stock, item.min_stock)}
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                  <div className="font-mono tabular-nums">
                    <span className="text-xs text-slate-500">Stok: </span>
                    <span className="text-sm font-bold text-slate-900">
                      {item.stock.toLocaleString('id-ID')} {item.unit}
                    </span>
                    <span className="text-xs text-slate-400 ml-2">
                      (Min: {item.min_stock})
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => navigate(`/transactions?item=${item.id}`)}
                      className="px-2.5 py-1.5 text-xs font-semibold text-indigo-600 bg-indigo-50 rounded-lg"
                    >
                      Mutasi
                    </button>
                    <button
                      type="button"
                      onClick={() => openEditModal(item)}
                      aria-label={`Edit ${item.name} mobile`}
                      className="p-1.5 text-slate-600 bg-slate-100 rounded-lg"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteItem(item.id)}
                      aria-label={`Hapus ${item.name} mobile`}
                      className="p-1.5 text-rose-600 bg-rose-50 rounded-lg"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Modal Form Tambah & Edit Barang */}
      {isModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="inventory-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs"
        >
          <div className="bg-white border border-slate-200 rounded-xl max-w-lg w-full shadow-xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <h3
                id="inventory-modal-title"
                className="text-base font-bold text-slate-900"
              >
                {editingItem ? 'Edit Data Barang Inventaris' : 'Tambah Barang Baru'}
              </h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                aria-label="Tutup modal barang"
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveItem} className="p-6 space-y-4">
              {formError && (
                <div
                  role="alert"
                  className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs font-medium text-rose-700"
                >
                  {formError}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="item-sku"
                    className="block text-xs font-semibold text-slate-700 mb-1"
                  >
                    Kode SKU
                  </label>
                  <input
                    id="item-sku"
                    type="text"
                    required
                    value={sku}
                    onChange={(e) => setSku(e.target.value)}
                    placeholder="WH-SCN-2208"
                    className="w-full px-3 py-2 text-sm font-mono bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-600"
                  />
                </div>

                <div>
                  <label
                    htmlFor="item-rack"
                    className="block text-xs font-semibold text-slate-700 mb-1"
                  >
                    Lokasi Rak Gudang
                  </label>
                  <input
                    id="item-rack"
                    type="text"
                    required
                    value={rackLocation}
                    onChange={(e) => setRackLocation(e.target.value)}
                    placeholder="RAK-A01-02"
                    className="w-full px-3 py-2 text-sm font-mono bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-600"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="item-name"
                  className="block text-xs font-semibold text-slate-700 mb-1"
                >
                  Nama Lengkap Barang
                </label>
                <input
                  id="item-name"
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Contoh: Forklift Hydraulic Hand Pallet 3 Ton"
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-600"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="item-category"
                    className="block text-xs font-semibold text-slate-700 mb-1"
                  >
                    Kategori Barang
                  </label>
                  <select
                    id="item-category"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-600"
                  >
                    {DEFAULT_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="item-unit"
                    className="block text-xs font-semibold text-slate-700 mb-1"
                  >
                    Satuan Hitung
                  </label>
                  <select
                    id="item-unit"
                    value={unit}
                    onChange={(e) => setUnit(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-600"
                  >
                    {DEFAULT_UNITS.map((u) => (
                      <option key={u} value={u}>
                        {u}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="item-stock"
                    className="block text-xs font-semibold text-slate-700 mb-1"
                  >
                    Stok Saat Ini
                  </label>
                  <input
                    id="item-stock"
                    type="number"
                    min={0}
                    required
                    value={stock}
                    onChange={(e) => setStock(e.target.value)}
                    className="w-full px-3 py-2 text-sm font-mono tabular-nums bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-600"
                  />
                </div>

                <div>
                  <label
                    htmlFor="item-min-stock"
                    className="block text-xs font-semibold text-slate-700 mb-1"
                  >
                    Batas Minimum Stok (Threshold)
                  </label>
                  <input
                    id="item-min-stock"
                    type="number"
                    min={0}
                    required
                    value={minStock}
                    onChange={(e) => setMinStock(e.target.value)}
                    className="w-full px-3 py-2 text-sm font-mono tabular-nums bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-600"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-lg transition-colors cursor-pointer"
                >
                  {saving
                    ? 'Menyimpan...'
                    : editingItem
                    ? 'Simpan Perubahan'
                    : 'Simpan Barang'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
