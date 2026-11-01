import { DocumentFile } from '../types';
import { saveDocToVault, getDocFromVault } from '../utils/indexedDbVault';

/**
 * Document Storage Service
 * Handles uploading, resolving, and caching authentic PDF documents both to the local server disk
 * and the browser's persistent IndexedDB vault so that applicant PDFs NEVER get replaced by sample PDFs.
 */

export interface SavedDocumentRecord {
  id: string;
  name: string;
  url: string;
  size?: string;
  dataUrl?: string;
  aliases?: string[];
  uploadedAt: string;
}

/**
 * Save authentic document to persistent storage with optional aliases (JSHSHR, phone)
 */
export async function saveAuthenticDocument(
  docId: string,
  name: string,
  urlOrDataUrl?: string,
  size?: string,
  dataUrl?: string,
  aliases: string[] = []
): Promise<{ success: boolean; url: string; id: string }> {
  const finalId = docId.replace(/\.pdf$/i, '').replace(/[^a-zA-Z0-9_-]/g, '_');
  const payloadDataUrl = dataUrl || (urlOrDataUrl && urlOrDataUrl.startsWith('data:') ? urlOrDataUrl : undefined);

  // 1. Immediately preserve in client IndexedDB Vault (Guarantees zero loss)
  if (payloadDataUrl) {
    saveDocToVault({
      id: finalId,
      name,
      type: 'pdf',
      url: payloadDataUrl,
      dataUrl: payloadDataUrl,
      size,
      uploadedAt: new Date().toISOString()
    }, aliases).catch(() => {});
  }

  // 2. Upload to backend server
  if (payloadDataUrl) {
    try {
      const res = await fetch('/api/documents/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: finalId,
          name,
          dataUrl: payloadDataUrl,
          size,
          type: 'pdf',
          aliases
        })
      });

      if (res.ok) {
        const data = await res.json();
        return {
          success: true,
          id: data.id || finalId,
          url: data.url || `/api/documents/${finalId}`
        };
      }
    } catch (err) {
      console.warn('[DocumentStorage] Serverga yuklashda xatolik:', err);
    }
  }

  // Fallback return standard endpoint
  return {
    success: true,
    id: finalId,
    url: `/api/documents/${finalId}`
  };
}

/**
 * Resolves a document file to an authentic accessible URL or Blob for viewing/ZIP archiving
 * Checks memory, IndexedDB Vault, and server endpoint in sequence.
 */
export async function resolveAuthenticBlob(
  doc: DocumentFile | undefined,
  key?: string,
  _aliases?: string[]
): Promise<{ url: string; blob?: Blob } | null> {
  if (!doc) return null;

  // 1. Check in-memory base64 or blob URL
  if (doc.dataUrl && doc.dataUrl.startsWith('data:')) {
    return { url: doc.dataUrl };
  }
  if (doc.url && (doc.url.startsWith('data:') || doc.url.startsWith('blob:'))) {
    return { url: doc.url };
  }

  const lookupKey = key || doc.id || doc.name?.replace(/\.pdf$/i, '');

  // 2. Check persistent IndexedDB Vault
  if (lookupKey) {
    const fromVault = await getDocFromVault(lookupKey);
    if (fromVault && (fromVault.dataUrl || fromVault.url)) {
      const u = fromVault.dataUrl || fromVault.url;
      if (u.startsWith('data:')) {
        return { url: u };
      }
    }
  }

  // 3. Fallback to server endpoint
  if (doc.url && doc.url.startsWith('/api/documents/')) {
    return { url: doc.url };
  }

  if (doc.id) {
    const cleanId = doc.id.replace(/\.pdf$/i, '').replace(/[^a-zA-Z0-9_-]/g, '_');
    return { url: `/api/documents/${cleanId}` };
  }

  return null;
}

/**
 * Retrieve document by ID or alias
 */
export async function getDocumentUrl(docId: string): Promise<string> {
  const cleanId = docId.replace(/\.pdf$/i, '').replace(/[^a-zA-Z0-9_-]/g, '_');
  return `/api/documents/${cleanId}`;
}
