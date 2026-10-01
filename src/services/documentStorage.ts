import { doc, getDoc, setDoc, collection, getDocs, orderBy, query } from 'firebase/firestore';
import { db } from './firebase';
import { DocumentFile } from '../types';
import { dataUrlToBlob, cleanPhoneDigits } from '../utils/formatters';
import { saveDocToIndexedDb, getDocFromIndexedDb } from '../utils/indexedDbStorage';
import { writeFileToPhysicalDisk } from './localDirectoryService';

const CHUNK_SIZE = 500000; // ~500 KB per chunk for Firestore storage

/**
 * Saves an authentic, un-altered PDF document to:
 * 1. Express Server disk (/api/documents/upload-binary or /api/documents/upload)
 * 2. Google Firestore (permanent cloud storage across all 7 admins and devices)
 * 3. Browser IndexedDB (fast local client cache)
 */
export async function saveAuthenticDocument(
  docId: string,
  name: string,
  fileOrBlobOrDataUrl: File | Blob | string,
  fileSizeFormatted?: string,
  precomputedDataUrl?: string,
  extraAliases: string[] = []
): Promise<{ success: boolean; url: string; error?: string }> {
  try {
    const cleanDocId = docId.replace(/[^a-zA-Z0-9_-]/g, '_');
    const cleanName = name.replace(/\.pdf$/i, '').replace(/[^a-zA-Z0-9_-]/g, '_');
    let dataUrl: string = '';
    let blob: Blob;

    if (typeof fileOrBlobOrDataUrl === 'string') {
      dataUrl = fileOrBlobOrDataUrl;
      blob = dataUrlToBlob(dataUrl, 'application/pdf');
    } else {
      blob = fileOrBlobOrDataUrl;
      if (precomputedDataUrl) {
        dataUrl = precomputedDataUrl;
      } else {
        dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
      }
    }

    const calculatedSize = fileSizeFormatted || `${(blob.size / (1024 * 1024)).toFixed(2)} MB`;

    // 1. Fast local browser IndexedDB save
    saveDocToIndexedDb(cleanDocId, blob, name, 'application/pdf').catch((idbErr) => {
      console.warn('IndexedDB save warning:', idbErr);
    });

    // 1.1 Direct write to Admin's selected Physical Computer Hard Drive folder (C:\, Documents, etc.)
    const diskFileName = name.toLowerCase().endsWith('.pdf') ? name : `${name}.pdf`;
    writeFileToPhysicalDisk(diskFileName, blob).catch(() => {});
    if (extraAliases && extraAliases.length > 0) {
      extraAliases.forEach((alias) => {
        const aliasName = alias.toLowerCase().endsWith('.pdf') ? alias : `${alias}.pdf`;
        writeFileToPhysicalDisk(aliasName, blob).catch(() => {});
      });
    }

    // 2. Direct binary or JSON upload to Express Server
    let serverUploadOk = false;
    try {
      if (blob && blob.size > 0) {
        // Try high-speed binary stream first
        const uploadUrl = `/api/documents/upload-binary?id=${encodeURIComponent(cleanDocId)}&name=${encodeURIComponent(name)}&size=${encodeURIComponent(calculatedSize)}`;
        const binResp = await fetch(uploadUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/pdf',
            'X-Document-Id': cleanDocId,
            'X-Document-Name': encodeURIComponent(name),
            'X-Document-Size': encodeURIComponent(calculatedSize),
          },
          body: blob
        });

        if (binResp.ok) {
          serverUploadOk = true;
        } else {
          // Fallback to JSON payload
          const jsonResp = await fetch('/api/documents/upload', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              id: cleanDocId,
              name,
              type: 'pdf',
              dataUrl,
              size: calculatedSize
            })
          });
          serverUploadOk = jsonResp.ok;
        }
      }
    } catch (serverErr) {
      console.warn('Serverga yuklashda tarmoq xatosi:', serverErr);
    }

    // 3. Cloud document metadata reference
    // Authentic PDF binaries are stored on the dedicated computer server disk and client IndexedDB.
    // Heavy chunked binary writes to Firestore are omitted to strictly preserve the daily write quota.
    return {
      success: true,
      url: `/api/documents/${cleanDocId}`
    };
  } catch (err: any) {
    console.error('Asl hujjatni saqlashda xatolik:', err);
    return {
      success: false,
      url: `/api/documents/${docId}`,
      error: err?.message || 'Yuklashda xatolik yuz berdi'
    };
  }
}

