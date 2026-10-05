import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  onAuthStateChanged, 
  User, 
  signOut 
} from 'firebase/auth';
import { auth } from './firebase';
import firebaseConfig from '../../firebase-applet-config.json';
import { AnyApplication, ApplicationStatus, DocumentFile } from '../types';

export const WORKSPACE_SCOPES = [
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/spreadsheets'
];

const provider = new GoogleAuthProvider();
WORKSPACE_SCOPES.forEach(scope => provider.addScope(scope));
// Force prompt to ensure refresh/consent if needed
provider.setCustomParameters({
  prompt: 'consent',
  access_type: 'offline'
});

let isSigningIn = false;
const ACCESS_TOKEN_KEY = 'ubs_google_access_token';
const DRIVE_FOLDER_ID_KEY = 'ubs_google_drive_folder_id';
const SPREADSHEET_ID_KEY = 'ubs_google_spreadsheet_id';

let cachedAccessToken: string | null = (() => {
  try {
    const saved = localStorage.getItem(ACCESS_TOKEN_KEY);
    return saved && saved.trim() ? saved.trim() : null;
  } catch {
    return null;
  }
})();
let currentUser: User | null = null;

type AuthCallback = (user: User | any, token: string) => void;
type FailureCallback = () => void;
const authListeners: { onSuccess?: AuthCallback; onFailure?: FailureCallback }[] = [];

function notifyListeners() {
  const currentToken = getStoredToken();
  if (currentToken) {
    const userObj = currentUser || { email: 'Google Hisobi', displayName: 'Google Drive & Sheets' };
    authListeners.forEach(l => l.onSuccess?.(userObj, currentToken));
  } else {
    authListeners.forEach(l => l.onFailure?.());
  }
}

function getStoredToken(): string | null {
  if (cachedAccessToken && cachedAccessToken.trim()) {
    return cachedAccessToken.trim();
  }
  try {
    const item = localStorage.getItem(ACCESS_TOKEN_KEY);
    if (item && item.trim()) {
      cachedAccessToken = item.trim();
      return cachedAccessToken;
    }
  } catch {}
  return null;
}

export const initAuth = (
  onAuthSuccess?: AuthCallback,
  onAuthFailure?: FailureCallback
) => {
  const listener = { onSuccess: onAuthSuccess, onFailure: onAuthFailure };
  authListeners.push(listener);

  // If token already present in localStorage/memory, trigger success immediately
  const existingToken = getStoredToken();
  if (existingToken && onAuthSuccess) {
    onAuthSuccess(currentUser || { email: 'Google Foydalanuvchisi', displayName: 'Google Drive & Sheets' } as any, existingToken);
  }

  const unsubscribe = onAuthStateChanged(auth, async (user: User | null) => {
    currentUser = user;
    const token = getStoredToken();
    if (user) {
      if (token) {
        onAuthSuccess?.(user, token);
      }
    } else if (token) {
      // Manual/GIS token is actively preserved in localStorage! Do NOT wipe it!
      onAuthSuccess?.({ email: 'Google Foydalanuvchisi', displayName: 'Google Drive & Sheets' } as any, token);
    } else {
      onAuthFailure?.();
    }
  });

  return () => {
    const idx = authListeners.indexOf(listener);
    if (idx !== -1) authListeners.splice(idx, 1);
    unsubscribe();
  };
};

export const setManualAccessToken = (token: string) => {
  let clean = (token || '').trim();
  // Strip "Bearer " prefix if user pasted it
  if (clean.toLowerCase().startsWith('bearer ')) {
    clean = clean.slice(7).trim();
  }
  // Strip surrounding quotes
  if ((clean.startsWith('"') && clean.endsWith('"')) || (clean.startsWith("'") && clean.endsWith("'"))) {
    clean = clean.slice(1, -1).trim();
  }

  cachedAccessToken = clean || null;
  try {
    if (clean) {
      localStorage.setItem(ACCESS_TOKEN_KEY, clean);
    } else {
      localStorage.removeItem(ACCESS_TOKEN_KEY);
    }
  } catch {}

  notifyListeners();
};

