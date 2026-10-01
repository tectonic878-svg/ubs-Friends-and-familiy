import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { AuthScreen } from './components/AuthScreen';
import { FriendsApplicationForm } from './components/FriendsApplicationForm';
import { FamilyApplicationForm } from './components/FamilyApplicationForm';
import { AdminPortal } from './components/AdminPortal';
import { StatusChecker } from './components/StatusChecker';
import { DocumentLightbox } from './components/DocumentLightbox';
import { INITIAL_APPLICATIONS, DEFAULT_CONTRACT_SETTINGS } from './data/mockData';
import { 
  AnyApplication, 
  ApplicationStatus, 
  AuthSession, 
  DocumentFile, 
  RegisteredUser,
  ContractSettings,
  AdminCredentials 
} from './types';
import { 
  subscribeApplicationsSupabase, 
  saveApplicationToSupabase, 
  updateApplicationStatusInSupabase,
  subscribeContractSettingsSupabase,
  saveContractSettingsToSupabase,
  subscribeAdminCredentialsSupabase,
  saveAdminCredentialsToSupabase,
  testSupabaseConnection
} from './services/supabase';
import { CheckCircle2, CloudCheck, WifiOff } from 'lucide-react';
import { UBSLogo } from './components/UBSLogo';

const INITIAL_SAVED_USERS: RegisteredUser[] = [];

