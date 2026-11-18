import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildBatchPickingList,
  buildClusterPickingList,
  buildPutawayRecommendation,
  buildUserStoragePath,
  buildZonePickingList,
  calculateCategoryDistribution,
  calculateDashboardMetrics,
  calculateMovementTrend,
  calculateStockHealthSummary,
  canUserAccessStoragePath,
  filterInventoryItems,
  formatRackHierarchyCode,
  generateInventoryCsv,
  generateTransactionsCsv,
  getFefoStatus,
  getReplenishmentCandidates,
  getStockStatus,
  sortItemsByFefo,
  validateDocumentUpload,
  validateReplenishmentTransfer,
  validateTransactionInput,
} from './warehouseRules';
import {
  FulfillmentOrder,
  WarehouseItem,
  WarehouseTransaction,
} from '../types/warehouse';

const sampleItems: WarehouseItem[] = [
  {
    id: 'item-1',
    user_id: 'user-a',
    sku: 'WH-ELC-001',
    barcode: '899001122001',
    name: 'Industrial Barcode Scanner Zebra DS2208',
    category: 'Elektronik Gudang',
    floor_level: 'Lantai 1',
    aisle_row: 'Baris A',
    column_bay: 'Kolom 01',
    rack_code: 'Rak 02',
    rack_location: 'L1-A-01-R02',
    inbound_rack_location: 'INB-STG-A01',
    reserve_stock: 15,
    stock: 25,
    min_stock: 10,
    unit: 'Unit',
    batch_number: 'BATCH-2026-10A',
    expiry_date: null,
    updated_at: '2026-11-17T08:00:00.000Z',
    created_at: '2026-11-10T08:00:00.000Z',
  },
  {
    id: 'item-2',
    user_id: 'user-a',
    sku: 'WH-PKG-002',
    barcode: '899001122002',
    name: 'Stretch Film Roll 50cm x 300m',
    category: 'Material Packaging',
    floor_level: 'Lantai 1',
    aisle_row: 'Baris B',
    column_bay: 'Kolom 04',
    rack_code: 'Rak 01',
    rack_location: 'L1-B-04-R01',
    inbound_rack_location: 'INB-STG-B02',
    reserve_stock: 30,
    stock: 6,
    min_stock: 15,
    unit: 'Roll',
    batch_number: 'BATCH-2026-11B',
    expiry_date: '2026-11-28',
    updated_at: '2026-11-17T08:00:00.000Z',
    created_at: '2026-11-10T08:00:00.000Z',
  },
  {
    id: 'item-3',
    user_id: 'user-a',
    sku: 'WH-SAF-003',
    barcode: '899001122003',
    name: 'Sepatu Safety Steel Toe Krushers',
    category: 'APD & K3',
    floor_level: 'Lantai 2',
    aisle_row: 'Baris C',
    column_bay: 'Kolom 02',
    rack_code: 'Rak 04',
    rack_location: 'L2-C-02-R04',
    inbound_rack_location: 'INB-STG-C01',
    reserve_stock: 0,
    stock: 0,
    min_stock: 8,
    unit: 'Pasang',
    batch_number: 'BATCH-2026-09C',
    expiry_date: '2027-04-15',
    updated_at: '2026-11-17T08:00:00.000Z',
    created_at: '2026-11-10T08:00:00.000Z',
  },
  {
    id: 'item-4',
    user_id: 'user-b',
    sku: 'WH-B-999',
    barcode: '899009999001',
    name: 'Forklift Hydraulic Oil 20L (Milik User B)',
    category: 'Suku Cadang',
    floor_level: 'Lantai 1',
    aisle_row: 'Baris Z',
    column_bay: 'Kolom 09',
    rack_code: 'Rak 01',
    rack_location: 'L1-Z-09-R01',
    inbound_rack_location: 'INB-STG-Z01',
    reserve_stock: 20,
    stock: 100,
    min_stock: 10,
    unit: 'Pail',
    batch_number: 'BATCH-B-01',
    expiry_date: '2027-12-31',
    updated_at: '2026-11-17T08:00:00.000Z',
    created_at: '2026-11-10T08:00:00.000Z',
  },
];

