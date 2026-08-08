import React, { useState, useRef, useEffect } from 'react';
import { 
  Send, 
  Mic, 
  MicOff, 
  X,
  Maximize2,
  MessageCircle,
  AlertCircle,
  Languages,
  Loader2,
  Volume2,
  Trash2
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
  timestamp?: number;
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

const DEFAULT_WELCOME_MESSAGE: Message = { 
  id: '1', 
  role: 'ai', 
  text: "Hey! I'm HumnAi. Great to chat with you today! How's everything going with you?",
  timestamp: Date.now()
};

export default function Conversation({ isDarkMode, onThemeToggle, userEmail, userName, isPro, onTrialExpired }: ConversationProps) {
  const [messages, setMessages] = useState<Message[]>([DEFAULT_WELCOME_MESSAGE]);
  const [inputText, setInputText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState('');
  const [targetLanguage, setTargetLanguage] = useState(() => {
    return localStorage.getItem('humnai_user_language') || 'Hindi';
  });
  const [speechInputLang, setSpeechInputLang] = useState<'en-US' | 'native'>('en-US');

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
    'Bhojpuri': 'hi-IN',
    'Assamese': 'as-IN',
    'Malayalam': 'ml-IN'
  };

  const chatEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);
  const isSpeakingRef = useRef(false);

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // 1. LOAD CHAT HISTORY WITH 24-HOUR EXPIRATION FILTER
  useEffect(() => {
    const email = userEmail || localStorage.getItem('humnai_user_email');
    const storageKey = `humnai_chat_${email || 'guest'}`;
    const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;
    const now = Date.now();

    const loadHistory = async () => {
      let activeMessages: Message[] = [];

      const localData = localStorage.getItem(storageKey);
      if (localData) {
        try {
          const parsed = JSON.parse(localData);
          const savedMessages: Message[] = parsed.messages || [];
          
          activeMessages = savedMessages.filter(msg => {
            const msgTime = msg.timestamp || parsed.timestamp || now;
            return now - msgTime < TWENTY_FOUR_HOURS_MS;
          });

          if (activeMessages.length === 0 && savedMessages.length > 0) {
            localStorage.removeItem(storageKey);
          }
        } catch (e) {
          console.error("Error parsing local chat history:", e);
        }
      }

      if (email && activeMessages.length === 0) {
        try {
          const history = await dbService.getChatHistory(email);
          if (history && history.length > 0) {
            const dbMessages: Message[] = history.map((m: any) => ({
              id: m.id?.toString() || Date.now().toString(),
              role: m.role,
              text: m.text,
              correction: m.correction,
              translation: m.translation,
              explanation: m.explanation,
              timestamp: m.created_at ? new Date(m.created_at).getTime() : now
            }));

            activeMessages = dbMessages.filter(msg => now - (msg.timestamp || now) < TWENTY_FOUR_HOURS_MS);
          }
        } catch (err) {
          console.error("Failed to load chat history from database:", err);
        }
      }

      if (activeMessages.length > 0) {
        setMessages(activeMessages);
      } else {
        setMessages([DEFAULT_WELCOME_MESSAGE]);
      }
    };

    loadHistory();
  }, [userEmail]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Persist messages to LocalStorage
  const persistMessages = (updatedMessages: Message[]) => {
    setMessages(updatedMessages);

    const email = userEmail || localStorage.getItem('humnai_user_email');
    const storageKey = `humnai_chat_${email || 'guest'}`;

    localStorage.setItem(storageKey, JSON.stringify({
      messages: updatedMessages,
      timestamp: Date.now()
    }));
  };

  // Clear Chat History
  const clearChatHistory = () => {
    if (confirm("Are you sure you want to clear your conversation history?")) {
      const defaultMsg: Message[] = [DEFAULT_WELCOME_MESSAGE];
      persistMessages(defaultMsg);
    }
  };

  // Initialize Speech Recognition
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = speechInputLang === 'en-US' ? 'en-US' : (langMap[targetLanguage] || 'hi-IN');

      recognition.onstart = () => {
        setIsListening(true);
        setInterimTranscript('');
      };

      recognition.onresult = (event: any) => {
        let finalTranscript = '';
        let currentInterim = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          } else {
            currentInterim += event.results[i][0].transcript;
          }
        }

        if (currentInterim) {
          setInterimTranscript(currentInterim);
        }

        if (finalTranscript) {
          setInterimTranscript('');
          handleVoiceInput(finalTranscript);
        }
      };

      recognition.onerror = (event: any) => {
        if (event.error === 'no-speech' || event.error === 'aborted') {
          return; 
        }
        console.error('Speech recognition error', event.error);
        if (event.error === 'not-allowed') {
          alert('Microphone access denied. Please enable it in your browser settings.');
        }
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
    }

    const updateVoices = () => {
      window.speechSynthesis.getVoices();
    };
    updateVoices();
    window.speechSynthesis.addEventListener('voiceschanged', updateVoices);

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      window.speechSynthesis.removeEventListener('voiceschanged', updateVoices);
    };
  }, [speechInputLang, targetLanguage]);

  const speak = (text: string, lang: string = 'en-US', onComplete?: () => void) => {
    window.speechSynthesis.cancel();
    
    isSpeakingRef.current = true;

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang;
    utterance.rate = 0.95;
    
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

    utterance.onstart = () => {
      isSpeakingRef.current = true;
    };

    utterance.onend = () => {
      isSpeakingRef.current = false;
      if (onComplete) onComplete();
    };

    utterance.onerror = () => {
      isSpeakingRef.current = false;
      if (onComplete) onComplete();
    };

    window.speechSynthesis.speak(utterance);
  };

  const handleVoiceInput = async (transcript: string) => {
    if (!transcript.trim()) return;

    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {}
    }

    const formattedTranscript = transcript.trim().charAt(0).toUpperCase() + transcript.trim().slice(1);
    
    if (!isPro && messages.length >= 10) {
      if (onTrialExpired) onTrialExpired();
      return;
    }

    const userMsg: Message = { 
      id: Date.now().toString(), 
      role: 'user', 
      text: formattedTranscript,
      timestamp: Date.now()
    };
    
    const updatedMessages = [...messages, userMsg];
    persistMessages(updatedMessages);
    
    const email = userEmail || localStorage.getItem('humnai_user_email');
    if (email) {
      dbService.saveChatMessage(email, { role: 'user', text: formattedTranscript });
    }

    setIsProcessing(true);

    try {
      const historyContext = updatedMessages.slice(-10).map(m => `${m.role === 'user' ? 'User' : 'HumnAi'}: ${m.text}`);
      const correctionData = await humanAiService.correctSentence(transcript, historyContext, targetLanguage);
      const aiResponseText = correctionData.response || `Oh cool! Tell me more about that.`;
      
      const aiMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'ai',
        text: aiResponseText,
        correction: correctionData.corrected && correctionData.corrected.toLowerCase() !== transcript.toLowerCase() ? correctionData.corrected : undefined,
        translation: correctionData.translation,
        explanation: correctionData.explanation,
        timestamp: Date.now()
      };

      const finalMessages = [...updatedMessages, aiMsg];
      persistMessages(finalMessages);

      if (email) {
        dbService.saveChatMessage(email, { 
          role: 'ai', 
          text: aiMsg.text,
          correction: aiMsg.correction,
          translation: aiMsg.translation,
          explanation: aiMsg.explanation
        });
      }
      
      speak(aiResponseText, 'en-US', () => {
        if (correctionData.explanation) {
          speak(correctionData.explanation, langMap[targetLanguage] || 'hi-IN');
        }
      });
    } catch (error) {
      console.error("AI Voice processing failed", error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSendMessage = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!inputText.trim()) return;

    const formattedInput = inputText.trim().charAt(0).toUpperCase() + inputText.trim().slice(1);
    
    if (!isPro && messages.length >= 10) {
      if (onTrialExpired) onTrialExpired();
      return;
    }

    const userMsg: Message = { 
      id: Date.now().toString(), 
      role: 'user', 
      text: formattedInput,
      timestamp: Date.now()
    };
    
    const updatedMessages = [...messages, userMsg];
    persistMessages(updatedMessages);
    setInputText('');
    
    const email = userEmail || localStorage.getItem('humnai_user_email');
    if (email) {
      dbService.saveChatMessage(email, { role: 'user', text: formattedInput });
    }

    setIsProcessing(true);

    try {
      const historyContext = updatedMessages.slice(-10).map(m => `${m.role === 'user' ? 'User' : 'HumnAi'}: ${m.text}`);
      const correctionData = await humanAiService.correctSentence(formattedInput, historyContext, targetLanguage);
      
      const aiMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'ai',
        text: correctionData.response || `Oh nice! That sounds pretty cool.`,
        correction: correctionData.corrected && correctionData.corrected.toLowerCase() !== formattedInput.toLowerCase() ? correctionData.corrected : undefined,
        translation: correctionData.translation,
        explanation: correctionData.explanation,
        timestamp: Date.now()
      };

      const finalMessages = [...updatedMessages, aiMsg];
      persistMessages(finalMessages);

      if (email) {
        dbService.saveChatMessage(email, { 
          role: 'ai', 
          text: aiMsg.text,
          correction: aiMsg.correction,
          translation: aiMsg.translation,
          explanation: aiMsg.explanation
        });
      }
      
      speak(aiMsg.text, 'en-US', () => {
        if (correctionData.explanation) {
          speak(correctionData.explanation, langMap[targetLanguage] || 'hi-IN');
        }
      });
      
    } catch (error) {
      console.error("Error generating response:", error);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="h-full md:h-[calc(100vh-12rem)] flex flex-col gap-4 md:gap-6 overflow-hidden">
      {/* Chat Area */}
      <div className="flex flex-col bg-white dark:bg-[#1F2937] rounded-2xl md:rounded-3xl border border-[#E5E7EB] dark:border-gray-800 shadow-sm overflow-hidden transition-all duration-500 flex-1">
        {/* Chat Header */}
        <div className="p-4 border-b border-[#E5E7EB] dark:border-gray-800 flex items-center justify-between bg-white dark:bg-[#1F2937]">
          <div className="flex items-center gap-3">
            <div className="relative">
              <Logo collapsed={true} size="sm" />
              <div className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 rounded-full border-2 border-white dark:border-gray-800"></div>
            </div>
            <div>
              <h3 className="font-bold text-[#111827] dark:text-white">HumnAi Chat</h3>
              <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">Online • Real Human Conversational Partner</p>
            </div>
          </div>

          <button 
            onClick={clearChatHistory} 
            title="Clear Chat History"
            className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-xl transition-all cursor-pointer"
          >
            <Trash2 size={18} />
          </button>
        </div>

        {/* Messages List */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-[#F9FAFB] dark:bg-[#111827]">
          {messages.map((msg) => (
            <div key={msg.id} className={`flex items-end gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              {msg.role === 'ai' && (
                <div className="shrink-0 mb-1">
                  <Logo collapsed={true} size="sm" />
                </div>
              )}
              <div className="max-w-[80%] space-y-2">
                <div className={`p-4 rounded-2xl shadow-sm relative group ${
                  msg.role === 'user' 
                    ? 'bg-[#4F46E5] text-white rounded-tr-none' 
                    : 'bg-white dark:bg-gray-800 text-[#111827] dark:text-white rounded-tl-none border border-[#E5E7EB] dark:border-gray-700'
                }`}>
                  <p className="text-sm md:text-base leading-relaxed pr-6">{msg.text}</p>
                  {msg.role === 'ai' && (
                    <button 
                      onClick={() => {
                        speak(msg.text);
                        if (msg.explanation) {
                          setTimeout(() => speak(msg.explanation!, langMap[targetLanguage] || 'hi-IN'), 2000);
                        }
                      }}
                      className="absolute top-2 right-2 p-1 text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors cursor-pointer"
                    >
                      <Volume2 size={14} />
                    </button>
                  )}
                </div>
                
                {msg.correction && (
                  <motion.div 
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-900/30 p-3 rounded-xl flex flex-col gap-1"
                  >
                    <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
                      <AlertCircle size={14} />
                      <span className="text-xs font-bold uppercase tracking-wider">Natural Refinement</span>
                    </div>
                    <p className="text-sm font-semibold text-amber-900 dark:text-amber-100">"{msg.correction}"</p>
                    
                    {msg.explanation && (
                      <div className="bg-white/50 dark:bg-black/20 p-2.5 rounded-lg mt-1 border border-amber-200/50 dark:border-amber-800/30">
                        <span className="text-[10px] font-bold text-amber-800 dark:text-amber-300 block uppercase mb-0.5">Native Explanation ({targetLanguage}):</span>
                        <p className="text-xs text-amber-900 dark:text-amber-100 font-medium leading-relaxed">{msg.explanation}</p>
                      </div>
                    )}

                    {msg.translation && (
                      <div className="flex items-center gap-1 text-amber-600 dark:text-amber-500 text-xs mt-1">
                        <Languages size={12} />
                        <span>{msg.translation}</span>
                      </div>
                    )}
                  </motion.div>
                )}
              </div>
            </div>
          ))}

          {isProcessing && (
            <div className="flex justify-start">
              <div className="bg-white dark:bg-gray-800 border border-[#E5E7EB] dark:border-gray-700 p-3 rounded-2xl flex items-center gap-2 text-[#6B7280] dark:text-gray-400">
                <Loader2 size={16} className="animate-spin text-indigo-600" />
                <span className="text-sm">HumnAi is typing...</span>
              </div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        {/* Input Form */}
        <form onSubmit={handleSendMessage} className="p-4 bg-white dark:bg-[#1F2937] border-t border-[#E5E7EB] dark:border-gray-800 flex items-center gap-3">
          <div className="flex items-center gap-1">
            <div className="relative">
              <button 
                type="button" 
                onClick={() => {
                  if (isListening) {
                    recognitionRef.current?.stop();
                  } else {
                    try {
                      recognitionRef.current?.start();
                    } catch (e) {
                      console.error('Failed to start recognition from chat', e);
                    }
                  }
                }}
                className={`p-2 rounded-xl transition-all cursor-pointer ${isListening ? 'bg-indigo-100 dark:bg-indigo-900/40 text-[#4F46E5] dark:text-indigo-400' : 'text-[#6B7280] dark:text-gray-400 hover:bg-[#F3F4F6] dark:hover:bg-gray-800'}`}
              >
                <Mic size={20} />
              </button>
              {isListening && (
                <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-white dark:border-gray-800 animate-pulse"></span>
              )}
            </div>
            
            <button
              type="button"
              onClick={() => setSpeechInputLang(prev => prev === 'en-US' ? 'native' : 'en-US')}
              className={`text-[10px] font-bold px-2 py-1 rounded-lg border transition-all cursor-pointer ${
                speechInputLang === 'en-US' 
                  ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 border-indigo-100 dark:border-indigo-900/30' 
                  : 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 border-emerald-100 dark:border-emerald-900/30'
              }`}
            >
              {speechInputLang === 'en-US' ? 'EN' : 'NAT'}
            </button>
          </div>
          <input 
            type="text" 
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder={speechInputLang === 'en-US' ? "Type in English..." : `Type in ${targetLanguage}...`}
            className="flex-1 bg-[#F3F4F6] dark:bg-gray-800 border-none rounded-xl px-4 py-2.5 text-sm text-[#111827] dark:text-white placeholder-[#9CA3AF] focus:ring-2 focus:ring-[#4F46E5] transition-all"
          />
          <button 
            type="submit"
            disabled={!inputText.trim() || isProcessing}
            className="p-2.5 bg-[#4F46E5] hover:bg-indigo-600 disabled:opacity-50 text-white rounded-xl transition-colors shadow-lg shadow-indigo-100 dark:shadow-none shrink-0 cursor-pointer"
          >
            <Send size={20} />
          </button>
        </form>
      </div>
    </div>
  );
}
