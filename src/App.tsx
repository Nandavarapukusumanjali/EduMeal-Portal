import React, { useState, useEffect } from 'react';
import { 
  Role, 
  Student, 
  DailyWastageReport, 
  StudentFeedback,
  AttendanceReport,
  UserProfile,
  AuditLog
} from './types';
import WelcomePortal from './components/WelcomePortal';
import TeacherPortal from './components/TeacherPortal';
import SupervisorPortal from './components/SupervisorPortal';
import StudentPortal from './components/StudentPortal';
import AdminPortal from './components/AdminPortal';
import CoordinatorPortal from './components/CoordinatorPortal';
import { Utensils, Shield, LogOut, Radio, Shuffle, Info, Settings, Key } from 'lucide-react';
import ChangePasswordModal from './components/ChangePasswordModal';
import { 
  subscribeToStudents, 
  subscribeToFeedback, 
  subscribeToWastage, 
  subscribeToAttendance,
  addFeedback, 
  addWastageReport, 
  saveAttendanceReport,
  seedDatabaseIfEmpty,
  getUserProfile,
  addAuditLog
} from './services/db';
import { logoutUser, listenToAuthState } from './services/auth';
import { subscribeToCriticalErrors } from './firebase';

export default function App() {
  // Global Role Portal Management
  const [activeRole, setActiveRole] = useState<Role | 'welcome'>('welcome');
  const [quotaExceeded, setQuotaExceeded] = useState(false);
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [showChangePassword, setShowChangePassword] = useState(false);

  const handlePasswordChanged = () => {
    if (currentUser) {
      setCurrentUser(prev => prev ? { ...prev, first_login: false } : null);
    }
    setShowChangePassword(false);
  };

  useEffect(() => {
    const unsubscribe = subscribeToCriticalErrors((_msg, isQuota) => {
      if (isQuota) {
        setQuotaExceeded(true);
      }
    });
    return unsubscribe;
  }, []);

  // Securely listen to active Auth channel
  useEffect(() => {
    const unsubscribe = listenToAuthState(async (firebaseUser) => {
      if (firebaseUser) {
        try {
          const profile = await getUserProfile(firebaseUser.uid);
          if (profile) {
            if (profile.status === 'inactive' || profile.status === 'rejected') {
              console.warn("User account is inactive or rejected. Logging out.");
              await logoutUser();
              setCurrentUser(null);
              setActiveRole('welcome');
            } else {
              setCurrentUser(profile);
              setActiveRole(profile.role);
            }
          } else {
            setCurrentUser(null);
            setActiveRole('welcome');
          }
        } catch (err) {
          console.error("Error loading user profile:", err);
          setCurrentUser(null);
          setActiveRole('welcome');
        }
      } else {
        setCurrentUser(null);
        setActiveRole('welcome');
      }
    });

    return unsubscribe;
  }, []);

  const handlePortalExit = async () => {
    try {
      await logoutUser();
    } catch (err) {
      console.error('Logout failed:', err);
    }
    setActiveRole('welcome');
    setCurrentUser(null);
  };

  // Load baseline statistics and synchronize in real-time from Firestore database collections
  const [students, setStudents] = useState<Student[]>([]);
  const [wastageReports, setWastageReports] = useState<DailyWastageReport[]>([]);
  const [attendanceReports, setAttendanceReports] = useState<AttendanceReport[]>(() => {
    try {
      const saved = localStorage.getItem('edumeal_local_attendance_reports');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [feedbackList, setFeedbackList] = useState<StudentFeedback[]>([]);
  const [notificationCount, setNotificationCount] = useState<number>(3);

  // Establish live subscriptions with Firestore collections only when logged in
  useEffect(() => {
    if (activeRole === 'welcome') {
      setStudents([]);
      setFeedbackList([]);
      setWastageReports([]);
      setAttendanceReports([]);
      return;
    }

    // Seeding attempt on portal entrance (handles checks gracefully per user permissions)
    const runSeeder = async () => {
      /* 
      try {
        await seedDatabaseIfEmpty();
      } catch (err) {
        console.warn('Seeding skipped:', err);
      }
      */
    };
    runSeeder();

    const unsubStudents = subscribeToStudents((list) => {
      setStudents(list);
    });

    const unsubFeedback = subscribeToFeedback((list) => {
      setFeedbackList(list);
    });

    const unsubWastage = subscribeToWastage((list) => {
      setWastageReports(list);
    });

    const unsubAttendance = subscribeToAttendance((list) => {
      setAttendanceReports(prev => {
        const mergedMap = new Map<string, AttendanceReport>();
        
        // 1. Initial State from localStorage
        try {
          const savedStr = localStorage.getItem('edumeal_local_attendance_reports');
          if (savedStr) {
            const savedArr = JSON.parse(savedStr) as AttendanceReport[];
            savedArr.forEach(r => {
              if (r && r.id) mergedMap.set(r.id, r);
            });
          }
        } catch (e) {
          console.error(e);
        }

        // 2. Overwrite with database reports
        list.forEach(r => {
          if (r && r.id) mergedMap.set(r.id, r);
        });

        const mergedList = Array.from(mergedMap.values());
        return mergedList.sort((a, b) => b.date.localeCompare(a.date));
      });
    });

    return () => {
      unsubStudents();
      unsubFeedback();
      unsubWastage();
      unsubAttendance();
    };
  }, [activeRole]);

  // Handle addition of feedback from StudentPortal
  const handleAddFeedback = async (newFeedback: StudentFeedback) => {
    try {
      await addFeedback(newFeedback);
      setNotificationCount(p => p + 1);
    } catch (err) {
      console.error('Failed to submit student feedback to Firestore:', err);
    }
  };

  // Handle addition of wastage reports from SupervisorPortal
  const handleAddWastageReport = async (newReport: DailyWastageReport) => {
    try {
      await addWastageReport(newReport);
      setNotificationCount(p => p + 1);
    } catch (err) {
      console.error('Failed to save wastage report to Firestore:', err);
    }
  };

  // Handle attendance submission from TeacherPortal
  const handleSubmitAttendance = async (classStr: string, section: string, presentCount: number, studentDetails: { [key: string]: 'P' | 'A' }, customDate?: string) => {
    try {
      setNotificationCount(p => p + 1);
      
      const getLocalTodayDate = () => {
        const d = new Date();
        const yr = d.getFullYear();
        const mo = String(d.getMonth() + 1).padStart(2, '0');
        const da = String(d.getDate()).padStart(2, '0');
        return `${yr}-${mo}-${da}`;
      };
      
      const targetDate = customDate || getLocalTodayDate();

      const classStudents = students.filter(s => s.class === classStr && s.section === section);
      const total = classStudents.length;
      const present = presentCount;
      const absent = total - present;
      const percentage = total > 0 ? Math.round((present / total) * 100) : 0;

      const report: AttendanceReport = {
        id: `${classStr}_${section}_${targetDate}`,
        date: targetDate,
        classStr,
        section,
        totalStudents: total,
        totalPresent: present,
        totalAbsent: absent,
        attendancePercentage: percentage,
        studentDetails
      };
      
      console.log('DEBUG: Saving complete report for:', report.id, 'with students:', Object.keys(studentDetails).length);

      // 1. Save locally in state & localStorage immediately so the UI is 100% responsive
      setAttendanceReports(prev => {
        const filtered = prev.filter(r => r.id !== report.id);
        const updated = [report, ...filtered];
        try {
          localStorage.setItem('edumeal_local_attendance_reports', JSON.stringify(updated));
        } catch (e) {
          console.error('Failed to save to local storage', e);
        }
        return updated;
      });

      // 2. Transmit to remote database (fails gracefully if sandbox environment is unauthenticated/restricted)
      await saveAttendanceReport(report);

      try {
        await addAuditLog({
          log_id: `log_${Date.now()}`,
          user_id: currentUser?.uid || 'teacher',
          user_name: currentUser?.name || 'Teacher',
          role: 'teacher',
          action: 'Submitted Attendance',
          timestamp: new Date().toISOString(),
          remarks: `Submitted attendance for ${classStr}-${section} on ${targetDate}. Total Present: ${present}, Absentees: ${absent}.`
        });
      } catch (logErr) {
        console.error('Failed to save audit log for attendance:', logErr);
      }
    } catch (err) {
      console.error('Failed to save attendance report to Firestore:', err);
    }
  };

  // Global counts based authoritatively on today's posted reports
  const presentStudentCount = (() => {
    const d = new Date();
    const yr = d.getFullYear();
    const mo = String(d.getMonth() + 1).padStart(2, '0');
    const da = String(d.getDate()).padStart(2, '0');
    const todayStr = `${yr}-${mo}-${da}`;

    const classesList = [
      { c: 'Class 6', s: 'Section A' },
      { c: 'Class 6', s: 'Section B' },
      { c: 'Class 7', s: 'Section A' },
      { c: 'Class 7', s: 'Section B' },
      { c: 'Class 8', s: 'Section A' },
      { c: 'Class 8', s: 'Section B' },
      { c: 'Class 9', s: 'Section A' },
      { c: 'Class 9', s: 'Section B' },
      { c: 'Class 10', s: 'Section A' },
      { c: 'Class 10', s: 'Section B' }
    ];

    let totalPrev = 0;
    let anySubmitted = false;

    for (const item of classesList) {
      const rep = attendanceReports.find(
        r => r.classStr === item.c && r.section === item.s && r.date === todayStr
      );
      if (rep) {
        totalPrev += rep.totalPresent;
        anySubmitted = true;
      }
    }

    if (!anySubmitted) {
      return students.filter(s => s.present).length;
    }
    return totalPrev;
  })();

  const totalStudentCount = students.length;

  return (
    <div className={`min-h-screen bg-background text-on-surface flex flex-col`}>
      
      {/* Universal Top Application Header (Visible once a role is active) */}
      {activeRole !== 'welcome' && (
        <header className="fixed top-0 w-full z-50 bg-primary shadow-md h-16 flex items-center border-b border-white/15">
          <div className="flex items-center justify-between px-6 w-full max-w-[1440px] mx-auto">
            
            {/* BRAND LOGO AREA */}
            <div 
              onClick={handlePortalExit}
              className="flex items-center gap-3 cursor-pointer group"
            >
              <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center text-white group-hover:scale-105 transition-transform">
                <Utensils className="w-5 h-5" />
              </div>
              <div>
                <h1 className="font-headline-md text-base md:text-lg font-extrabold text-white tracking-tight">EduMeal Portal</h1>
                <p className="text-[9px] text-white/80 font-medium tracking-wide">AP MID-DAY MEAL COMPLIANCE</p>
              </div>
            </div>

            {/* NOTIFICATIONS & AVATAR BADGES */}
            <div className="flex items-center gap-4">
              
              {/* Selected Role Badge */}
              <div className="flex items-center gap-2 bg-white/15 border border-white/15 py-1 px-3 rounded-full text-white">
                <Shield className="w-3.5 h-3.5 text-white" />
                <span className="text-xs font-bold text-white capitalize hidden sm:inline font-headline-sm">
                  {activeRole === 'supervisor' ? 'Kitchen Supervisor' : activeRole}
                </span>
              </div>

              {/* Change Password button */}
              <button
                type="button"
                onClick={() => setShowChangePassword(true)}
                className="flex items-center gap-1.5 bg-white/10 hover:bg-white/20 text-white font-extrabold text-xs py-1.5 px-3 rounded-full border border-white/10 transition-colors cursor-pointer"
                title="Change Password"
              >
                <Key className="w-3.5 h-3.5 text-white" />
                <span className="hidden md:inline">Change Password</span>
              </button>

              {/* Log out to welcome */}
              <button 
                onClick={handlePortalExit}
                className="flex items-center gap-1 bg-red-50 text-red-600 hover:bg-red-100 hover:text-red-700 font-extrabold text-xs py-1.5 px-3 rounded-full transition-colors cursor-pointer"
                title="Logout"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Logout</span>
              </button>

            </div>
          </div>
        </header>
      )}

      {/* Main Content Layout Block */}
      <main className={`flex-1 ${activeRole !== 'welcome' ? 'pt-24 pb-12 px-6 max-w-[1440px] mx-auto w-full' : ''}`}>
        
        {/* Quota Exceeded Warning Banner */}
        {quotaExceeded && (
          <div id="quota-exceeded-banner" className="mb-6 bg-amber-50 border border-amber-200 text-amber-900 p-4 rounded-xl shadow-sm flex flex-col md:flex-row items-center justify-between gap-4 text-xs md:text-sm font-medium">
            <div className="flex items-center gap-3">
              <span className="text-xl flex-shrink-0">⚠️</span>
              <span>
                <strong>Firestore Free Daily Quota Exceeded:</strong> The daily reads limit has been reached on the free database tier. The app has automatically enabled <strong>offline fallback (local persistent cache)</strong> so all features continue to operate fully.
              </span>
            </div>
            <a
              href="https://console.firebase.google.com/project/gen-lang-client-0904883411/firestore/databases/ai-studio-92c33332-b704-4ac0-a376-ace252afe33d/data?openUpgradeDialog=true"
              target="_blank"
              rel="noopener noreferrer"
              className="whitespace-nowrap bg-amber-600 hover:bg-amber-700 text-white font-extrabold px-3.5 py-1.5 rounded-lg text-xs shadow-sm transition-colors flex items-center gap-1 cursor-pointer"
            >
              Upgrade & Reset Quotas ↗
            </a>
          </div>
        )}

        {/* Render active portal context */}
        {activeRole === 'welcome' && (
          <WelcomePortal onSelectRole={setActiveRole} />
        )}

        {activeRole === 'teacher' && (
          <TeacherPortal 
            students={students} 
            onUpdateStudents={setStudents}
            onSubmitAttendance={handleSubmitAttendance}
            onBackToWelcome={handlePortalExit}
            attendanceReports={attendanceReports}
            currentUser={currentUser}
          />
        )}

        {activeRole === 'supervisor' && (
          <SupervisorPortal 
            presentStudentCount={presentStudentCount}
            totalStudentCount={totalStudentCount}
            onAddWastageReport={handleAddWastageReport}
            onBackToWelcome={handlePortalExit}
            attendanceReports={attendanceReports}
            wastageReports={wastageReports}
            students={students}
          />
        )}

        {activeRole === 'student' && (
          <StudentPortal 
            feedbackList={feedbackList}
            onAddFeedback={handleAddFeedback}
            onBackToWelcome={handlePortalExit}
            currentUser={currentUser}
            onChangePassword={() => setShowChangePassword(true)}
          />
        )}

        {activeRole === 'admin' && (
          <AdminPortal 
            students={students}
            wastageReports={wastageReports}
            feedbackList={feedbackList}
            presentCountToday={presentStudentCount}
            onBackToWelcome={handlePortalExit}
            attendanceReports={attendanceReports}
            currentUser={currentUser}
          />
        )}

        {activeRole === 'coordinator' && (
          <CoordinatorPortal 
            onBackToWelcome={handlePortalExit}
            currentUser={currentUser}
          />
        )}

      </main>

      {/* Universal Change Password Modal */}
      {(showChangePassword || currentUser?.first_login) && (
        <ChangePasswordModal 
          onClose={handlePasswordChanged} 
          isForceChange={!!currentUser?.first_login}
        />
      )}

      {/* Persisted State operational status indicator (Floating bottom badge) */}
      {activeRole !== 'welcome' && (
        <div id="status-badge" className="fixed bottom-3 right-3 bg-white/95 backdrop-blur-xs text-on-surface border border-outline-variant p-2 rounded-xl text-[10px] shadow-sm flex items-center gap-2 select-none z-50">
          {quotaExceeded ? (
            <>
              <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
              <span>Database Status: <strong className="text-amber-600 font-bold">Offline Fallback Active</strong></span>
            </>
          ) : (
            <>
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Operational Live Sync: <strong className="text-emerald-600 font-bold">Connected</strong></span>
            </>
          )}
        </div>
      )}

    </div>
  );
}

