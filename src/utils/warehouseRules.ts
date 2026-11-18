import {
  DashboardMetrics,
  FefoStatus,
  FulfillmentOrder,
  StockStatus,
  TransactionType,
  WarehouseDocument,
  WarehouseItem,
  WarehouseTransaction,
} from '../types/warehouse';

export const MAX_UPLOAD_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

export const ALLOWED_EXTENSIONS = [
  '.pdf',
  '.jpg',
  '.jpeg',
  '.png',
  '.xlsx',
  '.xls',
  '.docx',
  '.doc',
  '.txt',
];

/**
 * Membentuk kode lokasi rak gabungan dari hierarki Lantai -> Baris -> Kolom -> Rak
 * Contoh: Lantai 1, Baris A, Kolom 02, Rak 03 -> L1-A-02-R03
 */
export function formatRackHierarchyCode(
  floorLevel: string,
  aisleRow: string,
  columnBay: string,
  rackCode: string
): string {
  const f = floorLevel.replace(/[^0-9]/g, '') || '1';
  const a =
    aisleRow
      .replace(/baris/i, '')
      .trim()
      .toUpperCase() || 'A';
  const c =
    columnBay
      .replace(/[^0-9]/g, '')
      .padStart(2, '0') || '01';
  const r =
    rackCode
      .replace(/[^0-9]/g, '')
      .padStart(2, '0') || '01';
  return `L${f}-${a}-${c}-R${r}`;
}

/**
 * Menentukan status stok barang di Rak Picking berdasarkan stok saat ini dan batas minimum stok.
 * - HABIS: stock <= 0
 * - MENIPIS: stock > 0 dan stock <= min_stock
 * - AMAN: stock > min_stock
 */
export function getStockStatus(stock: number, minStock: number): StockStatus {
  if (stock <= 0) {
    return 'HABIS';
  }
  if (stock <= minStock) {
    return 'MENIPIS';
  }
  return 'AMAN';
}

/**
 * Mengembalikan label bahasa Indonesia untuk status stok
 */
export function getStockStatusLabel(status: StockStatus): string {
  switch (status) {
    case 'AMAN':
      return 'Aman';
    case 'MENIPIS':
      return 'Menipis';
    case 'HABIS':
      return 'Habis';
  }
}

/**
 * Menghitung sisa hari hingga tanggal kedaluwarsa (FEFO).
 * Mengembalikan null jika barang tidak memiliki expiry_date.
 */
