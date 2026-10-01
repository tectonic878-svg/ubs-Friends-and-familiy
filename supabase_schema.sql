-- UBS Friends & Family Chegirma Tizimi
-- Supabase PostgreSQL Jadval Strukturalari
-- Ushbu kodni Supabase -> SQL Editor bo'limiga qo'yib, "Run" tugmasini bosing!

-- 1. Arizalar jadvali (Applications)
CREATE TABLE IF NOT EXISTS public.applications (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'kutilmoqda',
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()),
  data JSONB NOT NULL
);

-- 2. Tizim sozlamalari jadvali (System Settings: kontrakt narxlari, admin login)
CREATE TABLE IF NOT EXISTS public.system_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);

-- 3. Barcha foydalanuvchilar (anon va autentifikatsiyalangan) uchun o'qish va yozish ruxsatlari
ALTER TABLE public.applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

-- Arizalar uchun to'liq erkin policy (7 admin va talabalar uchun)
CREATE POLICY "Allow all operations for applications"
ON public.applications
FOR ALL
USING (true)
WITH CHECK (true);

-- Sozlamalar uchun to'liq erkin policy
CREATE POLICY "Allow all operations for system_settings"
ON public.system_settings
FOR ALL
USING (true)
WITH CHECK (true);

-- Realtime hodisalarni yoqish
ALTER PUBLICATION supabase_realtime ADD TABLE public.applications;
ALTER PUBLICATION supabase_realtime ADD TABLE public.system_settings;

-- 4. BAZA VA 1GB XOTIRANI TO'LIQ TOZALASH / QAYTA ISHGA TUSHIRISH (Storage Reset)
-- Agar bazadagi barcha yuklangan fayllar va arizalarni o'chirib, 1GB xotirani 0 MB ga qaytarmoqchi bo'lsangiz, 
-- quyidagi buyruqni Supabase SQL Editor bo'limiga qo'yib "Run" tugmasini bosing:
--
-- TRUNCATE TABLE public.applications;


