import React, { useState, useRef, useEffect } from 'react';
import {
  Send, Mic, Languages, Loader2, Volume2, Trash2, AlertCircle, BookOpen, TrendingUp
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { humanAiService } from '@/src/services/geminiService';
import Logo from './Logo';
import { dbService } from '../services/dbService';

interface Message {
  id: string;
  role: 'user' | 'ai';
  text: string;
  correction?: string;
  translation?: string;
  explanation?: string;
  wordOfDay?: string;
  timestamp?: number;
  isError?: boolean;
}

declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

interface ConversationProps {
  isDarkMode?: boolean;
  onThemeToggle?: () => void;
  userEmail?: string | null;
  userName?: string | null;
  isPro?: boolean;
  onTrialExpired?: () => void;
}

const LEVEL_CONFIG = {
  Beginner: {
    badge: '🌱 Beginner',
    color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    tip: 'Koi bhi chhoti si baat English mein likhne ki koshish karo — galti karna bilkul theek hai! 😊',
    placeholder: 'Kuch bhi likho English mein... (e.g. "My name is...")',
  },
  Intermediate: {
    badge: '⚡ Intermediate',
    color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    tip: 'Try using full sentences with proper tense — I will correct you gently! 💬',
    placeholder: 'Type anything in English... try a full sentence!',
  },
  Advanced: {
    badge: '🚀 Advanced',
    color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
    tip: 'Push yourself — use idioms, complex sentences, or discuss any topic! 🎯',
    placeholder: 'Express yourself freely — no limits!',
  },
};

function getTimeGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  if (h < 21) return 'Good evening';
  return 'Good night';
}

function getUserLevel(): 'Beginner' | 'Intermediate' | 'Advanced' {
  if (typeof window === 'undefined') return 'Beginner';
  const level = localStorage.getItem('humnai_user_level') || 'Beginner';
  if (level === 'Intermediate' || level === 'Advanced') return level;
  return 'Beginner';
}

function buildWelcomeMessage(userName?: string | null, level?: string): Message {
  const greeting = getTimeGreeting();
  const name = userName?.trim();
  const lvl = level || getUserLevel();

  const beginnerWelcome = name
    ? `${greeting}, ${name}! 👋 Main hoon HumnAi — tumhara English dost! Aaj kya baat karein? Kuch bhi likho — Hindi mein sochkar English mein likhne ki koshish karo! 😊`
    : `${greeting}! 👋 Main hoon HumnAi — tumhara personal English tutor! Koi bhi chhoti baat English mein likhkar bhejo — main tumhare saath hoon! 🌟`;

  const intermediateWelcome = name
    ? `${greeting}, ${name}! 👋 Welcome back! Let's have a real English conversation today. What's on your mind?`
    : `${greeting}! 👋 I'm HumnAi. Let's practice English together — what would you like to talk about today?`;

  const advancedWelcome = name
    ? `${greeting}, ${name}! 🎯 Good to see you. Ready for some sharp English practice? What shall we discuss today?`
    : `${greeting}! 🎯 I'm HumnAi — your English sparring partner. Pick any topic and let's dive in!`;

  const text = lvl === 'Advanced' ? advancedWelcome : lvl === 'Intermediate' ? intermediateWelcome : beginnerWelcome;

  return { id: `welcome_${Date.now()}`, role: 'ai', text, timestamp: Date.now() };
}

