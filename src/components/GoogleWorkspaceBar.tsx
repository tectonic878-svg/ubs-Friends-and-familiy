import React, { useState, useEffect } from 'react';
import { 
  initAuth, 
  googleSignIn, 
  signInWithGoogleIdentityServices,
  logout, 
  getAccessToken,
  getCurrentUser,
  getOrCreateDriveFolder,
  getOrCreateSpreadsheet,
  setManualAccessToken
} from '../services/googleWorkspace';
import { User } from 'firebase/auth';
import { 
  CheckCircle2, 
  ExternalLink, 
  Folder, 
  FileSpreadsheet, 
  LogOut, 
  Loader2, 
  Sparkles,
  AlertCircle,
  KeyRound,
  Copy,
  Info
} from 'lucide-react';

interface GoogleWorkspaceBarProps {
  onSyncAll?: () => Promise<void>;
  isAdmin?: boolean;
}

export const GoogleWorkspaceBar: React.FC<GoogleWorkspaceBarProps> = ({ onSyncAll, isAdmin = false }) => {
  const [user, setUser] = useState<User | null>(getCurrentUser());
  const [token, setToken] = useState<string | null>(() => {
    try {
      return localStorage.getItem('ubs_google_access_token') || null;
    } catch {
      return null;
    }
  });
  const [loading, setLoading] = useState(false);
  const [folderId, setFolderId] = useState<string | null>(() => {
    try { return localStorage.getItem('ubs_google_drive_folder_id'); } catch { return null; }
  });
  const [sheetId, setSheetId] = useState<string | null>(() => {
    try { return localStorage.getItem('ubs_google_spreadsheet_id'); } catch { return null; }
  });
  const [syncing, setSyncing] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [showManualInput, setShowManualInput] = useState(false);
  const [manualTokenInput, setManualTokenInput] = useState('');
  const [errorInfo, setErrorInfo] = useState<{ domain?: string; message: string } | null>(null);

  useEffect(() => {
    // Check initial token
    getAccessToken().then(tok => {
      if (tok) {
        setToken(tok);
        if (!user) {
          setUser({ email: 'Google Foydalanuvchisi', displayName: 'Google Drive & Sheets' } as any);
        }
      }
    });

    const unsubscribe = initAuth(
      (u, tok) => {
        if (tok) {
          setUser(u);
          setToken(tok);
        }
      },
      () => {
        // Only clear if localStorage has no token
        const saved = localStorage.getItem('ubs_google_access_token');
        if (!saved) {
          setUser(null);
          setToken(null);
        }
      }
    );

    return () => unsubscribe();
  }, []);

  const handleSignIn = async () => {
    setLoading(true);
    setMsg(null);
    setErrorInfo(null);
    try {
      const res = await googleSignIn();
      if (res && res.accessToken) {
        setUser(res.user || { email: 'Google Hisobi' } as any);
        setToken(res.accessToken);
        setMsg('Google Drive va Google Sheets muvaffaqiyatli ulandi!');

        try {
          const fid = await getOrCreateDriveFolder();
          setFolderId(fid);
          const sid = await getOrCreateSpreadsheet();
          setSheetId(sid);
        } catch (e) {
          console.warn('Workspace init notice:', e);
        }
      }
    } catch (err: any) {
      const isDomainError = err?.code === 'auth/unauthorized-domain' || (err.message && err.message.includes('Domen avtorizatsiyalanmagan'));
      if (isDomainError) {
        setErrorInfo({
          domain: err.domain || window.location.hostname,
          message: err.message
        });
      } else {
        setMsg(err.message || 'Google hisobiga ulanishda xatolik yuz berdi');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGisDirectSignIn = async () => {
    setLoading(true);
    setMsg(null);
    setErrorInfo(null);
    try {
      const res = await signInWithGoogleIdentityServices();
      if (res && res.accessToken) {
        setToken(res.accessToken);
        setUser({ email: 'Google Foydalanuvchisi', displayName: 'Google Drive & Sheets' } as any);
        setMsg('Google Identity Services orqali ulandi!');

        try {
          const fid = await getOrCreateDriveFolder();
          setFolderId(fid);
          const sid = await getOrCreateSpreadsheet();
          setSheetId(sid);
        } catch (e) {
          console.warn('Workspace init error:', e);
        }
      }
    } catch (err: any) {
      setMsg(err.message || 'GSI orqali kirishda xatolik');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveManualToken = async (e: React.FormEvent) => {
    e.preventDefault();
    let cleanToken = manualTokenInput.trim();
    if (!cleanToken) return;

    if (cleanToken.toLowerCase().startsWith('bearer ')) {
      cleanToken = cleanToken.slice(7).trim();
    }
    if ((cleanToken.startsWith('"') && cleanToken.endsWith('"')) || (cleanToken.startsWith("'") && cleanToken.endsWith("'"))) {
      cleanToken = cleanToken.slice(1, -1).trim();
    }

    setManualAccessToken(cleanToken);
    setToken(cleanToken);
    setUser({ email: 'Token orqali ulandi (Faol)', displayName: 'Google Drive & Sheets' } as any);
    setShowManualInput(false);
    setErrorInfo(null);
    setManualTokenInput('');
    setMsg('Google Access Token doimiy saqlandi va faol holatga keltirildi!');

    try {
      const fid = await getOrCreateDriveFolder();
      if (fid) setFolderId(fid);
      const sid = await getOrCreateSpreadsheet();
      if (sid) setSheetId(sid);
    } catch (e: any) {
      console.warn('Workspace init notice:', e);
    }
  };

  const handleSignOut = async () => {
    await logout();
    setUser(null);
    setToken(null);
    setFolderId(null);
    setSheetId(null);
    setMsg('Google hisobidan chiqildi');
  };

  const handleManualSync = async () => {
    if (!onSyncAll) return;
    setSyncing(true);
    setMsg(null);
    setErrorInfo(null);
    try {
      await onSyncAll();
      setMsg('Barcha arizalar Google Sheets va Drive ga sinxronizatsiya qilindi!');
    } catch (e: any) {
      const errMsg = e.message || String(e);
      if (errMsg.includes('401') || errMsg.includes('muddati tugagan') || errMsg.includes('UNAUTHENTICATED') || errMsg.includes('Invalid Credentials')) {
        setToken(null);
        setShowManualInput(true);
        setMsg('⚠️ Google Token muddati tugagan (1 soatlik limit). Iltimos, «Google bilan ulash» yoki yangi tokenni kiritib qayta ulaning.');
      } else {
        setMsg(errMsg);
      }
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="bg-gradient-to-r from-blue-900/90 via-slate-900 to-indigo-950 text-white rounded-2xl p-4 border border-blue-500/30 shadow-lg mb-6">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        {/* Left Info */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-500/20 border border-blue-400/30 flex items-center justify-center shrink-0">
            <svg className="w-6 h-6" viewBox="0 0 87.3 78" xmlns="http://www.w3.org/2000/svg">
              <path d="m6.6 66.85 3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3l13.75-23.8h-27.5c0 1.55.4 3.1 1.2 4.5z" fill="#0066da"/>
              <path d="m43.65 25-13.75-23.8c-1.35.8-2.5 1.9-3.3 3.3l-25.4 44c-.8 1.4-1.2 2.95-1.2 4.5h27.5z" fill="#00ac47"/>
              <path d="m73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.4 1.2-2.95 1.2-4.5h-27.502l5.852 11.5z" fill="#ea4335"/>
              <path d="m43.65 25 13.75-23.8c-1.35-.8-2.9-1.2-4.5-1.2h-18.5c-1.6 0-3.15.45-4.5 1.2z" fill="#00832d"/>
              <path d="m59.8 53h-32.3l-13.75 23.8c1.35.8 2.9 1.2 4.5 1.2h50.8c1.6 0 3.15-.45 4.5-1.2z" fill="#2684fc"/>
              <path d="m73.4 26.5-12.7-22c-.8-1.4-1.95-2.5-3.3-3.3l-13.75 23.8 16.15 28h27.45c0-1.55-.4-3.1-1.2-4.5z" fill="#ffba00"/>
            </svg>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                Google Drive & Google Sheets Bulut Xotirasi
              </h3>
              {token ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Ulandi (Faol)
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-500/20 text-slate-300 border border-slate-500/30">
                  Ixtiyoriy Bulut Zaxirasi
                </span>
              )}
            </div>
            <p className="text-xs text-blue-200/80">
              PDF hujjatlar va jadvallarni shaxsiy Google Drive/Sheets hisobingizga avtomatik nusxalash.
            </p>
          </div>
        </div>

        {/* Right Actions */}
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto justify-end">
          {token ? (
            <>
              {folderId && (
                <a
                  href={`https://drive.google.com/drive/folders/${folderId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 bg-blue-600/80 hover:bg-blue-600 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition border border-blue-400/30"
                  title="Google Drive'dagi UBS_Arizalar_2026 jildini ochish"
                >
                  <Folder className="w-3.5 h-3.5 text-amber-300" />
                  <span>Drive Jildini Ochish</span>
                  <ExternalLink className="w-3 h-3 opacity-70" />
                </a>
              )}

              {sheetId && (
                <a
                  href={`https://docs.google.com/spreadsheets/d/${sheetId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 bg-emerald-700/80 hover:bg-emerald-600 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition border border-emerald-400/30"
                  title="Google Sheets'dagi arizalar jadvalini ochish"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-200" />
                  <span>Sheets Jadvalini Ochish</span>
                  <ExternalLink className="w-3 h-3 opacity-70" />
                </a>
              )}

              {isAdmin && onSyncAll && (
                <button
                  type="button"
                  onClick={handleManualSync}
                  disabled={syncing}
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition disabled:opacity-50 cursor-pointer"
                  title="Barcha mavjud arizalarni Sheets va Drive ga ko'chirish"
                >
                  {syncing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5 text-amber-300" />}
                  <span>Drive'ga Sinxronlash</span>
                </button>
              )}

              <button
                type="button"
                onClick={handleSignOut}
                className="px-2.5 py-1.5 bg-slate-800 hover:bg-rose-900/40 text-slate-300 hover:text-white rounded-xl border border-slate-700 transition cursor-pointer flex items-center gap-1 text-xs"
                title="Google hisobidan chiqish / Tokenni o'chirish"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Chiqish</span>
              </button>
            </>
          ) : (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleSignIn}
                disabled={loading}
                className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-900 rounded-xl text-xs font-bold flex items-center gap-2 shadow-md transition disabled:opacity-50 cursor-pointer"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                ) : (
                  <svg className="w-4 h-4" viewBox="0 0 48 48">
                    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
                  </svg>
                )}
                <span>Google bilan ulash</span>
              </button>

              <button
                type="button"
                onClick={() => setShowManualInput(!showManualInput)}
                className="px-3 py-2 bg-blue-600/80 hover:bg-blue-600 text-white rounded-xl text-xs font-semibold border border-blue-400/40 transition cursor-pointer flex items-center gap-1.5 shadow"
                title="Google Access Token kiritish"
              >
                <KeyRound className="w-3.5 h-3.5 text-amber-300" />
                <span>Token kiritish</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {showManualInput && !token && (
        <form onSubmit={handleSaveManualToken} className="mt-3 pt-3 border-t border-blue-500/20 flex flex-col md:flex-row gap-2 items-center">
          <div className="flex-1 w-full relative">
            <KeyRound className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Google OAuth Access Token (ya29... yoki Bearer ya29...)"
              value={manualTokenInput}
              onChange={(e) => setManualTokenInput(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-black/50 border border-slate-600 rounded-lg text-white font-mono placeholder:text-slate-500 focus:outline-hidden focus:border-blue-400"
            />
          </div>
          <button
            type="submit"
            className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold whitespace-nowrap cursor-pointer shadow"
          >
            Tokenni saqlash
          </button>
          <button
            type="button"
            onClick={handleGisDirectSignIn}
            className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold whitespace-nowrap cursor-pointer flex items-center gap-1"
          >
            <Sparkles className="w-3 h-3 text-amber-300" />
            <span>GSI orqali</span>
          </button>
        </form>
      )}

      {msg && (
        <div className="mt-2.5 pt-2.5 border-t border-blue-500/20 text-xs text-blue-200 flex items-center gap-1.5">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          <span>{msg}</span>
        </div>
      )}

      {errorInfo && (
        <div className="mt-2.5 pt-2.5 border-t border-amber-500/30 text-xs text-amber-200 bg-amber-950/40 p-3.5 rounded-xl border border-amber-500/20 flex flex-col gap-2.5">
          <div className="flex items-start gap-2 text-amber-300 font-semibold">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-amber-400" />
            <span>Google Authentication: Nima uchun xato berdi?</span>
          </div>
          <p className="text-[11px] text-amber-100/90 leading-relaxed">
            Google va Firebase yangi qo‘shilgan domenni xavfsizlik tekshiruvidan o‘tkazishi va serverlar bo‘ylab yangilanishi uchun odatda <strong>5–10 daqiqa</strong> vaqt oladi.
          </p>
          <div className="bg-blue-950/60 p-2.5 rounded-lg border border-blue-500/30 flex items-start gap-2">
            <Info className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
            <div className="text-[11px] text-blue-100 leading-relaxed">
              <strong>Eslatma:</strong> Google Drive ulanishi faqat ixtiyoriy zaxira hisoblanadi. Tizimdagi barcha talaba arizalari, PDF hujjatlar, 10% chegirmalar va admin paneli <strong>Google hisobisiz ham 100% to‘liq ishlaydi!</strong>
            </div>
          </div>
          <div className="flex items-center gap-2 bg-black/40 px-2.5 py-1.5 rounded-lg border border-amber-500/30 font-mono text-[11px] text-amber-300 select-all">
            <span className="truncate">{errorInfo.domain || window.location.hostname}</span>
            <button
              type="button"
              onClick={() => {
                navigator.clipboard.writeText(errorInfo.domain || window.location.hostname);
                setMsg('Domen nusxalandi!');
              }}
              className="ml-auto text-[10px] bg-amber-500/30 hover:bg-amber-500/50 text-white px-2 py-0.5 rounded cursor-pointer font-sans shrink-0 flex items-center gap-1"
            >
              <Copy className="w-3 h-3" />
              Nusxalash
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
