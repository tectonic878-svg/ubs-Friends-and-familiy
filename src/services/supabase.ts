import { createClient } from '@supabase/supabase-js';
import { AnyApplication, ApplicationStatus, ContractSettings, AdminCredentials } from '../types';

// Supabase Project Credentials
export const DEFAULT_SUPABASE_URL = 'https://inyevztbojubfainwste.supabase.co';
export const DEFAULT_SUPABASE_ANON_KEY = 'sb_publishable_HfgGCcfIL2N3W68I5yDsKw_KrZDJ29D';

export function getSupabaseCredentials(): { url: string; key: string } {
  try {
    const custom = localStorage.getItem('unigrant_supabase_config');
    if (custom) {
      const parsed = JSON.parse(custom);
      if (parsed.url && parsed.key) return parsed;
    }
  } catch {
    // ignore
  }
  return { url: DEFAULT_SUPABASE_URL, key: DEFAULT_SUPABASE_ANON_KEY };
}

export function saveCustomSupabaseCredentials(url: string, key: string): void {
  try {
    localStorage.setItem('unigrant_supabase_config', JSON.stringify({ url: url.trim(), key: key.trim() }));
  } catch {
    // ignore
  }
}

export function resetSupabaseCredentialsToDefault(): void {
  try {
    localStorage.removeItem('unigrant_supabase_config');
  } catch {
    // ignore
  }
}

const initialCreds = getSupabaseCredentials();
export let SUPABASE_URL = initialCreds.url;
export let SUPABASE_ANON_KEY = initialCreds.key;

export let supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
});

export function reinitializeSupabaseClient(): void {
  const creds = getSupabaseCredentials();
  SUPABASE_URL = creds.url;
  SUPABASE_ANON_KEY = creds.key;
  supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    },
    realtime: {
      params: {
        eventsPerSecond: 10,
      },
    },
  });
}

/**
 * Test connectivity with Supabase
 */
