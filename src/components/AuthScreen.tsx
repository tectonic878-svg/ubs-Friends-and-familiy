import React, { useState } from 'react';
import { 
  ShieldCheck, 
  User, 
  Lock, 
  ArrowRight, 
  Sparkles, 
  CheckCircle2, 
  AlertCircle,
  KeyRound,
  UserCheck
} from 'lucide-react';
import { AuthSession, RegisteredUser, AdminCredentials } from '../types';
import { formatJshshr } from '../utils/formatters';
import { UBSLogo } from './UBSLogo';

interface AuthScreenProps {
  onLoginSuccess: (session: AuthSession) => void;
  savedUsers: RegisteredUser[];
  onRegisterUser: (user: RegisteredUser) => void;
  adminCredentials?: AdminCredentials;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({
  onLoginSuccess,
  savedUsers,
  onRegisterUser,
  adminCredentials,
}) => {
  const [authRole, setAuthRole] = useState<'student' | 'admin'>('student');

  // Student Login fields (No password needed for ordinary users)
  const [studentJshshr, setStudentJshshr] = useState('');
  const [studentFullName, setStudentFullName] = useState('');

  // // Admin Login fields
  const [adminUsername, setAdminUsername] = useState('');
  const [adminPassword, setAdminPassword] = useState('');

  const [errorMessage, setErrorMessage] = useState('');

  // When JSHSHR is typed, check if previously saved user exists to auto-fill their name
  const handleJshshrChange = (raw: string) => {
    const formatted = formatJshshr(raw);
    setStudentJshshr(formatted);
    setErrorMessage('');

    if (formatted.length === 14) {
      const existing = savedUsers.find((u) => u.jshshr === formatted);
      if (existing && existing.fullName) {
        setStudentFullName(existing.fullName);
      }
    }
  };

  // Handle student login purely with JSHSHR (no password required)
  const handleStudentLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    const cleanJshshr = studentJshshr.replace(/\D/g, '');
    if (cleanJshshr.length !== 14) {
      setErrorMessage('JSHSHR 14 ta raqamdan iborat bo‘lishi shart.');
      return;
    }

    // Check if user already exists
    const foundUser = savedUsers.find((u) => u.jshshr === cleanJshshr);
    const finalName = studentFullName.trim() || (foundUser ? foundUser.fullName : `Talaba (JSHSHR: ${cleanJshshr.slice(-4)})`);

    if (!foundUser) {
      const newUser: RegisteredUser = {
        fullName: finalName,
        jshshr: cleanJshshr,
        registeredAt: new Date().toISOString(),
      };
      onRegisterUser(newUser);
    }

    onLoginSuccess({
      role: 'student',
      fullName: finalName,
      jshshr: cleanJshshr,
      loginAt: new Date().toISOString(),
    });
  };

  // Handle admin login (always requires login and password)
  const handleAdminLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (!adminUsername.trim() || !adminPassword.trim()) {
      setErrorMessage('Admin login va parolini kiriting.');
      return;
    }

    // Configured admin credentials check
    const expectedUsername = (adminCredentials?.username || 'admin').toLowerCase();
    const expectedPassword = adminCredentials?.password || 'admin123';

    const cleanUsername = adminUsername.trim().toLowerCase();
    const isMatchedUser = 
      cleanUsername === expectedUsername || 
      cleanUsername === 'admin' || 
      /^admin[1-7]$/.test(cleanUsername);

