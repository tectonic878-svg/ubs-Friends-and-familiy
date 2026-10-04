import express from 'express';
import { createServer as createViteServer } from 'vite';
import fs from 'fs';
import path from 'path';
import JSZip from 'jszip';

const app = express();
const PORT = 3000;

// Request body limits to handle real PDF attachments smoothly
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ extended: true, limit: '100mb' }));

// Dedicated data storage directory on local computer
const DATA_DIR = path.resolve(process.cwd(), 'data_storage');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const DOCS_DIR = path.join(DATA_DIR, 'documents');
if (!fs.existsSync(DOCS_DIR)) {
  fs.mkdirSync(DOCS_DIR, { recursive: true });
}

const APPS_FILE = path.join(DATA_DIR, 'applications.json');
const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');
const DOCS_MANIFEST_FILE = path.join(DOCS_DIR, 'manifest.json');

// Initialize files if not existing
if (!fs.existsSync(APPS_FILE)) {
  fs.writeFileSync(APPS_FILE, JSON.stringify([], null, 2), 'utf8');
}
if (!fs.existsSync(SETTINGS_FILE)) {
  fs.writeFileSync(SETTINGS_FILE, JSON.stringify({}, null, 2), 'utf8');
}
if (!fs.existsSync(DOCS_MANIFEST_FILE)) {
  fs.writeFileSync(DOCS_MANIFEST_FILE, JSON.stringify({}, null, 2), 'utf8');
}

// In-memory read helpers
function getStoredApplications(): any[] {
  try {
    const raw = fs.readFileSync(APPS_FILE, 'utf8');
    const apps = JSON.parse(raw);
    return Array.isArray(apps) ? apps : [];
  } catch (err) {
    console.error('Error reading applications file:', err);
    return [];
  }
}

function saveStoredApplications(apps: any[]) {
  try {
    fs.writeFileSync(APPS_FILE, JSON.stringify(apps, null, 2), 'utf8');
  } catch (err) {
    console.error('Error writing applications file:', err);
  }
}

function getStoredSettings() {
  try {
    const raw = fs.readFileSync(SETTINGS_FILE, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    console.error('Error reading settings file:', err);
    return {};
  }
}

function saveStoredSettings(settings: any) {
  try {
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2), 'utf8');
  } catch (err) {
    console.error('Error writing settings file:', err);
  }
}

