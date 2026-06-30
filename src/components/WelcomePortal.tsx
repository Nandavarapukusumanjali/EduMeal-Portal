import React, { useState } from 'react';
import { Role } from '../types';
import { 
  BookOpen, Utensils, Shield, Users, Radio, Phone, 
  HelpCircle, GraduationCap, Lock, User, ArrowLeft, AlertCircle, Sparkles, UserPlus, LogIn, X
} from 'lucide-react';
import { authenticateRole, signUpUser } from '../services/auth';

interface WelcomePortalProps {
  onSelectRole: (role: Role) => void;
}

export default function WelcomePortal({ onSelectRole }: WelcomePortalProps) {
  // State to track if we are in the Gate Login mode for a particular role
  const [selectedGateRole, setSelectedGateRole] = useState<Role | null>(null);
  const [isSignUpMode, setIsSignUpMode] = useState(false);
  const [isUserGuideOpen, setIsUserGuideOpen] = useState(false);

  // Form input states
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [errorStatus, setErrorStatus] = useState('');
  const [loading, setLoading] = useState(false);

  // Handle Initiating the Login flow for a specific portal
  const handleInitiateLogin = (role: Role) => {
    setSelectedGateRole(role);
    setIsSignUpMode(false);
    setUsername('');
    setPassword('');
    setErrorStatus('');
  };

  // Perform password / code validation
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setErrorStatus('');

    const trimmedUser = username.trim();
    const trimmedPass = password.trim();

    if (!trimmedUser) {
      setErrorStatus('Please enter a username or name.');
      return;
    }
    if (!trimmedPass) {
      setErrorStatus('Please enter your security access PIN / password.');
      return;
    }

    if (!selectedGateRole) return;

    setLoading(true);
    try {
      if (isSignUpMode) {
        await signUpUser(trimmedUser, trimmedPass, selectedGateRole);
        setIsSignUpMode(false);
        setPassword('');
        setErrorStatus(`Success! Account registered. Please enter your PIN/password now to log in.`);
      } else {
        await authenticateRole(trimmedUser, trimmedPass, selectedGateRole);
        onSelectRole(selectedGateRole);
      }
    } catch (err: any) {
      setErrorStatus(err.message || 'Authentication error occurred.');
    } finally {
      setLoading(false);
    }
  };


  // Custom visual attributes based on selection
  const getRoleHeaderDetails = () => {
    switch (selectedGateRole) {
      case 'student':
        return {
          title: 'Student Feedback',
          subtitle: 'Use your Roll Number and Date of Birth (YYYY-MM-DD) to access your attendance profile.',
          themeColor: 'border-primary text-primary bg-primary/5',
          bannerColor: 'bg-primary',
          icon: <BookOpen className="w-6 h-6" />,
          userLabel: 'Student Roll Number',
          passwordLabel: 'Security PIN (DOB)',
          passwordPlaceholder: 'e.g., 2012-05-15',
          userPlaceholder: 'e.g., 701'
        };
      case 'teacher':
        return {
          title: isSignUpMode ? 'Classroom Teacher Registration' : 'Teacher Attendance Portal',
          subtitle: isSignUpMode ? 'Register a teacher account to manage classroom registries.' : 'Authorized portal for managing class students and daily attendance reports.',
          themeColor: 'border-secondary text-secondary bg-secondary/5',
          bannerColor: 'bg-secondary',
          icon: <Users className="w-6 h-6" />,
          userLabel: 'Staff Username',
          passwordLabel: 'Security PIN',
          passwordPlaceholder: 'Choose a PIN (e.g. 1234)',
          userPlaceholder: 'e.g., teacher'
        };
      case 'supervisor':
        return {
          title: isSignUpMode ? 'Supervisor Registration' : 'Supervisor Audits & Monitoring',
          subtitle: isSignUpMode ? 'Register a supervisor account for audits.' : 'Dashboard for monitoring food wastage, preparation audits, and school health records.',
          themeColor: 'border-emerald-600 text-emerald-600 bg-emerald-50',
          bannerColor: 'bg-emerald-700',
          icon: <Shield className="w-6 h-6" />,
          userLabel: 'Supervisor Username',
          passwordLabel: 'Security PIN',
          passwordPlaceholder: 'Choose a PIN',
          userPlaceholder: 'e.g., supervisor'
        };
      case 'admin':
        return {
          title: isSignUpMode ? 'Admin Registration' : 'System Administration & Settings',
          subtitle: isSignUpMode ? 'Register a system admin.' : 'Full access portal for system-level configurations, audit logging, and principal approval workflows.',
          themeColor: 'border-red-600 text-red-600 bg-red-50',
          bannerColor: 'bg-red-700',
          icon: <GraduationCap className="w-6 h-6" />,
          userLabel: 'Officer Username',
          passwordLabel: 'Admin Password',
          passwordPlaceholder: 'Choose a password (e.g. 1234)',
          userPlaceholder: 'e.g., admin'
        };
      case 'coordinator':
        return {
          title: 'Coordinator Registry & Setup',
          subtitle: 'Administrative control panel for managing class assignments, student transfers, and system configurations.',
          themeColor: 'border-amber-600 text-amber-600 bg-amber-50',
          bannerColor: 'bg-amber-700',
          icon: <Radio className="w-6 h-6" />,
          userLabel: 'Coordinator Username',
          passwordLabel: 'Security PIN',
          passwordPlaceholder: 'Choose a PIN',
          userPlaceholder: 'e.g., coord_north'
        };
      default:
        return null;
    }
  };

  const loginMeta = getRoleHeaderDetails();

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="fixed top-0 w-full z-50 bg-primary shadow-md h-16 flex items-center justify-between px-6 border-b border-white/15">
        <div 
          onClick={() => setSelectedGateRole(null)} 
          className="flex items-center gap-3 cursor-pointer"
        >
          <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center text-white">
            <Utensils className="w-5 h-5" />
          </div>
          <div>
            <h1 className="font-headline-md text-xl md:text-2xl font-extrabold text-white tracking-tight">EduMeal Portal</h1>
            <p className="text-[10px] text-white/80 font-medium tracking-wide">STATE MID-DAY MEAL SCHEME</p>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <div 
            onClick={() => setIsUserGuideOpen(true)}
            className="flex items-center gap-2 text-white hover:underline cursor-pointer font-medium text-sm"
          >
            <HelpCircle className="w-4 h-4" />
            <span className="hidden sm:inline">User Guide</span>
          </div>
        </div>
      </header>

      {/* Conditional: Main Hub Selection OR Active Portal Login Gate Page */}
      {!selectedGateRole ? (
        <>
          {/* Hero Section */}
          <div className="pt-24 pb-12 bg-primary text-white px-6 relative overflow-hidden flex flex-col items-center text-center">
            {/* Subtle grid pattern background */}
            <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#ffffff_1px,transparent_1px)] [background-size:16px_16px]"></div>
            
            <div className="relative z-10 max-w-4xl">
              <span className="px-3 py-1 bg-white/20 rounded-full text-xs font-bold tracking-wider uppercase mb-4 inline-block text-white">
                Government of Andhra Pradesh • Official Portal
              </span>
              <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight text-white mb-4 leading-tight">
                Smart Mid-Day Meal Feedback <br className="hidden md:block"/>& Waste Reduction System
              </h2>
              <p className="text-base text-white/95 max-w-2xl mx-auto mb-8 font-light">
                Streamlining meal distributions, maximizing plate quality, tracking attendance numbers, and automating wastage statistics for educational audit excellence.
              </p>

              <div className="flex flex-wrap justify-center gap-3">
                <div className="flex items-center gap-2 bg-white/15 px-4 py-2 rounded-lg text-xs font-medium border border-white/20 text-white">
                  <Shield className="w-3.5 h-3.5 text-amber-300" />
                  <span>Secure Login Protocol</span>
                </div>
                <div className="flex items-center gap-2 bg-white/15 px-4 py-2 rounded-lg text-xs font-medium border border-white/20 text-white font-headline-sm">
                  <Radio className="w-3.5 h-3.5 text-emerald-300 animate-pulse" />
                  <span>Real-time Interactive Audits</span>
                </div>
              </div>
            </div>
          </div>

          {/* Portal Grid */}
          <main className="flex-1 max-w-5xl mx-auto w-full px-6 py-12">
            <h3 className="text-center font-bold text-lg md:text-xl text-primary mb-8 tracking-tight uppercase">
              Select Authority Portal
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Student Portal Card */}
              <div 
                onClick={() => handleInitiateLogin('student')}
                className="group cursor-pointer bg-surface-container-lowest p-6 rounded-2xl shadow-sm border border-outline-variant hover:border-primary-container hover:-translate-y-1 transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-white transition-colors mb-4">
                    <BookOpen className="w-6 h-6" />
                  </div>
                  <h4 className="font-headline-sm text-lg font-bold text-primary group-hover:text-primary-container mb-2">Student Portal</h4>
                  <p className="text-sm text-on-surface-variant font-light leading-relaxed mb-6">
                    Access today's menu, view nutritional details, rate your meal quality, and submit taste and service behavior feedback.
                  </p>
                </div>
                <button className="w-full bg-primary text-white font-semibold text-sm py-2.5 rounded-lg group-hover:bg-primary-hover shadow-sm transition-all focus:ring-2 focus:ring-primary/20">
                  Enter Student Portal →
                </button>
              </div>

              {/* Teacher Portal Card */}
              <div 
                onClick={() => handleInitiateLogin('teacher')}
                className="group cursor-pointer bg-surface-container-lowest p-6 rounded-2xl shadow-sm border border-outline-variant hover:border-secondary hover:-translate-y-1 transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="w-12 h-12 rounded-xl bg-secondary/10 flex items-center justify-center text-secondary group-hover:bg-secondary group-hover:text-white transition-colors mb-4">
                    <Users className="w-6 h-6" />
                  </div>
                  <h4 className="font-headline-sm text-lg font-bold text-secondary group-hover:text-secondary-hover mb-2 font-headline-md">Teacher Portal</h4>
                  <p className="text-sm text-on-surface-variant font-light leading-relaxed mb-6">
                    Manage your classroom registries, add/edit students, track attendance levels, and submit meal counts for accurate kitchen distribution.
                  </p>
                </div>
                <button className="w-full bg-secondary text-white font-semibold text-sm py-2.5 rounded-lg group-hover:bg-secondary-hover shadow-sm transition-all focus:ring-2 focus:ring-secondary/20">
                  Enter Teacher Portal →
                </button>
              </div>

              {/* Kitchen Supervisor Card */}
              <div 
                onClick={() => handleInitiateLogin('supervisor')}
                className="group cursor-pointer bg-surface-container-lowest p-6 rounded-2xl shadow-sm border border-outline-variant hover:border-tertiary hover:-translate-y-1 transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="w-12 h-12 rounded-xl bg-tertiary-container/10 flex items-center justify-center text-tertiary group-hover:bg-tertiary group-hover:text-white transition-colors mb-4">
                    <Utensils className="w-6 h-6 animate-pulse" />
                  </div>
                  <h4 className="font-headline-sm text-lg font-bold text-tertiary mb-2">Kitchen Supervisor</h4>
                  <p className="text-sm text-on-surface-variant font-light leading-relaxed mb-6">
                    Access automatic attendance counters, calculate required raw food materials, customize weekly plans, and submit daily wastage stats.
                  </p>
                </div>
                <button className="w-full bg-tertiary text-white font-semibold text-sm py-2.5 rounded-lg hover:opacity-90 shadow-sm transition-all focus:ring-2 focus:ring-tertiary/20">
                  Enter Kitchen Portal →
                </button>
              </div>

              {/* Admin / Headmaster Card */}
              <div 
                onClick={() => handleInitiateLogin('admin')}
                className="group cursor-pointer bg-surface-container-lowest p-6 rounded-2xl shadow-sm border border-outline-variant hover:border-red-700 hover:-translate-y-1 transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="w-12 h-12 rounded-xl bg-red-100 flex items-center justify-center text-red-700 group-hover:bg-red-700 group-hover:text-white transition-colors mb-4">
                    <GraduationCap className="w-6 h-6" />
                  </div>
                  <h4 className="font-headline-sm text-lg font-bold text-red-700 mb-2 font-headline-md">Principal (Headmaster)</h4>
                  <p className="text-sm text-on-surface-variant font-light leading-relaxed mb-6">
                    Inspect consolidated audits, approve coordinator proposals, review real-time wastage, and download official compliance sheets.
                  </p>
                </div>
                <button className="w-full bg-red-700 text-white font-semibold text-sm py-2.5 rounded-lg hover:bg-red-800 shadow-sm transition-all focus:ring-2 focus:ring-red-700/20">
                  Enter Principal Portal →
                </button>
              </div>

              {/* School Coordinator Card */}
              <div 
                onClick={() => handleInitiateLogin('coordinator')}
                className="group cursor-pointer bg-surface-container-lowest p-6 rounded-2xl shadow-sm border border-outline-variant hover:border-emerald-700 hover:-translate-y-1 transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="w-12 h-12 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-700 group-hover:bg-emerald-700 group-hover:text-white transition-colors mb-4">
                    <Shield className="w-6 h-6" />
                  </div>
                  <h4 className="font-headline-sm text-lg font-bold text-emerald-700 mb-2 font-headline-md">School Coordinator</h4>
                  <p className="text-sm text-on-surface-variant font-light leading-relaxed mb-6">
                    Manage rosters, assign class teachers, submit student transfer applications, and file pending credentials approvals to the Headmaster.
                  </p>
                </div>
                <button className="w-full bg-emerald-700 text-white font-semibold text-sm py-2.5 rounded-lg hover:bg-emerald-800 shadow-sm transition-all focus:ring-2 focus:ring-emerald-700/20">
                  Enter Coordinator Portal →
                </button>
              </div>
            </div>

          </main>
        </>
      ) : (
        /* Render Roles Secure Login Screen */
        <main className="flex-1 flex flex-col items-center justify-center max-w-lg mx-auto w-full px-6 pt-24 pb-12">
          
          {/* Back button */}
          <button 
            type="button"
            onClick={() => setSelectedGateRole(null)}
            className="self-start flex items-center gap-2 text-xs font-bold text-primary hover:underline mb-6"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to portal selection
          </button>

          {/* Secure Login Card */}
          <div className="bg-surface-container-lowest w-full rounded-2xl border border-outline-variant shadow-md overflow-hidden">
            {/* Header banner */}
            <div className={`${loginMeta?.bannerColor} p-6 text-white flex items-center gap-4`}>
              <div className="p-3 bg-white/20 rounded-xl">
                {loginMeta?.icon}
              </div>
              <div>
                <span className="text-[9px] uppercase font-extrabold tracking-widest text-[#ef9900] bg-black/25 px-2 py-0.5 rounded-full inline-block">
                  Secure Gate Node
                </span>
                <h3 className="text-xl font-extrabold tracking-tight">{loginMeta?.title}</h3>
              </div>
            </div>

            {/* Login form body */}
            <form onSubmit={handleLoginSubmit} className="p-6 space-y-4">
              
              <p className="text-xs text-on-surface-variant font-light leading-relaxed bg-surface-container px-3.5 py-3 rounded-xl border border-outline-variant">
                {loginMeta?.subtitle}
              </p>

              {/* Error messages */}
              {errorStatus && (
                <div className="bg-red-50 text-red-600 p-3.5 rounded-xl border border-red-200 text-xs flex items-start gap-2 animate-shake">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <span className="whitespace-pre-line">{errorStatus}</span>
                </div>
              )}

              {/* Field 1: User identifier */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-on-surface-variant block">
                  {loginMeta?.userLabel}
                </label>
                <div className="relative">
                  <User className="w-4 h-4 absolute left-3 top-3 text-on-surface-variant/50" />
                  <input 
                    type="text"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder={loginMeta?.userPlaceholder}
                    className="w-full pl-9 pr-4 py-2 bg-white border border-outline-variant rounded-xl text-xs font-semibold focus:ring-2 focus:ring-primary/20 focus:outline-none"
                  />
                </div>
              </div>

              {/* Field 2: Pass/Access Code */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-on-surface-variant block">
                    {loginMeta?.passwordLabel}
                  </label>
                </div>
                <div className="relative">
                  <Lock className="w-4 h-4 absolute left-3 top-3 text-on-surface-variant/50" />
                  <input 
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={loginMeta?.passwordPlaceholder}
                    className="w-full pl-9 pr-4 py-2 bg-white border border-outline-variant rounded-xl text-xs font-semibold focus:ring-2 focus:ring-primary/20 focus:outline-none"
                  />
                </div>
              </div>

              {/* Action buttons */}
              <div className="pt-4 grid grid-cols-2 gap-3">
                <button 
                  type="button"
                  disabled={loading}
                  onClick={() => setSelectedGateRole(null)}
                  className="py-2.5 bg-surface-container border border-outline-variant text-[#222222] font-extrabold text-xs rounded-xl hover:bg-surface-container-high transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  disabled={loading}
                  className={`${loginMeta?.bannerColor} text-white font-extrabold text-xs rounded-xl hover:opacity-95 shadow-sm transition-opacity disabled:opacity-50 flex items-center justify-center p-2.5 cursor-pointer`}
                >
                  {loading ? (isSignUpMode ? 'Registering...' : 'Verifying...') : (isSignUpMode ? 'Register Account' : 'Verify & Enter')}
                </button>
              </div>

            </form>
          </div>
        </main>
      )}

      {/* Footer */}
      <footer className="bg-surface-container-low border-t border-outline-variant py-8 px-6 text-xs text-on-surface-variant mt-auto">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row justify-between gap-6 items-center">
          <div className="space-y-1 text-center md:text-left">
            <p className="font-semibold text-primary">EduMeal Portal — Andhra Pradesh School Education</p>
            <p>© 2026 AP School Monitoring Wing. All Rights Reserved.</p>
          </div>
          <div className="flex gap-4 flex-wrap justify-center">
            <span className="hover:underline cursor-pointer">Privacy Policy</span>
            <span className="hover:underline cursor-pointer">Accessibility</span>
            <span className="hover:underline cursor-pointer">MDM Portal GOI</span>
            <span className="hover:underline cursor-pointer">Ministry of Education</span>
          </div>
        </div>
      </footer>

      {/* User Guide Modern Modal Overlay */}
      {isUserGuideOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl w-full max-w-2xl max-h-[85vh] overflow-y-auto shadow-2xl flex flex-col">
            {/* Modal Header */}
            <div className="bg-primary p-5 text-white flex items-center justify-between sticky top-0 z-10 border-b border-white/10">
              <div className="flex items-center gap-2.5">
                <HelpCircle className="w-5 h-5 text-amber-300" />
                <h3 className="font-headline-md text-base md:text-lg font-extrabold tracking-tight">EduMeal Portal User Guide</h3>
              </div>
              <button 
                onClick={() => setIsUserGuideOpen(false)}
                className="p-1 px-2.5 rounded-lg bg-white/10 text-white hover:bg-white/20 transition-colors font-extrabold cursor-pointer flex items-center justify-center text-xs"
                title="Close Guide"
              >
                <X className="w-4 h-4 mr-1 inline" />
                <span>Close</span>
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 space-y-6 font-sans">
              <div className="p-4 bg-primary/5 border border-primary/10 rounded-xl">
                <p className="text-xs font-semibold text-on-surface-variant italic leading-relaxed">
                  Welcome to the EduMeal Portal - Andhra Pradesh State Mid-Day Meal Compliance Audit & Smart Wastage analytics platform. This system connects students, teaching staff, and kitchen supervisors to maintain delicious, hygienic, and waste-free meal services.
                </p>
              </div>

              {/* Roles Breakdown */}
              <div className="space-y-5">
                <h4 className="text-xs font-extrabold uppercase text-secondary tracking-widest border-b border-outline-variant pb-1.5">Authority Role Guides</h4>

                {/* Student */}
                <div className="flex gap-4 items-start bg-surface-container rounded-xl p-4 border border-outline-variant">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary flex-shrink-0 mt-0.5">
                    <BookOpen className="w-4 h-4" />
                  </div>
                  <div>
                    <h5 className="text-sm font-extrabold text-primary">Student Portal</h5>
                    <p className="text-xs text-on-surface-variant font-light mt-1 leading-relaxed">
                      Students can access their feedback card to rate the lunchtime meal items out of 5 stars. They can also score critical service quality parameters like <strong className="text-primary font-bold">Cleanliness/Hygiene</strong> near the text label, and suggest improvements.
                    </p>
                  </div>
                </div>

                {/* Teacher */}
                <div className="flex gap-4 items-start bg-surface-container rounded-xl p-4 border border-outline-variant">
                  <div className="w-8 h-8 rounded-lg bg-secondary/10 flex items-center justify-center text-secondary flex-shrink-0 mt-0.5">
                    <Users className="w-4 h-4" />
                  </div>
                  <div>
                    <h5 className="text-sm font-extrabold text-secondary">Classroom Teacher Portal</h5>
                    <p className="text-xs text-on-surface-variant font-light mt-1 leading-relaxed">
                      Teachers register and manage student attendance registries for <strong className="text-primary font-bold">Class 6 through 10 (Section A and Section B)</strong>. They can count and submit daily lunchrolls. If today's rolls aren't marked yet, the dashboard shows yesterday's historical data as standard compliance focus.
                    </p>
                  </div>
                </div>

                {/* Kitchen supervisor */}
                <div className="flex gap-4 items-start bg-surface-container rounded-xl p-4 border border-outline-variant">
                  <div className="w-8 h-8 rounded-lg bg-tertiary/10 flex items-center justify-center text-tertiary flex-shrink-0 mt-0.5">
                    <Utensils className="w-4 h-4" />
                  </div>
                  <div>
                    <h5 className="text-sm font-extrabold text-tertiary">Kitchen Supervisor Console</h5>
                    <p className="text-xs text-on-surface-variant font-light mt-1 leading-relaxed">
                      Supervisors calculate raw ingredients requirements (Rice, Dal, Eggs, Vegetables) based on the teacher's active present count. The <strong className="text-primary font-bold">computed calculator</strong> scales to precise decimal kg parameters. In the <strong className="text-primary font-bold">Daily Wastage Module</strong>, they log daily cooked vs. consumed weights to track leftover percentages.
                    </p>
                  </div>
                </div>

                {/* Headmaster / admin */}
                <div className="flex gap-4 items-start bg-surface-container rounded-xl p-4 border border-outline-variant">
                  <div className="w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center text-red-700 flex-shrink-0 mt-0.5">
                    <GraduationCap className="w-4 h-4" />
                  </div>
                  <div>
                    <h5 className="text-sm font-extrabold text-red-700">Headmaster / Admin Dashboard</h5>
                    <p className="text-xs text-on-surface-variant font-light mt-1 leading-relaxed">
                      Administrators view consolidated daily wastage trends, check cleanliness metrics from children's logs in real-time, generate automated mid-day compliance recommendations, and oversee students registration lists.
                    </p>
                  </div>
                </div>
              </div>

              {/* Quick instructions */}
              <div className="space-y-2">
                <h4 className="text-xs font-extrabold uppercase text-secondary tracking-widest border-b border-outline-variant pb-1.5">How to log in or register</h4>
                <p className="text-xs text-on-surface-variant font-light leading-relaxed">
                  Simply select your role, choose the <strong>Sign Up / Register</strong> tab on the login screen to register your name/email/PIN, and then switch back to the <strong>Log In</strong> tab to verify your credentials and enter.
                </p>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="bg-surface-container-low p-4 text-right border-t border-outline-variant rounded-b-2xl sticky bottom-0">
              <button 
                onClick={() => setIsUserGuideOpen(false)}
                className="px-5 py-2 bg-secondary text-white font-extrabold text-xs rounded-xl hover:opacity-90 shadow-sm transition-opacity cursor-pointer inline-block"
              >
                Understood, Let's Go!
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
