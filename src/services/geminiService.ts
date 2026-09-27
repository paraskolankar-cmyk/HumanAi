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

// ============================================================
// USER LEVEL HELPER
// ============================================================
function getUserLevel(): string {
  if (typeof window === 'undefined') return 'Beginner';
  return localStorage.getItem('humnai_user_level') || 'Beginner';
}

// ============================================================
// API KEY MANAGEMENT
// ============================================================
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
  return Array.from(new Set(keys.filter((k): k is string => Boolean(k) && typeof k === 'string' && k.trim().length > 0)));
}

let currentKeyIndex = 0;
function rotateKey(): void {
  const keys = getApiKeyList();
  if (keys.length > 1) currentKeyIndex = (currentKeyIndex + 1) % keys.length;
}

export function safeJsonParse(text: string | undefined): any {
  if (!text) return {};
  try {
    let clean = text.replace(/```json/gi, '').replace(/```/g, '').trim();
    const match = clean.match(/\{[\s\S]*\}/);
    if (match) clean = match[0];
    return JSON.parse(clean);
  } catch (e) {
    return {};
  }
}

const MODEL_FALLBACK_CHAIN = ['gemini-flash-latest', 'gemini-pro-latest'];

async function callGeminiRestApi(prompt: string): Promise<string> {
  const keys = getApiKeyList();
  if (keys.length === 0) throw new Error("No Gemini API Key found. Add VITE_PRIMARY_GEMINI_KEY in Vercel env settings.");

  let lastError: any = null;

  for (const model of MODEL_FALLBACK_CHAIN) {
    for (let kIndex = 0; kIndex < keys.length; kIndex++) {
      const activeKey = keys[(currentKeyIndex + kIndex) % keys.length];
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${activeKey}`;

      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.92, topP: 0.95, responseMimeType: 'application/json' }
          })
        });

        if (response.ok) {
          const data = await response.json();
          const out = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
          if (out.trim()) return out;
        } else {
          const errText = await response.text();
          lastError = new Error(`${model} - ${response.status}: ${errText}`);
          if (response.status === 429) { rotateKey(); continue; }
          if (response.status === 403) { rotateKey(); continue; }
          if (response.status === 404) break;
        }
      } catch (err) {
        lastError = err;
      }
    }
  }
  throw lastError || new Error('All Gemini models failed');
}

// ============================================================
// HUMNAAI SERVICE — IMPROVED
// ============================================================
export const humanAiService = {

  // -------------------------------------------------------
  // ASSESS LEVEL
  // -------------------------------------------------------
  async assessLevel(testAnswers: string | string[], profession: string = 'General') {
    const formatted = Array.isArray(testAnswers) ? testAnswers.join(', ') : testAnswers;
    try {
      const prompt = `Evaluate English level (Beginner, Intermediate, Advanced) from: "${formatted}" for profession: "${profession}". Return JSON: { "level": "Beginner/Intermediate/Advanced", "explanation": "Short friendly reason in 1-2 sentences" }`;
      const raw = await callGeminiRestApi(prompt);
      const parsed = safeJsonParse(raw);
      return parsed.level ? parsed : { level: 'Intermediate', explanation: 'Good foundation — keep going!' };
    } catch {
      return { level: 'Beginner', explanation: "Let's start from the basics — you'll do great!" };
    }
  },

  // -------------------------------------------------------
  // LEARNING PLAN
  // -------------------------------------------------------
  async generateLearningPlan(level: string, profession: string = 'General Professional') {
    const cacheKey = `humnai_cache_roadmap_${level.toLowerCase()}_${profession.toLowerCase().replace(/\s+/g, '_')}`;
    if (typeof window !== 'undefined') {
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        try {
          const p = JSON.parse(cached);
          if (p?.roadmap?.length >= 12) return p;
        } catch {}
      }
    }
    try {
      const prompt = `Create a 12-month English learning roadmap for a ${level} learner working as ${profession}. Return exactly 12 monthly entries. JSON only: { "roadmap": [ { "month": 1, "theme": "", "objectives": [] }, ... ] }`;
      const raw = await callGeminiRestApi(prompt);
      const parsed = safeJsonParse(raw);
      if (parsed?.roadmap?.length >= 12) {
        if (typeof window !== 'undefined') {
          try { localStorage.setItem(cacheKey, JSON.stringify(parsed)); } catch {}
        }
        return parsed;
      }
      throw new Error('Invalid roadmap');
    } catch {
      const themes = [
        { theme: `Foundations for ${profession}`, objectives: ['Core sentence structure', 'Essential vocabulary'] },
        { theme: 'Present & Past Tenses', objectives: ['Simple Present', 'Simple Past'] },
        { theme: 'Future & Planning', objectives: ['Will / going to', 'Making predictions'] },
        { theme: 'Workplace Communication', objectives: ['Emails & messages', 'Meeting phrases'] },
        { theme: 'Questions & Requests', objectives: ['Forming questions', 'Polite requests'] },
        { theme: 'Describing Things', objectives: ['Adjectives & comparisons', 'Appearance & character'] },
        { theme: 'Small Talk & Conversations', objectives: ['Starting conversations', 'Common idioms'] },
        { theme: 'Phone & Video Calls', objectives: ['Call etiquette', 'Clarifying & confirming'] },
        { theme: 'Presentations', objectives: ['Structuring a talk', 'Explaining processes'] },
        { theme: 'Problem Solving & Opinions', objectives: ['Expressing opinions', 'Agreeing & disagreeing'] },
        { theme: 'Advanced Grammar', objectives: ['Modal verbs', 'Conditionals'] },
        { theme: 'Fluency & Confidence', objectives: ['Spontaneous speaking', 'Full review'] }
      ];
      return { roadmap: themes.map((t, i) => ({ month: i + 1, theme: `${level} - ${t.theme}`, objectives: t.objectives })) };
    }
  },

  // -------------------------------------------------------
  // DAILY TASKS
  // -------------------------------------------------------
  async generateDailyTasks(level: string, month: number, day: number, targetLanguage?: string) {
    const lang = targetLanguage || getSelectedLanguageName();
    const cacheKey = `humnai_cache_tasks_${level.toLowerCase()}_m${month}_d${day}_${lang.toLowerCase()}`;
    if (typeof window !== 'undefined') {
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        try {
          const p = JSON.parse(cached);
          if (p?.sentences?.length || p?.mcqs?.length) return p;
        } catch {}
      }
    }
    try {
      const prompt = `Generate 20-30 English practice tasks in ${lang} for ${level} level, Month ${month} Day ${day}. Include 5-8 items each in: sentences, translations, arrangements, mcqs. Return STRICT JSON only: { "sentences": [], "translations": [], "arrangements": [], "mcqs": [] }`;
      const raw = await callGeminiRestApi(prompt);
      const parsed = safeJsonParse(raw);
      if (parsed?.sentences?.length || parsed?.mcqs?.length) {
        if (typeof window !== 'undefined') {
          try { localStorage.setItem(cacheKey, JSON.stringify(parsed)); } catch {}
        }
        return parsed;
      }
      throw new Error('Invalid tasks');
    } catch {
      return {
        sentences: [
          { english: 'I practice English daily.', translation: 'मैं रोज अंग्रेजी अभ्यास करता हूँ।' },
          { english: 'She works in an office.', translation: 'वह एक ऑफिस में काम करती है।' },
          { english: 'We will meet tomorrow.', translation: 'हम कल मिलेंगे।' },
          { english: 'He is learning new skills.', translation: 'वह नए कौशल सीख रहा है।' },
          { english: 'Can you help me with this?', translation: 'क्या आप इस में मेरी मदद कर सकते हैं?' }
        ],
        translations: [
          { translation: 'आपका दिन कैसा था?', english: 'How was your day?' },
          { translation: 'मुझे यह पसंद है।', english: 'I like this.' },
          { translation: 'कृपया मेरी मदद करें।', english: 'Please help me.' },
          { translation: 'यह बहुत अच्छा है।', english: 'This is very good.' },
          { translation: 'मैं थोड़ा व्यस्त हूँ।', english: 'I am a bit busy.' }
        ],
        arrangements: [
          { jumbled: ['learning', 'am', 'English', 'I'], correct: 'I am learning English', translation: 'मैं अंग्रेजी सीख रहा हूँ।' },
          { jumbled: ['work', 'I', 'office', 'in', 'an'], correct: 'I work in an office', translation: 'मैं एक ऑफिस में काम करता हूँ।' },
          { jumbled: ['today', 'busy', 'very', 'is', 'she'], correct: 'She is very busy today', translation: 'वह आज बहुत व्यस्त है।' },
          { jumbled: ['tomorrow', 'meeting', 'a', 'have', 'we'], correct: 'We have a meeting tomorrow', translation: 'हमारी कल एक मीटिंग है।' },
          { jumbled: ['email', 'the', 'sent', 'I', 'have'], correct: 'I have sent the email', translation: 'मैंने ईमेल भेज दिया है।' }
        ],
        mcqs: [
          { question: 'She ___ to work daily.', options: ['go', 'goes', 'going'], answer: 'goes', explanation: "Singular subject 'She' takes 'goes'.", translation: 'वह रोज काम पर जाती है।' },
          { question: 'They ___ studying now.', options: ['is', 'are', 'am'], answer: 'are', explanation: "'They' always takes 'are'.", translation: 'वे अभी पढ़ रहे हैं।' },
          { question: 'I ___ finished my work.', options: ['have', 'has', 'had'], answer: 'have', explanation: "'I' takes 'have' in present perfect.", translation: 'मैंने अपना काम पूरा कर लिया है।' },
          { question: 'This is the ___ book I have read.', options: ['good', 'better', 'best'], answer: 'best', explanation: 'Superlative form used for comparison.', translation: 'यह सबसे अच्छी किताब है।' },
          { question: 'We ___ dinner at 8 PM yesterday.', options: ['have', 'had', 'having'], answer: 'had', explanation: 'Past simple for a finished past action.', translation: 'हमने कल रात 8 बजे खाना खाया।' }
        ]
      };
    }
  },

  async generateMonthTasks(level: string, month: number, targetLanguage?: string, daysInMonth: number = 28) {
    const lang = targetLanguage || getSelectedLanguageName();
    const results: Record<number, any> = {};
    const missingDays: number[] = [];

    if (typeof window !== 'undefined') {
      for (let day = 1; day <= daysInMonth; day++) {
        const ck = `humnai_cache_tasks_${level.toLowerCase()}_m${month}_d${day}_${lang.toLowerCase()}`;
        const cached = localStorage.getItem(ck);
        if (cached) {
          try {
            const p = JSON.parse(cached);
            if (p?.sentences?.length || p?.mcqs?.length) { results[day] = p; continue; }
          } catch {}
        }
        missingDays.push(day);
      }
    } else {
      for (let day = 1; day <= daysInMonth; day++) missingDays.push(day);
    }

    if (missingDays.length === 0) return results;

    try {
      const prompt = `Generate English practice tasks in ${lang} for ${level} level, Month ${month}, for days: ${missingDays.join(', ')}. Each day: 20-30 total items (5-8 per category: sentences, translations, arrangements, mcqs). Return JSON: { "1": { "sentences": [], ... }, "2": { ... }, ... }`;
      const raw = await callGeminiRestApi(prompt);
      const parsed = safeJsonParse(raw);
      if (parsed && typeof parsed === 'object') {
        for (const day of missingDays) {
          const dayData = parsed[String(day)];
          if (dayData?.sentences?.length || dayData?.mcqs?.length) {
            results[day] = dayData;
            if (typeof window !== 'undefined') {
              const ck = `humnai_cache_tasks_${level.toLowerCase()}_m${month}_d${day}_${lang.toLowerCase()}`;
              try { localStorage.setItem(ck, JSON.stringify(dayData)); } catch {}
            }
          }
        }
      }
    } catch (err) {
      console.warn(`Month ${month} pregeneration failed:`, err);
    }

    return results;
  },

  async pregenerateRoadmapTasks(level: string, totalMonths: number = 12, daysPerMonth: number = 28, targetLanguage?: string, onProgress?: (done: number, total: number) => void) {
    for (let month = 1; month <= totalMonths; month++) {
      await this.generateMonthTasks(level, month, targetLanguage, daysPerMonth);
      onProgress?.(month, totalMonths);
      await new Promise(r => setTimeout(r, 400));
    }
  },

  async getDailyLearningContent(category: string, level: string, dayNumber: number = 1, targetLanguage?: string) {
    const lang = targetLanguage || getSelectedLanguageName();
    const cacheKey = `humnai_cache_module_${category}_day${dayNumber}_${lang.toLowerCase()}`;
    if (typeof window !== 'undefined') {
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        try {
          const p = JSON.parse(cached);
          if (p?.vocabulary || p?.explanation || p?.topic) return p;
        } catch {}
      }
    }
    try {
      const prompt = `You are an AI English Tutor. Generate DAY ${dayNumber} content for "${category}" at "${level}" level in ${lang}. Return JSON.`;
      const raw = await callGeminiRestApi(prompt);
      const parsed = safeJsonParse(raw);
      if (typeof window !== 'undefined' && parsed && (parsed.topic || parsed.vocabulary || parsed.explanation)) {
        try { localStorage.setItem(cacheKey, JSON.stringify(parsed)); } catch {}
      }
      return parsed;
    } catch {
      return {};
    }
  },

  async translateUIStrings(strings: Record<string, string>, targetLanguage: string) {
    try {
      const prompt = `Translate each value in this JSON into ${targetLanguage}. Keep keys same. Return ONLY JSON:\n${JSON.stringify(strings)}`;
      const raw = await callGeminiRestApi(prompt);
      const parsed = safeJsonParse(raw);
      if (parsed && Object.keys(parsed).length > 0) return parsed;
      throw new Error('Empty result');
    } catch {
      return strings;
    }
  },

  // ============================================================
  // MAIN AI CHAT — COMPLETELY REWRITTEN FOR HUMAN-LIKE TONE
  // ============================================================
  async correctSentence(sentence: string, historyContextOrLang?: string[] | string, targetLanguage?: string) {
    let historyContext: string[] = [];
    let userLanguage = getSelectedLanguageName();
    const userLevel = getUserLevel(); // Beginner / Intermediate / Advanced

    if (Array.isArray(historyContextOrLang)) {
      historyContext = historyContextOrLang;
      if (targetLanguage) userLanguage = targetLanguage;
    } else if (typeof historyContextOrLang === 'string') {
      userLanguage = historyContextOrLang;
    }

    const cleanInput = (sentence || '').trim();
    if (!cleanInput) {
      const msg = "Hey! Kuch toh likho — main sun raha hoon 😄";
      return { corrected: '', response: msg, translation: '', explanation: '', message: msg };
    }

    // ---- Level-aware teaching style ----
    const levelGuide = {
      Beginner: `The user is a BEGINNER. Use very simple English words. Speak slowly and clearly. Give short sentences. Always translate key words in ${userLanguage}. Encourage them a LOT — they are just starting out. Use emojis to make it fun 🎉`,
      Intermediate: `The user is at INTERMEDIATE level. Use natural English but avoid complex grammar. Occasionally introduce new vocabulary with a brief meaning. Be encouraging and engaging. Use mild humor.`,
      Advanced: `The user is ADVANCED. Use rich, natural English. You can use idioms, phrasal verbs, and complex sentences. Challenge them gently by introducing more sophisticated vocabulary or expressions. Be witty and intellectual.`
    }[userLevel] || `The user is a BEGINNER. Use simple English and be very encouraging.`;

    // ---- History context ----
    const historyPrompt = historyContext.length > 0
      ? `CONVERSATION SO FAR (most recent last):\n${historyContext.slice(-8).join('\n')}\n\n`
      : '';

    const seed = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

    const prompt = `You are HumnAi — a fun, warm, human-like English tutor and conversation partner. You talk like a real friend on WhatsApp, NOT like a robot or textbook.

IMPORTANT RULES:
- NEVER start two replies the same way. Vary your openers every time.
- NEVER say generic things like "Thanks for sharing!" or "What else is on your mind?"
- ALWAYS react to what the user ACTUALLY said — be specific and personal.
- Match your tone to the user's mood: if they're excited, be excited. If they're struggling, be gentle.
- Use emojis naturally, like a real person would — not forced.
- Be funny, warm, and encouraging — like a helpful dost (friend).

SESSION SEED (for variety, ignore the number itself): ${seed}

USER LEVEL: ${userLevel}
TEACHING STYLE: ${levelGuide}

${historyPrompt}USER'S MESSAGE: "${cleanInput}"

STEP 1 — CHECK FOR MISTAKES:
Look for grammar errors, wrong tense, missing articles/prepositions, or unnatural phrasing in: "${cleanInput}"

STEP 2 — IF MISTAKE FOUND:
- Write the corrected sentence naturally
- Explain the mistake briefly in ${userLanguage} (like a friend explaining, not a teacher lecturing)
- Then continue the conversation naturally in English reacting to what they actually said

STEP 3 — IF NO MISTAKE:
- Skip correction entirely
- Just reply naturally, reacting specifically to their message

${userLevel === 'Beginner' ? `
EXTRA FOR BEGINNERS:
- After your reply, add one "Word of the Day" relevant to the conversation
- Format: "📚 Aaj ka word: [word] = [${userLanguage} meaning] | Example: [simple sentence]"
` : ''}

${userLevel === 'Advanced' ? `
EXTRA FOR ADVANCED:
- Occasionally challenge them: introduce an idiom or phrasal verb relevant to the topic
- Format: "💡 Did you know: '[idiom]' means [meaning]. Example: [sentence]"
` : ''}

Return STRICT JSON only — no extra text:
{
  "corrected": "Corrected English sentence (same as input if no mistake)",
  "explanation": "Friendly mistake explanation in ${userLanguage}. Empty string if no mistake.",
  "response": "Your natural, specific, human English reply to their message",
  "translation": "${userLanguage} translation of the user's original message",
  "message": "The complete chat bubble: correction note (only if needed) + explanation in ${userLanguage} (only if needed) + your natural response. Written as ONE flowing friendly WhatsApp message.",
  "wordOfDay": "Only for Beginners — the word-of-the-day line. Empty string for other levels."
}`;

    try {
      const raw = await callGeminiRestApi(prompt);
      const parsed = safeJsonParse(raw);

      if (parsed && (parsed.response || parsed.corrected || parsed.message)) {
        const response = parsed.response || raw.trim();
        const explanation = parsed.explanation || '';
        const corrected = parsed.corrected || cleanInput;

        const cleanOriginal = cleanInput.trim().toLowerCase().replace(/[.,/#!$%^&*;:{}=\-_`~()]/g, '');
        const cleanCorrected = corrected.trim().toLowerCase().replace(/[.,/#!$%^&*;:{}=\-_`~()]/g, '');
        const hasMistake = cleanCorrected.length > 0 && cleanCorrected !== cleanOriginal;

        // Build message bubble
        let finalMessage = parsed.message || '';
        if (!finalMessage) {
          const parts = [];
          if (hasMistake && corrected) parts.push(`✅ Sahi tarika: "${corrected}"`);
          if (explanation) parts.push(explanation);
          parts.push(response);
          if (parsed.wordOfDay) parts.push(parsed.wordOfDay);
          finalMessage = parts.filter(Boolean).join('\n\n');
        }

        return {
          corrected: hasMistake ? corrected : cleanInput,
          response: finalMessage,
          translation: parsed.translation || cleanInput,
          explanation: hasMistake ? explanation : '',
          message: finalMessage
        };
      }

      throw new Error('Invalid Gemini response');

    } catch (error: any) {
      console.error('Gemini Chat Error:', error?.message || error);

      // Smart fallback responses based on input
      const isGreeting = /^(hello|hi|hey|hola|namaste|good\s*(morning|evening|night|afternoon))[\s!.]*$/i.test(cleanInput);
      const isQuestion = cleanInput.includes('?');

      if (isGreeting) {
        const greetings = [
          "Hey hey! 👋 Great to see you! Kya scene hai aaj?",
          "Arrey wahh! 😄 Aagaye aap! Batao, kya chal raha hai?",
          "Hello hello! 🌟 Welcome back! Aaj kya seekhna hai?"
        ];
        const msg = greetings[Math.floor(Math.random() * greetings.length)];
        return { corrected: cleanInput, response: msg, translation: cleanInput, explanation: '', message: msg };
      }

      if (isQuestion) {
        const msg = "Ek achha sawaal hai yeh! 🤔 Mujhe thodi der ke liye connection issue aa raha hai — ek baar phir try karo, main reply karunga!";
        return { corrected: cleanInput, response: msg, translation: cleanInput, explanation: '', message: msg };
      }

      const msg = `Hmm, main abhi thoda busy tha 😅 Phir se bhejo: "${cleanInput}" — main zaroor reply karunga!`;
      return { corrected: cleanInput, response: msg, translation: cleanInput, explanation: '', message: msg };
    }
  }
};
