import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  doc, 
  setDoc, 
  updateDoc, 
  onSnapshot, 
  getDocFromServer,
  query,
  orderBy,
  getDocs,
  enableNetwork
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import { AnyApplication, ApplicationStatus, ContractSettings, AdminCredentials } from '../types';

export const DEFAULT_ADMIN_CREDENTIALS: AdminCredentials = {
  username: 'admin',
  password: 'admin123',
};

// Initialize Firebase App
export const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app, (firebaseConfig as any).firestoreDatabaseId);

// Error Handling conforming to Firebase Skill Guidelines
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errMsg = error instanceof Error ? error.message : String(error);
  const isQuotaOrOffline = errMsg.includes('Quota limit exceeded') || 
                           errMsg.includes('quota') || 
                           errMsg.includes('the client is offline') ||
                           errMsg.includes('resource-exhausted');

  // If it's a quota or offline issue, gracefully warn without throwing unhandled exceptions
  if (isQuotaOrOffline) {
    console.warn(`Firestore [${operationType}] on [${path}] paused due to quota or offline status:`, errMsg);
    return;
  }

  const errInfo: FirestoreErrorInfo = {
    error: errMsg,
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Test initial connection as mandated by skill
export async function testConnection(): Promise<boolean> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    return true;
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    if (errMsg.includes('the client is offline') || errMsg.includes('Quota limit exceeded')) {
      console.warn('Firebase mijoz oflayn yoki kvota holatda:', errMsg);
      return false;
    }
    // If rules allow or document not found, the server is reached successfully
    return true;
  }
}
testConnection().catch(() => {});

/**
 * Force reconnect to Firestore cloud network
 */
export async function reconnectFirestore(): Promise<boolean> {
  try {
    await enableNetwork(db);
    return await testConnection();
  } catch (err) {
    console.warn('Firestore qayta ulanish xatosi:', err);
    return false;
  }
}

// Deep sanitize object for Firestore (strip undefined values)
function sanitizeForFirestore<T>(data: T): T {
  return JSON.parse(JSON.stringify(data));
}

/**
 * Real-time listener for all applications from Firestore
 * Ensures all 7 admins and students see past, current, and new applications across all devices in real-time.
 */
export function subscribeApplications(
  onUpdate: (applications: AnyApplication[]) => void,
  onError?: (err: Error) => void
): () => void {
  const collectionPath = 'applications';
  const appsCol = collection(db, collectionPath);
  
  const unsubscribe = onSnapshot(
    appsCol,
    (snapshot) => {
      const appsList: AnyApplication[] = [];
      snapshot.forEach((docSnap) => {
        if (docSnap.exists()) {
          appsList.push(docSnap.data() as AnyApplication);
        }
      });
      // Sort in-memory by createdAt descending
      appsList.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      onUpdate(appsList);
    },
    (error) => {
      const errMsg = error.message || '';
      const isQuotaOrOffline = errMsg.includes('Quota limit exceeded') || errMsg.includes('quota') || errMsg.includes('resource-exhausted') || errMsg.includes('offline');
      if (!isQuotaOrOffline) {
        console.error('Error listening to applications collection:', error);
      } else {
        console.warn('Firestore applications listener oflayn/kvota holatida:', errMsg);
      }
      if (onError) {
        onError(error);
      }
      try {
        handleFirestoreError(error, OperationType.GET, collectionPath);
      } catch {
        // handled
      }
    }
  );

  return unsubscribe;
}

/**
 * Save new student application to Firestore cloud
 */
export async function saveApplicationToFirestore(appData: AnyApplication): Promise<void> {
  const docPath = `applications/${appData.id}`;
  try {
    const cleanData = sanitizeForFirestore(appData);
    await setDoc(doc(db, 'applications', appData.id), cleanData);
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, docPath);
  }
}

/**
 * Update application status and notes in Firestore cloud (Admin action)
 */
export async function updateApplicationStatusInFirestore(
  id: string, 
  status: ApplicationStatus, 
  notes?: string
): Promise<void> {
  const docPath = `applications/${id}`;
  try {
    await updateDoc(doc(db, 'applications', id), {
      status,
      adminNotes: notes || '',
      updatedAt: new Date().toISOString()
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, docPath);
  }
}

/**
 * Real-time listener for university contract settings
 */
export function subscribeContractSettings(
  onUpdate: (settings: ContractSettings) => void,
  onError?: (err: Error) => void
): () => void {
  const docPath = 'settings/contract_pricing';
  const settingsDocRef = doc(db, 'settings', 'contract_pricing');

  const unsubscribe = onSnapshot(
    settingsDocRef,
    (docSnap) => {
      if (docSnap.exists()) {
        onUpdate(docSnap.data() as ContractSettings);
      }
    },
    (error) => {
      const errMsg = error.message || '';
      const isQuotaOrOffline = errMsg.includes('Quota limit exceeded') || errMsg.includes('quota') || errMsg.includes('resource-exhausted') || errMsg.includes('offline');
      if (!isQuotaOrOffline) {
        console.error('Error listening to contract settings:', error);
      } else {
        console.warn('Firestore settings listener oflayn/kvota holatida:', errMsg);
      }
      if (onError) {
        onError(error);
      }
      try {
        handleFirestoreError(error, OperationType.GET, docPath);
      } catch {
        // handled
      }
    }
  );

  return unsubscribe;
}

/**
 * Save updated contract settings to Firestore cloud
 */
export async function saveContractSettingsToFirestore(settings: ContractSettings): Promise<void> {
  const docPath = 'settings/contract_pricing';
  try {
    const cleanData = sanitizeForFirestore(settings);
    await setDoc(doc(db, 'settings', 'contract_pricing'), cleanData);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, docPath);
  }
}

/**
 * Real-time listener for admin credentials (username and password)
 * Stored centrally in Firestore so all 7 admins stay synchronized
 */
export function subscribeAdminCredentials(
  onUpdate: (credentials: AdminCredentials) => void,
  onError?: (err: Error) => void
): () => void {
  const docPath = 'settings/admin_credentials';
  const credsDocRef = doc(db, 'settings', 'admin_credentials');

  const unsubscribe = onSnapshot(
    credsDocRef,
    (docSnap) => {
      if (docSnap.exists()) {
        onUpdate(docSnap.data() as AdminCredentials);
      }
    },
    (error) => {
      const errMsg = error.message || '';
      const isQuotaOrOffline = errMsg.includes('Quota limit exceeded') || errMsg.includes('quota') || errMsg.includes('resource-exhausted') || errMsg.includes('offline');
      if (!isQuotaOrOffline) {
        console.error('Error listening to admin credentials:', error);
      } else {
        console.warn('Firestore admin credentials listener oflayn/kvota holatida:', errMsg);
      }
      if (onError) {
        onError(error);
      }
      try {
        handleFirestoreError(error, OperationType.GET, docPath);
      } catch {
        // handled
      }
    }
  );

  return unsubscribe;
}

/**
 * Save changed admin credentials to Firestore cloud
 */
export async function saveAdminCredentialsToFirestore(credentials: AdminCredentials): Promise<void> {
  const docPath = 'settings/admin_credentials';
  try {
    const cleanData = sanitizeForFirestore({
      ...credentials,
      lastChangedAt: new Date().toISOString()
    });
    await setDoc(doc(db, 'settings', 'admin_credentials'), cleanData);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, docPath);
  }
}
