import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Send, 
  CheckCircle2, 
  HelpCircle,
  FileCheck,
  UserCheck,
  Phone,
  ShieldAlert
} from 'lucide-react';
import { DocumentFile, FriendsApplicationData, RegisteredUser, ContractSettings, StudentInfo } from '../types';
import { FileUploadField } from './FileUploadField';
import { VideoTutorialGuide } from './VideoTutorialGuide';
import { UNIVERSITIES_FACULTIES } from '../data/mockData';
import { 
  formatJshshr, 
  formatPassportSeria, 
  formatPassportNumber,
  formatPhoneNumber,
  cleanPhoneDigits
} from '../utils/formatters';
import { saveAuthenticDocument } from '../services/documentStorage';

interface FriendsApplicationFormProps {
  currentUser?: RegisteredUser;
  onPreviewDoc: (doc: DocumentFile) => void;
  onSubmitApplication: (app: FriendsApplicationData) => void;
  onRequireAuth: () => void;
  contractSettings: ContractSettings;
}

interface FriendItemState {
  id: string;
  fullName: string;
  jshshr: string;
  passportSeria: string;
  passportNumber: string;
  faculty: string;
  course: string;
  phone1: string; // 1-telefon raqami (majburiy)
  phone2: string; // 2-telefon raqami (majburiy)
  passportDoc?: DocumentFile; // 1-fayl: JSHSHR nomi bilan
  certificateDoc?: DocumentFile; // 2-fayl: Telefon raqami bilan
}

const createInitialFriend = (index: number): FriendItemState => ({
  id: `friend_${Date.now()}_${index}`,
  fullName: '',
  jshshr: '',
  passportSeria: '',
  passportNumber: '',
  faculty: UNIVERSITIES_FACULTIES[(index + 1) % UNIVERSITIES_FACULTIES.length],
  course: '1-bosqich',
  phone1: '+998 ',
  phone2: '+998 ',
  passportDoc: undefined,
  certificateDoc: undefined,
});

