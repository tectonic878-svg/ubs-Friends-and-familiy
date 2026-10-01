export type ApplicationType = 'friends' | 'family';
export type ApplicationStatus = 'kutilmoqda' | 'tasdiqlandi' | 'rad_etildi';

export interface DocumentFile {
  id: string;
  name: string;
  type: 'image' | 'pdf';
  url: string;
  dataUrl?: string; // Raw base64 data for local computer server disk persistence
  uploadedAt: string;
  size?: string;
}

export interface StudentInfo {
  fullName: string;
  jshshr: string; // 14 raqam
  passportSeria: string; // 2 harf (masalan, AA, AB)
  passportNumber: string; // 7 raqam
  faculty: string;
  course: string;
  phone1: string; // 1-telefon raqami (majburiy)
  phone2: string; // 2-telefon raqami (majburiy)
  phone?: string; // orqaga moslik uchun
  passportDoc?: DocumentFile; // 1-fayl: JSHSHR bilan nomlangan PDF
  certificateDoc?: DocumentFile; // 2-fayl: Telefon raqami bilan nomlangan PDF
}

export interface FriendsApplicationData {
  id: string;
  type: 'friends';
  createdAt: string;
  status: ApplicationStatus;
  adminNotes?: string;
  applicantStudent: StudentInfo;
  friendStudent: StudentInfo; // First friend for compatibility
  friendsCount: number; // 1 dan 5 gacha
  friendsList: StudentInfo[]; // 1 to 5 friends
  contractAmountUZS: number;
  discountRate: number; // 0.10 (10%)
  savedAmountUZS: number;
  finalAmountUZS: number;
}

export type FamilyRelationship = 
  | 'O‘zi (Asosiy ariza beruvchi)'
  | 'Aka'
  | 'Uka'
  | 'Opa'
  | 'Singil'
  | 'Ota'
  | 'Ona'
  | 'Farzand'
  | 'Turmush o‘rtog‘i';

export interface FamilyMemberInfo {
  id: string;
  relationship: FamilyRelationship;
  fullName: string;
  jshshr: string; // 14 raqam
  passportSeria: string; // 2 harf
  passportNumber: string; // 7 raqam
  faculty: string;
  course: string;
  phone1: string; // 1-telefon raqami (majburiy)
  phone2: string; // 2-telefon raqami (majburiy)
  phone?: string; // orqaga moslik uchun
  passportDoc?: DocumentFile;
  birthOrMarriageDoc?: DocumentFile; // Tug'ilganlik yoki qarindoshlik guvohnomasi
}

export interface FamilyApplicationData {
  id: string;
  type: 'family';
  createdAt: string;
  status: ApplicationStatus;
  adminNotes?: string;
  membersCount: number; // 1 dan 10 gacha
  members: FamilyMemberInfo[];
  contractAmountPerStudentUZS: number;
  discountRate: number; // 0.10 (10%)
  totalContractAmountUZS: number;
  totalSavedAmountUZS: number;
  totalFinalAmountUZS: number;
}

export type AnyApplication = FriendsApplicationData | FamilyApplicationData;

export type UserRole = 'student' | 'admin';

export interface AuthSession {
  role: UserRole;
  fullName: string;
  jshshr?: string;
  username?: string;
  loginAt: string;
}

export interface RegisteredUser {
  fullName: string;
  jshshr: string;
  login?: string;
  password?: string;
  registeredAt: string;
}

export interface ContractSettings {
  friendsContractAmountUZS: number; // Friends dasturi bo'yicha belgilangan shartnoma summasi
  familyContractAmountPerStudentUZS: number; // Family dasturida 1 nafar talaba uchun belgilangan summa
  academicYear: string; // 2026/2027
  notes?: string;
  lastUpdatedAt: string;
}

export interface AdminCredentials {
  username: string;
  password: string;
  lastChangedAt?: string;
  changedBy?: string;
}
