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

const MODEL_FALLBACK_CHAIN = [
  'gemini-2.5-flash',
  'gemini-2.0-flash',
  'gemini-2.5-flash-lite',
  'gemini-flash-latest'
];

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

          if (response.status === 429) {
            if (errText.includes('"limit": 0') || errText.includes('limit: 0')) {
              break;
            }
            rotateKey();
            continue;
          }

          if (response.status === 403) {
            rotateKey();
            continue;
          }

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

// --------------------------------------------------------------------------
// PRACTICE SECTION CONSTANTS (12 MONTHS & 24 DAILY TASKS GUARANTEED)
// --------------------------------------------------------------------------

const FULL_12_MONTHS_ROADMAP = [
  { month: 1, theme: "Foundations & Professional Vocabulary", objectives: ["Basic sentence structure", "Workplace daily words", "Self-introduction & Elevator pitch"] },
  { month: 2, theme: "Present & Past Communication", objectives: ["Simple Present Tense in meetings", "Past tense for achievements", "Regular & Irregular Verbs"] },
  { month: 3, theme: "Future Tense & Modals in Workplace", objectives: ["Future planning & projections", "Polite requests (Could, Would, Should)", "Scheduling meetings"] },
  { month: 4, theme: "Nouns, Pronouns & Professional Writing", objectives: ["Types of Nouns", "Subject & Object Pronouns", "Descriptive Adjectives for reports"] },
  { month: 5, theme: "Verb Patterns & Sentence Building", objectives: ["Verb Forms V1-V4", "Subject-Verb Agreement", "Avoiding common speech errors"] },
  { month: 6, theme: "Prepositions & Email Writing", objectives: ["Prepositions of Time & Place", "Formal Email Etiquette", "Compound Sentences"] },
  { month: 7, theme: "Active & Passive Voice in Business", objectives: ["Active Voice Rules", "Passive Voice in Documentation", "Converting Sentences"] },
  { month: 8, theme: "Reporting Speech & Feedback", objectives: ["Direct Speech Rules", "Indirect Speech Conversion", "Handling Feedback Politely"] },
  { month: 9, theme: "Business Idioms & Phrases", objectives: ["High-frequency Corporate Idioms", "Phrasal Verbs for workplace", "Contextual Vocabulary"] },
  { month: 10, theme: "Reading Comprehension & Error Spotting", objectives: ["Comprehension Practice", "Grammatical Error Spotting", "Rearranging Jumbled Ideas"] },
  { month: 11, theme: "Interview & Presentation Fluency", objectives: ["Answering Interview Q&A", "Delivering Presentations", "Public Speaking Confidence"] },
  { month: 12, theme: "Career Mastery & Final Certification", objectives: ["Advanced Grammar Rules", "Full Mock Drills", "Complete Fluency Review"] }
];

