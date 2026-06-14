import React, { useState } from 'react';
import { Student, AttendanceReport } from '../types';
import { 
  Users, CheckCircle, XCircle, Percent, Plus, Edit, Trash, 
  ArrowLeft, Save, Sparkles, Calendar, Printer, Download, RefreshCw, Check
} from 'lucide-react';
import { addStudent, updateStudent, deleteStudent } from '../services/db';

interface TeacherPortalProps {
  students: Student[];
  onUpdateStudents: (updatedStudents: Student[]) => void;
  onSubmitAttendance: (classStr: string, section: string, presentCount: number) => void;
  onBackToWelcome: () => void;
  attendanceReports?: AttendanceReport[];
}

export default function TeacherPortal({
  students,
  onUpdateStudents,
  onSubmitAttendance,
  onBackToWelcome,
  attendanceReports = []
}: TeacherPortalProps) {
  const [selectedClass, setSelectedClass] = useState<string>('Class 6');
  const [selectedSection, setSelectedSection] = useState<string>('Section A');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Tab navigation state: 'registry' | 'monthly'
  const [activeTab, setActiveTab] = useState<'registry' | 'monthly'>('registry');

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
  const [localSubmittedClassSectionDates, setLocalSubmittedClassSectionDates] = useState<{ [key: string]: boolean }>({});

  const getLocalTodayDate = () => {
    const d = new Date();
    const yr = d.getFullYear();
    const mo = String(d.getMonth() + 1).padStart(2, '0');
    const da = String(d.getDate()).padStart(2, '0');
    return `${yr}-${mo}-${da}`;
  };

  const todayDate = getLocalTodayDate();

  // Today click interaction status: e.g., { [studentId]: 'NOT_MARKED' | 'P' | 'A' }
  const [todayClickStatus, setTodayClickStatus] = useState<{ [key: string]: 'NOT_MARKED' | 'P' | 'A' }>(() => {
    try {
      const d = new Date();
      const yr = d.getFullYear();
      const mo = String(d.getMonth() + 1).padStart(2, '0');
      const da = String(d.getDate()).padStart(2, '0');
      const tDate = `${yr}-${mo}-${da}`;
      const saved = localStorage.getItem(`edumeal_click_status_${tDate}`);
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  const clickTimers = React.useRef<{ [key: string]: any }>({});

  const handleStatusClick = (studentId: string) => {
    if (clickTimers.current[studentId]) {
      // Double click / tap detected!
      clearTimeout(clickTimers.current[studentId]);
      delete clickTimers.current[studentId];
      // Set status to 'A' (Absent, Red)
      setTodayClickStatus(prev => {
        const updated = { ...prev, [studentId]: 'A' as const };
        localStorage.setItem(`edumeal_click_status_${todayDate}`, JSON.stringify(updated));
        return updated;
      });
      // change physical database student model
      onUpdateStudents(students.map(s => s.id === studentId ? { ...s, present: false } : s));
      updateStudent(studentId, { present: false });
    } else {
      // Single click / tap set timer
      clickTimers.current[studentId] = setTimeout(() => {
        delete clickTimers.current[studentId];
        // Set status to 'P' (Present, Green)
        setTodayClickStatus(prev => {
          const updated = { ...prev, [studentId]: 'P' as const };
          localStorage.setItem(`edumeal_click_status_${todayDate}`, JSON.stringify(updated));
          return updated;
        });
        // change physical database student model
        onUpdateStudents(students.map(s => s.id === studentId ? { ...s, present: true } : s));
        updateStudent(studentId, { present: true });
      }, 250); // wait 250ms
    }
  };

  const handleEditHolidayToday = () => {
    const isHolidayCo = window.confirm("Is today a holiday?");
    if (isHolidayCo) {
      const desc = window.prompt("Enter holiday Description (e.g., 'NEW YEAR'):", holidayOverrides[todayDate] || "NEW YEAR");
      if (desc && desc.trim()) {
        const cleanDesc = desc.trim().toUpperCase();
        const updated = { ...holidayOverrides, [todayDate]: cleanDesc };
        setHolidayOverrides(updated);
        localStorage.setItem('edumeal_holiday_overrides', JSON.stringify(updated));
        alert(`Today (${todayDate}) is set as a Holiday: "${cleanDesc}". This will spell out letters in the Monthly Attendance Sheet!`);
      }
    } else {
      // Remove holiday override for today
      const updated = { ...holidayOverrides };
      delete updated[todayDate];
      setHolidayOverrides(updated);
      localStorage.setItem('edumeal_holiday_overrides', JSON.stringify(updated));
      alert(`Today (${todayDate}) is marked as a standard working school day. This will be automatically included in working days!`);
    }
  };

  const handleEditHolidayForDay = (dayNum: number) => {
    const dStr = `${selectedYear}-${pad(selectedMonth + 1)}-${pad(dayNum)}`;
    const isHolidayCo = window.confirm(`Is Day ${dayNum} (${dStr}) a holiday?`);
    if (isHolidayCo) {
      const desc = window.prompt("Enter holiday Description (e.g., 'NEW YEAR'):", holidayOverrides[dStr] || "NEW YEAR");
      if (desc && desc.trim()) {
        const cleanDesc = desc.trim().toUpperCase();
        const updated = { ...holidayOverrides, [dStr]: cleanDesc };
        setHolidayOverrides(updated);
        localStorage.setItem('edumeal_holiday_overrides', JSON.stringify(updated));
        alert(`Day ${dayNum} (${dStr}) is set as a Holiday: "${cleanDesc}". This will spell out letters in the Monthly Attendance Sheet!`);
      }
    } else {
      // Remove holiday override
      const updated = { ...holidayOverrides };
      delete updated[dStr];
      setHolidayOverrides(updated);
      localStorage.setItem('edumeal_holiday_overrides', JSON.stringify(updated));
      alert(`Day ${dayNum} (${dStr}) is marked as a standard school working day. This will be automatically included in working days!`);
    }
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

  // Stats calculation matches interactive tap states
  const totalStudents = filteredStudents.length;
  const presentStudents = filteredStudents.filter(s => {
    const status = todayClickStatus[s.id];
    if (status === 'A') return false;
    // Unmarked & P are considered PRESENT by default before submission (Opted for meal starts at All Present)
    return true; 
  }).length;
  const absentStudents = totalStudents - presentStudents;
  const attendancePercentage = totalStudents > 0 ? ((presentStudents / totalStudents) * 100).toFixed(1) : '0.0';

  // Yesterday vs Today logic based on submitted reports
  const todayReport = attendanceReports.find(
    r => r.classStr === selectedClass && r.section === selectedSection && r.date === todayDate
  );

  const sortedPreviousReports = [...attendanceReports]
    .filter(r => r.classStr === selectedClass && r.section === selectedSection && r.date !== todayDate)
    .sort((a, b) => b.date.localeCompare(a.date));
  
  const yesterdayReport = sortedPreviousReports[0];
  const todaySubmitted = !!todayReport || !!localSubmittedClassSectionDates[`${selectedClass}_${selectedSection}_${todayDate}`];

  let statsTotal = totalStudents;
  let statsPresent = presentStudents;
  let statsAbsent = absentStudents;
  let statsPercentage = attendancePercentage;
  let statsLabel = "Today's Attendance (PENDING - NOT POSTED)";
  let statsColor = "border-red-500 bg-red-50/40 text-red-950";

  if (todaySubmitted) {
    statsTotal = todayReport ? todayReport.totalStudents : totalStudents;
    statsPresent = todayReport ? todayReport.totalPresent : presentStudents;
    statsAbsent = todayReport ? todayReport.totalAbsent : absentStudents;
    statsPercentage = todayReport ? todayReport.attendancePercentage.toFixed(1) : attendancePercentage;
    statsLabel = "Today's Attendance (Submitted Successfully)";
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
        localStorage.setItem(`edumeal_click_status_${todayDate}`, JSON.stringify(updated));
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
    // Collect active classroom students
    const classStudents = students.filter(s => s.class === selectedClass && s.section === selectedSection);
    
    // Any student who is explicitly marked 'A' is an absentee (unmarked starts as Present/Opted for meal)
    const absentees = classStudents.filter(s => {
      const status = todayClickStatus[s.id];
      return status === 'A';
    });

    const presentCount = classStudents.length - absentees.length;

    const absenteeRolls = absentees.length > 0
      ? absentees.map(s => s.rollNo ? `Roll No. ${s.rollNo} (${s.name})` : s.name).join('\n')
      : 'None (100% Attendance)';

    const msg = `Are you sure you want to submit today's attendance for ${selectedClass} - ${selectedSection}?\n\nAbsentees (Roll Numbers / Name):\n${absentees.length > 0 ? absenteeRolls : 'None (100% Attendance)'}\n\nClick 'OK' to post and update records, or 'Cancel' to hold as not posted.`;
    
    const confirmPost = window.confirm(msg);
    if (confirmPost) {
      try {
        // Post the attendance
        onSubmitAttendance(selectedClass, selectedSection, presentCount);

        // Update today's status: anyone marked 'P' or unmarked remains 'P', 'A' remains 'A'
        const updatedClickStatus = { ...todayClickStatus };
        
        // Immediately start updates for local and DB state
        const updatedStudentsList = students.map(s => {
          if (s.class === selectedClass && s.section === selectedSection) {
            const currentStatus = todayClickStatus[s.id];
            const isPresent = currentStatus !== 'A'; // Unmarked or 'P' means Present

            updatedClickStatus[s.id] = isPresent ? 'P' : 'A';
            
            // update student Firestore object
            updateStudent(s.id, { present: isPresent });
            return { ...s, present: isPresent };
          }
          return s;
        });

        setTodayClickStatus(updatedClickStatus);
        localStorage.setItem(`edumeal_click_status_${todayDate}`, JSON.stringify(updatedClickStatus));
        onUpdateStudents(updatedStudentsList);

        // Mark today as submitted locally to instantly update the monthly sheet and other components
        const submissionKey = `${selectedClass}_${selectedSection}_${todayDate}`;
        setLocalSubmittedClassSectionDates(prev => ({ ...prev, [submissionKey]: true }));

        alert(`Attendance for ${selectedClass} - ${selectedSection} posted successfully!\nPresent Count: ${presentCount} students.\nAbsentees: ${absentees.length}.`);
      } catch (err) {
        console.error('Failed to submit attendance roll:', err);
      }
    } else {
      alert(`Submission cancelled. Today's roll remains NOT POSTED.`);
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
    // Check automatic public holidays for June 2026 (index 5)
    if (selectedYear === 2026 && selectedMonth === 5) {
      if (dayNum === 5) return "BAKRID";
    }
    return null;
  };

  const getMaxVisibleDay = () => {
    const todayObj = new Date();
    if (selectedYear < todayObj.getFullYear()) {
      return numDays;
    }
    if (selectedYear === todayObj.getFullYear() && selectedMonth < todayObj.getMonth()) {
      return numDays;
    }
    if (selectedYear === todayObj.getFullYear() && selectedMonth === todayObj.getMonth()) {
      return todayObj.getDate();
    }
    return 0; // Future months are completely blank
  };

  const getMaxVisibleDayForStats = () => {
    const todayObj = new Date();
    if (selectedYear < todayObj.getFullYear()) {
      return numDays;
    }
    if (selectedYear === todayObj.getFullYear() && selectedMonth < todayObj.getMonth()) {
      return numDays;
    }
    if (selectedYear === todayObj.getFullYear() && selectedMonth === todayObj.getMonth()) {
      return todaySubmitted ? todayObj.getDate() : todayObj.getDate() - 1;
    }
    return 0; // Future months are completely blank
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

    // 3. Constraint: If today's attendance has not been submitted, then today's column must remain empty
    if (isToday && !todaySubmitted) {
      return '';
    }

    // 4. Check cell overrides
    const key = `${student.id}_${dStr}`;
    if (sheetOverrides[key]) {
      return sheetOverrides[key];
    }

    // 5. Today state checks
    if (isToday) {
      const clickStatus = todayClickStatus[student.id];
      if (clickStatus === 'P') return 'P';
      if (clickStatus === 'A') return 'A';
      return student.present ? 'P' : 'A';
    }

    // 6. Standard historical fallback based on hashes
    const reportForDate = attendanceReports.find(
      r => r.classStr === selectedClass && r.section === selectedSection && r.date === dStr
    );

    let threshold = 88;
    if (reportForDate) {
      threshold = (reportForDate.totalPresent / (reportForDate.totalStudents || 1)) * 100;
    }

    let hash = 0;
    const combined = student.id + dStr;
    for (let i = 0; i < combined.length; i++) {
      hash = combined.charCodeAt(i) + ((hash << 5) - hash);
    }
    const score = Math.abs(hash) % 100;
    return score < threshold ? 'P' : 'A';
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
        }
        totalCellEvaluated++;
      }
    });
  });

  const monthlyAvgRate = totalCellEvaluated > 0 
    ? ((totalPresenceCounts / totalCellEvaluated) * 100).toFixed(1)
    : '0.0';

  const handleExportCSV = () => {
    const headers = ["Serial No.", "Student Name", ...daysInMonthArray.map(d => `Day ${d}`)];
    const csvRows = [headers.join(",")];

    filteredStudents.forEach((student, idx) => {
      const rowData = [
        (idx + 1).toString(),
        student.name,
        ...daysInMonthArray.map(dayNum => {
          const status = getStudentStatus(student, dayNum);
          return status === 'SUN' ? 'SUNDAY' : status;
        })
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
          <span className="text-secondary font-extrabold uppercase tracking-widest text-xs">Today's Attendance</span>
          <h2 className="font-headline-lg text-2xl md:text-3xl font-bold text-primary mt-1">Classroom Registry</h2>
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
          <div className="flex items-end h-full">
            <button 
              onClick={() => setIsAddMode(!isAddMode)}
              className="flex items-center gap-1.5 bg-secondary hover:bg-secondary-hover text-white font-semibold text-xs py-2 px-3.5 rounded-lg transition-colors shadow-sm self-end"
            >
              <Plus className="w-4 h-4" />
              Add Student
            </button>
          </div>
        </div>
      </div>

      {/* View Tabs */}
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
              {todaySubmitted ? (
                <span className="text-xs bg-emerald-600 text-white font-extrabold px-3 py-1.5 rounded-full flex items-center gap-1 shadow-sm">
                  <span className="w-2 h-2 bg-white rounded-full animate-ping"></span>
                  ● SUCCESS: SUBMITTED FOR TODAY
                </span>
              ) : (
                <span className="text-xs bg-red-600 text-white font-extrabold px-3 py-1.5 rounded-full flex items-center gap-1 shadow-sm animate-pulse">
                  ● TODAY PENDING - NOT POSTED
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
              <span className="text-xs sm:text-sm font-bold text-on-surface">
                Today's Date: <span className="font-mono text-primary font-black tracking-wide ml-1 px-2 py-0.5 bg-white border border-outline-variant rounded-md">{todayDate}</span>
              </span>
              {(() => {
                // Check if today has a holiday override
                const hol = holidayOverrides[todayDate];
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

          {/* Add Student Bar */}
          {isAddMode && (
            <form onSubmit={handleAddStudent} className="bg-surface-container-low p-4 rounded-xl border border-outline-variant flex flex-wrap gap-4 items-center animate-fade-in">
              <div className="flex-1 min-w-[150px]">
                <label className="block text-xs font-bold text-on-surface-variant mb-1">Roll Number</label>
                <input 
                  type="text" 
                  placeholder="e.g. 6A01"
                  value={newStudentRollNo}
                  onChange={e => setNewStudentRollNo(e.target.value)}
                  className="bg-white border border-outline-variant rounded-lg px-3 py-1.5 text-sm w-full focus:ring-2 focus:ring-primary focus:outline-none"
                  required
                />
              </div>
              <div className="flex-[2] min-w-[200px]">
                <label className="block text-xs font-bold text-on-surface-variant mb-1">Full Name</label>
                <input 
                  type="text" 
                  placeholder="e.g. John Doe"
                  value={newStudentName}
                  onChange={e => setNewStudentName(e.target.value)}
                  className="bg-white border border-outline-variant rounded-lg px-3 py-1.5 text-sm w-full focus:ring-2 focus:ring-primary focus:outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-on-surface-variant mb-1">Gender</label>
                <select 
                  value={newStudentGender}
                  onChange={e => setNewStudentGender(e.target.value as 'Male' | 'Female')}
                  className="bg-white border border-outline-variant rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-primary focus:outline-none"
                >
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                </select>
              </div>
              <div className="flex gap-2 self-end pt-5 md:pt-0">
                <button 
                  type="submit" 
                  className="bg-primary hover:bg-primary-hover text-white text-xs font-bold px-4 py-2 rounded-lg"
                >
                  Confirm
                </button>
                <button 
                  type="button" 
                  onClick={() => setIsAddMode(false)}
                  className="bg-surface-container hover:bg-surface-container-high text-on-surface-variant text-xs font-bold px-3 py-2 rounded-lg"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}

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
                    <th className="px-6 py-4 text-right">Actions</th>
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
                                  title="Double-click to mark as Absent (Red) / Single tap to toggle"
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
                                  title="Single tap to mark as Present (Green)"
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
                                  title="Single tap -> Present (Green), Double-click -> Absent (Red)"
                                >
                                  <span className="w-1.5 h-1.5 bg-slate-400 rounded-full"></span>
                                  <span>UNMARKED</span>
                                </button>
                              );
                            }
                          })()}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2 text-on-surface-variant">
                            <button 
                              onClick={() => handleStartEdit(s)}
                              className="p-1 hover:bg-surface-container-high rounded text-primary hover:text-primary-hover"
                              title="Edit Details"
                            >
                              <Edit className="w-3.5 h-3.5" />
                            </button>
                            <button 
                              onClick={() => handleDeleteStudent(s.id)}
                              className="p-1 hover:bg-red-100 rounded text-red-600"
                              title="Remove Student"
                            >
                              <Trash className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="text-center py-8 text-on-surface-variant text-sm font-light">
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
              <span>Currently Registry: <strong>{selectedClass} - {selectedSection}</strong> • {totalStudents} Enrolled ({presentStudents} present)</span>
            </div>
            <button 
              onClick={handleSubmit}
              className="w-full md:w-auto bg-primary hover:bg-primary-hover text-white font-extrabold text-sm py-2.5 px-8 rounded-lg shadow-sm transition-all focus:ring-2 focus:ring-primary/20 flex items-center justify-center gap-2"
            >
              Submit Attendance Roll
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
                                      const isHolidayChar = status && status !== 'P' && status !== 'A' && status !== 'SUN';
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
    </div>
  );
}
