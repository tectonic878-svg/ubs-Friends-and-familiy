import { AnyApplication, ContractSettings } from '../types';

export const UNIVERSITIES_FACULTIES = [
  'Ijtimoiy fanlar va raqamli texnologiyalar',
  'Pedagogika', 'Filologiya', 'Tibbiyot', 'Iqtisodiyot'
];

export const DEFAULT_CONTRACT_SETTINGS: ContractSettings = {
  friendsContractAmountUZS: 14000000,
  familyContractAmountPerStudentUZS: 13000000,
  academicYear: '2026/2027',
  notes: 'UBS ma’muriyati tomonidan tasdiqlangan bazaviy yillik to‘lov-shartnoma miqdori',
  lastUpdatedAt: new Date().toISOString(),
};

// Reusable SVG placeholder image generators for clean, realistic inline previews
export const createSampleDocSvg = (title: string, sub: string, color: string = '#1e3a8a') => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="420" viewBox="0 0 600 420">
    <defs>
      <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" style="stop-color:#ffffff;stop-opacity:1" />
        <stop offset="100%" style="stop-color:#f1f5f9;stop-opacity:1" />
      </linearGradient>
      <pattern id="pattern" width="20" height="20" patternUnits="userSpaceOnUse">
        <path d="M 20 0 L 0 20 M 0 0 L 20 20" fill="none" stroke="#e2e8f0" stroke-width="0.5"/>
      </pattern>
    </defs>
    <rect width="600" height="420" fill="url(#grad)" rx="12" stroke="#cbd5e1" stroke-width="3"/>
    <rect width="580" height="400" x="10" y="10" fill="url(#pattern)" rx="8" opacity="0.6"/>
    <rect width="560" height="380" x="20" y="20" fill="none" stroke="${color}" stroke-width="2" rx="6" stroke-dasharray="6,4"/>
    
    <!-- Header / Emblem -->
    <circle cx="300" cy="80" r="34" fill="${color}" opacity="0.1"/>
    <circle cx="300" cy="80" r="26" fill="none" stroke="${color}" stroke-width="2"/>
    <text x="300" y="86" font-family="sans-serif" font-size="20" text-anchor="middle" fill="${color}" font-weight="bold">UZB</text>
    
    <!-- Title -->
    <text x="300" y="150" font-family="sans-serif" font-size="22" text-anchor="middle" fill="${color}" font-weight="bold">${title}</text>
    <text x="300" y="180" font-family="sans-serif" font-size="14" text-anchor="middle" fill="#475569">${sub}</text>
    
    <!-- Content mock lines -->
    <line x1="80" y1="220" x2="520" y2="220" stroke="#94a3b8" stroke-width="2"/>
    <line x1="80" y1="250" x2="420" y2="250" stroke="#cbd5e1" stroke-width="2"/>
    <line x1="80" y1="280" x2="480" y2="280" stroke="#cbd5e1" stroke-width="2"/>
    <line x1="80" y1="310" x2="360" y2="310" stroke="#cbd5e1" stroke-width="2"/>
    
    <!-- Seal & Stamp -->
    <circle cx="480" cy="340" r="30" fill="#dc2626" opacity="0.2"/>
    <circle cx="480" cy="340" r="24" fill="none" stroke="#dc2626" stroke-width="2" stroke-dasharray="4,2"/>
    <text x="480" y="344" font-family="sans-serif" font-size="9" text-anchor="middle" fill="#dc2626" font-weight="bold">TASDIQLANGAN</text>
    
    <!-- Barcode mock -->
    <rect x="80" y="330" width="140" height="24" fill="#334155" opacity="0.8"/>
    <text x="150" y="370" font-family="monospace" font-size="11" text-anchor="middle" fill="#64748b">№ 2026-UZ-948102</text>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
};

// Publish uchun boshlang'ich arizalar ro'yxati 0 (bo'sh) holatda bo'lishi shart
export const INITIAL_APPLICATIONS: AnyApplication[] = [];
