/**
 * Service for interacting directly with the user's Physical Computer Storage (File System Access API)
 * Allows the Admin to pick a real physical folder (e.g. on C:\ drive or Documents) using the OS File Explorer dialog,
 * and directly writes authentic PDF documents to that chosen physical disk folder.
 */

const DB_NAME = 'ubs_physical_storage_db';
const STORE_NAME = 'handles';
const KEY_NAME = 'selected_folder_handle';

let cachedDirHandle: FileSystemDirectoryHandle | null = null;

// Open IndexedDB to persist FileSystemDirectoryHandle
function openHandleDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Persist directory handle in IndexedDB
 */
export async function persistDirectoryHandle(handle: FileSystemDirectoryHandle): Promise<void> {
  cachedDirHandle = handle;
  try {
    const db = await openHandleDb();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(handle, KEY_NAME);
    await new Promise((resolve, reject) => {
      tx.oncomplete = resolve;
      tx.onerror = reject;
    });
    localStorage.setItem('ubs_physical_folder_name', handle.name);
  } catch (err) {
    console.warn('Directory handle saqlashda xatolik:', err);
  }
}

/**
 * Retrieve saved directory handle from IndexedDB
 */
export async function getPersistedDirectoryHandle(): Promise<FileSystemDirectoryHandle | null> {
  if (cachedDirHandle) return cachedDirHandle;
  try {
    const db = await openHandleDb();
    const tx = db.transaction(STORE_NAME, 'readonly');
    const request = tx.objectStore(STORE_NAME).get(KEY_NAME);
    return new Promise((resolve) => {
      request.onsuccess = () => {
        const handle = request.result as FileSystemDirectoryHandle | undefined;
        if (handle) {
          cachedDirHandle = handle;
          resolve(handle);
        } else {
          resolve(null);
        }
      };
      request.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

/**
 * Clear saved directory handle
 */
export async function clearPersistedDirectoryHandle(): Promise<void> {
  cachedDirHandle = null;
  localStorage.removeItem('ubs_physical_folder_name');
  try {
    const db = await openHandleDb();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(KEY_NAME);
  } catch {
    //
  }
}

/**
 * Check if the application is running inside a cross-origin iframe
 */
export function isInsideIframe(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
}

/**
 * Opens native OS File Explorer folder picker dialog on the user's computer
 * Allows selecting any physical drive / folder (e.g. C:\Users\Admin\Documents or any C:\ drive folder)
 */
export async function openPhysicalDirectoryPicker(): Promise<{
  success: boolean;
  folderName?: string;
  handle?: FileSystemDirectoryHandle;
  isIframe?: boolean;
  error?: string;
}> {
  if (typeof window === 'undefined' || !('showDirectoryPicker' in window)) {
    return {
      success: false,
      error: 'Brauzeringiz File System Access API ni qo‘llab-quvvatlamaydi (Google Chrome yoki Microsoft Edge brauzeridan foydalaning).'
    };
  }

  // If in iframe, showDirectoryPicker is restricted by browser security policy
  if (isInsideIframe()) {
    return {
      success: false,
      isIframe: true,
      error: 'Dastur ichki ko‘rish oynasida (iframe) ishlamoqda. Brauzer xavfsizlik qoidalariga ko‘ra, kompyuter xotirasiga darcha ochish uchun ilovani alohida to‘liq oynada oching yoki 1-bosishda C: diskka yuklovchi skriptdan foydalaning.'
    };
  }

  try {
    // Trigger native Windows Explorer / OS folder picker window
    const handle: FileSystemDirectoryHandle = await (window as any).showDirectoryPicker({
      id: 'ubs_physical_documents_folder',
      mode: 'readwrite',
      startIn: 'documents'
    });

    // Request readwrite permissions
    const anyHandle = handle as any;
    if (typeof anyHandle.requestPermission === 'function') {
      const status = await anyHandle.requestPermission({ mode: 'readwrite' });
      if (status !== 'granted') {
        return {
          success: false,
          error: 'Papka uchun yozish ruxsati berilmadi.'
        };
      }
    }

    await persistDirectoryHandle(handle);

    return {
      success: true,
      folderName: handle.name,
      handle: handle
    };
  } catch (err: any) {
    if (err.name === 'AbortError') {
      return {
        success: false,
        error: 'Papka tanlash bekor qilindi.'
      };
    }
    const errMsg = err?.message || String(err);
    const isFrameError = errMsg.includes('sub frames') || errMsg.includes('Cross origin') || errMsg.includes('SecurityError');
    if (isFrameError) {
      return {
        success: false,
        isIframe: true,
        error: 'Brauzer xavfsizligi: Darcha ochish uchun ilovani to‘liq oynada oching.'
      };
    }
    console.error('Papka tanlashda xatolik:', err);
    return {
      success: false,
      error: errMsg || 'Kompyuterdan papkani tanlashda xatolik yuz berdi.'
    };
  }
}

/**
 * Writes a file directly to the user's selected physical computer disk directory
 */
export async function writeFileToPhysicalDisk(
  filename: string,
  data: Blob | ArrayBuffer | Uint8Array | string
): Promise<boolean> {
  try {
    const handle = await getPersistedDirectoryHandle();
    if (!handle) return false;

    // Verify permission
    const anyHandle = handle as any;
    if (typeof anyHandle.queryPermission === 'function') {
      const perm = await anyHandle.queryPermission({ mode: 'readwrite' });
      if (perm !== 'granted' && typeof anyHandle.requestPermission === 'function') {
        const req = await anyHandle.requestPermission({ mode: 'readwrite' });
        if (req !== 'granted') return false;
      }
    }

    // Create / get file in the physical directory
    const fileHandle = await handle.getFileHandle(filename, { create: true });
    const writable = await fileHandle.createWritable();

    let contentToWrite: any = data;
    if (typeof data === 'string' && data.startsWith('data:')) {
      // Convert base64 data url to Blob
      const res = await fetch(data);
      contentToWrite = await res.blob();
    } else if (typeof data === 'string') {
      contentToWrite = new Blob([data], { type: 'application/pdf' });
    }

    await writable.write(contentToWrite);
    await writable.close();
    return true;
  } catch (err) {
    console.error(`Faylni jismoniy diskka yozishda xatolik (${filename}):`, err);
    return false;
  }
}

/**
 * Check if a physical directory is configured and active
 */
export function getSavedPhysicalFolderName(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('ubs_physical_folder_name');
}
