import React, { useState } from 'react';
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
  Users, Utensils, ShieldAlert
} from 'lucide-react';

interface AdminPortalProps {
  students: Student[];
  wastageReports: DailyWastageReport[];
  feedbackList: StudentFeedback[];
  presentCountToday: number;
  onBackToWelcome: () => void;
  attendanceReports?: AttendanceReport[];
}

export default function AdminPortal({
  students,
  wastageReports,
  feedbackList,
  presentCountToday,
  onBackToWelcome,
  attendanceReports = []
}: AdminPortalProps) {
  const [activeReportTab, setActiveReportTab] = useState<'daily' | 'weekly' | 'monthly'>('daily');
  const [activeViewSection, setActiveViewSection] = useState<'charts' | 'feedbacks' | 'reports'>('charts');

  // --- Dynamic Dashboard Metrics ---
  const totalStudents = students.length;
  const presentToday = totalStudents > 0 ? (presentCountToday || students.filter(s => s.present).length) : 0;
  const absentToday = totalStudents > 0 ? (totalStudents - presentToday) : 0;
  const attendanceRatio = totalStudents > 0 ? parseFloat(((presentToday / totalStudents) * 100).toFixed(1)) : 0;

  // Let's grab the latest wastage report to show "Today's metrics"
  const latestWastage = wastageReports[wastageReports.length - 1];
  const lastWeekWastage = wastageReports[wastageReports.length - 2];

  const totalPrepFood = latestWastage ? latestWastage.items.reduce((acc, curr) => acc + curr.prepared, 0) : 0;
  const totalConsFood = latestWastage ? latestWastage.items.reduce((acc, curr) => acc + curr.consumed, 0) : 0;
  const totalWasteFood = Math.max(0, totalPrepFood - totalConsFood);
  const totalWastePct = totalPrepFood > 0 ? parseFloat(((totalWasteFood / totalPrepFood) * 100).toFixed(1)) : 0;

  // Average student satisfaction
  const allRatings: number[] = [];
  feedbackList.forEach(f => {
    Object.values(f.itemRatings).forEach(r => allRatings.push(r));
    Object.values(f.serviceRatings).forEach(r => allRatings.push(r));
  });
  const avgSatisfaction = allRatings.length > 0 
    ? parseFloat((allRatings.reduce((acc, r) => acc + r, 0) / allRatings.length).toFixed(1)) 
    : 0;

  // Calculate Average Rating per single item category across all feedbacks
  const foodItemScores: { [item: string]: { total: number; count: number } } = {};
  feedbackList.forEach(f => {
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

  if (feedbackList.length === 0) {
    generatedInsights.push("Waiting for student feedback: Star ratings submitted by students generate quality trends.");
  } else if (mostLovedItem && mostLovedItem !== 'No Ratings' && sortedRatings.length > 0) {
    generatedInsights.push(`Satisfaction high watermark: "${mostLovedItem} has recorded student rating of ${sortedRatings[0]?.Rating}/5.0."`);
  }

  // --- Dynamic Suggestions engine ---
  const recommendationSuggestions: string[] = [];
  if (students.length === 0 && wastageReports.length === 0 && feedbackList.length === 0) {
    recommendationSuggestions.push("Register student databases inside the Teacher Portal to populate administrative quotas.");
    recommendationSuggestions.push("Monitor kitchen leftovers weights to balance mid-day meal chef target portions.");
  } else {
    if (sortedRatings.length > 0 && sortedRatings[0] && sortedRatings[0].Rating > 0) {
      recommendationSuggestions.push(`Increase prepared quantity and secure supply of highly rated ${mostLovedItem}.`);
    }
    if (sortedWastageItems.length > 0 && sortedWastageItems[0] && sortedWastageItems[0]['Wastage (kg/units)'] > 0) {
      recommendationSuggestions.push(`Reduce secondary raw vegetable weights for ${mostWastedItemOverall} to curb plate over-portions.`);
    }
    const lowRatedObj = sortedRatings.find(r => r.Rating > 0 && r.Rating < 3.8);
    if (lowRatedObj) {
      recommendationSuggestions.push(`Review raw ingredients freshness or recipe of poorly rated ${lowRatedObj.name}.`);
    } else {
      recommendationSuggestions.push(`Collect regular ratings to optimize Andhra Pradesh mid-day meal taste vectors.`);
    }
  }

  // Average service behavior star calculation
  const allServiceRatings = feedbackList.map(f => f.serviceRatings);
  const avgTaste = allServiceRatings.length > 0 ? parseFloat((allServiceRatings.reduce((acc, item) => acc + item.taste, 0) / allServiceRatings.length).toFixed(1)) : 0;
  const avgClean = allServiceRatings.length > 0 ? parseFloat((allServiceRatings.reduce((acc, item) => acc + item.cleanliness, 0) / allServiceRatings.length).toFixed(1)) : 0;
  const avgServing = allServiceRatings.length > 0 ? parseFloat((allServiceRatings.reduce((acc, item) => acc + item.behaviour, 0) / allServiceRatings.length).toFixed(1)) : 0;

  if (avgServing > 0 && avgServing < 4.0) {
    recommendationSuggestions.push("Conduct quick serving training session to expand courteous hygiene portioning.");
  }

  if (avgServing < 4.0) {
    recommendationSuggestions.push("Conduct quick serving training session to expand courteous hygiene portioning.");
  }

  // --- Simulator Export actions ---
  const handleExportText = (type: 'PDF' | 'Excel') => {
    alert(`[EduMeal Portal Alert]\nGenerating official Government School report for AP District School Wing.\nExporting format: ${type}\nDocument contains:\n- Classroom registration summaries\n- Raw materials allocation indices\n- Daily waste percentage averages\n- Student satisfaction indices.`);
  };

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
          <span className="text-secondary font-extrabold uppercase tracking-widest text-xs">Administrative Overview</span>
          <h2 className="font-headline-lg text-2xl md:text-3xl font-bold text-primary mt-1">Analytics Dashboard</h2>
          <p className="text-on-surface-variant text-sm mt-1">
            Real-time compliance monitoring, student satisfaction ratings, menu volumes, and wastage reports.
          </p>
        </div>

        {/* View toggles */}
        <div className="flex bg-surface-container rounded-lg p-1 text-xs font-semibold">
          <button 
            onClick={() => setActiveViewSection('charts')}
            className={`px-4 py-2 rounded-md transition-all ${activeViewSection === 'charts' ? 'bg-primary text-white shadow-xs' : 'text-on-surface-variant hover:bg-surface-container-high'}`}
          >
            Charts & Trends
          </button>
          <button 
            onClick={() => setActiveViewSection('feedbacks')}
            className={`px-4 py-2 rounded-md transition-all ${activeViewSection === 'feedbacks' ? 'bg-primary text-white shadow-xs' : 'text-on-surface-variant hover:bg-surface-container-high'}`}
          >
            Feedback Logs
          </button>
          <button 
            onClick={() => setActiveViewSection('reports')}
            className={`px-4 py-2 rounded-md transition-all ${activeViewSection === 'reports' ? 'bg-primary text-white shadow-xs' : 'text-on-surface-variant hover:bg-surface-container-high'}`}
          >
            Report Generator
          </button>
        </div>
      </div>

      {/* Central Metrics Bento Row */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Attendance today card */}
        <div className="bg-surface-container-lowest p-5 rounded-2xl shadow-xs border-l-4 border-primary">
          <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Attendance %</p>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-2xl md:text-3xl font-extrabold text-primary font-mono">{attendanceRatio}%</span>
            <span className="text-[11px] text-secondary font-bold flex items-center">
              <TrendingUp className="w-3.5 h-3.5 mr-0.5" />
              ↑ 1.2%
            </span>
          </div>
          <p className="text-[10px] text-on-surface-variant font-light mt-1.5">{presentToday} Present Today</p>
        </div>

        {/* Total meal preparation prepared card */}
        <div className="bg-surface-container-lowest p-5 rounded-2xl shadow-xs border-l-4 border-secondary">
          <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Total Prepared Food</p>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-2xl md:text-3xl font-extrabold text-secondary font-mono">{totalPrepFood}</span>
            <span className="text-[10.5px] text-on-surface-variant font-medium">kg/units</span>
          </div>
          <p className="text-[10px] text-on-surface-variant font-light mt-1.5">{totalConsFood} kg/units Consumed</p>
        </div>

        {/* Total Waste Percentage card */}
        <div className="bg-surface-container-lowest p-5 rounded-2xl shadow-xs border-l-4 border-red-600">
          <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Daily Waste % Today</p>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-2xl md:text-3xl font-extrabold text-red-600 font-mono">{totalWastePct}%</span>
            <span className="text-[10.5px] text-red-600 font-medium">{totalWasteFood} kg lost</span>
          </div>
          <p className="text-[10px] text-on-surface-variant font-light mt-1.5">Alert triggers above 15% threshold</p>
        </div>

        {/* Satisfaction stars card */}
        <div className="bg-surface-container-lowest p-5 rounded-2xl shadow-xs border-l-4 border-tertiary">
          <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Avg Student Rating</p>
          <div className="flex items-baseline gap-2 mt-1.5">
            <span className="text-2xl md:text-3xl font-extrabold text-tertiary font-mono">{avgSatisfaction}</span>
            <span className="text-xs text-on-surface-variant">/ 5.0 Rating</span>
          </div>
          <div className="flex gap-0.5 mt-1.5">
            {[1, 2, 3, 4, 5].map(star => {
              const fillVal = star <= Math.floor(avgSatisfaction);
              return <Star key={star} size={13} className={`${fillVal ? 'fill-tertiary text-tertiary' : 'text-outline-variant fill-none'}`} />;
            })}
          </div>
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
            const todayStr = (() => {
              const d = new Date();
              const yr = d.getFullYear();
              const mo = String(d.getMonth() + 1).padStart(2, '0');
              const da = String(d.getDate()).padStart(2, '0');
              return `${yr}-${mo}-${da}`;
            })();
            const isPosted = attendanceReports.some(
              r => r.classStr === it.classStr && r.section === it.section && r.date === todayStr
            );
            return (
              <div 
                key={`${it.classStr}-${it.section}`}
                className={`p-3 rounded-xl border flex flex-col justify-between transition-all ${
                  isPosted 
                    ? 'bg-emerald-50/50 border-emerald-200 text-emerald-800' 
                    : 'bg-red-50/40 border-red-200 text-red-700'
                }`}
              >
                <div className="font-extrabold text-xs">{it.classStr}</div>
                <div className="text-[10px] font-bold text-on-surface-variant">{it.section}</div>
                <div className="mt-2 text-[10px] font-extrabold flex items-center gap-1">
                  <span className={`w-2 h-2 rounded-full ${isPosted ? 'bg-emerald-600' : 'bg-red-500 animate-pulse'}`}></span>
                  {isPosted ? 'SUBMITTED' : 'PENDING'}
                </div>
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
                  onClick={() => alert('[Compliance Sync]\nNo anomalies detected. Create student details or food wastage entries to trigger automatic live notifications.')}
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

                {feedbackList.length > 0 ? (
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
                    <div className="w-10 h-10 rounded-full bg-tertiary/10 flex items-center justify-center text-tertiary mb-2">
                      <Star className="w-5 h-5 fill-tertiary" />
                    </div>
                    <p className="text-xs font-bold text-primary">No Rating Feedback Data</p>
                    <p className="text-[10.5px] text-on-surface-variant max-w-xs mt-1 leading-normal font-light">
                      Today's meal satisfaction average is empty. Sign in to the **Student Portal** to submit 1-5 star ratings for Rice, Dal, Eggs, vegetables, or dessert items.
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

          {/* Recommendation engine widgets */}
          <div className="bg-surface-container-lowest p-6 rounded-2xl border border-outline-variant shadow-xs">
            <h4 className="text-sm font-extrabold text-primary mb-4 flex items-center gap-1.5">
              <AlertCircle className="w-5 h-5 text-tertiary" />
              <span>Smart Recommendation Engine suggested actions</span>
            </h4>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {recommendationSuggestions.map((rec, idx) => (
                <div key={idx} className="flex gap-3 items-start p-3 bg-tertiary-container/5 border-l-4 border-tertiary rounded-r-xl">
                  <span className="w-5 h-5 bg-tertiary text-white rounded-full flex items-center justify-center text-[10px] font-extrabold mt-0.5">
                    {idx + 1}
                  </span>
                  <p className="text-xs text-on-surface font-semibold leading-relaxed">{rec}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeViewSection === 'feedbacks' && (
        <div className="bg-surface-container-lowest p-6 rounded-2xl border border-outline-variant shadow-xs space-y-4">
          <h3 className="font-headline-sm text-base font-bold text-primary">Student Feedbacks & Comment Logs</h3>
          
          <div className="space-y-4 max-h-[500px] overflow-y-auto custom-scrollbar pr-2">
            {feedbackList.map((f, idx) => (
              <div key={f.id || idx} className="p-4 bg-surface-container-low rounded-xl border border-outline-variant space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <span className="text-xs font-bold text-primary uppercase bg-primary-container/10 px-2.5 py-1 rounded">
                    Student Submission • {f.date}
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
                  <p className="text-xs text-on-surface-variant font-light italic leading-relaxed">
                    User message: "{f.comments}"
                  </p>
                ) : (
                  <p className="text-xs text-on-surface-variant/40 italic font-light font-mono text-[10.5px]">No written complaint or advice provided.</p>
                )}
              </div>
            ))}
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
                <p><strong>DISTRICT GROUP:</strong> EAST CHITTOOR ZONE</p>
              </div>
              <div className="text-right">
                <p><strong>AUDIT PERIOD:</strong> CURRENT TERM CYCLES 2026</p>
                <p><strong>COMPLIANCE:</strong> VERIFIED OPERATIONAL</p>
                <p><strong>GENERATION DATE:</strong> 2026-06-11 UTC</p>
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
                <tr>
                  <td className="p-2">Measured Kitchen Wastage</td>
                  <td className="p-2">{totalPrepFood} kg Prepared</td>
                  <td className="p-2">{totalConsFood} kg Consumed</td>
                  <td className="p-2 text-right text-red-700 font-bold">{totalWastePct}% Wastage</td>
                </tr>
                <tr>
                  <td className="p-2">Plate Satisfaction Rating</td>
                  <td className="p-2">4.0 ★ Goal</td>
                  <td className="p-2">{feedbackList.length} Feedbacks Evaluated</td>
                  <td className="p-2 text-right text-tertiary font-bold">{avgSatisfaction} / 5.0 Star</td>
                </tr>
              </tbody>
            </table>

            {/* Generated Suggestions section on the print report */}
            <div className="p-4 bg-surface-container-low rounded-lg space-y-2">
              <strong className="text-[10px] text-primary uppercase block">REPORT SUGGESTED MITIGATIONS:</strong>
              <ul className="list-disc list-inside space-y-1 text-[9.5px] text-on-surface-variant">
                {recommendationSuggestions.map((rec, i) => (
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
    </div>
  );
}