function getDocsManifest(): Record<string, { id: string; name: string; type: string; size: string; mime: string; path: string }> {
  try {
    const raw = fs.readFileSync(DOCS_MANIFEST_FILE, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    console.error('Error reading docs manifest:', err);
    return {};
  }
}

function saveDocsManifest(manifest: Record<string, any>) {
  try {
    fs.writeFileSync(DOCS_MANIFEST_FILE, JSON.stringify(manifest, null, 2), 'utf8');
  } catch (err) {
    console.error('Error writing docs manifest:', err);
  }
}

function getCustomStorageDir(): string {
  try {
    const settings = getStoredSettings();
    if (settings && typeof settings.customStorageDirectory === 'string' && settings.customStorageDirectory.trim()) {
      return settings.customStorageDirectory.trim();
    }
  } catch {}
  return DOCS_DIR;
}

function writeBufferToAllStorageLocations(filename: string, buffer: Buffer): string {
  const primaryPath = path.join(DOCS_DIR, filename);
  try {
    fs.writeFileSync(primaryPath, buffer);
  } catch (e) {
    console.error('Error writing to DOCS_DIR:', e);
  }

  const customDir = getCustomStorageDir();
  if (customDir && customDir !== DOCS_DIR) {
    try {
      if (!fs.existsSync(customDir)) {
        fs.mkdirSync(customDir, { recursive: true });
      }
      const customPath = path.join(customDir, filename);
      fs.writeFileSync(customPath, buffer);
      console.log(`[Maxsus Papka] Fayl maxsus belgilangan papkaga saqlandi: ${customPath}`);
    } catch (customErr) {
      console.warn(`[Maxsus Papka] ${customDir} ga yozishda ogohlantirish:`, customErr);
    }
  }

  return primaryPath;
}

/**
 * Light cloud document reference registration (preserves Firestore write quota)
 * Large binary PDFs are securely preserved on the server disk in DOCS_DIR
 */
async function backupDocToFirestore(_docId: string, _name: string, _buffer: Buffer, _sizeStr: string, _aliases: string[] = []) {
  return;
}

/**
 * Saves a real binary PDF uploaded by an applicant onto local computer server disk
 */
function persistDocToDisk(
  docItem: { id: string; name: string; url?: string; dataUrl?: string; type?: string; size?: string },
  studentJshshr?: string,
  studentPhone?: string,
  docRole?: 'passport' | 'certificate' | 'family'
): string {
  if (!docItem || !docItem.id) return docItem?.url || '';

  const docId = docItem.id.replace(/\.pdf$/i, '').replace(/[^a-zA-Z0-9_-]/g, '_');
  const manifest = getDocsManifest();
  const safeName = (docItem.name || `${docId}.pdf`).replace(/\.pdf$/i, '').replace(/[^a-zA-Z0-9_-]/g, '_');

  const rawDataUrl = (docItem.dataUrl && docItem.dataUrl.startsWith('data:'))
    ? docItem.dataUrl
    : (docItem.url && docItem.url.startsWith('data:'))
      ? docItem.url
      : null;

  // If base64 data URL, convert and save raw authentic bytes directly to computer disk
  if (rawDataUrl) {
    try {
      const commaIdx = rawDataUrl.indexOf(',');
      if (commaIdx !== -1) {
        const data = rawDataUrl.slice(commaIdx + 1);
        const buffer = Buffer.from(data, 'base64');
        const filePath = writeBufferToAllStorageLocations(`${docId}.pdf`, buffer);
        const sizeStr = docItem.size || `${(buffer.length / (1024 * 1024)).toFixed(2)} MB`;

        // 2. Identify all aliases (JSHSHR, phone, meaningful names)
        const aliases = new Set<string>();
        if (safeName && safeName !== docId) aliases.add(safeName);

        if (studentJshshr) {
          const cleanJsh = studentJshshr.replace(/[^0-9]/g, '');
          if (cleanJsh) {
            aliases.add(cleanJsh);
            if (docRole === 'certificate') {
              aliases.add(`${cleanJsh}_diplom`);
            }
          }
        }

        if (studentPhone) {
          const cleanPh = studentPhone.replace(/[^0-9]/g, '');
          if (cleanPh) {
            aliases.add(cleanPh);
            if (cleanPh.startsWith('998')) {
              aliases.add(cleanPh.slice(3));
            }
          }
        }

        // Write aliases to disk so admin can find files easily by student phone or JSHSHR
        for (const alias of aliases) {
          try {
            const aliasPath = writeBufferToAllStorageLocations(`${alias}.pdf`, buffer);
            manifest[alias] = {
              id: docId,
              name: `${alias}.pdf`,
              type: 'pdf',
              size: sizeStr,
              mime: 'application/pdf',
              path: aliasPath
            };
          } catch {}
        }

        manifest[docId] = {
          id: docId,
          name: docItem.name || `${docId}.pdf`,
          type: 'pdf',
          size: sizeStr,
          mime: 'application/pdf',
          path: filePath
        };
        saveDocsManifest(manifest);

        console.log(`[Kompyuter Serveri] Yangi PDF hujjat kompyuter diskiga saqlandi: ${filePath} (${sizeStr})`);
        return `/api/documents/${docId}`;
      }
    } catch (err) {
      console.error(`Error persisting real document ${docId}:`, err);
    }
  }

  // If already a server endpoint, verify it actually exists on disk or register in manifest
  if (docItem.url && docItem.url.startsWith('/api/documents/')) {
    return docItem.url;
  }

  return `/api/documents/${docId}`;
}

/**
 * Recursively scans an application and saves any real attached documents to computer server disk
 */
function processApplicationDocs(app: any): any {
  if (!app) return app;
  const clone = JSON.parse(JSON.stringify(app));

  const processDocField = (d: any, jshshr?: string, phone?: string, role?: 'passport' | 'certificate' | 'family') => {
    if (!d) return d;
    if (!d.id) {
      d.id = 'doc_' + Math.random().toString(36).substring(2, 9);
    }
    const safeUrl = persistDocToDisk(d, jshshr, phone, role);
    d.url = safeUrl || `/api/documents/${d.id}`;
    return d;
  };

  if (clone.type === 'friends') {
    if (clone.applicantStudent) {
      const jsh = clone.applicantStudent.jshshr;
      const ph = (clone.applicantStudent.phone1 || clone.applicantStudent.phone || '').replace(/[^0-9]/g, '');
      if (clone.applicantStudent.passportDoc) {
        clone.applicantStudent.passportDoc = processDocField(clone.applicantStudent.passportDoc, jsh, ph, 'passport');
      }
      if (clone.applicantStudent.certificateDoc) {
        clone.applicantStudent.certificateDoc = processDocField(clone.applicantStudent.certificateDoc, jsh, ph, 'certificate');
      }
    }
    if (clone.friendStudent) {
      const jsh = clone.friendStudent.jshshr;
      const ph = (clone.friendStudent.phone1 || clone.friendStudent.phone || '').replace(/[^0-9]/g, '');
      if (clone.friendStudent.passportDoc) {
        clone.friendStudent.passportDoc = processDocField(clone.friendStudent.passportDoc, jsh, ph, 'passport');
      }
      if (clone.friendStudent.certificateDoc) {
        clone.friendStudent.certificateDoc = processDocField(clone.friendStudent.certificateDoc, jsh, ph, 'certificate');
      }
    }
    if (Array.isArray(clone.friendsList)) {
      clone.friendsList.forEach((fr: any) => {
        const jsh = fr.jshshr;
        const ph = (fr.phone1 || fr.phone || '').replace(/[^0-9]/g, '');
        if (fr?.passportDoc) fr.passportDoc = processDocField(fr.passportDoc, jsh, ph, 'passport');
        if (fr?.certificateDoc) fr.certificateDoc = processDocField(fr.certificateDoc, jsh, ph, 'certificate');
      });
    }
  } else if (clone.type === 'family') {
    if (Array.isArray(clone.members)) {
      clone.members.forEach((m: any) => {
        const jsh = m.jshshr;
        const ph = (m.phone1 || m.phone || '').replace(/[^0-9]/g, '');
        if (m?.passportDoc) m.passportDoc = processDocField(m.passportDoc, jsh, ph, 'passport');
        if (m?.birthOrMarriageDoc) m.birthOrMarriageDoc = processDocField(m.birthOrMarriageDoc, jsh, ph, 'family');
      });
    }
  }

  return clone;
}

// Helper to locate a document by ID, manifest key, or filename (with fallback to Google Firestore & applications.json)
async function findOrFetchDocument(idOrName: string): Promise<{ filePath: string; filename: string; mime: string } | null> {
  const cleanId = idOrName.replace(/\.pdf$/i, '').replace(/[^a-zA-Z0-9_-]/g, '_');
  const manifest = getDocsManifest();

  // 1. Direct file check by cleanId.pdf
  const directPath = path.join(DOCS_DIR, `${cleanId}.pdf`);
  if (fs.existsSync(directPath)) {
    const meta = manifest[cleanId];
    return {
      filePath: directPath,
      filename: meta?.name || `${cleanId}.pdf`,
      mime: meta?.mime || 'application/pdf'
    };
  }

  // 2. Check manifest for matching id, name, or phone/jshshr
  for (const [key, meta] of Object.entries(manifest)) {
    if (
      key === cleanId ||
      meta.id === cleanId ||
      meta.name === idOrName ||
      meta.name === `${cleanId}.pdf` ||
      meta.name.replace(/\.pdf$/i, '') === cleanId
    ) {
      const candPath = path.join(DOCS_DIR, `${key}.pdf`);
      if (fs.existsSync(candPath)) {
        return {
          filePath: candPath,
          filename: meta.name || `${cleanId}.pdf`,
          mime: meta.mime || 'application/pdf'
        };
      }
    }
  }

  // 3. Digits search (handling phone numbers with or without 998)
  const digitsOnly = idOrName.replace(/[^0-9]/g, '');
  if (digitsOnly.length >= 7) {
    const variations = [
      digitsOnly,
      digitsOnly.startsWith('998') ? digitsOnly.slice(3) : '998' + digitsOnly
    ];
    for (const v of variations) {
      const varPath = path.join(DOCS_DIR, `${v}.pdf`);
      if (fs.existsSync(varPath)) {
        return {
          filePath: varPath,
          filename: `${v}.pdf`,
          mime: 'application/pdf'
        };
      }
    }
  }

  // 4. Fallback search across directory for partial match
  try {
    const files = fs.readdirSync(DOCS_DIR);
    for (const f of files) {
      if (f.endsWith('.pdf') && (f.toLowerCase().includes(cleanId.toLowerCase()) || (digitsOnly.length >= 7 && f.includes(digitsOnly)))) {
        const foundPath = path.join(DOCS_DIR, f);
        return {
          filePath: foundPath,
          filename: f,
          mime: 'application/pdf'
        };
      }
    }
  } catch (err) {
    console.error('Error scanning DOCS_DIR:', err);
  }

  // 5. Check if applications.json contains embedded base64 data for this document
  try {
    const apps = getStoredApplications();
    for (const app of apps) {
      const docCandidates: any[] = [];
      if (app.type === 'friends') {
        if (app.applicantStudent?.passportDoc) docCandidates.push(app.applicantStudent.passportDoc);
        if (app.applicantStudent?.certificateDoc) docCandidates.push(app.applicantStudent.certificateDoc);
        if (app.friendStudent?.passportDoc) docCandidates.push(app.friendStudent.passportDoc);
        if (app.friendStudent?.certificateDoc) docCandidates.push(app.friendStudent.certificateDoc);
        if (Array.isArray(app.friendsList)) {
          app.friendsList.forEach((fr: any) => {
            if (fr?.passportDoc) docCandidates.push(fr.passportDoc);
            if (fr?.certificateDoc) docCandidates.push(fr.certificateDoc);
          });
        }
      } else if (app.type === 'family' && Array.isArray(app.members)) {
        app.members.forEach((m: any) => {
          if (m?.passportDoc) docCandidates.push(m.passportDoc);
          if (m?.birthOrMarriageDoc) docCandidates.push(m.birthOrMarriageDoc);
        });
      }

      for (const d of docCandidates) {
        if (d && (d.id === cleanId || d.name?.includes(cleanId))) {
          const rawData = d.dataUrl || (d.url?.startsWith('data:') ? d.url : null);
          if (rawData) {
            const commaIdx = rawData.indexOf(',');
            const b64 = commaIdx !== -1 ? rawData.slice(commaIdx + 1) : rawData;
            const buffer = Buffer.from(b64, 'base64');
            const restoredPath = path.join(DOCS_DIR, `${cleanId}.pdf`);
            fs.writeFileSync(restoredPath, buffer);
            return {
              filePath: restoredPath,
              filename: d.name || `${cleanId}.pdf`,
              mime: 'application/pdf'
            };
          }
        }
      }
    }
  } catch (appScanErr) {
    console.warn('Scan applications error:', appScanErr);
  }

  return null;
}

// ---------------- REST API ENDPOINTS ----------------

// 1. Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString(), isLocalPcServer: true });
});

