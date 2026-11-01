-- UBS Friends & Family Chegirma Tizimi
-- Supabase PostgreSQL Jadval Strukturalari va Huquqlari
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

-- 3. HUQUQLARNI BERISH (42501 permission denied xatosini 100% bartaraf etadi)
GRANT ALL ON TABLE public.applications TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.system_settings TO anon, authenticated, service_role;

-- 4. Barcha foydalanuvchilar (anon va adminlar) erkin yozishi va o'qishi uchun RLS ni ochish
ALTER TABLE public.applications DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_settings DISABLE ROW LEVEL SECURITY;

-- 5. Realtime hodisalarni yoqish (barcha adminlar ekranida jonli yangilanishi uchun)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'applications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.applications;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'system_settings'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.system_settings;
  END IF;
END $$;
