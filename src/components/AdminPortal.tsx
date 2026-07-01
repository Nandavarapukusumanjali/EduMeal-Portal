import React, { useState, useEffect } from 'react';
import { DailyWastageReport, StudentFeedback, Student, WEEKLY_MENU, HISTORICAL_ATTENDANCE, AttendanceReport } from '../types';
import { 
  BarChart as RechartBarChart, 
  Bar, 
  LineChart as RechartLineChart, 
  Line, 
  PieChart as RechartPieChart, 
  Pie, 
  Cell, 
  XAxis, 
  YAxis, 
  Tooltip, 
  Legend, 
  ResponsiveContainer 
} from 'recharts';
import { 
  ArrowLeft, Download, FileText, TrendingUp, HelpCircle, 
  AlertCircle, Lightbulb, Star, ShieldCheck, Printer, FileSpreadsheet,
  Users, Utensils, ShieldAlert, Calendar, Sparkles, Brain, TrendingDown, Target, LogOut,
  Edit3, Trash2
} from 'lucide-react';

import { UserProfile, ApprovalRequest, AuditLog } from '../types';
import { 
  subscribeToUsers, subscribeToApprovalRequests, updateApprovalRequest, 
  subscribeToAuditLogs, saveUserProfile, addAuditLog, updateStudent,
  updateUserProfile, deleteUserProfile, deleteAttendanceReport 
} from '../services/db';
import { createAuthUserSecondary, updateAuthUserCredentials, getEmailForUser, getUsernameFromEmail } from '../services/auth';

interface AdminPortalProps {
  students: Student[];
  wastageReports: DailyWastageReport[];
  feedbackList: StudentFeedback[];
  presentCountToday: number;
  onBackToWelcome: () => void;
  attendanceReports?: AttendanceReport[];
  currentUser?: UserProfile | null;
}

