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
    if (jsonMatch) cleanText = jsonMatch[0];
    return JSON.parse(cleanText);
  } catch (e) {
    console.error("Failed to parse Gemini JSON response:", text);
    return {};
  }
}

// REST API CALL WITH CORRECT GOOGLE ENDPOINT FORMAT
async function callGeminiRestApi(prompt: string): Promise<string> {
  const keys = getApiKeyList();
  if (keys.length === 0) {
    console.error("❌ CRITICAL: No Gemini API Keys found in Environment Variables!");
    throw new Error("Missing Gemini API Key");
  }

  let lastError: any = null;

  for (let attempt = 0; attempt < keys.length * 2; attempt++) {
    const activeKey = keys[currentKeyIndex] || keys[0];
    // Models prefix endpoint fixed to prevent 404
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${activeKey}`;

    const requestBody = {
      contents: [{
        parts: [{ text: prompt }]
      }],
      generationConfig: {
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
      console.warn(`Gemini API Call attempt failed (${response.status}):`, errText);

      rotateKey();
      await new Promise(res => setTimeout(res, 1000));
    } catch (err) {
      lastError = err;
      rotateKey();
      await new Promise(res => setTimeout(res, 1000));
    }
  }

  throw lastError || new Error("Gemini API calls failed");
}

export const humanAiService = {
  async assessLevel(testAnswers: string | string[], profession: string = "General") {
    const formattedAnswers = Array.isArray(testAnswers) ? testAnswers.join(', ') : testAnswers;
    try {
      const prompt = `Evaluate the English level (Beginner, Intermediate, Advanced) based on: "${formattedAnswers}" for a "${profession}". Return JSON strictly: { "level": "Beginner/Intermediate/Advanced", "explanation": "Short reason" }`;
      const rawText = await callGeminiRestApi(prompt);
      const parsed = safeJsonParse(rawText);
      return parsed.level ? parsed : { level: "Intermediate", explanation: "Evaluated level." };
    } catch (e) {
      return { level: "Beginner", explanation: "Default starting level." };
    }
  },

  async generateLearningPlan(level: string, profession: string = "General Professional") {
    try {
      const prompt = `Create a 12-month English roadmap for ${level} level student in ${profession}. Return JSON strictly: { "roadmap": [ { "month": 1, "theme": "", "objectives": [] } ] }`;
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
         - Evaluate "${cleanInput}" for grammar mistakes, missing words, word order, or unnatural phrasing.
         - "corrected": ALWAYS provide a polished, natural English version (e.g. for "Can you please talk with me for couple of minutes", correct it to "Could you please talk with me for a couple of minutes?").
         - "explanation": ALWAYS write a clear, supportive explanation in ${userLanguage} describing what mistake was made and why the corrected version sounds better.
         - If the input is ALREADY 100% perfect, polished English: set "corrected" to original input and "explanation" to "".
      2. FRIENDLY HUMAN RESPONSE:
         - "response": Reply warmly in English continuing the chat like a real human friend.

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

      throw new Error("Empty JSON output");
    } catch (error: any) {
      console.error("Gemini REST API Error:", error);
      
      return {
        corrected: cleanInput,
        response: `Hey! Thanks for chatting. I'm right here—what else is on your mind today?`,
        translation: cleanInput,
        explanation: ""
      };
    }
  }
};
