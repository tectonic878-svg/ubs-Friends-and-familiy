import React from 'react';
import { X, ZoomIn, ZoomOut, Download, FileText, ExternalLink } from 'lucide-react';
import { DocumentFile } from '../types';
import { downloadFile, getDocumentBlobUrl } from '../utils/formatters';

interface DocumentLightboxProps {
  document: DocumentFile | null;
  onClose: () => void;
}

export const DocumentLightbox: React.FC<DocumentLightboxProps> = ({ document: doc, onClose }) => {
  const [scale, setScale] = React.useState(1);

  if (!doc) return null;

  const docUrl = doc.dataUrl || doc.url;
  const isImage = doc.type === 'image' || docUrl.startsWith('data:image/');
  const isPdf = doc.type === 'pdf' || doc.name.toLowerCase().endsWith('.pdf') || docUrl.includes('application/pdf');

  return (
    <div 
      id="document-lightbox-modal"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-sm p-4"
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
              <h3 className="text-sm font-semibold text-white truncate max-w-md">{doc.name}</h3>
              <p className="text-xs text-slate-400">
                {doc.size || 'PDF Hujjat'} • {doc.type.toUpperCase()} • {new Date(doc.uploadedAt).toLocaleDateString('uz-UZ')}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
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
            {doc.driveWebViewLink && (
              <a
                href={doc.driveWebViewLink}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-lg transition flex items-center gap-1.5"
                title="Google Drive'da ochish"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Drive'da ochish</span>
              </a>
            )}
            <button
              id="lightbox-download"
              type="button"
              onClick={() => downloadFile(docUrl, doc.name)}
              className="p-2 text-slate-300 hover:text-white hover:bg-slate-700 rounded-lg transition cursor-pointer"
              title="Yuklab olish"
            >
              <Download className="w-4 h-4" />
            </button>
            <button
              id="lightbox-close"
              type="button"
              onClick={onClose}
              className="p-2 text-slate-300 hover:text-rose-400 hover:bg-slate-700 rounded-lg transition ml-2 cursor-pointer"
              title="Yopish"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Viewer body */}
        <div className="flex-1 overflow-auto p-6 flex items-center justify-center bg-slate-950/60 min-h-[460px]">
          <div 
            style={{ transform: `scale(${scale})`, transformOrigin: 'center center' }}
            className="transition-transform duration-200 w-full flex justify-center"
          >
            {isImage ? (
              <img 
                src={docUrl} 
                alt={doc.name} 
                className="max-h-[70vh] rounded-lg shadow-lg border border-slate-800 object-contain mx-auto"
              />
            ) : (
              <iframe
                src={getDocumentBlobUrl(docUrl, 'application/pdf')}
                title={doc.name}
                className="w-full h-[65vh] rounded-xl border border-slate-800 bg-white shadow-xl"
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
