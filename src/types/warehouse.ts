export type StockStatus = 'AMAN' | 'MENIPIS' | 'HABIS';

export type FefoStatus = 'FRESH' | 'NEAR_EXPIRY' | 'EXPIRED' | 'NO_EXPIRY';

export type TransactionType =
  | 'INBOUND'
  | 'OUTBOUND'
  | 'REPLENISHMENT'
  | 'OPNAME_ADJUSTMENT';

export type DocumentCategory =
  | 'Surat Jalan'
  | 'Invoice'
  | 'Berita Acara'
  | 'Shipping Manifest'
  | 'Lainnya';

export type OrderFulfillmentStatus =
  | 'PENDING'
  | 'PICKING'
  | 'PACKING'
  | 'READY_TO_SHIP'
  | 'SHIPPED';

export type PickingMethod = 'BATCH' | 'CLUSTER' | 'ZONE';

export type OmnichannelSource =
  | 'Shopee Mall'
  | 'Tokopedia'
  | 'TikTok Shop'
  | 'B2B Distributor'
  | 'Website Store';

export type CourierService =
  | 'Paxel Instant'
  | 'JNE Trucking'
  | 'J&T Express'
  | 'SiCepat Halu'
  | 'Armada Logistik Internal';

export interface WarehouseItem {
  id: string;
  user_id: string;
  sku: string;
  barcode: string;
  name: string;
  category: string;
  unit: string;
  // Hierarki Lokasi Rak Picking (Lantai -> Baris -> Kolom -> Rak)
  floor_level: string; // contoh: 'Lantai 1'
  aisle_row: string; // contoh: 'Baris A'
  column_bay: string; // contoh: 'Kolom 01'
  rack_code: string; // contoh: 'Rak 02'
  rack_location: string; // gabungan: 'L1-A-01-R02'
  // Lokasi & Stok Rak Inbound / Buffer Staging
  inbound_rack_location: string; // contoh: 'INB-STG-A01'
  reserve_stock: number; // stok di rak inbound yang siap ditransfer (Replenishment)
  // Stok Aktif di Rak Picking & Threshold
  stock: number;
  min_stock: number;
  // Pelacakan Batch & FEFO (First Expired, First Out)
  batch_number: string;
  expiry_date: string | null; // YYYY-MM-DD atau null
  updated_at: string;
  created_at: string;
}

export interface FulfillmentOrderItem {
  item_id: string;
  sku: string;
  barcode: string;
  item_name: string;
  rack_location: string;
  zone: string; // contoh: 'Lantai 1 · Baris A'
  batch_number: string;
  expiry_date: string | null;
  quantity: number;
  picked_qty: number;
  packed_verified: boolean;
  unit: string;
}

export interface FulfillmentOrder {
  id: string;
  user_id: string;
  order_no: string;
  channel: OmnichannelSource;
  customer_name: string;
  courier: CourierService;
  awb_number: string;
  status: OrderFulfillmentStatus;
  assigned_picker: string;
  assigned_packer: string;
  cycle_time_minutes: number;
  manifest_no?: string;
  items: FulfillmentOrderItem[];
  created_at: string;
}

export interface ShippingManifest {
  id: string;
  user_id: string;
  manifest_no: string;
  courier: CourierService;
  driver_name: string;
  vehicle_plate: string;
  order_ids: string[];
  awb_list: string[];
  total_packages: number;
  total_items: number;
  handed_over_by: string;
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
  from_location?: string;
  to_location?: string;
  batch_number?: string;
  reference_no: string;
  partner_name: string;
  operator_name?: string;
  notes: string;
  created_at: string;
}

export interface StaffPerformanceMetric {
  staff_id: string;
  user_id: string;
  staff_name: string;
  role: 'Picker' | 'Packer' | 'Putaway Staff' | 'QC & Opname Auditor';
  assigned_zone: string;
  orders_completed: number;
  items_processed: number;
  avg_pick_pack_minutes: number;
  accuracy_rate: number;
  active_status: 'Aktif Bertugas' | 'Istirahat Shift';
}

export interface WarehouseDocument {
  id: string;
  user_id: string;
  title: string;
  category: DocumentCategory;
  notes: string;
  file_name: string;
  file_path: string; // {user_id}/{timestamp}_{nama_file}
  file_size: number;
  mime_type: string;
  created_at: string;
  local_data_url?: string;
  content_preview?: string;
}

export interface UserSessionProfile {
  id: string;
  email: string;
  full_name: string;
  warehouse_zone: string;
  role: string;
  // Alias properti agar kompatibel dengan seluruh halaman
  warehouse_name?: string;
  role_title?: string;
}

export interface DashboardMetrics {
  totalSku: number;
  totalUnits: number;
  totalReserveUnits: number;
  lowStockCount: number;
  replenishmentNeededCount: number;
  nearExpiryCount: number;
  todayTransactionsCount: number;
}