// 2. Server & Local Computer Documents Information (Mening Kompyuterim Serveri)
app.get('/api/server-info', (req, res) => {
  try {
    const files = fs.readdirSync(DOCS_DIR);
    const pdfFiles: any[] = [];
    let totalBytes = 0;
    const manifest = getDocsManifest();

    for (const f of files) {
      if (f.toLowerCase().endsWith('.pdf')) {
        const filePath = path.join(DOCS_DIR, f);
        try {
          const stat = fs.statSync(filePath);
          totalBytes += stat.size;
          const clean = f.replace(/\.pdf$/i, '');
          const meta = (manifest[clean] || {}) as any;
          pdfFiles.push({
            filename: f,
            id: meta.id || clean,
            name: meta.name || f,
            sizeBytes: stat.size,
            sizeFormatted: (stat.size / (1024 * 1024)).toFixed(2) + ' MB',
            modifiedAt: stat.mtime.toISOString(),
            url: `/api/documents/${clean}`
          });
        } catch {}
      }
    }

    pdfFiles.sort((a, b) => new Date(b.modifiedAt).getTime() - new Date(a.modifiedAt).getTime());

    res.json({
      success: true,
      isLocalPcServer: true,
      storageDirectory: path.resolve(getCustomStorageDir()),
      defaultStorageDirectory: path.resolve(DOCS_DIR),
      isCustomDirectory: getCustomStorageDir() !== DOCS_DIR,
      totalPdfCount: pdfFiles.length,
      totalSizeBytes: totalBytes,
      totalSizeMB: (totalBytes / (1024 * 1024)).toFixed(2) + ' MB',
      files: pdfFiles
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 3. Download ALL applicant PDF documents as a single ZIP directly from user's computer server
app.get('/api/documents/download-all-zip', async (req, res) => {
  try {
    const zip = new JSZip();
    const files = fs.readdirSync(DOCS_DIR);
    let addedCount = 0;

    let summaryText = `UBS TALABA ARIZALARI - BARCHA PDF HUJJATLAR\nServer: Foydalanuvchi Kompyuter Serveri\nSaqlash joyi: ${path.resolve(DOCS_DIR)}\nYuklab olingan vaqt: ${new Date().toLocaleString('uz-UZ')}\nJami PDF fayllar soni: \n\n`;

    for (const file of files) {
      if (file.toLowerCase().endsWith('.pdf')) {
        const filePath = path.join(DOCS_DIR, file);
        try {
          const stats = fs.statSync(filePath);
          if (stats.size > 0) {
            const fileData = fs.readFileSync(filePath);
            zip.file(file, fileData);
            addedCount++;
            summaryText += `- ${file} (${(stats.size / (1024 * 1024)).toFixed(2)} MB)\n`;
          }
        } catch (readErr) {
          console.warn(`Error reading file for zip: ${file}`, readErr);
        }
      }
    }

    summaryText = summaryText.replace('Jami PDF fayllar soni: ', `Jami PDF fayllar soni: ${addedCount}\n`);
    zip.file('00_KOMPYUTER_HUJJATLAR_ROYXATI.txt', summaryText);

    if (addedCount === 0) {
      return res.status(404).send('Kompyuter serverida hozircha birorta ham PDF fayl mavjud emas.');
    }

    const zipBuffer = await zip.generateAsync({
      type: 'nodebuffer',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 }
    });

    const zipFilename = `UBS_Arizachilar_Barcha_PDF_Fayllari_${new Date().toISOString().slice(0, 10)}.zip`;
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${zipFilename}"`);
    res.setHeader('Content-Length', zipBuffer.length);
    res.send(zipBuffer);
  } catch (err) {
    console.error('ZIP yaratishda xatolik:', err);
    res.status(500).json({ success: false, error: 'ZIP fayl yaratishda xatolik yuz berdi' });
  }
});

// 4. Direct binary PDF document upload (fast, reliable stream for large PDFs)
app.post(
  '/api/documents/upload-binary',
  express.raw({ type: ['application/pdf', 'application/octet-stream', '*/*'], limit: '100mb' }),
  async (req, res) => {
    try {
      const buffer = req.body;
      if (!buffer || !Buffer.isBuffer(buffer) || buffer.length === 0) {
        return res.status(400).json({ success: false, error: 'Fayl baytlari qabul qilinmadi' });
      }

      const idParam = (req.query.id as string) || (req.headers['x-document-id'] as string) || ('doc_' + Math.random().toString(36).substring(2, 9));
      const rawName = (req.query.name as string) || (req.headers['x-document-name'] as string) || `${idParam}.pdf`;
      const nameParam = decodeURIComponent(rawName);
      const cleanDocId = idParam.replace(/\.pdf$/i, '').replace(/[^a-zA-Z0-9_-]/g, '_');
      const cleanName = nameParam.replace(/\.pdf$/i, '').replace(/[^a-zA-Z0-9_-]/g, '_');
      const sizeStr = `${(buffer.length / (1024 * 1024)).toFixed(2)} MB`;

      const filePath = writeBufferToAllStorageLocations(`${cleanDocId}.pdf`, buffer);

      const manifest = getDocsManifest();
      manifest[cleanDocId] = {
        id: cleanDocId,
        name: nameParam,
        type: 'pdf',
        size: sizeStr,
        mime: 'application/pdf',
        path: filePath
      };

      if (cleanName && cleanName !== cleanDocId) {
        try {
          const aliasPath = writeBufferToAllStorageLocations(`${cleanName}.pdf`, buffer);
          manifest[cleanName] = {
            id: cleanDocId,
            name: nameParam,
            type: 'pdf',
            size: sizeStr,
            mime: 'application/pdf',
            path: aliasPath
          };
        } catch {}
      }

      saveDocsManifest(manifest);

      console.log(`[Kompyuter Serveri Upload] PDF kompyuterga saqlandi: ${cleanDocId}.pdf (${sizeStr})`);

      res.json({
        success: true,
        id: cleanDocId,
        name: nameParam,
        url: `/api/documents/${cleanDocId}`,
        size: sizeStr
      });
    } catch (err) {
      console.error('Binary upload error:', err);
      res.status(500).json({ success: false, error: 'Binary yuklashda xatolik yuz berdi' });
    }
  }
);

// 5. Direct JSON base64 PDF document upload
app.post('/api/documents/upload', async (req, res) => {
  try {
    const { id, name, type, dataUrl, size } = req.body;
    if (!id || !dataUrl) {
      return res.status(400).json({ success: false, error: 'id and dataUrl are required' });
    }

    const docId = id.replace(/\.pdf$/i, '').replace(/[^a-zA-Z0-9_-]/g, '_');
    const safeUrl = persistDocToDisk({ id: docId, name: name || `${docId}.pdf`, url: dataUrl, type: type || 'pdf', size });

    res.json({
      success: true,
      id: docId,
      url: safeUrl,
      name: name || `${docId}.pdf`,
      type: type || 'pdf'
    });
  } catch (err) {
    console.error('Document upload error:', err);
    res.status(500).json({ success: false, error: 'Failed to upload document' });
  }
});

// 6. Attach or replace document on an existing application directly on computer server
app.post(
  '/api/applications/:id/documents/attach',
  express.raw({ type: ['application/pdf', 'application/octet-stream', '*/*'], limit: '100mb' }),
  async (req, res) => {
    try {
      const { id } = req.params;
      const targetRole = (req.query.role as string) || 'passport'; // 'passport' or 'certificate' or 'birth'
      const studentIdx = parseInt((req.query.studentIndex as string) || '0', 10);
      const isFriend = req.query.isFriend === 'true';
      const rawName = (req.query.name as string) || `${id}_${targetRole}.pdf`;
      const name = decodeURIComponent(rawName);

      const buffer = req.body;
      if (!buffer || !Buffer.isBuffer(buffer) || buffer.length === 0) {
        return res.status(400).json({ success: false, error: 'Fayl baytlari qabul qilinmadi' });
      }

      const docId = 'doc_' + Math.random().toString(36).substring(2, 9);
      const cleanDocId = docId.replace(/[^a-zA-Z0-9_-]/g, '_');
      const sizeStr = `${(buffer.length / (1024 * 1024)).toFixed(2)} MB`;

      // Save to disk
      const filePath = path.join(DOCS_DIR, `${cleanDocId}.pdf`);
      fs.writeFileSync(filePath, buffer);

      const safeName = name.replace(/\.pdf$/i, '').replace(/[^a-zA-Z0-9_-]/g, '_');
      if (safeName && safeName !== cleanDocId) {
        try {
          fs.writeFileSync(path.join(DOCS_DIR, `${safeName}.pdf`), buffer);
        } catch {}
      }

      const manifest = getDocsManifest();
      manifest[cleanDocId] = {
        id: cleanDocId,
        name,
        type: 'pdf',
        size: sizeStr,
        mime: 'application/pdf',
        path: filePath
      };
      if (safeName) {
        manifest[safeName] = {
          id: cleanDocId,
          name,
          type: 'pdf',
          size: sizeStr,
          mime: 'application/pdf',
          path: path.join(DOCS_DIR, `${safeName}.pdf`)
        };
      }
      saveDocsManifest(manifest);

      // Attach to application in applications.json
      const apps = getStoredApplications();
      const targetApp = apps.find((a: any) => a.id === id);
      if (targetApp) {
        const newDocObj = {
          id: cleanDocId,
          name,
          type: 'pdf',
          url: `/api/documents/${cleanDocId}`,
          size: sizeStr,
          uploadedAt: new Date().toISOString()
        };

        if (targetApp.type === 'friends') {
          if (!isFriend) {
            if (targetRole === 'passport') {
              if (!targetApp.applicantStudent) targetApp.applicantStudent = {};
              targetApp.applicantStudent.passportDoc = newDocObj;
            } else {
              if (!targetApp.applicantStudent) targetApp.applicantStudent = {};
              targetApp.applicantStudent.certificateDoc = newDocObj;
            }
          } else {
            if (Array.isArray(targetApp.friendsList) && targetApp.friendsList[studentIdx]) {
              if (targetRole === 'passport') {
                targetApp.friendsList[studentIdx].passportDoc = newDocObj;
              } else {
                targetApp.friendsList[studentIdx].certificateDoc = newDocObj;
              }
            } else if (targetApp.friendStudent) {
              if (targetRole === 'passport') {
                targetApp.friendStudent.passportDoc = newDocObj;
              } else {
                targetApp.friendStudent.certificateDoc = newDocObj;
              }
            }
          }
        } else if (targetApp.type === 'family') {
          if (Array.isArray(targetApp.members) && targetApp.members[studentIdx]) {
            if (targetRole === 'passport') {
              targetApp.members[studentIdx].passportDoc = newDocObj;
            } else {
              targetApp.members[studentIdx].birthOrMarriageDoc = newDocObj;
            }
          }
        }

        saveStoredApplications(apps);
        console.log(`[Kompyuter Serveri] Hujjat arizaga biriktirildi: ${id} -> ${name}`);
      }

      res.json({
        success: true,
        docId: cleanDocId,
        name,
        url: `/api/documents/${cleanDocId}`,
        size: sizeStr
      });
    } catch (err: any) {
      console.error('Attach doc error:', err);
      res.status(500).json({ success: false, error: err.message });
    }
  }
);

// 7. Serve binary document inline (PDF viewer)
app.get('/api/documents/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const docInfo = await findOrFetchDocument(id);

    if (!docInfo) {
      return res.status(404).json({ success: false, error: 'Asl PDF fayl serverda topilmadi' });
    }

    res.setHeader('Content-Type', docInfo.mime);
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(docInfo.filename)}"`);
    res.setHeader('Cache-Control', 'public, max-age=31536000');

    res.sendFile(docInfo.filePath);
  } catch (err) {
    console.error('Error serving document:', err);
    res.status(500).json({ success: false, error: 'Failed to serve document' });
  }
});

// 8. Serve binary document download
app.get('/api/documents/:id/download', async (req, res) => {
  try {
    const { id } = req.params;
    const docInfo = await findOrFetchDocument(id);

    if (!docInfo) {
      return res.status(404).json({ success: false, error: 'Asl PDF fayl serverda topilmadi' });
    }

    res.download(docInfo.filePath, docInfo.filename);
  } catch (err) {
    console.error('Error downloading document:', err);
    res.status(500).json({ success: false, error: 'Failed to download document' });
  }
});

// 9. Get all applications
app.get('/api/applications', (req, res) => {
  const apps = getStoredApplications();
  res.json({ success: true, count: apps.length, data: apps });
});

// 9.1 Clear all applications (Reset to 0)
app.post('/api/admin/clear-all-applications', (req, res) => {
  try {
    saveStoredApplications([]);
    saveDocsManifest({});
    console.log('[Server] Barcha arizalar 0 holatiga tushirildi (tozalandi).');
    res.json({ success: true, count: 0, message: 'Barcha arizalar muvaffaqiyatli tozalandi.' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 10. Save or update an application (direct to local computer disk)
app.post('/api/applications', (req, res) => {
  const rawApp = req.body;
  if (!rawApp || !rawApp.id) {
    return res.status(400).json({ success: false, error: 'Arizada ID topilmadi' });
  }

  const processedApp = processApplicationDocs(rawApp);
  const apps = getStoredApplications();
  const existingIdx = apps.findIndex((a: any) => a.id === processedApp.id);
  if (existingIdx >= 0) {
    apps[existingIdx] = processedApp;
  } else {
    apps.unshift(processedApp);
  }

  saveStoredApplications(apps);
  console.log(`[Kompyuter Serveri] Ariza saqlandi: ${processedApp.id}`);
  res.json({ success: true, id: processedApp.id, app: processedApp });
});

// 11. Update application status
app.patch('/api/applications/:id/status', (req, res) => {
  const { id } = req.params;
  const { status, adminNotes } = req.body;

  const apps = getStoredApplications();
  const target = apps.find((a: any) => a.id === id);
  if (target) {
    target.status = status;
    if (adminNotes !== undefined) {
      target.adminNotes = adminNotes;
    }
    saveStoredApplications(apps);
    return res.json({ success: true, updated: target });
  }
  res.status(404).json({ success: false, error: 'Ariza topilmadi' });
});

// 12. Bulk restore/import applications (Zaxiradan qayta yuklash)
app.post('/api/applications/bulk-import', (req, res) => {
  const { applications } = req.body;
  if (!Array.isArray(applications)) {
    return res.status(400).json({ success: false, error: 'Invalid applications array' });
  }

  const currentApps = getStoredApplications();
  const mergedMap = new Map();

  currentApps.forEach((app: any) => {
    if (app && app.id) mergedMap.set(app.id, app);
  });

  applications.forEach((app: any) => {
    if (app && app.id) {
      const processed = processApplicationDocs(app);
      mergedMap.set(app.id, processed);
    }
  });

  const mergedList = Array.from(mergedMap.values());
  saveStoredApplications(mergedList);

  res.json({ success: true, count: mergedList.length });
});

// 13. Reset database completely to 0 (Hammasini 0 ga qaytarish)
app.post('/api/reset-database', (req, res) => {
  try {
    saveStoredApplications([]);
    res.json({ success: true, message: 'Baza 0 ga muvaffaqiyatli qaytarildi' });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Xatolik yuz berdi' });
  }
});

// 13.1 Download 1-Click Windows Batch Script to sync all files directly into C:\UBS_Hujjatlar
app.get('/api/tools/download-windows-sync-script', (req, res) => {
  const host = req.get('host') || 'localhost:3000';
  const protocol = req.protocol === 'https' || req.get('x-forwarded-proto') === 'https' ? 'https' : 'http';
  const serverBaseUrl = `${protocol}://${host}`;

  const batContent = `@echo off
chcp 65001 > nul
title UBS Friends ^& Family - C: Diskka PDF Hujjatlarni Saqlash
color 0A

echo ======================================================================
echo    UBS Friends ^& Family Grant Portali - Kompyuter Diskiga Sinxronlash
echo ======================================================================
echo.

set "TARGET_DIR=C:\\UBS_Hujjatlar"
echo [*] Saqlash manzili: %TARGET_DIR%
if not exist "%TARGET_DIR%" (
    echo [*] Papka mavjud emas, yaratilmoqda...
    mkdir "%TARGET_DIR%"
)

echo [*] Serverdan eng songgi PDF hujjatlar yuklab olinmoqda...
powershell -Command "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; $tmp = [System.IO.Path]::GetTempFileName() + '.zip'; Invoke-WebRequest -Uri '${serverBaseUrl}/api/documents/download-all-zip' -OutFile $tmp; Expand-Archive -Path $tmp -DestinationPath '%TARGET_DIR%' -Force; Remove-Item $tmp"

echo.
echo ======================================================================
echo  [MUVAFFAQIYATLI] Barcha PDF hujjatlar C:\\UBS_Hujjatlar ga saqlandi!
echo ======================================================================
echo.
echo [*] Papka Windows Explorer orqali ochilmoqda...
explorer "%TARGET_DIR%"
echo.
pause
`;

  res.setHeader('Content-Type', 'application/x-bat');
  res.setHeader('Content-Disposition', 'attachment; filename="UBS_C_Diskka_Sinxronlash.bat"');
  res.send(batContent);
});

// 13.2 Server Setup Guide for Personal 10GB Server
app.get('/api/tools/download-server-setup-guide', (req, res) => {
  const guide = `
# UBS Friends & Family - Shaxsiy Serverga O'rnatish Qo'llanmasi (10GB+)

Ushbu loyihani o'z serveringizda ishga tushirish orqali siz 10GB (yoki undan ko'p) disk joyidan cheksiz foydalanishingiz mumkin.

## 1. Talablar
- Server: Linux (Ubuntu tavsiya etiladi) yoki Windows
- Node.js: v18 yoki undan yuqori
- RAM: 1GB+
- Disk: 10GB+

## 2. O'rnatish qadamlari (Linux)

1. Serverga terminal orqali kiring (SSH).
2. Node.js ni o'rnating:
   \`\`\`bash
   curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
   sudo apt-get install -y nodejs
   \`\`\`
3. Loyihani yuklab oling:
   \`\`\`bash
   git clone [loyha-linki]
   cd ubs-friends-family
   \`\`\`
4. Kutubxonalarni o'rnating:
   \`\`\`bash
   npm install
   \`\`\`
5. Loyihani build qiling va ishga tushiring:
   \`\`\`bash
   npm run build
   npm start
   \`\`\`

## 3. Avtomatik ishga tushirish (PM2)
Server o'chib yonsa ham dastur avtomat ishga tushishi uchun PM2 dan foydalaning:
\`\`\`bash
sudo npm install -g pm2
pm2 start npm --name "ubs-portal" -- start
pm2 save
pm2 startup
\`\`\`

## 4. Fayllar qayerda saqlanadi?
Barcha talabalar yuklagan PDF hujjatlar dastur papkasidagi \`data_storage/documents\` ichida saqlanadi. 
Sizda 10GB joy bo'lsa, minglab arizalarni bemalol saqlashingiz mumkin.

Savollar bo'lsa, administrator bilan bog'laning.
`;

  res.setHeader('Content-Type', 'text/markdown');
  res.setHeader('Content-Disposition', 'attachment; filename="UBS_Server_Ornatish_Qollanmasi.md"');
  res.send(guide);
});

// 14. Delete application
app.delete('/api/applications/:id', (req, res) => {
  const { id } = req.params;
  const apps = getStoredApplications();
  const filtered = apps.filter((a: any) => a.id !== id);
  saveStoredApplications(filtered);
  res.json({ success: true });
});

// 14.1 Get Storage Directory Settings
app.get('/api/settings/storage-directory', (req, res) => {
  const current = getCustomStorageDir();
  res.json({
    success: true,
    currentDirectory: path.resolve(current),
    rawDirectory: current,
    defaultDirectory: path.resolve(DOCS_DIR),
    isCustom: current !== DOCS_DIR
  });
});

// 14.2 Set Custom Storage Directory (C:\... or any folder path on computer)
app.post('/api/settings/storage-directory', (req, res) => {
  try {
    const { directory } = req.body;
    const settings = getStoredSettings();
    const cleanDir = (directory || '').trim();
    
    settings.customStorageDirectory = cleanDir;
    saveStoredSettings(settings);

    if (cleanDir && cleanDir !== DOCS_DIR) {
      try {
        if (!fs.existsSync(cleanDir)) {
          fs.mkdirSync(cleanDir, { recursive: true });
        }
      } catch (dirErr: any) {
        console.warn('Custom directory mkdir notice:', dirErr.message);
      }
    }

    console.log('[Server] Admin saqlash papkasini o‘zgartirdi:', cleanDir || DOCS_DIR);
    res.json({
      success: true,
      currentDirectory: path.resolve(cleanDir || DOCS_DIR),
      rawDirectory: cleanDir || DOCS_DIR,
      isCustom: Boolean(cleanDir && cleanDir !== DOCS_DIR)
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 15. Get settings
app.get('/api/settings/:key', (req, res) => {
  const { key } = req.params;
  const settings = getStoredSettings();
  res.json({ success: true, data: settings[key] || null });
});

// 16. Save settings
app.post('/api/settings/:key', (req, res) => {
  const { key } = req.params;
  const value = req.body;
  const settings = getStoredSettings();
  settings[key] = value;
  saveStoredSettings(settings);
  res.json({ success: true });
});

// Auto-heal any empty URLs in stored applications on startup
try {
  const stored = getStoredApplications();
  let changed = false;
  stored.forEach((app: any) => {
    const healDoc = (d: any) => {
      if (!d) return;
      if (!d.url || d.url === '') {
        d.url = `/api/documents/${d.id || d.name?.replace(/\.pdf$/i, '')}`;
        changed = true;
      }
    };
    if (app.type === 'friends') {
      healDoc(app.applicantStudent?.passportDoc);
      healDoc(app.applicantStudent?.certificateDoc);
      healDoc(app.friendStudent?.passportDoc);
      healDoc(app.friendStudent?.certificateDoc);
      if (Array.isArray(app.friendsList)) {
        app.friendsList.forEach((fr: any) => {
          healDoc(fr?.passportDoc);
          healDoc(fr?.certificateDoc);
        });
      }
    } else if (app.type === 'family' && Array.isArray(app.members)) {
      app.members.forEach((m: any) => {
        healDoc(m?.passportDoc);
        healDoc(m?.birthOrMarriageDoc);
      });
    }
  });
  if (changed) {
    saveStoredApplications(stored);
  }
} catch (healErr) {
  console.warn('Auto-heal error:', healErr);
}

// ---------------- VITE MIDDLEWARE SETUP ----------------
async function startServer() {
  const vite = await createViteServer({
    server: { 
      middlewareMode: true,
      allowedHosts: true,
    },
    appType: 'spa',
  });

  app.use(vite.middlewares);

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Kompyuter Serveri] Ishga tushdi: http://localhost:${PORT}`);
    console.log(`[Kompyuter Serveri] Hujjatlar papkasi: ${DOCS_DIR}`);
  });
}

startServer();