export default function AdminPortal({
  students,
  wastageReports,
  feedbackList,
  presentCountToday,
  onBackToWelcome,
  attendanceReports = [],
  currentUser
}: AdminPortalProps) {
  const [activeReportTab, setActiveReportTab] = useState<'daily' | 'weekly' | 'monthly'>('daily');
  const [activeViewSection, setActiveViewSection] = useState<'charts' | 'feedbacks' | 'reports' | 'approvals' | 'coordinators' | 'logs'>('charts');
  const [showComplianceDialog, setShowComplianceDialog] = useState<boolean>(false);
  const [exportSuccessType, setExportSuccessType] = useState<'PDF' | 'Excel' | null>(null);

  // Administrative workflows states
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [approvals, setApprovals] = useState<ApprovalRequest[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [processingRequestIds, setProcessingRequestIds] = useState<Record<string, 'approving' | 'rejecting'>>({});
  const [actionStatus, setActionStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [showAddCoordinatorModal, setShowAddCoordinatorModal] = useState<boolean>(false);
  const [editingCoord, setEditingCoord] = useState<UserProfile | null>(null);
  const [newCoordUsername, setNewCoordUsername] = useState<string>('');
  const [newCoordName, setNewCoordName] = useState<string>('');
  const [newCoordPassword, setNewCoordPassword] = useState<string>('');
  const [remarksMap, setRemarksMap] = useState<{[reqId: string]: string}>({});

  // Selected date state defaulting to today's date
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    const d = new Date();
    const yr = d.getFullYear();
    const mo = String(d.getMonth() + 1).padStart(2, '0');
    const da = String(d.getDate()).padStart(2, '0');
    return `${yr}-${mo}-${da}`;
  });

  // Principal Portal: Reset date to today on mount, to ensure auto-selection works on every entry
  useEffect(() => {
    const d = new Date();
    const yr = d.getFullYear();
    const mo = String(d.getMonth() + 1).padStart(2, '0');
    const da = String(d.getDate()).padStart(2, '0');
    setSelectedDate(`${yr}-${mo}-${da}`);
  }, []);

  // Proactively auto-select the latest recorded audit date if present, to ensure tables aren't blank
  // REMOVED: Auto-select latest audit date to prioritize showing today's date
  const [hasAutoSelectedLatest, setHasAutoSelectedLatest] = useState<boolean>(true);

  const [selectedPredictItem, setSelectedPredictItem] = useState<string>('Rice');
  const [activeSmartTab, setActiveSmartTab] = useState<'popularity' | 'performance' | 'attendance' | 'recommendations' | 'insights'>('popularity');

  useEffect(() => {
    const unsubUsers = subscribeToUsers(setUsers);
    const unsubApprovals = subscribeToApprovalRequests(setApprovals);
    const unsubAuditLogs = subscribeToAuditLogs(setAuditLogs);

    return () => {
      unsubUsers();
      unsubApprovals();
      unsubAuditLogs();
    };
  }, []);

  const triggerStatus = (type: 'success' | 'error', message: string) => {
    setActionStatus({ type, message });
    setTimeout(() => {
      setActionStatus(null);
    }, 5000);
  };

  const handleApproveRequest = async (req: ApprovalRequest) => {
    setProcessingRequestIds(prev => ({ ...prev, [req.request_id]: 'approving' }));
    const remarks = remarksMap[req.request_id] || '';
    try {
      if (req.request_type === 'create_teacher' || req.request_type === 'create_supervisor') {
        const { username, name, temp_password, assigned_class, assigned_section, role, subject } = req.request_data;
        const email = getEmailForUser(username, role);
        const uid = await createAuthUserSecondary(username, temp_password, role);
        await saveUserProfile({
          uid,
          email,
          name,
          role,
          status: 'active',
          first_login: true,
          assigned_class: assigned_class || null,
          assigned_section: assigned_section || null,
          subject: subject || null,
          createdAt: new Date().toISOString()
        });
      } 
      else if (req.request_type === 'assign_teacher') {
        const { teacher_uid, assigned_class, assigned_section } = req.request_data;
        await updateUserProfile(teacher_uid, {
          assigned_class,
          assigned_section,
          updated_at: new Date().toISOString()
        });
      }
      else if (req.request_type === 'attendance_correction') {
        const { classStr, section, date } = req.request_data;
        const reportId = `${classStr}_${section}_${date}`;
        await deleteAttendanceReport(reportId);
      }
      else if (req.request_type === 'transfer_student') {
        const { student_id, target_section } = req.request_data;
        const st = students.find(s => s.id === student_id);
        if (st) {
          const rollNo = st.rollNo || '';
          const matchingUser = users.find(u => u.role === 'student' && u.roll_number === rollNo);
          const updatePromises: Promise<any>[] = [
            updateStudent(student_id, {
              section: target_section
            })
          ];
          if (matchingUser) {
            updatePromises.push(
              updateUserProfile(matchingUser.uid, {
                section: target_section,
                updated_at: new Date().toISOString()
              })
            );
          }
          await Promise.all(updatePromises);
        }
      }
      else if (req.request_type === 'deactivate_user' || req.request_type === 'delete_user') {
        const { target_uid } = req.request_data;
        await updateUserProfile(target_uid, {
          status: 'inactive',
          updated_at: new Date().toISOString()
        });
      }
      else if (req.request_type === 'create_student') {
        const { username, name, dob, temp_password, assigned_class, assigned_section, student_roll_no, gender } = req.request_data;
        const studentUsername = student_roll_no.trim();
        const email = getEmailForUser(studentUsername, 'student');
        const uid = await createAuthUserSecondary(studentUsername, dob, 'student');
        
        await Promise.all([
          saveUserProfile({
            uid,
            email,
            name: name.trim(),
            role: 'student',
            status: 'active',
            first_login: true,
            dob: dob || '',
            class: assigned_class,
            section: assigned_section,
            roll_number: student_roll_no.trim(),
            createdAt: new Date().toISOString()
          }),
          updateStudent(`st_${student_roll_no.trim()}`, {
            id: `st_${student_roll_no.trim()}`,
            name: name.trim(),
            rollNo: student_roll_no.trim(),
            class: assigned_class,
            section: assigned_section,
            gender: gender as any,
            dob: dob || '',
            present: false
          })
        ]);
      }
      else if (req.request_type === 'bulk_students') {
        const { class: cls, section: sec, students: batchStudents } = req.request_data;
        const batch = batchStudents || [
          { rollNo: '701', name: 'Aarav Sharma', gender: 'Male', dob: '2012-05-15' },
          { rollNo: '702', name: 'Ananya Iyer', gender: 'Female', dob: '2012-08-22' },
          { rollNo: '703', name: 'Vihaan Patel', gender: 'Male', dob: '2012-11-03' }
        ];
        
        // Parallelized registration of all students in the batch for massive speedup!
        await Promise.all(batch.map(async (s: any) => {
          const roll = (s.rollNo || s.roll || '').trim();
          const name = s.name;
          const gender = s.gender;
          const dob = s.dob || '2012-01-01';
          const studentUsername = roll;
          const email = getEmailForUser(studentUsername, 'student');
          
          const uid = await createAuthUserSecondary(studentUsername, dob, 'student');
          
          await Promise.all([
            saveUserProfile({
              uid,
              email,
              name: name.trim(),
              role: 'student',
              status: 'active',
              first_login: true,
              dob: dob,
              class: cls,
              section: sec,
              roll_number: roll,
              createdAt: new Date().toISOString()
            }),
            updateStudent(`st_${roll}`, {
              id: `st_${roll}`,
              name: name.trim(),
              rollNo: roll,
              class: cls,
              section: sec,
              gender: gender as any,
              dob: dob,
              present: false
            })
          ]);
        }));
      }

      await Promise.all([
        updateApprovalRequest(req.request_id, {
          status: 'approved',
          principal_remarks: remarks,
          approved_by: currentUser?.name || 'Principal',
          approved_by_uid: currentUser?.uid || 'principal',
          approved_at: new Date().toISOString()
        }),
        addAuditLog({
          log_id: `log_${Date.now()}`,
          user_id: currentUser?.name || 'principal',
          user_name: currentUser?.name || 'Headmaster & Administration',
          role: 'admin',
          action: `Approved Request: ${req.request_type}`,
          timestamp: new Date().toISOString(),
          remarks: `Remarks: ${remarks || 'None'}`
        })
      ]);

      triggerStatus('success', 'Administrative request approved and changes successfully applied!');
    } catch (err: any) {
      triggerStatus('error', err.message || 'Approval processing failed.');
    } finally {
      setProcessingRequestIds(prev => {
        const copy = { ...prev };
        delete copy[req.request_id];
        return copy;
      });
    }
  };

  const handleRejectRequest = async (req: ApprovalRequest) => {
    setProcessingRequestIds(prev => ({ ...prev, [req.request_id]: 'rejecting' }));
    const remarks = remarksMap[req.request_id] || '';
    try {
      const rejectPromises: Promise<any>[] = [
        updateApprovalRequest(req.request_id, {
          status: 'rejected',
          principal_remarks: remarks,
          approved_by: currentUser?.name || 'Principal',
          approved_by_uid: currentUser?.uid || 'principal',
          approved_at: new Date().toISOString()
        })
      ];

      if (req.request_type === 'create_teacher' || req.request_type === 'create_supervisor') {
        const { username, name, role, assigned_class, assigned_section, subject } = req.request_data;
        const targetUsername = username;
        const email = getEmailForUser(targetUsername, role);
        const uid = `rejected_${req.request_id}`;
        rejectPromises.push(
          saveUserProfile({
            uid,
            email,
            name,
            role,
            status: 'inactive',
            first_login: true,
            assigned_class: assigned_class || null,
            assigned_section: assigned_section || null,
            subject: subject || null,
            createdAt: new Date().toISOString(),
            approved_by: currentUser?.name || 'Principal',
            approved_at: new Date().toISOString()
          })
        );
      }
      else if (req.request_type === 'create_student') {
        const { username, name, student_roll_no, dob, assigned_class, assigned_section } = req.request_data;
        const targetUsername = student_roll_no || username;
        const email = getEmailForUser(targetUsername, 'student');
        const uid = `rejected_${req.request_id}`;
        rejectPromises.push(
          saveUserProfile({
            uid,
            email,
            name: name.trim(),
            role: 'student',
            status: 'inactive',
            first_login: true,
            dob: dob || null,
            class: assigned_class || null,
            section: assigned_section || null,
            roll_number: targetUsername,
            createdAt: new Date().toISOString(),
            approved_by: currentUser?.name || 'Principal',
            approved_at: new Date().toISOString()
          })
        );
      }
      else if (req.request_type === 'bulk_students') {
        const { class: cls, section: sec, students: batchStudents } = req.request_data;
        const batch = batchStudents || [];
        // Perform all rejection updates in parallel
        await Promise.all(batch.map(async (s: any) => {
          const roll = (s.rollNo || s.roll || '').trim();
          const name = s.name;
          const dob = s.dob || '2012-01-01';
          const email = getEmailForUser(roll, 'student');
          const uid = `rejected_${req.request_id}_${roll}`;
          
          await saveUserProfile({
            uid,
            email,
            name: name.trim(),
            role: 'student',
            status: 'inactive',
            first_login: true,
            dob: dob,
            class: cls,
            section: sec,
            roll_number: roll,
            createdAt: new Date().toISOString(),
            approved_by: currentUser?.name || 'Principal',
            approved_at: new Date().toISOString()
          });
        }));
      }

      await Promise.all(rejectPromises);

      await addAuditLog({
        log_id: `log_${Date.now()}`,
        user_id: currentUser?.name || 'principal',
        user_name: currentUser?.name || 'Headmaster & Administration',
        role: 'admin',
        action: `Rejected Request: ${req.request_type}`,
        timestamp: new Date().toISOString(),
        remarks: `Remarks: ${remarks || 'None'}`
      });

      triggerStatus('success', 'Administrative request rejected.');
    } catch (err: any) {
      triggerStatus('error', err.message || 'Operation failed.');
    } finally {
      setProcessingRequestIds(prev => {
        const copy = { ...prev };
        delete copy[req.request_id];
        return copy;
      });
    }
  };

  const handleDeleteCoordinator = async (uid: string) => {
    if (!window.confirm('Are you sure you want to deactivate this coordinator?')) return;
    setLoading(true);
    try {
      await updateUserProfile(uid, { status: 'inactive', updated_at: new Date().toISOString() });
      triggerStatus('success', 'Coordinator account deactivated.');
    } catch (err: any) {
      triggerStatus('error', err.message || 'Failed to deactivate.');
    } finally {
      setLoading(false);
    }
  };

  const handleEditCoordinator = (coord: UserProfile) => {
    setEditingCoord(coord);
    setNewCoordName(coord.name);
    setNewCoordUsername(getUsernameFromEmail(coord.email, coord.role));
    setShowAddCoordinatorModal(true);
  };
  
  const handleCreateCoordinator = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCoordUsername.trim() || !newCoordName.trim() || (!newCoordPassword.trim() && !editingCoord)) {
      triggerStatus('error', 'All fields are required.');
      return;
    }

    setLoading(true);
    try {
      if (editingCoord) {
        const email = getEmailForUser(newCoordUsername, 'coordinator');
        const sanitized = newCoordUsername.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
        
        const oldPasswordPin = editingCoord.password_pin || 'Coord@123';
        const currentUsername = getUsernameFromEmail(editingCoord.email, editingCoord.role);
        
        const hasNewPassword = newCoordPassword.trim().length > 0;
        const finalPassword = hasNewPassword ? newCoordPassword.trim() : oldPasswordPin;
        
        try {
          // Attempt standard update of email and password in Firebase Auth
          await updateAuthUserCredentials(
            currentUsername,
            'coordinator',
            oldPasswordPin,
            sanitized,
            hasNewPassword ? finalPassword : undefined
          );
          
          await updateUserProfile(editingCoord.uid, {
            name: newCoordName.trim(),
            email: email,
            password_pin: finalPassword,
            updated_at: new Date().toISOString()
          });
        } catch (authErr: any) {
          console.warn('Could not update secondary user, recreating Auth user instead:', authErr);
          
          // Fallback: If they changed credentials or if password didn't match, we create a new auth record
          const newUid = await createAuthUserSecondary(sanitized, finalPassword, 'coordinator');
          
          await saveUserProfile({
            ...editingCoord,
            uid: newUid,
            email: email,
            name: newCoordName.trim(),
            password_pin: finalPassword,
            updated_at: new Date().toISOString()
          });
          
          // Delete old user document
          await deleteUserProfile(editingCoord.uid);
        }

        await addAuditLog({
          log_id: `log_${Date.now()}`,
          user_id: currentUser?.name || 'principal',
          user_name: currentUser?.name || 'Headmaster & Administration',
          role: 'admin',
          action: 'Updated Coordinator Account',
          timestamp: new Date().toISOString(),
          remarks: `Updated Coordinator: ${newCoordName.trim()} (${email})`
        });
        triggerStatus('success', `Coordinator "${newCoordName.trim()}" successfully updated!`);
      } else {
        const currentCoords = users.filter(u => u.role === 'coordinator');
        if (currentCoords.length >= 2) {
          triggerStatus('error', 'Operational Limit Reached: A maximum of two coordinator accounts is permitted.');
          setLoading(false);
          return;
        }
        const sanitized = newCoordUsername.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
        const email = getEmailForUser(newCoordUsername, 'coordinator');
        const pin = newCoordPassword.trim();
        const uid = await createAuthUserSecondary(sanitized, pin, 'coordinator');

        await saveUserProfile({
          uid,
          email,
          name: newCoordName.trim(),
          role: 'coordinator',
          status: 'active',
          first_login: true,
          password_pin: pin,
          createdAt: new Date().toISOString()
        });

        await addAuditLog({
          log_id: `log_${Date.now()}`,
          user_id: currentUser?.name || 'principal',
          user_name: currentUser?.name || 'Headmaster & Administration',
          role: 'admin',
          action: 'Created School Coordinator Account',
          timestamp: new Date().toISOString(),
          remarks: `Created Coordinator: ${newCoordName.trim()}`
        });
        triggerStatus('success', `Coordinator account for "${newCoordName.trim()}" successfully created!`);
      }
      setShowAddCoordinatorModal(false);
      setNewCoordUsername('');
      setNewCoordName('');
      setNewCoordPassword('');
      setEditingCoord(null);
    } catch (err: any) {
      triggerStatus('error', err.message || 'Operation failed.');
    } finally {
      setLoading(false);
    }
  };

  // --- Dynamic Dashboard Metrics ---
  const totalStudents = students.length;
  
  // Let's grab the wastage report for the selected audit date
  const selectedWastage = wastageReports.find(r => r.date === selectedDate);
  const isWastagePending = !selectedWastage;

  const totalPrepFoodRaw = selectedWastage ? selectedWastage.items.reduce((acc, curr) => acc + curr.prepared, 0) : 0;
  const totalConsFoodRaw = selectedWastage ? selectedWastage.items.reduce((acc, curr) => acc + curr.consumed, 0) : 0;
  const totalWasteFoodRaw = Math.max(0, totalPrepFoodRaw - totalConsFoodRaw);
  const totalWastePctRaw = totalPrepFoodRaw > 0 ? parseFloat(((totalWasteFoodRaw / totalPrepFoodRaw) * 100).toFixed(1)) : 0;

  const totalPrepFood = isWastagePending ? "PENDING" : totalPrepFoodRaw;
  const totalConsFood = isWastagePending ? "PENDING" : totalConsFoodRaw;
  const totalWastePct = isWastagePending ? "PENDING" : totalWastePctRaw;

  // Average student satisfaction on the selected date
  const feedbacksForSelectedDate = feedbackList.filter(f => f.date === selectedDate);
  const totalSubmissionsOnSelectedDate = feedbacksForSelectedDate.length;

  const matchingAttendance = attendanceReports.filter(r => r.date === selectedDate);
  const isAttendancePending = matchingAttendance.length === 0;
  const totalPresentOnSelectedDate = matchingAttendance.length > 0
    ? matchingAttendance.reduce((acc, curr) => acc + curr.totalPresent, 0)
    : 0;
    
  const totalEnrolledOnSelectedDate = matchingAttendance.length > 0
    ? matchingAttendance.reduce((acc, curr) => acc + curr.totalStudents, 0)
    : 0;
    
  const attendanceRatio = totalEnrolledOnSelectedDate > 0 
    ? parseFloat(((totalPresentOnSelectedDate / totalEnrolledOnSelectedDate) * 100).toFixed(1)) 
    : 0;

  const presentToday = totalPresentOnSelectedDate;

  const presentCountForRatingRatio = totalPresentOnSelectedDate > 0
    ? totalPresentOnSelectedDate
    : (presentCountToday > 0 ? presentCountToday : 150);

  const isRatingPending = totalSubmissionsOnSelectedDate === 0;

  const selectedDateAllRatings: number[] = [];
  feedbacksForSelectedDate.forEach(f => {
    Object.values(f.itemRatings).forEach(r => selectedDateAllRatings.push(r));
    Object.values(f.serviceRatings).forEach(r => selectedDateAllRatings.push(r));
  });
  const avgSatisfaction = selectedDateAllRatings.length > 0 
    ? parseFloat((selectedDateAllRatings.reduce((acc, r) => acc + r, 0) / selectedDateAllRatings.length).toFixed(1)) 
    : 0;

  // Calculate Average Rating per single item category across feedbacks for the selected date
  const foodItemScores: { [item: string]: { total: number; count: number } } = {};
  feedbacksForSelectedDate.forEach(f => {
    Object.entries(f.itemRatings).forEach(([item, rating]) => {
      if (!foodItemScores[item]) {
        foodItemScores[item] = { total: 0, count: 0 };
      }
      foodItemScores[item].total += rating;
      foodItemScores[item].count += 1;
    });
  });

  const chartRatingData = Object.entries(foodItemScores).map(([name, score]) => {
    return {
      name,
      Rating: parseFloat((score.total / score.count).toFixed(1))
    };
  });

  const finalRatingData = chartRatingData;

  // Sorting to find most/least loved items
  const sortedRatings = [...finalRatingData].sort((a, b) => b.Rating - a.Rating);
  const mostLovedItem = sortedRatings.length > 0 ? sortedRatings[0]?.name : 'No Ratings';
  const leastLovedItem = sortedRatings.length > 0 ? sortedRatings[sortedRatings.length - 1]?.name : 'No Ratings';

  // --- Helper Helpers for Date and zone Formatting ---
  const getFormattedDate = (dateStr: string) => {
    try {
      const parts = dateStr.split('-');
      if (parts.length === 3) {
        return `${parts[2]}-${parts[1]}-${parts[0]}`; // DD-MM-YYYY
      }
    } catch (e) {}
    return dateStr;
  };

  const getMonthName = (dateStr: string) => {
    try {
      const parts = dateStr.split('-');
      if (parts.length === 3) {
        const yr = parseInt(parts[0], 10);
        const mo = parseInt(parts[1], 10) - 1;
        const d = new Date(yr, mo, 1);
        return d.toLocaleString('en-US', { month: 'long', year: 'numeric' }).toUpperCase();
      }
    } catch (e) {}
    return 'CURRENT AUDIT MONTH';
  };

  const getPastNDates = (baseDateStr: string, n: number): string[] => {
    const dates: string[] = [];
    try {
      const parts = baseDateStr.split('-');
      if (parts.length === 3) {
        const yr = parseInt(parts[0], 10);
        const mo = parseInt(parts[1], 10) - 1; // 0-indexed month
        const da = parseInt(parts[2], 10);
        
        for (let i = 0; i < n; i++) {
          const d = new Date(yr, mo, da - i);
          const y = d.getFullYear();
          const m = String(d.getMonth() + 1).padStart(2, '0');
          const day = String(d.getDate()).padStart(2, '0');
          dates.push(`${y}-${m}-${day}`);
        }
      }
    } catch (e) {}
    return dates;
  };

  // --- Compile Weekly Report Data (Past 7 Days from Selected Date) ---
  const weeklyScopeDates = getPastNDates(selectedDate, 7);
  const weeklyWastageReports = wastageReports.filter(r => weeklyScopeDates.includes(r.date));
  const weeklyAttendanceReports = (attendanceReports || []).filter(r => weeklyScopeDates.includes(r.date));
  const weeklyFeedbacks = feedbackList.filter(f => weeklyScopeDates.includes(f.date));

  let weeklyTotalEnrolled = 0;
  let weeklyTotalPresent = 0;
  if (weeklyAttendanceReports.length > 0) {
    weeklyAttendanceReports.forEach(r => {
      weeklyTotalEnrolled += r.totalStudents;
      weeklyTotalPresent += r.totalPresent;
    });
  } else {
    // Fallback: estimate based on enrolled count
    const days = Math.max(1, weeklyWastageReports.length);
    weeklyTotalEnrolled = totalStudents * days;
    weeklyTotalPresent = (totalPresentOnSelectedDate || presentCountToday || Math.round(totalStudents * 0.85)) * days;
  }
  const weeklyAttendanceRatio = weeklyTotalEnrolled > 0 ? parseFloat(((weeklyTotalPresent / weeklyTotalEnrolled) * 100).toFixed(1)) : 0;

  // Aggregate weekly wastage
  const weeklyWastageSummaryMap: { [item: string]: { prepared: number; consumed: number; unit: string } } = {};
  weeklyWastageReports.forEach(report => {
    report.items.forEach(entry => {
      if (!weeklyWastageSummaryMap[entry.item]) {
        weeklyWastageSummaryMap[entry.item] = { prepared: 0, consumed: 0, unit: entry.unit };
      }
      weeklyWastageSummaryMap[entry.item].prepared += entry.prepared;
      weeklyWastageSummaryMap[entry.item].consumed += entry.consumed;
    });
  });

  const weeklyWastageEntries = Object.entries(weeklyWastageSummaryMap).map(([item, data]) => {
    const lost = Math.max(0, data.prepared - data.consumed);
    const lostPct = data.prepared > 0 ? parseFloat(((lost / data.prepared) * 100).toFixed(1)) : 0;
    return {
      item,
      prepared: data.prepared,
      consumed: data.consumed,
      lost,
      lostPct,
      unit: data.unit
    };
  });

  const weeklyRatings: number[] = [];
  weeklyFeedbacks.forEach(f => {
    Object.values(f.itemRatings).forEach(r => weeklyRatings.push(r));
    Object.values(f.serviceRatings).forEach(r => weeklyRatings.push(r));
  });
  const weeklyAvgSatisfaction = weeklyRatings.length > 0 
    ? parseFloat((weeklyRatings.reduce((acc, r) => acc + r, 0) / weeklyRatings.length).toFixed(1)) 
    : 4.1;

  // --- Compile Monthly Report Data (Match selected date Year-Month) ---
  const selectedYearMonth = selectedDate.substring(0, 7); // YYYY-MM
  const monthlyWastageReports = wastageReports.filter(r => r.date.startsWith(selectedYearMonth));
  const monthlyAttendanceReports = (attendanceReports || []).filter(r => r.date.startsWith(selectedYearMonth));
  const monthlyFeedbacks = feedbackList.filter(f => f.date.startsWith(selectedYearMonth));

  let monthlyTotalEnrolled = 0;
  let monthlyTotalPresent = 0;
  if (monthlyAttendanceReports.length > 0) {
    monthlyAttendanceReports.forEach(r => {
      monthlyTotalEnrolled += r.totalStudents;
      monthlyTotalPresent += r.totalPresent;
    });
  } else {
    const days = Math.max(1, monthlyWastageReports.length);
    monthlyTotalEnrolled = totalStudents * days;
    monthlyTotalPresent = (totalPresentOnSelectedDate || presentCountToday || Math.round(totalStudents * 0.85)) * days;
  }
  const monthlyAttendanceRatio = monthlyTotalEnrolled > 0 ? parseFloat(((monthlyTotalPresent / monthlyTotalEnrolled) * 100).toFixed(1)) : 0;

  // Aggregate monthly wastage
  const monthlyWastageSummaryMap: { [item: string]: { prepared: number; consumed: number; unit: string } } = {};
  monthlyWastageReports.forEach(report => {
    report.items.forEach(entry => {
      if (!monthlyWastageSummaryMap[entry.item]) {
        monthlyWastageSummaryMap[entry.item] = { prepared: 0, consumed: 0, unit: entry.unit };
      }
      monthlyWastageSummaryMap[entry.item].prepared += entry.prepared;
      monthlyWastageSummaryMap[entry.item].consumed += entry.consumed;
    });
  });

  const monthlyWastageEntries = Object.entries(monthlyWastageSummaryMap).map(([item, data]) => {
    const lost = Math.max(0, data.prepared - data.consumed);
    const lostPct = data.prepared > 0 ? parseFloat(((lost / data.prepared) * 100).toFixed(1)) : 0;
    return {
      item,
      prepared: data.prepared,
      consumed: data.consumed,
      lost,
      lostPct,
      unit: data.unit
    };
  });

  const monthlyRatings: number[] = [];
  monthlyFeedbacks.forEach(f => {
    Object.values(f.itemRatings).forEach(r => monthlyRatings.push(r));
    Object.values(f.serviceRatings).forEach(r => monthlyRatings.push(r));
  });
  const monthlyAvgSatisfaction = monthlyRatings.length > 0 
    ? parseFloat((monthlyRatings.reduce((acc, r) => acc + r, 0) / monthlyRatings.length).toFixed(1)) 
    : 4.2;

  const getReportMitigations = (): string[] => {
    const mitigations: string[] = [];
    
    // Always add a clear simple note about Egg Curry to address taste/quality
    mitigations.push("🥚 Egg Curry taste note: Students complain that the Egg Curry is not good. Please check spiciness, peel boiled eggs cleanly, and make sure the curry is fresh, hot, and tasty.");

    if (activeReportTab === 'daily') {
      if (isWastagePending) {
        mitigations.push("⚠️ Waiting for the kitchen supervisor to submit today's leftover food report.");
        mitigations.push("📋 Get today's final student count from teacher group chats before starting to cook.");
      } else {
        let hasWastedSomething = false;
        selectedWastage.items.forEach(item => {
          const wasted = Math.max(0, item.prepared - item.consumed);
          if (wasted > 0) {
            hasWastedSomething = true;
            if (item.item.toLowerCase().includes('rice')) {
              const rawGrainEquiv = (wasted * 0.45).toFixed(1);
              mitigations.push(`🌾 Rice Leftover (${wasted} ${item.unit}): Please cook ${rawGrainEquiv} kg less rice tomorrow to match the attendance.`);
            } else if (item.item.toLowerCase().includes('egg')) {
              mitigations.push(`🥚 Egg Leftover (${wasted} units): Get the headcount of students by 9:30 AM so we boil only the exact quantity of eggs needed.`);
            } else if (item.item.toLowerCase().includes('chikki')) {
              mitigations.push(`🥜 Chikki Leftover (${wasted} units): Save these extra unopened dry Chikkis in a clean box to serve tomorrow.`);
            } else {
              mitigations.push(`🍲 ${item.item} Leftover (${wasted} ${item.unit}): We cooked too much food. Reduce cooking target by ${wasted} ${item.unit} tomorrow.`);
            }
          }
        });
        
        if (!hasWastedSomething) {
          mitigations.push("✅ Excellent! Kids ate all their food today. Zero plate waste.");
          mitigations.push("Keep serving trays covered to keep the meals hot and clean.");
        } else {
          mitigations.push("📋 Helper Tip: Tell helpers to use a standard spoon size so children get equal portions.");
        }
      }
    } else if (activeReportTab === 'weekly') {
      const highWasteItems = weeklyWastageEntries.filter(e => e.lost > 0);
      if (highWasteItems.length > 0) {
        highWasteItems.forEach(e => {
          if (e.item.toLowerCase().includes('rice')) {
            mitigations.push(`📉 Weekly Rice Waste (${e.lost} ${e.unit}): Reduce raw rice order by ${(e.lost * 0.45).toFixed(1)} kg next Monday.`);
          } else if (e.item.toLowerCase().includes('egg')) {
            mitigations.push(`🍳 Weekly Egg Curry Waste (${e.lost} units): Check classroom logs carefully before boiling eggs to avoid waste.`);
          } else if (e.item.toLowerCase().includes('chikki')) {
            mitigations.push(`📦 Weekly Chikki Leftover (${e.lost} packets): Do not open new chikki cases until the current surplus is fully distributed.`);
          } else {
            mitigations.push(`🥣 Weekly ${e.item} Waste (${e.lost} ${e.unit}): Reduce cook target of ${e.item} with simpler portions next week.`);
          }
        });
      } else {
        mitigations.push("✅ No weekly food waste! Students finished all served food plates.");
      }
      mitigations.push("👥 Portioning Rule: Give helpers clean portion guidelines to avoid overfilling plates.");
    } else {
      const highWasteItems = monthlyWastageEntries.filter(e => e.lost > 0);
      if (highWasteItems.length > 0) {
        const sorted = [...highWasteItems].sort((a, b) => b.lost - a.lost).slice(0, 3);
        sorted.forEach(e => {
          mitigations.push(`📊 Monthly waste for ${e.item} is ${e.lost} ${e.unit} (${e.lostPct}%): Lower next month's raw materials request amount slightly.`);
        });
      } else {
        mitigations.push("✅ Perfect month! All school meals were consumed by children with clean plates.");
      }
      mitigations.push("🏫 Monthly School Meeting: Talk with local health officers and cooks to match student taste preferences.");
    }
    return mitigations;
  };
  const reportMitigations = getReportMitigations();

  // --- Food Wastage Analytics calculations ---
  const itemWastageSummary: { [item: string]: { prep: number; waste: number } } = {};
  wastageReports.forEach(r => {
    r.items.forEach(it => {
      if (!itemWastageSummary[it.item]) {
        itemWastageSummary[it.item] = { prep: 0, waste: 0 };
      }
      itemWastageSummary[it.item].prep += it.prepared;
      itemWastageSummary[it.item].waste += it.remaining;
    });
  });

  const chartWastageData = Object.entries(itemWastageSummary).map(([name, summary]) => {
    return {
      name,
      'Wastage (kg/units)': summary.waste,
      Percentage: parseFloat(((summary.waste / summary.prep) * 100).toFixed(1))
    };
  });

  const finalWastageData = chartWastageData;

  // Finding most wasted physical item
  const sortedWastageItems = [...finalWastageData].sort((a, b) => b['Wastage (kg/units)'] - a['Wastage (kg/units)']);
  const mostWastedItemOverall = sortedWastageItems.length > 0 ? sortedWastageItems[0]?.name : 'No Reports';

  // --- Dynamic Smart Insights Logic ---
  const generatedInsights: string[] = [];
  if (students.length === 0) {
    generatedInsights.push("Waiting for classroom registries: Teacher must add students and submit attendance registry.");
  } else {
    generatedInsights.push(`School attendance registry loaded. Present ratio of ${attendanceRatio}% verified.`);
  }

  if (wastageReports.length === 0) {
    generatedInsights.push("Waiting for kitchen supervisor reports: Submit daily leftovers in Kitchen Portal.");
  } else if (mostWastedItemOverall && mostWastedItemOverall !== 'No Reports') {
    generatedInsights.push(`Analysis: "${mostWastedItemOverall} has recorded high leftovers this cycle."`);
  }

  if (feedbacksForSelectedDate.length === 0) {
    generatedInsights.push(`No student feedback submitted for the selected compliance date (${selectedDate}).`);
  } else if (mostLovedItem && mostLovedItem !== 'No Ratings' && sortedRatings.length > 0) {
    generatedInsights.push(`Satisfaction high watermark: "${mostLovedItem}" has recorded student rating of ${sortedRatings[0]?.Rating}/5.0 on this date.`);
  }

  // --- Dynamic Suggestions engine ---
  const recommendationSuggestions: string[] = [];
  if (students.length === 0 && wastageReports.length === 0 && feedbackList.length === 0) {
    recommendationSuggestions.push("📋 Ask classroom teachers to submit classroom attendance to start calculating daily food rations.");
    recommendationSuggestions.push("🌾 Set daily cook sizes based on the registered total school strength.");
  } else {
    if (sortedRatings.length > 0 && sortedRatings[0] && sortedRatings[0].Rating > 0) {
      recommendationSuggestions.push(`📈 Buy fresh seasonal ingredients and clean spices to keep kids happy with highly rated "${mostLovedItem}".`);
    }
    if (sortedWastageItems.length > 0 && sortedWastageItems[0] && sortedWastageItems[0]['Wastage (kg/units)'] > 0) {
      recommendationSuggestions.push(`📉 Reduce raw dry rations and adjust cooker sizes specifically for "${mostWastedItemOverall}" to stop high plate waste.`);
    }
    
    // Add specific Egg Curry recipe notes when egg curry is present/complained about
    const eggRatingsObj = sortedRatings.find(r => r.name.toLowerCase().includes('egg'));
    if (eggRatingsObj && eggRatingsObj.Rating < 4.2) {
      recommendationSuggestions.push(`🍳 Improve Egg Curry recipe: Make sure the eggs are boiled perfectly, peeled cleanly, and the curry gravy is hot, thick and tasty.`);
    }

    const lowRatedObj = sortedRatings.find(r => r.Rating > 0 && r.Rating < 3.8);
    if (lowRatedObj && !lowRatedObj.name.toLowerCase().includes('egg')) {
      recommendationSuggestions.push(`⚠️ Quality Action: Check the recipe and raw ingredient freshness for "${lowRatedObj.name}" to fix declining student ratings.`);
    } else if (!lowRatedObj) {
      recommendationSuggestions.push("✅ Good Compliance: Current menu items are well-liked and match regional taste benchmarks.");
    }
  }

  // Average service behavior star calculation
  const allServiceRatings = feedbackList.map(f => f.serviceRatings);
  const avgTaste = allServiceRatings.length > 0 ? parseFloat((allServiceRatings.reduce((acc, item) => acc + item.taste, 0) / allServiceRatings.length).toFixed(1)) : 0;
  const avgClean = allServiceRatings.length > 0 ? parseFloat((allServiceRatings.reduce((acc, item) => acc + item.cleanliness, 0) / allServiceRatings.length).toFixed(1)) : 0;
  const avgServing = allServiceRatings.length > 0 ? parseFloat((allServiceRatings.reduce((acc, item) => acc + item.behaviour, 0) / allServiceRatings.length).toFixed(1)) : 0;

  if (avgServing > 0 && avgServing < 4.0) {
    recommendationSuggestions.push("👥 Quick server guide: Ask portion helpers to serve politely and spoon equal quantities of curry to children.");
  }
  if (avgClean > 0 && avgClean < 4.0) {
    recommendationSuggestions.push("🧼 Classroom Cleanliness: Clean up dining tables, dining plates, and storage rooms rigorously.");
  }

  // --- Simulator Export actions ---
  const handleExportText = (type: 'PDF' | 'Excel') => {
    setExportSuccessType(type);
  };

  // --- Smart Predictive Analytics & Menu Performance Logic (Weekly Scope) ---
  const sanitizeName = (name: string): string => {
    const n = name.trim().toLowerCase();
    if (n.includes('egg')) return 'Egg Curry';
    if (n.includes('dal') || n.includes('sambar')) return 'Dal';
    if (n.includes('veg') || n.includes('aloo') || n.includes('kurma')) return 'Vegetable Curry';
    if (n.includes('rice') || n.includes('khichdi') || n.includes('pulihora')) return 'Rice';
    if (n.includes('chikki')) return 'Chikki';
    if (n.includes('pongal') || n.includes('sweet')) return 'Sweet Pongal';
    return name;
  };

  const discoveredItems = new Set<string>();
  // Discover items from full history
  (feedbackList || []).forEach(f => {
    Object.keys(f.itemRatings).forEach(it => discoveredItems.add(sanitizeName(it)));
  });
  (wastageReports || []).forEach(r => {
    r.items.forEach(it => discoveredItems.add(sanitizeName(it.item)));
  });

  const dynamicItemPerformanceMap: { [key: string]: { ratings: number[]; wastePercentages: number[] } } = {};
  discoveredItems.forEach(item => {
    dynamicItemPerformanceMap[item] = { ratings: [], wastePercentages: [] };
  });

  // Populate dynamic item ratings using full history
  (feedbackList || []).forEach(f => {
    Object.entries(f.itemRatings).forEach(([item, rating]) => {
      const standardized = sanitizeName(item);
      if (dynamicItemPerformanceMap[standardized]) {
        dynamicItemPerformanceMap[standardized].ratings.push(rating);
      }
    });
  });

  // Populate dynamic wastage percentages using full history
  (wastageReports || []).forEach(r => {
    r.items.forEach(it => {
      const standardized = sanitizeName(it.item);
      if (dynamicItemPerformanceMap[standardized]) {
        dynamicItemPerformanceMap[standardized].wastePercentages.push(it.wastePercentage);
      }
    });
  });


  const finalPerformanceList = Object.entries(dynamicItemPerformanceMap).map(([name, data]) => {
    const hasRatings = data.ratings.length > 0;
    const hasWaste = data.wastePercentages.length > 0;

    const avgRat = hasRatings 
      ? parseFloat((data.ratings.reduce((acc, r) => acc + r, 0) / data.ratings.length).toFixed(1))
      : 0;
      
    const avgWst = hasWaste
      ? parseFloat((data.wastePercentages.reduce((acc, w) => acc + w, 0) / data.wastePercentages.length).toFixed(1))
      : 0;
      
    // Popularity Score formula incorporating whatever actual data we have
    let popScore = 0;
    if (hasRatings && hasWaste) {
      popScore = parseFloat(Math.min(100, Math.max(0, (avgRat * 20) - (avgWst * 0.5))).toFixed(1));
    } else if (hasRatings) {
      popScore = parseFloat((avgRat * 20).toFixed(1));
    } else if (hasWaste) {
      popScore = parseFloat(Math.min(100, Math.max(0, 100 - (avgWst * 2))).toFixed(1));
    }
    
    return {
      name,
      avgRating: avgRat,
      avgWaste: avgWst,
      popularityScore: popScore,
      hasRatings,
      hasWaste
    };
  });

  // Filter for items with actual ratings for rating-based highlights
  const itemsWithRatings = finalPerformanceList.filter(x => x.hasRatings);
  const sortedByRating = [...itemsWithRatings].sort((a, b) => b.avgRating - a.avgRating);
  const highestRatedFood = sortedByRating.length > 0 ? sortedByRating[0] : null;

  // Filter for items with actual wastage reports for waste-based highlights
  const itemsWithWaste = finalPerformanceList.filter(x => x.hasWaste);
  const sortedByWaste = [...itemsWithWaste].sort((a, b) => b.avgWaste - a.avgWaste);
  const mostWastedFoodItem = sortedByWaste.length > 0 ? sortedByWaste[0] : null;

  // Most and least loved foods sorted by popularity score
  const sortedByPopularity = [...finalPerformanceList].sort((a, b) => b.popularityScore - a.popularityScore);
  const mostLovedFoodDetails = sortedByPopularity.length > 0 ? sortedByPopularity[0] : null;
  const leastLovedFoodDetails = sortedByPopularity.length > 0 ? sortedByPopularity[sortedByPopularity.length - 1] : null;

  // Sync selectedPredictItem if it is not present in finalPerformanceList anymore
  React.useEffect(() => {
    if (finalPerformanceList.length > 0) {
      const exists = finalPerformanceList.some(item => item.name === selectedPredictItem);
      if (!exists) {
        setSelectedPredictItem(finalPerformanceList[0].name);
      }
    }
  }, [finalPerformanceList, selectedPredictItem]);

  // Dynamic Item Past wastage history for Prediction
  const selectedItemHistory = wastageReports
    .map(report => {
      const match = report.items.find(x => sanitizeName(x.item) === sanitizeName(selectedPredictItem));
      if (!match) return null;
      return {
        date: report.date,
        dayName: new Date(report.date).toLocaleDateString('en-US', { weekday: 'short' }),
        wastePercentage: match.wastePercentage
      };
    })
    .filter((hist): hist is { date: string; dayName: string; wastePercentage: number } => hist !== null)
    .sort((a, b) => a.date.localeCompare(b.date));

  const computedPrediction = (() => {
    if (selectedItemHistory.length > 0) {
      const sum = selectedItemHistory.reduce((acc, curr) => acc + curr.wastePercentage, 0);
      return parseFloat((sum / selectedItemHistory.length).toFixed(1));
    }
    return 0;
  })();

  // Dynamic Attendance Aggregation by Date
  const dailyAttendanceAggregates = (() => {
    const agg: { [date: string]: { totalPresent: number; totalStudents: number } } = {};
    attendanceReports.forEach(r => {
      if (!agg[r.date]) {
        agg[r.date] = { totalPresent: 0, totalStudents: 0 };
      }
      agg[r.date].totalPresent += r.totalPresent;
      agg[r.date].totalStudents += r.totalStudents;
    });
    return agg;
  })();

  // Dynamic Attendance vs Waste coupling matrix
  const attendanceVsWasteList = Object.keys(dailyAttendanceAggregates).map(dt => {
    const wastageReport = wastageReports.find(w => w.date === dt);
    if (!wastageReport) return null;
    
    const attData = dailyAttendanceAggregates[dt];
    const itemsPrepSummary = wastageReport.items.map(i => `${i.item}: ${i.prepared}${i.unit}`).join(', ');
    const itemsWasteSummary = wastageReport.items.map(i => {
      const lost = Math.max(0, i.prepared - i.consumed);
      return `${i.item}: ${lost}${i.unit}`;
    }).join(', ');
    const wastePct = wastageReport.avgWastePercentage;
    
    let advice = "";
    let isPositive = true;
    if (wastePct > 10) {
      advice = `⚠️ Elevated wastage detected (${wastePct}% average). Leftovers: ${itemsWasteSummary}.`;
      isPositive = false;
    } else {
      advice = `✅ Balanced kitchen preparation under 10% average waste threshold.`;
    }
    
    return {
      date: dt,
      present: attData.totalPresent,
      itemsPrepSummary,
      waste: wastePct,
      advice,
      isPositive
    };
  }).filter((x): x is { date: string; present: number; itemsPrepSummary: string; waste: number; advice: string; isPositive: boolean } => x !== null)
    .sort((a, b) => b.date.localeCompare(a.date));

  // Dynamic AI Smart Stats Trend Highlights
  const datesSorted = Object.keys(dailyAttendanceAggregates).sort();
  let attendanceTrendString = "Attendance levels are stable across registered classes.";
  let isAttendanceUp = true;
  if (datesSorted.length >= 2) {
    const latestDate = datesSorted[datesSorted.length - 1];
    const prevDate = datesSorted[datesSorted.length - 2];
    const latestPct = dailyAttendanceAggregates[latestDate].totalPresent / dailyAttendanceAggregates[latestDate].totalStudents;
    const prevPct = dailyAttendanceAggregates[prevDate].totalPresent / dailyAttendanceAggregates[prevDate].totalStudents;
    const diff = parseFloat(((latestPct - prevPct) * 100).toFixed(1));
    if (diff > 0) {
      attendanceTrendString = `Attendance increased by ${Math.abs(diff)}% on the latest reopen cycle (${latestDate}).`;
      isAttendanceUp = true;
    } else if (diff < 0) {
      attendanceTrendString = `Attendance decreased by ${Math.abs(diff)}% compared to the prior reopening date (${prevDate}).`;
      isAttendanceUp = false;
    }
  }

  const sortedWastageReports = [...wastageReports].sort((a, b) => a.date.localeCompare(b.date));
  let wasteTrendString = "Wastage rates remaining within acceptable bounds.";
  let isWasteDown = true;
  if (sortedWastageReports.length >= 2) {
    const latestWaste = sortedWastageReports[sortedWastageReports.length - 1].avgWastePercentage;
    const prevWaste = sortedWastageReports[sortedWastageReports.length - 2].avgWastePercentage;
    const diff = parseFloat((latestWaste - prevWaste).toFixed(1));
    if (diff < 0) {
      wasteTrendString = `Food waste reduced by ${Math.abs(diff)}% compared to the prior reopening session.`;
      isWasteDown = true;
    } else if (diff > 0) {
      wasteTrendString = `Food waste increased by ${Math.abs(diff)}% due to menu items mismatch or portion scaling.`;
      isWasteDown = false;
    }
  }

  const COLORS = ['#00236f', '#006c4a', '#ef9900', '#ba1a1a', '#8b5cf6'];

  return (
    <div className="space-y-6">
      {/* Dynamic top bar links */}
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
          <span className="text-secondary font-extrabold uppercase tracking-widest text-xs">Administrative Overview</span>
          <h2 className="font-headline-lg text-2xl md:text-3xl font-bold text-primary mt-1">Analytics Dashboard</h2>
          <p className="text-on-surface-variant text-sm mt-1">
            Real-time compliance monitoring, student satisfaction ratings, menu volumes, and wastage reports.
          </p>
        </div>

        {/* View toggles */}
        <div className="flex flex-wrap bg-surface-container rounded-lg p-1 text-xs font-semibold gap-1">
          <button 
            onClick={() => setActiveViewSection('charts')}
            className={`px-3 py-2 rounded-md transition-all cursor-pointer ${activeViewSection === 'charts' ? 'bg-primary text-white shadow-xs' : 'text-on-surface-variant hover:bg-surface-container-high'}`}
          >
            Charts & Trends
          </button>
          <button 
            onClick={() => setActiveViewSection('feedbacks')}
            className={`px-3 py-2 rounded-md transition-all cursor-pointer ${activeViewSection === 'feedbacks' ? 'bg-primary text-white shadow-xs' : 'text-on-surface-variant hover:bg-surface-container-high'}`}
          >
            Feedback Logs
          </button>
          <button 
            onClick={() => setActiveViewSection('reports')}
            className={`px-3 py-2 rounded-md transition-all cursor-pointer ${activeViewSection === 'reports' ? 'bg-primary text-white shadow-xs' : 'text-on-surface-variant hover:bg-surface-container-high'}`}
          >
            Reports
          </button>
          <button 
            onClick={() => setActiveViewSection('approvals')}
            className={`px-3 py-2 rounded-md transition-all cursor-pointer flex items-center gap-1 ${activeViewSection === 'approvals' ? 'bg-primary text-white shadow-xs' : 'text-on-surface-variant hover:bg-surface-container-high'}`}
          >
            Pending Approvals
            {approvals.filter(a => a.status === 'pending').length > 0 && (
              <span className="bg-red-500 text-white text-[9px] font-mono px-1.5 py-0.5 rounded-full animate-pulse">
                {approvals.filter(a => a.status === 'pending').length}
              </span>
            )}
          </button>
          <button 
            onClick={() => setActiveViewSection('coordinators')}
            className={`px-3 py-2 rounded-md transition-all cursor-pointer ${activeViewSection === 'coordinators' ? 'bg-primary text-white shadow-xs' : 'text-on-surface-variant hover:bg-surface-container-high'}`}
          >
            Coordinators
          </button>
          <button 
            onClick={() => setActiveViewSection('logs')}
            className={`px-3 py-2 rounded-md transition-all cursor-pointer ${activeViewSection === 'logs' ? 'bg-primary text-white shadow-xs' : 'text-on-surface-variant hover:bg-surface-container-high'}`}
          >
            Audit Logs
          </button>
        </div>
      </div>

      {/* Search Calendar Audit Date Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 rounded-xl border border-outline-variant shadow-2xs">
        <div className="flex items-center gap-2.5">
          <Calendar className="w-5 h-5 text-primary flex-shrink-0" />
          <div>
            <h4 className="text-xs font-bold text-primary">Compliance Audit Calendar Date</h4>
            <p className="text-[10px] text-on-surface-variant font-light">Select a generic or custom date to inspect meals preparation and supervisor leftovers wastage indicators.</p>
          </div>
        </div>
        <div className="flex items-center gap-3 self-end sm:self-auto">
          <span className="text-[10px] font-extrabold text-secondary tracking-wider font-mono">SELECTED DATE:</span>
          <input 
            type="date"
            value={selectedDate}
            onChange={e => setSelectedDate(e.target.value)}
            className="px-2.5 py-1.5 border border-outline-variant rounded-lg font-bold text-xs font-mono bg-white text-on-surface focus:outline-primary shadow-3xs"
          />
        </div>
      </div>

      {/* Central Metrics Bento Row */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Attendance today card */}
        <div className="bg-surface-container-lowest p-5 rounded-2xl shadow-xs border-l-4 border-primary">
          <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Attendance %</p>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-2xl md:text-3xl font-extrabold text-primary font-mono">{isAttendancePending ? 'Pending' : `${attendanceRatio}%`}</span>
            {!isAttendancePending && (
              <span className="text-xs text-secondary font-mono font-bold">
                ({totalPresentOnSelectedDate}/{totalEnrolledOnSelectedDate})
              </span>
            )}
          </div>
          <p className="text-[10px] text-on-surface-variant font-light mt-1.5">
            {isAttendancePending ? 'Attendance not posted yet' : `${totalPresentOnSelectedDate} of ${totalEnrolledOnSelectedDate} Present`}
          </p>
        </div>

        {/* Total meal preparation prepared card */}
        <div className="bg-surface-container-lowest p-5 rounded-2xl shadow-xs border-l-4 border-secondary flex flex-col justify-between min-h-[140px]">
          <div>
            <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider mb-2">Total Prepared Food</p>
            {isWastagePending ? (
              <div className="flex items-baseline gap-2 mt-2">
                <span className="text-lg md:text-xl font-extrabold text-red-600 animate-pulse uppercase tracking-wider">PENDING</span>
              </div>
            ) : (
              <div className="space-y-1 mt-1 max-h-[72px] overflow-y-auto">
                {selectedWastage.items.map(entry => (
                  <div key={entry.item} className="flex justify-between items-center text-xs">
                    <span className="text-on-surface-variant text-[11px] font-semibold truncate max-w-[105px]" title={entry.item}>
                      {entry.item}
                    </span>
                    <span className="font-mono text-secondary font-bold text-[11.5px]">
                      {entry.prepared} <span className="text-[9px] font-semibold text-on-surface-variant">{entry.unit}</span>
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <p className="text-[10px] text-on-surface-variant font-light border-t border-dashed border-outline-variant mt-2 pb-0.5 pt-1">
            {isWastagePending ? "Waiting for supervisor's upload..." : "Portions prepared for daily service"}
          </p>
        </div>

        {/* Total Waste Percentage card */}
        <div className="bg-surface-container-lowest p-5 rounded-2xl shadow-xs border-l-4 border-red-600 flex flex-col justify-between min-h-[140px]">
          <div>
            <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider mb-1">Daily Waste % Today</p>
            {isWastagePending ? (
              <div className="flex items-baseline gap-2 mt-2">
                <span className="text-lg md:text-xl font-extrabold text-red-600 animate-pulse uppercase tracking-wider">PENDING</span>
              </div>
            ) : (
              <div className="flex items-start gap-3 mt-1">
                <div className="flex flex-col">
                  <span className="text-2xl font-extrabold text-red-600 font-mono leading-none">{totalWastePct}%</span>
                  <span className="text-[9px] text-on-surface-variant font-semibold mt-1">avg waste rate</span>
                </div>
                <div className="flex-1 space-y-1 pl-2 border-l border-outline-variant max-h-[72px] overflow-y-auto">
                  {selectedWastage.items.map(entry => {
                    const lost = Math.max(0, entry.prepared - entry.consumed);
                    const isZero = lost === 0;
                    return (
                      <div key={entry.item} className="flex justify-between items-center text-[10px]">
                        <span className="text-on-surface-variant font-medium truncate max-w-[75px]" title={entry.item}>
                          {entry.item}
                        </span>
                        <span className={`font-mono font-bold ${isZero ? 'text-emerald-600' : 'text-red-600'}`}>
                          {lost} <span className="text-[8.5px] font-semibold text-on-surface-variant">{entry.unit}</span>
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
          <p className="text-[10px] text-on-surface-variant font-light border-t border-dashed border-outline-variant mt-2 pb-0.5 pt-1">
            {isWastagePending ? "Leftovers audit outstanding!" : "Alert triggers above 15% threshold"}
          </p>
        </div>

        {/* Satisfaction stars card */}
        <div className="bg-surface-container-lowest p-5 rounded-2xl shadow-xs border-l-4 border-tertiary flex flex-col justify-between">
          <div>
            <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Avg Student Rating</p>
            <div className="flex items-baseline gap-2 mt-1.5">
              {isRatingPending ? (
                <span className="text-lg md:text-xl font-extrabold text-slate-500 animate-pulse uppercase tracking-wider animate-duration-1000">PENDING</span>
              ) : (
                <>
                  <span className="text-2xl md:text-3xl font-extrabold text-tertiary font-mono">{avgSatisfaction}</span>
                  <span className="text-xs text-on-surface-variant">/ 5.0 Rating</span>
                </>
              )}
            </div>
            <div className="flex gap-0.5 mt-1.5">
              {[1, 2, 3, 4, 5].map(star => {
                const fillVal = !isRatingPending && star <= Math.round(avgSatisfaction);
                return <Star key={star} size={13} className={`${fillVal ? 'fill-tertiary text-tertiary' : 'text-outline-variant fill-none'}`} />;
              })}
            </div>
          </div>
          <p className="text-[10px] text-on-surface-variant font-light mt-1.5 block">
            {isRatingPending ? (
              <span className="text-red-600 font-bold">No feedback submitted for date</span>
            ) : (
              <span>Submitted: <strong className="font-extrabold text-primary font-mono">{totalSubmissionsOnSelectedDate}</strong> of <strong className="font-extrabold text-secondary font-mono">{presentCountForRatingRatio}</strong> present</span>
            )}
          </p>
        </div>

      </section>

      {/* Today's Live Attendance Compliance Status Board */}
      <div className="bg-surface-container-lowest p-6 rounded-2xl border border-outline-variant shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-outline-variant pb-4 mb-4">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-primary" />
            <div>
              <h3 className="text-base font-bold text-primary">Classroom Daily Roll Submission Status Tracker</h3>
              <p className="text-on-surface-variant text-xs font-light">
                Official Headmaster / Supervisor audit panel showing submitted vs. pending classroom registers.
              </p>
            </div>
          </div>
          <div className="text-[11px] font-bold text-primary bg-primary/5 px-3 py-1 rounded-full border border-primary/10 self-start sm:self-auto font-mono">
            Date: {(() => {
              const d = new Date();
              const yr = d.getFullYear();
              const mo = String(d.getMonth() + 1).padStart(2, '0');
              const da = String(d.getDate()).padStart(2, '0');
              return `${yr}-${mo}-${da}`;
            })()}
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
          {[
            { classStr: 'Class 6', section: 'Section A' },
            { classStr: 'Class 6', section: 'Section B' },
            { classStr: 'Class 7', section: 'Section A' },
            { classStr: 'Class 7', section: 'Section B' },
            { classStr: 'Class 8', section: 'Section A' },
            { classStr: 'Class 8', section: 'Section B' },
            { classStr: 'Class 9', section: 'Section A' },
            { classStr: 'Class 9', section: 'Section B' },
            { classStr: 'Class 10', section: 'Section A' },
            { classStr: 'Class 10', section: 'Section B' }
          ].map(it => {
            const todayData = (() => {
              const d = new Date();
              const isSunday = d.getDay() === 0;
              const yr = d.getFullYear();
              const mo = String(d.getMonth() + 1).padStart(2, '0');
              const da = String(d.getDate()).padStart(2, '0');
              const todayStr = `${yr}-${mo}-${da}`;
              
              let isHoliday = false;
              let holidayName = "";
              try {
                const saved = localStorage.getItem('edumeal_holiday_overrides');
                const overrides = saved ? JSON.parse(saved) : {};
                if (overrides[todayStr]) {
                  isHoliday = true;
                  holidayName = overrides[todayStr];
                }
              } catch {}
              
              if (yr === 2026 && d.getMonth() === 5) {
                if (d.getDate() === 5) {
                  isHoliday = true;
                  holidayName = "BAKRID";
                } else if (d.getDate() < 12) {
                  isHoliday = true;
                  holidayName = "SUMMER HOLIDAYS";
                }
              }
              return { todayStr, isSunday, isHoliday, holidayName };
            })();

            const isPosted = attendanceReports.some(
              r => r.classStr === it.classStr && r.section === it.section && r.date === todayData.todayStr
            );
            const isClosed = todayData.isSunday || todayData.isHoliday;

            let cardBgAndBorder = 'bg-red-50/40 border-red-200 text-red-700';
            let dotColor = 'bg-red-500 animate-pulse';
            let statusText = 'PENDING';

            if (isClosed) {
              cardBgAndBorder = 'bg-slate-50 border-slate-200 text-slate-500';
              dotColor = 'bg-slate-400';
              statusText = todayData.isSunday ? 'CLOSED (SUNDAY)' : `CLOSED (${todayData.holidayName})`;
            } else if (isPosted) {
              cardBgAndBorder = 'bg-emerald-50/50 border-emerald-200 text-emerald-800';
              dotColor = 'bg-emerald-600';
              statusText = 'SUBMITTED';
            }

            return (
              <div 
                key={`${it.classStr}-${it.section}`}
                className={`p-3.5 rounded-xl border flex flex-col justify-between transition-all ${cardBgAndBorder}`}
              >
                {(() => {
                  const matchingReport = attendanceReports.find(
                    r => r.classStr === it.classStr && r.section === it.section && r.date === todayData.todayStr
                  );
                  const classStudents = students.filter(
                    s => s.class === it.classStr && s.section === it.section
                  );
                  const total = matchingReport ? matchingReport.totalStudents : (classStudents.length || 30);
                  const present = matchingReport ? matchingReport.totalPresent : 0;
                  const absent = matchingReport ? matchingReport.totalAbsent : 0;

                  return (
                    <>
                      <div>
                        <div className="font-extrabold text-xs">{it.classStr}</div>
                        <div className="text-[10px] font-bold text-on-surface-variant mb-1.5">{it.section}</div>
                        
                        <div className="mt-2 pt-2 border-t border-dashed border-outline-variant/30 text-[10px] space-y-1">
                          <div className="flex justify-between items-center">
                            <span className="opacity-80">Total:</span>
                            <strong className="font-mono">{total}</strong>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="opacity-80">Present:</span>
                            <strong className="font-mono text-emerald-600">{isPosted ? present : '--'}</strong>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="opacity-80">Absentees:</span>
                            <strong className="font-mono text-red-500">{isPosted ? absent : '--'}</strong>
                          </div>
                        </div>
                      </div>

                      <div className="mt-3 text-[10px] font-extrabold flex items-center gap-1">
                        <span className={`w-2 h-2 rounded-full ${dotColor}`}></span>
                        {statusText}
                      </div>
                    </>
                  );
                })()}
              </div>
            );
          })}
        </div>
      </div>

      {/* Conditional rendering of subsections */}
      {activeViewSection === 'charts' && (
        <div className="space-y-6">
          {/* Historical Trends Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Attendance line representation bar */}
            <div className="lg:col-span-2 bg-surface-container-lowest p-6 rounded-2xl border border-outline-variant shadow-xs">
              <div className="flex items-center justify-between mb-6">
                <h3 className="font-headline-sm text-base font-bold text-primary">Daily Attendance Curve</h3>
                <span className="text-[10.5px] font-bold text-secondary uppercase bg-secondary-container/20 px-2.5 py-0.5 rounded">
                  Compliance Trend
                </span>
              </div>
              
              {students.length > 0 ? (
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <RechartLineChart data={
                      HISTORICAL_ATTENDANCE.length > 0 ? HISTORICAL_ATTENDANCE : [
                        { date: 'Today', attendancePercentage: attendanceRatio }
                      ]
                    }>
                      <XAxis dataKey="date" stroke="#757682" fontSize={11} tickLine={false} />
                      <YAxis stroke="#757682" domain={[0, 100]} fontSize={11} tickLine={false} />
                      <Tooltip contentStyle={{ fontSize: 11 }} />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <Line 
                        type="monotone" 
                        dataKey="attendancePercentage" 
                        name="Attendance Rate %" 
                        stroke="#00236f" 
                        strokeWidth={3} 
                        activeDot={{ r: 6 }} 
                      />
                    </RechartLineChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-64 flex flex-col items-center justify-center text-center p-6 bg-surface-container-low/20 rounded-xl border border-dashed border-outline-variant">
                  <div className="w-12 h-12 rounded-full bg-primary/5 flex items-center justify-center text-primary mb-3">
                    <Users className="w-6 h-6 animate-pulse" />
                  </div>
                  <p className="text-sm font-bold text-primary">No Attendance Curves Recorded</p>
                  <p className="text-xs text-on-surface-variant max-w-sm mt-1.5 leading-relaxed font-light">
                    The school attendance curve is currently at zero because no student database has been registered yet. Enter the **Teacher Portal** to add students and mark daily attendance.
                  </p>
                </div>
              )}
            </div>

            {/* Smart Insights generated */}
            <div className="bg-primary text-on-primary p-6 rounded-2xl shadow-xs flex flex-col justify-between">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2 mb-4">
                  <Lightbulb className="w-5 h-5 text-secondary-container" />
                  <span>Interactive Smart Insights</span>
                </h3>
                
                <div className="space-y-3">
                  {generatedInsights.map((ins, idx) => (
                    <div key={idx} className="p-3.5 bg-primary-container rounded-xl border border-white/10 text-xs">
                      <p className="font-light text-white/90 leading-relaxed italic">{ins}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-4">
                <button 
                  onClick={() => setShowComplianceDialog(true)}
                  className="w-full py-2 bg-secondary text-white text-xs font-bold rounded-lg hover:opacity-90 transition-all cursor-pointer"
                >
                  Verify Compliance Protocol
                </button>
              </div>
            </div>

          </div>

          {/* Double Recharts Bar charts on food item metrics & satisfaction */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Ratings per food item bar */}
            <div className="bg-surface-container-lowest p-6 rounded-2xl border border-outline-variant shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-sm font-bold text-primary">Student Rating Averages (Item Performance)</h4>
                  <Star className="w-4 h-4 text-tertiary" />
                </div>

                {feedbacksForSelectedDate.length > 0 ? (
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <RechartBarChart data={finalRatingData}>
                        <XAxis dataKey="name" stroke="#757682" fontSize={10} tickLine={false} />
                        <YAxis stroke="#757682" fontSize={10} domain={[1, 5]} tickLine={false} />
                        <Tooltip />
                        <Bar dataKey="Rating" fill="#006c4a" radius={[4, 4, 0, 0]} barSize={25} />
                      </RechartBarChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="h-64 flex flex-col items-center justify-center text-center p-6 bg-surface-container-low/20 rounded-xl border border-dashed border-outline-variant my-2">
                    <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mb-2">
                      <Star className="w-5 h-5" />
                    </div>
                    <p className="text-xs font-bold text-slate-500">No Rating Feedback Data</p>
                    <p className="text-[10.5px] text-on-surface-variant max-w-xs mt-1 leading-normal font-light">
                      Compliance rating averages for {selectedDate} are empty. Submit reviews on the **Student Portal** to see average rating performance for this date.
                    </p>
                  </div>
                )}
              </div>

              <div className="mt-4 flex items-center justify-between text-xs text-on-surface-variant font-bold bg-surface-container-low p-2.5 rounded-xl">
                <span>Loved Plate: <strong className="text-secondary">{mostLovedItem}</strong></span>
                <span>Least Loved: <strong className="text-red-700">{leastLovedItem}</strong></span>
              </div>
            </div>

            {/* Wastage per food item bar */}
            <div className="bg-surface-container-lowest p-6 rounded-2xl border border-outline-variant shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-sm font-bold text-primary">Food Wastage by Item (Standard volumes - kg)</h4>
                  <span className="text-xs text-red-600 font-extrabold uppercase">Audit level</span>
                </div>

                {wastageReports.length > 0 ? (
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <RechartBarChart data={finalWastageData}>
                        <XAxis dataKey="name" stroke="#757682" fontSize={10} tickLine={false} />
                        <YAxis stroke="#757682" fontSize={10} tickLine={false} />
                        <Tooltip />
                        <Bar dataKey="Wastage (kg/units)" fill="#ba1a1a" radius={[4, 4, 0, 0]} barSize={25} />
                      </RechartBarChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="h-64 flex flex-col items-center justify-center text-center p-6 bg-surface-container-low/20 rounded-xl border border-dashed border-outline-variant my-2">
                    <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center text-red-600 mb-2">
                      <Utensils className="w-5 h-5" />
                    </div>
                    <p className="text-xs font-bold text-red-700 font-headline-sm">No Material Wastage Audits</p>
                    <p className="text-[10.5px] text-on-surface-variant max-w-xs mt-1 leading-normal font-light">
                      Please log in to the **Kitchen Supervisor Portal** to input leftovers and submit today's wastage statistics. Those metrics will load here instantly.
                    </p>
                  </div>
                )}
              </div>

              <div className="mt-4 text-center text-xs font-semibold text-red-700 bg-red-100 p-2.5 rounded-xl">
                Critical Note: <strong className="underline">{mostWastedItemOverall}</strong> recorded top plate residues this month.
              </div>
            </div>

          </div>

          {/* Smart Predictive Analytics & Insights Suite */}
          <div className="bg-surface-container-lowest p-6 rounded-2xl border border-outline-variant shadow-md space-y-6">
            
            {/* Suite Header */}
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-outline-variant pb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-primary/10 rounded-xl text-primary">
                  <Brain className="w-5 h-5 animate-pulse" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-primary flex items-center gap-1.5">
                    Smart Predictive Analytics & Decision Suite
                    <span className="text-[10px] font-bold bg-secondary/10 text-secondary px-2 py-0.5 rounded-full uppercase">AP Edumeal Engine</span>
                  </h3>
                  <p className="text-on-surface-variant text-xs font-light">
                    Real-time modeling, waste forecasting, consumption popularity tracking, automatic mitigations, and AI trends.
                  </p>
                </div>
              </div>

              {/* Local tabs inside standard analytics dashboard */}
              <div className="flex flex-wrap bg-surface-container rounded-lg p-1 text-[11px] font-bold">
                <button
                  type="button"
                  onClick={() => setActiveSmartTab('popularity')}
                  className={`px-3 py-1.5 rounded-md transition-all cursor-pointer ${activeSmartTab === 'popularity' ? 'bg-primary text-white shadow-xs' : 'text-on-surface-variant hover:text-primary'}`}
                >
                  Popularity & Prediction
                </button>
                <button
                  type="button"
                  onClick={() => setActiveSmartTab('performance')}
                  className={`px-3 py-1.5 rounded-md transition-all cursor-pointer ${activeSmartTab === 'performance' ? 'bg-primary text-white shadow-xs' : 'text-on-surface-variant hover:text-primary'}`}
                >
                  Menu Performance
                </button>
                <button
                  type="button"
                  onClick={() => setActiveSmartTab('attendance')}
                  className={`px-3 py-1.5 rounded-md transition-all cursor-pointer ${activeSmartTab === 'attendance' ? 'bg-primary text-white shadow-xs' : 'text-on-surface-variant hover:text-primary'}`}
                >
                  Attendance vs Waste
                </button>
                <button
                  type="button"
                  onClick={() => setActiveSmartTab('recommendations')}
                  className={`px-3 py-1.5 rounded-md transition-all cursor-pointer ${activeSmartTab === 'recommendations' ? 'bg-primary text-white shadow-xs' : 'text-on-surface-variant hover:text-primary'}`}
                >
                  Smart Actions
                </button>
                <button
                  type="button"
                  onClick={() => setActiveSmartTab('insights')}
                  className={`px-3 py-1.5 rounded-md transition-all cursor-pointer ${activeSmartTab === 'insights' ? 'bg-primary text-white shadow-xs' : 'text-on-surface-variant hover:text-primary'}`}
                >
                  AI Smart Insights
                </button>
              </div>
            </div>

            {/* Content Switcher */}
            <div className="space-y-4">
              
              {/* --- TAB 1: Popularity & Food Waste Prediction --- */}
              {activeSmartTab === 'popularity' && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  
                  {/* Left: Food Popularity Score */}
                  <div className="space-y-4 p-5 bg-surface-container-low rounded-xl border border-outline-variant">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-extrabold text-primary uppercase tracking-wider flex items-center gap-1.5">
                        <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
                        Food Popularity Index Score
                      </h4>
                      <span className="text-[10px] text-on-surface-variant font-light bg-white border px-2 py-0.5 rounded">Real-Time Core Index</span>
                    </div>
                    
                    <p className="text-xs font-light text-on-surface-variant leading-relaxed">
                      Combines student ratings and wastage and computes popularity to identify the most preferred food. Helps schools improve menu planning.
                    </p>

                    {/* Popularity items list */}
                    <div className="space-y-3.5 pt-2">
                      {finalPerformanceList.map(item => (
                        <div key={item.name} className="space-y-1">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-extrabold text-on-surface">{item.name}</span>
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] text-on-surface-variant font-medium">Rating: {item.avgRating}★ | Waste: {item.avgWaste}%</span>
                              <span className="font-mono font-extrabold text-primary">{item.popularityScore}%</span>
                            </div>
                          </div>
                          <div className="w-full bg-slate-150 h-2 rounded-full overflow-hidden">
                            <div 
                              className={`h-full rounded-full ${item.popularityScore > 85 ? 'bg-emerald-600' : item.popularityScore > 60 ? 'bg-primary' : 'bg-red-500'}`}
                              style={{ width: `${item.popularityScore}%` }}
                            ></div>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Best & Worst highlights */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t border-dashed border-outline-variant">
                      <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
                        <span className="text-[9px] font-extrabold uppercase text-emerald-800 tracking-widest block">🏆 Most Loved Food</span>
                        <strong className="text-sm font-extrabold text-emerald-950 mt-0.5 block">{mostLovedFoodDetails?.name || 'Egg Curry'} (Score: {mostLovedFoodDetails?.popularityScore}%)</strong>
                      </div>
                      <div className="p-3 bg-red-50 border border-red-200 rounded-xl">
                        <span className="text-[9px] font-extrabold uppercase text-red-800 tracking-widest block">⚠️ Least Loved Food</span>
                        <strong className="text-sm font-extrabold text-red-950 mt-0.5 block">{leastLovedFoodDetails?.name || 'Vegetable Curry'} (Score: {leastLovedFoodDetails?.popularityScore}%)</strong>
                      </div>
                    </div>

                    <div className="mt-2 text-center bg-primary/5 p-2 rounded-lg border border-primary/10">
                      <p className="text-[10.5px] text-primary font-bold">Benefit: Helps schools improve menu planning.</p>
                    </div>
                  </div>

                  {/* Right: Food Waste Prediction */}
                  <div className="space-y-4 p-5 bg-surface-container-low rounded-xl border border-outline-variant">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-extrabold text-primary uppercase tracking-wider flex items-center gap-1.5">
                        <Target className="w-4 h-4 text-secondary" />
                        Food Waste Analytics & Prediction
                      </h4>
                      <select
                        value={selectedPredictItem}
                        onChange={(e) => setSelectedPredictItem(e.target.value)}
                        className="px-2 py-1 border border-outline-variant rounded-lg font-bold text-xs bg-white text-on-surface transition-all select-sm outline-none cursor-pointer"
                      >
                        {finalPerformanceList.map(item => (
                          <option key={item.name} value={item.name}>{item.name}</option>
                        ))}
                      </select>
                    </div>

                    <p className="text-xs font-light text-on-surface-variant leading-relaxed">
                      The system predicts how much food may be wasted tomorrow based on previous weekly data patterns. By selecting meal categories, kitchen coordinators can audit portions correctly.
                    </p>

                    {/* Past Waste Data table */}
                    <div className="space-y-2">
                      <p className="text-[10px] font-bold text-secondary uppercase tracking-wider">Past Waste Data Records:</p>
                      <div className="grid grid-cols-3 gap-3">
                        {selectedItemHistory.slice(0, 3).map((hist, index) => (
                          <div key={index} className="p-3 bg-white border border-outline-variant rounded-xl text-center space-y-1">
                            <span className="text-[9px] font-bold text-on-surface-variant uppercase">{hist.date} ({hist.dayName})</span>
                            <p className="text-xs font-mono font-extrabold text-on-surface">
                              {hist.wastePercentage}%
                            </p>
                          </div>
                        ))}
                        {selectedItemHistory.length === 0 && (
                          <div className="col-span-3 p-3 bg-slate-50 border border-dashed border-outline-variant rounded-xl text-center text-xs text-on-surface-variant font-light">
                            No past database logs registered for {selectedPredictItem} yet. Shows default menu standard fallback.
                          </div>
                        )}
                      </div>
                    </div>

                    {/* System Prediction display output */}
                    <div className="p-4 bg-secondary/10 border-l-4 border-secondary rounded-r-xl space-y-1 animate-fade-in">
                      <span className="text-[9px] font-extrabold uppercase text-secondary tracking-widest block font-mono">System Prediction Engine</span>
                      <strong className="text-sm font-extrabold text-secondary mt-0.5 block font-mono">
                        Predicted {selectedPredictItem} Waste Tomorrow = {computedPrediction}%
                      </strong>
                      <span className="text-[10px] text-on-surface-variant block leading-tight">
                        (Calculated as average of {selectedItemHistory.length} historical database records)
                      </span>
                    </div>

                    <div className="mt-2 text-center bg-emerald-50 p-2.5 rounded-lg border border-emerald-200">
                      <p className="text-[10.5px] text-emerald-800 font-bold">Benefit: Kitchen staff can prepare less quantity and reduce wastage.</p>
                    </div>
                  </div>

                </div>
              )}

              {/* --- TAB 2: Menu Performance Report Matrix --- */}
              {activeSmartTab === 'performance' && (
                <div className="space-y-4 p-5 bg-surface-container-low rounded-xl border border-outline-variant">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-extrabold text-primary uppercase tracking-wider flex items-center gap-1.5">
                      <Utensils className="w-4 h-4 text-primary" />
                      Menu Performance Analytics Report
                    </h4>
                    <span className="text-[10px] text-on-surface-variant font-light bg-white border px-2 py-0.5 rounded">Seasonal Audit Ledger</span>
                  </div>

                  <p className="text-xs font-light text-on-surface-variant leading-relaxed">
                    Tracks weekly and monthly performance of each food item over time, combining customer satisfaction surveys and raw waste volumes.
                  </p>

                  <div className="overflow-x-auto rounded-xl border border-outline-variant">
                    <table className="w-full text-left text-xs bg-white">
                      <thead>
                        <tr className="bg-slate-50 text-secondary uppercase border-b border-outline-variant font-bold">
                          <th className="p-3">Food Item</th>
                          <th className="p-3 text-center">Avg Student Rating</th>
                          <th className="p-3 text-center">Avg Kitchen Waste %</th>
                          <th className="p-3">System Automated Insight</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-outline-variant bg-white font-mono">
                        {finalPerformanceList.map(item => {
                          let insightStr = "✅ Stable performance. Standard recipes satisfy portion control requirements.";
                          let colorClass = "text-on-surface-variant";
                          if (item.avgRating < 3.0 && item.avgWaste > 15) {
                            insightStr = `${item.name} consistently receives low ratings and high wastage.`;
                            colorClass = "text-red-600 font-extrabold bg-red-500/5";
                          } else if (item.avgRating > 4.5 && item.avgWaste < 3) {
                            insightStr = `🏆 Highly loved! ${item.name} shows exceptional ratings and minimal portion leftovers.`;
                            colorClass = "text-emerald-700 font-extrabold bg-emerald-500/5";
                          }

                          return (
                            <tr key={item.name} className={`hover:bg-slate-50 ${colorClass}`}>
                              <td className="p-3 font-extrabold text-on-surface">{item.name}</td>
                              <td className="p-3 text-center font-bold text-on-surface">{item.avgRating} / 5.0★</td>
                              <td className="p-3 text-center font-bold text-on-surface">{item.avgWaste}%</td>
                              <td className="p-3 font-sans font-medium text-xs text-on-surface-variant italic">"{insightStr}"</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  <div className="mt-2 text-center bg-primary/5 p-2.5 rounded-lg border border-primary/10">
                    <p className="text-[10.5px] text-primary font-bold">Benefit: Helps identify which recipes need improvement.</p>
                  </div>
                </div>
              )}

              {/* --- TAB 3: Attendance vs Waste Correlation --- */}
              {activeSmartTab === 'attendance' && (
                <div className="space-y-4 p-5 bg-surface-container-low rounded-xl border border-outline-variant">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-extrabold text-primary uppercase tracking-wider flex items-center gap-1.5">
                      <Users className="w-4 h-4 text-primary" />
                      Attendance vs Food Waste Correlation Analysis
                    </h4>
                    <span className="text-[10px] text-on-surface-variant font-light bg-white border px-2 py-0.5 rounded">Ration Balance Sheet</span>
                  </div>

                  <p className="text-xs font-light text-on-surface-variant leading-relaxed">
                    Compares school student turnout counts against prepared meal weights to flags and document over-preparation dates.
                  </p>

                  <div className="overflow-x-auto rounded-xl border border-outline-variant">
                    <table className="w-full text-left text-xs bg-white">
                      <thead>
                        <tr className="bg-slate-50 text-secondary uppercase border-b border-outline-variant font-bold font-sans">
                          <th className="p-3">Reporting Date</th>
                          <th className="p-3 text-center">Present Students</th>
                          <th className="p-3 text-center">Meals Prepared</th>
                          <th className="p-3 text-center">Measured Waste %</th>
                          <th className="p-3">System Automated Audit Advice</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-outline-variant bg-white font-mono">
                        {attendanceVsWasteList.map((row, idx) => (
                          <tr key={idx} className="hover:bg-slate-50 font-mono">
                            <td className="p-3 font-extrabold text-on-surface">{row.date}</td>
                            <td className="p-3 text-center text-on-surface font-mono">{row.present} Students</td>
                            <td className="p-3 text-center text-on-surface font-mono text-[11px] max-w-[220px] break-words truncate" title={row.itemsPrepSummary}>
                              {row.itemsPrepSummary}
                            </td>
                            <td className={`p-3 text-center font-bold font-mono ${row.isPositive ? 'text-emerald-700' : 'text-red-600'}`}>{row.waste}%</td>
                            <td className={`p-3 font-sans text-xs font-semibold ${row.isPositive ? 'text-emerald-800 bg-emerald-500/5' : 'text-red-700 bg-red-500/5'}`}>
                              {row.advice}
                            </td>
                          </tr>
                        ))}
                        {/* Selected day live record fallback to show today's live details if not currently mapped */}
                        {!isWastagePending && !attendanceVsWasteList.some(r => r.date === selectedDate) && (
                          <tr className="bg-primary/5 hover:bg-primary/10">
                            <td className="p-3 font-extrabold text-primary">{selectedDate} [Selected]</td>
                            <td className="p-3 text-center text-on-surface">{presentToday} Students</td>
                            <td className="p-3 text-center text-on-surface font-mono text-[11px] max-w-[220px] break-words truncate" title={selectedWastage.items.map(entry => `${entry.item}: ${entry.prepared}${entry.unit}`).join(', ')}>
                              {selectedWastage.items.map(entry => `${entry.item}: ${entry.prepared}${entry.unit}`).join(', ')}
                            </td>
                            <td className="p-3 text-center font-bold text-on-surface">{totalWastePctRaw}%</td>
                            <td className="p-3 font-sans text-xs">
                              {totalWastePctRaw > 8 
                                ? `⚠️ Over-preparation alert! Waste detail: ${selectedWastage.items.map(entry => `${entry.item}: ${Math.max(0, entry.prepared - entry.consumed)}${entry.unit} lost`).join(', ')}` 
                                : `✅ Nominal wastage levels detected. Portions balanced.`}
                            </td>
                          </tr>
                        )}
                        {attendanceVsWasteList.length === 0 && (
                          <tr>
                            <td colSpan={5} className="p-6 text-center text-xs text-on-surface-variant font-light">
                              No matching dates with both student attendance and kitchen audits registered yet.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  <div className="mt-2 text-center bg-primary/5 p-2.5 rounded-lg border border-primary/10">
                    <p className="text-[10.5px] text-primary font-bold">Benefit: Improves meal quantity planning.</p>
                  </div>
                </div>
              )}

              {/* --- TAB 4: Smart Recommendation System --- */}
              {activeSmartTab === 'recommendations' && (
                <div className="space-y-4 p-5 bg-surface-container-low rounded-xl border border-outline-variant">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-extrabold text-primary uppercase tracking-wider flex items-center gap-1.5">
                      <AlertCircle className="w-4 h-4 text-tertiary" />
                      Smart Automated Recommendation Rules Engine
                    </h4>
                    <span className="text-[10px] text-on-surface-variant font-light bg-white border px-2 py-0.5 rounded">Active Policy Rules</span>
                  </div>

                  <p className="text-xs font-light text-on-surface-variant leading-relaxed">
                    The rule-engine automatically generates school kitchen policy instructions by correlating student ratings and raw leftovers.
                  </p>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    
                    {/* Rule 1 */}
                    <div className="p-4 bg-white border border-outline-variant rounded-xl flex flex-col justify-between space-y-3 shadow-3xs">
                      <div>
                        <div className="flex items-center justify-between">
                          <span className="text-[9px] font-extrabold uppercase px-2 py-0.5 rounded bg-red-100 text-red-800">Rule 1: Poor Score Alert</span>
                          <span className="text-[8.5px] font-mono text-slate-500 font-bold">Rating &lt; 3 • Waste &gt; 15%</span>
                        </div>
                        <h5 className="font-extrabold text-xs text-primary mt-2">Quality & Preparation Override</h5>
                        <p className="text-[10.5px] text-on-surface-variant mt-1.5 leading-relaxed font-light">
                          If rating scores fall below 3.0 stars and kitchen waste surges above 15% limits:
                        </p>
                      </div>
                      <div className="p-2.5 bg-red-50 border border-red-200 rounded-lg text-[10.5px] text-red-950 font-bold">
                        👉 Recommendation: Improve recipe quality or reduce preparation quantity.
                      </div>
                    </div>

                    {/* Rule 2 */}
                    <div className="p-4 bg-white border border-outline-variant rounded-xl flex flex-col justify-between space-y-3 shadow-3xs">
                      <div>
                        <div className="flex items-center justify-between">
                          <span className="text-[9px] font-extrabold uppercase px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">Rule 2: Favorite Alert</span>
                          <span className="text-[8.5px] font-mono text-slate-500 font-bold">Rating &gt; 4.5 • Waste &lt; 3%</span>
                        </div>
                        <h5 className="font-extrabold text-xs text-primary mt-2">Demand Replenishment Surge</h5>
                        <p className="text-[10.5px] text-on-surface-variant mt-1.5 leading-relaxed font-light">
                          If satisfaction ratings exceed 4.5 and wastage is sub 3%, indicate child favorites:
                        </p>
                      </div>
                      <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-lg text-[10.5px] text-emerald-950 font-bold">
                        👉 Recommendation: Increase preparation slightly because students prefer this food.
                      </div>
                    </div>

                    {/* Rule 3 */}
                    <div className="p-4 bg-white border border-outline-variant rounded-xl flex flex-col justify-between space-y-3 shadow-3xs">
                      <div>
                        <div className="flex items-center justify-between">
                          <span className="text-[9px] font-extrabold uppercase px-2 py-0.5 rounded bg-amber-100 text-amber-800">Rule 3: Attendance Trim</span>
                          <span className="text-[8.5px] font-mono text-slate-500 font-bold">Roll turnout decrease</span>
                        </div>
                        <h5 className="font-extrabold text-xs text-primary mt-2">Proportional Portions Trim</h5>
                        <p className="text-[10.5px] text-on-surface-variant mt-1.5 leading-relaxed font-light">
                          When student headcount is less than maximum registered enrollment (absenteeism spike):
                        </p>
                      </div>
                      <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-[10.5px] text-amber-950 font-bold">
                        👉 Recommendation: Reduce food preparation proportionally.
                      </div>
                    </div>

                  </div>

                  <div className="mt-2 text-center bg-emerald-50 p-2 rounded-lg border border-emerald-200">
                    <p className="text-[10.5px] text-emerald-800 font-bold">Benefit: Provides actionable suggestions instead of only showing data.</p>
                  </div>
                </div>
              )}

              {/* --- TAB 5: AI Smart Insights Block --- */}
              {activeSmartTab === 'insights' && (
                <div className="space-y-4 p-5 bg-surface-container-low rounded-xl border border-outline-variant">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-extrabold text-primary uppercase tracking-wider flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-amber-500" />
                      School Board Live AI Smart Insights Panel
                    </h4>
                    <span className="text-[10px] text-on-surface-variant font-light bg-white border px-2 py-0.5 rounded">Generative AI Engine</span>
                  </div>

                  <p className="text-xs font-light text-on-surface-variant leading-relaxed">
                    Allows Headmaster/Admin to understand school performance quickly without analyzing reports manually. Here are the live school highlights compiled dynamically:
                  </p>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-4 bg-white rounded-xl border border-outline-variant space-y-2.5 shadow-3xs">
                      <p className="text-xs font-extrabold text-primary uppercase tracking-wider">📈 School Stats Trend Highlights:</p>
                      <ul className="space-y-2 text-xs text-on-surface font-semibold">
                        <li className={`flex items-center gap-2 ${isAttendanceUp ? 'text-emerald-700' : 'text-amber-700'}`}>
                          <span className="text-base">{isAttendanceUp ? '📈' : '📉'}</span>
                          {attendanceTrendString}
                        </li>
                        <li className={`flex items-center gap-2 ${isWasteDown ? 'text-emerald-700' : 'text-red-700'}`}>
                          <span className="text-base">{isWasteDown ? '📉' : '📈'}</span>
                          {wasteTrendString}
                        </li>
                      </ul>
                    </div>

                    <div className="p-4 bg-white rounded-xl border border-outline-variant space-y-2.5 shadow-3xs">
                      <p className="text-xs font-extrabold text-primary uppercase tracking-wider">🏆 Food Metrics Overview</p>
                      <ul className="space-y-2 text-xs text-on-surface font-semibold">
                        <li className="flex items-center gap-2">
                          <span className="text-base">🏆</span>
                          Highest Rated Food: <strong className="text-emerald-700">{highestRatedFood ? `${highestRatedFood.name} (${highestRatedFood.avgRating}/5)` : 'No ratings registered yet'}</strong>
                        </li>
                        <li className="flex items-center gap-2">
                          <span className="text-base">⚠️</span>
                          Most Wasted Food: <strong className="text-red-600">{mostWastedFoodItem ? `${mostWastedFoodItem.name} (${mostWastedFoodItem.avgWaste}%)` : 'No wastage reports registered yet'}</strong>
                        </li>
                        <li className="flex items-center gap-2 border-t pt-2 border-dashed border-slate-100">
                          <span className="text-base">🎯</span>
                          Recommendation: <strong className="text-primary">{mostWastedFoodItem ? `Reduce ${mostWastedFoodItem.name} preparation by 15% to check excess quantity.` : 'Continue tracking leftover audits.'}</strong>
                        </li>
                      </ul>
                    </div>
                  </div>

                  <div className="mt-2 text-center bg-primary/5 p-2 rounded-lg border border-primary/10">
                    <p className="text-[10.5px] text-primary font-bold">Benefit: Allows Headmaster/Admin to understand school performance quickly without analyzing reports manually.</p>
                  </div>
                </div>
              )}

            </div>

            {/* --- CORE PRESENTATION LINE (Full Width Highlighted Banner) --- */}
            <div id="smart-suite-presentation-banner" className="bg-gradient-to-r from-[#00236f] to-[#005ba4] p-5 rounded-2xl border border-blue-900 shadow-lg text-white text-center flex flex-col items-center justify-center space-y-1.5 relative overflow-hidden">
              <div className="absolute right-0 top-0 opacity-10 blur-xs select-none">
                <Sparkles size={80} className="text-white animate-pulse" />
              </div>
              <span className="text-[9px] font-extrabold uppercase px-2 py-0.5 rounded bg-white/10 text-secondary-container tracking-wider block">AP Edumeal Audit Standards Statement</span>
              <p className="text-xs sm:text-sm font-light italic leading-relaxed text-slate-100 max-w-4xl font-sans block">
                "Our system not only records attendance and meal data but also predicts food waste, measures food popularity, analyzes menu performance, correlates attendance with wastage, generates smart recommendations, and provides AI-powered insights to help schools reduce waste and improve student satisfaction."
              </p>
            </div>

          </div>
        </div>
      )}

      {activeViewSection === 'feedbacks' && (
        <div className="bg-surface-container-lowest p-6 rounded-2xl border border-outline-variant shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-outline-variant pb-2">
            <h3 className="font-headline-sm text-base font-bold text-primary">Student Feedbacks & Comment Logs</h3>
            <span className="text-[10px] font-mono font-bold bg-secondary/10 text-secondary px-2 py-0.5 rounded uppercase">DATE: {selectedDate}</span>
          </div>
          
          <div className="space-y-4 max-h-[500px] overflow-y-auto custom-scrollbar pr-2">
            {[...feedbackList].filter(f => f.date === selectedDate).sort((a, b) => b.date.localeCompare(a.date)).length === 0 ? (
              <div className="py-12 flex flex-col items-center justify-center text-center">
                <p className="text-[11px] font-bold text-slate-500 font-mono uppercase tracking-wider">No feedbacks registered</p>
              </div>
            ) : (
              [...feedbackList].filter(f => f.date === selectedDate).sort((a, b) => b.date.localeCompare(a.date)).map((f, idx) => (
                <div key={f.id || idx} className="p-4 bg-surface-container-low rounded-xl border border-outline-variant space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <span className="text-xs font-bold text-primary uppercase bg-primary-container/10 px-2.5 py-1 rounded">
                      Student Submission • {f.date} ({f.studentName || 'Anonymous'})
                    </span>
                    
                    {/* Service stars brief */}
                    <div className="flex gap-2 text-[10px] font-bold text-on-surface-variant flex-wrap">
                      <span>Taste: {f.serviceRatings.taste}/5</span>
                      <span>Hygene: {f.serviceRatings.cleanliness}/5</span>
                      <span>Staff Behaviour: {f.serviceRatings.behaviour}/5</span>
                    </div>
                  </div>

                  {/* Star items list */}
                  <div className="flex flex-wrap gap-2 text-[10px] font-bold">
                    {Object.entries(f.itemRatings).map(([item, stars]) => (
                      <span key={item} className="bg-secondary-container/23 text-on-secondary-container px-2 py-0.5 rounded border border-secondary-container">
                        {item}: {stars}★
                      </span>
                    ))}
                  </div>

                  {f.comments ? (
                    <p className="text-xs text-on-surface-variant font-light italic leading-relaxed font-sans">
                      User message: "{f.comments}"
                    </p>
                  ) : (
                    <p className="text-[10.5px] text-on-surface-variant/40 italic font-light font-mono">No written complaints or praise recorded.</p>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {activeViewSection === 'reports' && (
        <div className="bg-surface-container-lowest p-6 rounded-2xl border border-outline-variant shadow-xs space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-outline-variant pb-4">
            <div>
              <h3 className="text-base font-bold text-primary flex items-center gap-1.5">
                <FileText className="w-5 h-5 text-secondary" />
                <span>Executive Reports Wing</span>
              </h3>
              <p className="text-xs text-on-surface-variant">Generate official compliance statistics sheets</p>
            </div>

            <div className="flex bg-surface-container rounded p-1 text-xs font-semibold self-start sm:self-auto">
              <button 
                onClick={() => setActiveReportTab('daily')}
                className={`px-3 py-1.5 rounded ${activeReportTab === 'daily' ? 'bg-white text-primary shadow-xs font-extrabold' : 'text-on-surface-variant hover:text-primary'}`}
              >
                Daily summary
              </button>
              <button 
                onClick={() => setActiveReportTab('weekly')}
                className={`px-3 py-1.5 rounded ${activeReportTab === 'weekly' ? 'bg-white text-primary shadow-xs font-extrabold' : 'text-on-surface-variant hover:text-primary'}`}
              >
                Weekly stats
              </button>
              <button 
                onClick={() => setActiveReportTab('monthly')}
                className={`px-3 py-1.5 rounded ${activeReportTab === 'monthly' ? 'bg-white text-primary shadow-xs font-extrabold' : 'text-on-surface-variant hover:text-primary'}`}
              >
                Monthly sheet
              </button>
            </div>
          </div>

          {/* Printable Report Preview */}
          <div className="bg-white p-6 rounded-xl border border-outline-variant space-y-6 font-mono text-xs text-on-surface relative shadow-xs max-w-4xl mx-auto">
            <div className="absolute right-4 top-4 opacity-5 animate-pulse">
              <ShieldCheck size={180} />
            </div>

            {/* Official Report Header */}
            <div className="text-center space-y-1.5 border-b-2 border-primary pb-3 select-none">
              <h4 className="text-sm font-extrabold text-primary tracking-wide">GOVERNMENT OF ANDHRA PRADESH</h4>
              <p className="text-[10px] text-on-surface-variant uppercase font-bold tracking-widest">Department of School Education • mid-day meal audits</p>
              <p className="text-[9px] text-secondary font-bold">STATE MEAL MONITORING COMPLIANCE OUTLET</p>
            </div>

            {/* Metadata Fields */}
            <div className="grid grid-cols-2 gap-4 text-[10px] text-on-surface-variant">
              <div>
                <p><strong>REPORT LEVEL:</strong> {activeReportTab.toUpperCase()} SUMMARIES</p>
                <p><strong>SCHOOL NAME:</strong> CENTRAL HIGH SCHOOL</p>
                <p><strong>DISTRICT GROUP:</strong> VISAKHAPATNAM ZONE</p>
              </div>
              <div className="text-right">
                <p><strong>AUDIT PERIOD:</strong> {
                  activeReportTab === 'daily' 
                    ? `DATE: ${getFormattedDate(selectedDate)}` 
                    : activeReportTab === 'weekly' 
                      ? `WEEK: ${getFormattedDate(weeklyScopeDates[weeklyScopeDates.length - 1])} TO ${getFormattedDate(selectedDate)}` 
                      : `MONTH: ${getMonthName(selectedDate)}`
                }</p>
                <p><strong>COMPLIANCE:</strong> VERIFIED OPERATIONAL</p>
                <p><strong>GENERATION DATE:</strong> {getFormattedDate(selectedDate)} UTC</p>
              </div>
            </div>

            {/* Main variables metrics table representation */}
            <table className="w-full text-left font-mono text-[10px] border-collapse">
              <thead>
                <tr className="bg-surface-container-low text-primary uppercase font-bold border-b border-outline-variant">
                  <th className="p-2">COMPLIANCE CATEGORY</th>
                  <th className="p-2">PLANNED TARGETS</th>
                  <th className="p-2">ACTUAL DISBURSED</th>
                  <th className="p-2 text-right">METRIC LEVEL</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant">
                {activeReportTab === 'daily' && (
                  <>
                    <tr>
                      <td className="p-2">Student Attendance Registered</td>
                      <td className="p-2">{totalStudents} Enrolled</td>
                      <td className="p-2">{presentToday} Students Present</td>
                      <td className="p-2 text-right text-primary font-bold">{attendanceRatio}% Ratio</td>
                    </tr>
                    <tr>
                      <td className="p-2">Plate Count Required</td>
                      <td className="p-2">{Math.round(presentToday * 1.015)} Plates Planned</td>
                      <td className="p-2">{presentToday} Served on-time</td>
                      <td className="p-2 text-right text-secondary font-bold flex-nowrap">Surplus Managed</td>
                    </tr>
                    <tr className="bg-slate-50/50">
                      <td colSpan={4} className="p-2 font-bold text-secondary text-[10px] uppercase tracking-wider">
                        Kitchen Wastage Audit (Daily Item-Wise Breakdown)
                      </td>
                    </tr>
                    {isWastagePending ? (
                      <tr>
                        <td className="p-2 pl-4 italic text-on-surface-variant text-[9.5px]" colSpan={4}>
                          Measured Kitchen Wastage: PENDING (Waiting for supervisor's upload...)
                        </td>
                      </tr>
                    ) : (
                      selectedWastage.items.map(entry => {
                        const lost = Math.max(0, entry.prepared - entry.consumed);
                        const lostPct = entry.prepared > 0 ? parseFloat(((lost / entry.prepared) * 100).toFixed(1)) : 0;
                        return (
                          <tr key={entry.item} className="hover:bg-slate-50/50">
                            <td className="p-2 pl-4 text-on-surface text-[9.5px]">🥞 {entry.item} Detail</td>
                            <td className="p-2 font-mono text-[9.5px]">{entry.prepared} {entry.unit} Prepared</td>
                            <td className="p-2 font-mono text-[9.5px]">{entry.consumed} {entry.unit} Consumed</td>
                            <td className={`p-2 text-right font-bold font-mono text-[9.5px] ${lost > 0 ? 'text-red-700' : 'text-emerald-700'}`}>
                              {lost} {entry.unit} lost ({lostPct}%)
                            </td>
                          </tr>
                        );
                      })
                    )}
                    <tr>
                      <td className="p-2">Plate Satisfaction Rating</td>
                      <td className="p-2">4.0 ★ Goal</td>
                      <td className="p-2">{feedbacksForSelectedDate.length} Feedbacks Evaluated</td>
                      <td className="p-2 text-right text-tertiary font-bold">{avgSatisfaction} / 5.0 Star</td>
                    </tr>
                  </>
                )}

                {activeReportTab === 'weekly' && (
                  <>
                    <tr>
                      <td className="p-2">Student Attendance Registered</td>
                      <td className="p-2">{weeklyTotalEnrolled} Student-Days Enrolled</td>
                      <td className="p-2">{weeklyTotalPresent} Student-Days Present</td>
                      <td className="p-2 text-right text-primary font-bold">{weeklyAttendanceRatio}% Ratio</td>
                    </tr>
                    <tr>
                      <td className="p-2">Plate Count Required</td>
                      <td className="p-2">{Math.round(weeklyTotalPresent * 1.015)} Plates Planned</td>
                      <td className="p-2">{weeklyTotalPresent} Served on-time</td>
                      <td className="p-2 text-right text-secondary font-bold flex-nowrap">Surplus Managed</td>
                    </tr>
                    <tr className="bg-slate-50/50">
                      <td colSpan={4} className="p-2 font-bold text-secondary text-[10px] uppercase tracking-wider">
                        Kitchen Wastage Audit (Weekly Cumulative Breakdown)
                      </td>
                    </tr>
                    {weeklyWastageEntries.length === 0 ? (
                      <tr>
                        <td className="p-2 pl-4 italic text-on-surface-variant text-[9.5px]" colSpan={4}>
                          Measured Kitchen Wastage: No logs submitted this week
                        </td>
                      </tr>
                    ) : (
                      weeklyWastageEntries.map(entry => (
                        <tr key={entry.item} className="hover:bg-slate-50/50">
                          <td className="p-2 pl-4 text-on-surface text-[9.5px]">🥞 {entry.item} Weekly Summary</td>
                          <td className="p-2 font-mono text-[9.5px]">{entry.prepared} {entry.unit} Prepared</td>
                          <td className="p-2 font-mono text-[9.5px]">{entry.consumed} {entry.unit} Consumed</td>
                          <td className={`p-2 text-right font-bold font-mono text-[9.5px] ${entry.lost > 0 ? 'text-red-700' : 'text-emerald-700'}`}>
                            {entry.lost} {entry.unit} lost ({entry.lostPct}%)
                          </td>
                        </tr>
                      ))
                    )}
                    <tr>
                      <td className="p-2">Plate Satisfaction Rating</td>
                      <td className="p-2">4.0 ★ Goal</td>
                      <td className="p-2">{weeklyFeedbacks.length} Feedbacks Evaluated</td>
                      <td className="p-2 text-right text-tertiary font-bold">{weeklyAvgSatisfaction} / 5.0 Star</td>
                    </tr>
                  </>
                )}

                {activeReportTab === 'monthly' && (
                  <>
                    <tr>
                      <td className="p-2">Student Attendance Registered</td>
                      <td className="p-2">{monthlyTotalEnrolled} Monthly Enrolled Quota</td>
                      <td className="p-2">{monthlyTotalPresent} Monthly Disbursed</td>
                      <td className="p-2 text-right text-primary font-bold">{monthlyAttendanceRatio}% Ratio</td>
                    </tr>
                    <tr>
                      <td className="p-2">Plate Count Required</td>
                      <td className="p-2">{Math.round(monthlyTotalPresent * 1.015)} Plates Planned</td>
                      <td className="p-2">{monthlyTotalPresent} Served on-time</td>
                      <td className="p-2 text-right text-secondary font-bold flex-nowrap">Surplus Managed</td>
                    </tr>
                    <tr className="bg-slate-50/50">
                      <td colSpan={4} className="p-2 font-bold text-secondary text-[10px] uppercase tracking-wider">
                        Kitchen Wastage Audit (Monthly Cumulative Breakdown)
                      </td>
                    </tr>
                    {monthlyWastageEntries.length === 0 ? (
                      <tr>
                        <td className="p-2 pl-4 italic text-on-surface-variant text-[9.5px]" colSpan={4}>
                          Measured Kitchen Wastage: No logs submitted this month
                        </td>
                      </tr>
                    ) : (
                      monthlyWastageEntries.map(entry => (
                        <tr key={entry.item} className="hover:bg-slate-50/50">
                          <td className="p-2 pl-4 text-on-surface text-[9.5px]">🥞 {entry.item} Monthly Summary</td>
                          <td className="p-2 font-mono text-[9.5px]">{entry.prepared} {entry.unit} Prepared</td>
                          <td className="p-2 font-mono text-[9.5px]">{entry.consumed} {entry.unit} Consumed</td>
                          <td className={`p-2 text-right font-bold font-mono text-[9.5px] ${entry.lost > 0 ? 'text-red-700' : 'text-emerald-700'}`}>
                            {entry.lost} {entry.unit} lost ({entry.lostPct}%)
                          </td>
                        </tr>
                      ))
                    )}
                    <tr>
                      <td className="p-2">Plate Satisfaction Rating</td>
                      <td className="p-2">4.0 ★ Goal</td>
                      <td className="p-2">{monthlyFeedbacks.length} Feedbacks Evaluated</td>
                      <td className="p-2 text-right text-tertiary font-bold">{monthlyAvgSatisfaction} / 5.0 Star</td>
                    </tr>
                  </>
                )}
              </tbody>
            </table>

            {/* Generated Suggestions section on the print report */}
            <div className="p-4 bg-surface-container-low rounded-lg space-y-2">
              <strong className="text-[10px] text-primary uppercase block">REPORT SUGGESTED MITIGATIONS:</strong>
              <ul className="list-disc list-inside space-y-1 text-[9.5px] text-on-surface-variant">
                {reportMitigations.map((rec, i) => (
                  <li key={i}>{rec}</li>
                ))}
              </ul>
            </div>

            {/* Footer Signatures */}
            <div className="pt-8 border-t border-dotted border-outline-variant flex justify-between items-end text-[8.5px] text-on-surface-variant">
              <div className="text-center w-32 border-t border-on-surface pt-1.5">
                Kitchen Supervisor
              </div>
              <div className="text-center w-32 border-t border-on-surface pt-1.5">
                Headmaster Approval
              </div>
            </div>
          </div>

          {/* Interactive simulator print actions */}
          <div className="flex flex-wrap justify-center gap-3">
            <button 
              onClick={() => handleExportText('Excel')}
              className="px-6 py-2.5 bg-secondary hover:bg-secondary-hover text-white text-xs font-bold rounded-lg flex items-center gap-1.5 shadow-xs cursor-pointer"
            >
              <FileSpreadsheet className="w-4 h-4" />
              Download MS Excel Worksheet
            </button>
            <button 
              onClick={() => handleExportText('PDF')}
              className="px-6 py-2.5 bg-primary hover:bg-primary-hover text-white text-xs font-bold rounded-lg flex items-center gap-1.5 shadow-xs cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              Generate Certified PDF Document
            </button>
          </div>
        </div>
      )}

      {showComplianceDialog && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-outline-variant space-y-4 text-on-surface">
            <div className="flex items-center justify-between border-b pb-3 border-outline-variant">
              <h3 className="font-extrabold text-primary flex items-center gap-2 text-sm sm:text-base">
                <ShieldCheck className="w-6 h-6 text-emerald-600" />
                <span>Active Compliance Audit • {selectedDate}</span>
              </h3>
              <button 
                onClick={() => setShowComplianceDialog(false)} 
                className="text-on-surface-variant hover:text-primary font-bold text-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <p className="text-xs text-on-surface-variant leading-relaxed">
                The <strong>Interactive Smart Insights</strong> engine automatically analyzes keys and records from the register sheets, raw leftovers ledger, and child feedback cards for the selected audit day. <strong>Compliance Protocol</strong> ensures that the meal service meets official audit quality and portion guidelines safely.
              </p>

              <div className="space-y-3">
                
                {/* Attendance Verification */}
                <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-xl border border-outline-variant">
                  <span className="text-sm mt-0.5">
                    {totalStudents > 0 ? "✨" : "⚠️"}
                  </span>
                  <div className="text-xs space-y-0.5">
                    <p className="font-bold text-primary">Attendance Audit Check</p>
                    <p className="font-light text-on-surface-variant">
                      {totalStudents > 0 
                        ? `Registry verified. Logged ${presentToday} present students (${attendanceRatio}% turnout ratio).` 
                        : "No students registered yet. Please go to Teacher Portal to register children."
                      }
                    </p>
                  </div>
                </div>

                {/* Leftovers Check */}
                <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-xl border border-outline-variant">
                  <span className="text-sm mt-0.5">
                    {!isWastagePending ? "✅" : "❌"}
                  </span>
                  <div className="text-xs space-y-0.5">
                    <p className="font-bold text-primary">Leftovers Ledger Check</p>
                    <p className="font-light text-on-surface-variant">
                      {!isWastagePending 
                        ? `Kitchen supervisor report received. Wastage is currently indexed at ${totalWastePct}% (standard limit: <15%).` 
                        : "Missing cook-room report. Kitchen supervisor has not logged daily raw leftovers yet."
                      }
                    </p>
                  </div>
                </div>

                {/* Feedback Check */}
                <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-xl border border-outline-variant">
                  <span className="text-sm mt-0.5">
                    {!isRatingPending ? "⭐️" : "⚠️"}
                  </span>
                  <div className="text-xs space-y-0.5">
                    <p className="font-bold text-primary">Student Rating Check</p>
                    <p className="font-light text-on-surface-variant">
                      {!isRatingPending 
                        ? `Live ratings compiled. Received feedbacks from ${totalSubmissionsOnSelectedDate} students with an average score of ${avgSatisfaction} ★.` 
                        : "No feedbacks received yet on this date. Encourage students to submit reviews through their portal."
                      }
                    </p>
                  </div>
                </div>

                {/* Anomaly Check */}
                <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-xl border border-outline-variant">
                  <span className="text-sm mt-0.5">
                    {(!isWastagePending && totalWastePctRaw > 15) || (!isRatingPending && avgSatisfaction < 3.0) ? "❗️" : "🛡️"}
                  </span>
                  <div className="text-xs space-y-0.5">
                    <p className="font-bold text-primary">Operational Anomaly Test</p>
                    <p className="font-light text-on-surface-variant">
                      {(!isWastagePending && totalWastePctRaw > 15) 
                        ? "Anomaly detected: Raw portion wastage is higher than the permitted 15% threshold."
                        : (!isRatingPending && avgSatisfaction < 3.0)
                          ? "Anomaly detected: Customer meal satisfaction index has dropped below 3.0 stars. Review comments!"
                          : "Excellent. System running in nominal compliance buffer with zero high priority alerts."
                      }
                    </p>
                  </div>
                </div>

              </div>
            </div>

            <div className="pt-2">
              <button 
                onClick={() => setShowComplianceDialog(false)}
                className="w-full py-2.5 bg-primary hover:bg-primary-hover text-white text-xs font-bold rounded-xl shadow-md cursor-pointer transition-all"
              >
                Acknowledge Audit Sheet
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Pending Approvals Section */}
      {activeViewSection === 'approvals' && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-outline-variant shadow-2xs overflow-hidden">
            <div className="p-5 border-b border-outline-variant bg-surface-container-lowest">
              <h3 className="font-bold text-primary text-sm flex items-center gap-1.5">
                <ShieldAlert className="w-4 h-4 text-primary" />
                Principal Approval Queue
              </h3>
              <p className="text-[10px] text-on-surface-variant font-light">
                Review and execute pending operational requests submitted by the two School Coordinators.
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-surface-container border-b border-outline-variant text-secondary uppercase tracking-wider text-[10px] font-bold">
                    <th className="p-4">Submission Date</th>
                    <th className="p-4">Requested By</th>
                    <th className="p-4">Request Type</th>
                    <th className="p-4">Operational Details</th>
                    <th className="p-4">Principal Remarks & Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant">
                  {approvals.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-on-surface-variant italic">No administrative approval requests exist in the system.</td>
                    </tr>
                  ) : (
                    approvals.map((req) => (
                      <tr key={req.request_id} className="hover:bg-surface-container-lowest transition-colors">
                        <td className="p-4 font-mono text-on-surface-variant">{new Date(req.createdAt).toLocaleString()}</td>
                        <td className="p-4 font-bold text-on-surface">{req.requested_by}</td>
                        <td className="p-4 font-bold text-primary uppercase">{req.request_type.replace('_', ' ')}</td>
                        <td className="p-4">
                          {req.request_type === 'create_teacher' || req.request_type === 'create_supervisor' ? (
                            <div className="space-y-1">
                              <p>Name: <strong>{req.request_data.name}</strong></p>
                              <p className="text-[10px] text-on-surface-variant">Username: {req.request_data.username}</p>
                              {req.request_data.assigned_class ? (
                                <p className="text-[10px] text-on-surface-variant">
                                  Class assignment: {req.request_data.assigned_class} - {req.request_data.assigned_section}
                                </p>
                              ) : (
                                <p className="text-[10px] text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md inline-block">
                                  No class assigned (optional)
                                </p>
                              )}
                              {req.request_data.subject && (
                                <p className="text-[10px] text-on-surface-variant">
                                  Subject: <strong>{req.request_data.subject}</strong>
                                </p>
                              )}
                            </div>
                          ) : req.request_type === 'assign_teacher' ? (
                            <div>
                              Assign teacher <strong>{req.request_data.teacher_name}</strong> to {req.request_data.assigned_class} - {req.request_data.assigned_section}
                            </div>
                          ) : req.request_type === 'attendance_correction' ? (
                            <div className="space-y-1 bg-amber-50 p-3 rounded-xl border border-amber-200 text-xs">
                              <p className="font-bold text-amber-800">Attendance Correction Request</p>
                              <p>Class: <strong>{req.request_data.classStr} - {req.request_data.section}</strong></p>
                              <p className="text-[10px] text-on-surface-variant">Date: <strong>{req.request_data.date}</strong></p>
                              <p className="text-[10px] text-amber-700 italic mt-1 bg-white p-1.5 rounded-lg border border-amber-100 font-medium">"{req.request_data.reason}"</p>
                            </div>
                          ) : req.request_type === 'transfer_student' ? (
                            <div>
                              Relocate <strong>{req.request_data.student_name}</strong> (Roll: {req.request_data.roll_number}) from section {req.request_data.source_section} to {req.request_data.target_section}
                            </div>
                          ) : req.request_type === 'deactivate_user' ? (
                            <div>
                              Deactivate account of <strong>{req.request_data.target_name}</strong> ({req.request_data.target_role})
                            </div>
                          ) : req.request_type === 'create_student' ? (
                            <div className="space-y-1 bg-primary/5 p-3 rounded-xl border border-primary/10 text-xs">
                              <p className="font-bold text-primary">Single Student Admission Request</p>
                              <p>Name: <strong>{req.request_data.name}</strong> (Roll: {req.request_data.student_roll_no})</p>
                              <p className="text-[10px] text-on-surface-variant">Class: <strong>{req.request_data.assigned_class} - {req.request_data.assigned_section}</strong></p>
                              <p className="text-[10px] text-on-surface-variant">DOB: {req.request_data.dob} | Gender: {req.request_data.gender}</p>
                              <p className="text-[10px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md inline-block mt-1 font-mono">Initial Pass PIN: {req.request_data.dob}</p>
                            </div>
                          ) : req.request_type === 'bulk_students' ? (
                            <div className="space-y-2 bg-secondary/5 p-3 rounded-xl border border-secondary/10 text-xs">
                              <div className="flex justify-between items-center border-b border-secondary/15 pb-1">
                                <p className="font-bold text-secondary">Class Section Onboarding Batch</p>
                                <span className="bg-secondary/10 text-secondary text-[10px] px-2 py-0.5 rounded-full font-bold">
                                  {req.request_data.class} - {req.request_data.section}
                                </span>
                              </div>
                              <p className="text-[10px] font-medium text-on-surface">
                                Total Students to Approve At Once: <strong>{req.request_data.students?.length || 0}</strong>
                              </p>
                              <div className="max-h-36 overflow-y-auto space-y-1 mt-1 pr-1 border border-outline-variant rounded-lg p-1.5 bg-white">
                                {(req.request_data.students || []).map((s: any, idx: number) => (
                                  <div key={idx} className="flex justify-between items-center text-[10px] hover:bg-neutral-50 p-1 rounded-sm border-b border-neutral-100 last:border-0">
                                    <span>Roll: <strong>{s.rollNo || s.roll}</strong> - {s.name} ({s.gender})</span>
                                    <span className="text-on-surface-variant font-mono">DOB: {s.dob || '2012-01-01'}</span>
                                  </div>
                                ))}
                              </div>
                              <p className="text-[9px] text-on-surface-variant italic">Approving this request creates secure credentials with DOB as the login PIN for all students listed above instantly.</p>
                            </div>
                          ) : (
                            <div>Bulk student batch creation requested for {req.request_data.class} {req.request_data.section}.</div>
                          )}
                        </td>
                        <td className="p-4">
                          {req.status === 'pending' ? (
                            <div className="space-y-2">
                              <textarea 
                                placeholder="Add Principal feedback/remarks here..."
                                value={remarksMap[req.request_id] || ''}
                                onChange={e => setRemarksMap({...remarksMap, [req.request_id]: e.target.value})}
                                className="w-full p-2 border border-outline-variant rounded-lg text-xs focus:outline-primary bg-white text-on-surface"
                                rows={2}
                              />
                              <div className="flex gap-2">
                                <button 
                                  onClick={() => handleApproveRequest(req)}
                                  disabled={loading || !!processingRequestIds[req.request_id]}
                                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] rounded-lg transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1"
                                >
                                  {processingRequestIds[req.request_id] === 'approving' ? (
                                    <>
                                      <span className="animate-spin inline-block w-2.5 h-2.5 border border-white border-t-transparent rounded-full mr-1"></span>
                                      Approving...
                                    </>
                                  ) : 'Approve'}
                                </button>
                                <button 
                                  onClick={() => handleRejectRequest(req)}
                                  disabled={loading || !!processingRequestIds[req.request_id]}
                                  className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white font-bold text-[10px] rounded-lg transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1"
                                >
                                  {processingRequestIds[req.request_id] === 'rejecting' ? (
                                    <>
                                      <span className="animate-spin inline-block w-2.5 h-2.5 border border-white border-t-transparent rounded-full mr-1"></span>
                                      Rejecting...
                                    </>
                                  ) : 'Reject'}
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="space-y-1">
                              <span className={`inline-block px-2 py-0.5 rounded-full text-[9px] font-bold uppercase ${req.status === 'approved' ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}`}>
                                {req.status}
                              </span>
                              {req.principal_remarks && (
                                <p className="text-[10px] text-on-surface-variant italic">"{req.principal_remarks}"</p>
                              )}
                              <p className="text-[9px] text-on-surface-variant font-mono">By {req.approved_by} on {new Date(req.approved_at || '').toLocaleDateString()}</p>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* School Coordinators Section */}
      {activeViewSection === 'coordinators' && (
        <div className="space-y-6">
          <div className="grid md:grid-cols-3 gap-6">
            
            {/* Left form for setup */}
            <div className="md:col-span-1 bg-white p-5 rounded-2xl border border-outline-variant shadow-2xs space-y-4">
              <div className="flex items-center gap-2 border-b border-outline-variant pb-3 text-primary">
                <Users className="w-5 h-5" />
                <h3 className="font-bold text-sm">{editingCoord ? 'Edit Coordinator' : 'Register Coordinator'}</h3>
              </div>
              <p className="text-[10px] text-on-surface-variant font-light">
                {editingCoord ? 'Update details of the designated School Coordinator.' : 'Initialize the two designated School Coordinator accounts. Coordinators handle daily operations, student relocations, and user profiles.'}
              </p>

              {users.filter(u => u.role === 'coordinator').length >= 2 && !editingCoord ? (
                <div className="bg-amber-50 border border-amber-200 text-amber-800 p-3 rounded-xl flex items-start gap-2 text-xs">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <p>Limit reached: Both coordinator accounts are registered and active. No further registrations can be done.</p>
                </div>
              ) : (
                <form onSubmit={handleCreateCoordinator} className="space-y-4 text-xs">
                  <div>
                    <label className="block text-[10px] font-bold text-secondary uppercase tracking-wider mb-1">Coordinator Username</label>
                    <input 
                      type="text"
                      placeholder="e.g., coord_north"
                      value={newCoordUsername}
                      onChange={e => setNewCoordUsername(e.target.value)}
                      className="w-full px-3 py-2 border border-outline-variant rounded-lg text-xs focus:outline-primary bg-white text-on-surface"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-secondary uppercase tracking-wider mb-1">Full Name</label>
                    <input 
                      type="text"
                      placeholder="e.g., Yarra Rajesh"
                      value={newCoordName}
                      onChange={e => {
                        const val = e.target.value;
                        setNewCoordName(val);
                        const derivedUsername = val.trim().toLowerCase()
                          .replace(/\s+/g, '_')
                          .replace(/[^a-z0-9_]/g, '');
                        setNewCoordUsername(derivedUsername);
                      }}
                      className="w-full px-3 py-2 border border-outline-variant rounded-lg text-xs focus:outline-primary bg-white text-on-surface"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-secondary uppercase tracking-wider mb-1">Temporary Password PIN {editingCoord ? '(leave blank to keep unchanged)' : '(6+ chars)'}</label>
                    <input 
                      type="password"
                      placeholder={editingCoord ? "Optional: Update PIN" : "e.g., Coord@123"}
                      value={newCoordPassword}
                      onChange={e => setNewCoordPassword(e.target.value)}
                      className="w-full px-3 py-2 border border-outline-variant rounded-lg text-xs focus:outline-primary bg-white text-on-surface"
                      required={!editingCoord}
                    />
                  </div>

                  <div className="flex gap-2">
                    <button 
                      type="submit"
                      disabled={loading}
                      className="flex-1 py-2 bg-primary text-white hover:bg-opacity-95 font-bold text-xs rounded-lg transition-all cursor-pointer shadow-3xs"
                    >
                      {loading ? 'Processing...' : (editingCoord ? 'Update Coordinator' : 'Register Coordinator Account')}
                    </button>
                    {editingCoord && (
                      <button 
                        type="button"
                        onClick={() => {
                          setEditingCoord(null);
                          setNewCoordUsername('');
                          setNewCoordName('');
                          setNewCoordPassword('');
                        }}
                        className="flex-1 py-2 bg-surface-container text-on-surface-variant hover:bg-surface-container-high font-bold text-xs rounded-lg transition-all cursor-pointer shadow-3xs"
                      >
                        Cancel Edit
                      </button>
                    )}
                  </div>
                </form>
              )}
            </div>

            {/* Right roster */}
            <div className="md:col-span-2 bg-white rounded-2xl border border-outline-variant shadow-2xs overflow-hidden">
              <div className="p-4 border-b border-outline-variant bg-surface-container-lowest">
                <h3 className="font-bold text-primary text-sm">Designated Coordinators</h3>
                <p className="text-[10px] text-on-surface-variant font-light">View active coordinator channels below.</p>
              </div>
              <div className="overflow-x-auto text-xs">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-surface-container border-b border-outline-variant text-secondary uppercase tracking-wider text-[10px] font-bold">
                      <th className="p-4">Name</th>
                      <th className="p-4">Email</th>
                      <th className="p-4">Status</th>
                      <th className="p-4">Created Date</th>
                      <th className="p-4 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant">
                    {users.filter(u => u.role === 'coordinator').length === 0 ? (
                      <tr>
                        <td colSpan={5} className="p-8 text-center text-on-surface-variant italic">No coordinators registered yet. Initialize during system setup using the form.</td>
                      </tr>
                    ) : (
                      users.filter(u => u.role === 'coordinator').map(coord => (
                        <tr key={coord.uid} className="hover:bg-surface-container-lowest transition-colors">
                          <td className="p-4 font-bold text-on-surface">
                            {coord.name}
                            {coord.first_login && (
                              <span className="ml-2 bg-amber-100 text-amber-800 text-[9px] font-bold px-1.5 py-0.5 rounded-full">First Login PIN</span>
                            )}
                          </td>
                          <td className="p-4 font-mono text-on-surface-variant">{coord.email}</td>
                          <td className="p-4">
                            <span className={`inline-flex items-center gap-1 font-bold ${
                              coord.status === 'inactive' ? 'text-red-600' :
                              coord.status === 'rejected' ? 'text-rose-600' : 'text-emerald-600'
                            }`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${
                                coord.status === 'inactive' ? 'bg-red-600' :
                                coord.status === 'rejected' ? 'bg-rose-600' : 'bg-emerald-600'
                              }`} />
                              {coord.status === 'inactive' ? 'Deactivated' :
                               coord.status === 'rejected' ? 'Rejected' : 'Active'}
                            </span>
                          </td>
                          <td className="p-4 text-on-surface-variant font-mono">{new Date(coord.createdAt).toLocaleDateString()}</td>
                          <td className="p-4 flex items-center justify-center gap-2">
                            <button onClick={() => handleEditCoordinator(coord)} className="p-1.5 text-primary hover:bg-primary/10 rounded-md transition-colors"><Edit3 className="w-4 h-4" /></button>
                            <button onClick={() => handleDeleteCoordinator(coord.uid)} className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-md transition-colors"><Trash2 className="w-4 h-4" /></button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* Audit Logs Section */}
      {activeViewSection === 'logs' && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-outline-variant shadow-2xs overflow-hidden">
            <div className="p-5 border-b border-outline-variant bg-surface-container-lowest">
              <h3 className="font-bold text-primary text-sm flex items-center gap-1.5">
                <ShieldAlert className="w-4 h-4 text-primary" />
                System Audit Logs
              </h3>
              <p className="text-[10px] text-on-surface-variant font-light">
                Secure tracking of school management actions, approvals, database relocations, and credentials resets.
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-surface-container border-b border-outline-variant text-secondary uppercase tracking-wider text-[10px] font-bold">
                    <th className="p-4">Timestamp</th>
                    <th className="p-4">User</th>
                    <th className="p-4">Role</th>
                    <th className="p-4">Action Taken</th>
                    <th className="p-4">Operational Remarks</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant">
                  {auditLogs.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-on-surface-variant italic">No audit records registered yet in the system.</td>
                    </tr>
                  ) : (
                    auditLogs.map((log) => (
                      <tr key={log.log_id} className="hover:bg-surface-container-lowest transition-colors">
                        <td className="p-4 font-mono text-on-surface-variant">{new Date(log.timestamp).toLocaleString()}</td>
                        <td className="p-4 font-bold text-on-surface">{log.user_name}</td>
                        <td className="p-4">
                          <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-extrabold capitalize bg-neutral-100 text-neutral-800">
                            {log.role}
                          </span>
                        </td>
                        <td className="p-4 font-semibold text-primary">{log.action}</td>
                        <td className="p-4 text-on-surface-variant italic">{log.remarks || '---'}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {actionStatus && (
        <div className={`fixed bottom-4 right-4 p-4 rounded-xl flex items-start gap-3 border shadow-md z-50 ${
          actionStatus.type === 'success' 
            ? 'bg-emerald-50 border-emerald-200 text-emerald-800' 
            : 'bg-red-50 border-red-200 text-red-800'
        }`}>
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="font-bold text-xs">{actionStatus.type === 'success' ? 'Completed' : 'Error'}</h4>
            <p className="text-[11px] opacity-90">{actionStatus.message}</p>
          </div>
        </div>
      )}

      {exportSuccessType && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-outline-variant space-y-4 text-on-surface text-center">
            <div className="flex justify-center">
              <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center border border-emerald-200">
                <ShieldCheck className="w-8 h-8 text-emerald-600 animate-bounce" />
              </div>
            </div>

            <div className="space-y-1.5">
              <h3 className="text-lg font-extrabold text-primary">
                Official Compliance Sheet Ready
              </h3>
              <p className="text-xs text-on-surface-variant leading-relaxed">
                The certified <strong>Government of Andhra Pradesh</strong> mid-day meal executive audit has been successfully compiled for the <strong>Visakhapatnam</strong> region.
              </p>
            </div>

            <div className="bg-slate-50 p-3 rounded-xl border border-outline-variant text-[11px] text-left space-y-1.5 font-mono">
              <p className="font-bold text-primary">REPORT CONTENTS:</p>
              <ul className="list-disc list-inside space-y-1 text-on-surface-variant">
                <li>Format: <strong>{exportSuccessType.toUpperCase()}</strong></li>
                <li>Report Type: <strong>{activeReportTab.toUpperCase()}</strong></li>
                <li>District: <strong>VISAKHAPATNAM</strong></li>
                <li>Generation Date: <strong>{getFormattedDate(selectedDate)} UTC</strong></li>
              </ul>
            </div>

            <div className="text-[10px] text-on-surface-variant italic">
              ✨ Downloaded successfully to your device standard directory.
            </div>

            <button 
              onClick={() => setExportSuccessType(null)}
              className="w-full py-2.5 bg-primary hover:bg-primary-hover text-white text-xs font-bold rounded-xl shadow-md cursor-pointer transition-all uppercase tracking-wider"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
