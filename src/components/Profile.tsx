import React, { useState } from 'react';
import { 
  User, 
  Mail, 
  Phone, 
  Camera, 
  Save, 
  Shield, 
  Bell, 
  Globe,
  CheckCircle2,
  Crown,
  CreditCard,
  ArrowRight,
  Moon,
  Sun,
  ChevronDown
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface ProfileProps {
  onTabChange?: (tabId: string) => void;
  isDarkMode?: boolean;
  onThemeToggle?: () => void;
  userEmail: string | null;
  userName: string | null;
  isPro?: boolean;
}

// Native Languages List
const NATIVE_LANGUAGES = [
  'Hindi',
  'Marathi',
  'Urdu',
  'Telugu',
  'Tamil',
  'Kannada',
  'Assamese',
  'Malayalam',
  'Bhojpuri',
  'Bengali',
  'Odia',
  'Punjabi',
  'Gujarati',
  'Spanish',
  'French',
  'German',
  'Japanese',
  'English'
];

export default function Profile({ onTabChange, isDarkMode, onThemeToggle, userEmail, userName, isPro }: ProfileProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [showSavedToast, setShowSavedToast] = useState(false);
  const [securityModal, setSecurityModal] = useState<'password' | '2fa' | 'delete' | null>(null);
  const [passwordData, setPasswordData] = useState({ current: '', new: '', confirm: '' });
  
  // Split name into first and last
  const nameParts = (userName || 'Rahul Sharma').split(' ');
  const initialFirstName = nameParts[0] || '';
  const initialLastName = nameParts.slice(1).join(' ') || '';

  const [profile, setProfile] = useState({
    firstName: initialFirstName,
    lastName: initialLastName,
    email: userEmail || 'rahul.sharma@example.com',
    mobile: localStorage.getItem('humnai_user_mobile') || '+91 98765 43210',
    bio: localStorage.getItem('humnai_user_bio') || 'Passionate English learner aiming for fluency. Love reading and traveling.',
    level: localStorage.getItem('humnai_user_level') || 'Intermediate',
    nativeLanguage: localStorage.getItem('humnai_user_language') || 'Hindi',
    joinedDate: 'January 2024',
    isPro: isPro || false,
    avatarUrl: localStorage.getItem('humnai_user_avatar') || null
  });

  // Update profile if props change
  React.useEffect(() => {
    if (userEmail || userName || isPro !== undefined) {
      const parts = (userName || '').split(' ');
      setProfile(prev => ({
        ...prev,
        firstName: parts[0] || prev.firstName,
        lastName: parts.slice(1).join(' ') || prev.lastName,
        email: userEmail || prev.email,
        isPro: isPro ?? prev.isPro
      }));
    }
  }, [userEmail, userName, isPro]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsEditing(false);
    
    // Save to localStorage
    localStorage.setItem('humnai_user_name', `${profile.firstName} ${profile.lastName}`);
    localStorage.setItem('humnai_user_mobile', profile.mobile);
    localStorage.setItem('humnai_user_bio', profile.bio);
    localStorage.setItem('humnai_user_language', profile.nativeLanguage);
    if (profile.avatarUrl) {
      localStorage.setItem('humnai_user_avatar', profile.avatarUrl);
    }
    
    // Backend API Sync
    if (profile.email) {
      try {
        await fetch('/api/user/update-profile', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: profile.email,
            nativeLanguage: profile.nativeLanguage,
            mobile: profile.mobile,
            bio: profile.bio
          })
        });
      } catch (err) {
        console.error("Failed to sync profile with server:", err);
      }
    }

    setShowSavedToast(true);
    setTimeout(() => setShowSavedToast(false), 3000);
  };

  const handleSecurityAction = (e: React.FormEvent) => {
    e.preventDefault();
    setSecurityModal(null);
    setShowSavedToast(true);
    setTimeout(() => setShowSavedToast(false), 3000);
  };

  const handleDeleteAccount = async () => {
    try {
      const response = await fetch('/api/user/delete-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          email: profile.email,
          mobile: profile.mobile 
        })
      });
      
      if (response.ok) {
        localStorage.clear();
        window.location.reload();
      } else {
        const error = await response.json();
        alert(error.error || "Failed to delete account");
      }
    } catch (error) {
      console.error("Delete account error:", error);
      alert("Failed to delete account. Please try again.");
    }
  };

  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        setProfile(prev => ({ ...prev, avatarUrl: base64String }));
        localStorage.setItem('humnai_user_avatar', base64String);
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-12">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-[#111827] dark:text-white">My Profile</h2>
          <p className="text-[#6B7280] dark:text-gray-400">Manage your personal information and preferences.</p>
        </div>
        <button 
          onClick={() => setIsEditing(!isEditing)}
          className={`px-6 py-2 rounded-xl font-bold transition-all ${
            isEditing 
              ? 'bg-white dark:bg-gray-800 border border-[#E5E7EB] dark:border-gray-700 text-[#6B7280] dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700' 
              : 'bg-[#4F46E5] text-white hover:bg-indigo-600 shadow-lg shadow-indigo-100 dark:shadow-none'
          }`}
        >
          {isEditing ? 'Cancel' : 'Edit Profile'}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Avatar & Quick Stats */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white dark:bg-[#1F2937] rounded-3xl border border-[#E5E7EB] dark:border-gray-700 p-8 text-center shadow-sm">
            <div className="relative inline-block mb-4">
              <input 
                type="file" 
                ref={fileInputRef}
                onChange={handleImageUpload}
                accept="image/*"
                className="hidden"
              />
              <div className="w-32 h-32 bg-indigo-50 dark:bg-indigo-900/20 rounded-full flex items-center justify-center text-[#4F46E5] dark:text-indigo-400 text-4xl font-bold border-4 border-white dark:border-gray-800 shadow-md overflow-hidden">
                {profile.avatarUrl ? (
                  <img src={profile.avatarUrl} alt="Profile" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                ) : (
                  <span>{profile.firstName[0]}{profile.lastName[0]}</span>
                )}
              </div>
              {profile.isPro && (
                <div className="absolute -top-2 -right-2 bg-amber-400 text-white p-2 rounded-full border-4 border-white dark:border-gray-800 shadow-lg">
                  <Crown size={16} />
                </div>
              )}
              {isEditing && (
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute bottom-0 right-0 p-2 bg-[#111827] dark:bg-indigo-600 text-white rounded-full border-2 border-white dark:border-gray-800 hover:scale-110 transition-transform"
                >
                  <Camera size={16} />
                </button>
              )}
            </div>
            <h3 className="text-xl font-bold text-[#111827] dark:text-white">{profile.firstName} {profile.lastName}</h3>
            <p className="text-sm text-[#6B7280] dark:text-gray-400 mb-6">{profile.level} Learner</p>
            
            <div className="grid grid-cols-2 gap-4 pt-6 border-t border-[#F3F4F6] dark:border-gray-700">
              <div>
                <p className="text-xs font-bold text-[#6B7280] dark:text-gray-400 uppercase tracking-wider">Streak</p>
                <p className="text-lg font-bold text-orange-500">12 Days</p>
              </div>
              <div>
                <p className="text-xs font-bold text-[#6B7280] dark:text-gray-400 uppercase tracking-wider">Lessons</p>
                <p className="text-lg font-bold text-[#4F46E5] dark:text-indigo-400">48</p>
              </div>
            </div>
          </div>

          {/* Subscription Card */}
          <div className={`rounded-3xl p-6 shadow-sm border ${profile.isPro ? 'bg-indigo-600 text-white border-indigo-700' : 'bg-white dark:bg-[#1F2937] border-[#E5E7EB] dark:border-gray-700'}`}>
            <div className="flex items-center justify-between mb-4">
              <h4 className={`font-bold flex items-center gap-2 ${profile.isPro ? 'text-white' : 'text-[#111827] dark:text-white'}`}>
                <CreditCard size={18} />
                Subscription
              </h4>
              {profile.isPro && <span className="text-[10px] font-bold uppercase tracking-widest bg-white/20 px-2 py-1 rounded-full">Pro</span>}
            </div>
            
            {profile.isPro ? (
              <div className="space-y-4">
                <p className="text-sm opacity-90">Your Pro subscription is active until Jan 2025.</p>
                <button 
                  onClick={() => onTabChange?.('pricing')}
                  className="w-full py-2.5 bg-white/10 hover:bg-white/20 rounded-xl text-xs font-bold transition-all"
                >
                  Manage Subscription
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-sm text-[#6B7280] dark:text-gray-400">You are currently on the Free Starter plan.</p>
                <button 
                  onClick={() => onTabChange?.('pricing')}
                  className="w-full py-3 bg-[#111827] dark:bg-indigo-600 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 hover:bg-black dark:hover:bg-indigo-700 transition-all"
                >
                  Upgrade to Pro
                  <ArrowRight size={14} />
                </button>
              </div>
            )}
          </div>

          {/* Appearance Section */}
          <div className="bg-white dark:bg-[#1F2937] rounded-3xl border border-[#E5E7EB] dark:border-gray-700 p-6 shadow-sm space-y-4">
            <h4 className="font-bold text-[#111827] dark:text-white flex items-center gap-2">
              <Sun size={18} className="text-[#4F46E5]" />
              Appearance
            </h4>
            <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800/50 rounded-2xl border border-gray-100 dark:border-gray-700">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${isDarkMode ? 'bg-indigo-500/10 text-indigo-400' : 'bg-amber-500/10 text-amber-500'}`}>
                  {isDarkMode ? <Moon size={16} /> : <Sun size={16} />}
                </div>
                <div>
                  <p className="text-sm font-bold text-gray-900 dark:text-white">Dark Mode</p>
                  <p className="text-[10px] text-gray-500 dark:text-gray-400">Switch between light and dark theme</p>
                </div>
              </div>
              <button 
                onClick={onThemeToggle}
                className={`relative w-12 h-6 rounded-full transition-colors duration-200 focus:outline-none ${isDarkMode ? 'bg-indigo-600' : 'bg-gray-200'}`}
              >
                <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform duration-200 ${isDarkMode ? 'translate-x-6' : 'translate-x-0'}`} />
              </button>
            </div>
          </div>

          {/* Account Security */}
          <div className="bg-white dark:bg-[#1F2937] rounded-3xl border border-[#E5E7EB] dark:border-gray-700 p-6 shadow-sm space-y-4">
            <h4 className="font-bold text-[#111827] dark:text-white flex items-center gap-2">
              <Shield size={18} className="text-[#4F46E5]" />
              Account Security
            </h4>
            <div className="space-y-3">
              <button 
                onClick={() => setSecurityModal('password')}
                className="w-full text-left text-sm text-[#6B7280] hover:text-[#4F46E5] transition-colors"
              >
                Change Password
              </button>
              <button 
                onClick={() => setSecurityModal('2fa')}
                className="w-full text-left text-sm text-[#6B7280] hover:text-[#4F46E5] transition-colors"
              >
                Two-Factor Auth
              </button>
              <button 
                onClick={() => setSecurityModal('delete')}
                className="w-full text-left text-sm text-red-500 hover:text-red-600 transition-colors"
              >
                Delete Account
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Profile Form */}
        <div className="lg:col-span-2">
          <div className="bg-white dark:bg-[#1F2937] rounded-3xl border border-[#E5E7EB] dark:border-gray-700 shadow-sm overflow-hidden">
            <form onSubmit={handleSave} className="p-8 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-[#6B7280] dark:text-gray-400 uppercase tracking-wider ml-1">First Name</label>
                  <div className="relative">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 text-[#9CA3AF]" size={18} />
                    <input 
                      type="text" 
                      disabled={!isEditing}
                      value={profile.firstName}
                      onChange={(e) => setProfile({...profile, firstName: e.target.value})}
                      className="w-full pl-12 pr-4 py-3 bg-[#F9FAFB] dark:bg-gray-800/50 border border-[#E5E7EB] dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all disabled:opacity-60 dark:text-white"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-[#6B7280] dark:text-gray-400 uppercase tracking-wider ml-1">Last Name</label>
                  <div className="relative">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 text-[#9CA3AF]" size={18} />
                    <input 
                      type="text" 
                      disabled={!isEditing}
                      value={profile.lastName}
                      onChange={(e) => setProfile({...profile, lastName: e.target.value})}
                      className="w-full pl-12 pr-4 py-3 bg-[#F9FAFB] dark:bg-gray-800/50 border border-[#E5E7EB] dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all disabled:opacity-60 dark:text-white"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-[#6B7280] dark:text-gray-400 uppercase tracking-wider ml-1">Email Address</label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-[#9CA3AF]" size={18} />
                  <input 
                    type="email" 
                    disabled={!isEditing}
                    value={profile.email}
                    onChange={(e) => setProfile({...profile, email: e.target.value})}
                    className="w-full pl-12 pr-4 py-3 bg-[#F9FAFB] dark:bg-gray-800/50 border border-[#E5E7EB] dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all disabled:opacity-60 dark:text-white"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-[#6B7280] dark:text-gray-400 uppercase tracking-wider ml-1">Mobile Number</label>
                <div className="relative">
                  <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-[#9CA3AF]" size={18} />
                  <input 
                    type="tel" 
                    disabled={!isEditing}
                    value={profile.mobile}
                    onChange={(e) => setProfile({...profile, mobile: e.target.value})}
                    className="w-full pl-12 pr-4 py-3 bg-[#F9FAFB] dark:bg-gray-800/50 border border-[#E5E7EB] dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all disabled:opacity-60 dark:text-white"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-[#6B7280] dark:text-gray-400 uppercase tracking-wider ml-1">Bio</label>
                <textarea 
                  disabled={!isEditing}
                  value={profile.bio}
                  onChange={(e) => setProfile({...profile, bio: e.target.value})}
                  rows={4}
                  className="w-full px-4 py-3 bg-[#F9FAFB] dark:bg-gray-800/50 border border-[#E5E7EB] dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all disabled:opacity-60 resize-none dark:text-white"
                />
              </div>

              {/* NATIVE LANGUAGE DROPDOWN SECTION */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-[#6B7280] dark:text-gray-400 uppercase tracking-wider ml-1 flex items-center gap-1">
                    <Globe size={14} className="text-indigo-600 dark:text-indigo-400" />
                    Native Language
                  </label>
                  <div className="relative">
                    <Globe className="absolute left-4 top-1/2 -translate-y-1/2 text-[#9CA3AF]" size={18} />
                    <select 
                      disabled={!isEditing}
                      value={profile.nativeLanguage}
                      onChange={(e) => setProfile({...profile, nativeLanguage: e.target.value})}
                      className="w-full pl-12 pr-10 py-3 bg-[#F9FAFB] dark:bg-gray-800/50 border border-[#E5E7EB] dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all disabled:opacity-60 appearance-none dark:text-white font-medium cursor-pointer"
                    >
                      {NATIVE_LANGUAGES.map((lang) => (
                        <option key={lang} value={lang} className="dark:bg-gray-800">
                          {lang}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-[#9CA3AF] pointer-events-none" size={18} />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-[#6B7280] dark:text-gray-400 uppercase tracking-wider ml-1">Notification Prefs</label>
                  <div className="relative">
                    <Bell className="absolute left-4 top-1/2 -translate-y-1/2 text-[#9CA3AF]" size={18} />
                    <select 
                      disabled={!isEditing}
                      className="w-full pl-12 pr-10 py-3 bg-[#F9FAFB] dark:bg-gray-800/50 border border-[#E5E7EB] dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all disabled:opacity-60 appearance-none dark:text-white cursor-pointer"
                    >
                      <option>All Notifications</option>
                      <option>Only Important</option>
                      <option>None</option>
                    </select>
                    <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-[#9CA3AF] pointer-events-none" size={18} />
                  </div>
                </div>
              </div>

              {isEditing && (
                <motion.button 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  type="submit"
                  className="w-full bg-[#111827] dark:bg-indigo-600 text-white py-4 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-black dark:hover:bg-indigo-700 transition-all shadow-lg shadow-gray-200 dark:shadow-none cursor-pointer"
                >
                  <Save size={18} />
                  Save Changes
                </motion.button>
              )}
            </form>
          </div>
        </div>
      </div>

      {/* Toast Notification */}
      {showSavedToast && (
        <motion.div 
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 50 }}
          className="fixed bottom-8 right-8 bg-[#111827] text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3 z-50"
        >
          <CheckCircle2 className="text-emerald-400" size={24} />
          <span className="font-bold">Settings updated successfully!</span>
        </motion.div>
      )}

      {/* Security Modals */}
      <AnimatePresence>
        {securityModal === 'password' && (
          <motion.div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div className="bg-white dark:bg-[#1F2937] rounded-3xl p-8 max-w-md w-full shadow-2xl border border-[#E5E7EB] dark:border-gray-700">
              <h4 className="text-2xl font-bold text-[#111827] dark:text-white mb-6">Change Password</h4>
              <form onSubmit={handleSecurityAction} className="space-y-4">
                <div>
                  <label className="text-xs font-bold text-[#6B7280] dark:text-gray-400 uppercase tracking-wider ml-1">Current Password</label>
                  <input type="password" required className="w-full px-4 py-3 bg-[#F9FAFB] dark:bg-gray-800/50 border border-[#E5E7EB] dark:border-gray-700 rounded-xl outline-none mt-1 dark:text-white" />
                </div>
                <div>
                  <label className="text-xs font-bold text-[#6B7280] dark:text-gray-400 uppercase tracking-wider ml-1">New Password</label>
                  <input type="password" required className="w-full px-4 py-3 bg-[#F9FAFB] dark:bg-gray-800/50 border border-[#E5E7EB] dark:border-gray-700 rounded-xl outline-none mt-1 dark:text-white" />
                </div>
                <div>
                  <label className="text-xs font-bold text-[#6B7280] dark:text-gray-400 uppercase tracking-wider ml-1">Confirm New Password</label>
                  <input type="password" required className="w-full px-4 py-3 bg-[#F9FAFB] dark:bg-gray-800/50 border border-[#E5E7EB] dark:border-gray-700 rounded-xl outline-none mt-1 dark:text-white" />
                </div>
                <div className="flex gap-3 pt-4">
                  <button type="button" onClick={() => setSecurityModal(null)} className="flex-1 py-3 bg-gray-100 dark:bg-gray-800 text-[#6B7280] dark:text-gray-400 rounded-xl font-bold">Cancel</button>
                  <button type="submit" className="flex-1 py-3 bg-[#4F46E5] text-white rounded-xl font-bold">Update Password</button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}

        {securityModal === '2fa' && (
          <motion.div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div className="bg-white dark:bg-[#1F2937] rounded-3xl p-8 max-w-md w-full shadow-2xl border border-[#E5E7EB] dark:border-gray-700 text-center">
              <div className="w-16 h-16 bg-indigo-100 dark:bg-indigo-900/30 rounded-full flex items-center justify-center text-[#4F46E5] dark:text-indigo-400 mx-auto mb-6">
                <Shield size={32} />
              </div>
              <h4 className="text-2xl font-bold text-[#111827] dark:text-white mb-2">Two-Factor Authentication</h4>
              <p className="text-[#6B7280] dark:text-gray-400 mb-8">Add an extra layer of security to your account by requiring a code from your phone.</p>
              <div className="flex gap-3">
                <button onClick={() => setSecurityModal(null)} className="flex-1 py-3 bg-gray-100 dark:bg-gray-800 text-[#6B7280] dark:text-gray-400 rounded-xl font-bold">Cancel</button>
                <button onClick={handleSecurityAction} className="flex-1 py-3 bg-[#4F46E5] text-white rounded-xl font-bold">Enable 2FA</button>
              </div>
            </motion.div>
          </motion.div>
        )}

        {securityModal === 'delete' && (
          <motion.div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div className="bg-white dark:bg-[#1F2937] rounded-3xl p-8 max-w-md w-full shadow-2xl border border-[#E5E7EB] dark:border-gray-700 text-center">
              <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center text-red-600 dark:text-red-400 mx-auto mb-6">
                <Shield size={32} />
              </div>
              <h4 className="text-2xl font-bold text-[#111827] dark:text-white mb-2">Delete Account?</h4>
              <p className="text-[#6B7280] dark:text-gray-400 mb-8">This action is permanent and cannot be undone. All your progress and data will be lost.</p>
              <div className="flex gap-3">
                <button onClick={() => setSecurityModal(null)} className="flex-1 py-3 bg-gray-100 dark:bg-gray-800 text-[#6B7280] dark:text-gray-400 rounded-xl font-bold">Cancel</button>
                <button onClick={handleDeleteAccount} className="flex-1 py-3 bg-red-600 text-white rounded-xl font-bold">Yes, Delete</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
