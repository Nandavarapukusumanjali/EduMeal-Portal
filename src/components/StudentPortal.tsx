import React, { useState, useEffect } from 'react';
import { WEEKLY_MENU, StudentFeedback } from '../types';
import { ArrowLeft, Star, Heart, HelpCircle, Utensils, MessageSquare, Send, ThumbsUp, Coffee } from 'lucide-react';
import { auth } from '../firebase';
import { getUserProfile } from '../services/db';

interface StudentPortalProps {
  onAddFeedback: (feedback: StudentFeedback) => void;
  onBackToWelcome: () => void;
}

export default function StudentPortal({ onAddFeedback, onBackToWelcome }: StudentPortalProps) {
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

  // Synchronize authenticated student's full name from Firestore
  useEffect(() => {
    const loadStudentName = async () => {
      if (auth.currentUser) {
        try {
          const profile = await getUserProfile(auth.currentUser.uid);
          if (profile) {
            setStudentName(profile.name);
          }
        } catch (err) {
          console.error('Error fetching student profile name:', err);
        }
      }
    };
    loadStudentName();
  }, []);


  const handleSetItemRating = (item: string, stars: number) => {
    setItemRatings(prev => ({
      ...prev,
      [item]: stars
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Build the feedback object
    const ratingsObj: { [item: string]: number } = {};
    activeMenu.items.forEach(item => {
      ratingsObj[item] = itemRatings[item] || 4; // default to 4 stars if they didn't touch it
    });

    const newFeedback: StudentFeedback = {
      id: 'f-' + Date.now(),
      date: new Date().toISOString().split('T')[0],
      studentName: studentName,
      itemRatings: ratingsObj,
      serviceRatings: {
        taste: tasteRating || 4,
        quality: qualityRating || 4,
        temperature: tempRating || 4,
        behaviour: behaviourRating || 5, // default polite
        cleanliness: cleanlinessRating || 4
      },
      comments: commentText.trim()
    };

    onAddFeedback(newFeedback);
    setIsSubmitted(true);

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
          <span className="text-secondary font-extrabold uppercase tracking-widest text-xs">Student Feedback</span>
          <h2 className="font-headline-lg text-2xl md:text-3xl font-bold text-primary mt-1">How was your meal?</h2>
          <p className="text-on-surface-variant text-sm mt-1">
            Your anonymous rating helps the kitchen supervisor improve ingredients and cleanliness qualities!
          </p>
        </div>

        {/* Day simulator dropdown */}
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
      </div>

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
      ) : (
        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
          
          {/* Today's Menu Highlight Box */}
          <div className="md:col-span-4 bg-surface-container-lowest rounded-2xl border border-outline-variant shadow-xs overflow-hidden flex flex-col justify-between">
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
                  {renderStars(tasteRating, setTasteRating, 20)}
                </div>

                {/* Quality */}
                <div className="flex items-center justify-between gap-4">
                  <span className="text-xs font-semibold text-on-surface-variant">Raw Quality</span>
                  {renderStars(qualityRating, setQualityRating, 20)}
                </div>

                {/* Temp */}
                <div className="flex items-center justify-between gap-4">
                  <span className="text-xs font-semibold text-on-surface-variant">Food Temperature</span>
                  {renderStars(tempRating, setTempRating, 20)}
                </div>

                {/* Behaviour */}
                <div className="flex items-center justify-between gap-4">
                  <span className="text-xs font-semibold text-on-surface-variant">Serving Behavior</span>
                  {renderStars(behaviourRating, setBehaviourRating, 20)}
                </div>

                {/* Cleanliness */}
                <div className="flex items-center justify-between gap-4 col-span-1">
                  <span className="text-xs font-semibold text-on-surface-variant">Cleanliness / Hygiene</span>
                  {renderStars(cleanlinessRating, setCleanlinessRating, 20)}
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
    </div>
  );
}