/**
 * Direct Google Identity Services (GIS) Token Client fallback
 */
export const signInWithGoogleIdentityServices = (): Promise<{ accessToken: string } | null> => {
  return new Promise((resolve, reject) => {
    try {
      const google = (window as any).google;
      const clientId = (firebaseConfig as any).oAuthClientId;
      if (!google?.accounts?.oauth2 || !clientId) {
        throw new Error('Google Identity Services kutubxonasi yuklanmoqda...');
      }

      const client = google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: WORKSPACE_SCOPES.join(' '),
        callback: (tokenResponse: any) => {
          if (tokenResponse.error) {
            const errStr = String(tokenResponse.error_description || tokenResponse.error);
            if (errStr.includes('popup_blocked') || errStr.includes('popup') || errStr.includes('window')) {
              reject(new Error('Brauzer qalqib chiquvchi oynani (popup) blokladi. Iltimos, brauzeringizda popup oynalarga ruxsat bering.'));
            } else {
              reject(new Error(tokenResponse.error_description || tokenResponse.error));
            }
            return;
          }
          if (tokenResponse.access_token) {
            setManualAccessToken(tokenResponse.access_token);
            resolve({ accessToken: tokenResponse.access_token });
          } else {
            reject(new Error('Kirish tokeni olinmadi'));
          }
        },
        error_callback: (err: any) => {
          reject(err);
        }
      });

      client.requestAccessToken({ prompt: 'consent' });
    } catch (e) {
      reject(e);
    }
  });
};

