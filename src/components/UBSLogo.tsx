import React, { useState } from 'react';

interface UBSLogoProps {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  showText?: boolean;
  textColor?: 'dark' | 'light' | 'white';
  subtext?: string;
  className?: string;
  variant?: 'shield' | 'full';
}

export const UBSLogo: React.FC<UBSLogoProps> = ({
  size = 'md',
  showText = false,
  textColor = 'dark',
  subtext,
  className = '',
}) => {
  const [imgError, setImgError] = useState<boolean>(false);
  const [imgSrc, setImgSrc] = useState<string>('/logo.png');

  const handleImgError = () => {
    if (imgSrc === '/logo.png') {
      setImgSrc('/ubs_logo.png');
    } else {
      setImgError(true);
    }
  };

  const sizeClasses = {
    xs: 'w-6 h-6',
    sm: 'w-8 h-8',
    md: 'w-10 h-10',
    lg: 'w-14 h-14',
    xl: 'w-20 h-20',
    '2xl': 'w-28 h-28',
  }[size];

  const titleSize = {
    xs: 'text-xs',
    sm: 'text-sm font-bold',
    md: 'text-base font-extrabold',
    lg: 'text-lg font-black',
    xl: 'text-2xl font-black',
    '2xl': 'text-3xl font-black',
  }[size];

  const subtextSize = {
    xs: 'text-[9px]',
    sm: 'text-[10px]',
    md: 'text-xs',
    lg: 'text-xs',
    xl: 'text-sm',
    '2xl': 'text-base',
  }[size];

  return (
    <div className={`inline-flex items-center gap-2.5 ${className}`}>
      {/* Official UBS Logo Crest Emblem */}
      <div 
        className={`${sizeClasses} shrink-0 relative flex items-center justify-center rounded-xl bg-white shadow-xs overflow-hidden border border-slate-200/80 p-0.5`}
      >
        {!imgError ? (
          <img
            src={imgSrc}
            alt="University of Business and Sciences Logo"
            className="w-full h-full object-contain"
            onError={handleImgError}
            referrerPolicy="no-referrer"
          />
        ) : (
          /* High-Fidelity SVG Fallback matching the uploaded UBS crest */
         
          <svg viewBox="0 0 100 120" className="w-full h-full" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path
              d="M50 4C75 4 92 12 92 35C92 82 50 114 50 114C50 114 8 82 8 35C8 12 25 4 50 4Z"
              fill="white"
              stroke="#0B2559"
              strokeWidth="6"
            />
            {/* Quadrant 1 (Top Left) - Dark Blue with B */}
            <path d="M12 35C12 20 25 10 50 10V56H12V35Z" fill="#0B2559" />
            <text x="31" y="42" fill="white" fontFamily="serif" fontSize="24" fontWeight="bold" textAnchor="middle">B</text>

            {/* Quadrant 4 (Bottom Right) - Dark Blue with S */}
            <path d="M50 56H88C87 80 62 100 50 108V56Z" fill="#0B2559" />
            <text x="69" y="86" fill="white" fontFamily="serif" fontSize="24" fontWeight="bold" textAnchor="middle">S</text>

            {/* Quadrant 2 (Top Right) - Quill icon */}
            <path d="M50 10C70 10 88 18 88 35V56H50V10Z" fill="white" />
            <path d="M68 20C75 28 65 42 60 48C58 44 60 36 68 20Z" fill="#0B2559" />

            {/* Quadrant 3 (Bottom Left) - Fleur-de-lis */}
            <path d="M12 56H50V108C38 100 13 80 12 56Z" fill="white" />
            <circle cx="31" cy="78" r="4" fill="#0B2559" />
            <path d="M31 64C27 70 23 76 25 82C29 80 30 76 31 74C32 76 33 80 37 82C39 76 35 70 31 64Z" fill="#0B2559" />

            {/* Center Divider Grid */}
            <line x1="50" y1="10" x2="50" y2="108" stroke="#0B2559" strokeWidth="2.5" />
            <line x1="12" y1="56" x2="88" y2="56" stroke="#0B2559" strokeWidth="2.5" />
          </svg>
        )}
      </div>

      {showText && (
        <div className="flex flex-col leading-tight">
          <div className="flex items-center gap-1.5">
            <span
              className={`${titleSize} tracking-tight font-serif ${
                textColor === 'white' 
                  ? 'text-white' 
                  : textColor === 'light' 
                  ? 'text-slate-100' 
                  : 'text-[#0B2559]'
              }`}
            >
              UBS
            </span>
          </div>
          <span
            className={`${subtextSize} font-medium ${
              textColor === 'white' 
                ? 'text-slate-200' 
                : textColor === 'light' 
                ? 'text-slate-400' 
                : 'text-slate-600'
            }`}
          >
            {subtext || 'University of Business and Sciences'}
          </span>
        </div>
      )}
    </div>
  );
};
