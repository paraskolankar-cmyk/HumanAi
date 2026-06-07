import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import Logo from './Logo';
import { 
  Mail, 
  Lock, 
  User, 
  ArrowRight, 
  Github, 
  Chrome,
  Sparkles,
  Phone
} from 'lucide-react';

interface AuthProps {
  onLogin: (email: string, name?: string, isNewUser?: boolean, mobile?: string) => void;
  isDarkMode?: boolean;
}

export default function Auth({ onLogin, isDarkMode }: AuthProps) {
  const [isLogin, setIsLogin] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [mobile, setMobile] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');

  const handleTabSwitch = (loginFlag: boolean) => {
    setIsLogin(loginFlag);
    setError('');
    setPassword('');
    setConfirmPassword('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    // Password validation for Sign Up
    if (!isLogin && password !== confirmPassword) {
      setError("Passwords do not match!");
      return;
    }

    setIsLoading(true);
    const normalizedEmail = email.trim().toLowerCase();
    
    try {
      if (isLogin) {
        // --- SECURE LOGIN MODE ---
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: normalizedEmail,
            password: password
          })
        });

        const data = await res.json();

        if (!res.ok) {
          // Backend agar error deta hai (wrong password ya user not found)
          setError(data.message || "Invalid email or password.");
          setIsLoading(false);
          return;
        }
        
        // Success: Trigger login state
        onLogin(normalizedEmail, data.name, false);

      } else {
        // --- SECURE SIGN-UP MODE ---
        const fullName = `${firstName} ${lastName}`.trim();
        const res = await fetch('/api/auth/signup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: normalizedEmail,
            password: password,
            name: fullName,
            mobile: mobile
          })
        });

        const data = await res.json();

        if (!res.ok) {
          // Backend agar bole ki user already exists ya validation fail ho
          setError(data.message || "Registration failed. Please try again.");
          setIsLoading(false);
          return;
        }

        // New user registration state clean-up
        localStorage.removeItem('humnai_assessment_completed');
        localStorage.removeItem('humnai_user_level');
        localStorage.removeItem('humnai_roadmap');
        localStorage.removeItem('humnai_completed_days');
        
        onLogin(normalizedEmail, fullName, true, mobile);
      }
    } catch (err: any) {
      console.error("Auth error:", err);
      setError("An error occurred during authentication. Please check your internet connection.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F9FAFB] dark:bg-[#111827] flex items-center justify-center p-4 transition-colors duration-300">
      <div className="max-w-md w-full">
        {/* Logo & Header */}
        <div className="flex flex-col items-center text-center mb-8">
          <Logo size="lg" />
          <p className="text-[#6B7280] dark:text-gray-400 mt-4">Master English with your AI Tutor</p>
        </div>

        {/* Auth Card */}
        <div className="bg-white dark:bg-[#1F2937] rounded-3xl shadow-sm border border-[#E5E7EB] dark:border-gray-700 overflow-hidden">
          <div className="p-8">
            <div className="flex gap-4 mb-8">
              <button 
                type="button"
                onClick={() => handleTabSwitch(true)}
                className={`flex-1 pb-2 text-sm font-bold uppercase tracking-wider transition-colors ${isLogin ? 'text-[#4F46E5] dark:text-indigo-400 border-b-2 border-[#4F46E5] dark:border-indigo-400' : 'text-[#6B7280] dark:text-gray-500'}`}
              >
                Sign In
              </button>
              <button 
                type="button"
                onClick={() => handleTabSwitch(false)}
                className={`flex-1 pb-2 text-sm font-bold uppercase tracking-wider transition-colors ${!isLogin ? 'text-[#4F46E5] dark:text-indigo-400 border-b-2 border-[#4F46E5] dark:border-indigo-400' : 'text-[#6B7280] dark:text-gray-500'}`}
              >
                Sign Up
              </button>
            </div>

            {error && (
              <motion.div 
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-6 p-4 border border-red-200 dark:border-red-900/30 bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 text-sm rounded-2xl flex items-center justify-center font-semibold text-center"
              >
                {error}
              </motion.div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <AnimatePresence mode="wait">
                {!isLogin && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="space-y-4"
                  >
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-[#6B7280] dark:text-gray-400 uppercase tracking-wider ml-1">First Name</label>
                        <div className="relative">
                          <User className="absolute left-4 top-1/2 -translate-y-1/2 text-[#9CA3AF]" size={18} />
                          <input 
                            type="text" 
                            placeholder="John"
                            required
                            value={firstName}
                            onChange={(e) => setFirstName(e.target.value)}
                            className="w-full pl-12 pr-4 py-3 bg-[#F9FAFB] dark:bg-gray-800 border border-[#E5E7EB] dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all text-[#111827] dark:text-white"
                          />
                        </div>
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-[#6B7280] dark:text-gray-400 uppercase tracking-wider ml-1">Last Name</label>
                        <div className="relative">
                          <User className="absolute left-4 top-1/2 -translate-y-1/2 text-[#9CA3AF]" size={18} />
                          <input 
                            type="text" 
                            placeholder="Doe"
                            required
                            value={lastName}
                            onChange={(e) => setLastName(e.target.value)}
                            className="w-full pl-12 pr-4 py-3 bg-[#F9FAFB] dark:bg-gray-800 border border-[#E5E7EB] dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all text-[#111827] dark:text-white"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-bold text-[#6B7280] dark:text-gray-400 uppercase tracking-wider ml-1">Mobile Number</label>
                      <div className="relative">
                        <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-[#9CA3AF]" size={18} />
                        <input 
                          type="tel" 
                          placeholder="+91 98765 43210"
                          required
                          value={mobile}
                          onChange={(e) => setMobile(e.target.value)}
                          className="w-full pl-12 pr-4 py-3 bg-[#F9FAFB] dark:bg-gray-800 border border-[#E5E7EB] dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all text-[#111827] dark:text-white"
                        />
                      </div>
                      <p className="text-[10px] text-[#6B7280] dark:text-gray-500 ml-1 italic">For daily reports and notifications</p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="space-y-1">
                <label className="text-xs font-bold text-[#6B7280] dark:text-gray-400 uppercase tracking-wider ml-1">Email Address</label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-[#9CA3AF]" size={18} />
                  <input 
                    type="email" 
                    placeholder="name@example.com"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-12 pr-4 py-3 bg-[#F9FAFB] dark:bg-gray-800 border border-[#E5E7EB] dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all text-[#111827] dark:text-white"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-[#6B7280] dark:text-gray-400 uppercase tracking-wider ml-1">{isLogin ? 'Password' : 'Create Password'}</label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-[#9CA3AF]" size={18} />
                  <input 
                    type="password" 
                    placeholder="••••••••"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-12 pr-4 py-3 bg-[#F9FAFB] dark:bg-gray-800 border border-[#E5E7EB] dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all text-[#111827] dark:text-white"
                  />
                </div>
              </div>

              {!isLogin && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-1"
                >
                  <label className="text-xs font-bold text-[#6B7280] dark:text-gray-400 uppercase tracking-wider ml-1">Confirm Password</label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-[#9CA3AF]" size={18} />
                    <input 
                      type="password" 
                      placeholder="••••••••"
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full pl-12 pr-4 py-3 bg-[#F9FAFB] dark:bg-gray-800 border border-[#E5E7EB] dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all text-[#111827] dark:text-white"
                    />
                  </div>
                </motion.div>
              )}

              {isLogin && (
                <div className="text-right">
                  <button type="button" className="text-xs font-bold text-[#4F46E5] dark:text-indigo-400 hover:underline">Forgot password?</button>
                </div>
              )}

              <button 
                type="submit"
                disabled={isLoading}
                className="w-full bg-[#111827] dark:bg-indigo-600 text-white py-4 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-black dark:hover:bg-indigo-700 transition-all disabled:opacity-50 mt-4 shadow-lg shadow-gray-200 dark:shadow-none"
              >
                {isLoading ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                ) : (
                  <>
                    {isLogin ? 'Sign In' : 'Create Account'}
                    <ArrowRight size={18} />
                  </>
                )}
              </button>
            </form>

            <div className="relative my-8">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-[#E5E7EB] dark:border-gray-700"></div>
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-white dark:bg-[#1F2937] px-2 text-[#9CA3AF] dark:text-gray-400 font-bold">Or continue with</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <button type="button" className="flex items-center justify-center gap-2 py-3 border border-[#E5E7EB] dark:border-gray-700 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors font-medium text-[#374151] dark:text-gray-300">
                <Chrome size={18} />
                Google
              </button>
              <button type="button" className="flex items-center justify-center gap-2 py-3 border border-[#E5E7EB] dark:border-gray-700 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors font-medium text-[#374151] dark:text-gray-300">
                <Github size={18} />
                GitHub
              </button>
            </div>
          </div>

          <div className="bg-[#F9FAFB] dark:bg-[#111827] p-6 text-center border-t border-[#E5E7EB] dark:border-gray-700">
            <p className="text-sm text-[#6B7280] dark:text-gray-400">
              {isLogin ? "Don't have an account?" : "Already have an account?"}{' '}
              <button 
                type="button"
                onClick={() => handleTabSwitch(!isLogin)}
                className="text-[#4F46E5] dark:text-indigo-400 font-bold hover:underline"
              >
                {isLogin ? 'Sign Up' : 'Sign In'}
              </button>
            </p>
          </div>
        </div>

        {/* Footer Info */}
        <div className="mt-8 flex items-center justify-center gap-2 text-xs text-[#9CA3AF] font-medium">
          <Sparkles size={14} className="text-amber-400" />
          <span>Join 10,000+ students learning English today</span>
        </div>
      </div>
    </div>
  );
}