export const googleSignIn = async (): Promise<{ user?: User | any; accessToken: string } | null> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Google hisobidan kirish tokeni olinmadi');
    }

    setManualAccessToken(credential.accessToken);
    currentUser = result.user;
    return { user: result.user, accessToken: credential.accessToken };
  } catch (error: any) {
    const code = error?.code || '';
    const message = error?.message || '';
    if (code === 'auth/unauthorized-domain' || message.includes('auth/unauthorized-domain')) {
      const hostname = typeof window !== 'undefined' ? window.location.hostname : 'ushbu domen';
      const cleanError = new Error(
        `Domen avtorizatsiyalanmagan: '${hostname}'. Firebase Console -> Authentication -> Settings -> Authorized Domains ro'yxatiga '${hostname}' domenini qo'shing.`
      );
      (cleanError as any).code = 'auth/unauthorized-domain';
      (cleanError as any).domain = hostname;
      throw cleanError;
    }
    console.warn('Google Sign In:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const getAccessToken = async (): Promise<string | null> => {
  return getStoredToken();
};

export const getCurrentUser = (): User | null => {
  return currentUser || auth.currentUser;
};

export const isWorkspaceConnected = (): boolean => {
  return !!getStoredToken();
};

export const logout = async () => {
  try {
    await signOut(auth);
  } catch {}
  setManualAccessToken('');
  currentUser = null;
};

/**
 * Helper to perform Google API fetch with automatic 401 token expiration handling
 */
export async function fetchWithGoogleAuth(url: string, init: RequestInit = {}): Promise<Response> {
  let token = await getAccessToken();
  if (!token) {
    throw new Error('Google hisobi ulanmagan. Iltimos, «Google bilan ulash» yoki «Token kiritish» orqali ulaning.');
  }

  const makeHeaders = (tok: string) => {
    const h = new Headers(init.headers || {});
    h.set('Authorization', `Bearer ${tok}`);
    return h;
  };

  let res = await fetch(url, { ...init, headers: makeHeaders(token) });

  if (res.status === 401) {
    console.warn('Google Access Token muddati tugagan (401). Yangilashga harakat qilinmoqda...');

    // Try silent auto-refresh via Google Identity Services if client is available
    try {
      const refreshed = await signInWithGoogleIdentityServices();
      if (refreshed?.accessToken) {
        token = refreshed.accessToken;
        res = await fetch(url, { ...init, headers: makeHeaders(token) });
        if (res.ok) return res;
      }
    } catch {
      // GIS auto prompt failed or popup was blocked
    }

    if (res.status === 401) {
      // Clear expired token so app asks for a fresh one cleanly
      setManualAccessToken('');
      throw new Error(
        'Google hisobi tokenining amal qilish muddati tugagan (Google Access Token 1 soat amal qiladi). Iltimos, yuqoridagi ko‘k paneldagi «Google bilan ulash» yoki yangi «Token kiritish» tugmasi orqali qayta ulaning.'
      );
    }
  }

  return res;
}

/**
 * 1. GOOGLE DRIVE: Find or Create Root Folder "UBS_Arizalar_2026"
 */
export async function getOrCreateDriveFolder(folderName: string = 'UBS_Arizalar_2026'): Promise<string> {
  const cachedFolderId = localStorage.getItem(DRIVE_FOLDER_ID_KEY);

  // Verify cached folder still exists
  if (cachedFolderId) {
    try {
      const checkRes = await fetchWithGoogleAuth(`https://www.googleapis.com/drive/v3/files/${cachedFolderId}?fields=id,name,trashed`);
      if (checkRes.ok) {
        const folderData = await checkRes.json();
        if (!folderData.trashed) {
          return cachedFolderId;
        }
      }
    } catch {
      // ignore
    }
  }

  // Search existing folder by name
  try {
    const q = encodeURIComponent(`mimeType='application/vnd.google-apps.folder' and name='${folderName}' and trashed=false`);
    const searchRes = await fetchWithGoogleAuth(`https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name)`);
    if (searchRes.ok) {
      const searchData = await searchRes.json();
      if (searchData.files && searchData.files.length > 0) {
        const folderId = searchData.files[0].id;
        localStorage.setItem(DRIVE_FOLDER_ID_KEY, folderId);
        return folderId;
      }
    }
  } catch (err) {
    console.warn('Drive folder search failed:', err);
  }

  // Create folder
  const createRes = await fetchWithGoogleAuth('https://www.googleapis.com/drive/v3/files', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      name: folderName,
      mimeType: 'application/vnd.google-apps.folder'
    })
  });

  if (!createRes.ok) {
    const errText = await createRes.text();
    throw new Error(`Google Drive jildi yaratishda xatolik: ${errText}`);
  }

  const createdFolder = await createRes.json();
  localStorage.setItem(DRIVE_FOLDER_ID_KEY, createdFolder.id);
  return createdFolder.id;
}

/**
 * Convert base64 data URL to Blob
 */
