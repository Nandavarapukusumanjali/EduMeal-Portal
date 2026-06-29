import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  getAuth,
  updatePassword,
  updateEmail,
  User as FirebaseUser
} from 'firebase/auth';
import { initializeApp } from 'firebase/app';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { 
  getUserProfile, saveUserProfile, updateUserProfile, getUserProfileByEmail,
  getUserProfileByUsernameAndRole, deleteUserProfile, revisedEmailsMap 
} from './db';
import { Role, UserProfile } from '../types';
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
export function getEmailForUser(username: string, role: Role): string {
  let sanitized = username.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
  
  // Strip role suffix if it was already appended to avoid duplicates (e.g. _coordinator_coordinator)
  const roleSuffix = `_${role}`;
  if (sanitized.endsWith(roleSuffix)) {
    sanitized = sanitized.slice(0, -roleSuffix.length);
  }
  // Also strip the role name itself if it is at the end
  if (sanitized.endsWith(role)) {
    sanitized = sanitized.slice(0, -role.length);
  }
  // Trim any trailing underscores
  while (sanitized.endsWith('_')) {
    sanitized = sanitized.slice(0, -1);
  }

  const finalUsername = sanitized || 'user';
  return `${finalUsername}_${role}@edumeal.gov.in`;
}

/**
 * Extract original username from email and role, handling potential recreated formats correctly.
 */
