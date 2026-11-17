import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import {
  DocumentCategory,
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
  createInitialTransactions,
  DEMO_USERS,
} from '../lib/seedData';
import {
  buildUserStoragePath,
  canUserAccessStoragePath,
  validateDocumentUpload,
  validateTransactionInput,
} from '../utils/warehouseRules';

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info';
  title: string;
  description?: string;
}

interface UpsertItemPayload {
  id?: string;
  sku: string;
  name: string;
  category: string;
  rack_location: string;
  stock: number;
  min_stock: number;
  unit: string;
}

interface CreateTransactionPayload {
  item_id: string;
  type: TransactionType;
  quantity: number;
  reference_no: string;
  partner_name: string;
  notes: string;
}

interface UploadDocumentPayload {
  title: string;
  category: DocumentCategory;
  notes: string;
  file: File;
}

interface WarehouseContextValue {
  user: UserSessionProfile | null;
  authLoading: boolean;
  dataLoading: boolean;
  isCloudConnected: boolean;
  items: WarehouseItem[];
  transactions: WarehouseTransaction[];
  documents: WarehouseDocument[];
  toasts: ToastMessage[];
  addToast: (type: ToastMessage['type'], title: string, description?: string) => void;
  dismissToast: (id: string) => void;
  login: (email: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  register: (params: {
    email: string;
    password: string;
    fullName: string;
    warehouseZone: string;
  }) => Promise<{ ok: boolean; error?: string }>;
  loginDemoAccount: (email: string) => Promise<void>;
  logout: () => Promise<void>;
  saveItem: (payload: UpsertItemPayload) => Promise<{ ok: boolean; error?: string }>;
  deleteItem: (itemId: string) => Promise<{ ok: boolean; error?: string }>;
  recordTransaction: (
    payload: CreateTransactionPayload
  ) => Promise<{ ok: boolean; error?: string }>;
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
  SESSION: 'logivault_active_session_v1',
  USERS: 'logivault_registered_users_v1',
  ITEMS: 'logivault_items_v1',
  TRANSACTIONS: 'logivault_transactions_v1',
  DOCUMENTS: 'logivault_documents_v1',
};

export const WarehouseProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserSessionProfile | null>(null);
  const [authLoading, setAuthLoading] = useState<boolean>(true);
  const [dataLoading, setDataLoading] = useState<boolean>(false);

  const [allItems, setAllItems] = useState<WarehouseItem[]>([]);
  const [allTransactions, setAllTransactions] = useState<WarehouseTransaction[]>([]);
  const [allDocuments, setAllDocuments] = useState<WarehouseDocument[]>([]);
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

