import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowDownLeft,
  ArrowRight,
  ArrowUpRight,
  Boxes,
  CalendarClock,
  Layers,
  Plus,
  XCircle,
} from 'lucide-react';
import { useWarehouse } from '../context/WarehouseContext';
import {
  calculateDashboardMetrics,
  getStockStatus,
  getStockStatusLabel,
} from '../utils/warehouseRules';

export const Dashboard: React.FC = () => {
  const { user, items, transactions, dataLoading } = useWarehouse();
  const navigate = useNavigate();

  if (!user) return null;

  const metrics = calculateDashboardMetrics(items, transactions, user.id);

  // Barang dengan status kritis/menipis (stock <= min_stock), diurutkan dari stok terkecil
  const criticalItems = [...items]
    .filter((item) => item.stock <= item.min_stock)
    .sort((a, b) => a.stock - b.stock);

  // 5 aktivitas transaksi terakhir
  const recentTransactions = [...transactions]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 5);

  const formatDateTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString('id-ID', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="space-y-8">
      {/* Header Kontekstual & Aksi Utama */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">
            Ikhtisar Operasional Gudang
          </h2>
          <p className="text-sm text-slate-600 mt-0.5">
            Data real-time terisolasi untuk <span className="font-semibold text-slate-900">{user.full_name}</span> · {user.warehouse_zone}
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <Link
            to="/transactions"
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors whitespace-nowrap shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Catat Transaksi Gudang</span>
          </Link>
        </div>
      </div>

      {/* 4 Kartu Statistik Utama */}
      <section aria-label="Statistik Utama Gudang" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>Total SKU Terdaftar</span>
            <Boxes className="w-4 h-4 text-slate-400" />
          </div>
          <div className="mt-3 text-2xl font-bold text-slate-900 font-mono tabular-nums">
            {dataLoading ? '...' : metrics.totalSku.toLocaleString('id-ID')}
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Item aktif di katalog gudang
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>Total Unit Stok Fisik</span>
            <Layers className="w-4 h-4 text-slate-400" />
          </div>
          <div className="mt-3 text-2xl font-bold text-slate-900 font-mono tabular-nums">
            {dataLoading ? '...' : metrics.totalUnits.toLocaleString('id-ID')}
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Akumulasi seluruh kuantitas barang
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>Peringatan Stok Menipis</span>
            <AlertTriangle className="w-4 h-4 text-amber-600" />
          </div>
          <div
            className={`mt-3 text-2xl font-bold font-mono tabular-nums ${
              metrics.lowStockCount > 0 ? 'text-amber-600' : 'text-slate-900'
            }`}
          >
            {dataLoading ? '...' : metrics.lowStockCount.toLocaleString('id-ID')}
          </div>
          <p className="mt-1 text-xs text-slate-500">
            SKU dengan stok &le; batas minimum
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>Transaksi Hari Ini</span>
            <CalendarClock className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="mt-3 text-2xl font-bold text-slate-900 font-mono tabular-nums">
            {dataLoading ? '...' : metrics.todayTransactionsCount.toLocaleString('id-ID')}
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Pergerakan Inbound & Outbound
          </p>
        </div>
      </section>

      {/* Grid 2 Kolom: Daftar Stok Kritis/Menipis & 5 Aktivitas Transaksi Terakhir */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Kolom Kiri (5 cols): Peringatan Stok Kritis / Menipis */}
        <section className="lg:col-span-5 bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Daftar Stok Kritis & Menipis
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Barang yang memerlukan tindakan restock segera
              </p>
            </div>
            <Link
              to="/inventory?status=MENIPIS"
              className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 inline-flex items-center gap-1 whitespace-nowrap"
            >
              <span>Semua SKU</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {criticalItems.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-sm font-semibold text-slate-900">
                Seluruh Stok Berada di Level Aman
              </p>
              <p className="text-xs text-slate-500 mt-1">
                Tidak ada SKU yang berada di bawah batas minimum stok saat ini.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-200">
              {criticalItems.map((item) => {
                const status = getStockStatus(item.stock, item.min_stock);
                const isOut = status === 'HABIS';
                return (
                  <div
                    key={item.id}
                    className="p-4 hover:bg-slate-50 transition-colors flex items-center justify-between gap-4"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 text-xs text-slate-500 font-mono">
                        <span className="font-semibold text-slate-700">{item.sku}</span>
                        <span aria-hidden="true">·</span>
                        <span>{item.rack_location}</span>
                        <span aria-hidden="true">·</span>
                        <span
                          className={`inline-flex items-center gap-1 font-sans font-semibold ${
                            isOut ? 'text-rose-600' : 'text-amber-600'
                          }`}
                        >
                          {isOut ? (
                            <XCircle className="w-3.5 h-3.5" />
                          ) : (
                            <AlertTriangle className="w-3.5 h-3.5" />
                          )}
                          {getStockStatusLabel(status)}
                        </span>
                      </div>
                      <p className="text-sm font-semibold text-slate-900 truncate mt-1">
                        {item.name}
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5 font-mono tabular-nums">
                        Sisa: <strong className="text-slate-900">{item.stock}</strong> {item.unit} / Min: {item.min_stock} {item.unit}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        navigate(`/transactions?item=${item.id}&type=INBOUND`)
                      }
                      className="px-3 py-1.5 text-xs font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      Restock Cepat
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Kolom Kanan (7 cols): 5 Aktivitas Transaksi Terakhir */}
        <section className="lg:col-span-7 bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                5 Aktivitas Transaksi Terakhir
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Mutasi barang masuk (Inbound) dan barang keluar (Outbound) terbaru
              </p>
            </div>
            <Link
              to="/transactions"
              className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 inline-flex items-center gap-1 whitespace-nowrap"
            >
              <span>Riwayat Lengkap</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {recentTransactions.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-sm font-semibold text-slate-900">
                Belum Ada Aktivitas Transaksi
              </p>
              <p className="text-xs text-slate-500 mt-1 mb-4">
                Catat penerimaan atau pengeluaran barang pertama Anda.
              </p>
              <Link
                to="/transactions"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Buat Transaksi Pertama</span>
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-slate-200">
              {recentTransactions.map((tx) => {
                const isInbound = tx.type === 'INBOUND';
                return (
                  <div
                    key={tx.id}
                    className="p-4 hover:bg-slate-50 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      <div
                        className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                          isInbound
                            ? 'bg-emerald-50 text-emerald-600'
                            : 'bg-amber-50 text-amber-600'
                        }`}
                      >
                        {isInbound ? (
                          <ArrowDownLeft className="w-4 h-4" />
                        ) : (
                          <ArrowUpRight className="w-4 h-4" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 text-xs text-slate-500 font-mono flex-wrap">
                          <span className="font-semibold text-slate-800">
                            {tx.reference_no}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span>{tx.sku}</span>
                          <span aria-hidden="true">·</span>
                          <span className="font-sans">{formatDateTime(tx.created_at)}</span>
                        </div>
                        <p className="text-sm font-semibold text-slate-900 truncate mt-0.5">
                          {tx.item_name}
                        </p>
                        {tx.partner_name && (
                          <p className="text-xs text-slate-500 truncate mt-0.5">
                            Mitra: {tx.partner_name}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="sm:text-right pl-11 sm:pl-0 shrink-0 font-mono tabular-nums">
                      <div
                        className={`text-sm font-bold ${
                          isInbound ? 'text-emerald-600' : 'text-amber-600'
                        }`}
                      >
                        {isInbound ? `+${tx.quantity}` : `-${tx.quantity}`}
                      </div>
                      <div className="text-xs text-slate-500">
                        Stok: {tx.stock_before} → {tx.stock_after}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};