export function getDaysUntilExpiry(
  expiryDate: string | null | undefined,
  referenceDate: Date = new Date()
): number | null {
  if (!expiryDate) return null;
  const exp = new Date(expiryDate);
  if (Number.isNaN(exp.getTime())) return null;

  const refStart = new Date(
    referenceDate.getFullYear(),
    referenceDate.getMonth(),
    referenceDate.getDate()
  );
  const expStart = new Date(exp.getFullYear(), exp.getMonth(), exp.getDate());
  const diffMs = expStart.getTime() - refStart.getTime();
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * Menentukan status FEFO (First Expired, First Out)
 * - EXPIRED: <= 0 hari
 * - NEAR_EXPIRY: 1 s/d 45 hari
 * - FRESH: > 45 hari
 * - NO_EXPIRY: tidak memiliki tanggal kedaluwarsa
 */
export function getFefoStatus(
  expiryDate: string | null | undefined,
  referenceDate: Date = new Date()
): FefoStatus {
  const days = getDaysUntilExpiry(expiryDate, referenceDate);
  if (days === null) return 'NO_EXPIRY';
  if (days <= 0) return 'EXPIRED';
  if (days <= 45) return 'NEAR_EXPIRY';
  return 'FRESH';
}

/**
 * Mengurutkan daftar barang berdasarkan prioritas FEFO (masa kedaluwarsa terdekat di urutan pertama).
 * Barang tanpa tanggal kedaluwarsa ditempatkan di bagian akhir.
 */
export function sortItemsByFefo<T extends { expiry_date?: string | null; sku?: string }>(
  list: T[]
): T[] {
  return [...list].sort((a, b) => {
    const aHas = Boolean(a.expiry_date);
    const bHas = Boolean(b.expiry_date);
    if (aHas && !bHas) return -1;
    if (!aHas && bHas) return 1;
    if (a.expiry_date && b.expiry_date) {
      const diff =
        new Date(a.expiry_date).getTime() - new Date(b.expiry_date).getTime();
      if (diff !== 0) return diff;
    }
    return (a.sku || '').localeCompare(b.sku || '');
  });
}

/**
 * Menghasilkan rekomendasi Putaway cerdas saat barang masuk (Inbound)
 * berdasarkan lokasi rak existing SKU yang sama atau zona kategori.
 */
export function buildPutawayRecommendation(item: WarehouseItem | undefined): {
  recommendedPickingRack: string;
  recommendedInboundRack: string;
  hierarchySummary: string;
  suggestedTarget: 'PICKING_RACK' | 'INBOUND_STAGE';
  reason: string;
} {
  if (!item) {
    return {
      recommendedPickingRack: 'L1-A-01-R01',
      recommendedInboundRack: 'INB-STG-A01',
      hierarchySummary: 'Lantai 1 · Baris A · Kolom 01 · Rak 01',
      suggestedTarget: 'PICKING_RACK',
      reason: 'Pilih SKU untuk melihat rekomendasi koordinat rak penyimpanan.',
    };
  }

  const hierarchySummary = `${item.floor_level} · ${item.aisle_row} · ${item.column_bay} · ${item.rack_code}`;
  const isPickingLow = item.stock <= item.min_stock;

  if (isPickingLow) {
    return {
      recommendedPickingRack: item.rack_location,
      recommendedInboundRack: item.inbound_rack_location,
      hierarchySummary,
      suggestedTarget: 'PICKING_RACK',
      reason: `Stok Rak Picking (${item.stock} ${item.unit}) berada di bawah/sama dengan batas minimum (${item.min_stock} ${item.unit}). Disarankan langsung Putaway ke Rak Picking ${item.rack_location}.`,
    };
  }

  return {
    recommendedPickingRack: item.rack_location,
    recommendedInboundRack: item.inbound_rack_location,
    hierarchySummary,
    suggestedTarget: 'INBOUND_STAGE',
    reason: `Rak Picking ${item.rack_location} masih mencukupi (${item.stock} ${item.unit}). Disarankan simpan buffer di Rak Inbound ${item.inbound_rack_location} untuk cadangan Replenishment.`,
  };
}

/**
 * Mengambil daftar barang yang memerlukan Transfer Replenishment:
 * yaitu stok di Rak Picking <= min_stock DAN memiliki reserve_stock > 0 di Rak Inbound.
 */
export function getReplenishmentCandidates(
  items: WarehouseItem[],
  userId: string
): Array<
  WarehouseItem & {
    recommendedTransferQty: number;
    shortageQty: number;
  }
> {
  return items
    .filter((item) => item.user_id === userId)
    .filter((item) => item.stock <= item.min_stock && item.reserve_stock > 0)
    .map((item) => {
      const targetLevel = Math.max(item.min_stock * 2, item.min_stock + 10);
      const needed = Math.max(1, targetLevel - item.stock);
      const recommendedTransferQty = Math.min(item.reserve_stock, needed);
      return {
        ...item,
        shortageQty: Math.max(0, item.min_stock - item.stock + 1),
        recommendedTransferQty,
      };
    })
    .sort((a, b) => a.stock - b.stock);
}

/**
 * Validasi transfer Replenishment dari Rak Inbound (reserve_stock) ke Rak Picking (stock)
 */
export function validateReplenishmentTransfer(params: {
  item: WarehouseItem | undefined;
  userId: string;
  transferQty: number;
}): {
  valid: boolean;
  error?: string;
  pickingBefore: number;
  pickingAfter: number;
  reserveBefore: number;
  reserveAfter: number;
} {
  const { item, userId, transferQty } = params;
  if (!item) {
    return {
      valid: false,
      error: 'SKU barang tidak ditemukan.',
      pickingBefore: 0,
      pickingAfter: 0,
      reserveBefore: 0,
      reserveAfter: 0,
    };
  }
  if (item.user_id !== userId) {
    return {
      valid: false,
      error: 'Akses ditolak: Barang ini bukan milik akun Anda (RLS Isolation).',
      pickingBefore: item.stock,
      pickingAfter: item.stock,
      reserveBefore: item.reserve_stock,
      reserveAfter: item.reserve_stock,
    };
  }
  if (!Number.isInteger(transferQty) || transferQty <= 0) {
    return {
      valid: false,
      error: 'Kuantitas transfer replenishment harus berupa angka bulat > 0.',
      pickingBefore: item.stock,
      pickingAfter: item.stock,
      reserveBefore: item.reserve_stock,
      reserveAfter: item.reserve_stock,
    };
  }
  if (transferQty > item.reserve_stock) {
    return {
      valid: false,
      error: `Stok di Rak Inbound (${item.inbound_rack_location}) hanya tersedia ${item.reserve_stock} ${item.unit}.`,
      pickingBefore: item.stock,
      pickingAfter: item.stock,
      reserveBefore: item.reserve_stock,
      reserveAfter: item.reserve_stock,
    };
  }

  return {
    valid: true,
    pickingBefore: item.stock,
    pickingAfter: item.stock + transferQty,
    reserveBefore: item.reserve_stock,
    reserveAfter: item.reserve_stock - transferQty,
  };
}

export interface BatchPickLine {
  item_id: string;
  sku: string;
  barcode: string;
  item_name: string;
  rack_location: string;
  zone: string;
  batch_number: string;
  expiry_date: string | null;
  total_qty_needed: number;
  total_picked_qty: number;
  unit: string;
  order_numbers: string[];
  order_ids: string[];
  fefo_status: FefoStatus;
}

/**
 * Strategi 1 — Batch Picking:
 * Menggabungkan kebutuhan barang dari beberapa pesanan aktif (PENDING / PICKING) per SKU yang sama,
 * diurutkan berdasarkan prioritas FEFO (tanggal kedaluwarsa terdekat) dan lokasi rak.
 */
export function buildBatchPickingList(
  orders: FulfillmentOrder[],
  userId: string,
  referenceDate: Date = new Date()
): BatchPickLine[] {
  const activeOrders = orders.filter(
    (o) =>
      o.user_id === userId &&
      (o.status === 'PENDING' || o.status === 'PICKING')
  );

  const map = new Map<string, BatchPickLine>();

  for (const order of activeOrders) {
    for (const line of order.items) {
      const existing = map.get(line.sku);
      if (existing) {
        existing.total_qty_needed += line.quantity;
        existing.total_picked_qty += line.picked_qty;
        if (!existing.order_numbers.includes(order.order_no)) {
          existing.order_numbers.push(order.order_no);
        }
        if (!existing.order_ids.includes(order.id)) {
          existing.order_ids.push(order.id);
        }
      } else {
        map.set(line.sku, {
          item_id: line.item_id,
          sku: line.sku,
          barcode: line.barcode,
          item_name: line.item_name,
          rack_location: line.rack_location,
          zone: line.zone,
          batch_number: line.batch_number,
          expiry_date: line.expiry_date,
          total_qty_needed: line.quantity,
          total_picked_qty: line.picked_qty,
          unit: line.unit,
          order_numbers: [order.order_no],
          order_ids: [order.id],
          fefo_status: getFefoStatus(line.expiry_date, referenceDate),
        });
      }
    }
  }

  return sortItemsByFefo(Array.from(map.values()));
}

export interface ClusterPickGroup {
  tote_code: string;
  order_id: string;
  order_no: string;
  channel: string;
  customer_name: string;
  courier: string;
  assigned_picker: string;
  status: string;
  total_sku: number;
  total_units: number;
  items: FulfillmentOrder['items'];
}

/**
 * Strategi 2 — Cluster Picking:
 * Mengelompokkan pengambilan barang berdasarkan nomor pesanan / keranjang tote (multi-tote cart).
 */
export function buildClusterPickingList(
  orders: FulfillmentOrder[],
  userId: string
): ClusterPickGroup[] {
  return orders
    .filter(
      (o) =>
        o.user_id === userId &&
        (o.status === 'PENDING' || o.status === 'PICKING')
    )
    .map((order, idx) => ({
      tote_code: `TOTE-0${idx + 1}`,
      order_id: order.id,
      order_no: order.order_no,
      channel: order.channel,
      customer_name: order.customer_name,
      courier: order.courier,
      assigned_picker: order.assigned_picker,
      status: order.status,
      total_sku: order.items.length,
      total_units: order.items.reduce((sum, i) => sum + i.quantity, 0),
      items: order.items,
    }));
}

export interface ZonePickGroup {
  zone: string;
  assigned_picker: string;
  rack_codes: string[];
  total_units: number;
  lines: Array<{
    order_id: string;
    order_no: string;
    sku: string;
    barcode: string;
    item_name: string;
    rack_location: string;
    batch_number: string;
    expiry_date: string | null;
    quantity: number;
    unit: string;
  }>;
}

/**
 * Strategi 3 — Zone Picking:
 * Membagi penugasan pengambilan barang berdasarkan Zona Lantai & Baris Rak gudang.
 */
export function buildZonePickingList(
  orders: FulfillmentOrder[],
  userId: string
): ZonePickGroup[] {
  const activeOrders = orders.filter(
    (o) =>
      o.user_id === userId &&
      (o.status === 'PENDING' || o.status === 'PICKING')
  );

  const zoneMap = new Map<string, ZonePickGroup>();

  for (const order of activeOrders) {
    for (const item of order.items) {
      const zoneName = item.zone || 'Lantai 1 · Baris A';
      const existing = zoneMap.get(zoneName);
      const lineEntry = {
        order_id: order.id,
        order_no: order.order_no,
        sku: item.sku,
        barcode: item.barcode,
        item_name: item.item_name,
        rack_location: item.rack_location,
        batch_number: item.batch_number,
        expiry_date: item.expiry_date,
        quantity: item.quantity,
        unit: item.unit,
      };

      if (existing) {
        existing.total_units += item.quantity;
        if (!existing.rack_codes.includes(item.rack_location)) {
          existing.rack_codes.push(item.rack_location);
        }
        existing.lines.push(lineEntry);
      } else {
        zoneMap.set(zoneName, {
          zone: zoneName,
          assigned_picker: order.assigned_picker,
          rack_codes: [item.rack_location],
          total_units: item.quantity,
          lines: [lineEntry],
        });
      }
    }
  }

  return Array.from(zoneMap.values()).sort((a, b) =>
    a.zone.localeCompare(b.zone)
  );
}

/**
 * Menghitung kartu statistik utama untuk Dashboard Ringkasan
 * Hanya menghitung record milik user_id yang sedang aktif.
 */
export function calculateDashboardMetrics(
  items: WarehouseItem[],
  transactions: WarehouseTransaction[],
  userId: string,
  referenceDate: Date = new Date()
): DashboardMetrics {
  const userItems = items.filter((item) => item.user_id === userId);
  const userTransactions = transactions.filter((tx) => tx.user_id === userId);

  const totalSku = userItems.length;
  const totalUnits = userItems.reduce(
    (sum, item) => sum + Math.max(0, item.stock),
    0
  );
  const totalReserveUnits = userItems.reduce(
    (sum, item) => sum + Math.max(0, item.reserve_stock || 0),
    0
  );
  const lowStockCount = userItems.filter(
    (item) => item.stock <= item.min_stock
  ).length;
  const replenishmentNeededCount = userItems.filter(
    (item) => item.stock <= item.min_stock && (item.reserve_stock || 0) > 0
  ).length;
  const nearExpiryCount = userItems.filter((item) => {
    const fefo = getFefoStatus(item.expiry_date, referenceDate);
    return fefo === 'NEAR_EXPIRY' || fefo === 'EXPIRED';
  }).length;

  const refYear = referenceDate.getFullYear();
  const refMonth = referenceDate.getMonth();
  const refDay = referenceDate.getDate();

  const todayTransactionsCount = userTransactions.filter((tx) => {
    const d = new Date(tx.created_at);
    return (
      d.getFullYear() === refYear &&
      d.getMonth() === refMonth &&
      d.getDate() === refDay
    );
  }).length;

  return {
    totalSku,
    totalUnits,
    totalReserveUnits,
    lowStockCount,
    replenishmentNeededCount,
    nearExpiryCount,
    todayTransactionsCount,
  };
}

/**
 * Memfilter daftar inventaris berdasarkan user_id aktif, kata kunci pencarian, status stok, lantai, dan FEFO.
 */
export function filterInventoryItems(
  items: WarehouseItem[],
  userId: string,
  searchQuery: string,
  statusFilter: 'ALL' | StockStatus,
  categoryFilter: string = 'ALL',
  floorFilter: string = 'ALL',
  fefoOnly: boolean = false
): WarehouseItem[] {
  const normalizedQuery = searchQuery.trim().toLowerCase();

  const filtered = items
    .filter((item) => item.user_id === userId)
    .filter((item) => {
      if (statusFilter !== 'ALL') {
        const status = getStockStatus(item.stock, item.min_stock);
        if (status !== statusFilter) return false;
      }
      if (categoryFilter !== 'ALL' && item.category !== categoryFilter) {
        return false;
      }
      if (floorFilter !== 'ALL' && item.floor_level !== floorFilter) {
        return false;
      }
      if (fefoOnly) {
        const fefo = getFefoStatus(item.expiry_date);
        if (fefo !== 'NEAR_EXPIRY' && fefo !== 'EXPIRED') return false;
      }
      if (!normalizedQuery) return true;
      return (
        item.sku.toLowerCase().includes(normalizedQuery) ||
        (item.barcode || '').toLowerCase().includes(normalizedQuery) ||
        item.name.toLowerCase().includes(normalizedQuery) ||
        item.category.toLowerCase().includes(normalizedQuery) ||
        item.rack_location.toLowerCase().includes(normalizedQuery) ||
        (item.inbound_rack_location || '').toLowerCase().includes(normalizedQuery) ||
        (item.batch_number || '').toLowerCase().includes(normalizedQuery)
      );
    });

  return fefoOnly ? sortItemsByFefo(filtered) : filtered;
}

/**
 * Validasi input transaksi Inbound / Outbound sebelum disimpan ke database.
 */
export function validateTransactionInput(params: {
  item: WarehouseItem | undefined;
  userId: string;
  type: TransactionType;
  quantity: number;
  referenceNo: string;
}): { valid: boolean; error?: string; stockBefore: number; stockAfter: number } {
  const { item, userId, type, quantity, referenceNo } = params;

  if (!item) {
    return {
      valid: false,
      error: 'Pilih barang dari Master Inventaris terlebih dahulu.',
      stockBefore: 0,
      stockAfter: 0,
    };
  }

  if (item.user_id !== userId) {
    return {
      valid: false,
      error: 'Akses ditolak: Barang ini bukan milik akun Anda (RLS Isolation).',
      stockBefore: item.stock,
      stockAfter: item.stock,
    };
  }

  if (!referenceNo || referenceNo.trim().length < 2) {
    return {
      valid: false,
      error: 'Nomor referensi dokumen (PO / DO / SJ) wajib diisi.',
      stockBefore: item.stock,
      stockAfter: item.stock,
    };
  }

  if (!Number.isInteger(quantity) || quantity <= 0) {
    return {
      valid: false,
      error: 'Jumlah unit transaksi harus berupa angka bulat lebih dari 0.',
      stockBefore: item.stock,
      stockAfter: item.stock,
    };
  }

  const stockBefore = item.stock;
  const stockAfter =
    type === 'INBOUND' || type === 'REPLENISHMENT'
      ? stockBefore + quantity
      : stockBefore - quantity;

  if (type === 'OUTBOUND' && quantity > stockBefore) {
    return {
      valid: false,
      error: `Stok Rak Picking tidak mencukupi. Stok "${item.name}" di Rak Picking tersedia ${stockBefore} ${item.unit}, sedangkan permintaan keluar ${quantity} ${item.unit}.`,
      stockBefore,
      stockAfter,
    };
  }

  return {
    valid: true,
    stockBefore,
    stockAfter,
  };
}

/**
 * Membentuk path penyimpanan file yang terisolasi per user_id di bucket warehouse-docs
 * Format: {user_id}/{timestamp}_{sanitized_filename}
 */
export function buildUserStoragePath(
  userId: string,
  originalFileName: string,
  timestamp: number = Date.now()
): string {
  const cleanUserId = userId.trim();
  const sanitized = originalFileName
    .trim()
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/_+/g, '_');
  return `${cleanUserId}/${timestamp}_${sanitized}`;
}

