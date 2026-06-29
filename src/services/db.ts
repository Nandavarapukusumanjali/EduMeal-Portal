import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  orderBy, 
  onSnapshot,
  writeBatch
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { Student, DailyWastageReport, StudentFeedback, AttendanceReport, WeeklyMenu, WEEKLY_MENU, UserProfile, ApprovalRequest, AuditLog, TimetableEntry, Role } from '../types';

// ============================================================================
// 1. Users & Roles Services
// ============================================================================

export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  const path = `users/${uid}`;
  try {
    const userDocRef = doc(db, 'users', uid);
    const snap = await getDoc(userDocRef);
    if (snap.exists()) {
      return snap.data() as UserProfile;
    }
    return null;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
    throw error;
  }
}

export async function getUserProfileByEmail(email: string): Promise<UserProfile | null> {
  const path = `users (query by email: ${email})`;
  try {
    const collRef = collection(db, 'users');
    const q = query(collRef, where('email', '==', email));
    const querySnapshot = await getDocs(q);
    if (!querySnapshot.empty) {
      const list = querySnapshot.docs.map(d => d.data() as UserProfile);
      // Prefer active profiles first to prevent getting deactivated/inactive accounts of the same email
      const activeMatch = list.find(u => u.status === 'active');
      if (activeMatch) return activeMatch;
      return list[0];
    }
    return null;
  } catch (error: any) {
    const errCode = error?.code;
    const errMessage = error instanceof Error ? error.message : String(error);
    if (errCode === 'permission-denied' || errMessage.includes('permission-denied') || errMessage.includes('permissions')) {
      return null;
    }
    handleFirestoreError(error, OperationType.GET, path);
    throw error;
  }
}

/**
 * Extract original username from email and role, handling potential recreated formats correctly.
 */
