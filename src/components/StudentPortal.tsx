import React, { useState, useEffect } from 'react';
import { WEEKLY_MENU, StudentFeedback, TimetableEntry } from '../types';
import { ArrowLeft, Star, Heart, HelpCircle, Utensils, MessageSquare, Send, ThumbsUp, Coffee, AlertCircle, LogOut, User, Key, Calendar } from 'lucide-react';
import { auth } from '../firebase';
import { getUserProfile, subscribeToTimetableEntries } from '../services/db';

interface StudentPortalProps {
  feedbackList?: StudentFeedback[];
  onAddFeedback: (feedback: StudentFeedback) => void;
  onBackToWelcome: () => void;
  currentUser?: any;
  onChangePassword?: () => void;
}

export default function StudentPortal({ 
  feedbackList = [], 
  onAddFeedback, 
  onBackToWelcome,
  currentUser,
  onChangePassword
}: StudentPortalProps) {
  // We can let the student select which day's meal they are rating for full testability!
  const [selectedDayIndex, setSelectedDayIndex] = useState<number>(() => {
    const day = new Date().getDay(); // 0 is Sunday, 1 is Monday, ...
    return day === 0 ? 0 : day - 1; // Map Sunday (0) to Monday (0) as fallback
  });
  const activeMenu = WEEKLY_MENU[selectedDayIndex];

  // Ratings State for Food Items of the Day
  const [itemRatings, setItemRatings] = useState<{ [item: string]: number }>({});
  
  // Ratings State for Service experience
  const [tasteRating, setTasteRating] = useState<number>(0);
  const [qualityRating, setQualityRating] = useState<number>(0);
  const [tempRating, setTempRating] = useState<number>(0);
  const [behaviourRating, setBehaviourRating] = useState<number>(0);
  const [cleanlinessRating, setCleanlinessRating] = useState<number>(0);

  const [commentText, setCommentText] = useState<string>('');
  const [isSubmitted, setIsSubmitted] = useState<boolean>(false);
  const [studentName, setStudentName] = useState<string>('Anonymous Student');
  const [profile, setProfile] = useState<any>(null);
  const [onScreenError, setOnScreenError] = useState<string>('');

  const [activeTab, setActiveTab] = useState<'meal' | 'timetable'>('meal');
  const [timetableEntries, setTimetableEntries] = useState<TimetableEntry[]>([]);

  useEffect(() => {
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

  const todayDateStr = new Date().toISOString().split('T')[0];
  const hasAlreadySubmittedToday = feedbackList.some(
    f => f.studentName?.trim().toLowerCase() === studentName.trim().toLowerCase() && f.date === todayDateStr
  );

  // Synchronize authenticated student's profile from Firestore
  useEffect(() => {
    const loadStudentProfile = async () => {
      if (auth.currentUser) {
        try {
          const fetchedProfile = await getUserProfile(auth.currentUser.uid);
          if (fetchedProfile) {
            setProfile(fetchedProfile);
            setStudentName(fetchedProfile.name);
          }
        } catch (err) {
          console.error('Error fetching student profile:', err);
        }
      } else if (currentUser) {
        setProfile(currentUser);
        setStudentName(currentUser.name);
      }
    };
    loadStudentProfile();
  }, [currentUser]);


  const handleSetItemRating = (item: string, stars: number) => {
    setOnScreenError('');
    setItemRatings(prev => ({
      ...prev,
      [item]: stars
    }));
  };

  const handleSetTasteRating = (stars: number) => { setTasteRating(stars); setOnScreenError(''); };
  const handleSetQualityRating = (stars: number) => { setQualityRating(stars); setOnScreenError(''); };
  const handleSetTempRating = (stars: number) => { setTempRating(stars); setOnScreenError(''); };
  const handleSetBehaviourRating = (stars: number) => { setBehaviourRating(stars); setOnScreenError(''); };
  const handleSetCleanlinessRating = (stars: number) => { setCleanlinessRating(stars); setOnScreenError(''); };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Check if they left anything unrated
    const unratedFoodItems = activeMenu.items.filter(item => !itemRatings[item] || itemRatings[item] === 0);
    
    // Check if any service ratings are zero
    const unratedServices: string[] = [];
    if (tasteRating === 0) unratedServices.push('Food Taste');
    if (qualityRating === 0) unratedServices.push('Raw Quality');
    if (tempRating === 0) unratedServices.push('Food Temperature');
    if (behaviourRating === 0) unratedServices.push('Serving Behavior');
    if (cleanlinessRating === 0) unratedServices.push('Cleanliness / Hygiene');

    if (unratedFoodItems.length > 0 || unratedServices.length > 0) {
      const errorParts: string[] = [];
      if (unratedFoodItems.length > 0) {
        errorParts.push(`Food Items [${unratedFoodItems.join(', ')}]`);
      }
      if (unratedServices.length > 0) {
        errorParts.push(`Service aspects [${unratedServices.join(', ')}]`);
      }
      setOnScreenError(`Please rate everything! Left unrated: ${errorParts.join(' and ')}.`);
      return;
    }

    // Build the feedback object
    const ratingsObj: { [item: string]: number } = {};
    activeMenu.items.forEach(item => {
      ratingsObj[item] = itemRatings[item];
    });

    const newFeedback: StudentFeedback = {
      id: 'f-' + Date.now(),
      date: new Date().toISOString().split('T')[0],
      studentName: studentName,
      itemRatings: ratingsObj,
      serviceRatings: {
        taste: tasteRating,
        quality: qualityRating,
        temperature: tempRating,
        behaviour: behaviourRating,
        cleanliness: cleanlinessRating
      },
      comments: commentText.trim()
    };

    onAddFeedback(newFeedback);
    setIsSubmitted(true);
    setOnScreenError('');

    // Reset scores
    setTimeout(() => {
      setIsSubmitted(false);
      setItemRatings({});
      setTasteRating(0);
      setQualityRating(0);
      setTempRating(0);
      setBehaviourRating(0);
      setCleanlinessRating(0);
      setCommentText('');
    }, 3000);
  };

  const renderStars = (currentVal: number, onSelect: (val: number) => void, size: number = 24) => {
    return (
      <div className="flex gap-1.5">
        {[1, 2, 3, 4, 5].map((stars) => (
          <button
            key={stars}
            type="button"
            onClick={() => onSelect(stars)}
            className="focus:outline-none transition-transform hover:scale-125 cursor-pointer"
          >
            <Star 
              size={size}
              className={`${
                stars <= currentVal 
                  ? 'fill-tertiary text-tertiary' 
                  : 'text-outline-variant fill-none'
              }`}
            />
          </button>
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
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
          <span className="text-secondary font-extrabold uppercase tracking-widest text-xs">
            Student Portal {profile ? `• ${profile.class}-${profile.section}` : ''}
          </span>
          <h2 className="font-headline-lg text-2xl md:text-3xl font-bold text-primary mt-1">
            {activeTab === 'meal' ? "How was your meal?" : "My Weekly Class Timetable"}
          </h2>
          <p className="text-on-surface-variant text-sm mt-1">
            {activeTab === 'meal' 
              ? "Your anonymous rating helps the kitchen supervisor improve ingredients and cleanliness qualities!"
              : `Showing official scheduled slots for ${profile ? `${profile.class}-${profile.section}` : 'your class'}.`
            }
          </p>
        </div>

        {/* Day simulator dropdown (only visible on meal tab) */}
        {activeTab === 'meal' && (
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-on-surface-variant uppercase">Select Meal Day:</span>
            <select 
              value={selectedDayIndex} 
              onChange={e => setSelectedDayIndex(parseInt(e.target.value) || 0)}
              className="bg-white border border-outline-variant rounded-lg px-2.5 py-1.5 text-xs font-bold text-primary focus:outline-none"
            >
              {WEEKLY_MENU.map((menu, idx) => (
                <option key={menu.day} value={idx}>{menu.day}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Tab Selector */}
      <div className="flex border-b border-outline-variant gap-4 select-none mb-2">
        <button 
          onClick={() => setActiveTab('meal')}
          className={`pb-3 text-sm font-bold border-b-2 transition-all flex items-center gap-2 ${
            activeTab === 'meal' 
              ? 'border-primary text-primary font-extrabold pb-2.5' 
              : 'border-transparent text-on-surface-variant hover:text-primary'
          }`}
        >
          <Utensils className="w-4 h-4" />
          <span>Rate Today's Meal</span>
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
          <span>My Class Timetable</span>
        </button>
      </div>

      {activeTab === 'meal' ? (
        <>
          {isSubmitted ? (
        <div className="bg-secondary-container/20 p-8 rounded-2xl border border-secondary/20 flex flex-col items-center text-center space-y-4 animate-fade-in py-16">
          <div className="w-16 h-16 bg-secondary text-white rounded-full flex items-center justify-center shadow-md">
            <ThumbsUp className="w-8 h-8" />
          </div>
          <h3 className="text-2xl font-extrabold text-secondary tracking-tight">Feedback Submitted Successfully!</h3>
          <p className="text-sm text-on-surface-variant max-w-lg leading-relaxed">
            Thank you! Your ratings hit the Headmaster Analytics Panel instantly. We are auditing recipes and portions to serve cleaner, warmer, and sweeter plates.
          </p>
          <span className="text-xs text-secondary-container font-extrabold uppercase bg-secondary px-3 py-1 rounded-full">
            Jai Hind • Clean Andhra Pradesh Initiative
          </span>
        </div>
      ) : hasAlreadySubmittedToday ? (
        <div className="bg-amber-500/10 border border-amber-500/20 p-8 rounded-2xl flex flex-col items-center text-center space-y-4 animate-fade-in py-16">
          <div className="w-16 h-16 bg-amber-500 text-white rounded-full flex items-center justify-center shadow-md">
            <AlertCircle className="w-8 h-8 font-extrabold" />
          </div>
          <h3 className="text-2xl font-extrabold text-amber-600 tracking-tight">Feedback Already Received</h3>
          <p className="text-sm text-on-surface-variant max-w-lg leading-relaxed">
            Hello <strong className="text-primary font-bold">{studentName}</strong>, our live records show you have already submitted your meal rating feedback for today.
          </p>
          <p className="text-xs text-on-surface-variant/80 max-w-md">
            To satisfy Mid-Day Meal daily auditing criteria and maintain system compliance, each student can submit exactly one review ticket per weekday. Please return tomorrow for your next hot lunch review!
          </p>
          <button
            type="button"
            onClick={onBackToWelcome}
            className="px-5 py-2.5 bg-primary hover:bg-primary-hover text-white rounded-xl text-xs font-bold transition-all cursor-pointer shadow-sm"
          >
            Go Back to Portals
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
          
          {/* Today's Menu Highlight Box & Profile Details */}
          <div className="md:col-span-4 space-y-6">
            <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant shadow-xs overflow-hidden flex flex-col justify-between">
              <div className="p-6">
                <span className="text-[10px] text-primary bg-primary/10 px-2.5 py-1 rounded-full font-bold uppercase tracking-wider mb-3 inline-block">
                  {activeMenu.day}'s Serving
                </span>
                <h3 className="text-xl font-extrabold text-primary mb-4 leading-tight">Today's Nutrition Card</h3>
                
                <div className="space-y-2.5">
                  {activeMenu.items.map((item, idx) => (
                    <div key={idx} className="flex items-center gap-3 p-2.5 bg-surface-container-low rounded-xl">
                      <Utensils className="w-4 h-4 text-secondary flex-shrink-0" />
                      <span className="text-xs font-bold text-on-surface">{item}</span>
                    </div>
                  ))}
                </div>
              </div>

              <img 
                src={activeMenu.image} 
                alt={activeMenu.day}
                className="h-32 w-full object-cover border-t border-outline-variant"
              />
            </div>

            {/* Student Profile details card */}
            <div className="bg-surface-container-lowest p-6 rounded-2xl border border-outline-variant shadow-xs space-y-4">
              <div className="flex items-center gap-2.5 border-b border-outline-variant pb-3">
                <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                  <User className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="font-bold text-xs text-primary uppercase tracking-wider">My Profile Details</h4>
                  <p className="text-[10px] text-on-surface-variant font-light">Student Registration Record</p>
                </div>
              </div>

              <div className="space-y-3 text-xs">
                <div className="flex justify-between items-center py-1.5 border-b border-neutral-50">
                  <span className="text-on-surface-variant font-medium">Full Name</span>
                  <strong className="text-on-surface font-extrabold text-right">{profile?.name || studentName}</strong>
                </div>

                <div className="flex justify-between items-center py-1.5 border-b border-neutral-50">
                  <span className="text-on-surface-variant font-medium">Roll Number</span>
                  <span className="font-mono bg-neutral-100 text-on-surface px-2 py-0.5 rounded font-bold">
                    {profile?.roll_number || 'Pending'}
                  </span>
                </div>

                <div className="flex justify-between items-center py-1.5 border-b border-neutral-50">
                  <span className="text-on-surface-variant font-medium">Class / Section</span>
                  <strong className="text-primary font-extrabold">
                    {profile?.class ? `${profile.class} - ${profile.section || ''}` : 'Not assigned'}
                  </strong>
                </div>

                <div className="flex justify-between items-center py-1.5 border-b border-neutral-50">
                  <span className="text-on-surface-variant font-medium">Gender</span>
                  <span className="text-on-surface font-semibold">{profile?.gender || 'N/A'}</span>
                </div>

                <div className="flex justify-between items-center py-1.5">
                  <span className="text-on-surface-variant font-medium">Date of Birth (DOB)</span>
                  <span className="font-mono text-on-surface font-semibold">{profile?.dob || 'N/A'}</span>
                </div>
              </div>

              {onChangePassword && (
                <button
                  type="button"
                  onClick={onChangePassword}
                  className="w-full flex items-center justify-center gap-1.5 py-2.5 px-3 mt-2 bg-secondary/10 hover:bg-secondary/15 text-secondary font-extrabold text-xs rounded-xl border border-secondary/10 transition-all hover:scale-[1.02] cursor-pointer"
                >
                  <Key className="w-3.5 h-3.5" />
                  <span>Change Password PIN</span>
                </button>
              )}
            </div>
          </div>

          {/* Feedback Form Rating Star Sheets */}
          <div className="md:col-span-8 space-y-6">
            
            {/* Food item ratings */}
            <div className="bg-surface-container-lowest p-6 rounded-2xl border border-outline-variant shadow-xs">
              <h3 className="font-headline-sm text-base font-bold text-secondary mb-4 flex items-center gap-1.5">
                <Heart className="w-5 h-5 text-red-500 fill-red-500" />
                <span>Rate Food Items</span>
              </h3>
              
              <div className="space-y-4">
                {activeMenu.items.map((item) => (
                  <div key={item} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-outline-variant pb-3 last:border-0 last:pb-0">
                    <span className="text-sm font-bold text-on-surface">{item} Quality</span>
                    {renderStars(itemRatings[item] || 0, (v) => handleSetItemRating(item, v), 28)}
                  </div>
                ))}
              </div>
            </div>

            {/* Service experience ratings */}
            <div className="bg-surface-container-lowest p-6 rounded-2xl border border-outline-variant shadow-xs">
              <h3 className="font-headline-sm text-base font-bold text-tertiary mb-4 flex items-center gap-1.5">
                <Coffee className="w-5 h-5 text-tertiary" />
                <span>Service Quality Experience</span>
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4">
                
                {/* Taste */}
                <div className="flex items-center justify-between gap-4">
                  <span className="text-xs font-semibold text-on-surface-variant">Food Taste</span>
                  {renderStars(tasteRating, handleSetTasteRating, 20)}
                </div>

                {/* Quality */}
                <div className="flex items-center justify-between gap-4">
                  <span className="text-xs font-semibold text-on-surface-variant">Raw Quality</span>
                  {renderStars(qualityRating, handleSetQualityRating, 20)}
                </div>

                {/* Temp */}
                <div className="flex items-center justify-between gap-4">
                  <span className="text-xs font-semibold text-on-surface-variant">Food Temperature</span>
                  {renderStars(tempRating, handleSetTempRating, 20)}
                </div>

                {/* Behaviour */}
                <div className="flex items-center justify-between gap-4">
                  <span className="text-xs font-semibold text-on-surface-variant">Serving Behavior</span>
                  {renderStars(behaviourRating, handleSetBehaviourRating, 20)}
                </div>

                {/* Cleanliness */}
                <div className="flex items-center justify-between gap-4 col-span-1">
                  <span className="text-xs font-semibold text-on-surface-variant">Cleanliness / Hygiene</span>
                  {renderStars(cleanlinessRating, handleSetCleanlinessRating, 20)}
                </div>

              </div>
            </div>

            {/* Comments textarea */}
            <div className="bg-surface-container-lowest p-6 rounded-2xl border border-outline-variant shadow-xs">
              <label className="font-semibold text-sm text-on-surface flex items-center gap-1.5 mb-3">
                <MessageSquare className="w-4 h-4 text-primary" />
                Any suggestions to reduce food wastage?
              </label>
              <textarea 
                rows={3}
                value={commentText}
                onChange={e => setCommentText(e.target.value)}
                placeholder="Suggest recipes changes, sweet level, or smaller portions..."
                className="w-full bg-surface-container-low border border-outline-variant rounded-xl p-3 text-xs focus:ring-2 focus:ring-primary focus:outline-none transition-all"
              />
            </div>

            {onScreenError && (
              <div id="student-on-screen-alert" className="p-4 bg-red-50 text-red-700 rounded-2xl border border-red-200 text-xs font-bold flex items-start gap-2.5 animate-bounce">
                <AlertCircle className="w-5 h-5 flex-shrink-0 text-red-600 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-extrabold uppercase tracking-wider text-[10px] text-red-800">Incomplete Submission Alert</p>
                  <p className="font-medium text-red-700 leading-normal">{onScreenError}</p>
                </div>
              </div>
            )}

            {/* Submit Button */}
            <button 
              type="submit"
              className="w-full py-3.5 bg-primary hover:bg-primary-hover text-white rounded-2xl font-extrabold text-sm shadow-md flex items-center justify-center gap-2 hover:-translate-y-0.5 active:scale-95 transition-all cursor-pointer"
            >
              <Send className="w-4 h-4" />
              Submit My Honest Feedback
            </button>

          </div>
        </form>
      )}
        </>
      ) : (
        /* Classroom Timetable View */
        <div className="bg-white rounded-2xl border border-outline-variant shadow-2xs p-6 space-y-6 animate-fade-in">
          {!profile?.class || !profile?.section ? (
            <div className="text-center p-8 text-sm text-on-surface-variant italic space-y-2">
              <AlertCircle className="w-8 h-8 text-amber-500 mx-auto" />
              <div>Please ask your school coordinator to assign your Class and Section to view your timetable.</div>
            </div>
          ) : (
            <>
              <div className="border-b border-outline-variant pb-4">
                <h2 className="text-lg font-bold text-primary flex items-center gap-2">
                  <Calendar className="w-5 h-5" />
                  Weekly Class Timetable: {profile.class} - {profile.section}
                </h2>
                <p className="text-xs text-on-surface-variant">
                  Standard 7-period schedule. Timings are set by the official mid-day meal guidelines.
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
                          const classClean = profile.class.replace('Class ', '');
                          const sectionClean = profile.section.replace('Section ', '');
                          
                          const entry = timetableEntries.find(e => 
                            e.day_of_week === day && 
                            e.period_number === pNum && 
                            e.class === classClean && 
                            e.section === sectionClean
                          );
                          const hasClassSubject = entry && entry.subject && entry.subject !== 'Free Period';
                          const subjectStr = hasClassSubject ? entry.subject : 'Free';
                          const teacherStr = hasClassSubject && entry.teacher_id && entry.teacher_id !== 'None' ? entry.teacher_id : '';
                          
                          return (
                            <td 
                              key={pNum} 
                              className={`p-3 border border-outline-variant transition-all ${!hasClassSubject ? 'bg-neutral-50/50 text-neutral-400' : 'bg-primary/5 font-semibold text-primary'}`}
                            >
                              <div className="font-bold text-sm">
                                {subjectStr}
                              </div>
                              {hasClassSubject && teacherStr && (
                                <div className="text-[10px] text-on-surface-variant font-medium mt-0.5">
                                  {teacherStr}
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
                          const classClean = profile.class.replace('Class ', '');
                          const sectionClean = profile.section.replace('Section ', '');
                          
                          const entry = timetableEntries.find(e => 
                            e.day_of_week === day && 
                            e.period_number === pNum && 
                            e.class === classClean && 
                            e.section === sectionClean
                          );
                          const hasClassSubject = entry && entry.subject && entry.subject !== 'Free Period';
                          const subjectStr = hasClassSubject ? entry.subject : 'Free';
                          const teacherStr = hasClassSubject && entry.teacher_id && entry.teacher_id !== 'None' ? entry.teacher_id : '';
                          
                          return (
                            <td 
                              key={pNum} 
                              className={`p-3 border border-outline-variant transition-all ${!hasClassSubject ? 'bg-neutral-50/50 text-neutral-400' : 'bg-primary/5 font-semibold text-primary'}`}
                            >
                              <div className="font-bold text-sm">
                                {subjectStr}
                              </div>
                              {hasClassSubject && teacherStr && (
                                <div className="text-[10px] text-on-surface-variant font-medium mt-0.5">
                                  {teacherStr}
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
                          const classClean = profile.class.replace('Class ', '');
                          const sectionClean = profile.section.replace('Section ', '');
                          
                          const entry = timetableEntries.find(e => 
                            e.day_of_week === day && 
                            e.period_number === pNum && 
                            e.class === classClean && 
                            e.section === sectionClean
                          );
                          const hasClassSubject = entry && entry.subject && entry.subject !== 'Free Period';
                          const subjectStr = hasClassSubject ? entry.subject : 'Free';
                          const teacherStr = hasClassSubject && entry.teacher_id && entry.teacher_id !== 'None' ? entry.teacher_id : '';
                          
                          return (
                            <td 
                              key={pNum} 
                              className={`p-3 border border-outline-variant transition-all ${!hasClassSubject ? 'bg-neutral-50/50 text-neutral-400' : 'bg-primary/5 font-semibold text-primary'}`}
                            >
                              <div className="font-bold text-sm">
                                {subjectStr}
                              </div>
                              {hasClassSubject && teacherStr && (
                                <div className="text-[10px] text-on-surface-variant font-medium mt-0.5">
                                  {teacherStr}
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
            </>
          )}
        </div>
      )}
    </div>
  );
}
