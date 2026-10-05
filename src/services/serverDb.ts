import { AnyApplication, ApplicationStatus, ContractSettings, AdminCredentials } from '../types';

/**
 * Check if the backend storage server is healthy
 */
export async function testServerConnection(): Promise<boolean> {
  try {
    const res = await fetch('/api/health');
    if (!res.ok) return false;
    const data = await res.json();
    return data.status === 'ok';
  } catch (err) {
    console.warn('Mahalliy server ulanish tekshiruvi:', err);
    return false;
  }
}

/**
 * Fetch all applications from the independent server
 */
export async function fetchAllApplicationsFromServer(): Promise<AnyApplication[]> {
  try {
    const res = await fetch('/api/applications');
    if (!res.ok) throw new Error('Arizalarni yuklab bo‘lmadi');
    const result = await res.json();
    return result.data || [];
  } catch (err) {
    console.warn('Serverdan arizalarni olishda xatolik:', err);
    // Fallback to localStorage
    const cached = localStorage.getItem('unigrant_applications');
    return cached ? JSON.parse(cached) : [];
  }
}

/**
 * Save an application to the server
 */
export async function saveApplicationToServer(appData: AnyApplication): Promise<void> {
  try {
    const res = await fetch('/api/applications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(appData),
    });
    if (!res.ok) {
      console.warn('Serverga saqlash xatosi, status:', res.status);
    }
  } catch (err) {
    console.warn('Serverga saqlash istisnosi:', err);
  }
}

/**
 * Update application status on the server
 */
export async function updateApplicationStatusOnServer(
  id: string,
  status: ApplicationStatus,
  adminNotes?: string
): Promise<void> {
  try {
    await fetch(`/api/applications/${id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, adminNotes }),
    });
  } catch (err) {
    console.warn('Serverda holatni yangilash xatosi:', err);
  }
}

/**
 * Bulk import applications (Zaxira faylini serverga yuklash)
 */
export async function bulkImportApplicationsToServer(apps: AnyApplication[]): Promise<number> {
  try {
    const res = await fetch('/api/applications/bulk-import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ applications: apps }),
    });
    const result = await res.json();
    return result.count || apps.length;
  } catch (err) {
    console.warn('Zaxiradan import qilish xatosi:', err);
    return 0;
  }
}

/**
 * Clear all applications on server (Reset to 0)
 */
export async function clearAllApplicationsOnServer(): Promise<boolean> {
  try {
    const res = await fetch('/api/admin/clear-all-applications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    return res.ok;
  } catch (err) {
    console.warn('Serverdagi arizalarni tozalash xatosi:', err);
    return false;
  }
}

/**
 * Save contract settings to server
 */
export async function saveContractSettingsToServer(settings: ContractSettings): Promise<void> {
  try {
    await fetch('/api/settings/contract_pricing', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings),
    });
  } catch (err) {
    console.warn('Kontrakt sozlamalarini serverga saqlash:', err);
  }
}

/**
 * Fetch contract settings from server
 */
export async function fetchContractSettingsFromServer(): Promise<ContractSettings | null> {
  try {
    const res = await fetch('/api/settings/contract_pricing');
    if (!res.ok) return null;
    const json = await res.json();
    return json.data || null;
  } catch (err) {
    return null;
  }
}

/**
 * Save admin credentials to server
 */
export async function saveAdminCredentialsToServer(creds: AdminCredentials): Promise<void> {
  try {
    await fetch('/api/settings/admin_credentials', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(creds),
    });
  } catch (err) {
    console.warn('Admin parolini serverga saqlash:', err);
  }
}

/**
 * Fetch admin credentials from server
 */
export async function fetchAdminCredentialsFromServer(): Promise<AdminCredentials | null> {
  try {
    const res = await fetch('/api/settings/admin_credentials');
    if (!res.ok) return null;
    const json = await res.json();
    return json.data || null;
  } catch (err) {
    return null;
  }
}

/**
 * Real-time polling subscriber for independent server
 */
export function subscribeServerData(
  onAppsUpdate: (apps: AnyApplication[]) => void,
  onSettingsUpdate: (settings: ContractSettings) => void,
  onCredsUpdate: (creds: AdminCredentials) => void,
  intervalMs = 2000
): () => void {
  let isMounted = true;

  const poll = async () => {
    try {
      const apps = await fetchAllApplicationsFromServer();
      if (isMounted && apps) {
        onAppsUpdate(apps);
      }

      const settings = await fetchContractSettingsFromServer();
      if (isMounted && settings) {
        onSettingsUpdate(settings);
      }

      const creds = await fetchAdminCredentialsFromServer();
      if (isMounted && creds) {
        onCredsUpdate(creds);
      }
    } catch {
      // ignore
    }
  };

  // Initial immediate fetch
  poll();

  const intervalId = setInterval(poll, intervalMs);

  return () => {
    isMounted = false;
    clearInterval(intervalId);
  };
}
