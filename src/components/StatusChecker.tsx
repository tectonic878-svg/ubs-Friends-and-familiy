import React, { useState } from 'react';
import { Search, CheckCircle2, XCircle, Clock, FileText, ArrowRight, ShieldCheck } from 'lucide-react';
import { AnyApplication, DocumentFile } from '../types';
import { formatMoneyUZS } from '../utils/formatters';

interface StatusCheckerProps {
  applications: AnyApplication[];
  onPreviewDoc: (doc: DocumentFile) => void;
  defaultJshshr?: string;
}

export const StatusChecker: React.FC<StatusCheckerProps> = ({ applications, onPreviewDoc, defaultJshshr }) => {
  const [jshshrQuery, setJshshrQuery] = useState(defaultJshshr || '');
  const [searched, setSearched] = useState(Boolean(defaultJshshr));

  const foundApps = applications.filter((app) => {
    if (!jshshrQuery.trim()) return false;
    const q = jshshrQuery.trim().toLowerCase();
    if (app.id.toLowerCase() === q) return true;

    if (app.type === 'friends') {
      const inFriendsList = app.friendsList?.some((f) => f.jshshr === q);
      return app.applicantStudent.jshshr === q || app.friendStudent?.jshshr === q || Boolean(inFriendsList);
    } else {
      return app.members.some((m) => m.jshshr === q);
    }
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearched(true);
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-xl text-center">
        <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto mb-3">
          <Search className="w-6 h-6" />
        </div>
        <h2 className="text-xl font-bold text-slate-900 mb-1">Ariza Holatini Tekshirish</h2>
        <p className="text-xs text-slate-500 max-w-md mx-auto mb-6">
          14 xonali JSHSHR (PINFL) raqamingizni yoki arizangiz ID raqamini (masalan: APP-FR-1001) kiriting.
        </p>

        <form onSubmit={handleSearch} className="max-w-md mx-auto flex gap-2">
          <input
            type="text"
            required
            value={jshshrQuery}
            onChange={(e) => {
              setJshshrQuery(e.target.value);
              setSearched(false);
            }}
            placeholder="31405021234567 yoki APP-..."
            className="flex-1 px-4 py-2.5 text-xs font-mono border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-hidden tracking-wider"
          />
          <button
            type="submit"
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl shadow-md transition cursor-pointer"
          >
            Tekshirish
          </button>
        </form>
      </div>

      {searched && (
        <div className="space-y-4">
          {foundApps.length === 0 ? (
            <div className="bg-white rounded-2xl p-8 text-center border border-slate-200">
              <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-2">
                <Search className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-semibold text-slate-700">Ariza topilmadi</h3>
              <p className="text-xs text-slate-500 mt-1">
                Kiritilgan ma’lumot bo‘yicha ariza mavjud emas. Iltimos, raqamni qayta tekshiring.
              </p>
            </div>
          ) : (
            foundApps.map((app) => (
              <div key={app.id} className="bg-white rounded-2xl p-6 border border-slate-200 shadow-md space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-200">
                  <div>
                    <span className="font-mono text-xs font-bold text-slate-500 block">Ariza raqami:</span>
                    <span className="text-sm font-bold text-slate-900 font-mono">{app.id}</span>
                  </div>

                  <div>
                    {app.status === 'tasdiqlandi' && (
                      <span className="flex items-center gap-1 text-xs font-bold px-3 py-1 rounded-full bg-emerald-100 text-emerald-800">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        Tasdiqlangan (10% chegirma taqdim etildi)
                      </span>
                    )}
                    {app.status === 'rad_etildi' && (
                      <span className="flex items-center gap-1 text-xs font-bold px-3 py-1 rounded-full bg-rose-100 text-rose-800">
                        <XCircle className="w-4 h-4 text-rose-600" />
                        Rad etilgan
                      </span>
                    )}
                    {app.status === 'kutilmoqda' && (
                      <span className="flex items-center gap-1 text-xs font-bold px-3 py-1 rounded-full bg-amber-100 text-amber-800">
                        <Clock className="w-4 h-4 text-amber-600" />
                        Admin tekshiruvida
                      </span>
                    )}
                  </div>
                </div>

                {/* Timeline */}
                <div className="grid grid-cols-3 gap-2 text-center py-2">
                  <div className="p-2 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200">
                    <span className="text-[10px] uppercase font-bold block">1. Topshirildi</span>
                    <span className="text-[11px] font-semibold">Qabul qilindi</span>
                  </div>
                  <div className={`p-2 rounded-xl border ${
                    app.status !== 'kutilmoqda' 
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-200' 
                      : 'bg-amber-50 text-amber-800 border-amber-200'
                  }`}>
                    <span className="text-[10px] uppercase font-bold block">2. Tekshiruv</span>
                    <span className="text-[11px] font-semibold">
                      {app.status === 'kutilmoqda' ? 'Ko‘rib chiqilmoqda' : 'Yakunlandi'}
                    </span>
                  </div>
                  <div className={`p-2 rounded-xl border ${
                    app.status === 'tasdiqlandi'
                      ? 'bg-emerald-100 text-emerald-900 border-emerald-300 font-bold'
                      : (app.status === 'rad_etildi' ? 'bg-rose-50 text-rose-800 border-rose-200' : 'bg-slate-50 text-slate-400 border-slate-200')
                  }`}>
                    <span className="text-[10px] uppercase font-bold block">3. 10% Chegirma</span>
                    <span className="text-[11px]">
                      {app.status === 'tasdiqlandi' ? '10% Tasdiqlandi' : (app.status === 'rad_etildi' ? 'Rad etildi' : 'Kutilmoqda')}
                    </span>
                  </div>
                </div>

                {app.adminNotes && (
                  <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-xs">
                    <strong className="text-slate-800 block mb-0.5">UBS mas’ul xodimi izohi:</strong>
                    <p className="text-slate-600">{app.adminNotes}</p>
                  </div>
                )}

                {/* Uploaded Documents List */}
                <div className="pt-3 border-t border-slate-100">
                  <span className="text-xs font-semibold text-slate-700 block mb-2">Yuklangan PDF Hujjatlar:</span>
                  <div className="flex flex-wrap gap-2">
                    {app.type === 'friends' ? (
                      <>
                        {app.applicantStudent.passportDoc && (
                          <button
                            type="button"
                            onClick={() => onPreviewDoc(app.applicantStudent.passportDoc!)}
                            className="px-3 py-1.5 rounded-xl bg-slate-50 hover:bg-blue-50 border border-slate-200 hover:border-blue-300 text-xs text-slate-700 flex items-center gap-1.5 transition cursor-pointer"
                          >
                            <FileText className="w-3.5 h-3.5 text-rose-500" />
                            <span className="truncate max-w-[150px]">{app.applicantStudent.passportDoc.name}</span>
                            {app.applicantStudent.passportDoc.driveFileId && (
                              <span className="text-[10px] px-1.5 py-0.2 bg-blue-100 text-blue-700 rounded-md font-mono">Drive</span>
                            )}
                          </button>
                        )}
                        {app.applicantStudent.certificateDoc && (
                          <button
                            type="button"
                            onClick={() => onPreviewDoc(app.applicantStudent.certificateDoc!)}
                            className="px-3 py-1.5 rounded-xl bg-slate-50 hover:bg-blue-50 border border-slate-200 hover:border-blue-300 text-xs text-slate-700 flex items-center gap-1.5 transition cursor-pointer"
                          >
                            <FileText className="w-3.5 h-3.5 text-rose-500" />
                            <span className="truncate max-w-[150px]">{app.applicantStudent.certificateDoc.name}</span>
                            {app.applicantStudent.certificateDoc.driveFileId && (
                              <span className="text-[10px] px-1.5 py-0.2 bg-blue-100 text-blue-700 rounded-md font-mono">Drive</span>
                            )}
                          </button>
                        )}
                      </>
                    ) : (
                      app.members.map((m) => (
                        <React.Fragment key={m.id}>
                          {m.passportDoc && (
                            <button
                              type="button"
                              onClick={() => onPreviewDoc(m.passportDoc!)}
                              className="px-3 py-1.5 rounded-xl bg-slate-50 hover:bg-blue-50 border border-slate-200 hover:border-blue-300 text-xs text-slate-700 flex items-center gap-1.5 transition cursor-pointer"
                            >
                              <FileText className="w-3.5 h-3.5 text-rose-500" />
                              <span className="truncate max-w-[150px]">{m.passportDoc.name}</span>
                              {m.passportDoc.driveFileId && (
                                <span className="text-[10px] px-1.5 py-0.2 bg-blue-100 text-blue-700 rounded-md font-mono">Drive</span>
                              )}
                            </button>
                          )}
                        </React.Fragment>
                      ))
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};
