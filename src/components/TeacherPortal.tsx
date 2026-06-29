import React, { useState } from 'react';
import { Student, AttendanceReport, UserProfile, TimetableEntry } from '../types';
import { 
  Users, CheckCircle, XCircle, Percent, Plus, Edit, Trash, 
  ArrowLeft, Save, Sparkles, Calendar, Printer, Download, RefreshCw, Check,
  AlertTriangle, HelpCircle, LogOut, Lock, ArrowRight
} from 'lucide-react';
import { addStudent, updateStudent, deleteStudent, subscribeToTimetableEntries } from '../services/db';

interface TeacherPortalProps {
  students: Student[];
  onUpdateStudents: (updatedStudents: Student[]) => void;
  onSubmitAttendance: (classStr: string, section: string, presentCount: number, studentDetails: { [key: string]: 'P' | 'A' }, customDate?: string) => void;
  onBackToWelcome: () => void;
  attendanceReports?: AttendanceReport[];
  currentUser?: UserProfile | null;
}

export default function TeacherPortal({
  students,
  onUpdateStudents,
  onSubmitAttendance,
  onBackToWelcome,
  attendanceReports = [],
  currentUser = null
}: TeacherPortalProps) {
  const [selectedClass, setSelectedClass] = useState<string>(() => {
    if (currentUser?.role === 'teacher' && currentUser.assigned_class) {
      return currentUser.assigned_class;
    }
    return 'Class 6';
  });
  const [selectedSection, setSelectedSection] = useState<string>(() => {
    if (currentUser?.role === 'teacher' && currentUser.assigned_section) {
      return currentUser.assigned_section;
    }
    return 'Section A';
  });
  const [searchQuery, setSearchQuery] = useState<string>('');

  const isAssigned = !currentUser || currentUser.role !== 'teacher' || (
    currentUser.assigned_class === selectedClass && currentUser.assigned_section === selectedSection
  );

  // Tabs and view switching
  const [activeTab, setActiveTab] = useState<'registry' | 'monthly' | 'timetable'>('registry');

  // DEBUGGING: Log attendance reports when switching tabs
  React.useEffect(() => {
    if (activeTab === 'monthly') {
      console.log('DEBUG: Monthly tab active. Attendance reports count:', attendanceReports.length);
      console.log('DEBUG: Attendance reports:', attendanceReports);
    }
  }, [activeTab, attendanceReports]);

  // Month and Year selection for Monthly Attendance Sheet view
  const [selectedMonth, setSelectedMonth] = useState<number>(5); // Default: June (index 5)
  const [selectedYear, setSelectedYear] = useState<number>(2026);

  // Manual grid cell attendance overrides, persisted in localStorage
  const [sheetOverrides, setSheetOverrides] = useState<{ [key: string]: 'P' | 'A' }>(() => {
    try {
      const saved = localStorage.getItem('edumeal_sheet_overrides');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  // Holiday descriptions, e.g., { "2026-06-12": "NEW YEAR" }
  const [holidayOverrides, setHolidayOverrides] = useState<{ [key: string]: string }>(() => {
    try {
      const saved = localStorage.getItem('edumeal_holiday_overrides');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  // Local submitted status to update instantly without waiting for Firestore live collection cycle
  const [localSubmittedClassSectionDates, setLocalSubmittedClassSectionDates] = useState<{ [key: string]: boolean }>(() => {
    try {
      const saved = localStorage.getItem('edumeal_submitted_dates');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  const getLocalTodayDate = () => {
    const d = new Date();
    const yr = d.getFullYear();
    const mo = String(d.getMonth() + 1).padStart(2, '0');
    const da = String(d.getDate()).padStart(2, '0');
    return `${yr}-${mo}-${da}`;
  };

  const todayDate = getLocalTodayDate();
  const [attendanceDate, setAttendanceDate] = useState<string>(todayDate);

  const [timetableEntries, setTimetableEntries] = useState<TimetableEntry[]>([]);

  React.useEffect(() => {
    const unsub = subscribeToTimetableEntries(setTimetableEntries);
    return () => unsub();
  }, []);

  const getPeriodTimes = (pNum: number) => {
    const times = [
      { start: '08:45', end: '09:35' },
      { start: '09:35', end: '10:25' },
      { start: '10:40', end: '11:30' },
      { start: '11:30', end: '12:20' },
      { start: '01:10', end: '02:00' },
      { start: '02:00', end: '02:50' },
      { start: '02:50', end: '03:40' }
    ];
    return times[pNum - 1] || { start: '08:45', end: '09:35' };
  };

  // Non-blocking accessible custom dialog states to bypass sandboxed iframe restrictions on sync popup dialogs
  const [dialogInput, setDialogInput] = useState<string>('');
  const [dialogState, setDialogState] = useState<{
    isOpen: boolean;
    type: 'alert' | 'confirm' | 'prompt';
    title: string;
    message: string;
    onConfirm: (val?: string) => void;
    onCancel?: () => void;
  }>({
    isOpen: false,
    type: 'alert',
    title: '',
    message: '',
    onConfirm: () => {},
  });

  const showCustomAlert = (title: string, message: string, onOk?: () => void) => {
    setDialogState({
      isOpen: true,
      type: 'alert',
      title,
      message,
      onConfirm: () => {
        setDialogState(prev => ({ ...prev, isOpen: false }));
        if (onOk) onOk();
      }
    });
  };

  const showCustomConfirm = (title: string, message: string, onYes: () => void, onNo?: () => void) => {
    setDialogState({
      isOpen: true,
      type: 'confirm',
      title,
      message,
      onConfirm: () => {
        setDialogState(prev => ({ ...prev, isOpen: false }));
        onYes();
      },
      onCancel: () => {
        setDialogState(prev => ({ ...prev, isOpen: false }));
        if (onNo) onNo();
      }
    });
  };

  const showCustomPrompt = (title: string, message: string, defaultValue: string, onYes: (val: string) => void, onNo?: () => void) => {
    setDialogInput(defaultValue);
    setDialogState({
      isOpen: true,
      type: 'prompt',
      title,
      message,
      onConfirm: (typedValue?: string) => {
        setDialogState(prev => ({ ...prev, isOpen: false }));
        onYes(typedValue || '');
      },
      onCancel: () => {
        setDialogState(prev => ({ ...prev, isOpen: false }));
        if (onNo) onNo();
      }
    });
  };

  // Today click interaction status: e.g., { [studentId]: 'NOT_MARKED' | 'P' | 'A' }
  const [todayClickStatus, setTodayClickStatus] = useState<{ [key: string]: 'NOT_MARKED' | 'P' | 'A' }>({});

  React.useEffect(() => {
    // 1. Check Firestore report FIRST
    const reportForDate = attendanceReports.find(
      r => r.classStr === selectedClass && r.section === selectedSection && r.date === attendanceDate
    );

    if (reportForDate?.studentDetails) {
      setTodayClickStatus(reportForDate.studentDetails);
      return;
    }

    // 2. Fallback to localStorage
    try {
      const saved = localStorage.getItem(`edumeal_click_status_${attendanceDate}`);
      setTodayClickStatus(saved ? JSON.parse(saved) : {});
    } catch {
      setTodayClickStatus({});
    }
  }, [attendanceDate, attendanceReports, selectedClass, selectedSection]);

  // Keep track of the original status of students for rollback/cancel
  const [snapshotKey, setSnapshotKey] = useState<string>("");
  const [originalSnapshot, setOriginalSnapshot] = useState<{
    clickStatus: { [studentId: string]: 'P' | 'A' | 'NOT_MARKED' };
    studentPresents: { [studentId: string]: boolean };
  } | null>(null);

  React.useEffect(() => {
    const currentKey = `${selectedClass}_${selectedSection}_${attendanceDate}`;
    const classStudents = students.filter(s => s.class === selectedClass && s.section === selectedSection);
    
    // If we have actual students loaded and the snapshot is either not for this key OR is currently unset
    if (classStudents.length > 0 && snapshotKey !== currentKey) {
      let savedClickStatus: { [key: string]: 'P' | 'A' | 'NOT_MARKED' } = {};
      try {
        const saved = localStorage.getItem(`edumeal_click_status_${attendanceDate}`);
        if (saved) {
          savedClickStatus = JSON.parse(saved);
        }
      } catch (e) {
        console.error(e);
      }

      const originalClick: { [key: string]: 'P' | 'A' | 'NOT_MARKED' } = {};
      const originalPresents: { [key: string]: boolean } = {};

      classStudents.forEach(s => {
        // Find if this student has a saved click status, if not we back up as of now
        originalClick[s.id] = savedClickStatus[s.id] || 'NOT_MARKED';
        originalPresents[s.id] = s.present ?? true;
      });

      setOriginalSnapshot({
        clickStatus: originalClick,
        studentPresents: originalPresents,
      });
      setSnapshotKey(currentKey);
    }
  }, [selectedClass, selectedSection, attendanceDate, students, snapshotKey]);

  // Synchronise or back up the original submitted slice if today is already submitted
  React.useEffect(() => {
    const todayReport = attendanceReports.find(
      r => r.classStr === selectedClass && r.section === selectedSection && r.date === attendanceDate
    );
    const todaySubmittedInternal = !!todayReport || !!localSubmittedClassSectionDates[`${selectedClass}_${selectedSection}_${attendanceDate}`];

    if (todaySubmittedInternal) {
      const backupKey = `edumeal_submitted_backup_${selectedClass}_${selectedSection}_${attendanceDate}`;
      const existingBackup = localStorage.getItem(backupKey);
      if (!existingBackup) {
        const classStudents = students.filter(s => s.class === selectedClass && s.section === selectedSection);
        const currentBackupSlice: { [key: string]: 'P' | 'A' | 'NOT_MARKED' } = {};
        classStudents.forEach(s => {
          currentBackupSlice[s.id] = todayClickStatus[s.id] || 'NOT_MARKED';
        });
        localStorage.setItem(backupKey, JSON.stringify(currentBackupSlice));
      }
    }
  }, [attendanceReports, localSubmittedClassSectionDates, selectedClass, selectedSection, attendanceDate, todayClickStatus, students]);

  const handleRollbackChanges = async () => {
    if (originalSnapshot) {
      try {
        // Restore local and DB student states for this class/section
        const updatedStudentsList = students.map(s => {
          if (s.class === selectedClass && s.section === selectedSection) {
            const wasPresent = originalSnapshot.studentPresents[s.id] ?? true;
            updateStudent(s.id, { present: wasPresent });
            return { ...s, present: wasPresent };
          }
          return s;
        });

        // Reconstruct active click statuses
        const restoredClickStatus = { ...todayClickStatus, ...originalSnapshot.clickStatus };

        setTodayClickStatus(restoredClickStatus);
        localStorage.setItem(`edumeal_click_status_${attendanceDate}`, JSON.stringify(restoredClickStatus));
        onUpdateStudents(updatedStudentsList);

        // Also back up this restored state under backupKey just in case
        const backupKey = `edumeal_submitted_backup_${selectedClass}_${selectedSection}_${attendanceDate}`;
        localStorage.setItem(backupKey, JSON.stringify(originalSnapshot.clickStatus));

        showCustomAlert(
          "Changes Discarded",
          "All changes have been successfully discarded, and attendance rolls have been reverted to the last submitted state."
        );
      } catch (e) {
        console.error("Failed to restore original statuses:", e);
      }
    } else {
      showCustomAlert(
        "No Changes to Revert",
        "Could not find a backup of the original submitted attendance record to roll back to."
      );
    }
  };

  const handleStatusClick = (studentId: string) => {
    if (!isAssigned) {
      showCustomAlert("Unauthorized Action", `You are only authorized to post and edit attendance for your assigned class (${currentUser?.assigned_class} - ${currentUser?.assigned_section}).`);
      return;
    }
    const current = todayClickStatus[studentId];
    // Start as unmarked (undefined). First click -> Present (P). Toggle then flips: P -> A -> P.
    let nextStatus: 'P' | 'A';
    if (!current || current === 'NOT_MARKED') {
      nextStatus = 'P';
    } else {
      nextStatus = current === 'P' ? 'A' : 'P';
    }

    const updated = { ...todayClickStatus, [studentId]: nextStatus };
    setTodayClickStatus(updated);
    try {
      localStorage.setItem(`edumeal_click_status_${attendanceDate}`, JSON.stringify(updated));
    } catch (e) {
      console.error('Failed to save click status to localStorage', e);
    }
    
    const isPresent = nextStatus === 'P';
    onUpdateStudents(students.map(s => s.id === studentId ? { ...s, present: isPresent } : s));
    updateStudent(studentId, { present: isPresent });
  };

  const handleEditHolidayToday = () => {
    if (!isAssigned) {
      showCustomAlert("Unauthorized Action", `You are only authorized to configure holiday settings for your assigned class (${currentUser?.assigned_class} - ${currentUser?.assigned_section}).`);
      return;
    }
    showCustomConfirm(
      "Mark Holiday Confirmation",
      `Is ${attendanceDate} a holiday? Click 'Yes / Proceed' to configure a custom holiday name, or 'No / Cancel' to reset/mark it as a standard working school day.`,
      () => {
        showCustomPrompt(
          "Enter Holiday Description",
          `Please enter the holiday description (e.g., 'NEW YEAR') for ${attendanceDate}:`,
          holidayOverrides[attendanceDate] || "NEW YEAR",
          (descName) => {
            if (descName && descName.trim()) {
              const cleanDesc = descName.trim().toUpperCase();
              const updated = { ...holidayOverrides, [attendanceDate]: cleanDesc };
              setHolidayOverrides(updated);
              localStorage.setItem('edumeal_holiday_overrides', JSON.stringify(updated));
              showCustomAlert(
                "Holiday Configured Successfully",
                `${attendanceDate} has been set as a Holiday: "${cleanDesc}". This will spell out letters in the Monthly Attendance Sheet!`
              );
            }
          }
        );
      },
      () => {
        const updated = { ...holidayOverrides };
        delete updated[attendanceDate];
        setHolidayOverrides(updated);
        localStorage.setItem('edumeal_holiday_overrides', JSON.stringify(updated));
        showCustomAlert(
          "Standard Working Day Restore",
          `${attendanceDate} is marked as a standard working school day. This will be automatically included in working days!`
        );
      }
    );
  };

  const handleEditHolidayForDay = (dayNum: number) => {
    const dStr = `${selectedYear}-${pad(selectedMonth + 1)}-${pad(dayNum)}`;
    showCustomConfirm(
      "Mark Holiday Confirmation",
      `Is Day ${dayNum} (${dStr}) a holiday? Click 'Yes / Proceed' to configure it as a custom holiday, or 'No / Cancel' to reset/mark it as a standard school working day.`,
      () => {
        showCustomPrompt(
          "Enter Holiday Description",
          `Please enter the holiday description for ${dStr}:`,
          holidayOverrides[dStr] || "NEW YEAR",
          (descName) => {
            if (descName && descName.trim()) {
              const cleanDesc = descName.trim().toUpperCase();
              const updated = { ...holidayOverrides, [dStr]: cleanDesc };
              setHolidayOverrides(updated);
              localStorage.setItem('edumeal_holiday_overrides', JSON.stringify(updated));
              showCustomAlert(
                "Holiday Configured Successfully",
                `Day ${dayNum} (${dStr}) is set as a Holiday: "${cleanDesc}". This will spell out letters in the Monthly Attendance Sheet!`
              );
            }
          }
        );
      },
      () => {
        const updated = { ...holidayOverrides };
        delete updated[dStr];
        setHolidayOverrides(updated);
        localStorage.setItem('edumeal_holiday_overrides', JSON.stringify(updated));
        showCustomAlert(
          "Standard Working Day Restore",
          `Day ${dayNum} (${dStr}) is marked as a standard school working day. This will be automatically included in working days!`
        );
      }
    );
  };

  const pad = (num: number) => num.toString().padStart(2, '0');

  // Add student form state
  const [isAddMode, setIsAddMode] = useState<boolean>(false);
  const [newStudentName, setNewStudentName] = useState<string>('');
  const [newStudentRollNo, setNewStudentRollNo] = useState<string>('');
  const [newStudentGender, setNewStudentGender] = useState<'Male' | 'Female'>('Male');

  // Edit student state
  const [editingStudentId, setEditingStudentId] = useState<string | null>(null);
  const [editName, setEditName] = useState<string>('');
  const [editRollNo, setEditRollNo] = useState<string>('');
  const [editGender, setEditGender] = useState<'Male' | 'Female'>('Male');

  // Filter students based on UI selections
  const filteredStudents = students.filter(
    s => s.class === selectedClass && 
         s.section === selectedSection &&
         s.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getIsRealDateSundayOrHoliday = (dStr: string) => {
    const parts = dStr.split('-');
    const yr = parseInt(parts[0], 10);
    const mo = parseInt(parts[1], 10) - 1; // 0-indexed
    const da = parseInt(parts[2], 10);
    const d = new Date(yr, mo, da);
    const isSunday = d.getDay() === 0;
    
    if (holidayOverrides[dStr]) {
      return { isHoliday: true, name: holidayOverrides[dStr], isSunday };
    }
    if (yr === 2026 && mo === 5) {
      if (da === 5) return { isHoliday: true, name: "BAKRID", isSunday };
      if (da < 12) return { isHoliday: true, name: "SUMMER HOLIDAYS", isSunday };
    }
    return { isHoliday: false, name: null, isSunday };
  };

  // Stats calculation matches interactive tap states (unmarked is NOT counted as Present or Absent)
  const totalStudents = filteredStudents.length;
  const presentStudents = filteredStudents.filter(s => todayClickStatus[s.id] === 'P').length;
  const absentStudents = filteredStudents.filter(s => todayClickStatus[s.id] === 'A').length;
  const attendancePercentage = totalStudents > 0 ? ((presentStudents / totalStudents) * 100).toFixed(1) : '0.0';

  // Yesterday vs Attendance Date logic based on submitted reports
  const todayReport = attendanceReports.find(
    r => r.classStr === selectedClass && r.section === selectedSection && r.date === attendanceDate
  );

  const sortedPreviousReports = [...attendanceReports]
    .filter(r => r.classStr === selectedClass && r.section === selectedSection && r.date !== attendanceDate)
    .sort((a, b) => b.date.localeCompare(a.date));
  
  const yesterdayReport = sortedPreviousReports[0];
  const todaySubmitted = !!todayReport || !!localSubmittedClassSectionDates[`${selectedClass}_${selectedSection}_${attendanceDate}`];

  const realTodayInfo = getIsRealDateSundayOrHoliday(attendanceDate);
  const isClosedToday = realTodayInfo.isSunday || realTodayInfo.isHoliday;

  let statsTotal = totalStudents;
  let statsPresent = presentStudents;
  let statsAbsent = absentStudents;
  let statsPercentage = attendancePercentage;
  let statsLabel = "Selected Date's Attendance (PENDING - NOT POSTED)";
  let statsColor = "border-red-500 bg-red-50/40 text-red-950";

  if (isClosedToday) {
    statsTotal = totalStudents;
    statsPresent = 0;
    statsAbsent = 0;
    statsPercentage = "0.0";
    if (realTodayInfo.isSunday) {
      statsLabel = `Sunday (${attendanceDate}) - School Closed (No Attendance Required)`;
    } else {
      statsLabel = `Holiday (${attendanceDate}): ${realTodayInfo.name} - School Closed (No Attendance Required)`;
    }
    statsColor = "border-outline bg-surface-container-low/50 text-on-surface-variant";
  } else if (todaySubmitted) {
    statsTotal = todayReport ? todayReport.totalStudents : totalStudents;
    statsPresent = todayReport ? todayReport.totalPresent : presentStudents;
    statsAbsent = todayReport ? todayReport.totalAbsent : absentStudents;
    statsPercentage = todayReport ? todayReport.attendancePercentage.toFixed(1) : attendancePercentage;
    statsLabel = `Attendance for ${attendanceDate} (Submitted Successfully)`;
    statsColor = "border-secondary bg-secondary/5 text-secondary-hover";
  }

  const handleToggleAttendance = async (id: string) => {
    const student = students.find(s => s.id === id);
    if (!student) return;
    try {
      await updateStudent(id, { present: !student.present });
    } catch (err) {
      console.error('Failed to toggle attendance:', err);
    }
  };

  const handleMarkAll = async (present: boolean) => {
    try {
      const targets = students.filter(s => s.class === selectedClass && s.section === selectedSection);
      await Promise.all(targets.map(s => updateStudent(s.id, { present })));
      
      // Update interactive tap status state and local storage
      setTodayClickStatus(prev => {
        const updated = { ...prev };
        targets.forEach(s => {
          updated[s.id] = present ? 'P' : 'A';
        });
        localStorage.setItem(`edumeal_click_status_${attendanceDate}`, JSON.stringify(updated));
        return updated;
      });
      // Immediately notify parent components
      onUpdateStudents(students.map(s => {
        if (s.class === selectedClass && s.section === selectedSection) {
          return { ...s, present };
        }
        return s;
      }));
    } catch (err) {
      console.error('Failed to mass update attendance:', err);
    }
  };

  const handleAddStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStudentName.trim() || !newStudentRollNo.trim()) return;

    try {
      const newStudent: Omit<Student, 'id'> = {
        name: newStudentName.trim(),
        rollNo: newStudentRollNo.trim(),
        class: selectedClass,
        section: selectedSection,
        gender: newStudentGender,
        present: true // Default present
      };

      await addStudent(newStudent);
      setNewStudentName('');
      setNewStudentRollNo('');
      setIsAddMode(false);
    } catch (err) {
      console.error('Failed to add student registry:', err);
    }
  };

  const handleStartEdit = (student: Student) => {
    setEditingStudentId(student.id);
    setEditName(student.name);
    setEditGender(student.gender);
    setEditRollNo(student.rollNo || student.id);
  };

  const handleSaveEdit = async (id: string) => {
    try {
      await updateStudent(id, { name: editName, gender: editGender, rollNo: editRollNo.trim() });
      setEditingStudentId(null);
    } catch (err) {
      console.error('Failed to save student edits:', err);
    }
  };

  const handleDeleteStudent = async (id: string) => {
    try {
      await deleteStudent(id);
    } catch (err) {
      console.error('Failed to delete student:', err);
    }
  };

  const handleSubmit = async () => {
    if (!isAssigned) {
      showCustomAlert("Unauthorized Action", `You are only authorized to post and edit attendance for your assigned class (${currentUser?.assigned_class} - ${currentUser?.assigned_section}).`);
      return;
    }
    const realDateInfo = getIsRealDateSundayOrHoliday(attendanceDate);
    const isClosed = realDateInfo.isSunday || realDateInfo.isHoliday;
    if (isClosed) {
      showCustomAlert(
        "School Closed",
        `The date ${attendanceDate} is a school closed day (Sunday or Holiday). No attendance submission is required.`
      );
      return;
    }

    // Collect active classroom students
    const classStudents = students.filter(s => s.class === selectedClass && s.section === selectedSection);
    if (classStudents.length === 0) {
      showCustomAlert(
        "No Registered Students",
        "No students are registered in this class/section."
      );
      return;
    }
    
    // Check for unmarked students
    const unmarkedStudents = classStudents.filter(s => {
      const status = todayClickStatus[s.id];
      return !status || status === 'NOT_MARKED';
    });

    const finalClickStatus = { ...todayClickStatus };

    const proceedWithPosting = (originalWorkingClickStatus: typeof todayClickStatus) => {
      // Force all unmarked students to 'P' (Present)
      const workingClickStatus = { ...originalWorkingClickStatus };
      classStudents.forEach(s => {
        if (!workingClickStatus[s.id] || workingClickStatus[s.id] === 'NOT_MARKED') {
          workingClickStatus[s.id] = 'P';
        }
      });

      const absentees = classStudents.filter(s => workingClickStatus[s.id] === 'A');
      const presentCount = classStudents.length - absentees.length;

      const absenteeRolls = absentees.length > 0
        ? absentees.map(s => s.rollNo ? `Roll No. ${s.rollNo} (${s.name})` : s.name).join('\n')
        : 'None (100% Attendance)';

      const confirmMsg = `Are you sure you want to submit attendance for ${selectedClass} - ${selectedSection} on date ${attendanceDate}?\n\nAbsentees (Roll Numbers / Name):\n${absentees.length > 0 ? absenteeRolls : 'None (100% Attendance)'}\n\nClick 'Yes / Proceed' to post and update records, or 'No / Cancel' to hold as not posted.`;

      if (todaySubmitted) {
        showCustomConfirm(
          "Attendance Already Submitted",
          "already attendance is submitted and do you want to change or cancel",
          async () => {
            try {
              // Post the attendance (pass the attendanceDate as the 5th argument)
              onSubmitAttendance(selectedClass, selectedSection, presentCount, workingClickStatus, attendanceDate);

              // Immediately start updates for local and DB state
              const updatedStudentsList = students.map(s => {
                if (s.class === selectedClass && s.section === selectedSection) {
                  const isPresent = workingClickStatus[s.id] !== 'A';
                  updateStudent(s.id, { present: isPresent });
                  return { ...s, present: isPresent };
                }
                return s;
              });

              setTodayClickStatus(workingClickStatus);
              localStorage.setItem(`edumeal_click_status_${attendanceDate}`, JSON.stringify(workingClickStatus));
              onUpdateStudents(updatedStudentsList);

              // Save the new slice as backup
              const backupKey = `edumeal_submitted_backup_${selectedClass}_${selectedSection}_${attendanceDate}`;
              const newBackupSlice: { [key: string]: 'P' | 'A' | 'NOT_MARKED' } = {};
              classStudents.forEach(s => {
                newBackupSlice[s.id] = workingClickStatus[s.id] || 'NOT_MARKED';
              });
              localStorage.setItem(backupKey, JSON.stringify(newBackupSlice));

              // Mark the date as submitted locally to instantly update the monthly sheet and other components
              const submissionKey = `${selectedClass}_${selectedSection}_${attendanceDate}`;
              setLocalSubmittedClassSectionDates(prev => {
                const updated = { ...prev, [submissionKey]: true };
                try {
                  localStorage.setItem('edumeal_submitted_dates', JSON.stringify(updated));
                } catch (err) {
                  console.error(err);
                }
                return updated;
              });

              // Update snapshot baseline
              const committedPresents: { [key: string]: boolean } = {};
              const committedClick: { [key: string]: 'P' | 'A' | 'NOT_MARKED' } = {};
              classStudents.forEach(s => {
                committedPresents[s.id] = workingClickStatus[s.id] !== 'A';
                committedClick[s.id] = workingClickStatus[s.id] || 'NOT_MARKED';
              });
              setOriginalSnapshot({
                clickStatus: committedClick,
                studentPresents: committedPresents,
              });

              showCustomAlert(
                "Attendance Updated Successfully",
                `Attendance for ${selectedClass} - ${selectedSection} on date ${attendanceDate} updated successfully!\n\nRegistered: ${classStudents.length} students.\nPresent: ${presentCount}.\nAbsentees: ${absentees.length}.`
              );
            } catch (err) {
              console.error('Failed to submit attendance roll:', err);
              showCustomAlert("Submission Failed", "An error occurred while posting attendance. Please try again.");
            }
          },
          () => {
            // Cancel means "all changes made not applied", revert to previous submitted backup state!
            handleRollbackChanges();
          }
        );
      } else {
        showCustomConfirm(
          "Confirm Attendance Submission",
          confirmMsg,
          async () => {
            try {
              // Post the attendance (pass the attendanceDate as the 5th argument)
              onSubmitAttendance(selectedClass, selectedSection, presentCount, workingClickStatus, attendanceDate);

              // Immediately start updates for local and DB state
              const updatedStudentsList = students.map(s => {
                if (s.class === selectedClass && s.section === selectedSection) {
                  const isPresent = workingClickStatus[s.id] !== 'A';
                  updateStudent(s.id, { present: isPresent });
                  return { ...s, present: isPresent };
                }
                return s;
              });

              setTodayClickStatus(workingClickStatus);
              localStorage.setItem(`edumeal_click_status_${attendanceDate}`, JSON.stringify(workingClickStatus));
              onUpdateStudents(updatedStudentsList);

              // Save the new slice as backup
              const backupKey = `edumeal_submitted_backup_${selectedClass}_${selectedSection}_${attendanceDate}`;
              const newBackupSlice: { [key: string]: 'P' | 'A' | 'NOT_MARKED' } = {};
              classStudents.forEach(s => {
                newBackupSlice[s.id] = workingClickStatus[s.id] || 'NOT_MARKED';
              });
              localStorage.setItem(backupKey, JSON.stringify(newBackupSlice));

              // Mark the date as submitted locally to instantly update the monthly sheet and other components
              const submissionKey = `${selectedClass}_${selectedSection}_${attendanceDate}`;
              setLocalSubmittedClassSectionDates(prev => {
                const updated = { ...prev, [submissionKey]: true };
                try {
                  localStorage.setItem('edumeal_submitted_dates', JSON.stringify(updated));
                } catch (err) {
                  console.error(err);
                }
                return updated;
              });

              // Update snapshot baseline
              const committedPresents: { [key: string]: boolean } = {};
              const committedClick: { [key: string]: 'P' | 'A' | 'NOT_MARKED' } = {};
              classStudents.forEach(s => {
                committedPresents[s.id] = workingClickStatus[s.id] !== 'A';
                committedClick[s.id] = workingClickStatus[s.id] || 'NOT_MARKED';
              });
              setOriginalSnapshot({
                clickStatus: committedClick,
                studentPresents: committedPresents,
              });

              showCustomAlert(
                "Attendance Posted Successfully",
                `Attendance for ${selectedClass} - ${selectedSection} on date ${attendanceDate} posted successfully!\n\nRegistered: ${classStudents.length} students.\nPresent: ${presentCount}.\nAbsentees: ${absentees.length}.`
              );
            } catch (err) {
              console.error('Failed to submit attendance roll:', err);
              showCustomAlert("Submission Failed", "An error occurred while posting attendance. Please try again.");
            }
          },
          () => {
            showCustomAlert(
              "Submission Cancelled",
              `Attendance for ${attendanceDate} remains NOT POSTED (Pending status retained).`
            );
          }
        );
      }
    };

    if (unmarkedStudents.length > 0) {
      showCustomConfirm(
        "Unmarked Students Detected",
        `There are ${unmarkedStudents.length} student(s) still UNMARKED in the list.\n\nWould you like to automatically mark all unmarked students as PRESENT and proceed with submission?`,
        () => {
          // Yes: Populate unmarked as 'P'
          unmarkedStudents.forEach(s => {
            finalClickStatus[s.id] = 'P';
          });
          proceedWithPosting(finalClickStatus);
        },
        () => {
          // No: Cancel submission and tell teacher to specify
          showCustomAlert(
            "Submission On Hold",
            "Submission cancelled. Please mark each student as either Present or Absent before posting."
          );
        }
      );
    } else {
      proceedWithPosting(finalClickStatus);
    }
  };

  // Monthly calculations
  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];
  const years = [2024, 2025, 2026];

  const numDays = new Date(selectedYear, selectedMonth + 1, 0).getDate();
  const daysInMonthArray = Array.from({ length: numDays }, (_, i) => i + 1);

  const getDayInfo = (dayNum: number) => {
    const dStr = `${selectedYear}-${pad(selectedMonth + 1)}-${pad(dayNum)}`;
    const dateObj = new Date(selectedYear, selectedMonth, dayNum);
    const dayIndex = dateObj.getDay();
    const dayLabel = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"][dayIndex];
    const isSunday = dayIndex === 0;
    const isToday = dStr === todayDate;
    return { dStr, dayLabel, isSunday, isToday };
  };

  const getHolidayForDay = (dayNum: number): string | null => {
    // Check manual override first
    const dStr = `${selectedYear}-${pad(selectedMonth + 1)}-${pad(dayNum)}`;
    if (holidayOverrides[dStr]) {
      return holidayOverrides[dStr];
    }
    // Check automatic public holidays / vacations for June 2026 (index 5)
    if (selectedYear === 2026 && selectedMonth === 5) {
      if (dayNum === 5) return "BAKRID";
      if (dayNum < 12) return "SUMMER HOLIDAYS";
    }
    return null;
  };

  const getMaxVisibleDay = () => {
    const todayObj = new Date();
    let maxDay = 0;

    if (selectedYear < todayObj.getFullYear()) {
      maxDay = numDays;
    } else if (selectedYear === todayObj.getFullYear() && selectedMonth < todayObj.getMonth()) {
      maxDay = numDays;
    } else if (selectedYear === todayObj.getFullYear() && selectedMonth === todayObj.getMonth()) {
      maxDay = todayObj.getDate();
    }

    // Include the day of the currently focused attendance date if it is in this month/year
    const parts = attendanceDate.split('-');
    if (parts.length === 3) {
      const attYr = parseInt(parts[0], 10);
      const attMo = parseInt(parts[1], 10) - 1;
      const attDa = parseInt(parts[2], 10);
      if (attYr === selectedYear && attMo === selectedMonth) {
        if (attDa > maxDay) {
          maxDay = attDa;
        }
      }
    }

    // Include any day that has a submitted attendance record in the list
    attendanceReports.forEach(r => {
      if (r.classStr === selectedClass && r.section === selectedSection) {
        const rp = r.date.split('-');
        if (rp.length === 3) {
          const rYr = parseInt(rp[0], 10);
          const rMo = parseInt(rp[1], 10) - 1;
          const rDa = parseInt(rp[2], 10);
          if (rYr === selectedYear && rMo === selectedMonth) {
            if (rDa > maxDay) {
              maxDay = rDa;
            }
          }
        }
      }
    });

    // Also scan local in-memory submitted status
    Object.keys(localSubmittedClassSectionDates).forEach(key => {
      if (key.startsWith(`${selectedClass}_${selectedSection}_`)) {
        const datePart = key.replace(`${selectedClass}_${selectedSection}_`, '');
        const rp = datePart.split('-');
        if (rp.length === 3) {
          const rYr = parseInt(rp[0], 10);
          const rMo = parseInt(rp[1], 10) - 1;
          const rDa = parseInt(rp[2], 10);
          if (rYr === selectedYear && rMo === selectedMonth) {
            if (rDa > maxDay) {
              maxDay = rDa;
            }
          }
        }
      }
    });

    return Math.min(maxDay, numDays);
  };

  const getMaxVisibleDayForStats = () => {
    return getMaxVisibleDay();
  };

  const getStudentStatus = (student: Student, dayNum: number) => {
    // 1. Constraint: Leave future days after dynamic max visible day completely empty/blank (add till today only)
    if (dayNum > getMaxVisibleDay()) {
      return '';
    }

    const { dStr, isSunday, isToday } = getDayInfo(dayNum);
    if (isSunday) return 'SUN';

    // 2. Spatially spell out any automatic/manual holiday name on each card cell
    const holidayText = getHolidayForDay(dayNum);
    if (holidayText) {
      const sIdx = filteredStudents.findIndex(s => s.id === student.id);
      if (sIdx !== -1) {
        const clean = holidayText.toUpperCase();
        return clean[sIdx % clean.length];
      }
      return 'H';
    }

    // 1. Get report for this day/class/section
    const reportForDate = attendanceReports.find(
      r => r.classStr === selectedClass && r.section === selectedSection && r.date === dStr
    );

    if (reportForDate?.studentDetails && reportForDate.studentDetails[student.id]) {
      return reportForDate.studentDetails[student.id];
    } else if (reportForDate) {
      console.warn(`DEBUG: Report found for ${dStr}, but studentDetails missing or student ${student.id} not found in studentDetails keys: ${reportForDate.studentDetails ? Object.keys(reportForDate.studentDetails).join(',') : 'UNDEFINED'}`);
    }

    // 2. If it is the currently selected date, load live tap status
    if (dStr === attendanceDate) {
      const clickStatus = todayClickStatus[student.id];
      return (clickStatus === 'P' || clickStatus === 'A') ? clickStatus : '';
    }

    // 3. Check cell overrides for past dates
    const key = `${student.id}_${dStr}`;
    if (sheetOverrides[key]) {
      return sheetOverrides[key];
    }

    // 4. Default: Unmarked
    return '';
  };

  const toggleStatusDirectly = (studentId: string, dayNum: number) => {
    // Disable toggling non-editable or empty cells
    if (dayNum > getMaxVisibleDay()) return;
    const { dStr, isSunday, isToday } = getDayInfo(dayNum);
    if (isSunday) return;
    if (isToday && !todaySubmitted) return;
    if (getHolidayForDay(dayNum)) return; // holiday column is non-overrideable

    const student = filteredStudents.find(s => s.id === studentId);
    if (!student) return;

    const currentStatus = getStudentStatus(student, dayNum);
    const nextStatus = currentStatus === 'P' ? 'A' : 'P';
    
    const key = `${studentId}_${dStr}`;
    const nextOverrides = { ...sheetOverrides, [key]: nextStatus };
    setSheetOverrides(nextOverrides);
    localStorage.setItem('edumeal_sheet_overrides', JSON.stringify(nextOverrides));
  };

  // Pre-calculate month statistics (working days, excluding Sundays, public holidays, and custom/edited holidays)
  const workingDaysCount = daysInMonthArray.filter(dayNum => {
    const { isSunday } = getDayInfo(dayNum);
    if (isSunday) return false;
    const holiday = getHolidayForDay(dayNum);
    if (holiday) return false;
    return true;
  }).length;

  const workingDaysCountForStats = daysInMonthArray.filter(dayNum => {
    if (dayNum > getMaxVisibleDayForStats()) return false;
    const { isSunday } = getDayInfo(dayNum);
    if (isSunday) return false;
    const holiday = getHolidayForDay(dayNum);
    if (holiday) return false;
    return true;
  }).length;

  let totalPresenceCounts = 0;
  let totalCellEvaluated = 0;
  filteredStudents.forEach(student => {
    daysInMonthArray.forEach(dayNum => {
      if (dayNum > getMaxVisibleDayForStats()) return;
      
      const { isSunday } = getDayInfo(dayNum);
      const isHoliday = getHolidayForDay(dayNum) !== null;
      if (!isSunday && !isHoliday) {
        const s = getStudentStatus(student, dayNum);
        if (s === 'P') {
          totalPresenceCounts++;
          totalCellEvaluated++;
        } else if (s === 'A') {
          totalCellEvaluated++;
        }
      }
    });
  });

  const monthlyAvgRate = totalCellEvaluated > 0 
    ? ((totalPresenceCounts / totalCellEvaluated) * 100).toFixed(1)
    : '0.0';

  const handleExportCSV = () => {
    const headers = [
      "Serial No.", 
      "Student Name", 
      ...daysInMonthArray.map(d => `Day ${d}`),
      "Days Present",
      "Days Absent",
      "Percentage"
    ];
    const csvRows = [headers.join(",")];

    filteredStudents.forEach((student, idx) => {
      // Pre-calculate statistics for this child
      let presentCount = 0;
      let absentCount = 0;
      daysInMonthArray.forEach(dayNum => {
        const isSunday = getDayInfo(dayNum).isSunday;
        const isHoliday = getHolidayForDay(dayNum) !== null;
        if (isSunday || isHoliday) return;
        
        const status = getStudentStatus(student, dayNum);
        if (status === 'P') {
          presentCount++;
        } else if (status === 'A') {
          absentCount++;
        }
      });
      const total = presentCount + absentCount;
      const pct = total > 0 ? ((presentCount / total) * 100).toFixed(1) + '%' : '0.0%';

      const rowData = [
        (idx + 1).toString(),
        student.name,
        ...daysInMonthArray.map(dayNum => {
          const status = getStudentStatus(student, dayNum);
          return status === 'SUN' ? 'SUNDAY' : status;
        }),
        presentCount.toString(),
        absentCount.toString(),
        pct
      ];
      rowData[1] = `"${rowData[1]}"`; // wrap names
      csvRows.push(rowData.join(","));
    });

    const csvContent = "data:text/csv;charset=utf-8," + csvRows.join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Attendance_Sheet_${selectedClass.replace(' ', '_')}_${selectedSection.replace(' ', '_')}_${months[selectedMonth]}_${selectedYear}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-outline-variant pb-6">
        <div>
          <button 
            onClick={onBackToWelcome}
            className="flex items-center gap-1.5 text-primary hover:underline font-semibold text-sm mb-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Select Portal
          </button>
          <button 
            onClick={onBackToWelcome}
            className="flex items-center gap-1.5 bg-red-50 text-red-600 hover:bg-red-100 hover:text-red-700 font-bold text-xs py-1.5 px-3 rounded-full transition-colors cursor-pointer mb-2"
          >
            <LogOut className="w-3.5 h-3.5" />
            Logout
          </button>
          <span className="text-secondary font-extrabold uppercase tracking-widest text-xs">Today's Attendance</span>
          <h2 className="font-headline-lg text-2xl md:text-3xl font-bold text-primary mt-1">Classroom Registry</h2>
          
          {!isAssigned && (
            <div className="mt-4 bg-amber-50 border border-amber-200 text-amber-800 p-3.5 rounded-xl text-xs flex items-center gap-2.5 shadow-3xs animate-fade-in">
              <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 animate-pulse" />
              <div>
                <span className="font-bold">Read-Only Mode:</span> You are only authorized to post and modify attendance for your assigned class (<strong>{currentUser?.assigned_class} - {currentUser?.assigned_section}</strong>).
              </div>
            </div>
          )}

          <p className="text-on-surface-variant text-sm mt-1">
            Register students and submit accurate numbers for Mid-Day Meal planning.
          </p>
        </div>

        {/* Filter Controls */}
        <div className="flex flex-wrap items-center gap-3 font-sans">
          <div>
            <label className="block text-xs font-bold text-on-surface-variant mb-1">Class</label>
            <select 
              value={selectedClass} 
              onChange={e => setSelectedClass(e.target.value)}
              className="bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary focus:border-primary focus:outline-none transition-all cursor-pointer font-bold"
            >
              <option value="Class 6">Class 6</option>
              <option value="Class 7">Class 7</option>
              <option value="Class 8">Class 8</option>
              <option value="Class 9">Class 9</option>
              <option value="Class 10">Class 10</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-on-surface-variant mb-1">Section</label>
            <select 
              value={selectedSection} 
              onChange={e => setSelectedSection(e.target.value)}
              className="bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary focus:border-primary focus:outline-none transition-all cursor-pointer font-bold"
            >
              <option value="Section A">Section A</option>
              <option value="Section B">Section B</option>
            </select>
          </div>
        </div>
      </div>

      {/* View Tabs */}
      {!isAssigned ? (
        <div className="bg-white p-8 rounded-2xl border border-outline-variant shadow-2xs text-center max-w-xl mx-auto my-8 space-y-6 animate-fade-in">
          <div className="mx-auto w-16 h-16 bg-rose-50 border border-rose-200 text-rose-600 rounded-full flex items-center justify-center shadow-3xs">
            <Lock className="w-8 h-8 animate-pulse" />
          </div>
          <div className="space-y-2">
            <h3 className="font-headline-sm text-xl font-bold text-rose-950">Access Restricted: Class Not Assigned</h3>
            <p className="text-xs sm:text-sm text-on-surface-variant leading-relaxed">
              You are not authorized to view student details or mark attendance for <strong className="text-primary">{selectedClass} - {selectedSection}</strong>.
            </p>
            <p className="text-[11px] text-on-surface-variant/80 italic">
              Your assigned class is <strong>{currentUser?.assigned_class || 'None'} - {currentUser?.assigned_section || 'None'}</strong>.
            </p>
          </div>
          {currentUser?.assigned_class && currentUser?.assigned_section && (
            <div className="pt-2">
              <button
                type="button"
                onClick={() => {
                  setSelectedClass(currentUser.assigned_class || 'Class 6');
                  setSelectedSection(currentUser.assigned_section || 'Section A');
                }}
                className="inline-flex items-center gap-2 bg-primary hover:bg-primary-hover text-white text-xs font-extrabold px-5 py-2.5 rounded-xl shadow-xs transition-all active:scale-95 cursor-pointer"
              >
                <ArrowRight className="w-4 h-4" />
                <span>Go to My Assigned Class</span>
              </button>
            </div>
          )}
        </div>
      ) : (
        <>
          <div className="flex border-b border-outline-variant gap-4 select-none mb-1">
            <button 
              onClick={() => setActiveTab('registry')}
          className={`pb-3 text-sm font-bold border-b-2 transition-all flex items-center gap-2 ${
            activeTab === 'registry' 
              ? 'border-primary text-primary font-extrabold pb-2.5' 
              : 'border-transparent text-on-surface-variant hover:text-primary'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Today's Daily Roll Call</span>
        </button>
        <button 
          onClick={() => setActiveTab('monthly')}
          className={`pb-3 text-sm font-bold border-b-2 transition-all flex items-center gap-2 ${
            activeTab === 'monthly' 
              ? 'border-primary text-primary font-extrabold pb-2.5' 
              : 'border-transparent text-on-surface-variant hover:text-primary'
          }`}
        >
          <Calendar className="w-4 h-4" />
          <span>Monthly Attendance Sheet</span>
        </button>
        <button 
          onClick={() => setActiveTab('timetable')}
          className={`pb-3 text-sm font-bold border-b-2 transition-all flex items-center gap-2 ${
            activeTab === 'timetable' 
              ? 'border-primary text-primary font-extrabold pb-2.5' 
              : 'border-transparent text-on-surface-variant hover:text-primary'
          }`}
        >
          <Calendar className="w-4 h-4" />
          <span>My Teaching Timetable</span>
        </button>
      </div>

      {activeTab === 'registry' ? (
        <>
          {/* Attendance Submission Status Banner */}
          <div className={`p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${statsColor} transition-colors`}>
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" />
              <div>
                <span className="text-xs font-extrabold uppercase tracking-widest block text-primary font-mono pb-0.5">Attendance Focus Indicator</span>
                <span className="text-sm font-bold text-on-surface">{statsLabel}</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {isClosedToday ? (
                <span className="text-xs bg-slate-500 text-white font-extrabold px-3 py-1.5 rounded-full flex items-center gap-1 shadow-sm">
                  ● SCHOOL CLOSED ON SELECTED DATE
                </span>
              ) : todaySubmitted ? (
                <span className="text-xs bg-emerald-600 text-white font-extrabold px-3 py-1.5 rounded-full flex items-center gap-1 shadow-sm">
                  <span className="w-2 h-2 bg-white rounded-full animate-ping"></span>
                  ● SUCCESS: SUBMITTED FOR THE DATE
                </span>
              ) : (
                <span className="text-xs bg-red-600 text-white font-extrabold px-3 py-1.5 rounded-full flex items-center gap-1 shadow-sm animate-pulse">
                  ● PENDING - NOT POSTED
                </span>
              )}
            </div>
          </div>

          {/* Today's Date and Holiday Configuration Bar */}
          <div className="bg-surface-container-low p-4 rounded-xl border border-outline-variant flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
            <div className="flex items-center gap-2 flex-wrap">
              <div className="bg-primary/10 text-primary p-1.5 rounded-lg">
                <Calendar className="w-4 h-4" />
              </div>
              <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                <span className="text-xs sm:text-sm font-bold text-on-surface">
                  Attendance Selection Date:
                </span>
                <input 
                  type="date"
                  value={attendanceDate}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val) setAttendanceDate(val);
                  }}
                  className="bg-white border border-outline-variant rounded-md px-2.5 py-1 text-xs sm:text-sm font-mono text-primary font-black tracking-wide focus:outline-none focus:ring-1 focus:ring-primary shadow-3xs"
                />
              </div>
              {(() => {
                // Check if today has a holiday override
                const hol = holidayOverrides[attendanceDate];
                if (hol) {
                  return (
                    <span className="text-xs bg-amber-100 text-amber-800 border border-amber-300 px-2.5 py-0.5 rounded-full font-extrabold ml-1 sm:ml-2">
                      🎉 HOLIDAY: {hol}
                    </span>
                  );
                }
                return null;
              })()}
            </div>
            <button 
              type="button"
              onClick={handleEditHolidayToday}
              className="flex items-center gap-1.5 bg-white border border-outline-variant hover:bg-slate-50 text-xs font-extrabold px-3.5 py-1.5 rounded-lg text-primary shadow-2xs transition-all hover:shadow-xs active:scale-95 cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Edit Holiday Status</span>
            </button>
          </div>



          {/* Bento Stats Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Total students */}
            <div className="bg-surface-container-lowest p-5 rounded-2xl shadow-xs border-l-4 border-primary">
              <div className="flex items-center justify-between text-on-surface-variant mb-1.5">
                <span className="text-xs font-bold uppercase tracking-wide">TOTAL</span>
                <Users className="w-4 h-4 text-primary" />
              </div>
              <div className="text-2xl md:text-3xl font-extrabold text-primary">{statsTotal.toString().padStart(2, '0')}</div>
              <div className="text-xs text-on-surface-variant font-light">Enrolled Students</div>
            </div>

            {/* Present */}
            <div className="bg-surface-container-lowest p-5 rounded-2xl shadow-xs border-l-4 border-secondary">
              <div className="flex items-center justify-between text-on-surface-variant mb-1.5">
                <span className="text-xs font-bold uppercase tracking-wide">PRESENT</span>
                <CheckCircle className="w-4 h-4 text-secondary" />
              </div>
              <div className="text-2xl md:text-3xl font-extrabold text-secondary">{statsPresent.toString().padStart(2, '0')}</div>
              <div className="text-xs text-on-surface-variant font-light">Opted for meal</div>
            </div>

            {/* Absent */}
            <div className="bg-surface-container-lowest p-5 rounded-2xl shadow-xs border-l-4 border-red-600">
              <div className="flex items-center justify-between text-on-surface-variant mb-1.5">
                <span className="text-xs font-bold uppercase tracking-wide">ABSENT</span>
                <XCircle className="w-4 h-4 text-red-600" />
              </div>
              <div className="text-2xl md:text-3xl font-extrabold text-red-600">{statsAbsent.toString().padStart(2, '0')}</div>
              <div className="text-xs text-on-surface-variant font-light">Absent counting</div>
            </div>

            {/* Attendance Ratio */}
            <div className="bg-surface-container-lowest p-5 rounded-2xl shadow-xs border-l-4 border-tertiary">
              <div className="flex items-center justify-between text-on-surface-variant mb-1.5">
                <span className="text-xs font-bold uppercase tracking-wide font-headline-sm">RATIO</span>
                <Percent className="w-4 h-4 text-tertiary" />
              </div>
              <div className="text-2xl md:text-3xl font-extrabold text-tertiary">{statsPercentage}%</div>
              <div className="text-xs text-on-surface-variant font-light">Current percentage</div>
            </div>
          </div>

          {/* Student Attendance Table */}
          <div className="bg-surface-container-lowest rounded-2xl shadow-xs border border-outline-variant overflow-hidden">
            {/* Table Toolbar */}
            <div className="px-6 py-4 bg-surface-container-low border-b border-outline-variant flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="relative max-w-sm w-full">
                <input 
                  type="text" 
                  placeholder="Search student..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="bg-white border border-outline-variant rounded-lg px-3 py-1.5 text-xs w-full focus:border-primary focus:outline-none"
                />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button 
                  onClick={() => handleMarkAll(true)}
                  className="text-xs font-extrabold text-secondary hover:text-white border border-secondary hover:bg-secondary px-3 py-1.5 rounded-full transition-all"
                >
                  Mark All Present
                </button>
                <button 
                  onClick={() => handleMarkAll(false)}
                  className="text-xs font-extrabold text-red-600 hover:text-white border border-red-600 hover:bg-red-600 px-3 py-1.5 rounded-full transition-all"
                >
                  Mark All Absent
                </button>
              </div>
            </div>

            {/* Real Student Table */}
            <div className="overflow-x-auto custom-scrollbar">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-surface-container-low/50 text-on-surface-variant font-bold text-xs uppercase tracking-wider border-b border-outline-variant">
                    <th className="px-6 py-4">Roll No.</th>
                    <th className="px-6 py-4">Student Name</th>
                    <th className="px-6 py-4">Gender</th>
                    <th className="px-6 py-4 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant">
                  {filteredStudents.length > 0 ? (
                    filteredStudents.map((s, idx) => (
                      <tr key={s.id} className="hover:bg-surface-container-low/30 transition-colors h-14">
                        <td className="px-6 py-4 font-bold text-primary font-mono text-sm">
                          {editingStudentId === s.id ? (
                            <input 
                              type="text" 
                              value={editRollNo}
                              onChange={e => setEditRollNo(e.target.value)}
                              className="bg-white border border-outline-variant rounded px-2 py-1 text-xs w-20 font-mono focus:outline-none focus:ring-1 focus:ring-primary text-on-surface"
                              placeholder="Roll No"
                              required
                            />
                          ) : (
                            s.rollNo || s.id
                          )}
                        </td>
                        <td className="px-6 py-4">
                          {editingStudentId === s.id ? (
                            <input 
                              type="text" 
                              value={editName}
                              onChange={e => setEditName(e.target.value)}
                              className="bg-white border border-outline-variant rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-primary text-on-surface w-full max-w-xs"
                              placeholder="Student Name"
                              required
                            />
                          ) : (
                            <div className="flex items-center gap-3">
                              <img 
                                src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${s.name}`} 
                                alt={s.name} 
                                className="w-8 h-8 rounded-full bg-surface-container border border-outline-variant"
                              />
                              <span className="font-semibold text-sm text-on-surface">{s.name}</span>
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4 text-xs font-medium text-on-surface-variant">
                          {editingStudentId === s.id ? (
                            <div className="flex items-center gap-2">
                              <select 
                                value={editGender}
                                onChange={e => setEditGender(e.target.value as 'Male' | 'Female')}
                                className="bg-white border border-outline-variant rounded px-1.5 py-1 text-xs focus:ring-1 focus:ring-primary text-on-surface"
                              >
                                <option value="Male">Male</option>
                                <option value="Female">Female</option>
                              </select>
                              <button 
                                onClick={() => handleSaveEdit(s.id)}
                                className="text-secondary p-1 hover:bg-secondary/10 rounded border border-outline-variant bg-white flex items-center justify-center cursor-pointer"
                                title="Save"
                              >
                                <Save className="w-4 h-4" />
                              </button>
                            </div>
                          ) : (
                            s.gender
                          )}
                        </td>
                        <td className="px-6 py-4 text-center">
                          {(() => {
                            const status = todayClickStatus[s.id];
                            if (status === 'P') {
                              return (
                                <button
                                  type="button"
                                  onClick={() => handleStatusClick(s.id)}
                                  className="px-4 py-1.5 rounded-full text-[10px] font-extrabold tracking-wider bg-emerald-600 text-white border border-emerald-700 hover:bg-emerald-700 shadow-2xs transition-all active:scale-95 cursor-pointer flex items-center justify-center gap-1 mx-auto"
                                  title="Click to mark as Absent"
                                >
                                  <Check className="w-3 h-3" />
                                  <span>PRESENT</span>
                                </button>
                              );
                            } else if (status === 'A') {
                              return (
                                <button
                                  type="button"
                                  onClick={() => handleStatusClick(s.id)}
                                  className="px-4 py-1.5 rounded-full text-[10px] font-extrabold tracking-wider bg-rose-600 text-white border border-rose-700 hover:bg-rose-700 shadow-2xs transition-all active:scale-95 cursor-pointer flex items-center justify-center gap-1 mx-auto animate-fade-in"
                                  title="Click to mark as Present"
                                >
                                  <Users className="w-3 h-3" />
                                  <span>ABSENT</span>
                                </button>
                              );
                            } else {
                              return (
                                <button
                                  type="button"
                                  onClick={() => handleStatusClick(s.id)}
                                  className="px-4 py-1.5 rounded-full text-[10px] font-extrabold tracking-wider bg-slate-100 text-slate-600 border border-slate-300 hover:bg-slate-200 shadow-3xs transition-all active:scale-95 cursor-pointer flex items-center justify-center gap-1 mx-auto font-medium"
                                  title="Unmarked. Click to mark as Present."
                                >
                                  <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-pulse"></span>
                                  <span>UNMARKED</span>
                                </button>
                              );
                            }
                          })()}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} className="text-center py-8 text-on-surface-variant text-sm font-light">
                        No students registered in this class/section matching query.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Floating Bottom Action Drawer */}
          <div className="bg-surface-container-lowest p-4 rounded-2xl border border-outline-variant shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex gap-2 items-center text-xs text-on-surface-variant">
              <Sparkles className="w-4 h-4 text-tertiary" />
              {isClosedToday ? (
                <span>Currently Registry: <strong>{selectedClass} - {selectedSection}</strong> • School Closed Today (No Attendance Required)</span>
              ) : (
                <span>Currently Registry: <strong>{selectedClass} - {selectedSection}</strong> • {totalStudents} Enrolled ({presentStudents} present)</span>
              )}
            </div>
            <button 
              onClick={handleSubmit}
              disabled={isClosedToday}
              className={`w-full md:w-auto font-extrabold text-sm py-2.5 px-8 rounded-lg shadow-sm transition-all focus:ring-2 flex items-center justify-center gap-2 ${
                isClosedToday 
                  ? "bg-slate-300 text-slate-500 cursor-not-allowed"
                  : "bg-primary hover:bg-primary-hover text-white focus:ring-primary/20 cursor-pointer"
              }`}
            >
              {isClosedToday ? "School Closed" : "Submit Attendance Roll"}
            </button>
          </div>
        </>
      ) : (
        /* Monthly Attendance Sheet View */
        <div className="space-y-4">
          <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant overflow-hidden shadow-xs">
            {/* Spreadsheet Header Toolbar */}
            <div className="p-4 bg-surface-container-low border-b border-outline-variant flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-4">
                {/* Month Picker */}
                <div>
                  <label className="block text-[10px] font-extrabold text-on-surface-variant uppercase tracking-wider mb-1">Select Month</label>
                  <select 
                    value={selectedMonth} 
                    onChange={e => setSelectedMonth(Number(e.target.value))}
                    className="bg-white border border-outline-variant rounded-lg px-3 py-1.5 text-xs focus:ring-1 focus:ring-primary focus:outline-none cursor-pointer font-bold text-on-surface"
                  >
                    {months.map((m, idx) => (
                      <option key={idx} value={idx}>{m}</option>
                    ))}
                  </select>
                </div>

                {/* Year Picker */}
                <div>
                  <label className="block text-[10px] font-extrabold text-on-surface-variant uppercase tracking-wider mb-1">Select Year</label>
                  <select 
                    value={selectedYear} 
                    onChange={e => setSelectedYear(Number(e.target.value))}
                    className="bg-white border border-outline-variant rounded-lg px-3 py-1.5 text-xs focus:ring-1 focus:ring-primary focus:outline-none cursor-pointer font-bold text-on-surface"
                  >
                    {years.map(y => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                </div>

                <div className="h-8 w-[1px] bg-outline-variant hidden md:block mt-4" />

                {/* Filter Sync Indicator */}
                <div className="flex flex-col justify-end h-full">
                  <span className="text-[10px] uppercase font-bold text-secondary">Registry Filter Synchronized:</span>
                  <span className="text-xs font-extrabold text-primary">{selectedClass} — {selectedSection}</span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2 w-full md:w-auto justify-end pt-2 md:pt-0">
                <button 
                  onClick={handleExportCSV}
                  className="flex items-center gap-1.5 bg-white border border-outline-variant hover:bg-slate-50 text-on-surface font-bold text-xs py-2 px-3.5 rounded-lg transition-colors shadow-2xs cursor-pointer"
                  title="Download Excel Sheet"
                >
                  <Download className="w-3.5 h-3.5 text-secondary" />
                  <span>Export Excel / CSV</span>
                </button>

                <button 
                  onClick={() => window.print()}
                  className="flex items-center gap-1.5 bg-primary hover:bg-primary-hover text-white font-bold text-xs py-2 px-3.5 rounded-lg transition-all cursor-pointer shadow-sm"
                  title="Print current window"
                >
                  <Printer className="w-4 h-4" />
                  <span>Print Sheet</span>
                </button>
              </div>
            </div>

            {/* Summary metrics of selected month */}
            <div className="grid grid-cols-3 gap-3 p-4 bg-surface-container-low/30 border-b border-outline-variant">
              <div className="bg-white px-4 py-3 rounded-xl border border-outline-variant flex flex-col justify-center shadow-2xs">
                <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wide">Working Days</span>
                <span className="text-base font-extrabold text-primary">{workingDaysCountForStats} / {workingDaysCount} Days</span>
                <span className="text-[9px] text-on-surface-variant block mt-0.5 font-bold leading-normal">
                  (Elapsed / Total Month)
                </span>
              </div>
              <div className="bg-white px-4 py-3 rounded-xl border border-outline-variant flex flex-col justify-center shadow-2xs">
                <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wide">Present Average</span>
                <span className="text-base font-extrabold text-secondary">
                  {(totalPresenceCounts / (workingDaysCountForStats || 1)).toFixed(1)} / {filteredStudents.length}
                </span>
              </div>
              <div className="bg-white px-4 py-3 rounded-xl border border-outline-variant flex flex-col justify-center shadow-2xs">
                <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wide">Month Attendance Rate</span>
                <span className="text-base font-extrabold text-tertiary">{monthlyAvgRate}%</span>
              </div>
            </div>

            {/* Horizontal Scrollable Table container with sticky headers */}
            <div className="overflow-x-auto overflow-y-visible custom-scrollbar">
              <div className="inline-block min-w-full align-middle">
                <table className="w-full text-left border-collapse min-w-[1240px]">
                  <thead>
                    <tr className="bg-surface-container-low/50 text-[10px] font-extrabold text-on-surface-variant uppercase border-b border-outline-variant">
                      {/* Sticky left index */}
                      <th className="sticky left-0 bg-surface-container-low z-20 border-r border-outline-variant px-3 py-3 w-12 text-center select-none shadow-[1px_0_3px_rgba(0,0,0,0.03)]">
                        No.
                      </th>
                      
                      {/* Sticky left name */}
                      <th className="sticky left-12 bg-surface-container-low z-20 border-r border-outline-variant px-4 py-3 w-48 shadow-[3px_0_3px_rgba(0,0,0,0.04)] select-none">
                        Student Name
                      </th>

                      {/* Dynamic Day columns */}
                      {daysInMonthArray.map(dayNum => {
                        const { dayLabel, isSunday, isToday } = getDayInfo(dayNum);
                        let thClass = "text-center px-1.5 py-2.5 border-r border-outline-variant w-11 select-none transition-colors ";
                        
                        if (isSunday) {
                          thClass += "bg-slate-100/70 text-slate-400";
                        } else if (isToday) {
                          thClass += "bg-amber-100 border-x border-amber-300 text-amber-950 font-extrabold cursor-pointer hover:bg-amber-200";
                        } else {
                          thClass += "hover:bg-surface-container-high/40 cursor-pointer hover:text-primary";
                        }

                        return (
                          <th 
                            key={dayNum} 
                            className={thClass}
                            onClick={() => !isSunday && handleEditHolidayForDay(dayNum)}
                            title={isSunday ? "Sunday" : `Day ${dayNum} - Click to set/clear Holiday`}
                          >
                            <div className="font-extrabold text-xs">{dayNum}</div>
                            <div className="text-[9px] font-bold tracking-widest leading-none mt-0.5">{dayLabel}</div>
                          </th>
                        );
                      })}

                      {/* Summary columns */}
                      <th className="px-3 py-3 font-extrabold text-xs text-center border-l-2 border-outline-variant bg-emerald-50/50 text-emerald-800">
                        Days Present
                      </th>
                      <th className="px-3 py-3 font-extrabold text-xs text-center border-r border-outline-variant bg-rose-50/50 text-rose-800">
                        Days Absent
                      </th>
                      <th className="px-3 py-3 font-extrabold text-xs text-center bg-tertiary/10 text-tertiary">
                        Percentage
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant">
                    {filteredStudents.length > 0 ? (
                      filteredStudents.map((student, idx) => {
                        // Pre-calculate statistics for this child dynamically on each state cycle
                        const stats = (() => {
                          let presentCount = 0;
                          let absentCount = 0;
                          daysInMonthArray.forEach(dayNum => {
                            const isSunday = getDayInfo(dayNum).isSunday;
                            const isHoliday = getHolidayForDay(dayNum) !== null;
                            if (isSunday || isHoliday) return;

                            const status = getStudentStatus(student, dayNum);
                            if (status === 'P') {
                              presentCount++;
                            } else if (status === 'A') {
                              absentCount++;
                            }
                          });
                          const total = presentCount + absentCount;
                          const pct = total > 0 ? ((presentCount / total) * 100).toFixed(1) + '%' : '0.0%';
                          return { presentCount, absentCount, pct };
                        })();

                        return (
                          <tr key={student.id} className="hover:bg-slate-50/50 transition-colors h-11 text-xs">
                            {/* Sticky index cell */}
                            <td className="sticky left-0 bg-white z-10 border-r border-outline-variant text-[11px] text-on-surface-variant font-bold text-center select-none shadow-[1px_0_3px_rgba(0,0,0,0.03)]">
                              {idx + 1}
                            </td>

                            {/* Sticky student name cell */}
                            <td className="sticky left-12 bg-white z-10 border-r border-outline-variant px-4 py-1.5 font-bold text-on-surface shadow-[3px_0_3px_rgba(0,0,0,0.04)] truncate shrink-0 max-w-[12rem]">
                              <span className="block truncate text-ellipsis max-w-[11.5rem]" title={student.name}>{student.name}</span>
                              <span className="block text-[8px] font-mono text-on-surface-variant font-light -mt-0.5 select-none">{student.rollNo || student.id}</span>
                            </td>

                            {/* Dynamic Status cells */}
                            {daysInMonthArray.map(dayNum => {
                              const { isSunday, isToday } = getDayInfo(dayNum);
                              const status = getStudentStatus(student, dayNum);

                              let cellClass = "p-1 text-center border-r border-outline-variant select-none transition-colors ";

                              if (isSunday) {
                                cellClass += "bg-slate-50/60";
                              } else if (isToday) {
                                cellClass += "bg-amber-50/60 border-x border-amber-200";
                              } else {
                                cellClass += "hover:bg-slate-50/40";
                              }

                              return (
                                <td 
                                  key={dayNum} 
                                  className={cellClass}
                                >
                                  {isSunday ? (
                                    <span className="text-[8px] font-extrabold text-slate-300">SUN</span>
                                  ) : (
                                    (() => {
                                      const isHoliday = getHolidayForDay(dayNum) !== null;
                                      const isHolidayChar = isHoliday && status !== 'SUN';
                                      if (isHolidayChar) {
                                        return (
                                          <span 
                                            className="w-5 h-5 rounded-md flex items-center justify-center font-extrabold mx-auto text-[10px] bg-amber-100 border border-amber-300 text-amber-800"
                                            title={`Holiday spelling module`}
                                          >
                                            {status}
                                          </span>
                                        );
                                      }
                                      if (!status) {
                                        return <span className="text-slate-300 text-[9px] font-light">—</span>;
                                      }
                                      return (
                                        <button 
                                          type="button"
                                          onClick={() => toggleStatusDirectly(student.id, dayNum)}
                                          className={`w-5 h-5 rounded-md flex items-center justify-center font-extrabold mx-auto transition-all cursor-pointer select-none text-[10px] ${
                                            status === 'P'
                                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-600 hover:text-white'
                                              : 'bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-600 hover:text-white'
                                          }`}
                                          title={`Click to mark ${status === 'P' ? 'Absent' : 'Present'}`}
                                        >
                                          {status}
                                        </button>
                                      );
                                    })()
                                  )}
                                </td>
                              );
                            })}

                            {/* Dynamic Live Statistics Columns */}
                            <td className="px-3 py-1.5 text-center font-extrabold text-emerald-700 bg-emerald-50/30 border-l-2 border-outline-variant select-none">
                              {stats.presentCount}
                            </td>
                            <td className="px-3 py-1.5 text-center font-extrabold text-rose-700 bg-rose-50/20 border-r border-outline-variant select-none">
                              {stats.absentCount}
                            </td>
                            <td className="px-3 py-1.5 text-center font-extrabold text-tertiary bg-tertiary/5 select-none font-mono">
                              {stats.pct}
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={2 + numDays + 3} className="text-center py-8 text-on-surface-variant text-sm font-light bg-white font-sans">
                          No students registered in this class/section matching query.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Dynamic Color Legend block */}
            <div className="p-4 bg-surface-container-low border-t border-outline-variant text-[11px] text-on-surface-variant flex flex-col sm:flex-row items-center justify-between gap-4 font-medium select-none">
              <div className="flex flex-wrap items-center gap-4">
                <span className="font-extrabold text-primary uppercase text-[10px] tracking-wider">Registry Key:</span>
                <div className="flex items-center gap-1.5">
                  <span className="w-5 h-5 bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-extrabold flex items-center justify-center rounded">P</span>
                  <span>Present</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-5 h-5 bg-rose-50 text-rose-700 border border-rose-200 text-[10px] font-extrabold flex items-center justify-center rounded">A</span>
                  <span>Absent</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-8 h-5 bg-slate-100 text-slate-400 text-[9px] font-extrabold flex items-center justify-center rounded uppercase">SUN</span>
                  <span>Sunday Holiday (Closed)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-5 h-5 bg-yellow-100 border border-yellow-300 rounded flex items-center justify-center"></span>
                  <span className="font-bold text-amber-950">Today's Column (Yellow Highlighted)</span>
                </div>
              </div>
              
              <div className="text-[10px] text-on-surface-variant italic font-semibold">
                💡 Tip: Click any student's P/A tile in the grid to instantly override!
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'timetable' && (
        <div className="bg-white rounded-2xl border border-outline-variant shadow-2xs p-6 space-y-6 animate-fade-in">
          <div className="border-b border-outline-variant pb-4">
            <h2 className="text-lg font-bold text-primary flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              My Weekly Teaching Schedule: {currentUser?.name}
            </h2>
            <p className="text-xs text-on-surface-variant">
              Class coordinator duties: <strong className="text-primary">{currentUser?.assigned_class ? `${currentUser.assigned_class}-${currentUser.assigned_section}` : 'None'}</strong> • Primary subject: <strong>{currentUser?.subject || 'N/A'}</strong>
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse border border-outline-variant text-xs text-center">
              <thead>
                <tr className="bg-surface-container border-b border-outline-variant text-secondary uppercase tracking-wider text-[10px] font-bold">
                  <th className="p-3 border border-outline-variant">Day</th>
                  <th className="p-3 border border-outline-variant">P1<div className="text-[9px] text-neutral-400 normal-case font-normal mt-0.5">{getPeriodTimes(1).start} - {getPeriodTimes(1).end}</div></th>
                  <th className="p-3 border border-outline-variant">P2<div className="text-[9px] text-neutral-400 normal-case font-normal mt-0.5">{getPeriodTimes(2).start} - {getPeriodTimes(2).end}</div></th>
                  <th className="p-3 border border-outline-variant bg-amber-50/40 text-amber-800 font-bold">Short Break<div className="text-[9px] text-amber-500/70 normal-case font-normal mt-0.5">10:25 - 10:40</div></th>
                  <th className="p-3 border border-outline-variant">P3<div className="text-[9px] text-neutral-400 normal-case font-normal mt-0.5">{getPeriodTimes(3).start} - {getPeriodTimes(3).end}</div></th>
                  <th className="p-3 border border-outline-variant">P4<div className="text-[9px] text-neutral-400 normal-case font-normal mt-0.5">{getPeriodTimes(4).start} - {getPeriodTimes(4).end}</div></th>
                  <th className="p-3 border border-outline-variant bg-amber-50/40 text-amber-800 font-bold">Lunch Break<div className="text-[9px] text-amber-500/70 normal-case font-normal mt-0.5">12:20 - 01:10</div></th>
                  <th className="p-3 border border-outline-variant">P5<div className="text-[9px] text-neutral-400 normal-case font-normal mt-0.5">{getPeriodTimes(5).start} - {getPeriodTimes(5).end}</div></th>
                  <th className="p-3 border border-outline-variant">P6<div className="text-[9px] text-neutral-400 normal-case font-normal mt-0.5">{getPeriodTimes(6).start} - {getPeriodTimes(6).end}</div></th>
                  <th className="p-3 border border-outline-variant">P7<div className="text-[9px] text-neutral-400 normal-case font-normal mt-0.5">{getPeriodTimes(7).start} - {getPeriodTimes(7).end}</div></th>
                </tr>
              </thead>
              <tbody>
                {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map(day => (
                  <tr key={day} className="hover:bg-neutral-50/50">
                    <td className="p-2 border border-outline-variant font-bold text-on-surface bg-surface-container-lowest text-center w-24">
                      {day}
                    </td>
                    {[1, 2].map(pNum => {
                      const entry = timetableEntries.find(e => 
                        e.day_of_week === day && 
                        e.period_number === pNum && 
                        e.teacher_id === currentUser?.name
                      );
                      const isFree = !entry || entry.subject === 'Free Period' || entry.teacher_id === 'None';
                      const classNameStr = isFree ? 'Free' : (entry.class && entry.section ? `${entry.class}-${entry.section}` : entry.subject);
                      const subjectStr = isFree ? '' : entry.subject;
                      
                      return (
                        <td 
                          key={pNum} 
                          className={`p-3 border border-outline-variant transition-all ${isFree ? 'bg-neutral-50/50 text-neutral-400' : 'bg-primary/5 font-semibold text-primary'}`}
                        >
                          <div className="font-bold text-sm">
                            {classNameStr}
                          </div>
                          {!isFree && subjectStr && subjectStr !== classNameStr && (
                            <div className="text-[10px] text-on-surface-variant font-medium mt-0.5">
                              {subjectStr}
                            </div>
                          )}
                        </td>
                      );
                    })}

                    {/* Short Break */}
                    <td className="p-3 border border-outline-variant bg-amber-50/20 text-amber-700 font-bold text-[10px] text-center italic select-none">
                      Short Break
                    </td>

                    {[3, 4].map(pNum => {
                      const entry = timetableEntries.find(e => 
                        e.day_of_week === day && 
                        e.period_number === pNum && 
                        e.teacher_id === currentUser?.name
                      );
                      const isFree = !entry || entry.subject === 'Free Period' || entry.teacher_id === 'None';
                      const classNameStr = isFree ? 'Free' : (entry.class && entry.section ? `${entry.class}-${entry.section}` : entry.subject);
                      const subjectStr = isFree ? '' : entry.subject;
                      
                      return (
                        <td 
                          key={pNum} 
                          className={`p-3 border border-outline-variant transition-all ${isFree ? 'bg-neutral-50/50 text-neutral-400' : 'bg-primary/5 font-semibold text-primary'}`}
                        >
                          <div className="font-bold text-sm">
                            {classNameStr}
                          </div>
                          {!isFree && subjectStr && subjectStr !== classNameStr && (
                            <div className="text-[10px] text-on-surface-variant font-medium mt-0.5">
                              {subjectStr}
                            </div>
                          )}
                        </td>
                      );
                    })}

                    {/* Lunch Break */}
                    <td className="p-3 border border-outline-variant bg-amber-50/20 text-amber-700 font-bold text-[10px] text-center italic select-none">
                      Lunch Break
                    </td>

                    {[5, 6, 7].map(pNum => {
                      const entry = timetableEntries.find(e => 
                        e.day_of_week === day && 
                        e.period_number === pNum && 
                        e.teacher_id === currentUser?.name
                      );
                      const isFree = !entry || entry.subject === 'Free Period' || entry.teacher_id === 'None';
                      const classNameStr = isFree ? 'Free' : (entry.class && entry.section ? `${entry.class}-${entry.section}` : entry.subject);
                      const subjectStr = isFree ? '' : entry.subject;
                      
                      return (
                        <td 
                          key={pNum} 
                          className={`p-3 border border-outline-variant transition-all ${isFree ? 'bg-neutral-50/50 text-neutral-400' : 'bg-primary/5 font-semibold text-primary'}`}
                        >
                          <div className="font-bold text-sm">
                            {classNameStr}
                          </div>
                          {!isFree && subjectStr && subjectStr !== classNameStr && (
                            <div className="text-[10px] text-on-surface-variant font-medium mt-0.5">
                              {subjectStr}
                            </div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
        </>
      )}

      {/* Absolute Overlay Dialog Portal matching EduMeal premium theme */}
      {dialogState.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-fade-in" id="custom-dialog-overlay">
          <div className="bg-white rounded-2xl shadow-xl border border-outline-variant max-w-md w-full overflow-hidden animate-scale-up">
            <div className="p-6">
              <div className="flex items-start gap-4">
                <div className={`p-3 rounded-full flex-shrink-0 ${
                  dialogState.type === 'alert'
                    ? 'bg-amber-50 text-amber-600 border border-amber-200'
                    : dialogState.type === 'prompt'
                    ? 'bg-primary/10 text-primary border border-primary/20'
                    : 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                }`}>
                  {dialogState.type === 'alert' ? (
                    <AlertTriangle className="w-6 h-6" />
                  ) : dialogState.type === 'prompt' ? (
                    <Calendar className="w-6 h-6" />
                  ) : (
                    <HelpCircle className="w-6 h-6" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-base font-extrabold text-on-surface tracking-tight leading-none mb-2 select-none">
                    {dialogState.title}
                  </h3>
                  <p className="text-xs font-semibold text-on-surface-variant leading-relaxed whitespace-pre-line select-none">
                    {dialogState.message}
                  </p>
                  
                  {dialogState.type === 'prompt' && (
                    <div className="mt-4">
                      <input
                        type="text"
                        value={dialogInput}
                        onChange={(e) => setDialogInput(e.target.value)}
                        className="w-full bg-white border border-outline-variant rounded-lg px-3 py-2 text-xs font-mono text-primary font-black focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary shadow-inner"
                        placeholder="e.g., NATIONAL HOLIDAY"
                        autoFocus
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
            
            <div className="bg-slate-50 px-6 py-4 flex items-center justify-end gap-2 border-t border-outline-variant">
              {dialogState.type !== 'alert' && (
                <button
                  type="button"
                  onClick={() => dialogState.onCancel?.()}
                  className="px-4 py-2 text-xs font-bold text-on-surface-variant hover:bg-slate-100 border border-outline-variant rounded-lg transition-all active:scale-95 cursor-pointer"
                >
                  {dialogState.type === 'prompt' ? 'Cancel' : 'No / Cancel'}
                </button>
              )}
              <button
                type="button"
                onClick={() => dialogState.onConfirm(dialogState.type === 'prompt' ? dialogInput : undefined)}
                className={`px-5 py-2 text-xs font-extrabold text-white rounded-lg transition-all active:scale-95 cursor-pointer shadow-3xs flex items-center gap-1.5 ${
                  dialogState.type === 'alert'
                    ? 'bg-amber-600 hover:bg-amber-700'
                    : dialogState.type === 'prompt'
                    ? 'bg-primary hover:bg-primary-hover'
                    : 'bg-emerald-600 hover:bg-emerald-700'
                }`}
              >
                {dialogState.type === 'alert' ? 'OK' : dialogState.type === 'prompt' ? 'Save' : 'Yes / Proceed'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
