import React, { useState } from 'react';
import { 
  Shield, 
  Search, 
  CheckCircle, 
  XCircle, 
  Clock, 
  Eye, 
  Lock, 
  FileText, 
  Printer, 
  MessageSquareQuote, 
  Check, 
  X, 
  Download, 
  FileSpreadsheet, 
  Users, 
  Users2, 
  Phone, 
  Calendar,
  Layers,
  KeyRound,
  Archive,
  FolderArchive,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Video as VideoIcon,
  Upload,
  RotateCcw,
  HeartHandshake,
  RefreshCw,
  Database,
  Trash2,
  HardDrive,
  AlertTriangle,
  Copy,
  Sparkles,
  ShieldAlert,
  Server,
  Globe
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { 
  AnyApplication, 
  ApplicationStatus, 
  DocumentFile, 
  ContractSettings, 
  StudentInfo, 
  FamilyMemberInfo,
  AdminCredentials 
} from '../types';
import { downloadFile, cleanPhoneDigits } from '../utils/formatters';
import { downloadAllApplicationsAsZip } from '../utils/zipUtils';
import { UBSLogo } from './UBSLogo';
import { 
  saveVideoFile, 
  saveVideoUrl, 
  resetVideoToDefault, 
  loadVideoData, 
  DEFAULT_VIDEOS 
} from '../utils/videoStorage';
import { 
  deleteAllApplicationsFromSupabase, 
  purgeHeavyFilesFromSupabase, 
  calculateStorageUsage,
  getSupabaseCredentials,
  saveCustomSupabaseCredentials,
  resetSupabaseCredentialsToDefault,
  reinitializeSupabaseClient,
  testSupabaseConnection,
  DEFAULT_SUPABASE_URL,
  DEFAULT_SUPABASE_ANON_KEY
} from '../services/supabase';

interface AdminPortalProps {
  applications: AnyApplication[];
  onUpdateStatus: (id: string, status: ApplicationStatus, notes?: string) => void;
  onPreviewDoc: (doc: DocumentFile) => void;
  onLogout?: () => void;
  contractSettings: ContractSettings;
  onUpdateContractSettings: (settings: ContractSettings) => void;
  isCloudConnected?: boolean;
  isQuotaExceeded?: boolean;
  isReconnecting?: boolean;
  onReconnectCloud?: () => void;
  adminCredentials?: AdminCredentials;
  onUpdateAdminCredentials?: (credentials: AdminCredentials) => void;
  onResetApplicationsList?: () => void;
}

export const AdminPortal: React.FC<AdminPortalProps> = ({
  applications,
  onUpdateStatus,
  onPreviewDoc,
  onLogout,
  contractSettings,
  onUpdateContractSettings,
  isCloudConnected = true,
  isQuotaExceeded = false,
  isReconnecting = false,
  onReconnectCloud,
  adminCredentials,
  onUpdateAdminCredentials,
  onResetApplicationsList,
}) => {
  const [isAuthenticated, setIsAuthenticated] = useState(true);
  const [adminUsername, setAdminUsername] = useState('ubs_admin');
  const [adminPassword, setAdminPassword] = useState('error404');
  const [loginError, setLoginError] = useState('false');

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState<'all' | 'friends' | 'family'>('all');
  const [selectedStatus, setSelectedStatus] = useState<'all' | ApplicationStatus>('all');

  // Rejection modal
  const [rejectModalAppId, setRejectModalAppId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  // Print state
  const [printApp, setPrintApp] = useState<AnyApplication | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // ZIP download progress state
  const [isZipping, setIsZipping] = useState(false);
  const [zipProgressText, setZipProgressText] = useState('');
  const [zipProgressPercent, setZipProgressPercent] = useState(0);

  // Change Admin Credentials Modal State (only accessible inside Admin Portal)
  const [isChangePasswordModalOpen, setIsChangePasswordModalOpen] = useState(false);
  const [newAdminUsername, setNewAdminUsername] = useState(adminCredentials?.username || 'admin');
  const [currentAdminPassword, setCurrentAdminPassword] = useState('');
  const [newAdminPassword, setNewAdminPassword] = useState('');
  const [confirmAdminPassword, setConfirmAdminPassword] = useState('');
  const [passwordChangeError, setPasswordChangeError] = useState('');
  const [passwordChangeSuccess, setPasswordChangeSuccess] = useState('');

  // Video Tutorial Management Modal State (Separate Friends & Family)
  const [isVideoModalOpen, setIsVideoModalOpen] = useState(false);
  const [activeVideoTab, setActiveVideoTab] = useState<'friends' | 'family'>('friends');
  
  // Storage & Supabase Database Clear/Reset Modal State
  const [isStorageModalOpen, setIsStorageModalOpen] = useState(false);
  const [isClearingDb, setIsClearingDb] = useState(false);
  const [confirmPurgeText, setConfirmPurgeText] = useState('');
  const [storageFeedback, setStorageFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [sqlCopied, setSqlCopied] = useState(false);

  // Custom Supabase Project Credentials Form
  const currentCreds = getSupabaseCredentials();
  const [customSupabaseUrl, setCustomSupabaseUrl] = useState(currentCreds.url);
  const [customSupabaseKey, setCustomSupabaseKey] = useState(currentCreds.key);
  const [isTestingSupabaseConfig, setIsTestingSupabaseConfig] = useState(false);
  const [supabaseConfigMsg, setSupabaseConfigMsg] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const [friendsVideoSrc, setFriendsVideoSrc] = useState<string>(DEFAULT_VIDEOS.friends.src);
  const [friendsVideoTitle, setFriendsVideoTitle] = useState<string>(DEFAULT_VIDEOS.friends.name);

  const [familyVideoSrc, setFamilyVideoSrc] = useState<string>(DEFAULT_VIDEOS.family.src);
  const [familyVideoTitle, setFamilyVideoTitle] = useState<string>(DEFAULT_VIDEOS.family.name);

  const [videoCustomUrl, setVideoCustomUrl] = useState('');
  const [videoMessage, setVideoMessage] = useState('');
  const [isVideoSaving, setIsVideoSaving] = useState(false);
  const adminVideoInputRef = React.useRef<HTMLInputElement>(null);

  // Load persistent video sources
  const loadVideos = React.useCallback(async () => {
    try {
      const [friendsData, familyData] = await Promise.all([
        loadVideoData('friends'),
        loadVideoData('family')
      ]);
      setFriendsVideoSrc(friendsData.src);
      setFriendsVideoTitle(friendsData.name);
      setFamilyVideoSrc(familyData.src);
      setFamilyVideoTitle(familyData.name);
    } catch (err) {
      console.warn('Error loading admin videos', err);
    }
  }, []);

  React.useEffect(() => {
    loadVideos();
  }, [loadVideos]);

  const currentTabSrc = activeVideoTab === 'friends' ? friendsVideoSrc : familyVideoSrc;
  const currentTabTitle = activeVideoTab === 'friends' ? friendsVideoTitle : familyVideoTitle;

  const handleAdminVideoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsVideoSaving(true);
    setVideoMessage(`"${file.name}" fayli doimiy saqlanmoqda...`);
    try {
      const objectUrl = await saveVideoFile(activeVideoTab, file, file.name);
      if (activeVideoTab === 'friends') {
        setFriendsVideoSrc(objectUrl);
        setFriendsVideoTitle(file.name);
      } else {
        setFamilyVideoSrc(objectUrl);
        setFamilyVideoTitle(file.name);
      }
      setVideoMessage(`"${file.name}" doimiy saqlandi va ${activeVideoTab === 'friends' ? 'Friends' : 'Family'} loyihasida faollashtirildi!`);
      setTimeout(() => setVideoMessage(''), 4000);
    } catch (err) {
      setVideoMessage('Xatolik: videoni saqlab bo‘lmadi.');
    } finally {
      setIsVideoSaving(false);
      if (adminVideoInputRef.current) adminVideoInputRef.current.value = '';
    }
  };

  const handleAdminVideoUrlSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!videoCustomUrl.trim()) return;
    const url = videoCustomUrl.trim();
    saveVideoUrl(activeVideoTab, url);
    if (activeVideoTab === 'friends') {
      setFriendsVideoSrc(url);
      setFriendsVideoTitle(url);
    } else {
      setFamilyVideoSrc(url);
      setFamilyVideoTitle(url);
    }
    setVideoMessage(`Video havolasi ${activeVideoTab === 'friends' ? 'Friends' : 'Family'} uchun saqlandi!`);
    setVideoCustomUrl('');
    setTimeout(() => setVideoMessage(''), 3500);
  };

  const handleAdminResetVideo = async () => {
    setIsVideoSaving(true);
    try {
      const defaultSrc = await resetVideoToDefault(activeVideoTab);
      if (activeVideoTab === 'friends') {
        setFriendsVideoSrc(defaultSrc);
        setFriendsVideoTitle(DEFAULT_VIDEOS.friends.name);
      } else {
        setFamilyVideoSrc(defaultSrc);
        setFamilyVideoTitle(DEFAULT_VIDEOS.family.name);
      }
      setVideoMessage(`Standart ${DEFAULT_VIDEOS[activeVideoTab].name} holatiga qaytarildi.`);
      setTimeout(() => setVideoMessage(''), 3500);
    } catch (err) {
      //
    } finally {
      setIsVideoSaving(false);
    }
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  // ZIP download for all applications
  const handleDownloadAllAsZip = async () => {
    if (applications.length === 0) {
      showToast('Hozirda yuklab olish uchun arizalar mavjud emas.');
      return;
    }
    setIsZipping(true);
    setZipProgressText('Fayllar to‘planmoqda...');
    setZipProgressPercent(5);

    try {
      await downloadAllApplicationsAsZip(applications, (text, percent) => {
        setZipProgressText(text);
        setZipProgressPercent(percent);
      });
      showToast('Barcha arizalarning PDF hujjatlari bitta umumiy ZIP arxivda muvaffaqiyatli yuklab olindi!');
    } catch (error) {
      console.error('ZIP yuklab olishda xatolik:', error);
      showToast(error instanceof Error ? error.message : 'ZIP arxivni shakllantirishda xatolik yuz berdi.');
    } finally {
      setTimeout(() => {
        setIsZipping(false);
        setZipProgressPercent(0);
        setZipProgressText('');
      }, 1000);
    }
  };

  // ZIP download for a single application
  const handleDownloadSingleAppZip = async (app: AnyApplication) => {
    setIsZipping(true);
    setZipProgressText(`${app.id} arizasi hujjatlari arxivlanmoqda...`);
    setZipProgressPercent(10);

    try {
      await downloadAllApplicationsAsZip([app], (text, percent) => {
        setZipProgressText(text);
        setZipProgressPercent(percent);
      });
      showToast(`${app.id} arizasi PDF hujjatlari ZIP formatida yuklab olindi!`);
    } catch (error) {
      console.error('ZIP xatosi:', error);
      showToast(error instanceof Error ? error.message : 'Faylni arxivlashda xatolik yuz berdi.');
    } finally {
      setTimeout(() => {
        setIsZipping(false);
        setZipProgressPercent(0);
        setZipProgressText('');
      }, 800);
    }
  };

  const handleOpenChangePasswordModal = () => {
    setNewAdminUsername(adminCredentials?.username || 'admin');
    setCurrentAdminPassword('');
    setNewAdminPassword('');
    setConfirmAdminPassword('');
    setPasswordChangeError('');
    setPasswordChangeSuccess('');
    setIsChangePasswordModalOpen(true);
  };

  const handleChangePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordChangeError('');
    setPasswordChangeSuccess('');

    const expectedPassword = adminCredentials?.password || 'admin123';

    if (!currentAdminPassword.trim()) {
      setPasswordChangeError('Iltimos, amaldagi joriy parolni kiriting.');
      return;
    }

    if (currentAdminPassword !== expectedPassword) {
      setPasswordChangeError('Kiritilgan joriy parol noto‘g‘ri.');
      return;
    }

    if (!newAdminUsername.trim()) {
      setPasswordChangeError('Admin login nomi bo‘sh bo‘lishi mumkin emas.');
      return;
    }

    if (!newAdminPassword || newAdminPassword.length < 5) {
      setPasswordChangeError('Yangi parol kamida 5 ta belgidan iborat bo‘lishi kerak.');
      return;
    }

    if (newAdminPassword !== confirmAdminPassword) {
      setPasswordChangeError('Yangi parol va tasdiqlovchi parol bir-biriga mos kelmadi.');
      return;
    }

    if (onUpdateAdminCredentials) {
      onUpdateAdminCredentials({
        username: newAdminUsername.trim(),
        password: newAdminPassword,
        lastChangedAt: new Date().toISOString(),
        changedBy: 'Admin Portal'
      });
      setPasswordChangeSuccess('Admin login va paroli bulut bazasida muvaffaqiyatli yangilandi!');
      showToast('✅ Admin logini va paroli yangilandi. Barcha 7 ta admin yangi ma’lumotlardan foydalanadi.');
      setTimeout(() => {
        setIsChangePasswordModalOpen(false);
      }, 1500);
    } else {
      setPasswordChangeError('Tizim xatoligi: Parolni saqlash xizmati ulanmagan.');
    }
  };

  // Database Storage Usage estimation
  const storageStats = calculateStorageUsage(applications);
  const storageQuotaMB = 1024; // 1 GB free Supabase limit
  const storagePercent = Math.min(100, Number(((storageStats.totalMB / storageQuotaMB) * 100).toFixed(1)));

  // Wipe / Delete ALL applications and attached PDF files to free 1GB
  const handlePurgeAllApplications = async () => {
    if (confirmPurgeText.trim().toUpperCase() !== 'TOZALASH') {
      setStorageFeedback({
        type: 'error',
        message: 'Iltimos, tasdiqlash uchun maydonga katta harflar bilan "TOZALASH" so‘zini yozing.'
      });
      return;
    }

    setIsClearingDb(true);
    setStorageFeedback(null);

    try {
      const result = await deleteAllApplicationsFromSupabase();
      if (result.success) {
        if (result.isEgressQuota) {
          setStorageFeedback({
            type: 'success',
            message: result.error || '✅ Lokal arizalar va xotira 100% tozalandi. Supabase bulut bazasini ham 0 ga tushirish uchun quyidagi SQL buyrug‘idan foydalaning.'
          });
        } else {
          setStorageFeedback({
            type: 'success',
            message: `✅ Supabase bazasidagi barcha arizalar va yuklangan fayllar to‘liq o‘chirildi! 1 GB xotira 100% bo‘shatildi.`
          });
        }
        showToast('✅ Arizalar va xotira muvaffaqiyatli tozalandi!');
        setConfirmPurgeText('');
        if (onResetApplicationsList) {
          onResetApplicationsList();
        }
      } else {
        setStorageFeedback({
          type: 'error',
          message: `Xatolik yuz berdi: ${result.error || 'Noma’lum xato'}`
        });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Noma’lum xatolik';
      setStorageFeedback({
        type: 'error',
        message: `Baza tozalashda xatolik: ${msg}`
      });
    } finally {
      setIsClearingDb(false);
    }
  };

  // Purge only large Base64 files while keeping application history
  const handlePurgeFilesOnly = async () => {
    setIsClearingDb(true);
    setStorageFeedback(null);

    try {
      const result = await purgeHeavyFilesFromSupabase();
      if (result.success) {
        setStorageFeedback({
          type: 'success',
          message: `✅ ${result.count || 0} ta arizaning og‘ir PDF fayllari tozalandi. Arizalar ro‘yxati saqlanib qolgan holda xotira bo‘shatildi.`
        });
        showToast('✅ Yuklangan og‘ir fayllar tozalandi!');
      } else {
        setStorageFeedback({
          type: 'error',
          message: `Xatolik: ${result.error || 'Noma’lum xato'}`
        });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Noma’lum xatolik';
      setStorageFeedback({
        type: 'error',
        message: `Fayllarni tozalashda xatolik: ${msg}`
      });
    } finally {
      setIsClearingDb(false);
    }
  };

  const handleCopySql = () => {
    const sql = `TRUNCATE TABLE public.applications;`;
    navigator.clipboard.writeText(sql);
    setSqlCopied(true);
    showToast('SQL buyrug‘i nusxalandi! Supabase SQL Editor bo‘limiga qo‘yishingiz mumkin.');
    setTimeout(() => setSqlCopied(false), 3000);
  };

  // Save new/custom Supabase credentials and re-test connection
  const handleSaveSupabaseConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customSupabaseUrl.trim() || !customSupabaseKey.trim()) {
      setSupabaseConfigMsg({
        type: 'error',
        message: 'Iltimos, Supabase URL va Anon Key maydonlarini to‘ldiring.'
      });
      return;
    }

    setIsTestingSupabaseConfig(true);
    setSupabaseConfigMsg(null);

    try {
      saveCustomSupabaseCredentials(customSupabaseUrl.trim(), customSupabaseKey.trim());
      reinitializeSupabaseClient();
      const isOk = await testSupabaseConnection();
      if (isOk) {
        setSupabaseConfigMsg({
          type: 'success',
          message: '✅ Yangi Supabase bazasiga ulanish muvaffaqiyatli o‘rnatildi! Baza to‘liq faol.'
        });
        showToast('✅ Supabase kalitlari yangilandi va ulandi!');
      } else {
        setSupabaseConfigMsg({
          type: 'error',
          message: '⚠️ Yangi ma’lumotlar saqlandi, lekin Supabase loyihasiga ulanib bo‘lmadi. URL yoki Anon Key ni tekshiring yoki SQL jadvalini yarating.'
        });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Noma’lum xato';
      setSupabaseConfigMsg({
        type: 'error',
        message: `Ulanish xatosi: ${msg}`
      });
    } finally {
      setIsTestingSupabaseConfig(false);
    }
  };

  const handleResetSupabaseConfig = async () => {
    resetSupabaseCredentialsToDefault();
    setCustomSupabaseUrl(DEFAULT_SUPABASE_URL);
    setCustomSupabaseKey(DEFAULT_SUPABASE_ANON_KEY);
    reinitializeSupabaseClient();
    setSupabaseConfigMsg({
      type: 'success',
      message: 'Standart Supabase loyihasi holatiga qaytarildi.'
    });
    showToast('Standart Supabase sozlamalari tiklandi.');
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (adminUsername === 'admin' && adminPassword === 'admin123') {
      setIsAuthenticated(true);
      setLoginError('');
    } else {
      setLoginError('Noto‘g‘ri login yoki parol. (Demo uchun: admin / admin123)');
    }
  };

  const handleApprove = (id: string) => {
    onUpdateStatus(id, 'tasdiqlandi', 'Barcha talablar va hujjatlar muvaffaqiyatli tekshirildi. 10% chegirma tasdiqlandi.');
    showToast(`${id} raqamli ariza muvaffaqiyatli tasdiqlandi.`);
  };

  const handleRejectConfirm = () => {
    if (!rejectModalAppId) return;
    onUpdateStatus(rejectModalAppId, 'rad_etildi', rejectReason || 'Hujjatlar to‘liq emas yoki talablarga javob bermaydi.');
    setRejectModalAppId(null);
    setRejectReason('');
    showToast('Ariza rad etildi.');
  };

  // Filtered applications
  const filteredApps = applications.filter((app) => {
    if (selectedType !== 'all' && app.type !== selectedType) return false;
    if (selectedStatus !== 'all' && app.status !== selectedStatus) return false;
    if (!searchQuery.trim()) return true;

    const q = searchQuery.toLowerCase();
    if (app.id.toLowerCase().includes(q)) return true;

    if (app.type === 'friends') {
      const allS = [
        app.applicantStudent,
        ...(app.friendsList && app.friendsList.length > 0 ? app.friendsList : [app.friendStudent])
      ];
      return allS.some(
        (s) =>
          s.fullName.toLowerCase().includes(q) ||
          s.jshshr.includes(q) ||
          s.passportNumber.includes(q) ||
          (s.phone1 && s.phone1.includes(q)) ||
          (s.phone2 && s.phone2.includes(q))
      );
    } else {
      return app.members.some(
        (m) =>
          m.fullName.toLowerCase().includes(q) ||
          m.jshshr.includes(q) ||
          m.passportNumber.includes(q) ||
          (m.phone1 && m.phone1.includes(q)) ||
          (m.phone2 && m.phone2.includes(q))
      );
    }
  });

  // Calculate statistics purely focused on applications & students (NO money amounts)
  const totalCount = applications.length;
  const pendingCount = applications.filter((a) => a.status === 'kutilmoqda').length;
  const approvedCount = applications.filter((a) => a.status === 'tasdiqlandi').length;
  const rejectedCount = applications.filter((a) => a.status === 'rad_etildi').length;
  const friendsAppsCount = applications.filter((a) => a.type === 'friends').length;
  const familyAppsCount = applications.filter((a) => a.type === 'family').length;

  // Total students covered
  const totalStudentsCount = applications.reduce((acc, app) => {
    if (app.type === 'friends') {
      const count = (app.friendsList && app.friendsList.length > 0 ? app.friendsList.length : 1) + 1;
      return acc + count;
    } else {
      return acc + (app.members?.length || app.membersCount || 0);
    }
  }, 0);

  // EXCEL EXPORT FUNCTION (.xlsx)
  const handleExportToExcel = () => {
    if (applications.length === 0) {
      showToast('Eksport qilish uchun arizalar mavjud emas.');
      return;
    }

    const rows: Record<string, string | number>[] = [];
    let counter = 1;

    applications.forEach((app) => {
      const appTypeLabel = app.type === 'friends' ? 'Friends (Do‘stlar)' : 'Family (Oila)';
      const appStatusLabel = 
        app.status === 'tasdiqlandi' ? 'Tasdiqlangan' : 
        app.status === 'rad_etildi' ? 'Rad etilgan' : 'Kutilmoqda';
      const createdDate = new Date(app.createdAt).toLocaleString('uz-UZ');

      if (app.type === 'friends') {
        const students: { s: StudentInfo; role: string }[] = [
          { s: app.applicantStudent, role: '1-Talaba (Asosiy arizachi)' },
          ...(app.friendsList && app.friendsList.length > 0 ? app.friendsList : [app.friendStudent]).map((fr, idx) => ({
            s: fr,
            role: `${idx + 2}-Talaba (${idx + 1}-Sherik/Do‘st)`
          }))
        ];

        students.forEach(({ s, role }) => {
          const cleanPhone = cleanPhoneDigits(s.phone1 || s.phone || '');
          rows.push({
            '№': counter++,
            'Ariza ID': app.id,
            'Dastur turi': appTypeLabel,
            'Talaba F.I.SH': s.fullName,
            'JSHSHR (PINFL)': s.jshshr,
            'Pasport seriyasi': s.passportSeria,
            'Pasport raqami': s.passportNumber,
            '1-Telefon raqami (Asosiy)': s.phone1 || s.phone || 'Kiritilmagan',
            '2-Telefon raqami (Qo‘shimcha)': s.phone2 || 'Kiritilmagan',
            'Fakultet / Yo‘nalish': s.faculty,
            'Bosqich (Kurs)': s.course,
            'Talaba roli': role,
            'Ariza holati': appStatusLabel,
            'Ariza sanasi': createdDate,
            '1-Fayl nomi (JSHSHR)': `${s.jshshr}.pdf`,
            '2-Fayl nomi (Telefon)': cleanPhone ? `${cleanPhone}.pdf` : 'telefon.pdf'
          });
        });
      } else if (app.type === 'family') {
        app.members.forEach((m, idx) => {
          const cleanPhone = cleanPhoneDigits(m.phone1 || m.phone || '');
          rows.push({
            '№': counter++,
            'Ariza ID': app.id,
            'Dastur turi': appTypeLabel,
            'Talaba F.I.SH': m.fullName,
            'JSHSHR (PINFL)': m.jshshr,
            'Pasport seriyasi': m.passportSeria,
            'Pasport raqami': m.passportNumber,
            '1-Telefon raqami (Asosiy)': m.phone1 || m.phone || 'Kiritilmagan',
            '2-Telefon raqami (Qo‘shimcha)': m.phone2 || 'Kiritilmagan',
            'Fakultet / Yo‘nalish': m.faculty,
            'Bosqich (Kurs)': m.course,
            'Talaba roli': `${idx + 1}-A’zo (${m.relationship})`,
            'Ariza holati': appStatusLabel,
            'Ariza sanasi': createdDate,
            '1-Fayl nomi (JSHSHR)': `${m.jshshr}.pdf`,
            '2-Fayl nomi (Telefon)': cleanPhone ? `${cleanPhone}.pdf` : 'telefon.pdf'
          });
        });
      }
    });

    const worksheet = XLSX.utils.json_to_sheet(rows);

    // Auto calculate column widths
    const colWidths = [
      { wch: 5 },  // №
      { wch: 15 }, // Ariza ID
      { wch: 20 }, // Dastur turi
      { wch: 32 }, // Talaba F.I.SH
      { wch: 18 }, // JSHSHR
      { wch: 16 }, // Pasport seriyasi
      { wch: 16 }, // Pasport raqami
      { wch: 22 }, // 1-Telefon
      { wch: 22 }, // 2-Telefon
      { wch: 32 }, // Fakultet
      { wch: 15 }, // Kurs
      { wch: 26 }, // Talaba roli
      { wch: 16 }, // Ariza holati
      { wch: 20 }, // Ariza sanasi
      { wch: 22 }, // 1-Fayl
      { wch: 22 }, // 2-Fayl
    ];
    worksheet['!cols'] = colWidths;

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Talabalar_Arizalari');

    const fileName = `Talabalar_Arizalari_${new Date().toISOString().slice(0, 10)}.xlsx`;
    XLSX.writeFile(workbook, fileName);
    showToast(`Barcha arizalar muvaffaqiyatli ${fileName} fayliga yuklab olindi.`);
  };

  // INDIVIDUAL PDF DOWNLOAD HELPERS
  // 1-fayl: JSHSHR bo'yicha nomlanadi (masalan, 31405021234567.pdf)
  const downloadFirstPdf = (doc: DocumentFile | undefined, jshshr: string) => {
    if (!doc?.url) {
      showToast('1-fayl (Pasport PDF) hujjati mavjud emas.');
      return;
    }
    const filename = `${jshshr || 'hujjat_jshshr'}.pdf`;
    downloadFile(doc.url, filename);
    showToast(`1-fayl yuklab olindi: ${filename}`);
  };

  // 2-fayl: Telefon raqamiga qarab nomlanadi (masalan, 998901234567.pdf)
  const downloadSecondPdf = (doc: DocumentFile | undefined, phone: string) => {
    if (!doc?.url) {
      showToast('2-fayl (Diplom/Guvohnoma PDF) hujjati mavjud emas.');
      return;
    }
    const clean = cleanPhoneDigits(phone);
    const filename = `${clean || 'hujjat_telefon'}.pdf`;
    downloadFile(doc.url, filename);
    showToast(`2-fayl yuklab olindi: ${filename}`);
  };

  // Download all PDFs of a single application individually
  const handleDownloadAllApplicationPdfs = (app: AnyApplication) => {
    const filesToDownload: { url: string; name: string }[] = [];

    if (app.type === 'friends') {
      const students = [
        app.applicantStudent,
        ...(app.friendsList && app.friendsList.length > 0 ? app.friendsList : [app.friendStudent])
      ];

      students.forEach((s) => {
        if (s.passportDoc?.url) {
          filesToDownload.push({ url: s.passportDoc.url, name: `${s.jshshr}.pdf` });
        }
        if (s.certificateDoc?.url) {
          const cleanPhone = cleanPhoneDigits(s.phone1 || s.phone || '');
          filesToDownload.push({ url: s.certificateDoc.url, name: `${cleanPhone || s.jshshr + '_doc2'}.pdf` });
        }
      });
    } else if (app.type === 'family') {
      app.members.forEach((m) => {
        if (m.passportDoc?.url) {
          filesToDownload.push({ url: m.passportDoc.url, name: `${m.jshshr}.pdf` });
        }
        if (m.birthOrMarriageDoc?.url) {
          const cleanPhone = cleanPhoneDigits(m.phone1 || m.phone || '');
          filesToDownload.push({ url: m.birthOrMarriageDoc.url, name: `${cleanPhone || m.jshshr + '_doc2'}.pdf` });
        }
      });
    }

    if (filesToDownload.length === 0) {
      showToast('Ushbu arizada yuklab olish uchun PDF fayllar topilmadi.');
      return;
    }

    // Trigger individual downloads sequentially with a small delay so browser doesn't block them
    filesToDownload.forEach((file, index) => {
      setTimeout(() => {
        downloadFile(file.url, file.name);
      }, index * 250);
    });

    showToast(`${filesToDownload.length} ta PDF fayl alohida-alohida yuklab olinmoqda...`);
  };

  if (!isAuthenticated) {
    return (
      <div className="max-w-md mx-auto my-12 bg-white rounded-3xl p-8 border border-slate-200 shadow-xl">
        <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto mb-4">
          <Lock className="w-6 h-6" />
        </div>
        <h2 className="text-xl font-bold text-center text-slate-900 mb-1">Admin Tizimiga Kirish</h2>
        <p className="text-xs text-center text-slate-500 mb-6">
          Universitet mas’ul xodimlari uchun himoyalangan boshqaruv paneli
        </p>

        {loginError && (
          <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs">
            {loginError}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Login</label>
            <input
              type="text"
              value={adminUsername}
              onChange={(e) => setAdminUsername(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-hidden"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Parol</label>
            <input
              type="password"
              value={adminPassword}
              onChange={(e) => setAdminPassword(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-hidden"
              required
            />
          </div>
          <button
            type="submit"
            className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-md transition cursor-pointer"
          >
            Kirish
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white text-xs font-medium px-4 py-3 rounded-xl shadow-2xl border border-slate-700 flex items-center gap-2 animate-bounce">
          <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Admin Header with stats focused strictly on student info & application counts (NO financial totals) */}
      <div className="bg-slate-900 rounded-3xl p-6 text-white shadow-xl border border-slate-800">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <UBSLogo size="md" showText={false} />
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold text-white">UBS Ma’muriyati Admin Portali</h1>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className={`text-[10px] ${isCloudConnected ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' : isQuotaExceeded ? 'bg-amber-500/20 text-amber-300 border-amber-500/30' : 'bg-slate-700/50 text-slate-300 border-slate-600'} px-2 py-0.5 rounded-full font-mono border flex items-center gap-1.5`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${isCloudConnected ? 'bg-emerald-400 animate-pulse' : isQuotaExceeded ? 'bg-amber-400' : 'bg-slate-400'}`} />
                    {isCloudConnected ? 'Supabase Bulutli Baza Faol (7 ta Admin uchun Umumiy)' : isQuotaExceeded ? 'Lokal Rejim' : 'Oflayn Rejim'}
                  </span>
                  {onReconnectCloud && (
                    <button
                      onClick={onReconnectCloud}
                      disabled={isReconnecting}
                      type="button"
                      className={`px-2 py-0.5 text-[10px] rounded-md font-semibold border flex items-center gap-1 transition cursor-pointer ${
                        !isCloudConnected 
                          ? 'bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border-amber-400/50' 
                          : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
                      }`}
                      title={isCloudConnected ? "Bulutli baza holatini tekshirish" : "Bulutli bazaga qayta ulanishni sinash"}
                    >
                      <RefreshCw className={`w-2.5 h-2.5 ${isReconnecting ? 'animate-spin' : ''}`} />
                      <span>{isReconnecting ? 'Ulanmoqda...' : (isCloudConnected ? 'Tekshirish' : 'Qayta ulash')}</span>
                    </button>
                  )}
                </div>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                University of Business and Sciences • Talabalar ma’lumotlari to‘liq va himoyalangan boshqaruv paneli
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* ZIP Download All PDFs Button */}
            <button
              onClick={handleDownloadAllAsZip}
              disabled={isZipping || applications.length === 0}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-800 disabled:text-slate-500 text-white rounded-xl text-xs font-bold transition shadow-md flex items-center gap-2 cursor-pointer disabled:cursor-not-allowed border border-indigo-500/40"
              title="Barcha arizalarning PDF hujjatlarini bitta umumiy ZIP arxivda yuklab olish (1-fayl: JSHSHR, 2-fayl: Telefon raqami)"
            >
              {isZipping ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-indigo-200" />
                  <span>ZIP tayyorlanmoqda ({zipProgressPercent}%)...</span>
                </>
              ) : (
                <>
                  <Archive className="w-4 h-4 text-indigo-200" />
                  <span>Barcha PDF-larni ZIP yuklab olish</span>
                </>
              )}
            </button>

            {/* Excel Export Button */}
            <button
              onClick={handleExportToExcel}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition shadow-md flex items-center gap-2 cursor-pointer border border-emerald-500/40"
              title="Barcha arizalarni Excel (.xlsx) formatida yuklab olish"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-200" />
              <span>Excel (.xlsx) yuklab olish</span>
            </button>

            {/* Change Admin Password Button (Accessible only from Admin Portal) */}
            <button
              onClick={handleOpenChangePasswordModal}
              className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-xl text-xs font-semibold transition border border-slate-700 flex items-center gap-1.5 cursor-pointer shadow-xs"
              title="Administrator login va parolini o‘zgartirish (Barcha 7 ta admin uchun umumiy)"
            >
              <KeyRound className="w-3.5 h-3.5 text-amber-400" />
              <span>Parolni o‘zgartirish</span>
            </button>

            {/* Video Tutorial Guide Management Button */}
            <button
              onClick={() => setIsVideoModalOpen(true)}
              className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-xl text-xs font-semibold transition border border-slate-700 flex items-center gap-1.5 cursor-pointer shadow-xs"
              title="Talabalar uchun rasmiy video qo‘llanmani ko‘rish yoki yangi video yuklash"
            >
              <VideoIcon className="w-3.5 h-3.5 text-blue-400" />
              <span>Video qo‘llanma yuklash</span>
            </button>

            {/* Database & Storage 1GB Purge Button */}
            <button
              onClick={() => {
                setConfirmPurgeText('');
                setStorageFeedback(null);
                setIsStorageModalOpen(true);
              }}
              className="px-3.5 py-2 bg-rose-950/40 hover:bg-rose-900/50 text-rose-300 hover:text-rose-100 rounded-xl text-xs font-semibold transition border border-rose-700/60 flex items-center gap-1.5 cursor-pointer shadow-xs"
              title="Supabase PostgreSQL bazasi va yuklangan fayllarni tozalash (1 GB xotirani bo‘shatish)"
            >
              <HardDrive className="w-3.5 h-3.5 text-rose-400" />
              <span>Baza & 1GB Tozalash ({storageStats.totalMB} MB)</span>
            </button>

            <button
              onClick={() => {
                if (onLogout) {
                  onLogout();
                } else {
                  setIsAuthenticated(false);
                }
              }}
              className="px-3 py-2 text-xs text-rose-300 hover:text-white bg-slate-800 hover:bg-rose-900/50 rounded-xl transition border border-slate-700 cursor-pointer"
            >
              Chiqish
            </button>
          </div>
        </div>

        {/* Refactored Stats counters (Application & Student metrics only, NO contract sums) */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mt-6 pt-5 border-t border-slate-800">
          <div className="bg-slate-800/60 rounded-xl p-3 border border-slate-700/50">
            <span className="text-[11px] text-slate-400 block">Jami arizalar:</span>
            <span className="text-xl font-bold text-white font-mono">{totalCount} ta</span>
          </div>
          <div className="bg-amber-500/10 rounded-xl p-3 border border-amber-500/20">
            <span className="text-[11px] text-amber-300 block">Kutilmoqda (Tekshiruv):</span>
            <span className="text-xl font-bold text-amber-300 font-mono">{pendingCount} ta</span>
          </div>
          <div className="bg-emerald-500/10 rounded-xl p-3 border border-emerald-500/20">
            <span className="text-[11px] text-emerald-300 block">Tasdiqlangan:</span>
            <span className="text-xl font-bold text-emerald-300 font-mono">{approvedCount} ta</span>
          </div>
          <div className="bg-rose-500/10 rounded-xl p-3 border border-rose-500/20">
            <span className="text-[11px] text-rose-300 block">Rad etilgan:</span>
            <span className="text-xl font-bold text-rose-300 font-mono">{rejectedCount} ta</span>
          </div>
          <div className="bg-blue-500/10 rounded-xl p-3 border border-blue-500/20">
            <span className="text-[11px] text-blue-300 block">Friends arizalari:</span>
            <span className="text-xl font-bold text-blue-300 font-mono">{friendsAppsCount} ta</span>
          </div>
          <div className="bg-teal-500/10 rounded-xl p-3 border border-teal-500/20">
            <span className="text-[11px] text-teal-300 block">Jami talabalar:</span>
            <span className="text-xl font-bold text-teal-300 font-mono">{totalStudentsCount} nafar</span>
          </div>
        </div>
      </div>

      {/* Offline Alert Banner */}
      {!isCloudConnected && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-amber-900 shadow-xs">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
            <div>
              <p className="font-semibold text-amber-950">
                Bulutli baza bilan aloqa oflayn rejimda
              </p>
              <p className="text-amber-700 mt-0.5">
                Arizalar va sozlamalar hozircha lokal xotiradan olinmoqda. Aloqa tiklanganda barcha ma’lumotlar markaziy Supabase bazasiga avtomatik sinxronlanadi.
              </p>
            </div>
          </div>
          {onReconnectCloud && (
            <button
              onClick={onReconnectCloud}
              disabled={isReconnecting}
              type="button"
              className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 disabled:bg-amber-400 text-white rounded-xl font-bold flex items-center gap-1.5 transition shrink-0 cursor-pointer shadow-xs"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isReconnecting ? 'animate-spin' : ''}`} />
              <span>{isReconnecting ? 'Ulanmoqda...' : 'Qayta tekshirish'}</span>
            </button>
          )}
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex-1 min-w-[240px] relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="JSHSHR, ism-familiya, telefon yoki ariza ID bo‘yicha izlash..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-hidden"
          />
        </div>

        <div className="flex items-center gap-2 overflow-x-auto">
          {/* Program filter */}
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value as any)}
            className="px-3 py-1.5 text-xs font-medium border border-slate-200 rounded-xl bg-slate-50 focus:ring-2 focus:ring-indigo-500 outline-hidden cursor-pointer"
          >
            <option value="all">Barcha dasturlar</option>
            <option value="friends">Faqat Friends</option>
            <option value="family">Faqat Family</option>
          </select>

          {/* Status filter */}
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value as any)}
            className="px-3 py-1.5 text-xs font-medium border border-slate-200 rounded-xl bg-slate-50 focus:ring-2 focus:ring-indigo-500 outline-hidden cursor-pointer"
          >
            <option value="all">Barcha holatlar</option>
            <option value="kutilmoqda">Kutilmoqda</option>
            <option value="tasdiqlandi">Tasdiqlangan</option>
            <option value="rad_etildi">Rad etilgan</option>
          </select>

          {/* Excel export quick icon */}
          <button
            onClick={handleExportToExcel}
            className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer shrink-0"
            title="Excel formatida eksport qilish"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
            <span className="hidden sm:inline">Excel</span>
          </button>
        </div>
      </div>

      {/* Applications list */}
      {filteredApps.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center border border-slate-200">
          {applications.length === 0 ? (
            <div className="max-w-md mx-auto space-y-2">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
                <FileText className="w-6 h-6" />
              </div>
              <p className="text-sm font-bold text-slate-800">
                Hozircha tizimda topshirilgan arizalar mavjud emas (0 ta ariza)
              </p>
              <p className="text-xs text-slate-500 leading-relaxed">
                Foydalanuvchilar JSHSHR orqali kirib, Friends yoki Family dasturi bo‘yicha 2 ta telefon raqam va PDF hujjatlar bilan ariza topshirganda, bu yerda aks etadi.
              </p>
            </div>
          ) : (
            <div>
              <p className="text-sm font-semibold text-slate-700 mb-1">Mos arizalar topilmadi</p>
              <p className="text-xs text-slate-400">Qidiruv parametrlarini yoki filtrlarni o‘zgartirib ko‘ring.</p>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {filteredApps.map((app) => (
            <div
              key={app.id}
              className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden transition-all duration-150"
            >
              {/* Card top banner: Only student and application identification (No sum) */}
              <div className="px-6 py-4 bg-slate-50/80 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className={`text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider ${
                    app.type === 'friends' 
                      ? 'bg-blue-100 text-blue-800' 
                      : 'bg-emerald-100 text-emerald-800'
                  }`}>
                    {app.type === 'friends' 
                      ? `Friends Dasturi (${(app.friendsList?.length || 1) + 1} nafar talaba)` 
                      : `Family Dasturi (${app.membersCount} nafar a’zo)`}
                  </span>
                  <span className="font-mono text-xs font-bold text-slate-700">{app.id}</span>
                  <span className="text-xs text-slate-400">
                    Sana: {new Date(app.createdAt).toLocaleString('uz-UZ')}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  {/* Status badge */}
                  {app.status === 'tasdiqlandi' && (
                    <span className="flex items-center gap-1 text-xs font-semibold px-3 py-1 rounded-full bg-emerald-100 text-emerald-800">
                      <CheckCircle className="w-3.5 h-3.5" />
                      Tasdiqlangan
                    </span>
                  )}
                  {app.status === 'rad_etildi' && (
                    <span className="flex items-center gap-1 text-xs font-semibold px-3 py-1 rounded-full bg-rose-100 text-rose-800">
                      <XCircle className="w-3.5 h-3.5" />
                      Rad etilgan
                    </span>
                  )}
                  {app.status === 'kutilmoqda' && (
                    <span className="flex items-center gap-1 text-xs font-semibold px-3 py-1 rounded-full bg-amber-100 text-amber-800">
                      <Clock className="w-3.5 h-3.5" />
                      Kutilmoqda
                    </span>
                  )}

                  {/* Actions for Admin */}
                  <div className="flex items-center gap-1.5 ml-3">
                    {/* Download all PDFs as ZIP button */}
                    <button
                      onClick={() => handleDownloadSingleAppZip(app)}
                      className="px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg text-xs font-semibold transition flex items-center gap-1 cursor-pointer"
                      title="Ushbu arizaning PDF hujjatlarini ZIP arxiv qilib yuklab olish"
                    >
                      <FolderArchive className="w-3.5 h-3.5" />
                      <span>ZIP yuklab olish</span>
                    </button>

                    {/* Download all PDFs button */}
                    <button
                      onClick={() => handleDownloadAllApplicationPdfs(app)}
                      className="px-2.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg text-xs font-semibold transition flex items-center gap-1 cursor-pointer"
                      title="Ushbu arizaning barcha PDF hujjatlarini alohida-alohida yuklab olish"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>PDF-lar</span>
                    </button>

                    {app.status !== 'tasdiqlandi' && (
                      <button
                        onClick={() => handleApprove(app.id)}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold transition flex items-center gap-1 shadow-xs cursor-pointer"
                        title="Arizani tasdiqlash"
                      >
                        <Check className="w-3.5 h-3.5" />
                        Tasdiqlash
                      </button>
                    )}
                    {app.status !== 'rad_etildi' && (
                      <button
                        onClick={() => {
                          setRejectModalAppId(app.id);
                          setRejectReason('');
                        }}
                        className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-xs font-semibold transition flex items-center gap-1 cursor-pointer"
                        title="Arizani rad etish"
                      >
                        <X className="w-3.5 h-3.5" />
                        Rad etish
                      </button>
                    )}
                    <button
                      onClick={() => setPrintApp(app)}
                      className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-200 rounded-lg transition"
                      title="Qaror varaqasini chiqarish (Print)"
                    >
                      <Printer className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Admin Note if exists */}
              {app.adminNotes && (
                <div className="px-6 py-2 bg-slate-100/70 border-b border-slate-200 text-xs text-slate-700 flex items-center gap-2">
                  <MessageSquareQuote className="w-4 h-4 text-indigo-600 shrink-0" />
                  <span><strong>Admin izohi:</strong> {app.adminNotes}</span>
                </div>
              )}

              {/* Read-Only Student Data Display (Summa ko'rsatilmaydi, talabaning barcha ma'lumotlari to'liq ko'rinadi) */}
              <div className="p-6">
                <div className="flex items-center gap-1.5 text-slate-400 text-[11px] mb-4">
                  <Lock className="w-3.5 h-3.5 text-amber-500" />
                  <span>Talabaning shaxsiy ma’lumotlari: 2 ta telefon raqam, pasport va JSHSHR / Telefon bo‘yicha nomlangan PDF fayllar</span>
                </div>

                {/* IF FRIENDS APPLICATION */}
                {app.type === 'friends' && (
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {/* 1-Student (Applicant) */}
                      <div className="p-4 rounded-xl bg-slate-50/70 border border-slate-200 flex flex-col justify-between">
                        <div>
                          <div className="text-xs font-bold text-blue-700 mb-2 flex items-center justify-between pb-1.5 border-b border-slate-200">
                            <span>1-Talaba (Asosiy arizachi)</span>
                            <span className="font-mono text-[11px] text-slate-500">{app.applicantStudent.course}</span>
                          </div>
                          <div className="space-y-1.5 text-xs">
                            <p><strong className="text-slate-700">F.I.SH:</strong> {app.applicantStudent.fullName}</p>
                            <p><strong className="text-slate-700">JSHSHR:</strong> <span className="font-mono bg-white px-2 py-0.5 rounded border border-slate-200 font-bold">{app.applicantStudent.jshshr}</span></p>
                            <p><strong className="text-slate-700">Pasport:</strong> <span className="font-mono font-bold text-slate-900">{app.applicantStudent.passportSeria} {app.applicantStudent.passportNumber}</span></p>
                            <p><strong className="text-slate-700">1-Telefon:</strong> <span className="font-mono font-bold text-blue-800">{app.applicantStudent.phone1 || app.applicantStudent.phone || 'Kiritilmagan'}</span></p>
                            <p><strong className="text-slate-700">2-Telefon:</strong> <span className="font-mono text-slate-700">{app.applicantStudent.phone2 || 'Kiritilmagan'}</span></p>
                            <p><strong className="text-slate-700">Fakultet:</strong> <span className="text-slate-600 block truncate">{app.applicantStudent.faculty}</span></p>
                          </div>
                        </div>

                        {/* PDF Download Buttons & Previews */}
                        <div className="mt-4 pt-3 border-t border-slate-200 space-y-2">
                          {/* 1-fayl: JSHSHR bilan */}
                          <div className="flex items-center justify-between p-2 rounded-lg bg-white border border-slate-200">
                            <div className="min-w-0">
                              <p className="text-[11px] font-bold text-slate-800 truncate">
                                1-Fayl: <span className="font-mono text-blue-600">{app.applicantStudent.jshshr}.pdf</span>
                              </p>
                              <p className="text-[10px] text-slate-400">Pasport nusxasi (PDF)</p>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              {app.applicantStudent.passportDoc && (
                                <button
                                  onClick={() => onPreviewDoc(app.applicantStudent.passportDoc!)}
                                  className="p-1 text-slate-500 hover:text-blue-600 rounded hover:bg-slate-100 transition"
                                  title="Ko‘rish"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                </button>
                              )}
                              <button
                                onClick={() => downloadFirstPdf(app.applicantStudent.passportDoc, app.applicantStudent.jshshr)}
                                className="px-2 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded text-[10px] font-bold transition flex items-center gap-1"
                                title="1-faylni JSHSHR nomi bilan yuklab olish"
                              >
                                <Download className="w-3 h-3" />
                                Yuklab olish
                              </button>
                            </div>
                          </div>

                          {/* 2-fayl: Telefon raqami bilan */}
                          <div className="flex items-center justify-between p-2 rounded-lg bg-white border border-slate-200">
                            <div className="min-w-0">
                              <p className="text-[11px] font-bold text-slate-800 truncate">
                                2-Fayl: <span className="font-mono text-emerald-600">{cleanPhoneDigits(app.applicantStudent.phone1 || app.applicantStudent.phone || 'telefon')}.pdf</span>
                              </p>
                              <p className="text-[10px] text-slate-400">Diplom / Shahodatnoma (PDF)</p>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              {app.applicantStudent.certificateDoc && (
                                <button
                                  onClick={() => onPreviewDoc(app.applicantStudent.certificateDoc!)}
                                  className="p-1 text-slate-500 hover:text-blue-600 rounded hover:bg-slate-100 transition"
                                  title="Ko‘rish"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                </button>
                              )}
                              <button
                                onClick={() => downloadSecondPdf(app.applicantStudent.certificateDoc, app.applicantStudent.phone1 || app.applicantStudent.phone || '')}
                                className="px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded text-[10px] font-bold transition flex items-center gap-1"
                                title="2-faylni telefon raqami nomi bilan yuklab olish"
                              >
                                <Download className="w-3 h-3" />
                                Yuklab olish
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Friends List (1 to 5 friends) */}
                      {(app.friendsList && app.friendsList.length > 0 
                        ? app.friendsList 
                        : [app.friendStudent]
                      ).map((friend, fIdx) => (
                        <div key={fIdx} className="p-4 rounded-xl bg-slate-50/70 border border-slate-200 flex flex-col justify-between">
                          <div>
                            <div className="text-xs font-bold text-indigo-700 mb-2 flex items-center justify-between pb-1.5 border-b border-slate-200">
                              <span>{fIdx + 2}-Talaba ({fIdx + 1}-Sherik)</span>
                              <span className="font-mono text-[11px] text-slate-500">{friend.course}</span>
                            </div>
                            <div className="space-y-1.5 text-xs">
                              <p><strong className="text-slate-700">F.I.SH:</strong> {friend.fullName}</p>
                              <p><strong className="text-slate-700">JSHSHR:</strong> <span className="font-mono bg-white px-2 py-0.5 rounded border border-slate-200 font-bold">{friend.jshshr}</span></p>
                              <p><strong className="text-slate-700">Pasport:</strong> <span className="font-mono font-bold text-slate-900">{friend.passportSeria} {friend.passportNumber}</span></p>
                              <p><strong className="text-slate-700">1-Telefon:</strong> <span className="font-mono font-bold text-indigo-800">{friend.phone1 || friend.phone || 'Kiritilmagan'}</span></p>
                              <p><strong className="text-slate-700">2-Telefon:</strong> <span className="font-mono text-slate-700">{friend.phone2 || 'Kiritilmagan'}</span></p>
                              <p><strong className="text-slate-700">Fakultet:</strong> <span className="text-slate-600 block truncate">{friend.faculty}</span></p>
                            </div>
                          </div>

                          {/* PDF Download Buttons & Previews */}
                          <div className="mt-4 pt-3 border-t border-slate-200 space-y-2">
                            {/* 1-fayl: JSHSHR bilan */}
                            <div className="flex items-center justify-between p-2 rounded-lg bg-white border border-slate-200">
                              <div className="min-w-0">
                                <p className="text-[11px] font-bold text-slate-800 truncate">
                                  1-Fayl: <span className="font-mono text-indigo-600">{friend.jshshr}.pdf</span>
                                </p>
                                <p className="text-[10px] text-slate-400">Pasport nusxasi (PDF)</p>
                              </div>
                              <div className="flex items-center gap-1 shrink-0">
                                {friend.passportDoc && (
                                  <button
                                    onClick={() => onPreviewDoc(friend.passportDoc!)}
                                    className="p-1 text-slate-500 hover:text-indigo-600 rounded hover:bg-slate-100 transition"
                                    title="Ko‘rish"
                                  >
                                    <Eye className="w-3.5 h-3.5" />
                                  </button>
                                )}
                                <button
                                  onClick={() => downloadFirstPdf(friend.passportDoc, friend.jshshr)}
                                  className="px-2 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded text-[10px] font-bold transition flex items-center gap-1"
                                  title="1-faylni JSHSHR nomi bilan yuklab olish"
                                >
                                  <Download className="w-3 h-3" />
                                  Yuklab olish
                                </button>
                              </div>
                            </div>

                            {/* 2-fayl: Telefon raqami bilan */}
                            <div className="flex items-center justify-between p-2 rounded-lg bg-white border border-slate-200">
                              <div className="min-w-0">
                                <p className="text-[11px] font-bold text-slate-800 truncate">
                                  2-Fayl: <span className="font-mono text-emerald-600">{cleanPhoneDigits(friend.phone1 || friend.phone || 'telefon')}.pdf</span>
                                </p>
                                <p className="text-[10px] text-slate-400">Diplom / Shahodatnoma (PDF)</p>
                              </div>
                              <div className="flex items-center gap-1 shrink-0">
                                {friend.certificateDoc && (
                                  <button
                                    onClick={() => onPreviewDoc(friend.certificateDoc!)}
                                    className="p-1 text-slate-500 hover:text-indigo-600 rounded hover:bg-slate-100 transition"
                                    title="Ko‘rish"
                                  >
                                    <Eye className="w-3.5 h-3.5" />
                                  </button>
                                )}
                                <button
                                  onClick={() => downloadSecondPdf(friend.certificateDoc, friend.phone1 || friend.phone || '')}
                                  className="px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded text-[10px] font-bold transition flex items-center gap-1"
                                  title="2-faylni telefon raqami nomi bilan yuklab olish"
                                >
                                  <Download className="w-3 h-3" />
                                  Yuklab olish
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* IF FAMILY APPLICATION */}
                {app.type === 'family' && (
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                      {app.members.map((member, mIdx) => (
                        <div key={member.id} className="p-4 rounded-xl bg-slate-50/70 border border-slate-200 flex flex-col justify-between">
                          <div>
                            <div className="text-xs font-bold text-emerald-800 mb-2 flex items-center justify-between pb-1.5 border-b border-slate-200">
                              <span>{mIdx + 1}-A’zo: {member.relationship}</span>
                              <span className="font-mono text-[11px] text-slate-500">{member.course}</span>
                            </div>
                            <div className="space-y-1.5 text-xs mb-3">
                              <p><strong className="text-slate-700">F.I.SH:</strong> {member.fullName}</p>
                              <p><strong className="text-slate-700">JSHSHR:</strong> <span className="font-mono bg-white px-1.5 py-0.5 rounded border border-slate-200 font-bold">{member.jshshr}</span></p>
                              <p><strong className="text-slate-700">Pasport:</strong> <span className="font-mono font-bold text-slate-900">{member.passportSeria} {member.passportNumber}</span></p>
                              <p><strong className="text-slate-700">1-Telefon:</strong> <span className="font-mono font-bold text-emerald-800">{member.phone1 || member.phone || 'Kiritilmagan'}</span></p>
                              <p><strong className="text-slate-700">2-Telefon:</strong> <span className="font-mono text-slate-700">{member.phone2 || 'Kiritilmagan'}</span></p>
                              <p><strong className="text-slate-700">Fakultet:</strong> <span className="truncate block text-slate-600">{member.faculty}</span></p>
                            </div>
                          </div>

                          {/* PDF Download Buttons & Previews */}
                          <div className="space-y-2 pt-3 border-t border-slate-200">
                            {/* 1-fayl: JSHSHR bilan */}
                            <div className="flex items-center justify-between p-2 rounded-lg bg-white border border-slate-200">
                              <div className="min-w-0">
                                <p className="text-[11px] font-bold text-slate-800 truncate">
                                  1-Fayl: <span className="font-mono text-emerald-600">{member.jshshr}.pdf</span>
                                </p>
                                <p className="text-[10px] text-slate-400">Pasport nusxasi (PDF)</p>
                              </div>
                              <div className="flex items-center gap-1 shrink-0">
                                {member.passportDoc && (
                                  <button
                                    onClick={() => onPreviewDoc(member.passportDoc!)}
                                    className="p-1 text-slate-500 hover:text-emerald-600 rounded hover:bg-slate-100 transition"
                                    title="Ko‘rish"
                                  >
                                    <Eye className="w-3.5 h-3.5" />
                                  </button>
                                )}
                                <button
                                  onClick={() => downloadFirstPdf(member.passportDoc, member.jshshr)}
                                  className="px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded text-[10px] font-bold transition flex items-center gap-1"
                                  title="1-faylni JSHSHR nomi bilan yuklab olish"
                                >
                                  <Download className="w-3 h-3" />
                                  Yuklab olish
                                </button>
                              </div>
                            </div>

                            {/* 2-fayl: Telefon raqami bilan */}
                            <div className="flex items-center justify-between p-2 rounded-lg bg-white border border-slate-200">
                              <div className="min-w-0">
                                <p className="text-[11px] font-bold text-slate-800 truncate">
                                  2-Fayl: <span className="font-mono text-teal-600">{cleanPhoneDigits(member.phone1 || member.phone || 'telefon')}.pdf</span>
                                </p>
                                <p className="text-[10px] text-slate-400">Guvohnoma / Metrika (PDF)</p>
                              </div>
                              <div className="flex items-center gap-1 shrink-0">
                                {member.birthOrMarriageDoc && (
                                  <button
                                    onClick={() => onPreviewDoc(member.birthOrMarriageDoc!)}
                                    className="p-1 text-slate-500 hover:text-emerald-600 rounded hover:bg-slate-100 transition"
                                    title="Ko‘rish"
                                  >
                                    <Eye className="w-3.5 h-3.5" />
                                  </button>
                                )}
                                <button
                                  onClick={() => downloadSecondPdf(member.birthOrMarriageDoc, member.phone1 || member.phone || '')}
                                  className="px-2 py-1 bg-teal-50 hover:bg-teal-100 text-teal-700 rounded text-[10px] font-bold transition flex items-center gap-1"
                                  title="2-faylni telefon raqami nomi bilan yuklab olish"
                                >
                                  <Download className="w-3 h-3" />
                                  Yuklab olish
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Reject Modal */}
      {rejectModalAppId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <h3 className="text-sm font-bold text-slate-900 mb-2">Arizani rad etish sababi</h3>
            <p className="text-xs text-slate-500 mb-4">
              Talabaga nima sababdan rad etilganini tushuntirish uchun izoh qoldiring:
            </p>
            <textarea
              rows={3}
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Masalan: 14 talik JSHSHR yoki pasport ma’lumotlari noto‘g‘ri, PDF hujjat o‘rniga boshqa fayl yuklangan..."
              className="w-full p-2.5 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-rose-500 outline-hidden mb-4"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setRejectModalAppId(null)}
                className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Bekor qilish
              </button>
              <button
                onClick={handleRejectConfirm}
                className="px-4 py-1.5 text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white rounded-lg"
              >
                Rad etishni tasdiqlash
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Print Preview Modal */}
      {printApp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-8 shadow-2xl border border-slate-300 text-slate-900 max-h-[90vh] overflow-y-auto">
            <div className="text-center pb-4 border-b-2 border-slate-900 mb-6">
              <div className="flex justify-center mb-2">
                <UBSLogo size="lg" showText={false} />
              </div>
              <h2 className="text-base font-bold uppercase tracking-wider font-serif text-[#0B2559]">
                UNIVERSITY OF BUSINESS AND SCIENCES (UBS)
              </h2>
              <p className="text-xs text-slate-600 font-medium">
                Talaba arizasi va taqdim etilgan hujjatlar to‘g‘risida rasmiy ma’lumotnoma
              </p>
              <p className="text-[11px] font-mono text-slate-500 mt-1">№ {printApp.id} / Sana: {new Date(printApp.createdAt).toLocaleDateString('uz-UZ')}</p>
            </div>

            <div className="space-y-4 text-xs">
              <div className="flex justify-between border-b pb-2">
                <span className="text-slate-500">Dastur yo‘nalishi:</span>
                <span className="font-bold">{printApp.type === 'friends' ? 'Friends (Do‘stlar)' : 'Family (Oila)'}</span>
              </div>
              <div className="flex justify-between border-b pb-2">
                <span className="text-slate-500">Holat:</span>
                <span className="font-bold uppercase text-emerald-700">{printApp.status}</span>
              </div>
              <div className="flex justify-between border-b pb-2">
                <span className="text-slate-500">Ariza topshirilgan sana:</span>
                <span className="font-mono">{new Date(printApp.createdAt).toLocaleString('uz-UZ')}</span>
              </div>
            </div>

            <div className="mt-8 pt-6 border-t flex justify-between items-end text-xs">
              <div>
                <p className="font-semibold text-slate-700">Mas’ul admin imzosi:</p>
                <div className="w-36 border-b border-slate-400 mt-6" />
              </div>
              <div className="text-center">
                <div className="w-20 h-20 rounded-full border-2 border-dashed border-slate-400 flex items-center justify-center text-slate-400 text-[10px] font-bold mx-auto">
                  M.O‘. (MUHR)
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button
                onClick={() => setPrintApp(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Yopish
              </button>
              <button
                onClick={() => window.print()}
                className="px-4 py-2 text-xs font-semibold bg-blue-600 text-white rounded-lg"
              >
                Chop etish (Print)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ZIP Progress Modal */}
      {isZipping && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 text-center animate-in fade-in zoom-in-95 duration-200">
            <div className="w-16 h-16 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto mb-4 border border-indigo-100 shadow-inner">
              <Archive className="w-8 h-8 animate-pulse" />
            </div>
            <h3 className="text-base font-bold text-slate-900 mb-1">
              PDF Fayllar ZIP Arxivi Yaratilmoqda
            </h3>
            <p className="text-xs text-slate-500 mb-4 h-5 truncate px-2">
              {zipProgressText}
            </p>

            {/* Progress bar */}
            <div className="w-full bg-slate-100 rounded-full h-3.5 overflow-hidden border border-slate-200 p-0.5 mb-2">
              <div 
                className="bg-indigo-600 h-full rounded-full transition-all duration-300"
                style={{ width: `${zipProgressPercent}%` }}
              />
            </div>
            <div className="flex justify-between items-center text-[11px] text-slate-400 font-mono px-1">
              <span>Hujjatlar siqilmoqda</span>
              <span className="font-bold text-indigo-600">{zipProgressPercent}%</span>
            </div>
          </div>
        </div>
      )}

      {/* Change Admin Password Modal */}
      {isChangePasswordModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-7 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 border border-amber-200/60 flex items-center justify-center">
                  <KeyRound className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Admin Login va Parolini O‘zgartirish</h3>
                  <p className="text-[11px] text-slate-500">7 ta administrator uchun umumiy markaziy sozlama</p>
                </div>
              </div>
              <button 
                onClick={() => setIsChangePasswordModalOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleChangePasswordSubmit} className="space-y-4">
              {passwordChangeError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
                  <span>{passwordChangeError}</span>
                </div>
              )}

              {passwordChangeSuccess && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-700 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-500" />
                  <span>{passwordChangeSuccess}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Administrator Logini:
                </label>
                <input
                  type="text"
                  value={newAdminUsername}
                  onChange={(e) => setNewAdminUsername(e.target.value)}
                  placeholder="admin"
                  required
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-hidden bg-slate-50 focus:bg-white transition"
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  Amaldagi login: <span className="font-mono text-slate-600 font-bold">{adminCredentials?.username || 'admin'}</span> (shuningdek admin1..admin7 ham amal qiladi)
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Amaldagi (Joriy) Parol:
                </label>
                <input
                  type="password"
                  value={currentAdminPassword}
                  onChange={(e) => setCurrentAdminPassword(e.target.value)}
                  placeholder="Joriy parolni kiriting"
                  required
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-hidden bg-slate-50 focus:bg-white transition"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Yangi Parol:
                  </label>
                  <input
                    type="password"
                    value={newAdminPassword}
                    onChange={(e) => setNewAdminPassword(e.target.value)}
                    placeholder="Kamida 5 ta belgi"
                    required
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-hidden bg-slate-50 focus:bg-white transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Parolni Tasdiqlash:
                  </label>
                  <input
                    type="password"
                    value={confirmAdminPassword}
                    onChange={(e) => setConfirmAdminPassword(e.target.value)}
                    placeholder="Qayta kiriting"
                    required
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-hidden bg-slate-50 focus:bg-white transition"
                  />
                </div>
              </div>

              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/80 text-[11px] text-slate-500">
                💡 <span className="font-semibold text-slate-700">Eslatma:</span> Ushbu o‘zgarish Firebase bulut bazasiga saqlanadi va barcha 7 ta administratorning kirish paroli yangilanadi.
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsChangePasswordModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
                >
                  Bekor qilish
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl transition shadow-md cursor-pointer flex items-center gap-1.5"
                >
                  <KeyRound className="w-3.5 h-3.5" />
                  <span>Parolni Saqlash</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Video Tutorial Management Modal */}
      {isVideoModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-xs text-slate-900">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 sm:p-7 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl ${activeVideoTab === 'friends' ? 'bg-blue-50 text-blue-600 border border-blue-200/60' : 'bg-emerald-50 text-emerald-600 border border-emerald-200/60'} flex items-center justify-center`}>
                  <VideoIcon className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Video Qo‘llanmalarni Boshqarish va Yuklash</h3>
                  <p className="text-[11px] text-slate-500">Friends va Family loyihalari uchun alohida videolar</p>
                </div>
              </div>
              <button 
                onClick={() => setIsVideoModalOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Program Selection Tabs */}
            <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-2xl mb-4">
              <button
                type="button"
                onClick={() => setActiveVideoTab('friends')}
                className={`py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer ${
                  activeVideoTab === 'friends'
                    ? 'bg-white text-blue-600 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Users className="w-4 h-4" />
                <span>Friends Videosi</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveVideoTab('family')}
                className={`py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer ${
                  activeVideoTab === 'family'
                    ? 'bg-white text-emerald-600 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <HeartHandshake className="w-4 h-4" />
                <span>Family Videosi</span>
              </button>
            </div>

            {videoMessage && (
              <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-700 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                <span>{videoMessage}</span>
              </div>
            )}

            {/* Live Video Preview */}
            <div className="space-y-4">
              <div className="rounded-2xl overflow-hidden bg-black aspect-video border border-slate-200 shadow-inner relative">
                <video
                  key={currentTabSrc}
                  src={currentTabSrc}
                  controls
                  className="w-full h-full object-contain"
                >
                  <source src={currentTabSrc} type="video/mp4" />
                  Brauzer videoni qo‘llab-quvvatlamaydi.
                </video>
                <div className="absolute top-2 left-2 bg-black/70 backdrop-blur-xs text-white text-[10px] font-mono px-2.5 py-1 rounded-md border border-white/10">
                  {activeVideoTab === 'friends' ? 'Friends 10%' : 'Family 10%'} • {currentTabTitle}
                </div>
              </div>

              {/* Upload New File */}
              <div className="p-4 rounded-2xl bg-slate-50 border-2 border-dashed border-slate-200 hover:border-blue-400 transition text-center">
                <input
                  type="file"
                  ref={adminVideoInputRef}
                  accept="video/mp4,video/webm,video/ogg,video/quicktime"
                  onChange={handleAdminVideoUpload}
                  className="hidden"
                />
                <h4 className="text-xs font-bold text-slate-800 mb-1">
                  {activeVideoTab === 'friends' ? '«Friends»' : '«Family»'} uchun yangi video yuklash (.mp4)
                </h4>
                <p className="text-[11px] text-slate-500 mb-3">
                  Tanlangan video faqat {activeVideoTab === 'friends' ? 'Friends (Do‘stlar)' : 'Family (Oila a’zolari)'} arizasi sahifasida ko‘rsatiladi.
                </p>
                <button
                  type="button"
                  onClick={() => adminVideoInputRef.current?.click()}
                  className={`px-4 py-2 ${activeVideoTab === 'friends' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-emerald-600 hover:bg-emerald-700'} text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer inline-flex items-center gap-1.5`}
                >
                  <Upload className="w-3.5 h-3.5" />
                  {activeVideoTab === 'friends' ? 'Friends videoni tanlash (.mp4)' : 'Family videoni tanlash (.mp4)'}
                </button>
              </div>

              {/* Custom URL Input */}
              <form onSubmit={handleAdminVideoUrlSave} className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-700">
                  Yoki {activeVideoTab === 'friends' ? 'Friends' : 'Family'} uchun video URL havolasini kiriting:
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={videoCustomUrl}
                    onChange={(e) => setVideoCustomUrl(e.target.value)}
                    placeholder={activeVideoTab === 'friends' ? "/video_friends.mp4 yoki https://..." : "/video_family.mp4 yoki https://..."}
                    className="flex-1 px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-hidden bg-slate-50 focus:bg-white"
                  />
                  <button
                    type="submit"
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-semibold transition cursor-pointer shrink-0"
                  >
                    Saqlash
                  </button>
                </div>
              </form>

              {/* Footer info */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                <span className="text-[11px] text-slate-500">
                  {activeVideoTab === 'friends' ? 'Friends faol video:' : 'Family faol video:'}{' '}
                  <span className="font-mono text-slate-800 font-bold">{currentTabTitle}</span>
                </span>
                <button
                  type="button"
                  onClick={handleAdminResetVideo}
                  className="text-slate-500 hover:text-slate-800 flex items-center gap-1 cursor-pointer text-[11px] font-medium"
                >
                  <RotateCcw className="w-3 h-3" />
                  Standart ({activeVideoTab === 'friends' ? 'video_friends.mp4' : 'video_family.mp4'})
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================= STORAGE & SUPABASE DATABASE RESET MODAL (1GB Purge) ================= */}
      {isStorageModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 sm:p-7 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-200 max-h-[92vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center border border-rose-200">
                  <Database className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Supabase Baza va 1 GB Xotirani Tozalash</h3>
                  <p className="text-xs text-slate-500">Yuklangan fayllarni o‘chirish va ajratilgan 1 GB xotirani bo‘shatish</p>
                </div>
              </div>
              <button 
                onClick={() => setIsStorageModalOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Storage Usage Card */}
            <div className="p-4 rounded-2xl bg-slate-900 text-white mb-5 border border-slate-800 shadow-md">
              <div className="flex items-center justify-between text-xs mb-2">
                <div className="flex items-center gap-2">
                  <HardDrive className="w-4 h-4 text-rose-400" />
                  <span className="font-semibold text-slate-200">Supabase Xotira Holati:</span>
                </div>
                <span className="font-mono font-bold text-rose-300">
                  {storageStats.totalMB} MB / {storageQuotaMB} MB ({storagePercent}%)
                </span>
              </div>

              {/* Progress bar */}
              <div className="w-full h-2.5 bg-slate-800 rounded-full overflow-hidden mb-3 border border-slate-700/50">
                <div 
                  className={`h-full transition-all duration-500 rounded-full ${
                    storagePercent > 80 ? 'bg-rose-500' : storagePercent > 50 ? 'bg-amber-500' : 'bg-emerald-500'
                  }`}
                  style={{ width: `${Math.max(2, storagePercent)}%` }}
                />
              </div>

              <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-800/80 text-[11px]">
                <div>
                  <span className="text-slate-400 block">Jami arizalar:</span>
                  <span className="font-bold text-white font-mono">{applications.length} ta</span>
                </div>
                <div>
                  <span className="text-slate-400 block">Yuklangan fayllar:</span>
                  <span className="font-bold text-amber-300 font-mono">{storageStats.totalFiles} ta PDF</span>
                </div>
                <div>
                  <span className="text-slate-400 block">Band qilingan hajm:</span>
                  <span className="font-bold text-rose-300 font-mono">{storageStats.totalMB} MB</span>
                </div>
              </div>
            </div>

            {/* Storage Feedback Alert */}
            {storageFeedback && (
              <div className={`mb-5 p-3.5 rounded-2xl text-xs flex items-center gap-2.5 ${
                storageFeedback.type === 'success' 
                  ? 'bg-emerald-50 border border-emerald-200 text-emerald-800' 
                  : 'bg-rose-50 border border-rose-200 text-rose-800'
              }`}>
                {storageFeedback.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                )}
                <span className="font-medium">{storageFeedback.message}</span>
              </div>
            )}

            <div className="space-y-4">
              {/* Option 1: Complete Wipe & Restart (100% 1GB Free) */}
              <div className="p-4 rounded-2xl border-2 border-rose-200 bg-rose-50/50">
                <div className="flex items-start gap-3 mb-2">
                  <div className="w-8 h-8 rounded-xl bg-rose-600 text-white flex items-center justify-center shrink-0 mt-0.5 shadow-xs">
                    <Trash2 className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-rose-950">
                      1. Barcha arizalar va yuklangan fayllarni to‘liq o‘chirish (100% 1GB bo‘shatish)
                    </h4>
                    <p className="text-[11px] text-rose-700 mt-0.5 leading-relaxed">
                      Supabase PostgreSQL bazasidagi barcha arizalar va ularga biriktirilgan barcha PDF hujjatlarni to‘liq o‘chiradi, 1 GB xotirani 0 MB ga qaytaradi va tizimni yangitdan boshlaydi.
                    </p>
                  </div>
                </div>

                <div className="mt-3 pt-3 border-t border-rose-200/80">
                  <label className="block text-[11px] font-semibold text-rose-900 mb-1.5">
                    Tasdiqlash uchun quyidagi maydonga <span className="font-mono font-bold bg-white px-1.5 py-0.5 rounded-md border border-rose-300 text-rose-600">TOZALASH</span> so‘zini yozing:
                  </label>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      type="text"
                      value={confirmPurgeText}
                      onChange={(e) => setConfirmPurgeText(e.target.value)}
                      placeholder="TOZALASH"
                      className="flex-1 px-3 py-2 text-xs border border-rose-300 rounded-xl focus:ring-2 focus:ring-rose-500 outline-hidden bg-white uppercase font-mono font-bold text-rose-900"
                    />
                    <button
                      type="button"
                      onClick={handlePurgeAllApplications}
                      disabled={isClearingDb || confirmPurgeText.trim().toUpperCase() !== 'TOZALASH'}
                      className="px-4 py-2 bg-rose-600 hover:bg-rose-700 disabled:bg-slate-300 disabled:text-slate-500 text-white rounded-xl text-xs font-bold transition shadow-md cursor-pointer disabled:cursor-not-allowed flex items-center justify-center gap-1.5 shrink-0"
                    >
                      {isClearingDb ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Tozalanmoqda...</span>
                        </>
                      ) : (
                        <>
                          <Trash2 className="w-4 h-4" />
                          <span>Bazani to‘liq tozalash</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>

              {/* Option 2: Purge Heavy Base64 Files Only */}
              <div className="p-4 rounded-2xl border border-amber-200 bg-amber-50/40">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0 mt-0.5">
                      <FileText className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-amber-950">
                        2. Faqat og‘ir PDF fayllarni tozalash (Arizalarni saqlagan holda)
                      </h4>
                      <p className="text-[11px] text-amber-800 mt-0.5">
                        Talabalar arizalari ro‘yxati va holatlari saqlanadi, lekin ularning ichidagi og‘ir PDF fayllar olib tashlanadi va xotira bo‘shatiladi.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handlePurgeFilesOnly}
                    disabled={isClearingDb || applications.length === 0}
                    className="px-3.5 py-2 bg-amber-600 hover:bg-amber-700 disabled:bg-slate-300 text-white rounded-xl text-xs font-semibold transition cursor-pointer disabled:cursor-not-allowed shrink-0"
                  >
                    Fayllarni tozalash
                  </button>
                </div>
              </div>

              {/* Option 3: Supabase SQL Editor Direct Purge Command */}
              <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50">
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                    <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
                    <span>Supabase SQL Editor orqali 1 soniyada tozalash:</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleCopySql}
                    className="text-[11px] font-medium text-indigo-600 hover:text-indigo-700 flex items-center gap-1 cursor-pointer bg-white px-2.5 py-1 rounded-lg border border-slate-200 hover:border-indigo-300 transition"
                  >
                    {sqlCopied ? <CheckCircle2 className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                    <span>{sqlCopied ? 'Nusxalandi!' : 'SQL nusxalash'}</span>
                  </button>
                </div>
                <pre className="p-2.5 bg-slate-900 text-emerald-400 font-mono text-[11px] rounded-xl overflow-x-auto border border-slate-800">
                  {`TRUNCATE TABLE public.applications;`}
                </pre>
                <p className="text-[10px] text-slate-500 mt-1.5">
                  Supabase boshqaruv panelida <span className="font-semibold text-slate-700">SQL Editor</span> bo‘limiga o‘tib, ushbu kodni joylashtiring va <span className="font-semibold text-slate-700">"Run"</span> tugmasini bosing. PostgreSQL diskdagi barcha joyni bir zumda to‘liq bo‘shatadi.
                </p>
              </div>

              {/* Option 4: Supabase Unpause & Restart Guide */}
              <div className="p-4 rounded-2xl border border-blue-200 bg-blue-50/50">
                <div className="flex items-center gap-2 mb-2">
                  <RefreshCw className="w-4 h-4 text-blue-600" />
                  <h4 className="text-xs font-bold text-blue-950">Supabase Bazasini Qayta Ishga Tushirish (Unpause / Restore)</h4>
                </div>
                <ol className="text-[11px] text-blue-900 space-y-1.5 list-decimal list-inside leading-relaxed">
                  <li>
                    <strong><a href="https://supabase.com/dashboard" target="_blank" rel="noreferrer" className="underline text-blue-700 hover:text-blue-900">Supabase Dashboard</a></strong> ga kiring.
                  </li>
                  <li>
                    Agar loyihangizda <em>"Paused"</em> yoki <em>"Restricted"</em> yozuvi tursa, <strong className="text-emerald-700">"Restore Project"</strong> yoki <strong className="text-blue-700">"Resume"</strong> tugmasini bosing.
                  </li>
                  <li>
                    Loyihangiz 1–2 daqiqada qayta ishga tushgach, ushbu sahifada <strong>"Qayta ulash"</strong> tugmasini bosing.
                  </li>
                </ol>
              </div>

              {/* Option 5: Connect New/Fresh Supabase Project */}
              <div className="p-4 rounded-2xl border border-slate-200 bg-white shadow-xs">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <KeyRound className="w-4 h-4 text-slate-700" />
                    <h4 className="text-xs font-bold text-slate-900">Yangi Supabase Bazasini Ulash (URL & Anon Key)</h4>
                  </div>
                  <button
                    type="button"
                    onClick={handleResetSupabaseConfig}
                    className="text-[10px] text-slate-500 hover:text-slate-800 underline cursor-pointer"
                  >
                    Standartga qaytarish
                  </button>
                </div>
                <p className="text-[11px] text-slate-500 mb-3">
                  Agar yangi bepul Supabase loyihasi ochgan bo‘lsangiz, uning ma’lumotlarini shu yerga kiriting:
                </p>

                {supabaseConfigMsg && (
                  <div className={`mb-3 p-2.5 rounded-xl text-xs flex items-center gap-2 ${
                    supabaseConfigMsg.type === 'success' 
                      ? 'bg-emerald-50 border border-emerald-200 text-emerald-800' 
                      : 'bg-rose-50 border border-rose-200 text-rose-800'
                  }`}>
                    {supabaseConfigMsg.type === 'success' ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    ) : (
                      <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                    )}
                    <span>{supabaseConfigMsg.message}</span>
                  </div>
                )}

                <form onSubmit={handleSaveSupabaseConfig} className="space-y-2.5">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">Project URL</label>
                    <input
                      type="text"
                      value={customSupabaseUrl}
                      onChange={(e) => setCustomSupabaseUrl(e.target.value)}
                      placeholder="https://xyzcompany.supabase.co"
                      className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-hidden bg-slate-50 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">Project Anon Key (Public)</label>
                    <input
                      type="text"
                      value={customSupabaseKey}
                      onChange={(e) => setCustomSupabaseKey(e.target.value)}
                      placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                      className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-hidden bg-slate-50 font-mono"
                    />
                  </div>
                  <div className="flex justify-end pt-1">
                    <button
                      type="submit"
                      disabled={isTestingSupabaseConfig}
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer flex items-center gap-1.5"
                    >
                      {isTestingSupabaseConfig ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Tekshirilmoqda...</span>
                        </>
                      ) : (
                        <>
                          <Check className="w-3.5 h-3.5" />
                          <span>Saqlash va Ulanish</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>

              {/* Option 6: Personal Server (10GB) Connection */}
              <div className="p-4 rounded-2xl border border-emerald-200 bg-emerald-50/40">
                <div className="flex items-center gap-2 mb-2">
                  <Server className="w-4 h-4 text-emerald-600" />
                  <h4 className="text-xs font-bold text-emerald-950">Shaxsiy Server (10GB) ni Ulash</h4>
                </div>
                <p className="text-[11px] text-emerald-800 mb-3 leading-relaxed">
                  Agar sizda shaxsiy Linux yoki Windows serveringiz bo‘lsa, ushbu dasturni to‘liq u yerga ko‘chirib, 10GB joyingizdan cheksiz foydalanishingiz mumkin.
                </p>
                
                <div className="space-y-2">
                  <div className="flex items-center gap-2 p-2 bg-white rounded-xl border border-emerald-100">
                    <div className="w-6 h-6 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
                      <Globe className="w-3.5 h-3.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] font-bold text-slate-700">1. To‘liq o‘rnatish (Self-Hosted)</p>
                      <p className="text-[9px] text-slate-500 truncate">Serveringizda Node.js o‘rnating va loyihani yuklang.</p>
                    </div>
                    <button 
                      type="button"
                      onClick={() => window.open('/api/tools/download-server-setup-guide', '_blank')}
                      className="px-2 py-1 bg-emerald-600 text-white text-[9px] font-bold rounded-lg hover:bg-emerald-700 transition cursor-pointer"
                    >
                      Qo‘llanma
                    </button>
                  </div>

                  <div className="flex items-center gap-2 p-2 bg-white rounded-xl border border-emerald-100">
                    <div className="w-6 h-6 rounded-lg bg-indigo-100 text-indigo-600 flex items-center justify-center shrink-0">
                      <HardDrive className="w-3.5 h-3.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] font-bold text-slate-700">2. Tashqi Diskni Ulash (Remote API)</p>
                      <p className="text-[9px] text-slate-500 truncate">Fayllarni boshqa serveringizga yuborish.</p>
                    </div>
                    <button 
                      type="button"
                      onClick={() => showToast('Tez kunda: Masofaviy server API orqali ulash funksiyasi qo‘shiladi.')}
                      className="px-2 py-1 bg-indigo-600 text-white text-[9px] font-bold rounded-lg hover:bg-indigo-700 transition cursor-pointer"
                    >
                      Ulash
                    </button>
                  </div>
                </div>

                <div className="mt-3 p-2.5 bg-slate-900 rounded-xl border border-slate-800">
                  <p className="text-[10px] text-emerald-400 font-mono flex items-center gap-1.5 mb-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Serverda ishga tushirish buyrug‘i:
                  </p>
                  <code className="text-[10px] text-slate-300 font-mono block break-all">
                    git clone [loyha-linki] && npm install && npm run build && npm start
                  </code>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="pt-4 mt-5 border-t border-slate-100 flex items-center justify-end">
              <button
                type="button"
                onClick={() => setIsStorageModalOpen(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition cursor-pointer"
              >
                Yopish
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