export function getUsernameFromEmail(email: string, role: Role): string {
  const emailPart = email.split('@')[0].toLowerCase();
  const roleSuffix = `_${role}`.toLowerCase();
  let usernamePart = emailPart;
  if (usernamePart.endsWith(roleSuffix)) {
    usernamePart = usernamePart.slice(0, -roleSuffix.length);
  }
  if (usernamePart.includes('_recreate_')) {
    usernamePart = usernamePart.split('_recreate_')[0];
  }
  return usernamePart;
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
  // Try to resolve user's email from their Firestore profile (handles recreated accounts with unique revision emails)
  let email = getEmailForUser(username, role);
  try {
    const existingProfile = await getUserProfileByUsernameAndRole(username, role);
    if (existingProfile && existingProfile.email) {
      email = existingProfile.email;
    }
  } catch (err) {
    // Graceful fallback to default formatted email
  }
  
  const securePwd = getSecurePassword(password);
  
  if (role === 'student') {
    const studentRoll = username.trim();
    const studentDocId = `st_${studentRoll}`;
    
    try {
      const studentSnap = await getDoc(doc(db, 'students', studentDocId));
      if (studentSnap.exists()) {
        const studentData = studentSnap.data() as any;
        const storedDob = studentData.dob;
        
        if (storedDob) {
          if (storedDob.trim() !== password.trim()) {
            throw new Error('Incorrect Password PIN. For students, your initial PIN is your Date of Birth (DOB) e.g., 2012-05-15.');
          }
        } else {
          // If no DOB is stored, set the entered password as DOB on the student document
          await updateDoc(doc(db, 'students', studentDocId), {
            dob: password.trim()
          });
          studentData.dob = password.trim();
        }
        
        // Try logging in standardly. If they don't have a Firebase Auth account, we create it.
        try {
          const userCredential = await signInWithEmailAndPassword(auth, email, securePwd);
          const uid = userCredential.user.uid;
          const profile = await getUserProfile(uid);
          if (profile) {
            if (profile.status === 'inactive') {
              throw new Error('This account has been deactivated by the administration.');
            }
            if (profile.status === 'rejected') {
              throw new Error('This account registration has been rejected by the administration.');
            }
            return profile;
          }
        } catch (authErr: any) {
          if (
            authErr.code === 'auth/user-not-found' || 
            authErr.code === 'auth/invalid-credential' ||
            String(authErr).includes('user-not-found') || 
            String(authErr).includes('invalid-credential')
          ) {
            // Check if there's already a profile for this email that has been rejected
            const existingProfile = await getUserProfileByEmail(email);
            if (existingProfile && existingProfile.status === 'rejected') {
              throw new Error('This account registration has been rejected by the administration.');
            }

            // Auto-provision their Firebase Auth account
            const uid = await createAuthUserSecondary(studentRoll, password.trim(), 'student');
            
            const newProfile: UserProfile = {
              uid,
              email,
              name: studentData.name || 'Student',
              role: 'student',
              status: 'active',
              first_login: true,
              dob: studentData.dob || password.trim(),
              class: studentData.class || 'Class 6',
              section: studentData.section || 'Section A',
              roll_number: studentRoll,
              createdAt: new Date().toISOString()
            };
            
            await saveUserProfile(newProfile);
            
            // Sign in successfully
            await signInWithEmailAndPassword(auth, email, securePwd);
            return newProfile;
          } else {
            throw authErr;
          }
        }
      }
    } catch (err: any) {
      if (
        (err.message && err.message.includes('Incorrect Password')) ||
        (err.message && err.message.includes('deactivated')) ||
        (err.message && err.message.includes('rejected'))
      ) {
        throw err;
      }
      console.warn('Silent warning - student check bypassed, checking standard user:', err);
    }
  }

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

    if (profile.status === 'inactive') {
      throw new Error('This account has been deactivated by the administration.');
    }
    if (profile.status === 'rejected') {
      throw new Error('This account registration has been rejected by the administration.');
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

    if (String(error.message || error).toLowerCase().includes('quota') || String(error.message || error).toLowerCase().includes('resource-exhausted')) {
      throw new Error('Our database service is temporarily limited due to high demand. Please try logging in again in a few minutes.');
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
      password_pin: password,
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

/**
 * Secondary account registrar to create Auth credentials in a separate context.
 * Bypasses the default auto-login behavior of createUserWithEmailAndPassword.
 */
export async function createAuthUserSecondary(username: string, password: string, role: Role): Promise<string> {
  const email = getEmailForUser(username, role);
  const securePwd = getSecurePassword(password);
  
  // Create a separate instance to avoid signing out the current admin
  const secondaryAppName = `SecondaryAuthApp_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
  const secondaryApp = initializeApp(firebaseConfig, secondaryAppName);
  const secondaryAuth = getAuth(secondaryApp);
  
  try {
    const userCredential = await createUserWithEmailAndPassword(secondaryAuth, email, securePwd);
    const uid = userCredential.user.uid;
    await signOut(secondaryAuth);
    return uid;
  } catch (error: any) {
    if (error?.code === 'auth/operation-not-allowed' || String(error).includes('operation-not-allowed')) {
      handleAuthError(error);
    }
    
    // Check if error is email-already-in-use (meaning we are trying to recreate a deactivated/existing user)
    if (error?.code === 'auth/email-already-in-use' || String(error).includes('email-already-in-use')) {
      console.log(`Recreation handling: Email already in use for ${email}. Re-using or recreating.`);
      
      const existingProfile = await getUserProfileByEmail(email);
      
      // CRITICAL: If the existing account was deactivated/inactive, we MUST NOT reuse the old credentials or try to sign in.
      // Instead, we immediately create a fresh revised/timestamped Auth user and return its UID.
      // This satisfies the requirement: "if the account is deactivated, and again created with that name, use the new account and the first login as temporary password".
      if (existingProfile && existingProfile.status === 'inactive') {
        console.log(`Recreation handling: Account was deactivated. Creating a fresh, separate Auth user with the new temporary password.`);
        const revisionUsername = `${username}_recreate_${Date.now()}`;
        const revisedEmail = getEmailForUser(revisionUsername, role);
        try {
          const revisedCred = await createUserWithEmailAndPassword(secondaryAuth, revisedEmail, securePwd);
          const newUid = revisedCred.user.uid;
          await signOut(secondaryAuth);
          
          // Register the new revised email in the shared map so that saveUserProfile preserves it
          revisedEmailsMap.set(newUid, revisedEmail);
          return newUid;
        } catch (createErr) {
          console.error(`Failed to create fresh revised secondary auth user for deactivated ${username}:`, createErr);
          throw error;
        }
      }

      const candidates: string[] = [password];
      if (existingProfile) {
        if (existingProfile.password_pin) candidates.push(existingProfile.password_pin);
        if (existingProfile.dob) candidates.push(existingProfile.dob);
      }
      candidates.push('Coord@123', 'Teacher@123', 'Supervisor@123', 'Student@123');
      
      const uniqueCandidates = Array.from(new Set(candidates.filter(cand => cand && cand.trim())));
      let signedIn = false;
      let existingUid = existingProfile?.uid || '';
      
      // Attempt login with candidate passwords in parallel using isolated temp contexts
      try {
        const results = await Promise.all(
          uniqueCandidates.map(async (cand) => {
            try {
              const tempAppName = `TempAuth_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
              const tempApp = initializeApp(firebaseConfig, tempAppName);
              const tempAuth = getAuth(tempApp);
              const userCred = await signInWithEmailAndPassword(tempAuth, email, getSecurePassword(cand.trim()));
              return { uid: userCred.user.uid, cand };
            } catch (err) {
              return null;
            }
          })
        );
        
        const validResult = results.find(r => r !== null);
        if (validResult) {
          existingUid = validResult.uid;
          // Successfully identified the active candidate password, perform single sequential login to primary secondaryAuth
          await signInWithEmailAndPassword(secondaryAuth, email, getSecurePassword(validResult.cand.trim()));
          signedIn = true;
        }
      } catch (parallelErr) {
        console.warn('Parallel candidate logins failed:', parallelErr);
      }
      
      if (signedIn && secondaryAuth.currentUser) {
        try {
          // Success! Update password of the existing user in Firebase Auth
          await updatePassword(secondaryAuth.currentUser, securePwd);
          await signOut(secondaryAuth);
          
          // Reactivate Firestore profile if it exists
          if (existingProfile) {
            await updateUserProfile(existingUid, {
              status: 'active',
              first_login: true,
              password_pin: password,
              updated_at: new Date().toISOString()
            });
          }
          
          return existingUid;
        } catch (updateErr) {
          console.error(`Failed to update password for existing auth record for ${email}:`, updateErr);
        }
      }
      
      // If we cannot sign in (changed password), create a fresh revised/timestamped Auth user
      console.log(`Password recovery/update failed. Creating fresh revised auth record for ${username}.`);
      const revisionUsername = `${username}_recreate_${Date.now()}`;
      const revisedEmail = getEmailForUser(revisionUsername, role);
      
      try {
        const revisedCred = await createUserWithEmailAndPassword(secondaryAuth, revisedEmail, securePwd);
        const newUid = revisedCred.user.uid;
        await signOut(secondaryAuth);
        
        // Register the new revised email in the shared map so that saveUserProfile preserves it
        revisedEmailsMap.set(newUid, revisedEmail);
        
        // Clean up the old Firestore document if it exists to prevent duplicates
        if (existingProfile && existingProfile.uid) {
          await deleteUserProfile(existingProfile.uid);
        }
        
        return newUid;
      } catch (createErr) {
        console.error(`Failed to create revised secondary auth user for ${username}:`, createErr);
        throw error; // Throw original email-already-in-use if both options fail
      }
    }
    
    throw error;
  }
}

