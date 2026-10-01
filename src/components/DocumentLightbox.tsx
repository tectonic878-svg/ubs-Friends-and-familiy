import React, { useState, useEffect } from 'react';
import { X, ZoomIn, ZoomOut, Download, FileText, ExternalLink, AlertCircle, Loader2 } from 'lucide-react';
import { DocumentFile } from '../types';
import { downloadAuthenticDocument, resolveAuthenticBlob } from '../services/documentStorage';

interface DocumentLightboxProps {
  document: DocumentFile | null;
  onClose: () => void;
}

export const DocumentLightbox: React.FC<DocumentLightboxProps> = ({ document, onClose }) => {
  const [scale, setScale] = useState(1);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let isCancelled = false;
    if (!document) {
      setBlobUrl(null);
      return;
    }

    setIsLoading(true);
    setLoadError(null);

    const loadBlob = async () => {
      try {
        const resolved = await resolveAuthenticBlob(document, document.name);
        if (!isCancelled) {
          if (resolved && resolved.url) {
            setBlobUrl(resolved.url);
          } else {
            setLoadError('Asl PDF hujjat topilmadi. Arizachi tomonidan yuklangan fayl mavjud emas.');
          }
          setIsLoading(false);
        }
      } catch (err) {
        console.error('Hujjatni yuklash xatosi:', err);
        if (!isCancelled) {
          setLoadError('Hujjatni yuklashda xatolik yuz berdi.');
          setIsLoading(false);
        }
      }
    };

    loadBlob();

    return () => {
      isCancelled = true;
    };
  }, [document?.id, document?.url]);

  if (!document) return null;

  const isPdf = 
    document.type === 'pdf' || 
    document.name?.toLowerCase().endsWith('.pdf') || 
    document.url?.startsWith('data:application/pdf') ||
    document.url?.includes('application/pdf') ||
    document.url?.startsWith('/api/documents/');

  const isSvgOrImage = 
    document.url?.startsWith('data:image/') || 
    document.name?.toLowerCase().match(/\.(png|jpg|jpeg|webp|svg)$/);

  const handleDownload = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await downloadAuthenticDocument(document, document.name);
  };

  const handleOpenNewTab = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (blobUrl) {
      window.open(blobUrl, '_blank', 'noopener,noreferrer');
    } else {
      downloadAuthenticDocument(document, document.name);
    }
  };

  return (
    <div 
      id="document-lightbox-modal"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-md p-2 sm:p-4"
      onClick={onClose}
    >
      <div 
        className="relative max-w-5xl w-full h-[92vh] max-h-[95vh] bg-slate-900 border border-slate-700 rounded-2xl overflow-hidden shadow-2xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top bar */}
        <div className="flex flex-wrap items-center justify-between px-4 sm:px-6 py-3.5 bg-slate-800/95 border-b border-slate-700 gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-lg bg-rose-500/20 text-rose-400 border border-rose-500/30 flex items-center justify-center shrink-0">
              <FileText className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-white truncate max-w-xs sm:max-w-md md:max-w-lg font-mono">
                {document.name}
              </h3>
              <p className="text-xs text-slate-400 flex items-center gap-2">
                <span className="font-semibold text-rose-400">{isPdf ? 'ASL PDF HUJJAT' : document.type.toUpperCase()}</span>
                <span>•</span>
                <span>{document.size || 'Rasmiy nusxa'}</span>
                <span>•</span>
                <span>{new Date(document.uploadedAt || Date.now()).toLocaleDateString('uz-UZ')}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {isSvgOrImage && !isPdf && (
              <>
                <button
                  id="lightbox-zoom-in"
                  type="button"
                  onClick={() => setScale((s) => Math.min(s + 0.25, 2.5))}
                  className="p-2 text-slate-300 hover:text-white hover:bg-slate-700 rounded-lg transition cursor-pointer"
                  title="Kattalashtirish"
                >
                  <ZoomIn className="w-4 h-4" />
                </button>
                <button
                  id="lightbox-zoom-out"
                  type="button"
                  onClick={() => setScale((s) => Math.max(s - 0.25, 0.5))}
                  className="p-2 text-slate-300 hover:text-white hover:bg-slate-700 rounded-lg transition cursor-pointer"
                  title="Kichiklashtirish"
                >
                  <ZoomOut className="w-4 h-4" />
                </button>
              </>
            )}

            {/* Open in new tab button */}
            <button
              id="lightbox-open-external"
              type="button"
              onClick={handleOpenNewTab}
              disabled={isLoading || !!loadError}
              className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 disabled:opacity-40 text-slate-100 hover:text-white rounded-lg transition text-xs font-semibold flex items-center gap-1.5 cursor-pointer border border-slate-600"
              title="Hujjatni brauzerning yangi oynasida to‘liq ochish"
            >
              <ExternalLink className="w-3.5 h-3.5 text-blue-400" />
              <span className="hidden sm:inline">Yangi oynada ochish</span>
            </button>

            {/* Download button */}
            <button
              id="lightbox-download"
              type="button"
              onClick={handleDownload}
              disabled={isLoading || !!loadError}
              className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 disabled:opacity-40 text-white rounded-lg transition text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-md"
              title="Asl PDF hujjatni kompyuterga yuklab olish"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Yuklab olish</span>
            </button>

            {/* Close button */}
            <button
              id="lightbox-close"
              type="button"
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-rose-400 hover:bg-slate-700/80 rounded-lg transition ml-1 cursor-pointer"
              title="Yopish (ESC)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Viewer body */}
        <div className="flex-1 overflow-hidden p-2 sm:p-4 flex flex-col items-center justify-center bg-slate-950/70 relative">
          {isLoading ? (
            <div className="flex flex-col items-center gap-3 text-slate-300">
              <Loader2 className="w-8 h-8 animate-spin text-rose-500" />
              <p className="text-xs font-medium">Asl PDF hujjat yuklanmoqda...</p>
            </div>
          ) : loadError ? (
            <div className="text-center p-8 max-w-md bg-slate-900 rounded-2xl border border-slate-800">
              <AlertCircle className="w-12 h-12 text-amber-400 mx-auto mb-3" />
              <h4 className="text-base font-bold text-white mb-1">Hujjat mavjud emas</h4>
              <p className="text-xs text-slate-400">{loadError}</p>
            </div>
          ) : isPdf && blobUrl ? (
            <div className="w-full h-full flex flex-col">
              <iframe
                src={`${blobUrl}#toolbar=1&navpanes=0`}
                className="w-full h-full rounded-xl border border-slate-700 bg-white"
                title={document.name}
              />
            </div>
          ) : isSvgOrImage && blobUrl ? (
            <div className="flex-1 overflow-auto w-full h-full flex items-center justify-center p-4">
              <div 
                style={{ transform: `scale(${scale})`, transformOrigin: 'center center' }}
                className="transition-transform duration-200 flex items-center justify-center max-w-full max-h-full"
              >
                <img 
                  src={blobUrl} 
                  alt={document.name} 
                  className="max-h-[75vh] max-w-full rounded-xl shadow-2xl border border-slate-800 object-contain mx-auto bg-white"
                />
              </div>
            </div>
          ) : (
            <div className="text-center p-8 max-w-md bg-slate-900 rounded-2xl border border-slate-800">
              <FileText className="w-12 h-12 text-indigo-400 mx-auto mb-3" />
              <h4 className="text-base font-bold text-white mb-2">{document.name}</h4>
              <p className="text-xs text-slate-400 mb-5">
                Ushbu hujjatni ochish yoki kompyuteringizga yuklab olish uchun quyidagi tugmani bosing:
              </p>
              <div className="flex items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={handleOpenNewTab}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition cursor-pointer flex items-center gap-1.5"
                >
                  <ExternalLink className="w-4 h-4" />
                  Ochish
                </button>
                <button
                  type="button"
                  onClick={handleDownload}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl transition cursor-pointer flex items-center gap-1.5"
                >
                  <Download className="w-4 h-4" />
                  Yuklab olish
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