  // Inisialisasi data lokal ber-isolasi user_id
  const loadLocalDatabase = () => {
    try {
      const rawItems = localStorage.getItem(STORAGE_KEYS.ITEMS);
      const rawTx = localStorage.getItem(STORAGE_KEYS.TRANSACTIONS);
      const rawDocs = localStorage.getItem(STORAGE_KEYS.DOCUMENTS);

      const parsedItems: WarehouseItem[] = rawItems
        ? JSON.parse(rawItems)
        : createInitialItems();
      const parsedTx: WarehouseTransaction[] = rawTx
        ? JSON.parse(rawTx)
        : createInitialTransactions();
      const parsedDocs: WarehouseDocument[] = rawDocs
        ? JSON.parse(rawDocs)
        : createInitialDocuments();

      if (!rawItems) localStorage.setItem(STORAGE_KEYS.ITEMS, JSON.stringify(parsedItems));
      if (!rawTx) localStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(parsedTx));
      if (!rawDocs) localStorage.setItem(STORAGE_KEYS.DOCUMENTS, JSON.stringify(parsedDocs));

      setAllItems(parsedItems);
      setAllTransactions(parsedTx);
      setAllDocuments(parsedDocs);
    } catch {
      setAllItems(createInitialItems());
      setAllTransactions(createInitialTransactions());
      setAllDocuments(createInitialDocuments());
    }
  };

  // Memuat data dari Supabase dengan filter wajib .eq('user_id', activeUserId)
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

      if (itemsRes.data) setAllItems(itemsRes.data as WarehouseItem[]);
      if (txRes.data) setAllTransactions(txRes.data as WarehouseTransaction[]);
      if (docsRes.data) setAllDocuments(docsRes.data as WarehouseDocument[]);
    } finally {
      setDataLoading(false);
    }
  };

  // Inisialisasi sesi Auth saat aplikasi dimuat
  useEffect(() => {
    const initSession = async () => {
      setAuthLoading(true);

      if (isSupabaseConfigured && supabase) {
        const { data } = await supabase.auth.getSession();
        if (data.session?.user) {
          const sbUser = data.session.user;
          const profile: UserSessionProfile = {
            id: sbUser.id,
            email: sbUser.email || 'user@warehouse.id',
            full_name:
              (sbUser.user_metadata?.full_name as string) ||
              sbUser.email?.split('@')[0] ||
              'Admin Gudang',
            warehouse_zone:
              (sbUser.user_metadata?.warehouse_zone as string) || 'Gudang Utama',
            role: 'Admin Warehouse',
          };
          setUser(profile);
          await fetchSupabaseDataForUser(profile.id);
        }
        setAuthLoading(false);
        return;
      }

      // Mode SPA Client-Side dengan simulasi RLS per akun
      loadLocalDatabase();
      const savedSession = localStorage.getItem(STORAGE_KEYS.SESSION);
      const searchParams = new URLSearchParams(window.location.search);
      const autostart = searchParams.get('autostart') === '1';

      if (savedSession) {
        try {
          setUser(JSON.parse(savedSession));
        } catch {
          localStorage.removeItem(STORAGE_KEYS.SESSION);
        }
      } else if (autostart) {
        const demoProfile = DEMO_USERS['budi.gudang@logivault.id'];
        const sessionObj: UserSessionProfile = {
          id: demoProfile.id,
          email: demoProfile.email,
          full_name: demoProfile.full_name,
          warehouse_zone: demoProfile.warehouse_zone,
          role: demoProfile.role,
        };
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

  const login = async (
    email: string,
    password: string
  ): Promise<{ ok: boolean; error?: string }> => {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !password) {
      return { ok: false, error: 'Email dan kata sandi wajib diisi.' };
    }

    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password,
      });
      if (error || !data.user) {
        return {
          ok: false,
          error: error?.message || 'Gagal masuk. Periksa kembali email dan kata sandi.',
        };
      }
      const profile: UserSessionProfile = {
        id: data.user.id,
        email: data.user.email || cleanEmail,
        full_name:
          (data.user.user_metadata?.full_name as string) ||
          cleanEmail.split('@')[0],
        warehouse_zone:
          (data.user.user_metadata?.warehouse_zone as string) || 'Gudang Utama',
        role: 'Admin Warehouse',
      };
      setUser(profile);
      await fetchSupabaseDataForUser(profile.id);
      addToast('success', 'Berhasil Masuk', `Selamat datang kembali, ${profile.full_name}.`);
      return { ok: true };
    }

    // Validasi terhadap DEMO_USERS atau akun yang baru didaftarkan di localStorage
    const customUsersRaw = localStorage.getItem(STORAGE_KEYS.USERS);
    const customUsers: Record<
      string,
      UserSessionProfile & { password: string }
    > = customUsersRaw ? JSON.parse(customUsersRaw) : {};

    const allKnownUsers = { ...DEMO_USERS, ...customUsers };
    const found = allKnownUsers[cleanEmail];

    if (!found || found.password !== password) {
      return {
        ok: false,
        error: 'Kredensial tidak valid. Periksa kembali email atau kata sandi Anda.',
      };
    }

    const sessionObj: UserSessionProfile = {
      id: found.id,
      email: found.email,
      full_name: found.full_name,
      warehouse_zone: found.warehouse_zone,
      role: found.role,
    };

    localStorage.setItem(STORAGE_KEYS.SESSION, JSON.stringify(sessionObj));
    setUser(sessionObj);
    addToast(
      'success',
      'Sesi Terautentikasi',
      `Data gudang diisolasi untuk akun ${sessionObj.full_name} (${sessionObj.warehouse_zone}).`
    );
    return { ok: true };
  };

  const loginDemoAccount = async (email: string) => {
    const cleanEmail = email.trim().toLowerCase();
    const demo = DEMO_USERS[cleanEmail];
    if (!demo) return;
    const sessionObj: UserSessionProfile = {
      id: demo.id,
      email: demo.email,
      full_name: demo.full_name,
      warehouse_zone: demo.warehouse_zone,
      role: demo.role,
    };
    localStorage.setItem(STORAGE_KEYS.SESSION, JSON.stringify(sessionObj));
    setUser(sessionObj);
    addToast(
      'info',
      `Beralih ke Akun: ${demo.full_name}`,
      `RLS aktif — Menampilkan data eksklusif untuk user_id ${demo.id.slice(0, 8)}...`
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

    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase.auth.signUp({
        email: cleanEmail,
        password: params.password,
        options: {
          data: {
            full_name: cleanName,
            warehouse_zone: cleanZone,
          },
        },
      });
      if (error || !data.user) {
        return { ok: false, error: error?.message || 'Gagal mendaftarkan akun.' };
      }
      const profile: UserSessionProfile = {
        id: data.user.id,
        email: cleanEmail,
        full_name: cleanName,
        warehouse_zone: cleanZone,
        role: 'Admin Warehouse',
      };
      setUser(profile);
      await fetchSupabaseDataForUser(profile.id);
      addToast(
        'success',
        'Registrasi Berhasil',
        `Ruang kerja terisolasi untuk ${cleanName} siap digunakan.`
      );
      return { ok: true };
    }

    const customUsersRaw = localStorage.getItem(STORAGE_KEYS.USERS);
    const customUsers: Record<
      string,
      UserSessionProfile & { password: string }
    > = customUsersRaw ? JSON.parse(customUsersRaw) : {};

    if (DEMO_USERS[cleanEmail] || customUsers[cleanEmail]) {
      return {
        ok: false,
        error: 'Email ini sudah terdaftar. Silakan gunakan halaman Login.',
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
      role: 'Admin Warehouse',
      password: params.password,
    };

    customUsers[cleanEmail] = newRecord;
    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(customUsers));

    const sessionObj: UserSessionProfile = {
      id: newRecord.id,
      email: newRecord.email,
      full_name: newRecord.full_name,
      warehouse_zone: newRecord.warehouse_zone,
      role: newRecord.role,
    };
    localStorage.setItem(STORAGE_KEYS.SESSION, JSON.stringify(sessionObj));
    setUser(sessionObj);
    addToast(
      'success',
      'Akun Gudang Baru Aktif',
      `Workspace terisolasi dibuat dengan user_id: ${newUserId}`
    );
    return { ok: true };
  };

  const logout = async () => {
    if (isSupabaseConfigured && supabase) {
      await supabase.auth.signOut();
    }
    localStorage.removeItem(STORAGE_KEYS.SESSION);
    setUser(null);
    addToast('info', 'Sesi Berakhir', 'Anda telah keluar dari sistem Admin Warehouse.');
  };

  const saveItem = async (
    payload: UpsertItemPayload
  ): Promise<{ ok: boolean; error?: string }> => {
    if (!user) return { ok: false, error: 'Sesi tidak ditemukan. Silakan login kembali.' };

    const cleanSku = payload.sku.trim().toUpperCase();
    const cleanName = payload.name.trim();
    const cleanCategory = payload.category.trim();
    const cleanRack = payload.rack_location.trim().toUpperCase();
    const cleanUnit = payload.unit.trim() || 'Pcs';

    if (!cleanSku || !cleanName || !cleanCategory || !cleanRack) {
      return { ok: false, error: 'Kode SKU, Nama Barang, Kategori, dan Lokasi Rak wajib diisi.' };
    }
    if (payload.stock < 0 || payload.min_stock < 0) {
      return { ok: false, error: 'Stok dan batas minimum stok tidak boleh bernilai negatif.' };
    }

    // Cek duplikasi SKU pada akun user yang sama
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

    if (isSupabaseConfigured && supabase) {
      if (payload.id) {
        const { error } = await supabase
          .from('items')
          .update({
            sku: cleanSku,
            name: cleanName,
            category: cleanCategory,
            rack_location: cleanRack,
            stock: payload.stock,
            min_stock: payload.min_stock,
            unit: cleanUnit,
            updated_at: now,
          })
          .eq('id', payload.id)
          .eq('user_id', user.id);

        if (error) return { ok: false, error: error.message };
      } else {
        const { error } = await supabase.from('items').insert({
          user_id: user.id,
          sku: cleanSku,
          name: cleanName,
          category: cleanCategory,
          rack_location: cleanRack,
          stock: payload.stock,
          min_stock: payload.min_stock,
          unit: cleanUnit,
        });

        if (error) return { ok: false, error: error.message };
      }

      await fetchSupabaseDataForUser(user.id);
      addToast(
        'success',
        payload.id ? 'Data Barang Diperbarui' : 'Barang Baru Ditambahkan',
        `${cleanSku} — ${cleanName}`
      );
      return { ok: true };
    }

    // Update pada database lokal ber-isolasi user_id
    let updatedList: WarehouseItem[];
    if (payload.id) {
      updatedList = allItems.map((item) => {
        if (item.id === payload.id && item.user_id === user.id) {
          return {
            ...item,
            sku: cleanSku,
            name: cleanName,
            category: cleanCategory,
            rack_location: cleanRack,
            stock: Number(payload.stock),
            min_stock: Number(payload.min_stock),
            unit: cleanUnit,
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
        name: cleanName,
        category: cleanCategory,
        rack_location: cleanRack,
        stock: Number(payload.stock),
        min_stock: Number(payload.min_stock),
        unit: cleanUnit,
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
      `${cleanSku} — ${cleanName} (${payload.stock} ${cleanUnit})`
    );
    return { ok: true };
  };

  const deleteItem = async (itemId: string): Promise<{ ok: boolean; error?: string }> => {
    if (!user) return { ok: false, error: 'Tidak ada sesi aktif.' };
    const target = items.find((i) => i.id === itemId && i.user_id === user.id);
    if (!target) {
      return { ok: false, error: 'Barang tidak ditemukan atau bukan milik akun Anda.' };
    }

    if (isSupabaseConfigured && supabase) {
      const { error } = await supabase
        .from('items')
        .delete()
        .eq('id', itemId)
        .eq('user_id', user.id);
      if (error) return { ok: false, error: error.message };
      await fetchSupabaseDataForUser(user.id);
      addToast('info', 'SKU Dihapus', `${target.sku} telah dihapus dari inventaris.`);
      return { ok: true };
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

    if (isSupabaseConfigured && supabase) {
      // 1. Insert ke tabel transactions dengan user_id
      const { error: txErr } = await supabase.from('transactions').insert({
        user_id: user.id,
        item_id: targetItem.id,
        sku: targetItem.sku,
        item_name: targetItem.name,
        type: payload.type,
        quantity: Number(payload.quantity),
        stock_before: validation.stockBefore,
        stock_after: validation.stockAfter,
        reference_no: payload.reference_no.trim().toUpperCase(),
        partner_name: payload.partner_name.trim(),
        notes: payload.notes.trim(),
      });

      if (txErr) return { ok: false, error: txErr.message };

      // 2. Update stok otomatis pada tabel items dengan filter user_id
      const { error: itemErr } = await supabase
        .from('items')
        .update({
          stock: validation.stockAfter,
          updated_at: now,
        })
        .eq('id', targetItem.id)
        .eq('user_id', user.id);

      if (itemErr) return { ok: false, error: itemErr.message };

      await fetchSupabaseDataForUser(user.id);
      addToast(
        'success',
        payload.type === 'INBOUND'
          ? 'Transaksi Barang Masuk Tercatat'
          : 'Transaksi Barang Keluar Tercatat',
        `Stok ${targetItem.sku} diperbarui: ${validation.stockBefore} → ${validation.stockAfter} ${targetItem.unit}`
      );
      return { ok: true };
    }

    // Eksekusi atomik di state lokal
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
      reference_no: payload.reference_no.trim().toUpperCase(),
      partner_name: payload.partner_name.trim(),
      notes: payload.notes.trim(),
      created_at: now,
    };

    const nextTransactions = [newTx, ...allTransactions];
    const nextItems = allItems.map((item) => {
      if (item.id === targetItem.id && item.user_id === user.id) {
        return {
          ...item,
          stock: validation.stockAfter,
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
        ? 'Barang Masuk (Inbound) Berhasil'
        : 'Barang Keluar (Outbound) Berhasil',
      `Stok ${targetItem.sku} otomatis berubah dari ${validation.stockBefore} menjadi ${validation.stockAfter} ${targetItem.unit}.`
    );

    return { ok: true };
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

    // Path khusus per akun wajib berformat: {user_id}/{timestamp}_{nama_file}
    const storagePath = buildUserStoragePath(user.id, payload.file.name);
    const now = new Date().toISOString();

    if (isSupabaseConfigured && supabase) {
      // 1. Upload ke bucket privat warehouse-docs di path {user_id}/{nama_file}
      const { error: uploadErr } = await supabase.storage
        .from(STORAGE_BUCKET)
        .upload(storagePath, payload.file, {
          cacheControl: '3600',
          upsert: false,
        });

      if (uploadErr) {
        return { ok: false, error: `Gagal unggah ke Storage: ${uploadErr.message}` };
      }

      // 2. Simpan metadata dokumen di tabel public.documents dengan user_id
      const { error: dbErr } = await supabase.from('documents').insert({
        user_id: user.id,
        title: payload.title.trim(),
        category: payload.category,
        notes: payload.notes.trim(),
        file_name: payload.file.name,
        file_path: storagePath,
        file_size: payload.file.size,
        mime_type: payload.file.type || 'application/octet-stream',
      });

      if (dbErr) {
        return { ok: false, error: `Gagal simpan metadata dokumen: ${dbErr.message}` };
      }

      await fetchSupabaseDataForUser(user.id);
      addToast(
        'success',
        'Dokumen Tersimpan di Cloud Vault',
        `Path terisolasi: ${storagePath}`
      );
      return { ok: true };
    }

    // Baca data URL untuk preview aman jika file berukuran <= 2MB pada simulasi lokal
    let localDataUrl: string | undefined;
    if (payload.file.size <= 2 * 1024 * 1024) {
      localDataUrl = await new Promise<string | undefined>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : undefined);
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
      // Jika kuota localStorage penuh karena data URL besar, simpan tanpa data URL
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

    if (isSupabaseConfigured && supabase) {
      await supabase.storage.from(STORAGE_BUCKET).remove([target.file_path]);
      const { error } = await supabase
        .from('documents')
        .delete()
        .eq('id', docId)
        .eq('user_id', user.id);

      if (error) return { ok: false, error: error.message };
      await fetchSupabaseDataForUser(user.id);
      addToast('info', 'Dokumen Dihapus', `${target.file_name} telah dihapus dari Cloud Vault.`);
      return { ok: true };
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

    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase.storage
        .from(STORAGE_BUCKET)
        .createSignedUrl(doc.file_path, 3600);

      if (error || !data?.signedUrl) {
        return {
          ok: false,
          error: error?.message || 'Gagal menerbitkan Signed URL sementara.',
        };
      }

      return {
        ok: true,
        url: data.signedUrl,
        expiresAt,
      };
    }

    // Buat token Signed URL sementara yang realistis untuk mode simulasi
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
    localStorage.setItem(STORAGE_KEYS.ITEMS, JSON.stringify(initialItems));
    localStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(initialTx));
    localStorage.setItem(STORAGE_KEYS.DOCUMENTS, JSON.stringify(initialDocs));
    setAllItems(initialItems);
    setAllTransactions(initialTx);
    setAllDocuments(initialDocs);
    addToast(
      'info',
      'Data Demo Direset',
      'Seluruh data inventaris, transaksi, dan dokumen dikembalikan ke kondisi awal.'
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
        toasts,
        addToast,
        dismissToast,
        login,
        register,
        loginDemoAccount,
        logout,
        saveItem,
        deleteItem,
        recordTransaction,
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