export default function Conversation({ isDarkMode, onThemeToggle, userEmail, userName, isPro, onTrialExpired }: ConversationProps) {
  const userLevel = getUserLevel();
  const levelCfg = LEVEL_CONFIG[userLevel];

  const [messages, setMessages] = useState<Message[]>(() => [buildWelcomeMessage(userName, userLevel)]);
  const hasLoadedOnceRef = useRef(false);
  const lastLoadedEmailRef = useRef<string | null>(null);
  const [inputText, setInputText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState('');
  const [targetLanguage, setTargetLanguage] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('humnai_user_language') || 'Hindi';
    }
    return 'Hindi';
  });
  const [speechInputLang, setSpeechInputLang] = useState<'en-US' | 'native'>('en-US');
  const [messageCount, setMessageCount] = useState(0);
  const [showLevelTip, setShowLevelTip] = useState(true);

  const langMap: Record<string, string> = {
    Hindi: 'hi-IN', Marathi: 'mr-IN', Spanish: 'es-ES', French: 'fr-FR',
    German: 'de-DE', Japanese: 'ja-JP', Bengali: 'bn-IN', Tamil: 'ta-IN',
    Telugu: 'te-IN', Urdu: 'ur-PK', Punjabi: 'pa-IN', Gujarati: 'gu-IN',
    Kannada: 'kn-IN', Odia: 'or-IN', Bhojpuri: 'hi-IN', Assamese: 'as-IN', Malayalam: 'ml-IN'
  };

  const chatEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);
  const messagesRef = useRef<Message[]>([]);

  useEffect(() => { messagesRef.current = messages; }, [messages]);
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const generateId = () => (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

  const persistToStorage = (msgs: Message[]) => {
    if (typeof window === 'undefined') return;
    const email = userEmail || localStorage.getItem('humnai_user_email');
    localStorage.setItem(`humnai_chat_${email || 'guest'}`, JSON.stringify({ messages: msgs, timestamp: Date.now() }));
  };

  const appendMessage = (msg: Message) => {
    setMessages(prev => {
      const updated = [...prev, msg];
      persistToStorage(updated);
      return updated;
    });
  };

  // Load history
  useEffect(() => {
    const email = userEmail || (typeof window !== 'undefined' ? localStorage.getItem('humnai_user_email') : null);
    if (hasLoadedOnceRef.current && lastLoadedEmailRef.current === (email || null)) return;

    const load = async () => {
      let active: Message[] = [];
      const now = Date.now();
      const TTL = 24 * 60 * 60 * 1000;
      const storageKey = `humnai_chat_${email || 'guest'}`;

      const local = typeof window !== 'undefined' ? localStorage.getItem(storageKey) : null;
      if (local) {
        try {
          const parsed = JSON.parse(local);
          active = (parsed.messages || []).filter((m: Message) => now - (m.timestamp || parsed.timestamp || now) < TTL);
          if (active.length === 0) localStorage.removeItem(storageKey);
        } catch {}
      }

      if (email && active.length === 0) {
        try {
          const history = await dbService.getChatHistory(email);
          if (Array.isArray(history) && history.length > 0) {
            active = history.map((m: any) => ({
              id: m.id?.toString() || generateId(),
              role: m.role, text: m.text, correction: m.correction,
              translation: m.translation, explanation: m.explanation,
              timestamp: m.timestamp ? new Date(m.timestamp).getTime() : now
            })).filter((m: Message) => now - (m.timestamp || now) < TTL);
          }
        } catch {}
      }

      hasLoadedOnceRef.current = true;
      lastLoadedEmailRef.current = email || null;

      if (active.length > 0) {
        setMessages(active);
        setMessageCount(active.filter(m => m.role === 'user').length);
      } else {
        setMessages(prev => prev.length > 1 ? prev : [buildWelcomeMessage(userName, userLevel)]);
      }
    };

    load();
  }, [userEmail, userName]);

  // Speech recognition
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;

    const recognition = new SR();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = speechInputLang === 'en-US' ? 'en-US' : (langMap[targetLanguage] || 'hi-IN');

    recognition.onstart = () => { setIsListening(true); setInterimTranscript(''); };
    recognition.onresult = (e: any) => {
      let final = ''; let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) final += e.results[i][0].transcript;
        else interim += e.results[i][0].transcript;
      }
      if (interim) setInterimTranscript(interim);
      if (final) { setInterimTranscript(''); handleVoiceInput(final); }
    };
    recognition.onerror = (e: any) => {
      if (e.error === 'no-speech' || e.error === 'aborted') return;
      if (e.error === 'not-allowed') alert('Microphone access denied. Please allow it in browser settings.');
      setIsListening(false);
    };
    recognition.onend = () => setIsListening(false);
    recognitionRef.current = recognition;

    return () => { recognitionRef.current?.stop(); };
  }, [speechInputLang, targetLanguage]);

  const speak = (text: string, lang = 'en-US', onComplete?: () => void) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    speakRaw(text, lang, onComplete);
  };

  const speakRaw = (text: string, lang = 'en-US', onComplete?: () => void) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    const utt = new SpeechSynthesisUtterance(text);
    utt.lang = lang;
    utt.rate = userLevel === 'Beginner' ? 0.85 : 0.95; // Slower for beginners
    const voices = window.speechSynthesis.getVoices();
    let voice = lang.startsWith('en')
      ? voices.find(v => v.lang === 'en-IN') || voices.find(v => v.name.includes('Google US English'))
      : voices.find(v => v.lang === lang && v.name.includes('Google')) || voices.find(v => v.lang === lang);
    if (voice) utt.voice = voice;
    utt.onend = () => { if (onComplete) onComplete(); };
    utt.onerror = () => { if (onComplete) onComplete(); };
    window.speechSynthesis.speak(utt);
  };

  const speakSequence = (items: { text: string; lang: string }[]) => {
    const queue = items.filter(i => i.text?.trim());
    if (!queue.length) return;
    window.speechSynthesis?.cancel();
    const playNext = (i: number) => {
      if (i >= queue.length) return;
      setTimeout(() => speakRaw(queue[i].text, queue[i].lang, () => playNext(i + 1)), 250);
    };
    playNext(0);
  };

  const processUserMessage = async (rawText: string) => {
    const text = rawText.trim().charAt(0).toUpperCase() + rawText.trim().slice(1);
    if (!text) return;

    // Free user message limit
    if (!isPro && messagesRef.current.filter(m => m.role === 'user').length >= 10) {
      if (onTrialExpired) onTrialExpired();
      return;
    }

    const userMsg: Message = { id: generateId(), role: 'user', text, timestamp: Date.now() };
    appendMessage(userMsg);
    setMessageCount(prev => prev + 1);

    const email = userEmail || (typeof window !== 'undefined' ? localStorage.getItem('humnai_user_email') : null);
    if (email) {
      try { dbService.saveChatMessage(email, { role: 'user', text }); } catch {}
    }

    setIsProcessing(true);

    try {
      const historySource = [...messagesRef.current, userMsg].slice(-10);
      const historyContext = historySource.map(m => `${m.role === 'user' ? 'User' : 'HumnAi'}: ${m.text}`);

      const result = await humanAiService.correctSentence(text, historyContext, targetLanguage);

      const aiText = result.response || result.message || "That's really interesting!";
      const cleanOrig = text.trim().toLowerCase().replace(/[.,/#!$%^&*;:{}=\-_`~()]/g, '');
      const cleanCorr = (result.corrected || '').trim().toLowerCase().replace(/[.,/#!$%^&*;:{}=\-_`~()]/g, '');
      const hasMistake = cleanCorr.length > 0 && cleanCorr !== cleanOrig;

      const aiMsg: Message = {
        id: generateId(),
        role: 'ai',
        text: aiText,
        correction: hasMistake ? result.corrected : undefined,
        translation: result.translation,
        explanation: hasMistake ? result.explanation : undefined,
        wordOfDay: result.wordOfDay || undefined,
        timestamp: Date.now()
      };

      appendMessage(aiMsg);

      if (email) {
        try { dbService.saveChatMessage(email, { role: 'ai', text: aiMsg.text, correction: aiMsg.correction, translation: aiMsg.translation, explanation: aiMsg.explanation }); } catch {}
      }

      const nativeLang = langMap[targetLanguage] || 'hi-IN';
      speakSequence([
        { text: aiText, lang: 'en-US' },
        hasMistake ? { text: result.corrected, lang: 'en-US' } : { text: '', lang: 'en-US' },
        result.explanation ? { text: result.explanation, lang: nativeLang } : { text: '', lang: nativeLang }
      ]);

    } catch (err) {
      console.error('Chat error:', err);
      appendMessage({
        id: generateId(), role: 'ai', isError: true, timestamp: Date.now(),
        text: "Oops! Thodi connectivity problem hai abhi 🙏 Ek baar phir try karo!"
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleVoiceInput = async (transcript: string) => {
    if (!transcript.trim()) return;
    try { recognitionRef.current?.stop(); } catch {}
    await processUserMessage(transcript);
  };

  const handleSend = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!inputText.trim() || isProcessing) return;
    const txt = inputText;
    setInputText('');
    await processUserMessage(txt);
  };

  const clearChat = () => {
    if (confirm('Are you sure you want to clear your conversation history?')) {
      const fresh = [buildWelcomeMessage(userName, userLevel)];
      setMessages(fresh);
      setMessageCount(0);
      persistToStorage(fresh);
    }
  };

  return (
    <div className="h-full md:h-[calc(100vh-12rem)] flex flex-col gap-4 overflow-hidden">

      {/* Level Tip Banner */}
      <AnimatePresence>
        {showLevelTip && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className={`flex items-center justify-between gap-3 px-4 py-3 rounded-2xl text-sm font-medium ${levelCfg.color}`}
          >
            <div className="flex items-center gap-2">
              <TrendingUp size={16} />
              <span>{levelCfg.tip}</span>
            </div>
            <button onClick={() => setShowLevelTip(false)} className="text-xs opacity-60 hover:opacity-100 font-bold shrink-0">✕</button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Chat Box */}
      <div className="flex flex-col bg-white dark:bg-[#1F2937] rounded-2xl md:rounded-3xl border border-[#E5E7EB] dark:border-gray-800 shadow-sm overflow-hidden flex-1">

        {/* Header */}
        <div className="p-4 border-b border-[#E5E7EB] dark:border-gray-800 flex items-center justify-between bg-white dark:bg-[#1F2937]">
          <div className="flex items-center gap-3">
            <div className="relative">
              <Logo collapsed={true} size="sm" />
              <div className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 rounded-full border-2 border-white dark:border-gray-800" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-[#111827] dark:text-white">HumnAi Chat</h3>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${levelCfg.color}`}>
                  {levelCfg.badge}
                </span>
              </div>
              <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">Online • Your AI English Dost</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Message counter for free users */}
            {!isPro && (
              <span className="text-xs font-bold text-gray-400 dark:text-gray-500">
                {Math.min(messageCount, 10)}/10 messages
              </span>
            )}
            <button
              onClick={clearChat}
              title="Clear Chat"
              className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-xl transition-all"
            >
              <Trash2 size={18} />
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-5 bg-[#F9FAFB] dark:bg-[#111827]">
          {messages.map((msg) => (
            <div key={msg.id} className={`flex items-end gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              {msg.role === 'ai' && (
                <div className="shrink-0 mb-1"><Logo collapsed={true} size="sm" /></div>
              )}
              <div className="max-w-[82%] space-y-2">
                {/* Main bubble */}
                <div className={`p-4 rounded-2xl shadow-sm relative group ${
                  msg.role === 'user'
                    ? 'bg-[#4F46E5] text-white rounded-tr-none'
                    : msg.isError
                      ? 'bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300 rounded-tl-none border border-red-200 dark:border-red-900'
                      : 'bg-white dark:bg-gray-800 text-[#111827] dark:text-white rounded-tl-none border border-[#E5E7EB] dark:border-gray-700'
                }`}>
                  <p className="text-sm md:text-base leading-relaxed pr-6 whitespace-pre-line">{msg.text}</p>
                  {msg.role === 'ai' && !msg.isError && (
                    <button
                      onClick={() => speakSequence([
                        { text: msg.text, lang: 'en-US' },
                        msg.correction ? { text: msg.correction, lang: 'en-US' } : { text: '', lang: 'en-US' },
                        msg.explanation ? { text: msg.explanation, lang: langMap[targetLanguage] || 'hi-IN' } : { text: '', lang: 'hi-IN' }
                      ])}
                      className="absolute top-2 right-2 p-1 text-gray-300 hover:text-indigo-500 transition-colors"
                    >
                      <Volume2 size={14} />
                    </button>
                  )}
                </div>

                {/* Correction & Explanation card */}
                {(msg.correction || msg.explanation) && (
                  <motion.div
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800/40 p-3.5 rounded-2xl space-y-2"
                  >
                    {msg.correction && (
                      <div>
                        <div className="flex items-center gap-1.5 text-amber-700 dark:text-amber-400 mb-1">
                          <AlertCircle size={13} />
                          <span className="text-[10px] font-bold uppercase tracking-wide">Sahi Tarika (Natural English)</span>
                        </div>
                        <p className="text-sm font-bold text-amber-950 dark:text-amber-100">"{msg.correction}"</p>
                      </div>
                    )}
                    {msg.explanation && (
                      <div className="bg-white/60 dark:bg-black/30 p-3 rounded-xl border border-amber-200/50 dark:border-amber-800/40">
                        <span className="text-[10px] font-bold text-amber-800 dark:text-amber-300 block uppercase mb-1">
                          {targetLanguage} mein Explanation:
                        </span>
                        <p className="text-xs text-amber-900 dark:text-amber-100 font-medium leading-relaxed">{msg.explanation}</p>
                      </div>
                    )}
                    {msg.translation && (
                      <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400 text-xs pt-1 border-t border-amber-100 dark:border-amber-900/30">
                        <Languages size={12} />
                        <span>{msg.translation}</span>
                      </div>
                    )}
                  </motion.div>
                )}

                {/* Word of the Day — only for Beginners */}
                {msg.wordOfDay && userLevel === 'Beginner' && (
                  <motion.div
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800/40 p-3 rounded-2xl"
                  >
                    <div className="flex items-center gap-1.5 text-indigo-600 dark:text-indigo-400 mb-1">
                      <BookOpen size={13} />
                      <span className="text-[10px] font-bold uppercase tracking-wide">Word of the Day</span>
                    </div>
                    <p className="text-xs text-indigo-800 dark:text-indigo-200 font-medium leading-relaxed">{msg.wordOfDay}</p>
                  </motion.div>
                )}
              </div>
            </div>
          ))}

          {/* Typing indicator */}
          {isProcessing && (
            <div className="flex justify-start">
              <div className="bg-white dark:bg-gray-800 border border-[#E5E7EB] dark:border-gray-700 px-4 py-3 rounded-2xl flex items-center gap-2 text-gray-400">
                <Loader2 size={15} className="animate-spin text-indigo-500" />
                <span className="text-sm">
                  {userLevel === 'Beginner' ? 'HumnAi soch raha hai...' : 'HumnAi is typing...'}
                </span>
              </div>
            </div>
          )}

          {/* Interim voice transcript */}
          {isListening && interimTranscript && (
            <div className="flex justify-end">
              <div className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 px-4 py-2 rounded-2xl text-sm text-indigo-600 dark:text-indigo-300 italic">
                🎙 {interimTranscript}...
              </div>
            </div>
          )}

          <div ref={chatEndRef} />
        </div>

        {/* Input Area */}
        <form onSubmit={handleSend} className="p-4 bg-white dark:bg-[#1F2937] border-t border-[#E5E7EB] dark:border-gray-800 flex items-center gap-3">
          {/* Mic button */}
          <div className="flex items-center gap-1 shrink-0">
            <div className="relative">
              <button
                type="button"
                disabled={isProcessing}
                onClick={() => {
                  if (isListening) { try { recognitionRef.current?.stop(); } catch {} }
                  else { try { recognitionRef.current?.start(); } catch {} }
                }}
                className={`p-2 rounded-xl transition-all disabled:opacity-40 ${
                  isListening
                    ? 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600'
                    : 'text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                }`}
              >
                <Mic size={20} />
              </button>
              {isListening && (
                <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-white dark:border-gray-800 animate-pulse" />
              )}
            </div>

            {/* Language toggle for voice */}
            <button
              type="button"
              onClick={() => setSpeechInputLang(p => p === 'en-US' ? 'native' : 'en-US')}
              className={`text-[10px] font-bold px-2 py-1 rounded-lg border transition-all ${
                speechInputLang === 'en-US'
                  ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 border-indigo-200 dark:border-indigo-800'
                  : 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 border-emerald-200 dark:border-emerald-800'
              }`}
            >
              {speechInputLang === 'en-US' ? 'EN' : 'NAT'}
            </button>
          </div>

          {/* Text input */}
          <input
            type="text"
            value={inputText}
            onChange={e => setInputText(e.target.value)}
            placeholder={levelCfg.placeholder}
            className="flex-1 bg-[#F3F4F6] dark:bg-gray-800 border-none rounded-xl px-4 py-2.5 text-sm text-[#111827] dark:text-white placeholder-[#9CA3AF] focus:ring-2 focus:ring-[#4F46E5] outline-none transition-all"
          />

          {/* Send button */}
          <button
            type="submit"
            disabled={!inputText.trim() || isProcessing}
            className="p-2.5 bg-[#4F46E5] hover:bg-indigo-600 disabled:opacity-40 text-white rounded-xl transition-colors shadow-lg shadow-indigo-100 dark:shadow-none shrink-0"
          >
            <Send size={20} />
          </button>
        </form>
      </div>
    </div>
  );
}
