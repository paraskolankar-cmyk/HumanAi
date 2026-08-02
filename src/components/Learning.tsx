import React, { useState, useEffect } from 'react';
import { 
  Book, 
  Type, 
  Mic2, 
  FileText, 
  Hash, 
  Layers,
  ChevronRight,
  Sparkles,
  ArrowLeft,
  BookOpen,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Trophy,
  Volume2,
  User,
  BrainCircuit,
  Clock
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { humanAiService, getSelectedLanguageName } from '../services/geminiService';

const ICON_MAP: Record<string, any> = {
  Book, Type, Mic2, FileText, Hash, Layers, Clock, User, Sparkles, BrainCircuit
};

const MODULES = [
  { id: 'vocabulary', title: 'Vocabulary', icon: 'Book', color: 'bg-blue-50 text-blue-600', description: 'Learn new words and phrases daily.' },
  { id: 'grammar', title: 'Grammar', icon: 'Type', color: 'bg-purple-50 text-purple-600', description: 'Master English grammar rules.' },
  { id: 'tenses', title: 'Tenses', icon: 'Clock', color: 'bg-orange-50 text-orange-600', description: 'Daily tense structure and practice.' },
  { id: 'syno-anto', title: 'Synonyms & Antonyms', icon: 'Layers', color: 'bg-emerald-50 text-emerald-600', description: 'Learn synonyms and antonyms daily.' },
  { id: 'noun-pronoun', title: 'Noun & Pronoun', icon: 'User', color: 'bg-pink-50 text-pink-600', description: 'Learn nouns and pronouns with examples.' },
  { id: 'verbs', title: 'Verbs', icon: 'Mic2', color: 'bg-indigo-50 text-indigo-600', description: 'Master verbs in all 4 forms.' },
  { id: 'voice-narration', title: 'Voice & Narration', icon: 'Hash', color: 'bg-red-50 text-red-600', description: 'Master Active/Passive voice and Narration.' },
  { id: 'other-pos', title: 'Advanced Grammar', icon: 'Sparkles', color: 'bg-yellow-50 text-yellow-600', description: 'Adjectives, Conjunctions, Articles & more.' },
  { id: 'expert-grammar', title: 'Expert Grammar', icon: 'BrainCircuit', color: 'bg-orange-50 text-orange-600', description: 'Infinitive, Participle, Inversion & Mood.' },
];

interface LearningProps {
  isDarkMode?: boolean;
  onThemeToggle?: () => void;
  userEmail?: string | null;
  userName?: string | null;
  isPro?: boolean;
  onTrialExpired?: () => void;
}

export default function Learning({ isDarkMode, onThemeToggle, userEmail, userName, isPro, onTrialExpired }: LearningProps) {
  const [selectedModule, setSelectedModule] = useState<string | null>(null);
  const [content, setContent] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [showExplanation, setShowExplanation] = useState(false);
  const [score, setScore] = useState(0);
  const [isLessonFinished, setIsLessonFinished] = useState(false);
  const [hasReadContent, setHasReadContent] = useState(false);
  
  const userLevel = localStorage.getItem('humnai_user_level') || 'Beginner';
  const nativeLanguage = getSelectedLanguageName();

  const [completedToday, setCompletedToday] = useState<Record<string, boolean>>(() => {
    const saved = localStorage.getItem('humnai_daily_completion');
    const today = new Date().toDateString();
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.date === today) return parsed.modules || {};
      } catch (e) {
        console.error("Failed to parse completion data", e);
      }
    }
    return {};
  });

  useEffect(() => {
    if (selectedModule) {
      fetchDailyContent();
    }
  }, [selectedModule]);

  const fetchDailyContent = async () => {
    if (!selectedModule) return;

    // Restriction: Only Vocabulary is free for non-pro users
    if (!isPro && selectedModule !== 'vocabulary') {
      if (onTrialExpired) {
        onTrialExpired();
      } else {
        alert("Please upgrade to Pro to access this module!");
      }
      setSelectedModule(null);
      return;
    }

    setIsLoading(true);
    try {
      let category = selectedModule;
      if (selectedModule === 'syno-anto') category = 'Synonyms & Antonyms';
      if (selectedModule === 'noun-pronoun') category = 'Noun & Pronoun';
      if (selectedModule === 'verbs') category = 'Verbs';
      if (selectedModule === 'voice-narration') category = 'Voice & Narration';
      if (selectedModule === 'other-pos') category = 'Other Parts of Speech';
      if (selectedModule === 'expert-grammar') category = 'Expert Grammar';
      
      const data = await humanAiService.getDailyLearningContent(category!, userLevel, nativeLanguage);
      
      if (data) {
        setContent(data);
      } else {
        throw new Error("Invalid Content Returned");
      }

      setHasReadContent(false);
      setIsLessonFinished(false);
      setCurrentQuestionIndex(0);
      setScore(0);
      setSelectedAnswer(null);
      setShowExplanation(false);
    } catch (error) {
      console.error('Failed to fetch daily content, using fallback structure', error);
      
      // Structured Fallback Data so Content ALWAYS displays properly
      const fallbackContent = {
        topic: `${selectedModule.toUpperCase()} Essential Rules & Practice`,
        explanation: `Today's lesson focuses on core principles of ${selectedModule} tailored for ${userLevel} level learners.`,
        explanationTranslation: `Aaj ka yah path ${selectedModule} ke mukhya niyamo aur udaaharano par aadharit hai.`,
        vocabulary: selectedModule === 'vocabulary' ? [
          { word: "Achieve", meaning: "To accomplish or reach a goal successfully", translation: "Praapt karna / Safal hona", example: "She worked hard to achieve her dreams." },
          { word: "Fluent", meaning: "Able to express oneself easily and articulately", translation: "Dhaarapravaah bolne yogya", example: "He is fluent in English conversation." },
          { word: "Confidence", meaning: "A feeling of self-assurance arising from one's appreciation of one's own abilities", translation: "Aatmavishvaas", example: "Practice daily to boost your confidence." }
        ] : undefined,
        verbs: selectedModule === 'verbs' ? [
          { v1: "Speak", v2: "Spoke", v3: "Spoken", v4: "Speaking", translation: "Bolna", example: "I speak English fluently." },
          { v1: "Learn", v2: "Learnt", v3: "Learnt", v4: "Learning", translation: "Seekhna", example: "She is learning grammar." }
        ] : undefined,
        examples: [
          { english: "Consistency is key to mastering English.", translation: "Angrezi seekhne ke liye nirantar abhyaas zaroori hai." },
          { english: "Practice speaking every single day.", translation: "Roj bolne ka abhyaas karein." }
        ],
        questions: [
          {
            question: `Which option accurately applies to today's ${selectedModule} topic?`,
            translation: "Kaun sa vikalp sahi hai?",
            options: ["Correct Option", "Incorrect Option 1", "Incorrect Option 2", "Incorrect Option 3"],
            answer: "Correct Option",
            explanation: "This is the grammatically correct choice according to English rules."
          }
        ]
      };
      setContent(fallbackContent);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAnswerSelect = (answer: string) => {
    if (showExplanation || !content?.questions) return;
    setSelectedAnswer(answer);
    setShowExplanation(true);
    if (answer === content.questions[currentQuestionIndex]?.answer) {
      setScore(prev => prev + 1);
    }
  };

  const nextQuestion = () => {
    if (content?.questions && currentQuestionIndex < content.questions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
      setSelectedAnswer(null);
      setShowExplanation(false);
    } else {
      setIsLessonFinished(true);
      const today = new Date().toDateString();
      const newCompletion = { ...completedToday, [selectedModule!]: true };
      setCompletedToday(newCompletion);
      localStorage.setItem('humnai_daily_completion', JSON.stringify({
        date: today,
        modules: newCompletion
      }));
    }
  };

  const speak = (text: string, lang: string = 'en-US') => {
    if (!text) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang;
    utterance.rate = 0.9;
    
    const voices = window.speechSynthesis.getVoices();
    let preferredVoice;
    
    if (lang.startsWith('en')) {
      preferredVoice = voices.find(v => v.lang === 'en-IN' || v.name.includes('India'));
      if (!preferredVoice) {
        preferredVoice = voices.find(v => v.name.includes('Google US English') || v.name.includes('Samantha') || v.name.includes('Female'));
      }
    } else {
      preferredVoice = voices.find(v => v.lang === lang && (v.name.includes('India') || v.name.includes('Google') || v.name.includes('Microsoft')));
      if (!preferredVoice) preferredVoice = voices.find(v => v.lang === lang);
      if (!preferredVoice) preferredVoice = voices.find(v => v.lang.startsWith(lang.split('-')[0]) && v.name.includes('India'));
      if (!preferredVoice) preferredVoice = voices.find(v => v.lang.startsWith(lang.split('-')[0]));
    }
    
    if (preferredVoice) utterance.voice = preferredVoice;
    window.speechSynthesis.speak(utterance);
  };

  const langMap: Record<string, string> = {
    'Hindi': 'hi-IN',
    'Marathi': 'mr-IN',
    'Spanish': 'es-ES',
    'French': 'fr-FR',
    'German': 'de-DE',
    'Japanese': 'ja-JP',
    'Bengali': 'bn-IN',
    'Tamil': 'ta-IN',
    'Telugu': 'te-IN',
    'Urdu': 'ur-PK',
    'Punjabi': 'pa-IN',
    'Gujarati': 'gu-IN',
    'Kannada': 'kn-IN',
    'Odia': 'or-IN',
    'Assamese': 'as-IN',
    'Bhojpuri': 'hi-IN',
    'Malayalam': 'ml-IN'
  };

  if (isLoading) {
    return (
      <div className="h-[60vh] flex flex-col items-center justify-center gap-4">
        <Loader2 size={48} className="text-[#4F46E5] animate-spin" />
        <p className="font-bold text-[#111827] dark:text-white">Generating your daily lesson & content...</p>
        <p className="text-sm text-[#6B7280] dark:text-gray-400">Tailoring content for {userLevel} level in {nativeLanguage}</p>
      </div>
    );
  }

  if (selectedModule && content) {
    return (
      <motion.div 
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        className="space-y-8 pb-20 max-w-5xl mx-auto"
      >
        <button 
          onClick={() => {
            setSelectedModule(null);
            setContent(null);
          }}
          className="flex items-center gap-2 text-[#6B7280] dark:text-gray-400 hover:text-[#111827] dark:hover:text-white transition-colors font-medium cursor-pointer"
        >
          <ArrowLeft size={20} />
          Back to Learning Center
        </button>

        <div className="bg-white dark:bg-[#1F2937] rounded-3xl border border-[#E5E7EB] dark:border-gray-700 p-8 shadow-sm">
          <div className="flex items-center gap-4">
            <div className={`p-3 rounded-2xl ${MODULES.find(m => m.id === selectedModule)?.color || 'bg-indigo-50 text-indigo-600'}`}>
              <BookOpen size={24} />
            </div>
            <div>
              <h2 className="text-3xl font-bold text-[#111827] dark:text-white">{content.topic || 'Daily Lesson'}</h2>
              <p className="text-[#6B7280] dark:text-gray-400">Daily {selectedModule} Lesson • {userLevel} Level in {nativeLanguage}</p>
            </div>
          </div>
        </div>

        {/* 1. LESSON CONTENT DISPLAY VIEW */}
        {!hasReadContent ? (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            <div className="bg-white dark:bg-[#1F2937] rounded-3xl border border-[#E5E7EB] dark:border-gray-700 p-8 space-y-8 shadow-sm">
              
              {/* General Explanation Section */}
              {content.explanation && (
                <div className="space-y-4">
                  <h3 className="text-xl font-bold text-[#111827] dark:text-white flex items-center gap-2">
                    <FileText className="text-indigo-600 dark:text-indigo-400" size={20} />
                    Lesson Explanation
                  </h3>
                  <div className="prose prose-indigo max-w-none space-y-3">
                    <p className="text-lg text-[#111827] dark:text-white leading-relaxed">{content.explanation}</p>
                    {content.explanationTranslation && (
                      <div className="p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-2xl border border-indigo-100 dark:border-indigo-900/30">
                        <p className="text-[#4F46E5] dark:text-indigo-300 font-medium">{content.explanationTranslation}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Tenses Structure Formula Section */}
              {content.tenseStructure && (
                <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-100 dark:border-orange-900/30 rounded-2xl p-6">
                  <h4 className="text-orange-800 dark:text-orange-300 font-bold mb-2 flex items-center gap-2">
                    <Layers size={18} />
                    Structure / Formula
                  </h4>
                  <code className="text-xl font-mono text-orange-600 dark:text-orange-400 bg-white dark:bg-gray-800 px-4 py-2 rounded-lg border border-orange-200 dark:border-orange-900/50 block text-center">
                    {content.tenseStructure}
                  </code>
                </div>
              )}

              {/* Vocabulary Display */}
              {content.vocabulary && content.vocabulary.length > 0 && (
                <div className="space-y-6">
                  <h3 className="text-xl font-bold text-[#111827] dark:text-white flex items-center gap-2">
                    <Book className="text-blue-600 dark:text-blue-400" size={20} />
                    Daily Vocabulary Words
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {content.vocabulary.map((item: any, i: number) => (
                      <div key={i} className="p-6 bg-gray-50 dark:bg-gray-800/50 rounded-2xl border border-gray-100 dark:border-gray-700 flex flex-col justify-between gap-3 hover:border-blue-200 transition-all">
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <h4 className="text-xl font-bold text-blue-600 dark:text-blue-400">{item.word}</h4>
                            <button 
                              onClick={() => speak(item.word)}
                              className="p-1.5 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg hover:bg-blue-200 transition-colors"
                            >
                              <Volume2 size={16} />
                            </button>
                          </div>
                          <p className="text-[#111827] dark:text-white font-medium">{item.meaning}</p>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-gray-400 uppercase">Translation:</span>
                            <p className="text-[#4F46E5] dark:text-indigo-400 font-bold">{item.translation}</p>
                          </div>
                          {item.example && (
                            <p className="text-sm text-[#6B7280] dark:text-gray-400 italic">
                              <span className="font-bold text-blue-400 not-italic mr-1">Example:</span>
                              "{item.example}"
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Verbs (V1 - V4) Display */}
              {content.verbs && content.verbs.length > 0 && (
                <div className="space-y-6">
                  <h3 className="text-xl font-bold text-[#111827] dark:text-white flex items-center gap-2">
                    <Mic2 className="text-indigo-600 dark:text-indigo-400" size={20} />
                    Daily Verbs (4 Forms)
                  </h3>
                  <div className="grid grid-cols-1 gap-4">
                    {content.verbs.map((verb: any, i: number) => (
                      <div key={i} className="bg-gray-50 dark:bg-gray-800/50 p-6 rounded-2xl border border-gray-100 dark:border-gray-700 space-y-4">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-200 dark:border-gray-700 pb-3">
                          <div>
                            <h4 className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">{verb.v1} ({verb.translation})</h4>
                          </div>
                          {verb.example && <p className="text-sm text-indigo-800 dark:text-indigo-200 italic">"{verb.example}"</p>}
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-center">
                          <div className="p-2 bg-white dark:bg-gray-800 rounded-lg"><span className="text-[10px] text-gray-400 block">V1</span><span className="font-bold">{verb.v1}</span></div>
                          <div className="p-2 bg-white dark:bg-gray-800 rounded-lg"><span className="text-[10px] text-gray-400 block">V2</span><span className="font-bold">{verb.v2}</span></div>
                          <div className="p-2 bg-white dark:bg-gray-800 rounded-lg"><span className="text-[10px] text-gray-400 block">V3</span><span className="font-bold">{verb.v3}</span></div>
                          <div className="p-2 bg-white dark:bg-gray-800 rounded-lg"><span className="text-[10px] text-gray-400 block">V4 (-ing)</span><span className="font-bold">{verb.v4}</span></div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Examples Display */}
              {content.examples && content.examples.length > 0 && (
                <div className="space-y-4">
                  <h3 className="text-xl font-bold text-[#111827] dark:text-white">Examples</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {content.examples.map((ex: any, i: number) => (
                      <div key={i} className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-2xl border border-gray-100 dark:border-gray-700 space-y-1">
                        <p className="font-bold text-[#111827] dark:text-white">{ex.english}</p>
                        <p className="text-sm text-[#6B7280] dark:text-gray-400">{ex.translation}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Start Quiz Action Button */}
              <div className="flex justify-center pt-6 border-t border-gray-100 dark:border-gray-800">
                <button 
                  onClick={() => setHasReadContent(true)}
                  className="bg-[#4F46E5] text-white px-12 py-4 rounded-2xl font-bold shadow-lg shadow-indigo-100 dark:shadow-none hover:bg-indigo-600 transition-all flex items-center gap-2 cursor-pointer"
                >
                  Start Practice Quiz
                  <ChevronRight size={20} />
                </button>
              </div>
            </div>
          </motion.div>
        ) : !isLessonFinished && content.questions && content.questions.length > 0 ? (
          
          /* 2. PRACTICE QUIZ VIEW */
          <div className="space-y-6">
            <div className="flex items-center justify-between px-4">
              <span className="text-sm font-bold text-[#4F46E5] dark:text-indigo-400">Question {currentQuestionIndex + 1} of {content.questions.length}</span>
              <div className="flex items-center gap-2">
                <Trophy size={18} className="text-yellow-500" />
                <span className="text-sm font-bold text-gray-700 dark:text-gray-300">Score: {score}</span>
              </div>
            </div>

            <div className="w-full bg-gray-200 dark:bg-gray-800 h-2 rounded-full overflow-hidden">
              <motion.div 
                className="h-full bg-[#4F46E5] dark:bg-indigo-400"
                initial={{ width: 0 }}
                animate={{ width: `${((currentQuestionIndex + 1) / content.questions.length) * 100}%` }}
              />
            </div>

            <motion.div 
              key={currentQuestionIndex}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="bg-white dark:bg-[#1F2937] rounded-3xl border border-[#E5E7EB] dark:border-gray-700 p-8 space-y-8 shadow-sm"
            >
              <div className="space-y-4">
                <h3 className="text-2xl font-bold text-[#111827] dark:text-white">{content.questions[currentQuestionIndex].question}</h3>
                {content.questions[currentQuestionIndex].translation && (
                  <p className="text-lg text-[#6B7280] dark:text-gray-400 italic">{content.questions[currentQuestionIndex].translation}</p>
                )}
              </div>

              <div className="grid grid-cols-1 gap-4">
                {content.questions[currentQuestionIndex].options.map((opt: string, i: number) => {
                  const isCorrect = opt === content.questions[currentQuestionIndex].answer;
                  const isSelected = opt === selectedAnswer;
                  
                  let buttonClass = "border-gray-100 dark:border-gray-700 hover:border-indigo-200 dark:hover:border-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 text-gray-700 dark:text-gray-300";
                  if (showExplanation) {
                    if (isCorrect) buttonClass = "border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400";
                    else if (isSelected) buttonClass = "border-red-500 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400";
                    else buttonClass = "opacity-50 border-gray-100 dark:border-gray-700 text-gray-400 dark:text-gray-500";
                  } else if (isSelected) {
                    buttonClass = "border-[#4F46E5] dark:border-indigo-600 bg-indigo-50 dark:bg-indigo-900/20 text-[#4F46E5] dark:text-indigo-400";
                  }

                  return (
                    <button
                      key={i}
                      onClick={() => handleAnswerSelect(opt)}
                      disabled={showExplanation}
                      className={`w-full p-5 rounded-2xl border-2 text-left font-bold transition-all flex items-center justify-between cursor-pointer ${buttonClass}`}
                    >
                      <span>{opt}</span>
                      {showExplanation && isCorrect && <CheckCircle2 size={20} className="text-emerald-500" />}
                      {showExplanation && isSelected && !isCorrect && <AlertCircle size={20} className="text-red-500" />}
                    </button>
                  );
                })}
              </div>

              {showExplanation && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className={`p-6 rounded-2xl border ${selectedAnswer === content.questions[currentQuestionIndex].answer ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-100 dark:border-emerald-900/30' : 'bg-red-50 dark:bg-red-900/20 border-red-100 dark:border-red-900/30'}`}
                >
                  <p className="font-bold mb-2 text-[#111827] dark:text-white">Explanation:</p>
                  <p className="text-sm leading-relaxed text-gray-700 dark:text-gray-300">{content.questions[currentQuestionIndex].explanation}</p>
                  <button 
                    onClick={nextQuestion}
                    className="mt-6 w-full bg-[#111827] dark:bg-indigo-600 text-white py-4 rounded-xl font-bold hover:bg-black dark:hover:bg-indigo-700 transition-colors cursor-pointer"
                  >
                    {currentQuestionIndex === content.questions.length - 1 ? 'Finish Lesson' : 'Next Question'}
                  </button>
                </motion.div>
              )}
            </motion.div>
          </div>
        ) : (
          /* 3. LESSON COMPLETE RESULT VIEW */
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white dark:bg-[#1F2937] rounded-3xl border border-[#E5E7EB] dark:border-gray-700 p-12 text-center space-y-6 shadow-sm"
          >
            <div className="w-20 h-20 bg-emerald-50 dark:bg-emerald-900/20 rounded-full flex items-center justify-center mx-auto text-emerald-500 dark:text-emerald-400">
              <Trophy size={48} />
            </div>
            <div className="space-y-2">
              <h2 className="text-3xl font-bold text-[#111827] dark:text-white">Daily Lesson Complete!</h2>
              <p className="text-[#6B7280] dark:text-gray-400 text-lg">You scored {score} out of {content.questions?.length || 0} in today's {selectedModule} practice.</p>
            </div>
            <div className="bg-indigo-50 dark:bg-indigo-900/20 p-6 rounded-2xl border border-indigo-100 dark:border-indigo-900/30 inline-block">
              <p className="text-[#4F46E5] dark:text-indigo-400 font-bold">Progress Saved!</p>
              <p className="text-sm text-indigo-400 dark:text-indigo-300">Come back tomorrow for new content.</p>
            </div>
            <div className="pt-6">
              <button 
                onClick={() => {
                  setSelectedModule(null);
                  setContent(null);
                }}
                className="bg-[#111827] dark:bg-white text-white dark:text-[#111827] px-12 py-4 rounded-2xl font-bold hover:bg-black dark:hover:bg-gray-200 transition-colors cursor-pointer"
              >
                Back to Learning Center
              </button>
            </div>
          </motion.div>
        )}
      </motion.div>
    );
  }

  /* Default Modules Grid View */
  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-[#111827] dark:text-white">Learning Center</h2>
          <p className="text-[#6B7280] dark:text-gray-400">Master English fundamentals with daily AI-powered lessons.</p>
        </div>
        <div className="flex items-center gap-2 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 px-4 py-2 rounded-xl border border-emerald-100 dark:border-emerald-900/30">
          <CheckCircle2 size={18} />
          <span className="text-sm font-bold">Level: {userLevel}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {MODULES.map((module) => {
          const Icon = ICON_MAP[module.icon] || Book;
          const isCompleted = completedToday[module.id];
          const isLocked = !isPro && module.id !== 'vocabulary';

          return (
            <div 
              key={module.id} 
              onClick={() => setSelectedModule(module.id)}
              className={`group bg-white dark:bg-[#121214] p-6 rounded-3xl border transition-all cursor-pointer relative overflow-hidden ${isCompleted ? 'border-emerald-200 dark:border-emerald-900/30 bg-emerald-50/30 dark:bg-emerald-900/10' : 'border-[#E5E7EB] dark:border-[#1F1F22] hover:border-[#4F46E5] dark:hover:border-indigo-500 hover:shadow-xl hover:shadow-indigo-50 dark:hover:shadow-none'}`}
            >
              {isLocked && (
                <div className="absolute top-4 right-4 text-amber-500">
                  <Sparkles size={24} className="fill-amber-500" />
                </div>
              )}
              <div className="flex items-start justify-between mb-6">
                <div className={`w-14 h-14 ${module.color} dark:bg-opacity-20 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform`}>
                  <Icon size={28} />
                </div>
              </div>
              <h3 className="text-xl font-bold text-[#111827] dark:text-white mb-2">{module.title}</h3>
              <p className="text-sm text-[#6B7280] dark:text-[#A1A1AA] mb-6">
                {module.description}
              </p>
              <div className="flex items-center justify-between pt-4 border-t border-[#F3F4F6] dark:border-[#1F1F22]">
                <span className={`text-sm font-bold ${isCompleted ? 'text-emerald-600 dark:text-emerald-400' : 'text-[#4F46E5] dark:text-indigo-400'}`}>
                  {isCompleted ? 'Completed Today' : 'Start Learning'}
                </span>
                <ChevronRight size={18} className={`${isCompleted ? 'text-emerald-600 dark:text-emerald-400' : 'text-[#4F46E5] dark:text-indigo-400'} group-hover:translate-x-1 transition-transform`} />
              </div>
            </div>
          );
        })}
      </div>

      <div className="bg-[#111827] dark:bg-[#121214] rounded-3xl p-8 text-white flex flex-col md:flex-row items-center gap-8 border border-white/5">
        <div className="flex-1 space-y-4 text-center md:text-left">
          <div className="inline-flex items-center gap-2 bg-indigo-500/20 text-indigo-300 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider">
            Daily Progress
          </div>
          <h3 className="text-3xl font-bold">Your Learning Journey</h3>
          <p className="text-gray-400 max-w-md">
            Complete your daily modules to unlock advanced lessons and earn badges.
          </p>
          <div className="flex items-center gap-4">
            <div className="flex-1 bg-gray-800 dark:bg-[#1F1F22] h-2 rounded-full overflow-hidden">
              <div 
                className="h-full bg-indigo-500 transition-all duration-500"
                style={{ width: `${(Object.keys(completedToday).length / MODULES.length) * 100}%` }}
              />
            </div>
            <span className="text-sm font-bold">{Object.keys(completedToday).length}/{MODULES.length} Done</span>
          </div>
        </div>
      </div>
    </div>
  );
}
