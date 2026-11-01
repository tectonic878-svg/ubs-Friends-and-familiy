# Reja: Google Drive va Google Sheets Zaxira Tizimini Ulash

## 1. Nega Google Drive-da zaxira saqlanmayotgan edi?
1. Google Drive va Google Sheets shaxsiy bulut xizmatlari bo'lgani sababli, ularga ma'lumot yuklash uchun Google hisobingizdan maxsus ruxsat (OAuth roziligi) olinishi shart.
2. Hozirgacha ilovada rasmiy Google OAuth ruxsat kartasi faollashtirilmagan edi.
3. `/api/documents/download-all-zip` havolasi esa bazada arizalar hali bo'lmagani sababli 404 qaytargan edi — bu to'liq to'g'irlandi va endi havola orqali har doim 200 OK bilan haqiqiy ZIP arxiv yuklanmoqda.

## 2. Amalga oshirish bosqichlari

### 1-qadam: Google Workspace OAuth ulanishini ochish
- `set_up_oauth` vositasi orqali quyidagi 2 ta ruxsatni faollashtirish:
  - `https://www.googleapis.com/auth/drive.file` (Google Drive-da PDF hujjatlar uchun maxsus jild ochish va fayllarni yuklash)
  - `https://www.googleapis.com/auth/spreadsheets` (Google Sheets-da arizalar jadvalini yaratish va yangilash)
- Siz rozilik bildirish uchun ekranda Google Ulanish kartasini tasdiqlaysiz.

### 2-qadam: Avtomatik Google Drive & Sheets sinxronizatsiyasi
- Talabalar saytdan ariza yuborganda:
  1. Talabaning asl PDF hujjatlari (pasport va diplom nusxalari) to'g'ridan-to'g'ri sizning Google Drive jildingizga yuklanadi.
  2. Barcha ma'lumotlar Google Sheets jadvaliga yangi qator bo'lib avtomatik yoziladi.
- Admin portalidagi **"Google Drive va Sheets ga sinxronlash"** tugmasi orqali avvalgi barcha mavjud arizalar va PDF fayllarni ham 1 marta bosish bilan Google hisobingizga nusxalash imkoniyati yaratiladi.

### 3-qadam: Sinov va tekshirish
- Yangi ariza yuborish orqali Google Drive jildida PDF paydo bo'lishini va Google Sheets jadvalida yozuv tushishini tekshirish.
- ZIP arxiv yuklab olish tizimini yakuniy tekshirish.
