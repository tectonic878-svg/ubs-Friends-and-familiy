import React from 'react';
import { 
  Users, 
  Users2, 
  ArrowRight, 
  Percent, 
  ShieldCheck, 
  FileCheck, 
  Bot, 
  Sparkles, 
  CheckCircle2, 
  PlayCircle
} from 'lucide-react';
import { UBSLogo } from './UBSLogo';

interface OverviewHomeProps {
  onSelectTab: (tab: 'friends' | 'family' | 'status' | 'telegram') => void;
  onOpenAuth: () => void;
  currentUserExists: boolean;
}

export const OverviewHome: React.FC<OverviewHomeProps> = ({
  onSelectTab,
  onOpenAuth,
  currentUserExists,
}) => {
  return (
    <div className="space-y-12">
      {/* Hero Banner with minimalist, high-contrast design */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-indigo-950 to-blue-950 p-8 sm:p-12 text-white shadow-2xl border border-slate-800">
        <div className="relative z-10 max-w-3xl space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <UBSLogo size="sm" showText={true} textColor="white" subtext="Rasmiy Chegirmalar Tizimi" />
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/20 text-blue-300 text-xs font-semibold border border-blue-500/30 ml-2">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>2026/2027 O‘quv yili</span>
            </div>
          </div>

          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-white leading-tight">
            UBS «Friends» va «Family» <br className="hidden sm:inline" />
            Ta’lim Chegirmalari Tizimi
          </h1>

          <p className="text-sm sm:text-base text-slate-300 leading-relaxed max-w-2xl">
            <strong>University of Business and Sciences</strong> talabalari uchun do‘stingiz yoki oila a’zolaringiz bilan birga ta’lim oling va 
            to‘lov-shartnomadan <strong>har bir talaba uchun 10% kafolatlangan chegirmaga</strong> ega bo‘ling. 
            Hujjatlarni onlayn yuklang va arizangizni admin tekshiruviga yuboring.
          </p>

          <div className="pt-4 flex flex-wrap items-center gap-3">
            <button
              onClick={() => onSelectTab('friends')}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-lg transition flex items-center gap-2 cursor-pointer"
            >
              <Users className="w-4 h-4" />
              <span>Friends dasturiga ariza topshirish</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <button
              onClick={() => onSelectTab('family')}
              className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-lg transition flex items-center gap-2 cursor-pointer"
            >
              <Users2 className="w-4 h-4" />
              <span>Family dasturiga topshirish (1-10 kishi)</span>
            </button>

            {!currentUserExists && (
              <button
                onClick={onOpenAuth}
                className="px-5 py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-semibold backdrop-blur-md transition cursor-pointer"
              >
                Talabani ro‘yxatdan o‘tkazish
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 2 Main Program Pillars */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* 1-Qism: Friends Card */}
        <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-sm hover:shadow-md transition space-y-4 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center shadow-xs">
                <Users className="w-6 h-6" />
              </div>
              <span className="text-xs font-bold px-3 py-1 rounded-full bg-blue-100 text-blue-800">
                1-Qism • 10% Chegirma
              </span>
            </div>

            <h2 className="text-xl font-bold text-slate-900">
              «Friends» (Do‘stlar) Dasturi
            </h2>

            <p className="text-xs text-slate-600 leading-relaxed">
              Universitetga do‘stingiz bilan birga o‘qishga kirsangiz yoki birga tahsil olsangiz, har ikkingizga to‘lov-shartnoma summasidan 10% dan chegirma taqdim etiladi.
            </p>

            <ul className="space-y-2 text-xs text-slate-600 pt-2 border-t border-slate-100">
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" />
                <span>Sahifaning eng yuqori qismida rasmiy video qo‘llanma</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" />
                <span>Ariza beruvchi va do‘stining 14 xonali JSHSHR ma’lumotlari</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" />
                <span>Shahodatnoma, attestat yoki diplom nusxasini yuklash</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" />
                <span>To‘g‘ridan-to‘g‘ri universitet adminiga yo‘naltirish</span>
              </li>
            </ul>
          </div>

          <button
            onClick={() => onSelectTab('friends')}
            className="w-full py-3 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold rounded-xl transition flex items-center justify-center gap-2 cursor-pointer mt-4"
          >
            <span>Friends arizasini to‘ldirish</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        {/* 2-Qism: Family Card */}
        <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-sm hover:shadow-md transition space-y-4 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shadow-xs">
                <Users2 className="w-6 h-6" />
              </div>
              <span className="text-xs font-bold px-3 py-1 rounded-full bg-emerald-100 text-emerald-800">
                2-Qism • 1-10 kishi
              </span>
            </div>

            <h2 className="text-xl font-bold text-slate-900">
              «Family» (Oila A’zolari) Dasturi
            </h2>

            <p className="text-xs text-slate-600 leading-relaxed">
              Oila a’zolari (aka-uka, opa-singil, ota-ona va farzandlar) bir vaqtda universitetda o‘qisa, 1 kishidan 10 kishigacha bo‘lgan barcha talabalar uchun har biriga 10% chegirma beriladi.
            </p>

            <ul className="space-y-2 text-xs text-slate-600 pt-2 border-t border-slate-100">
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Oila a’zolari soni (1 kishi, 2 kishi ... 10 kishigacha)</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Alohida ajratilgan pasport seriyasi va raqami qatorlari</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Pasport va tug‘ilganlik haqida guvohnoma nusxasi</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Har bir talaba uchun qat’iy 10% chegirma hisob-kitobi</span>
              </li>
            </ul>
          </div>

          <button
            onClick={() => onSelectTab('family')}
            className="w-full py-3 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-bold rounded-xl transition flex items-center justify-center gap-2 cursor-pointer mt-4"
          >
            <span>Family arizasini to‘ldirish</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Feature Highlights: Protected Admin & Telegram Bot */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <div className="bg-slate-50 rounded-2xl p-6 border border-slate-200">
          <div className="w-9 h-9 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center mb-3">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <h3 className="text-sm font-bold text-slate-900 mb-1">Xavfsiz Admin Tekshiruvi</h3>
          <p className="text-xs text-slate-600 leading-relaxed">
            Admin talabalar kiritgan ma’lumotlarni tahrirlay olmaydi. U faqat yuklangan rasmlarni ko‘rib, tasdiqlaydi yoki sabab bilan rad etadi.
          </p>
        </div>

        <div className="bg-slate-50 rounded-2xl p-6 border border-slate-200">
          <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center mb-3">
            <FileCheck className="w-5 h-5" />
          </div>
          <h3 className="text-sm font-bold text-slate-900 mb-1">Inline Vizual Ko‘rik</h3>
          <p className="text-xs text-slate-600 leading-relaxed">
            Admin ma’lumotlarni tekshirish uchun har bir faylni alohida yuklab o‘tirmaydi, barcha rasmlar talaba ma’lumotlari ostida ko‘rinib turadi.
          </p>
        </div>

        <div className="bg-slate-50 rounded-2xl p-6 border border-slate-200">
          <div className="w-9 h-9 rounded-xl bg-sky-100 text-sky-600 flex items-center justify-center mb-3">
            <Bot className="w-5 h-5" />
          </div>
          <h3 className="text-sm font-bold text-slate-900 mb-1">Telegram Bot Integratsiyasi</h3>
          <p className="text-xs text-slate-600 leading-relaxed">
            Talabalar @UBSDiscountBot orqali botda tezkor javob olishi, chegirma hisoblashi va 14 xonali JSHSHR orqali holatini tekshirishi mumkin.
          </p>
        </div>
      </div>
    </div>
  );
};
