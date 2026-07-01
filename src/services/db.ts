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
import { 
  Student, 
  DailyWastageReport, 
  StudentFeedback, 
  AttendanceReport, 
  WeeklyMenu, 
  WEEKLY_MENU, 
  UserProfile, 
  ApprovalRequest, 
  AuditLog, 
  TimetableEntry, 
  Role, 
  SubstituteAssignment, 
  Attendance,
  TeacherLeave
} from '../types';

// ============================================================================
// Local In-Memory Cache & Pub-Sub State
// ============================================================================

let usersCache: UserProfile[] | null = null;
const usersSubscribers = new Set<(users: UserProfile[]) => void>();
let isFetchingUsers = false;

let approvalsCache: ApprovalRequest[] | null = null;
const approvalsSubscribers = new Set<(requests: ApprovalRequest[]) => void>();
let isFetchingApprovals = false;

let auditLogsCache: AuditLog[] | null = null;
const auditLogsSubscribers = new Set<(logs: AuditLog[]) => void>();
let isFetchingAuditLogs = false;

let studentsCache: Student[] | null = null;
const studentsSubscribers = new Set<(students: Student[]) => void>();
let isFetchingStudents = false;

let feedbackCache: StudentFeedback[] | null = null;
const feedbackSubscribers = new Set<(feeds: StudentFeedback[]) => void>();
let isFetchingFeedback = false;

let wastageCache: DailyWastageReport[] | null = null;
const wastageSubscribers = new Set<(reports: DailyWastageReport[]) => void>();
let isFetchingWastage = false;

let weeklyMenuCache: WeeklyMenu[] | null = null;

let timetableCache: TimetableEntry[] | null = null;
const timetableSubscribers = new Set<(entries: TimetableEntry[]) => void>();
let isFetchingTimetable = false;

let substituteAssignmentsCache: SubstituteAssignment[] | null = null;
const substituteAssignmentsSubscribers = new Set<(assignments: SubstituteAssignment[]) => void>();
let isFetchingSubstituteAssignments = false;

// Real-Time Shared Listener Multiplexers (for modules that genuinely need live updates)
let attendanceCache: AttendanceReport[] | null = null;
const attendanceSubscribers = new Set<(reports: AttendanceReport[]) => void>();
let activeAttendanceUnsub: (() => void) | null = null;

let attendanceRecordsCache: Attendance[] | null = null;
const attendanceRecordsSubscribers = new Set<(records: Attendance[]) => void>();
let activeAttendanceRecordsUnsub: (() => void) | null = null;

export const revisedEmailsMap = new Map<string, string>();

// ============================================================================
// 1. Users & Roles Services
// ============================================================================

export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  if (usersCache) {
    const cached = usersCache.find(u => u.uid === uid);
    if (cached) return cached;
  }
  const path = `users/${uid}`;
  try {
    const userDocRef = doc(db, 'users', uid);
    const snap = await getDoc(userDocRef);
    if (snap.exists()) {
      const profile = snap.data() as UserProfile;
      if (usersCache) {
        const idx = usersCache.findIndex(u => u.uid === uid);
        if (idx > -1) usersCache[idx] = profile;
        else usersCache.push(profile);
      }
      return profile;
    }
    return null;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
    throw error;
  }
}

