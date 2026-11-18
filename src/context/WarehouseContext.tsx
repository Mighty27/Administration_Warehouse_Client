import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import {
  CourierService,
  DocumentCategory,
  FulfillmentOrder,
  OmnichannelSource,
  OrderFulfillmentStatus,
  ShippingManifest,
  StaffPerformanceMetric,
  TransactionType,
  UserSessionProfile,
  WarehouseDocument,
  WarehouseItem,
  WarehouseTransaction,
} from '../types/warehouse';
import { isSupabaseConfigured, STORAGE_BUCKET, supabase } from '../lib/supabase';
import {
  createInitialDocuments,
  createInitialItems,
  createInitialManifests,
  createInitialOrders,
  createInitialStaffMetrics,
  createInitialTransactions,
  DEMO_USERS,
} from '../lib/seedData';
import {
  buildUserStoragePath,
  canUserAccessStoragePath,
  formatRackHierarchyCode,
  validateDocumentUpload,
  validateReplenishmentTransfer,
  validateTransactionInput,
} from '../utils/warehouseRules';

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info';
  title: string;
  description?: string;
}

export interface UpsertItemPayload {
  id?: string;
  sku: string;
  barcode?: string;
  name: string;
  category: string;
  floor_level?: string;
  aisle_row?: string;
  column_bay?: string;
  rack_code?: string;
  rack_location?: string;
  inbound_rack_location?: string;
  reserve_stock?: number;
  stock: number;
  min_stock: number;
  unit: string;
  batch_number?: string;
  expiry_date?: string | null;
}

export interface CreateTransactionPayload {
  item_id: string;
  type: TransactionType;
  quantity: number;
  reference_no: string;
  partner_name: string;
  notes: string;
  putaway_target?: 'PICKING_RACK' | 'INBOUND_STAGE';
  batch_number?: string;
  expiry_date?: string | null;
  operator_name?: string;
}

export interface UploadDocumentPayload {
  title: string;
  category: DocumentCategory;
  notes: string;
  file: File;
}

export interface CreateOrderPayload {
  channel: OmnichannelSource;
  customer_name: string;
  courier: CourierService;
  assigned_picker: string;
  assigned_packer: string;
  lines: Array<{ item_id: string; quantity: number }>;
}

export interface CreateManifestPayload {
  courier: CourierService;
  driver_name: string;
  vehicle_plate: string;
  order_ids: string[];
}

export interface StockOpnameEntry {
  item_id: string;
  actual_stock: number;
  reason: string;
}

interface WarehouseContextValue {
  user: UserSessionProfile | null;
  authLoading: boolean;
  dataLoading: boolean;
  isCloudConnected: boolean;
  items: WarehouseItem[];
  transactions: WarehouseTransaction[];
  documents: WarehouseDocument[];
  orders: FulfillmentOrder[];
  manifests: ShippingManifest[];
  staffMetrics: StaffPerformanceMetric[];
  toasts: ToastMessage[];
  addToast: (type: ToastMessage['type'], title: string, description?: string) => void;
  dismissToast: (id: string) => void;
  login: (email: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  signIn: (params: { email: string; password: string }) => Promise<{ error?: string }>;
  register: (params: {
    email: string;
    password: string;
    fullName: string;
    warehouseZone: string;
  }) => Promise<{ ok: boolean; error?: string }>;
  signUp: (params: {
    email: string;
    password: string;
    fullName: string;
    warehouseName: string;
  }) => Promise<{ error?: string }>;
  loginDemoAccount: (email: string) => Promise<void>;
  logout: () => Promise<void>;
  signOut: () => Promise<void>;
  saveItem: (payload: UpsertItemPayload) => Promise<{ ok: boolean; error?: string }>;
  deleteItem: (itemId: string) => Promise<{ ok: boolean; error?: string }>;
  recordTransaction: (
    payload: CreateTransactionPayload
  ) => Promise<{ ok: boolean; error?: string }>;
  executeReplenishment: (params: {
    item_id: string;
    transfer_qty?: number;
    operator_name?: string;
  }) => Promise<{ ok: boolean; error?: string }>;
  createOrder: (
    payload: CreateOrderPayload
  ) => Promise<{ ok: boolean; error?: string }>;
  advanceOrderStatus: (
    orderId: string,
    nextStatus: OrderFulfillmentStatus
  ) => Promise<{ ok: boolean; error?: string }>;
  completeBatchPickingForSku: (
    sku: string
  ) => Promise<{ ok: boolean; error?: string }>;
  verifyOrderItemBarcode: (
    orderId: string,
    skuOrBarcode: string
  ) => { ok: boolean; message: string };
  verifyAllOrderItems: (orderId: string) => void;
  createShippingManifest: (
    payload: CreateManifestPayload
  ) => Promise<{ ok: boolean; error?: string; manifest?: ShippingManifest }>;
  submitStockOpname: (params: {
    auditor_name: string;
    zone_label: string;
    entries: StockOpnameEntry[];
  }) => Promise<{ ok: boolean; error?: string; adjustedCount: number }>;
  uploadDocument: (
    payload: UploadDocumentPayload
  ) => Promise<{ ok: boolean; error?: string }>;
  deleteDocument: (docId: string) => Promise<{ ok: boolean; error?: string }>;
  getSignedDocumentUrl: (
    doc: WarehouseDocument
  ) => Promise<{ ok: boolean; url?: string; expiresAt?: string; error?: string }>;
  resetDemoData: () => void;
}

const WarehouseContext = createContext<WarehouseContextValue | undefined>(undefined);

const STORAGE_KEYS = {
  SESSION: 'logivault_active_session_v2',
  USERS: 'logivault_registered_users_v2',
  ITEMS: 'logivault_items_v2',
  TRANSACTIONS: 'logivault_transactions_v2',
  DOCUMENTS: 'logivault_documents_v2',
  ORDERS: 'logivault_orders_v2',
  MANIFESTS: 'logivault_manifests_v2',
  STAFF: 'logivault_staff_v2',
};

function normalizeProfile(profile: UserSessionProfile): UserSessionProfile {
  return {
    ...profile,
    warehouse_name: profile.warehouse_name || profile.warehouse_zone,
    role_title: profile.role_title || profile.role,
  };
}

export const WarehouseProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserSessionProfile | null>(null);
  const [authLoading, setAuthLoading] = useState<boolean>(true);
  const [dataLoading, setDataLoading] = useState<boolean>(false);

