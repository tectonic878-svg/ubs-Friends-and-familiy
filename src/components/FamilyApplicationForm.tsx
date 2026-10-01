import React, { useState, useEffect } from 'react';
import { 
  Users2, 
  Send, 
  CheckCircle2, 
  FileCheck,
  ShieldAlert,
  UserCheck
} from 'lucide-react';
import { 
  FamilyApplicationData, 
  FamilyMemberInfo, 
  FamilyRelationship, 
  DocumentFile, 
  RegisteredUser,
  ContractSettings 
} from '../types';
import { FileUploadField } from './FileUploadField';
import { VideoTutorialGuide } from './VideoTutorialGuide';
import { UNIVERSITIES_FACULTIES } from '../data/mockData';
import { saveAuthenticDocument } from '../services/documentStorage';
import { 
  formatJshshr, 
  formatPassportSeria, 
  formatPassportNumber,
  formatPhoneNumber,
  cleanPhoneDigits
} from '../utils/formatters';

interface FamilyApplicationFormProps {
  currentUser?: RegisteredUser;
  onPreviewDoc: (doc: DocumentFile) => void;
  onSubmitApplication: (app: FamilyApplicationData) => void;
  onRequireAuth: () => void;
  contractSettings: ContractSettings;
}

const RELATIONSHIPS: FamilyRelationship[] = [
  'O‘zi (Asosiy ariza beruvchi)',
  'Aka',
  'Uka',
  'Opa',
  'Singil',
  'Ota',
  'Ona',
  'Farzand',
  'Turmush o‘rtog‘i'
];

