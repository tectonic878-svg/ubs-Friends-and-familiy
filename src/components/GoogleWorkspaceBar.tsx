import React, { useState, useEffect } from 'react';
import { 
  initAuth, 
  googleSignIn, 
  logout, 
  getAccessToken,
  getCurrentUser,
  getOrCreateDriveFolder,
  getOrCreateSpreadsheet
} from '../services/googleWorkspace';
import { User } from 'firebase/auth';
import { 
  CheckCircle2, 
  ExternalLink, 
  Folder, 
  FileSpreadsheet, 
  LogOut, 
  ShieldCheck, 
  Loader2, 
  Sparkles,
  AlertCircle
} from 'lucide-react';

interface GoogleWorkspaceBarProps {
  onSyncAll?: () => Promise<void>;
  isAdmin?: boolean;
}

export const GoogleWorkspaceBar: React.FC<GoogleWorkspaceBarProps> = ({ onSyncAll, isAdmin = false }) => {
  const [user, setUser] = useState<User | null>(getCurrentUser());
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [folderId, setFolderId] = useState<string | null>(() => localStorage.getItem('ubs_google_drive_folder_id'));
  const [sheetId, setSheetId] = useState<string | null>(() => localStorage.getItem('ubs_google_spreadsheet_id'));
  const [syncing, setSyncing] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    getAccessToken().then(tok => {
      setToken(tok);
      if (tok && !user) {
        setUser(getCurrentUser());
      }
    });

    const unsubscribe = initAuth(
      (u, tok) => {
        setUser(u);
        setToken(tok);
      },
      () => {
        setUser(null);
        setToken(null);
      }
    );

    return () => unsubscribe();
  }, []);

  const handleSignIn = async () => {
    setLoading(true);
    setMsg(null);
    try {
      const res = await googleSignIn();
      if (res) {
        setUser(res.user);
        setToken(res.accessToken);
        setMsg('Google Drive va Google Sheets muvaffaqiyatli ulandi!');

        // Preload folder & sheet
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
      console.error('Google login error:', err);
      setMsg(err.message || 'Google hisobiga ulanishda xatolik yuz berdi');
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    await logout();
    setUser(null);
    setToken(null);
    setMsg('Google hisobidan chiqildi');
  };

  const handleManualSync = async () => {
    if (!onSyncAll) return;
    setSyncing(true);
    try {
      await onSyncAll();
      setMsg('Barcha arizalar Google Sheets va Drive ga sinxronizatsiya qilindi!');
    } catch (e: any) {
      setMsg(e.message || 'Sinxronizatsiya xatosi');
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
                Google Drive & Google Sheets Xotirasi
              </h3>
              {token ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  <CheckCircle2 className="w-3 h-3 text-emerald-400" /> Faol
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  Ulanmagan
                </span>
              )}
            </div>
            <p className="text-xs text-blue-200/80">
              PDF hujjatlar to‘g‘ridan-to‘g‘ri shaxsiy Google Drive'ga, ma'lumotlar Google Sheets'ga joylanadi (Database'ga ortiqcha og‘irlik tushmaydi).
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
                className="p-1.5 bg-slate-800 hover:bg-rose-900/40 text-slate-300 hover:text-white rounded-xl border border-slate-700 transition cursor-pointer"
                title="Google hisobidan chiqish"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </>
          ) : (
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
              <span>Google bilan ulash (Drive & Sheets)</span>
            </button>
          )}
        </div>
      </div>

      {msg && (
        <div className="mt-2.5 pt-2.5 border-t border-blue-500/20 text-xs text-blue-200 flex items-center gap-1.5">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          <span>{msg}</span>
        </div>
      )}
    </div>
  );
};
