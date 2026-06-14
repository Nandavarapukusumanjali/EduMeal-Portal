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
  onSnapshot 
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { Student, DailyWastageReport, StudentFeedback, AttendanceReport, WeeklyMenu, WEEKLY_MENU } from '../types';

// ============================================================================
// 1. Users & Roles Services
// ============================================================================

export interface UserProfile {
  uid: string;
  email: string;
  name: string;
  role: 'student' | 'teacher' | 'supervisor' | 'admin';
  createdAt: string;
}

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
    return null;
  }
}

export async function saveUserProfile(profile: UserProfile): Promise<void> {
  const path = `users/${profile.uid}`;
  try {
    const userDocRef = doc(db, 'users', profile.uid);
    await setDoc(userDocRef, profile);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
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
    await updateDoc(docRef, updates);
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
    
    // Check if any old formats (with single initials or three-word names) exist
    let hasOldFormats = false;
    if (!studentDocs.empty) {
      for (const d of studentDocs.docs) {
        const data = d.data() as Student;
        if (data.name.includes('.') || data.name.split(' ').length > 2) {
          hasOldFormats = true;
          break;
        }
      }
    }

    // Seed or overwrite if clean seeding is required (fewer than 50 records) or old format detected
    if (studentDocs.empty || studentDocs.size < 50 || hasOldFormats) {
      console.log('Seeding baseline student registries to Firestore with Telugu Surname and GivenName style...');
      
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
            generatedStudents.push({
              id: `st_${rollNo}`,
              name: nameText,
              rollNo: rollNo,
              class: `Class ${c}`,
              section: `Section ${sec}`,
              gender: 'Male',
              present: true
            });
          }
          // 15 Girls
          for (let i = 16; i <= 30; i++) {
            const gName = girlsFirst[(c * 13 + sec.charCodeAt(0) * 17 + i * 23) % girlsFirst.length];
            const gSur = surnames[(c * 19 + sec.charCodeAt(0) * 2 + i * 29) % surnames.length];
            const nameText = `${gSur} ${gName}`;
            const rollStr = i.toString().padStart(2, '0');
            const rollNo = `${c}${sec}${rollStr}`;
            generatedStudents.push({
              id: `st_${rollNo}`,
              name: nameText,
              rollNo: rollNo,
              class: `Class ${c}`,
              section: `Section ${sec}`,
              gender: 'Female',
              present: true
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
          id: 'waste_001',
          date: new Date(Date.now() - 24*60*60*1000).toISOString().split('T')[0],
          items: [
            { item: 'Rice', prepared: 50, consumed: 46.5, remaining: 3.5, wastePercentage: 7, unit: 'kg' },
            { item: 'Dal', prepared: 20, consumed: 18.8, remaining: 1.2, wastePercentage: 6, unit: 'kg' },
            { item: 'Eggs', prepared: 120, consumed: 120, remaining: 0, wastePercentage: 0, unit: 'units' }
          ],
          avgWastePercentage: 4.3,
          mostWastedItem: 'Rice',
          mostWastedQty: 3.5
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
          id: 'feed_001',
          date: new Date().toISOString().split('T')[0],
          studentName: 'Rajesh Kumar',
          itemRatings: { 'Rice': 5, 'Eggs': 4, 'Chikki': 5 },
          serviceRatings: { taste: 5, quality: 4, temperature: 4, behaviour: 5, cleanliness: 5 },
          comments: 'We love the hot meals served today!'
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
}