test('getStockStatus dan formatRackHierarchyCode bekerja dengan akurat', () => {
  assert.equal(getStockStatus(25, 10), 'AMAN');
  assert.equal(getStockStatus(10, 10), 'MENIPIS');
  assert.equal(getStockStatus(4, 10), 'MENIPIS');
  assert.equal(getStockStatus(0, 10), 'HABIS');
  assert.equal(
    formatRackHierarchyCode('Lantai 2', 'Baris C', 'Kolom 04', 'Rak 03'),
    'L2-C-04-R03'
  );
});

test('calculateDashboardMetrics mengisolasi data per user_id dan menghitung Replenishment & FEFO', () => {
  const refDate = new Date('2026-11-17T10:00:00.000Z');
  const transactions: WarehouseTransaction[] = [
    {
      id: 'tx-1',
      user_id: 'user-a',
      item_id: 'item-1',
      sku: 'WH-ELC-001',
      item_name: 'Industrial Barcode Scanner Zebra DS2208',
      type: 'INBOUND',
      quantity: 5,
      stock_before: 20,
      stock_after: 25,
      reference_no: 'PO-2026-081',
      partner_name: 'PT Metro Logistik',
      notes: 'Restock rutin',
      created_at: '2026-11-17T09:00:00.000Z',
    },
    {
      id: 'tx-2',
      user_id: 'user-b',
      item_id: 'item-4',
      sku: 'WH-B-999',
      item_name: 'Forklift Hydraulic Oil 20L',
      type: 'INBOUND',
      quantity: 50,
      stock_before: 50,
      stock_after: 100,
      reference_no: 'PO-B-100',
      partner_name: 'Vendor B',
      notes: '',
      created_at: '2026-11-17T09:30:00.000Z',
    },
  ];

  const metricsA = calculateDashboardMetrics(sampleItems, transactions, 'user-a', refDate);
  assert.equal(metricsA.totalSku, 3);
  assert.equal(metricsA.totalUnits, 31); // 25 + 6 + 0
  assert.equal(metricsA.totalReserveUnits, 45); // 15 + 30 + 0
  assert.equal(metricsA.lowStockCount, 2); // item-2 & item-3
  assert.equal(metricsA.replenishmentNeededCount, 1); // item-2 (stock 6 <= 15 dan reserve_stock 30 > 0)
  assert.equal(metricsA.nearExpiryCount, 1); // item-2 expires 2026-11-28 (11 hari dari refDate)
  assert.equal(metricsA.todayTransactionsCount, 1);
});

test('FEFO, Guided Putaway, dan Replenishment bekerja sesuai aturan WMS', () => {
  const refDate = new Date('2026-11-18T00:00:00.000Z');
  assert.equal(getFefoStatus('2026-11-28', refDate), 'NEAR_EXPIRY');
  assert.equal(getFefoStatus('2027-06-01', refDate), 'FRESH');
  assert.equal(getFefoStatus('2026-11-10', refDate), 'EXPIRED');
  assert.equal(getFefoStatus(null, refDate), 'NO_EXPIRY');

  const sorted = sortItemsByFefo(sampleItems.filter((i) => i.user_id === 'user-a'));
  assert.equal(sorted[0].sku, 'WH-PKG-002'); // 2026-11-28 paling dekat
  assert.equal(sorted[1].sku, 'WH-SAF-003'); // 2027-04-15 berikutnya
  assert.equal(sorted[2].sku, 'WH-ELC-001'); // null terakhir

  const putawayLow = buildPutawayRecommendation(sampleItems[1]);
  assert.equal(putawayLow.suggestedTarget, 'PICKING_RACK');
  assert.equal(putawayLow.recommendedPickingRack, 'L1-B-04-R01');

  const candidates = getReplenishmentCandidates(sampleItems, 'user-a');
  assert.equal(candidates.length, 1);
  assert.equal(candidates[0].sku, 'WH-PKG-002');
  assert.equal(candidates[0].recommendedTransferQty, 24);

  const validRep = validateReplenishmentTransfer({
    item: sampleItems[1],
    userId: 'user-a',
    transferQty: 20,
  });
  assert.equal(validRep.valid, true);
  assert.equal(validRep.pickingAfter, 26);
  assert.equal(validRep.reserveAfter, 10);
});