  const [allItems, setAllItems] = useState<WarehouseItem[]>([]);
  const [allTransactions, setAllTransactions] = useState<WarehouseTransaction[]>([]);
  const [allDocuments, setAllDocuments] = useState<WarehouseDocument[]>([]);
  const [allOrders, setAllOrders] = useState<FulfillmentOrder[]>([]);
  const [allManifests, setAllManifests] = useState<ShippingManifest[]>([]);
  const [allStaff, setAllStaff] = useState<StaffPerformanceMetric[]>([]);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const addToast = (
    type: ToastMessage['type'],
    title: string,
    description?: string
  ) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setToasts((prev) => [...prev, { id, type, title, description }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  };

  const dismissToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const loadLocalDatabase = () => {
    try {
      const rawItems = localStorage.getItem(STORAGE_KEYS.ITEMS);
      const rawTx = localStorage.getItem(STORAGE_KEYS.TRANSACTIONS);
      const rawDocs = localStorage.getItem(STORAGE_KEYS.DOCUMENTS);
      const rawOrders = localStorage.getItem(STORAGE_KEYS.ORDERS);
      const rawManifests = localStorage.getItem(STORAGE_KEYS.MANIFESTS);
      const rawStaff = localStorage.getItem(STORAGE_KEYS.STAFF);

      const parsedItems: WarehouseItem[] = rawItems
        ? JSON.parse(rawItems)
        : createInitialItems();
      const parsedTx: WarehouseTransaction[] = rawTx
        ? JSON.parse(rawTx)
        : createInitialTransactions();
      const parsedDocs: WarehouseDocument[] = rawDocs
        ? JSON.parse(rawDocs)
        : createInitialDocuments();
      const parsedOrders: FulfillmentOrder[] = rawOrders
        ? JSON.parse(rawOrders)
        : createInitialOrders();
      const parsedManifests: ShippingManifest[] = rawManifests
        ? JSON.parse(rawManifests)
        : createInitialManifests();
      const parsedStaff: StaffPerformanceMetric[] = rawStaff
        ? JSON.parse(rawStaff)
        : createInitialStaffMetrics();

      if (!rawItems) localStorage.setItem(STORAGE_KEYS.ITEMS, JSON.stringify(parsedItems));
      if (!rawTx) localStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(parsedTx));
      if (!rawDocs) localStorage.setItem(STORAGE_KEYS.DOCUMENTS, JSON.stringify(parsedDocs));
      if (!rawOrders) localStorage.setItem(STORAGE_KEYS.ORDERS, JSON.stringify(parsedOrders));
      if (!rawManifests)
        localStorage.setItem(STORAGE_KEYS.MANIFESTS, JSON.stringify(parsedManifests));
      if (!rawStaff) localStorage.setItem(STORAGE_KEYS.STAFF, JSON.stringify(parsedStaff));

      setAllItems(parsedItems);
      setAllTransactions(parsedTx);
      setAllDocuments(parsedDocs);
      setAllOrders(parsedOrders);
      setAllManifests(parsedManifests);
      setAllStaff(parsedStaff);
    } catch {
      setAllItems(createInitialItems());
      setAllTransactions(createInitialTransactions());
      setAllDocuments(createInitialDocuments());
      setAllOrders(createInitialOrders());
      setAllManifests(createInitialManifests());
      setAllStaff(createInitialStaffMetrics());
    }
  };

  const fetchSupabaseDataForUser = async (activeUserId: string) => {
    if (!supabase) return;
    setDataLoading(true);
    try {
      const [itemsRes, txRes, docsRes] = await Promise.all([
        supabase
          .from('items')
          .select('*')
          .eq('user_id', activeUserId)
          .order('updated_at', { ascending: false }),
        supabase
          .from('transactions')
          .select('*')
          .eq('user_id', activeUserId)
          .order('created_at', { ascending: false }),
        supabase
          .from('documents')
          .select('*')
          .eq('user_id', activeUserId)
          .order('created_at', { ascending: false }),
      ]);

      if (itemsRes.data && itemsRes.data.length > 0) {
        const enriched = (itemsRes.data as WarehouseItem[]).map((it, idx) => ({
          ...it,
          barcode: it.barcode || `899701400${1000 + idx}`,
          floor_level: it.floor_level || 'Lantai 1',
          aisle_row: it.aisle_row || 'Baris A',
          column_bay: it.column_bay || 'Kolom 01',
          rack_code: it.rack_code || 'Rak 01',
          inbound_rack_location: it.inbound_rack_location || 'INB-STG-A01',
          reserve_stock: it.reserve_stock ?? 20,
          batch_number: it.batch_number || 'BATCH-2026-11A',
          expiry_date: it.expiry_date ?? null,
        }));
        setAllItems(enriched);
      }
      if (txRes.data && txRes.data.length > 0) {
        setAllTransactions(txRes.data as WarehouseTransaction[]);
      }
      if (docsRes.data && docsRes.data.length > 0) {
        setAllDocuments(docsRes.data as WarehouseDocument[]);
      }
    } finally {
      setDataLoading(false);
    }
  };

  useEffect(() => {
    const initSession = async () => {
      setAuthLoading(true);
      loadLocalDatabase();

      const searchParams = new URLSearchParams(window.location.search);
      const autostart = searchParams.get('autostart') === '1';

      if (isSupabaseConfigured && supabase && !autostart) {
        const { data } = await supabase.auth.getSession();
        if (data.session?.user) {
          const sbUser = data.session.user;
          const profile = normalizeProfile({
            id: sbUser.id,
            email: sbUser.email || 'user@warehouse.id',
            full_name:
              (sbUser.user_metadata?.full_name as string) ||
              sbUser.email?.split('@')[0] ||
              'Admin Gudang',
            warehouse_zone:
              (sbUser.user_metadata?.warehouse_zone as string) || 'Gudang Utama',
            role: 'Admin Warehouse',
          });
          setUser(profile);
          await fetchSupabaseDataForUser(profile.id);
          setAuthLoading(false);
          return;
        }
      }

      const savedSession = localStorage.getItem(STORAGE_KEYS.SESSION);
      if (savedSession) {
        try {
          setUser(normalizeProfile(JSON.parse(savedSession)));
          setAuthLoading(false);
          return;
        } catch {
          localStorage.removeItem(STORAGE_KEYS.SESSION);
        }
      }

      if (autostart) {
        const demoProfile = DEMO_USERS['budi.gudang@logivault.id'];
        const sessionObj = normalizeProfile({
          id: demoProfile.id,
          email: demoProfile.email,
          full_name: demoProfile.full_name,
          warehouse_zone: demoProfile.warehouse_zone,
          role: demoProfile.role,
        });
        localStorage.setItem(STORAGE_KEYS.SESSION, JSON.stringify(sessionObj));
        setUser(sessionObj);
      }

      setAuthLoading(false);
    };

    initSession();
  }, []);

  // Isolasi ketat berdasarkan user_id yang sedang aktif
  const items = useMemo(() => {
    if (!user) return [];
    return allItems.filter((item) => item.user_id === user.id);
  }, [allItems, user]);

  const transactions = useMemo(() => {
    if (!user) return [];
    return allTransactions.filter((tx) => tx.user_id === user.id);
  }, [allTransactions, user]);

  const documents = useMemo(() => {
    if (!user) return [];
    return allDocuments.filter((doc) => doc.user_id === user.id);
  }, [allDocuments, user]);

  const orders = useMemo(() => {
    if (!user) return [];
    return allOrders.filter((ord) => ord.user_id === user.id);
  }, [allOrders, user]);

  const manifests = useMemo(() => {
    if (!user) return [];
    return allManifests.filter((mnf) => mnf.user_id === user.id);
  }, [allManifests, user]);

  const staffMetrics = useMemo(() => {
    if (!user) return [];
    return allStaff.filter((stf) => stf.user_id === user.id);
  }, [allStaff, user]);

  const login = async (
    email: string,
    password: string
  ): Promise<{ ok: boolean; error?: string }> => {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !password) {
      return { ok: false, error: 'Email dan kata sandi wajib diisi.' };
    }

    // Cek DEMO_USERS atau customUsers terlebih dahulu agar akun demo selalu berfungsi
    const customUsersRaw = localStorage.getItem(STORAGE_KEYS.USERS);
    const customUsers: Record<
      string,
      UserSessionProfile & { password: string }
    > = customUsersRaw ? JSON.parse(customUsersRaw) : {};

    const allKnownUsers = { ...DEMO_USERS, ...customUsers };
    const found = allKnownUsers[cleanEmail];

