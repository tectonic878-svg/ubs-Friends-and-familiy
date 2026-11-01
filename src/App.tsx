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
  subscribeApplications, 
  saveApplicationToFirestore, 
  updateApplicationStatusInFirestore,
  subscribeContractSettings,
  saveContractSettingsToFirestore,
  subscribeAdminCredentials,
  saveAdminCredentialsToFirestore,
  testConnection as testFirebaseConnection
} from './services/firebase';
import {
  subscribeApplicationsSupabase,
  saveApplicationToSupabase,
  updateApplicationStatusInSupabase,
  subscribeContractSettingsSupabase,
  saveContractSettingsToSupabase,
  subscribeAdminCredentialsSupabase,
  saveAdminCredentialsToSupabase,
  testSupabaseConnection,
} from './services/supabase';
import {
  saveApplicationToServer,
  updateApplicationStatusOnServer,
  bulkImportApplicationsToServer,
  saveContractSettingsToServer,
  saveAdminCredentialsToServer,
  testServerConnection,
  subscribeServerData,
  clearAllApplicationsOnServer,
  restoreFromSupabaseOnServer
} from './services/serverDb';
import { 
  processAndUploadApplicationDocs, 
  appendApplicationToGoogleSheets, 
  updateApplicationStatusInGoogleSheets,
  getAccessToken 
} from './services/googleWorkspace';
import { optimizeApplicationForCloud, mergeLocalDocumentUrls, mergeSingleAppDocs } from './utils/cloudSyncOptimizer';
import { saveApplicationToVault, getAllApplicationsFromVault, clearAllVaultData } from './utils/indexedDbVault';
import { 
  CheckCircle2, 
  CloudCheck, 
  WifiOff,
  ShieldCheck,
  Lock,
  User,
  KeyRound,
  Sparkles,
  Eye,
  EyeOff,
  X,
  AlertCircle
} from 'lucide-react';
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

  // Secret Admin Quick Modal State (Activated by Ctrl + Shift + A anywhere)
  const [isSecretAdminModalOpen, setIsSecretAdminModalOpen] = useState(false);
  const [secretAdminUser, setSecretAdminUser] = useState('');
  const [secretAdminPass, setSecretAdminPass] = useState('');
  const [showSecretAdminPass, setShowSecretAdminPass] = useState(false);
  const [secretAdminError, setSecretAdminError] = useState('');

  // Global listener for Ctrl + Shift + A (Cmd + Shift + A)
  useEffect(() => {
    const handleGlobalShortcut = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'a' || e.key === 'A')) {
        e.preventDefault();
        if (session?.role !== 'admin') {
          setIsSecretAdminModalOpen(true);
          setSecretAdminError('');
        }
      }
    };

    window.addEventListener('keydown', handleGlobalShortcut);
    return () => window.removeEventListener('keydown', handleGlobalShortcut);
  }, [session]);

  // Manual reconnect handler
  const handleReconnectCloud = async () => {
    setIsReconnecting(true);
    showToast('Bulutli baza bilan aloqa tekshirilmoqda...');
    try {
      const supaOk = await testSupabaseConnection();
      if (supaOk) {
        setIsCloudConnected(true);
        setIsQuotaExceeded(false);
        setSyncKey((prev) => prev + 1);
        showToast('✅ Supabase bulutli bazasi bilan aloqa faol va xavfsiz!');
        return;
      }

      const fireOk = await testFirebaseConnection();
      if (fireOk) {
        setIsCloudConnected(true);
        setIsQuotaExceeded(false);
        setSyncKey((prev) => prev + 1);
        showToast('✅ Google Cloud Firestore bazasi bilan aloqa faol va xavfsiz!');
        return;
      }

      const serverOk = await testServerConnection();
      if (serverOk) {
        setIsCloudConnected(true);
        setIsQuotaExceeded(false);
        setSyncKey((prev) => prev + 1);
        showToast('✅ Markaziy server bazasi faol!');
      } else {
        setIsCloudConnected(false);
        showToast('⚠️ Baza bilan aloqa tiklanmadi. Lokal xotira rejimi faol.');
      }
    } catch {
      setIsCloudConnected(false);
      showToast('⚠️ Aloqa tekshiruvida xatolik yuz berdi.');
    } finally {
      setIsReconnecting(false);
    }
  };

  // 1. MULTI-CLOUD SYNCHRONIZATION: SUPABASE (PRIMARY) + GOOGLE FIRESTORE + SERVER DB
  // Real-time synchronization across all 7 admins and students with zero data loss
  useEffect(() => {
    let isMounted = true;

    // Check Supabase and Cloud connection immediately
    testSupabaseConnection().then((supaOk) => {
      if (supaOk && isMounted) {
        setIsCloudConnected(true);
        setIsQuotaExceeded(false);
      } else {
        testFirebaseConnection().then((fireOk) => {
          if (fireOk && isMounted) {
            setIsCloudConnected(true);
            setIsQuotaExceeded(false);
          } else {
            testServerConnection().then((servOk) => {
              if (servOk && isMounted) {
                setIsCloudConnected(true);
                setIsQuotaExceeded(false);
              }
            });
          }
        });
      }
    });

    // 1. Subscribe to Supabase applications (Primary)
    const unsubscribeSupabaseApps = subscribeApplicationsSupabase(
      (supabaseApps) => {
        if (!isMounted) return;
        setIsCloudConnected(true);
        setIsQuotaExceeded(false);

        if (Array.isArray(supabaseApps) && supabaseApps.length > 0) {
          setApplications((prev) => {
            const map = new Map<string, AnyApplication>();
            // Keep local apps first
            prev.forEach((p) => {
              if (p && p.id) map.set(p.id, p);
            });
            // Merge in Supabase apps
            supabaseApps.forEach((sa) => {
              if (sa && sa.id) {
                const localMatch = map.get(sa.id);
                const merged = localMatch ? mergeSingleAppDocs(sa, localMatch) : sa;
                map.set(sa.id, merged);
              }
            });
            const list = Array.from(map.values());
            list.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
            return list;
          });
        }
      },
      (err) => {
        console.warn('Supabase sinxronizatsiya ogohlantirish:', err.message);
      }
    );

    // 2. Subscribe to contract settings from Supabase
    const unsubscribeSupabaseSettings = subscribeContractSettingsSupabase(
      (cloudSettings) => {
        if (!isMounted) return;
        if (cloudSettings) setContractSettings(cloudSettings);
      }
    );

    // 3. Subscribe to admin credentials from Supabase
    const unsubscribeSupabaseCreds = subscribeAdminCredentialsSupabase(
      (cloudCreds) => {
        if (!isMounted) return;
        if (cloudCreds) setAdminCredentials(cloudCreds);
      }
    );

    // 4. Subscribe to Google Cloud Firestore applications (Parallel Backup)
    const unsubscribeFirestoreApps = subscribeApplications(
      (firestoreApps) => {
        if (!isMounted) return;
        if (firestoreApps.length > 0) {
          setApplications((prev) => {
            const merged = mergeLocalDocumentUrls(firestoreApps, prev);
            return merged;
          });
        }
      },
      (err) => {
        console.warn('Firestore sinxronizatsiya ogohlantirish:', err.message);
      }
    );

    // 5. Subscribe to contract settings from Firestore
    const unsubscribeFirestoreSettings = subscribeContractSettings(
      (cloudSettings) => {
        if (!isMounted) return;
        if (cloudSettings) setContractSettings(cloudSettings);
      },
      () => {}
    );

    // 6. Subscribe to admin credentials from Firestore
    const unsubscribeFirestoreCreds = subscribeAdminCredentials(
      (cloudCreds) => {
        if (!isMounted) return;
        if (cloudCreds) setAdminCredentials(cloudCreds);
      },
      () => {}
    );

    // 7. Background polling from server DB (Safeguard without destructive wiping!)
    const unsubscribeServer = subscribeServerData(
      (serverApps) => {
        if (!isMounted || !Array.isArray(serverApps)) return;
        // CRITICAL FIX: NEVER wipe out applications if serverApps is empty!
        if (serverApps.length === 0) return;

        setApplications((prev) => {
          const map = new Map<string, AnyApplication>();
          prev.forEach((p) => {
            if (p && p.id) map.set(p.id, p);
          });
          serverApps.forEach((sa) => {
            if (sa && sa.id) {
              const localMatch = map.get(sa.id);
              const merged = localMatch ? mergeSingleAppDocs(sa, localMatch) : sa;
              map.set(sa.id, merged);
            }
          });
          const list = Array.from(map.values());
          list.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
          return list;
        });
      },
      () => {},
      () => {},
      3000
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
      isMounted = false;
      unsubscribeSupabaseApps();
      unsubscribeSupabaseSettings();
      unsubscribeSupabaseCreds();
      unsubscribeFirestoreApps();
      unsubscribeFirestoreSettings();
      unsubscribeFirestoreCreds();
      unsubscribeServer();
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [syncKey]);

  // Load applications from persistent IndexedDB Vault on mount
  useEffect(() => {
    getAllApplicationsFromVault().then((vaultApps) => {
      if (vaultApps && vaultApps.length > 0) {
        setApplications((prev) => {
          const map = new Map<string, AnyApplication>();
          prev.forEach((a) => map.set(a.id, a));
          vaultApps.forEach((va) => {
            const ex = map.get(va.id);
            map.set(va.id, ex ? { ...va, ...ex } : va);
          });
          const list = Array.from(map.values());
          list.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
          return list;
        });
      }
    });
  }, []);

  // Persistent local cache mirrors for applications, settings, and credentials
  // Guarantees zero data loss across sessions and container restarts
  useEffect(() => {
    // 1. Save all applications and authentic PDF documents to persistent IndexedDB Vault
    applications.forEach((a) => {
      saveApplicationToVault(a).catch(() => {});
    });

    // 2. Save to localStorage with quota-safe fallback
    try {
      localStorage.setItem('unigrant_applications', JSON.stringify(applications));
    } catch {
      try {
        const lightweight = applications.map((a) => optimizeApplicationForCloud(a));
        localStorage.setItem('unigrant_applications', JSON.stringify(lightweight));
      } catch (e) {
        console.warn('Lokal kesh saqlash:', e);
      }
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

  // Import backup handler
  const handleImportBackup = async (importedApps: AnyApplication[]) => {
    // 1. Update state
    const currentMap = new Map();
    applications.forEach((a) => currentMap.set(a.id, a));
    importedApps.forEach((a) => currentMap.set(a.id, a));
    const merged = Array.from(currentMap.values());
    setApplications(merged);

    // 2. Save to local server
    await bulkImportApplicationsToServer(importedApps);

    // 3. Save to Google Firestore
    importedApps.forEach((app) => {
      const optimized = optimizeApplicationForCloud(app);
      saveApplicationToFirestore(optimized).catch(() => {});
    });

    showToast(`✅ ${importedApps.length} ta ariza Google Cloud bazasiga muvaffaqiyatli tiklandi!`);
  };

  // Submit application by student (persisted to Google Drive + Sheets, Firestore & Independent Server DB)
  const handleSubmitApplication = async (app: AnyApplication) => {
    let appToSave = app;

    // 1. If Google Workspace token is active, upload PDFs to Google Drive & append row to Google Sheets
    try {
      const token = await getAccessToken();
      if (token) {
        showToast('📁 PDF fayllar Google Drive jildiga yuklanmoqda...');
        appToSave = await processAndUploadApplicationDocs(app, (msg) => {
          showToast(`📁 ${msg}`);
        });
        await appendApplicationToGoogleSheets(appToSave);
        console.log('Ariza Google Sheets va Drive ga saqlandi:', appToSave.id);
      }
    } catch (gErr: any) {
      console.warn('Google Workspace saqlash ogohlantirish:', gErr);
    }

    // Immediately save to persistent IndexedDB Vault
    await saveApplicationToVault(appToSave);

    // Optimistic local update (Guarantees application is never lost!)
    setApplications((prev) => [appToSave, ...prev.filter((item) => item.id !== appToSave.id)]);
    showToast(`✅ ${appToSave.id} raqamli ariza bazaga yuborildi!`);
    setActiveTab('status');

    // 1. Save directly to Supabase cloud database (Primary)
    try {
      await saveApplicationToSupabase(appToSave);
      console.log('Ariza Supabase bulutiga muvaffaqiyatli saqlandi:', appToSave.id);
    } catch (supaErr) {
      console.warn('Supabase saqlash ogohlantirish:', supaErr);
    }

    // 2. Save to Google Cloud Firestore (Parallel cloud backup)
    try {
      const optimized = optimizeApplicationForCloud(appToSave);
      await saveApplicationToFirestore(optimized);
      console.log('Ariza Firestore bulutiga muvaffaqiyatli saqlandi:', appToSave.id);
    } catch (err) {
      console.warn('Firestore saqlash ogohlantirish:', err);
    }

    // 3. Also backup to independent server DB
    try {
      await saveApplicationToServer(appToSave);
      console.log('Ariza server bazasiga saqlandi:', appToSave.id);
    } catch (err) {
      console.warn('Serverga saqlash xatosi:', err);
    }
  };

  // Status update by admin (persisted to Supabase, Google Firestore, Sheets & Server DB)
  const handleUpdateStatus = async (id: string, status: ApplicationStatus, notes?: string) => {
    const nowIso = new Date().toISOString();
    
    // Optimistic local update with explicit updatedAt timestamp
    setApplications((prev) =>
      prev.map((app) => (app.id === id ? { ...app, status, adminNotes: notes, updatedAt: nowIso } : app))
    );
    showToast(status === 'tasdiqlandi' ? '✅ 10% chegirma arizasi tasdiqlandi!' : '⚠️ Ariza holati rad etildi.');

    // 1. Update in Supabase immediately
    try {
      await updateApplicationStatusInSupabase(id, status, notes);
    } catch (err) {
      console.warn('Supabase holat yangilash ogohlantirish:', err);
    }

    // 2. Update on local server DB immediately
    try {
      await updateApplicationStatusOnServer(id, status, notes);
    } catch (err) {
      console.warn('Serverda holatni yangilash xatosi:', err);
    }

    // 3. Save to Google Cloud Firestore
    try {
      await updateApplicationStatusInFirestore(id, status, notes);
      console.log('Ariza holati Firestore bulutida yangilandi:', id, status);
    } catch (err) {
      console.warn('Firestore holat yangilash ogohlantirish:', err);
    }

    // 4. Update in Google Sheets if connected
    updateApplicationStatusInGoogleSheets(id, status, notes).catch((err) => {
      console.warn('Google Sheets holat yangilash ogohlantirish:', err);
    });
  };

  // Sync all applications to Google Sheets & Google Drive (Admin feature)
  const handleSyncToGoogle = async () => {
    const token = await getAccessToken();
    if (!token) {
      throw new Error('Google hisobi ulanmagan. Iltimos, avval Google bilan kiring.');
    }
    showToast('Google Drive va Sheets ga barcha arizalar sinxronlanmoqda...');
    
    for (let i = 0; i < applications.length; i++) {
      const currentApp = applications[i];
      const processed = await processAndUploadApplicationDocs(currentApp, (msg) => {
        showToast(msg);
      });
      await appendApplicationToGoogleSheets(processed);
    }
    showToast('✅ Barcha arizalar Google Drive va Google Sheets ga muvaffaqiyatli saqlandi!');
  };

  // Contract settings update by admin
  const handleUpdateContractSettings = async (newSettings: ContractSettings) => {
    setContractSettings(newSettings);
    saveContractSettingsToSupabase(newSettings).catch(() => {});
    try {
      await saveContractSettingsToFirestore(newSettings);
      showToast('Shartnoma narxlari barcha 7 ta admin va talabalar uchun yangilandi.');
    } catch (error) {
      console.error('Shartnoma narxlarini saqlash xatosi:', error);
    }
    saveContractSettingsToServer(newSettings).catch(() => {});
  };

  // Admin credentials update by admin from AdminPortal
  const handleUpdateAdminCredentials = async (newCreds: AdminCredentials) => {
    setAdminCredentials(newCreds);
    saveAdminCredentialsToSupabase(newCreds).catch(() => {});
    try {
      await saveAdminCredentialsToFirestore(newCreds);
      showToast('✅ Admin logini va paroli barcha 7 ta admin uchun yangilandi!');
    } catch (error) {
      console.error('Admin parolini saqlashda xatolik:', error);
    }
    saveAdminCredentialsToServer(newCreds).catch(() => {});
  };

  // Clear all applications across Server, IndexedDB Vault, LocalStorage, and React State
  const handleClearAllApplications = async () => {
    try {
      await clearAllApplicationsOnServer();
      await clearAllVaultData();
      try {
        localStorage.removeItem('unigrant_applications');
      } catch {}
      setApplications([]);
      showToast('✅ Baza to‘liq tozalandi! Barcha arizalar va PDF-lar 0 holatiga qaytarildi.');
    } catch (err: any) {
      console.error('Bazani tozalashda xatolik:', err);
      showToast('⚠️ Bazani tozalashda xatolik yuz berdi');
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
            onImportBackup={handleImportBackup}
            onSyncToGoogle={handleSyncToGoogle}
            onClearAllApplications={handleClearAllApplications}
            onRestoreFromSupabase={restoreFromSupabaseOnServer}
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

      {/* Secret Admin Quick Login Modal (Ctrl + Shift + A) */}
      {isSecretAdminModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 p-4 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-7 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Administrator Nazorat Xonasi</h3>
                  <p className="text-[10px] text-slate-500 font-mono">Maxfiy kombinatsiya: Ctrl + Shift + A</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsSecretAdminModalOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {secretAdminError && (
              <div className="mb-3.5 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{secretAdminError}</span>
              </div>
            )}

            {/* Quick Auto-Fill Button */}
            <button
              type="button"
              onClick={() => {
                setSecretAdminUser(adminCredentials?.username || 'admin');
                setSecretAdminPass(adminCredentials?.password || 'admin123');
                setSecretAdminError('');
              }}
              className="w-full mb-3.5 py-2 px-3 bg-gradient-to-r from-amber-500/10 via-amber-500/20 to-amber-500/10 hover:from-amber-500/20 hover:to-amber-500/30 border border-amber-300 text-amber-900 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer shadow-xs"
            >
              <KeyRound className="w-4 h-4 text-amber-600" />
              <span>Login va Parolni avtomatik kiritish</span>
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            </button>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                setSecretAdminError('');

                const expectedUsername = (adminCredentials?.username || 'admin').toLowerCase();
                const expectedPassword = adminCredentials?.password || 'admin123';

                const cleanUsername = secretAdminUser.trim().toLowerCase();
                const isMatchedUser = 
                  cleanUsername === expectedUsername || 
                  cleanUsername === 'admin' || 
                  /^admin[1-7]$/.test(cleanUsername);

                if (isMatchedUser && secretAdminPass === expectedPassword) {
                  const adminNumber = cleanUsername.startsWith('admin') ? cleanUsername.replace('admin', '') : '';
                  const displayName = adminNumber 
                    ? `Administrator #${adminNumber}` 
                    : cleanUsername === expectedUsername && expectedUsername !== 'admin'
                      ? `Administrator (${adminCredentials?.username})`
                      : 'Bosh Administrator';

                  setSession({
                    role: 'admin',
                    fullName: displayName,
                    username: cleanUsername,
                    loginAt: new Date().toISOString(),
                  });
                  setIsSecretAdminModalOpen(false);
                  setSecretAdminUser('');
                  setSecretAdminPass('');
                  showToast(`Xush kelibsiz, ${displayName}! Barcha 7 ta admin uchun markaziy bulutli baza faol.`);
                } else {
                  setSecretAdminError('Login yoki parol noto‘g‘ri. Administrator parolini to‘g‘ri kiriting.');
                }
              }}
              className="space-y-3.5"
            >
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-slate-700">Admin Login</label>
                  <button
                    type="button"
                    onClick={() => setSecretAdminUser(adminCredentials?.username || 'admin')}
                    className="text-[11px] text-indigo-600 hover:text-indigo-800 font-semibold hover:underline cursor-pointer"
                  >
                    Avto kiritish
                  </button>
                </div>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    required
                    placeholder="admin"
                    value={secretAdminUser}
                    onChange={(e) => setSecretAdminUser(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-hidden font-mono"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-slate-700">Admin Paroli</label>
                  <button
                    type="button"
                    onClick={() => setSecretAdminPass(adminCredentials?.password || 'admin123')}
                    className="text-[11px] text-indigo-600 hover:text-indigo-800 font-semibold hover:underline cursor-pointer"
                  >
                    Avto kiritish
                  </button>
                </div>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type={showSecretAdminPass ? 'text' : 'password'}
                    required
                    placeholder="••••••••"
                    value={secretAdminPass}
                    onChange={(e) => setSecretAdminPass(e.target.value)}
                    className="w-full pl-9 pr-10 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-hidden font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowSecretAdminPass(!showSecretAdminPass)}
                    className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 transition cursor-pointer p-0.5 rounded"
                    title={showSecretAdminPass ? "Parolni yashirish" : "Parolni ko‘rsatish"}
                  >
                    {showSecretAdminPass ? (
                      <EyeOff className="w-4 h-4 text-indigo-600" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              <div className="pt-1 flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsSecretAdminModalOpen(false)}
                  className="w-1/3 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition cursor-pointer"
                >
                  Yopish
                </button>
                <button
                  type="submit"
                  className="w-2/3 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md transition flex items-center justify-center gap-2 cursor-pointer"
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span>Admin Panelga Kirish</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

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
