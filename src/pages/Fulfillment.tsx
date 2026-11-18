import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Boxes,
  CheckCircle2,
  ClipboardCheck,
  FileCheck2,
  Layers,
  MapPin,
  PackageCheck,
  Plus,
  ScanBarcode,
  ShoppingBag,
  Truck,
  X,
} from 'lucide-react';
import { useWarehouse } from '../context/WarehouseContext';
import {
  CourierService,
  OmnichannelSource,
  OrderFulfillmentStatus,
  PickingMethod,
} from '../types/warehouse';
import {
  buildBatchPickingList,
  buildClusterPickingList,
  buildZonePickingList,
  getDaysUntilExpiry,
} from '../utils/warehouseRules';

const CHANNELS: OmnichannelSource[] = [
  'Shopee Mall',
  'Tokopedia',
  'TikTok Shop',
  'B2B Distributor',
  'Website Store',
];

const COURIERS: CourierService[] = [
  'JNE Trucking',
  'Paxel Instant',
  'J&T Express',
  'SiCepat Halu',
  'Armada Logistik Internal',
];

export const Fulfillment: React.FC = () => {
  const {
    user,
    items,
    orders,
    manifests,
    createOrder,
    advanceOrderStatus,
    completeBatchPickingForSku,
    verifyOrderItemBarcode,
    verifyAllOrderItems,
    createShippingManifest,
  } = useWarehouse();

  const [statusFilter, setStatusFilter] = useState<'ALL' | OrderFulfillmentStatus>('ALL');
  const [pickingMethod, setPickingMethod] = useState<PickingMethod>('BATCH');
  const [activePackingOrderId, setActivePackingOrderId] = useState<string>('');
  const [barcodeScanInput, setBarcodeScanInput] = useState<string>('');

  // State Generator Shipping Manifest
  const [manifestCourier, setManifestCourier] = useState<CourierService>('JNE Trucking');
  const [driverName, setDriverName] = useState<string>('Agus Supriyadi');
  const [vehiclePlate, setVehiclePlate] = useState<string>('B 9821 UTX');
  const [selectedReadyOrderIds, setSelectedReadyOrderIds] = useState<string[]>([]);
  const [manifestError, setManifestError] = useState<string | null>(null);

  // State Modal Buat Pesanan Omnichannel Baru
  const [isNewOrderOpen, setIsNewOrderOpen] = useState<boolean>(false);
  const [newChannel, setNewChannel] = useState<OmnichannelSource>('Shopee Mall');
  const [newCustomer, setNewCustomer] = useState<string>('');
  const [newCourier, setNewCourier] = useState<CourierService>('Paxel Instant');
  const [newPicker, setNewPicker] = useState<string>('Rizky Pratama');
  const [newItemId, setNewItemId] = useState<string>('');
  const [newQty, setNewQty] = useState<string>('2');

  if (!user) return null;

  const filteredOrders = orders.filter((ord) =>
    statusFilter === 'ALL' ? true : ord.status === statusFilter
  );

  const batchPickingList = buildBatchPickingList(orders, user.id);
  const clusterPickingList = buildClusterPickingList(orders, user.id);
  const zonePickingList = buildZonePickingList(orders, user.id);

  const packingOrders = orders.filter((o) => o.status === 'PACKING');
  const currentPackingOrder =
    packingOrders.find((o) => o.id === activePackingOrderId) || packingOrders[0];

  const readyToShipOrders = orders.filter((o) => o.status === 'READY_TO_SHIP');

  const countByStatus = (st: OrderFulfillmentStatus) =>
    orders.filter((o) => o.status === st).length;

  const handleScanPackingBarcode = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPackingOrder || !barcodeScanInput.trim()) return;
    const res = verifyOrderItemBarcode(currentPackingOrder.id, barcodeScanInput);
    if (res.ok) {
      setBarcodeScanInput('');
    }
  };

  const toggleSelectReadyOrder = (orderId: string) => {
    setSelectedReadyOrderIds((prev) =>
      prev.includes(orderId)
        ? prev.filter((id) => id !== orderId)
        : [...prev, orderId]
    );
  };

  const handleGenerateManifest = async (e: React.FormEvent) => {
    e.preventDefault();
    setManifestError(null);

    const targetIds =
      selectedReadyOrderIds.length > 0
        ? selectedReadyOrderIds
        : readyToShipOrders.map((o) => o.id);

    const res = await createShippingManifest({
      courier: manifestCourier,
      driver_name: driverName,
      vehicle_plate: vehiclePlate,
      order_ids: targetIds,
    });

    if (!res.ok) {
      setManifestError(res.error || 'Gagal menerbitkan Shipping Manifest.');
      return;
    }

    setSelectedReadyOrderIds([]);
  };

  const handleCreateOrderSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetItem = newItemId || items[0]?.id;
    if (!targetItem) return;

    const res = await createOrder({
      channel: newChannel,
      customer_name: newCustomer || 'Pelanggan Omnichannel',
      courier: newCourier,
      assigned_picker: newPicker,
      assigned_packer: 'Dewi Lestari',
      lines: [{ item_id: targetItem, quantity: Math.max(1, Number(newQty) || 1) }],
    });

    if (res.ok) {
      setNewCustomer('');
      setIsNewOrderOpen(false);
    }
  };

  const renderStatusText = (status: OrderFulfillmentStatus) => {
    switch (status) {
      case 'PENDING':
        return (
          <span className="text-xs font-semibold text-amber-700 dark:text-amber-400">
            1. Antrean Baru
          </span>
        );
      case 'PICKING':
        return (
          <span className="text-xs font-semibold text-indigo-700 dark:text-indigo-300">
            2. Sedang Diambil (Picking)
          </span>
        );
      case 'PACKING':
        return (
          <span className="text-xs font-semibold text-amber-600 dark:text-amber-300">
            3. Validasi Packing
          </span>
        );
      case 'READY_TO_SHIP':
        return (
          <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
            4. Siap Kirim
          </span>
        );
      case 'SHIPPED':
        return (
          <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">
            5. Terkirim (Manifested)
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Pemenuhan Pesanan Terintegrasi */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
            Pemenuhan Pesanan, Strategi Picking & Shipping Manifest
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-0.5">
            Alur terpusat dari Pesanan Masuk → Batch/Cluster/Zone Picking → Validasi Barcode Packing → Shipping Manifest
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setNewItemId(items[0]?.id || '');
            setIsNewOrderOpen(true);
          }}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Simulasi Pesanan Baru</span>
        </button>
      </div>

      {/* Pipeline 5 Tahap Pemenuhan Pesanan */}
      <div
        role="group"
        aria-label="Filter tahapan pemenuhan pesanan"
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-2 flex items-center gap-1.5 overflow-x-auto"
      >
        <button
          type="button"
          onClick={() => setStatusFilter('ALL')}
          className={`px-3 py-2 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
            statusFilter === 'ALL'
              ? 'bg-indigo-600 text-white'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          Semua Pesanan ({orders.length})
        </button>
        <button
          type="button"
          onClick={() => setStatusFilter('PENDING')}
          className={`px-3 py-2 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
            statusFilter === 'PENDING'
              ? 'bg-indigo-600 text-white'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          1. Pending ({countByStatus('PENDING')})
        </button>
        <button
          type="button"
          onClick={() => setStatusFilter('PICKING')}
          className={`px-3 py-2 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
            statusFilter === 'PICKING'
              ? 'bg-indigo-600 text-white'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          2. Picking ({countByStatus('PICKING')})
        </button>
        <button
          type="button"
          onClick={() => setStatusFilter('PACKING')}
          className={`px-3 py-2 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
            statusFilter === 'PACKING'
              ? 'bg-indigo-600 text-white'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          3. Validasi Packing ({countByStatus('PACKING')})
        </button>
        <button
          type="button"
          onClick={() => setStatusFilter('READY_TO_SHIP')}
          className={`px-3 py-2 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
            statusFilter === 'READY_TO_SHIP'
              ? 'bg-indigo-600 text-white'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          4. Siap Kirim ({countByStatus('READY_TO_SHIP')})
        </button>
        <button
          type="button"
          onClick={() => setStatusFilter('SHIPPED')}
          className={`px-3 py-2 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
            statusFilter === 'SHIPPED'
              ? 'bg-indigo-600 text-white'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          5. Terkirim ({countByStatus('SHIPPED')})
        </button>
      </div>

      {/* PANEL 3 STRATEGI PICKING: BATCH PICKING, CLUSTER PICKING, ZONE PICKING */}
      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-4">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
              Pusat Strategi Pengambilan Barang (Batch, Cluster, & Zone Picking)
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Pilih metode picking sesuai karakteristik pesanan untuk mengoptimalkan rute jalan staf picker dan urutan FEFO
            </p>
          </div>

          <div
            role="group"
            aria-label="Pilih metode strategi picking"
            className="inline-flex items-center p-1 bg-slate-100 dark:bg-slate-800 rounded-lg self-start"
          >
            <button
              type="button"
              onClick={() => setPickingMethod('BATCH')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                pickingMethod === 'BATCH'
                  ? 'bg-white dark:bg-slate-900 text-indigo-700 dark:text-indigo-300 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Batch Picking (Per SKU)</span>
            </button>
            <button
              type="button"
              onClick={() => setPickingMethod('CLUSTER')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                pickingMethod === 'CLUSTER'
                  ? 'bg-white dark:bg-slate-900 text-indigo-700 dark:text-indigo-300 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              <Boxes className="w-3.5 h-3.5" />
              <span>Cluster Picking (Per Pesanan)</span>
            </button>
            <button
              type="button"
              onClick={() => setPickingMethod('ZONE')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                pickingMethod === 'ZONE'
                  ? 'bg-white dark:bg-slate-900 text-indigo-700 dark:text-indigo-300 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              <MapPin className="w-3.5 h-3.5" />
              <span>Zone Picking (Per Rak/Zona)</span>
            </button>
          </div>
        </div>

        {/* Konten Strategi 1: BATCH PICKING (Gabungan per SKU + FEFO) */}
        {pickingMethod === 'BATCH' && (
          <div className="space-y-3">
            <div className="text-xs text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/50 p-3 rounded-lg">
              <strong>Cara Kerja Batch Picking:</strong> Menggabungkan seluruh pesanan aktif yang membutuhkan SKU yang sama sehingga picker cukup berjalan sekali ke satu lokasi rak dan mengambil total akumulasi unit berdasarkan urutan <strong>FEFO terdekat</strong>.
            </div>

            {batchPickingList.length === 0 ? (
              <p className="text-xs text-slate-500 py-4 text-center">
                Tidak ada antrean pesanan berstatus Pending atau Picking.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                      <th className="py-2.5 px-3">Prioritas FEFO & Batch</th>
                      <th className="py-2.5 px-3">Koordinat Rak</th>
                      <th className="py-2.5 px-3">Kode SKU & Nama Barang</th>
                      <th className="py-2.5 px-3">Gabungan Nomor Pesanan</th>
                      <th className="py-2.5 px-3 text-right">Total Ambil</th>
                      <th className="py-2.5 px-3 text-right">Aksi Batch Pick</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-sm">
                    {batchPickingList.map((batch, idx) => {
                      const days = getDaysUntilExpiry(batch.expiry_date);
                      return (
                        <tr key={batch.sku}>
                          <td className="py-3 px-3 font-mono text-xs whitespace-nowrap">
                            <span className="font-bold text-indigo-600 dark:text-indigo-400">
                              #{idx + 1} · {batch.batch_number}
                            </span>
                            <div className="text-[11px] text-slate-500">
                              {batch.expiry_date
                                ? `Exp: ${batch.expiry_date} (${days}h)`
                                : 'Non-FEFO'}
                            </div>
                          </td>
                          <td className="py-3 px-3 font-mono text-xs font-bold text-slate-900 dark:text-slate-100 whitespace-nowrap">
                            {batch.rack_location}
                            <div className="text-[11px] font-normal text-slate-500">
                              {batch.zone}
                            </div>
                          </td>
                          <td className="py-3 px-3">
                            <div className="font-mono text-xs font-semibold text-slate-900 dark:text-slate-100">
                              {batch.sku}
                            </div>
                            <div className="text-xs text-slate-600 dark:text-slate-300">
                              {batch.item_name}
                            </div>
                          </td>
                          <td className="py-3 px-3 font-mono text-xs text-slate-600 dark:text-slate-400">
                            {batch.order_numbers.join(', ')} ({batch.order_numbers.length}{' '}
                            pesanan)
                          </td>
                          <td className="py-3 px-3 text-right font-mono font-bold text-slate-900 dark:text-slate-100 whitespace-nowrap">
                            {batch.total_qty_needed} {batch.unit}
                          </td>
                          <td className="py-3 px-3 text-right whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => completeBatchPickingForSku(batch.sku)}
                              className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold transition-colors cursor-pointer"
                            >
                              Ambil Batch SKU ({batch.total_qty_needed} {batch.unit})
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Konten Strategi 2: CLUSTER PICKING (Per Nomor Pesanan / Keranjang Tote) */}
        {pickingMethod === 'CLUSTER' && (
          <div className="space-y-3">
            <div className="text-xs text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/50 p-3 rounded-lg">
              <strong>Cara Kerja Cluster Picking:</strong> Staf picker membawa troli dengan beberapa keranjang (<code>TOTE-01</code>, <code>TOTE-02</code>, dst.) dan langsung memisahkan barang per nomor pesanan saat berjalan menyusuri lorong rak.
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {clusterPickingList.map((cluster) => (
                <div
                  key={cluster.order_id}
                  className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 flex flex-col justify-between gap-3"
                >
                  <div>
                    <div className="flex items-center justify-between text-xs font-mono">
                      <span className="font-bold text-indigo-600 dark:text-indigo-400">
                        {cluster.tote_code} · {cluster.order_no}
                      </span>
                      <span className="text-slate-500">{cluster.channel}</span>
                    </div>
                    <p className="text-sm font-bold text-slate-900 dark:text-slate-100 mt-1">
                      {cluster.customer_name}
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Picker: {cluster.assigned_picker} · Kurir: {cluster.courier}
                    </p>

                    <div className="mt-3 pt-2.5 border-t border-slate-200 dark:border-slate-800 space-y-1.5">
                      {cluster.items.map((line) => (
                        <div
                          key={line.sku}
                          className="flex items-center justify-between text-xs font-mono"
                        >
                          <span className="truncate">
                            {line.sku} ({line.rack_location})
                          </span>
                          <span className="font-bold text-slate-900 dark:text-slate-100 shrink-0 ml-2">
                            {line.quantity} {line.unit}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => advanceOrderStatus(cluster.order_id, 'PACKING')}
                    className="w-full py-2 px-3 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold transition-colors cursor-pointer"
                  >
                    Selesai Ambil {cluster.tote_code} → Kirim ke Packing
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Konten Strategi 3: ZONE PICKING (Per Kode Rak / Zona Gudang) */}
        {pickingMethod === 'ZONE' && (
          <div className="space-y-3">
            <div className="text-xs text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/50 p-3 rounded-lg">
              <strong>Cara Kerja Zone Picking:</strong> Gudang dibagi menjadi beberapa zona lantai dan baris rak. Setiap picker hanya bertugas mengambil barang yang berada di zonanya masing-masing sebelum diteruskan ke konveyor stasiun packing.
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {zonePickingList.map((z) => (
                <div
                  key={z.zone}
                  className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 space-y-3"
                >
                  <div className="border-b border-slate-200 dark:border-slate-800 pb-2.5">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                        {z.zone}
                      </h4>
                      <span className="text-xs font-mono font-semibold text-indigo-600 dark:text-indigo-400">
                        {z.total_units} Unit
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      PIC Zona: <strong>{z.assigned_picker}</strong> · Rak:{' '}
                      <span className="font-mono">{z.rack_codes.join(', ')}</span>
                    </p>
                  </div>

                  <div className="space-y-2">
                    {z.lines.map((line, i) => (
                      <div
                        key={`${line.order_id}-${line.sku}-${i}`}
                        className="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 text-xs"
                      >
                        <div className="flex items-center justify-between font-mono">
                          <span className="font-bold text-indigo-600 dark:text-indigo-400">
                            {line.rack_location}
                          </span>
                          <span>{line.order_no}</span>
                        </div>
                        <p className="font-semibold text-slate-900 dark:text-slate-100 mt-0.5 truncate">
                          {line.item_name}
                        </p>
                        <div className="flex items-center justify-between font-mono text-[11px] text-slate-500 mt-1">
                          <span>SKU: {line.sku}</span>
                          <strong className="text-slate-900 dark:text-slate-100">
                            Ambil: {line.quantity} {line.unit}
                          </strong>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* STASIUN VALIDASI BARCODE PACKING & GENERATOR SHIPPING MANIFEST */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Stasiun Validasi Barcode Packing (6 Kolom) */}
        <section className="lg:col-span-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0 mt-0.5">
                <ScanBarcode className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  Stasiun Validasi Barcode Packing (Anti Salah Kirim)
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Wajib verifikasi seluruh SKU pesanan sebelum label resi AWB dicetak
                </p>
              </div>
            </div>
          </div>

          {packingOrders.length === 0 ? (
            <div className="p-6 text-center rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800">
              <PackageCheck className="w-6 h-6 text-emerald-600 mx-auto mb-1.5" />
              <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                Meja Packing Kosong
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                Selesaikan proses Picking di atas untuk mengirim pesanan ke meja validasi packing.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label
                  htmlFor="select-packing-order"
                  className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
                >
                  Pilih Pesanan di Meja Kemas ({packingOrders.length} antrean)
                </label>
                <select
                  id="select-packing-order"
                  value={currentPackingOrder?.id || ''}
                  onChange={(e) => setActivePackingOrderId(e.target.value)}
                  className="w-full px-3 py-2 text-sm font-mono bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg"
                >
                  {packingOrders.map((ord) => (
                    <option key={ord.id} value={ord.id}>
                      {ord.order_no} — {ord.customer_name} ({ord.courier})
                    </option>
                  ))}
                </select>
              </div>

              {currentPackingOrder && (
                <>
                  <form onSubmit={handleScanPackingBarcode} className="flex gap-2">
                    <input
                      type="text"
                      value={barcodeScanInput}
                      onChange={(e) => setBarcodeScanInput(e.target.value)}
                      placeholder="Ketik / Scan Barcode atau SKU (mis. WH-PLT-1210)..."
                      aria-label="Scan barcode item packing"
                      className="flex-1 px-3 py-2 text-xs font-mono bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg"
                    />
                    <button
                      type="submit"
                      className="px-3.5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg cursor-pointer whitespace-nowrap"
                    >
                      Verifikasi Scan
                    </button>
                  </form>

                  <div className="divide-y divide-slate-200 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
                    {currentPackingOrder.items.map((line) => (
                      <div
                        key={line.sku}
                        className="p-3 flex items-center justify-between gap-3 bg-slate-50/50 dark:bg-slate-950/40"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 text-xs font-mono">
                            <span className="font-bold text-slate-900 dark:text-slate-100">
                              {line.sku}
                            </span>
                            <span className="text-slate-400">·</span>
                            <span className="text-slate-500">{line.barcode}</span>
                          </div>
                          <p className="text-xs font-medium text-slate-800 dark:text-slate-200 truncate">
                            {line.item_name} ({line.quantity} {line.unit})
                          </p>
                        </div>

                        {line.packed_verified ? (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 dark:text-emerald-400 shrink-0">
                            <CheckCircle2 className="w-4 h-4" />
                            <span>Tervalidasi</span>
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() =>
                              verifyOrderItemBarcode(currentPackingOrder.id, line.sku)
                            }
                            className="px-2.5 py-1 text-xs font-semibold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/80 hover:bg-indigo-100 rounded-md cursor-pointer shrink-0"
                          >
                            Scan Validasi
                          </button>
                        )}
                      </div>
                    ))}
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => verifyAllOrderItems(currentPackingOrder.id)}
                      className="px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 rounded-lg cursor-pointer"
                    >
                      Validasi Semua Barcode
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        advanceOrderStatus(currentPackingOrder.id, 'READY_TO_SHIP')
                      }
                      className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg cursor-pointer"
                    >
                      <ClipboardCheck className="w-4 h-4" />
                      <span>Selesai Packing & Cetak AWB ({currentPackingOrder.awb_number})</span>
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </section>

        {/* Generator Shipping Manifest (Bukti Serah Terima Kurir) (6 Kolom) */}
        <section className="lg:col-span-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0 mt-0.5">
                <Truck className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  Shipping Manifest (Bukti Serah Terima Ekspedisi)
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Terbitkan berita acara serah terima paket Siap Kirim kepada kurir penjemput
                </p>
              </div>
            </div>
            <Link
              to="/documents"
              className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline whitespace-nowrap shrink-0"
            >
              Arsip Manifest ({manifests.length})
            </Link>
          </div>

          {manifestError && (
            <div
              role="alert"
              className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-xs font-medium text-rose-700 dark:text-rose-300"
            >
              {manifestError}
            </div>
          )}

          <form onSubmit={handleGenerateManifest} className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Ekspedisi Kurir
                </label>
                <select
                  value={manifestCourier}
                  onChange={(e) => setManifestCourier(e.target.value as CourierService)}
                  className="w-full px-2.5 py-2 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg"
                >
                  {COURIERS.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Nama Driver / Kurir
                </label>
                <input
                  type="text"
                  required
                  value={driverName}
                  onChange={(e) => setDriverName(e.target.value)}
                  className="w-full px-2.5 py-2 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Plat Kendaraan
                </label>
                <input
                  type="text"
                  required
                  value={vehiclePlate}
                  onChange={(e) => setVehiclePlate(e.target.value)}
                  className="w-full px-2.5 py-2 text-xs font-mono bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <span className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Paket Berstatus Siap Kirim ({readyToShipOrders.length} paket):
              </span>
              {readyToShipOrders.length === 0 ? (
                <p className="text-xs text-slate-500 p-3 rounded-lg bg-slate-50 dark:bg-slate-800/40">
                  Belum ada pesanan berstatus Siap Kirim. Selesaikan validasi di Stasiun Packing terlebih dahulu.
                </p>
              ) : (
                <div className="space-y-1.5 max-h-40 overflow-y-auto">
                  {readyToShipOrders.map((ord) => {
                    const checked =
                      selectedReadyOrderIds.length === 0 ||
                      selectedReadyOrderIds.includes(ord.id);
                    return (
                      <label
                        key={ord.id}
                        className="flex items-center justify-between p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/40 text-xs cursor-pointer"
                      >
                        <span className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleSelectReadyOrder(ord.id)}
                          />
                          <span className="font-mono font-bold text-slate-900 dark:text-slate-100">
                            {ord.awb_number}
                          </span>
                          <span className="text-slate-500">
                            · {ord.order_no} ({ord.customer_name})
                          </span>
                        </span>
                        <span className="font-mono text-indigo-600 dark:text-indigo-400">
                          {ord.courier}
                        </span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={readyToShipOrders.length === 0}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-semibold transition-colors cursor-pointer"
            >
              <FileCheck2 className="w-4 h-4" />
              <span>Terbitkan Shipping Manifest & Serah Terima Kurir</span>
            </button>
          </form>
        </section>
      </div>

      {/* Tabel Daftar Seluruh Pesanan Omnichannel */}
      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
        <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShoppingBag className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              Daftar Pesanan Omnichannel ({filteredOrders.length})
            </h3>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/50 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                <th className="py-3 px-4">No. Pesanan & Channel</th>
                <th className="py-3 px-4">Pelanggan & Kurir (AWB)</th>
                <th className="py-3 px-4">Daftar SKU & Rak</th>
                <th className="py-3 px-4">Petugas Pick & Pack</th>
                <th className="py-3 px-4">Status Tahapan</th>
                <th className="py-3 px-4 text-right">Tindakan Cepat</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-sm">
              {filteredOrders.map((ord) => (
                <tr
                  key={ord.id}
                  className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                >
                  <td className="py-3 px-4 font-mono whitespace-nowrap">
                    <div className="text-xs font-bold text-slate-900 dark:text-slate-100">
                      {ord.order_no}
                    </div>
                    <div className="text-[11px] text-slate-500">{ord.channel}</div>
                  </td>
                  <td className="py-3 px-4">
                    <div className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                      {ord.customer_name}
                    </div>
                    <div className="text-[11px] font-mono text-slate-500">
                      {ord.courier} · {ord.awb_number}
                    </div>
                  </td>
                  <td className="py-3 px-4 text-xs font-mono text-slate-700 dark:text-slate-300">
                    {ord.items.map((i) => (
                      <div key={i.sku}>
                        {i.sku} ({i.rack_location}) × {i.quantity} {i.unit}
                      </div>
                    ))}
                  </td>
                  <td className="py-3 px-4 text-xs text-slate-600 dark:text-slate-400 whitespace-nowrap">
                    <div>Pick: {ord.assigned_picker}</div>
                    <div>Pack: {ord.assigned_packer}</div>
                  </td>
                  <td className="py-3 px-4 whitespace-nowrap">
                    {renderStatusText(ord.status)}
                    {ord.manifest_no && (
                      <div className="text-[11px] font-mono text-slate-400">
                        {ord.manifest_no}
                      </div>
                    )}
                  </td>
                  <td className="py-3 px-4 text-right whitespace-nowrap">
                    {ord.status === 'PENDING' && (
                      <button
                        type="button"
                        onClick={() => advanceOrderStatus(ord.id, 'PICKING')}
                        className="px-2.5 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-semibold cursor-pointer"
                      >
                        Mulai Picking
                      </button>
                    )}
                    {ord.status === 'PICKING' && (
                      <button
                        type="button"
                        onClick={() => advanceOrderStatus(ord.id, 'PACKING')}
                        className="px-2.5 py-1.5 rounded-lg bg-amber-600 text-white text-xs font-semibold cursor-pointer"
                      >
                        Kirim ke Packing
                      </button>
                    )}
                    {ord.status === 'PACKING' && (
                      <button
                        type="button"
                        onClick={() => setActivePackingOrderId(ord.id)}
                        className="px-2.5 py-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 text-xs font-semibold cursor-pointer"
                      >
                        Pilih di Meja Scan
                      </button>
                    )}
                    {ord.status === 'READY_TO_SHIP' && (
                      <span className="text-xs font-mono text-emerald-600 dark:text-emerald-400 font-semibold">
                        Siap Serah Terima
                      </span>
                    )}
                    {ord.status === 'SHIPPED' && (
                      <span className="text-xs font-mono text-slate-400">
                        Selesai
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Modal Simulasi Pesanan Baru */}
      {isNewOrderOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-order-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs"
        >
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl max-w-md w-full shadow-xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-800">
              <h3 id="modal-order-title" className="text-sm font-bold">
                Buat Simulasi Pesanan Omnichannel Baru
              </h3>
              <button
                type="button"
                onClick={() => setIsNewOrderOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateOrderSubmit} className="p-5 space-y-3.5">
              <div>
                <label className="block text-xs font-semibold mb-1">
                  Channel Penjualan
                </label>
                <select
                  value={newChannel}
                  onChange={(e) => setNewChannel(e.target.value as OmnichannelSource)}
                  className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg"
                >
                  {CHANNELS.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">
                  Nama Pembeli / Distributor
                </label>
                <input
                  type="text"
                  required
                  value={newCustomer}
                  onChange={(e) => setNewCustomer(e.target.value)}
                  placeholder="Contoh: PT Maju Logistik"
                  className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold mb-1">
                    Ekspedisi Kurir
                  </label>
                  <select
                    value={newCourier}
                    onChange={(e) => setNewCourier(e.target.value as CourierService)}
                    className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg"
                  >
                    {COURIERS.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">
                    Petugas Picker
                  </label>
                  <input
                    type="text"
                    value={newPicker}
                    onChange={(e) => setNewPicker(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg"
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="block text-xs font-semibold mb-1">
                    Pilih SKU Barang
                  </label>
                  <select
                    value={newItemId}
                    onChange={(e) => setNewItemId(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-mono bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg"
                  >
                    {items.map((it) => (
                      <option key={it.id} value={it.id}>
                        {it.sku} — {it.name} ({it.rack_location})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">
                    Kuantitas
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={newQty}
                    onChange={(e) => setNewQty(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-mono bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg"
                  />
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsNewOrderOpen(false)}
                  className="px-3.5 py-2 text-xs font-semibold text-slate-600 border border-slate-200 rounded-lg"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg cursor-pointer"
                >
                  Simpan Pesanan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
