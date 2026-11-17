import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  ArrowDownLeft,
  ArrowUpRight,
  Download,
  FileSpreadsheet,
  Search,
} from 'lucide-react';
import { useWarehouse } from '../context/WarehouseContext';
import { TransactionType } from '../types/warehouse';
import {
  generateTransactionsCsv,
  validateTransactionInput,
} from '../utils/warehouseRules';

export const Transactions: React.FC = () => {
  const { user, items, transactions, recordTransaction, addToast } = useWarehouse();
  const [searchParams] = useSearchParams();

  // State Form Pencatatan Transaksi Inbound / Outbound
  const [type, setType] = useState<TransactionType>('INBOUND');
  const [selectedItemId, setSelectedItemId] = useState<string>('');
  const [quantity, setQuantity] = useState<string>('1');
  const [referenceNo, setReferenceNo] = useState<string>(
    `PO-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`
  );
  const [partnerName, setPartnerName] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // State Filter Riwayat Transaksi
  const [historyFilterType, setHistoryFilterType] = useState<'ALL' | TransactionType>('ALL');
  const [historySearch, setHistorySearch] = useState('');

  // Inisialisasi pilihan barang dari URL query parameter atau item pertama
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

  if (!user) return null;

  const selectedItem = items.find((i) => i.id === selectedItemId);
  const parsedQty = Number(quantity) || 0;

  const livePreview = validateTransactionInput({
    item: selectedItem,
    userId: user.id,
    type,
    quantity: parsedQty,
    referenceNo: referenceNo || 'REF-TEMP',
  });

  const handleTypeSwitch = (nextType: TransactionType) => {
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

    const validation = validateTransactionInput({
      item: selectedItem,
      userId: user.id,
      type,
      quantity: Number(quantity),
      referenceNo,
    });

    if (!validation.valid) {
      setFormError(validation.error || 'Input transaksi tidak valid.');
      return;
    }

    setSubmitting(true);
    const res = await recordTransaction({
      item_id: selectedItemId,
      type,
      quantity: Number(quantity),
      reference_no: referenceNo,
      partner_name: partnerName,
      notes,
    });
    setSubmitting(false);

    if (!res.ok) {
      setFormError(res.error || 'Gagal mencatat transaksi gudang.');
      return;
    }

    // Reset field transaksi untuk entri berikutnya
    const prefix = type === 'INBOUND' ? 'PO' : 'DO';
    setReferenceNo(
      `${prefix}-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`
    );
    setQuantity('1');
    setPartnerName('');
    setNotes('');
  };

  const filteredTransactions = transactions
    .filter((tx) => (historyFilterType === 'ALL' ? true : tx.type === historyFilterType))
    .filter((tx) => {
      const q = historySearch.trim().toLowerCase();
      if (!q) return true;
      return (
        tx.reference_no.toLowerCase().includes(q) ||
        tx.sku.toLowerCase().includes(q) ||
        tx.item_name.toLowerCase().includes(q) ||
        tx.partner_name.toLowerCase().includes(q)
      );
    });

  const handleExportCsv = () => {
    if (filteredTransactions.length === 0) {
      addToast('error', 'Tidak Ada Data', 'Tidak ada riwayat transaksi untuk diekspor.');
      return;
    }

    const csvContent = generateTransactionsCsv(filteredTransactions);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const dateStamp = new Date().toISOString().slice(0, 10);
    link.href = url;
    link.setAttribute('download', `Laporan_Transaksi_Gudang_${dateStamp}.csv`);
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
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">
            Transaksi Gudang (Inbound & Outbound)
          </h2>
          <p className="text-sm text-slate-600 mt-0.5">
            Catat mutasi barang masuk dan barang keluar dengan pembaruan stok otomatis di Master Inventaris
          </p>
        </div>

        <button
          type="button"
          onClick={handleExportCsv}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold text-slate-800 bg-white border border-slate-200 hover:bg-slate-100 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          <Download className="w-4 h-4 text-indigo-600" />
          <span>Export CSV</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Form Pencatatan Transaksi (5 Kolom di Desktop) */}
        <section className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-6">
          <h3 className="text-base font-bold text-slate-900">
            Formulir Mutasi Stok
          </h3>
          <p className="text-xs text-slate-500 mt-0.5 mb-5">
            Validasi otomatis mencegah pengeluaran melebihi stok fisik tersedia
          </p>

          {/* Pemilih Tipe Transaksi: Inbound vs Outbound */}
          <div
            role="group"
            aria-label="Tipe Transaksi Gudang"
            className="grid grid-cols-2 gap-1.5 p-1 bg-slate-100 rounded-xl mb-5"
          >
            <button
              type="button"
              onClick={() => handleTypeSwitch('INBOUND')}
              className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                type === 'INBOUND'
                  ? 'bg-white text-emerald-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <ArrowDownLeft className="w-3.5 h-3.5 shrink-0" />
              <span>Barang Masuk (Inbound)</span>
            </button>

            <button
              type="button"
              onClick={() => handleTypeSwitch('OUTBOUND')}
              className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                type === 'OUTBOUND'
                  ? 'bg-white text-amber-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <ArrowUpRight className="w-3.5 h-3.5 shrink-0" />
              <span>Barang Keluar (Outbound)</span>
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            {formError && (
              <div
                role="alert"
                className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs font-medium text-rose-700"
              >
                {formError}
              </div>
            )}

            <div>
              <label
                htmlFor="tx-item"
                className="block text-xs font-semibold text-slate-700 mb-1.5"
              >
                Pilih Barang dari Master Inventaris
              </label>
              <select
                id="tx-item"
                value={selectedItemId}
                onChange={(e) => {
                  setSelectedItemId(e.target.value);
                  setFormError(null);
                }}
                className="w-full px-3 py-2.5 text-sm bg-white border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-600"
              >
                {items.length === 0 && (
                  <option value="">-- Belum ada barang di inventaris --</option>
                )}
                {items.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.sku} — {item.name} (Stok: {item.stock} {item.unit})
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="tx-quantity"
                  className="block text-xs font-semibold text-slate-700 mb-1.5"
                >
                  Kuantitas ({selectedItem?.unit || 'Unit'})
                </label>
                <input
                  id="tx-quantity"
                  type="number"
                  min={1}
                  required
                  value={quantity}
                  onChange={(e) => {
                    setQuantity(e.target.value);
                    setFormError(null);
                  }}
                  className="w-full px-3 py-2 text-sm font-mono tabular-nums bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-600"
                />
              </div>

              <div>
                <label
                  htmlFor="tx-reference"
                  className="block text-xs font-semibold text-slate-700 mb-1.5"
                >
                  No. Referensi (PO / DO / SJ)
                </label>
                <input
                  id="tx-reference"
                  type="text"
                  required
                  value={referenceNo}
                  onChange={(e) => setReferenceNo(e.target.value)}
                  placeholder="PO-2026-101"
                  className="w-full px-3 py-2 text-sm font-mono bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-600"
                />
              </div>
            </div>

            {/* Kalkulasi Pratinjau Stok Otomatis */}
            {selectedItem && (
              <div
                className={`p-3.5 rounded-xl border text-xs flex items-center justify-between font-mono tabular-nums ${
                  type === 'OUTBOUND' && parsedQty > selectedItem.stock
                    ? 'bg-rose-50 border-rose-200 text-rose-700'
                    : 'bg-slate-50 border-slate-200 text-slate-700'
                }`}
              >
                <div>
                  <span className="font-sans text-slate-500">Simulasi Mutasi: </span>
                  <strong>{selectedItem.stock}</strong> →{' '}
                  <strong>{livePreview.stockAfter}</strong> {selectedItem.unit}
                </div>
                {type === 'OUTBOUND' && parsedQty > selectedItem.stock && (
                  <span className="font-sans font-semibold text-rose-600">
                    Melebihi Stok!
                  </span>
                )}
              </div>
            )}

            <div>
              <label
                htmlFor="tx-partner"
                className="block text-xs font-semibold text-slate-700 mb-1.5"
              >
                Pemasok / Divisi Tujuan
              </label>
              <input
                id="tx-partner"
                type="text"
                value={partnerName}
                onChange={(e) => setPartnerName(e.target.value)}
                placeholder={
                  type === 'INBOUND'
                    ? 'Contoh: PT Sumber Logistik Utama'
                    : 'Contoh: Divisi Pengiriman Ekspedisi'
                }
                className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-600"
              />
            </div>

            <div>
              <label
                htmlFor="tx-notes"
                className="block text-xs font-semibold text-slate-700 mb-1.5"
              >
                Catatan Pemeriksaan
              </label>
              <textarea
                id="tx-notes"
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Kondisi kemasan, nomor kendaraan, atau nama petugas..."
                className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-600"
              />
            </div>

            <button
              type="submit"
              disabled={submitting || items.length === 0}
              className="w-full py-2.5 px-4 rounded-lg text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 transition-colors cursor-pointer"
            >
              {submitting
                ? 'Menyimpan Transaksi...'
                : type === 'INBOUND'
                ? 'Simpan Barang Masuk & Tambah Stok'
                : 'Simpan Barang Keluar & Kurangi Stok'}
            </button>
          </form>
        </section>

        {/* Tabel Riwayat Transaksi & Export CSV (7 Kolom di Desktop) */}
        <section className="lg:col-span-7 space-y-4">
          <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="search"
                aria-label="Cari riwayat transaksi"
                value={historySearch}
                onChange={(e) => setHistorySearch(e.target.value)}
                placeholder="Cari No. Referensi, SKU, nama barang, atau mitra..."
                className="w-full pl-10 pr-4 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-600"
              />
            </div>

            <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg shrink-0">
              <button
                type="button"
                onClick={() => setHistoryFilterType('ALL')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                  historyFilterType === 'ALL'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Semua ({transactions.length})
              </button>
              <button
                type="button"
                onClick={() => setHistoryFilterType('INBOUND')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                  historyFilterType === 'INBOUND'
                    ? 'bg-white text-emerald-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Inbound
              </button>
              <button
                type="button"
                onClick={() => setHistoryFilterType('OUTBOUND')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                  historyFilterType === 'OUTBOUND'
                    ? 'bg-white text-amber-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Outbound
              </button>
            </div>
          </div>

          {filteredTransactions.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-xl p-10 text-center">
              <FileSpreadsheet className="w-8 h-8 text-slate-400 mx-auto mb-2" />
              <p className="text-sm font-semibold text-slate-900">
                Belum Ada Riwayat Transaksi
              </p>
              <p className="text-xs text-slate-500 mt-1">
                Gunakan formulir di samping untuk mencatat pergerakan barang masuk atau keluar.
              </p>
            </div>
          ) : (
            <>
              {/* Tabel Desktop */}
              <div className="hidden md:block bg-white border border-slate-200 rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50/80 text-[11px] font-semibold text-slate-500">
                        <th className="py-3 px-4">Waktu & Referensi</th>
                        <th className="py-3 px-4">Barang & SKU</th>
                        <th className="py-3 px-4">Tipe</th>
                        <th className="py-3 px-4 text-right">Mutasi</th>
                        <th className="py-3 px-4 text-right">Saldo Stok</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 text-sm">
                      {filteredTransactions.map((tx) => {
                        const isInbound = tx.type === 'INBOUND';
                        return (
                          <tr
                            key={tx.id}
                            className="hover:bg-slate-50/80 transition-colors"
                          >
                            <td className="py-3 px-4 whitespace-nowrap">
                              <div className="font-mono text-xs font-semibold text-slate-900">
                                {tx.reference_no}
                              </div>
                              <div className="text-xs text-slate-500">
                                {formatDateTime(tx.created_at)}
                              </div>
                            </td>
                            <td className="py-3 px-4">
                              <div className="font-medium text-slate-900">
                                {tx.item_name}
                              </div>
                              <div className="text-xs text-slate-500 font-mono">
                                {tx.sku}
                                {tx.partner_name ? ` · ${tx.partner_name}` : ''}
                              </div>
                            </td>
                            <td className="py-3 px-4 whitespace-nowrap">
                              <span
                                className={`inline-flex items-center gap-1 text-xs font-semibold ${
                                  isInbound ? 'text-emerald-700' : 'text-amber-700'
                                }`}
                              >
                                {isInbound ? (
                                  <ArrowDownLeft className="w-3.5 h-3.5" />
                                ) : (
                                  <ArrowUpRight className="w-3.5 h-3.5" />
                                )}
                                {isInbound ? 'Inbound' : 'Outbound'}
                              </span>
                            </td>
                            <td
                              className={`py-3 px-4 text-right font-mono font-bold tabular-nums whitespace-nowrap ${
                                isInbound ? 'text-emerald-600' : 'text-amber-600'
                              }`}
                            >
                              {isInbound ? `+${tx.quantity}` : `-${tx.quantity}`}
                            </td>
                            <td className="py-3 px-4 text-right font-mono text-xs text-slate-600 tabular-nums whitespace-nowrap">
                              {tx.stock_before} →{' '}
                              <strong className="text-slate-900">
                                {tx.stock_after}
                              </strong>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Card List Mobile */}
              <div className="md:hidden space-y-3">
                {filteredTransactions.map((tx) => {
                  const isInbound = tx.type === 'INBOUND';
                  return (
                    <div
                      key={tx.id}
                      className="bg-white border border-slate-200 rounded-xl p-4 space-y-2"
                    >
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-mono font-semibold text-slate-900">
                          {tx.reference_no}
                        </span>
                        <span className="text-slate-500">
                          {formatDateTime(tx.created_at)}
                        </span>
                      </div>
                      <p className="text-sm font-bold text-slate-900">
                        {tx.item_name}
                      </p>
                      <div className="flex items-center justify-between pt-2 border-t border-slate-100 font-mono text-xs tabular-nums">
                        <span
                          className={`font-sans font-semibold ${
                            isInbound ? 'text-emerald-700' : 'text-amber-700'
                          }`}
                        >
                          {isInbound ? 'Barang Masuk' : 'Barang Keluar'}:{' '}
                          {isInbound ? `+${tx.quantity}` : `-${tx.quantity}`}
                        </span>
                        <span className="text-slate-600">
                          Stok: {tx.stock_before} → <strong>{tx.stock_after}</strong>
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
};