function dataUrlToBlob(dataUrl: string): Blob {
  const parts = dataUrl.split(',');
  const mime = parts[0].match(/:(.*?);/)?.[1] || 'application/pdf';
  const bstr = atob(parts[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  return new Blob([u8arr], { type: mime });
}

/**
 * 2. GOOGLE DRIVE: Upload PDF Document directly to Google Drive
 * Stores PDF in Drive, returns driveFileId and webViewLink
 */
export async function uploadPdfToDrive(
  fileName: string,
  pdfDataUrl: string,
  folderId?: string
): Promise<{ driveFileId: string; webViewLink: string; webContentLink?: string }> {
  const targetFolderId = folderId || await getOrCreateDriveFolder();
  const blob = dataUrlToBlob(pdfDataUrl);

  const metadata = {
    name: fileName.endsWith('.pdf') ? fileName : `${fileName}.pdf`,
    parents: [targetFolderId],
    mimeType: 'application/pdf'
  };

  const form = new FormData();
  form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
  form.append('file', blob);

  const res = await fetchWithGoogleAuth('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink,webContentLink', {
    method: 'POST',
    body: form
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Google Drive'ga PDF yuklashda xatolik: ${err}`);
  }

  const uploaded = await res.json();

  // Try to make file viewable with link
  try {
    await fetchWithGoogleAuth(`https://www.googleapis.com/drive/v3/files/${uploaded.id}/permissions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        role: 'reader',
        type: 'anyone'
      })
    });
  } catch (permErr) {
    console.warn('Drive permission share warning:', permErr);
  }

  return {
    driveFileId: uploaded.id,
    webViewLink: uploaded.webViewLink || `https://drive.google.com/file/d/${uploaded.id}/view?usp=drivesdk`,
    webContentLink: uploaded.webContentLink
  };
}

/**
 * 3. GOOGLE SHEETS: Find or Create Spreadsheet "UBS_Friends_Family_Arizalar_2026"
 */
export const SHEETS_HEADER = [
  'Ariza ID',
  'Dastur Turi',
  'Ariza Beruvchi (F.I.SH.)',
  'JSHSHR',
  'Passport Seria & Raqam',
  'Yo‘nalish / Fakultet',
  'Kurs',
  'Asosiy Telefon (1)',
  'Qo‘shimcha Telefon (2)',
  'A‘zolar / Do‘stlar Soni',
  'Barcha A‘zolar / Do‘stlar Tafsiloti',
  'Shartnoma Summasi (so‘m)',
  'Chegirma Miqdori (10% so‘m)',
  'To‘lanadigan Summa (so‘m)',
  'PDF Fayllar va Drive IDlari',
  'Google Drive PDF Havolalari',
  'Topshirilgan Sana',
  'Holati (Status)',
  'Admin Izohi'
];

export async function getOrCreateSpreadsheet(
  title: string = 'UBS_Friends_Family_Arizalar_2026'
): Promise<string> {
  const cachedId = localStorage.getItem(SPREADSHEET_ID_KEY);

  // Verify cached spreadsheet
  if (cachedId) {
    try {
      const checkRes = await fetchWithGoogleAuth(`https://sheets.googleapis.com/v4/spreadsheets/${cachedId}?fields=spreadsheetId,properties.title`);
      if (checkRes.ok) {
        return cachedId;
      }
    } catch {
      // continue
    }
  }

  // Search spreadsheet on Drive
  try {
    const q = encodeURIComponent(`mimeType='application/vnd.google-apps.spreadsheet' and name='${title}' and trashed=false`);
    const searchRes = await fetchWithGoogleAuth(`https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name)`);
    if (searchRes.ok) {
      const searchData = await searchRes.json();
      if (searchData.files && searchData.files.length > 0) {
        const sheetId = searchData.files[0].id;
        localStorage.setItem(SPREADSHEET_ID_KEY, sheetId);
        return sheetId;
      }
    }
  } catch (err) {
    console.warn('Sheets search error:', err);
  }

  // Create new Spreadsheet
  const folderId = await getOrCreateDriveFolder();
  const createRes = await fetchWithGoogleAuth('https://sheets.googleapis.com/v4/spreadsheets', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      properties: {
        title: title
      },
      sheets: [
        {
          properties: {
            title: 'Arizalar',
            gridProperties: {
              frozenRowCount: 1
            }
          }
        }
      ]
    })
  });

  if (!createRes.ok) {
    const errText = await createRes.text();
    throw new Error(`Google Sheets yaratishda xatolik: ${errText}`);
  }

  const created = await createRes.json();
  const newSheetId = created.spreadsheetId;
  localStorage.setItem(SPREADSHEET_ID_KEY, newSheetId);

  // Move spreadsheet file to folder
  try {
    await fetchWithGoogleAuth(`https://www.googleapis.com/drive/v3/files/${newSheetId}?addParents=${folderId}&fields=id,parents`, {
      method: 'PATCH'
    });
  } catch {
    // optional move
  }

  // Set Header Row styling and values
  try {
    await fetchWithGoogleAuth(`https://sheets.googleapis.com/v4/spreadsheets/${newSheetId}/values/Arizalar!A1:S1?valueInputOption=USER_ENTERED`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        values: [SHEETS_HEADER]
      })
    });
  } catch {}

  return newSheetId;
}

