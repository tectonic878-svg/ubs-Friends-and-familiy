import React from 'react';
import { X, ZoomIn, ZoomOut, Download, FileText } from 'lucide-react';
import { DocumentFile } from '../types';

interface DocumentLightboxProps {
  document: DocumentFile | null;
  onClose: () => void;
}

export const DocumentLightbox: React.FC<DocumentLightboxProps> = ({ document, onClose }) => {
  const [scale, setScale] = React.useState(1);

  if (!document) return null;

  return (
    <div 
      id="document-lightbox-modal"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div 
        className="relative max-w-4xl w-full max-h-[90vh] bg-slate-900 border border-slate-700 rounded-2xl overflow-hidden shadow-2xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top bar */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-800/90 border-b border-slate-700">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-blue-600/20 text-blue-400 flex items-center justify-center">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white truncate max-w-md">{document.name}</h3>
              <p className="text-xs text-slate-400">
                {document.size || 'Hujjat'} • {document.type.toUpperCase()} • {new Date(document.uploadedAt).toLocaleDateString('uz-UZ')}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              id="lightbox-zoom-in"
              onClick={() => setScale((s) => Math.min(s + 0.25, 2.5))}
              className="p-2 text-slate-300 hover:text-white hover:bg-slate-700 rounded-lg transition"
              title="Kattalashtirish"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            <button
              id="lightbox-zoom-out"
              onClick={() => setScale((s) => Math.max(s - 0.25, 0.5))}
              className="p-2 text-slate-300 hover:text-white hover:bg-slate-700 rounded-lg transition"
              title="Kichiklashtirish"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            {document.driveWebViewLink && (
              <a
                href={document.driveWebViewLink}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-lg transition flex items-center gap-1.5"
                title="Google Drive'da to'g'ridan-to'g'ri ochish"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Google Drive'da ochish</span>
              </a>
            )}
            <a
              id="lightbox-download"
              href={document.driveDownloadLink || document.url}
              download={document.name}
              className="p-2 text-slate-300 hover:text-white hover:bg-slate-700 rounded-lg transition"
              title="Yuklab olish"
            >
              <Download className="w-4 h-4" />
            </a>
            <button
              id="lightbox-close"
              onClick={onClose}
              className="p-2 text-slate-300 hover:text-rose-400 hover:bg-slate-700 rounded-lg transition ml-2"
              title="Yopish"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Viewer body */}
        <div className="flex-1 overflow-auto p-6 flex items-center justify-center bg-slate-950/50 min-h-[400px]">
          <div 
            style={{ transform: `scale(${scale})`, transformOrigin: 'center center' }}
            className="transition-transform duration-200"
          >
            <img 
              src={document.url} 
              alt={document.name} 
              className="max-h-[70vh] rounded-lg shadow-lg border border-slate-800 object-contain mx-auto"
            />
          </div>
        </div>
      </div>
    </div>
  );
};
