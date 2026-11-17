export type StockStatus = 'AMAN' | 'MENIPIS' | 'HABIS';

export type TransactionType = 'INBOUND' | 'OUTBOUND';

export type DocumentCategory = 'Surat Jalan' | 'Invoice' | 'Berita Acara' | 'Lainnya';

export interface WarehouseItem {
  id: string;
  user_id: string;
  sku: string;
  name: string;
  category: string;
  rack_location: string;
  stock: number;
  min_stock: number;
  unit: string;
  updated_at: string;
  created_at: string;
}

export interface WarehouseTransaction {
  id: string;
  user_id: string;
  item_id: string;
  sku: string;
  item_name: string;
  type: TransactionType;
  quantity: number;
  stock_before: number;
  stock_after: number;
  reference_no: string;
  partner_name: string;
  notes: string;
  created_at: string;
}

export interface WarehouseDocument {
  id: string;
  user_id: string;
  title: string;
  category: DocumentCategory;
  notes: string;
  file_name: string;
  file_path: string; // {user_id}/{nama_file}
  file_size: number;
  mime_type: string;
  created_at: string;
  local_data_url?: string; // Digunakan pada mode simulasi lokal untuk pratinjau Signed URL
}

export interface UserSessionProfile {
  id: string;
  email: string;
  full_name: string;
  warehouse_zone: string;
  role: string;
}

export interface DashboardMetrics {
  totalSku: number;
  totalUnits: number;
  lowStockCount: number;
  todayTransactionsCount: number;
}
