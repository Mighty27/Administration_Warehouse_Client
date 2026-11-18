import React, { useRef, useState } from 'react';
import {
  Download,
  Eye,
  FileSpreadsheet,
  FileText,
  Image as ImageIcon,
  Lock,
  Search,
  ShieldCheck,
  Trash2,
  UploadCloud,
  X,
} from 'lucide-react';
import { useWarehouse } from '../context/WarehouseContext';
import { DocumentCategory, WarehouseDocument } from '../types/warehouse';
import {
  filterUserDocuments,
  formatFileSize,
} from '../utils/warehouseRules';
import { STORAGE_BUCKET } from '../lib/supabase';

const DOC_CATEGORIES: DocumentCategory[] = [
  'Surat Jalan',
  'Shipping Manifest',
  'Invoice',
  'Berita Acara',
  'Lainnya',
];

export const Documents: React.FC = () => {
  const {
    user,
    documents,
    uploadDocument,
    deleteDocument,
    getSignedDocumentUrl,
    addToast,
  } = useWarehouse();

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<DocumentCategory>('Surat Jalan');
  const [notes, setNotes] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // State Modal Pratinjau Signed URL
  const [previewDoc, setPreviewDoc] = useState<WarehouseDocument | null>(null);
  const [signedUrlData, setSignedUrlData] = useState<{
    url: string;
    expiresAt: string;
  } | null>(null);

  if (!user) return null;

  const filteredDocs = filterUserDocuments(
    documents,
    user.id,
    categoryFilter,
    searchQuery
  );

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUploadError(null);
    const file = e.target.files?.[0] || null;
    setSelectedFile(file);
    if (file && !title.trim()) {
      const baseName = file.name.replace(/\.[^/.]+$/, '').replace(/[_-]/g, ' ');
      setTitle(baseName);
    }
  };

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setUploadError(null);

    if (!selectedFile) {
      setUploadError('Silakan pilih file dokumen terlebih dahulu (maks. 10MB).');
      return;
    }

    setUploading(true);
    const res = await uploadDocument({
      title,
      category,
      notes,
      file: selectedFile,
    });
    setUploading(false);

    if (!res.ok) {
      setUploadError(res.error || 'Gagal mengunggah dokumen.');
      return;
    }

    setTitle('');
    setNotes('');
    setSelectedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleOpenPreview = async (doc: WarehouseDocument) => {
    const res = await getSignedDocumentUrl(doc);
    if (!res.ok || !res.url) {
      addToast('error', 'Gagal Membuka Pratinjau', res.error);
      return;
    }
    setPreviewDoc(doc);
    setSignedUrlData({
      url: res.url,
      expiresAt: res.expiresAt || new Date(Date.now() + 3600 * 1000).toISOString(),
    });
  };

  const handleDownload = async (doc: WarehouseDocument) => {
    const res = await getSignedDocumentUrl(doc);
    if (!res.ok || !res.url) {
      addToast('error', 'Gagal Mengunduh Dokumen', res.error);
      return;
    }

    if (doc.local_data_url) {
      const link = document.createElement('a');
      link.href = doc.local_data_url;
      link.download = doc.file_name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else {
      const summaryBlob = new Blob(
        [
          `LOGIVAULT CLOUD FILE VAULT — ARSIP TERVERIFIKASI\n` +
            `=================================================\n` +
            `Judul Dokumen : ${doc.title}\n` +
            `Kategori      : ${doc.category}\n` +
            `Nama File     : ${doc.file_name}\n` +
            `Bucket Path   : ${STORAGE_BUCKET}/${doc.file_path}\n` +
            `Pemilik (UID) : ${doc.user_id}\n` +
            `Ukuran File   : ${formatFileSize(doc.file_size)}\n` +
            `Waktu Upload  : ${doc.created_at}\n` +
            `Catatan       : ${doc.notes || '-'}\n` +
            `Isi / Ringkasan:\n${doc.content_preview || '-'}\n` +
            `Signed URL    : ${res.url}\n`,
        ],
        { type: 'text/plain;charset=utf-8' }
      );
      const blobUrl = URL.createObjectURL(summaryBlob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = doc.file_name.endsWith('.txt')
        ? doc.file_name
        : `${doc.file_name}.txt`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(blobUrl);
    }

    addToast(
      'success',
      'Unduhan Dimulai',
      `Mengunduh ${doc.file_name} melalui Signed URL aman.`
    );
  };

  const renderFileIcon = (mime: string, fileName: string) => {
    const lower = fileName.toLowerCase();
    if (mime.startsWith('image/') || lower.endsWith('.png') || lower.endsWith('.jpg')) {
      return <ImageIcon className="w-5 h-5 text-indigo-600 dark:text-indigo-400 shrink-0" />;
    }
    if (lower.endsWith('.xlsx') || lower.endsWith('.xls')) {
      return <FileSpreadsheet className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />;
    }
    return <FileText className="w-5 h-5 text-slate-600 dark:text-slate-300 shrink-0" />;
  };

  const formatDate = (iso: string) => {
    return new Date(iso).toLocaleDateString('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
            Cloud File Vault (Arsip Dokumen & Shipping Manifest)
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Bucket privat <code className="font-mono text-xs bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">{STORAGE_BUCKET}</code> dengan isolasi direktori RLS{' '}
            <code className="font-mono text-xs text-indigo-600 dark:text-indigo-400">
              {user.id.slice(0, 8)}.../{'{nama_file}'}
            </code>
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Form Upload Dokumen (4 Kolom) */}
        <section className="lg:col-span-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5">
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              Unggah Dokumen Operasional
            </h2>
            <Lock className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
            Mendukung PDF, JPG/PNG, XLSX, dan DOCX (Maksimal 10 MB per file)
          </p>

          <form onSubmit={handleUploadSubmit} noValidate className="space-y-4">
            {uploadError && (
              <div
                role="alert"
                className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-300"
              >
                {uploadError}
              </div>
            )}

            <div>
              <span className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                File Dokumen
              </span>
              <label
                htmlFor="vault-file-input"
                className="flex flex-col items-center justify-center border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-indigo-500 rounded-xl p-5 text-center bg-slate-50 dark:bg-slate-800/50 cursor-pointer transition-colors"
              >
                <UploadCloud className="w-7 h-7 text-indigo-600 dark:text-indigo-400 mb-2" />
                <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                  {selectedFile
                    ? selectedFile.name
                    : 'Klik untuk memilih file dari perangkat Anda'}
                </span>
                <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400 mt-1">
                  {selectedFile
                    ? `Ukuran: ${formatFileSize(selectedFile.size)}`
                    : 'PDF, JPG, PNG, XLSX, DOCX · Maks 10 MB'}
                </span>
                <input
                  ref={fileInputRef}
                  id="vault-file-input"
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png,.xlsx,.xls,.docx,.doc"
                  onChange={handleFileChange}
                  className="sr-only"
                />
              </label>
            </div>

            <div>
              <label
                htmlFor="vault-title"
                className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
              >
                Judul Dokumen
              </label>
              <input
                id="vault-title"
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Contoh: Surat Jalan Pengiriman Palet Batch IV"
                className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label
                htmlFor="vault-category"
                className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
              >
                Kategori Dokumen
              </label>
              <select
                id="vault-category"
                value={category}
                onChange={(e) => setCategory(e.target.value as DocumentCategory)}
                className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {DOC_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="vault-notes"
                className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
              >
                Catatan Singkat
              </label>
              <textarea
                id="vault-notes"
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Keterangan nomor PO/DO terkait atau nama penandatangan..."
                className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <button
              type="submit"
              disabled={uploading}
              className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-semibold rounded-lg transition-colors"
            >
              {uploading
                ? 'Mengenkripsi & Mengunggah...'
                : 'Unggah ke Cloud File Vault'}
            </button>
          </form>
        </section>

        {/* Daftar Dokumen Tersimpan (8 Kolom) */}
        <section className="lg:col-span-8 space-y-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="search"
                aria-label="Cari dokumen tersimpan"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari judul dokumen, nama file, manifest, atau catatan..."
                className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0">
              <button
                type="button"
                onClick={() => setCategoryFilter('ALL')}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                  categoryFilter === 'ALL'
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                }`}
              >
                Semua ({documents.length})
              </button>
              {DOC_CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategoryFilter(cat)}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                    categoryFilter === cat
                      ? 'bg-indigo-600 text-white'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {filteredDocs.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-10 text-center">
              <FileText className="w-8 h-8 text-slate-400 mx-auto mb-2" />
              <p className="text-sm font-semibold text-slate-900 dark:text-white">
                Belum Ada Dokumen Tersimpan
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Unggah Surat Jalan, Shipping Manifest, Invoice, atau Berita Acara pada panel di samping.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredDocs.map((doc) => (
                <div
                  key={doc.id}
                  className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:border-slate-300 dark:hover:border-slate-700 transition-colors"
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center shrink-0 mt-0.5">
                      {renderFileIcon(doc.mime_type, doc.file_name)}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 flex-wrap">
                        <span className="px-2 py-0.5 text-[11px] font-semibold rounded bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                          {doc.category}
                        </span>
                        <span>•</span>
                        <span className="font-mono">{formatFileSize(doc.file_size)}</span>
                        <span>•</span>
                        <span>{formatDate(doc.created_at)}</span>
                      </div>

                      <h3 className="text-sm font-bold text-slate-900 dark:text-white mt-1">
                        {doc.title}
                      </h3>

                      {doc.notes && (
                        <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">
                          {doc.notes}
                        </p>
                      )}

                      <p
                        className="font-mono text-[11px] text-slate-400 dark:text-slate-500 truncate mt-1"
                        title={doc.file_path}
                      >
                        Path: {STORAGE_BUCKET}/{doc.file_path}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100 dark:border-slate-800">
                    <button
                      type="button"
                      onClick={() => handleOpenPreview(doc)}
                      aria-label={`Preview dokumen ${doc.title}`}
                      className="px-3 py-1.5 rounded-lg border border-indigo-200 dark:border-indigo-800 bg-indigo-50/70 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Preview</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDownload(doc)}
                      aria-label={`Download dokumen ${doc.title}`}
                      className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Download</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => deleteDocument(doc.id)}
                      aria-label={`Hapus dokumen ${doc.title}`}
                      className="p-1.5 rounded-lg border border-rose-200 dark:border-rose-900/60 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Modal Pratinjau Dokumen dengan Signed URL Sementara */}
      {previewDoc && signedUrlData && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="preview-doc-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4"
        >
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl max-w-2xl w-full overflow-hidden shadow-xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-800">
              <div>
                <h3
                  id="preview-doc-title"
                  className="text-base font-bold text-slate-900 dark:text-white"
                >
                  {previewDoc.title}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {previewDoc.category} · {previewDoc.file_name} ({formatFileSize(previewDoc.file_size)})
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setPreviewDoc(null);
                  setSignedUrlData(null);
                }}
                aria-label="Tutup pratinjau dokumen"
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/80 flex items-start gap-2.5">
                <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                <div className="min-w-0 flex-1 text-xs">
                  <p className="font-semibold text-emerald-900 dark:text-emerald-200">
                    Signed URL Sementara Aktif (Berlaku 60 Menit)
                  </p>
                  <p className="font-mono text-[11px] text-emerald-700 dark:text-emerald-300 truncate mt-0.5">
                    {signedUrlData.url}
                  </p>
                </div>
              </div>

              {previewDoc.local_data_url &&
              previewDoc.mime_type.startsWith('image/') ? (
                <div className="border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden bg-slate-50 dark:bg-slate-950 flex items-center justify-center max-h-80">
                  <img
                    src={previewDoc.local_data_url}
                    alt={previewDoc.title}
                    referrerPolicy="no-referrer"
                    className="max-h-80 object-contain"
                  />
                </div>
              ) : (
                <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-lg p-4 text-xs space-y-2.5">
                  <div className="flex justify-between py-1 border-b border-slate-200 dark:border-slate-700">
                    <span className="text-slate-500">Bucket Storage</span>
                    <span className="font-mono font-semibold text-slate-900 dark:text-white">
                      {STORAGE_BUCKET} (Private)
                    </span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-200 dark:border-slate-700">
                    <span className="text-slate-500">Path Terisolasi RLS</span>
                    <span className="font-mono text-slate-800 dark:text-slate-200">
                      {previewDoc.file_path}
                    </span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-200 dark:border-slate-700">
                    <span className="text-slate-500">Pemilik Akun (user_id)</span>
                    <span className="font-mono text-slate-800 dark:text-slate-200">
                      {previewDoc.user_id}
                    </span>
                  </div>
                  <div className="pt-1">
                    <span className="text-slate-500 block mb-1">Catatan Dokumen:</span>
                    <p className="font-medium text-slate-900 dark:text-white">
                      {previewDoc.notes || 'Tidak ada catatan tambahan.'}
                    </p>
                  </div>
                  {previewDoc.content_preview && (
                    <div className="pt-2">
                      <span className="text-slate-500 block mb-1">Isi Ringkasan Dokumen / Manifest:</span>
                      <pre className="p-3 rounded bg-slate-900 text-emerald-400 font-mono text-[11px] whitespace-pre-wrap overflow-x-auto">
                        {previewDoc.content_preview}
                      </pre>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 px-5 py-3.5 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => handleDownload(previewDoc)}
                className="px-3.5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold inline-flex items-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Unduh File</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setPreviewDoc(null);
                  setSignedUrlData(null);
                }}
                className="px-3.5 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