/**
 * Format application data into a row for Google Sheets
 */
function applicationToRow(app: AnyApplication): string[] {
  let mainName = '';
  let jshshr = '';
  let passport = '';
  let faculty = '';
  let course = '';
  let phone1 = '';
  let phone2 = '';
  let membersCount = 0;
  let membersDetails = '';
  let contractAmount = 0;
  let savedAmount = 0;
  let finalAmount = 0;
  const pdfIds: string[] = [];
  const pdfLinks: string[] = [];

  if (app.type === 'friends') {
    mainName = app.applicantStudent.fullName;
    jshshr = app.applicantStudent.jshshr;
    passport = `${app.applicantStudent.passportSeria || ''} ${app.applicantStudent.passportNumber || ''}`.trim();
    faculty = app.applicantStudent.faculty;
    course = app.applicantStudent.course;
    phone1 = app.applicantStudent.phone1 || app.applicantStudent.phone || '';
    phone2 = app.applicantStudent.phone2 || '';
    membersCount = (app.friendsList?.length || 1);

    // Collect all friends
    const friends = app.friendsList || [app.friendStudent];
    membersDetails = friends.map((f, i) => 
      `${i + 1}. ${f.fullName} (JSHSHR: ${f.jshshr}, Tel: ${f.phone1 || f.phone || ''}, Fak: ${f.faculty})`
    ).join(' | ');

    contractAmount = app.contractAmountUZS;
    savedAmount = app.savedAmountUZS;
    finalAmount = app.finalAmountUZS;

    // Documents
    if (app.applicantStudent.passportDoc?.driveFileId) {
      pdfIds.push(`Asosiy: ${app.applicantStudent.passportDoc.driveFileId}`);
      pdfLinks.push(app.applicantStudent.passportDoc.driveWebViewLink || `https://drive.google.com/file/d/${app.applicantStudent.passportDoc.driveFileId}/view`);
    }
    if (app.applicantStudent.certificateDoc?.driveFileId) {
      pdfIds.push(`Guvohnoma: ${app.applicantStudent.certificateDoc.driveFileId}`);
      pdfLinks.push(app.applicantStudent.certificateDoc.driveWebViewLink || `https://drive.google.com/file/d/${app.applicantStudent.certificateDoc.driveFileId}/view`);
    }
    friends.forEach((f, idx) => {
      if (f.passportDoc?.driveFileId) {
        pdfIds.push(`Do'st_${idx + 1}: ${f.passportDoc.driveFileId}`);
        pdfLinks.push(f.passportDoc.driveWebViewLink || `https://drive.google.com/file/d/${f.passportDoc.driveFileId}/view`);
      }
    });

  } else {
    // Family
    const primary = app.members.find(m => m.relationship.includes('O‘zi') || m.relationship.includes('Asosiy')) || app.members[0];
    mainName = primary?.fullName || 'Noma‘lum';
    jshshr = primary?.jshshr || '';
    passport = `${primary?.passportSeria || ''} ${primary?.passportNumber || ''}`.trim();
    faculty = primary?.faculty || '';
    course = primary?.course || '';
    phone1 = primary?.phone1 || primary?.phone || '';
    phone2 = primary?.phone2 || '';
    membersCount = app.membersCount || app.members.length;

    membersDetails = app.members.map((m, i) => 
      `${i + 1}. [${m.relationship}] ${m.fullName} (JSHSHR: ${m.jshshr}, Tel: ${m.phone1 || m.phone || ''}, Fak: ${m.faculty})`
    ).join(' | ');

    contractAmount = app.totalContractAmountUZS;
    savedAmount = app.totalSavedAmountUZS;
    finalAmount = app.totalFinalAmountUZS;

    app.members.forEach((m, idx) => {
      if (m.passportDoc?.driveFileId) {
        pdfIds.push(`A'zo_${idx + 1}_Passport: ${m.passportDoc.driveFileId}`);
        pdfLinks.push(m.passportDoc.driveWebViewLink || `https://drive.google.com/file/d/${m.passportDoc.driveFileId}/view`);
      }
      if (m.birthOrMarriageDoc?.driveFileId) {
        pdfIds.push(`A'zo_${idx + 1}_Qarindoshlik: ${m.birthOrMarriageDoc.driveFileId}`);
        pdfLinks.push(m.birthOrMarriageDoc.driveWebViewLink || `https://drive.google.com/file/d/${m.birthOrMarriageDoc.driveFileId}/view`);
      }
    });
  }

  return [
    app.id,
    app.type === 'friends' ? 'Friends (Do‘stlar 10%)' : 'Family (Oila 10%)',
    mainName,
    jshshr,
    passport,
    faculty,
    course,
    phone1,
    phone2,
    String(membersCount),
    membersDetails,
    String(contractAmount),
    String(savedAmount),
    String(finalAmount),
    pdfIds.join('; '),
    pdfLinks.join('\n'),
    app.createdAt,
    app.status,
    app.adminNotes || ''
  ];
}

