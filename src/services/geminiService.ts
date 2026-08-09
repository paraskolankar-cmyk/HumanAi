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

// Models tried in order — if the first is unavailable/deprecated in your account/region,
// it automatically falls through to the next one instead of failing silently.
const MODEL_FALLBACK_CHAIN = [
  'gemini-2.0-flash',
  'gemini-1.5-flash-latest',
  'gemini-1.5-flash'
];

// ULTRA-STABLE DIRECT REST API CALLER (Fixes 404 & REST Endpoint Format)
async function callGeminiRestApi(prompt: string): Promise<string> {
  const keys = getApiKeyList();
  if (keys.length === 0) {
    console.error("❌ CRITICAL ERROR: No Gemini API Key exposed to Vite client! Check that your env var is prefixed with VITE_ (e.g. VITE_PRIMARY_GEMINI_KEY) and set in your deployment (Vercel) env settings.");
    throw new Error("Missing Gemini API Key in build bundle");
  }

  let lastError: any = null;

  for (const model of MODEL_FALLBACK_CHAIN) {
    for (let kIndex = 0; kIndex < keys.length; kIndex++) {
      const activeKey = keys[(currentKeyIndex + kIndex) % keys.length];
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${activeKey}`;

      const requestBody = {
        contents: [
          {
            role: "user",
            parts: [{ text: prompt }]
          }
        ],
        generationConfig: {
          temperature: 0.9,
          topP: 0.95,
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
          console.warn(`⚠️ Gemini (${model}) returned empty output.`, data);
        } else {
          const errText = await response.text();
          console.warn(`⚠️ Gemini API call failed [model: ${model}, status: ${response.status}]:`, errText);
          lastError = new Error(`Model ${model} - Status ${response.status}: ${errText}`);

          // 429 (rate limit) / 403 (bad key) -> try next key on this same model first
          if (response.status === 429 || response.status === 403) {
            rotateKey();
            continue;
          }

          // 404 -> this model isn't available for this key/account, break to try next model
          if (response.status === 404) {
            break;
          }
        }
      } catch (err) {
        console.error(`❌ Network/fetch error calling Gemini (${model}):`, err);
        lastError = err;
      }
    }
  }

  throw lastError || new Error("All Gemini models/keys failed");
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

  /**
   * Main AI Chat handler.
   *
   * IMPORTANT FOR UI: this now returns a ready-to-display `message` field that
   * already combines correction + native-language explanation + natural reply
   * in the right order (so even if your chat bubble only renders one field,
   * it will show the full tutoring flow). The individual fields (`corrected`,
   * `response`, `explanation`, `translation`) are still returned separately
   * in case you want to style them differently (e.g. correction in a colored box).
   */
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
        ? `PREVIOUS CONVERSATION HISTORY (most recent last):\n${historyContext.slice(-6).join('\n')}\n`
        : '';

      const seed = Date.now() + "_" + Math.random().toString(36).substring(2, 7);

      const prompt = `You are HumnAi — a warm, witty, human-like English speaking partner chatting on WhatsApp with a ${userLanguage}-speaking learner. You are NOT a robot and must never sound scripted or repeat the same phrasing across turns. Vary your vocabulary, tone, and sentence structure every single time.

Session Seed (ignore this number, just use it to make sure you vary your reply): ${seed}

${historyPrompt}
USER'S LATEST MESSAGE: "${cleanInput}"

YOUR JOB — follow this exact order of thinking:
1. Check "${cleanInput}" for grammar mistakes, wrong tense, missing articles/prepositions, or unnatural phrasing.
2. If there IS a mistake:
   - Gently correct it FIRST, like a friend would — short, warm, not preachy. Example style: "Just a tiny tweak — say 'I am going to the market' instead of 'I go to market' 🙂"
   - THEN explain WHY, briefly, written naturally in ${userLanguage} (not English), so the learner truly understands the rule in their own language.
   - THEN continue the conversation naturally in English, reacting to what the user actually said (ask a follow-up question or share a relevant thought — like real WhatsApp chat, not generic filler).
3. If the sentence is ALREADY correct and natural:
   - Skip correction and explanation entirely.
   - Just reply naturally in English, continuing the conversation like a real friend, reacting specifically to what they said.
4. NEVER use generic filler like "Thanks for chatting" or "What else is on your mind" — always react to the ACTUAL content of their message.

Return STRICT JSON in exactly this format, nothing else:
{
  "corrected": "Corrected/natural English version of user's sentence",
  "explanation": "Friendly explanation of the mistake, written in ${userLanguage}. Empty string \"\" if no mistake.",
  "response": "Natural, specific, human English reply continuing the conversation",
  "translation": "${userLanguage} translation of the user's original sentence",
  "message": "The FULL combined chat bubble text: (correction line, only if needed) + (explanation in ${userLanguage}, only if needed) + (natural response). Written as one flowing, friendly WhatsApp-style message a human tutor friend would actually send."
}`;

      const rawText = await callGeminiRestApi(prompt);
      const parsed = safeJsonParse(rawText);

      if (parsed && (parsed.response || parsed.corrected || parsed.message)) {
        const response = parsed.response || rawText.trim();
        const explanation = parsed.explanation || "";
        const corrected = parsed.corrected || cleanInput;

        // Build a safe fallback combined message in case the model didn't return `message`
        const fallbackMessage = [
          explanation && corrected !== cleanInput ? `✅ ${corrected}` : null,
          explanation || null,
          response
        ].filter(Boolean).join('\n\n');

        return {
          corrected,
          response,
          translation: parsed.translation || cleanInput,
          explanation,
          message: parsed.message || fallbackMessage
        };
      }

      throw new Error("Empty or invalid JSON output from Gemini REST API");
    } catch (error: any) {
      console.error("Gemini Direct REST Chat Error:", error?.message || error);

      const isGreeting = /^(hello|hi|hey|hola|namaste|good morning|good evening)[\s!.]*$/i.test(cleanInput);

      if (isGreeting) {
        const msg = "Hey there! Great to connect with you. How's your day going so far?";
        return { corrected: cleanInput, response: msg, translation: cleanInput, explanation: "", message: msg };
      }

      // Honest fallback instead of a fake-generic reply — tells the user (in their
      // own language) that something went wrong, instead of pretending to chat normally.
      const msg = `Hmm, mujhe abhi thoda connection issue aa raha hai 🙏 Ek baar phir se try karo: "${cleanInput}"`;
      return { corrected: cleanInput, response: msg, translation: cleanInput, explanation: "", message: msg };
    }
  }
};