export const FriendsApplicationForm: React.FC<FriendsApplicationFormProps> = ({
  currentUser,
  onPreviewDoc,
  onSubmitApplication,
  onRequireAuth,
  contractSettings,
}) => {
  // Primary student fields (pre-filled if logged in)
  const [primaryName, setPrimaryName] = useState(currentUser?.fullName || '');
  const [primaryJshshr, setPrimaryJshshr] = useState(currentUser?.jshshr || '');

  useEffect(() => {
    if (currentUser?.fullName) setPrimaryName(currentUser.fullName);
    if (currentUser?.jshshr) setPrimaryJshshr(currentUser.jshshr);
  }, [currentUser]);

  const [primarySeria, setPrimarySeria] = useState('');
  const [primaryNumber, setPrimaryNumber] = useState('');
  const [primaryFaculty, setPrimaryFaculty] = useState(UNIVERSITIES_FACULTIES[0]);
  const [primaryCourse, setPrimaryCourse] = useState('1-bosqich');
  const [primaryPhone1, setPrimaryPhone1] = useState('+998 ');
  const [primaryPhone2, setPrimaryPhone2] = useState('+998 ');
  const [primaryPassportDoc, setPrimaryPassportDoc] = useState<DocumentFile | undefined>();
  const [primaryCertificateDoc, setPrimaryCertificateDoc] = useState<DocumentFile | undefined>();

  // Up to 5 friends selection (1 dan 5 tagacha tanlov)
  const [friendsCount, setFriendsCount] = useState<number>(1);
  const [friends, setFriends] = useState<FriendItemState[]>([createInitialFriend(0)]);

  const handleFriendsCountChange = (count: number) => {
    setFriendsCount(count);
    setFriends((prev) => {
      if (count > prev.length) {
        const added: FriendItemState[] = [];
        for (let i = prev.length; i < count; i++) {
          added.push(createInitialFriend(i));
        }
        return [...prev, ...added];
      } else {
        return prev.slice(0, count);
      }
    });
  };

  const updateFriendField = <K extends keyof FriendItemState>(
    index: number,
    field: K,
    value: FriendItemState[K]
  ) => {
    setFriends((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  };

  // Contract calculation from official admin settings
  const contractAmount = contractSettings?.friendsContractAmountUZS || 14000000;
  const discountRate = 0.10; // 10%
  const savedPerStudent = contractAmount * discountRate;
  const finalPerStudent = contractAmount - savedPerStudent;

  const [isSubmittedSuccess, setIsSubmittedSuccess] = useState(false);
  const [submittedId, setSubmittedId] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser && (!primaryName || primaryJshshr.length !== 14)) {
      onRequireAuth();
      return;
    }

    if (!primaryName.trim()) {
      setError('Asosiy talabaning to‘liq ism va familiyasini kiriting.');
      return;
    }

    if (primaryJshshr.length !== 14) {
      setError('Asosiy talabaning JSHSHR raqami to‘liq 14 ta raqam bo‘lishi lozim.');
      return;
    }

    if (!primarySeria || !primaryNumber) {
      setError('Asosiy talabaning pasport seriyasi va raqami to‘liq kiritilishi shart.');
      return;
    }

    // Check both phone numbers for primary applicant
    if (!cleanPhoneDigits(primaryPhone1) || cleanPhoneDigits(primaryPhone1).length < 9) {
      setError('Asosiy talabaning 1-telefon raqami to‘liq kiritilishi shart.');
      return;
    }
    if (!cleanPhoneDigits(primaryPhone2) || cleanPhoneDigits(primaryPhone2).length < 9) {
      setError('Asosiy talabaning 2-qo‘shimcha telefon raqami (ota-ona yoki 2-raqam) kiritilishi shart.');
      return;
    }

    if (!primaryPassportDoc) {
      setError('Asosiy talaba uchun 1-fayl: Pasport nusxasi (PDF) yuklanishi shart.');
      return;
    }

    if (!primaryCertificateDoc) {
      setError('Asosiy talaba uchun 2-fayl: Shahodatnoma yoki diplom hujjati (PDF) yuklanishi shart.');
      return;
    }

    // Validate each friend
    for (let i = 0; i < friends.length; i++) {
      const f = friends[i];
      if (!f.fullName.trim()) {
        setError(`${i + 1}-sherikning to‘liq F.I.SH (Ism-familiyasini) kiriting.`);
        return;
      }
      if (f.jshshr.length !== 14) {
        setError(`${i + 1}-sherikning JSHSHR raqami 14 ta raqam bo‘lishi shart.`);
        return;
      }
      if (!f.passportSeria || !f.passportNumber) {
        setError(`${i + 1}-sherikning pasport seriyasi va raqami to‘ldirilishi shart.`);
        return;
      }
      if (!cleanPhoneDigits(f.phone1) || cleanPhoneDigits(f.phone1).length < 9) {
        setError(`${i + 1}-sherikning 1-telefon raqami kiritilishi shart.`);
        return;
      }
      if (!cleanPhoneDigits(f.phone2) || cleanPhoneDigits(f.phone2).length < 9) {
        setError(`${i + 1}-sherikning 2-qo‘shimcha telefon raqami kiritilishi shart.`);
        return;
      }
      if (!f.passportDoc) {
        setError(`${i + 1}-sherik uchun 1-fayl: Pasport nusxasi (PDF) yuklanishi shart.`);
        return;
      }
      if (!f.certificateDoc) {
        setError(`${i + 1}-sherik uchun 2-fayl: Shahodatnoma yoki diplom hujjati (PDF) yuklanishi shart.`);
        return;
      }
    }

    setError('');
    const newId = 'APP-FR-' + Math.floor(1000 + Math.random() * 9000);

    const safePrimaryPhoneClean = cleanPhoneDigits(primaryPhone1);
    
    // Ensure authentic documents are registered with final student JSHSHR and Phone aliases
    if (primaryPassportDoc) {
      saveAuthenticDocument(
        primaryPassportDoc.id,
        `${primaryJshshr}.pdf`,
        primaryPassportDoc.dataUrl || primaryPassportDoc.url,
        primaryPassportDoc.size,
        primaryPassportDoc.dataUrl,
        [primaryJshshr]
      ).catch(() => {});
    }

    if (primaryCertificateDoc) {
      saveAuthenticDocument(
        primaryCertificateDoc.id,
        `${safePrimaryPhoneClean}.pdf`,
        primaryCertificateDoc.dataUrl || primaryCertificateDoc.url,
        primaryCertificateDoc.size,
        primaryCertificateDoc.dataUrl,
        [safePrimaryPhoneClean, safePrimaryPhoneClean.slice(3)]
      ).catch(() => {});
    }

    const finalizedPrimaryPassport: DocumentFile | undefined = primaryPassportDoc ? {
      ...primaryPassportDoc,
      name: `${primaryJshshr}.pdf`,
      url: primaryPassportDoc.url || `/api/documents/${primaryPassportDoc.id}`
    } : undefined;

    const finalizedPrimaryCertificate: DocumentFile | undefined = primaryCertificateDoc ? {
      ...primaryCertificateDoc,
      name: `${safePrimaryPhoneClean}.pdf`,
      url: primaryCertificateDoc.url || `/api/documents/${primaryCertificateDoc.id}`
    } : undefined;

    const friendsList: StudentInfo[] = friends.map((f) => {
      const cleanPhone = cleanPhoneDigits(f.phone1);

      if (f.passportDoc) {
        saveAuthenticDocument(
          f.passportDoc.id,
          `${f.jshshr}.pdf`,
          f.passportDoc.dataUrl || f.passportDoc.url,
          f.passportDoc.size,
          f.passportDoc.dataUrl,
          [f.jshshr]
        ).catch(() => {});
      }

      if (f.certificateDoc) {
        saveAuthenticDocument(
          f.certificateDoc.id,
          `${cleanPhone}.pdf`,
          f.certificateDoc.dataUrl || f.certificateDoc.url,
          f.certificateDoc.size,
          f.certificateDoc.dataUrl,
          [cleanPhone, cleanPhone.slice(3)]
        ).catch(() => {});
      }

      const safePassport: DocumentFile | undefined = f.passportDoc ? {
        ...f.passportDoc,
        name: `${f.jshshr}.pdf`,
        url: f.passportDoc.url || `/api/documents/${f.passportDoc.id}`
      } : undefined;

      const safeCertificate: DocumentFile | undefined = f.certificateDoc ? {
        ...f.certificateDoc,
        name: `${cleanPhone}.pdf`,
        url: f.certificateDoc.url || `/api/documents/${f.certificateDoc.id}`
      } : undefined;

      return {
        fullName: f.fullName.trim(),
        jshshr: f.jshshr,
        passportSeria: f.passportSeria || 'AB',
        passportNumber: f.passportNumber || '0000000',
        faculty: f.faculty,
        course: f.course,
        phone1: f.phone1,
        phone2: f.phone2,
        phone: f.phone1,
        passportDoc: safePassport,
        certificateDoc: safeCertificate,
      };
    });

    const newApp: FriendsApplicationData = {
      id: newId,
      type: 'friends',
      createdAt: new Date().toISOString(),
      status: 'kutilmoqda',
      contractAmountUZS: contractAmount,
      discountRate: 0.10,
      savedAmountUZS: savedPerStudent,
      finalAmountUZS: finalPerStudent,
      friendsCount: friendsCount,
      applicantStudent: {
        fullName: primaryName.trim(),
        jshshr: primaryJshshr,
        passportSeria: primarySeria || 'AA',
        passportNumber: primaryNumber || '0000000',
        faculty: primaryFaculty,
        course: primaryCourse,
        phone1: primaryPhone1,
        phone2: primaryPhone2,
        phone: primaryPhone1,
        passportDoc: finalizedPrimaryPassport,
        certificateDoc: finalizedPrimaryCertificate,
      },
      friendStudent: friendsList[0],
      friendsList: friendsList,
    };

    onSubmitApplication(newApp);
    setSubmittedId(newId);
    setIsSubmittedSuccess(true);
  };

  if (isSubmittedSuccess) {
    return (
      <div className="max-w-2xl mx-auto bg-white rounded-3xl p-8 border border-emerald-200 shadow-xl text-center">
        <div className="w-16 h-16 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto mb-4">
          <CheckCircle2 className="w-8 h-8" />
        </div>
        <h2 className="text-2xl font-bold text-slate-900 mb-2">
          Ariza muvaffaqiyatli yuborildi!
        </h2>
        <p className="text-sm text-slate-600 mb-6">
          Siz va {friendsCount} nafar sherigingiz uchun <strong className="text-blue-600 font-mono">{submittedId}</strong> raqamli 
          ariza ro‘yxatga olindi va universitet ma’muriyatiga (adminga) yo‘naltirildi.
        </p>

        <div className="bg-slate-50 rounded-2xl p-5 border border-slate-200 text-left mb-6 space-y-3">
          <div className="flex justify-between items-center text-xs pb-2 border-b border-slate-200">
            <span className="text-slate-500">Ariza turi:</span>
            <span className="font-semibold text-slate-800">Friends Dasturi ({friendsCount + 1} nafar talaba)</span>
          </div>
          <div className="flex justify-between items-center text-xs pb-2 border-b border-slate-200">
            <span className="text-slate-500">Kafolatlangan chegirma:</span>
            <span className="font-bold text-emerald-600">10% chegirma</span>
          </div>
          <div className="flex justify-between items-center text-xs pb-2 border-b border-slate-200">
            <span className="text-slate-500">Asosiy arizachi:</span>
            <span className="font-medium text-slate-800">{primaryName}</span>
          </div>
          <div className="flex justify-between items-center text-xs pb-2 border-b border-slate-200">
            <span className="text-slate-500">1-telefon / 2-telefon:</span>
            <span className="font-mono text-slate-700">{primaryPhone1} / {primaryPhone2}</span>
          </div>
          <div className="flex justify-between items-center text-xs">
            <span className="text-slate-500">Ariza holati:</span>
            <span className="px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 font-semibold text-[11px]">
              Kutilmoqda (Admin tekshiruvida)
            </span>
          </div>
        </div>

        <div className="flex justify-center gap-3">
          <button
            onClick={() => setIsSubmittedSuccess(false)}
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl shadow-md transition cursor-pointer"
          >
            Yangi ariza topshirish
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* 1. Video Tutorial on top as specifically requested */}
      <VideoTutorialGuide type="friends" />

      {/* 2. Directly the Application Form (No intermediate 10% calculation cards) */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}

        {/* 5-choice selection for friends: strictly 1 to 5 as requested */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="w-6 h-6 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-xs">
                <Users className="w-3.5 h-3.5" />
              </span>
              <label className="text-sm font-bold text-slate-900">
                Sheriklar sonini tanlang (1 dan 5 tagacha):
              </label>
            </div>
            <p className="text-xs text-slate-500">
              Siz bilan birga nechta do‘stingiz o‘qishga kirmoqda? (Atiga 5 talik tanlov)
            </p>
          </div>

          <div className="flex items-center gap-2">
            {[1, 2, 3, 4, 5].map((num) => (
              <button
                key={num}
                type="button"
                onClick={() => handleFriendsCountChange(num)}
                className={`w-10 h-10 rounded-xl text-xs font-bold transition flex items-center justify-center cursor-pointer shrink-0 ${
                  friendsCount === num
                    ? 'bg-blue-600 text-white shadow-md ring-2 ring-blue-600 ring-offset-2'
                    : 'bg-white text-slate-700 hover:bg-blue-50 border border-slate-300'
                }`}
              >
                {num}
              </button>
            ))}
          </div>
        </div>

        {/* 1-Student: Applicant */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-200">
            <div className="flex items-center gap-2.5">
              <span className="w-7 h-7 rounded-full bg-blue-600 text-white font-bold text-xs flex items-center justify-center">
                1
              </span>
              <div>
                <h3 className="text-sm font-bold text-slate-800">
                  Ariza beruvchi talaba ma’lumotlari (Asosiy arizachi)
                </h3>
                <p className="text-[11px] text-slate-400">
                  O‘zingizning pasport va shaxsiy ta’lim ma’lumotlaringiz
                </p>
              </div>
            </div>
            {currentUser && (
              <span className="text-xs px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 font-medium flex items-center gap-1">
                <UserCheck className="w-3.5 h-3.5" />
                JSHSHR tasdiqlangan
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Ism, Familiya va Otasining ismi <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={primaryName}
                onChange={(e) => setPrimaryName(e.target.value)}
                placeholder="Aliyev Bekzod Jamshidovich"
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-hidden"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                JSHSHR (PINFL - 14 ta raqam) <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                maxLength={14}
                value={primaryJshshr}
                onChange={(e) => setPrimaryJshshr(formatJshshr(e.target.value))}
                placeholder="31405021234567"
                className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-hidden tracking-wider"
              />
            </div>

            {/* Separate passport seria & number */}
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Pasport seriya <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  maxLength={2}
                  value={primarySeria}
                  onChange={(e) => setPrimarySeria(formatPassportSeria(e.target.value))}
                  placeholder="AA"
                  className="w-full px-3 py-2 text-xs font-mono text-center uppercase border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-hidden"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Pasport raqami <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  maxLength={7}
                  value={primaryNumber}
                  onChange={(e) => setPrimaryNumber(formatPassportNumber(e.target.value))}
                  placeholder="1234567"
                  className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-hidden"
                />
              </div>
            </div>

            {/* 1-Telefon raqami (Majburiy) */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                1-Telefon raqami (Asosiy) <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  required
                  value={primaryPhone1}
                  onChange={(e) => setPrimaryPhone1(formatPhoneNumber(e.target.value))}
                  placeholder="+998 (90) 123 45 67"
                  className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-hidden"
                />
              </div>
            </div>

            {/* 2-Telefon raqami (Majburiy) */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                2-Telefon raqami (Qo‘shimcha / Ota-ona) <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  required
                  value={primaryPhone2}
                  onChange={(e) => setPrimaryPhone2(formatPhoneNumber(e.target.value))}
                  placeholder="+998 (93) 765 43 21"
                  className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-hidden"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Fakultet / Ta’lim yo‘nalishi
              </label>
              <select
                value={primaryFaculty}
                onChange={(e) => setPrimaryFaculty(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-hidden"
              >
                {UNIVERSITIES_FACULTIES.map((fac, idx) => (
                  <option key={idx} value={fac}>{fac}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Bosqich (Kurs)
              </label>
              <select
                value={primaryCourse}
                onChange={(e) => setPrimaryCourse(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-hidden"
              >
                <option value="1-bosqich">1-bosqich</option>
                <option value="2-bosqich">2-bosqich</option>
                <option value="3-bosqich">3-bosqich</option>
                <option value="4-bosqich">4-bosqich</option>
                <option value="5-bosqich">5-bosqich</option>
                <option value="Magistratura 1">Magistratura 1-bosqich</option>
              </select>
            </div>
          </div>

          {/* 2 PDF uploads for primary applicant: 1-fayl JSHSHR, 2-fayl Telefon */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-3 border-t border-slate-100">
            <FileUploadField
              id="primary-passport"
              label="1. Pasport yoki ID-karta (Faqat PDF)"
              subLabel="Fayl avtomatik JSHSHR raqami bilan nomlanadi (.pdf)"
              desiredFileName={`${primaryJshshr || 'asosiy_talaba_pasport'}.pdf`}
              studentJshshr={primaryJshshr}
              studentPhone={primaryPhone1}
              sampleJshshr={primaryJshshr}
              document={primaryPassportDoc}
              onChange={setPrimaryPassportDoc}
              onPreview={onPreviewDoc}
              sampleTitle="Pasport nusxasi"
              sampleSub={`${primarySeria || 'AA'} ${primaryNumber || '1234567'}`}
              required
            />

            <FileUploadField
              id="primary-certificate"
              label="2. Shahodatnoma yoki Diplom (Faqat PDF)"
              subLabel="Fayl avtomatik telefon raqami bilan nomlanadi (.pdf)"
              desiredFileName={`${cleanPhoneDigits(primaryPhone1) || 'asosiy_talaba_telefon'}.pdf`}
              studentJshshr={primaryJshshr}
              studentPhone={primaryPhone1}
              document={primaryCertificateDoc}
              onChange={setPrimaryCertificateDoc}
              onPreview={onPreviewDoc}
              sampleTitle="1-talaba Diplomi"
              sampleSub="Seriya B № 482910"
              required
            />
          </div>
        </div>

        {/* Dynamic Friend Cards (1 dan 5 tagacha sheriklar) */}
        {friends.map((friend, index) => (
          <div 
            key={friend.id}
            className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs space-y-4"
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2.5">
                <span className="w-7 h-7 rounded-full bg-indigo-600 text-white font-bold text-xs flex items-center justify-center">
                  {index + 2}
                </span>
                <div>
                  <h3 className="text-sm font-bold text-slate-800">
                    {index + 1}-Sherik (Do‘st) ma’lumotlari
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Siz bilan birga o‘qishga topshirayotgan sherigingiz ma’lumotlari
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Sherikning F.I.SH (Ism, Familiya, Otasining ismi) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={friend.fullName}
                  onChange={(e) => updateFriendField(index, 'fullName', e.target.value)}
                  placeholder="Sobirov Jasur Bahodirovich"
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  JSHSHR (PINFL - 14 ta raqam) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  maxLength={14}
                  value={friend.jshshr}
                  onChange={(e) => updateFriendField(index, 'jshshr', formatJshshr(e.target.value))}
                  placeholder="32406034567890"
                  className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-hidden tracking-wider"
                />
              </div>

              {/* Separate passport seria & number */}
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Pasport seriya <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    maxLength={2}
                    value={friend.passportSeria}
                    onChange={(e) => updateFriendField(index, 'passportSeria', formatPassportSeria(e.target.value))}
                    placeholder="AB"
                    className="w-full px-3 py-2 text-xs font-mono text-center uppercase border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-hidden"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Pasport raqami <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    maxLength={7}
                    value={friend.passportNumber}
                    onChange={(e) => updateFriendField(index, 'passportNumber', formatPassportNumber(e.target.value))}
                    placeholder="7654321"
                    className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-hidden"
                  />
                </div>
              </div>

              {/* 1-Telefon raqami (Majburiy) */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  1-Telefon raqami (Asosiy) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={friend.phone1}
                  onChange={(e) => updateFriendField(index, 'phone1', formatPhoneNumber(e.target.value))}
                  placeholder="+998 (91) 987 65 43"
                  className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-hidden"
                />
              </div>

              {/* 2-Telefon raqami (Majburiy) */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  2-Telefon raqami (Qo‘shimcha / Ota-ona) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={friend.phone2}
                  onChange={(e) => updateFriendField(index, 'phone2', formatPhoneNumber(e.target.value))}
                  placeholder="+998 (97) 543 21 00"
                  className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Fakultet / Ta’lim yo‘nalishi
                </label>
                <select
                  value={friend.faculty}
                  onChange={(e) => updateFriendField(index, 'faculty', e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-hidden"
                >
                  {UNIVERSITIES_FACULTIES.map((fac, idx) => (
                    <option key={idx} value={fac}>{fac}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Bosqich (Kurs)
                </label>
                <select
                  value={friend.course}
                  onChange={(e) => updateFriendField(index, 'course', e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-hidden"
                >
                  <option value="1-bosqich">1-bosqich</option>
                  <option value="2-bosqich">2-bosqich</option>
                  <option value="3-bosqich">3-bosqich</option>
                  <option value="4-bosqich">4-bosqich</option>
                </select>
              </div>
            </div>

            {/* 2 PDF uploads for friend: 1-fayl JSHSHR, 2-fayl Telefon */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-3 border-t border-slate-100">
              <FileUploadField
                id={`friend-passport-${index}`}
                label={`1. Sherik #${index + 1} Pasport yoki ID-karta (Faqat PDF)`}
                subLabel="Fayl avtomatik sherikning JSHSHR raqami bilan nomlanadi (.pdf)"
                desiredFileName={`${friend.jshshr || `sherik_${index + 1}_pasport`}.pdf`}
                studentJshshr={friend.jshshr}
                studentPhone={friend.phone1}
                sampleJshshr={friend.jshshr}
                document={friend.passportDoc}
                onChange={(doc) => updateFriendField(index, 'passportDoc', doc)}
                onPreview={onPreviewDoc}
                sampleTitle={`Sherik #${index + 1} Pasporti`}
                sampleSub={`${friend.passportSeria || 'AB'} ${friend.passportNumber || '7654321'}`}
                required
              />

              <FileUploadField
                id={`friend-certificate-${index}`}
                label={`2. Sherik #${index + 1} Shahodatnoma yoki Diplom (Faqat PDF)`}
                subLabel="Fayl avtomatik sherikning telefon raqami bilan nomlanadi (.pdf)"
                desiredFileName={`${cleanPhoneDigits(friend.phone1) || `sherik_${index + 1}_telefon`}.pdf`}
                studentJshshr={friend.jshshr}
                studentPhone={friend.phone1}
                document={friend.certificateDoc}
                onChange={(doc) => updateFriendField(index, 'certificateDoc', doc)}
                onPreview={onPreviewDoc}
                sampleTitle={`Sherik #${index + 1} Hujjati`}
                sampleSub="Seriya UM № 938210"
                required
              />
            </div>
          </div>
        ))}

        {/* Submit bar */}
        <div className="p-4 bg-slate-100 rounded-2xl flex flex-wrap items-center justify-between gap-4 border border-slate-200">
          <div className="text-xs text-slate-600 flex items-center gap-2">
            <FileCheck className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>Ma’lumotlar tekshiruv uchun universitet adminiga to‘g‘ridan-to‘g‘ri yuboriladi.</span>
          </div>

          <button
            type="submit"
            className="px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-xs font-bold rounded-xl shadow-lg transition flex items-center gap-2 cursor-pointer"
          >
            <Send className="w-4 h-4" />
            <span>Arizani Adminga Yuborish</span>
          </button>
        </div>
      </form>
    </div>
  );
};
