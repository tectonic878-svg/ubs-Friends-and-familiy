// Native File System Access API for picking physical directory on computer disk

let globalDirectoryHandle: FileSystemDirectoryHandle | null = null;

const IDB_DB_NAME = 'ubs_folder_picker_db';
const IDB_STORE_NAME = 'handles';
const IDB_KEY = 'chosen_directory_handle';

/**
 * Save directory handle to IndexedDB
 */
async function saveHandleToIndexedDb(handle: FileSystemDirectoryHandle): Promise<void> {
  return new Promise((resolve) => {
    try {
      const request = indexedDB.open(IDB_DB_NAME, 1);
      request.onupgradeneeded = (e: any) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(IDB_STORE_NAME)) {
          db.createObjectStore(IDB_STORE_NAME);
        }
      };
      request.onsuccess = (e: any) => {
        const db = e.target.result;
        const tx = db.transaction(IDB_STORE_NAME, 'readwrite');
        const store = tx.objectStore(IDB_STORE_NAME);
        store.put(handle, IDB_KEY);
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      };
      request.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

/**
 * Load directory handle from IndexedDB
 */
export async function getSavedDirectoryHandle(): Promise<FileSystemDirectoryHandle | null> {
  if (globalDirectoryHandle) return globalDirectoryHandle;
  return new Promise((resolve) => {
    try {
      const request = indexedDB.open(IDB_DB_NAME, 1);
      request.onupgradeneeded = (e: any) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(IDB_STORE_NAME)) {
          db.createObjectStore(IDB_STORE_NAME);
        }
      };
      request.onsuccess = (e: any) => {
        const db = e.target.result;
        const tx = db.transaction(IDB_STORE_NAME, 'readonly');
        const store = tx.objectStore(IDB_STORE_NAME);
        const getReq = store.get(IDB_KEY);
        getReq.onsuccess = () => {
          if (getReq.result) {
            globalDirectoryHandle = getReq.result;
            resolve(getReq.result);
          } else {
            resolve(null);
          }
        };
        getReq.onerror = () => resolve(null);
      };
      request.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

/**
 * Physically opens the computer's native folder picker (Windows File Explorer / macOS Finder)
 */
export async function pickPhysicalDirectory(): Promise<{
  success: boolean;
  folderName?: string;
  handle?: FileSystemDirectoryHandle;
  error?: string;
}> {
  if (!('showDirectoryPicker' in window)) {
    return {
      success: false,
      error: 'Brauzeringiz File System Access API ni to‘liq qo‘llab-quvvatlamaydi. Chrome yoki Edge brauzeridan foydalaning.'
    };
  }

  try {
    const handle: FileSystemDirectoryHandle = await (window as any).showDirectoryPicker({
      mode: 'readwrite',
      startIn: 'documents'
    });

    globalDirectoryHandle = handle;
    await saveHandleToIndexedDb(handle);

    return {
      success: true,
      folderName: handle.name,
      handle
    };
  } catch (err: any) {
    if (err.name === 'AbortError') {
      return { success: false, error: 'Papka tanlash bekor qilindi' };
    }
    return { success: false, error: err.message || 'Papkani tanlashda xatolik yuz berdi' };
  }
}

/**
 * Write a PDF blob or buffer directly into a file in the picked computer directory
 */
export async function saveFileToDirectory(
  dirHandle: FileSystemDirectoryHandle,
  filename: string,
  data: Blob | ArrayBuffer | Uint8Array
): Promise<boolean> {
  try {
    const fileHandle = await (dirHandle as any).getFileHandle(filename, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(data);
    await writable.close();
    return true;
  } catch (err) {
    console.error(`Error writing file ${filename} to directory:`, err);
    return false;
  }
}

/**
 * Fetch document blob from server or memory
 */
async function fetchDocumentBlob(docUrl: string, docDataUrl?: string): Promise<Blob | null> {
  if (docDataUrl && docDataUrl.startsWith('data:')) {
    const res = await fetch(docDataUrl);
    return await res.blob();
  }
  if (docUrl) {
    try {
      const res = await fetch(docUrl);
      if (res.ok) {
        return await res.blob();
      }
    } catch {}
  }
  return null;
}

/**
 * Save all documents of an application to the physically chosen directory on the computer
 */
export async function saveApplicationToPhysicalDirectory(
  dirHandle: FileSystemDirectoryHandle,
  app: any
): Promise<{ savedCount: number; files: string[] }> {
  let savedCount = 0;
  const savedFiles: string[] = [];

  const writeDoc = async (docObj: any, desiredName: string) => {
    if (!docObj) return;
    try {
      const blob = await fetchDocumentBlob(docObj.url, docObj.dataUrl);
      if (blob && blob.size > 0) {
        const finalName = desiredName.toLowerCase().endsWith('.pdf') ? desiredName : `${desiredName}.pdf`;
        const ok = await saveFileToDirectory(dirHandle, finalName, blob);
        if (ok) {
          savedCount++;
          savedFiles.push(finalName);
        }
      }
    } catch (e) {
      console.warn(`Error writing doc ${desiredName}:`, e);
    }
  };

  if (app.type === 'friends') {
    if (app.applicantStudent) {
      const jsh = app.applicantStudent.jshshr ? app.applicantStudent.jshshr.replace(/[^0-9]/g, '') : 'talaba_pasport';
      const phone = (app.applicantStudent.phone1 || app.applicantStudent.phone || '').replace(/[^0-9]/g, '') || `${jsh}_diplom`;
      await writeDoc(app.applicantStudent.passportDoc, `${jsh}.pdf`);
      await writeDoc(app.applicantStudent.certificateDoc, `${phone}.pdf`);
    }
    if (app.friendStudent) {
      const jsh = app.friendStudent.jshshr ? app.friendStudent.jshshr.replace(/[^0-9]/g, '') : 'sherik_pasport';
      const phone = (app.friendStudent.phone1 || app.friendStudent.phone || '').replace(/[^0-9]/g, '') || `${jsh}_diplom`;
      await writeDoc(app.friendStudent.passportDoc, `${jsh}.pdf`);
      await writeDoc(app.friendStudent.certificateDoc, `${phone}.pdf`);
    }
    if (Array.isArray(app.friendsList)) {
      for (const fr of app.friendsList) {
        if (fr) {
          const jsh = fr.jshshr ? fr.jshshr.replace(/[^0-9]/g, '') : 'sherik_pasport';
          const phone = (fr.phone1 || fr.phone || '').replace(/[^0-9]/g, '') || `${jsh}_diplom`;
          await writeDoc(fr.passportDoc, `${jsh}.pdf`);
          await writeDoc(fr.certificateDoc, `${phone}.pdf`);
        }
      }
    }
  } else if (app.type === 'family') {
    if (Array.isArray(app.members)) {
      for (const m of app.members) {
        if (m) {
          const jsh = m.jshshr ? m.jshshr.replace(/[^0-9]/g, '') : 'oila_azosi_pasport';
          const phone = (m.phone1 || m.phone || '').replace(/[^0-9]/g, '') || `${jsh}_hujjat`;
          await writeDoc(m.passportDoc, `${jsh}.pdf`);
          await writeDoc(m.birthOrMarriageDoc, `${phone}.pdf`);
        }
      }
    }
  }

  return { savedCount, files: savedFiles };
}

/**
 * Save all applications' documents into the picked directory
 */
export async function saveAllApplicationsToPhysicalDirectory(
  dirHandle: FileSystemDirectoryHandle,
  apps: any[],
  onProgress?: (current: number, total: number, fileName: string) => void
): Promise<{ totalSaved: number; files: string[] }> {
  let totalSaved = 0;
  const allFiles: string[] = [];

  for (let i = 0; i < apps.length; i++) {
    const app = apps[i];
    if (onProgress) {
      onProgress(i + 1, apps.length, app.id);
    }
    const res = await saveApplicationToPhysicalDirectory(dirHandle, app);
    totalSaved += res.savedCount;
    allFiles.push(...res.files);
  }

  return { totalSaved, files: allFiles };
}
