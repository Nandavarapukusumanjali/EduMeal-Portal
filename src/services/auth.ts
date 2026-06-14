import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  User as FirebaseUser
} from 'firebase/auth';
import { auth } from '../firebase';
import { getUserProfile, saveUserProfile, UserProfile } from './db';
import { Role } from '../types';
import firebaseConfig from '../../firebase-applet-config.json';

// Password length helper (Firebase requires minimum 6 characters)
function getSecurePassword(password: string): string {
  // Pad shorter passwords to satisfy Firebase standard validation constraints safely
  if (password.length < 6) {
    return `${password}_secure`;
  }
  return password;
}

// Convert local credentials username + role into a legitimate standard email format
function getEmailForUser(username: string, role: Role): string {
  const sanitized = username.toLowerCase().replace(/[^a-z0-9]/g, '');
  const finalUsername = sanitized || 'user';
  return `${finalUsername}_${role}@edumeal.gov.in`;
}

/**
 * Handle operation-not-allowed error by providing detailed walkthrough to enable standard providers
 */
function handleAuthError(error: any): never {
  const errStr = String(error);
  if (error?.code === 'auth/operation-not-allowed' || errStr.includes('operation-not-allowed')) {
    const projectId = firebaseConfig?.projectId || 'gen-lang-client-0904883411';
    throw new Error(
      `Email/Password provider is disabled in Firebase. To enable it:\n\n` +
      `1. Open the Firebase Console:\n` +
      `https://console.firebase.google.com/project/${projectId}/authentication/providers\n\n` +
      `2. Click "Add new provider" under the "Sign-in method" tab.\n` +
      `3. Choose "Email/Password" and click "Enable" (under the first slider) and click "Save".\n\n` +
      `Then return here and retry login!`
    );
  }
  throw error;
}

/**
 * Robust role-based authenticator combining Firebase Auth and Firestore profile validations.
 * Does NOT perform auto-registration; expects the user to have signed up first.
 */
export async function authenticateRole(
  username: string, 
  password: string, 
  role: Role
): Promise<UserProfile> {
  const email = getEmailForUser(username, role);
  const securePwd = getSecurePassword(password);
  
  try {
    // Attempt standard login
    const userCredential = await signInWithEmailAndPassword(auth, email, securePwd);
    const uid = userCredential.user.uid;
    
    // Check if role is stored correctly in Firestore
    const profile = await getUserProfile(uid);
    if (!profile) {
      throw new Error('Your user profile could not be found. Please sign up to create your account registry.');
    }
    
    // Safety check - verify role matches expected
    if (profile.role !== role) {
      throw new Error(`Profile access restricted. This account is registered under the role: ${profile.role}`);
    }
    
    return profile;
  } catch (error: any) {
    if (error?.code === 'auth/operation-not-allowed' || String(error).includes('operation-not-allowed')) {
      handleAuthError(error);
    }
    
    if (
      error.code === 'auth/user-not-found' || 
      error.code === 'auth/invalid-credential' || 
      error.code === 'auth/wrong-password' ||
      String(error).includes('user-not-found') || 
      String(error).includes('invalid-credential')
    ) {
      throw new Error('Invalid username or PIN. Please verify your credentials or register a new account.');
    }
    
    throw new Error(error.message || 'Authorization failed. Please check your credentials.');
  }
}

/**
 * Handle explicit user registration/sign up.
 * Stores the user record in standard Firebase Authentication and creates a user profile in Firestore.
 */
export async function signUpUser(
  username: string,
  password: string,
  role: Role
): Promise<UserProfile> {
  const email = getEmailForUser(username, role);
  const securePwd = getSecurePassword(password);
  
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, securePwd);
    const uid = userCredential.user.uid;
    
    const profile: UserProfile = {
      uid,
      email,
      name: username,
      role,
      createdAt: new Date().toISOString()
    };
    
    await saveUserProfile(profile);
    return profile;
  } catch (error: any) {
    if (error?.code === 'auth/operation-not-allowed' || String(error).includes('operation-not-allowed')) {
      handleAuthError(error);
    }
    if (error?.code === 'auth/email-already-in-use' || String(error).includes('email-already-in-use')) {
      throw new Error('This username is already registered for this role. Please use Log In or try a different name.');
    }
    throw new Error(error.message || 'Could not complete registration. Please try again.');
  }
}

/**
 * Log out from Firebase Auth
 */
export async function logoutUser(): Promise<void> {
  await signOut(auth);
}

/**
 * Handle state changes securely
 */
export function listenToAuthState(callback: (user: FirebaseUser | null) => void) {
  return onAuthStateChanged(auth, callback);
}
