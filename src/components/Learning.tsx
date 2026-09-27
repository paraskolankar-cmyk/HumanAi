import React, { useState, useEffect } from 'react';
import {
  Book, Type, Mic2, FileText, Hash, Layers, ChevronRight, Sparkles,
  ArrowLeft, BookOpen, Loader2, CheckCircle2, AlertCircle, Trophy,
  Volume2, User, BrainCircuit, Clock, Calendar
} from 'lucide-react';
import { motion } from 'framer-motion';
import { humanAiService, getSelectedLanguageName } from '../services/geminiService';
import { getStaticContent } from '../services/learningContent';

const ICON_MAP: Record<string, any> = {
  Book, Type, Mic2, FileText, Hash, Layers, Clock, User, Sparkles, BrainCircuit
};

const MODULES = [
  { id: 'vocabulary',     title: 'Vocabulary',          icon: 'Book',        color: 'bg-blue-50 text-blue-600',    description: '10 essential words daily with meanings & native translation.' },
  { id: 'grammar',        title: 'Grammar Essentials',  icon: 'Type',        color: 'bg-purple-50 text-purple-600', description: 'Master foundational English grammar rules step by step.' },
  { id: 'tenses',         title: 'Tenses & Structure',  icon: 'Clock',       color: 'bg-orange-50 text-orange-600', description: 'Tense formulas, rules and sentence transformations.' },
  { id: 'syno-anto',      title: 'Synonyms & Antonyms', icon: 'Layers',      color: 'bg-emerald-50 text-emerald-600', description: 'Learn daily opposite & similar word pairs.' },
  { id: 'noun-pronoun',   title: 'Noun & Pronoun',      icon: 'User',        color: 'bg-pink-50 text-pink-600',    description: 'Nouns and pronouns with clear examples.' },
  { id: 'verbs',          title: 'Verbs (V1 - V4)',     icon: 'Mic2',        color: 'bg-indigo-50 text-indigo-600', description: 'Master verbs in all 4 forms with examples.' },
  { id: 'voice-narration',title: 'Voice & Narration',   icon: 'Hash',        color: 'bg-red-50 text-red-600',      description: 'Active/Passive voice and Direct/Indirect speech.' },
  { id: 'other-pos',      title: 'Advanced Grammar',    icon: 'Sparkles',    color: 'bg-yellow-50 text-yellow-600', description: 'Adjectives, Conjunctions, Articles & Prepositions.' },
  { id: 'expert-grammar', title: 'Expert Grammar',      icon: 'BrainCircuit',color: 'bg-orange-50 text-orange-600', description: 'Infinitive, Participle, Conditionals & Mood.' },
];

interface LearningProps {
  isDarkMode?: boolean;
  onThemeToggle?: () => void;
  userEmail?: string | null;
  userName?: string | null;
  isPro?: boolean;
  onTrialExpired?: () => void;
}

