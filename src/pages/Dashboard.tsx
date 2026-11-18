import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  CalendarClock,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  Layers,
  Package,
  PieChart,
  Plus,
  RefreshCw,
  Timer,
  Users,
  XCircle,
} from 'lucide-react';
import { useWarehouse } from '../context/WarehouseContext';
import {
  calculateCategoryDistribution,
  calculateDashboardMetrics,
  calculateMovementTrend,
  calculateStockHealthSummary,
  getDaysUntilExpiry,
  getFefoStatus,
  getReplenishmentCandidates,
  sortItemsByFefo,
} from '../utils/warehouseRules';

export const Dashboard: React.FC = () => {
  const {
    user,
    items,
    transactions,
    orders,
    staffMetrics,
    executeReplenishment,
  } = useWarehouse();

  const [trendRangeDays, setTrendRangeDays] = useState<7 | 14>(7);
  const [selectedDayIndex, setSelectedDayIndex] = useState<number | null>(null);

  if (!user) return null;

  const warehouseLabel = user.warehouse_name || user.warehouse_zone;

  const metrics = calculateDashboardMetrics(items, transactions, user.id);
  const replenishmentCandidates = getReplenishmentCandidates(items, user.id);
  const fefoPriorityItems = sortItemsByFefo(
    items.filter((i) => i.expiry_date !== null)
  ).slice(0, 4);

  const movementTrend = calculateMovementTrend(
    transactions,
    user.id,
    trendRangeDays
  );
  const categoryDistribution = calculateCategoryDistribution(items, user.id);
  const stockHealth = calculateStockHealthSummary(items, user.id);

  // Statistik Pipeline Pemenuhan Pesanan
  const pendingOrders = orders.filter((o) => o.status === 'PENDING').length;
  const pickingOrders = orders.filter((o) => o.status === 'PICKING').length;
  const packingOrders = orders.filter((o) => o.status === 'PACKING').length;
  const readyToShipOrders = orders.filter((o) => o.status === 'READY_TO_SHIP').length;
  const shippedOrders = orders.filter((o) => o.status === 'SHIPPED').length;

  // Rata-rata Kecepatan Pick & Pack & Akurasi Karyawan
  const avgPickPackTime =
    staffMetrics.length > 0
      ? (
          staffMetrics.reduce((s, m) => s + m.avg_pick_pack_minutes, 0) /
          staffMetrics.length
        ).toFixed(1)
      : '3.5';

  const avgAccuracyRate =
    staffMetrics.length > 0
      ? (
          staffMetrics.reduce((s, m) => s + m.accuracy_rate, 0) /
          staffMetrics.length
        ).toFixed(1)
      : '99.5';

  const activePoint =
    selectedDayIndex !== null && movementTrend.points[selectedDayIndex]
      ? movementTrend.points[selectedDayIndex]
      : movementTrend.points[movementTrend.points.length - 1];

  const donutRadius = 38;
  const donutCircumference = 2 * Math.PI * donutRadius;
  const amanArc = (stockHealth.amanPct / 100) * donutCircumference;
  const menipisArc = (stockHealth.menipisPct / 100) * donutCircumference;
  const habisArc = (stockHealth.habisPct / 100) * donutCircumference;

  return (
    <div className="space-y-6">
      {/* Header Ikhtisar Operasional */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
            Ikhtisar Operasional WMS & Performa Gudang
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-0.5">
            Pemantauan real-time lokasi rak, prioritas FEFO, Replenishment, dan pemenuhan pesanan untuk{' '}
            <span className="font-semibold text-slate-800 dark:text-slate-200">
              {user.full_name}
            </span>{' '}
            · {warehouseLabel}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <Link
            to="/fulfillment"
            className="inline-flex items-center justify-center gap-2 px-3.5 py-2 text-xs font-semibold text-slate-800 dark:text-slate-200 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors whitespace-nowrap shrink-0"
          >
            <ClipboardCheck className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            <span>Proses Pesanan ({orders.length - shippedOrders})</span>
          </Link>

          <Link
            to="/transactions"
            className="inline-flex items-center justify-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors whitespace-nowrap shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Catat Putaway / Mutasi</span>
          </Link>
        </div>
      </div>

      {/* 4 Kartu KPI Utama Enterprise WMS */}
      <section
        aria-label="Statistik Utama Gudang"
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
      >
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500 dark:text-slate-400">
            <span>Total SKU & Unit Fisik</span>
            <Package className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100">
              {metrics.totalSku} SKU
            </span>
            <span className="text-xs font-mono text-slate-500 dark:text-slate-400">
              · {(metrics.totalUnits + metrics.totalReserveUnits).toLocaleString('id-ID')} Unit
            </span>
          </div>
          <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400 font-mono">
            Rak Picking: {metrics.totalUnits} · Rak Inbound: {metrics.totalReserveUnits}
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500 dark:text-slate-400">
            <span>Pipeline Pemenuhan Pesanan</span>
            <Layers className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100">
              {orders.length} Pesanan
            </span>
            <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
              · {readyToShipOrders} Siap Kirim
            </span>
          </div>
          <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400 font-mono">
            Pending: {pendingOrders} · Pick: {pickingOrders} · Pack: {packingOrders}
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500 dark:text-slate-400">
            <span>Kecepatan Pick & Pack (SLA)</span>
            <Timer className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono tabular-nums text-emerald-700 dark:text-emerald-400">
              {avgPickPackTime} mnt
            </span>
            <span className="text-xs font-mono font-semibold text-slate-600 dark:text-slate-300">
              · Akurasi {avgAccuracyRate}%
            </span>
          </div>
          <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
            Rata-rata waktu penyelesaian per pesanan
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500 dark:text-slate-400">
            <span>Replenishment & Prioritas FEFO</span>
            <AlertTriangle className="w-4 h-4 text-amber-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono tabular-nums text-amber-600 dark:text-amber-400">
              {metrics.replenishmentNeededCount} Transfer
            </span>
            <span className="text-xs font-mono text-rose-600 dark:text-rose-400">
              · {metrics.nearExpiryCount} FEFO Dekat
            </span>
          </div>
          <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
            Rekomendasi isi ulang Rak Picking & pantauan kadaluwarsa
          </p>
        </div>
      </section>

      {/* Widget Rekomendasi Pintar: Auto-Replenishment & Prioritas FEFO */}
      <section
        aria-label="Rekomendasi Transfer Produk dan Prioritas FEFO"
        className="grid grid-cols-1 lg:grid-cols-12 gap-6"
      >
        {/* Kartu Rekomendasi Transfer Produk (Replenishment) */}
        <div className="lg:col-span-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-start justify-between gap-3 mb-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  Rekomendasi Transfer Produk (Auto-Replenishment)
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Deteksi otomatis saat stok di Rak Picking menipis namun masih tersedia stok cadangan di Rak Inbound
                </p>
              </div>
              <Link
                to="/inventory?status=MENIPIS"
                className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 inline-flex items-center gap-1 whitespace-nowrap shrink-0"
              >
                <span>Buka Peta Rak</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            {replenishmentCandidates.length === 0 ? (
              <div className="p-6 text-center rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-200/70 dark:border-slate-800">
                <CheckCircle2 className="w-6 h-6 text-emerald-600 mx-auto mb-1.5" />
                <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                  Seluruh Rak Picking Terisi Optimal
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  Tidak ada SKU yang memerlukan transfer darurat dari Rak Inbound saat ini.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-200 dark:divide-slate-800">
                {replenishmentCandidates.map((item) => (
                  <div
                    key={item.id}
                    className="py-3 first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 text-xs font-mono text-slate-500 dark:text-slate-400 flex-wrap">
                        <span className="font-semibold text-slate-900 dark:text-slate-100">
                          {item.sku}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span className="text-indigo-600 dark:text-indigo-400 font-semibold">
                          {item.inbound_rack_location} → {item.rack_location}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span className="text-amber-600 dark:text-amber-400 font-semibold">
                          Picking: {item.stock} / Min: {item.min_stock} {item.unit}
                        </span>
                      </div>
                      <p className="text-sm font-medium text-slate-900 dark:text-slate-100 mt-0.5 truncate">
                        {item.name}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                        Tersedia di Rak Inbound: {item.reserve_stock} {item.unit} · Rekomendasi isi ulang: +{item.recommendedTransferQty} {item.unit}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        executeReplenishment({
                          item_id: item.id,
                          transfer_qty: item.recommendedTransferQty,
                        })
                      }
                      className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>
                        Transfer +{item.recommendedTransferQty} {item.unit}
                      </span>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Kartu Peringatan Prioritas FEFO (First Expired, First Out) */}
        <div className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-start justify-between gap-3 mb-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  Urutan Pengambilan FEFO (First Expired, First Out)
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Batch dengan tanggal kedaluwarsa terdekat wajib diambil lebih dulu
                </p>
              </div>
              <CalendarClock className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            </div>

            <div className="divide-y divide-slate-200 dark:divide-slate-800">
              {fefoPriorityItems.map((item, idx) => {
                const daysLeft = getDaysUntilExpiry(item.expiry_date);
                const fefoState = getFefoStatus(item.expiry_date);
                return (
                  <div
                    key={item.id}
                    className="py-2.5 first:pt-0 last:pb-0 flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 text-xs font-mono text-slate-500 dark:text-slate-400">
                        <span className="font-bold text-indigo-600 dark:text-indigo-400">
                          FEFO #{idx + 1}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span className="font-semibold text-slate-900 dark:text-slate-100">
                          {item.sku}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>{item.rack_location}</span>
                      </div>
                      <p className="text-xs font-medium text-slate-900 dark:text-slate-100 truncate mt-0.5">
                        {item.name}
                      </p>
                      <p className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                        Batch: {item.batch_number} · Exp: {item.expiry_date}
                      </p>
                    </div>

                    <div className="text-right shrink-0">
                      <span
                        className={`text-xs font-mono font-bold ${
                          fefoState === 'EXPIRED'
                            ? 'text-rose-600 dark:text-rose-400'
                            : fefoState === 'NEAR_EXPIRY'
                            ? 'text-amber-600 dark:text-amber-400'
                            : 'text-emerald-600 dark:text-emerald-400'
                        }`}
                      >
                        {daysLeft !== null
                          ? daysLeft <= 0
                            ? 'Kedaluwarsa'
                            : `${daysLeft} hari lagi`
                          : '-'}
                      </span>
                      <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                        Stok: {item.stock} {item.unit}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* Grafik Analitik Operasional Gudang */}
      <section
        aria-label="Grafik Analitik Operasional Gudang"
        className="grid grid-cols-1 lg:grid-cols-12 gap-6"
      >
        {/* Grafik Batang Tren Pergerakan Barang */}
        <div className="lg:col-span-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 flex flex-col justify-between">
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <div className="flex items-start gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0 mt-0.5">
                  <BarChart3 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                    Grafik Tren Pergerakan Barang (Inbound vs Outbound)
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Perbandingan volume unit barang masuk dan keluar per hari
                  </p>
                </div>
              </div>

              <div
                role="group"
                aria-label="Rentang waktu grafik pergerakan"
                className="inline-flex items-center p-1 bg-slate-100 dark:bg-slate-800 rounded-lg self-start sm:self-auto"
              >
                <button
                  type="button"
                  onClick={() => {
                    setTrendRangeDays(7);
                    setSelectedDayIndex(null);
                  }}
                  className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                    trendRangeDays === 7
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  7 Hari
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setTrendRangeDays(14);
                    setSelectedDayIndex(null);
                  }}
                  className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                    trendRangeDays === 14
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  14 Hari
                </button>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3 py-3 border-y border-slate-100 dark:border-slate-800 mb-4">
              <div>
                <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                  <span className="w-2.5 h-2.5 rounded-xs bg-emerald-600 inline-block" />
                  <span>Total Masuk</span>
                </div>
                <p className="text-sm font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100 mt-0.5">
                  +{movementTrend.totalInbound} unit
                </p>
              </div>
              <div>
                <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                  <span className="w-2.5 h-2.5 rounded-xs bg-amber-500 inline-block" />
                  <span>Total Keluar</span>
                </div>
                <p className="text-sm font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100 mt-0.5">
                  -{movementTrend.totalOutbound} unit
                </p>
              </div>
              <div>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  Selisih Bersih
                </span>
                <p
                  className={`text-sm font-bold font-mono tabular-nums mt-0.5 ${
                    movementTrend.netFlow >= 0
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-rose-600 dark:text-rose-400'
                  }`}
                >
                  {movementTrend.netFlow >= 0
                    ? `+${movementTrend.netFlow}`
                    : movementTrend.netFlow}{' '}
                  unit
                </p>
              </div>
            </div>

            {/* Area Bar Chart */}
            <div className="relative h-44 pt-4 pb-2 flex items-end justify-between gap-1.5 border-b border-slate-200 dark:border-slate-800">
              {movementTrend.points.map((pt, idx) => {
                const inHeight = Math.round(
                  (pt.inbound / movementTrend.maxDailyVolume) * 120
                );
                const outHeight = Math.round(
                  (pt.outbound / movementTrend.maxDailyVolume) * 120
                );
                const isSelected =
                  (selectedDayIndex === null &&
                    idx === movementTrend.points.length - 1) ||
                  selectedDayIndex === idx;

                return (
                  <button
                    key={pt.dateKey}
                    type="button"
                    onClick={() => setSelectedDayIndex(idx)}
                    aria-label={`Detail mutasi ${pt.label}: Masuk ${pt.inbound} unit, Keluar ${pt.outbound} unit`}
                    className={`flex-1 flex flex-col items-center gap-1.5 py-1.5 rounded-lg transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-indigo-50/70 dark:bg-indigo-950/40'
                        : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                    }`}
                  >
                    <div className="w-full h-32 flex items-end justify-center gap-1 px-1">
                      <div
                        title={`Inbound ${pt.label}: +${pt.inbound}`}
                        style={{ height: `${Math.max(4, inHeight)}px` }}
                        className="w-2.5 sm:w-3 rounded-t-xs bg-emerald-600 transition-opacity"
                      />
                      <div
                        title={`Outbound ${pt.label}: -${pt.outbound}`}
                        style={{ height: `${Math.max(4, outHeight)}px` }}
                        className="w-2.5 sm:w-3 rounded-t-xs bg-amber-500 transition-opacity"
                      />
                    </div>
                    <span className="text-[10px] font-mono text-slate-600 dark:text-slate-400 truncate max-w-full">
                      {pt.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {activePoint && (
            <div className="mt-3 px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-800/60 flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="text-slate-600 dark:text-slate-300">
                Rincian{' '}
                <strong className="font-semibold text-slate-900 dark:text-slate-100">
                  {activePoint.shortDay}, {activePoint.label}
                </strong>{' '}
                ({activePoint.transactionsCount} transaksi)
              </span>
              <div className="flex items-center gap-2 font-mono font-semibold">
                <span className="text-emerald-700 dark:text-emerald-400">
                  Masuk: +{activePoint.inbound}
                </span>
                <span aria-hidden="true">·</span>
                <span className="text-amber-700 dark:text-amber-400">
                  Keluar: -{activePoint.outbound}
                </span>
                <span aria-hidden="true">·</span>
                <span className="text-slate-900 dark:text-slate-100">
                  Net: {activePoint.net >= 0 ? `+${activePoint.net}` : activePoint.net}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Grafik Donut Kesehatan Stok & Distribusi Kategori */}
        <div className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-start gap-2.5 mb-4">
              <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0 mt-0.5">
                <PieChart className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  Komposisi Kategori & Kesehatan Stok
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Proporsi status ketersediaan SKU di Rak Picking
                </p>
              </div>
            </div>

            <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-800 flex items-center gap-5 mb-4">
              <div className="relative w-24 h-24 shrink-0 flex items-center justify-center">
                <svg
                  viewBox="0 0 100 100"
                  className="w-24 h-24 -rotate-90"
                  role="img"
                  aria-label="Grafik Donut Kesehatan Stok SKU"
                >
                  <circle
                    cx="50"
                    cy="50"
                    r={donutRadius}
                    fill="transparent"
                    stroke="currentColor"
                    strokeWidth="12"
                    className="text-slate-200 dark:text-slate-700"
                  />
                  {stockHealth.amanPct > 0 && (
                    <circle
                      cx="50"
                      cy="50"
                      r={donutRadius}
                      fill="transparent"
                      stroke="#2e9468"
                      strokeWidth="12"
                      strokeDasharray={`${amanArc} ${donutCircumference}`}
                      strokeDashoffset={0}
                    />
                  )}
                  {stockHealth.menipisPct > 0 && (
                    <circle
                      cx="50"
                      cy="50"
                      r={donutRadius}
                      fill="transparent"
                      stroke="#cf950c"
                      strokeWidth="12"
                      strokeDasharray={`${menipisArc} ${donutCircumference}`}
                      strokeDashoffset={-amanArc}
                    />
                  )}
                  {stockHealth.habisPct > 0 && (
                    <circle
                      cx="50"
                      cy="50"
                      r={donutRadius}
                      fill="transparent"
                      stroke="#b43328"
                      strokeWidth="12"
                      strokeDasharray={`${habisArc} ${donutCircumference}`}
                      strokeDashoffset={-(amanArc + menipisArc)}
                    />
                  )}
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                  <span className="text-sm font-bold font-mono text-slate-900 dark:text-slate-100">
                    {stockHealth.amanPct}%
                  </span>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400">
                    Aman
                  </span>
                </div>
              </div>

              <div className="flex-1 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span>Stok Aman</span>
                  </span>
                  <span className="font-mono font-semibold text-slate-900 dark:text-slate-100">
                    {stockHealth.amanCount} SKU ({stockHealth.amanPct}%)
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                    <span>Stok Menipis</span>
                  </span>
                  <span className="font-mono font-semibold text-amber-600 dark:text-amber-400">
                    {stockHealth.menipisCount} SKU ({stockHealth.menipisPct}%)
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
                    <XCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                    <span>Stok Habis</span>
                  </span>
                  <span className="font-mono font-semibold text-rose-600 dark:text-rose-400">
                    {stockHealth.habisCount} SKU ({stockHealth.habisPct}%)
                  </span>
                </div>
              </div>
            </div>

            <div className="space-y-2.5">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-300">
                <span>Distribusi Unit per Kategori</span>
                <span className="font-mono">Total: {metrics.totalUnits} Unit</span>
              </div>

              <div className="space-y-2">
                {categoryDistribution.map((cat) => (
                  <div key={cat.category} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-slate-800 dark:text-slate-200 truncate">
                        {cat.category}{' '}
                        <span className="text-slate-400 font-mono">
                          ({cat.skuCount} SKU)
                        </span>
                      </span>
                      <span className="font-mono text-slate-600 dark:text-slate-400">
                        {cat.totalUnits} unit · {cat.percentage}%
                      </span>
                    </div>
                    <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div
                        style={{ width: `${Math.max(4, cat.percentage)}%` }}
                        className="h-full bg-indigo-600 rounded-full"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Tabel Laporan Performa Karyawan Gudang (Staff Performance Analytics) */}
      <section
        aria-label="Laporan Performa Karyawan Gudang"
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden"
      >
        <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0 mt-0.5">
              <Users className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Laporan Performa Karyawan Gudang (Pick, Pack, Putaway & Opname)
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Evaluasi kecepatan pemrosesan pesanan, jumlah unit ditangani, dan akurasi pemindaian barcode
              </p>
            </div>
          </div>
          <span className="text-xs font-mono text-slate-500 dark:text-slate-400">
            Target SLA Kecepatan: ≤ 4.5 menit / pesanan
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/50 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                <th className="py-3 px-4">Nama Staf Gudang</th>
                <th className="py-3 px-4">Peran Operasional</th>
                <th className="py-3 px-4">Zona / Area Tugasan</th>
                <th className="py-3 px-4 text-right">Pesanan Selesai</th>
                <th className="py-3 px-4 text-right">Unit Diproses</th>
                <th className="py-3 px-4 text-right">Rata-rata Waktu</th>
                <th className="py-3 px-4 text-right">Akurasi Scan</th>
                <th className="py-3 px-4">Status Shift</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-sm">
              {staffMetrics.map((stf) => (
                <tr
                  key={stf.staff_id}
                  className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                >
                  <td className="py-3 px-4 font-semibold text-slate-900 dark:text-slate-100 whitespace-nowrap">
                    {stf.staff_name}
                  </td>
                  <td className="py-3 px-4 text-xs text-indigo-700 dark:text-indigo-300 font-medium whitespace-nowrap">
                    {stf.role}
                  </td>
                  <td className="py-3 px-4 text-xs font-mono text-slate-600 dark:text-slate-400 whitespace-nowrap">
                    {stf.assigned_zone}
                  </td>
                  <td className="py-3 px-4 text-right font-mono font-bold text-slate-900 dark:text-slate-100 tabular-nums whitespace-nowrap">
                    {stf.orders_completed}
                  </td>
                  <td className="py-3 px-4 text-right font-mono text-slate-700 dark:text-slate-300 tabular-nums whitespace-nowrap">
                    {stf.items_processed.toLocaleString('id-ID')} unit
                  </td>
                  <td className="py-3 px-4 text-right font-mono tabular-nums whitespace-nowrap">
                    <span className="inline-flex items-center justify-end gap-1 text-emerald-700 dark:text-emerald-400 font-semibold">
                      <Clock className="w-3.5 h-3.5" />
                      <span>{stf.avg_pick_pack_minutes.toFixed(1)} mnt</span>
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right font-mono font-bold text-emerald-700 dark:text-emerald-400 tabular-nums whitespace-nowrap">
                    {stf.accuracy_rate.toFixed(1)}%
                  </td>
                  <td className="py-3 px-4 text-xs font-medium text-slate-600 dark:text-slate-400 whitespace-nowrap">
                    {stf.active_status}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};