const FULL_24_DAILY_TASKS = {
  sentences: [
    { english: "I start my work early in the morning.", translation: "मैं सुबह जल्दी अपना काम शुरू करता हूँ।" },
    { english: "Effective communication builds strong career growth.", translation: "प्रभावी बातचीत मजबूत करियर विकास का निर्माण करती है।" },
    { english: "He works hard to achieve his professional goals.", translation: "वह अपने पेशेवर लक्ष्यों को पाने के लिए कड़ी मेहनत करता है।" },
    { english: "We are learning new business vocabulary today.", translation: "हम आज नई व्यावसायिक शब्दावली सीख रहे हैं।" },
    { english: "Never hesitate to ask questions in meetings.", translation: "मीटिंग में सवाल पूछने में कभी मत हिचकिचाएं।" },
    { english: "Clear expression solves many workplace problems.", translation: "स्पष्ट अभिव्यक्ति कार्यस्थल की कई समस्याओं को हल करती है।" }
  ],
  translations: [
    { translation: "आपका दिन बहुत शुभ हो।", english: "Have a very good day." },
    { translation: "मैं अंग्रेजी में धाराप्रवाह बात कर सकता हूँ।", english: "I can speak fluently in English." },
    { translation: "वह बहुत प्रतिभाशाली और मेहनती है।", english: "She is very talented and hardworking." },
    { translation: "क्या आप आज की मीटिंग के लिए तैयार हैं?", english: "Are you ready for today's meeting?" },
    { translation: "सफलता निरंतर अभ्यास से ही आती है।", english: "Success comes only from continuous practice." },
    { translation: "समय कार्यस्थल पर बहुत मूल्यवान है।", english: "Time is very valuable in the workplace." }
  ],
  arrangements: [
    { jumbled: ["English", "learning", "am", "I", "daily"], correct: "I am learning English daily", translation: "मैं रोज अंग्रेजी सीख रहा हूँ।" },
    { jumbled: ["a", "is", "great", "leader", "He"], correct: "He is a great leader", translation: "वह एक महान नेता है।" },
    { jumbled: ["hard", "Work", "achieve", "to", "success"], correct: "Work hard to achieve success", translation: "सफलता पाने के लिए कड़ी मेहनत करें।" },
    { jumbled: ["fluently", "speaks", "She", "English"], correct: "She speaks English fluently", translation: "वह धाराप्रवाह अंग्रेजी बोलती है।" },
    { jumbled: ["time", "on", "Be", "always"], correct: "Always be on time", translation: "हमेशा समय पर रहें।" },
    { jumbled: ["makes", "Practice", "man", "a", "perfect"], correct: "Practice makes a man perfect", translation: "अभ्यास इंसान को निपुण बनाता है।" }
  ],
  mcqs: [
    { question: "He ___ to office yesterday.", options: ["go", "went", "gone", "going"], answer: "went", explanation: "Past tense of 'go' is 'went'.", translation: "वह कल दफ्तर गया था।" },
    { question: "She is ___ than her colleague.", options: ["smart", "smarter", "smartest", "more smart"], answer: "smarter", explanation: "Comparative degree uses 'smarter'.", translation: "वह अपने सहकर्मी से ज्यादा समझदार है।" },
    { question: "They ___ preparing for the presentation now.", options: ["is", "are", "was", "be"], answer: "are", explanation: "Plural subject 'They' takes 'are'.", translation: "वे अभी प्रेजेंटेशन की तैयारी कर रहे हैं।" },
    { question: "Identify the Noun: 'Honesty is key to success.'", options: ["is", "key", "Honesty", "success"], answer: "Honesty", explanation: "'Honesty' is an abstract noun.", translation: "संज्ञा पहचानें:" },
    { question: "Choose the correct sentence:", options: ["She like tea", "She likes tea", "She liking tea", "She is like tea"], answer: "She likes tea", explanation: "Third person singular takes 'likes'.", translation: "सही वाक्य चुनें:" },
    { question: "We ___ completed the project on time.", options: ["has", "have", "is", "was"], answer: "have", explanation: "Plural 'We' takes 'have'.", translation: "हमने समय पर प्रोजेक्ट पूरा कर लिया है।" }
  ]
};

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

  // --------------------------------------------------------------------------
  // UPDATED PRACTICE SECTION METHOD 1: GENERATE 12-MONTH LEARNING PLAN
  // --------------------------------------------------------------------------
  async generateLearningPlan(level: string, profession: string = "General Professional") {
    try {
      const prompt = `Create a COMPLETE 12-MONTH English learning roadmap tailored for a ${level} level student whose profession/goal is "${profession}". 
      STRICT REQUIREMENT: You MUST generate EXACTLY 12 MONTHS in the "roadmap" array (Month 1, Month 2, Month 3, ... up to Month 12).
      Make monthly themes and key objectives directly relevant to their profession (${profession}).

      Return JSON format strictly: 
      { 
        "roadmap": [ 
          { "month": 1, "theme": "Theme for Month 1", "objectives": ["Obj 1", "Obj 2", "Obj 3"] },
          { "month": 2, "theme": "Theme for Month 2", "objectives": ["Obj 1", "Obj 2", "Obj 3"] },
          ... continue up to month 12
        ] 
      }`;
      const rawText = await callGeminiRestApi(prompt);
      const parsed = safeJsonParse(rawText);
      
      if (parsed && Array.isArray(parsed.roadmap) && parsed.roadmap.length >= 6) {
        return parsed;
      }
      throw new Error("Invalid roadmap structure or less than 6 months returned");
    } catch (error) {
      console.warn("Serving 12-month roadmap fallback:", error);
      return {
        roadmap: FULL_12_MONTHS_ROADMAP.map(item => ({
          month: item.month,
          theme: `${level} - ${item.theme}`,
          objectives: item.objectives
        }))
      };
    }
  },

  // --------------------------------------------------------------------------
  // UPDATED PRACTICE SECTION METHOD 2: GENERATE DAILY PRACTICE TASKS (20-30 QUESTIONS)
  // --------------------------------------------------------------------------
  async generateDailyTasks(level: string, month: number, day: number, targetLanguage?: string) {
    const userLanguage = targetLanguage || getSelectedLanguageName();

    try {
      const prompt = `Generate daily English practice tasks for a ${level} level student on Month ${month}, Day ${day}.
        CRITICAL CONSTRAINT: Generate BETWEEN 20 AND 30 PRACTICE QUESTIONS IN TOTAL.
        
        Provide 5 to 8 questions in EACH of these 4 categories:
        1. "sentences": 5 to 8 short speaking practice sentences with ${userLanguage} translation.
        2. "translations": 5 to 8 translation tasks (${userLanguage} sentence to translate into English).
        3. "arrangements": 5 to 8 jumbled word arrays with correct sentence and ${userLanguage} translation.
        4. "mcqs": 5 to 8 grammar multiple-choice questions with 4 options, answer, and explanation in ${userLanguage}.
        
        Return JSON format strictly:
        { 
          "sentences": [ { "english": "...", "translation": "..." } ], 
          "translations": [ { "translation": "...", "english": "..." } ],
          "arrangements": [ { "jumbled": ["word1", "word2"], "correct": "...", "translation": "..." } ],
          "mcqs": [ { "question": "...", "options": ["A", "B", "C", "D"], "answer": "...", "explanation": "...", "translation": "..." } ]
        }`;

      const rawText = await callGeminiRestApi(prompt);
      const parsed = safeJsonParse(rawText);
      const total = (parsed.sentences?.length || 0) + (parsed.translations?.length || 0) + (parsed.arrangements?.length || 0) + (parsed.mcqs?.length || 0);

      if (parsed && total >= 12) {
        return parsed;
      }
      throw new Error("Tasks count below required minimum");
    } catch (error) {
      console.warn("Serving 24-question daily tasks fallback:", error);
      return FULL_24_DAILY_TASKS;
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

  async translateUIStrings(strings: Record<string, string>, targetLanguage: string) {
    try {
      const prompt = `Translate each value in this JSON object into ${targetLanguage}. Keep the same keys. Return ONLY a JSON object with the same keys, translated values, nothing else:\n${JSON.stringify(strings)}`;
      const rawText = await callGeminiRestApi(prompt);
      const parsed = safeJsonParse(rawText);
      if (parsed && Object.keys(parsed).length > 0) return parsed;
      throw new Error("Empty translation result");
    } catch (err) {
      return strings;
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
