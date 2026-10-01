import React from 'react';
import { 
  Users, 
  Users2, 
  Search, 
  LogOut, 
  Percent,
  ShieldCheck
} from 'lucide-react';
import { AuthSession } from '../types';
import { UBSLogo } from './UBSLogo';

interface HeaderProps {
  activeTab: 'friends' | 'family' | 'status';
  setActiveTab: (tab: 'friends' | 'family' | 'status') => void;
  session: AuthSession;
  onLogout: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  session,
  onLogout,
}) => {
  // If admin session, render dedicated admin header
  if (session.role === 'admin') {
    return (
      <header className="sticky top-0 z-40 bg-slate-900 border-b border-slate-800 text-white shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <UBSLogo size="md" showText={true} textColor="white" subtext="Ma’muriyat Admin Portali" />
              <span className="hidden sm:inline-flex text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                Ma’muriyat nazorati
              </span>
            </div>

            <div className="flex items-center gap-3">
              <div className="text-right hidden sm:block">
                <p className="text-xs font-semibold text-white">{session.fullName}</p>
                <p className="text-[10px] text-slate-400">Ruxsat: Faqat ko‘rish va tasdiqlash</p>
              </div>
              <button
                onClick={onLogout}
                className="px-3 py-1.5 text-xs font-semibold text-rose-300 hover:text-white bg-slate-800 hover:bg-rose-900/40 rounded-xl border border-slate-700 hover:border-rose-700/50 transition flex items-center gap-1.5 cursor-pointer"
                title="Tizimdan chiqish"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Chiqish</span>
              </button>
            </div>
          </div>
        </div>
      </header>
    );
  }

  // Student Header: Clean, minimalist, no admin portal button, no telegram bot codes
  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Brand */}
          <div 
            onClick={() => setActiveTab('friends')}
            className="flex items-center gap-2.5 cursor-pointer select-none"
          >
            <UBSLogo size="md" showText={true} textColor="dark" subtext="Friends & Family Chegirma Tizimi" />
            <span className="hidden sm:inline-flex text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 items-center gap-0.5">
              <Percent className="w-2.5 h-2.5" /> 10% Chegirma
            </span>
          </div>

          {/* Navigation tabs for Student: Only Friends, Family, and Status */}
          <nav className="flex items-center gap-1 bg-slate-100/90 p-1 rounded-xl border border-slate-200">
            <button
              onClick={() => setActiveTab('friends')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'friends'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-blue-600'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>Friends (1-qism)</span>
            </button>
            <button
              onClick={() => setActiveTab('family')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'family'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-emerald-600'
              }`}
            >
              <Users2 className="w-3.5 h-3.5" />
              <span>Family (2-qism)</span>
            </button>
            <button
              onClick={() => setActiveTab('status')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'status'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Search className="w-3.5 h-3.5" />
              <span>Arizam holati</span>
            </button>
          </nav>

          {/* Logged in Student Info & Logout */}
          <div className="flex items-center gap-2.5">
            <div className="flex items-center gap-2 pl-2.5 pr-2 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs">
              <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center text-[10px]">
                {session.fullName.charAt(0)}
              </div>
              <div className="hidden sm:block text-left">
                <span className="font-semibold text-slate-800 max-w-[130px] truncate block leading-tight">
                  {session.fullName}
                </span>
                {session.jshshr && (
                  <span className="text-[10px] text-slate-400 font-mono block leading-tight">
                    {session.jshshr}
                  </span>
                )}
              </div>
            </div>

            <button
              onClick={onLogout}
              className="px-2.5 py-1.5 text-xs text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition border border-transparent hover:border-rose-200 flex items-center gap-1 cursor-pointer"
              title="Tizimdan chiqish"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Chiqish</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
