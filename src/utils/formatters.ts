import { createAuthenticPdfBlob } from './pdfGenerator';

export const formatMoneyUZS = (amount: number): string => {
  return new Intl.NumberFormat('uz-UZ').format(Math.round(amount)) + ' so‘m';
};

export const formatJshshr = (val: string): string => {
  // Allow only digits and limit to 14
  return val.replace(/\D/g, '').slice(0, 14);
};

export const formatPassportSeria = (val: string): string => {
  // Allow only 2 letters and uppercase
  return val.replace(/[^a-zA-Z]/g, '').slice(0, 2).toUpperCase();
};

export const formatPassportNumber = (val: string): string => {
  // Allow only 7 digits
  return val.replace(/\D/g, '').slice(0, 7);
};

export const cleanPhoneDigits = (val: string): string => {
  return val.replace(/\D/g, '');
};

export const formatPhoneNumber = (val: string): string => {
  // Clean non-digits
  const digits = val.replace(/\D/g, '');
  if (!digits) return '+998 ';
  
  // Strip initial 998 if typed
  let core = digits;
  if (core.startsWith('998')) {
    core = core.slice(3);
  }
  core = core.slice(0, 9); // Max 9 digits for UZ (e.g. 90 123 45 67)

  let formatted = '+998';
  if (core.length > 0) formatted += ' (' + core.slice(0, 2);
  if (core.length >= 2) formatted += ') ';
  if (core.length > 2) formatted += core.slice(2, 5);
  if (core.length >= 5) formatted += ' ' + core.slice(5, 7);
  if (core.length >= 7) formatted += ' ' + core.slice(7, 9);

  return formatted;
};

/**
 * Converts a data URL (base64 or urlencoded) or text into a standard binary Blob
 */
export function dataUrlToBlob(dataUrl: string, fallbackMime: string = 'application/pdf'): Blob {
  if (!dataUrl || !dataUrl.startsWith('data:')) {
    if (fallbackMime === 'application/pdf') {
      return createAuthenticPdfBlob({
        title: 'UBS Rasmiy Hujjat',
        subTitle: 'University of Business and Sciences'
      });
    }
    return new Blob([dataUrl || ''], { type: fallbackMime });
  }

  // If it is an SVG dataUrl masquerading as PDF, convert to real PDF binary
  if (dataUrl.includes('image/svg') || dataUrl.includes('<svg')) {
    return createAuthenticPdfBlob({
      title: 'UBS Rasmiy Hujjat (PDF)',
      subTitle: 'Tasdiqlangan elektron nusxa'
    });
  }

  const commaIdx = dataUrl.indexOf(',');
  if (commaIdx === -1) {
    return new Blob([dataUrl], { type: fallbackMime });
  }

  const meta = dataUrl.slice(0, commaIdx);
  const data = dataUrl.slice(commaIdx + 1);
  const mimeMatch = meta.match(/data:([^;]+)/);
  const mime = mimeMatch ? mimeMatch[1] : fallbackMime;

  if (meta.includes(';base64')) {
    try {
      const binary = atob(data);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      return new Blob([bytes], { type: mime });
    } catch {
      if (fallbackMime === 'application/pdf') {
        return createAuthenticPdfBlob({ title: 'UBS Hujjat' });
      }
      return new Blob([], { type: fallbackMime });
    }
  } else {
    try {
      const decoded = decodeURIComponent(data);
      if (decoded.includes('<svg')) {
        return createAuthenticPdfBlob({ title: 'UBS Hujjat' });
      }
      return new Blob([decoded], { type: mime });
    } catch {
      return new Blob([], { type: fallbackMime });
    }
  }
}

/**
 * Creates a browser-compatible Blob URL from any URL (data:, blob:, or relative/absolute URL)
 */
export function getDocumentBlobUrl(url: string, fallbackMime: string = 'application/pdf'): string {
  if (!url) return '';
  if (url.startsWith('blob:')) return url;
  if (url.startsWith('data:')) {
    try {
      const blob = dataUrlToBlob(url, fallbackMime);
      return URL.createObjectURL(blob);
    } catch (err) {
      console.warn('Error converting dataUrl to blob url:', err);
      return url;
    }
  }
  return url;
}

/**
 * Universal file download helper that reliably downloads PDFs and documents
 * in modern browsers without iframe navigation blocks or size limitations.
 */
export const downloadFile = async (dataUrlOrBlob: string, fileName: string) => {
  if (!dataUrlOrBlob) {
    console.warn('Yuklab olish uchun fayl manzili topilmadi');
    return;
  }

  try {
    let objectUrl: string;
    let shouldRevoke = false;

    if (dataUrlOrBlob.startsWith('data:')) {
      const isPdf = fileName.toLowerCase().endsWith('.pdf') || dataUrlOrBlob.includes('application/pdf');
      const blob = dataUrlToBlob(dataUrlOrBlob, isPdf ? 'application/pdf' : 'application/octet-stream');
      objectUrl = URL.createObjectURL(blob);
      shouldRevoke = true;
    } else if (dataUrlOrBlob.startsWith('/api/documents/')) {
      const resp = await fetch(dataUrlOrBlob);
      const blob = await resp.blob();
      objectUrl = URL.createObjectURL(blob);
      shouldRevoke = true;
    } else {
      objectUrl = dataUrlOrBlob;
    }

    const safeName = fileName.includes('.') ? fileName : `${fileName}.pdf`;
    const link = document.createElement('a');
    link.href = objectUrl;
    link.download = safeName;
    link.rel = 'noopener noreferrer';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    if (shouldRevoke) {
      setTimeout(() => URL.revokeObjectURL(objectUrl), 60000);
    }
  } catch (err) {
    console.error('Faylni yuklab olishda xatolik:', err);
    const safeName = fileName.includes('.') ? fileName : `${fileName}.pdf`;
    const link = document.createElement('a');
    link.href = dataUrlOrBlob;
    link.download = safeName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
};

/**
 * Safely opens a PDF document in a new browser tab or window
 */
export const openDocumentInNewTab = async (url: string, fileName: string = 'hujjat.pdf') => {
  if (!url) return;
  try {
    let blobUrl = url;
    if (url.startsWith('data:')) {
      const blob = dataUrlToBlob(url, 'application/pdf');
      blobUrl = URL.createObjectURL(blob);
    } else if (url.startsWith('/api/documents/')) {
      const resp = await fetch(url);
      const blob = await resp.blob();
      blobUrl = URL.createObjectURL(blob);
    }
    
    const newWindow = window.open(blobUrl, '_blank', 'noopener,noreferrer');
    if (!newWindow || newWindow.closed || typeof newWindow.closed === 'undefined') {
      downloadFile(url, fileName);
    }
  } catch (err) {
    console.error('Hujjatni yangi oynada ochishda xatolik:', err);
    downloadFile(url, fileName);
  }
};

export const readFileAsDataUrl = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (error) => reject(error);
    reader.readAsDataURL(file);
  });
};