export async function testSupabaseConnection(): Promise<boolean> {
  try {
    const { data, error } = await supabase.from('applications').select('id').limit(1);
    if (error) {
      console.warn('Supabase test ulanish:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('Supabase ulanish xatosi:', err);
    return false;
  }
}

/**
 * Save or update an application in Supabase
 */
export async function saveApplicationToSupabase(appData: AnyApplication): Promise<void> {
  try {
    const payload = {
      id: appData.id,
      type: appData.type,
      status: appData.status,
      created_at: appData.createdAt,
      data: appData,
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase
      .from('applications')
      .upsert(payload, { onConflict: 'id' });

    if (error) {
      console.warn('Supabase arizani saqlashda xatolik:', error.message);
      // Save locally as transparent backup
      saveAppToLocal(appData);
    }
  } catch (err) {
    console.warn('Supabase saqlash istisnosi:', err);
    saveAppToLocal(appData);
  }
}

/**
 * Update application status and admin notes in Supabase
 */
export async function updateApplicationStatusInSupabase(
  id: string,
  status: ApplicationStatus,
  adminNotes?: string
): Promise<void> {
  try {
    // First get existing application to merge updated status into JSON data
    const { data: existing, error: fetchErr } = await supabase
      .from('applications')
      .select('data')
      .eq('id', id)
      .maybeSingle();

    if (fetchErr) {
      console.warn('Supabase fetch prior to update status failed:', fetchErr.message);
    }

    const updatedData = existing && existing.data 
      ? { ...existing.data, status, adminNotes }
      : { id, status, adminNotes };

    const { error } = await supabase
      .from('applications')
      .update({
        status,
        data: updatedData,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (error) {
      console.warn('Supabase ariza holatini yangilash xatosi:', error.message);
    }
  } catch (err) {
    console.warn('Supabase update status istisnosi:', err);
  }
}

/**
 * Delete an application from Supabase
 */
export async function deleteApplicationFromSupabase(id: string): Promise<void> {
  try {
    const { error } = await supabase.from('applications').delete().eq('id', id);
    if (error) {
      console.warn('Supabase arizani o‘chirish xatosi:', error.message);
    }
  } catch (err) {
    console.warn('Supabase delete xatosi:', err);
  }
}

/**
 * Delete ALL applications and uploaded files from Supabase database to free 1GB storage
 */
export async function deleteAllApplicationsFromSupabase(): Promise<{ 
  success: boolean; 
  count?: number; 
  error?: string;
  isEgressQuota?: boolean;
}> {
  // Always clear local cache first
  try {
    localStorage.removeItem('unigrant_applications');
  } catch {
    // ignore
  }

  try {
    // Supabase PostgREST requires a WHERE filter for DELETE; using neq id to match all
    const { error, count } = await supabase
      .from('applications')
      .delete({ count: 'exact' })
      .neq('id', '__NON_EXISTING_ID_MATCH_ALL__');

    if (error) {
      const errMsg = error.message || '';
      const isEgress = errMsg.includes('exceed_egress_quota') || errMsg.includes('restricted') || errMsg.includes('quota');
      if (isEgress) {
        console.warn('Supabase egress kvotasi to‘lgan:', errMsg);
        return { 
          success: true,
          count: 0,
          isEgressQuota: true,
          error: 'Lokal arizalar va xotira 100% tozalandi. Supabase bulut bazasida bepul tarifning tarmoq (egress) kvotasi to‘lgan. Bulutli bazani to‘liq bo‘shatish uchun Supabase SQL Editor bo‘limida TRUNCATE buyrug‘ini bajaring.' 
        };
      }
      console.warn('Supabase barcha arizalarni o‘chirish xatosi:', error.message);
      return { success: false, error: error.message };
    }

    return { success: true, count: count ?? 0 };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Noma’lum xatolik';
    const isEgress = msg.includes('exceed_egress_quota') || msg.includes('restricted') || msg.includes('quota');
    if (isEgress) {
      return { 
        success: true,
        count: 0,
        isEgressQuota: true,
        error: 'Lokal arizalar va xotira 100% tozalandi. Supabase bulut bazasida egress kvotasi to‘lgan. Bulutli bazani to‘liq tiklash uchun Supabase SQL Editor bo‘limida TRUNCATE buyrug‘ini bajaring.' 
      };
    }
    console.warn('Supabase deleteAll istisnosi:', msg);
    return { success: false, error: msg };
  }
}

/**
 * Purge heavy base64 file payloads from all applications while keeping student records
 */
export async function purgeHeavyFilesFromSupabase(): Promise<{ success: boolean; count?: number; error?: string }> {
  try {
    // Fetch all current applications
    const { data, error } = await supabase.from('applications').select('*');
    if (error) {
      return { success: false, error: error.message };
    }

    if (!data || data.length === 0) {
      return { success: true, count: 0 };
    }

    let updatedCount = 0;
    for (const row of data) {
      const appData = row.data as AnyApplication;
      if (!appData) continue;

      let modified = false;
      if (appData.type === 'friends') {
        if (appData.applicantStudent?.passportDoc?.url) {
          appData.applicantStudent.passportDoc.url = '';
          modified = true;
        }
        if (appData.applicantStudent?.certificateDoc?.url) {
          appData.applicantStudent.certificateDoc.url = '';
          modified = true;
        }
        if (appData.friendStudent?.passportDoc?.url) {
          appData.friendStudent.passportDoc.url = '';
          modified = true;
        }
        if (appData.friendStudent?.certificateDoc?.url) {
          appData.friendStudent.certificateDoc.url = '';
          modified = true;
        }
        if (appData.friendsList) {
          appData.friendsList.forEach(fr => {
            if (fr.passportDoc?.url) { fr.passportDoc.url = ''; modified = true; }
            if (fr.certificateDoc?.url) { fr.certificateDoc.url = ''; modified = true; }
          });
        }
      } else if (appData.type === 'family') {
        if (appData.members) {
          appData.members.forEach(m => {
            if (m.passportDoc?.url) { m.passportDoc.url = ''; modified = true; }
            if (m.birthOrMarriageDoc?.url) { m.birthOrMarriageDoc.url = ''; modified = true; }
          });
        }
      }

      if (modified) {
        await supabase
          .from('applications')
          .update({ data: appData, updated_at: new Date().toISOString() })
          .eq('id', row.id);
        updatedCount++;
      }
    }

    return { success: true, count: updatedCount };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Noma’lum xatolik';
    return { success: false, error: msg };
  }
}

/**
 * Calculate estimated storage usage in MB and count of files
 */
export function calculateStorageUsage(apps: AnyApplication[]): {
  totalBytes: number;
  totalMB: number;
  totalFiles: number;
  appsCount: number;
} {
  let totalBytes = 0;
  let totalFiles = 0;

  apps.forEach(app => {
    // Estimate app JSON size
    const jsonStr = JSON.stringify(app);
    totalBytes += jsonStr.length * 2; // rough UTF-16 byte estimation

    if (app.type === 'friends') {
      const students = [
        app.applicantStudent,
        ...(app.friendsList && app.friendsList.length > 0 ? app.friendsList : [app.friendStudent])
      ];
      students.forEach(s => {
        if (s?.passportDoc?.url) totalFiles++;
        if (s?.certificateDoc?.url) totalFiles++;
      });
    } else if (app.type === 'family') {
      app.members?.forEach(m => {
        if (m?.passportDoc?.url) totalFiles++;
        if (m?.birthOrMarriageDoc?.url) totalFiles++;
      });
    }
  });

  const totalMB = Number((totalBytes / (1024 * 1024)).toFixed(2));
  return {
    totalBytes,
    totalMB,
    totalFiles,
    appsCount: apps.length
  };
}

/**
 * Real-time subscription to all applications from Supabase
 */
export function subscribeApplicationsSupabase(
  onUpdate: (apps: AnyApplication[]) => void,
  onError?: (err: Error) => void
): () => void {
  let isMounted = true;

  // Batch fetch to safely load large Base64 documents without hitting PostgREST statement timeout
  const fetchAllApps = async () => {
    try {
      const allApps: AnyApplication[] = [];
      const BATCH_SIZE = 2; // 2 applications per batch ensures fast queries under statement timeout
      let from = 0;
      let hasMore = true;

      while (hasMore && isMounted) {
        const { data, error } = await supabase
          .from('applications')
          .select('*')
          .order('created_at', { ascending: false })
          .range(from, from + BATCH_SIZE - 1);

        if (error) {
          console.warn('Supabase arizalar yuklashda xatolik:', error.message);
          if (onError) onError(new Error(error.message));
          return;
        }

        if (data && data.length > 0) {
          for (const row of data) {
            if (row.data) {
              allApps.push(row.data as AnyApplication);
            }
          }
          if (data.length < BATCH_SIZE) {
            hasMore = false;
          } else {
            from += BATCH_SIZE;
          }
        } else {
          hasMore = false;
        }
      }

      if (isMounted) {
        onUpdate(allApps);
      }
    } catch (err) {
      if (onError && err instanceof Error) onError(err);
    }
  };

  fetchAllApps();

  // Listen to Postgres Realtime changes
  const channel = supabase
    .channel('public:applications')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'applications' },
      () => {
        fetchAllApps();
      }
    )
    .subscribe();

  return () => {
    isMounted = false;
    supabase.removeChannel(channel);
  };
}

/**
 * Save contract pricing settings to Supabase
 */
export async function saveContractSettingsToSupabase(settings: ContractSettings): Promise<void> {
  try {
    const { error } = await supabase
      .from('system_settings')
      .upsert({
        key: 'contract_pricing',
        value: settings,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'key' });

    if (error) {
      console.warn('Supabase kontrakt sozlamalarini saqlash:', error.message);
    }
  } catch (err) {
    console.warn('Supabase sozlamalar istisnosi:', err);
  }
}

/**
 * Real-time subscription to contract settings
 */
export function subscribeContractSettingsSupabase(
  onUpdate: (settings: ContractSettings) => void,
  onError?: (err: Error) => void
): () => void {
  let isMounted = true;

  const fetchSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('system_settings')
        .select('value')
        .eq('key', 'contract_pricing')
        .maybeSingle();

      if (error && onError) {
        onError(new Error(error.message));
        return;
      }

      if (isMounted && data && data.value) {
        onUpdate(data.value as ContractSettings);
      }
    } catch (err) {
      if (onError && err instanceof Error) onError(err);
    }
  };

  fetchSettings();

  const channel = supabase
    .channel('public:contract_pricing')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'system_settings', filter: 'key=eq.contract_pricing' },
      () => {
        fetchSettings();
      }
    )
    .subscribe();

  return () => {
    isMounted = false;
    supabase.removeChannel(channel);
  };
}