export const FamilyApplicationForm: React.FC<FamilyApplicationFormProps> = ({
  currentUser,
  onPreviewDoc,
  onSubmitApplication,
  onRequireAuth,
  contractSettings,
}) => {
  // Members count: strictly 1 to 5 as requested (atiga 5 talik tanlov)
  const [membersCount, setMembersCount] = useState<number>(2);
  const contractPerStudent = contractSettings?.familyContractAmountPerStudentUZS || 13000000;
  const [isSubmittedSuccess, setIsSubmittedSuccess] = useState(false);
  const [submittedId, setSubmittedId] = useState('');
  const [error, setError] = useState('');

  // Generate initial member
  const createEmptyMember = (index: number): FamilyMemberInfo => ({
    id: 'mem_' + (index + 1),
    relationship: index === 0 ? 'O‘zi (Asosiy ariza beruvchi)' : (index === 1 ? 'Uka' : 'Singil'),
    fullName: index === 0 && currentUser ? currentUser.fullName : '',
    jshshr: index === 0 && currentUser ? currentUser.jshshr : '',
    passportSeria: '',
    passportNumber: '',
    faculty: UNIVERSITIES_FACULTIES[index % UNIVERSITIES_FACULTIES.length],
    course: '1-bosqich',
    phone1: '+998 ',
    phone2: '+998 ',
    phone: '+998 ',
    passportDoc: undefined,
    birthOrMarriageDoc: undefined
  });

  const [members, setMembers] = useState<FamilyMemberInfo[]>([
    createEmptyMember(0),
    createEmptyMember(1)
  ]);

  useEffect(() => {
    if (currentUser?.fullName || currentUser?.jshshr) {
      setMembers((prev) => {
        if (!prev || prev.length === 0) return prev;
        const copy = [...prev];
        if (!copy[0].fullName && currentUser.fullName) {
          copy[0] = { ...copy[0], fullName: currentUser.fullName };
        }
        if (!copy[0].jshshr && currentUser.jshshr) {
          copy[0] = { ...copy[0], jshshr: currentUser.jshshr };
        }
        return copy;
      });
    }
  }, [currentUser]);

  // Handle members count change strictly within 1 to 5
  const handleCountChange = (newCount: number) => {
    const validCount = Math.min(Math.max(newCount, 1), 5);
    setMembersCount(validCount);
    setMembers((prev) => {
      const next = [...prev];
      if (validCount > prev.length) {
        for (let i = prev.length; i < validCount; i++) {
          next.push(createEmptyMember(i));
        }
      } else {
        next.splice(validCount);
      }
      return next;
    });
  };

  const updateMember = (index: number, patch: Partial<FamilyMemberInfo>) => {
    setMembers((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], ...patch };
      return updated;
    });
  };

  // Fixed 10% discount calculation
  const discountRate = 0.10;
  const totalContract = contractPerStudent * membersCount;
  const totalSaved = totalContract * discountRate;
  const totalFinal = totalContract - totalSaved;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser && (!members[0]?.fullName || members[0]?.jshshr?.length !== 14)) {
      onRequireAuth();
      return;
    }

    // Validate each member
    for (let i = 0; i < members.length; i++) {
      const m = members[i];
      if (!m.fullName.trim()) {
        setError(`${i + 1}-oila a’zosining to‘liq ism familiyasini kiriting.`);
        return;
      }
      if (m.jshshr.length !== 14) {
        setError(`${i + 1}-oila a’zosi (${m.fullName || 'Talaba'})ning JSHSHR raqami to‘liq 14 ta raqam bo‘lishi shart.`);
        return;
      }
      if (!m.passportSeria || !m.passportNumber) {
        setError(`${i + 1}-oila a’zosi pasport seriyasi va raqami to‘ldirilishi shart.`);
        return;
      }
      if (!cleanPhoneDigits(m.phone1) || cleanPhoneDigits(m.phone1).length < 9) {
        setError(`${i + 1}-oila a’zosining 1-telefon raqami to‘liq kiritilishi shart.`);
        return;
      }
      if (!cleanPhoneDigits(m.phone2) || cleanPhoneDigits(m.phone2).length < 9) {
        setError(`${i + 1}-oila a’zosining 2-qo‘shimcha telefon raqami kiritilishi shart.`);
        return;
      }
      if (!m.passportDoc) {
        setError(`${i + 1}-oila a’zosi (${m.fullName})ning 1-fayl: Pasport nusxasi (PDF) yuklanmagan.`);
        return;
      }
      if (!m.birthOrMarriageDoc) {
        setError(`${i + 1}-oila a’zosi (${m.fullName})ning 2-fayl: Tug‘ilganlik yoki qarindoshlik guvohnomasi (PDF) yuklanmagan.`);
        return;
      }
    }

    setError('');
    const newId = 'APP-FM-' + Math.floor(2000 + Math.random() * 8000);

    const finalizedMembers: FamilyMemberInfo[] = members.map((m) => {
      const cleanPhone = cleanPhoneDigits(m.phone1);

      if (m.passportDoc) {
        saveAuthenticDocument(
          m.passportDoc.id,
          `${m.jshshr}.pdf`,
          m.passportDoc.dataUrl || m.passportDoc.url,
          m.passportDoc.size,
          m.passportDoc.dataUrl,
          [m.jshshr]
        ).catch(() => {});
      }

      if (m.birthOrMarriageDoc) {
        saveAuthenticDocument(
          m.birthOrMarriageDoc.id,
          `${cleanPhone || m.jshshr + '_guvohnoma'}.pdf`,
          m.birthOrMarriageDoc.dataUrl || m.birthOrMarriageDoc.url,
          m.birthOrMarriageDoc.size,
          m.birthOrMarriageDoc.dataUrl,
          [cleanPhone, m.jshshr, cleanPhone.slice(3)]
        ).catch(() => {});
      }

      const safePassport: DocumentFile | undefined = m.passportDoc ? {
        ...m.passportDoc,
        name: `${m.jshshr}.pdf`,
        url: m.passportDoc.url || `/api/documents/${m.passportDoc.id}`
      } : undefined;

      const safeBirthDoc: DocumentFile | undefined = m.birthOrMarriageDoc ? {
        ...m.birthOrMarriageDoc,
        name: `${cleanPhone || m.jshshr + '_guvohnoma'}.pdf`,
        url: m.birthOrMarriageDoc.url || `/api/documents/${m.birthOrMarriageDoc.id}`
      } : undefined;

      return {
        ...m,
        passportDoc: safePassport,
        birthOrMarriageDoc: safeBirthDoc,
      };
    });

    const newApp: FamilyApplicationData = {
      id: newId,
      type: 'family',
      createdAt: new Date().toISOString(),
      status: 'kutilmoqda',
      membersCount,
      members: finalizedMembers,
      contractAmountPerStudentUZS: contractPerStudent,
      discountRate: 0.10,
      totalContractAmountUZS: totalContract,
      totalSavedAmountUZS: totalSaved,
      totalFinalAmountUZS: totalFinal
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
          Family arizasi muvaffaqiyatli topshirildi!
        </h2>
        <p className="text-sm text-slate-600 mb-6">
          Oila tarifi bo‘yicha <strong className="text-blue-600 font-mono">{submittedId}</strong> raqamli 
          arizangiz {membersCount} nafar oila a’zosi uchun adminga yo‘naltirildi.
        </p>

        <div className="bg-slate-50 rounded-2xl p-5 border border-slate-200 text-left mb-6 space-y-3">
          <div className="flex justify-between items-center text-xs pb-2 border-b border-slate-200">
            <span className="text-slate-500">Dastur:</span>
            <span className="font-semibold text-slate-800">Family (Oila) Dasturi</span>
          </div>
          <div className="flex justify-between items-center text-xs pb-2 border-b border-slate-200">
            <span className="text-slate-500">O‘qiyotgan oila a’zolari soni:</span>
            <span className="font-bold text-blue-600">{membersCount} nafar talaba</span>
          </div>
          <div className="flex justify-between items-center text-xs pb-2 border-b border-slate-200">
            <span className="text-slate-500">Kafolatlangan chegirma:</span>
            <span className="font-bold text-emerald-600">Har bir talabaga 10% chegirma</span>
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
            Yangi ariza shakllantirish
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* 1. Video Tutorial on top as specifically requested */}
      <VideoTutorialGuide type="family" />

      {/* 2. Directly the Application Form (No intermediate 10% calculation reports) */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}

        {/* 5-choice selection for family members */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="w-6 h-6 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold text-xs">
                <Users2 className="w-3.5 h-3.5" />
              </span>
              <label className="text-sm font-bold text-slate-900">
                Oila a’zolari sonini tanlang (1 dan 5 tagacha):
              </label>
            </div>
            <p className="text-xs text-slate-500">
              Oila a’zolari soni bo‘yicha atiga 5 talik tanlov (1 dan 5 nafargacha oila a’zosi)
            </p>
          </div>

          <div className="flex items-center gap-2">
            {[1, 2, 3, 4, 5].map((num) => (
              <button
                key={num}
                type="button"
                onClick={() => handleCountChange(num)}
                className={`w-10 h-10 rounded-xl text-xs font-bold transition flex items-center justify-center cursor-pointer shrink-0 ${
                  membersCount === num
                    ? 'bg-emerald-600 text-white shadow-md ring-2 ring-emerald-600 ring-offset-2'
                    : 'bg-white text-slate-700 hover:bg-emerald-50 border border-slate-300'
                }`}
              >
                {num}
              </button>
            ))}
          </div>
        </div>

        {/* Dynamic Member Cards */}
        {members.map((member, index) => (
          <div 
            key={member.id}
            className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs space-y-4 relative"
          >
            {/* Member header */}
            <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2.5">
                <span className="w-7 h-7 rounded-full bg-emerald-600 text-white font-bold text-xs flex items-center justify-center">
                  {index + 1}
                </span>
                <div>
                  <h3 className="text-sm font-bold text-slate-800">
                    {index === 0 ? '1-oila a’zosi (Asosiy ariza beruvchi talaba)' : `${index + 1}-oila a’zosi ma’lumotlari`}
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Qarindoshlik turi, pasport va tug‘ilganlik hujjati (PDF)
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {index === 0 && currentUser && (
                  <span className="text-[11px] px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 font-medium flex items-center gap-1">
                    <UserCheck className="w-3 h-3" />
                    JSHSHR tasdiqlangan
                  </span>
                )}
                <div className="flex items-center gap-1.5">
                  <label className="text-xs font-semibold text-slate-600">Qarindoshlik:</label>
                  <select
                    value={member.relationship}
                    onChange={(e) => updateMember(index, { relationship: e.target.value as FamilyRelationship })}
                    className="px-2.5 py-1 text-xs font-medium border border-slate-300 rounded-lg bg-slate-50 focus:ring-2 focus:ring-emerald-500 outline-hidden"
                  >
                    {RELATIONSHIPS.map((rel, rIdx) => (
                      <option key={rIdx} value={rel}>{rel}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Ism Familiya */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Ism, Familiya va Otasining ismi <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={member.fullName}
                  onChange={(e) => updateMember(index, { fullName: e.target.value })}
                  placeholder="Rahimova Madina Shuhrat qizi"
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-hidden"
                />
              </div>

              {/* JSHSHR 14 digits */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  JSHSHR (PINFL - 14 ta raqam) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  maxLength={14}
                  value={member.jshshr}
                  onChange={(e) => updateMember(index, { jshshr: formatJshshr(e.target.value) })}
                  placeholder="40510014567890"
                  className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-hidden tracking-wider"
                />
              </div>

              {/* Alohida ajratilgan pasport seriyasi qatori va raqami qatori */}
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Pasport seriya <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    maxLength={2}
                    required
                    value={member.passportSeria}
                    onChange={(e) => updateMember(index, { passportSeria: formatPassportSeria(e.target.value) })}
                    placeholder="AD"
                    className="w-full px-3 py-2 text-xs font-mono text-center uppercase border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-hidden"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Pasport raqami <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    maxLength={7}
                    required
                    value={member.passportNumber}
                    onChange={(e) => updateMember(index, { passportNumber: formatPassportNumber(e.target.value) })}
                    placeholder="3456789"
                    className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-hidden"
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
                  value={member.phone1}
                  onChange={(e) => updateMember(index, { 
                    phone1: formatPhoneNumber(e.target.value),
                    phone: formatPhoneNumber(e.target.value)
                  })}
                  placeholder="+998 (93) 555 12 34"
                  className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-hidden"
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
                  value={member.phone2}
                  onChange={(e) => updateMember(index, { phone2: formatPhoneNumber(e.target.value) })}
                  placeholder="+998 (90) 888 77 66"
                  className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-hidden"
                />
              </div>

              {/* Faculty */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Fakultet / Ta’lim yo‘nalishi
                </label>
                <select
                  value={member.faculty}
                  onChange={(e) => updateMember(index, { faculty: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-hidden"
                >
                  {UNIVERSITIES_FACULTIES.map((fac, fIdx) => (
                    <option key={fIdx} value={fac}>{fac}</option>
                  ))}
                </select>
              </div>

              {/* Course */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Bosqich (Kurs)
                </label>
                <select
                  value={member.course}
                  onChange={(e) => updateMember(index, { course: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-hidden"
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

            {/* Document uploads: 1-fayl JSHSHR, 2-fayl Telefon raqami */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-slate-100">
              <FileUploadField
                id={`member-${index}-passport`}
                label="1. Pasport yoki ID-karta nusxasi (Faqat PDF)"
                subLabel="Fayl avtomatik JSHSHR raqami bilan nomlanadi (.pdf)"
                desiredFileName={`${member.jshshr || `oila_${index + 1}_pasport`}.pdf`}
                sampleJshshr={member.jshshr}
                document={member.passportDoc}
                onChange={(doc) => updateMember(index, { passportDoc: doc })}
                onPreview={onPreviewDoc}
                sampleTitle={`${member.fullName || 'Talaba'} Pasporti`}
                sampleSub={`${member.passportSeria || 'AD'} ${member.passportNumber || '3456789'}`}
                required
              />

              <FileUploadField
                id={`member-${index}-birth-cert`}
                label="2. Tug‘ilganlik haqida guvohnoma (Faqat PDF)"
                subLabel="Fayl avtomatik telefon raqami bilan nomlanadi (.pdf)"
                desiredFileName={`${cleanPhoneDigits(member.phone1) || `oila_${index + 1}_telefon`}.pdf`}
                document={member.birthOrMarriageDoc}
                onChange={(doc) => updateMember(index, { birthOrMarriageDoc: doc })}
                onPreview={onPreviewDoc}
                sampleTitle="Tug‘ilganlik guvohnomasi"
                sampleSub="Seriya I-TN № 847291"
                required
              />
            </div>
          </div>
        ))}

        {/* Submit bar */}
        <div className="p-4 bg-slate-100 rounded-2xl flex flex-wrap items-center justify-between gap-4 border border-slate-200">
          <div className="text-xs text-slate-600 flex items-center gap-2">
            <FileCheck className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{membersCount} nafar oila a’zosi uchun ariza adminga to‘g‘ridan-to‘g‘ri taqdim etiladi.</span>
          </div>

          <button
            type="submit"
            className="px-6 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white text-xs font-bold rounded-xl shadow-lg transition flex items-center gap-2 cursor-pointer"
          >
            <Send className="w-4 h-4" />
            <span>Arizani Adminga Yuborish</span>
          </button>
        </div>
      </form>
    </div>
  );
};
