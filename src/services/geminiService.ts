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

// 2. Safely extract all available Gemini API Keys (Vite Client & Process Fallback)
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

// DIRECT REST API EXECUTOR (Prevents SDK 404/Bundler Errors on Vercel)
async function callGeminiRestApi(prompt: string, forceJson = true): Promise<string> {
  const keys = getApiKeyList();
  if (keys.length === 0) {
    console.error("❌ CRITICAL: No Gemini API Keys found in Environment Variables!");
    throw new Error("Missing Gemini API Key");
  }

  let lastError: any = null;

  for (let attempt = 0; attempt < keys.length * 2; attempt++) {
    const activeKey = keys[currentKeyIndex] || keys[0];
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${activeKey}`;

    const requestBody: any = {
      contents: [{
        parts: [{ text: prompt }]
      }]
    };

    if (forceJson) {
      requestBody.generationConfig = {
        responseMimeType: "application/json"
      };
    }

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
      console.warn(`Gemini API Call attempt failed (${response.status}):`, errText);

      if (response.status === 429 || response.status === 403 || errText.includes("Quota") || errText.includes("API key")) {
        rotateKey();
        await new Promise(res => setTimeout(res, 1000));
        continue;
      }
    } catch (err) {
      lastError = err;
      rotateKey();
      await new Promise(res => setTimeout(res, 1000));
    }
  }

  throw lastError || new Error("Gemini API calls failed on all available keys");
}

export const humanAiService = {
  // 5 QUESTIONS & PROFESSION BASED LEVEL ASSESSMENT
  async assessLevel(testAnswers: string | string[], profession: string = "General") {
    const formattedAnswers = Array.isArray(testAnswers) ? testAnswers.join(', ') : testAnswers;
    try {
      const prompt = `Evaluate the English level (Beginner, Intermediate, Advanced) based on these 5 assessment answers: "${formattedAnswers}" for a person whose profession/goal is "${profession}". Return JSON strictly: { "level": "Beginner/Intermediate/Advanced", "explanation": "Short reason" }`;
      const rawText = await callGeminiRestApi(prompt, true);
      const parsed = safeJsonParse(rawText);
      return parsed.level ? parsed : { level: "Intermediate", explanation: "Evaluated from assessment test." };
    } catch (e) {
      return { level: "Beginner", explanation: "Default starting level." };
    }
  },

  // PROFESSION & LEVEL TAILORED 12-MONTH ROADMAP GENERATOR
  async generateLearningPlan(level: string, profession: string = "General Professional") {
    try {
      const prompt = `Create a 12-month high-level English learning roadmap tailored for a ${level} level student whose profession/goal is "${profession}". 
      Make the monthly themes and key objectives directly relevant to their profession.
      Return JSON format strictly: { "roadmap": [ { "month": 1, "theme": "", "objectives": [] }, ... up to month 12 ] }`;
      
      const rawText = await callGeminiRestApi(prompt, true);
      const parsed = safeJsonParse(rawText);
      if (parsed && Array.isArray(parsed.roadmap) && parsed.roadmap.length > 0) {
        return parsed;
      }
      throw new Error("Invalid roadmap structure");
    } catch (error) {
      console.error("Roadmap generation failed, serving fallback plan", error);
      const defaultThemes = [
        { theme: `Foundations & Professional Intro for ${profession}`, objectives: ["Core sentence structure", "Essential workplace vocabulary", "Professional introduction"] },
        { theme: "Present & Past Tenses in Work", objectives: ["Simple Present Tense in daily work", "Simple Past Tense for tasks", "Action verbs"] },
        { theme: "Future Tense & Polite Modals", objectives: ["Future projections & goal setting", "Modals (Could, Would, Should)", "Scheduling meetings"] }
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

  // DAILY TASKS GENERATOR
  async generateDailyTasks(level: string, month: number, day: number, targetLanguage?: string) {
    const userLanguage = targetLanguage || getSelectedLanguageName();

    try {
      const prompt = `Generate daily English practice tasks for a ${level} level student on Month ${month}, Day ${day}.
        Provide questions across these 4 categories (5 to 8 questions per category):
        1. Speaking practice sentences (with ${userLanguage} translation).
        2. Translation tasks (${userLanguage} to English).
        3. Jumbled sentence arrangements.
        4. Grammar MCQs with explanations in ${userLanguage}.
        
        Return JSON format strictly:
        { 
          "sentences": [ { "english": "I start my work early.", "translation": "मैं अपना काम जल्दी शुरू करता हूँ।" } ], 
          "translations": [ { "translation": "आज का दिन अच्छा है।", "english": "Today is a good day." } ],
          "arrangements": [ { "jumbled": ["learning", "am", "English", "I"], "correct": "I am learning English", "translation": "मैं अंग्रेजी सीख रहा हूँ।" } ],
          "mcqs": [ { "question": "She ___ to office every day.", "options": ["go", "goes", "going", "gone"], "answer": "goes", "explanation": "Singular subject uses 'goes'.", "translation": "वह रोज दफ्तर जाती है।" } ]
        }`;

      const rawText = await callGeminiRestApi(prompt, true);
      const parsed = safeJsonParse(rawText);
      const total = (parsed.sentences?.length || 0) + (parsed.translations?.length || 0) + (parsed.arrangements?.length || 0) + (parsed.mcqs?.length || 0);
      
      if (parsed && total >= 5) {
        return parsed;
      }
      throw new Error("Tasks count below minimum");
    } catch (error) {
      return {
        sentences: [{ english: "I practice English every single day.", translation: "मैं हर दिन अंग्रेजी का अभ्यास करता हूँ।" }],
        translations: [{ translation: "आपका दिन शुभ हो।", english: "Have a nice day." }],
        arrangements: [{ jumbled: ["English", "learning", "am", "I"], correct: "I am learning English", translation: "मैं अंग्रेजी सीख रहा हूँ।" }],
        mcqs: [{ question: "He ___ to market yesterday.", options: ["go", "went", "gone", "going"], answer: "went", explanation: "Past tense of 'go' is 'went'.", translation: "वह कल बाजार गया था।" }]
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
      const rawText = await callGeminiRestApi(prompt, true);
      const parsed = safeJsonParse(rawText);
      if (typeof window !== 'undefined' && parsed && (parsed.topic || parsed.vocabulary || parsed.explanation)) {
        try { localStorage.setItem(cacheKey, JSON.stringify(parsed)); } catch (e) {}
      }
      return parsed;
    } catch (err) {
      return {};
    }
  },

  // REAL HUMAN-LIKE CONVERSATIONAL CHAT WITH NATIVE MISTAKE EXPLANATION
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

      const prompt = `You are HumnAi, a warm, witty, genuine human friend and English language tutor chatting with a friend on WhatsApp.
      Session Seed: ${seed}

      ${historyPrompt}
      USER'S INPUT SENTENCE: "${cleanInput}"

      STRICT HUMANOID & TUTORING INSTRUCTIONS:
      1. CRITICAL GRAMMAR & PHRASING EVALUATION:
         - Carefully check "${cleanInput}" for grammar mistakes, unnatural phrasing, missing words, or if the user spoke in ${userLanguage}.
         - "corrected": Always provide the most natural, polished, native-sounding English sentence. (e.g., if user says "I want to talk with you can you please talk with me", correct it to "I want to talk with you. Could you please chat with me for a couple of minutes?")
         - "explanation": Explain clearly and warmly in ${userLanguage} what mistake was made and why the corrected version sounds more natural.
         - If user sentence is ALREADY 100% perfect, set "corrected" to original text and "explanation" to "".
      2. FRIENDLY CONVERSATIONAL RESPONSE:
         - "response": Write a warm, casual, human reply in English naturally continuing the conversation like a real WhatsApp friend.
         - NEVER use robotic lines like "What would you like to know about this?" or "Tell me more about X".

      Return JSON strictly in this exact format:
      {
        "corrected": "Refined and corrected English sentence",
        "response": "Your friendly, casual human conversational reply in English",
        "translation": "${userLanguage} translation of user sentence",
        "explanation": "Grammar/spelling mistake explanation written in ${userLanguage} (or empty string if 100% correct)"
      }`;

      const rawText = await callGeminiRestApi(prompt, true);
      const parsed = safeJsonParse(rawText);

      if (parsed && (parsed.response || parsed.corrected)) {
        return {
          corrected: parsed.corrected || cleanInput,
          response: parsed.response || rawText.trim(),
          translation: parsed.translation || cleanInput,
          explanation: parsed.explanation || ""
        };
      }

      throw new Error("Empty or invalid JSON output");
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