/**
 * Save admin credentials to Supabase
 */
export async function saveAdminCredentialsToSupabase(creds: AdminCredentials): Promise<void> {
  try {
    const { error } = await supabase
      .from('system_settings')
      .upsert({
        key: 'admin_credentials',
        value: creds,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'key' });

    if (error) {
      console.warn('Supabase admin login saqlash:', error.message);
    }
  } catch (err) {
    console.warn('Supabase admin login istisnosi:', err);
  }
}

/**
 * Real-time subscription to admin credentials
 */
export function subscribeAdminCredentialsSupabase(
  onUpdate: (creds: AdminCredentials) => void,
  onError?: (err: Error) => void
): () => void {
  let isMounted = true;

  const fetchCreds = async () => {
    try {
      const { data, error } = await supabase
        .from('system_settings')
        .select('value')
        .eq('key', 'admin_credentials')
        .maybeSingle();

      if (error && onError) {
        onError(new Error(error.message));
        return;
      }

      if (isMounted && data && data.value) {
        onUpdate(data.value as AdminCredentials);
      }
    } catch (err) {
      if (onError && err instanceof Error) onError(err);
    }
  };

  fetchCreds();

  const channel = supabase
    .channel('public:admin_credentials')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'system_settings', filter: 'key=eq.admin_credentials' },
      () => {
        fetchCreds();
      }
    )
    .subscribe();

  return () => {
    isMounted = false;
    supabase.removeChannel(channel);
  };
}

/**
 * Helper: save to localStorage as fail-safe
 */
function saveAppToLocal(app: AnyApplication) {
  try {
    const raw = localStorage.getItem('unigrant_applications');
    const list: AnyApplication[] = raw ? JSON.parse(raw) : [];
    const idx = list.findIndex((a) => a.id === app.id);
    if (idx >= 0) {
      list[idx] = app;
    } else {
      list.unshift(app);
    }
    localStorage.setItem('unigrant_applications', JSON.stringify(list));
  } catch {
    // ignore
  }
}