/**
 * 4. GOOGLE SHEETS: Append new Application row
 */
export async function appendApplicationToGoogleSheets(appData: AnyApplication): Promise<void> {
  const spreadsheetId = await getOrCreateSpreadsheet();
  const rowValues = applicationToRow(appData);

  const res = await fetchWithGoogleAuth(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Arizalar!A:S:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        values: [rowValues]
      })
    }
  );

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Google Sheets'ga yozishda xatolik: ${errText}`);
  }
}

/**
 * 5. GOOGLE SHEETS: Update Application Status & Notes in Google Sheets
 */
export async function updateApplicationStatusInGoogleSheets(
  applicationId: string,
  newStatus: ApplicationStatus,
  adminNotes?: string
): Promise<boolean> {
  try {
    const spreadsheetId = await getOrCreateSpreadsheet();
    
    // Read all IDs from column A
    const res = await fetchWithGoogleAuth(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Arizalar!A:A`
    );
    if (!res.ok) return false;

    const data = await res.json();
    const rows: string[][] = data.values || [];
    let rowIndex = -1;

    for (let i = 0; i < rows.length; i++) {
      if (rows[i] && rows[i][0] === applicationId) {
        rowIndex = i + 1; // 1-indexed for Sheets API
        break;
      }
    }

    if (rowIndex === -1) return false;

    // Column R is Status (18th col), Column S is AdminNotes (19th col)
    const updateRes = await fetchWithGoogleAuth(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Arizalar!R${rowIndex}:S${rowIndex}?valueInputOption=USER_ENTERED`,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          values: [[newStatus, adminNotes || '']]
        })
      }
    );

    return updateRes.ok;
  } catch (err) {
    console.warn('Sheets update error:', err);
    return false;
  }
}

/**
 * 6. Helper to process all PDF documents in an application and upload them to Drive
 * Strips heavy base64 and keeps driveFileId + drive links
 */
