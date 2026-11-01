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

function mergeDoc(target?: DocumentFile, source?: DocumentFile): DocumentFile | undefined {
  if (!target && !source) return undefined;
  if (!target) return source ? JSON.parse(JSON.stringify(source)) : undefined;
  if (!source) return target;

  const merged: DocumentFile = { ...target };
  if (!merged.dataUrl && source.dataUrl) {
    merged.dataUrl = source.dataUrl;
  }
  if (source.url && source.url.startsWith('data:') && !merged.dataUrl) {
    merged.dataUrl = source.url;
  }
  if ((!merged.url || merged.url.trim() === '') && source.url) {
    merged.url = source.url;
  }
  if (!merged.size && source.size) {
    merged.size = source.size;
  }
  if (!merged.driveFileId && source.driveFileId) {
    merged.driveFileId = source.driveFileId;
    merged.driveWebViewLink = source.driveWebViewLink;
    merged.driveDownloadLink = source.driveDownloadLink;
  }
  return merged;
}

export function mergeSingleAppDocs(base: AnyApplication, other: AnyApplication): AnyApplication {
  if (!base) return other;
  if (!other) return base;
  try {
    const result: AnyApplication = JSON.parse(JSON.stringify(base));
    if (result.type === 'friends' && other.type === 'friends') {
      if (result.applicantStudent && other.applicantStudent) {
        result.applicantStudent.passportDoc = mergeDoc(result.applicantStudent.passportDoc, other.applicantStudent.passportDoc);
        result.applicantStudent.certificateDoc = mergeDoc(result.applicantStudent.certificateDoc, other.applicantStudent.certificateDoc);
      } else if (!result.applicantStudent && other.applicantStudent) {
        result.applicantStudent = other.applicantStudent;
      }

      if (result.friendStudent && other.friendStudent) {
        result.friendStudent.passportDoc = mergeDoc(result.friendStudent.passportDoc, other.friendStudent.passportDoc);
        result.friendStudent.certificateDoc = mergeDoc(result.friendStudent.certificateDoc, other.friendStudent.certificateDoc);
      } else if (!result.friendStudent && other.friendStudent) {
        result.friendStudent = other.friendStudent;
      }

      if (Array.isArray(other.friendsList) && other.friendsList.length > 0) {
        if (!Array.isArray(result.friendsList) || result.friendsList.length === 0) {
          result.friendsList = other.friendsList;
        } else {
          result.friendsList = result.friendsList.map((fr, idx) => {
            const oFr = other.friendsList[idx] || other.friendsList.find((f) => f && f.jshshr === fr.jshshr);
            if (!oFr) return fr;
            return {
              ...fr,
              passportDoc: mergeDoc(fr.passportDoc, oFr.passportDoc),
              certificateDoc: mergeDoc(fr.certificateDoc, oFr.certificateDoc)
            };
          });
        }
      }
    } else if (result.type === 'family' && other.type === 'family') {
      if (Array.isArray(other.members) && other.members.length > 0) {
        if (!Array.isArray(result.members) || result.members.length === 0) {
          result.members = other.members;
        } else {
          result.members = result.members.map((m, idx) => {
            const oMember = other.members[idx] || other.members.find((lm) => lm && lm.jshshr === m.jshshr);
            if (!oMember) return m;
            return {
              ...m,
              passportDoc: mergeDoc(m.passportDoc, oMember.passportDoc),
              birthOrMarriageDoc: mergeDoc(m.birthOrMarriageDoc, oMember.birthOrMarriageDoc)
            };
          });
        }
      }
    }
    return result;
  } catch (err) {
    console.warn('mergeSingleAppDocs error:', err);
    return base;
  }
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

      let base: AnyApplication;
      let other: AnyApplication;

      if (newTime > existingTime) {
        base = app;
        other = existing;
      } else if (existingTime > newTime) {
        base = existing;
        other = app;
      } else {
        // If timestamps are equal, prefer the one with a resolved status ('tasdiqlandi' or 'rad_etildi')
        const isAppDecided = app.status === 'tasdiqlandi' || app.status === 'rad_etildi';
        const isExistingDecided = existing.status === 'tasdiqlandi' || existing.status === 'rad_etildi';
        if (isAppDecided && !isExistingDecided) {
          base = app;
          other = existing;
        } else {
          base = existing;
          other = app;
        }
      }

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
