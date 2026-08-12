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

// Models tried in order.
//
// FIX (Aug 2026): version-pinned names like 'gemini-2.5-flash',
// 'gemini-2.0-flash' and 'gemini-2.5-flash-lite' were returning 404 for this
// account/API version — Gemini 2.0 Flash / Flash-Lite have been retired by
// Google, and pinned 2.5 names aren't guaranteed to exist on every key/region.
// Only the *rolling alias* names (which Google keeps pointed at whatever the
// current best available model is) reliably resolve, so we now only use
// those. This also means there's just ONE quota bucket in practice, so the
// old "try 4 model names to dodge quota" trick no longer helps and mostly
// just burned through the 20-requests/day free-tier limit for nothing.
const MODEL_FALLBACK_CHAIN = [
  'gemini-flash-latest',
  'gemini-pro-latest'
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

          // 429 with a project-level "limit: 0" quota (Workspace/no-billing accounts)
          // means retrying the SAME model with a different key/attempt is pointless —
          // move straight to the next model, which may have its own quota bucket.
          if (response.status === 429) {
            if (errText.includes('"limit": 0') || errText.includes('limit: 0')) {
              break; // go to next model immediately, don't burn more quota here
            }
            rotateKey();
            continue;
          }

          // 403 -> bad/invalid key, try next key on this same model
          if (response.status === 403) {
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
    // FIX: cache the roadmap per level+profession. Previously this had NO
    // cache at all, so every time a user opened Practice it fired a fresh
    // API call — one of the things burning through the 20/day free quota.
    const cacheKey = `humnai_cache_roadmap_${level.toLowerCase()}_${profession.toLowerCase().replace(/\s+/g, '_')}`;

    if (typeof window !== 'undefined') {
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          if (parsed && Array.isArray(parsed.roadmap) && parsed.roadmap.length >= 12) return parsed;
        } catch (e) {}
      }
    }

    try {
      const prompt = `Create a COMPLETE 12-month English roadmap for a ${level} level student working as ${profession}. You MUST return exactly 12 entries, one per month, month 1 through month 12 — never fewer. Return JSON only: { "roadmap": [ { "month": 1, "theme": "", "objectives": [] }, ... all the way to month 12 ] }`;
      const rawText = await callGeminiRestApi(prompt);
      const parsed = safeJsonParse(rawText);
      if (parsed && Array.isArray(parsed.roadmap) && parsed.roadmap.length >= 12) {
        if (typeof window !== 'undefined') {
          try { localStorage.setItem(cacheKey, JSON.stringify(parsed)); } catch (e) {}
        }
        return parsed;
      }
      throw new Error("Invalid or incomplete roadmap structure");
    } catch (error) {
      // FIX: fallback used to only cover 2 months. Now covers all 12 so a
      // failed/quota-exhausted API call doesn't visibly truncate the plan.
      const defaultThemes = [
        { theme: `Foundations for ${profession}`, objectives: ["Core sentence structure", "Essential workplace vocabulary"] },
        { theme: "Present & Past Tenses", objectives: ["Simple Present Tense", "Simple Past Tense"] },
        { theme: "Future Tense & Planning", objectives: ["Future forms (will/going to)", "Making plans and predictions"] },
        { theme: "Workplace Communication", objectives: ["Emails and messages", "Meeting phrases"] },
        { theme: "Questions & Requests", objectives: ["Forming questions", "Polite requests"] },
        { theme: "Describing People & Things", objectives: ["Adjectives and comparisons", "Describing appearance and character"] },
        { theme: "Conversations & Small Talk", objectives: ["Starting conversations", "Common idioms"] },
        { theme: "Phone & Video Calls", objectives: ["Call etiquette phrases", "Clarifying and confirming"] },
        { theme: "Presentations & Explaining Ideas", objectives: ["Structuring a talk", "Explaining processes"] },
        { theme: "Problem Solving & Opinions", objectives: ["Expressing opinions", "Agreeing and disagreeing"] },
        { theme: "Advanced Grammar Review", objectives: ["Modal verbs", "Conditionals"] },
        { theme: "Fluency & Confidence Building", objectives: ["Spontaneous speaking practice", "Review of all key topics"] }
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
    // FIX: cache per level+month+day+language. This had no cache before, so
    // re-opening the same day's practice re-called the API every time.
    const cacheKey = `humnai_cache_tasks_${level.toLowerCase()}_m${month}_d${day}_${userLanguage.toLowerCase()}`;

    if (typeof window !== 'undefined') {
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          if (parsed && (parsed.sentences?.length || parsed.mcqs?.length)) return parsed;
        } catch (e) {}
      }
    }

    try {
      const prompt = `Generate a FULL day of English practice tasks in ${userLanguage} for a ${level} level student on Month ${month}, Day ${day}. Include at least 4 sentences, 4 translations, 4 arrangements, and 4 mcqs (16 items total). Return JSON only: { "sentences": [], "translations": [], "arrangements": [], "mcqs": [] }`;
      const rawText = await callGeminiRestApi(prompt);
      const parsed = safeJsonParse(rawText);
      if (parsed && (parsed.sentences?.length || parsed.mcqs?.length)) {
        if (typeof window !== 'undefined') {
          try { localStorage.setItem(cacheKey, JSON.stringify(parsed)); } catch (e) {}
        }
        return parsed;
      }
      throw new Error("Tasks error");
    } catch (error) {
      // FIX: fallback used to only have 1 item per category (4 total).
      // Now has 4 per category (16 total) matching the real expected count.
      return {
        sentences: [
          { english: "I practice English daily.", translation: "मैं रोज अंग्रेजी अभ्यास करता हूँ।" },
          { english: "She works in an office.", translation: "वह एक ऑफिस में काम करती है।" },
          { english: "We will meet tomorrow.", translation: "हम कल मिलेंगे।" },
          { english: "He is learning new skills.", translation: "वह नए कौशल सीख रहा है।" }
        ],
        translations: [
          { translation: "आपका दिन कैसा था?", english: "How was your day?" },
          { translation: "मुझे यह पसंद है।", english: "I like this." },
          { translation: "कृपया मेरी मदद करें।", english: "Please help me." },
          { translation: "यह बहुत अच्छा है।", english: "This is very good." }
        ],
        arrangements: [
          { jumbled: ["learning", "am", "English", "I"], correct: "I am learning English", translation: "मैं अंग्रेजी सीख रहा हूँ।" },
          { jumbled: ["work", "I", "office", "in", "an"], correct: "I work in an office", translation: "मैं एक ऑफिस में काम करता हूँ।" },
          { jumbled: ["today", "busy", "very", "is", "she"], correct: "She is very busy today", translation: "वह आज बहुत व्यस्त है।" },
          { jumbled: ["tomorrow", "meeting", "a", "have", "we"], correct: "We have a meeting tomorrow", translation: "हमारी कल एक मीटिंग है।" }
        ],
        mcqs: [
          { question: "She ___ to work daily.", options: ["go", "goes", "going"], answer: "goes", explanation: "Singular takes 'goes'.", translation: "वह रोज काम पर जाती है।" },
          { question: "They ___ studying now.", options: ["is", "are", "am"], answer: "are", explanation: "'They' takes 'are'.", translation: "वे अभी पढ़ रहे हैं।" },
          { question: "I ___ finished my work.", options: ["have", "has", "had"], answer: "have", explanation: "'I' takes 'have' in present perfect.", translation: "मैंने अपना काम पूरा कर लिया है।" },
          { question: "He ___ to the gym every morning.", options: ["go", "goes", "went"], answer: "goes", explanation: "Present simple habit uses 'goes'.", translation: "वह हर सुबह जिम जाता है।" }
        ]
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
   * Translates small fixed UI strings (e.g. the trial-expired modal) into the
   * user's native language. Reuses the same robust REST pipeline (retries,
   * model fallback, key rotation) instead of a separate, broken direct
   * @google/genai SDK call with a client-side-inaccessible API key.
   */
  async translateUIStrings(strings: Record<string, string>, targetLanguage: string) {
    try {
      const prompt = `Translate each value in this JSON object into ${targetLanguage}. Keep the same keys. Return ONLY a JSON object with the same keys, translated values, nothing else:\n${JSON.stringify(strings)}`;
      const rawText = await callGeminiRestApi(prompt);
      const parsed = safeJsonParse(rawText);
      if (parsed && Object.keys(parsed).length > 0) return parsed;
      throw new Error("Empty translation result");
    } catch (err) {
      return strings; // fall back to original (English) strings on failure
    }
  },

  /**
   * Main AI Chat handler.
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

      const msg = `Hmm, mujhe abhi thoda connection issue aa raha hai 🙏 Ek baar phir se try karo: "${cleanInput}"`;
      return { corrected: cleanInput, response: msg, translation: cleanInput, explanation: "", message: msg };
    }
  }
};