    if (found && found.password === password) {
      const sessionObj = normalizeProfile({
        id: found.id,
        email: found.email,
        full_name: found.full_name,
        warehouse_zone: found.warehouse_zone,
        role: found.role,
      });
      localStorage.setItem(STORAGE_KEYS.SESSION, JSON.stringify(sessionObj));
      setUser(sessionObj);
      addToast(
        'success',
        'Sesi Terautentikasi',
        `Data gudang diisolasi untuk akun ${sessionObj.full_name} (${sessionObj.warehouse_zone}).`
      );
      return { ok: true };
    }

    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password,
      });
      if (error || !data.user) {
        return {
          ok: false,
          error: error?.message || 'Kredensial tidak valid. Periksa kembali email dan kata sandi.',
        };
      }
      const profile = normalizeProfile({
        id: data.user.id,
        email: data.user.email || cleanEmail,
        full_name:
          (data.user.user_metadata?.full_name as string) ||
          cleanEmail.split('@')[0],
        warehouse_zone:
          (data.user.user_metadata?.warehouse_zone as string) || 'Gudang Utama',
        role: 'Admin Warehouse',
      });
      setUser(profile);
      await fetchSupabaseDataForUser(profile.id);
      addToast('success', 'Berhasil Masuk', `Selamat datang kembali, ${profile.full_name}.`);
      return { ok: true };
    }

    return {
      ok: false,
      error: 'Kredensial tidak valid. Periksa kembali email atau kata sandi Anda.',
    };
  };

  const signIn = async (params: {
    email: string;
    password: string;
  }): Promise<{ error?: string }> => {
    const res = await login(params.email, params.password);
    return res.ok ? {} : { error: res.error };
  };

  const loginDemoAccount = async (email: string) => {
    const cleanEmail = email.trim().toLowerCase();
    const demo = DEMO_USERS[cleanEmail];
    if (!demo) return;
    const sessionObj = normalizeProfile({
      id: demo.id,
      email: demo.email,
      full_name: demo.full_name,
      warehouse_zone: demo.warehouse_zone,
      role: demo.role,
    });
    localStorage.setItem(STORAGE_KEYS.SESSION, JSON.stringify(sessionObj));
    setUser(sessionObj);
    addToast(
      'info',
      `Beralih ke Akun: ${demo.full_name}`,
      `RLS aktif — Menampilkan data eksklusif untuk ${demo.warehouse_zone}.`
    );
  };

  const register = async (params: {
    email: string;
    password: string;
    fullName: string;
    warehouseZone: string;
  }): Promise<{ ok: boolean; error?: string }> => {
    const cleanEmail = params.email.trim().toLowerCase();
    const cleanName = params.fullName.trim();
    const cleanZone = params.warehouseZone.trim() || 'Gudang Pusat';

    if (!cleanName || cleanName.length < 3) {
      return { ok: false, error: 'Nama lengkap minimal 3 karakter.' };
    }
    if (!cleanEmail.includes('@')) {
      return { ok: false, error: 'Masukkan alamat email kerja yang valid.' };
    }
    if (params.password.length < 6) {
      return { ok: false, error: 'Kata sandi minimal 6 karakter.' };
    }

    const customUsersRaw = localStorage.getItem(STORAGE_KEYS.USERS);
    const customUsers: Record<
      string,
      UserSessionProfile & { password: string }
    > = customUsersRaw ? JSON.parse(customUsersRaw) : {};

    if (DEMO_USERS[cleanEmail] || customUsers[cleanEmail]) {
      return {
        ok: false,
        error: 'Email ini sudah terdaftar. Silakan gunakan halaman Masuk.',
      };
    }

    const newUserId = `usr-${Date.now().toString(36)}-${Math.random()
      .toString(36)
      .slice(2, 8)}`;

    const newRecord = {
      id: newUserId,
      email: cleanEmail,
      full_name: cleanName,
      warehouse_zone: cleanZone,
      role: 'Kepala Gudang',
      warehouse_name: cleanZone,
      role_title: 'Kepala Gudang',
      password: params.password,
    };

    customUsers[cleanEmail] = newRecord;
    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(customUsers));

    const sessionObj = normalizeProfile({
      id: newRecord.id,
      email: newRecord.email,
      full_name: newRecord.full_name,
      warehouse_zone: newRecord.warehouse_zone,
      role: newRecord.role,
    });
    localStorage.setItem(STORAGE_KEYS.SESSION, JSON.stringify(sessionObj));
    setUser(sessionObj);
    addToast(
      'success',
      'Akun Gudang Baru Aktif',
      `Workspace terisolasi dibuat untuk ${cleanZone}.`
    );
    return { ok: true };
  };

  const signUp = async (params: {
    email: string;
    password: string;
    fullName: string;
    warehouseName: string;
  }): Promise<{ error?: string }> => {
    const res = await register({
      email: params.email,
      password: params.password,
      fullName: params.fullName,
      warehouseZone: params.warehouseName,
    });
    return res.ok ? {} : { error: res.error };
  };

  const logout = async () => {
    if (isSupabaseConfigured && supabase) {
      await supabase.auth.signOut();
    }
    localStorage.removeItem(STORAGE_KEYS.SESSION);
    setUser(null);
    addToast('info', 'Sesi Berakhir', 'Anda telah keluar dari sistem LogiVault WMS.');
  };

  const signOut = logout;

  const saveItem = async (
    payload: UpsertItemPayload
  ): Promise<{ ok: boolean; error?: string }> => {
    if (!user) return { ok: false, error: 'Sesi tidak ditemukan. Silakan login kembali.' };

    const cleanSku = payload.sku.trim().toUpperCase();
    const cleanName = payload.name.trim();
    const cleanCategory = payload.category.trim();
    const floorLevel = payload.floor_level?.trim() || 'Lantai 1';
    const aisleRow = payload.aisle_row?.trim() || 'Baris A';
    const columnBay = payload.column_bay?.trim() || 'Kolom 01';
    const rackCode = payload.rack_code?.trim() || 'Rak 01';
    const cleanRack =
      payload.rack_location?.trim().toUpperCase() ||
      formatRackHierarchyCode(floorLevel, aisleRow, columnBay, rackCode);
    const cleanInboundRack =
      payload.inbound_rack_location?.trim().toUpperCase() || 'INB-STG-A01';
    const cleanUnit = payload.unit.trim() || 'Pcs';
    const cleanBarcode =
      payload.barcode?.trim() || `8997014${Math.floor(100000 + Math.random() * 900000)}`;
    const cleanBatch =
      payload.batch_number?.trim().toUpperCase() ||
      `BATCH-${new Date().getFullYear()}-11A`;
    const reserveStock = Math.max(0, Number(payload.reserve_stock ?? 0));

    if (!cleanSku || !cleanName || !cleanCategory || !cleanRack) {
      return {
        ok: false,
        error: 'Kode SKU, Nama Barang, Kategori, dan Lokasi Rak wajib diisi.',
      };
    }
    if (payload.stock < 0 || payload.min_stock < 0) {
      return {
        ok: false,
        error: 'Stok dan batas minimum stok tidak boleh bernilai negatif.',
      };
    }

    const duplicate = items.find(
      (i) => i.sku.toUpperCase() === cleanSku && i.id !== payload.id
    );
    if (duplicate) {
      return {
        ok: false,
        error: `Kode SKU "${cleanSku}" sudah terdaftar pada inventaris akun Anda.`,
      };
    }

    const now = new Date().toISOString();

    let updatedList: WarehouseItem[];
    if (payload.id) {
      updatedList = allItems.map((item) => {
        if (item.id === payload.id && item.user_id === user.id) {
          return {
            ...item,
            sku: cleanSku,
            barcode: cleanBarcode,
            name: cleanName,
            category: cleanCategory,
            floor_level: floorLevel,
            aisle_row: aisleRow,
            column_bay: columnBay,
            rack_code: rackCode,
            rack_location: cleanRack,
            inbound_rack_location: cleanInboundRack,
            reserve_stock: reserveStock,
            stock: Number(payload.stock),
            min_stock: Number(payload.min_stock),
            unit: cleanUnit,
            batch_number: cleanBatch,
            expiry_date: payload.expiry_date || null,
            updated_at: now,
          };
        }
        return item;
      });
    } else {
      const newItem: WarehouseItem = {
        id: `item-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        user_id: user.id,
        sku: cleanSku,
        barcode: cleanBarcode,
        name: cleanName,
        category: cleanCategory,
        floor_level: floorLevel,
        aisle_row: aisleRow,
        column_bay: columnBay,
        rack_code: rackCode,
        rack_location: cleanRack,
        inbound_rack_location: cleanInboundRack,
        reserve_stock: reserveStock,
        stock: Number(payload.stock),
        min_stock: Number(payload.min_stock),
        unit: cleanUnit,
        batch_number: cleanBatch,
        expiry_date: payload.expiry_date || null,
        updated_at: now,
        created_at: now,
      };
      updatedList = [newItem, ...allItems];
    }

    setAllItems(updatedList);
    localStorage.setItem(STORAGE_KEYS.ITEMS, JSON.stringify(updatedList));
    addToast(
      'success',
      payload.id ? 'Master Barang Diperbarui' : 'SKU Baru Tersimpan',
      `${cleanSku} (${cleanRack}) — Picking: ${payload.stock} ${cleanUnit} · Inbound: ${reserveStock} ${cleanUnit}`
    );
    return { ok: true };
  };

  const deleteItem = async (itemId: string): Promise<{ ok: boolean; error?: string }> => {
    if (!user) return { ok: false, error: 'Tidak ada sesi aktif.' };
    const target = items.find((i) => i.id === itemId && i.user_id === user.id);
    if (!target) {
      return { ok: false, error: 'Barang tidak ditemukan atau bukan milik akun Anda.' };
    }

    const nextItems = allItems.filter(
      (i) => !(i.id === itemId && i.user_id === user.id)
    );
    setAllItems(nextItems);
    localStorage.setItem(STORAGE_KEYS.ITEMS, JSON.stringify(nextItems));
    addToast('info', 'SKU Dihapus', `${target.sku} — ${target.name} berhasil dihapus.`);
    return { ok: true };
  };

  const recordTransaction = async (
    payload: CreateTransactionPayload
  ): Promise<{ ok: boolean; error?: string }> => {
    if (!user) return { ok: false, error: 'Sesi tidak ditemukan.' };

    const targetItem = items.find((i) => i.id === payload.item_id);
    const putawayTarget = payload.putaway_target || 'PICKING_RACK';

    if (payload.type === 'INBOUND' && putawayTarget === 'INBOUND_STAGE') {
      if (!targetItem) {
        return { ok: false, error: 'Pilih barang dari Master Inventaris terlebih dahulu.' };
      }
      if (!payload.reference_no || payload.reference_no.trim().length < 2) {
        return { ok: false, error: 'Nomor referensi PO wajib diisi.' };
      }
      const qty = Number(payload.quantity);
      if (!Number.isInteger(qty) || qty <= 0) {
        return { ok: false, error: 'Kuantitas harus berupa angka bulat > 0.' };
      }

      const now = new Date().toISOString();
      const newReserve = (targetItem.reserve_stock || 0) + qty;
      const newBatch = payload.batch_number?.trim() || targetItem.batch_number;

      const newTx: WarehouseTransaction = {
        id: `tx-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        user_id: user.id,
        item_id: targetItem.id,
        sku: targetItem.sku,
        item_name: targetItem.name,
        type: 'INBOUND',
        quantity: qty,
        stock_before: targetItem.reserve_stock || 0,
        stock_after: newReserve,
        from_location: 'DOCK-RECEIVING',
        to_location: targetItem.inbound_rack_location,
        batch_number: newBatch,
        reference_no: payload.reference_no.trim().toUpperCase(),
        partner_name: payload.partner_name.trim() || 'Supplier Resmi',
        operator_name: payload.operator_name || user.full_name,
        notes:
          payload.notes.trim() ||
          `Guided Putaway ke Rak Inbound Staging (${targetItem.inbound_rack_location})`,
        created_at: now,
      };

      const nextTx = [newTx, ...allTransactions];
      const nextItems = allItems.map((it) => {
        if (it.id === targetItem.id && it.user_id === user.id) {
          return {
            ...it,
            reserve_stock: newReserve,
            batch_number: newBatch,
            expiry_date:
              payload.expiry_date !== undefined ? payload.expiry_date : it.expiry_date,
            updated_at: now,
          };
        }
        return it;
      });

      setAllTransactions(nextTx);
      setAllItems(nextItems);
      localStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(nextTx));
      localStorage.setItem(STORAGE_KEYS.ITEMS, JSON.stringify(nextItems));

      addToast(
        'success',
        'Putaway ke Rak Inbound Berhasil',
        `Stok cadangan ${targetItem.sku} di ${targetItem.inbound_rack_location} bertambah +${qty} ${targetItem.unit}.`
      );
      return { ok: true };
    }

    const validation = validateTransactionInput({
      item: targetItem,
      userId: user.id,
      type: payload.type,
      quantity: Number(payload.quantity),
      referenceNo: payload.reference_no,
    });

    if (!validation.valid || !targetItem) {
      return { ok: false, error: validation.error };
    }

    const now = new Date().toISOString();
    const newBatch = payload.batch_number?.trim() || targetItem.batch_number;

    const newTx: WarehouseTransaction = {
      id: `tx-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      user_id: user.id,
      item_id: targetItem.id,
      sku: targetItem.sku,
      item_name: targetItem.name,
      type: payload.type,
      quantity: Number(payload.quantity),
      stock_before: validation.stockBefore,
      stock_after: validation.stockAfter,
      from_location:
        payload.type === 'INBOUND' ? targetItem.inbound_rack_location : targetItem.rack_location,
      to_location:
        payload.type === 'INBOUND' ? targetItem.rack_location : 'PACKING-OUTBOUND',
      batch_number: newBatch,
      reference_no: payload.reference_no.trim().toUpperCase(),
      partner_name: payload.partner_name.trim() || 'Mitra Operasional',
      operator_name: payload.operator_name || user.full_name,
      notes: payload.notes.trim(),
      created_at: now,
    };

    const nextTransactions = [newTx, ...allTransactions];
    const nextItems = allItems.map((item) => {
      if (item.id === targetItem.id && item.user_id === user.id) {
        return {
          ...item,
          stock: validation.stockAfter,
          batch_number: newBatch,
          expiry_date:
            payload.expiry_date !== undefined ? payload.expiry_date : item.expiry_date,
          updated_at: now,
        };
      }
      return item;
    });

    setAllTransactions(nextTransactions);
    setAllItems(nextItems);
    localStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(nextTransactions));
    localStorage.setItem(STORAGE_KEYS.ITEMS, JSON.stringify(nextItems));

    addToast(
      'success',
      payload.type === 'INBOUND'
        ? 'Putaway ke Rak Picking Berhasil'
        : 'Barang Keluar (Outbound) Berhasil',
      `Stok ${targetItem.sku} di ${targetItem.rack_location}: ${validation.stockBefore} → ${validation.stockAfter} ${targetItem.unit}.`
    );

    return { ok: true };
  };

  /**
   * Rekomendasi Transfer Produk (Replenishment):
   * Memindahkan stok dari Rak Inbound (reserve_stock) ke Rak Picking (stock)
   */
  const executeReplenishment = async (params: {
    item_id: string;
    transfer_qty?: number;
    operator_name?: string;
  }): Promise<{ ok: boolean; error?: string }> => {
    if (!user) return { ok: false, error: 'Sesi tidak ditemukan.' };
    const targetItem = items.find((i) => i.id === params.item_id);
    if (!targetItem) {
      return { ok: false, error: 'SKU barang tidak ditemukan.' };
    }

    const defaultTransfer = Math.min(
      targetItem.reserve_stock,
      Math.max(1, targetItem.min_stock * 2 - targetItem.stock)
    );
    const qty = params.transfer_qty ?? defaultTransfer;

    const check = validateReplenishmentTransfer({
      item: targetItem,
      userId: user.id,
      transferQty: qty,
    });

    if (!check.valid) {
      return { ok: false, error: check.error };
    }

    const now = new Date().toISOString();
    const refNo = `REP-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`;

    const newTx: WarehouseTransaction = {
      id: `tx-rep-${Date.now()}`,
      user_id: user.id,
      item_id: targetItem.id,
      sku: targetItem.sku,
      item_name: targetItem.name,
      type: 'REPLENISHMENT',
      quantity: qty,
      stock_before: check.pickingBefore,
      stock_after: check.pickingAfter,
      from_location: targetItem.inbound_rack_location,
      to_location: targetItem.rack_location,
      batch_number: targetItem.batch_number,
      reference_no: refNo,
      partner_name: `Transfer Internal (${targetItem.inbound_rack_location} → ${targetItem.rack_location})`,
      operator_name: params.operator_name || 'Hendra Gunawan',
      notes: `Replenishment otomatis: Rak Picking bertambah +${qty} ${targetItem.unit}, sisa Rak Inbound ${check.reserveAfter} ${targetItem.unit}.`,
      created_at: now,
    };

    const nextItems = allItems.map((it) => {
      if (it.id === targetItem.id && it.user_id === user.id) {
        return {
          ...it,
          stock: check.pickingAfter,
          reserve_stock: check.reserveAfter,
          updated_at: now,
        };
      }
      return it;
    });

    const nextTx = [newTx, ...allTransactions];
    setAllItems(nextItems);
    setAllTransactions(nextTx);
    localStorage.setItem(STORAGE_KEYS.ITEMS, JSON.stringify(nextItems));
    localStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(nextTx));

    addToast(
      'success',
      'Transfer Replenishment Selesai',
      `${qty} ${targetItem.unit} ${targetItem.sku} dipindahkan dari ${targetItem.inbound_rack_location} ke Rak Picking ${targetItem.rack_location}.`
    );
    return { ok: true };
  };

  /**
   * Membuat pesanan omnichannel baru
   */
  const createOrder = async (
    payload: CreateOrderPayload
  ): Promise<{ ok: boolean; error?: string }> => {
    if (!user) return { ok: false, error: 'Sesi tidak ditemukan.' };
    if (!payload.customer_name.trim()) {
      return { ok: false, error: 'Nama pelanggan / pembeli wajib diisi.' };
    }
    if (!payload.lines || payload.lines.length === 0) {
      return { ok: false, error: 'Pilih minimal 1 SKU barang untuk pesanan ini.' };
    }

    const orderItems: FulfillmentOrder['items'] = [];
    for (const line of payload.lines) {
      const found = items.find((i) => i.id === line.item_id);
      if (!found) continue;
      if (line.quantity <= 0) continue;
      orderItems.push({
        item_id: found.id,
        sku: found.sku,
        barcode: found.barcode,
        item_name: found.name,
        rack_location: found.rack_location,
        zone: `${found.floor_level} · ${found.aisle_row}`,
        batch_number: found.batch_number,
        expiry_date: found.expiry_date,
        quantity: line.quantity,
        picked_qty: 0,
        packed_verified: false,
        unit: found.unit,
      });
    }

    if (orderItems.length === 0) {
      return { ok: false, error: 'Item pesanan tidak valid.' };
    }

    const prefix =
      payload.channel === 'Shopee Mall'
        ? 'SHP'
        : payload.channel === 'Tokopedia'
        ? 'TKP'
        : payload.channel === 'TikTok Shop'
        ? 'TTS'
        : payload.channel === 'B2B Distributor'
        ? 'B2B'
        : 'WEB';

    const rand = Math.floor(100000 + Math.random() * 900000);
    const newOrder: FulfillmentOrder = {
      id: `ord-${Date.now()}`,
      user_id: user.id,
      order_no: `ORD-${prefix}-${rand}`,
      channel: payload.channel,
      customer_name: payload.customer_name.trim(),
      courier: payload.courier,
      awb_number: `AWB-${prefix}-${Math.floor(10000000 + Math.random() * 90000000)}`,
      status: 'PENDING',
      assigned_picker: payload.assigned_picker || 'Rizky Pratama',
      assigned_packer: payload.assigned_packer || 'Dewi Lestari',
      cycle_time_minutes: 3.5,
      items: orderItems,
      created_at: new Date().toISOString(),
    };

    const nextOrders = [newOrder, ...allOrders];
    setAllOrders(nextOrders);
    localStorage.setItem(STORAGE_KEYS.ORDERS, JSON.stringify(nextOrders));

    addToast(
      'success',
      'Pesanan Baru Masuk Antrean',
      `${newOrder.order_no} (${newOrder.channel}) siap diproses lewat Batch/Cluster/Zone Picking.`
    );
    return { ok: true };
  };

  /**
   * Memindahkan status pesanan pada pipeline Fulfillment
   */
  const advanceOrderStatus = async (
    orderId: string,
    nextStatus: OrderFulfillmentStatus
  ): Promise<{ ok: boolean; error?: string }> => {
    if (!user) return { ok: false, error: 'Sesi tidak aktif.' };
    const target = orders.find((o) => o.id === orderId);
    if (!target) return { ok: false, error: 'Pesanan tidak ditemukan.' };

    // Jika pindah ke READY_TO_SHIP dari PACKING, wajib semua item sudah packed_verified
    if (nextStatus === 'READY_TO_SHIP') {
      const unverified = target.items.some((i) => !i.packed_verified);
      if (unverified) {
        return {
          ok: false,
          error:
            'Validasi Barcode Packing belum 100%! Pastikan seluruh SKU pada pesanan ini telah dipindai/diverifikasi sebelum cetak label AWB.',
        };
      }
    }

    const updatedOrders = allOrders.map((ord) => {
      if (ord.id === orderId && ord.user_id === user.id) {
        const updatedItems = ord.items.map((line) => {
          if (nextStatus === 'PACKING' || nextStatus === 'READY_TO_SHIP') {
            return { ...line, picked_qty: line.quantity };
          }
          return line;
        });
        return {
          ...ord,
          status: nextStatus,
          items: updatedItems,
        };
      }
      return ord;
    });

    setAllOrders(updatedOrders);
    localStorage.setItem(STORAGE_KEYS.ORDERS, JSON.stringify(updatedOrders));

    const labelMap: Record<OrderFulfillmentStatus, string> = {
      PENDING: 'Antrean Pending',
      PICKING: 'Sedang Diambil (Picking)',
      PACKING: 'Meja Kemas & Validasi Barcode (Packing)',
      READY_TO_SHIP: 'Siap Serah Terima Kurir (Ready to Ship)',
      SHIPPED: 'Terkirim (Shipped)',
    };

    addToast(
      'success',
      `Status ${target.order_no} Diperbarui`,
      `Pesanan berpindah ke tahap: ${labelMap[nextStatus]}`
    );
    return { ok: true };
  };

  /**
   * Menyelesaikan Batch Picking untuk satu SKU sekaligus di seluruh pesanan aktif
   */
  const completeBatchPickingForSku = async (
    sku: string
  ): Promise<{ ok: boolean; error?: string }> => {
    if (!user) return { ok: false, error: 'Sesi tidak aktif.' };

    let affectedOrdersCount = 0;
    const nextOrders = allOrders.map((ord) => {
      if (
        ord.user_id === user.id &&
        (ord.status === 'PENDING' || ord.status === 'PICKING')
      ) {
        const hasSku = ord.items.some((i) => i.sku === sku);
        if (!hasSku) return ord;
        affectedOrdersCount++;

        const updatedItems = ord.items.map((line) =>
          line.sku === sku ? { ...line, picked_qty: line.quantity } : line
        );
        const allPicked = updatedItems.every((l) => l.picked_qty >= l.quantity);

        return {
          ...ord,
          status: allPicked ? ('PACKING' as OrderFulfillmentStatus) : ('PICKING' as OrderFulfillmentStatus),
          items: updatedItems,
        };
      }
      return ord;
    });

    if (affectedOrdersCount === 0) {
      return {
        ok: false,
        error: `Tidak ada antrean pesanan aktif yang membutuhkan SKU ${sku}.`,
      };
    }

    setAllOrders(nextOrders);
    localStorage.setItem(STORAGE_KEYS.ORDERS, JSON.stringify(nextOrders));

    addToast(
      'success',
      `Batch Picking SKU ${sku} Selesai`,
      `Berhasil mengambil SKU ${sku} untuk ${affectedOrdersCount} pesanan sekaligus (Prioritas FEFO).`
    );
    return { ok: true };
  };

  /**
   * Memvalidasi scan barcode satu item pada tahap Packing Validation
   */
  const verifyOrderItemBarcode = (
    orderId: string,
    skuOrBarcode: string
  ): { ok: boolean; message: string } => {
    if (!user) return { ok: false, message: 'Sesi tidak aktif.' };
    const cleanCode = skuOrBarcode.trim().toUpperCase();
    const targetOrder = orders.find((o) => o.id === orderId);
    if (!targetOrder) {
      return { ok: false, message: 'Pesanan tidak ditemukan.' };
    }

    const matchedLine = targetOrder.items.find(
      (i) =>
        i.sku.toUpperCase() === cleanCode ||
        i.barcode.toUpperCase() === cleanCode
    );

    if (!matchedLine) {
      addToast(
        'error',
        'Peringatan Salah Ambil Barang!',
        `Kode "${cleanCode}" tidak terdaftar pada pesanan ${targetOrder.order_no}.`
      );
      return {
        ok: false,
        message: `Barcode/SKU "${cleanCode}" BUKAN bagian dari pesanan ${targetOrder.order_no}!`,
      };
    }

    const nextOrders = allOrders.map((ord) => {
      if (ord.id === orderId && ord.user_id === user.id) {
        return {
          ...ord,
          items: ord.items.map((line) =>
            line.sku === matchedLine.sku
              ? { ...line, picked_qty: line.quantity, packed_verified: true }
              : line
          ),
        };
      }
      return ord;
    });

    setAllOrders(nextOrders);
    localStorage.setItem(STORAGE_KEYS.ORDERS, JSON.stringify(nextOrders));

    addToast(
      'success',
      `Barcode Tervalidasi: ${matchedLine.sku}`,
      `${matchedLine.item_name} (${matchedLine.quantity} ${matchedLine.unit}) cocok 100%.`
    );
    return {
      ok: true,
      message: `${matchedLine.sku} berhasil diverifikasi.`,
    };
  };

  const verifyAllOrderItems = (orderId: string) => {
    if (!user) return;
    const nextOrders = allOrders.map((ord) => {
      if (ord.id === orderId && ord.user_id === user.id) {
        return {
          ...ord,
          items: ord.items.map((line) => ({
            ...line,
            picked_qty: line.quantity,
            packed_verified: true,
          })),
        };
      }
      return ord;
    });
    setAllOrders(nextOrders);
    localStorage.setItem(STORAGE_KEYS.ORDERS, JSON.stringify(nextOrders));
    addToast(
      'success',
      'Seluruh Item Pesanan Tervalidasi',
      'Seluruh barcode produk telah cocok 100%. Pesanan siap cetak label AWB.'
    );
  };

  /**
   * Menerbitkan dokumen Shipping Manifest untuk pesanan READY_TO_SHIP:
   * 1. Mengubah status pesanan menjadi SHIPPED
   * 2. Mengurangi stok fisik di Master Inventaris & mencatat transaksi OUTBOUND
   * 3. Menambah metrik produktivitas karyawan gudang
   * 4. Menerbitkan dokumen Shipping Manifest ke Cloud File Vault
   */
  const createShippingManifest = async (
    payload: CreateManifestPayload
  ): Promise<{ ok: boolean; error?: string; manifest?: ShippingManifest }> => {
    if (!user) return { ok: false, error: 'Sesi tidak ditemukan.' };
    if (!payload.driver_name.trim() || !payload.vehicle_plate.trim()) {
      return {
        ok: false,
        error: 'Nama kurir/driver dan nomor plat kendaraan wajib diisi.',
      };
    }
    if (payload.order_ids.length === 0) {
      return {
        ok: false,
        error: 'Pilih minimal 1 pesanan berstatus Siap Kirim (Ready to Ship).',
      };
    }

    const selectedOrders = orders.filter(
      (o) => payload.order_ids.includes(o.id) && o.status === 'READY_TO_SHIP'
    );
    if (selectedOrders.length === 0) {
      return {
        ok: false,
        error: 'Tidak ada pesanan valid berstatus Siap Kirim yang dipilih.',
      };
    }

    const now = new Date().toISOString();
    const manifestNo = `MNF-CKR-${new Date().getFullYear()}-${String(
      manifests.length + 2
    ).padStart(3, '0')}`;

    const awbList = selectedOrders.map((o) => o.awb_number);
    const totalPackages = selectedOrders.length;
    const totalItems = selectedOrders.reduce(
      (sum, o) => sum + o.items.reduce((s, i) => s + i.quantity, 0),
      0
    );

    const newManifest: ShippingManifest = {
      id: `mnf-${Date.now()}`,
      user_id: user.id,
      manifest_no: manifestNo,
      courier: payload.courier,
      driver_name: payload.driver_name.trim(),
      vehicle_plate: payload.vehicle_plate.trim().toUpperCase(),
      order_ids: selectedOrders.map((o) => o.id),
      awb_list: awbList,
      total_packages: totalPackages,
      total_items: totalItems,
      handed_over_by: user.full_name,
      created_at: now,
    };

    // 1. Update status pesanan menjadi SHIPPED
    const nextOrders = allOrders.map((ord) => {
      if (payload.order_ids.includes(ord.id) && ord.user_id === user.id) {
        return {
          ...ord,
          status: 'SHIPPED' as OrderFulfillmentStatus,
          manifest_no: manifestNo,
        };
      }
      return ord;
    });

    // 2. Kurangi stok fisik & catat transaksi OUTBOUND untuk tiap item dalam pesanan
    const generatedTx: WarehouseTransaction[] = [];
    const nextItems = allItems.map((item) => {
      if (item.user_id !== user.id) return item;
      let deducted = 0;
      for (const ord of selectedOrders) {
        for (const line of ord.items) {
          if (line.item_id === item.id || line.sku === item.sku) {
            deducted += line.quantity;
          }
        }
      }
      if (deducted <= 0) return item;

      const before = item.stock;
      const after = Math.max(0, before - deducted);
      generatedTx.push({
        id: `tx-mnf-${Date.now()}-${item.sku}`,
        user_id: user.id,
        item_id: item.id,
        sku: item.sku,
        item_name: item.name,
        type: 'OUTBOUND',
        quantity: deducted,
        stock_before: before,
        stock_after: after,
        from_location: item.rack_location,
        to_location: `MANIFEST-${manifestNo}`,
        batch_number: item.batch_number,
        reference_no: manifestNo,
        partner_name: `${payload.courier} (${payload.driver_name.trim()})`,
        operator_name: user.full_name,
        notes: `Pengeluaran otomatis via Shipping Manifest ${manifestNo} (${awbList.join(', ')})`,
        created_at: now,
      });

      return {
        ...item,
        stock: after,
        updated_at: now,
      };
    });

    // 3. Terbitkan dokumen Shipping Manifest ke Cloud File Vault
    const fileName = `Shipping_Manifest_${manifestNo}.pdf`;
    const newDoc: WarehouseDocument = {
      id: `doc-mnf-${Date.now()}`,
      user_id: user.id,
      title: `Shipping Manifest ${manifestNo} (${payload.courier})`,
      category: 'Shipping Manifest',
      notes: `Serah terima ${totalPackages} paket (${totalItems} unit) kepada driver ${payload.driver_name} (${payload.vehicle_plate.toUpperCase()}). Daftar AWB: ${awbList.join(', ')}.`,
      file_name: fileName,
      file_path: buildUserStoragePath(user.id, fileName),
      file_size: 294800,
      mime_type: 'application/pdf',
      created_at: now,
      content_preview: `DOKUMEN SERAH TERIMA KURIR (SHIPPING MANIFEST)\nNomor Manifest: ${manifestNo}\nEkspedisi: ${payload.courier}\nDriver: ${payload.driver_name} (${payload.vehicle_plate.toUpperCase()})\nTotal Paket: ${totalPackages} Paket (${totalItems} Unit)\nDaftar Resi AWB: ${awbList.join(', ')}\nDiserahkan Oleh: ${user.full_name}`,
    };

    // 4. Update produktivitas staf
    const nextStaff = allStaff.map((stf) => {
      if (stf.user_id === user.id && (stf.role === 'Picker' || stf.role === 'Packer')) {
        return {
          ...stf,
          orders_completed: stf.orders_completed + totalPackages,
          items_processed: stf.items_processed + totalItems,
        };
      }
      return stf;
    });

    const nextManifests = [newManifest, ...allManifests];
    const nextTransactions = [...generatedTx, ...allTransactions];
    const nextDocs = [newDoc, ...allDocuments];

    setAllOrders(nextOrders);
    setAllItems(nextItems);
    setAllManifests(nextManifests);
    setAllTransactions(nextTransactions);
    setAllDocuments(nextDocs);
    setAllStaff(nextStaff);

    localStorage.setItem(STORAGE_KEYS.ORDERS, JSON.stringify(nextOrders));
    localStorage.setItem(STORAGE_KEYS.ITEMS, JSON.stringify(nextItems));
    localStorage.setItem(STORAGE_KEYS.MANIFESTS, JSON.stringify(nextManifests));
    localStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(nextTransactions));
    localStorage.setItem(STORAGE_KEYS.DOCUMENTS, JSON.stringify(nextDocs));
    localStorage.setItem(STORAGE_KEYS.STAFF, JSON.stringify(nextStaff));

    addToast(
      'success',
      `Shipping Manifest ${manifestNo} Terbit`,
      `${totalPackages} paket diserahkan ke ${payload.courier} & arsip tersimpan di Cloud File Vault.`
    );
    return { ok: true, manifest: newManifest };
  };

  /**
   * Stock Opname Real-Time:
   * Mencocokkan stok fisik aktual dengan stok sistem, mencatat OPNAME_ADJUSTMENT,
   * dan menerbitkan Berita Acara Stock Opname ke Cloud File Vault.
   */
  const submitStockOpname = async (params: {
    auditor_name: string;
    zone_label: string;
    entries: StockOpnameEntry[];
  }): Promise<{ ok: boolean; error?: string; adjustedCount: number }> => {
    if (!user) return { ok: false, error: 'Sesi tidak aktif.', adjustedCount: 0 };

    const now = new Date().toISOString();
    const opnameRef = `SO-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`;
    const newAdjustTx: WarehouseTransaction[] = [];
    const summaryLines: string[] = [];
    let adjustedCount = 0;

    const nextItems = allItems.map((item) => {
      if (item.user_id !== user.id) return item;
      const entry = params.entries.find((e) => e.item_id === item.id);
      if (!entry) return item;

      const actual = Math.max(0, Math.floor(Number(entry.actual_stock)));
      const diff = actual - item.stock;
      if (diff === 0) return item;

      adjustedCount++;
      summaryLines.push(
        `${item.sku} (${item.rack_location}): Sistem ${item.stock} -> Fisik ${actual} (${
          diff > 0 ? `+${diff}` : diff
        } ${item.unit})`
      );

      newAdjustTx.push({
        id: `tx-so-${Date.now()}-${item.sku}`,
        user_id: user.id,
        item_id: item.id,
        sku: item.sku,
        item_name: item.name,
        type: 'OPNAME_ADJUSTMENT',
        quantity: Math.abs(diff),
        stock_before: item.stock,
        stock_after: actual,
        from_location: item.rack_location,
        to_location: item.rack_location,
        batch_number: item.batch_number,
        reference_no: opnameRef,
        partner_name: `Audit Stock Opname (${params.zone_label})`,
        operator_name: params.auditor_name || user.full_name,
        notes:
          entry.reason.trim() ||
          `Penyesuaian Stock Opname selisih ${diff > 0 ? `+${diff}` : diff} ${item.unit}`,
        created_at: now,
      });

      return {
        ...item,
        stock: actual,
        updated_at: now,
      };
    });

    const baFileName = `BA_${opnameRef}_${params.zone_label.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;
    const baDoc: WarehouseDocument = {
      id: `doc-so-${Date.now()}`,
      user_id: user.id,
      title: `Berita Acara Stock Opname ${opnameRef} (${params.zone_label})`,
      category: 'Berita Acara',
      notes:
        adjustedCount > 0
          ? `Auditor: ${params.auditor_name}. Ditemukan & disesuaikan ${adjustedCount} SKU: ${summaryLines.join('; ')}`
          : `Auditor: ${params.auditor_name}. 100% cocok antara stok fisik dan stok sistem pada zona ${params.zone_label}.`,
      file_name: baFileName,
      file_path: buildUserStoragePath(user.id, baFileName),
      file_size: 245600,
      mime_type: 'application/pdf',
      created_at: now,
      content_preview: `BERITA ACARA STOCK OPNAME #${opnameRef}\nZona Audit: ${params.zone_label}\nAuditor: ${params.auditor_name}\nJumlah SKU Disesuaikan: ${adjustedCount}\nRincian: ${
        summaryLines.length > 0 ? summaryLines.join(' | ') : 'Stok fisik 100% akurat sesuai sistem.'
      }`,
    };

    const nextTx = [...newAdjustTx, ...allTransactions];
    const nextDocs = [baDoc, ...allDocuments];

    setAllItems(nextItems);
    setAllTransactions(nextTx);
    setAllDocuments(nextDocs);
    localStorage.setItem(STORAGE_KEYS.ITEMS, JSON.stringify(nextItems));
    localStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(nextTx));
    localStorage.setItem(STORAGE_KEYS.DOCUMENTS, JSON.stringify(nextDocs));

    addToast(
      'success',
      `Stock Opname ${opnameRef} Selesai`,
      adjustedCount > 0
        ? `${adjustedCount} SKU disesuaikan & Berita Acara diterbitkan ke Cloud File Vault.`
        : `Stok fisik 100% akurat & Berita Acara diterbitkan ke Cloud File Vault.`
    );

    return { ok: true, adjustedCount };
  };

  const uploadDocument = async (
    payload: UploadDocumentPayload
  ): Promise<{ ok: boolean; error?: string }> => {
    if (!user) return { ok: false, error: 'Sesi tidak ditemukan.' };

    const check = validateDocumentUpload({
      title: payload.title,
      fileName: payload.file.name,
      fileSize: payload.file.size,
    });

    if (!check.valid) {
      return { ok: false, error: check.error };
    }

    const storagePath = buildUserStoragePath(user.id, payload.file.name);
    const now = new Date().toISOString();

    let localDataUrl: string | undefined;
    if (payload.file.size <= 2 * 1024 * 1024) {
      localDataUrl = await new Promise<string | undefined>((resolve) => {
        const reader = new FileReader();
        reader.onload = () =>
          resolve(typeof reader.result === 'string' ? reader.result : undefined);
        reader.onerror = () => resolve(undefined);
        reader.readAsDataURL(payload.file);
      });
    }

    const newDoc: WarehouseDocument = {
      id: `doc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      user_id: user.id,
      title: payload.title.trim(),
      category: payload.category,
      notes: payload.notes.trim(),
      file_name: payload.file.name,
      file_path: storagePath,
      file_size: payload.file.size,
      mime_type: payload.file.type || 'application/pdf',
      created_at: now,
      local_data_url: localDataUrl,
    };

    const nextDocs = [newDoc, ...allDocuments];
    setAllDocuments(nextDocs);
    try {
      localStorage.setItem(STORAGE_KEYS.DOCUMENTS, JSON.stringify(nextDocs));
    } catch {
      const slimDocs = nextDocs.map(({ local_data_url, ...rest }) => rest);
      localStorage.setItem(STORAGE_KEYS.DOCUMENTS, JSON.stringify(slimDocs));
    }

    addToast(
      'success',
      'Dokumen Berhasil Diunggah',
      `Disimpan di bucket privat: ${STORAGE_BUCKET}/${storagePath}`
    );
    return { ok: true };
  };

  const deleteDocument = async (
    docId: string
  ): Promise<{ ok: boolean; error?: string }> => {
    if (!user) return { ok: false, error: 'Sesi tidak ditemukan.' };

    const target = documents.find((d) => d.id === docId && d.user_id === user.id);
    if (!target) {
      return {
        ok: false,
        error: 'Akses ditolak: Dokumen tidak ditemukan atau bukan milik akun Anda.',
      };
    }

    if (!canUserAccessStoragePath(user.id, target.file_path)) {
      return {
        ok: false,
        error: 'Pelanggaran kebijakan Storage RLS: Folder bukan milik user_id aktif.',
      };
    }

    const nextDocs = allDocuments.filter(
      (d) => !(d.id === docId && d.user_id === user.id)
    );
    setAllDocuments(nextDocs);
    localStorage.setItem(STORAGE_KEYS.DOCUMENTS, JSON.stringify(nextDocs));
    addToast('info', 'Dokumen Dihapus', `${target.title} telah dihapus dari penyimpanan.`);
    return { ok: true };
  };

  const getSignedDocumentUrl = async (
    doc: WarehouseDocument
  ): Promise<{ ok: boolean; url?: string; expiresAt?: string; error?: string }> => {
    if (!user) return { ok: false, error: 'Sesi tidak aktif.' };

    if (doc.user_id !== user.id || !canUserAccessStoragePath(user.id, doc.file_path)) {
      return {
        ok: false,
        error: 'Storage RLS Policy: Anda tidak memiliki izin mengakses folder akun lain.',
      };
    }

    const expiresAt = new Date(Date.now() + 3600 * 1000).toISOString();
    const token = btoa(`${doc.user_id}:${doc.file_path}:${expiresAt}`).slice(0, 48);
    const simulatedSignedUrl =
      doc.local_data_url ||
      `https://project.supabase.co/storage/v1/object/sign/${STORAGE_BUCKET}/${encodeURIComponent(
        doc.file_path
      )}?token=${token}&expires_in=3600`;

    return {
      ok: true,
      url: simulatedSignedUrl,
      expiresAt,
    };
  };

  const resetDemoData = () => {
    const initialItems = createInitialItems();
    const initialTx = createInitialTransactions();
    const initialDocs = createInitialDocuments();
    const initialOrders = createInitialOrders();
    const initialManifests = createInitialManifests();
    const initialStaff = createInitialStaffMetrics();

    localStorage.setItem(STORAGE_KEYS.ITEMS, JSON.stringify(initialItems));
    localStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(initialTx));
    localStorage.setItem(STORAGE_KEYS.DOCUMENTS, JSON.stringify(initialDocs));
    localStorage.setItem(STORAGE_KEYS.ORDERS, JSON.stringify(initialOrders));
    localStorage.setItem(STORAGE_KEYS.MANIFESTS, JSON.stringify(initialManifests));
    localStorage.setItem(STORAGE_KEYS.STAFF, JSON.stringify(initialStaff));

    setAllItems(initialItems);
    setAllTransactions(initialTx);
    setAllDocuments(initialDocs);
    setAllOrders(initialOrders);
    setAllManifests(initialManifests);
    setAllStaff(initialStaff);

    addToast(
      'info',
      'Data Demo WMS Direset',
      'Seluruh data inventaris, fulfillment, manifest, dan dokumen dikembalikan ke kondisi awal.'
    );
  };

  return (
    <WarehouseContext.Provider
      value={{
        user,
        authLoading,
        dataLoading,
        isCloudConnected: isSupabaseConfigured,
        items,
        transactions,
        documents,
        orders,
        manifests,
        staffMetrics,
        toasts,
        addToast,
        dismissToast,
        login,
        signIn,
        register,
        signUp,
        loginDemoAccount,
        logout,
        signOut,
        saveItem,
        deleteItem,
        recordTransaction,
        executeReplenishment,
        createOrder,
        advanceOrderStatus,
        completeBatchPickingForSku,
        verifyOrderItemBarcode,
        verifyAllOrderItems,
        createShippingManifest,
        submitStockOpname,
        uploadDocument,
        deleteDocument,
        getSignedDocumentUrl,
        resetDemoData,
      }}
    >
      {children}
    </WarehouseContext.Provider>
  );
};

export function useWarehouse(): WarehouseContextValue {
  const ctx = useContext(WarehouseContext);
  if (!ctx) {
    throw new Error('useWarehouse harus digunakan di dalam WarehouseProvider');
  }
  return ctx;
}
