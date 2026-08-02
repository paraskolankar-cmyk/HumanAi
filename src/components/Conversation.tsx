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
  Volume2
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

// Add type for SpeechRecognition
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
  text: "Hello! I'm your AI tutor. How can I help you today?",
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
  
  // Voice recognition refs
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

      // A. LocalStorage Check (with Timestamp expiration)
      const localData = localStorage.getItem(storageKey);
      if (localData) {
        try {
          const parsed = JSON.parse(localData);
          const savedMessages: Message[] = parsed.messages || [];
          
          // Filter out messages older than 24 hours
          activeMessages = savedMessages.filter(msg => {
            const msgTime = msg.timestamp || parsed.timestamp || now;
            return now - msgTime < TWENTY_FOUR_HOURS_MS;
          });

          // If all messages expired, clear local storage
          if (activeMessages.length === 0 && savedMessages.length > 0) {
            localStorage.removeItem(storageKey);
          }
        } catch (e) {
          console.error("Error parsing local chat history:", e);
        }
      }

      // B. Database Fetch Fallback / Sync
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

            // Filter out database messages older than 24 hours
            activeMessages = dbMessages.filter(msg => now - (msg.timestamp || now) < TWENTY_FOUR_HOURS_MS);
          }
        } catch (err) {
          console.error("Failed to load chat history from database:", err);
        }
      }

      // Set valid active messages or fallback to default welcome message
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

  // Helper to persist messages with timestamp
  const persistMessages = (updatedMessages: Message[]) => {
    setMessages(updatedMessages);

    const email = userEmail || localStorage.getItem('humnai_user_email');
    const storageKey = `humnai_chat_${email || 'guest'}`;

    localStorage.setItem(storageKey, JSON.stringify({
      messages: updatedMessages,
      timestamp: Date.now()
    }));
  };

  // Initialize Speech Recognition once
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
    } else {
      console.warn("Speech recognition not supported in this browser.");
    }

    // Load voices
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
    window.speechSynthesis.cancel(); // Stop any current speech
    
    isSpeakingRef.current = true;

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang;
    utterance.rate = 0.9;
    utterance.pitch = 1.0;
    
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
      const correctionData = await humanAiService.correctSentence(transcript, targetLanguage);
      const aiResponseText = correctionData.response || "I understand. Tell me more!";
      
      const aiMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'ai',
        text: aiResponseText,
        correction: correctionData.corrected && correctionData.corrected !== transcript ? correctionData.corrected : undefined,
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
        if (correctionData.corrected && correctionData.corrected.toLowerCase() !== transcript.toLowerCase()) {
          speak(`You can say it like this: ${correctionData.corrected}`, 'en-US', () => {
            if (correctionData.explanation) {
              speak(correctionData.explanation, langMap[targetLanguage] || 'hi-IN');
            }
          });
        } else if (correctionData.explanation) {
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
      const correctionData = await humanAiService.correctSentence(formattedInput, targetLanguage);
      
      const aiMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'ai',
        text: correctionData.response || "I understand. Can you explain that in more detail?",
        correction: correctionData.corrected && correctionData.corrected !== formattedInput ? correctionData.corrected : undefined,
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
        if (correctionData.corrected && correctionData.corrected.toLowerCase() !== formattedInput.toLowerCase()) {
          speak(`You can say it like this: ${correctionData.corrected}`, 'en-US', () => {
            if (aiMsg.explanation) {
              speak(aiMsg.explanation, langMap[targetLanguage] || 'hi-IN');
            }
          });
        } else if (aiMsg.explanation) {
          speak(aiMsg.explanation, langMap[targetLanguage] || 'hi-IN');
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
              <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">Online • Chats auto-erase after 24 hrs</p>
            </div>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-[#F9FAFB] dark:bg-[#111827]">
          {messages.map((msg) => (
            <div key={msg.id} className={`flex items-end gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              {msg.role === 'ai' && (
                <div className="shrink-0 mb-1">
                  <Logo collapsed={true} size="sm" />
                </div>
              )}
              <div className={`max-w-[80%] space-y-2`}>
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
                      className="absolute top-2 right-2 p-1 text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
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
                      <span className="text-xs font-bold uppercase tracking-wider">Correction</span>
                    </div>
                    <p className="text-sm font-semibold text-amber-900 dark:text-amber-100">Use "{msg.correction}" instead</p>
                    
                    {msg.explanation && (
                      <div className="bg-white/50 dark:bg-black/20 p-2 rounded-lg mt-1">
                        <p className="text-xs text-amber-800 dark:text-amber-200 italic">{msg.explanation}</p>
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
                <Loader2 size={16} className="animate-spin" />
                <span className="text-sm">Thinking...</span>
              </div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        {/* Input */}
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
                className={`p-2 rounded-xl transition-all ${isListening ? 'bg-indigo-100 dark:bg-indigo-900/40 text-[#4F46E5] dark:text-indigo-400' : 'text-[#6B7280] dark:text-gray-400 hover:bg-[#F3F4F6] dark:hover:bg-gray-800'}`}
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
              className={`text-[10px] font-bold px-2 py-1 rounded-lg border transition-all ${
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
            className="p-2.5 bg-[#4F46E5] text-white rounded-xl hover:bg-indigo-600 transition-colors shadow-lg shadow-indigo-100 dark:shadow-none shrink-0"
          >
            <Send size={20} />
          </button>
        </form>
      </div>
    </div>
  );
}