function getUsernameFromEmail(email: string, role: Role): string {
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

export async function getUserProfileByUsernameAndRole(username: string, role: Role): Promise<UserProfile | null> {
  const path = `users (query by username: ${username}, role: ${role})`;
  try {
    const collRef = collection(db, 'users');
    const q = query(collRef, where('role', '==', role));
    const querySnapshot = await getDocs(q);
    if (!querySnapshot.empty) {
      const list = querySnapshot.docs.map(d => d.data() as UserProfile);
      const matches = list.filter(u => {
        if (role === 'student') {
          return u.roll_number?.trim().toLowerCase() === username.trim().toLowerCase();
        }
        const emailUsername = getUsernameFromEmail(u.email, role);
        const cleanUsername = username.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
        return emailUsername === cleanUsername;
      });
      // Prefer active profiles first to prevent getting deactivated/inactive accounts of the same username
      const activeMatch = matches.find(u => u.status === 'active');
      if (activeMatch) return activeMatch;
      return matches[0] || null;
    }
    return null;
  } catch (error: any) {
    const errCode = error?.code;
    const errMessage = error instanceof Error ? error.message : String(error);
    if (errCode === 'permission-denied' || errMessage.includes('permission-denied') || errMessage.includes('permissions')) {
      return null;
    }
    handleFirestoreError(error, OperationType.GET, path);
    throw error;
  }
}

export const revisedEmailsMap = new Map<string, string>();

export async function saveUserProfile(profile: UserProfile): Promise<void> {
  const path = `users/${profile.uid}`;
  try {
    if (revisedEmailsMap.has(profile.uid)) {
      profile.email = revisedEmailsMap.get(profile.uid)!;
    }
    const userDocRef = doc(db, 'users', profile.uid);
    await setDoc(userDocRef, profile);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function getUsers(): Promise<UserProfile[]> {
  const path = 'users';
  try {
    const collRef = collection(db, 'users');
    const qSnapshot = await getDocs(collRef);
    const records: UserProfile[] = [];
    qSnapshot.forEach((docSnap) => {
      records.push(docSnap.data() as UserProfile);
    });
    return records;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
    return [];
  }
}

export const DEFAULT_TEACHER_SUBJECTS: Record<string, string> = {
  'kosana joshna': 'Mathematics',
  'avala thanuja': 'English',
  'lekkala yamini': 'Science',
  'saripalli madhuri': 'Social Studies',
  'nandavrapu harini': 'Telugu',
  'nandavarapuru harini': 'Telugu',
  'nandavarapu harini': 'Telugu',
  'dammu amar': 'Hindi',
  'cheluboyina bharathi': 'Computer Science',
  'srivalli': 'Physical Education (PET)',
  'nandavarapu murali': 'Mathematics',
  'gantla siva': 'English'
};

export function subscribeToUsers(callback: (users: UserProfile[]) => void) {
  const path = 'users';
  const collRef = collection(db, 'users');
  return onSnapshot(collRef, (snapshot) => {
    const records: UserProfile[] = [];
    snapshot.forEach((docSnap) => {
      records.push(docSnap.data() as UserProfile);
    });
    
    // Check if there are teachers that need subject assignment
    setTimeout(() => {
      records.forEach(async (u) => {
        if (u.role === 'teacher' && !u.subject) {
          const normName = u.name.trim().toLowerCase().replace(/\s+/g, ' ');
          let matchedSubject = DEFAULT_TEACHER_SUBJECTS[normName];
          if (!matchedSubject) {
            const key = Object.keys(DEFAULT_TEACHER_SUBJECTS).find(k => normName.includes(k) || k.includes(normName));
            if (key) {
              matchedSubject = DEFAULT_TEACHER_SUBJECTS[key];
            }
          }
          if (matchedSubject) {
            console.log(`Auto-migrating subject for teacher: ${u.name} -> ${matchedSubject}`);
            try {
              await updateUserProfile(u.uid, { subject: matchedSubject });
            } catch (e) {
              console.error(`Failed to auto-migrate subject for teacher ${u.name}:`, e);
            }
          }
        }
      });
    }, 1000);

    callback(records);
  }, (error) => {
    handleFirestoreError(error, OperationType.LIST, path);
  });
}

export async function updateUserProfile(uid: string, updates: Partial<UserProfile>): Promise<void> {
  const path = `users/${uid}`;
  try {
    const docRef = doc(db, 'users', uid);
    await updateDoc(docRef, updates);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteUserProfile(uid: string): Promise<void> {
  const path = `users/${uid}`;
  try {
    const docRef = doc(db, 'users', uid);
    await deleteDoc(docRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// ============================================================================
// 1b. Principal Approval Workflow Services
// ============================================================================

export async function addApprovalRequest(req: ApprovalRequest): Promise<void> {
  const path = `approvals/${req.request_id}`;
  try {
    const docRef = doc(db, 'approvals', req.request_id);
    await setDoc(docRef, req);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export function subscribeToApprovalRequests(callback: (requests: ApprovalRequest[]) => void) {
  const path = 'approvals';
  const collRef = collection(db, 'approvals');
  const q = query(collRef, orderBy('createdAt', 'desc'));
  return onSnapshot(q, (snapshot) => {
    const records: ApprovalRequest[] = [];
    snapshot.forEach((docSnap) => {
      records.push(docSnap.data() as ApprovalRequest);
    });
    callback(records);
  }, (error) => {
    handleFirestoreError(error, OperationType.LIST, path);
  });
}

export async function updateApprovalRequest(id: string, updates: Partial<ApprovalRequest>): Promise<void> {
  const path = `approvals/${id}`;
  try {
    const docRef = doc(db, 'approvals', id);
    await updateDoc(docRef, updates);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

// ============================================================================
// 1c. Audit Logs Services
// ============================================================================

export async function addAuditLog(log: AuditLog): Promise<void> {
  const path = `auditLogs/${log.log_id}`;
  try {
    const docRef = doc(db, 'auditLogs', log.log_id);
    await setDoc(docRef, log);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export function subscribeToAuditLogs(callback: (logs: AuditLog[]) => void) {
  const path = 'auditLogs';
  const collRef = collection(db, 'auditLogs');
  const q = query(collRef, orderBy('timestamp', 'desc'));
  return onSnapshot(q, (snapshot) => {
    const records: AuditLog[] = [];
    snapshot.forEach((docSnap) => {
      records.push(docSnap.data() as AuditLog);
    });
    callback(records);
  }, (error) => {
    handleFirestoreError(error, OperationType.LIST, path);
  });
}

// ============================================================================
// 2. Students Collection Services (CRUD)
// ============================================================================

export async function getStudents(): Promise<Student[]> {
  const path = 'students';
  try {
    const collRef = collection(db, 'students');
    const qSnapshot = await getDocs(collRef);
    const records: Student[] = [];
    qSnapshot.forEach((docSnap) => {
      records.push({ ...docSnap.data() as Student, id: docSnap.id });
    });
    return records;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
    return [];
  }
}

export function subscribeToStudents(callback: (students: Student[]) => void, onError?: (err: Error) => void) {
  const path = 'students';
  const collRef = collection(db, 'students');
  return onSnapshot(collRef, (snapshot) => {
    const records: Student[] = [];
    snapshot.forEach((docSnap) => {
      records.push({ ...docSnap.data() as Student, id: docSnap.id });
    });
    callback(records);
  }, (error) => {
    handleFirestoreError(error, OperationType.LIST, path);
    if (onError) onError(error);
  });
}

export async function addStudent(student: Omit<Student, 'id'>, id?: string): Promise<string> {
  const path = 'students';
  try {
    const collRef = collection(db, 'students');
    if (id) {
      const docRef = doc(db, 'students', id);
      await setDoc(docRef, { ...student, id });
      return id;
    } else {
      const docRef = await addDoc(collRef, student);
      await updateDoc(docRef, { id: docRef.id });
      return docRef.id;
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
    return '';
  }
}

export async function updateStudent(id: string, updates: Partial<Student>): Promise<void> {
  const path = `students/${id}`;
  try {
    const docRef = doc(db, 'students', id);
    await setDoc(docRef, updates, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteStudent(id: string): Promise<void> {
  const path = `students/${id}`;
  try {
    const docRef = doc(db, 'students', id);
    await deleteDoc(docRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// ============================================================================
// 3. Attendance Logs Services
// ============================================================================

export async function getAttendanceReports(): Promise<AttendanceReport[]> {
  const path = 'attendance';
  try {
    const collRef = collection(db, 'attendance');
    const qSnapshot = await getDocs(query(collRef, orderBy('date', 'desc')));
    const records: AttendanceReport[] = [];
    qSnapshot.forEach((docSnap) => {
      records.push(docSnap.data() as AttendanceReport);
    });
    return records;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
    return [];
  }
}

export function subscribeToAttendance(callback: (reports: AttendanceReport[]) => void) {
  const path = 'attendance';
  const collRef = collection(db, 'attendance');
  const q = query(collRef, orderBy('date', 'desc'));
  
  return onSnapshot(q, (snapshot) => {
    const records: AttendanceReport[] = [];
    snapshot.forEach((docSnap) => {
      records.push(docSnap.data() as AttendanceReport);
    });
    callback(records);
  }, (error) => {
    handleFirestoreError(error, OperationType.LIST, path);
  });
}

export async function saveAttendanceReport(report: AttendanceReport): Promise<void> {
  const path = `attendance/${report.id}`;
  try {
    const docRef = doc(db, 'attendance', report.id);
    await setDoc(docRef, report);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

// ============================================================================
// 4. Student Feedback Services
// ============================================================================

export async function getFeedbackReports(): Promise<StudentFeedback[]> {
  const path = 'feedback';
  try {
    const collRef = collection(db, 'feedback');
    const qSnapshot = await getDocs(query(collRef, orderBy('date', 'desc')));
    const records: StudentFeedback[] = [];
    qSnapshot.forEach((docSnap) => {
      records.push(docSnap.data() as StudentFeedback);
    });
    return records;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
    return [];
  }
}

export function subscribeToFeedback(callback: (feeds: StudentFeedback[]) => void) {
  const path = 'feedback';
  const collRef = collection(db, 'feedback');
  const q = query(collRef, orderBy('date', 'desc'));
  
  return onSnapshot(q, (snapshot) => {
    const records: StudentFeedback[] = [];
    snapshot.forEach((docSnap) => {
      records.push(docSnap.data() as StudentFeedback);
    });
    callback(records);
  }, (error) => {
    handleFirestoreError(error, OperationType.LIST, path);
  });
}

export async function addFeedback(report: StudentFeedback): Promise<void> {
  const path = `feedback/${report.id}`;
  try {
    const docRef = doc(db, 'feedback', report.id);
    await setDoc(docRef, report);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

// ============================================================================
// 5. Raw Leftovers & Wastage Services
// ============================================================================

export async function getWastageReports(): Promise<DailyWastageReport[]> {
  const path = 'wastage';
  try {
    const collRef = collection(db, 'wastage');
    const qSnapshot = await getDocs(query(collRef, orderBy('date', 'asc')));
    const records: DailyWastageReport[] = [];
    qSnapshot.forEach((docSnap) => {
      records.push(docSnap.data() as DailyWastageReport);
    });
    return records;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
    return [];
  }
}

export function subscribeToWastage(callback: (reports: DailyWastageReport[]) => void) {
  const path = 'wastage';
  const collRef = collection(db, 'wastage');
  const q = query(collRef, orderBy('date', 'asc'));
  
  return onSnapshot(q, (snapshot) => {
    const records: DailyWastageReport[] = [];
    snapshot.forEach((docSnap) => {
      records.push(docSnap.data() as DailyWastageReport);
    });
    callback(records);
  }, (error) => {
    handleFirestoreError(error, OperationType.LIST, path);
  });
}

export async function addWastageReport(report: DailyWastageReport): Promise<void> {
  const path = `wastage/${report.id}`;
  try {
    const docRef = doc(db, 'wastage', report.id);
    await setDoc(docRef, report);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

// ============================================================================
// 6. Master Menu Collection Services
// ============================================================================

export async function getWeeklyMenu(): Promise<WeeklyMenu[]> {
  const path = 'menu';
  try {
    const collRef = collection(db, 'menu');
    const qSnapshot = await getDocs(collRef);
    const records: WeeklyMenu[] = [];
    qSnapshot.forEach((docSnap) => {
      records.push(docSnap.data() as WeeklyMenu);
    });
    
    // Seed menu collection initially if empty
    if (records.length === 0) {
      for (const item of WEEKLY_MENU) {
        const docRef = doc(db, 'menu', item.day);
        await setDoc(docRef, item);
        records.push(item);
      }
    }
    return records;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
    return WEEKLY_MENU;
  }
}

export async function seedDatabaseIfEmpty() {
  // 1. Seed students
  try {
    const studentsColl = collection(db, 'students');
    const studentDocs = await getDocs(studentsColl);
    
    // Check if any old formats (with single initials or three-word names) or missing/unrandomized DOBs exist
    let hasOldFormats = false;
    let missingDob = false;
    const uniqueDobs = new Set<string>();
    if (!studentDocs.empty) {
      for (const d of studentDocs.docs) {
        const data = d.data() as Student;
        if (data.name.includes('.') || data.name.split(' ').length > 2) {
          hasOldFormats = true;
        }
        if (!data.dob || data.dob === '2012-01-01' || data.dob === '2012-05-15' || data.dob === '2012-11-03' || data.dob === '2012-08-22') {
          missingDob = true;
        } else {
          uniqueDobs.add(data.dob);
        }
      }
    }

    // If there is less than 15 unique DOBs among 50+ students, they aren't randomized properly!
    const isNotRandomized = !studentDocs.empty && uniqueDobs.size < 15;

    // Seed or overwrite if clean seeding is required or old format detected or missing/unrandomized dob
    if (studentDocs.empty || studentDocs.size < 50 || hasOldFormats || missingDob || isNotRandomized) {
      console.log('Seeding baseline student registries to Firestore with Telugu Surname, GivenName, and Randomized DOB...');
      
      const classes = [6, 7, 8, 9, 10];
      const sections = ['A', 'B'];
      const generatedStudents: Student[] = [];
      
      const boysFirst = [
        "Kalyan", "Pavan", "Rajesh", "Ravi", "Suresh", 
        "Srinivas", "Bhaskar", "Mahesh", "Ramana", "Prasad", 
        "Naidu", "Venkatesh", "Chaitanya", "Anil", "Vijay", 
        "Harish", "Surya", "Kiran", "Abhishek", "Rohan", 
        "Sanjay", "Sandeep", "Sai", "Vikram", "Ganesh", 
        "Kartik", "Tarun", "Nikhil", "Pranav"
      ];
      const girlsFirst = [
        "Kusumanjali", "Anusha", "Sireesha", "Anitha", "Lakshmi", 
        "Sridevi", "Meghana", "Tejaswi", "Sandhya", "Harini", 
        "Sravani", "Pallavi", "Sindhu", "Lavanya", "Kavya", 
        "Keerthi", "Radhika", "Pooja", "Jyothi"
      ];
      const surnames = [
        "Nandavarapu", "Yerra", "Malkapuram", "Koppula", "Challa", 
        "Pothula", "Galla", "Gudipati", "Dandu", "Konda", 
        "Vemula", "Bommireddy", "Sunkara", "Thota", "Yalamanchili", 
        "Kavati", "Gutta", "Boddu", "Gorantla", "Kanneganti", 
        "Nallamothu", "Paladugu", "Rayapati", "Alapati", "Medasani"
      ];
 
      for (const c of classes) {
        for (const sec of sections) {
          // 15 Boys
          for (let i = 1; i <= 15; i++) {
            const bName = boysFirst[(c * 7 + sec.charCodeAt(0) * 11 + i * 17) % boysFirst.length];
            const bSur = surnames[(c * 17 + sec.charCodeAt(0) + i * 19) % surnames.length];
            const nameText = `${bSur} ${bName}`;
            const rollStr = i.toString().padStart(2, '0');
            const rollNo = `${c}${sec}${rollStr}`;
            
            // Year based on class (Class 6: 2014-2015, Class 10: 2010-2011)
            let birthYear = 2014;
            if (c === 6) birthYear = 2014 + Math.floor(Math.random() * 2);
            else if (c === 7) birthYear = 2013 + Math.floor(Math.random() * 2);
            else if (c === 8) birthYear = 2012 + Math.floor(Math.random() * 2);
            else if (c === 9) birthYear = 2011 + Math.floor(Math.random() * 2);
            else if (c === 10) birthYear = 2010 + Math.floor(Math.random() * 2);

            const randomMonth = Math.floor(Math.random() * 12) + 1;
            const randomDay = Math.floor(Math.random() * 28) + 1;
            const dobStr = `${birthYear}-${String(randomMonth).padStart(2, '0')}-${String(randomDay).padStart(2, '0')}`;

            generatedStudents.push({
              id: `st_${rollNo}`,
              name: nameText,
              rollNo: rollNo,
              class: `Class ${c}`,
              section: `Section ${sec}`,
              gender: 'Male',
              present: true,
              dob: dobStr
            });
          }
          // 15 Girls
          for (let i = 16; i <= 30; i++) {
            const gName = girlsFirst[(c * 13 + sec.charCodeAt(0) * 17 + i * 23) % girlsFirst.length];
            const gSur = surnames[(c * 19 + sec.charCodeAt(0) * 2 + i * 29) % surnames.length];
            const nameText = `${gSur} ${gName}`;
            const rollStr = i.toString().padStart(2, '0');
            const rollNo = `${c}${sec}${rollStr}`;

            // Year based on class
            let birthYear = 2014;
            if (c === 6) birthYear = 2014 + Math.floor(Math.random() * 2);
            else if (c === 7) birthYear = 2013 + Math.floor(Math.random() * 2);
            else if (c === 8) birthYear = 2012 + Math.floor(Math.random() * 2);
            else if (c === 9) birthYear = 2011 + Math.floor(Math.random() * 2);
            else if (c === 10) birthYear = 2010 + Math.floor(Math.random() * 2);

            const randomMonth = Math.floor(Math.random() * 12) + 1;
            const randomDay = Math.floor(Math.random() * 28) + 1;
            const dobStr = `${birthYear}-${String(randomMonth).padStart(2, '0')}-${String(randomDay).padStart(2, '0')}`;

            generatedStudents.push({
              id: `st_${rollNo}`,
              name: nameText,
              rollNo: rollNo,
              class: `Class ${c}`,
              section: `Section ${sec}`,
              gender: 'Female',
              present: true,
              dob: dobStr
            });
          }
        }
      }

      // Write students to Firestore (use batch-style sets)
      for (const s of generatedStudents) {
        await setDoc(doc(db, 'students', s.id), s);
      }
      console.log(`Successfully seeded ${generatedStudents.length} Indian students with beautiful Surname + GivenName pairs.`);
    }
  } catch (error) {
    console.warn('Silent warning - skipped or missing permission to seed students:', error);
  }

  // 2. Seed wastage
  try {
    const wastageColl = collection(db, 'wastage');
    const wastageDocs = await getDocs(wastageColl);
    if (wastageDocs.empty) {
      console.log('Seeding historical wastage audits to Firestore...');
      const baselineWastage = [
        {
          id: 'waste_012',
          date: '2026-06-12',
          items: [
            { item: 'Rice', prepared: 50, consumed: 48, remaining: 2, wastePercentage: 4, unit: 'kg' },
            { item: 'Dal', prepared: 20, consumed: 19, remaining: 1, wastePercentage: 5, unit: 'kg' },
            { item: 'Egg Curry', prepared: 300, consumed: 294, remaining: 6, wastePercentage: 2, unit: 'units' },
            { item: 'Chikki', prepared: 300, consumed: 297, remaining: 3, wastePercentage: 1, unit: 'units' }
          ],
          avgWastePercentage: 3.0,
          mostWastedItem: 'Egg Curry',
          mostWastedQty: 6
        }
      ];
      for (const w of baselineWastage) {
        await setDoc(doc(db, 'wastage', w.id), w);
      }
    }
  } catch (error) {
    console.warn('Silent warning - skipped or missing permission to seed wastage:', error);
  }

  // 3. Seed feedback
  try {
    const feedbackColl = collection(db, 'feedback');
    const feedbackDocs = await getDocs(feedbackColl);
    if (feedbackDocs.empty) {
      console.log('Seeding compliance feedback models to Firestore...');
      const baselineFeedback = [
        {
          id: 'feed_012',
          date: '2026-06-12',
          studentName: 'Yarra Rajesh',
          itemRatings: { 'Rice': 4.5, 'Dal': 4.3, 'Egg Curry': 4.8, 'Chikki': 4.6 },
          serviceRatings: { taste: 5, quality: 4, temperature: 4, behaviour: 5, cleanliness: 5 },
          comments: 'The Egg Curry and Rice on reopening day was served hot and tasted amazing!'
        }
      ];
      for (const f of baselineFeedback) {
        await setDoc(doc(db, 'feedback', f.id), f);
      }
    }
  } catch (error) {
    console.warn('Silent warning - skipped or missing permission to seed feedback:', error);
  }

  // 4. Seed menu
  try {
    await getWeeklyMenu();
  } catch (error) {
    console.warn('Silent warning - skipped or missing permission to seed menu:', error);
  }


  // 5. Seed Attendance Reports for June 12 and June 13, 2026 (for school reopening days)
  // Seeding removed to encourage fresh submission of complete attendance data
}

// ============================================================================
// 7. Teacher Timetable Services
// ============================================================================

export async function getTimetableEntries(): Promise<TimetableEntry[]> {
  const path = 'timetables';
  try {
    const collRef = collection(db, 'timetables');
    const qSnapshot = await getDocs(collRef);
    const records: TimetableEntry[] = [];
    qSnapshot.forEach((docSnap) => {
      records.push(docSnap.data() as TimetableEntry);
    });
    return records;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
    return [];
  }
}

export function subscribeToTimetableEntries(callback: (entries: TimetableEntry[]) => void) {
  const path = 'timetables';
  const collRef = collection(db, 'timetables');
  return onSnapshot(collRef, (snapshot) => {
    const records: TimetableEntry[] = [];
    snapshot.forEach((docSnap) => {
      records.push(docSnap.data() as TimetableEntry);
    });
    callback(records);
  }, (error) => {
    handleFirestoreError(error, OperationType.LIST, path);
  });
}

export async function addTimetableEntry(entry: TimetableEntry): Promise<void> {
  const path = `timetables/${entry.timetable_id}`;
  try {
    const docRef = doc(db, 'timetables', entry.timetable_id);
    await setDoc(docRef, entry);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function updateTimetableEntry(id: string, updates: Partial<TimetableEntry>): Promise<void> {
  const path = `timetables/${id}`;
  try {
    const docRef = doc(db, 'timetables', id);
    await updateDoc(docRef, updates);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteTimetableEntry(id: string): Promise<void> {
  const path = `timetables/${id}`;
  try {
    const docRef = doc(db, 'timetables', id);
    await deleteDoc(docRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function saveTimetableEntriesBatch(entries: TimetableEntry[]): Promise<void> {
  const path = 'timetables/batch';
  try {
    const batch = writeBatch(db);
    entries.forEach((entry) => {
      const docRef = doc(db, 'timetables', entry.timetable_id);
      batch.set(docRef, entry);
    });
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
    throw error;
  }
}

