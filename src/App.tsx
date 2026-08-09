import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard, 
  BookOpen, 
  MessageSquare, 
  GraduationCap, 
  Settings, 
  Bell,
  User,
  ShieldCheck,
  Menu,
  X,
  LogOut,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  Sparkles,
  ArrowRight,
  Loader2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Dashboard from './components/Dashboard';
import Practice from './components/Practice';
import Conversation from './components/Conversation';
import Learning from './components/Learning';
import AdminPanel from './components/AdminPanel';
import Auth from './components/Auth';
import Profile from './components/Profile';
import Pricing from './components/Pricing';
import Logo from './components/Logo';
import OnboardingQuiz, { OnboardingData } from './components/OnboardingQuiz';
import { dbService } from './services/dbService';
import { humanAiService } from './services/geminiService';

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isAdmin, setIsAdmin] = useState(() => localStorage.getItem('humnai_user_email')?.includes('admin') || false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isOnboarding, setIsOnboarding] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userName, setUserName] = useState<string | null>(null);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isPro, setIsPro] = useState(() => {
    const email = localStorage.getItem('humnai_user_email');
    return localStorage.getItem('humnai_is_pro') === 'true' || (email?.includes('admin') || false);
  });
  const [showTrialModal, setShowTrialModal] = useState(false);
  const [trialTranslations, setTrialTranslations] = useState<any>(null);
  const [lastTranslatedLang, setLastTranslatedLang] = useState<string | null>(null);
  const [isTranslatingTrial, setIsTranslatingTrial] = useState(false);

  // Live Live Sync Effect for Database Pro Status
  useEffect(() => {
    const syncLiveUserStatus = async () => {
      const email = userEmail || localStorage.getItem('humnai_user_email');
      if (!email || !isAuthenticated) return;

      try {
        const res = await fetch(`/api/sync?email=${encodeURIComponent(email)}`);
        if (res.ok) {
          const data = await res.json();
          if (data && data.is_pro !== undefined) {
            const isUserPro = Boolean(data.is_pro) || email.includes('admin');
            setIsPro(isUserPro);
            localStorage.setItem('humnai_is_pro', String(isUserPro));
          }
          if (data && data.is_admin !== undefined) {
            const isUserAdmin = Boolean(data.is_admin) || email.includes('admin');
            setIsAdmin(isUserAdmin);
            localStorage.setItem('humnai_is_admin', String(isUserAdmin));
          }
        }
      } catch (err) {
        console.error("Live Pro status sync error:", err);
      }
    };

    syncLiveUserStatus();

    // Background interval to check every 8 seconds if Admin updated user's Pro status
    const interval = setInterval(() => {
      syncLiveUserStatus();
    }, 8000);

    return () => clearInterval(interval);
  }, [userEmail, isAuthenticated]);

  useEffect(() => {
    const checkTrial = async () => {
      if (isAuthenticated && !isPro && activeTab !== 'pricing' && activeTab !== 'profile') {
        let startTime = localStorage.getItem('humnai_trial_start_time');
        
        if (!startTime) {
          startTime = Date.now().toString();
          localStorage.setItem('humnai_trial_start_time', startTime);
        }

        const elapsed = Date.now() - parseInt(startTime);
        const twentyFourHours = 24 * 60 * 60 * 1000;

        if (elapsed >= twentyFourHours) {
          setShowTrialModal(true);
          
          const nativeLang = localStorage.getItem('humnai_user_language') || 'Hindi';
          
          if ((!trialTranslations || lastTranslatedLang !== nativeLang) && !isTranslatingTrial) {
            setIsTranslatingTrial(true);
            try {
              // FIX: previously used a direct @google/genai SDK call with
              // `process.env.GEMINI_API_KEY` (always undefined in the Vite
              // client bundle -- needs a VITE_ prefix to be exposed) and an
              // invalid model name ("gemini-3-flash-preview" doesn't exist),
              // so this ALWAYS silently failed and fell back to English.
              // Now reuses the shared, working geminiService REST pipeline
              // (same API key handling + model fallback chain as AI Chat).
              const result = await humanAiService.translateUIStrings(
                {
                  title: "Free Trial Expired!",
                  message: "Your 24-hour free trial has ended. Upgrade to Pro to unlock unlimited AI conversations and all learning modules.",
                  button: "Get Pro Plan",
                  secondary: "Maybe Later"
                },
                nativeLang
              );
              setTrialTranslations(result);
              setLastTranslatedLang(nativeLang);
            } catch (error) {
              console.error("Trial translation failed", error);
            } finally {
              setIsTranslatingTrial(false);
            }
          }
        }
      }
    };

    checkTrial();
  }, [isAuthenticated, isPro, activeTab, trialTranslations, isTranslatingTrial]);

  useEffect(() => {
    const savedTheme = localStorage.getItem('humnai_theme');
    if (savedTheme === 'dark') {
      setIsDarkMode(true);
    }
  }, []);

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('humnai_theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('humnai_theme', 'light');
    }
  }, [isDarkMode]);

  useEffect(() => {
    const auth = localStorage.getItem('humnai_auth');
    const email = localStorage.getItem('humnai_user_email');
    const onboarding = localStorage.getItem('humnai_onboarding_completed');
    
    if (auth === 'true' && email) {
      setIsAuthenticated(true);
      setUserEmail(email);
      setUserName(localStorage.getItem('humnai_user_name'));
      setIsAdmin(localStorage.getItem('humnai_is_admin') === 'true' || email.includes('admin'));
      
      dbService.getUser(email).then(user => {
        if (user) {
          if (user.name) {
            setUserName(user.name);
            localStorage.setItem('humnai_user_name', user.name);
          }
          if (user.is_pro || user.email?.includes('admin')) {
            setIsPro(true);
            localStorage.setItem('humnai_is_pro', 'true');
          } else {
            setIsPro(false);
            localStorage.setItem('humnai_is_pro', 'false');
          }
          if (user.is_admin || user.email?.includes('admin')) {
            setIsAdmin(true);
            localStorage.setItem('humnai_is_admin', 'true');
          } else {
            setIsAdmin(false);
            localStorage.setItem('humnai_is_admin', 'false');
          }
          if (user.onboarding) {
            localStorage.setItem('humnai_onboarding_completed', 'true');
            localStorage.setItem('humnai_user_language', user.onboarding.nativeLanguage);
          }
          if (user.progress) {
            localStorage.setItem('humnai_completed_days', JSON.stringify(user.progress));
          }
        } else {
          const storedName = localStorage.getItem('humnai_user_name') || email.split('@')[0];
          const storedMobile = localStorage.getItem('humnai_user_mobile') || undefined;
          const storedIsPro = localStorage.getItem('humnai_is_pro') === 'true';
          const storedDays = localStorage.getItem('humnai_completed_days');
          let storedProgress = null;
          try {
            if (storedDays) storedProgress = JSON.parse(storedDays);
          } catch(e) {}

          dbService.syncUser({
            email,
            name: storedName,
            mobile: storedMobile,
            isPro: storedIsPro,
            progress: storedProgress
          });
        }
      });

      if (onboarding !== 'true') {
        setIsOnboarding(true);
      }
    }
  }, []);

  const handleLogin = async (email: string, name?: string, isNewUser: boolean = false, mobile?: string) => {
    setIsAuthenticated(true);
    setUserEmail(email);
    if (name) setUserName(name);
    
    const isUserAdmin = email.includes('admin');
    setIsAdmin(isUserAdmin || localStorage.getItem('humnai_is_admin') === 'true');
    if (isUserAdmin) {
      setIsPro(true);
      localStorage.setItem('humnai_is_pro', 'true');
      setIsAdmin(true);
      localStorage.setItem('humnai_is_admin', 'true');
    }
    
    localStorage.setItem('humnai_auth', 'true');
    localStorage.setItem('humnai_user_email', email);
    if (name) localStorage.setItem('humnai_user_name', name);
    if (mobile) localStorage.setItem('humnai_user_mobile', mobile);

    const userData = await dbService.syncUser({ email, name, mobile });
    
    if (userData.is_pro || isUserAdmin) {
      setIsPro(true);
      localStorage.setItem('humnai_is_pro', 'true');
    } else {
      setIsPro(false);
      localStorage.setItem('humnai_is_pro', 'false');
    }

    if (userData.is_admin || isUserAdmin) {
      setIsAdmin(true);
      localStorage.setItem('humnai_is_admin', 'true');
    } else {
      setIsAdmin(false);
      localStorage.setItem('humnai_is_admin', 'false');
    }

    if (isNewUser) {
      setIsOnboarding(true);
      localStorage.removeItem('humnai_onboarding_completed');
    } else {
      const user = await dbService.getUser(email);
      if (user?.onboarding) {
        localStorage.setItem('humnai_onboarding_completed', 'true');
        setIsOnboarding(false);
      } else {
        setIsOnboarding(true);
      }
    }
  };

  const handleOnboardingComplete = async (data: OnboardingData) => {
    setIsOnboarding(false);
    localStorage.setItem('humnai_onboarding_completed', 'true');
    
    if (userEmail) {
      await dbService.syncUser({
        email: userEmail,
        onboarding: data
      });
    }
    
    localStorage.setItem('humnai_user_language', data.nativeLanguage);
    localStorage.setItem('humnai_user_level', data.proficiencyLevel);
    localStorage.setItem('humnai_user_education', data.educationStatus);
    if (data.otherEducation) {
      localStorage.setItem('humnai_user_education_other', data.otherEducation);
    }
  };

  const tabs = [
    { id: 'dashboard', label: 'Home', icon: LayoutDashboard, component: Dashboard },
    { id: 'practice', label: 'Practice', icon: BookOpen, component: Practice },
    { id: 'conversation', label: 'AI Chat', icon: MessageSquare, component: Conversation },
    { id: 'learning', label: 'Learning', icon: GraduationCap, component: Learning },
    { id: 'pricing', label: 'Pro Plan', icon: CreditCard, component: Pricing },
    { id: 'profile', label: 'Profile', icon: User, component: Profile },
  ];

  if (isAdmin) {
    tabs.push({ id: 'admin', label: 'Admin', icon: ShieldCheck, component: AdminPanel });
  }

  const handleTabChange = (tabId: string) => {
    setActiveTab(tabId);
    setIsMobileMenuOpen(false);
  };

  if (!isAuthenticated) {
    return <Auth onLogin={handleLogin} isDarkMode={isDarkMode} />;
  }

  if (isOnboarding) {
    return <OnboardingQuiz onComplete={handleOnboardingComplete} isDarkMode={isDarkMode} />;
  }

  const ActiveComponent = tabs.find(t => t.id === activeTab)?.component || Dashboard;

  return (
    <div className="min-h-screen bg-[#F8F9FA] dark:bg-[#111827] flex flex-col md:flex-row font-sans text-[#1A1A1A] dark:text-gray-100 pb-20 md:pb-0 transition-colors duration-300">
      {/* Mobile Header */}
      <header className="md:hidden h-16 bg-white dark:bg-[#1F2937] border-b border-[#E5E7EB] dark:border-gray-800 flex items-center justify-between px-6 sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setIsMobileMenuOpen(true)}
            className="p-2 -ml-2 text-[#6B7280] dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
          >
            <Menu size={24} />
          </button>
          <Logo size="sm" />
        </div>
        <div className="flex items-center gap-3">
          <button className="p-2 text-[#6B7280] dark:text-gray-400">
            <Bell size={20} />
          </button>
          <div 
            onClick={() => setActiveTab('profile')}
            className="w-8 h-8 rounded-full bg-[#E5E7EB] dark:bg-gray-700 flex items-center justify-center overflow-hidden border border-[#E5E7EB] dark:border-gray-600 cursor-pointer"
          >
            <User size={16} className="text-[#9CA3AF] dark:text-gray-400" />
          </div>
        </div>
      </header>

      {/* Mobile Sidebar Drawer */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMobileMenuOpen(false)}
              className="fixed inset-0 bg-black/50 z-[60] md:hidden backdrop-blur-sm"
            />
            <motion.nav 
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed inset-y-0 left-0 w-72 bg-white dark:bg-[#1F2937] z-[70] md:hidden flex flex-col shadow-2xl"
            >
              <div className="p-6 flex items-center justify-between border-b border-gray-100 dark:border-gray-800">
                <Logo />
                <button 
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <X size={24} />
                </button>
              </div>

              <div className="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => handleTabChange(tab.id)}
                    className={`w-full flex items-center gap-4 px-4 py-4 rounded-2xl transition-all ${
                      activeTab === tab.id 
                        ? 'bg-[#4F46E5] text-white shadow-lg shadow-indigo-100 dark:shadow-none' 
                        : 'text-[#6B7280] dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
                    }`}
                  >
                    <tab.icon size={22} />
                    <span className="font-bold text-lg">{tab.label}</span>
                  </button>
                ))}
              </div>

              <div className="p-6 border-t border-gray-100 dark:border-gray-800 space-y-4">
                <div className="flex items-center gap-4 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-2xl">
                  <div className="w-12 h-12 rounded-full bg-white dark:bg-gray-700 flex items-center justify-center border border-gray-200 dark:border-gray-600">
                    <User size={24} className="text-gray-400 dark:text-gray-500" />
                  </div>
                  <div>
                    <p className="font-bold text-gray-900 dark:text-white">{userName || 'User'}</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {isPro ? 'Pro Member' : 'Free Member'}
                    </p>
                  </div>
                </div>
                <button 
                  onClick={() => setIsAuthenticated(false)}
                  className="w-full flex items-center justify-center gap-2 p-4 text-red-600 font-bold hover:bg-red-50 dark:hover:bg-red-900/20 rounded-2xl transition-colors"
                >
                  <LogOut size={20} />
                  <span>Logout</span>
                </button>
              </div>
            </motion.nav>
          </>
        )}
      </AnimatePresence>

      {/* Desktop Sidebar */}
      <nav className={`hidden md:flex bg-white dark:bg-[#1F2937] border-r border-[#E5E7EB] dark:border-gray-800 flex-col h-screen sticky top-0 z-50 transition-all duration-300 ${isSidebarCollapsed ? 'w-20' : 'w-64'}`}>
        <div className="p-6 flex items-center justify-between">
          <Logo collapsed={isSidebarCollapsed} />
          <button 
            onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-all"
          >
            {isSidebarCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
          </button>
        </div>

        <div className="flex-1 px-4 py-4 space-y-1 overflow-y-auto overflow-x-hidden">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group relative ${
                activeTab === tab.id 
                  ? 'bg-[#4F46E5] text-white shadow-lg shadow-indigo-100 dark:shadow-none' 
                  : 'text-[#6B7280] dark:text-gray-400 hover:bg-[#F3F4F6] dark:hover:bg-gray-800 hover:text-[#111827] dark:hover:text-white'
              }`}
            >
              <tab.icon size={20} className="shrink-0" />
              {!isSidebarCollapsed && (
                <span className="font-medium whitespace-nowrap">{tab.label}</span>
              )}
              {isSidebarCollapsed && (
                <div className="absolute left-full ml-4 px-2 py-1 bg-[#111827] dark:bg-gray-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-[60]">
                  {tab.label}
                </div>
              )}
            </button>
          ))}
        </div>

        <div className="p-4 border-t border-[#E5E7EB] dark:border-gray-800 space-y-2">
          <button 
            onClick={() => setIsAdmin(!isAdmin)}
            className="w-full flex items-center gap-3 px-4 py-2 text-sm text-[#6B7280] dark:text-gray-400 hover:text-[#111827] dark:hover:text-white transition-colors"
          >
            <ShieldCheck size={16} className="shrink-0" />
            {!isSidebarCollapsed && <span>{isAdmin ? 'Switch to User' : 'Admin Access'}</span>}
          </button>
          
          <div 
            onClick={() => setActiveTab('profile')}
            className={`w-full flex items-center gap-3 px-3 py-3 bg-[#F9FAFB] dark:bg-gray-800/50 rounded-xl transition-all hover:bg-indigo-50 dark:hover:bg-indigo-900/20 group cursor-pointer ${activeTab === 'profile' ? 'ring-2 ring-[#4F46E5]/20' : ''}`}
          >
            <div className="w-8 h-8 rounded-full bg-[#E5E7EB] dark:bg-gray-700 flex items-center justify-center group-hover:bg-indigo-100 dark:group-hover:bg-indigo-900/40 transition-colors shrink-0">
              <User size={16} className="text-[#9CA3AF] dark:text-gray-400 group-hover:text-[#4F46E5] dark:group-hover:text-indigo-400" />
            </div>
            {!isSidebarCollapsed && (
              <div className="flex-1 min-w-0 text-left">
                <p className="text-sm font-semibold text-[#111827] dark:text-white truncate">{userName || 'User'}</p>
                <p className="text-xs text-[#6B7280] dark:text-gray-400 truncate flex items-center gap-1">
                  {isPro ? (
                    <span className="text-amber-500 font-bold">Pro Active</span>
                  ) : (
                    <span>Free Plan</span>
                  )}
                </p>
              </div>
            )}
          </div>
        </div>
      </nav>

      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white dark:bg-[#1F2937] border-t border-[#E5E7EB] dark:border-gray-800 px-4 py-2 flex items-center justify-around z-50 safe-area-bottom shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
        {tabs.slice(0, 5).map((tab) => (
          <button
            key={tab.id}
            onClick={() => handleTabChange(tab.id)}
            className={`flex flex-col items-center gap-1 p-2 rounded-xl transition-all relative ${
              activeTab === tab.id ? 'text-[#4F46E5]' : 'text-[#6B7280] dark:text-gray-400'
            }`}
          >
            <tab.icon size={20} />
            <span className="text-[10px] font-bold uppercase tracking-tighter">{tab.label}</span>
            {activeTab === tab.id && (
              <motion.div 
                layoutId="activeTab"
                className="absolute -top-2 w-1 h-1 bg-[#4F46E5] rounded-full"
              />
            )}
          </button>
        ))}
      </nav>

      {/* Main Content */}
      <main className="flex-1 min-h-screen overflow-y-auto bg-[#F8F9FA] dark:bg-[#111827] relative">
        <header className="hidden md:flex h-16 bg-white dark:bg-[#1F2937] border-b border-[#E5E7EB] dark:border-gray-800 items-center justify-between px-8 sticky top-0 z-40">
          <div className="flex items-center gap-4">
            <h2 className="text-lg font-bold text-[#111827] dark:text-white">
              {tabs.find(t => t.id === activeTab)?.label}
            </h2>
          </div>
          <div className="flex items-center gap-4">
            <button className="p-2 text-[#6B7280] dark:text-gray-400 hover:bg-[#F3F4F6] dark:hover:bg-gray-800 rounded-full relative transition-colors">
              <Bell size={20} />
              <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-white dark:border-gray-800"></span>
            </button>
            <div className="h-8 w-[1px] bg-[#E5E7EB] dark:bg-gray-800"></div>
            <button 
              onClick={() => setIsAuthenticated(false)}
              className="px-4 py-2 text-sm font-bold text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
            >
              Logout
            </button>
          </div>
        </header>

        <div className="p-4 md:p-8 max-w-7xl mx-auto">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              <ActiveComponent 
                onTabChange={handleTabChange} 
                isDarkMode={isDarkMode}
                onThemeToggle={() => setIsDarkMode(!isDarkMode)}
                userEmail={userEmail}
                userName={userName}
                isPro={isPro}
                onUpgrade={async () => {
                  setIsPro(true);
                  localStorage.setItem('humnai_is_pro', 'true');
                  if (userEmail) {
                    await dbService.syncUser({ email: userEmail, isPro: true });
                  }
                }}
                onTrialExpired={() => setShowTrialModal(true)}
              />
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Trial Expired Modal */}
        <AnimatePresence>
          {showTrialModal && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                onClick={() => setShowTrialModal(false)}
              />
              <motion.div 
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                className="relative bg-white dark:bg-[#1F2937] rounded-[2.5rem] shadow-2xl border border-[#E5E7EB] dark:border-gray-700 p-8 md:p-10 max-w-md w-full overflow-hidden"
              >
                <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-3xl -mr-16 -mt-16" />
                <div className="absolute bottom-0 left-0 w-24 h-24 bg-amber-500/10 rounded-full blur-2xl -ml-12 -mb-12" />

                <div className="relative z-10 text-center space-y-6">
                  <div className="flex justify-center mb-2">
                    <Logo size="lg" />
                  </div>
                  
                  <div className="w-20 h-20 bg-amber-50 dark:bg-amber-900/20 rounded-3xl flex items-center justify-center mx-auto text-amber-500 dark:text-amber-400 shadow-inner">
                    <Sparkles size={40} />
                  </div>
                  
                  <div className="space-y-2">
                    <h3 className="text-2xl md:text-3xl font-black text-[#111827] dark:text-white tracking-tight">
                      {trialTranslations?.title || "Free Trial Expired!"}
                    </h3>
                    <p className="text-[#6B7280] dark:text-gray-400 font-medium leading-relaxed">
                      {trialTranslations?.message || "Your 24-hour free trial has ended. Upgrade to Pro to unlock unlimited AI conversations and all learning modules."}
                    </p>
                  </div>

                  <div className="space-y-3 pt-4">
                    <button 
                      onClick={() => {
                        setActiveTab('pricing');
                        setShowTrialModal(false);
                      }}
                      disabled={isTranslatingTrial}
                      className="w-full py-4 bg-[#4F46E5] text-white rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-indigo-600 transition-all shadow-lg shadow-indigo-100 dark:shadow-none group disabled:opacity-50"
                    >
                      {isTranslatingTrial ? (
                        <Loader2 className="animate-spin" size={20} />
                      ) : (
                        <>
                          {trialTranslations?.button || "Get Pro Plan"}
                          <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                        </>
                      )}
                    </button>
                    <button 
                      onClick={() => setShowTrialModal(false)}
                      className="w-full py-3 text-sm font-bold text-[#6B7280] dark:text-gray-400 hover:text-[#111827] dark:hover:text-white transition-colors"
                    >
                      {trialTranslations?.secondary || "Maybe Later"}
                    </button>
                  </div>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        <footer className="p-8 mt-auto border-t border-gray-100 dark:border-gray-800 text-center">
          <p className="text-sm font-medium text-gray-400 italic">
            Practice english with <span className="text-indigo-500 font-bold">HumnAi</span> just like a human.
          </p>
        </footer>
      </main>
    </div>
  );
}