/**
 * Memvalidasi apakah path file di Supabase Storage berhak diakses oleh userId
 */
export function canUserAccessStoragePath(userId: string, filePath: string): boolean {
  if (!userId || !filePath) return false;
  const segments = filePath.split('/');
  return segments.length >= 2 && segments[0] === userId;
}

/**
 * Validasi ukuran dan ekstensi file sebelum diunggah ke Cloud File Vault
 */
export function validateDocumentUpload(params: {
  title: string;
  fileName: string;
  fileSize: number;
}): { valid: boolean; error?: string } {
  const { title, fileName, fileSize } = params;

  if (!title || title.trim().length < 3) {
    return {
      valid: false,
      error: 'Judul dokumen wajib diisi (minimal 3 karakter).',
    };
  }

  if (!fileName) {
    return {
      valid: false,
      error: 'Silakan pilih file dokumen yang akan diunggah.',
    };
  }

  if (fileSize <= 0) {
    return {
      valid: false,
      error: 'File yang dipilih kosong (0 byte).',
    };
  }

  if (fileSize > MAX_UPLOAD_SIZE_BYTES) {
    return {
      valid: false,
      error: 'Ukuran file melebihi batas maksimum 10 MB.',
    };
  }

  const lower = fileName.toLowerCase();
  const hasAllowedExt = ALLOWED_EXTENSIONS.some((ext) => lower.endsWith(ext));
  if (!hasAllowedExt) {
    return {
      valid: false,
      error: 'Format file tidak didukung. Gunakan PDF, JPG, PNG, XLSX, atau DOCX.',
    };
  }

  return { valid: true };
}

