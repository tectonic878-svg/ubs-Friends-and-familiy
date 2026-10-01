import JSZip from 'jszip';
import { AnyApplication } from '../types';
import { cleanPhoneDigits } from './formatters';
import { resolveAuthenticBlob } from '../services/documentStorage';

interface ZipItem {
  folderName: string;
  fileName: string;
  url: string;
}

/**
 * Converts any URL (Data URI, Base64, Blob URL, or HTTP URL) into an ArrayBuffer or binary Uint8Array
 */
async function urlToUint8Array(url: string): Promise<Uint8Array> {
  if (url.startsWith('data:')) {
    const commaIndex = url.indexOf(',');
    if (commaIndex === -1) {
      throw new Error('Noto‘g‘ri ma’lumot URL formati');
    }
    const meta = url.slice(0, commaIndex);
    const rawData = url.slice(commaIndex + 1);

    if (meta.includes(';base64')) {
      const binaryString = atob(rawData);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      return bytes;
    } else {
      const decoded = decodeURIComponent(rawData);
      const encoder = new TextEncoder();
      return encoder.encode(decoded);
    }
  }

  // HTTP or Blob URL
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Faylni yuklab bo‘lmadi: ${response.statusText}`);
  }
  const arrayBuffer = await response.arrayBuffer();
  return new Uint8Array(arrayBuffer);
}

/**
 * Collects all PDF documents from all applications with strict naming rules:
 * 1-fayl: {jshshr}.pdf
 * 2-fayl: {telefon}.pdf
 */
export async function collectApplicationPdfs(applications: AnyApplication[]): Promise<ZipItem[]> {
  const items: ZipItem[] = [];

  for (const app of applications) {
    const cleanId = app.id.replace(/[^a-zA-Z0-9_-]/g, '_');
    const folderName = `${cleanId}_${app.type === 'friends' ? 'Friends' : 'Family'}`;

    if (app.type === 'friends') {
      const students = [
        app.applicantStudent,
        ...(app.friendsList && app.friendsList.length > 0 ? app.friendsList : [app.friendStudent])
      ];

      for (const s of students) {
        // 1-fayl: JSHSHR bilan
        if (s.passportDoc) {
          const res1 = await resolveAuthenticBlob(s.passportDoc, s.jshshr, [s.jshshr]);
          if (res1 && res1.url) {
            items.push({
              folderName,
              fileName: `${s.jshshr || 'pasport'}.pdf`,
              url: res1.url
            });
          }
        }

        // 2-fayl: Telefon raqami bilan
        if (s.certificateDoc) {
          const cleanPhone = cleanPhoneDigits(s.phone1 || s.phone || '');
          const res2 = await resolveAuthenticBlob(s.certificateDoc, cleanPhone, [cleanPhone, s.jshshr]);
          if (res2 && res2.url) {
            items.push({
              folderName,
              fileName: `${cleanPhone || s.jshshr + '_doc2'}.pdf`,
              url: res2.url
            });
          }
        }
      }
    } else if (app.type === 'family') {
      for (const m of app.members) {
        // 1-fayl: JSHSHR bilan
        if (m.passportDoc) {
          const res1 = await resolveAuthenticBlob(m.passportDoc, m.jshshr, [m.jshshr]);
          if (res1 && res1.url) {
            items.push({
              folderName,
              fileName: `${m.jshshr || 'pasport'}.pdf`,
              url: res1.url
            });
          }
        }

        // 2-fayl: Telefon raqami bilan
        if (m.birthOrMarriageDoc) {
          const cleanPhone = cleanPhoneDigits(m.phone1 || m.phone || '');
          const res2 = await resolveAuthenticBlob(m.birthOrMarriageDoc, cleanPhone, [cleanPhone, m.jshshr]);
          if (res2 && res2.url) {
            items.push({
              folderName,
              fileName: `${cleanPhone || m.jshshr + '_doc2'}.pdf`,
              url: res2.url
            });
          }
        }
      }
    }
  }

  return items;
}

/**
 * Builds and downloads a single ZIP archive containing all PDF files across applications.
 * Organized by Application folders, strictly named 1-file: {jshshr}.pdf, 2-file: {phone}.pdf
 */
export async function downloadAllApplicationsAsZip(
  applications: AnyApplication[],
  onProgress?: (progressText: string, percent: number) => void
): Promise<void> {
  const zip = new JSZip();
  const pdfItems = await collectApplicationPdfs(applications);

  if (pdfItems.length === 0) {
    throw new Error('Yuklab olish uchun birorta ham PDF fayl topilmadi.');
  }

  // Create a root summary manifest file
  let manifestText = `O‘ZBEKISTON RESPUBLIKASI OLIY TA’LIM UNIVERSITETI\n`;
  manifestText += `FRIENDS & FAMILY DASTURI BO‘YICHA TOPSHIRILGAN BARCHA ARIZALAR PDF FAYLLARI ARXIVI\n`;
  manifestText += `Yaratilgan vaqt: ${new Date().toLocaleString('uz-UZ')}\n`;
  manifestText += `Jami arizalar soni: ${applications.length} ta\n`;
  manifestText += `Jami PDF hujjatlar soni: ${pdfItems.length} ta\n`;
  manifestText += `--------------------------------------------------------\n\n`;

  applications.forEach((app, idx) => {
    manifestText += `${idx + 1}. Ariza ID: ${app.id} (${app.type.toUpperCase()})\n`;
    manifestText += `   Holati: ${app.status}\n`;
    manifestText += `   Topshirilgan sana: ${new Date(app.createdAt).toLocaleString('uz-UZ')}\n`;

    if (app.type === 'friends') {
      const students = [
        app.applicantStudent,
        ...(app.friendsList && app.friendsList.length > 0 ? app.friendsList : [app.friendStudent])
      ];
      students.forEach((s, sIdx) => {
        const cleanPhone = cleanPhoneDigits(s.phone1 || s.phone || '');
        manifestText += `   - Talaba #${sIdx + 1}: ${s.fullName}\n`;
        manifestText += `     JSHSHR: ${s.jshshr} | 1-Fayl: ${s.jshshr}.pdf\n`;
        manifestText += `     1-Telefon: ${s.phone1 || s.phone || ''} | 2-Telefon: ${s.phone2 || ''} | 2-Fayl: ${cleanPhone}.pdf\n`;
        manifestText += `     Fakultet: ${s.faculty} | Kurs: ${s.course}\n`;
      });
    } else {
      app.members.forEach((m, mIdx) => {
        const cleanPhone = cleanPhoneDigits(m.phone1 || m.phone || '');
        manifestText += `   - A’zo #${mIdx + 1} (${m.relationship}): ${m.fullName}\n`;
        manifestText += `     JSHSHR: ${m.jshshr} | 1-Fayl: ${m.jshshr}.pdf\n`;
        manifestText += `     1-Telefon: ${m.phone1 || m.phone || ''} | 2-Telefon: ${m.phone2 || ''} | 2-Fayl: ${cleanPhone}.pdf\n`;
        manifestText += `     Fakultet: ${m.faculty} | Kurs: ${m.course}\n`;
      });
    }
    manifestText += `\n`;
  });

  zip.file('Barcha_Arizalar_Royxati.txt', manifestText);

  // Fetch and append all PDF files
  const total = pdfItems.length;
  for (let i = 0; i < total; i++) {
    const item = pdfItems[i];
    if (onProgress) {
      const currentPercent = Math.round(((i + 1) / total) * 70);
      onProgress(`Fayllar tayyorlanmoqda (${i + 1} / ${total}): ${item.fileName}...`, currentPercent);
    }

    try {
      const binaryData = await urlToUint8Array(item.url);
      const appFolder = zip.folder(item.folderName);
      if (appFolder) {
        appFolder.file(item.fileName, binaryData);
      } else {
        zip.file(item.fileName, binaryData);
      }
    } catch (err) {
      console.warn(`Faylni zipga qo'shishda xatolik (${item.fileName}):`, err);
    }
  }

  // Generate zip file with compression
  if (onProgress) {
    onProgress('ZIP arxiv siqilmoqda va shakllantirilmoqda...', 85);
  }

  const zipBlob = await zip.generateAsync(
    {
      type: 'blob',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 }
    },
    (metadata) => {
      if (onProgress) {
        const p = 85 + Math.round(metadata.percent * 0.15);
        onProgress(`ZIP arxiv shakllantirilmoqda: ${Math.round(metadata.percent)}%`, p);
      }
    }
  );

  // Download trigger
  const link = document.createElement('a');
  const dateStr = new Date().toISOString().slice(0, 10);
  const zipFileName = `Barcha_Arizalar_PDF_Arxivi_${dateStr}.zip`;
  link.href = URL.createObjectURL(zipBlob);
  link.download = zipFileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);

  if (onProgress) {
    onProgress('Muvaffaqiyatli yuklab olindi!', 100);
  }
}
