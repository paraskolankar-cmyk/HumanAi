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

function getApiKeyList(): string[] {
  const keys: (string | undefined)[] = [];

  try {
    if (typeof import.meta !== 'undefined' && import.meta.env) {
      keys.push(import.meta.env.VITE_PRIMARY_GEMINI_KEY);
      keys.push(import.meta.env.VITE_BACKUP_GEMINI_KEY);
      keys.push(import.meta.env.VITE_GEMINI_API_KEY);
      keys.push(import.meta.env.GEMINI_API_KEY);
    }
  } catch (e) {}

  try {
    if (typeof process !== 'undefined' && process.env) {
      keys.push(process.env.VITE_PRIMARY_GEMINI_KEY);
      keys.push(process.env.VITE_BACKUP_GEMINI_KEY);
      keys.push(process.env.VITE_GEMINI_API_KEY);
      keys.push(process.env.GEMINI_API_KEY);
    }
  } catch (e) {}

  return Array.from(new Set(keys.filter((key): key is string => Boolean(key) && typeof key === 'string' && key.trim().length > 0)));
}

let currentKeyIndex = 0;

function rotateKey(): void {
  const keys = getApiKeyList();
  if (keys.length > 1) {
    currentKeyIndex = (currentKeyIndex + 1) % keys.length;
    console.warn(`🔄 Switched to Backup API Key Index #${currentKeyIndex}`);
  }
}

export function safeJsonParse(text: string | undefined): any {
  if (!text) return {};
  try {
    let cleanText = text.replace(/```json/gi, '').replace(/```/g, '').trim();
    const jsonMatch = cleanText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      cleanText = jsonMatch[0];
    }
    return JSON.parse(cleanText);
  } catch (e) {
    console.error("Failed to parse Gemini JSON response:", text);
    return {};
  }
}

