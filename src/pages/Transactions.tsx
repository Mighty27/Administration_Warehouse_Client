import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  ArrowDownLeft,
  ArrowUpRight,
  Compass,
  Download,
  FileSpreadsheet,
  RefreshCw,
  Search,
} from 'lucide-react';
import { useWarehouse } from '../context/WarehouseContext';
import { TransactionType } from '../types/warehouse';
import {
  buildPutawayRecommendation,
  generateTransactionsCsv,
  validateTransactionInput,
} from '../utils/warehouseRules';

export const Transactions: React.FC = () => {
  const {
    user,
    items,
    transactions,
    recordTransaction,
    executeReplenishment,
    addToast,
  } = useWarehouse();
  const [searchParams] = useSearchParams();

  // State Form Pencatatan Transaksi Inbound / Outbound / Replenishment
  const [type, setType] = useState<'INBOUND' | 'OUTBOUND'>('INBOUND');
  const [selectedItemId, setSelectedItemId] = useState<string>('');
  const [putawayTarget, setPutawayTarget] = useState<
    'PICKING_RACK' | 'INBOUND_STAGE'
  >('PICKING_RACK');
  const [quantity, setQuantity] = useState<string>('10');
  const [batchNumber, setBatchNumber] = useState<string>('BATCH-2026-11A');
  const [expiryDate, setExpiryDate] = useState<string>('');
  const [referenceNo, setReferenceNo] = useState<string>(
    `PO-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`
  );
  const [partnerName, setPartnerName] = useState<string>('');
  const [operatorName, setOperatorName] = useState<string>('Hendra Gunawan');
  const [notes, setNotes] = useState<string>('');
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // State Filter Riwayat Transaksi
  const [historyFilterType, setHistoryFilterType] = useState<
    'ALL' | TransactionType
  >('ALL');
  const [historySearch, setHistorySearch] = useState('');

  useEffect(() => {
    const paramItem = searchParams.get('item');
    const paramType = searchParams.get('type');
    if (paramType === 'INBOUND' || paramType === 'OUTBOUND') {
      setType(paramType);
      setReferenceNo(
        `${paramType === 'INBOUND' ? 'PO' : 'DO'}-${new Date().getFullYear()}-${Math.floor(
          100 + Math.random() * 900
        )}`
      );
    }
    if (paramItem && items.some((i) => i.id === paramItem)) {
      setSelectedItemId(paramItem);
    } else if (!selectedItemId && items.length > 0) {
      setSelectedItemId(items[0].id);
    }
  }, [searchParams, items, selectedItemId]);

  const selectedItem = items.find((i) => i.id === selectedItemId);

  useEffect(() => {
    if (selectedItem) {
      setBatchNumber(selectedItem.batch_number || 'BATCH-2026-11A');
      setExpiryDate(selectedItem.expiry_date || '');
      const rec = buildPutawayRecommendation(selectedItem);
      setPutawayTarget(rec.suggestedTarget);
    }
  }, [selectedItem?.id]);

  if (!user) return null;

  const parsedQty = Number(quantity) || 0;
  const putawayRec = buildPutawayRecommendation(selectedItem);

  const livePreview = validateTransactionInput({
    item: selectedItem,
    userId: user.id,
    type,
    quantity: parsedQty,
    referenceNo: referenceNo || 'REF-TEMP',
  });

  const handleTypeSwitch = (nextType: 'INBOUND' | 'OUTBOUND') => {
    setType(nextType);
    setFormError(null);
    const prefix = nextType === 'INBOUND' ? 'PO' : 'DO';
    setReferenceNo(
      `${prefix}-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    setSubmitting(true);
    const res = await recordTransaction({
      item_id: selectedItemId,
      type,
      quantity: Number(quantity),
      reference_no: referenceNo,
      partner_name: partnerName,
      notes,
      putaway_target: type === 'INBOUND' ? putawayTarget : 'PICKING_RACK',
      batch_number: batchNumber,
      expiry_date: expiryDate.trim() ? expiryDate.trim() : undefined,
      operator_name: operatorName,
    });
    setSubmitting(false);

    if (!res.ok) {
      setFormError(res.error || 'Gagal mencatat transaksi gudang.');
      return;
    }

    const prefix = type === 'INBOUND' ? 'PO' : 'DO';
    setReferenceNo(
      `${prefix}-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`
    );
    setQuantity('5');
    setPartnerName('');
    setNotes('');
  };

  const filteredTransactions = transactions
    .filter((tx) =>
      historyFilterType === 'ALL' ? true : tx.type === historyFilterType
    )
    .filter((tx) => {
      const q = historySearch.trim().toLowerCase();
      if (!q) return true;
      return (
        tx.reference_no.toLowerCase().includes(q) ||
        tx.sku.toLowerCase().includes(q) ||
        tx.item_name.toLowerCase().includes(q) ||
        tx.partner_name.toLowerCase().includes(q) ||
        (tx.to_location || '').toLowerCase().includes(q)
      );
    });

  const handleExportCsv = () => {
    if (filteredTransactions.length === 0) {
      addToast('error', 'Tidak Ada Data', 'Tidak ada riwayat transaksi untuk diekspor.');
      return;
    }

    const csvContent = generateTransactionsCsv(filteredTransactions);
    const blob = new Blob(['\uFEFF' + csvContent], {
      type: 'text/csv;charset=utf-8;',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const dateStamp = new Date().toISOString().slice(0, 10);
    link.href = url;
    link.setAttribute('download', `Laporan_Mutasi_Gudang_${dateStamp}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    addToast(
      'success',
      'Laporan CSV Berhasil Diunduh',
      `${filteredTransactions.length} baris transaksi diekspor ke CSV.`
    );
  };

  const formatDateTime = (iso: string) => {
    return new Date(iso).toLocaleDateString('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
            Guided Putaway, Mutasi Gudang & Replenishment
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-0.5">
            Pencatatan barang masuk dengan rekomendasi koordinat rak penyimpanan, pengeluaran FEFO, dan transfer internal
          </p>
        </div>

        <button
          type="button"
          onClick={handleExportCsv}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold text-slate-800 dark:text-slate-200 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          <Download className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
          <span>Export CSV ({filteredTransactions.length})</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Form Pencatatan Putaway & Mutasi (5 Kolom di Desktop) */}
        <section className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
              Formulir Guided Putaway & Mutasi Stok
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Sistem otomatis merekomendasikan lokasi rak tujuan berdasarkan SKU serupa
            </p>
          </div>

          {/* Pemilih Tipe Transaksi */}
          <div
            role="group"
            aria-label="Pilih tipe transaksi"
            className="grid grid-cols-2 gap-2 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg"
          >
            <button
              type="button"
              onClick={() => handleTypeSwitch('INBOUND')}
              className={`flex items-center justify-center gap-2 py-2 px-3 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                type === 'INBOUND'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
              }`}
            >
              <ArrowDownLeft className="w-4 h-4" />
              <span>Inbound & Putaway</span>
            </button>

            <button
              type="button"
              onClick={() => handleTypeSwitch('OUTBOUND')}
              className={`flex items-center justify-center gap-2 py-2 px-3 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                type === 'OUTBOUND'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
              }`}
            >
              <ArrowUpRight className="w-4 h-4" />
              <span>Outbound (Picking)</span>
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {formError && (
              <div
                role="alert"
                className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-xs font-medium text-rose-700 dark:text-rose-300"
              >
                {formError}
              </div>
            )}

            <div>
              <label
                htmlFor="tx-item"
                className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
              >
                Pilih Barang dari Master Inventaris
              </label>
              <select
                id="tx-item"
                value={selectedItemId}
                onChange={(e) => setSelectedItemId(e.target.value)}
                required
                className="w-full px-3 py-2.5 text-xs font-mono bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
              >
                {items.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.sku} — {item.name} (Picking: {item.stock} {item.unit})
                  </option>
                ))}
              </select>
            </div>

            {/* Banner Rekomendasi Guided Putaway khusus Inbound */}
            {type === 'INBOUND' && selectedItem && (
              <div className="p-3.5 rounded-lg bg-indigo-50/70 dark:bg-indigo-950/50 border border-indigo-200 dark:border-indigo-900 space-y-2">
                <div className="flex items-center gap-2 text-xs font-bold text-indigo-800 dark:text-indigo-200">
                  <Compass className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
                  <span>Rekomendasi Lokasi Putaway Cerdas</span>
                </div>
                <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                  {putawayRec.reason}
                </p>
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setPutawayTarget('PICKING_RACK')}
                    className={`p-2 rounded-md border text-left text-xs font-mono cursor-pointer ${
                      putawayTarget === 'PICKING_RACK'
                        ? 'border-indigo-600 bg-white dark:bg-slate-900 font-bold text-indigo-700 dark:text-indigo-300'
                        : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    <div>Rak Picking Utama</div>
                    <div className="text-[11px]">{selectedItem.rack_location}</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPutawayTarget('INBOUND_STAGE')}
                    className={`p-2 rounded-md border text-left text-xs font-mono cursor-pointer ${
                      putawayTarget === 'INBOUND_STAGE'
                        ? 'border-indigo-600 bg-white dark:bg-slate-900 font-bold text-indigo-700 dark:text-indigo-300'
                        : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    <div>Rak Inbound Staging</div>
                    <div className="text-[11px]">
                      {selectedItem.inbound_rack_location}
                    </div>
                  </button>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label
                  htmlFor="tx-qty"
                  className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
                >
                  Jumlah Unit ({selectedItem?.unit || 'Unit'})
                </label>
                <input
                  id="tx-qty"
                  type="number"
                  min={1}
                  required
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  className="w-full px-3 py-2 text-sm font-mono tabular-nums bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg"
                />
              </div>

              <div>
                <label
                  htmlFor="tx-ref"
                  className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
                >
                  No. Referensi (PO / DO)
                </label>
                <input
                  id="tx-ref"
                  type="text"
                  required
                  value={referenceNo}
                  onChange={(e) => setReferenceNo(e.target.value)}
                  className="w-full px-3 py-2 text-sm font-mono bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg"
                />
              </div>
            </div>

            {type === 'INBOUND' && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Nomor Batch Masuk
                  </label>
                  <input
                    type="text"
                    value={batchNumber}
                    onChange={(e) => setBatchNumber(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-mono bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg"
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
                    className="w-full px-3 py-2 text-xs font-mono bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg"
                  />
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Supplier / Divisi Tujuan
                </label>
                <input
                  type="text"
                  value={partnerName}
                  onChange={(e) => setPartnerName(e.target.value)}
                  placeholder="PT Sumber Logistik"
                  className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Nama Staf Operator
                </label>
                <input
                  type="text"
                  value={operatorName}
                  onChange={(e) => setOperatorName(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Catatan Operasional
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Kondisi segel utuh, lolos QC..."
                className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg"
              />
            </div>

            <button
              type="submit"
              disabled={
                submitting ||
                (type === 'OUTBOUND' && !livePreview.valid && parsedQty > 0)
              }
              className={`w-full py-2.5 px-4 rounded-lg text-white text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50 ${
                type === 'INBOUND'
                  ? 'bg-emerald-600 hover:bg-emerald-700'
                  : 'bg-amber-600 hover:bg-amber-700'
              }`}
            >
              {submitting
                ? 'Memproses Mutasi...'
                : type === 'INBOUND'
                ? `Simpan Inbound & Putaway ke ${
                    putawayTarget === 'PICKING_RACK'
                      ? selectedItem?.rack_location
                      : selectedItem?.inbound_rack_location
                  }`
                : 'Simpan Pengeluaran Barang (Outbound)'}
            </button>

            {selectedItem && selectedItem.reserve_stock > 0 && (
              <button
                type="button"
                onClick={() => executeReplenishment({ item_id: selectedItem.id })}
                className="w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg border border-indigo-200 dark:border-indigo-800 bg-indigo-50/60 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 text-xs font-semibold cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>
                  Transfer Replenishment Cepat ({selectedItem.inbound_rack_location} →{' '}
                  {selectedItem.rack_location})
                </span>
              </button>
            )}
          </form>
        </section>

        {/* Tabel Riwayat Transaksi (7 Kolom di Desktop) */}
        <section className="lg:col-span-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
          <div className="p-5 border-b border-slate-200 dark:border-slate-800 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  Buku Besar Riwayat Putaway, Picking & Replenishment
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Jejak audit lengkap lokasi asal, lokasi tujuan, nomor batch, dan staf operator
                </p>
              </div>
              <span className="text-xs font-mono text-slate-500">
                {filteredTransactions.length} transaksi
              </span>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="search"
                  aria-label="Cari nomor referensi atau SKU pada riwayat"
                  value={historySearch}
                  onChange={(e) => setHistorySearch(e.target.value)}
                  placeholder="Cari No. PO/DO/Manifest, kode SKU, rak, atau nama barang..."
                  className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg"
                />
              </div>

              <div
                role="group"
                aria-label="Filter tipe riwayat transaksi"
                className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg overflow-x-auto"
              >
                <button
                  type="button"
                  onClick={() => setHistoryFilterType('ALL')}
                  className={`px-2.5 py-1 text-xs font-semibold rounded-md cursor-pointer ${
                    historyFilterType === 'ALL'
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  Semua
                </button>
                <button
                  type="button"
                  onClick={() => setHistoryFilterType('INBOUND')}
                  className={`px-2.5 py-1 text-xs font-semibold rounded-md cursor-pointer ${
                    historyFilterType === 'INBOUND'
                      ? 'bg-white dark:bg-slate-900 text-emerald-700 dark:text-emerald-400'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  Inbound
                </button>
                <button
                  type="button"
                  onClick={() => setHistoryFilterType('OUTBOUND')}
                  className={`px-2.5 py-1 text-xs font-semibold rounded-md cursor-pointer ${
                    historyFilterType === 'OUTBOUND'
                      ? 'bg-white dark:bg-slate-900 text-amber-700 dark:text-amber-400'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  Outbound
                </button>
                <button
                  type="button"
                  onClick={() => setHistoryFilterType('REPLENISHMENT')}
                  className={`px-2.5 py-1 text-xs font-semibold rounded-md cursor-pointer ${
                    historyFilterType === 'REPLENISHMENT'
                      ? 'bg-white dark:bg-slate-900 text-indigo-700 dark:text-indigo-300'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  Replenish
                </button>
              </div>
            </div>
          </div>

          {filteredTransactions.length === 0 ? (
            <div className="p-10 text-center">
              <FileSpreadsheet className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-sm font-semibold">Belum Ada Transaksi yang Cocok</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/50 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                    <th className="py-3 px-4">Waktu & Referensi</th>
                    <th className="py-3 px-4">Tipe & Rute Rak</th>
                    <th className="py-3 px-4">Barang & Batch</th>
                    <th className="py-3 px-4 text-right">Mutasi</th>
                    <th className="py-3 px-4 text-right">Saldo Akhir</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-sm">
                  {filteredTransactions.map((tx) => (
                    <tr
                      key={tx.id}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors"
                    >
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="font-mono text-xs font-semibold text-slate-900 dark:text-slate-100">
                          {tx.reference_no}
                        </div>
                        <div className="text-[11px] text-slate-500">
                          {formatDateTime(tx.created_at)}
                        </div>
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span
                          className={`text-xs font-semibold ${
                            tx.type === 'INBOUND'
                              ? 'text-emerald-700 dark:text-emerald-400'
                              : tx.type === 'REPLENISHMENT'
                              ? 'text-indigo-700 dark:text-indigo-300'
                              : tx.type === 'OPNAME_ADJUSTMENT'
                              ? 'text-rose-700 dark:text-rose-400'
                              : 'text-amber-700 dark:text-amber-400'
                          }`}
                        >
                          {tx.type}
                        </span>
                        <div className="text-[11px] font-mono text-slate-500">
                          {tx.from_location || 'IN'} → {tx.to_location || 'OUT'}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-medium text-slate-900 dark:text-slate-100 text-xs">
                          {tx.item_name}
                        </div>
                        <div className="text-[11px] font-mono text-slate-500">
                          {tx.sku} · {tx.batch_number || '-'} · PIC:{' '}
                          {tx.operator_name || 'Staf WMS'}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold tabular-nums whitespace-nowrap">
                        <span
                          className={
                            tx.type === 'INBOUND' || tx.type === 'REPLENISHMENT'
                              ? 'text-emerald-700 dark:text-emerald-400'
                              : 'text-amber-700 dark:text-amber-400'
                          }
                        >
                          {tx.type === 'INBOUND' || tx.type === 'REPLENISHMENT'
                            ? `+${tx.quantity}`
                            : `-${tx.quantity}`}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-xs text-slate-600 dark:text-slate-400 tabular-nums whitespace-nowrap">
                        {tx.stock_before} →{' '}
                        <strong className="text-slate-900 dark:text-slate-100">
                          {tx.stock_after}
                        </strong>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
};
