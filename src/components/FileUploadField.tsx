import React, { useRef, useState } from 'react';
import { UploadCloud, CheckCircle2, Trash2, Eye, Sparkles, FileText, Download, AlertCircle } from 'lucide-react';
import { DocumentFile } from '../types';
import { readFileAsDataUrl, downloadFile } from '../utils/formatters';
import { createSampleDocSvg } from '../data/mockData';

interface FileUploadFieldProps {
  id: string;
  label: string;
  subLabel?: string;
  document?: DocumentFile;
  onChange: (doc: DocumentFile | undefined) => void;
  onPreview: (doc: DocumentFile) => void;
  sampleTitle?: string;
  sampleSub?: string;
  sampleJshshr?: string;
  desiredFileName?: string; // e.g. 31405021234567.pdf or 998901234567.pdf
  required?: boolean;
}

export const FileUploadField: React.FC<FileUploadFieldProps> = ({
  id,
  label,
  subLabel = 'Faqat PDF (.pdf) hujjati qabul qilinadi',
  document,
  onChange,
  onPreview,
  sampleTitle = 'Hujjat_PDF',
  sampleSub = 'Tasdiqlangan PDF nusxa',
  sampleJshshr = '31405021234567',
  desiredFileName,
  required = false
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [formatError, setFormatError] = useState<string | null>(null);

  const handleFile = async (file: File) => {
    setFormatError(null);
    const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
    
    if (!isPdf) {
      setFormatError('Xatolik: Faqat PDF (.pdf) formatidagi fayllar qabul qilinadi!');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setFormatError('Fayl hajmi 10 MB dan oshmasligi kerak. Iltimos, optimallashtirilgan PDF yuklang.');
      return;
    }

    try {
      const dataUrl = await readFileAsDataUrl(file);
      // Auto-name according to rule: desiredFileName if given
      const finalName = desiredFileName || (file.name.toLowerCase().endsWith('.pdf') ? file.name : `${file.name}.pdf`);
      
      const newDoc: DocumentFile = {
        id: 'doc_' + Math.random().toString(36).substring(2, 9),
        name: finalName,
        type: 'pdf',
        url: dataUrl,
        size: (file.size / (1024 * 1024)).toFixed(2) + ' MB',
        uploadedAt: new Date().toISOString()
      };
      onChange(newDoc);
    } catch (err) {
      console.error('Faylni o‘qishda xatolik:', err);
      setFormatError('Faylni yuklashda xatolik yuz berdi.');
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleUseSample = (e: React.MouseEvent) => {
    e.stopPropagation();
    setFormatError(null);
    const finalName = desiredFileName || `${sampleTitle.replace(/\s+/g, '_')}.pdf`;
    
    // Create both valid PDF stream data and visual SVG representation
    const sampleDoc: DocumentFile = {
      id: 'sample_' + Math.random().toString(36).substring(2, 9),
      name: finalName,
      type: 'pdf',
      size: '0.8 MB',
      uploadedAt: new Date().toISOString(),
      // Use SVG preview for visual rendering in browser, with embedded sample metadata
      url: createSampleDocSvg(sampleTitle.toUpperCase() + ' (PDF)', sampleSub, '#0284c7')
    };
    onChange(sampleDoc);
  };

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-1.5">
        <label htmlFor={id} className="block text-xs font-semibold text-slate-700">
          {label} {required && <span className="text-rose-500">*</span>}
        </label>
        {!document && (
          <button
            type="button"
            onClick={handleUseSample}
            className="text-[11px] font-medium text-blue-600 hover:text-blue-700 flex items-center gap-1 hover:underline cursor-pointer"
            title="Sinov uchun tayyor namunaviy PDF hujjatini yuklash"
          >
            <Sparkles className="w-3 h-3 text-amber-500" />
            Namuna PDF yuklash
          </button>
        )}
      </div>

      <input
        ref={fileInputRef}
        id={id}
        type="file"
        accept=".pdf,application/pdf"
        className="hidden"
        onChange={(e) => {
          if (e.target.files && e.target.files[0]) {
            handleFile(e.target.files[0]);
          }
        }}
      />

      {formatError && (
        <div className="mb-2 p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{formatError}</span>
        </div>
      )}

      {!document ? (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-all duration-150 flex flex-col items-center justify-center gap-2 ${
            isDragging
              ? 'border-blue-500 bg-blue-50/70'
              : 'border-slate-300 hover:border-blue-400 bg-slate-50/60 hover:bg-slate-50'
          }`}
        >
          <div className="w-10 h-10 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs font-medium text-slate-800">
              PDF faylni bu yerga tashlang yoki <span className="text-blue-600 underline">tanlang</span>
            </p>
            <p className="text-[11px] text-slate-400 mt-0.5">{subLabel}</p>
          </div>
        </div>
      ) : (
        <div className="border border-slate-200 bg-white rounded-xl p-3 shadow-xs flex flex-col gap-2">
          {/* Header row */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-7 h-7 rounded-lg bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center shrink-0">
                <FileText className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-slate-800 truncate max-w-[240px] font-mono">
                  {document.name}
                </p>
                <div className="flex items-center gap-2 text-[11px] text-slate-400">
                  <span className="font-semibold text-rose-600">PDF hujjat</span>
                  <span>•</span>
                  <span>{document.size || 'Yuklangan'}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => downloadFile(document.url, document.name)}
                className="p-1.5 text-slate-600 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition"
                title="PDF faylni kompyuterga yuklab olish"
              >
                <Download className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => onPreview(document)}
                className="p-1.5 text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
                title="Katta o'lchamda ko'rish"
              >
                <Eye className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => onChange(undefined)}
                className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                title="O'chirish va qayta yuklash"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Inline Visual thumbnail */}
          <div 
            onClick={() => onPreview(document)}
            className="relative h-28 w-full rounded-lg overflow-hidden border border-slate-200 bg-slate-100 cursor-pointer group"
          >
            <img 
              src={document.url} 
              alt={document.name} 
              className="w-full h-full object-contain p-1 transition-transform group-hover:scale-102"
            />
            <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-medium gap-1.5 backdrop-blur-[1px]">
              <Eye className="w-4 h-4" />
              PDF Ko‘rish
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
