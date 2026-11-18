import React, { useMemo, useState } from 'react';
import {
  Smartphone,
  QrCode,
  ClipboardCheck,
  ArrowDownToLine,
  PackageCheck,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  FileCheck2,
  RefreshCw,
  MapPin,
  CalendarClock,
} from 'lucide-react';
import { useWarehouse } from '../context/WarehouseContext';
import {
  buildPutawayRecommendation,
  getDaysUntilExpiry,
  getFefoStatus,
  sortItemsByFefo,
} from '../utils/warehouseRules';

type MobileMode = 'PUTAWAY' | 'PICKING' | 'PACKING';

export const MobileWms: React.FC = () => {
  const {
    items,
    orders,
    recordTransaction,
    advanceOrderStatus,
    verifyOrderItemBarcode,
    submitStockOpname,
  } = useWarehouse();

  // Sub-Modul A: PDA Mobile Scanner State
  const [pdaMode, setPdaMode] = useState<MobileMode>('PICKING');
  const [selectedPutawayItemId, setSelectedPutawayItemId] = useState<string>('');
  const [putawayQty, setPutawayQty] = useState<number>(15);
  const [putawayTarget, setPutawayTarget] = useState<'PICKING_RACK' | 'INBOUND_STAGE'>('PICKING_RACK');
  const [selectedOrderId, setSelectedOrderId] = useState<string>('');
  const [pdaLog, setPdaLog] = useState<string>('PDA Scanner siap. Pilih mode operasional di atas.');
  const [submittingPda, setSubmittingPda] = useState(false);

  // Sub-Modul B: Stock Opname State
  const [floorFilter, setFloorFilter] = useState<string>('ALL');
  const [physicalCounts, setPhysicalCounts] = useState<Record<string, number>>({});
  const [opnameReasons, setOpnameReasons] = useState<Record<string, string>>({});
  const [opnameOperator, setOpnameOperator] = useState<string>('Rizky Pratama (Auditor Gudang)');
  const [submittingOpname, setSubmittingOpname] = useState(false);

  const activePutawayItem = useMemo(
    () => items.find((i) => i.id === selectedPutawayItemId) || items[0] || null,
    [items, selectedPutawayItemId]
  );

  const putawayRec = useMemo(() => {
    if (!activePutawayItem) return null;
    return buildPutawayRecommendation(activePutawayItem);
  }, [activePutawayItem]);

  const fefoSortedItems = useMemo(() => sortItemsByFefo(items), [items]);

  const pickingOrders = useMemo(
    () => orders.filter((o) => o.status === 'PENDING' || o.status === 'PICKING'),
    [orders]
  );

  const packingOrders = useMemo(
    () => orders.filter((o) => o.status === 'PACKING'),
    [orders]
  );

  const activePackingOrder = useMemo(
    () => packingOrders.find((o) => o.id === selectedOrderId) || packingOrders[0] || null,
    [packingOrders, selectedOrderId]
  );

  const filteredOpnameItems = useMemo(() => {
    if (floorFilter === 'ALL') return items;
    return items.filter((item) => item.floor_level === floorFilter);
  }, [items, floorFilter]);

  const handleMobilePutaway = async () => {
    if (!activePutawayItem) return;
    setSubmittingPda(true);
    try {
      const targetRackLabel =
        putawayTarget === 'PICKING_RACK'
          ? activePutawayItem.rack_location
          : activePutawayItem.inbound_rack_location;

      await recordTransaction({
        item_id: activePutawayItem.id,
        type: 'INBOUND',
        quantity: putawayQty,
        putaway_target: putawayTarget,
        reference_no: `PDA-IN-${Date.now().toString().slice(-5)}`,
        partner_name: 'Inbound Dock PDA Scanner',
        batch_number: activePutawayItem.batch_number,
        expiry_date: activePutawayItem.expiry_date,
        operator_name: 'Fajar Nugroho (PDA Mobile)',
        notes: `Mobile Guided Putaway via Handheld Scanner ke ${targetRackLabel}`,
      });
      setPdaLog(
        `[SUKSES PUTAWAY] +${putawayQty} ${activePutawayItem.unit} ${activePutawayItem.sku} ditempatkan ke ${targetRackLabel}`
      );
    } finally {
      setSubmittingPda(false);
    }
  };

  const handleMobilePickingScan = async (
    orderId: string,
    orderNo: string,
    currentStatus: string
  ) => {
    setSubmittingPda(true);
    try {
      if (currentStatus === 'PENDING') {
        await advanceOrderStatus(orderId, 'PICKING');
      }
      await advanceOrderStatus(orderId, 'PACKING');
      setPdaLog(`[SUKSES PICKING FEFO] Order ${orderNo} selesai diambil & diteruskan ke Meja Packing.`);
    } finally {
      setSubmittingPda(false);
    }
  };

  const handleMobilePackingScan = (orderId: string, sku: string) => {
    const res = verifyOrderItemBarcode(orderId, sku);
    setPdaLog(res.ok ? `[BARCODE VERIFIED] ${res.message}` : `[SCAN GAGAL] ${res.message}`);
  };

  const getPhysicalCount = (itemId: string, systemStock: number): number => {
    return physicalCounts[itemId] !== undefined ? physicalCounts[itemId] : systemStock;
  };

  const opnameDiscrepancies = useMemo(() => {
    return filteredOpnameItems.filter((item) => {
      const physical = getPhysicalCount(item.id, item.stock);
      return physical - item.stock !== 0;
    });
  }, [filteredOpnameItems, physicalCounts]);

  const handleReconcileOpname = async () => {
    const entries = filteredOpnameItems.map((item) => ({
      item_id: item.id,
      actual_stock: getPhysicalCount(item.id, item.stock),
      reason: opnameReasons[item.id] || 'Penyesuaian hitung fisik Stock Opname berkala',
    }));

    setSubmittingOpname(true);
    try {
      await submitStockOpname({
        auditor_name: opnameOperator,
        zone_label: floorFilter === 'ALL' ? 'Semua Zona Gudang' : floorFilter,
        entries,
      });
    } finally {
      setSubmittingOpname(false);
    }
  };

  const handleSimulateDiscrepancy = () => {
    if (filteredOpnameItems.length === 0) return;
    const first = filteredOpnameItems[0];
    setPhysicalCounts((prev) => ({
      ...prev,
      [first.id]: Math.max(0, first.stock - 2),
    }));
    setOpnameReasons((prev) => ({
      ...prev,
      [first.id]: '2 unit kemasan penyok ditemukan saat audit rak fisik',
    }));
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 text-[11px] font-mono font-semibold uppercase tracking-wider bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 rounded">
              Handheld PDA & Audit Fisik
            </span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight mt-1">
            WMS Mobile App Simulator & Real-Time Stock Opname
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Simulasi perangkat scanner PDA petugas gudang (Putaway, Picking FEFO, Packing) & rekonsiliasi hitung fisik Stock Opname
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* SUB-MODUL A: WMS MOBILE APP SIMULATOR (PDA HANDHELD) */}
        <div className="xl:col-span-5 bg-slate-900 text-white rounded-xl border-2 border-slate-700 p-5 shadow-sm">
          <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-800">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-lg bg-indigo-600/30 border border-indigo-500/40 flex items-center justify-center text-indigo-300">
                <Smartphone className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[10px] font-mono uppercase tracking-widest text-emerald-400 block">
                  ● ZEBRA TC21 PDA SIMULATOR
                </span>
                <h2 className="text-sm font-bold text-white">LogiVault Mobile Scanner v2.4</h2>
              </div>
            </div>
            <QrCode className="w-5 h-5 text-slate-400" />
          </div>

          {/* 3 Mode Selector */}
          <div className="grid grid-cols-3 gap-1.5 bg-slate-800 p-1 rounded-lg mb-4">
            <button
              type="button"
              onClick={() => setPdaMode('PUTAWAY')}
              className={`py-2 px-2 rounded-md text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors ${
                pdaMode === 'PUTAWAY'
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              <ArrowDownToLine className="w-3.5 h-3.5" />
              Putaway
            </button>
            <button
              type="button"
              onClick={() => setPdaMode('PICKING')}
              className={`py-2 px-2 rounded-md text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors ${
                pdaMode === 'PICKING'
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              <MapPin className="w-3.5 h-3.5" />
              Picking
            </button>
            <button
              type="button"
              onClick={() => setPdaMode('PACKING')}
              className={`py-2 px-2 rounded-md text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors ${
                pdaMode === 'PACKING'
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              <PackageCheck className="w-3.5 h-3.5" />
              Packing
            </button>
          </div>

          {/* PDA Screen Area */}
          <div className="bg-slate-950 border border-slate-800 rounded-lg p-4 space-y-4">
            {pdaMode === 'PUTAWAY' && activePutawayItem && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono text-indigo-400 uppercase font-semibold">
                    Mode 1 · Guided Putaway Scanner
                  </span>
                  <span className="text-[11px] font-mono text-slate-400">
                    Batch: {activePutawayItem.batch_number}
                  </span>
                </div>

                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">Scan / Pilih SKU Inbound</label>
                  <select
                    value={activePutawayItem.id}
                    onChange={(e) => setSelectedPutawayItemId(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-slate-900 border border-slate-700 rounded-lg text-white"
                  >
                    {items.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.sku} — {item.name}
                      </option>
                    ))}
                  </select>
                </div>

                {putawayRec && (
                  <div className="p-3 rounded-lg bg-indigo-950/60 border border-indigo-800/70 text-xs space-y-1">
                    <div className="flex items-center gap-1.5 text-indigo-300 font-semibold">
                      <Sparkles className="w-3.5 h-3.5" />
                      Rekomendasi Rak:{' '}
                      {putawayRec.suggestedTarget === 'PICKING_RACK'
                        ? putawayRec.recommendedPickingRack
                        : putawayRec.recommendedInboundRack}
                    </div>
                    <p className="text-[11px] text-slate-300">{putawayRec.reason}</p>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">Kuantitas Masuk</label>
                    <input
                      type="number"
                      min={1}
                      value={putawayQty}
                      onChange={(e) => setPutawayQty(Math.max(1, Number(e.target.value)))}
                      className="w-full px-3 py-1.5 text-xs font-mono bg-slate-900 border border-slate-700 rounded-lg text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">Target Rak</label>
                    <select
                      value={putawayTarget}
                      onChange={(e) =>
                        setPutawayTarget(e.target.value as 'PICKING_RACK' | 'INBOUND_STAGE')
                      }
                      className="w-full px-2.5 py-1.5 text-xs bg-slate-900 border border-slate-700 rounded-lg text-white"
                    >
                      <option value="PICKING_RACK">
                        Rak Picking ({activePutawayItem.rack_location})
                      </option>
                      <option value="INBOUND_STAGE">
                        Inbound Staging ({activePutawayItem.inbound_rack_location})
                      </option>
                    </select>
                  </div>
                </div>

                <button
                  type="button"
                  disabled={submittingPda}
                  onClick={handleMobilePutaway}
                  className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg flex items-center justify-center gap-2 transition-colors"
                >
                  <QrCode className="w-4 h-4" />
                  Scan Barcode Rak & Konfirmasi Putaway
                </button>
              </div>
            )}

            {pdaMode === 'PICKING' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono text-indigo-400 uppercase font-semibold">
                    Mode 2 · Mobile Picking (FEFO Priority)
                  </span>
                  <span className="text-[11px] font-mono text-slate-400">
                    {pickingOrders.length} Antrean Order
                  </span>
                </div>

                {/* Top FEFO Recommendation */}
                {fefoSortedItems.slice(0, 2).map((item) => {
                  const days = getDaysUntilExpiry(item.expiry_date);
                  return (
                    <div
                      key={item.id}
                      className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-between text-xs"
                    >
                      <div>
                        <span className="font-mono font-bold text-amber-400">{item.rack_location}</span>
                        <span className="mx-1.5 text-slate-600">•</span>
                        <span className="font-medium text-white">{item.sku}</span>
                        <p className="text-[11px] text-slate-400 truncate max-w-[210px]">{item.name}</p>
                      </div>
                      <span className="px-2 py-0.5 text-[10px] font-mono bg-amber-950/80 text-amber-300 border border-amber-800 rounded">
                        FEFO {days !== null ? `${days}h` : 'N/A'}
                      </span>
                    </div>
                  );
                })}

                <div className="space-y-2 pt-1">
                  {pickingOrders.length === 0 ? (
                    <p className="text-xs text-slate-400 text-center py-3">
                      Semua antrean order telah selesai di-pick!
                    </p>
                  ) : (
                    pickingOrders.map((order) => (
                      <div
                        key={order.id}
                        className="p-3 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-between gap-2"
                      >
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-mono font-bold text-white">
                              {order.order_no}
                            </span>
                            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-indigo-950 text-indigo-300">
                              {order.channel}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-400 mt-0.5">
                            {order.items.map((i) => `${i.sku} (${i.quantity}x @ ${i.rack_location})`).join(', ')}
                          </p>
                        </div>
                        <button
                          type="button"
                          disabled={submittingPda}
                          onClick={() => handleMobilePickingScan(order.id, order.order_no, order.status)}
                          className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-lg shrink-0"
                        >
                          Scan Pick
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {pdaMode === 'PACKING' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono text-indigo-400 uppercase font-semibold">
                    Mode 3 · Mobile Packing Validation
                  </span>
                  <span className="text-[11px] font-mono text-slate-400">
                    {packingOrders.length} Order di Meja Pack
                  </span>
                </div>

                {packingOrders.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-4">
                    Tidak ada pesanan berstatus PACKING saat ini.
                  </p>
                ) : (
                  <>
                    <select
                      value={activePackingOrder?.id || ''}
                      onChange={(e) => setSelectedOrderId(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-slate-900 border border-slate-700 rounded-lg text-white"
                    >
                      {packingOrders.map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.order_no} — {o.customer_name} ({o.channel})
                        </option>
                      ))}
                    </select>

                    {activePackingOrder && (
                      <div className="space-y-2">
                        {activePackingOrder.items.map((item) => (
                          <div
                            key={item.sku}
                            className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-between"
                          >
                            <div>
                              <span className="text-xs font-mono font-bold text-white">{item.sku}</span>
                              <p className="text-[11px] text-slate-400">
                                Qty: {item.quantity} • Scanned: {item.picked_qty}/{item.quantity}
                              </p>
                            </div>
                            {item.packed_verified ? (
                              <span className="inline-flex items-center gap-1 text-xs font-mono text-emerald-400">
                                <CheckCircle2 className="w-4 h-4" /> Verified
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleMobilePackingScan(activePackingOrder.id, item.sku)}
                                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg"
                              >
                                Scan SKU
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {/* PDA Status Console Log */}
            <div className="p-2.5 rounded bg-slate-900 border border-slate-800 text-[11px] font-mono text-emerald-400">
              {pdaLog}
            </div>
          </div>
        </div>

        {/* SUB-MODUL B: REAL-TIME STOCK OPNAME & REKONSILIASI */}
        <div className="xl:col-span-7 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 mb-4 border-b border-slate-200 dark:border-slate-800">
            <div>
              <div className="flex items-center gap-2">
                <ClipboardCheck className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  Real-Time Stock Opname & Rekonsiliasi Selisih
                </h2>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Bandingkan stok buku sistem dengan kuantitas hitung fisik di rak tanpa menghentikan operasional
              </p>
            </div>

            <div className="flex items-center gap-2">
              <select
                value={floorFilter}
                onChange={(e) => setFloorFilter(e.target.value)}
                aria-label="Filter Lantai Opname"
                className="px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200"
              >
                <option value="ALL">Semua Lantai ({items.length} SKU)</option>
                <option value="Lantai 1">Zona Lantai 1</option>
                <option value="Lantai 2">Zona Lantai 2</option>
              </select>
              <button
                type="button"
                onClick={handleSimulateDiscrepancy}
                className="px-3 py-1.5 text-xs font-medium text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 rounded-lg hover:bg-amber-100 transition-colors"
              >
                Simulasi Selisih (-2)
              </button>
            </div>
          </div>

          {/* Summary Bar */}
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
              <span className="text-[11px] text-slate-500 dark:text-slate-400 block">SKU Diaudit</span>
              <span className="text-lg font-bold font-mono text-slate-900 dark:text-white">
                {filteredOpnameItems.length} SKU
              </span>
            </div>
            <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
              <span className="text-[11px] text-slate-500 dark:text-slate-400 block">Selisih Ditemukan</span>
              <span
                className={`text-lg font-bold font-mono ${
                  opnameDiscrepancies.length > 0
                    ? 'text-amber-600 dark:text-amber-400'
                    : 'text-emerald-600 dark:text-emerald-400'
                }`}
              >
                {opnameDiscrepancies.length} SKU
              </span>
            </div>
            <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
              <label className="text-[11px] text-slate-500 dark:text-slate-400 block">Auditor Pelaksana</label>
              <input
                type="text"
                value={opnameOperator}
                onChange={(e) => setOpnameOperator(e.target.value)}
                className="w-full text-xs font-medium bg-transparent text-slate-900 dark:text-white focus:outline-none mt-0.5"
              />
            </div>
          </div>

          {/* Opname Table */}
          <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-lg">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/70 border-b border-slate-200 dark:border-slate-800 text-[11px] font-mono uppercase text-slate-500 dark:text-slate-400">
                  <th className="py-2.5 px-3">Rak & SKU</th>
                  <th className="py-2.5 px-3 text-right">Stok Sistem</th>
                  <th className="py-2.5 px-3 text-center">Hitung Fisik</th>
                  <th className="py-2.5 px-3 text-right">Variance</th>
                  <th className="py-2.5 px-3">Catatan Audit / Alasan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-xs">
                {filteredOpnameItems.map((item) => {
                  const physical = getPhysicalCount(item.id, item.stock);
                  const variance = physical - item.stock;
                  const fefo = getFefoStatus(item.expiry_date);
                  return (
                    <tr
                      key={item.id}
                      className={
                        variance !== 0
                          ? 'bg-amber-50/50 dark:bg-amber-950/20'
                          : 'hover:bg-slate-50/80 dark:hover:bg-slate-800/40'
                      }
                    >
                      <td className="py-2.5 px-3">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">
                            {item.rack_location}
                          </span>
                          <span className="font-mono text-slate-700 dark:text-slate-300">{item.sku}</span>
                          {(fefo === 'EXPIRED' || fefo === 'NEAR_EXPIRY') && (
                            <CalendarClock className="w-3.5 h-3.5 text-rose-500" />
                          )}
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate max-w-[180px]">
                          {item.name}
                        </p>
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-semibold text-slate-700 dark:text-slate-300">
                        {item.stock} {item.unit}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <input
                          type="number"
                          min={0}
                          aria-label={`Hitung fisik ${item.sku}`}
                          value={physical}
                          onChange={(e) =>
                            setPhysicalCounts((prev) => ({
                              ...prev,
                              [item.id]: Math.max(0, Number(e.target.value)),
                            }))
                          }
                          className="w-20 px-2 py-1 text-center font-mono font-bold text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded text-slate-900 dark:text-white"
                        />
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold">
                        {variance === 0 ? (
                          <span className="text-emerald-600 dark:text-emerald-400">0 (Cocok)</span>
                        ) : (
                          <span
                            className={
                              variance > 0
                                ? 'text-indigo-600 dark:text-indigo-400'
                                : 'text-rose-600 dark:text-rose-400'
                            }
                          >
                            {variance > 0 ? `+${variance}` : variance} {item.unit}
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3">
                        <input
                          type="text"
                          placeholder="Catatan selisih..."
                          value={opnameReasons[item.id] || ''}
                          onChange={(e) =>
                            setOpnameReasons((prev) => ({
                              ...prev,
                              [item.id]: e.target.value,
                            }))
                          }
                          className="w-full px-2 py-1 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded text-slate-800 dark:text-slate-200"
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Action Footer */}
          <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
              {opnameDiscrepancies.length > 0 ? (
                <>
                  <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
                  <span>
                    Terdapat <strong>{opnameDiscrepancies.length} SKU</strong> dengan selisih stok fisik. Rekonsiliasi akan mencatat mutasi <code>OPNAME_ADJUSTMENT</code> & menerbitkan Berita Acara di Cloud File Vault.
                  </span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span>Seluruh stok fisik cocok 100% dengan stok sistem. Anda tetap dapat menyimpan Berita Acara Audit.</span>
                </>
              )}
            </div>

            <button
              type="button"
              disabled={submittingOpname}
              onClick={handleReconcileOpname}
              className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-semibold rounded-lg flex items-center justify-center gap-2 shrink-0 transition-colors"
            >
              {submittingOpname ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <FileCheck2 className="w-4 h-4" />
              )}
              Setujui & Rekonsiliasi Stock Opname
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
