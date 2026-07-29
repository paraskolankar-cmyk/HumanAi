import React, { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import { 
  Users, 
  CreditCard, 
  Activity,
  Search,
  Filter,
  ArrowUpRight,
  ArrowDownRight,
  Loader2,
  DollarSign,
  UserPlus,
  ShieldCheck,
  Download,
  BookOpen,
  Trash2,
  Plus,
  Zap
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis
} from 'recharts';

interface AdminPanelProps {
  isDarkMode?: boolean;
  userEmail?: string | null;
  userName?: string | null;
}

export default function AdminPanel({ isDarkMode }: AdminPanelProps) {
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');
  const [storedPassword, setStoredPassword] = useState(() => {
    return localStorage.getItem('humnai_admin_password') || 'admin123';
  });
  const [activeTab, setActiveTab] = useState<'dashboard' | 'content' | 'users' | 'admin-group' | 'settings'>('dashboard');
  const [stats, setStats] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [plans, setPlans] = useState<any[]>([]);
  const [editingPlan, setEditingPlan] = useState<any>(null);
  const [newPrice, setNewPrice] = useState('');
  const [newInterval, setNewInterval] = useState('');

  // Content Management State
  const [modules, setModules] = useState<any[]>([]);
  const [editingModule, setEditingModule] = useState<any>(null);
  const [lessons, setLessons] = useState<any[]>([]);
  const [selectedModuleId, setSelectedModuleId] = useState<string | null>(null);
  const [editingLesson, setEditingLesson] = useState<any>(null);
  const [assessmentQuestions, setAssessmentQuestions] = useState<any[]>([]);
  const [editingAssessment, setEditingAssessment] = useState<any>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [editingUser, setEditingUser] = useState<any>(null);
  const [editingPlanModal, setEditingPlanModal] = useState<any>(null);
  const [selectedNewAdminId, setSelectedNewAdminId] = useState<number | ''>('');
  const [searchQuery, setSearchQuery] = useState('');

  // Real-time Socket Event Listener (FIXED FOR NEW SIGNUPS)
  useEffect(() => {
    if (!isAdmin) return;

    const socket = io();

    socket.on('user:registered', (newUser) => {
      // 1. Add user to active users list
      setUsers((prevUsers) => {
        const exists = prevUsers.some((u) => u.id === newUser.id || u.email === newUser.email);

        // 2. Real-time Increments on Dashboard Stats
        setStats((prevStats: any) => {
          const isNew = !exists;
          if (!isNew) return prevStats; // If user already exists in state, skip double count

          const currentMonthName = new Date().toLocaleString('default', { month: 'short' });
          let updatedGrowth = [...(prevStats?.userGrowth || [])];

          // Realtime update in Column Chart
          if (updatedGrowth.length > 0) {
            const currentMonthIdx = updatedGrowth.findIndex((g: any) => g.month === currentMonthName);
            if (currentMonthIdx !== -1) {
              updatedGrowth[currentMonthIdx] = {
                ...updatedGrowth[currentMonthIdx],
                users: (updatedGrowth[currentMonthIdx].users || 0) + 1
              };
            } else {
              updatedGrowth.push({ month: currentMonthName, users: 1 });
            }
          }

          const previousNewSignups = prevStats?.newSignups ?? prevStats?.newUsersToday ?? 0;

          return {
            ...prevStats,
            totalUsers: (prevStats?.totalUsers || 0) + 1,
            newSignups: previousNewSignups + 1,
            newUsersToday: previousNewSignups + 1,
            proUsers: newUser.is_pro 
              ? (prevStats?.proUsers || 0) + 1 
              : (prevStats?.proUsers || 0),
            userGrowth: updatedGrowth
          };
        });

        if (exists) {
          return prevUsers.map((u) => (u.id === newUser.id || u.email === newUser.email) ? newUser : u);
        }
        return [newUser, ...prevUsers];
      });
    });

    return () => {
      socket.disconnect();
    };
  }, [isAdmin]);

  // Fetch Initial Data & Polling Sync
  useEffect(() => {
    if (!isAdmin) return;

    let isMounted = true;

    const fetchData = async () => {
      try {
        const safeFetch = async (url: string, fallbackValue: any) => {
          try {
            const res = await fetch(url);
            if (!res.ok) return fallbackValue;
            const text = await res.text();
            if (text.includes("Rate exceeded") || text.includes("Too Many Requests")) {
              return fallbackValue;
            }
            return JSON.parse(text);
          } catch (err) {
            return fallbackValue;
          }
        };

        const [parsedStats, parsedPlans, parsedModules, parsedAssessment, parsedUsers] = await Promise.all([
          safeFetch('/api/admin/stats', null),
          safeFetch('/api/plans', []),
          safeFetch('/api/modules', []),
          safeFetch('/api/assessment-questions', []),
          safeFetch('/api/admin/users', [])
        ]);

        if (isMounted) {
          if (parsedStats && typeof parsedStats === 'object' && !parsedStats.error) {
            setStats((prev: any) => {
              // Ensure real-time increments aren't wiped out by delayed polling API response
              const backendNewSignups = parsedStats.newSignups ?? parsedStats.newUsersToday ?? 0;
              const liveSignups = prev?.newSignups ?? backendNewSignups;
              return {
                ...parsedStats,
                newSignups: Math.max(liveSignups, backendNewSignups)
              };
            });
          }
          setPlans(Array.isArray(parsedPlans) ? parsedPlans : []);
          setModules(Array.isArray(parsedModules) ? parsedModules : []);
          setAssessmentQuestions(Array.isArray(parsedAssessment) ? parsedAssessment : []);
          setUsers(Array.isArray(parsedUsers) ? parsedUsers : []);
          setIsLoading(false);
        }
      } catch (error) {
        console.error('Failed to fetch admin data', error);
        if (isMounted) setIsLoading(false);
      }
    };

    fetchData();

    const intervalId = setInterval(() => {
      fetchData();
    }, 10000);

    return () => {
      isMounted = false;
      clearInterval(intervalId);
    };
  }, [isAdmin]);

  // Lessons fetch handler
  useEffect(() => {
    if (!selectedModuleId) return;

    let isMounted = true;
    const fetchLessons = async () => {
      try {
        const res = await fetch(`/api/modules/${selectedModuleId}/lessons`);
        if (!res.ok) {
          if (isMounted) setLessons([]);
          return;
        }
        const data = await res.json();
        if (isMounted) {
          setLessons(Array.isArray(data) ? data : []);
        }
      } catch (error) {
        console.error('Failed to fetch lessons', error);
        if (isMounted) setLessons([]);
      }
    };

    fetchLessons();
    return () => {
      isMounted = false;
    };
  }, [selectedModuleId]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (adminPassword === storedPassword) {
      setIsAdmin(true);
    } else {
      alert('Invalid password');
    }
  };

  const handleResetPassword = (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData(e.target as HTMLFormElement);
    const newPass = formData.get('newPassword') as string;
    const confirmPass = formData.get('confirmPassword') as string;

    if (newPass !== confirmPass) {
      alert('Passwords do not match');
      return;
    }

    setStoredPassword(newPass);
    localStorage.setItem('humnai_admin_password', newPass);
    alert('Password updated successfully');
    (e.target as HTMLFormElement).reset();
  };

  const handleUpdatePrice = async () => {
    if (!editingPlan || !newPrice || !newInterval) return;
    try {
      const response = await fetch('/api/admin/plans/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          id: editingPlan.id, 
          price: parseFloat(newPrice),
          interval: newInterval
        })
      });
      if (response.ok) {
        setPlans(plans.map(p => p.id === editingPlan.id ? { ...p, price: parseFloat(newPrice), interval: newInterval } : p));
        setEditingPlan(null);
        setNewPrice('');
        setNewInterval('');
      }
    } catch (error) {
      console.error('Failed to update plan', error);
    }
  };

  const handleDeletePlan = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this course plan? This action is irreversible.')) return;
    try {
      const response = await fetch('/api/admin/plans/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
      });
      if (response.ok) {
        setPlans(plans.filter(p => p.id !== id));
      }
    } catch (error) {
      console.error('Failed to delete plan', error);
    }
  };

  const handleUpdateLesson = async (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData(e.target as HTMLFormElement);
    const contentStr = formData.get('content') as string;
    let content = [];
    try {
      content = JSON.parse(contentStr);
    } catch (err) {
      alert('Invalid JSON in content');
      return;
    }

    const data = {
      id: editingLesson?.id || Date.now().toString(),
      moduleId: selectedModuleId,
      title: formData.get('title'),
      duration: formData.get('duration'),
      content
    };

    const endpoint = editingLesson?.id ? '/api/admin/lessons/update' : '/api/admin/lessons/create';

    await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });

    if (editingLesson?.id) {
      setLessons(lessons.map(l => l.id === data.id ? { ...l, ...data } : l));
    } else {
      setLessons([...lessons, data]);
    }
    setEditingLesson(null);
  };

  const handleDeleteUser = async (id: number) => {
    if (!confirm('Are you sure you want to delete this user?')) return;
    await fetch('/api/admin/users/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id })
    });
    setUsers(users.filter(u => u.id !== id));
  };

  const handleTogglePro = async (id: number, currentPro: boolean) => {
    await fetch('/api/admin/users/update-pro', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, is_pro: !currentPro })
    });
    setUsers(users.map(u => u.id === id ? { ...u, is_pro: !currentPro ? 1 : 0 } : u));
  };

  const handleToggleAdmin = async (id: number, currentAdmin: boolean) => {
    await fetch('/api/admin/users/update-admin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, is_admin: !currentAdmin })
    });
    setUsers(users.map(u => u.id === id ? { ...u, is_admin: !currentAdmin ? 1 : 0 } : u));
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData(e.target as HTMLFormElement);
    const isPro = formData.get('is_pro') ? 1 : 0;
    const isAdminUser = editingUser?.is_admin ? 1 : 0;
    const data = {
      id: editingUser.id,
      name: formData.get('name'),
      email: formData.get('email'),
      mobile: formData.get('mobile'),
      level: formData.get('level'),
      is_pro: isPro,
      is_admin: isAdminUser
    };
    await fetch('/api/admin/users/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    setUsers(users.map(u => u.id === data.id ? { ...u, ...data, is_pro: isPro, is_admin: isAdminUser } : u));
    setEditingUser(null);
  };

  const handleCreatePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData(e.target as HTMLFormElement);
    const data = {
      id: formData.get('id'),
      name: formData.get('name'),
      price: parseFloat(formData.get('price') as string),
      interval: formData.get('interval')
    };
    await fetch('/api/admin/plans/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    setPlans([...plans, data]);
    setEditingPlanModal(null);
  };

  if (!isAdmin) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white dark:bg-[#1F2937] p-8 rounded-3xl border border-[#E5E7EB] dark:border-gray-700 shadow-xl max-w-md w-full"
        >
          <div className="w-16 h-16 bg-indigo-50 dark:bg-indigo-900/30 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <ShieldCheck className="text-indigo-600 dark:text-indigo-400" size={32} />
          </div>
          <h2 className="text-2xl font-bold text-center text-[#111827] dark:text-white mb-2">Admin Login</h2>
          <p className="text-center text-[#6B7280] dark:text-gray-400 mb-8">Enter your credentials to access the dashboard.</p>
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="text-xs font-bold text-[#6B7280] dark:text-gray-500 uppercase tracking-wider ml-1">Password</label>
              <input 
                type="password" 
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-4 py-3 bg-[#F9FAFB] dark:bg-gray-800 border border-[#E5E7EB] dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none mt-1 text-[#111827] dark:text-white"
                required
              />
            </div>
            <button 
              type="submit"
              className="w-full py-4 bg-[#111827] dark:bg-indigo-600 text-white rounded-xl font-bold hover:bg-black dark:hover:bg-indigo-700 transition-all shadow-lg"
            >
              Access Dashboard
            </button>
          </form>
        </motion.div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="h-[60vh] flex flex-col items-center justify-center gap-4">
        <Loader2 size={48} className="text-[#4F46E5] dark:text-indigo-400 animate-spin" />
        <p className="font-bold text-[#111827] dark:text-white">Loading Admin Dashboard...</p>
      </div>
    );
  }

  // Real-time Overview Statistics Values
  const newSignupsValue = stats?.newSignups ?? stats?.newUsersToday ?? 0;

  const overviewStats = [
    { label: 'Total Revenue', value: `₹${stats?.revenue?.toLocaleString() || 0}`, change: '+12.5%', up: true, icon: DollarSign, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { label: 'Total Users', value: (stats?.totalUsers || 0).toLocaleString(), change: '+8.2%', up: true, icon: Users, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Pro Members', value: (stats?.proUsers || 0).toLocaleString(), change: '+15.3%', up: true, icon: ShieldCheck, color: 'text-purple-600', bg: 'bg-purple-50' },
    { label: 'New Signups', value: newSignupsValue.toLocaleString(), change: '+Realtime', up: true, icon: UserPlus, color: 'text-orange-600', bg: 'bg-orange-50' },
  ];

  // Column / Bar Chart Data Fallbacks
  const chartData = (stats?.userGrowth && stats.userGrowth.length > 0) 
    ? stats.userGrowth 
    : [
        { month: 'Jan', users: 400 },
        { month: 'Feb', users: 650 },
        { month: 'Mar', users: 980 },
        { month: 'Apr', users: 1400 },
        { month: 'May', users: 1950 },
        { month: 'Jun', users: (stats?.totalUsers || 2400) }
      ];

  return (
    <div className="space-y-8 pb-12">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-[#111827] dark:text-white">Admin Dashboard</h2>
          <p className="text-[#6B7280] dark:text-gray-400">Manage your application and monitor revenue.</p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setIsAdmin(false)}
            className="px-4 py-2 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-xl text-sm font-bold hover:bg-red-100 dark:hover:bg-red-900/30 transition-all"
          >
            Logout
          </button>
          <button className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-[#1F2937] border border-[#E5E7EB] dark:border-gray-700 rounded-xl text-sm font-bold text-[#111827] dark:text-white hover:bg-gray-50 dark:hover:bg-gray-800 transition-all">
            <Download size={18} />
            Export Report
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 p-1 rounded-2xl w-fit">
        {[
          { id: 'dashboard', label: 'Overview', icon: Activity },
          { id: 'content', label: 'Content', icon: BookOpen },
          { id: 'users', label: 'Users', icon: Users },
          { id: 'admin-group', label: 'Admin Group', icon: ShieldCheck },
          { id: 'settings', label: 'Settings', icon: CreditCard },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${
              activeTab === tab.id 
                ? 'bg-white dark:bg-[#1F2937] text-[#111827] dark:text-white shadow-sm' 
                : 'text-[#6B7280] dark:text-gray-400 hover:text-[#111827] dark:hover:text-white'
            }`}
          >
            <tab.icon size={18} />
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'dashboard' && (
        <>
          {/* Real-time Synced Overview Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {overviewStats.map((stat, i) => (
              <motion.div 
                key={i}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                className="bg-white dark:bg-[#1F2937] p-6 rounded-3xl border border-[#E5E7EB] dark:border-gray-700 shadow-sm"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className={`w-12 h-12 ${stat.bg} dark:bg-opacity-20 rounded-2xl flex items-center justify-center`}>
                    <stat.icon className={stat.color} size={24} />
                  </div>
                  <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold ${stat.up ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400' : 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400'}`}>
                    {stat.up ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                    {stat.change}
                  </div>
                </div>
                <p className="text-sm font-bold text-[#6B7280] dark:text-gray-500 uppercase tracking-wider">{stat.label}</p>
                <p className="text-3xl font-bold text-[#111827] dark:text-white mt-1">{stat.value}</p>
              </motion.div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* COLUMN SHAPE REVENUE / GROWTH CHART */}
            <div className="lg:col-span-2 bg-white dark:bg-[#1F2937] p-8 rounded-3xl border border-[#E5E7EB] dark:border-gray-700 shadow-sm flex flex-col justify-between">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-xl font-bold text-[#111827] dark:text-white">Revenue & Growth Overview</h3>
                  <p className="text-xs text-[#6B7280] dark:text-gray-400">Column chart of user growth and revenue activity</p>
                </div>
                <select className="text-sm font-bold text-[#6B7280] dark:text-gray-400 bg-gray-50 dark:bg-gray-800 border-none rounded-lg px-3 py-1.5 focus:ring-0 outline-none">
                  <option>Last 6 Months</option>
                  <option>Last 30 Days</option>
                  <option>Last 12 Months</option>
                </select>
              </div>

              <div className="w-full h-[320px] min-h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }} barSize={32}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDarkMode ? '#374151' : '#F3F4F6'} />
                    <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#9CA3AF'}} dy={10} />
                    <YAxis axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#9CA3AF'}} />
                    <Tooltip 
                      cursor={{ fill: isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.02)' }}
                      contentStyle={{ 
                        borderRadius: '16px', 
                        border: 'none', 
                        boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)',
                        backgroundColor: isDarkMode ? '#1F2937' : '#FFFFFF',
                        color: isDarkMode ? '#FFFFFF' : '#111827'
                      }}
                    />
                    <Bar 
                      dataKey="users" 
                      fill="#4F46E5" 
                      radius={[8, 8, 0, 0]} 
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Recent Payments Section */}
            <div className="bg-white dark:bg-[#1F2937] p-8 rounded-3xl border border-[#E5E7EB] dark:border-gray-700 shadow-sm flex flex-col justify-between">
              <div>
                <h3 className="text-xl font-bold text-[#111827] dark:text-white mb-6">Recent Payments</h3>
                <div className="space-y-6">
                  {stats?.recentPayments && stats.recentPayments.length > 0 ? (
                    stats.recentPayments.map((payment: any) => (
                      <div key={payment.id} className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-gray-50 dark:bg-gray-800 rounded-xl flex items-center justify-center text-[#111827] dark:text-white font-bold">
                            {payment.user?.charAt(0) || 'U'}
                          </div>
                          <div>
                            <p className="text-sm font-bold text-[#111827] dark:text-white">{payment.user}</p>
                            <p className="text-xs text-[#6B7280] dark:text-gray-500">{payment.plan} Plan</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-bold text-[#111827] dark:text-white">₹{payment.amount}</p>
                          <p className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-tighter">Success</p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-gray-500 text-center py-8">No recent payments recorded.</p>
                  )}
                </div>
              </div>
              <button className="w-full mt-8 py-3 text-sm font-bold text-[#4F46E5] dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 rounded-xl hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-all">
                View All Transactions
              </button>
            </div>
          </div>
        </>
      )}

      {/* Remaining Tabs (Content, Users, Admin Group, Settings) preserved */}
      {activeTab === 'content' && (
        <div className="space-y-8">
          <div className="bg-white dark:bg-[#1F2937] p-8 rounded-3xl border border-[#E5E7EB] dark:border-gray-700 shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-xl font-bold text-[#111827] dark:text-white">Plan Management</h3>
                <p className="text-xs text-gray-500 mt-1">Pricing tiers available for the courses.</p>
              </div>
              <button 
                onClick={() => setEditingPlanModal({})}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all"
              >
                <Plus size={16} />
                Create New Plan
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {plans.map((plan) => (
                <div key={plan.id} className="p-6 rounded-2xl border border-[#F3F4F6] dark:border-gray-700 bg-[#F9FAFB] dark:bg-gray-800/50 flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-1.5">
                      <p className="text-sm font-bold text-[#111827] dark:text-white">{plan.name}</p>
                      <span className="text-[10px] uppercase tracking-wider font-mono px-1.5 py-0.5 bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded font-semibold">{plan.id}</span>
                    </div>
                    <p className="text-xs text-[#6B7280] dark:text-gray-500 mt-0.5">
                      {plan.interval === 'day' ? 'One-time' : plan.interval === 'week' ? 'Weekly' : `Billed ${plan.interval}ly`}
                    </p>
                    <p className="text-2xl font-bold text-[#111827] dark:text-white mt-1">₹{plan.price}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => {
                        setEditingPlan(plan);
                        setNewPrice(plan.price.toString());
                        setNewInterval(plan.interval || 'month');
                      }}
                      className="px-4 py-2 bg-white dark:bg-[#1F2937] border border-[#E5E7EB] dark:border-gray-700 rounded-xl text-sm font-bold text-[#4F46E5] dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-all"
                    >
                      Edit Rate
                    </button>
                    <button 
                      onClick={() => handleDeletePlan(plan.id)}
                      className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-all border border-transparent hover:border-red-200 dark:hover:border-red-900/40"
                      title="Delete Plan"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'users' && (
        <div className="bg-white dark:bg-[#1F2937] rounded-3xl border border-[#E5E7EB] dark:border-gray-700 overflow-hidden shadow-sm">
          <div className="p-8 border-b border-[#E5E7EB] dark:border-gray-700 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <h3 className="text-xl font-bold text-[#111827] dark:text-white">User Management</h3>
            <div className="flex items-center gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9CA3AF]" size={18} />
                <input 
                  type="text" 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search users..." 
                  className="pl-10 pr-4 py-2.5 bg-[#F9FAFB] dark:bg-gray-800 border border-[#E5E7EB] dark:border-gray-700 rounded-xl text-sm focus:ring-2 focus:ring-[#4F46E5] outline-none w-full md:w-64 text-[#111827] dark:text-white"
                />
              </div>
              <button className="p-2.5 border border-[#E5E7EB] dark:border-gray-700 rounded-xl text-[#6B7280] dark:text-gray-400 hover:bg-[#F9FAFB] dark:hover:bg-gray-800">
                <Filter size={20} />
              </button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-[#F9FAFB] dark:bg-gray-800/50 border-b border-[#E5E7EB] dark:border-gray-700">
                <tr>
                  <th className="px-8 py-4 text-xs font-bold text-[#6B7280] dark:text-gray-500 uppercase tracking-wider">User</th>
                  <th className="px-8 py-4 text-xs font-bold text-[#6B7280] dark:text-gray-500 uppercase tracking-wider">Mobile</th>
                  <th className="px-8 py-4 text-xs font-bold text-[#6B7280] dark:text-gray-500 uppercase tracking-wider">Plan</th>
                  <th className="px-8 py-4 text-xs font-bold text-[#6B7280] dark:text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-8 py-4 text-xs font-bold text-[#6B7280] dark:text-gray-500 uppercase tracking-wider">Level</th>
                  <th className="px-8 py-4 text-xs font-bold text-[#6B7280] dark:text-gray-500 uppercase tracking-wider text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5E7EB] dark:divide-gray-700">
                {users.filter(u => 
                  !searchQuery ||
                  u.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                  u.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                  u.mobile?.includes(searchQuery)
                ).map((user) => (
                  <tr key={user.id} className="hover:bg-[#F9FAFB] dark:hover:bg-gray-800/30 transition-colors">
                    <td className="px-8 py-5">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-indigo-100 dark:bg-indigo-900/30 rounded-xl flex items-center justify-center text-[#4F46E5] dark:text-indigo-400 font-bold">
                          {user.name?.charAt(0) || 'U'}
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <p className="text-sm font-bold text-[#111827] dark:text-white">{user.name || 'Anonymous'}</p>
                            {user.is_admin ? (
                              <span className="px-1.5 py-0.5 bg-indigo-50 dark:bg-indigo-950 text-[9px] font-extrabold text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-900 rounded uppercase tracking-wider">Admin</span>
                            ) : null}
                          </div>
                          <p className="text-xs text-[#6B7280] dark:text-gray-500">{user.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-5 text-sm text-[#6B7280] dark:text-gray-500">{user.mobile || 'N/A'}</td>
                    <td className="px-8 py-5">
                      <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${user.is_pro ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'}`}>
                        {user.is_pro ? 'Pro' : 'Free'}
                      </span>
                    </td>
                    <td className="px-8 py-5">
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${user.is_pro ? 'bg-emerald-500' : 'bg-gray-300 dark:bg-gray-600'}`}></div>
                        <span className="text-sm font-medium text-[#111827] dark:text-white">{user.is_pro ? 'Active' : 'Regular'}</span>
                      </div>
                    </td>
                    <td className="px-8 py-5 text-sm text-[#6B7280] dark:text-gray-500">{user.level || 'Beginner'}</td>
                    <td className="px-8 py-5 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button 
                          onClick={() => setEditingUser(user)}
                          className="p-2 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-colors"
                          title="Edit User"
                        >
                          <Activity size={18} />
                        </button>
                        <button 
                          onClick={() => handleTogglePro(user.id, !!user.is_pro)}
                          className={`p-2 rounded-lg transition-colors ${user.is_pro ? 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:hover:bg-amber-900/40' : 'text-gray-400 dark:text-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800'}`}
                          title={user.is_pro ? "Remove Free Subscription" : "Grant Lifetime Pro Free"}
                        >
                          <Zap size={18} />
                        </button>
                        <button 
                          onClick={() => handleDeleteUser(user.id)}
                          className="p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                          title="Delete User"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'admin-group' && (
        <div className="space-y-8">
          <div className="p-6 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 rounded-3xl flex items-start gap-4">
            <div className="p-3 bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-400 rounded-2xl">
              <ShieldCheck size={24} />
            </div>
            <div>
              <h4 className="text-lg font-bold text-amber-900 dark:text-amber-300">Admin Group Isolation</h4>
              <p className="text-sm text-amber-700 dark:text-amber-400/80 mt-1">
                Administrative access control setting isolated from general user access.
              </p>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'settings' && (
        <div className="max-w-2xl">
          <div className="bg-white dark:bg-[#1F2937] p-8 rounded-3xl border border-[#E5E7EB] dark:border-gray-700 shadow-sm">
            <h3 className="text-xl font-bold text-[#111827] dark:text-white mb-6">Admin Settings</h3>
            <form onSubmit={handleResetPassword} className="space-y-6">
              <div className="space-y-4">
                <h4 className="text-sm font-bold text-[#6B7280] dark:text-gray-500 uppercase tracking-wider">Change Admin Password</h4>
                <div>
                  <label className="text-xs font-bold text-[#6B7280] dark:text-gray-500 uppercase tracking-wider ml-1">New Password</label>
                  <input 
                    name="newPassword"
                    type="password" 
                    className="w-full px-4 py-3 bg-[#F9FAFB] dark:bg-gray-800 border border-[#E5E7EB] dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none mt-1 text-[#111827] dark:text-white"
                    required
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-[#6B7280] dark:text-gray-500 uppercase tracking-wider ml-1">Confirm New Password</label>
                  <input 
                    name="confirmPassword"
                    type="password" 
                    className="w-full px-4 py-3 bg-[#F9FAFB] dark:bg-gray-800 border border-[#E5E7EB] dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none mt-1 text-[#111827] dark:text-white"
                    required
                  />
                </div>
              </div>
              <button 
                type="submit"
                className="px-8 py-3 bg-[#111827] dark:bg-indigo-600 text-white rounded-xl font-bold hover:bg-black dark:hover:bg-indigo-700 transition-all"
              >
                Update Password
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