export default function Learning({ isDarkMode, userEmail, userName, isPro, onTrialExpired }: LearningProps) {
  const [selectedModule, setSelectedModule] = useState<string | null>(null);
  const [selectedDay, setSelectedDay]       = useState<number>(1);
  const [content, setContent]               = useState<any>(null);
  const [isLoading, setIsLoading]           = useState(false);
  const [currentQ, setCurrentQ]             = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [showExplanation, setShowExplanation] = useState(false);
  const [score, setScore]                   = useState(0);
  const [finished, setFinished]             = useState(false);
  const [hasReadContent, setHasReadContent] = useState(false);

  const userLevel     = typeof window !== 'undefined' ? localStorage.getItem('humnai_user_level') || 'Beginner' : 'Beginner';
  const nativeLanguage = getSelectedLanguageName();

  const [completedToday, setCompletedToday] = useState<Record<string, boolean>>(() => {
    if (typeof window === 'undefined') return {};
    const saved = localStorage.getItem('humnai_daily_completion');
    const today = new Date().toDateString();
    if (saved) {
      try {
        const p = JSON.parse(saved);
        if (p.date === today && typeof p.modules === 'object') return p.modules;
      } catch {}
    }
    return {};
  });

  // Module select karo — reset all state
  const handleSelectModule = (moduleId: string) => {
    setSelectedModule(moduleId);
    setContent(null);
    setHasReadContent(false);
    setFinished(false);
    setCurrentQ(0);
    setScore(0);
    setSelectedAnswer(null);
    setShowExplanation(false);
  };

  useEffect(() => {
    if (selectedModule) fetchContent(selectedDay);
  }, [selectedModule, selectedDay]);

  // ============================================================
  // CONTENT FETCH — Static pehle, AI sirf fallback
  // ============================================================
  const fetchContent = async (dayNum: number) => {
    if (!selectedModule) return;

    // Pro check
    if (!isPro && selectedModule !== 'vocabulary') {
      if (onTrialExpired) onTrialExpired();
      else alert('Please upgrade to Pro to access all modules!');
      setSelectedModule(null);
      return;
    }

    setIsLoading(true);
    setContent(null);

    // Step 1: localStorage cache check
    const cacheKey = `humnai_learn_${selectedModule}_day${dayNum}_${nativeLanguage.toLowerCase()}`;
    if (typeof window !== 'undefined') {
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          if (parsed && parsed.topic && parsed.questions?.length > 0) {
            setContent(parsed);
            setIsLoading(false);
            return;
          }
        } catch {}
      }
    }

    // Step 2: Static content (instant, zero API calls)
    const staticData = getStaticContent(selectedModule, dayNum, nativeLanguage);
    if (staticData && staticData.topic && staticData.questions?.length > 0) {
      setContent(staticData);
      setIsLoading(false);
      // Cache it
      if (typeof window !== 'undefined') {
        try { localStorage.setItem(cacheKey, JSON.stringify(staticData)); } catch {}
      }
      return;
    }

    // Step 3: AI fallback (only if static content missing)
    try {
      const categoryMap: Record<string, string> = {
        'syno-anto': 'Synonyms & Antonyms',
        'noun-pronoun': 'Noun & Pronoun',
        'verbs': 'Verbs (V1 V2 V3 V4 forms)',
        'voice-narration': 'Active Passive Voice and Direct Indirect Narration',
        'other-pos': 'Adjectives Conjunctions Articles Prepositions',
        'expert-grammar': 'Conditionals Infinitive Participle Inversion',
        'vocabulary': 'Daily Vocabulary Words',
        'grammar': 'English Grammar Fundamentals',
        'tenses': 'English Tenses',
      };
      const category = categoryMap[selectedModule] || selectedModule;

      const prompt = `You are an English teacher. Create Day ${dayNum} lesson content for "${category}" topic at "${userLevel}" level. The student speaks ${nativeLanguage}. 

Return STRICT JSON only in this exact format (no extra text):
{
  "topic": "Day ${dayNum}: [specific topic title]",
  "explanation": "Clear explanation in simple English",
  "explanationTranslation": "Same explanation in ${nativeLanguage}",
  "rules": ["Rule 1", "Rule 2", "Rule 3"],
  "vocabulary": [{"word": "...", "meaning": "...", "translation": "${nativeLanguage} meaning", "example": "..."}],
  "examples": [{"english": "...", "translation": "${nativeLanguage} translation"}],
  "questions": [
    {"question": "...", "translation": "${nativeLanguage} translation", "options": ["A", "B", "C", "D"], "answer": "correct option exactly as written", "explanation": "Why this is correct in ${nativeLanguage}"}
  ]
}

Generate at least 5 questions. For vocabulary module, include 8-10 vocabulary words. For verbs module, include "verbs" array with v1/v2/v3/v4/translation/example fields.`;

      const raw = await humanAiService['_callApi']?.(prompt) || '';
      // Use getDailyLearningContent as the entry point
      const aiData = await humanAiService.getDailyLearningContent(category, userLevel, dayNum, nativeLanguage);

      if (aiData && aiData.topic) {
        setContent(aiData);
        if (typeof window !== 'undefined') {
          try { localStorage.setItem(cacheKey, JSON.stringify(aiData)); } catch {}
        }
      } else {
        throw new Error('AI returned empty content');
      }
    } catch (err) {
      console.error('AI content fetch failed, using emergency fallback:', err);
      // Emergency fallback — always has content
      setContent(getEmergencyFallback(selectedModule, dayNum, nativeLanguage));
    } finally {
      setIsLoading(false);
    }
  };

  const handleAnswerSelect = (answer: string) => {
    if (showExplanation || !content?.questions) return;
    setSelectedAnswer(answer);
    setShowExplanation(true);
    if (answer === content.questions[currentQ]?.answer) {
      setScore(prev => prev + 1);
    }
  };

  const nextQuestion = () => {
    if (content?.questions && currentQ < content.questions.length - 1) {
      setCurrentQ(prev => prev + 1);
      setSelectedAnswer(null);
      setShowExplanation(false);
    } else {
      setFinished(true);
      if (selectedModule) {
        const today = new Date().toDateString();
        const updated = { ...completedToday, [selectedModule]: true };
        setCompletedToday(updated);
        if (typeof window !== 'undefined') {
          localStorage.setItem('humnai_daily_completion', JSON.stringify({ date: today, modules: updated }));
        }
      }
    }
  };

  const speak = (text: string, lang = 'en-US') => {
    if (!text || typeof window === 'undefined') return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = lang; u.rate = 0.9;
    window.speechSynthesis.speak(u);
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="h-[60vh] flex flex-col items-center justify-center gap-4 text-center">
        <Loader2 size={48} className="text-[#4F46E5] animate-spin" />
        <h3 className="font-bold text-[#111827] dark:text-white text-xl">Loading Day {selectedDay} Lesson...</h3>
        <p className="text-sm text-[#6B7280] dark:text-gray-400">Preparing content in {nativeLanguage}</p>
      </div>
    );
  }

  // Module lesson view
  if (selectedModule && content) {
    return (
      <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-6 pb-20 max-w-5xl mx-auto">

        {/* Top Bar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <button
            onClick={() => { setSelectedModule(null); setContent(null); }}
            className="flex items-center gap-2 text-[#6B7280] dark:text-gray-400 hover:text-[#111827] dark:hover:text-white transition-colors font-medium"
          >
            <ArrowLeft size={20} /> Back to Learning Center
          </button>

          {/* Day selector */}
          <div className="flex items-center gap-2 overflow-x-auto py-1.5 px-3 bg-gray-100 dark:bg-gray-800 rounded-2xl">
            <Calendar size={16} className="text-indigo-600 shrink-0" />
            <span className="text-xs font-bold text-gray-500 uppercase shrink-0">Day:</span>
            <div className="flex items-center gap-1 overflow-x-auto">
              {Array.from({ length: 30 }).map((_, i) => {
                const d = i + 1;
                return (
                  <button
                    key={d}
                    onClick={() => { setSelectedDay(d); setFinished(false); setHasReadContent(false); setCurrentQ(0); setScore(0); setSelectedAnswer(null); setShowExplanation(false); }}
                    className={`px-3 py-1 rounded-xl text-xs font-bold transition-all shrink-0 ${selectedDay === d ? 'bg-[#4F46E5] text-white' : 'text-gray-600 dark:text-gray-300 hover:bg-white dark:hover:bg-gray-700'}`}
                  >
                    {d}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Module Header */}
        <div className="bg-white dark:bg-[#1F2937] rounded-3xl border border-[#E5E7EB] dark:border-gray-700 p-6 shadow-sm flex items-center gap-4">
          <div className={`p-3 rounded-2xl ${MODULES.find(m => m.id === selectedModule)?.color || 'bg-indigo-50 text-indigo-600'}`}>
            <BookOpen size={24} />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-[#111827] dark:text-white">{content.topic}</h2>
            <p className="text-sm text-[#6B7280] dark:text-gray-400 mt-1">Day {selectedDay} • {userLevel} • {nativeLanguage}</p>
          </div>
        </div>

        {/* LESSON CONTENT VIEW */}
        {!hasReadContent ? (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            <div className="bg-white dark:bg-[#1F2937] rounded-3xl border border-[#E5E7EB] dark:border-gray-700 p-6 md:p-8 space-y-8 shadow-sm">

              {/* Explanation */}
              {content.explanation && (
                <div className="space-y-3">
                  <h3 className="text-lg font-bold text-[#111827] dark:text-white flex items-center gap-2">
                    <FileText className="text-indigo-600" size={18} /> Concept ({nativeLanguage})
                  </h3>
                  <p className="text-base text-[#111827] dark:text-white leading-relaxed">{content.explanation}</p>
                  {content.explanationTranslation && (
                    <div className="p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-2xl border border-indigo-100 dark:border-indigo-800">
                      <span className="text-[10px] uppercase font-bold text-indigo-500 block mb-1">{nativeLanguage}:</span>
                      <p className="text-indigo-700 dark:text-indigo-300 font-medium">{content.explanationTranslation}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Rules */}
              {content.rules && content.rules.length > 0 && (
                <div className="space-y-3">
                  <h4 className="text-sm font-bold uppercase tracking-wider text-gray-500">Key Rules:</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {content.rules.map((rule: string, i: number) => (
                      <div key={i} className="p-3 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 flex items-start gap-2 text-sm">
                        <CheckCircle2 size={15} className="text-emerald-500 shrink-0 mt-0.5" />
                        <span className="text-gray-800 dark:text-gray-200">{rule}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Tense Structure */}
              {content.tenseStructure && (
                <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-100 dark:border-orange-800 rounded-2xl p-5">
                  <h4 className="text-orange-800 dark:text-orange-300 font-bold mb-2 flex items-center gap-2">
                    <Layers size={16} /> Structure / Formula
                  </h4>
                  <code className="text-lg font-mono text-orange-600 dark:text-orange-300 bg-white dark:bg-gray-800 px-4 py-2 rounded-lg block text-center">
                    {content.tenseStructure}
                  </code>
                </div>
              )}

              {/* Vocabulary */}
              {content.vocabulary && content.vocabulary.length > 0 && (
                <div className="space-y-4">
                  <h3 className="text-lg font-bold text-[#111827] dark:text-white flex items-center gap-2">
                    <Book className="text-blue-600" size={18} /> Vocabulary ({content.vocabulary.length} Words)
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {content.vocabulary.map((item: any, i: number) => (
                      <div key={i} className="p-5 bg-gray-50 dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 space-y-2">
                        <div className="flex items-center justify-between">
                          <h4 className="text-xl font-bold text-blue-600 dark:text-blue-400">{item.word}</h4>
                          <button onClick={() => speak(item.word)} className="p-1.5 bg-blue-100 dark:bg-blue-900/30 text-blue-600 rounded-lg hover:bg-blue-200 transition-colors">
                            <Volume2 size={15} />
                          </button>
                        </div>
                        <p className="text-[#111827] dark:text-white font-medium text-sm">{item.meaning}</p>
                        <div className="p-2 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl">
                          <span className="text-[10px] font-bold text-indigo-500 uppercase">{nativeLanguage}: </span>
                          <span className="text-sm font-bold text-indigo-700 dark:text-indigo-300">{item.translation}</span>
                        </div>
                        {item.example && (
                          <p className="text-xs text-[#6B7280] dark:text-gray-400 italic">"{item.example}"</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Verbs V1-V4 */}
              {content.verbs && content.verbs.length > 0 && (
                <div className="space-y-4">
                  <h3 className="text-lg font-bold text-[#111827] dark:text-white flex items-center gap-2">
                    <Mic2 className="text-indigo-600" size={18} /> Verbs — 4 Forms
                  </h3>
                  {content.verbs.map((verb: any, i: number) => (
                    <div key={i} className="bg-gray-50 dark:bg-gray-800 p-5 rounded-2xl border border-gray-100 dark:border-gray-700 space-y-3">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xl font-bold text-indigo-600 dark:text-indigo-400">{verb.v1} <span className="text-sm font-normal text-gray-500">({verb.translation})</span></h4>
                        <button onClick={() => speak(verb.v1)} className="p-1.5 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 rounded-lg">
                          <Volume2 size={14} />
                        </button>
                      </div>
                      <div className="grid grid-cols-4 gap-2 text-center">
                        {[['V1', verb.v1], ['V2', verb.v2], ['V3', verb.v3], ['V4 (-ing)', verb.v4]].map(([label, val]) => (
                          <div key={label} className="p-2 bg-white dark:bg-gray-900 rounded-lg">
                            <span className="text-[10px] text-gray-400 block">{label}</span>
                            <span className="font-bold text-sm text-[#111827] dark:text-white">{val}</span>
                          </div>
                        ))}
                      </div>
                      {verb.example && <p className="text-xs text-gray-500 italic">"{verb.example}"</p>}
                    </div>
                  ))}
                </div>
              )}

              {/* Examples */}
              {content.examples && content.examples.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-lg font-bold text-[#111827] dark:text-white">Examples</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {content.examples.map((ex: any, i: number) => (
                      <div key={i} className="p-4 bg-gray-50 dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 space-y-1">
                        <p className="font-bold text-[#111827] dark:text-white text-sm">{ex.english}</p>
                        <p className="text-xs text-[#6B7280] dark:text-gray-400">{ex.translation}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex justify-center pt-4 border-t border-gray-100 dark:border-gray-800">
                <button
                  onClick={() => setHasReadContent(true)}
                  className="bg-[#4F46E5] text-white px-10 py-4 rounded-2xl font-bold shadow-lg hover:bg-indigo-600 transition-all flex items-center gap-2"
                >
                  Start Quiz ({content.questions?.length || 5} Questions) <ChevronRight size={18} />
                </button>
              </div>
            </div>
          </motion.div>

        ) : !finished && content.questions && content.questions.length > 0 ? (

          /* QUIZ VIEW */
          <div className="space-y-5">
            <div className="flex items-center justify-between px-2">
              <span className="text-sm font-bold text-[#4F46E5]">Question {currentQ + 1} of {content.questions.length}</span>
              <div className="flex items-center gap-2">
                <Trophy size={16} className="text-yellow-500" />
                <span className="text-sm font-bold text-gray-700 dark:text-gray-300">Score: {score}</span>
              </div>
            </div>

            <div className="w-full bg-gray-200 dark:bg-gray-800 h-2 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-[#4F46E5]"
                animate={{ width: `${((currentQ + 1) / content.questions.length) * 100}%` }}
              />
            </div>

            <motion.div key={currentQ} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
              className="bg-white dark:bg-[#1F2937] rounded-3xl border border-[#E5E7EB] dark:border-gray-700 p-6 md:p-8 space-y-6 shadow-sm"
            >
              <div>
                <h3 className="text-xl font-bold text-[#111827] dark:text-white">{content.questions[currentQ].question}</h3>
                {content.questions[currentQ].translation && (
                  <p className="text-sm text-[#6B7280] dark:text-gray-400 mt-1 italic">{content.questions[currentQ].translation}</p>
                )}
              </div>

              <div className="grid grid-cols-1 gap-3">
                {content.questions[currentQ].options.map((opt: string, i: number) => {
                  const isCorrect = opt === content.questions[currentQ].answer;
                  const isSelected = opt === selectedAnswer;
                  let cls = 'border-gray-100 dark:border-gray-700 hover:border-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 text-gray-700 dark:text-gray-300';
                  if (showExplanation) {
                    if (isCorrect) cls = 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300';
                    else if (isSelected) cls = 'border-red-500 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300';
                    else cls = 'opacity-40 border-gray-100 dark:border-gray-700 text-gray-400';
                  } else if (isSelected) cls = 'border-[#4F46E5] bg-indigo-50 dark:bg-indigo-900/20 text-[#4F46E5]';
                  return (
                    <button key={i} onClick={() => handleAnswerSelect(opt)} disabled={showExplanation}
                      className={`w-full p-4 rounded-2xl border-2 text-left font-medium transition-all flex items-center justify-between ${cls}`}
                    >
                      <span>{opt}</span>
                      {showExplanation && isCorrect && <CheckCircle2 size={18} className="text-emerald-500" />}
                      {showExplanation && isSelected && !isCorrect && <AlertCircle size={18} className="text-red-500" />}
                    </button>
                  );
                })}
              </div>

              {showExplanation && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  className={`p-5 rounded-2xl border ${selectedAnswer === content.questions[currentQ].answer ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-100 dark:border-emerald-800' : 'bg-red-50 dark:bg-red-900/20 border-red-100 dark:border-red-800'}`}
                >
                  <p className="font-bold mb-1 text-[#111827] dark:text-white text-sm">Explanation ({nativeLanguage}):</p>
                  <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">{content.questions[currentQ].explanation}</p>
                  <button onClick={nextQuestion}
                    className="mt-4 w-full bg-[#111827] dark:bg-indigo-600 text-white py-3 rounded-xl font-bold hover:bg-black dark:hover:bg-indigo-700 transition-colors"
                  >
                    {currentQ === content.questions.length - 1 ? '🎉 Finish Lesson' : 'Next Question →'}
                  </button>
                </motion.div>
              )}
            </motion.div>
          </div>

        ) : (

          /* FINISH VIEW */
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
            className="bg-white dark:bg-[#1F2937] rounded-3xl border border-[#E5E7EB] dark:border-gray-700 p-10 text-center space-y-6 shadow-sm"
          >
            <div className="w-20 h-20 bg-emerald-50 dark:bg-emerald-900/20 rounded-full flex items-center justify-center mx-auto text-emerald-500">
              <Trophy size={44} />
            </div>
            <div>
              <h2 className="text-3xl font-bold text-[#111827] dark:text-white">Day {selectedDay} Complete! 🎉</h2>
              <p className="text-[#6B7280] dark:text-gray-400 mt-2">Score: {score} / {content.questions?.length || 0}</p>
            </div>
            <div className="bg-indigo-50 dark:bg-indigo-900/20 p-4 rounded-2xl border border-indigo-100 dark:border-indigo-800 inline-block">
              <p className="text-[#4F46E5] dark:text-indigo-300 font-bold">
                {score === content.questions?.length ? '🌟 Perfect Score!' : score >= (content.questions?.length || 0) / 2 ? '👍 Well done!' : '💪 Keep practicing!'}
              </p>
              <p className="text-sm text-indigo-400 mt-1">Next: Day {selectedDay < 30 ? selectedDay + 1 : 1}</p>
            </div>
            <button
              onClick={() => { setSelectedModule(null); setContent(null); }}
              className="bg-[#111827] dark:bg-white text-white dark:text-[#111827] px-10 py-4 rounded-2xl font-bold hover:bg-black dark:hover:bg-gray-100 transition-colors"
            >
              Back to Learning Center
            </button>
          </motion.div>
        )}
      </motion.div>
    );
  }

  // MODULES GRID
  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold text-[#111827] dark:text-white">Learning Center</h2>
          <p className="text-[#6B7280] dark:text-gray-400 text-sm">Daily AI-powered lessons in {nativeLanguage}</p>
        </div>
        <div className="flex items-center gap-2 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 px-4 py-2 rounded-xl border border-emerald-100 dark:border-emerald-800">
          <CheckCircle2 size={16} />
          <span className="text-sm font-bold">Level: {userLevel}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {MODULES.map((mod) => {
          const Icon = ICON_MAP[mod.icon] || Book;
          const isCompleted = Boolean(completedToday[mod.id]);
          const isLocked = !isPro && mod.id !== 'vocabulary';

          return (
            <div
              key={mod.id}
              onClick={() => handleSelectModule(mod.id)}
              className={`group bg-white dark:bg-[#121214] p-6 rounded-3xl border transition-all cursor-pointer relative overflow-hidden ${
                isCompleted
                  ? 'border-emerald-200 dark:border-emerald-900/30 bg-emerald-50/20'
                  : 'border-[#E5E7EB] dark:border-[#1F1F22] hover:border-[#4F46E5] hover:shadow-xl hover:shadow-indigo-50 dark:hover:shadow-none'
              }`}
            >
              {isLocked && (
                <div className="absolute top-4 right-4">
                  <Sparkles size={20} className="text-amber-400 fill-amber-400" />
                </div>
              )}
              <div className={`w-12 h-12 ${mod.color} rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                <Icon size={24} />
              </div>
              <h3 className="text-lg font-bold text-[#111827] dark:text-white mb-1">{mod.title}</h3>
              <p className="text-xs text-[#6B7280] dark:text-gray-400 mb-4 leading-relaxed">{mod.description}</p>
              <div className="flex items-center justify-between pt-3 border-t border-gray-100 dark:border-gray-800">
                <span className={`text-sm font-bold ${isCompleted ? 'text-emerald-600' : 'text-[#4F46E5] dark:text-indigo-400'}`}>
                  {isCompleted ? '✅ Done Today' : isLocked ? '🔒 Pro Only' : 'Start →'}
                </span>
                {!isLocked && <ChevronRight size={16} className="text-indigo-400 group-hover:translate-x-1 transition-transform" />}
              </div>
            </div>
          );
        })}
      </div>

      {/* Progress bar */}
      <div className="bg-[#111827] dark:bg-[#121214] rounded-3xl p-6 text-white border border-white/5">
        <p className="text-sm text-gray-400 mb-3 font-bold uppercase tracking-wider">Today's Progress</p>
        <div className="flex items-center gap-4">
          <div className="flex-1 bg-gray-800 h-3 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-indigo-500 rounded-full"
              animate={{ width: `${(Object.keys(completedToday).length / MODULES.length) * 100}%` }}
              transition={{ duration: 0.5 }}
            />
          </div>
          <span className="text-sm font-bold shrink-0">{Object.keys(completedToday).length}/{MODULES.length} Done</span>
        </div>
      </div>
    </div>
  );
}

// Emergency fallback — always works, zero API calls
function getEmergencyFallback(moduleId: string, day: number, language: string): any {
  return {
    topic: `Day ${day}: ${moduleId.charAt(0).toUpperCase() + moduleId.slice(1)} Practice`,
    explanation: `Today's lesson covers important ${moduleId} concepts for English learning.`,
    explanationTranslation: `Aaj ke path mein ${moduleId} ke zaroori concepts cover kiye gaye hain.`,
    rules: [
      "Read each point carefully",
      "Practice with the examples given",
      "Attempt all quiz questions honestly"
    ],
    examples: [
      { english: "I am learning English every day.", translation: "Main roz English seekh raha hoon." },
      { english: "Practice makes perfect.", translation: "Abhyaas se hi safalta milti hai." }
    ],
    questions: [
      { question: "Which is the correct English sentence?", translation: "Kaun sa English sentence sahi hai?", options: ["I am learn English.", "I learning English.", "I am learning English.", "I learns English."], answer: "I am learning English.", explanation: "Present Continuous mein 'am/is/are + V4 (-ing)' use hota hai. 'I am learning' sahi hai." },
      { question: "Choose the correct option: 'She ___ to school daily.'", translation: "Sahi option chunein.", options: ["go", "goes", "going", "gone"], answer: "goes", explanation: "She (He/She/It) ke saath Simple Present mein verb mein 's' lagate hain. 'Goes' sahi hai." },
      { question: "What is the past tense of 'eat'?", translation: "'Eat' ka past tense kya hai?", options: ["eated", "eating", "eaten", "ate"], answer: "ate", explanation: "'Eat' ka Past (V2) 'Ate' hai. Jaise: I ate rice yesterday." },
      { question: "Which sentence has correct grammar?", translation: "Kaun sa sentence grammatically sahi hai?", options: ["He don't like tea.", "He doesn't likes tea.", "He doesn't like tea.", "He not like tea."], answer: "He doesn't like tea.", explanation: "He/She/It ke negative mein 'doesn't + V1' use hota hai. 'He doesn't like tea' sahi hai." },
      { question: "Choose the correct article: '___ honest man'", translation: "Sahi article chunein.", options: ["a", "an", "the", "no article"], answer: "an", explanation: "'Honest' mein 'h' silent hai, isliye vowel sound 'o' se shuru hota hai. 'An honest man' sahi hai." }
    ]
  };
}
