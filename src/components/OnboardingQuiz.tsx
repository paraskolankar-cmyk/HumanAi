import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Globe, 
  GraduationCap, 
  Briefcase, 
  Building2, 
  User, 
  ChevronRight, 
  ArrowRight,
  Sparkles,
  CheckCircle2,
  Volume2,
  Loader2
} from 'lucide-react';
import { GoogleGenAI, Modality, Type } from "@google/genai";
import { safeJsonParse } from '../services/geminiService';

interface OnboardingQuizProps {
  onComplete: (data: OnboardingData) => void;
  isDarkMode?: boolean;
}

export interface OnboardingData {
  nativeLanguage: string;
  educationStatus: string;
  otherEducation?: string;
  proficiencyLevel: string;
}

const languages = [
  'Hindi', 'Marathi', 'Urdu', 'Telugu', 'Tamil', 'Kannada', 
  'Assamese', 'Malayalam', 'Bhojpuri', 'Bengali', 'Odia', 
  'Spanish', 'French', 'German', 'Japanese', 'Punjabi', 'Gujarati',
];

const educationOptions = [
  { id: 'school', label: 'School', icon: GraduationCap },
  { id: 'college', label: 'College', icon: Building2 },
  { id: 'work', label: 'Work', icon: Briefcase },
  { id: 'business', label: 'Business', icon: Sparkles },
  { id: 'other', label: 'Other', icon: User },
];

const proficiencyOptions = [
  { id: 'words', label: '1-2 Words bol lete hai', description: 'Very basic vocabulary' },
  { id: 'sentences', label: '1-2 Sentences bol lete hai', description: 'Can form simple sentences' },
  { id: 'normal', label: 'Normal day-to-day bol lete hai par confident nahi hai', description: 'Conversational but lacks confidence' },
  { id: 'advance', label: 'Advance level tak', description: 'Fluent and confident' },
];

