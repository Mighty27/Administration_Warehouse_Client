import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeftRight,
  CalendarClock,
  CheckCircle2,
  Download,
  Edit3,
  Grid,
  List,
  MapPin,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  X,
  XCircle,
} from 'lucide-react';
import { useWarehouse } from '../context/WarehouseContext';
import { StockStatus, WarehouseItem } from '../types/warehouse';
import {
  filterInventoryItems,
  formatRackHierarchyCode,
  generateInventoryCsv,
  getDaysUntilExpiry,
  getFefoStatus,
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
const FLOOR_OPTIONS = ['Lantai 1', 'Lantai 2'];
const AISLE_OPTIONS = ['Baris A', 'Baris B', 'Baris C', 'Baris D'];
const COLUMN_OPTIONS = ['Kolom 01', 'Kolom 02', 'Kolom 03', 'Kolom 04'];
const RACK_OPTIONS = ['Rak 01', 'Rak 02', 'Rak 03', 'Rak 04'];

export const Inventory: React.FC = () => {
  const {
    user,
    items,
    saveItem,
    deleteItem,
    executeReplenishment,
    addToast,
  } = useWarehouse();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const [viewMode, setViewMode] = useState<'TABLE' | 'RACK_MAP'>('TABLE');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | StockStatus>('ALL');
  const [floorFilter, setFloorFilter] = useState<string>('ALL');
  const [fefoOnly, setFefoOnly] = useState<boolean>(false);
  const [selectedMapItem, setSelectedMapItem] = useState<WarehouseItem | null>(null);

  // State Modal Tambah / Edit Barang
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<WarehouseItem | null>(null);
  const [sku, setSku] = useState('');
  const [barcode, setBarcode] = useState('');
  const [name, setName] = useState('');
  const [category, setCategory] = useState(DEFAULT_CATEGORIES[0]);
  const [floorLevel, setFloorLevel] = useState('Lantai 1');
  const [aisleRow, setAisleRow] = useState('Baris A');
  const [columnBay, setColumnBay] = useState('Kolom 01');
  const [rackCode, setRackCode] = useState('Rak 01');
  const [inboundRackLocation, setInboundRackLocation] = useState('INB-STG-A01');
  const [reserveStock, setReserveStock] = useState<string>('20');
  const [stock, setStock] = useState<string>('25');
  const [minStock, setMinStock] = useState<string>('10');
  const [unit, setUnit] = useState('Pcs');
  const [batchNumber, setBatchNumber] = useState('BATCH-2026-11A');
  const [expiryDate, setExpiryDate] = useState<string>('');
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

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
    statusFilter,
    'ALL',
    floorFilter,
    fefoOnly
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

  const handleExportInventoryCsv = () => {
    if (filteredItems.length === 0) {
      addToast(
        'error',
        'Tidak Ada Data',
        'Tidak ada data barang yang cocok dengan filter saat ini untuk diekspor.'
      );
      return;
    }

    const csvContent = generateInventoryCsv(filteredItems);
    const blob = new Blob(['\uFEFF' + csvContent], {
      type: 'text/csv;charset=utf-8;',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const dateStamp = new Date().toISOString().slice(0, 10);
    const statusSuffix =
      statusFilter === 'ALL' ? 'Semua_Status' : getStockStatusLabel(statusFilter);
    link.href = url;
    link.setAttribute(
      'download',
      `Laporan_Inventaris_${statusSuffix}_${dateStamp}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    addToast(
      'success',
      'Laporan Inventaris CSV Berhasil Diunduh',
      `${filteredItems.length} SKU inventaris sesuai tampilan filter diekspor ke CSV.`
    );
  };

  const openAddModal = () => {
    setEditingItem(null);
    const rand = Math.floor(1000 + Math.random() * 9000);
    setSku(`WH-SKU-${rand}`);
    setBarcode(`899701400${rand}`);
    setName('');
    setCategory(DEFAULT_CATEGORIES[0]);
    setFloorLevel('Lantai 1');
    setAisleRow('Baris A');
    setColumnBay('Kolom 01');
    setRackCode('Rak 01');
    setInboundRackLocation('INB-STG-A01');
    setReserveStock('20');
    setStock('25');
    setMinStock('10');
    setUnit('Pcs');
    setBatchNumber('BATCH-2026-11A');
    setExpiryDate('');
    setFormError(null);
    setIsModalOpen(true);
  };

  const openEditModal = (item: WarehouseItem) => {
    setEditingItem(item);
    setSku(item.sku);
    setBarcode(item.barcode || '');
    setName(item.name);
    setCategory(item.category);
    setFloorLevel(item.floor_level || 'Lantai 1');
    setAisleRow(item.aisle_row || 'Baris A');
    setColumnBay(item.column_bay || 'Kolom 01');
    setRackCode(item.rack_code || 'Rak 01');
    setInboundRackLocation(item.inbound_rack_location || 'INB-STG-A01');
    setReserveStock(String(item.reserve_stock ?? 0));
    setStock(String(item.stock));
    setMinStock(String(item.min_stock));
    setUnit(item.unit);
    setBatchNumber(item.batch_number || 'BATCH-2026-11A');
    setExpiryDate(item.expiry_date || '');
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleSaveItem = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const parsedStock = Number(stock);
    const parsedMinStock = Number(minStock);
    const parsedReserve = Number(reserveStock);

    if (Number.isNaN(parsedStock) || parsedStock < 0) {
      setFormError('Stok Rak Picking harus berupa angka >= 0.');
      return;
    }
    if (Number.isNaN(parsedMinStock) || parsedMinStock < 0) {
      setFormError('Batas minimum stok harus berupa angka >= 0.');
      return;
    }

    const computedRackCode = formatRackHierarchyCode(
      floorLevel,
      aisleRow,
      columnBay,
      rackCode
    );

    setSaving(true);
    const res = await saveItem({
      id: editingItem?.id,
      sku,
      barcode,
      name,
      category,
      floor_level: floorLevel,
      aisle_row: aisleRow,
      column_bay: columnBay,
      rack_code: rackCode,
      rack_location: computedRackCode,
      inbound_rack_location: inboundRackLocation,
      reserve_stock: Math.max(0, Math.floor(parsedReserve || 0)),
      stock: Math.floor(parsedStock),
      min_stock: Math.floor(parsedMinStock),
      unit,
      batch_number: batchNumber,
      expiry_date: expiryDate.trim() ? expiryDate.trim() : null,
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
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400 whitespace-nowrap">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span>{getStockStatusLabel(status)}</span>
        </span>
      );
    }
    if (status === 'MENIPIS') {
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-700 dark:text-amber-400 whitespace-nowrap">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
          <span>{getStockStatusLabel(status)}</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-rose-700 dark:text-rose-400 whitespace-nowrap">
        <XCircle className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400 shrink-0" />
        <span>{getStockStatusLabel(status)}</span>
      </span>
    );
  };

  const renderFefoInfo = (item: WarehouseItem) => {
    if (!item.expiry_date) {
      return (
        <span className="text-xs font-mono text-slate-400 dark:text-slate-500">
          {item.batch_number} · Non-FEFO
        </span>
      );
    }
    const days = getDaysUntilExpiry(item.expiry_date);
    const fefo = getFefoStatus(item.expiry_date);
    return (
      <div className="text-xs font-mono">
        <div className="font-semibold text-slate-800 dark:text-slate-200">
          {item.batch_number}
        </div>
        <div
          className={
            fefo === 'EXPIRED'
              ? 'text-rose-600 dark:text-rose-400 font-semibold'
              : fefo === 'NEAR_EXPIRY'
              ? 'text-amber-600 dark:text-amber-400 font-semibold'
              : 'text-emerald-600 dark:text-emerald-400'
          }
        >
          Exp: {item.expiry_date} ({days !== null ? `${days}h` : ''})
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header & Tombol Mode Tampilan + Export CSV + Tambah Barang */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
            Manajemen Lokasi Gudang Hierarkis & Inventaris FEFO
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-0.5">
            Pemetaan lokasi Lantai → Baris → Kolom → Rak, pemisahan Rak Inbound & Rak Picking, serta pelacakan FEFO
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          {/* Switch Mode Tabel vs Peta Denah Rak */}
          <div
            role="group"
            aria-label="Mode tampilan inventaris"
            className="inline-flex items-center p-1 bg-slate-200/70 dark:bg-slate-800 rounded-lg"
          >
            <button
              type="button"
              onClick={() => setViewMode('TABLE')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                viewMode === 'TABLE'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              <List className="w-3.5 h-3.5" />
              <span>Tabel SKU</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('RACK_MAP')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                viewMode === 'RACK_MAP'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              <Grid className="w-3.5 h-3.5" />
              <span>Peta Denah Rak</span>
            </button>
          </div>

          <button
            type="button"
            onClick={handleExportInventoryCsv}
            aria-label="Export CSV inventaris sesuai filter"
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold text-slate-800 dark:text-slate-200 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Download className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            <span>Export CSV ({filteredItems.length})</span>
          </button>

          <button
            type="button"
            onClick={openAddModal}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Tambah Barang Baru</span>
          </button>
        </div>
      </div>

      {/* Bar Pencarian Real-Time, Filter Lantai, FEFO & Status Stok */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex flex-col xl:flex-row xl:items-center justify-between gap-4">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="search"
            aria-label="Cari SKU, nama barang, kategori, atau lokasi rak"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari kode SKU, barcode, nama barang, batch, atau kode rak (L1-A-01-R01)..."
            className="w-full pl-10 pr-4 py-2 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:bg-white dark:focus:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-600"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Filter Lantai */}
          <select
            aria-label="Filter lantai gudang"
            value={floorFilter}
            onChange={(e) => setFloorFilter(e.target.value)}
            className="px-3 py-1.5 text-xs font-semibold bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200"
          >
            <option value="ALL">Semua Lantai</option>
            {FLOOR_OPTIONS.map((fl) => (
              <option key={fl} value={fl}>
                {fl}
              </option>
            ))}
          </select>

          {/* Toggle Prioritas FEFO */}
          <button
            type="button"
            onClick={() => setFefoOnly((prev) => !prev)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors cursor-pointer whitespace-nowrap ${
              fefoOnly
                ? 'bg-amber-50 dark:bg-amber-950/60 border-amber-300 dark:border-amber-800 text-amber-800 dark:text-amber-300'
                : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
            }`}
          >
            <CalendarClock className="w-3.5 h-3.5" />
            <span>Prioritas FEFO</span>
          </button>

          {/* Segmented Filter Status Stok */}
          <div
            role="group"
            aria-label="Filter status stok"
            className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg overflow-x-auto"
          >
            <button
              type="button"
              onClick={() => handleFilterChange('ALL')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                statusFilter === 'ALL'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
              }`}
            >
              Semua ({countAll})
            </button>
            <button
              type="button"
              onClick={() => handleFilterChange('AMAN')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                statusFilter === 'AMAN'
                  ? 'bg-white dark:bg-slate-900 text-emerald-700 dark:text-emerald-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
              }`}
            >
              Aman ({countAman})
            </button>
            <button
              type="button"
              onClick={() => handleFilterChange('MENIPIS')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                statusFilter === 'MENIPIS'
                  ? 'bg-white dark:bg-slate-900 text-amber-700 dark:text-amber-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
              }`}
            >
              Menipis ({countMenipis})
            </button>
            <button
              type="button"
              onClick={() => handleFilterChange('HABIS')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                statusFilter === 'HABIS'
                  ? 'bg-white dark:bg-slate-900 text-rose-700 dark:text-rose-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
              }`}
            >
              Habis ({countHabis})
            </button>
          </div>
        </div>
      </div>

      {/* MODE 2: PETA DENAH VISUAL RAK GUDANG */}
      {viewMode === 'RACK_MAP' ? (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Grid Denah Rak Picking & Rak Inbound */}
            <div className="lg:col-span-8 space-y-6">
              {FLOOR_OPTIONS.filter(
                (fl) => floorFilter === 'ALL' || floorFilter === fl
              ).map((floor) => {
                const floorItems = filteredItems.filter(
                  (i) => (i.floor_level || 'Lantai 1') === floor
                );
                return (
                  <div
                    key={floor}
                    className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4"
                  >
                    <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
                      <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                        <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                          Denah {floor} — Area Rak Picking & Buffer Inbound
                        </h3>
                      </div>
                      <span className="text-xs font-mono text-slate-500 dark:text-slate-400">
                        {floorItems.length} Rak Aktif
                      </span>
                    </div>

                    {floorItems.length === 0 ? (
                      <p className="text-xs text-slate-500 py-4 text-center">
                        Tidak ada SKU pada {floor} yang sesuai filter.
                      </p>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                        {floorItems.map((item) => {
                          const status = getStockStatus(item.stock, item.min_stock);
                          const isSelected = selectedMapItem?.id === item.id;
                          return (
                            <button
                              key={item.id}
                              type="button"
                              onClick={() => setSelectedMapItem(item)}
                              className={`text-left p-3.5 rounded-lg border transition-colors cursor-pointer ${
                                isSelected
                                  ? 'border-indigo-600 bg-indigo-50/40 dark:bg-indigo-950/40'
                                  : 'border-slate-200 dark:border-slate-800 hover:border-indigo-400 bg-slate-50/60 dark:bg-slate-950/50'
                              }`}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <span className="font-mono text-xs font-bold text-indigo-700 dark:text-indigo-300">
                                  {item.rack_location}
                                </span>
                                {renderStatusIndicator(item.stock, item.min_stock)}
                              </div>
                              <p className="text-xs text-slate-500 dark:text-slate-400 font-mono mt-0.5">
                                {item.aisle_row} · {item.column_bay} · {item.rack_code}
                              </p>
                              <p className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate mt-2">
                                {item.name}
                              </p>
                              <div className="mt-2 pt-2 border-t border-slate-200/70 dark:border-slate-800 flex items-center justify-between text-[11px] font-mono">
                                <span>
                                  Picking: <strong>{item.stock}</strong> {item.unit}
                                </span>
                                <span
                                  className={
                                    status !== 'AMAN' && item.reserve_stock > 0
                                      ? 'text-indigo-600 dark:text-indigo-400 font-semibold'
                                      : 'text-slate-500'
                                  }
                                >
                                  Inbound: {item.reserve_stock}
                                </span>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Panel Inspeksi Detail Rak & Eksekusi Replenishment */}
            <div className="lg:col-span-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 sticky top-20">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-1">
                Inspeksi Koordinat Rak & Replenishment
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
                Klik salah satu sel rak di peta untuk melihat detail hierarki dan transfer stok
              </p>

              {(() => {
                const activeRackItem = selectedMapItem || filteredItems[0];
                if (!activeRackItem) {
                  return (
                    <p className="text-xs text-slate-500">
                      Pilih rak untuk melihat rincian.
                    </p>
                  );
                }
                return (
                  <div className="space-y-4">
                    <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-sm font-bold text-indigo-600 dark:text-indigo-400">
                          {activeRackItem.rack_location}
                        </span>
                        {renderStatusIndicator(
                          activeRackItem.stock,
                          activeRackItem.min_stock
                        )}
                      </div>
                      <p className="text-xs font-mono text-slate-500 dark:text-slate-400">
                        {activeRackItem.floor_level} → {activeRackItem.aisle_row} →{' '}
                        {activeRackItem.column_bay} → {activeRackItem.rack_code}
                      </p>
                      <p className="text-sm font-bold text-slate-900 dark:text-slate-100 pt-1">
                        {activeRackItem.name}
                      </p>
                      <p className="text-xs font-mono text-slate-500">
                        SKU: {activeRackItem.sku} · Barcode: {activeRackItem.barcode}
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-xs font-mono">
                      <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-800">
                        <span className="text-slate-500 block">Stok Rak Picking</span>
                        <span className="text-base font-bold text-slate-900 dark:text-slate-100">
                          {activeRackItem.stock} {activeRackItem.unit}
                        </span>
                        <span className="text-[11px] text-slate-400 block">
                          Min: {activeRackItem.min_stock} {activeRackItem.unit}
                        </span>
                      </div>
                      <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-800">
                        <span className="text-slate-500 block">
                          Rak Inbound ({activeRackItem.inbound_rack_location})
                        </span>
                        <span className="text-base font-bold text-indigo-600 dark:text-indigo-400">
                          {activeRackItem.reserve_stock} {activeRackItem.unit}
                        </span>
                        <span className="text-[11px] text-slate-400 block">
                          Siap Replenish
                        </span>
                      </div>
                    </div>

                    {activeRackItem.reserve_stock > 0 && (
                      <button
                        type="button"
                        onClick={() =>
                          executeReplenishment({
                            item_id: activeRackItem.id,
                          })
                        }
                        className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold transition-colors cursor-pointer"
                      >
                        <RefreshCw className="w-4 h-4" />
                        <span>
                          Transfer Replenishment ({activeRackItem.inbound_rack_location}{' '}
                          → {activeRackItem.rack_location})
                        </span>
                      </button>
                    )}
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-10 text-center">
          <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            Tidak Ada Barang yang Ditemukan
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-md mx-auto">
            Tidak ada SKU yang cocok dengan kata kunci pencarian atau filter lokasi/FEFO yang dipilih.
          </p>
          <div className="mt-4 flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setFloorFilter('ALL');
                setFefoOnly(false);
                handleFilterChange('ALL');
              }}
              className="px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
            >
              Reset Filter
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* TAMPILAN DESKTOP: Tabel High-Density (hidden md:block) */}
          <div className="hidden md:block bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/50 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                    <th className="py-3 px-4">Kode SKU & Barcode</th>
                    <th className="py-3 px-4">Nama Barang & Kategori</th>
                    <th className="py-3 px-4">Hierarki Lokasi Rak Picking</th>
                    <th className="py-3 px-4">Batch & Prioritas FEFO</th>
                    <th className="py-3 px-4 text-right">Stok Picking</th>
                    <th className="py-3 px-4 text-right">Stok Rak Inbound</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Tindakan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-sm">
                  {filteredItems.map((item) => (
                    <tr
                      key={item.id}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors"
                    >
                      <td className="py-3 px-4 font-mono whitespace-nowrap">
                        <div className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                          {item.sku}
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400">
                          {item.barcode}
                        </div>
                      </td>
                      <td className="py-3 px-4 font-medium text-slate-900 dark:text-slate-100">
                        <div>{item.name}</div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                          {item.category} · Min: {item.min_stock} {item.unit}
                        </div>
                      </td>
                      <td className="py-3 px-4 font-mono whitespace-nowrap">
                        <div className="text-xs font-bold text-indigo-700 dark:text-indigo-300">
                          {item.rack_location}
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400">
                          {item.floor_level} · {item.aisle_row} · {item.column_bay}
                        </div>
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        {renderFefoInfo(item)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-slate-900 dark:text-slate-100 tabular-nums whitespace-nowrap">
                        {item.stock.toLocaleString('id-ID')} {item.unit}
                      </td>
                      <td className="py-3 px-4 text-right font-mono whitespace-nowrap">
                        <div className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                          {item.reserve_stock} {item.unit}
                        </div>
                        <div className="text-[11px] text-slate-500">
                          {item.inbound_rack_location}
                        </div>
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        {renderStatusIndicator(item.stock, item.min_stock)}
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center justify-end gap-1">
                          {item.stock <= item.min_stock && item.reserve_stock > 0 && (
                            <button
                              type="button"
                              onClick={() =>
                                executeReplenishment({ item_id: item.id })
                              }
                              aria-label={`Replenish ${item.name}`}
                              title="Transfer Replenishment dari Rak Inbound ke Rak Picking"
                              className="px-2 py-1 text-[11px] font-semibold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 rounded-md transition-colors cursor-pointer mr-1"
                            >
                              +Replenish
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() =>
                              navigate(`/transactions?item=${item.id}`)
                            }
                            aria-label={`Mutasi stok ${item.name}`}
                            title="Catat Putaway / Mutasi"
                            className="p-1.5 text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 rounded-lg transition-colors cursor-pointer"
                          >
                            <ArrowLeftRight className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => openEditModal(item)}
                            aria-label={`Edit barang ${item.name}`}
                            title="Edit Barang"
                            className="p-1.5 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteItem(item.id)}
                            aria-label={`Hapus barang ${item.name}`}
                            title="Hapus Barang"
                            className="p-1.5 text-slate-500 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/60 rounded-lg transition-colors cursor-pointer"
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
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 font-mono">
                      <span className="font-semibold text-slate-900 dark:text-slate-100">
                        {item.sku}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="font-bold text-indigo-600 dark:text-indigo-400">
                        {item.rack_location}
                      </span>
                    </div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 mt-1">
                      {item.name}
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      {item.floor_level} · {item.aisle_row} · Batch: {item.batch_number}
                    </p>
                  </div>
                  {renderStatusIndicator(item.stock, item.min_stock)}
                </div>

                <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                  <div className="font-mono tabular-nums text-xs">
                    <span className="text-slate-500">Picking: </span>
                    <strong className="text-slate-900 dark:text-slate-100">
                      {item.stock} {item.unit}
                    </strong>
                    <span className="text-slate-400 ml-2">
                      (Inbound: {item.reserve_stock})
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {item.stock <= item.min_stock && item.reserve_stock > 0 && (
                      <button
                        type="button"
                        onClick={() => executeReplenishment({ item_id: item.id })}
                        className="px-2 py-1 text-xs font-semibold text-white bg-indigo-600 rounded-lg"
                      >
                        Replenish
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => openEditModal(item)}
                      aria-label={`Edit ${item.name} mobile`}
                      className="p-1.5 text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 rounded-lg"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Modal Form Tambah & Edit Barang Hierarkis */}
      {isModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="inventory-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs overflow-y-auto"
        >
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl max-w-2xl w-full shadow-xl overflow-hidden my-8">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800">
              <h3
                id="inventory-modal-title"
                className="text-base font-bold text-slate-900 dark:text-slate-100"
              >
                {editingItem
                  ? 'Edit SKU, Hierarki Lokasi Rak & FEFO'
                  : 'Tambah SKU & Konfigurasi Lokasi Rak Baru'}
              </h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                aria-label="Tutup modal barang"
                className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveItem} className="p-6 space-y-4">
              {formError && (
                <div
                  role="alert"
                  className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 text-xs font-medium text-rose-700 dark:text-rose-300"
                >
                  {formError}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label
                    htmlFor="item-sku"
                    className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
                  >
                    Kode SKU
                  </label>
                  <input
                    id="item-sku"
                    type="text"
                    required
                    value={sku}
                    onChange={(e) => setSku(e.target.value)}
                    className="w-full px-3 py-2 text-sm font-mono bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
                  />
                </div>
                <div>
                  <label
                    htmlFor="item-barcode"
                    className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
                  >
                    Nomor Barcode EAN-13
                  </label>
                  <input
                    id="item-barcode"
                    type="text"
                    value={barcode}
                    onChange={(e) => setBarcode(e.target.value)}
                    className="w-full px-3 py-2 text-sm font-mono bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
                  />
                </div>
                <div>
                  <label
                    htmlFor="item-category"
                    className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
                  >
                    Kategori
                  </label>
                  <select
                    id="item-category"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
                  >
                    {DEFAULT_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label
                  htmlFor="item-name"
                  className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
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
                  className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
                />
              </div>

              {/* Hierarki Lokasi Gudang (Lantai -> Baris -> Kolom -> Rak) */}
              <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    Hierarki Lokasi Rak Picking Utama
                  </span>
                  <span className="text-xs font-mono font-bold text-indigo-600 dark:text-indigo-400">
                    Kode: {formatRackHierarchyCode(floorLevel, aisleRow, columnBay, rackCode)}
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                      Lantai
                    </label>
                    <select
                      value={floorLevel}
                      onChange={(e) => setFloorLevel(e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg"
                    >
                      {FLOOR_OPTIONS.map((f) => (
                        <option key={f} value={f}>
                          {f}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                      Baris (Aisle)
                    </label>
                    <select
                      value={aisleRow}
                      onChange={(e) => setAisleRow(e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg"
                    >
                      {AISLE_OPTIONS.map((a) => (
                        <option key={a} value={a}>
                          {a}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                      Kolom (Bay)
                    </label>
                    <select
                      value={columnBay}
                      onChange={(e) => setColumnBay(e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg"
                    >
                      {COLUMN_OPTIONS.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                      Nomor Rak
                    </label>
                    <select
                      value={rackCode}
                      onChange={(e) => setRackCode(e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg"
                    >
                      {RACK_OPTIONS.map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label
                    htmlFor="item-stock"
                    className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
                  >
                    Stok Rak Picking
                  </label>
                  <input
                    id="item-stock"
                    type="number"
                    min={0}
                    required
                    value={stock}
                    onChange={(e) => setStock(e.target.value)}
                    className="w-full px-3 py-2 text-sm font-mono bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg"
                  />
                </div>
                <div>
                  <label
                    htmlFor="item-min-stock"
                    className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
                  >
                    Min Stok Picking
                  </label>
                  <input
                    id="item-min-stock"
                    type="number"
                    min={0}
                    required
                    value={minStock}
                    onChange={(e) => setMinStock(e.target.value)}
                    className="w-full px-3 py-2 text-sm font-mono bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg"
                  />
                </div>
                <div>
                  <label
                    htmlFor="item-reserve"
                    className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
                  >
                    Stok Rak Inbound
                  </label>
                  <input
                    id="item-reserve"
                    type="number"
                    min={0}
                    value={reserveStock}
                    onChange={(e) => setReserveStock(e.target.value)}
                    className="w-full px-3 py-2 text-sm font-mono bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg"
                  />
                </div>
                <div>
                  <label
                    htmlFor="item-unit"
                    className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
                  >
                    Satuan
                  </label>
                  <select
                    id="item-unit"
                    value={unit}
                    onChange={(e) => setUnit(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg"
                  >
                    {DEFAULT_UNITS.map((u) => (
                      <option key={u} value={u}>
                        {u}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Kode Rak Inbound Staging
                  </label>
                  <input
                    type="text"
                    value={inboundRackLocation}
                    onChange={(e) => setInboundRackLocation(e.target.value)}
                    className="w-full px-3 py-2 text-sm font-mono bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Nomor Batch
                  </label>
                  <input
                    type="text"
                    value={batchNumber}
                    onChange={(e) => setBatchNumber(e.target.value)}
                    className="w-full px-3 py-2 text-sm font-mono bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Tanggal Kedaluwarsa (FEFO)
                  </label>
                  <input
                    type="date"
                    value={expiryDate}
                    onChange={(e) => setExpiryDate(e.target.value)}
                    className="w-full px-3 py-2 text-sm font-mono bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-lg cursor-pointer"
                >
                  {saving ? 'Menyimpan...' : editingItem ? 'Simpan Perubahan' : 'Simpan Barang'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
