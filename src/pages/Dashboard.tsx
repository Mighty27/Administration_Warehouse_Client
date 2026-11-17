import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowDownLeft,
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  Boxes,
  CalendarClock,
  CheckCircle2,
  Layers,
  PieChart,
  Plus,
  XCircle,
} from 'lucide-react';
import { useWarehouse } from '../context/WarehouseContext';
import {
  calculateCategoryDistribution,
  calculateDashboardMetrics,
  calculateMovementTrend,
  calculateStockHealthSummary,
  getStockStatus,
  getStockStatusLabel,
} from '../utils/warehouseRules';

const CATEGORY_BAR_COLORS = [
  'bg-indigo-600',
  'bg-sky-500',
  'bg-emerald-500',
  'bg-amber-500',
  'bg-violet-500',
  'bg-slate-500',
];

export const Dashboard: React.FC = () => {
  const { user, items, transactions, dataLoading } = useWarehouse();
  const navigate = useNavigate();

  const [trendRangeDays, setTrendRangeDays] = useState<7 | 14>(7);
  const [selectedDayIndex, setSelectedDayIndex] = useState<number | null>(null);

  if (!user) return null;

  const metrics = calculateDashboardMetrics(items, transactions, user.id);
  const movementTrend = calculateMovementTrend(
    transactions,
    user.id,
    trendRangeDays
  );
  const categoryDistribution = calculateCategoryDistribution(items, user.id);
  const stockHealth = calculateStockHealthSummary(items, user.id);

  const activePoint =
    selectedDayIndex !== null && movementTrend.points[selectedDayIndex]
      ? movementTrend.points[selectedDayIndex]
      : movementTrend.points[movementTrend.points.length - 1];

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

  // Geometri SVG Donut Chart untuk Kesehatan SKU
  const donutRadius = 38;
  const donutCircumference = 2 * Math.PI * donutRadius;
  const totalSkuSafe = Math.max(1, metrics.totalSku);
  const amanArc = (stockHealth.amanCount / totalSkuSafe) * donutCircumference;
  const menipisArc = (stockHealth.menipisCount / totalSkuSafe) * donutCircumference;
  const habisArc = (stockHealth.habisCount / totalSkuSafe) * donutCircumference;

  return (
    <div className="space-y-8">
      {/* Header Kontekstual & Aksi Utama */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
            Ikhtisar Operasional Gudang
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-0.5">
            Data real-time terisolasi untuk <span className="font-semibold text-slate-900 dark:text-slate-100">{user.full_name}</span> · {user.warehouse_zone}
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
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500 dark:text-slate-400">
            <span>Total SKU Terdaftar</span>
            <Boxes className="w-4 h-4 text-slate-400 dark:text-slate-500" />
          </div>
          <div className="mt-3 text-2xl font-bold text-slate-900 dark:text-slate-100 font-mono tabular-nums">
            {dataLoading ? '...' : metrics.totalSku.toLocaleString('id-ID')}
          </div>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Item aktif di katalog gudang
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500 dark:text-slate-400">
            <span>Total Unit Stok Fisik</span>
            <Layers className="w-4 h-4 text-slate-400 dark:text-slate-500" />
          </div>
          <div className="mt-3 text-2xl font-bold text-slate-900 dark:text-slate-100 font-mono tabular-nums">
            {dataLoading ? '...' : metrics.totalUnits.toLocaleString('id-ID')}
          </div>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Akumulasi seluruh kuantitas barang
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500 dark:text-slate-400">
            <span>Peringatan Stok Menipis</span>
            <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
          </div>
          <div
            className={`mt-3 text-2xl font-bold font-mono tabular-nums ${
              metrics.lowStockCount > 0
                ? 'text-amber-600 dark:text-amber-400'
                : 'text-slate-900 dark:text-slate-100'
            }`}
          >
            {dataLoading ? '...' : metrics.lowStockCount.toLocaleString('id-ID')}
          </div>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            SKU dengan stok &le; batas minimum
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500 dark:text-slate-400">
            <span>Transaksi Hari Ini</span>
            <CalendarClock className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
          </div>
          <div className="mt-3 text-2xl font-bold text-slate-900 dark:text-slate-100 font-mono tabular-nums">
            {dataLoading ? '...' : metrics.todayTransactionsCount.toLocaleString('id-ID')}
          </div>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Pergerakan Inbound & Outbound
          </p>
        </div>
      </section>

      {/* BAGIAN GRAFIK ANALITIK WAREHOUSE (2 Kolom Proporsional: 7 Cols Tren Mutasi + 5 Cols Komposisi Stok) */}
      <section
        aria-label="Grafik Analitik Operasional Gudang"
        className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch"
      >
        {/* Grafik 1 (7 Cols): Tren Pergerakan Barang Harian (Inbound vs Outbound) */}
        <div className="lg:col-span-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 flex flex-col justify-between">
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-start gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0 mt-0.5">
                  <BarChart3 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                    Grafik Tren Pergerakan Barang (Inbound vs Outbound)
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Perbandingan volume unit barang masuk dan keluar per hari
                  </p>
                </div>
              </div>

              {/* Filter Rentang Hari Grafik */}
              <div
                role="group"
                aria-label="Rentang waktu grafik pergerakan"
                className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg self-start sm:self-auto shrink-0"
              >
                <button
                  type="button"
                  onClick={() => {
                    setTrendRangeDays(7);
                    setSelectedDayIndex(null);
                  }}
                  className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    trendRangeDays === 7
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
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
                  className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    trendRangeDays === 14
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                  }`}
                >
                  14 Hari
                </button>
              </div>
            </div>

            {/* Ringkasan Volume Periode & Legenda */}
            <div className="grid grid-cols-3 gap-3 py-3.5 border-b border-slate-100 dark:border-slate-800/80 text-xs">
              <div>
                <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
                  <span className="w-2.5 h-2.5 rounded-xs bg-emerald-500 inline-block shrink-0" />
                  <span>Total Masuk</span>
                </div>
                <p className="text-base font-bold text-slate-900 dark:text-slate-100 font-mono tabular-nums mt-0.5">
                  +{movementTrend.totalInbound.toLocaleString('id-ID')}{' '}
                  <span className="text-xs font-normal text-slate-500 dark:text-slate-400">unit</span>
                </p>
              </div>

              <div>
                <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
                  <span className="w-2.5 h-2.5 rounded-xs bg-amber-500 inline-block shrink-0" />
                  <span>Total Keluar</span>
                </div>
                <p className="text-base font-bold text-slate-900 dark:text-slate-100 font-mono tabular-nums mt-0.5">
                  -{movementTrend.totalOutbound.toLocaleString('id-ID')}{' '}
                  <span className="text-xs font-normal text-slate-500 dark:text-slate-400">unit</span>
                </p>
              </div>

              <div>
                <span className="text-slate-500 dark:text-slate-400 block">Selisih Bersih</span>
                <p
                  className={`text-base font-bold font-mono tabular-nums mt-0.5 ${
                    movementTrend.netFlow >= 0
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-rose-600 dark:text-rose-400'
                  }`}
                >
                  {movementTrend.netFlow >= 0
                    ? `+${movementTrend.netFlow.toLocaleString('id-ID')}`
                    : movementTrend.netFlow.toLocaleString('id-ID')}{' '}
                  <span className="text-xs font-normal text-slate-500 dark:text-slate-400">unit</span>
                </p>
              </div>
            </div>

            {/* Kanvas Grafik Batang Interaktif */}
            <div className="pt-5 pb-2">
              <div className="h-48 flex items-end gap-2 sm:gap-3 border-b border-slate-200 dark:border-slate-800 pb-2 px-1 relative">
                {/* Garis bantu horizontal */}
                <div
                  aria-hidden="true"
                  className="absolute inset-x-0 top-0 border-t border-dashed border-slate-100 dark:border-slate-800 pointer-events-none flex justify-end"
                >
                  <span className="text-[10px] font-mono text-slate-400 dark:text-slate-500 -mt-2 bg-white dark:bg-slate-900 px-1">
                    {movementTrend.maxDailyVolume}
                  </span>
                </div>
                <div
                  aria-hidden="true"
                  className="absolute inset-x-0 top-1/2 border-t border-dashed border-slate-100 dark:border-slate-800 pointer-events-none flex justify-end"
                >
                  <span className="text-[10px] font-mono text-slate-400 dark:text-slate-500 -mt-2 bg-white dark:bg-slate-900 px-1">
                    {Math.round(movementTrend.maxDailyVolume / 2)}
                  </span>
                </div>

                {movementTrend.points.map((pt, idx) => {
                  const inboundHeightPct = Math.max(
                    pt.inbound > 0 ? 6 : 2,
                    Math.round((pt.inbound / movementTrend.maxDailyVolume) * 100)
                  );
                  const outboundHeightPct = Math.max(
                    pt.outbound > 0 ? 6 : 2,
                    Math.round((pt.outbound / movementTrend.maxDailyVolume) * 100)
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
                      onMouseEnter={() => setSelectedDayIndex(idx)}
                      aria-label={`Detail mutasi ${pt.label}: Masuk ${pt.inbound} unit, Keluar ${pt.outbound} unit`}
                      className={`flex-1 h-full flex flex-col justify-end items-center group rounded-lg px-0.5 pt-2 transition-colors cursor-pointer ${
                        isSelected
                          ? 'bg-slate-100/80 dark:bg-slate-800/80'
                          : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                      }`}
                    >
                      <div className="w-full h-36 flex items-end justify-center gap-1">
                        {/* Batang Inbound */}
                        <div
                          style={{ height: `${inboundHeightPct}%` }}
                          className={`w-full max-w-[14px] rounded-t-sm transition-all duration-150 ${
                            pt.inbound > 0
                              ? 'bg-emerald-500 group-hover:bg-emerald-600'
                              : 'bg-slate-200 dark:bg-slate-700'
                          }`}
                          title={`Inbound ${pt.label}: +${pt.inbound}`}
                        />
                        {/* Batang Outbound */}
                        <div
                          style={{ height: `${outboundHeightPct}%` }}
                          className={`w-full max-w-[14px] rounded-t-sm transition-all duration-150 ${
                            pt.outbound > 0
                              ? 'bg-amber-500 group-hover:bg-amber-600'
                              : 'bg-slate-200 dark:bg-slate-700'
                          }`}
                          title={`Outbound ${pt.label}: -${pt.outbound}`}
                        />
                      </div>
                      <span
                        className={`mt-2 text-[10px] font-mono tabular-nums whitespace-nowrap ${
                          isSelected
                            ? 'font-bold text-indigo-600 dark:text-indigo-400'
                            : 'text-slate-500 dark:text-slate-400'
                        }`}
                      >
                        {trendRangeDays === 7 ? pt.label : pt.label.slice(0, 2)}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Detail Bar Hari Terpilih */}
          {activePoint && (
            <div className="mt-2 px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 rounded-lg flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="font-medium text-slate-700 dark:text-slate-300">
                Rincian <span className="font-bold text-slate-900 dark:text-slate-100">{activePoint.shortDay}, {activePoint.label}</span> ({activePoint.transactionsCount} transaksi)
              </div>
              <div className="flex items-center gap-3 font-mono tabular-nums">
                <span className="text-emerald-700 dark:text-emerald-400 font-semibold">
                  Masuk: +{activePoint.inbound}
                </span>
                <span className="text-slate-300 dark:text-slate-600" aria-hidden="true">·</span>
                <span className="text-amber-700 dark:text-amber-400 font-semibold">
                  Keluar: -{activePoint.outbound}
                </span>
                <span className="text-slate-300 dark:text-slate-600" aria-hidden="true">·</span>
                <span className="text-slate-900 dark:text-slate-100 font-bold">
                  Net: {activePoint.net >= 0 ? `+${activePoint.net}` : activePoint.net}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Grafik 2 (5 Cols): Distribusi Stok per Kategori & Proporsi Kesehatan SKU */}
        <div className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 flex flex-col justify-between space-y-5">
          <div className="flex items-start gap-2.5 pb-4 border-b border-slate-200 dark:border-slate-800">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0 mt-0.5">
              <PieChart className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Komposisi Kategori & Kesehatan Stok
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Proporsi status ketersediaan SKU dan distribusi unit per kategori
              </p>
            </div>
          </div>

          {/* Donut Ring Kesehatan SKU */}
          <div className="flex items-center gap-5 p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200/70 dark:border-slate-700/70">
            <div className="relative w-24 h-24 shrink-0 flex items-center justify-center">
              <svg
                viewBox="0 0 100 100"
                className="w-24 h-24 -rotate-90 transform"
                aria-label="Grafik Donut Kesehatan Stok SKU"
              >
                <circle
                  cx="50"
                  cy="50"
                  r={donutRadius}
                  fill="transparent"
                  className="stroke-slate-200 dark:stroke-slate-700"
                  strokeWidth="12"
                />
                {metrics.totalSku > 0 && (
                  <>
                    <circle
                      cx="50"
                      cy="50"
                      r={donutRadius}
                      fill="transparent"
                      stroke="#10b981"
                      strokeWidth="12"
                      strokeDasharray={`${amanArc} ${donutCircumference}`}
                      strokeDashoffset={0}
                    />
                    <circle
                      cx="50"
                      cy="50"
                      r={donutRadius}
                      fill="transparent"
                      stroke="#f59e0b"
                      strokeWidth="12"
                      strokeDasharray={`${menipisArc} ${donutCircumference}`}
                      strokeDashoffset={-amanArc}
                    />
                    <circle
                      cx="50"
                      cy="50"
                      r={donutRadius}
                      fill="transparent"
                      stroke="#e11d48"
                      strokeWidth="12"
                      strokeDasharray={`${habisArc} ${donutCircumference}`}
                      strokeDashoffset={-(amanArc + menipisArc)}
                    />
                  </>
                )}
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                <span className="text-sm font-bold text-slate-900 dark:text-slate-100 font-mono tabular-nums">
                  {stockHealth.amanPct}%
                </span>
                <span className="text-[10px] text-slate-500 dark:text-slate-400">Aman</span>
              </div>
            </div>

            <div className="flex-1 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 text-slate-700 dark:text-slate-300 font-medium">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <span>Stok Aman</span>
                </span>
                <span className="font-mono font-semibold text-slate-900 dark:text-slate-100 tabular-nums">
                  {stockHealth.amanCount} SKU ({stockHealth.amanPct}%)
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 text-slate-700 dark:text-slate-300 font-medium">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                  <span>Stok Menipis</span>
                </span>
                <span className="font-mono font-semibold text-amber-700 dark:text-amber-400 tabular-nums">
                  {stockHealth.menipisCount} SKU ({stockHealth.menipisPct}%)
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 text-slate-700 dark:text-slate-300 font-medium">
                  <XCircle className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400 shrink-0" />
                  <span>Stok Habis</span>
                </span>
                <span className="font-mono font-semibold text-rose-700 dark:text-rose-400 tabular-nums">
                  {stockHealth.habisCount} SKU ({stockHealth.habisPct}%)
                </span>
              </div>
            </div>
          </div>

          {/* Grafik Batang Horizontal: Distribusi Unit Stok per Kategori */}
          <div className="space-y-3 flex-1 flex flex-col justify-center">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-300">
              <span>Distribusi Unit per Kategori</span>
              <span className="font-mono text-slate-500 dark:text-slate-400 tabular-nums">
                Total: {metrics.totalUnits.toLocaleString('id-ID')} Unit
              </span>
            </div>

            {categoryDistribution.length === 0 ? (
              <p className="text-xs text-slate-500 dark:text-slate-400 py-4 text-center">
                Belum ada data kategori barang untuk ditampilkan.
              </p>
            ) : (
              <div className="space-y-2.5">
                {categoryDistribution.slice(0, 5).map((cat, idx) => {
                  const barColor =
                    CATEGORY_BAR_COLORS[idx % CATEGORY_BAR_COLORS.length];
                  return (
                    <div key={cat.category} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium text-slate-800 dark:text-slate-200 truncate pr-2">
                          {cat.category}{' '}
                          <span className="text-slate-400 dark:text-slate-500 font-mono">
                            ({cat.skuCount} SKU)
                          </span>
                        </span>
                        <span className="font-mono text-slate-700 dark:text-slate-300 font-semibold tabular-nums shrink-0">
                          {cat.totalUnits.toLocaleString('id-ID')} unit · {cat.percentage}%
                        </span>
                      </div>
                      <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                        <div
                          style={{ width: `${Math.max(4, cat.percentage)}%` }}
                          className={`h-full rounded-full transition-all duration-200 ${barColor}`}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Grid 2 Kolom: Daftar Stok Kritis/Menipis & 5 Aktivitas Transaksi Terakhir */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Kolom Kiri (5 cols): Peringatan Stok Kritis / Menipis */}
        <section className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Daftar Stok Kritis & Menipis
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Barang yang memerlukan tindakan restock segera
              </p>
            </div>
            <Link
              to="/inventory?status=MENIPIS"
              className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 inline-flex items-center gap-1 whitespace-nowrap"
            >
              <span>Semua SKU</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {criticalItems.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Seluruh Stok Berada di Level Aman
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Tidak ada SKU yang berada di bawah batas minimum stok saat ini.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-200 dark:divide-slate-800">
              {criticalItems.map((item) => {
                const status = getStockStatus(item.stock, item.min_stock);
                const isOut = status === 'HABIS';
                return (
                  <div
                    key={item.id}
                    className="p-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors flex items-center justify-between gap-4"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 font-mono">
                        <span className="font-semibold text-slate-700 dark:text-slate-300">{item.sku}</span>
                        <span aria-hidden="true">·</span>
                        <span>{item.rack_location}</span>
                        <span aria-hidden="true">·</span>
                        <span
                          className={`inline-flex items-center gap-1 font-sans font-semibold ${
                            isOut
                              ? 'text-rose-600 dark:text-rose-400'
                              : 'text-amber-600 dark:text-amber-400'
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
                      <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate mt-1">
                        {item.name}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-mono tabular-nums">
                        Sisa: <strong className="text-slate-900 dark:text-slate-100">{item.stock}</strong> {item.unit} / Min: {item.min_stock} {item.unit}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        navigate(`/transactions?item=${item.id}&type=INBOUND`)
                      }
                      className="px-3 py-1.5 text-xs font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
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
        <section className="lg:col-span-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                5 Aktivitas Transaksi Terakhir
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Mutasi barang masuk (Inbound) dan barang keluar (Outbound) terbaru
              </p>
            </div>
            <Link
              to="/transactions"
              className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 inline-flex items-center gap-1 whitespace-nowrap"
            >
              <span>Riwayat Lengkap</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {recentTransactions.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Belum Ada Aktivitas Transaksi
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 mb-4">
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
            <div className="divide-y divide-slate-200 dark:divide-slate-800">
              {recentTransactions.map((tx) => {
                const isInbound = tx.type === 'INBOUND';
                return (
                  <div
                    key={tx.id}
                    className="p-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      <div
                        className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                          isInbound
                            ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400'
                            : 'bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400'
                        }`}
                      >
                        {isInbound ? (
                          <ArrowDownLeft className="w-4 h-4" />
                        ) : (
                          <ArrowUpRight className="w-4 h-4" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 font-mono flex-wrap">
                          <span className="font-semibold text-slate-800 dark:text-slate-200">
                            {tx.reference_no}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span>{tx.sku}</span>
                          <span aria-hidden="true">·</span>
                          <span className="font-sans">{formatDateTime(tx.created_at)}</span>
                        </div>
                        <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate mt-0.5">
                          {tx.item_name}
                        </p>
                        {tx.partner_name && (
                          <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                            Mitra: {tx.partner_name}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="sm:text-right pl-11 sm:pl-0 shrink-0 font-mono tabular-nums">
                      <div
                        className={`text-sm font-bold ${
                          isInbound
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-amber-600 dark:text-amber-400'
                        }`}
                      >
                        {isInbound ? `+${tx.quantity}` : `-${tx.quantity}`}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">
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
