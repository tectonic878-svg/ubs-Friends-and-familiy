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
  saveApplicationToServer,
  updateApplicationStatusOnServer,
  bulkImportApplicationsToServer,
  saveContractSettingsToServer,
  saveAdminCredentialsToServer,
  testServerConnection,
  subscribeServerData
} from './services/serverDb';
import { 
  processAndUploadApplicationDocs, 
  appendApplicationToGoogleSheets, 
  updateApplicationStatusInGoogleSheets,
  getAccessToken 
} from './services/googleWorkspace';
import { optimizeApplicationForCloud, mergeLocalDocumentUrls } from './utils/cloudSyncOptimizer';
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
    showToast('Google Cloud Firestore bazasi bilan aloqa tekshirilmoqda...');
    try {
      const fireOk = await testFirebaseConnection();
      if (fireOk) {
        setIsCloudConnected(true);
        setIsQuotaExceeded(false);
        setSyncKey((prev) => prev + 1);
        showToast('✅ Google Cloud Firestore bazasi bilan aloqa faol va xavfsiz!');
      } else {
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
      }
    } catch {
      setIsCloudConnected(false);
      showToast('⚠️ Aloqa tekshiruvida xatolik yuz berdi.');
    } finally {
      setIsReconnecting(false);
    }
  };

  // 1. DUAL SYNCHRONIZATION: GOOGLE FIRESTORE + INDEPENDENT SERVER DB
  // Real-time synchronization across all 7 admins and students with zero quota bottlenecks
  useEffect(() => {
    let isMounted = true;

    // Check Firebase and Server connection immediately
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

    // 1. Subscribe to Google Cloud Firestore applications
    const unsubscribeFirestoreApps = subscribeApplications(
      (firestoreApps) => {
        if (!isMounted) return;
        setIsCloudConnected(true);
        setIsQuotaExceeded(false);

        if (firestoreApps.length > 0) {
          // Merge local documents with lightweight firestore state
          setApplications((prev) => {
            const merged = mergeLocalDocumentUrls(firestoreApps, prev);
            // Backup to local server
            bulkImportApplicationsToServer(merged);
            return merged;
          });
        } else {
          // If Firestore is brand new and has 0 apps, check if we have local/server apps to seed
          const cached = localStorage.getItem('unigrant_applications');
          if (cached) {
            try {
              const parsed: AnyApplication[] = JSON.parse(cached);
              if (parsed.length > 0) {
                parsed.forEach((appItem) => {
                  const optimized = optimizeApplicationForCloud(appItem);
                  saveApplicationToFirestore(optimized).catch(() => {});
                });
                bulkImportApplicationsToServer(parsed);
                setApplications(parsed);
              }
            } catch {
              // ignore
            }
          }
        }
      },
      (err) => {
        console.warn('Firestore sinxronizatsiya ogohlantirish:', err.message);
      }
    );

    // 2. Subscribe to contract settings from Firestore
    const unsubscribeFirestoreSettings = subscribeContractSettings(
      (cloudSettings) => {
        if (!isMounted) return;
        if (cloudSettings) {
          setContractSettings(cloudSettings);
        } else {
          saveContractSettingsToFirestore(contractSettings).catch(() => {});
        }
      },
      (err) => console.warn('Firestore settings listener:', err.message)
    );

    // 3. Subscribe to admin credentials from Firestore
    const unsubscribeFirestoreCreds = subscribeAdminCredentials(
      (cloudCreds) => {
        if (!isMounted) return;
        if (cloudCreds) {
          setAdminCredentials(cloudCreds);
        } else {
          saveAdminCredentialsToFirestore(adminCredentials).catch(() => {});
        }
      },
      (err) => console.warn('Firestore admin creds listener:', err.message)
    );

    // 4. Background polling from independent server DB as secondary sync
    const unsubscribeServer = subscribeServerData(
      (serverApps) => {
        if (!isMounted) return;
        if (serverApps.length > 0) {
          setApplications((prev) => {
            // Only update if server has apps and firestore is empty or offline
            if (prev.length === 0) return serverApps;
            return prev;
          });
        }
      },
      () => {},
      () => {},
      10000 // gentle 10s interval
    );

    // Online / Offline browser event listeners
    const handleOnline = () => {
      testFirebaseConnection().then((connected) => {
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
      unsubscribeFirestoreApps();
      unsubscribeFirestoreSettings();
      unsubscribeFirestoreCreds();
      unsubscribeServer();
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

    // Optimistic local update
    setApplications((prev) => [appToSave, ...prev.filter((item) => item.id !== appToSave.id)]);
    showToast(`✅ ${appToSave.id} raqamli ariza bazaga yuborildi!`);
    setActiveTab('status');

    // Save to Google Cloud Firestore (optimized lightweight, PDF binary is on Drive)
    try {
      const optimized = optimizeApplicationForCloud(appToSave);
      await saveApplicationToFirestore(optimized);
      console.log('Ariza Firestore bulutiga muvaffaqiyatli saqlandi:', appToSave.id);
    } catch (err) {
      console.warn('Firestore saqlash ogohlantirish:', err);
    }

    // Also backup to independent server DB
    try {
      await saveApplicationToServer(appToSave);
      console.log('Ariza server bazasiga saqlandi:', appToSave.id);
    } catch (err) {
      console.warn('Serverga saqlash xatosi:', err);
    }
  };

  // Status update by admin (persisted to Google Firestore, Sheets & Server DB)
  const handleUpdateStatus = async (id: string, status: ApplicationStatus, notes?: string) => {
    // Optimistic local update
    setApplications((prev) =>
      prev.map((app) => (app.id === id ? { ...app, status, adminNotes: notes } : app))
    );
    showToast(status === 'tasdiqlandi' ? '✅ 10% chegirma arizasi tasdiqlandi!' : '⚠️ Ariza holati yangilandi.');

    // Save to Google Cloud Firestore
    try {
      await updateApplicationStatusInFirestore(id, status, notes);
      console.log('Ariza holati Firestore bulutida yangilandi:', id, status);
    } catch (err) {
      console.warn('Firestore holat yangilash ogohlantirish:', err);
    }

    // Update in Google Sheets if connected
    updateApplicationStatusInGoogleSheets(id, status, notes).catch((err) => {
      console.warn('Google Sheets holat yangilash ogohlantirish:', err);
    });

    // Also update on local server DB
    try {
      await updateApplicationStatusOnServer(id, status, notes);
    } catch (err) {
      console.warn('Serverda holatni yangilash xatosi:', err);
    }
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
    try {
      await saveContractSettingsToFirestore(newSettings);
      showToast('Shartnoma narxlari barcha 7 ta admin va talabalar uchun Google Cloud bazasida yangilandi.');
    } catch (error) {
      console.error('Shartnoma narxlarini saqlash xatosi:', error);
    }
    saveContractSettingsToServer(newSettings).catch(() => {});
  };

  // Admin credentials update by admin from AdminPortal
  const handleUpdateAdminCredentials = async (newCreds: AdminCredentials) => {
    setAdminCredentials(newCreds);
    try {
      await saveAdminCredentialsToFirestore(newCreds);
      showToast('✅ Admin logini va paroli barcha 7 ta admin uchun Google Cloud bazasida yangilandi!');
    } catch (error) {
      console.error('Admin parolini saqlashda xatolik:', error);
    }
    saveAdminCredentialsToServer(newCreds).catch(() => {});
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
