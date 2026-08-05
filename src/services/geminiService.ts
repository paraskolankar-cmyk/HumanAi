import { GoogleGenAI } from "@google/genai";

// 1. LocalStorage se User ki Native Language read karne ka function
export function getSelectedLanguageName(): string {
  if (typeof window === 'undefined') return 'Hindi';
  
  const savedLang = localStorage.getItem('humnai_user_language') || localStorage.getItem('humnai_native_language') || 'hi';
  
  const languageMap: Record<string, string> = {
    hi: 'Hindi', bn: 'Bengali', mr: 'Marathi', te: 'Telugu', ta: 'Tamil',
    gu: 'Gujarati', kn: 'Kannada', ml: 'Malayalam', pa: 'Punjabi', en: 'English',
    ur: 'Urdu', as: 'Assamese', bho: 'Bhojpuri', or: 'Odia', es: 'Spanish',
    fr: 'French', de: 'German', ja: 'Japanese'
  };

  return languageMap[savedLang.toLowerCase()] || savedLang || 'Hindi';
}

// 2. Primary aur Backup API Keys ka array
const GEMINI_KEYS = [
  process.env.GEMINI_API_KEY,
  process.env.VITE_PRIMARY_GEMINI_KEY,
  process.env.VITE_BACKUP_GEMINI_KEY
].filter((key): key is string => Boolean(key) && key.trim().length > 0);

let currentKeyIndex = 0;

// Current Active SDK Instance Helper
function getAiInstance(): GoogleGenAI {
  const apiKey = GEMINI_KEYS[currentKeyIndex] || process.env.GEMINI_API_KEY || process.env.VITE_PRIMARY_GEMINI_KEY || "";
  return new GoogleGenAI({ apiKey });
}

// Key Limit Exceed Hone Par Backup Key Switch Logic
function rotateToBackupKey(): void {
  if (GEMINI_KEYS.length <= 1) return;
  const prevIndex = currentKeyIndex;
  currentKeyIndex = (currentKeyIndex + 1) % GEMINI_KEYS.length;
  console.warn(
    `⚠️ Primary API Limit Exceeded (Key #${prevIndex + 1}). Switched to Backup Key #${currentKeyIndex + 1}`
  );
}

// Automatic Retry & Backup Switch Wrapper
async function withRetry<T>(fn: (ai: GoogleGenAI) => Promise<T>, maxRetries = GEMINI_KEYS.length || 3): Promise<T> {
  let lastError: any;
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      const activeAi = getAiInstance();
      return await fn(activeAi);
    } catch (error: any) {
      lastError = error;
      const errorMessage = error?.message || String(error);
      
      if (errorMessage.includes("429") || errorMessage.includes("Rate exceeded") || errorMessage.includes("Quota")) {
        rotateToBackupKey();
        const delay = Math.pow(2, i) * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      throw error;
    }
  }
  throw lastError;
}

export function safeJsonParse(text: string | undefined): any {
  if (!text) return {};
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    const cleanText = jsonMatch ? jsonMatch[0] : text;
    return JSON.parse(cleanText);
  } catch (e) {
    console.error("Failed to parse Gemini response as JSON:", text);
    return {};
  }
}

export const humanAiService = {
  async assessLevel(testAnswers: string) {
    return withRetry(async (ai) => {
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: `Assess the English level (Beginner, Intermediate, Advanced) based on these answers: ${testAnswers}. Return JSON with level and a brief explanation.`,
        config: { responseMimeType: "application/json" }
      });
      return safeJsonParse(response.text);
    });
  },

  async generateLearningPlan(level: string) {
    return withRetry(async (ai) => {
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: `Create a 12-month high-level English learning roadmap for a ${level} level student. Return JSON format: { roadmap: [ { month: 1, theme: "", objectives: [] }, ... ] }`,
        config: { responseMimeType: "application/json" }
      });
      return safeJsonParse(response.text);
    });
  },

  async generateDailyTasks(level: string, month: number, day: number, targetLanguage?: string) {
    const userLanguage = targetLanguage || getSelectedLanguageName();
    return withRetry(async (ai) => {
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: `Generate daily English practice tasks for a ${level} level student on Month ${month}, Day ${day} in ${userLanguage}.
        Return JSON format: { 
          "sentences": [ { "english": "", "translation": "" } ], 
          "translations": [ { "translation": "", "english": "" } ],
          "mcqs": [ { "question": "", "options": [], "answer": "", "explanation": "", "translation": "" } ],
          "arrangements": [ { "jumbled": [], "correct": "", "translation": "" } ]
        }`,
        config: { responseMimeType: "application/json" }
      });
      return safeJsonParse(response.text);
    });
  },

  async getDailyLearningContent(category: string, level: string, dayNumber: number = 1, targetLanguage?: string) {
    const userLanguage = targetLanguage || getSelectedLanguageName();
    const cacheKey = `humnai_cache_module_${category}_day${dayNumber}_${userLanguage.toLowerCase()}`;

    if (typeof window !== 'undefined') {
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          if (parsed && (parsed.vocabulary || parsed.explanation || parsed.topic)) {
            return parsed;
          }
        } catch (e) {}
      }
    }

    return withRetry(async (ai) => {
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: `You are an AI English Tutor. Generate DAY ${dayNumber} learning content for category: "${category}" at "${level}" level. Return JSON format.`,
        config: { responseMimeType: "application/json" }
      });

      const parsed = safeJsonParse(response.text);

      if (typeof window !== 'undefined' && parsed && (parsed.topic || parsed.vocabulary || parsed.explanation)) {
        try {
          localStorage.setItem(cacheKey, JSON.stringify(parsed));
        } catch (e) {}
      }

      return parsed;
    });
  },

  // FIX FOR AI CHAT NOT RESPONDING
  async correctSentence(sentence: string, targetLanguage?: string) {
    const userLanguage = targetLanguage || getSelectedLanguageName();

    try {
      return await withRetry(async (ai) => {
        const response = await ai.models.generateContent({
          model: "gemini-2.5-flash",
          contents: `You are an AI English Tutor for a student learning English.
          The user said: "${sentence}".
          
          Tasks:
          1. If input is in ${userLanguage} or non-English, translate it to conversational English.
          2. If input is in English with grammatical errors, correct it.
          3. Provide a friendly conversational reply in English.
          4. Provide meaning of user's intent in ${userLanguage}.
          5. Provide explanation in ${userLanguage} about grammar or structure used.
          
          Return JSON format strictly:
          {
            "corrected": "Corrected/Natural English sentence",
            "response": "Your friendly English response",
            "translation": "User intent translated in ${userLanguage}",
            "explanation": "Clear explanation in ${userLanguage}"
          }`,
          config: { responseMimeType: "application/json" }
        });

        const parsed = safeJsonParse(response.text);

        // Fallback Response if JSON Parsing produces empty response
        if (!parsed || (!parsed.response && !parsed.corrected)) {
          return {
            corrected: sentence,
            response: response.text || "That sounds interesting! Tell me more.",
            translation: sentence,
            explanation: `Keep practicing in ${userLanguage}!`
          };
        }

        return parsed;
      });
    } catch (error) {
      console.error("Gemini Chat API Error:", error);
      
      // Automatic Fallback Response on API Failure (Rate Limit / Network Error)
      return {
        corrected: sentence,
        response: "I understood you! Let's continue practicing English together.",
        translation: sentence,
        explanation: `API Limit reached. Please try again in a few moments.`
      };
    }
  }
};
