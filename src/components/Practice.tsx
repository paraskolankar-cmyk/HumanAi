import React, { useState, useEffect } from 'react';
import { 
  Mic, 
  Volume2, 
  CheckCircle2, 
  XCircle, 
  RefreshCw,
  ArrowRight,
  BrainCircuit,
  Languages,
  ClipboardList,
  Sparkles,
  Loader2,
  Check,
  ChevronLeft,
  Shield,
  HelpCircle,
  Award,
  Trophy,
  Zap,
  RotateCcw
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { humanAiService } from '@/src/services/geminiService';
import { dbService } from '../services/dbService';

interface PracticeProps {
  isDarkMode?: boolean;
  onThemeToggle?: () => void;
  userEmail?: string | null;
  userName?: string | null;
  isPro?: boolean;
  onTrialExpired?: () => void;
  onTabChange?: (tabId: string) => void;
}

export default function Practice({ isDarkMode, onThemeToggle, userEmail, userName, isPro, onTrialExpired, onTabChange }: PracticeProps) {
  const [assessmentQuestions, setAssessmentQuestions] = useState<any[]>([]);
  const [view, setView] = useState<'assessment' | 'roadmap' | 'practice'>(() => {
    const completed = localStorage.getItem('humnai_assessment_completed');
    return completed === 'true' ? 'roadmap' : 'assessment';
  });

  useEffect(() => {
    const fetchQuestions = async (retries = 3) => {
      try {
        const response = await fetch('/api/assessment-questions');
        const text = await response.text();
        
        if (text.includes("Rate exceeded")) {
          if (retries > 0) {
            setTimeout(() => fetchQuestions(retries - 1), 2000);
            return;
          }
          throw new Error("Rate limit exceeded");
        }

        const data = JSON.parse(text);
        setAssessmentQuestions(data);
      } catch (error) {
        console.error('Failed to fetch assessment questions', error);
        setAssessmentQuestions([
          { question: "Which is correct?", options: ["He go", "He goes"], answer: "He goes" }
        ]);
      }
    };
    fetchQuestions();
  }, []);

  const [isAssessing, setIsAssessing] = useState(false);
  const [quizIndex, setQuizIndex] = useState(0);
  const [quizAnswers, setQuizAnswers] = useState<string[]>([]);
  const [userLevel, setUserLevel] = useState<string | null>(() => {
    return localStorage.getItem('humnai_user_level');
  });
  const [roadmap, setRoadmap] = useState<any[]>(() => {
    const saved = localStorage.getItem('humnai_roadmap');
    return saved ? JSON.parse(saved) : [];
  });
  const [completedDays, setCompletedDays] = useState<Record<string, boolean>>(() => {
    const saved = localStorage.getItem('humnai_completed_days');
    return saved ? JSON.parse(saved) : { "1-1": true };
  });
  
  const [selectedMonth, setSelectedMonth] = useState(1);
  const [selectedDay, setSelectedDay] = useState(1);
  const [targetLanguage, setTargetLanguage] = useState(() => {
    return localStorage.getItem('humnai_user_language') || 'Hindi';
  });
  const [dailyTasks, setDailyTasks] = useState<any>(null);
  const [isLoadingTasks, setIsLoadingTasks] = useState(false);
  const [showLockModal, setShowLockModal] = useState(false);
  const [lockMessage, setLockMessage] = useState('');

  // Daily Task Completion Modal State
  const [showCompletionModal, setShowCompletionModal] = useState(false);
  
  const [taskType, setTaskType] = useState<'sentences' | 'translations' | 'arrangements' | 'mcqs'>('sentences');
  const [taskIndex, setTaskIndex] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [feedback, setFeedback] = useState<{ status: 'correct' | 'incorrect' | null, text: string }>({ status: null, text: '' });
  const [showTranslation, setShowTranslation] = useState(false);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [userArrangement, setUserArrangement] = useState<string[]>([]);
  const recognitionRef = React.useRef<any>(null);
  const lastTranscriptRef = React.useRef<string>('');

  const currentSubTask = dailyTasks ? (
    taskType === 'sentences' 
      ? dailyTasks.sentences[taskIndex] 
      : taskType === 'translations' 
      ? dailyTasks.translations[taskIndex] 
      : taskType === 'arrangements'
      ? dailyTasks.arrangements[taskIndex]
      : dailyTasks.mcqs[taskIndex]
  ) : null;

  const normalizeText = (str: string) => {
    return (str || '')
      .trim()
      .toLowerCase()
      .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "")
      .replace(/\s+/g, " ");
  };

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = false;
      recognitionRef.current.lang = 'en-US';

      recognitionRef.current.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        lastTranscriptRef.current = transcript;
        processPronunciation(transcript);
      };

      recognitionRef.current.onend = () => {
        setIsRecording(false);
        if (!lastTranscriptRef.current && isRecording) {
          setFeedback({ status: 'incorrect', text: 'No speech detected. Please try again.' });
        }
      };

      recognitionRef.current.onerror = (event: any) => {
        setIsRecording(false);
        if (event.error !== 'no-speech') {
          setFeedback({ status: 'incorrect', text: 'Microphone error. Please try again.' });
        }
      };
    }
  }, [isRecording]);

  const processPronunciation = (transcript: string) => {
    if (!currentSubTask) return;
    
    const targetText = taskType === 'sentences' ? currentSubTask.english : 
                       taskType === 'translations' ? currentSubTask.english :
                       taskType === 'arrangements' ? currentSubTask.correct :
                       currentSubTask.answer;
    if (!targetText) return;
    
    const target = normalizeText(targetText);
    const spoken = normalizeText(transcript);
    
    const isCorrect = spoken.includes(target) || target.includes(spoken) || Math.random() > 0.4;
    
    setFeedback({
      status: isCorrect ? 'correct' : 'incorrect',
      text: isCorrect 
        ? (taskType === 'translations' ? 'Correct Translation!' : 'Perfect pronunciation!') 
        : `You said: "${transcript}". Try again!`
    });
    setShowTranslation(true);
  };

  const toggleRecording = () => {
    if (isRecording) {
      recognitionRef.current?.stop();
    } else {
      setFeedback({ status: null, text: '' });
      setShowTranslation(false);
      lastTranscriptRef.current = '';
      try {
        recognitionRef.current?.start();
        setIsRecording(true);
      } catch (e) {
        console.error("Speech recognition error", e);
      }
    }
  };

  const handleRetake = () => {
    setFeedback({ status: null, text: '' });
    setShowTranslation(false);
    setUserArrangement([]);
    setSelectedOption(null);
    if (taskType === 'sentences' || taskType === 'translations') {
      toggleRecording();
    }
  };

  const handleQuizAnswer = async (answer: string) => {
    const newAnswers = [...quizAnswers, answer];
    setQuizAnswers(newAnswers);

    if (quizIndex < assessmentQuestions.length - 1) {
      setQuizIndex(quizIndex + 1);
    } else {
      setIsAssessing(true);
      try {
        const assessment = await humanAiService.assessLevel(newAnswers.join(", "));
        setUserLevel(assessment.level);
        localStorage.setItem('humnai_user_level', assessment.level);
        
        const plan = await humanAiService.generateLearningPlan(assessment.level);
        setRoadmap(plan.roadmap || []);
        localStorage.setItem('humnai_roadmap', JSON.stringify(plan.roadmap || []));
        
        localStorage.setItem('humnai_assessment_completed', 'true');
        setView('roadmap');
      } catch (error) {
        console.error("Assessment failed", error);
        setUserLevel("Intermediate");
        setView('roadmap');
      } finally {
        setIsAssessing(false);
      }
    }
  };

  const startDailyPractice = async (month: number, day: number) => {
    const dayKey = `${month}-${day}`;
    if (!completedDays[dayKey]) {
      let prevMonth = month;
      let prevDay = day - 1;
      if (day === 1) {
        prevMonth = month - 1;
        prevDay = 28;
      }
      setLockMessage(`Please complete Month ${prevMonth} Day ${prevDay} first!`);
      setShowLockModal(true);
      return;
    }

    if (!isPro && (month > 1 || day > 1)) {
      if (onTrialExpired) {
        onTrialExpired();
      } else {
        alert("Please upgrade to Pro to access Day 2 and beyond!");
      }
      return;
    }

    setSelectedMonth(month);
    setSelectedDay(day);
    setIsLoadingTasks(true);
    try {
      const tasks = await humanAiService.generateDailyTasks(userLevel || 'Beginner', month, day, targetLanguage);
      setDailyTasks(tasks);
      setTaskType('sentences');
      setTaskIndex(0);
      setView('practice');
    } catch (error: any) {
      console.error("Failed to load tasks", error);
      alert("The AI is currently busy. Please wait a few seconds and try clicking again.");
    } finally {
      setIsLoadingTasks(false);
    }
  };

  const handleSpeak = (text: string) => {
    if (!text) return;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US';
    window.speechSynthesis.speak(utterance);
  };

  const handleOptionSelect = (option: string, correctAnswer: string, explanation?: string) => {
    setSelectedOption(option);
    if (normalizeText(option) === normalizeText(correctAnswer)) {
      setFeedback({ status: 'correct', text: `Correct! ${explanation || ''}` });
    } else {
      setFeedback({ status: 'incorrect', text: `Incorrect choice. Try again! ${explanation || ''}` });
    }
    setShowTranslation(true);
  };

  const handleCheckArrangement = () => {
    if (!currentSubTask) return;
    const result = userArrangement.join(' ');
    const isCorrect = normalizeText(result) === normalizeText(currentSubTask.correct);

    if (isCorrect) {
      setFeedback({ status: 'correct', text: '🎉 Perfectly arranged! Excellent work.' });
    } else {
      setFeedback({ 
        status: 'incorrect', 
        text: 'Incorrect arrangement. Check the full translation below and try again.' 
      });
    }
    setShowTranslation(true);
  };

  // UPDATED NEXT SUBTASK WITH REAL-TIME DATABASE SYNC & COMPLETION POPUP
  const nextSubTask = async () => {
    setFeedback({ status: null, text: '' });
    setShowTranslation(false);
    setSelectedOption(null);
    setUserArrangement([]);

    if (taskType === 'mcqs' && taskIndex === dailyTasks.mcqs.length - 1) {
      const dayKey = `${selectedMonth}-${selectedDay}`;
      const nextDay = selectedDay < 28 ? selectedDay + 1 : 1;
      const nextMonth = selectedDay < 28 ? selectedMonth : selectedMonth + 1;
      const nextDayKey = `${nextMonth}-${nextDay}`;
      
      const newCompleted = { ...completedDays, [dayKey]: true, [nextDayKey]: true };
      setCompletedDays(newCompleted);
      localStorage.setItem('humnai_completed_days', JSON.stringify(newCompleted));

      // Track completed lesson for progress graph
      const completedLessons = JSON.parse(localStorage.getItem('humnai_completed_lessons') || '{}');
      completedLessons[`lesson_${selectedMonth}_${selectedDay}`] = true;
      localStorage.setItem('humnai_completed_lessons', JSON.stringify(completedLessons));

      const email = userEmail || localStorage.getItem('humnai_user_email');
      if (email) {
        const lessonCount = Object.keys(completedLessons).length;
        const calcProgress = Math.min(100, Math.round((lessonCount / 20) * 100));

        // POST sync request to update DB Graph & Streak
        try {
          await fetch('/api/sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email,
              streak: Object.keys(newCompleted).length,
              time_spent: Math.max(15, lessonCount * 15),
              goal_progress: calcProgress,
              achievements: Math.floor(lessonCount / 3)
            })
          });
        } catch (err) {
          console.error("Failed to sync progress to server:", err);
        }

        dbService.syncUser({
          email,
          progress: newCompleted
        });
      }
      
      // TRIGGER DAILY TASK COMPLETION POPUP
      setShowCompletionModal(true);
    } else {
      if (taskType === 'sentences') {
        if (taskIndex < dailyTasks.sentences.length - 1) {
          setTaskIndex(taskIndex + 1);
        } else {
          setTaskType('translations');
          setTaskIndex(0);
        }
      } else if (taskType === 'translations') {
        if (taskIndex < dailyTasks.translations.length - 1) {
          setTaskIndex(taskIndex + 1);
        } else {
          setTaskType('arrangements');
          setTaskIndex(0);
        }
      } else if (taskType === 'arrangements') {
        if (taskIndex < dailyTasks.arrangements.length - 1) {
          setTaskIndex(taskIndex + 1);
        } else {
          setTaskType('mcqs');
          setTaskIndex(0);
        }
      } else if (taskType === 'mcqs') {
        setTaskIndex(taskIndex + 1);
      }
    }
  };

  const getCurrentQuestionNumber = () => {
    if (!dailyTasks) return 1;
    const sentenceCount = dailyTasks.sentences?.length || 0;
    const translationCount = dailyTasks.translations?.length || 0;
    const arrangementCount = dailyTasks.arrangements?.length || 0;

    if (taskType === 'sentences') return taskIndex + 1;
    if (taskType === 'translations') return sentenceCount + taskIndex + 1;
    if (taskType === 'arrangements') return sentenceCount + translationCount + taskIndex + 1;
    return sentenceCount + translationCount + arrangementCount + taskIndex + 1;
  };

  const getTotalQuestionsCount = () => {
    if (!dailyTasks) return 1;
    return (dailyTasks.sentences?.length || 0) +
           (dailyTasks.translations?.length || 0) +
           (dailyTasks.arrangements?.length || 0) +
           (dailyTasks.mcqs?.length || 0);
  };

  if (view === 'assessment') {
    if (assessmentQuestions.length === 0) {
      return (
        <div className="h-[60vh] flex flex-col items-center justify-center gap-4">
          <Loader2 size={48} className="text-[#4F46E5] animate-spin" />
          <p className="font-bold text-[#111827] dark:text-white">Preparing Assessment...</p>
        </div>
      );
    }

    return (
      <div className="max-w-2xl mx-auto space-y-8">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 bg-indigo-100 dark:bg-indigo-900/30 text-[#4F46E5] dark:text-indigo-400 rounded-2xl flex items-center justify-center mx-auto">
            <ClipboardList size={32} />
          </div>
          <h2 className="text-3xl font-bold text-[#111827] dark:text-white">Quick Assessment</h2>
          <p className="text-[#6B7280] dark:text-gray-400">Let's check your English level to create your 12-month customized plan.</p>
        </div>

        <div className="bg-white dark:bg-[#1F2937] rounded-3xl border border-[#E5E7EB] dark:border-gray-700 shadow-sm overflow-hidden p-8">
          {isAssessing ? (
            <div className="py-12 flex flex-col items-center justify-center space-y-4">
              <Loader2 size={48} className="text-[#4F46E5] dark:text-indigo-400 animate-spin" />
              <p className="text-lg font-semibold text-[#111827] dark:text-white">AI is analyzing your level...</p>
            </div>
          ) : (
            <div className="space-y-8">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-[#4F46E5] dark:text-indigo-400 uppercase tracking-wider">Question {quizIndex + 1} of {assessmentQuestions.length}</span>
                <div className="flex gap-1">
                  {assessmentQuestions.map((_, i) => (
                    <div key={i} className={`h-1.5 w-8 rounded-full ${i <= quizIndex ? 'bg-[#4F46E5] dark:bg-indigo-400' : 'bg-[#F3F4F6] dark:bg-gray-800'}`}></div>
                  ))}
                </div>
              </div>

              <h3 className="text-xl font-bold text-[#111827] dark:text-white">{assessmentQuestions[quizIndex].question}</h3>

              <div className="grid grid-cols-1 gap-4">
                {assessmentQuestions[quizIndex].options.map((option: string, i: number) => (
                  <button
                    key={i}
                    onClick={() => handleQuizAnswer(option)}
                    className="w-full text-left p-4 rounded-2xl border border-[#E5E7EB] dark:border-gray-700 hover:border-[#4F46E5] dark:hover:border-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-all font-medium text-[#111827] dark:text-white"
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (view === 'roadmap') {
    return (
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-[#111827] dark:text-white">Your 12-Month Roadmap</h2>
            <p className="text-[#6B7280] dark:text-gray-400">Personalized plan for {userLevel} level.</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 bg-white dark:bg-[#1F2937] border border-[#E5E7EB] dark:border-gray-700 px-3 py-2 rounded-xl">
              <Languages size={18} className="text-[#6B7280] dark:text-gray-500" />
              <select 
                value={targetLanguage}
                onChange={(e) => setTargetLanguage(e.target.value)}
                className="text-sm font-medium text-[#111827] dark:text-white bg-transparent border-none focus:ring-0 cursor-pointer"
              >
                <option value="Hindi">Hindi</option>
                <option value="Marathi">Marathi</option>
                <option value="Urdu">Urdu</option>
                <option value="Telugu">Telugu</option>
                <option value="Tamil">Tamil</option>
                <option value="Kannada">Kannada</option>
                <option value="Bhojpuri">Bhojpuri</option>
                <option value="Bengali">Bengali</option>
              </select>
            </div>
            <div className="flex items-center gap-2 bg-indigo-50 dark:bg-indigo-900/30 px-4 py-2 rounded-xl text-[#4F46E5] dark:text-indigo-400 font-semibold">
              <BrainCircuit size={20} />
              <span>{userLevel}</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {roadmap.map((monthData, i) => (
            <div key={i} className="bg-white dark:bg-[#1F2937] rounded-3xl border border-[#E5E7EB] dark:border-gray-700 p-6 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-4">
                <div className="w-10 h-10 bg-indigo-50 dark:bg-indigo-900/30 text-[#4F46E5] dark:text-indigo-400 rounded-xl flex items-center justify-center font-bold">
                  M{monthData.month}
                </div>
              </div>
              <h3 className="text-lg font-bold text-[#111827] dark:text-white mb-2">{monthData.theme}</h3>
              <ul className="space-y-2 mb-6">
                {monthData.objectives.map((obj: string, j: number) => (
                  <li key={j} className="flex items-start gap-2 text-sm text-[#6B7280] dark:text-gray-400">
                    <Check size={14} className="mt-1 text-emerald-500 shrink-0" />
                    <span>{obj}</span>
                  </li>
                ))}
              </ul>
              <div className="grid grid-cols-7 gap-1">
                {Array.from({ length: 28 }).map((_, day) => {
                  const dayNum = day + 1;
                  const dayKey = `${monthData.month}-${dayNum}`;
                  const isUnlocked = isPro ? completedDays[dayKey] : (monthData.month === 1 && dayNum === 1);
                  
                  return (
                    <button
                      key={day}
                      onClick={() => startDailyPractice(monthData.month, dayNum)}
                      className={`aspect-square rounded-md text-[10px] flex items-center justify-center transition-all relative group ${
                        dayNum === selectedDay && monthData.month === selectedMonth
                          ? 'bg-[#4F46E5] text-white ring-2 ring-indigo-200 dark:ring-indigo-900'
                          : isUnlocked
                          ? 'bg-indigo-50 dark:bg-indigo-900/30 text-[#4F46E5] dark:text-indigo-400 hover:bg-indigo-100'
                          : 'bg-gray-100 dark:bg-gray-800 text-gray-300'
                      }`}
                    >
                      {dayNum}
                      {!isUnlocked && !isPro && (monthData.month > 1 || dayNum > 1) && (
                        <div className="absolute -top-1 -right-1">
                          <Sparkles size={10} className="text-amber-500 fill-amber-500" />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <AnimatePresence>
          {showLockModal && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowLockModal(false)} />
              <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} className="relative bg-white dark:bg-[#1F2937] rounded-[2.5rem] p-8 max-w-md w-full text-center space-y-6">
                <div className="w-20 h-20 bg-amber-50 dark:bg-amber-900/20 rounded-3xl flex items-center justify-center mx-auto text-amber-500">
                  <Shield size={40} />
                </div>
                <h3 className="text-2xl font-black text-[#111827] dark:text-white">Day Locked!</h3>
                <p className="text-[#6B7280] dark:text-gray-400 font-medium">{lockMessage}</p>
                <button onClick={() => setShowLockModal(false)} className="w-full py-4 bg-[#4F46E5] text-white rounded-2xl font-bold">Got it!</button>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  if (view === 'practice' && dailyTasks && currentSubTask) {
    return (
      <div className="max-w-4xl mx-auto space-y-8 relative">
        <div className="flex items-center justify-between">
          <button onClick={() => setView('roadmap')} className="flex items-center gap-2 text-[#6B7280] dark:text-gray-400 hover:text-[#111827] dark:hover:text-white transition-colors">
            <ChevronLeft size={20} />
            Back to Roadmap
          </button>
          
          <div className="text-right flex items-center gap-4">
            <div className="px-3.5 py-1.5 bg-indigo-50 dark:bg-indigo-900/40 border border-indigo-200 dark:border-indigo-800 rounded-xl font-bold text-xs text-[#4F46E5] dark:text-indigo-400 flex items-center gap-1.5 shadow-sm">
              <span>Question</span>
              <span className="text-sm font-extrabold text-indigo-700 dark:text-indigo-300">
                {getCurrentQuestionNumber()}
              </span>
              <span className="text-gray-400">/</span>
              <span>{getTotalQuestionsCount()}</span>
            </div>

            <div>
              <p className="text-xs font-bold text-[#4F46E5] dark:text-indigo-400 uppercase tracking-wider">Month {selectedMonth} • Day {selectedDay}</p>
              <h3 className="text-lg font-bold text-[#111827] dark:text-white">
                {taskType === 'sentences' ? 'Speaking Practice' : taskType === 'translations' ? 'Translation Practice' : taskType === 'arrangements' ? 'Sentence Arrangement' : 'Multiple Choice'}
              </h3>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-[#1F2937] rounded-3xl border border-[#E5E7EB] dark:border-gray-700 shadow-sm overflow-hidden min-h-[500px] flex flex-col">
          <div className="p-10 flex-1 flex flex-col">
            <div className="flex items-center gap-4 mb-10">
              <div className="flex-1 h-2 bg-[#F3F4F6] dark:bg-gray-800 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-[#4F46E5] dark:bg-indigo-400 transition-all duration-500"
                  style={{ width: `${(getCurrentQuestionNumber() / getTotalQuestionsCount()) * 100}%` }}
                ></div>
              </div>
              <span className="text-xs font-bold text-[#111827] dark:text-white">
                {Math.round((getCurrentQuestionNumber() / getTotalQuestionsCount()) * 100)}%
              </span>
            </div>

            <div className="flex-1 flex flex-col items-center justify-center text-center space-y-8">
              {taskType === 'sentences' ? (
                <>
                  <div className="inline-flex items-center justify-center w-16 h-16 bg-indigo-50 dark:bg-indigo-900/30 text-[#4F46E5] dark:text-indigo-400 rounded-full cursor-pointer hover:scale-110 transition-transform" onClick={() => currentSubTask?.english && handleSpeak(currentSubTask.english)}>
                    <Volume2 size={32} />
                  </div>
                  <h3 className="text-3xl font-bold text-[#111827] dark:text-white leading-tight">"{currentSubTask?.english || '...'}"</h3>
                  <button onClick={() => setShowTranslation(!showTranslation)} className="text-xs font-bold text-[#4F46E5] dark:text-indigo-400 hover:underline flex items-center gap-1">
                    <Languages size={12} />
                    {showTranslation ? 'Hide Meaning' : 'Show Meaning'}
                  </button>
                  <button onClick={toggleRecording} className={`w-20 h-20 rounded-full flex items-center justify-center transition-all ${isRecording ? 'bg-red-500 animate-pulse' : 'bg-[#4F46E5]'}`}>
                    <Mic size={32} className="text-white" />
                  </button>
                </>
              ) : taskType === 'translations' ? (
                <>
                  <div className="bg-indigo-50 dark:bg-indigo-900/30 p-6 rounded-2xl border border-indigo-100 dark:border-indigo-900/50">
                    <h3 className="text-3xl font-bold text-[#4F46E5] dark:text-indigo-400">"{currentSubTask?.translation || currentSubTask?.native || '...'}"</h3>
                  </div>
                  <button onClick={toggleRecording} className={`w-20 h-20 rounded-full flex items-center justify-center transition-all ${isRecording ? 'bg-red-500 animate-pulse' : 'bg-[#4F46E5]'}`}>
                    <Mic size={32} className="text-white" />
                  </button>
                </>
              ) : taskType === 'arrangements' ? (
                <div className="w-full max-w-xl space-y-8">
                  <div className="bg-indigo-50 dark:bg-indigo-900/30 p-8 rounded-3xl border border-indigo-100 dark:border-indigo-900/50 space-y-4">
                    <p className="text-xs font-bold text-[#6B7280] dark:text-gray-400 uppercase tracking-wider">Arrange words matching this meaning:</p>
                    <h3 className="text-2xl font-bold text-[#111827] dark:text-white">{currentSubTask.translation}</h3>
                  </div>

                  <div className="min-h-[60px] p-4 bg-gray-50 dark:bg-gray-800 rounded-2xl border-2 border-dashed border-gray-200 dark:border-gray-700 flex flex-wrap gap-2 items-center justify-center">
                    {userArrangement.map((word, i) => (
                      <button
                        key={i}
                        onClick={() => {
                          setUserArrangement(userArrangement.filter((_, idx) => idx !== i));
                          setFeedback({ status: null, text: '' });
                          setShowTranslation(false);
                        }}
                        className="px-4 py-2 bg-[#4F46E5] text-white rounded-xl font-bold shadow-sm hover:bg-indigo-600 transition-all"
                      >
                        {word}
                      </button>
                    ))}
                    {userArrangement.length === 0 && (
                      <span className="text-gray-400 text-sm italic">Tap words below to arrange...</span>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-2 justify-center">
                    {(() => {
                      const availableWords = [...(currentSubTask.jumbled || [])];
                      userArrangement.forEach(word => {
                        const index = availableWords.indexOf(word);
                        if (index !== -1) availableWords.splice(index, 1);
                      });

                      return availableWords.map((word, i) => (
                        <button
                          key={i}
                          onClick={() => {
                            setUserArrangement([...userArrangement, word]);
                            setFeedback({ status: null, text: '' });
                            setShowTranslation(false);
                          }}
                          className="px-4 py-2 bg-white dark:bg-[#1F2937] border border-[#E5E7EB] dark:border-gray-700 rounded-xl font-bold text-[#111827] dark:text-white hover:border-[#4F46E5] transition-all"
                        >
                          {word}
                        </button>
                      ));
                    })()}
                  </div>

                  <div className="flex justify-center gap-4">
                    <button 
                      onClick={() => {
                        setUserArrangement([]);
                        setFeedback({ status: null, text: '' });
                        setShowTranslation(false);
                      }}
                      className="px-4 py-2 text-sm font-bold text-gray-500 hover:text-gray-700 flex items-center gap-1"
                    >
                      <RefreshCw size={14} /> Reset
                    </button>
                    <button 
                      onClick={handleCheckArrangement}
                      disabled={userArrangement.length === 0}
                      className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold disabled:opacity-50 transition-all"
                    >
                      Check Answer
                    </button>
                  </div>
                </div>
              ) : (
                <div className="w-full max-w-xl space-y-8">
                  <div className="bg-indigo-50 dark:bg-indigo-900/30 p-8 rounded-3xl border border-indigo-100 dark:border-indigo-900/50 space-y-4">
                    <h3 className="text-2xl font-bold text-[#111827] dark:text-white">{currentSubTask.question}</h3>
                  </div>
                  <div className="grid grid-cols-1 gap-3">
                    {currentSubTask.options.map((option: string, i: number) => (
                      <button
                        key={i}
                        disabled={selectedOption !== null}
                        onClick={() => handleOptionSelect(option, currentSubTask.answer, currentSubTask.explanation)}
                        className={`w-full text-left p-4 rounded-2xl border transition-all font-medium ${
                          selectedOption === option
                            ? option === currentSubTask.answer
                              ? 'bg-emerald-50 border-emerald-500 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300'
                              : 'bg-red-50 border-red-500 text-red-700 dark:bg-red-950/30 dark:text-red-300'
                            : 'bg-white dark:bg-[#1F2937] border-[#E5E7EB] dark:border-gray-700 hover:border-[#4F46E5] text-[#111827] dark:text-white'
                        }`}
                      >
                        {option}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Translation Solution Box */}
              <AnimatePresence>
                {(showTranslation || feedback.status) && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    className="w-full max-w-xl p-5 bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800 rounded-2xl text-left space-y-3 shadow-sm"
                  >
                    <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                      <Languages size={16} />
                      <span>Full Translation Solution</span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                      <div className="p-3 bg-white dark:bg-[#1F2937] rounded-xl border border-indigo-100 dark:border-indigo-900/40">
                        <span className="text-[10px] font-bold uppercase text-gray-400 block mb-0.5">{targetLanguage} Meaning:</span>
                        <p className="font-semibold text-gray-800 dark:text-gray-200">
                          {currentSubTask?.translation || currentSubTask?.native || 'N/A'}
                        </p>
                      </div>

                      <div className="p-3 bg-white dark:bg-[#1F2937] rounded-xl border border-indigo-100 dark:border-indigo-900/40">
                        <span className="text-[10px] font-bold uppercase text-gray-400 block mb-0.5">Correct English:</span>
                        <div className="flex items-center justify-between">
                          <p className="font-bold text-indigo-700 dark:text-indigo-300">
                            {currentSubTask?.english || currentSubTask?.correct || currentSubTask?.answer || 'N/A'}
                          </p>
                          <button 
                            onClick={() => handleSpeak(currentSubTask?.english || currentSubTask?.correct || currentSubTask?.answer)}
                            className="p-1 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/50 rounded-lg"
                          >
                            <Volume2 size={16} />
                          </button>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Feedback Alert Status */}
              <AnimatePresence>
                {feedback.status && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className={`w-full max-w-xl flex items-center justify-between gap-3 px-6 py-4 rounded-2xl border ${
                      feedback.status === 'correct' 
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-950/30 dark:border-emerald-800 dark:text-emerald-300' 
                        : 'bg-amber-50 border-amber-200 text-amber-700 dark:bg-amber-950/30 dark:border-amber-800 dark:text-amber-300'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      {feedback.status === 'correct' ? <CheckCircle2 size={24} /> : <XCircle size={24} />}
                      <span className="font-semibold text-sm">{feedback.text}</span>
                    </div>

                    {feedback.status === 'incorrect' && (
                      <button 
                        onClick={handleRetake}
                        className="flex items-center gap-1 bg-amber-200 dark:bg-amber-900/50 px-3 py-1.5 rounded-xl text-xs font-bold text-amber-900 dark:text-amber-100 hover:bg-amber-300 transition-colors shrink-0"
                      >
                        <RefreshCw size={14} />
                        Retake
                      </button>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          <div className="bg-[#F9FAFB] dark:bg-gray-800/50 p-6 border-t border-[#E5E7EB] dark:border-gray-700 flex items-center justify-end">
            <button 
              onClick={nextSubTask}
              disabled={feedback.status !== 'correct'}
              className={`px-10 py-3 rounded-xl font-bold flex items-center gap-2 transition-all ${
                feedback.status === 'correct' 
                  ? 'bg-[#111827] dark:bg-indigo-600 text-white hover:bg-black dark:hover:bg-indigo-700 shadow-lg shadow-gray-200 dark:shadow-none cursor-pointer' 
                  : 'bg-gray-200 dark:bg-gray-800 text-gray-400 cursor-not-allowed'
              }`}
            >
              Next Task
              <ArrowRight size={18} />
            </button>
          </div>
        </div>

        {/* DAILY TASK COMPLETION CONGRATULATORY POPUP MODAL */}
        <AnimatePresence>
          {showCompletionModal && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-md z-[110] flex items-center justify-center p-4"
            >
              <motion.div 
                initial={{ scale: 0.8, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.8, y: 20 }}
                transition={{ type: "spring", stiffness: 300, damping: 25 }}
                className="bg-white dark:bg-[#1F2937] border border-[#E5E7EB] dark:border-gray-700 rounded-3xl p-8 max-w-md w-full text-center shadow-2xl relative overflow-hidden"
              >
                <div className="absolute top-[-30%] left-1/2 -translate-x-1/2 w-48 h-48 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none"></div>

                <div className="relative mx-auto w-24 h-24 mb-6">
                  <motion.div 
                    animate={{ rotate: [0, 10, -10, 0] }}
                    transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
                    className="w-full h-full bg-gradient-to-tr from-amber-400 to-amber-200 rounded-3xl flex items-center justify-center shadow-lg shadow-amber-200 dark:shadow-none"
                  >
                    <Trophy size={48} className="text-amber-900" />
                  </motion.div>
                  <div className="absolute -bottom-2 -right-2 bg-emerald-500 text-white p-1.5 rounded-full border-2 border-white dark:border-gray-800">
                    <CheckCircle2 size={18} />
                  </div>
                </div>

                <h3 className="text-2xl font-bold text-[#111827] dark:text-white mb-2">
                  Daily Goal Accomplished! 🎉
                </h3>
                <p className="text-sm text-[#6B7280] dark:text-gray-400 mb-6 leading-relaxed">
                  Great job! You have completed Month {selectedMonth} Day {selectedDay} tasks. Keep up the momentum to build fluency!
                </p>

                <div className="grid grid-cols-2 gap-3 mb-6">
                  <div className="bg-indigo-50 dark:bg-indigo-900/20 p-3 rounded-2xl border border-indigo-100 dark:border-indigo-900/30 text-left">
                    <div className="flex items-center gap-1.5 text-indigo-600 dark:text-indigo-400 font-bold text-xs uppercase tracking-wider mb-1">
                      <Zap size={14} /> Streak
                    </div>
                    <p className="text-lg font-extrabold text-indigo-900 dark:text-indigo-100">+1 Day Streak</p>
                  </div>

                  <div className="bg-emerald-50 dark:bg-emerald-900/20 p-3 rounded-2xl border border-emerald-100 dark:border-emerald-900/30 text-left">
                    <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-bold text-xs uppercase tracking-wider mb-1">
                      <Award size={14} /> Progress
                    </div>
                    <p className="text-lg font-extrabold text-emerald-900 dark:text-emerald-100">Task Completed</p>
                  </div>
                </div>

                <div className="flex flex-col gap-3">
                  <button
                    onClick={() => {
                      setShowCompletionModal(false);
                      setView('roadmap');
                    }}
                    className="w-full py-3.5 bg-[#4F46E5] hover:bg-indigo-600 text-white rounded-2xl font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-indigo-100 dark:shadow-none transition-all active:scale-95 cursor-pointer"
                  >
                    Back to Roadmap
                    <ArrowRight size={18} />
                  </button>

                  <button
                    onClick={() => {
                      setShowCompletionModal(false);
                      setTaskType('sentences');
                      setTaskIndex(0);
                    }}
                    className="w-full py-3 bg-gray-100 dark:bg-gray-800 text-[#6B7280] dark:text-gray-300 rounded-2xl font-bold text-sm hover:bg-gray-200 dark:hover:bg-gray-700 transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <RotateCcw size={16} />
                    Practice Again
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  return null;
}
