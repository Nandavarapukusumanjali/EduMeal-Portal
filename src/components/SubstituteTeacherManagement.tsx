import React, { useState, useEffect } from 'react';
import { User, Calendar, CheckSquare, AlertCircle, RefreshCw, Check, ArrowRight } from 'lucide-react';
import { SubstituteAssignment, TimetableEntry, UserProfile, AuditLog } from '../types';
import { subscribeToSubstituteAssignments, addSubstituteAssignment } from '../services/db';

interface SubstituteTeacherManagementProps {
  teachers: UserProfile[];
  timetableEntries: TimetableEntry[];
  addAuditLog: (log: AuditLog) => Promise<void>;
  currentUser?: UserProfile | null;
}

export default function SubstituteTeacherManagement({ 
  teachers, 
  timetableEntries, 
  addAuditLog,
  currentUser 
}: SubstituteTeacherManagementProps) {
  const [selectedTeacherId, setSelectedTeacherId] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    const d = new Date();
    const yr = d.getFullYear();
    const mo = String(d.getMonth() + 1).padStart(2, '0');
    const da = String(d.getDate()).padStart(2, '0');
    return `${yr}-${mo}-${da}`;
  });
  const [teacherTimetable, setTeacherTimetable] = useState<TimetableEntry[]>([]);
  const [substituteAssignments, setSubstituteAssignments] = useState<SubstituteAssignment[]>([]);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error' | null; text: string }>({ type: null, text: '' });

  useEffect(() => {
    const unsub = subscribeToSubstituteAssignments(setSubstituteAssignments);
    return () => unsub();
  }, []);

  const getDayOfWeek = (dateStr: string) => {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    // Avoid timezone offset issues by splitting YYYY-MM-DD
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      const yr = parseInt(parts[0], 10);
      const mo = parseInt(parts[1], 10) - 1;
      const da = parseInt(parts[2], 10);
      const d = new Date(yr, mo, da);
      return days[d.getDay()];
    }
    const d = new Date(dateStr);
    return days[d.getDay()];
  };

  useEffect(() => {
    if (selectedTeacherId && selectedDate) {
      const dayName = getDayOfWeek(selectedDate);
      // Filter entries for selected teacher on this day of the week
      const entries = timetableEntries.filter(
        e => e.teacher_id === selectedTeacherId && e.day_of_week === dayName
      );
      // Sort by period
      entries.sort((a, b) => a.period_number - b.period_number);
      setTeacherTimetable(entries);
    } else {
      setTeacherTimetable([]);
    }
  }, [selectedTeacherId, selectedDate, timetableEntries]);

  const getPeriodTimeLabel = (pNum: number) => {
    const times = [
      '08:45 - 09:35',
      '09:35 - 10:25',
      '10:40 - 11:30',
      '11:30 - 12:20',
      '01:10 - 02:00',
      '02:00 - 02:50',
      '02:50 - 03:40'
    ];
    return times[pNum - 1] || '08:45 - 09:35';
  };

  const handleAssignSubstitute = async (period: number, subTeacherId: string) => {
    if (!selectedTeacherId) return;
    const entry = teacherTimetable.find(e => e.period_number === period);
    if (!entry) return;

    try {
      setStatusMsg({ type: null, text: '' });
      
      if (!subTeacherId) {
        // Clearing/unassigning substitute (Optional/Extra care, but let's keep it clean)
        return;
      }

      const assignment: SubstituteAssignment = {
        assignment_id: `sub_${selectedDate}_${period}_${entry.class}_${entry.section}`,
        date: selectedDate,
        period,
        class: entry.class,
        section: entry.section,
        subject: entry.subject,
        original_teacher_id: selectedTeacherId,
        substitute_teacher_id: subTeacherId,
        assigned_by: currentUser?.name || 'School Coordinator',
        assigned_at: new Date().toISOString(),
      };

      await addSubstituteAssignment(assignment);

      // Create Audit Log
      await addAuditLog({
        log_id: `log_${Date.now()}`,
        user_id: currentUser?.uid || 'coordinator',
        user_name: currentUser?.name || 'School Coordinator',
        role: 'coordinator',
        action: 'Assigned Substitute Teacher',
        timestamp: new Date().toISOString(),
        remarks: `Assigned ${subTeacherId} as substitute for ${selectedTeacherId} on ${selectedDate} (Period ${period}, Class ${entry.class}-${entry.section}, Subject: ${entry.subject}).`
      });

      setStatusMsg({
        type: 'success',
        text: `Successfully assigned ${subTeacherId} to Period ${period} (${entry.class}-${entry.section}) today!`
      });
    } catch (err: any) {
      console.error(err);
      setStatusMsg({
        type: 'error',
        text: err.message || 'Failed to save substitute assignment.'
      });
    }
  };

  // Find assignments already made for the selected date
  const activeAssignmentsForDate = substituteAssignments.filter(
    sub => sub.date === selectedDate
  );

  const isTeacherFree = (teacherName: string, period: number) => {
    if (teacherName === selectedTeacherId) return false;
    const dayName = getDayOfWeek(selectedDate);
    
    // 1. Check if they have a regular class assigned in timetable
    const hasRegularClass = timetableEntries.some(
      e => e.teacher_id === teacherName && e.day_of_week === dayName && e.period_number === period
    );
    if (hasRegularClass) return false;

    // 2. Check if they are already substituting for another class during this period on this date
    const isAlreadySubstituting = substituteAssignments.some(
      sub => sub.date === selectedDate && sub.period === period && sub.substitute_teacher_id === teacherName
    );
    if (isAlreadySubstituting) return false;

    // 3. Check if they are the absent teacher in any substitute assignment for this period on this date
    const isAbsentForThisPeriod = substituteAssignments.some(
      sub => sub.date === selectedDate && sub.period === period && sub.original_teacher_id === teacherName
    );
    if (isAbsentForThisPeriod) return false;

    return true;
  };

  const selectedDayName = selectedDate ? getDayOfWeek(selectedDate) : '';

  return (
    <div className="bg-white p-5 rounded-2xl border border-outline-variant shadow-2xs space-y-5">
      <div className="flex items-center gap-2 border-b border-outline-variant pb-3 text-primary">
        <User className="w-5 h-5 text-primary" />
        <h3 className="font-bold text-sm">Substitute / Leave Management</h3>
      </div>
      <p className="text-[10px] text-on-surface-variant font-light leading-relaxed">
        Reassign class periods for absent teachers. Substitute assignments automatically route Period 1 attendance capabilities to the reassigned teacher.
      </p>

      {statusMsg.text && (
        <div className={`p-3 rounded-lg text-xs font-bold flex items-start gap-2 ${statusMsg.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-red-50 text-red-800 border border-red-200'}`}>
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{statusMsg.text}</span>
        </div>
      )}

      {/* Inputs */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-[9px] font-extrabold text-secondary uppercase tracking-wider mb-1">Absent Teacher</label>
          <select 
            value={selectedTeacherId} 
            onChange={e => setSelectedTeacherId(e.target.value)}
            className="w-full px-3 py-2 border border-outline-variant rounded-lg text-xs bg-white text-on-surface font-semibold focus:outline-primary"
          >
            <option value="">-- Choose Absent Teacher --</option>
            {teachers.map(t => (
              <option key={t.uid} value={t.name}>{t.name} ({t.subject || 'All Subjects'})</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-[9px] font-extrabold text-secondary uppercase tracking-wider mb-1">Date of Leave</label>
          <input 
            type="date" 
            value={selectedDate} 
            onChange={e => setSelectedDate(e.target.value)}
            className="w-full px-3 py-2 border border-outline-variant rounded-lg text-xs bg-white text-on-surface font-semibold focus:outline-primary"
          />
        </div>
      </div>

      {selectedTeacherId && (
        <div className="bg-neutral-50 p-3 rounded-xl border border-neutral-100 space-y-3">
          <div className="flex justify-between items-center text-[10px] text-secondary font-bold uppercase tracking-wider">
            <span>Schedule for {selectedTeacherId} ({selectedDayName})</span>
            {teacherTimetable.length === 0 && <span className="text-amber-600">No classes scheduled on {selectedDayName}</span>}
          </div>

          {teacherTimetable.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-[11px] border-collapse">
                <thead>
                  <tr className="border-b border-neutral-200 text-neutral-500 font-extrabold">
                    <th className="pb-2">Period</th>
                    <th className="pb-2">Class</th>
                    <th className="pb-2">Subject</th>
                    <th className="pb-2">Substitute Teacher</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {teacherTimetable.map(entry => {
                    const currentSub = activeAssignmentsForDate.find(
                      sub => sub.original_teacher_id === selectedTeacherId && 
                             sub.period === entry.period_number
                    );

                    return (
                      <tr key={entry.timetable_id} className="hover:bg-neutral-100/50">
                        <td className="py-2.5 font-bold text-neutral-700">
                          P{entry.period_number}
                          <div className="text-[9px] text-neutral-400 font-normal">{getPeriodTimeLabel(entry.period_number)}</div>
                        </td>
                        <td className="py-2.5 font-bold text-primary">{entry.class}-{entry.section}</td>
                        <td className="py-2.5 text-neutral-600 font-medium">{entry.subject}</td>
                        <td className="py-2.5">
                          <select 
                            value={currentSub?.substitute_teacher_id || ''}
                            onChange={e => handleAssignSubstitute(entry.period_number, e.target.value)}
                            className="px-2 py-1 border border-neutral-200 rounded-md text-[10px] bg-white font-bold text-neutral-800 focus:outline-primary"
                          >
                            <option value="">-- Assign --</option>
                            {teachers
                              .filter(t => isTeacherFree(t.name, entry.period_number) || (currentSub && currentSub.substitute_teacher_id === t.name))
                              .map(t => (
                                <option key={t.uid} value={t.name}>{t.name}</option>
                              ))
                            }
                          </select>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Active Assignments List */}
      <div className="border-t border-outline-variant pt-4 space-y-2">
        <h4 className="text-[10px] font-extrabold text-secondary uppercase tracking-wider">Active Reassignments for {selectedDate}</h4>
        {activeAssignmentsForDate.length === 0 ? (
          <div className="text-[10px] text-on-surface-variant italic py-2 bg-neutral-50 text-center rounded-lg border border-dashed border-neutral-200">
            No substitute teacher assignments made for this date.
          </div>
        ) : (
          <div className="space-y-1.5 max-h-[160px] overflow-y-auto">
            {activeAssignmentsForDate.map(sub => (
              <div key={sub.assignment_id} className="flex items-center justify-between text-[11px] p-2 bg-slate-50 border border-slate-100 rounded-lg">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-1 font-bold text-neutral-800">
                    <span>{sub.original_teacher_id}</span>
                    <ArrowRight className="w-3 h-3 text-neutral-400" />
                    <span className="text-primary">{sub.substitute_teacher_id}</span>
                  </div>
                  <div className="text-[9px] text-neutral-500 font-semibold">
                    Period {sub.period} • {sub.class}-{sub.section} • {sub.subject}
                  </div>
                </div>
                <div className="text-[9px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-bold">
                  {sub.period === 1 ? 'Period 1 (Attendance)' : 'Period ' + sub.period}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
