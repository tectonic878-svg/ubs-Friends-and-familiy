import { DocumentFile, AnyApplication } from '../types';

/**
 * Permanent IndexedDB Vault for UBS Portal Documents & Applications
 * Guarantees zero data loss across browser sessions, reloads, and container restarts.
 * Real authentic student PDF documents are NEVER overwritten with sample templates.
 */

const DB_NAME = 'UBS_PERMANENT_PDF_VAULT_V2';
const DB_VERSION = 1;
const DOCS_STORE = 'documents';
const APPS_STORE = 'applications';

function openVaultDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      return reject(new Error('IndexedDB is not available in this environment'));
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      
      // Documents store (original PDF binary dataUrls)
      if (!db.objectStoreNames.contains(DOCS_STORE)) {
        const docStore = db.createObjectStore(DOCS_STORE, { keyPath: 'id' });
        docStore.createIndex('aliases', 'aliases', { multiEntry: true });
        docStore.createIndex('name', 'name', { unique: false });
        docStore.createIndex('updatedAt', 'updatedAt', { unique: false });
      }

      // Applications store (full application objects with documents)
      if (!db.objectStoreNames.contains(APPS_STORE)) {
        const appStore = db.createObjectStore(APPS_STORE, { keyPath: 'id' });
        appStore.createIndex('status', 'status', { unique: false });
        appStore.createIndex('type', 'type', { unique: false });
        appStore.createIndex('createdAt', 'createdAt', { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export interface VaultDocRecord {
  id: string;
  name: string;
  dataUrl: string;
  size?: string;
  type?: string;
  aliases: string[];
  updatedAt: string;
}

/**
 * Saves an authentic student document to persistent IndexedDB
 */
export async function saveDocToVault(doc: DocumentFile | undefined, aliases: string[] = []): Promise<boolean> {
  if (!doc || !doc.id) return false;

  const rawData = (doc.dataUrl && doc.dataUrl.startsWith('data:'))
    ? doc.dataUrl
    : (doc.url && doc.url.startsWith('data:'))
      ? doc.url
      : null;

  if (!rawData) return false;

  // Never save dummy sample documents as authentic documents
  if (rawData.includes('HUJJAT MA\'LUMOTLARI VA IDENTIFIKATSIYASI') || rawData.includes('UBS TASDIQLANDI')) {
    console.warn('[Vault] Namuna hujjat saqlash bloklandi:', doc.id);
    return false;
  }

  try {
    const db = await openVaultDb();
    return new Promise((resolve) => {
      const tx = db.transaction(DOCS_STORE, 'readwrite');
      const store = tx.objectStore(DOCS_STORE);

      const cleanId = doc.id.replace(/\.pdf$/i, '').replace(/[^a-zA-Z0-9_-]/g, '_');
      const cleanAliases = Array.from(new Set([
        cleanId,
        ...(aliases || []),
        doc.name?.replace(/\.pdf$/i, '') || ''
      ].map(a => a.trim()).filter(Boolean)));

      const record: VaultDocRecord = {
        id: cleanId,
        name: doc.name || `${cleanId}.pdf`,
        dataUrl: rawData,
        size: doc.size || `${(rawData.length * 0.75 / (1024 * 1024)).toFixed(2)} MB`,
        type: doc.type || 'pdf',
        aliases: cleanAliases,
        updatedAt: new Date().toISOString()
      };

      store.put(record);

      tx.oncomplete = () => {
        db.close();
        resolve(true);
      };
      tx.onerror = () => {
        db.close();
        resolve(false);
      };
    });
  } catch (err) {
    console.warn('[Vault] Saqlash xatosi:', err);
    return false;
  }
}

/**
 * Retrieves an authentic student document by ID or alias (JSHSHR, phone number)
 */
export async function getDocFromVault(idOrAlias: string): Promise<DocumentFile | null> {
  if (!idOrAlias) return null;
  const cleanLookup = idOrAlias.replace(/\.pdf$/i, '').replace(/[^a-zA-Z0-9_-]/g, '_');
  const digitsOnly = idOrAlias.replace(/[^0-9]/g, '');

  try {
    const db = await openVaultDb();
    return new Promise((resolve) => {
      const tx = db.transaction(DOCS_STORE, 'readonly');
      const store = tx.objectStore(DOCS_STORE);

      // 1. Direct key match
      const req = store.get(cleanLookup);
      req.onsuccess = () => {
        const item = req.result as VaultDocRecord | undefined;
        if (item && item.dataUrl) {
          db.close();
          return resolve({
            id: item.id,
            name: item.name,
            type: 'pdf',
            url: item.dataUrl,
            dataUrl: item.dataUrl,
            size: item.size,
            uploadedAt: item.updatedAt
          });
        }

        // 2. Lookup by alias index
        try {
          const aliasIndex = store.index('aliases');
          const aliasReq = aliasIndex.get(cleanLookup);
          aliasReq.onsuccess = () => {
            const aliasItem = aliasReq.result as VaultDocRecord | undefined;
            if (aliasItem && aliasItem.dataUrl) {
              db.close();
              return resolve({
                id: aliasItem.id,
                name: aliasItem.name,
                type: 'pdf',
                url: aliasItem.dataUrl,
                dataUrl: aliasItem.dataUrl,
                size: aliasItem.size,
                uploadedAt: aliasItem.updatedAt
              });
            }

            // 3. Digits match (e.g. 998901234567 or JSHSHR)
            if (digitsOnly.length >= 7) {
              const digitsReq = aliasIndex.get(digitsOnly);
              digitsReq.onsuccess = () => {
                db.close();
                const dItem = digitsReq.result as VaultDocRecord | undefined;
                if (dItem && dItem.dataUrl) {
                  return resolve({
                    id: dItem.id,
                    name: dItem.name,
                    type: 'pdf',
                    url: dItem.dataUrl,
                    dataUrl: dItem.dataUrl,
                    size: dItem.size,
                    uploadedAt: dItem.updatedAt
                  });
                }
                resolve(null);
              };
              digitsReq.onerror = () => {
                db.close();
                resolve(null);
              };
            } else {
              db.close();
              resolve(null);
            }
          };
          aliasReq.onerror = () => {
            db.close();
            resolve(null);
          };
        } catch {
          db.close();
          resolve(null);
        }
      };

      req.onerror = () => {
        db.close();
        resolve(null);
      };
    });
  } catch (err) {
    console.warn('[Vault] Qidirish xatosi:', err);
    return null;
  }
}

/**
 * Saves all attached documents in an application into the permanent vault
 */
export async function persistApplicationDocsToVault(app: AnyApplication): Promise<void> {
  if (!app) return;

  if (app.type === 'friends') {
    if (app.applicantStudent) {
      const jsh = app.applicantStudent.jshshr;
      const ph = (app.applicantStudent.phone1 || app.applicantStudent.phone || '').replace(/[^0-9]/g, '');
      if (app.applicantStudent.passportDoc) {
        await saveDocToVault(app.applicantStudent.passportDoc, [jsh]);
      }
      if (app.applicantStudent.certificateDoc) {
        await saveDocToVault(app.applicantStudent.certificateDoc, [ph, jsh]);
      }
    }
    if (app.friendStudent) {
      const jsh = app.friendStudent.jshshr;
      const ph = (app.friendStudent.phone1 || app.friendStudent.phone || '').replace(/[^0-9]/g, '');
      if (app.friendStudent.passportDoc) {
        await saveDocToVault(app.friendStudent.passportDoc, [jsh]);
      }
      if (app.friendStudent.certificateDoc) {
        await saveDocToVault(app.friendStudent.certificateDoc, [ph, jsh]);
      }
    }
    if (Array.isArray(app.friendsList)) {
      for (const fr of app.friendsList) {
        const jsh = fr.jshshr;
        const ph = (fr.phone1 || fr.phone || '').replace(/[^0-9]/g, '');
        if (fr.passportDoc) await saveDocToVault(fr.passportDoc, [jsh]);
        if (fr.certificateDoc) await saveDocToVault(fr.certificateDoc, [ph, jsh]);
      }
    }
  } else if (app.type === 'family' && Array.isArray(app.members)) {
    for (const m of app.members) {
      const jsh = m.jshshr;
      const ph = (m.phone1 || m.phone || '').replace(/[^0-9]/g, '');
      if (m.passportDoc) await saveDocToVault(m.passportDoc, [jsh]);
      if (m.birthOrMarriageDoc) await saveDocToVault(m.birthOrMarriageDoc, [ph, jsh]);
    }
  }
}

/**
 * Saves an entire application into the persistent IndexedDB store
 */
export async function saveApplicationToVault(app: AnyApplication): Promise<boolean> {
  if (!app || !app.id) return false;

  await persistApplicationDocsToVault(app);

  try {
    const db = await openVaultDb();
    return new Promise((resolve) => {
      const tx = db.transaction(APPS_STORE, 'readwrite');
      const store = tx.objectStore(APPS_STORE);
      store.put(app);
      tx.oncomplete = () => {
        db.close();
        resolve(true);
      };
      tx.onerror = () => {
        db.close();
        resolve(false);
      };
    });
  } catch (err) {
    console.warn('[Vault] Ariza saqlash xatosi:', err);
    return false;
  }
}

/**
 * Retrieves all applications from the persistent IndexedDB store
 */
export async function getAllApplicationsFromVault(): Promise<AnyApplication[]> {
  try {
    const db = await openVaultDb();
    return new Promise((resolve) => {
      const tx = db.transaction(APPS_STORE, 'readonly');
      const store = tx.objectStore(APPS_STORE);
      const req = store.getAll();
      req.onsuccess = () => {
        db.close();
        resolve(req.result || []);
      };
      req.onerror = () => {
        db.close();
        resolve([]);
      };
    });
  } catch {
    return [];
  }
}

/**
 * Completely clears all documents and applications from the persistent IndexedDB store
 */
export async function clearAllVaultData(): Promise<boolean> {
  try {
    const db = await openVaultDb();
    return new Promise((resolve) => {
      const tx = db.transaction([DOCS_STORE, APPS_STORE], 'readwrite');
      tx.objectStore(DOCS_STORE).clear();
      tx.objectStore(APPS_STORE).clear();
      tx.oncomplete = () => {
        db.close();
        resolve(true);
      };
      tx.onerror = () => {
        db.close();
        resolve(false);
      };
    });
  } catch (err) {
    console.warn('[Vault] Tozalash xatosi:', err);
    return false;
  }
}
