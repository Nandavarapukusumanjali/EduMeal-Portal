import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager, doc, getDocFromServer } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firestore with robust local persistent cache for seamless offline support
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager(),
  })
}, firebaseConfig.firestoreDatabaseId);

export const auth = getAuth(app);

// Error handling types as specified in the Firebase integration skill instructions
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
  const errMessage = error instanceof Error ? error.message : String(error);
  const errCode = (error as any)?.code;
  
  // Create formatted FirestoreErrorInfo
  const errInfo: FirestoreErrorInfo = {
    error: errMessage,
    authInfo: {
      userId: auth.currentUser?.uid || null,
      email: auth.currentUser?.email || null,
      emailVerified: auth.currentUser?.emailVerified || null,
      isAnonymous: auth.currentUser?.isAnonymous || null,
      tenantId: auth.currentUser?.tenantId || null,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  
  console.warn('Firestore Warning/Error info: ', JSON.stringify(errInfo));

  // If Firestore is offline or unavailable, prevent crashing the app.
  // Allow the client to work seamlessly in offline mode using the local persistent cache.
  if (errCode === 'unavailable' || errMessage.toLowerCase().includes('unavailable') || errMessage.toLowerCase().includes('could not reach')) {
    console.warn(`Firestore is operating in local/offline mode gracefully.`);
    return;
  }
  
  throw new Error(JSON.stringify(errInfo));
}

// CRITICAL CONSTRAINT: Validate connection to Firestore on initial boot
async function testConnection() {
  try {
    // Attempt load from server to verify connection is operational
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    const errMessage = error instanceof Error ? error.message : String(error);
    const errCode = (error as any)?.code;
    if (errCode === 'unavailable' || errMessage.toLowerCase().includes('offline') || errMessage.toLowerCase().includes('could not reach')) {
      console.warn("Firestore Notice: Client is operating in offline mode. Local persistent cache is active.");
    } else {
      console.error("Firestore test connection error:", error);
    }
  }
}

testConnection();