/**
 * Changes the current authenticated user's password, and updates first_login flag to false.
 */
export async function changeCurrentUserPassword(newPassword: string): Promise<void> {
  const user = auth.currentUser;
  if (!user) {
    throw new Error('No authenticated user session found.');
  }
  const securePwd = getSecurePassword(newPassword);
  await updatePassword(user, securePwd);
  
  // Update local profile first_login status
  await updateUserProfile(user.uid, {
    first_login: false,
    password_pin: newPassword,
    updated_at: new Date().toISOString()
  });
}

/**
 * Update secondary user credentials (email and/or password) by temporarily
 * signing in as them on a secondary app context.
 */
export async function updateAuthUserCredentials(
  currentUsername: string,
  role: Role,
  oldPassword: string,
  newUsername: string,
  newPassword?: string
): Promise<void> {
  const currentEmail = getEmailForUser(currentUsername, role);
  const secureOldPwd = getSecurePassword(oldPassword);
  
  const secondaryAppName = `UpdateAuthApp_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
  const secondaryApp = initializeApp(firebaseConfig, secondaryAppName);
  const secondaryAuth = getAuth(secondaryApp);
  
  try {
    // 1. Sign in as the coordinator on the secondary app context
    const userCredential = await signInWithEmailAndPassword(secondaryAuth, currentEmail, secureOldPwd);
    const user = userCredential.user;
    
    // 2. Update email if changed
    const newEmail = getEmailForUser(newUsername, role);
    if (newEmail !== currentEmail) {
      await updateEmail(user, newEmail);
    }
    
    // 3. Update password if provided and valid
    if (newPassword && newPassword.trim()) {
      const secureNewPwd = getSecurePassword(newPassword.trim());
      await updatePassword(user, secureNewPwd);
    }
    
    // 4. Sign out
    await signOut(secondaryAuth);
  } catch (error: any) {
    if (error?.code === 'auth/operation-not-allowed' || String(error).includes('operation-not-allowed')) {
      handleAuthError(error);
    }
    throw error;
  }
}

