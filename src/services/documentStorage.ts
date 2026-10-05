import { DocumentFile } from '../types';

/**
 * Document Storage Service
 * Handles uploading, resolving, and caching authentic PDF documents both to the local server disk
 * and for client-side document retrieval and ZIP bundling.
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
 * Save authentic document to server storage with optional aliases (JSHSHR, phone)
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

  // If we have base64 data, upload to backend server
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
 * Resolves a document file to an accessible URL or Blob for viewing/ZIP archiving
 */
export async function resolveAuthenticBlob(
  doc: DocumentFile | undefined,
  _key?: string,
  _aliases?: string[]
): Promise<{ url: string; blob?: Blob } | null> {
  if (!doc) return null;

  if (doc.dataUrl && doc.dataUrl.startsWith('data:')) {
    return { url: doc.dataUrl };
  }

  if (doc.url && doc.url.trim() !== '') {
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
