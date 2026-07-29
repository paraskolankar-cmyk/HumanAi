import React, { useEffect, useState, useRef } from 'react';
import { 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell
} from 'recharts';
import { 
  TrendingUp, 
  Clock, 
  Target, 
  Award,
  Play,
  CheckCircle2,
  BookOpen
} from 'lucide-react';

interface DashboardProps {
  onTabChange?: (tabId: string) => void;
  isDarkMode?: boolean;
  onThemeToggle?: () => void;
  userEmail?: string | null;
  userName?: string | null;
  isPro?: boolean;
}

export default function Dashboard({ onTabChange, isDarkMode, userEmail, userName, isPro }: DashboardProps) {
  const [stats, setStats] = useState({
    streak: 0,
    timeSpent: '0 mins',
    progress: 0,
    badges: 0
  });

  const [learningStats, setLearningStats] = useState({
    vocab: 0,
    grammar: 0,
    tenses: 0,
    totalCompleted: 0
  });

  // Active Screen Time Tracker State (In Seconds)
  const [activeSeconds, setActiveSeconds] = useState<number>(() => {
    return parseInt(localStorage.getItem('humnai_total_time_seconds') || '0', 10);
  });

  const activeTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Time Range Filter State (7 Days vs 30 Days)
  const [timeRange, setTimeRange] = useState<'7' | '30'>('7');

  // Dynamic Column Chart Data State
  const [chartData, setChartData] = useState<any[]>([]);

  // 1. Real-time Active Screen Time Counter
  useEffect(() => {
    const startTimer = () => {
      if (!activeTimerRef.current) {
        activeTimerRef.current = setInterval(() => {
          setActiveSeconds((prev) => {
            const nextTime = prev + 1;
            localStorage.setItem('humnai_total_time_seconds', nextTime.toString());
            return nextTime;
          });
        }, 1000);
      }
    };

    const stopTimer = () => {
      if (activeTimerRef.current) {
        clearInterval(activeTimerRef.current);
        activeTimerRef.current = null;
      }
    };

    startTimer();

    const handleVisibilityChange = () => {
      if (document.hidden) {
        stopTimer();
      } else {
        startTimer();
      }
    };

    window.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', startTimer);
    window.addEventListener('blur', stopTimer);

    return () => {
      stopTimer();
      window.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', startTimer);
      window.removeEventListener('blur', stopTimer);
    };
  }, []);

  // Format Total Seconds to Human Readable Display (e.g. "0 mins", "12 mins", "1 hr 15 mins")
  const formatTimeSpent = (totalSecs: number): string => {
    const totalMinutes = Math.floor(totalSecs / 60);
    if (totalMinutes < 60) {
      return `${totalMinutes} mins`;
    }
    const hours = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;
    return `${hours} hr ${mins} mins`;
  };

  // 2. Load Real-time Stats & Dynamic Sync
  useEffect(() => {
    const loadRealtimeStats = () => {
      const completedDays = JSON.parse(localStorage.getItem('humnai_completed_days') || '{}');
      const completedLessons = JSON.parse(localStorage.getItem('humnai_completed_lessons') || '{}');
      
      const dayCount = Object.keys(completedDays).length;
      const lessonCount = Object.keys(completedLessons).length;
      
      const vocabCount = Object.keys(completedLessons).filter(id => id.includes('vocab')).length;
      const grammarCount = Object.keys(completedLessons).filter(id => id.includes('grammar')).length;
      const tensesCount = Object.keys(completedLessons).filter(id => id.includes('tenses')).length;

      const calcProgress = Math.min(100, Math.round((lessonCount / 20) * 100));

      setStats((prev) => ({
        ...prev,
        streak: dayCount,
        timeSpent: formatTimeSpent(activeSeconds),
        progress: calcProgress,
        badges: Math.floor(lessonCount / 3)
      }));

      setLearningStats({
        vocab: vocabCount,
        grammar: grammarCount,
        tenses: tensesCount,
        totalCompleted: lessonCount
      });

      // Days Array for 7 Days Calculation
      const daysOfWeek = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
      const todayIndex = new Date().getDay() === 0 ? 6 : new Date().getDay() - 1;

      if (timeRange === '7') {
        const generated7Days = daysOfWeek.map((day, idx) => {
          let activityScore = 0;
          if (idx < todayIndex) {
            activityScore = Math.min(100, (idx + 1) * 20 + (lessonCount * 5));
          } else if (idx === todayIndex) {
            activityScore = Math.min(100, Math.max(0, Math.floor(activeSeconds / 60) * 5)); // Real-time active time score
          } else {
            activityScore = 0;
          }

          return {
            name: day,
            score: activityScore,
            isToday: idx === todayIndex
          };
        });

        setChartData(generated7Days);
      } else {
        setChartData([
          { name: 'Week 1', score: Math.min(100, lessonCount * 15) },
          { name: 'Week 2', score: Math.min(100, lessonCount * 20) },
          { name: 'Week 3', score: Math.min(100, lessonCount * 25) },
          { name: 'Week 4', score: calcProgress || 0 },
        ]);
      }

      // Fetch Live Dynamic Data from Database Serverless API
      if (userEmail) {
        fetch(`/api/sync?email=${encodeURIComponent(userEmail)}`)
          .then(res => res.json())
          .then(data => {
            if (data && !data.error) {
              setStats(prev => ({
                ...prev,
                streak: data.streak ?? prev.streak,
                timeSpent: data.time_spent ? `${data.time_spent} mins` : formatTimeSpent(activeSeconds),
                progress: data.goal_progress ?? prev.progress,
                badges: data.achievements ?? prev.badges
              }));

              if (timeRange === '7' && Array.isArray(data.graph_data) && data.graph_data.length > 0) {
                setChartData(data.graph_data.map((item: any, idx: number) => ({
                  name: item.day,
                  score: item.progress || 0,
                  isToday: idx === todayIndex
                })));
              }
            }
          })
          .catch(err => console.error("Sync fetch error:", err));
      }
    };

    loadRealtimeStats();

    window.addEventListener('focus', loadRealtimeStats);
    return () => window.removeEventListener('focus', loadRealtimeStats);
  }, [userEmail, timeRange, activeSeconds]);

  return (
    <div className="space-y-8 pb-20 md:pb-8">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-[#4F46E5] to-[#7C3AED] rounded-3xl p-8 text-white shadow-xl shadow-indigo-100 dark:shadow-none relative overflow-hidden">
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-3xl font-bold">Namaste, {userName || 'Learner'}! 👋</h1>
            {isPro && (
              <span className="bg-amber-400 text-white text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-lg flex items-center gap-1">
                <Award size={12} />
                Pro
              </span>
            )}
          </div>
          <p className="text-indigo-100 max-w-md">
            {isPro 
              ? "You have full access to all HumnAi features. Keep mastering English!" 
              : `You're doing great! You have completed ${learningStats.totalCompleted} lessons so far. Keep it up!`}
          </p>
          <button 
            onClick={() => onTabChange?.('practice')}
            className="mt-6 bg-white text-[#4F46E5] px-6 py-2.5 rounded-xl font-bold flex items-center gap-2 hover:bg-indigo-50 transition-colors"
          >
            <Play size={18} fill="currentColor" />
            Continue Learning
          </button>
        </div>
        <div className="absolute top-[-20%] right-[-10%] w-64 h-64 bg-white/10 rounded-full blur-3xl"></div>
        <div className="absolute bottom-[-20%] left-[20%] w-48 h-48 bg-indigo-400/20 rounded-full blur-2xl"></div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { label: 'Daily Streak', value: `${stats.streak} Days`, icon: TrendingUp, color: 'text-orange-500', bg: 'bg-orange-50' },
          { label: 'Time Spent', value: formatTimeSpent(activeSeconds), icon: Clock, color: 'text-blue-500', bg: 'bg-blue-50' },
          { label: 'Goal Progress', value: `${stats.progress}%`, icon: Target, color: 'text-emerald-500', bg: 'bg-emerald-50' },
          { label: 'Achievements', value: `${stats.badges} Badges`, icon: Award, color: 'text-purple-500', bg: 'bg-purple-50' },
        ].map((stat, i) => (
          <div key={i} className="bg-white dark:bg-[#1F2937] p-6 rounded-2xl border border-[#E5E7EB] dark:border-gray-700 hover:shadow-md transition-shadow">
            <div className={`w-12 h-12 ${stat.bg} dark:bg-opacity-20 rounded-xl flex items-center justify-center mb-4`}>
              <stat.icon className={stat.color} size={24} />
            </div>
            <p className="text-sm font-medium text-[#6B7280] dark:text-gray-400">{stat.label}</p>
            <p className="text-2xl font-bold text-[#111827] dark:text-white">{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Learning Progress Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Vertical Column Chart Card */}
        <div className="lg:col-span-2 bg-white dark:bg-[#1F2937] p-8 rounded-3xl shadow-sm border border-[#E5E7EB] dark:border-gray-700">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h3 className="text-xl font-bold text-[#111827] dark:text-white">Learning Progress</h3>
              <p className="text-sm text-[#6B7280] dark:text-gray-400">
                {timeRange === '7' ? 'Your performance over the last 7 days' : 'Your performance over the last 30 days'}
              </p>
            </div>

            <select 
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value as '7' | '30')}
              className="bg-[#F9FAFB] dark:bg-gray-800 border border-[#E5E7EB] dark:border-gray-700 rounded-xl px-3 py-1.5 text-sm font-bold text-[#111827] dark:text-white outline-none cursor-pointer focus:ring-2 focus:ring-indigo-500"
            >
              <option value="7">Last 7 Days</option>
              <option value="30">Last 30 Days</option>
            </select>
          </div>

          <div className="h-[300px] w-full outline-none" tabIndex={-1}>
            <ResponsiveContainer width="100%" height="100%" className="outline-none">
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: isDarkMode ? '#9CA3AF' : '#6B7280', fontSize: 12, fontWeight: 600 }}
                  dy={10}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: isDarkMode ? '#9CA3AF' : '#6B7280', fontSize: 12 }}
                  domain={[0, 100]}
                />
                <Tooltip 
                  cursor={{ fill: isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)' }}
                  contentStyle={{ 
                    backgroundColor: isDarkMode ? '#1F2937' : '#fff', 
                    borderRadius: '12px', 
                    border: '1px solid #E5E7EB', 
                    boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
                    color: isDarkMode ? '#fff' : '#111827'
                  }}
                  formatter={(value: any) => [`Score: ${value}`, 'Activity']}
                />
                <Bar 
                  dataKey="score" 
                  radius={[8, 8, 0, 0]} 
                  barSize={36}
                >
                  {chartData.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={entry.isToday ? '#4F46E5' : isDarkMode ? '#374151' : '#E0E7FF'} 
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Learning Report Side Panel */}
        <div className="bg-white dark:bg-[#1F2937] p-8 rounded-3xl border border-[#E5E7EB] dark:border-gray-700 space-y-6">
          <h3 className="text-xl font-bold text-[#111827] dark:text-white">Learning Report</h3>
          
          <div className="space-y-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-blue-50 dark:bg-blue-900/20 rounded-xl flex items-center justify-center text-blue-600 dark:text-blue-400">
                <BookOpen size={24} />
              </div>
              <div className="flex-1">
                <div className="flex justify-between mb-1">
                  <span className="text-sm font-bold text-[#111827] dark:text-white">Vocabulary</span>
                  <span className="text-sm text-[#6B7280] dark:text-gray-400">{learningStats.vocab} Lessons</span>
                </div>
                <div className="w-full bg-gray-100 dark:bg-gray-800 h-2 rounded-full overflow-hidden">
                  <div className="bg-blue-500 h-full transition-all" style={{ width: `${Math.min(100, (learningStats.vocab / 5) * 100)}%` }}></div>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-purple-50 dark:bg-purple-900/20 rounded-xl flex items-center justify-center text-purple-600 dark:text-purple-400">
                <Target size={24} />
              </div>
              <div className="flex-1">
                <div className="flex justify-between mb-1">
                  <span className="text-sm font-bold text-[#111827] dark:text-white">Grammar</span>
                  <span className="text-sm text-[#6B7280] dark:text-gray-400">{learningStats.grammar} Lessons</span>
                </div>
                <div className="w-full bg-gray-100 dark:bg-gray-800 h-2 rounded-full overflow-hidden">
                  <div className="bg-purple-500 h-full transition-all" style={{ width: `${Math.min(100, (learningStats.grammar / 5) * 100)}%` }}></div>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 size={24} />
              </div>
              <div className="flex-1">
                <div className="flex justify-between mb-1">
                  <span className="text-sm font-bold text-[#111827] dark:text-white">Tenses</span>
                  <span className="text-sm text-[#6B7280] dark:text-gray-400">{learningStats.tenses} Lessons</span>
                </div>
                <div className="w-full bg-gray-100 dark:bg-gray-800 h-2 rounded-full overflow-hidden">
                  <div className="bg-emerald-500 h-full transition-all" style={{ width: `${Math.min(100, (learningStats.tenses / 5) * 100)}%` }}></div>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-6 border-t border-gray-100 dark:border-gray-700">
            <div className="bg-indigo-50 dark:bg-indigo-900/20 p-4 rounded-2xl">
              <p className="text-xs text-indigo-600 dark:text-indigo-400 font-bold uppercase tracking-wider mb-1">Daily Tip</p>
              <p className="text-sm text-indigo-900 dark:text-indigo-100 leading-relaxed">
                Practice 10 minutes every day to boost your speaking confidence!
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
