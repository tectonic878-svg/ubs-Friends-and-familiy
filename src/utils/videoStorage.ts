// IndexedDB-backed persistent video storage for UniGrant
// Allows Admin to upload large .mp4 videos that persist permanently across page refreshes

const DB_NAME = 'UniGrantVideosDB';
const DB_VERSION = 1;
const STORE_NAME = 'videos';

function openVideoDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB not supported'));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export type VideoType = 'friends' | 'family';

export const DEFAULT_VIDEOS: Record<VideoType, { src: string; name: string }> = {
  friends: {
    src: '/video_friends.mp4',
    name: 'video_friends.mp4'
  },
  family: {
    src: '/video_family.mp4',
    name: 'video_family.mp4'
  }
};

/**
 * Save an uploaded video Blob/File permanently to IndexedDB
 */
export async function saveVideoFile(type: VideoType, file: File | Blob, fileName: string): Promise<string> {
  try {
    const db = await openVideoDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.put({ blob: file, name: fileName, timestamp: Date.now() }, type);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });

    // Save name in localStorage for fast title lookup
    localStorage.setItem(`unigrant_video_name_${type}`, fileName);
    // Remove any stale custom URL
    localStorage.removeItem(`unigrant_video_custom_url_${type}`);
    // Clean old blob keys
    localStorage.removeItem(`unigrant_tutorial_video_${type}_src`);
    localStorage.removeItem('unigrant_tutorial_video_src');

    const objectUrl = URL.createObjectURL(file);
    window.dispatchEvent(new CustomEvent('unigrant_video_updated', { detail: { type, src: objectUrl } }));
    return objectUrl;
  } catch (err) {
    console.warn('Failed to save video to IndexedDB, fallback to session URL', err);
    const objectUrl = URL.createObjectURL(file);
    return objectUrl;
  }
}

/**
 * Save an external video URL
 */
export function saveVideoUrl(type: VideoType, url: string): void {
  localStorage.setItem(`unigrant_video_custom_url_${type}`, url);
  localStorage.setItem(`unigrant_video_name_${type}`, url);
  // Clear indexedDB copy if any
  clearIndexedDbVideo(type).catch(() => {});
  window.dispatchEvent(new CustomEvent('unigrant_video_updated', { detail: { type, src: url } }));
}

/**
 * Delete custom video from IndexedDB and localStorage, revert to default /public video
 */
export async function resetVideoToDefault(type: VideoType): Promise<string> {
  await clearIndexedDbVideo(type).catch(() => {});
  localStorage.removeItem(`unigrant_video_custom_url_${type}`);
  localStorage.removeItem(`unigrant_video_name_${type}`);
  localStorage.removeItem(`unigrant_tutorial_video_${type}_src`);
  localStorage.removeItem(`unigrant_tutorial_video_${type}_name`);
  localStorage.removeItem('unigrant_tutorial_video_src');
  localStorage.removeItem('unigrant_tutorial_video_name');

  const defaultSrc = DEFAULT_VIDEOS[type].src;
  window.dispatchEvent(new CustomEvent('unigrant_video_updated', { detail: { type, src: defaultSrc } }));
  return defaultSrc;
}

async function clearIndexedDbVideo(type: VideoType): Promise<void> {
  try {
    const db = await openVideoDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(type);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    // Ignore error
  }
}

/**
 * Load the active video URL and filename.
 * 1. Checks IndexedDB for uploaded file -> creates live ObjectURL
 * 2. Checks localStorage for custom URL
 * 3. Falls back to DEFAULT_VIDEOS (e.g. /video_friends.mp4, /video_family.mp4)
 */
export async function loadVideoData(type: VideoType): Promise<{ src: string; name: string }> {
  // Clean up any stale "blob:" strings in localStorage from previous code
  const oldLocalSrc = localStorage.getItem(`unigrant_tutorial_video_${type}_src`);
  if (oldLocalSrc && oldLocalSrc.startsWith('blob:')) {
    localStorage.removeItem(`unigrant_tutorial_video_${type}_src`);
  }
  const rootOldLocalSrc = localStorage.getItem('unigrant_tutorial_video_src');
  if (rootOldLocalSrc && rootOldLocalSrc.startsWith('blob:')) {
    localStorage.removeItem('unigrant_tutorial_video_src');
  }

  // 1. Check IndexedDB
  try {
    const db = await openVideoDB();
    const record = await new Promise<{ blob: Blob; name: string } | null>((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(type);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    });

    if (record && record.blob) {
      const src = URL.createObjectURL(record.blob);
      return {
        src,
        name: record.name || DEFAULT_VIDEOS[type].name
      };
    }
  } catch (err) {
    // Fallthrough
  }

  // 2. Check Custom URL
  const customUrl = localStorage.getItem(`unigrant_video_custom_url_${type}`);
  if (customUrl && !customUrl.startsWith('blob:')) {
    return {
      src: customUrl,
      name: customUrl
    };
  }

  // 3. Fallback to default
  return {
    src: DEFAULT_VIDEOS[type].src,
    name: DEFAULT_VIDEOS[type].name
  };
}
