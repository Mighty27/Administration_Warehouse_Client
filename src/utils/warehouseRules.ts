import {
  DashboardMetrics,
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
];

/**
 * Menentukan status stok barang berdasarkan stok saat ini dan batas minimum stok.
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
 * Menghitung 4 kartu statistik utama untuk Dashboard Ringkasan
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
  const totalUnits = userItems.reduce((sum, item) => sum + Math.max(0, item.stock), 0);
  const lowStockCount = userItems.filter((item) => item.stock <= item.min_stock).length;

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
    lowStockCount,
    todayTransactionsCount,
  };
}

/**
 * Memfilter daftar inventaris berdasarkan user_id aktif, kata kunci pencarian, dan status stok.
 */
export function filterInventoryItems(
  items: WarehouseItem[],
  userId: string,
  searchQuery: string,
  statusFilter: 'ALL' | StockStatus,
  categoryFilter: string = 'ALL'
): WarehouseItem[] {
  const normalizedQuery = searchQuery.trim().toLowerCase();

  return items
    .filter((item) => item.user_id === userId)
    .filter((item) => {
      if (statusFilter !== 'ALL') {
        const status = getStockStatus(item.stock, item.min_stock);
        if (status !== statusFilter) return false;
      }
      if (categoryFilter !== 'ALL' && item.category !== categoryFilter) {
        return false;
      }
      if (!normalizedQuery) return true;
      return (
        item.sku.toLowerCase().includes(normalizedQuery) ||
        item.name.toLowerCase().includes(normalizedQuery) ||
        item.category.toLowerCase().includes(normalizedQuery) ||
        item.rack_location.toLowerCase().includes(normalizedQuery)
      );
    });
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
  const stockAfter = type === 'INBOUND' ? stockBefore + quantity : stockBefore - quantity;

  if (type === 'OUTBOUND' && quantity > stockBefore) {
    return {
      valid: false,
      error: `Stok tidak mencukupi. Stok "${item.name}" tersedia ${stockBefore} ${item.unit}, sedangkan permintaan keluar ${quantity} ${item.unit}.`,
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
    'Mitra / Tujuan',
    'Catatan',
  ];

  const escapeCsvCell = (val: string | number): string => {
    const str = String(val ?? '');
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const rows = transactions.map((tx) => [
    tx.id,
    new Date(tx.created_at).toISOString(),
    tx.reference_no,
    tx.type === 'INBOUND' ? 'Barang Masuk (Inbound)' : 'Barang Keluar (Outbound)',
    tx.sku,
    tx.item_name,
    tx.quantity,
    tx.stock_before,
    tx.stock_after,
    tx.partner_name,
    tx.notes,
  ]);

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