/**
 * Menghasilkan string CSV untuk ekspor riwayat transaksi harian di browser
 */
export function generateTransactionsCsv(transactions: WarehouseTransaction[]): string {
  const headers = [
    'ID Transaksi',
    'Waktu Transaksi',
    'No Referensi',
    'Tipe',
    'Kode SKU',
    'Nama Barang',
    'Kuantitas',
    'Stok Sebelum',
    'Stok Sesudah',
    'Lokasi Asal',
    'Lokasi Tujuan',
    'Nomor Batch',
    'Mitra / Tujuan',
    'Operator',
    'Catatan',
  ];

  const escapeCsvCell = (val: string | number | undefined): string => {
    const str = String(val ?? '');
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const formatTypeLabel = (type: TransactionType): string => {
    switch (type) {
      case 'INBOUND':
        return 'Barang Masuk (Inbound)';
      case 'OUTBOUND':
        return 'Barang Keluar (Outbound)';
      case 'REPLENISHMENT':
        return 'Transfer Replenishment (Inbound -> Picking)';
      case 'OPNAME_ADJUSTMENT':
        return 'Penyesuaian Stock Opname';
    }
  };

  const rows = transactions.map((tx) => [
    tx.id,
    new Date(tx.created_at).toISOString(),
    tx.reference_no,
    formatTypeLabel(tx.type),
    tx.sku,
    tx.item_name,
    tx.quantity,
    tx.stock_before,
    tx.stock_after,
    tx.from_location || '-',
    tx.to_location || '-',
    tx.batch_number || '-',
    tx.partner_name,
    tx.operator_name || 'Sistem WMS',
    tx.notes,
  ]);

  return [
    headers.map(escapeCsvCell).join(','),
    ...rows.map((row) => row.map(escapeCsvCell).join(',')),
  ].join('\n');
}

/**
 * Menghasilkan string CSV untuk ekspor tampilan Master Inventaris (Stok Barang) yang sedang difilter
 */
export function generateInventoryCsv(items: WarehouseItem[]): string {
  const headers = [
    'Kode SKU',
    'Barcode',
    'Nama Barang',
    'Kategori',
    'Lantai',
    'Baris',
    'Kolom',
    'Lokasi Rak Picking',
    'Lokasi Rak Inbound',
    'Stok Saat Ini',
    'Stok Cadangan Inbound',
    'Batas Minimum Stok',
    'Satuan',
    'Nomor Batch',
    'Tanggal Kedaluwarsa (FEFO)',
    'Status Stok',
    'Terakhir Diperbarui',
  ];

  const escapeCsvCell = (val: string | number | null | undefined): string => {
    const str = String(val ?? '');
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const rows = items.map((item) => {
    const status = getStockStatus(item.stock, item.min_stock);
    return [
      item.sku,
      item.barcode || item.sku,
      item.name,
      item.category,
      item.floor_level || 'Lantai 1',
      item.aisle_row || 'Baris A',
      item.column_bay || 'Kolom 01',
      item.rack_location,
      item.inbound_rack_location || 'INB-STG-01',
      item.stock,
      item.reserve_stock ?? 0,
      item.min_stock,
      item.unit,
      item.batch_number || '-',
      item.expiry_date || 'Non-FEFO',
      getStockStatusLabel(status),
      new Date(item.updated_at).toISOString(),
    ];
  });

  return [
    headers.map(escapeCsvCell).join(','),
    ...rows.map((row) => row.map(escapeCsvCell).join(',')),
  ].join('\n');
}

/**
 * Format ukuran byte menjadi KB / MB yang rapi
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  return `${mb.toFixed(2)} MB`;
}

/**
 * Filter dokumen milik user_id aktif
 */
export function filterUserDocuments(
  documents: WarehouseDocument[],
  userId: string,
  categoryFilter: string = 'ALL',
  searchQuery: string = ''
): WarehouseDocument[] {
  const q = searchQuery.trim().toLowerCase();
  return documents
    .filter((doc) => doc.user_id === userId)
    .filter((doc) => (categoryFilter === 'ALL' ? true : doc.category === categoryFilter))
    .filter((doc) => {
      if (!q) return true;
      return (
        doc.title.toLowerCase().includes(q) ||
        doc.file_name.toLowerCase().includes(q) ||
        doc.notes.toLowerCase().includes(q) ||
        doc.category.toLowerCase().includes(q)
      );
    });
}

export interface DailyMovementPoint {
  dateKey: string;
  label: string;
  shortDay: string;
  inbound: number;
  outbound: number;
  net: number;
  transactionsCount: number;
}

/**
 * Menghitung tren pergerakan barang harian (Inbound vs Outbound) selama N hari terakhir
 * khusus untuk user_id yang sedang aktif.
 */
export function calculateMovementTrend(
  transactions: WarehouseTransaction[],
  userId: string,
  daysCount: number = 7,
  referenceDate: Date = new Date()
): {
  points: DailyMovementPoint[];
  totalInbound: number;
  totalOutbound: number;
  netFlow: number;
  maxDailyVolume: number;
} {
  const safeDays = Math.max(1, Math.min(30, daysCount));
  const userTx = transactions.filter((tx) => tx.user_id === userId);

  const dayNames = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
  const monthNames = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'Mei',
    'Jun',
    'Jul',
    'Agu',
    'Sep',
    'Okt',
    'Nov',
    'Des',
  ];

  const toLocalDateKey = (d: Date): string => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  const buckets = new Map<string, DailyMovementPoint>();
  const points: DailyMovementPoint[] = [];

  for (let i = safeDays - 1; i >= 0; i--) {
    const d = new Date(referenceDate);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - i);
    const key = toLocalDateKey(d);
    const point: DailyMovementPoint = {
      dateKey: key,
      label: `${String(d.getDate()).padStart(2, '0')} ${monthNames[d.getMonth()]}`,
      shortDay: dayNames[d.getDay()],
      inbound: 0,
      outbound: 0,
      net: 0,
      transactionsCount: 0,
    };
    buckets.set(key, point);
    points.push(point);
  }

  for (const tx of userTx) {
    const txDate = new Date(tx.created_at);
    const key = toLocalDateKey(txDate);
    const bucket = buckets.get(key);
    if (bucket) {
      if (tx.type === 'INBOUND' || tx.type === 'REPLENISHMENT') {
        bucket.inbound += tx.quantity;
      } else if (tx.type === 'OUTBOUND') {
        bucket.outbound += tx.quantity;
      }
      bucket.net = bucket.inbound - bucket.outbound;
      bucket.transactionsCount += 1;
    }
  }

  const totalInbound = points.reduce((sum, p) => sum + p.inbound, 0);
  const totalOutbound = points.reduce((sum, p) => sum + p.outbound, 0);
  const netFlow = totalInbound - totalOutbound;
  const maxDailyVolume = Math.max(
    10,
    ...points.map((p) => Math.max(p.inbound, p.outbound))
  );

  return {
    points,
    totalInbound,
    totalOutbound,
    netFlow,
    maxDailyVolume,
  };
}

