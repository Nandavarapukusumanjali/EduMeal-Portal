import React, { useState, useEffect } from 'react';
import { DailyWastageReport, Student, WEEKLY_MENU, MEAL_ITEMS, WastageEntry, AttendanceReport } from '../types';
import { ArrowLeft, ChefHat, Calendar, Coffee, AlertTriangle, Send, RefreshCw, Layers, Check, Users, ShieldAlert } from 'lucide-react';

interface SupervisorPortalProps {
  presentStudentCount: number;
  totalStudentCount: number;
  onAddWastageReport: (report: DailyWastageReport) => void;
  onBackToWelcome: () => void;
  attendanceReports?: AttendanceReport[];
}

export default function SupervisorPortal({
  presentStudentCount,
  totalStudentCount,
  onAddWastageReport,
  onBackToWelcome,
  attendanceReports = []
}: SupervisorPortalProps) {
  // Local state to override attendance count for testing/simulation
  const [overrideCount, setOverrideCount] = useState<number>(presentStudentCount || totalStudentCount || 150);
  const [bufferOption, setBufferOption] = useState<number>(1.5); // percentage buffer

  // Sync overrideCount with prop when it updates
  useEffect(() => {
    if (presentStudentCount > 0) {
      setOverrideCount(presentStudentCount);
    } else if (totalStudentCount > 0 && (overrideCount === 0 || overrideCount === presentStudentCount)) {
      setOverrideCount(presentStudentCount || totalStudentCount);
    }
  }, [presentStudentCount, totalStudentCount]);

  // Wastage Module Input Form State
  const [ricePrep, setRicePrep] = useState<number>(130);
  const [riceCons, setRiceCons] = useState<number>(122);
  const [dalPrep, setDalPrep] = useState<number>(35);
  const [dalCons, setDalCons] = useState<number>(34);
  const [eggPrep, setEggPrep] = useState<number>(855);
  const [eggCons, setEggCons] = useState<number>(850);
  const [vegPrep, setVegPrep] = useState<number>(68);
  const [vegCons, setVegCons] = useState<number>(58);

  // Success indicator
  const [isSubmitSuccess, setIsSubmitSuccess] = useState<boolean>(false);

  // Determine today's menu day dynamically based on current local time
  const todayDayIndex = (() => {
    const day = new Date().getDay(); // 0 is Sunday, 1 is Monday, ...
    return day === 0 ? 0 : day - 1; // Map Sunday (0) to Monday (0) as fallback
  })();
  const todayMenu = WEEKLY_MENU[todayDayIndex];

  // Active Menu Day (for lookup menu view) - defaults to today's day index
  const [activeMenuIndex, setActiveMenuIndex] = useState<number>(todayDayIndex);

  // Automatic calculation for ingredients based on active student count
  const calcRiceReq = Math.round(overrideCount * 0.150); // 150g per student
  const calcDalReq = Math.round(overrideCount * 0.040); // 40g per student
  const calcEggReq = Math.round(overrideCount * 1.0); // 1 egg per student
  const calcVegReq = Math.round(overrideCount * 0.080); // 80g per student
  const calcChikkiReq = Math.round(overrideCount * 1.0); // 1 chikki per student

  // Auto waste calculation inside supervisor's console
  const itemsToCalc = [
    { name: 'Rice', prep: ricePrep, cons: riceCons, unit: 'kg' },
    { name: 'Dal', prep: dalPrep, cons: dalCons, unit: 'kg' },
    { name: 'Eggs', prep: eggPrep, cons: eggCons, unit: 'units' },
    { name: 'Vegetables', prep: vegPrep, cons: vegCons, unit: 'kg' }
  ];

  const processedWastageEntries: WastageEntry[] = itemsToCalc.map(item => {
    const remaining = Math.max(0, item.prep - item.cons);
    const percentage = item.prep > 0 ? (remaining / item.prep) * 100 : 0;
    return {
      item: item.name,
      prepared: item.prep,
      consumed: item.cons,
      remaining,
      wastePercentage: parseFloat(percentage.toFixed(2)),
      unit: item.unit
    };
  });

  const avgWastagePercentage = parseFloat(
    (processedWastageEntries.reduce((acc, curr) => acc + curr.wastePercentage, 0) / processedWastageEntries.length).toFixed(2)
  );

  // Find most wasted food item
  const sortedWastedEntries = [...processedWastageEntries].sort((a, b) => b.remaining - a.remaining);
  const mostWastedItem = sortedWastedEntries[0]?.item || 'None';
  const mostWastedQty = sortedWastedEntries[0]?.remaining || 0;
  const mostWastedPercentage = sortedWastedEntries[0]?.wastePercentage || 0;

  // Meal required today calculation
  const mealsRequired = Math.round(overrideCount * (1 + bufferOption / 100));

  const handleResetForm = () => {
    setRicePrep(Math.round(calcRiceReq * 1.05));
    setRiceCons(calcRiceReq);
    setDalPrep(Math.round(calcDalReq * 1.05));
    setDalCons(calcDalReq);
    setEggPrep(Math.round(calcEggReq * 1.1));
    setEggCons(calcEggReq);
    setVegPrep(Math.round(calcVegReq * 1.05));
    setVegCons(calcVegReq);
  };

  const handleSubmitWastage = () => {
    const report: DailyWastageReport = {
      id: 'w-' + Date.now(),
      date: new Date().toISOString().split('T')[0],
      items: processedWastageEntries,
      avgWastePercentage: avgWastagePercentage,
      mostWastedItem,
      mostWastedQty
    };

    onAddWastageReport(report);
    setIsSubmitSuccess(true);
    setTimeout(() => {
      setIsSubmitSuccess(false);
    }, 2500);
  };

  // Synchronize initial input fields with the calculator as defaults
  useEffect(() => {
    setRicePrep(Math.round(calcRiceReq * 1.05));
    setRiceCons(calcRiceReq);
    setDalPrep(Math.round(calcDalReq * 1.05));
    setDalCons(calcDalReq);
    setEggPrep(Math.round(calcEggReq * 1.02));
    setEggCons(calcEggReq);
    setVegPrep(Math.round(calcVegReq * 1.05));
    setVegCons(calcVegReq);
  }, [overrideCount]);

  return (
    <div className="space-y-6">
      {/* Header Row */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-outline-variant pb-6">
        <div>
          <button 
            onClick={onBackToWelcome}
            className="flex items-center gap-1.5 text-primary hover:underline font-semibold text-sm mb-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Select Portal
          </button>
          <span className="text-secondary font-extrabold uppercase tracking-widest text-xs">Kitchen Operations</span>
          <h2 className="font-headline-lg text-2xl md:text-3xl font-bold text-primary mt-1">Kitchen Dashboard</h2>
          <p className="text-on-surface-variant text-sm mt-1">
            Manage daily meal ingredients requirements, inspect weekly nutritional menus, and submit wastage records.
          </p>
        </div>

        {/* Date Stamp */}
        <div className="flex items-center gap-2 bg-white px-4 py-2 border border-outline-variant rounded-xl text-xs font-semibold text-primary">
          <Calendar className="w-4 h-4 text-secondary" />
          <span>Andhra Pradesh central Registry Clock</span>
        </div>
      </div>

      {/* Simulator Quick Slider */}
      <div className="bg-primary/5 p-4 rounded-xl border border-primary/10 flex flex-col md:flex-row items-center justify-between gap-4">
        <div>
          <h4 className="text-xs font-bold text-primary uppercase mb-1">Live Attendance Connector (Override Simulator)</h4>
          <p className="text-xs font-light text-on-surface-variant">
            Adjust student attendance count to dynamically simulate ingredients, meals and wastage forecasts.
          </p>
        </div>
        <div className="flex items-center gap-4 w-full md:w-auto">
          <input 
            type="range" 
            min="0" 
            max={totalStudentCount || 100} 
            value={overrideCount} 
            onChange={e => setOverrideCount(parseInt(e.target.value) || 0)}
            className="w-full md:w-56 accent-primary"
          />
          <span className="font-mono font-bold text-sm bg-white border border-outline-variant px-3 py-1 rounded-lg text-primary w-14 text-center">
            {overrideCount}
          </span>
        </div>
      </div>

      {/* Primary Bento Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Total Present Attendance */}
        <div className="bg-surface-container-lowest p-6 rounded-2xl shadow-xs border-l-4 border-primary flex items-center justify-between">
          <div>
            <p className="text-on-surface-variant text-xs font-bold uppercase tracking-wider">Total Present Today</p>
            <h2 className="text-3xl font-extrabold text-primary mt-1">{overrideCount}</h2>
            <p className="text-xs text-secondary mt-1 flex items-center gap-1">
              • Simulated count of students to feed
            </p>
          </div>
          <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center text-primary">
            <Layers className="w-5 h-5" />
          </div>
        </div>

        {/* Meals Required (+ buffer) */}
        <div className="bg-surface-container-lowest p-6 rounded-2xl shadow-xs border-l-4 border-secondary flex items-center justify-between">
          <div>
            <p className="text-on-surface-variant text-xs font-bold uppercase tracking-wider">Required Plates</p>
            <h2 className="text-3xl font-extrabold text-secondary mt-1">{mealsRequired}</h2>
            <div className="text-[10px] text-on-surface-variant mt-1.5 flex items-center gap-2">
              <span>Buffer allocation:</span>
              <select 
                value={bufferOption} 
                onChange={e => setBufferOption(parseFloat(e.target.value) || 0)}
                className="bg-surface-container border-none px-1 py-0.5 rounded text-[10px] font-bold text-secondary"
              >
                <option value="0">0.0% (Exact)</option>
                <option value="1.5">1.5% Buffer</option>
                <option value="3.0">3.0% Buffer</option>
                <option value="5.0">5.0% Buffer</option>
              </select>
            </div>
          </div>
          <div className="w-12 h-12 bg-secondary/10 rounded-full flex items-center justify-center text-secondary animate-pulse">
            <ChefHat className="w-5 h-5" />
          </div>
        </div>

        {/* Today's Special Menu Tag */}
        <div 
          onClick={() => {
            setActiveMenuIndex(todayDayIndex);
            setTimeout(() => {
              const el = document.getElementById('weekly-meal-planner');
              if (el) el.scrollIntoView({ behavior: 'smooth' });
            }, 50);
          }}
          className="bg-primary hover:bg-primary-hover p-6 rounded-2xl shadow-xs text-on-primary flex flex-col justify-between transition-colors cursor-pointer select-none"
        >
          <div>
            <span className="bg-white/20 text-white text-[10px] uppercase font-bold tracking-widest px-2 py-0.5 rounded">Menu Tag (Today)</span>
            <h3 className="text-lg font-bold mt-2 text-white">{todayMenu.day} Nutrition</h3>
            <p className="text-xs text-white/80 font-light mt-1">{todayMenu.items.join(' + ')}</p>
          </div>
          <div className="text-[10px] text-secondary-container mt-2 font-medium">Click to inspect full schedule</div>
        </div>
      </div>

      {/* Live Today's Attendance Compliance Audit Grid */}
      <div className="bg-surface-container-lowest p-6 rounded-2xl border border-outline-variant shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-outline-variant pb-4 mb-4">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-secondary" />
            <div>
              <h3 className="text-base font-bold text-primary">Classroom Attendance Posting Status (Today)</h3>
              <p className="text-on-surface-variant text-xs font-light">
                Monitor which classes have successfully posted today's attendance to verify kitchen plate allocations.
              </p>
            </div>
          </div>
          <div className="text-[11px] font-bold text-secondary-hover bg-secondary/10 px-3 py-1 rounded-full border border-secondary/20 self-start sm:self-auto font-mono">
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
                    : 'bg-red-55 bg-red-50/40 border-red-200 text-red-700'
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

      {/* Dynamic calculator & Wastage Form split layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Ingredients Requirement Calculator */}
        <div className="lg:col-span-7 bg-surface-container-lowest p-6 rounded-2xl border border-outline-variant shadow-xs">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-headline-sm text-lg font-bold text-primary flex items-center gap-2">
              <span>Requirement Calculator</span>
            </h3>
            <span className="text-[10px] text-on-surface-variant">Based on standard parameters per child</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Rice */}
            <div className="p-4 bg-surface-container-low rounded-xl">
              <span className="text-[10px] uppercase font-bold text-on-surface-variant block mb-1">Rice required</span>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-extrabold text-primary font-mono">{calcRiceReq}</span>
                <span className="text-xs text-on-surface-variant font-bold">kg</span>
              </div>
              <div className="mt-3 w-full bg-primary/10 h-1.5 rounded-full overflow-hidden">
                <div className="bg-primary h-full rounded-full" style={{ width: '80%' }}></div>
              </div>
            </div>

            {/* Dal */}
            <div className="p-4 bg-surface-container-low rounded-xl">
              <span className="text-[10px] uppercase font-bold text-on-surface-variant block mb-1">dal required</span>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-extrabold text-secondary font-mono">{calcDalReq}</span>
                <span className="text-xs text-on-surface-variant font-bold">kg</span>
              </div>
              <div className="mt-3 w-full bg-secondary/10 h-1.5 rounded-full overflow-hidden">
                <div className="bg-secondary h-full rounded-full" style={{ width: '50%' }}></div>
              </div>
            </div>

            {/* Eggs */}
            <div className="p-4 bg-surface-container-low rounded-xl">
              <span className="text-[10px] uppercase font-bold text-on-surface-variant block mb-1">Egg units</span>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-extrabold text-tertiary font-mono">{calcEggReq}</span>
                <span className="text-xs text-on-surface-variant font-bold">eggs</span>
              </div>
              <div className="mt-3 w-full bg-tertiary/15 h-1.5 rounded-full overflow-hidden">
                <div className="bg-tertiary h-full rounded-full" style={{ width: '90%' }}></div>
              </div>
            </div>

            {/* Vegetables */}
            <div className="p-4 bg-surface-container-low rounded-xl">
              <span className="text-[10px] uppercase font-bold text-on-surface-variant block mb-1">Vegetables volume</span>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-extrabold text-emerald-800 font-mono">{calcVegReq}</span>
                <span className="text-xs text-on-surface-variant font-bold">kg</span>
              </div>
              <div className="mt-3 w-full bg-emerald-800/10 h-1.5 rounded-full overflow-hidden">
                <div className="bg-emerald-800 h-full rounded-full" style={{ width: '65%' }}></div>
              </div>
            </div>
          </div>

          <div className="mt-6 p-4 bg-surface-container-low rounded-xl border border-outline-variant flex items-start gap-3">
            <AlertTriangle className="w-4 h-4 text-tertiary flex-shrink-0 mt-0.5" />
            <p className="text-[11px] text-on-surface-variant font-light italic leading-relaxed">
              Standardized state quotas modeled: Rice (150 grams/child), Dal (40 grams/child), Fresh Egg (1 unit), Green Vegetables / Sambar Mix (80 grams/child). High School Tier metrics applied.
            </p>
          </div>
        </div>

        {/* Wastage Report Submission Panel */}
        <div className="lg:col-span-5 bg-surface-container-lowest p-6 rounded-2xl border border-outline-variant shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4 border-b border-outline-variant pb-3">
              <h3 className="font-headline-sm text-lg font-bold text-red-600">Daily Wastage Module</h3>
              <span className="text-xs text-red-600 font-bold uppercase tracking-wider bg-red-100 px-2 py-0.5 rounded">Audit</span>
            </div>

            {/* Column captions explaining what the 2 input boxes represent */}
            <div className="grid grid-cols-12 gap-3 text-center mb-3">
              <span className="col-span-4 text-left text-[10px] font-extrabold uppercase text-on-surface-variant">Ingredient</span>
              <span className="col-span-4 text-[10px] font-extrabold uppercase text-primary bg-primary/5 py-1 rounded" title="The total weight or count of this item prepared/cooked in the kitchen">1. Cooked (A)</span>
              <span className="col-span-4 text-[10px] font-extrabold uppercase text-secondary bg-secondary/5 py-1 rounded" title="The weight or count of this item actually consumed by the attending students">2. Consumed (B)</span>
            </div>
            
            <p className="text-[10px] text-on-surface-variant italic leading-relaxed mb-4 text-center bg-surface-container px-2 py-1.5 rounded border border-outline-variant">
              Note: The left box is the amount <strong>cooked</strong> and the right box is the amount <strong>eaten</strong>. Leftovers are calculated as cooked minus eaten.
            </p>

            {/* Dynamic Ingredient inputs */}
            <div className="space-y-3.5">
              {/* Rice entry row */}
              <div className="grid grid-cols-12 gap-3 items-center">
                <span className="col-span-4 text-xs font-bold text-on-surface-variant">Rice Prep (kg)</span>
                <div className="col-span-4">
                  <input 
                    type="number" 
                    value={ricePrep} 
                    onChange={e => setRicePrep(Math.max(0, parseFloat(e.target.value) || 0))} 
                    className="w-full bg-surface-container-low border border-outline-variant rounded px-2.5 py-1 text-xs font-semibold text-primary"
                  />
                </div>
                <div className="col-span-4">
                  <input 
                    type="number" 
                    value={riceCons} 
                    onChange={e => setRiceCons(Math.max(0, parseFloat(e.target.value) || 0))} 
                    placeholder="Cons"
                    className="w-full bg-white border border-outline-variant rounded px-2.5 py-1 text-xs font-semibold text-secondary"
                  />
                </div>
              </div>

              {/* Dal entry row */}
              <div className="grid grid-cols-12 gap-3 items-center">
                <span className="col-span-4 text-xs font-bold text-on-surface-variant">Dal Prep (kg)</span>
                <div className="col-span-4">
                  <input 
                    type="number" 
                    value={dalPrep} 
                    onChange={e => setDalPrep(Math.max(0, parseFloat(e.target.value) || 0))} 
                    className="w-full bg-surface-container-low border border-outline-variant rounded px-2.5 py-1 text-xs font-semibold text-primary"
                  />
                </div>
                <div className="col-span-4">
                  <input 
                    type="number" 
                    value={dalCons} 
                    onChange={e => setDalCons(Math.max(0, parseFloat(e.target.value) || 0))} 
                    className="w-full bg-white border border-outline-variant rounded px-2.5 py-1 text-xs font-semibold text-secondary"
                  />
                </div>
              </div>

              {/* Egg entry row */}
              <div className="grid grid-cols-12 gap-3 items-center">
                <span className="col-span-4 text-xs font-bold text-on-surface-variant">Eggs (units)</span>
                <div className="col-span-4">
                  <input 
                    type="number" 
                    value={eggPrep} 
                    onChange={e => setEggPrep(Math.max(0, parseFloat(e.target.value) || 0))} 
                    className="w-full bg-surface-container-low border border-outline-variant rounded px-2.5 py-1 text-xs font-semibold text-primary"
                  />
                </div>
                <div className="col-span-4">
                  <input 
                    type="number" 
                    value={eggCons} 
                    onChange={e => setEggCons(Math.max(0, parseFloat(e.target.value) || 0))} 
                    className="w-full bg-white border border-outline-variant rounded px-2.5 py-1 text-xs font-semibold text-secondary"
                  />
                </div>
              </div>

              {/* Veg entry row */}
              <div className="grid grid-cols-12 gap-3 items-center">
                <span className="col-span-4 text-xs font-bold text-on-surface-variant">Vegetables (kg)</span>
                <div className="col-span-4">
                  <input 
                    type="number" 
                    value={vegPrep} 
                    onChange={e => setVegPrep(Math.max(0, parseFloat(e.target.value) || 0))} 
                    className="w-full bg-surface-container-low border border-outline-variant rounded px-2.5 py-1 text-xs font-semibold text-primary"
                  />
                </div>
                <div className="col-span-4">
                  <input 
                    type="number" 
                    value={vegCons} 
                    onChange={e => setVegCons(Math.max(0, parseFloat(e.target.value) || 0))} 
                    className="w-full bg-white border border-outline-variant rounded px-2.5 py-1 text-xs font-semibold text-secondary"
                  />
                </div>
              </div>
            </div>

            {/* Calculations summaries */}
            <div className="mt-5 pt-4 border-t border-outline-variant space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold text-on-surface-variant">
                <span>Computed Surcharges Waste:</span>
                <span className="text-red-700 font-bold">{avgWastagePercentage}% Average</span>
              </div>
              
              <div className="p-3 bg-red-100/50 rounded-lg text-xs flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-red-700 font-extrabold uppercase block tracking-wider">Most Wasted Food Item</span>
                  <span className="font-bold text-primary">{mostWastedItem} ({mostWastedQty} remaining)</span>
                </div>
                <div className="text-red-700 font-extrabold font-mono text-sm">
                  {mostWastedPercentage.toFixed(1)}%
                </div>
              </div>
            </div>
          </div>

          <div className="pt-4">
            <button 
              onClick={handleSubmitWastage}
              disabled={isSubmitSuccess}
              className={`w-full py-2.5 rounded-lg text-sm font-extrabold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                isSubmitSuccess 
                  ? 'bg-secondary text-white' 
                  : 'bg-primary hover:bg-primary-hover text-white shadow-xs'
              }`}
            >
              {isSubmitSuccess ? (
                <>
                  <Check className="w-4 h-4" />
                  Wastage Saved! Updated Admin Charts
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  Submit Daily Wastage Report
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Structured Weekly Menu Selector View */}
      <div id="weekly-meal-planner" className="bg-surface-container-lowest p-6 rounded-2xl border border-outline-variant shadow-xs scroll-mt-6">
        <h3 className="font-headline-sm text-lg font-bold text-primary mb-4 flex items-center gap-2">
          <ChefHat className="w-5 h-5 text-secondary" />
          <span>Andhra Pradesh Official Weekly Meal Planner</span>
        </h3>

        {/* Selected Menu Highlight */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 bg-surface-container-low p-5 rounded-xl border border-outline-variant mb-6 items-center">
          <div className="md:col-span-8 space-y-3">
            <div className="flex items-center gap-3">
              <span className="px-3 py-1 bg-primary text-white font-extrabold text-xs uppercase rounded-full tracking-wider">
                {WEEKLY_MENU[activeMenuIndex].day} Menu
              </span>
              <span className="text-xs font-semibold text-on-surface-variant font-mono">
                {WEEKLY_MENU[activeMenuIndex].calories} • {WEEKLY_MENU[activeMenuIndex].protein} Protein
              </span>
            </div>
            <h4 className="text-2xl font-extrabold text-primary leading-tight">
              {WEEKLY_MENU[activeMenuIndex].items.join(' + ')}
            </h4>
            <p className="text-xs text-on-surface-variant font-medium">
              Dietary tag: <strong className="text-secondary">{WEEKLY_MENU[activeMenuIndex].veggieTag}</strong> • Carefully modeled to support local micro-nutrients requirements.
            </p>
          </div>
          <div className="md:col-span-4">
            <img 
              src={WEEKLY_MENU[activeMenuIndex].image} 
              alt={WEEKLY_MENU[activeMenuIndex].day}
              className="w-full h-28 object-cover rounded-xl border border-outline-variant shadow-xs"
            />
          </div>
        </div>

        {/* Day Selector Buttons */}
        <div className="flex flex-wrap gap-2.5">
          {WEEKLY_MENU.map((menu, idx) => (
            <button
              key={menu.day}
              onClick={() => setActiveMenuIndex(idx)}
              className={`px-4 py-2.5 rounded-lg text-xs font-extrabold transition-all cursor-pointer ${
                activeMenuIndex === idx 
                  ? 'bg-secondary text-white shadow-xs' 
                  : 'bg-surface-container font-semibold hover:bg-surface-container-high text-on-surface-variant'
              }`}
            >
              {menu.day}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
