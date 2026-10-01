import { DocumentFile } from '../types';
import { dataUrlToBlob } from './formatters';
import { resolveAuthenticBlob, downloadAuthenticDocument } from '../services/documentStorage';

const DB_NAME = 'ubs_documents_db';
const DB_VERSION = 1;
const STORE_NAME = 'pdf_documents';

/**
 * Initializes and gets the IndexedDB database instance
 */
function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB not supported'));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Stores a binary Blob / ArrayBuffer or DataURL in IndexedDB
 */
export async function saveDocToIndexedDb(
  id: string,
  blobOrDataUrl: Blob | string,
  name: string,
  mime: string = 'application/pdf'
): Promise<void> {
  try {
    const db = await openDatabase();
    let blob: Blob;

    if (typeof blobOrDataUrl === 'string') {
      blob = dataUrlToBlob(blobOrDataUrl, mime);
    } else {
      blob = blobOrDataUrl;
    }

    const arrayBuffer = await blob.arrayBuffer();

    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const record = {
        id,
        name,
        mime,
        data: arrayBuffer,
        size: blob.size,
        updatedAt: new Date().toISOString()
      };

      const request = store.put(record);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.warn('IndexedDB saqlash xatosi:', err);
  }
}

/**
 * Retrieves a document from IndexedDB as a Blob
 */
export async function getDocFromIndexedDb(id: string): Promise<{ blob: Blob; name: string; mime: string } | null> {
  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const request = store.get(id);

      request.onsuccess = () => {
        const result = request.result;
        if (result && result.data) {
          const blob = new Blob([result.data], { type: result.mime || 'application/pdf' });
          resolve({ blob, name: result.name || `${id}.pdf`, mime: result.mime || 'application/pdf' });
        } else {
          resolve(null);
        }
      };

      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.warn('IndexedDB o‘qish xatosi:', err);
    return null;
  }
}

/**
 * Resolves the authentic document blob without any fake fallbacks
 */
export async function resolveDocumentBlob(
  doc: DocumentFile | undefined,
  _fallbackTitle?: string,
  _fallbackJshshr?: string,
  _fallbackSub?: string
): Promise<{ blob: Blob; url: string; name: string } | null> {
  return await resolveAuthenticBlob(doc);
}

/**
 * Universal authentic document downloader
 */
export async function downloadDocumentUniversal(
  doc: DocumentFile | undefined,
  _fallbackTitle?: string,
  _fallbackJshshr?: string,
  _fallbackSub?: string,
  preferredFileName?: string
): Promise<boolean> {
  return await downloadAuthenticDocument(doc, preferredFileName);
}