export interface CategoryStockPoint {
  category: string;
  skuCount: number;
  totalUnits: number;
  percentage: number;
}

/**
 * Menghitung distribusi unit stok dan jumlah SKU berdasarkan kategori barang milik user_id aktif.
 */
export function calculateCategoryDistribution(
  items: WarehouseItem[],
  userId: string
): CategoryStockPoint[] {
  const userItems = items.filter((item) => item.user_id === userId);
  const totalUnitsAll = userItems.reduce((sum, i) => sum + Math.max(0, i.stock), 0);

  const map = new Map<string, { skuCount: number; totalUnits: number }>();

  for (const item of userItems) {
    const cat = item.category || 'Lainnya';
    const current = map.get(cat) || { skuCount: 0, totalUnits: 0 };
    current.skuCount += 1;
    current.totalUnits += Math.max(0, item.stock);
    map.set(cat, current);
  }

  const result: CategoryStockPoint[] = Array.from(map.entries()).map(
    ([category, val]) => ({
      category,
      skuCount: val.skuCount,
      totalUnits: val.totalUnits,
      percentage:
        totalUnitsAll > 0
          ? Math.round((val.totalUnits / totalUnitsAll) * 1000) / 10
          : 0,
    })
  );

  return result.sort((a, b) => b.totalUnits - a.totalUnits || b.skuCount - a.skuCount);
}

export interface StockHealthSummary {
  amanCount: number;
  menipisCount: number;
  habisCount: number;
  amanPct: number;
  menipisPct: number;
  habisPct: number;
}

/**
 * Menghitung proporsi kesehatan SKU (Aman, Menipis, Habis) untuk grafik ringkasan
 */
export function calculateStockHealthSummary(
  items: WarehouseItem[],
  userId: string
): StockHealthSummary {
  const userItems = items.filter((item) => item.user_id === userId);
  const total = userItems.length;

  let amanCount = 0;
  let menipisCount = 0;
  let habisCount = 0;

  for (const item of userItems) {
    const status = getStockStatus(item.stock, item.min_stock);
    if (status === 'AMAN') amanCount++;
    else if (status === 'MENIPIS') menipisCount++;
    else habisCount++;
  }

  return {
    amanCount,
    menipisCount,
    habisCount,
    amanPct: total > 0 ? Math.round((amanCount / total) * 100) : 0,
    menipisPct: total > 0 ? Math.round((menipisCount / total) * 100) : 0,
    habisPct: total > 0 ? Math.round((habisCount / total) * 100) : 0,
  };
}
