import React, { useState } from 'react';
import { UserCheck, ShieldCheck, ArrowRight, KeyRound, User, Lock, Sparkles } from 'lucide-react';
import { RegisteredUser } from '../types';
import { formatJshshr } from '../utils/formatters';

interface StudentAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRegisterSuccess: (user: RegisteredUser) => void;
}

export const StudentAuthModal: React.FC<StudentAuthModalProps> = ({
  isOpen,
  onClose,
  onRegisterSuccess,
}) => {
  const [step, setStep] = useState<1 | 2>(1);
  const [fullName, setFullName] = useState('');
  const [jshshr, setJshshr] = useState('');
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleStep1Submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || fullName.trim().split(' ').length < 2) {
      setError('Iltimos, to‘liq ism va familiyangizni kiriting');
      return;
    }
    if (jshshr.length !== 14) {
      setError('JSHSHR aniq 14 ta raqamdan iborat bo‘lishi shart');
      return;
    }
    setError('');
    // Taklif qilinganidek avtomatik login taklif qilamiz
    const cleanLogin = fullName.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
    setLogin(cleanLogin || 'talaba_' + jshshr.slice(-4));
    setStep(2);
  };

  const handleFinalize = (withCredentials: boolean) => {
    const user: RegisteredUser = {
      fullName: fullName.trim(),
      jshshr,
      login: withCredentials ? login.trim() : undefined,
      password: withCredentials ? password : undefined,
      registeredAt: new Date().toISOString()
    };
    onRegisterSuccess(user);
    onClose();
  };

  const fillQuickSample = () => {
    setFullName('Bekzod Aliyev Jamshidovich');
    setJshshr('31405021234567');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-700 to-indigo-700 px-6 py-5 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center">
                <ShieldCheck className="w-6 h-6 text-emerald-300" />
              </div>
              <div>
                <h3 className="text-base font-bold">Talabani Ro‘yxatdan O‘tkazish</h3>
                <p className="text-xs text-blue-100">Friends & Family Chegirma Tizimi</p>
              </div>
            </div>
            <button
              type="button"
              onClick={fillQuickSample}
              className="text-[11px] bg-white/20 hover:bg-white/30 text-white px-2.5 py-1 rounded-lg transition flex items-center gap-1 cursor-pointer"
              title="Namunaviy ma'lumotlar bilan tez to'ldirish"
            >
              <Sparkles className="w-3 h-3 text-amber-300" />
              Namuna
            </button>
          </div>
        </div>

        {/* Step 1: Ism Familiya va JSHSHR */}
        {step === 1 && (
          <form onSubmit={handleStep1Submit} className="p-6 space-y-4">
            <div className="text-xs text-slate-500 mb-2 leading-relaxed">
              Dasturda 10% chegirma olish uchun dastlab universitet talabasi sifatida shaxsingizni tasdiqlang.
            </div>

            {error && (
              <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium">
                {error}
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Ism, Familiya va Otangizning ismi <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  required
                  placeholder="Masalan: Bekzod Aliyev Jamshidovich"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-hidden"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                JSHSHR (PINFL) raqami <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <span className="text-xs font-bold text-slate-400 absolute left-3 top-2.5 font-mono">14</span>
                <input
                  type="text"
                  required
                  maxLength={14}
                  placeholder="31405021234567"
                  value={jshshr}
                  onChange={(e) => setJshshr(formatJshshr(e.target.value))}
                  className="w-full pl-9 pr-3 py-2 text-sm font-mono border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-hidden tracking-wider"
                />
              </div>
              <div className="flex justify-between items-center mt-1">
                <span className="text-[11px] text-slate-400">Pasport yoki ID-kartadagi 14 xonali raqam</span>
                <span className={`text-[11px] font-mono ${jshshr.length === 14 ? 'text-emerald-600 font-bold' : 'text-slate-400'}`}>
                  {jshshr.length}/14
                </span>
              </div>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl shadow-md transition flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>Ro‘yxatdan o‘tish</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </form>
        )}

        {/* Step 2: Ixtiyoriy Login & Parol qo'yish */}
        {step === 2 && (
          <div className="p-6 space-y-4">
            <div className="flex items-center gap-2 p-3 bg-emerald-50 rounded-xl border border-emerald-200">
              <UserCheck className="w-5 h-5 text-emerald-600 shrink-0" />
              <div className="text-xs">
                <p className="font-semibold text-emerald-900">{fullName}</p>
                <p className="text-emerald-700 font-mono">JSHSHR: {jshshr}</p>
              </div>
            </div>

            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-3">
              <div className="flex items-center gap-2 text-slate-800 font-semibold text-xs">
                <KeyRound className="w-4 h-4 text-indigo-600" />
                <span>Ixtiyoriy: Tizimga qayta kirish uchun login va parol o‘rnating</span>
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Kelgusida arizangiz holatini kuzatish yoki yangi hujjatlar qo‘shish uchun shaxsiy login-parolingizni belgilashingiz mumkin (ixtiyoriy).
              </p>

              <div>
                <label className="block text-[11px] font-medium text-slate-600 mb-1">Login (Foydalanuvchi nomi)</label>
                <div className="relative">
                  <User className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2" />
                  <input
                    type="text"
                    value={login}
                    onChange={(e) => setLogin(e.target.value)}
                    placeholder="foydalanuvchi_nomi"
                    className="w-full pl-8 pr-2 py-1.5 text-xs border border-slate-300 rounded-lg outline-hidden focus:border-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-600 mb-1">Parol</label>
                <div className="relative">
                  <Lock className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-8 pr-2 py-1.5 text-xs border border-slate-300 rounded-lg outline-hidden focus:border-indigo-500"
                  />
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-2 pt-2">
              <button
                type="button"
                onClick={() => handleFinalize(true)}
                className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl shadow-md transition flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <span>Login-parol bilan arizaga o‘tish</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>

              <button
                type="button"
                onClick={() => handleFinalize(false)}
                className="w-full py-2 px-4 text-xs font-medium text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition"
              >
                Parolsiz to‘g‘ridan-to‘g‘ri ariza to‘ldirishga o‘tish
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