    if (isMatchedUser && adminPassword === expectedPassword) {
      const adminNumber = cleanUsername.startsWith('admin') ? cleanUsername.replace('admin', '') : '';
      const displayName = adminNumber 
        ? `Administrator #${adminNumber}` 
        : cleanUsername === expectedUsername && expectedUsername !== 'admin'
          ? `Administrator (${adminCredentials?.username})`
          : 'Bosh Administrator';

      onLoginSuccess({
        role: 'admin',
        fullName: displayName,
        username: cleanUsername,
        loginAt: new Date().toISOString(),
      });
    } else {
      setErrorMessage(`Login yoki parol noto‘g‘ri. Administrator parolini to‘g‘ri kiriting.`);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Background aesthetic decorative shapes */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-blue-600/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-indigo-600/20 rounded-full blur-3xl pointer-events-none" />

      <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10">
        {/* Brand Icon & Heading with Official UBS Crest */}
        <div className="text-center mb-6">
          <div className="flex justify-center mb-3">
            <UBSLogo size="xl" showText={false} />
          </div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight">
            UBS Portali
          </h1>
          <p className="text-xs text-slate-300 mt-1 font-medium">
            University of Business and Sciences
          </p>
          <p className="text-[11px] text-slate-400 mt-0.5">
            «Friends & Family» 10% talabalar chegirmalar tizimi
          </p>
        </div>

        {/* Role Selector Tabs (Talaba vs Universitet Admini) */}
        <div className="bg-slate-800/90 p-1.5 rounded-2xl border border-slate-700/80 mb-4 flex items-center gap-1 shadow-inner">
          <button
            type="button"
            onClick={() => {
              setAuthRole('student');
              setErrorMessage('');
            }}
            className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer ${
              authRole === 'student'
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <User className="w-4 h-4" />
            <span>Talaba sifatida</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setAuthRole('admin');
              setErrorMessage('');
            }}
            className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer ${
              authRole === 'admin'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Universitet Admini</span>
          </button>
        </div>

        {/* Main Auth Card */}
        <div className="bg-white rounded-3xl p-7 shadow-2xl border border-slate-200/80 space-y-5">
          {errorMessage && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* ================= TALABA SECTION (Parolsiz - Faqat JSHSHR) ================= */}
          {authRole === 'student' && (
            <div className="space-y-4">
              <div className="p-3 bg-blue-50/80 rounded-2xl border border-blue-100 flex items-start gap-2.5">
                <div className="w-7 h-7 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 mt-0.5">
                  <UserCheck className="w-4 h-4" />
                </div>
                <div className="text-xs">
                  <p className="font-bold text-blue-950">Oddiy foydalanuvchilar uchun tezkor kirish</p>
                  <p className="text-blue-700 mt-0.5 leading-relaxed">
                    Tizimga kirish uchun hech qanday parol talab qilinmaydi. Shaxsiy 14 xonali JSHSHR (PINFL) raqamingizni kiritish kifoya.
                  </p>
                </div>
              </div>

              <form onSubmit={handleStudentLogin} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    JSHSHR (PINFL - 14 ta raqam) <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <span className="text-xs font-bold text-blue-600 absolute left-3 top-2.5 font-mono">14</span>
                    <input
                      type="text"
                      required
                      maxLength={14}
                      placeholder="Masalan: 31405021234567"
                      value={studentJshshr}
                      onChange={(e) => handleJshshrChange(e.target.value)}
                      className="w-full pl-9 pr-3 py-2.5 text-xs font-mono font-bold tracking-wider border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-hidden"
                    />
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Pasport yoki ID-kartangizning pastki qismidagi 14 ta raqam
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Ism, Familiya va Otangizning ismi <span className="text-slate-400 font-normal">(Ixtiyoriy / Ariza uchun)</span>
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      placeholder="Masalan: Aliyev Bekzod Jamshidovich"
                      value={studentFullName}
                      onChange={(e) => setStudentFullName(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-hidden"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md hover:shadow-lg transition flex items-center justify-center gap-2 cursor-pointer mt-2"
                >
                  <span>JSHSHR bilan tizimga kirish</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </form>
            </div>
          )}

          {/* ================= ADMIN SECTION ================= */}
          {authRole === 'admin' && (
            <div className="space-y-4">
              <div className="p-3 bg-indigo-50 rounded-xl border border-indigo-200 text-xs text-indigo-950 flex items-start gap-2.5">
                <ShieldCheck className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold">Universitet Ma’muriyati Nazorat Xonasi</p>
                  <p className="text-[11px] text-indigo-800 mt-0.5">
                    Admin panelga kirish uchun doim login va parol talab qilinadi.
                  </p>
                </div>
              </div>

              <form onSubmit={handleAdminLogin} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Admin Login <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      required
                      placeholder="admin"
                      value={adminUsername}
                      onChange={(e) => setAdminUsername(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-hidden"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Admin Paroli <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type="password"
                      required
                      placeholder="••••••••"
                      value={adminPassword}
                      onChange={(e) => setAdminPassword(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-hidden"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md transition flex items-center justify-center gap-2 cursor-pointer"
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span>Admin Panelga Kirish</span>
                </button>
              </form>

              <div className="pt-2 border-t border-slate-100 text-center">
                <span className="text-[11px] text-slate-400">
                  Ushbu bo‘limdan faqat universitet ma’muriyati xodimlari o‘z login va maxfiy paroli bilan foydalanishi mumkin
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
