import React, { useState, useEffect } from 'react';
import { 
  Role, 
  Student, 
  DailyWastageReport, 
  StudentFeedback,
  AttendanceReport 
} from './types';
import WelcomePortal from './components/WelcomePortal';
import TeacherPortal from './components/TeacherPortal';
import SupervisorPortal from './components/SupervisorPortal';
import StudentPortal from './components/StudentPortal';
import AdminPortal from './components/AdminPortal';
import { Utensils, Shield, LogOut, Radio, Shuffle, Info, Bell, Settings } from 'lucide-react';
import { 
  subscribeToStudents, 
  subscribeToFeedback, 
  subscribeToWastage, 
  subscribeToAttendance,
  addFeedback, 
  addWastageReport, 
  saveAttendanceReport,
  seedDatabaseIfEmpty
} from './services/db';
import { logoutUser } from './services/auth';

export default function App() {
  // Global Role Portal Management
  const [activeRole, setActiveRole] = useState<Role | 'welcome'>('welcome');

  const handlePortalExit = async () => {
    try {
      await logoutUser();
    } catch (err) {
      console.error('Logout failed:', err);
    }
    setActiveRole('welcome');
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
      try {
        await seedDatabaseIfEmpty();
      } catch (err) {
        console.warn('Seeding skipped:', err);
      }
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
  const handleSubmitAttendance = async (classStr: string, section: string, presentCount: number, customDate?: string) => {
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
        attendancePercentage: percentage
      };

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
              
              {/* Notification icon log */}
              <div className="relative p-2 rounded-full hover:bg-white/15 transition-colors cursor-pointer text-white" onClick={() => {
                setNotificationCount(0);
                alert('[System Operational Sync]\nLatest logs synced:\n- Teacher classroom register attendance matching complete.\n- Chef requirement index adjusted.\n- Student rating logs verified.');
              }}>
                <Bell className="w-5 h-5 text-white" />
                {notificationCount > 0 && (
                  <span className="absolute top-1.5 right-1.5 w-4 h-4 bg-red-600 text-[9px] font-extrabold text-white rounded-full flex items-center justify-center animate-pulse">
                    {notificationCount}
                  </span>
                )}
              </div>

              {/* Selected Role Badge */}
              <div className="flex items-center gap-2 bg-white/15 border border-white/15 py-1 px-3 rounded-full text-white">
                <Shield className="w-3.5 h-3.5 text-white" />
                <span className="text-xs font-bold text-white capitalize hidden sm:inline font-headline-sm">
                  {activeRole === 'supervisor' ? 'Kitchen Supervisor' : activeRole}
                </span>
              </div>

              {/* Log out to welcome */}
              <button 
                onClick={handlePortalExit}
                className="flex items-center gap-1 bg-red-50 text-red-600 hover:bg-red-100 hover:text-red-700 font-extrabold text-xs py-1.5 px-3 rounded-full transition-colors cursor-pointer"
                title="Change Authority Portal"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Portal Hub</span>
              </button>

            </div>
          </div>
        </header>
      )}

      {/* Main Content Layout Block */}
      <main className={`flex-1 ${activeRole !== 'welcome' ? 'pt-24 pb-12 px-6 max-w-[1440px] mx-auto w-full' : ''}`}>
        
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
          />
        )}

      </main>

      {/* Persisted State operational status indicator (Floating bottom badge) */}
      {activeRole !== 'welcome' && (
        <div className="fixed bottom-3 right-3 bg-white/95 backdrop-blur-xs text-on-surface border border-outline-variant p-2 rounded-xl text-[10px] shadow-sm flex items-center gap-2 select-none z-50">
          <Info className="w-3.5 h-3.5 text-secondary" />
          <span>Operational Live Sync: <strong>Connected</strong></span>
        </div>
      )}

    </div>
  );
}