export default function App() {
  // Session authentication state (Must log in first)
  const [session, setSession] = useState<AuthSession | null>(() => {
    try {
      const saved = localStorage.getItem('unigrant_auth_session');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  // Saved registered users
  const [savedUsers, setSavedUsers] = useState<RegisteredUser[]>(() => {
    try {
      const saved = localStorage.getItem('unigrant_saved_users');
      return saved ? JSON.parse(saved) : INITIAL_SAVED_USERS;
    } catch {
      return INITIAL_SAVED_USERS;
    }
  });

  // Active student tab
  const [activeTab, setActiveTab] = useState<'friends' | 'family' | 'status'>('friends');

  // Applications list: initialized with cached data, then synced live via Firebase Firestore
  const [applications, setApplications] = useState<AnyApplication[]>(() => {
    try {
      const saved = localStorage.getItem('unigrant_applications');
      return saved ? JSON.parse(saved) : INITIAL_APPLICATIONS;
    } catch {
      return INITIAL_APPLICATIONS;
    }
  });

  // University contract pricing settings managed by Admin
  const [contractSettings, setContractSettings] = useState<ContractSettings>(() => {
    try {
      const saved = localStorage.getItem('unigrant_contract_settings');
      return saved ? JSON.parse(saved) : DEFAULT_CONTRACT_SETTINGS;
    } catch {
      return DEFAULT_CONTRACT_SETTINGS;
    }
  });

  // Admin credentials state synced with Firestore (admin1..admin7 + central admin password)
  const [adminCredentials, setAdminCredentials] = useState<AdminCredentials>(() => {
    try {
      const saved = localStorage.getItem('unigrant_admin_credentials');
      return saved ? JSON.parse(saved) : { username: 'admin', password: 'admin123' };
    } catch {
      return { username: 'admin', password: 'admin123' };
    }
  });

  // Cloud sync status indicator
  const [isCloudConnected, setIsCloudConnected] = useState<boolean>(true);
  const [isQuotaExceeded, setIsQuotaExceeded] = useState<boolean>(false);
  const [isReconnecting, setIsReconnecting] = useState<boolean>(false);
  const [syncKey, setSyncKey] = useState<number>(0);

  // Lightbox & feedback state
  const [lightboxDoc, setLightboxDoc] = useState<DocumentFile | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Manual reconnect handler
  const handleReconnectCloud = async () => {
    setIsReconnecting(true);
    showToast('Supabase bulutli bazasiga ulanish tekshirilmoqda...');
    try {
      const ok = await testSupabaseConnection();
      if (ok) {
        setIsCloudConnected(true);
        setIsQuotaExceeded(false);
        setSyncKey((prev) => prev + 1);
        showToast('✅ Supabase bulutli bazasi bilan aloqa faol va cheksiz!');
      } else {
        setIsCloudConnected(false);
        showToast('⚠️ Supabase bazasiga ulanib bo‘lmadi. Internet aloqasini tekshiring.');
      }
    } catch {
      setIsCloudConnected(false);
      showToast('⚠️ Aloqa tekshiruvida xatolik yuz berdi.');
    } finally {
      setIsReconnecting(false);
    }
  };

  // 1. REAL-TIME CLOUD SYNCHRONIZATION WITH SUPABASE POSTGRESQL
  // Connects all 7 admins and students without free daily request quota limits!
  useEffect(() => {
    const handleSyncError = (err: Error) => {
      console.warn('Supabase sinxronizatsiya ogohlantirish:', err.message);
      setIsCloudConnected(false);
    };

    // Subscribe to all applications from Supabase
    const unsubscribeApps = subscribeApplicationsSupabase(
      (cloudApps) => {
        setIsCloudConnected(true);
        setIsQuotaExceeded(false);
        // If Supabase is brand new and has 0 apps, but local storage had apps, seed local apps to Supabase
        if (cloudApps.length === 0) {
          const cached = localStorage.getItem('unigrant_applications');
          if (cached) {
            try {
              const parsed: AnyApplication[] = JSON.parse(cached);
              if (parsed.length > 0) {
                parsed.forEach((appItem) => {
                  saveApplicationToSupabase(appItem).catch(() => {});
                });
                setApplications(parsed);
                return;
              }
            } catch {
              // ignore
            }
          }
        }
        setApplications(cloudApps);
      },
      handleSyncError
    );

    // Subscribe to contract pricing settings
    const unsubscribeSettings = subscribeContractSettingsSupabase(
      (cloudSettings) => {
        if (cloudSettings) {
          setContractSettings(cloudSettings);
        } else {
          // Initialize Supabase database with current contract settings
          saveContractSettingsToSupabase(contractSettings).catch(() => {});
        }
      },
      handleSyncError
    );

    // Subscribe to admin credentials from Supabase
    const unsubscribeAdminCreds = subscribeAdminCredentialsSupabase(
      (cloudCreds) => {
        if (cloudCreds) {
          setAdminCredentials(cloudCreds);
        } else {
          // Initialize Supabase database with default admin credentials
          saveAdminCredentialsToSupabase(adminCredentials).catch(() => {});
        }
      },
      handleSyncError
    );

    // Online / Offline browser event listeners
    const handleOnline = () => {
      testSupabaseConnection().then((connected) => {
        if (connected) {
          setIsCloudConnected(true);
          setIsQuotaExceeded(false);
          setSyncKey((prev) => prev + 1);
        }
      });
    };

    const handleOffline = () => {
      setIsCloudConnected(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      unsubscribeApps();
      unsubscribeSettings();
      unsubscribeAdminCreds();
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [syncKey]);

  // Persistent local cache mirrors for applications, settings, and credentials
  // This guarantees zero data loss even when Firestore free tier daily quota is reached
  useEffect(() => {
    try {
      localStorage.setItem('unigrant_applications', JSON.stringify(applications));
    } catch (e) {
      console.warn('Lokal kesh saqlash:', e);
    }
  }, [applications]);

  useEffect(() => {
    try {
      localStorage.setItem('unigrant_contract_settings', JSON.stringify(contractSettings));
    } catch (e) {
      console.warn('Lokal kesh saqlash:', e);
    }
  }, [contractSettings]);

  useEffect(() => {
    try {
      localStorage.setItem('unigrant_admin_credentials', JSON.stringify(adminCredentials));
    } catch (e) {
      console.warn('Lokal kesh saqlash:', e);
    }
  }, [adminCredentials]);

  // Sync session & users to localStorage
  useEffect(() => {
    try {
      if (session) {
        localStorage.setItem('unigrant_auth_session', JSON.stringify(session));
      } else {
        localStorage.removeItem('unigrant_auth_session');
      }
    } catch (e) {
      console.error('Session saqlash xatosi:', e);
    }
  }, [session]);

  useEffect(() => {
    try {
      localStorage.setItem('unigrant_saved_users', JSON.stringify(savedUsers));
    } catch (e) {
      console.error('Users saqlash xatosi:', e);
    }
  }, [savedUsers]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  const handleLoginSuccess = (newSession: AuthSession) => {
    setSession(newSession);
    if (newSession.role === 'admin') {
      showToast(`Xush kelibsiz, ${newSession.fullName}! Barcha admin uchun markaziy bulutli baza faol.`);
    } else {
      setActiveTab('friends');
      showToast(`Xush kelibsiz, ${newSession.fullName}!`);
    }
  };

  const handleRegisterUser = (newUser: RegisteredUser) => {
    setSavedUsers((prev) => [newUser, ...prev]);
  };

  const handleLogout = () => {
    setSession(null);
    showToast('Tizimdan chiqildi.');
  };

  // Submit application by student (persisted directly into Supabase PostgreSQL)
  const handleSubmitApplication = async (app: AnyApplication) => {
    // Optimistic local update
    setApplications((prev) => [app, ...prev.filter((item) => item.id !== app.id)]);
    showToast(`✅ ${app.id} raqamli ariza markaziy bulut bazasiga yuborildi!`);
    setActiveTab('status');

    // Supabase cloud save
    try {
      await saveApplicationToSupabase(app);
      console.log('Ariza Supabase bulutiga muvaffaqiyatli saqlandi:', app.id);
    } catch (error) {
      console.error('Supabase saqlashda xatolik:', error);
      showToast('⚠️ Ariza mahalliy saqlandi, tarmoq ulanganda bulutga sinxronlanadi.');
    }
  };

  // Status update by admin (persisted directly into Supabase PostgreSQL)
  const handleUpdateStatus = async (id: string, status: ApplicationStatus, notes?: string) => {
    // Optimistic local update
    setApplications((prev) =>
      prev.map((app) => (app.id === id ? { ...app, status, adminNotes: notes } : app))
    );
    showToast(status === 'tasdiqlandi' ? '✅ 10% chegirma arizasi tasdiqlandi!' : '⚠️ Ariza holati yangilandi.');

    // Supabase cloud update
    try {
      await updateApplicationStatusInSupabase(id, status, notes);
      console.log('Ariza holati Supabase bulutida yangilandi:', id, status);
    } catch (error) {
      console.error('Supabase holat yangilashda xatolik:', error);
    }
  };

  // Contract settings update by admin
  const handleUpdateContractSettings = async (newSettings: ContractSettings) => {
    setContractSettings(newSettings);
    try {
      await saveContractSettingsToSupabase(newSettings);
      showToast('Shartnoma narxlari barcha 7 ta admin va talabalar uchun Supabase bazasida yangilandi.');
    } catch (error) {
      console.error('Shartnoma narxlarini Supabase bulutiga saqlash xatosi:', error);
    }
  };

  // Admin credentials update by admin from AdminPortal
  const handleUpdateAdminCredentials = async (newCreds: AdminCredentials) => {
    setAdminCredentials(newCreds);
    try {
      await saveAdminCredentialsToSupabase(newCreds);
      showToast('✅ Admin logini va paroli Supabase bulut bazasida barcha 7 ta admin uchun yangilandi!');
    } catch (error) {
      console.error('Admin parolini Supabase bulutiga saqlashda xatolik:', error);
      showToast('⚠️ Parol lokal saqlandi, ammo bulutga yozishda xatolik yuz berdi.');
    }
  };

  // If user is not authenticated, show ONLY the login/registration screen
  if (!session) {
    return (
      <AuthScreen
        onLoginSuccess={handleLoginSuccess}
        savedUsers={savedUsers}
        onRegisterUser={handleRegisterUser}
        adminCredentials={adminCredentials}
      />
    );
  }

  // Derive current student profile from session
  const currentUser: RegisteredUser = {
    fullName: session.fullName,
    jshshr: session.jshshr || '',
    login: session.username,
    registeredAt: session.loginAt,
  };

  return (
    <div className="min-h-screen bg-slate-100/70 text-slate-800 flex flex-col font-sans selection:bg-blue-600 selection:text-white">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-20 right-5 z-50 bg-slate-900 text-white px-4 py-3 rounded-2xl shadow-2xl border border-slate-700 text-xs font-semibold flex items-center gap-2.5 animate-bounce">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Main Header (Role-specific: Admin vs Student) */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        session={session}
        onLogout={handleLogout}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* ================= ADMIN VIEW ================= */}
        {session.role === 'admin' ? (
          <AdminPortal
            applications={applications}
            onUpdateStatus={handleUpdateStatus}
            onPreviewDoc={(doc) => setLightboxDoc(doc)}
            onLogout={handleLogout}
            contractSettings={contractSettings}
            onUpdateContractSettings={handleUpdateContractSettings}
            isCloudConnected={isCloudConnected}
            isQuotaExceeded={isQuotaExceeded}
            isReconnecting={isReconnecting}
            onReconnectCloud={handleReconnectCloud}
            adminCredentials={adminCredentials}
            onUpdateAdminCredentials={handleUpdateAdminCredentials}
            onResetApplicationsList={() => setApplications([])}
          />
        ) : (
          /* ================= STUDENT VIEW ================= */
          <div>
            {activeTab === 'friends' && (
              <FriendsApplicationForm
                currentUser={currentUser}
                onPreviewDoc={(doc) => setLightboxDoc(doc)}
                onSubmitApplication={handleSubmitApplication}
                onRequireAuth={() => {}}
                contractSettings={contractSettings}
              />
            )}

            {activeTab === 'family' && (
              <FamilyApplicationForm
                currentUser={currentUser}
                onPreviewDoc={(doc) => setLightboxDoc(doc)}
                onSubmitApplication={handleSubmitApplication}
                onRequireAuth={() => {}}
                contractSettings={contractSettings}
              />
            )}

            {activeTab === 'status' && (
              <StatusChecker
                applications={applications}
                onPreviewDoc={(doc) => setLightboxDoc(doc)}
                defaultJshshr={session.jshshr}
              />
            )}
          </div>
        )}
      </main>

      {/* Document Lightbox Modal */}
      <DocumentLightbox
        document={lightboxDoc}
        onClose={() => setLightboxDoc(null)}
      />

      {/* Clean, Minimalist Production Footer */}
      <footer className="bg-white border-t border-slate-200 py-6 text-xs text-slate-500 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <UBSLogo size="xs" showText={true} textColor="dark" subtext="Friends & Family 10% chegirmalar tizimi" />
          </div>
          <div className="flex items-center gap-4 text-[11px] text-slate-400">
            <span className="flex items-center gap-1 text-emerald-600 font-medium">
            UBS bilan ilmga yo'l och
            </span>
            <span>•</span>
            <span> </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