test('Batch Picking, Cluster Picking, dan Zone Picking mengelompokkan pesanan dengan tepat', () => {
  const orders: FulfillmentOrder[] = [
    {
      id: 'ord-1',
      user_id: 'user-a',
      order_no: 'ORD-SHP-001',
      channel: 'Shopee Mall',
      customer_name: 'PT Maju Bersama',
      courier: 'Paxel Instant',
      awb_number: 'PXL-9001',
      status: 'PICKING',
      assigned_picker: 'Rizky Pratama',
      assigned_packer: 'Dewi Lestari',
      cycle_time_minutes: 3.5,
      created_at: '2026-11-18T02:00:00.000Z',
      items: [
        {
          item_id: 'item-2',
          sku: 'WH-PKG-002',
          barcode: '899001122002',
          item_name: 'Stretch Film Roll 50cm x 300m',
          rack_location: 'L1-B-04-R01',
          zone: 'Lantai 1 · Baris B',
          batch_number: 'BATCH-2026-11B',
          expiry_date: '2026-11-28',
          quantity: 4,
          picked_qty: 0,
          packed_verified: false,
          unit: 'Roll',
        },
      ],
    },
    {
      id: 'ord-2',
      user_id: 'user-a',
      order_no: 'ORD-TKP-002',
      channel: 'Tokopedia',
      customer_name: 'CV Sentosa',
      courier: 'JNE Trucking',
      awb_number: 'JNE-9002',
      status: 'PENDING',
      assigned_picker: 'Rizky Pratama',
      assigned_packer: 'Dewi Lestari',
      cycle_time_minutes: 4.0,
      created_at: '2026-11-18T02:30:00.000Z',
      items: [
        {
          item_id: 'item-2',
          sku: 'WH-PKG-002',
          barcode: '899001122002',
          item_name: 'Stretch Film Roll 50cm x 300m',
          rack_location: 'L1-B-04-R01',
          zone: 'Lantai 1 · Baris B',
          batch_number: 'BATCH-2026-11B',
          expiry_date: '2026-11-28',
          quantity: 6,
          picked_qty: 0,
          packed_verified: false,
          unit: 'Roll',
        },
      ],
    },
  ];

  const batchList = buildBatchPickingList(orders, 'user-a');
  assert.equal(batchList.length, 1);
  assert.equal(batchList[0].sku, 'WH-PKG-002');
  assert.equal(batchList[0].total_qty_needed, 10); // 4 + 6 digabung per SKU
  assert.equal(batchList[0].order_numbers.length, 2);

  const clusterList = buildClusterPickingList(orders, 'user-a');
  assert.equal(clusterList.length, 2);
  assert.equal(clusterList[0].tote_code, 'TOTE-01');

  const zoneList = buildZonePickingList(orders, 'user-a');
  assert.equal(zoneList.length, 1);
  assert.equal(zoneList[0].zone, 'Lantai 1 · Baris B');
  assert.equal(zoneList[0].total_units, 10);
});

test('validateTransactionInput mencegah Outbound melebihi stok dan menolak lintas user_id', () => {
  const itemA = sampleItems[0]; // stock = 25, user-a

  const overStock = validateTransactionInput({
    item: itemA,
    userId: 'user-a',
    type: 'OUTBOUND',
    quantity: 30,
    referenceNo: 'DO-2026-009',
  });
  assert.equal(overStock.valid, false);
  assert.match(overStock.error || '', /Stok Rak Picking tidak mencukupi/);

  const validOutbound = validateTransactionInput({
    item: itemA,
    userId: 'user-a',
    type: 'OUTBOUND',
    quantity: 10,
    referenceNo: 'DO-2026-010',
  });
  assert.equal(validOutbound.valid, true);
  assert.equal(validOutbound.stockBefore, 25);
  assert.equal(validOutbound.stockAfter, 15);

  const crossUserAttempt = validateTransactionInput({
    item: itemA,
    userId: 'user-b',
    type: 'OUTBOUND',
    quantity: 2,
    referenceNo: 'DO-HACK-01',
  });
  assert.equal(crossUserAttempt.valid, false);
  assert.match(crossUserAttempt.error || '', /RLS Isolation/);
});

test('buildUserStoragePath dan canUserAccessStoragePath menerapkan isolasi folder {user_id}/{nama_file}', () => {
  const pathA = buildUserStoragePath('uuid-user-a', 'Surat Jalan #01.pdf', 1700000000000);
  assert.equal(pathA, 'uuid-user-a/1700000000000_Surat_Jalan_01.pdf');
  assert.equal(canUserAccessStoragePath('uuid-user-a', pathA), true);
  assert.equal(canUserAccessStoragePath('uuid-user-b', pathA), false);
});

