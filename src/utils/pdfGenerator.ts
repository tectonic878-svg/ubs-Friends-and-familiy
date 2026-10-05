/**
 * Authentic University PDF Document Generator
 * Generates 100% standard compliant %PDF-1.4 binary documents
 * Universally readable by Google Chrome, Adobe Acrobat, Foxit, macOS Preview, iOS, and Android.
 */

export interface PdfStudentDocOptions {
  title: string;
  subTitle?: string;
  docType?: 'passport' | 'certificate' | 'family' | 'contract';
  studentName?: string;
  jshshr?: string;
  phone?: string;
  faculty?: string;
  course?: string;
  documentNumber?: string;
  date?: string;
}

/**
 * Escapes text for PDF literal string format ( )
 */
function escapePdfText(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)')
    .replace(/[‘'’`]/g, "'")
    .replace(/[“”"]/g, '"');
}

/**
 * Generates a valid %PDF-1.4 binary Uint8Array
 */
export function createAuthenticPdfBytes(options: PdfStudentDocOptions): Uint8Array {
  const {
    title,
    subTitle = 'University of Business and Sciences - Rasmiy Tasdiqlangan Hujjat',
    docType = 'passport',
    studentName = 'Talaba',
    jshshr = '31405021234567',
    phone = '+998 90 123 45 67',
    faculty = 'Ijtimoiy fanlar va raqamli texnologiyalar',
    course = '1-kurs',
    documentNumber = 'UBS-DOC-' + Math.floor(100000 + Math.random() * 900000),
    date = new Date().toLocaleDateString('uz-UZ')
  } = options;

  // Stream content for PDF (A4 dimensions: 595 x 842 pt)
  const streamLines: string[] = [
    // Background frame
    'q',
    '0.95 0.96 0.98 rg', // light background
    '20 20 555 802 re f',
    '0.1 0.25 0.55 RG', // Dark blue border
    '3 w',
    '20 20 555 802 re S',
    '0.8 0.85 0.9 RG', // Inner dashed border
    '1 w',
    '[4 2] 0 d',
    '28 28 539 786 re S',
    '[] 0 d', // reset dash

    // Header banner
    '0.1 0.25 0.55 rg',
    '30 740 535 70 re f',
    '1 1 1 rg', // White text
    'BT',
    '/F2 18 Tf',
    '50 780 Td',
    `(${escapePdfText("UNIVERSITY OF BUSINESS AND SCIENCES")}) Tj`,
    '/F1 11 Tf',
    '0 -20 Td',
    `(${escapePdfText("O'ZBEKISTON RESPUBLIKASI OLIY TA'LIM PORTALI")}) Tj`,
    'ET',

    // Document Title
    '0.1 0.25 0.55 rg',
    'BT',
    '/F2 16 Tf',
    '50 700 Td',
    `(${escapePdfText(title.toUpperCase())}) Tj`,
    '/F1 10 Tf',
    '0 -16 Td',
    `0.4 0.45 0.55 rg (${escapePdfText(subTitle)}) Tj`,
    'ET',

    // Horizontal divider
    '0.8 0.85 0.9 RG',
    '1 w',
    '50 660 m 545 660 l S',

    // Main Information Table Box
    '1 1 1 rg', // White box
    '0.8 0.85 0.9 RG',
    '50 420 495 220 re B',

    // Table Header
    '0.9 0.93 0.98 rg',
    '50 610 495 30 re f',
    '0.1 0.25 0.55 rg',
    'BT',
    '/F2 12 Tf',
    '65 622 Td',
    `(${escapePdfText("HUJJAT MA'LUMOTLARI VA IDENTIFIKATSIYASI")}) Tj`,
    'ET',

    // Field Rows
    '0.2 0.2 0.2 rg',
    'BT',
    '/F2 10 Tf',
    '65 585 Td (Talaba to\'liq ismi:) Tj',
    '/F1 10 Tf',
    '160 0 Td',
    `(${escapePdfText(studentName)}) Tj`,
    '-160 -26 Td',

    '/F2 10 Tf',
    '(JSHSHR (PINFL):) Tj',
    '/F1 10 Tf',
    '160 0 Td',
    `(${escapePdfText(jshshr)}) Tj`,
    '-160 -26 Td',

    '/F2 10 Tf',
    '(Telefon raqami:) Tj',
    '/F1 10 Tf',
    '160 0 Td',
    `(${escapePdfText(phone)}) Tj`,
    '-160 -26 Td',

    '/F2 10 Tf',
    '(Fakultet:) Tj',
    '/F1 10 Tf',
    '160 0 Td',
    `(${escapePdfText(faculty)}) Tj`,
    '-160 -26 Td',

    '/F2 10 Tf',
    '(Kurs / Dastur:) Tj',
    '/F1 10 Tf',
    '160 0 Td',
    `(${escapePdfText(course + " - Friends & Family Chegirma Tizimi")}) Tj`,
    '-160 -26 Td',

    '/F2 10 Tf',
    '(Hujjat turi:) Tj',
    '/F1 10 Tf',
    '160 0 Td',
    `(${escapePdfText(docType.toUpperCase() + " HUJJATI - ASL NUSXA")}) Tj`,
    'ET',

    // Verification Badge
    '0.95 0.98 0.95 rg', // light green box
    '0.2 0.6 0.3 RG',
    '50 330 495 70 re B',
    '0.1 0.5 0.2 rg',
    'BT',
    '/F2 12 Tf',
    '70 375 Td',
    `(${escapePdfText("[OK] ELEKTRON RAQAMLI TASDIQLANGAN")}) Tj`,
    '/F1 9 Tf',
    '0 -16 Td',
    `(${escapePdfText("Ushbu PDF hujjat UBS 'Friends & Family' chegirma tizimiga qonuniy ravishda biriktirilgan.")}) Tj`,
    '0 -14 Td',
    `(${escapePdfText("Hujjat raqami: " + documentNumber + " | Berilgan sana: " + date)}) Tj`,
    'ET',

    // Stamp circle (Red seal)
    '0.8 0.1 0.1 RG',
    '2 w',
    '470 200 45 0 360 arc S',
    '0.8 0.1 0.1 rg',
    'BT',
    '/F2 8 Tf',
    '440 205 Td',
    `(${escapePdfText("UBS TASDIQLANDI")}) Tj`,
    '/F1 7 Tf',
    '444 193 Td',
    `(${escapePdfText(date)}) Tj`,
    'ET',

    // Footer Bar
    '0.1 0.25 0.55 rg',
    '30 30 535 30 re f',
    '1 1 1 rg',
    'BT',
    '/F1 8 Tf',
    '45 42 Td',
    `(${escapePdfText("University of Business and Sciences | info@ubs.uz | +998 (71) 200-00-00")}) Tj`,
    '360 0 Td',
    `(${escapePdfText("Sahifa 1 / 1")}) Tj`,
    'ET',

    'Q'
  ];

  const streamContent = streamLines.join('\n');
  const streamLength = streamContent.length;

  // Assemble PDF Objects
  const objects: string[] = [];
  objects.push('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');
  objects.push('2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n');
  objects.push(
    '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>\nendobj\n'
  );
  objects.push('4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n');
  objects.push('5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>\nendobj\n');
  objects.push(`6 0 obj\n<< /Length ${streamLength} >>\nstream\n${streamContent}\nendstream\nendobj\n`);

  let pdfText = '%PDF-1.4\n';
  const xrefOffsets: number[] = [0];

  for (const obj of objects) {
    xrefOffsets.push(pdfText.length);
    pdfText += obj;
  }

  const startxref = pdfText.length;
  pdfText += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i <= objects.length; i++) {
    const offset = xrefOffsets[i];
    pdfText += String(offset).padStart(10, '0') + ' 00000 n \n';
  }
  pdfText += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${startxref}\n%%EOF\n`;

  // Convert to binary Uint8Array
  const uint8 = new Uint8Array(pdfText.length);
  for (let i = 0; i < pdfText.length; i++) {
    uint8[i] = pdfText.charCodeAt(i) & 0xff;
  }
  return uint8;
}

/**
 * Returns a valid PDF binary Data URL (data:application/pdf;base64,...)
 */
export function createAuthenticPdfDataUrl(options: PdfStudentDocOptions): string {
  const bytes = createAuthenticPdfBytes(options);
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  const base64 = btoa(binary);
  return `data:application/pdf;base64,${base64}`;
}

/**
 * Creates a valid PDF Blob
 */
export function createAuthenticPdfBlob(options: PdfStudentDocOptions): Blob {
  const bytes = createAuthenticPdfBytes(options);
  return new Blob([bytes], { type: 'application/pdf' });
}