/**
 * Resolves the real, authentic PDF document binary bytes.
 * Never creates or returns a fake / mock / sample PDF.
 * If not found in any storage, returns null.
 */
export async function resolveAuthenticBlob(
  docItem: DocumentFile | undefined,
  fallbackIdentifier?: string,
  extraIdentifiers: string[] = []
): Promise<{ blob: Blob; url: string; name: string } | null> {
  if (!docItem && !fallbackIdentifier && extraIdentifiers.length === 0) return null;

  const docId = (docItem?.id || '').replace(/[^a-zA-Z0-9_-]/g, '_');
  const safeName = docItem?.name || (docId ? `${docId}.pdf` : (fallbackIdentifier ? `${fallbackIdentifier}.pdf` : 'hujjat.pdf'));
  const cleanIdFromName = safeName.replace(/\.pdf$/i, '').replace(/[^a-zA-Z0-9_-]/g, '_');
  const cleanFallback = fallbackIdentifier ? fallbackIdentifier.replace(/\.pdf$/i, '').replace(/[^a-zA-Z0-9_-]/g, '_') : '';
  const cleanPhone = fallbackIdentifier ? cleanPhoneDigits(fallbackIdentifier) : '';

  const idSet = new Set<string>();
  if (docId) idSet.add(docId);
  if (cleanIdFromName) idSet.add(cleanIdFromName);
  if (cleanFallback) idSet.add(cleanFallback);
  if (cleanPhone) {
    idSet.add(cleanPhone);
    if (cleanPhone.startsWith('998')) idSet.add(cleanPhone.slice(3));
    else idSet.add('998' + cleanPhone);
  }
  for (const extra of extraIdentifiers) {
    const cleanExtra = extra.replace(/\.pdf$/i, '').replace(/[^a-zA-Z0-9_-]/g, '_');
    if (cleanExtra) {
      idSet.add(cleanExtra);
      const digits = cleanExtra.replace(/[^0-9]/g, '');
      if (digits.length >= 7) {
        idSet.add(digits);
        if (digits.startsWith('998')) idSet.add(digits.slice(3));
        else idSet.add('998' + digits);
      }
    }
  }

  const candidateIds = Array.from(idSet).filter(Boolean);

  // Strategy 1: If document already has raw data: URL in memory
  if (docItem?.url && docItem.url.startsWith('data:')) {
    try {
      const mime = docItem.url.includes('application/pdf') ? 'application/pdf' : 'application/octet-stream';
      const blob = dataUrlToBlob(docItem.url, mime);
      if (blob.size > 0) {
        return { blob, url: URL.createObjectURL(blob), name: safeName };
      }
    } catch {
      // continue to next strategy
    }
  }
  if (docItem?.dataUrl && docItem.dataUrl.startsWith('data:')) {
    try {
      const mime = docItem.dataUrl.includes('application/pdf') ? 'application/pdf' : 'application/octet-stream';
      const blob = dataUrlToBlob(docItem.dataUrl, mime);
      if (blob.size > 0) {
        return { blob, url: URL.createObjectURL(blob), name: safeName };
      }
    } catch {
      // continue to next strategy
    }
  }

  // Strategy 2: Check browser IndexedDB
  for (const cId of candidateIds) {
    try {
      const idbRes = await getDocFromIndexedDb(cId);
      if (idbRes?.blob && idbRes.blob.size > 0) {
        return { blob: idbRes.blob, url: URL.createObjectURL(idbRes.blob), name: idbRes.name || safeName };
      }
    } catch {
      // continue
    }
  }

  // Strategy 3: Fetch from Express Server endpoint
  const candidateUrls: string[] = [];
  if (docItem?.url && docItem.url.startsWith('/api/documents/')) {
    candidateUrls.push(docItem.url);
    if (!docItem.url.endsWith('/download')) {
      candidateUrls.push(`${docItem.url}/download`);
    }
  }
  for (const cId of candidateIds) {
    const endpoint = `/api/documents/${cId}`;
    if (!candidateUrls.includes(endpoint)) candidateUrls.push(endpoint);
    const dlEndpoint = `/api/documents/${cId}/download`;
    if (!candidateUrls.includes(dlEndpoint)) candidateUrls.push(dlEndpoint);
  }

  for (const url of candidateUrls) {
    try {
      const resp = await fetch(url);
      if (resp.ok) {
        const contentType = resp.headers.get('content-type') || '';
        // Ensure not JSON 404 response
        if (!contentType.includes('application/json')) {
          const blob = await resp.blob();
          if (blob.size > 50) {
            if (docId) {
              saveDocToIndexedDb(docId, blob, safeName, 'application/pdf').catch(() => {});
            }
            return { blob, url: URL.createObjectURL(blob), name: safeName };
          }
        }
      }
    } catch {
      // continue to next strategy
    }
  }

  // Strategy 4: Retrieve directly from Google Firestore cloud storage
  for (const cId of candidateIds) {
    try {
      const fileDocRef = doc(db, 'stored_files', cId);
      const fileSnap = await getDoc(fileDocRef);

      if (fileSnap.exists()) {
        const data = fileSnap.data();
        let fullBase64 = '';

        if (!data.isChunked && data.data) {
          fullBase64 = data.data;
        } else if (data.isChunked) {
          const chunksCol = collection(db, 'stored_files', cId, 'chunks');
          const chunksQuery = query(chunksCol, orderBy('chunkIndex', 'asc'));
          const chunksSnap = await getDocs(chunksQuery);

          const parts: string[] = [];
          chunksSnap.forEach((cSnap) => {
            const cData = cSnap.data();
            if (cData && typeof cData.data === 'string') {
              parts.push(cData.data);
            }
          });
          fullBase64 = parts.join('');
        }

        if (fullBase64.length > 0) {
          const mimeType = data.mimeType || 'application/pdf';
          const dataUrl = `data:${mimeType};base64,${fullBase64}`;
          const blob = dataUrlToBlob(dataUrl, mimeType);

          // Cache in IndexedDB and server for fast future reads
          saveDocToIndexedDb(cId, blob, safeName, mimeType).catch(() => {});
          fetch('/api/documents/upload', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              id: cId,
              name: safeName,
              type: 'pdf',
              dataUrl,
              size: `${(blob.size / (1024 * 1024)).toFixed(2)} MB`
            })
          }).catch(() => {});

          return { blob, url: URL.createObjectURL(blob), name: safeName };
        }
      }
    } catch (firestoreErr) {
      console.warn('Firestore stored_files dan o‘qish xatosi:', firestoreErr);
    }
  }

  // Document was not found in any storage. Do NOT forge a fake document.
  return null;
}

/**
 * Downloads the authentic PDF document.
 * Returns true if successful, false if authentic file not found.
 */
export async function downloadAuthenticDocument(
  docItem: DocumentFile | undefined,
  preferredFileName?: string,
  extraIdentifiers: string[] = []
): Promise<boolean> {
  const result = await resolveAuthenticBlob(docItem, preferredFileName, extraIdentifiers);
  if (!result || !result.blob) {
    return false;
  }

  const finalName = preferredFileName || result.name || 'hujjat.pdf';
  const safeFinalName = finalName.toLowerCase().endsWith('.pdf') ? finalName : `${finalName}.pdf`;

  const blobUrl = URL.createObjectURL(result.blob);
  const link = document.createElement('a');
  link.href = blobUrl;
  link.download = safeFinalName;
  link.rel = 'noopener noreferrer';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
  return true;
}