export async function getUserProfileByEmail(email: string): Promise<UserProfile | null> {
  if (usersCache) {
    const cachedList = usersCache.filter(u => u.email === email);
    if (cachedList.length > 0) {
      const activeMatch = cachedList.find(u => u.status === 'active');
      if (activeMatch) return activeMatch;
      return cachedList[0];
    }
  }
  const path = `users (query by email: ${email})`;
  try {
    const collRef = collection(db, 'users');
    const q = query(collRef, where('email', '==', email));
    const querySnapshot = await getDocs(q);
    if (!querySnapshot.empty) {
      const list = querySnapshot.docs.map(d => d.data() as UserProfile);
      const activeMatch = list.find(u => u.status === 'active');
      const resolved = activeMatch || list[0];
      // Prime cache
      if (usersCache) {
        list.forEach(item => {
          const idx = usersCache!.findIndex(u => u.uid === item.uid);
          if (idx > -1) usersCache![idx] = item;
          else usersCache!.push(item);
        });
      }
      return resolved;
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
  if (usersCache) {
    const matches = usersCache.filter(u => {
      if (u.role !== role) return false;
      if (role === 'student') {
        return u.roll_number?.trim().toLowerCase() === username.trim().toLowerCase();
      }
      const emailUsername = getUsernameFromEmail(u.email, role);
      const cleanUsername = username.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
      return emailUsername === cleanUsername;
    });
    if (matches.length > 0) {
      const activeMatch = matches.find(u => u.status === 'active');
      if (activeMatch) return activeMatch;
      return matches[0];
    }
  }
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
      const activeMatch = matches.find(u => u.status === 'active');
      const resolved = activeMatch || matches[0] || null;
      if (resolved && usersCache) {
        const idx = usersCache.findIndex(u => u.uid === resolved.uid);
        if (idx > -1) usersCache[idx] = resolved;
        else usersCache.push(resolved);
      }
      return resolved;
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

export async function saveUserProfile(profile: UserProfile): Promise<void> {
  const path = `users/${profile.uid}`;
  try {
    if (revisedEmailsMap.has(profile.uid)) {
      profile.email = revisedEmailsMap.get(profile.uid)!;
    }
    const userDocRef = doc(db, 'users', profile.uid);
    await setDoc(userDocRef, profile);
    if (usersCache) {
      const idx = usersCache.findIndex(u => u.uid === profile.uid);
      if (idx > -1) usersCache[idx] = profile;
      else usersCache.push(profile);
      usersSubscribers.forEach(sub => sub([...usersCache!]));
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function getUsers(): Promise<UserProfile[]> {
  if (usersCache) return usersCache;
  const path = 'users';
  try {
    const collRef = collection(db, 'users');
    const qSnapshot = await getDocs(collRef);
    const records: UserProfile[] = [];
    qSnapshot.forEach((docSnap) => {
      records.push(docSnap.data() as UserProfile);
    });
    usersCache = records;
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
  'nandvrapu harini': 'Telugu',
  'nandavarapuru harini': 'Telugu',
  'nandavarapu harini': 'Telugu',
  'dammu amar': 'Hindi',
  'cheluboyina bharathi': 'Computer Science',
  'srivalli': 'Physical Education (PET)',
  'nandavarapu murali': 'Mathematics',
  'gantla siva': 'English'
};

export function subscribeToUsers(callback: (users: UserProfile[]) => void) {
  usersSubscribers.add(callback);

  const triggerTimeoutCheck = (records: UserProfile[]) => {
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
  };

  if (usersCache) {
    callback(usersCache);
    triggerTimeoutCheck(usersCache);
  } else if (!isFetchingUsers) {
    isFetchingUsers = true;
    getUsers().then(data => {
      usersCache = data;
      isFetchingUsers = false;
      usersSubscribers.forEach(sub => {
        sub(usersCache!);
        triggerTimeoutCheck(usersCache!);
      });
    }).catch(() => {
      isFetchingUsers = false;
    });
  }

  return () => {
    usersSubscribers.delete(callback);
  };
}

export async function updateUserProfile(uid: string, updates: Partial<UserProfile>): Promise<void> {
  const path = `users/${uid}`;
  try {
    const docRef = doc(db, 'users', uid);
    await updateDoc(docRef, updates);
    if (usersCache) {
      const idx = usersCache.findIndex(u => u.uid === uid);
      if (idx > -1) {
        usersCache[idx] = { ...usersCache[idx], ...updates };
        usersSubscribers.forEach(sub => sub([...usersCache!]));
      }
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteUserProfile(uid: string): Promise<void> {
  const path = `users/${uid}`;
  try {
    const docRef = doc(db, 'users', uid);
    await deleteDoc(docRef);
    if (usersCache) {
      usersCache = usersCache.filter(u => u.uid !== uid);
      usersSubscribers.forEach(sub => sub([...usersCache!]));
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// ============================================================================
// 1b. Principal Approval Workflow Services
// ============================================================================

export async function getApprovalRequests(): Promise<ApprovalRequest[]> {
  if (approvalsCache) return approvalsCache;
  const path = 'approvals';
  try {
    const collRef = collection(db, 'approvals');
    const qSnapshot = await getDocs(query(collRef, orderBy('createdAt', 'desc')));
    const records: ApprovalRequest[] = [];
    qSnapshot.forEach((docSnap) => {
      records.push(docSnap.data() as ApprovalRequest);
    });
    approvalsCache = records;
    return records;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
    return [];
  }
}

export async function addApprovalRequest(req: ApprovalRequest): Promise<void> {
  const path = `approvals/${req.request_id}`;
  try {
    const docRef = doc(db, 'approvals', req.request_id);
    await setDoc(docRef, req);
    if (approvalsCache) {
      const idx = approvalsCache.findIndex(r => r.request_id === req.request_id);
      if (idx > -1) approvalsCache[idx] = req;
      else approvalsCache.unshift(req);
      approvalsSubscribers.forEach(sub => sub([...approvalsCache!]));
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export function subscribeToApprovalRequests(callback: (requests: ApprovalRequest[]) => void) {
  approvalsSubscribers.add(callback);
  if (approvalsCache) {
    callback(approvalsCache);
  } else if (!isFetchingApprovals) {
    isFetchingApprovals = true;
    getApprovalRequests().then(data => {
      approvalsCache = data;
      isFetchingApprovals = false;
      approvalsSubscribers.forEach(sub => sub(approvalsCache!));
    }).catch(() => {
      isFetchingApprovals = false;
    });
  }
  return () => {
    approvalsSubscribers.delete(callback);
  };
}

export async function updateApprovalRequest(id: string, updates: Partial<ApprovalRequest>): Promise<void> {
  const path = `approvals/${id}`;
  try {
    const docRef = doc(db, 'approvals', id);
    await updateDoc(docRef, updates);
    if (approvalsCache) {
      const idx = approvalsCache.findIndex(r => r.request_id === id);
      if (idx > -1) {
        approvalsCache[idx] = { ...approvalsCache[idx], ...updates };
        approvalsSubscribers.forEach(sub => sub([...approvalsCache!]));
      }
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

// ============================================================================
// 1c. Audit Logs Services
// ============================================================================

export async function getAuditLogs(): Promise<AuditLog[]> {
  if (auditLogsCache) return auditLogsCache;
  const path = 'auditLogs';
  try {
    const collRef = collection(db, 'auditLogs');
    const qSnapshot = await getDocs(query(collRef, orderBy('timestamp', 'desc')));
    const records: AuditLog[] = [];
    qSnapshot.forEach((docSnap) => {
      records.push(docSnap.data() as AuditLog);
    });
    auditLogsCache = records;
    return records;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
    return [];
  }
}

export async function addAuditLog(log: AuditLog): Promise<void> {
  const path = `auditLogs/${log.log_id}`;
  try {
    const docRef = doc(db, 'auditLogs', log.log_id);
    await setDoc(docRef, log);
    if (auditLogsCache) {
      const idx = auditLogsCache.findIndex(l => l.log_id === log.log_id);
      if (idx > -1) auditLogsCache[idx] = log;
      else auditLogsCache.unshift(log);
      auditLogsSubscribers.forEach(sub => sub([...auditLogsCache!]));
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export function subscribeToAuditLogs(callback: (logs: AuditLog[]) => void) {
  auditLogsSubscribers.add(callback);
  if (auditLogsCache) {
    callback(auditLogsCache);
  } else if (!isFetchingAuditLogs) {
    isFetchingAuditLogs = true;
    getAuditLogs().then(data => {
      auditLogsCache = data;
      isFetchingAuditLogs = false;
      auditLogsSubscribers.forEach(sub => sub(auditLogsCache!));
    }).catch(() => {
      isFetchingAuditLogs = false;
    });
  }
  return () => {
    auditLogsSubscribers.delete(callback);
  };
}

// ============================================================================
// 2. Students Collection Services (CRUD)
// ============================================================================

export async function getStudents(): Promise<Student[]> {
  if (studentsCache) return studentsCache;
  const path = 'students';
  try {
    const collRef = collection(db, 'students');
    const qSnapshot = await getDocs(collRef);
    const records: Student[] = [];
    qSnapshot.forEach((docSnap) => {
      records.push({ ...docSnap.data() as Student, id: docSnap.id });
    });
    studentsCache = records;
    return records;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
    return [];
  }
}

export function subscribeToStudents(callback: (students: Student[]) => void, onError?: (err: Error) => void) {
  studentsSubscribers.add(callback);
  if (studentsCache) {
    callback(studentsCache);
  } else if (!isFetchingStudents) {
    isFetchingStudents = true;
    getStudents().then(data => {
      studentsCache = data;
      isFetchingStudents = false;
      studentsSubscribers.forEach(sub => sub(studentsCache!));
    }).catch(err => {
      isFetchingStudents = false;
      if (onError) onError(err);
    });
  }
  return () => {
    studentsSubscribers.delete(callback);
  };
}

export async function addStudent(student: Omit<Student, 'id'>, id?: string): Promise<string> {
  const path = 'students';
  try {
    const collRef = collection(db, 'students');
    let finalId = id;
    if (finalId) {
      const docRef = doc(db, 'students', finalId);
      await setDoc(docRef, { ...student, id: finalId });
    } else {
      const docRef = await addDoc(collRef, student);
      await updateDoc(docRef, { id: docRef.id });
      finalId = docRef.id;
    }
    if (studentsCache) {
      const newStudent = { ...student, id: finalId } as Student;
      const idx = studentsCache.findIndex(s => s.id === finalId);
      if (idx > -1) studentsCache[idx] = newStudent;
      else studentsCache.push(newStudent);
      studentsSubscribers.forEach(sub => sub([...studentsCache!]));
    }
    return finalId || '';
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
    if (studentsCache) {
      const idx = studentsCache.findIndex(s => s.id === id);
      if (idx > -1) {
        studentsCache[idx] = { ...studentsCache[idx], ...updates };
        studentsSubscribers.forEach(sub => sub([...studentsCache!]));
      }
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteStudent(id: string): Promise<void> {
  const path = `students/${id}`;
  try {
    const docRef = doc(db, 'students', id);
    await deleteDoc(docRef);
    if (studentsCache) {
      studentsCache = studentsCache.filter(s => s.id !== id);
      studentsSubscribers.forEach(sub => sub([...studentsCache!]));
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// ============================================================================
// 3. Attendance Logs Services (Multiplexed Live Subscriptions)
// ============================================================================

export async function getAttendanceReports(): Promise<AttendanceReport[]> {
  if (attendanceCache) return attendanceCache;
  const path = 'attendance';
  try {
    const collRef = collection(db, 'attendance');
    const qSnapshot = await getDocs(query(collRef, orderBy('date', 'desc')));
    const records: AttendanceReport[] = [];
    qSnapshot.forEach((docSnap) => {
      records.push(docSnap.data() as AttendanceReport);
    });
    attendanceCache = records;
    return records;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
    return [];
  }
}

export function subscribeToAttendance(callback: (reports: AttendanceReport[]) => void) {
  attendanceSubscribers.add(callback);
  if (attendanceCache) {
    callback(attendanceCache);
  }
  if (!activeAttendanceUnsub) {
    const path = 'attendance';
    const collRef = collection(db, 'attendance');
    const q = query(collRef, orderBy('date', 'desc'));
    
    activeAttendanceUnsub = onSnapshot(q, (snapshot) => {
      const records: AttendanceReport[] = [];
      snapshot.forEach((docSnap) => {
        records.push(docSnap.data() as AttendanceReport);
      });
      attendanceCache = records;
      attendanceSubscribers.forEach(sub => sub(records));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    });
  }
  return () => {
    attendanceSubscribers.delete(callback);
    if (attendanceSubscribers.size === 0 && activeAttendanceUnsub) {
      activeAttendanceUnsub();
      activeAttendanceUnsub = null;
    }
  };
}

export async function saveAttendanceReport(report: AttendanceReport): Promise<void> {
  const path = `attendance/${report.id}`;
  try {
    const docRef = doc(db, 'attendance', report.id);
    await setDoc(docRef, report);
    if (attendanceCache) {
      const idx = attendanceCache.findIndex(r => r.id === report.id);
      if (idx > -1) attendanceCache[idx] = report;
      else attendanceCache.unshift(report);
      attendanceSubscribers.forEach(sub => sub([...attendanceCache!]));
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deleteAttendanceReport(id: string): Promise<void> {
  const path = `attendance/${id}`;
  try {
    const docRef = doc(db, 'attendance', id);
    await deleteDoc(docRef);
    if (attendanceCache) {
      attendanceCache = attendanceCache.filter(r => r.id !== id);
      attendanceSubscribers.forEach(sub => sub([...attendanceCache!]));
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
    throw error;
  }
}

// ============================================================================
// 4. Student Feedback Services
// ============================================================================

export async function getFeedbackReports(): Promise<StudentFeedback[]> {
  if (feedbackCache) return feedbackCache;
  const path = 'feedback';
  try {
    const collRef = collection(db, 'feedback');
    const qSnapshot = await getDocs(query(collRef, orderBy('date', 'desc')));
    const records: StudentFeedback[] = [];
    qSnapshot.forEach((docSnap) => {
      records.push(docSnap.data() as StudentFeedback);
    });
    feedbackCache = records;
    return records;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
    return [];
  }
}

export function subscribeToFeedback(callback: (feeds: StudentFeedback[]) => void) {
  feedbackSubscribers.add(callback);
  if (feedbackCache) {
    callback(feedbackCache);
  } else if (!isFetchingFeedback) {
    isFetchingFeedback = true;
    getFeedbackReports().then(data => {
      feedbackCache = data;
      isFetchingFeedback = false;
      feedbackSubscribers.forEach(sub => sub(feedbackCache!));
    }).catch(() => {
      isFetchingFeedback = false;
    });
  }
  return () => {
    feedbackSubscribers.delete(callback);
  };
}

export async function addFeedback(report: StudentFeedback): Promise<void> {
  const path = `feedback/${report.id}`;
  try {
    const docRef = doc(db, 'feedback', report.id);
    await setDoc(docRef, report);
    if (feedbackCache) {
      const idx = feedbackCache.findIndex(f => f.id === report.id);
      if (idx > -1) feedbackCache[idx] = report;
      else feedbackCache.unshift(report);
      feedbackSubscribers.forEach(sub => sub([...feedbackCache!]));
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

// ============================================================================
// 5. Raw Leftovers & Wastage Services
// ============================================================================

export async function getWastageReports(): Promise<DailyWastageReport[]> {
  if (wastageCache) return wastageCache;
  const path = 'wastage';
  try {
    const collRef = collection(db, 'wastage');
    const qSnapshot = await getDocs(query(collRef, orderBy('date', 'asc')));
    const records: DailyWastageReport[] = [];
    qSnapshot.forEach((docSnap) => {
      records.push(docSnap.data() as DailyWastageReport);
    });
    wastageCache = records;
    return records;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
    return [];
  }
}

export function subscribeToWastage(callback: (reports: DailyWastageReport[]) => void) {
  wastageSubscribers.add(callback);
  if (wastageCache) {
    callback(wastageCache);
  } else if (!isFetchingWastage) {
    isFetchingWastage = true;
    getWastageReports().then(data => {
      wastageCache = data;
      isFetchingWastage = false;
      wastageSubscribers.forEach(sub => sub(wastageCache!));
    }).catch(() => {
      isFetchingWastage = false;
    });
  }
  return () => {
    wastageSubscribers.delete(callback);
  };
}

export async function addWastageReport(report: DailyWastageReport): Promise<void> {
  const path = `wastage/${report.id}`;
  try {
    const docRef = doc(db, 'wastage', report.id);
    await setDoc(docRef, report);
    if (wastageCache) {
      const idx = wastageCache.findIndex(w => w.id === report.id);
      if (idx > -1) wastageCache[idx] = report;
      else wastageCache.push(report);
      wastageSubscribers.forEach(sub => sub([...wastageCache!]));
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

// ============================================================================
// 6. Master Menu Collection Services
// ============================================================================

export async function getWeeklyMenu(): Promise<WeeklyMenu[]> {
  if (weeklyMenuCache) return weeklyMenuCache;
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
    weeklyMenuCache = records;
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

    const isNotRandomized = !studentDocs.empty && uniqueDobs.size < 15;

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
          for (let i = 1; i <= 15; i++) {
            const bName = boysFirst[(c * 7 + sec.charCodeAt(0) * 11 + i * 17) % boysFirst.length];
            const bSur = surnames[(c * 17 + sec.charCodeAt(0) + i * 19) % surnames.length];
            const nameText = `${bSur} ${bName}`;
            const rollStr = i.toString().padStart(2, '0');
            const rollNo = `${c}${sec}${rollStr}`;
            
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
          for (let i = 16; i <= 30; i++) {
            const gName = girlsFirst[(c * 13 + sec.charCodeAt(0) * 17 + i * 23) % girlsFirst.length];
            const gSur = surnames[(c * 19 + sec.charCodeAt(0) * 2 + i * 29) % surnames.length];
            const nameText = `${gSur} ${gName}`;
            const rollStr = i.toString().padStart(2, '0');
            const rollNo = `${c}${sec}${rollStr}`;

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

      for (const s of generatedStudents) {
        await setDoc(doc(db, 'students', s.id), s);
      }
      studentsCache = generatedStudents;
      studentsSubscribers.forEach(sub => sub([...studentsCache!]));
      console.log(`Successfully seeded ${generatedStudents.length} Indian students.`);
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
      wastageCache = baselineWastage;
      wastageSubscribers.forEach(sub => sub([...wastageCache!]));
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
      feedbackCache = baselineFeedback;
      feedbackSubscribers.forEach(sub => sub([...feedbackCache!]));
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
}

// ============================================================================
// 7. Teacher Timetable Services
// ============================================================================

export async function getTimetableEntries(): Promise<TimetableEntry[]> {
  if (timetableCache) return timetableCache;
  const path = 'timetables';
  try {
    const collRef = collection(db, 'timetables');
    const qSnapshot = await getDocs(collRef);
    const records: TimetableEntry[] = [];
    qSnapshot.forEach((docSnap) => {
      records.push(docSnap.data() as TimetableEntry);
    });
    timetableCache = records;
    return records;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
    return [];
  }
}

export function subscribeToTimetableEntries(callback: (entries: TimetableEntry[]) => void) {
  timetableSubscribers.add(callback);
  if (timetableCache) {
    callback(timetableCache);
  } else if (!isFetchingTimetable) {
    isFetchingTimetable = true;
    getTimetableEntries().then(data => {
      timetableCache = data;
      isFetchingTimetable = false;
      timetableSubscribers.forEach(sub => sub(timetableCache!));
    }).catch(() => {
      isFetchingTimetable = false;
    });
  }
  return () => {
    timetableSubscribers.delete(callback);
  };
}

export async function addTimetableEntry(entry: TimetableEntry): Promise<void> {
  const path = `timetables/${entry.timetable_id}`;
  try {
    const docRef = doc(db, 'timetables', entry.timetable_id);
    await setDoc(docRef, entry);
    if (timetableCache) {
      const idx = timetableCache.findIndex(e => e.timetable_id === entry.timetable_id);
      if (idx > -1) timetableCache[idx] = entry;
      else timetableCache.push(entry);
      timetableSubscribers.forEach(sub => sub([...timetableCache!]));
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function updateTimetableEntry(id: string, updates: Partial<TimetableEntry>): Promise<void> {
  const path = `timetables/${id}`;
  try {
    const docRef = doc(db, 'timetables', id);
    await updateDoc(docRef, updates);
    if (timetableCache) {
      const idx = timetableCache.findIndex(e => e.timetable_id === id);
      if (idx > -1) {
        timetableCache[idx] = { ...timetableCache[idx], ...updates };
        timetableSubscribers.forEach(sub => sub([...timetableCache!]));
      }
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteTimetableEntry(id: string): Promise<void> {
  const path = `timetables/${id}`;
  try {
    const docRef = doc(db, 'timetables', id);
    await deleteDoc(docRef);
    if (timetableCache) {
      timetableCache = timetableCache.filter(e => e.timetable_id !== id);
      timetableSubscribers.forEach(sub => sub([...timetableCache!]));
    }
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
    if (timetableCache) {
      entries.forEach(entry => {
        const idx = timetableCache!.findIndex(e => e.timetable_id === entry.timetable_id);
        if (idx > -1) timetableCache![idx] = entry;
        else timetableCache!.push(entry);
      });
      timetableSubscribers.forEach(sub => sub([...timetableCache!]));
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
    throw error;
  }
}

// ============================================================================
// 8. Substitute & Attendance Services
// ============================================================================

export async function getSubstituteAssignments(): Promise<SubstituteAssignment[]> {
  if (substituteAssignmentsCache) return substituteAssignmentsCache;
  const path = 'substitute_assignments';
  try {
    const collRef = collection(db, 'substitute_assignments');
    const qSnapshot = await getDocs(collRef);
    const records: SubstituteAssignment[] = [];
    qSnapshot.forEach((docSnap) => {
      records.push(docSnap.data() as SubstituteAssignment);
    });
    substituteAssignmentsCache = records;
    return records;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
    return [];
  }
}

export async function addSubstituteAssignment(assignment: SubstituteAssignment): Promise<void> {
  const path = `substitute_assignments/${assignment.assignment_id}`;
  try {
    const docRef = doc(db, 'substitute_assignments', assignment.assignment_id);
    await setDoc(docRef, assignment);
    if (substituteAssignmentsCache) {
      const idx = substituteAssignmentsCache.findIndex(sub => sub.assignment_id === assignment.assignment_id);
      if (idx > -1) substituteAssignmentsCache[idx] = assignment;
      else substituteAssignmentsCache.push(assignment);
      substituteAssignmentsSubscribers.forEach(sub => sub([...substituteAssignmentsCache!]));
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export function subscribeToSubstituteAssignments(callback: (assignments: SubstituteAssignment[]) => void) {
  substituteAssignmentsSubscribers.add(callback);
  if (substituteAssignmentsCache) {
    callback(substituteAssignmentsCache);
  } else if (!isFetchingSubstituteAssignments) {
    isFetchingSubstituteAssignments = true;
    getSubstituteAssignments().then(data => {
      substituteAssignmentsCache = data;
      isFetchingSubstituteAssignments = false;
      substituteAssignmentsSubscribers.forEach(sub => sub(substituteAssignmentsCache!));
    }).catch(() => {
      isFetchingSubstituteAssignments = false;
    });
  }
  return () => {
    substituteAssignmentsSubscribers.delete(callback);
  };
}

export async function getAttendanceRecords(): Promise<Attendance[]> {
  if (attendanceRecordsCache) return attendanceRecordsCache;
  const path = 'attendance_records';
  try {
    const collRef = collection(db, 'attendance_records');
    const qSnapshot = await getDocs(collRef);
    const records: Attendance[] = [];
    qSnapshot.forEach((docSnap) => {
      records.push(docSnap.data() as Attendance);
    });
    attendanceRecordsCache = records;
    return records;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
    return [];
  }
}

export async function addAttendance(attendance: Attendance): Promise<void> {
  const path = `attendance_records/${attendance.attendance_id}`;
  try {
    const docRef = doc(db, 'attendance_records', attendance.attendance_id);
    await setDoc(docRef, attendance);
    if (attendanceRecordsCache) {
      const idx = attendanceRecordsCache.findIndex(r => r.attendance_id === attendance.attendance_id);
      if (idx > -1) attendanceRecordsCache[idx] = attendance;
      else attendanceRecordsCache.push(attendance);
      attendanceRecordsSubscribers.forEach(sub => sub([...attendanceRecordsCache!]));
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export function subscribeToAttendanceRecords(callback: (records: Attendance[]) => void) {
  attendanceRecordsSubscribers.add(callback);
  if (attendanceRecordsCache) {
    callback(attendanceRecordsCache);
  }
  if (!activeAttendanceRecordsUnsub) {
    const path = 'attendance_records';
    const collRef = collection(db, 'attendance_records');
    activeAttendanceRecordsUnsub = onSnapshot(collRef, (snapshot) => {
      const records: Attendance[] = [];
      snapshot.forEach((docSnap) => {
        records.push(docSnap.data() as Attendance);
      });
      attendanceRecordsCache = records;
      attendanceRecordsSubscribers.forEach(sub => sub(records));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    });
  }
  return () => {
    attendanceRecordsSubscribers.delete(callback);
    if (attendanceRecordsSubscribers.size === 0 && activeAttendanceRecordsUnsub) {
      activeAttendanceRecordsUnsub();
      activeAttendanceRecordsUnsub = null;
    }
  };
}

export async function getTeacherLeaves(): Promise<TeacherLeave[]> {
  const path = 'teacher_leaves';
  try {
    const collRef = collection(db, path);
    const qSnapshot = await getDocs(collRef);
    return qSnapshot.docs.map(doc => doc.data() as TeacherLeave);
  } catch (err) {
    console.error("Error fetching teacher leaves:", err);
    return [];
  }
}
