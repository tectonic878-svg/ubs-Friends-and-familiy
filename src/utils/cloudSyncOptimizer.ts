import { AnyApplication, DocumentFile } from '../types';

function sanitizeDocForCloud(doc: DocumentFile | undefined): void {
  if (!doc) return;
  // If url is empty or large dataUrl, transform it to standard server/cloud endpoint reference
  // The actual binary bytes are stored in Google Firestore 'stored_files' and server disk
  if (!doc.url || doc.url.trim() === '' || doc.url.startsWith('data:')) {
    if (doc.id) {
      doc.url = `/api/documents/${doc.id}`;
    } else if (doc.name) {
      doc.url = `/api/documents/${doc.name.replace(/\.pdf$/i, '')}`;
    }
  }
  // CRITICAL: Delete dataUrl from the application document saved in 'applications' collection.
  // Raw base64 data exceeds Firestore's 1MB limit per document.
  // The actual PDF bytes are safely and permanently stored in 'stored_files' collection and on server disk.
  delete doc.dataUrl;
}

/**
 * Prepares application for cloud Firestore storage.
 * Ensures document references and IDs are preserved 100%,
 * so all 7 admins and students can immediately open and download authentic PDF documents.
 */
export function optimizeApplicationForCloud(app: AnyApplication): AnyApplication {
  const clone: AnyApplication = JSON.parse(JSON.stringify(app));

  try {
    if (clone.type === 'friends') {
      sanitizeDocForCloud(clone.applicantStudent?.passportDoc);
      sanitizeDocForCloud(clone.applicantStudent?.certificateDoc);
      sanitizeDocForCloud(clone.friendStudent?.passportDoc);
      sanitizeDocForCloud(clone.friendStudent?.certificateDoc);
      if (Array.isArray(clone.friendsList)) {
        clone.friendsList.forEach((fr) => {
          sanitizeDocForCloud(fr.passportDoc);
          sanitizeDocForCloud(fr.certificateDoc);
        });
      }
    } else if (clone.type === 'family') {
      if (Array.isArray(clone.members)) {
        clone.members.forEach((m) => {
          sanitizeDocForCloud(m.passportDoc);
          sanitizeDocForCloud(m.birthOrMarriageDoc);
        });
      }
    }
  } catch (err) {
    console.warn('optimizeApplicationForCloud error:', err);
  }

  return clone;
}

function mergeSingleAppDocs(base: AnyApplication, other: AnyApplication): AnyApplication {
  const result: AnyApplication = JSON.parse(JSON.stringify(base));
  if (result.type === 'friends' && other.type === 'friends') {
    if (!result.applicantStudent?.passportDoc?.url && other.applicantStudent?.passportDoc?.url) {
      if (result.applicantStudent?.passportDoc) result.applicantStudent.passportDoc.url = other.applicantStudent.passportDoc.url;
      else if (result.applicantStudent) result.applicantStudent.passportDoc = other.applicantStudent.passportDoc;
    }
    if (!result.applicantStudent?.certificateDoc?.url && other.applicantStudent?.certificateDoc?.url) {
      if (result.applicantStudent?.certificateDoc) result.applicantStudent.certificateDoc.url = other.applicantStudent.certificateDoc.url;
      else if (result.applicantStudent) result.applicantStudent.certificateDoc = other.applicantStudent.certificateDoc;
    }
    if (!result.friendStudent?.passportDoc?.url && other.friendStudent?.passportDoc?.url) {
      if (result.friendStudent?.passportDoc) result.friendStudent.passportDoc.url = other.friendStudent.passportDoc.url;
      else if (result.friendStudent) result.friendStudent.passportDoc = other.friendStudent.passportDoc;
    }
    if (!result.friendStudent?.certificateDoc?.url && other.friendStudent?.certificateDoc?.url) {
      if (result.friendStudent?.certificateDoc) result.friendStudent.certificateDoc.url = other.friendStudent.certificateDoc.url;
      else if (result.friendStudent) result.friendStudent.certificateDoc = other.friendStudent.certificateDoc;
    }
    if (Array.isArray(result.friendsList) && Array.isArray(other.friendsList)) {
      result.friendsList.forEach((fr, idx) => {
        const oFr = other.friendsList[idx] || other.friendsList.find(f => f.jshshr === fr.jshshr);
        if (oFr) {
          if (!fr.passportDoc?.url && oFr.passportDoc?.url) {
            if (fr.passportDoc) fr.passportDoc.url = oFr.passportDoc.url;
            else fr.passportDoc = oFr.passportDoc;
          }
          if (!fr.certificateDoc?.url && oFr.certificateDoc?.url) {
            if (fr.certificateDoc) fr.certificateDoc.url = oFr.certificateDoc.url;
            else fr.certificateDoc = oFr.certificateDoc;
          }
        }
      });
    }
  } else if (result.type === 'family' && other.type === 'family') {
    if (Array.isArray(result.members) && Array.isArray(other.members)) {
      result.members.forEach((m, idx) => {
        const oMember = other.members[idx] || other.members.find(lm => lm.jshshr === m.jshshr);
        if (oMember) {
          if (!m.passportDoc?.url && oMember.passportDoc?.url) {
            if (m.passportDoc) m.passportDoc.url = oMember.passportDoc.url;
            else m.passportDoc = oMember.passportDoc;
          }
          if (!m.birthOrMarriageDoc?.url && oMember.birthOrMarriageDoc?.url) {
            if (m.birthOrMarriageDoc) m.birthOrMarriageDoc.url = oMember.birthOrMarriageDoc.url;
            else m.birthOrMarriageDoc = oMember.birthOrMarriageDoc;
          }
        }
      });
    }
  }
  return result;
}

/**
 * Robustly merges two application lists (e.g. from Server, Cloud, and Local).
 * Ensures newly submitted applications in either list are NEVER discarded.
 * Resolves conflicts by picking the newest update while preserving document URLs.
 */
export function mergeApplicationsPreservingNewest(
  primaryList: AnyApplication[],
  secondaryList: AnyApplication[]
): AnyApplication[] {
  const map = new Map<string, AnyApplication>();

  const insertOrMerge = (app: AnyApplication) => {
    if (!app || !app.id) return;
    const existing = map.get(app.id);
    if (!existing) {
      map.set(app.id, app);
    } else {
      const existingTime = new Date((existing as any).updatedAt || existing.createdAt || 0).getTime();
      const newTime = new Date((app as any).updatedAt || app.createdAt || 0).getTime();

      const base = newTime >= existingTime ? app : existing;
      const other = newTime >= existingTime ? existing : app;

      map.set(app.id, mergeSingleAppDocs(base, other));
    }
  };

  if (Array.isArray(secondaryList)) secondaryList.forEach(insertOrMerge);
  if (Array.isArray(primaryList)) primaryList.forEach(insertOrMerge);

  const merged = Array.from(map.values());
  merged.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
  return merged;
}

/**
 * Intelligently merges cloud applications with local / server document URLs.
 * Guarantees that valid document URLs and IDs are never lost.
 */
export function mergeLocalDocumentUrls(
  cloudApps: AnyApplication[],
  localApps: AnyApplication[]
): AnyApplication[] {
  return mergeApplicationsPreservingNewest(cloudApps, localApps);
}