export default function OnboardingQuiz({ onComplete, isDarkMode }: OnboardingQuizProps) {
  const [step, setStep] = useState(1);
  const [data, setData] = useState<OnboardingData>({
    nativeLanguage: 'Hindi',
    educationStatus: '',
    proficiencyLevel: '',
  });
  const [otherText, setOtherText] = useState('');
  const [isFinishing, setIsFinishing] = useState(false);
  const [translations, setTranslations] = useState<any>(null);
  const [isTranslating, setIsTranslating] = useState(false);

  const handleNext = async () => {
    if (step === 1) {
      setStep(2);
      if (!translations && !isTranslating) {
        translateUI();
      }
    } else if (step < 3) {
      setStep(step + 1);
    } else {
      finishOnboarding();
    }
  };

  const translateUI = async () => {
    setIsTranslating(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Translate the following English strings into ${data.nativeLanguage}. 
        Return a JSON object with these keys:
        - q2Title: "What do you do?"
        - q2Sub: "Tell us about your current status."
        - q3Title: "How much English can you speak?"
        - q3Sub: "Select your current proficiency level."
        - finishTitle: "All Set!"
        - finishMessage: "Pareshan n ho mai HumnAi apka dost english practice me apki madad karuga ."
        - next: "Next"
        - back: "Back"
        - finish: "Finish"
        - specify: "Please specify..."
        - options: {
            school: "School",
            college: "College",
            work: "Work",
            business: "Business",
            other: "Other",
            words: "1-2 Words bol lete hai",
            sentences: "1-2 Sentences bol lete hai",
            normal: "Normal day-to-day bol lete hai par confident nahi hai",
            advance: "Advance level tak"
          }
        `,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              q2Title: { type: Type.STRING },
              q2Sub: { type: Type.STRING },
              q3Title: { type: Type.STRING },
              q3Sub: { type: Type.STRING },
              finishTitle: { type: Type.STRING },
              finishMessage: { type: Type.STRING },
              next: { type: Type.STRING },
              back: { type: Type.STRING },
              finish: { type: Type.STRING },
              specify: { type: Type.STRING },
              options: {
                type: Type.OBJECT,
                properties: {
                  school: { type: Type.STRING },
                  college: { type: Type.STRING },
                  work: { type: Type.STRING },
                  business: { type: Type.STRING },
                  other: { type: Type.STRING },
                  words: { type: Type.STRING },
                  sentences: { type: Type.STRING },
                  normal: { type: Type.STRING },
                  advance: { type: Type.STRING },
                }
              }
            }
          }
        }
      });
      const result = safeJsonParse(response.text);
      setTranslations(result);
    } catch (error) {
      console.error("Translation failed", error);
    } finally {
      setIsTranslating(false);
    }
  };

  const finishOnboarding = async () => {
    setIsFinishing(true);
    
    const message = translations?.finishMessage || 'Pareshan n ho mai HumnAi apka dost english practice me apki madad karuga .';
    
    // Play AI Voice Message using SpeechSynthesis for better reliability and language support
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(message);
      
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
        'Malayalam': 'ml-IN'
      };

      utterance.lang = langMap[data.nativeLanguage] || 'hi-IN';
      utterance.rate = 0.9;
      
      const voices = window.speechSynthesis.getVoices();
      const lang = utterance.lang;
      let preferredVoice = voices.find(v => v.lang === lang && (v.name.includes('India') || v.name.includes('Google') || v.name.includes('Microsoft')));
      if (!preferredVoice) {
        preferredVoice = voices.find(v => v.lang === lang);
      }
      if (!preferredVoice) {
        preferredVoice = voices.find(v => v.lang.startsWith(lang.split('-')[0]) && v.name.includes('India'));
      }
      if (!preferredVoice) {
        preferredVoice = voices.find(v => v.lang.startsWith(lang.split('-')[0]));
      }
      
      if (preferredVoice) utterance.voice = preferredVoice;

      utterance.onend = () => {
        // Add a small delay after speech ends for better UX
        setTimeout(() => {
          onComplete({
            ...data,
            otherEducation: data.educationStatus === 'other' ? otherText : undefined
          });
        }, 1000);
      };

      utterance.onerror = () => {
        onComplete({
          ...data,
          otherEducation: data.educationStatus === 'other' ? otherText : undefined
        });
      };

      window.speechSynthesis.speak(utterance);
    } catch (error) {
      console.error("Failed to play onboarding voice", error);
      onComplete({
        ...data,
        otherEducation: data.educationStatus === 'other' ? otherText : undefined
      });
    }
  };

  return (
    <div className="min-h-screen bg-[#F9FAFB] dark:bg-[#111827] flex items-center justify-center p-4 transition-colors duration-300">
      <div className="max-w-xl w-full">
        <AnimatePresence mode="wait">
          {!isFinishing ? (
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="bg-white dark:bg-[#1F2937] rounded-3xl shadow-xl border border-[#E5E7EB] dark:border-gray-700 p-8 md:p-10"
            >
              {/* Progress Bar */}
              <div className="flex gap-2 mb-8">
                {[1, 2, 3].map((s) => (
                  <div 
                    key={s} 
                    className={`h-1.5 flex-1 rounded-full transition-all duration-500 ${s <= step ? 'bg-[#4F46E5] dark:bg-indigo-500' : 'bg-gray-100 dark:bg-gray-800'}`}
                  />
                ))}
              </div>

              {step === 1 && (
                <div className="space-y-6">
                  <div className="space-y-2">
                    <h2 className="text-2xl md:text-3xl font-bold text-[#111827] dark:text-white">What is your native language?</h2>
                    <p className="text-[#6B7280] dark:text-gray-400">Select the language you are most comfortable with.</p>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3 h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                    {languages.map((lang) => (
                      <button
                        key={lang}
                        onClick={() => {
                          setData({ ...data, nativeLanguage: lang });
                          // Start translating in background as soon as language is picked
                          translateUI();
                        }}
                        className={`p-3 rounded-xl border-2 text-sm font-bold transition-all ${
                          data.nativeLanguage === lang 
                            ? 'border-[#4F46E5] bg-indigo-50 dark:bg-indigo-900/20 text-[#4F46E5] dark:text-indigo-400' 
                            : 'border-gray-100 dark:border-gray-800 hover:border-gray-200 dark:hover:border-gray-700 text-gray-600 dark:text-gray-400'
                        }`}
                      >
                        {lang}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {step === 2 && (
                <div className="space-y-6">
                  <div className="space-y-2">
                    <h2 className="text-2xl md:text-3xl font-bold text-[#111827] dark:text-white">{translations?.q2Title || "Ap kya karte hai?"}</h2>
                    <p className="text-[#6B7280] dark:text-gray-400">{translations?.q2Sub || "Tell us about your current status."}</p>
                  </div>
                  <div className="grid grid-cols-1 gap-3">
                    {isTranslating && !translations && (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="animate-spin text-indigo-500" size={32} />
                      </div>
                    )}
                    {(!isTranslating || translations) && educationOptions.map((opt) => (
                      <div key={opt.id} className="space-y-3">
                        <button
                          onClick={() => setData({ ...data, educationStatus: opt.id })}
                          className={`w-full p-4 rounded-2xl border-2 flex items-center gap-4 transition-all ${
                            data.educationStatus === opt.id 
                              ? 'border-[#4F46E5] bg-indigo-50 dark:bg-indigo-900/20' 
                              : 'border-gray-100 dark:border-gray-800 hover:border-gray-200 dark:hover:border-gray-700'
                          }`}
                        >
                          <div className={`p-2 rounded-xl ${data.educationStatus === opt.id ? 'bg-[#4F46E5] text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400'}`}>
                            <opt.icon size={20} />
                          </div>
                          <span className={`font-bold ${data.educationStatus === opt.id ? 'text-[#4F46E5] dark:text-indigo-400' : 'text-gray-700 dark:text-gray-300'}`}>
                            {translations?.options?.[opt.id] || opt.label}
                          </span>
                        </button>
                        {opt.id === 'other' && data.educationStatus === 'other' && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            className="px-2"
                          >
                            <input
                              type="text"
                              placeholder={translations?.specify || "Please specify..."}
                              value={otherText}
                              onChange={(e) => setOtherText(e.target.value)}
                              className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-[#4F46E5] outline-none text-[#111827] dark:text-white"
                            />
                          </motion.div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {step === 3 && (
                <div className="space-y-6">
                  <div className="space-y-2">
                    <h2 className="text-2xl md:text-3xl font-bold text-[#111827] dark:text-white">{translations?.q3Title || "Ap kitni English bol lete hai?"}</h2>
                    <p className="text-[#6B7280] dark:text-gray-400">{translations?.q3Sub || "Select your current proficiency level."}</p>
                  </div>
                  <div className="space-y-3">
                    {isTranslating && !translations && (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="animate-spin text-indigo-500" size={32} />
                      </div>
                    )}
                    {(!isTranslating || translations) && proficiencyOptions.map((opt) => (
                      <button
                        key={opt.id}
                        onClick={() => setData({ ...data, proficiencyLevel: opt.id })}
                        className={`w-full p-5 rounded-2xl border-2 text-left transition-all ${
                          data.proficiencyLevel === opt.id 
                            ? 'border-[#4F46E5] bg-indigo-50 dark:bg-indigo-900/20' 
                            : 'border-gray-100 dark:border-gray-800 hover:border-gray-200 dark:hover:border-gray-700'
                        }`}
                      >
                        <p className={`font-bold mb-1 ${data.proficiencyLevel === opt.id ? 'text-[#4F46E5] dark:text-indigo-400' : 'text-gray-800 dark:text-gray-200'}`}>
                          {translations?.options?.[opt.id] || opt.label}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{opt.description}</p>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="mt-10 flex items-center justify-between">
                <button
                  onClick={() => setStep(step - 1)}
                  disabled={step === 1 || isTranslating}
                  className="text-gray-400 dark:text-gray-500 font-bold hover:text-gray-600 dark:hover:text-gray-300 disabled:opacity-0"
                >
                  {translations?.back || "Back"}
                </button>
                <button
                  onClick={handleNext}
                  disabled={
                    isTranslating ||
                    (step === 2 && !data.educationStatus) || 
                    (step === 2 && data.educationStatus === 'other' && !otherText) ||
                    (step === 3 && !data.proficiencyLevel)
                  }
                  className="bg-[#111827] dark:bg-indigo-600 text-white px-8 py-4 rounded-2xl font-bold flex items-center gap-2 hover:bg-black dark:hover:bg-indigo-700 transition-all disabled:opacity-50 shadow-lg shadow-gray-200 dark:shadow-none min-w-[120px] justify-center"
                >
                  {isTranslating ? (
                    <Loader2 size={20} className="animate-spin" />
                  ) : (
                    <>
                      {step === 3 ? (translations?.finish || 'Finish') : (translations?.next || 'Next')}
                      <ChevronRight size={20} />
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          ) : (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white dark:bg-[#1F2937] rounded-3xl shadow-2xl border border-[#E5E7EB] dark:border-gray-700 p-12 text-center space-y-6"
            >
              <div className="w-20 h-20 bg-emerald-50 dark:bg-emerald-900/20 rounded-full flex items-center justify-center mx-auto text-emerald-500 dark:text-emerald-400">
                <CheckCircle2 size={48} />
              </div>
              <div className="space-y-2">
                <h2 className="text-3xl font-bold text-[#111827] dark:text-white">{translations?.finishTitle || "All Set!"}</h2>
                <p className="text-[#6B7280] dark:text-gray-400 text-lg">{translations?.finishMessage || "Pareshan n ho mai HumnAi apka dost english practice me apki madad karuga ."}</p>
              </div>
              <div className="flex items-center justify-center gap-2 text-[#4F46E5] dark:text-indigo-400 font-bold animate-pulse">
                <Volume2 size={24} />
                <span>AI Voice playing...</span>
              </div>
              <div className="pt-4">
                <div className="w-full bg-gray-100 dark:bg-gray-800 h-1.5 rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: '100%' }}
                    transition={{ duration: 4 }}
                    className="bg-[#4F46E5] dark:bg-indigo-500 h-full"
                  />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