// ULTRA-STABLE DIRECT REST API CALLER (Fixes 404 & REST Endpoint Format)
async function callGeminiRestApi(prompt: string): Promise<string> {
  const keys = getApiKeyList();
  if (keys.length === 0) {
    console.error("❌ CRITICAL ERROR: No Gemini API Key exposed to Vite client!");
    throw new Error("Missing Gemini API Key in build bundle");
  }

  let lastError: any = null;

  for (let kIndex = 0; kIndex < keys.length; kIndex++) {
    const activeKey = keys[(currentKeyIndex + kIndex) % keys.length];
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${activeKey}`;

    const requestBody = {
      contents: [
        {
          role: "user",
          parts: [{ text: prompt }]
        }
      ],
      generationConfig: {
        temperature: 0.7,
        responseMimeType: "application/json"
      }
    };

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody)
      });

      if (response.ok) {
        const data = await response.json();
        const outputText = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
        if (outputText.trim()) {
          return outputText;
        }
      }

      const errText = await response.text();
      console.warn(`Gemini API Call failed (${response.status}):`, errText);
      lastError = new Error(`Status ${response.status}: ${errText}`);
    } catch (err) {
      lastError = err;
    }

    rotateKey();
  }

  throw lastError || new Error("Gemini API REST endpoints failed");
}

export const humanAiService = {
  async assessLevel(testAnswers: string | string[], profession: string = "General") {
    const formattedAnswers = Array.isArray(testAnswers) ? testAnswers.join(', ') : testAnswers;
    try {
      const prompt = `Evaluate the English level (Beginner, Intermediate, Advanced) based on: "${formattedAnswers}" for "${profession}". Return JSON: { "level": "Beginner/Intermediate/Advanced", "explanation": "Short reason" }`;
      const rawText = await callGeminiRestApi(prompt);
      const parsed = safeJsonParse(rawText);
      return parsed.level ? parsed : { level: "Intermediate", explanation: "Evaluated level." };
    } catch (e) {
      return { level: "Beginner", explanation: "Default starting level." };
    }
  },

  async generateLearningPlan(level: string, profession: string = "General Professional") {
    try {
      const prompt = `Create a 12-month English roadmap for ${level} level student in ${profession}. Return JSON: { "roadmap": [ { "month": 1, "theme": "", "objectives": [] } ] }`;
      const rawText = await callGeminiRestApi(prompt);
      const parsed = safeJsonParse(rawText);
      if (parsed && Array.isArray(parsed.roadmap) && parsed.roadmap.length > 0) {
        return parsed;
      }
      throw new Error("Invalid roadmap structure");
    } catch (error) {
      const defaultThemes = [
        { theme: `Foundations for ${profession}`, objectives: ["Core sentence structure", "Essential workplace vocabulary"] },
        { theme: "Present & Past Tenses", objectives: ["Simple Present Tense", "Simple Past Tense"] }
      ];
      return {
        roadmap: defaultThemes.map((item, index) => ({
          month: index + 1,
          theme: `${level} - ${item.theme}`,
          objectives: item.objectives
        }))
      };
    }
  },

  async generateDailyTasks(level: string, month: number, day: number, targetLanguage?: string) {
    const userLanguage = targetLanguage || getSelectedLanguageName();
    try {
      const prompt = `Generate daily English practice tasks in ${userLanguage} for ${level} level on Month ${month}, Day ${day}. Return JSON: { "sentences": [], "translations": [], "arrangements": [], "mcqs": [] }`;
      const rawText = await callGeminiRestApi(prompt);
      const parsed = safeJsonParse(rawText);
      if (parsed && (parsed.sentences?.length || parsed.mcqs?.length)) return parsed;
      throw new Error("Tasks error");
    } catch (error) {
      return {
        sentences: [{ english: "I practice English daily.", translation: "मैं रोज अंग्रेजी अभ्यास करता हूँ।" }],
        translations: [{ translation: "आपका दिन कैसा था?", english: "How was your day?" }],
        arrangements: [{ jumbled: ["learning", "am", "English", "I"], correct: "I am learning English", translation: "मैं अंग्रेजी सीख रहा हूँ।" }],
        mcqs: [{ question: "She ___ to work daily.", options: ["go", "goes", "going"], answer: "goes", explanation: "Singular takes 'goes'.", translation: "वह रोज काम पर जाती है।" }]
      };
    }
  },

  async getDailyLearningContent(category: string, level: string, dayNumber: number = 1, targetLanguage?: string) {
    const userLanguage = targetLanguage || getSelectedLanguageName();
    const cacheKey = `humnai_cache_module_${category}_day${dayNumber}_${userLanguage.toLowerCase()}`;

    if (typeof window !== 'undefined') {
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          if (parsed && (parsed.vocabulary || parsed.explanation || parsed.topic)) return parsed;
        } catch (e) {}
      }
    }

    try {
      const prompt = `You are an AI English Tutor. Generate DAY ${dayNumber} learning content for category: "${category}" at "${level}" level in ${userLanguage}. Return JSON format.`;
      const rawText = await callGeminiRestApi(prompt);
      const parsed = safeJsonParse(rawText);
      if (typeof window !== 'undefined' && parsed && (parsed.topic || parsed.vocabulary || parsed.explanation)) {
        try { localStorage.setItem(cacheKey, JSON.stringify(parsed)); } catch (e) {}
      }
      return parsed;
    } catch (err) {
      return {};
    }
  },

  async correctSentence(sentence: string, historyContextOrLang?: string[] | string, targetLanguage?: string) {
    let historyContext: string[] = [];
    let userLanguage = getSelectedLanguageName();

    if (Array.isArray(historyContextOrLang)) {
      historyContext = historyContextOrLang;
      if (targetLanguage) userLanguage = targetLanguage;
    } else if (typeof historyContextOrLang === 'string') {
      userLanguage = historyContextOrLang;
    }

    const cleanInput = (sentence || "").trim();

    try {
      const historyPrompt = historyContext.length > 0 
        ? `PREVIOUS CONVERSATION HISTORY:\n${historyContext.slice(-6).join('\n')}\n` 
        : '';

      const seed = Date.now() + "_" + Math.random().toString(36).substring(2, 7);

      const prompt = `You are HumnAi, a warm, witty human friend and English tutor chatting on WhatsApp.
      Session Seed: ${seed}

      ${historyPrompt}
      USER'S INPUT MESSAGE: "${cleanInput}"

      STRICT TUTORING & CONVERSATION INSTRUCTIONS:
      1. GRAMMAR & NATURAL PHRASING CORRECTION:
         - Evaluate "${cleanInput}" for grammar mistakes, missing prepositions/articles, tense issues, or unnatural phrasing.
         - "corrected": Provide a polished, natural English version. (Example: For "I go to market", correct it to "I am going to the market.")
         - "explanation": Write a clear, friendly explanation in ${userLanguage} describing what mistake was made and how to fix it.
         - If the input is ALREADY 100% perfect, polished English: set "corrected" to original input and "explanation" to "".
      2. FRIENDLY HUMAN RESPONSE:
         - "response": Write a warm, casual, human reply in English naturally continuing the conversation like a real WhatsApp friend.

      Return JSON strictly in this exact format:
      {
        "corrected": "Corrected English sentence",
        "response": "Friendly human conversational response in English",
        "translation": "${userLanguage} translation of user sentence",
        "explanation": "Mistake explanation written in ${userLanguage} (or empty string if 100% correct)"
      }`;

      const rawText = await callGeminiRestApi(prompt);
      const parsed = safeJsonParse(rawText);

      if (parsed && (parsed.response || parsed.corrected)) {
        return {
          corrected: parsed.corrected || cleanInput,
          response: parsed.response || rawText.trim(),
          translation: parsed.translation || cleanInput,
          explanation: parsed.explanation || ""
        };
      }

      throw new Error("Empty or invalid JSON output from Gemini REST API");
    } catch (error: any) {
      console.error("Gemini Direct REST Chat Error:", error);
      
      const isGreeting = /^(hello|hi|hey|hola|namaste|good morning|good evening)[\s!.]*$/i.test(cleanInput);

      if (isGreeting) {
        return {
          corrected: cleanInput,
          response: "Hey there! Great to connect with you. How's your day going so far?",
          translation: cleanInput,
          explanation: ""
        };
      }

      return {
        corrected: cleanInput,
        response: `Hey! Thanks for chatting. I'm right here—what else is on your mind today?`,
        translation: cleanInput,
        explanation: ""
      };
    }
  }
};