export async function processAndUploadApplicationDocs(
  appData: AnyApplication,
  onProgress?: (statusMsg: string) => void
): Promise<AnyApplication> {
  const clonedApp: AnyApplication = JSON.parse(JSON.stringify(appData));
  const folderId = await getOrCreateDriveFolder();

  if (clonedApp.type === 'friends') {
    // 1. Applicant Student Docs
    if (clonedApp.applicantStudent.passportDoc?.url?.startsWith('data:')) {
      onProgress?.(`Google Drive'ga yuklanmoqda: ${clonedApp.applicantStudent.passportDoc.name}`);
      const uploaded = await uploadPdfToDrive(
        clonedApp.applicantStudent.passportDoc.name,
        clonedApp.applicantStudent.passportDoc.url,
        folderId
      );
      clonedApp.applicantStudent.passportDoc.driveFileId = uploaded.driveFileId;
      clonedApp.applicantStudent.passportDoc.driveWebViewLink = uploaded.webViewLink;
      clonedApp.applicantStudent.passportDoc.driveDownloadLink = uploaded.webContentLink;
      // Keep lightweight preview placeholder instead of huge base64
      clonedApp.applicantStudent.passportDoc.url = uploaded.webViewLink;
    }

    if (clonedApp.applicantStudent.certificateDoc?.url?.startsWith('data:')) {
      onProgress?.(`Google Drive'ga yuklanmoqda: ${clonedApp.applicantStudent.certificateDoc.name}`);
      const uploaded = await uploadPdfToDrive(
        clonedApp.applicantStudent.certificateDoc.name,
        clonedApp.applicantStudent.certificateDoc.url,
        folderId
      );
      clonedApp.applicantStudent.certificateDoc.driveFileId = uploaded.driveFileId;
      clonedApp.applicantStudent.certificateDoc.driveWebViewLink = uploaded.webViewLink;
      clonedApp.applicantStudent.certificateDoc.driveDownloadLink = uploaded.webContentLink;
      clonedApp.applicantStudent.certificateDoc.url = uploaded.webViewLink;
    }

    // 2. Friends Docs
    if (clonedApp.friendsList) {
      for (let i = 0; i < clonedApp.friendsList.length; i++) {
        const friend = clonedApp.friendsList[i];
        if (friend.passportDoc?.url?.startsWith('data:')) {
          onProgress?.(`Google Drive'ga yuklanmoqda (${i + 1}-do'st): ${friend.passportDoc.name}`);
          const uploaded = await uploadPdfToDrive(
            friend.passportDoc.name,
            friend.passportDoc.url,
            folderId
          );
          friend.passportDoc.driveFileId = uploaded.driveFileId;
          friend.passportDoc.driveWebViewLink = uploaded.webViewLink;
          friend.passportDoc.driveDownloadLink = uploaded.webContentLink;
          friend.passportDoc.url = uploaded.webViewLink;
        }
      }
    }
  } else {
    // Family Application Docs
    for (let i = 0; i < clonedApp.members.length; i++) {
      const member = clonedApp.members[i];
      if (member.passportDoc?.url?.startsWith('data:')) {
        onProgress?.(`Google Drive'ga yuklanmoqda (${member.relationship}): ${member.passportDoc.name}`);
        const uploaded = await uploadPdfToDrive(
          member.passportDoc.name,
          member.passportDoc.url,
          folderId
        );
        member.passportDoc.driveFileId = uploaded.driveFileId;
        member.passportDoc.driveWebViewLink = uploaded.webViewLink;
        member.passportDoc.driveDownloadLink = uploaded.webContentLink;
        member.passportDoc.url = uploaded.webViewLink;
      }
      if (member.birthOrMarriageDoc?.url?.startsWith('data:')) {
        onProgress?.(`Google Drive'ga yuklanmoqda (${member.relationship} guvohnoma): ${member.birthOrMarriageDoc.name}`);
        const uploaded = await uploadPdfToDrive(
          member.birthOrMarriageDoc.name,
          member.birthOrMarriageDoc.url,
          folderId
        );
        member.birthOrMarriageDoc.driveFileId = uploaded.driveFileId;
        member.birthOrMarriageDoc.driveWebViewLink = uploaded.webViewLink;
        member.birthOrMarriageDoc.driveDownloadLink = uploaded.webContentLink;
        member.birthOrMarriageDoc.url = uploaded.webViewLink;
      }
    }
  }

  return clonedApp;
}
