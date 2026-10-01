import { doc, setDoc, getDoc, collection, getDocs } from 'firebase/firestore';
import { db } from './firebase';
import { saveDocToIndexedDb, getDocFromIndexedDb } from '../utils/indexedDbStorage';
import { dataUrlToBlob } from '../utils/formatters';

const CHUNK_SIZE = 600000; // 600KB chunks safely under Firestore 1MB doc limit

/**
 * Stores the EXACT, UNMODIFIED original binary PDF file into Google Cloud Firestore.
 * Automatically handles chunking for large files up to several megabytes.
 */
export async function saveOriginalFileToCloud(
  fileId: string,
  dataUrl: string,
  name: string,
  size: string
): Promise<string> {
  const safeId = fileId.replace(/[^a-zA-Z0-9_-]/g, '_');

  // 1. Save in client IndexedDB immediately
  try {
    await saveDocToIndexedDb(safeId, dataUrl, name, 'application/pdf');
  } catch (err) {
    console.warn('IndexedDB save warning:', err);
  }

  // 2. Save on Server disk via API
  try {
    await fetch('/api/documents/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: safeId,
        name,
        type: 'pdf',
        dataUrl,
        size
      })
    });
  } catch (err) {
    console.warn('Server disk save warning:', err);
  }

  // 3. Save to Google Cloud Firestore persistently
  try {
    const totalLen = dataUrl.length;
    const numChunks = Math.ceil(totalLen / CHUNK_SIZE);

    if (numChunks <= 1) {
      // Single chunk fits in one Firestore document
      await setDoc(doc(db, 'stored_files', safeId), {
        id: safeId,
        name,
        size,
        mime: 'application/pdf',
        numChunks: 1,
        data: dataUrl,
        uploadedAt: new Date().toISOString()
      });
    } else {
      // Multi-chunk document
      await setDoc(doc(db, 'stored_files', safeId), {
        id: safeId,
        name,
        size,
        mime: 'application/pdf',
        numChunks,
        uploadedAt: new Date().toISOString()
      });

      for (let i = 0; i < numChunks; i++) {
        const chunkData = dataUrl.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
        await setDoc(doc(db, 'stored_files', safeId, 'chunks', String(i)), {
          index: i,
          data: chunkData
        });
      }
    }
  } catch (err) {
    console.error('Firestore original file save error:', err);
  }

  return `/api/documents/${safeId}`;
}

/**
 * Retrieves the EXACT, UNMODIFIED original binary PDF file.
 * Checks IndexedDB -> Server Disk -> Google Cloud Firestore.
 * Never alters or modifies the applicant's original file.
 */
export async function getOriginalFileBlob(fileId: string): Promise<{ blob: Blob; url: string; name: string } | null> {
  const safeId = fileId.replace(/[^a-zA-Z0-9_-]/g, '_');

  // 1. Try local IndexedDB
  try {
    const cached = await getDocFromIndexedDb(safeId);
    if (cached?.blob && cached.blob.size > 0) {
      const url = URL.createObjectURL(cached.blob);
      return { blob: cached.blob, url, name: cached.name || `${safeId}.pdf` };
    }
  } catch {
    // continue
  }

  // 2. Try Server Disk Endpoint
  try {
    const resp = await fetch(`/api/documents/${safeId}`);
    if (resp.ok) {
      const blob = await resp.blob();
      if (blob && blob.size > 0) {
        const url = URL.createObjectURL(blob);
        // Cache to IndexedDB for instant access
        saveDocToIndexedDb(safeId, blob, `${safeId}.pdf`, 'application/pdf').catch(() => {});
        return { blob, url, name: `${safeId}.pdf` };
      }
    }
  } catch {
    // continue
  }

  // 3. Retrieve from Google Cloud Firestore
  try {
    const metaSnap = await getDoc(doc(db, 'stored_files', safeId));
    if (metaSnap.exists()) {
      const meta = metaSnap.data();
      const numChunks = meta.numChunks || 1;
      let fullDataUrl = '';

      if (numChunks === 1 && meta.data) {
        fullDataUrl = meta.data;
      } else {
        // Fetch all chunks
        const chunksCol = collection(db, 'stored_files', safeId, 'chunks');
        const chunksSnap = await getDocs(chunksCol);
        const chunkMap = new Map<number, string>();
        chunksSnap.forEach((cDoc) => {
          const cData = cDoc.data();
          chunkMap.set(cData.index, cData.data);
        });

        const sortedParts: string[] = [];
        for (let i = 0; i < numChunks; i++) {
          sortedParts.push(chunkMap.get(i) || '');
        }
        fullDataUrl = sortedParts.join('');
      }

      if (fullDataUrl && fullDataUrl.startsWith('data:')) {
        const blob = dataUrlToBlob(fullDataUrl, 'application/pdf');
        const url = URL.createObjectURL(blob);
        // Cache in IndexedDB and upload to local server
        saveDocToIndexedDb(safeId, blob, meta.name || `${safeId}.pdf`, 'application/pdf').catch(() => {});
        fetch('/api/documents/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: safeId,
            name: meta.name || `${safeId}.pdf`,
            type: 'pdf',
            dataUrl: fullDataUrl,
            size: meta.size || ''
          })
        }).catch(() => {});

        return { blob, url, name: meta.name || `${safeId}.pdf` };
      }
    }
  } catch (err) {
    console.error('Error fetching file from Firestore:', err);
  }

  return null;
}