test('validateDocumentUpload membatasi ukuran <= 10MB dan ekstensi yang diizinkan', () => {
  const tooLarge = validateDocumentUpload({
    title: 'Laporan Tahunan',
    fileName: 'laporan.pdf',
    fileSize: 11 * 1024 * 1024,
  });
  assert.equal(tooLarge.valid, false);

  const badExt = validateDocumentUpload({
    title: 'Script Berbahaya',
    fileName: 'malware.exe',
    fileSize: 1024,
  });
  assert.equal(badExt.valid, false);

  const validDoc = validateDocumentUpload({
    title: 'Surat Jalan Pengiriman Batch 12',
    fileName: 'SJ_Batch_12.pdf',
    fileSize: 450 * 1024,
  });
  assert.equal(validDoc.valid, true);
});

test('filterInventoryItems, generateInventoryCsv, dan generateTransactionsCsv berfungsi akurat', () => {
  const menipisOnly = filterInventoryItems(sampleItems, 'user-a', '', 'MENIPIS');
  assert.equal(menipisOnly.length, 1);
  assert.equal(menipisOnly[0].sku, 'WH-PKG-002');

  const inventoryCsv = generateInventoryCsv(menipisOnly);
  assert.match(
    inventoryCsv,
    /Kode SKU,Barcode,Nama Barang,Kategori,Lantai,Baris,Kolom,Lokasi Rak Picking/
  );
  assert.match(inventoryCsv, /WH-PKG-002,899001122002/);

  const csv = generateTransactionsCsv([
    {
      id: 'tx-100',
      user_id: 'user-a',
      item_id: 'item-1',
      sku: 'WH-ELC-001',
      item_name: 'Scanner, Industrial',
      type: 'INBOUND',
      quantity: 12,
      stock_before: 13,
      stock_after: 25,
      reference_no: 'PO-100',
      partner_name: 'PT Sumber Jaya',
      notes: 'Kondisi baik',
      created_at: '2026-11-17T08:30:00.000Z',
    },
  ]);
  assert.match(csv, /ID Transaksi,Waktu Transaksi,No Referensi/);
  assert.match(csv, /"Scanner, Industrial"/);
});

test('calculateMovementTrend, calculateCategoryDistribution, dan calculateStockHealthSummary mengagregasi data grafik per user_id', () => {
  const refDate = new Date('2026-11-17T12:00:00.000Z');
  const txs: WarehouseTransaction[] = [
    {
      id: 'tx-c1',
      user_id: 'user-a',
      item_id: 'item-1',
      sku: 'WH-ELC-001',
      item_name: 'Scanner',
      type: 'INBOUND',
      quantity: 20,
      stock_before: 5,
      stock_after: 25,
      reference_no: 'PO-01',
      partner_name: 'Vendor',
      notes: '',
      created_at: '2026-11-17T08:00:00.000Z',
    },
    {
      id: 'tx-c2',
      user_id: 'user-a',
      item_id: 'item-2',
      sku: 'WH-PKG-002',
      item_name: 'Stretch Film',
      type: 'OUTBOUND',
      quantity: 8,
      stock_before: 14,
      stock_after: 6,
      reference_no: 'DO-01',
      partner_name: 'Packing',
      notes: '',
      created_at: '2026-11-17T09:00:00.000Z',
    },
  ];

  const trend = calculateMovementTrend(txs, 'user-a', 7, refDate);
  assert.equal(trend.points.length, 7);
  assert.equal(trend.totalInbound, 20);
  assert.equal(trend.totalOutbound, 8);
  assert.equal(trend.netFlow, 12);

  const cats = calculateCategoryDistribution(sampleItems, 'user-a');
  assert.equal(cats.length, 3);
  assert.equal(cats[0].category, 'Elektronik Gudang');
  assert.equal(cats[0].totalUnits, 25);

  const health = calculateStockHealthSummary(sampleItems, 'user-a');
  assert.equal(health.amanCount, 1);
  assert.equal(health.menipisCount, 1);
  assert.equal(health.habisCount, 1);
});
