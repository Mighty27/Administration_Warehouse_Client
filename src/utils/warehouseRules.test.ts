import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildUserStoragePath,
  calculateDashboardMetrics,
  canUserAccessStoragePath,
  filterInventoryItems,
  generateTransactionsCsv,
  getStockStatus,
  validateDocumentUpload,
  validateTransactionInput,
} from './warehouseRules';
import { WarehouseItem, WarehouseTransaction } from '../types/warehouse';

const sampleItems: WarehouseItem[] = [
  {
    id: 'item-1',
    user_id: 'user-a',
    sku: 'WH-ELC-001',
    name: 'Industrial Barcode Scanner Zebra DS2208',
    category: 'Elektronik Gudang',
    rack_location: 'RAK-A01-02',
    stock: 25,
    min_stock: 10,
    unit: 'Unit',
    updated_at: '2026-11-17T08:00:00.000Z',
    created_at: '2026-11-10T08:00:00.000Z',
  },
  {
    id: 'item-2',
    user_id: 'user-a',
    sku: 'WH-PKG-002',
    name: 'Stretch Film Roll 50cm x 300m',
    category: 'Material Packaging',
    rack_location: 'RAK-B04-01',
    stock: 6,
    min_stock: 15,
    unit: 'Roll',
    updated_at: '2026-11-17T08:00:00.000Z',
    created_at: '2026-11-10T08:00:00.000Z',
  },
  {
    id: 'item-3',
    user_id: 'user-a',
    sku: 'WH-SAF-003',
    name: 'Sepatu Safety Steel Toe Krushers',
    category: 'APD & K3',
    rack_location: 'RAK-C02-04',
    stock: 0,
    min_stock: 8,
    unit: 'Pasang',
    updated_at: '2026-11-17T08:00:00.000Z',
    created_at: '2026-11-10T08:00:00.000Z',
  },
  {
    id: 'item-4',
    user_id: 'user-b',
    sku: 'WH-B-999',
    name: ' Forklift Hydraulic Oil 20L (Milik User B)',
    category: 'Suku Cadang',
    rack_location: 'RAK-Z09-01',
    stock: 100,
    min_stock: 10,
    unit: 'Pail',
    updated_at: '2026-11-17T08:00:00.000Z',
    created_at: '2026-11-10T08:00:00.000Z',
  },
];

test('getStockStatus mengklasifikasikan stok Aman, Menipis, dan Habis dengan tepat', () => {
  assert.equal(getStockStatus(25, 10), 'AMAN');
  assert.equal(getStockStatus(10, 10), 'MENIPIS');
  assert.equal(getStockStatus(4, 10), 'MENIPIS');
  assert.equal(getStockStatus(0, 10), 'HABIS');
});

test('calculateDashboardMetrics mengisolasi data per user_id dengan ketat', () => {
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
  assert.equal(metricsA.totalUnits, 31); // 25 + 6 + 0 (tidak termasuk 100 milik user-b)
  assert.equal(metricsA.lowStockCount, 2); // item-2 (6<=15) dan item-3 (0<=8)
  assert.equal(metricsA.todayTransactionsCount, 1);
});

test('validateTransactionInput mencegah Outbound melebihi stok dan menolak lintas user_id', () => {
  const itemA = sampleItems[0]; // stock = 25, user-a

  // Outbound melebihi stok tersedia
  const overStock = validateTransactionInput({
    item: itemA,
    userId: 'user-a',
    type: 'OUTBOUND',
    quantity: 30,
    referenceNo: 'DO-2026-009',
  });
  assert.equal(overStock.valid, false);
  assert.match(overStock.error || '', /Stok tidak mencukupi/);

  // Outbound valid
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

  // Percobaan akses lintas user (user-b mencoba mutasi barang user-a)
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

test('filterInventoryItems dan generateTransactionsCsv berfungsi akurat', () => {
  const menipisOnly = filterInventoryItems(sampleItems, 'user-a', '', 'MENIPIS');
  assert.equal(menipisOnly.length, 1);
  assert.equal(menipisOnly[0].sku, 'WH-PKG-002');

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
