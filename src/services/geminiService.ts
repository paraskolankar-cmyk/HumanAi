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

// Limit Exceed Hone Par Next Backup Key Par Switch Karne Ka Logic
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
    let cleanText = text.replace(/```json/gi, '').replace(/```/g, '').trim();
    const jsonMatch = cleanText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      cleanText = jsonMatch[0];
    }
    return JSON.parse(cleanText);
  } catch (e) {
    console.error("Failed to parse Gemini response as JSON:", text);
    return {};
  }
}

export const getGeminiModel = (modelName = "gemini-2.5-flash") => {
  const ai = getAiInstance();
  return ai.models.generateContent({
    model: modelName,
    contents: "",
  });
};

export const humanAiService = {
  // 5 QUESTIONS & PROFESSION BASED LEVEL ASSESSMENT
  async assessLevel(testAnswers: string | string[], profession: string = "General") {
    const formattedAnswers = Array.isArray(testAnswers) ? testAnswers.join(', ') : testAnswers;
    try {
      return await withRetry(async (ai) => {
        const response = await ai.models.generateContent({
          model: "gemini-2.5-flash",
          contents: `Evaluate the English level (Beginner, Intermediate, Advanced) based on these 5 assessment answers: "${formattedAnswers}" for a person whose profession/goal is "${profession}". Return JSON: { "level": "Beginner/Intermediate/Advanced", "explanation": "Short reason" }`,
          config: { responseMimeType: "application/json" }
        });
        const parsed = safeJsonParse(response.text);
        return parsed.level ? parsed : { level: "Intermediate", explanation: "Evaluated from assessment test." };
      });
    } catch (e) {
      return { level: "Beginner", explanation: "Default starting level." };
    }
  },

  // PROFESSION & LEVEL TAILORED 12-MONTH ROADMAP GENERATOR
  async generateLearningPlan(level: string, profession: string = "General Professional") {
    try {
      return await withRetry(async (ai) => {
        const response = await ai.models.generateContent({
          model: "gemini-2.5-flash",
          contents: `Create a 12-month high-level English learning roadmap tailored for a ${level} level student whose profession/goal is "${profession}". 
          Make the monthly themes and key objectives directly relevant to their profession (e.g. interviews, business calls, academic exams, client communication, IT meetings, etc.).
          Return JSON format strictly: { "roadmap": [ { "month": 1, "theme": "", "objectives": [] }, ... up to month 12 ] }`,
          config: { responseMimeType: "application/json" }
        });

        const parsed = safeJsonParse(response.text);
        if (parsed && Array.isArray(parsed.roadmap) && parsed.roadmap.length > 0) {
          return parsed;
        }
        throw new Error("Invalid roadmap structure");
      });
    } catch (error) {
      console.error("Roadmap generation failed, serving fallback 12-month plan", error);

      const defaultThemes = [
        { theme: `Foundations & Professional Intro for ${profession}`, objectives: ["Core sentence structure", "Essential workplace vocabulary", "Professional introduction"] },
        { theme: "Present & Past Tenses in Work", objectives: ["Simple Present Tense in daily work", "Simple Past Tense for tasks", "Action verbs"] },
        { theme: "Future Tense & Polite Modals", objectives: ["Future projections & goal setting", "Modals (Could, Would, Should)", "Scheduling meetings"] },
        { theme: "Nouns, Pronouns & Professional Writing", objectives: ["Types of Nouns", "Subject & Object Pronouns", "Descriptive terms for reports"] },
        { theme: "Verbs & Sentence Accuracy", objectives: ["Verb Forms (V1 to V4)", "Subject-Verb Agreement", "Avoiding common errors"] },
        { theme: "Prepositions & Email Communication", objectives: ["Prepositions of Place & Time", "Formal Email Etiquette", "Connecting ideas"] },
        { theme: "Active & Passive Voice in Business", objectives: ["Active Voice Rules", "Passive Voice in Documentation", "Sentence Transformation"] },
        { theme: "Direct & Indirect Speech", objectives: ["Direct Speech Rules", "Reporting conversations", "Handling workplace feedback"] },
        { theme: "Advanced Vocabulary & Industry Terms", objectives: ["High-frequency Corporate Idioms", "Phrasal Verbs for work", "Contextual Vocabulary"] },
        { theme: "Reading & Error Spotting", objectives: ["Comprehension Practice", "Grammatical Error Spotting", "Rearranging Jumbled Ideas"] },
        { theme: "Conversational & Interview Fluency", objectives: ["Speaking without Hesitation", "Answering Interview / Meeting Questions", "Public Speaking Confidence"] },
        { theme: "Mastery & Final Career Review", objectives: ["Advanced Grammar Inversion", "Full Mock Practice", "Complete Fluency Review"] }
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

  // DAILY TASKS GENERATOR (MINIMUM 20, MAXIMUM 30 QUESTIONS TOTAL)
  async generateDailyTasks(level: string, month: number, day: number, targetLanguage?: string) {
    const userLanguage = targetLanguage || getSelectedLanguageName();

    try {
      return await withRetry(async (ai) => {
        const response = await ai.models.generateContent({
          model: "gemini-2.5-flash",
          contents: `Generate daily English practice tasks for a ${level} level student on Month ${month}, Day ${day}.
          CRITICAL CONSTRAINT: Generate BETWEEN 20 AND 30 PRACTICE QUESTIONS IN TOTAL (MINIMUM 20, MAXIMUM 30).
          
          Provide questions across these 4 categories (5 to 8 questions per category):
          1. 5 to 8 short sentences for speaking practice (with ${userLanguage} translation).
          2. 5 to 8 translation tasks (provide native ${userLanguage} sentence to translate into English).
          3. 5 to 8 sentence arrangement tasks (jumbled word array with correct sentence).
          4. 5 to 8 grammar multiple choice questions (MCQs with 4 options, answer, and explanation in ${userLanguage}).
          
          Return JSON format strictly:
          { 
            "sentences": [ 
              { "english": "I start my work early.", "translation": "मैं अपना काम जल्दी शुरू करता हूँ।" },
              { "english": "She speaks English fluently.", "translation": "वह धाराप्रवाह अंग्रेजी बोलती है।" },
              { "english": "We completed the project on time.", "translation": "हमने प्रोजेक्ट समय पर पूरा किया।" },
              { "english": "Are you ready for the meeting?", "translation": "क्या आप बैठक के लिए तैयार हैं?" },
              { "english": "Practice makes a person confident.", "translation": "अभ्यास व्यक्ति को आत्मविश्वासी बनाता है।" },
              { "english": "Clear goals bring better results.", "translation": "स्पष्ट लक्ष्य बेहतर परिणाम लाते हैं।" }
            ], 
            "translations": [ 
              { "translation": "आज का दिन बहुत अच्छा है।", "english": "Today is a very good day." },
              { "translation": "मुझे नई चीजें सीखना पसंद है।", "english": "I like learning new things." },
              { "translation": "क्या आप मेरी मदद कर सकते हैं?", "english": "Can you help me?" },
              { "translation": "वह हर दिन अभ्यास करता है।", "english": "He practices every day." },
              { "translation": "हम कल मिलेंगे।", "english": "We will meet tomorrow." },
              { "translation": "यह एक महत्वपूर्ण कार्य है।", "english": "This is an important task." }
            ],
            "arrangements": [
              { "jumbled": ["learning", "am", "English", "I"], "correct": "I am learning English", "translation": "मैं अंग्रेजी सीख रहा हूँ।" },
              { "jumbled": ["is", "great", "day", "a", "Today"], "correct": "Today is a great day", "translation": "आज एक बेहतरीन दिन है।" },
              { "jumbled": ["hard", "works", "every", "She", "day"], "correct": "She works hard every day", "translation": "वह हर दिन कड़ी मेहनत करती है।" },
              { "jumbled": ["us", "with", "Come", "now"], "correct": "Come with us now", "translation": "अब हमारे साथ आओ।" },
              { "jumbled": ["ready", "the", "for", "test", "Be"], "correct": "Be ready for the test", "translation": "परीक्षा के लिए तैयार रहें।" },
              { "jumbled": ["time", "save", "will", "This"], "correct": "This will save time", "translation": "इससे समय की बचत होगी।" }
            ],
            "mcqs": [ 
              { "question": "She ___ to office every day.", "options": ["go", "goes", "going", "gone"], "answer": "goes", "explanation": "Singular subject uses 'goes'.", "translation": "वह रोज दफ्तर जाती है।" },
              { "question": "They ___ completed the task yesterday.", "options": ["have", "had", "did", "was"], "answer": "had", "explanation": "Completed past event uses 'had'.", "translation": "उन्होंने कल काम पूरा कर लिया था।" },
              { "question": "I am good ___ English.", "options": ["in", "at", "on", "with"], "answer": "at", "explanation": "Preposition 'at' is used with skills.", "translation": "मैं अंग्रेजी में अच्छा हूँ।" },
              { "question": "Identify the adjective: 'It is a beautiful city.'", "options": ["It", "city", "beautiful", "is"], "answer": "beautiful", "explanation": "'Beautiful' describes the noun 'city'.", "translation": "विशेषण पहचानें:" },
              { "question": "Choose the correct sentence:", "options": ["He don't know", "He doesn't know", "He not know", "He isn't know"], "answer": "He doesn't know", "explanation": "Singular 'He' uses 'doesn't'.", "translation": "सही वाक्य चुनें:" },
              { "question": "We ___ waiting for your reply.", "options": ["is", "are", "was", "be"], "answer": "are", "explanation": "Plural subject 'We' uses 'are'.", "translation": "हम आपके जवाब का इंतजार कर रहे हैं।" }
            ]
          }`,
          config: { responseMimeType: "application/json" }
        });

        const parsed = safeJsonParse(response.text);
        const total = (parsed.sentences?.length || 0) + (parsed.translations?.length || 0) + (parsed.arrangements?.length || 0) + (parsed.mcqs?.length || 0);
        
        if (parsed && total >= 15) {
          return parsed;
        }
        throw new Error("Tasks count below required minimum");
      });
    } catch (error) {
      console.error("Daily Tasks Generation Error. Serving 24 Fallback Tasks.", error);
      return {
        sentences: [
          { english: "I practice English every single day.", translation: "मैं हर दिन अंग्रेजी का अभ्यास करता हूँ।" },
          { english: "Communication skills build confidence.", translation: "संचार कौशल आत्मविश्वास का निर्माण करते हैं।" },
          { english: "He works hard to achieve his goals.", translation: "वह अपने लक्ष्यों को पाने के लिए कड़ी मेहनत करता है।" },
          { english: "We are learning new vocabulary today.", translation: "हम आज नई शब्दावली सीख रहे हैं।" },
          { english: "Never give up on your dreams.", translation: "अपने सपनों को कभी मत छोड़ो।" },
          { english: "Clear communication solves many problems.", translation: "स्पष्ट बातचीत कई समस्याओं को हल करती है।" }
        ],
        translations: [
          { translation: "आपका दिन शुभ हो।", english: "Have a nice day." },
          { translation: "मैं अंग्रेजी में बात कर सकता हूँ।", english: "I can speak in English." },
          { translation: "वह बहुत प्रतिभाशाली है।", english: "She is very talented." },
          { translation: "क्या आप तैयार हैं?", english: "Are you ready?" },
          { translation: "सफलता अभ्यास से आती है।", english: "Success comes from practice." },
          { translation: "समय बहुत मूल्यवान है।", english: "Time is very valuable." }
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
          { question: "He ___ to market yesterday.", options: ["go", "went", "gone", "going"], answer: "went", explanation: "Past tense of 'go' is 'went'.", translation: "वह कल बाजार गया था।" },
          { question: "She is ___ than her sister.", options: ["tall", "taller", "tallest", "more tall"], answer: "taller", explanation: "Comparative degree uses 'taller'.", translation: "वह अपनी बहन से लंबी है।" },
          { question: "They ___ playing football now.", options: ["is", "are", "was", "be"], answer: "are", explanation: "Plural 'They' takes 'are'.", translation: "वे अभी फुटबॉल खेल रहे हैं।" },
          { question: "Find the noun: 'Honesty is the best policy.'", options: ["is", "best", "Honesty", "the"], answer: "Honesty", explanation: "'Honesty' is an abstract noun.", translation: "संज्ञा पहचानें:" },
          { question: "Choose the correct sentence:", options: ["She like ice cream", "She likes ice cream", "She liking ice cream", "She is like ice cream"], answer: "She likes ice cream", explanation: "Third-person singular takes 'likes'.", translation: "सही वाक्य चुनें:" },
          { question: "We ___ finished the assignment.", options: ["has", "have", "is", "was"], answer: "have", explanation: "Plural 'We' takes 'have' in present perfect.", translation: "हमने असाइनमेंट पूरा कर लिया है।" }
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

    return withRetry(async (ai) => {
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: `You are an AI English Tutor. Generate DAY ${dayNumber} learning content for category: "${category}" at "${level}" level in ${userLanguage}. Return JSON format.`,
        config: { responseMimeType: "application/json" }
      });
      const parsed = safeJsonParse(response.text);
      if (typeof window !== 'undefined' && parsed && (parsed.topic || parsed.vocabulary || parsed.explanation)) {
        try { localStorage.setItem(cacheKey, JSON.stringify(parsed)); } catch (e) {}
      }
      return parsed;
    });
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

    try {
      return await withRetry(async (ai) => {
        const historyPrompt = historyContext.length > 0 
          ? `RECENT CHAT HISTORY:\n${historyContext.join('\n')}\n` 
          : '';

        const nonce = Date.now() + Math.random().toString(36).substring(2, 7);

        const prompt = `You are HumnAi, a genuine, warm, witty, human friend chatting in English with a friend on WhatsApp.
        Session ID: ${nonce}

        ${historyPrompt}
        USER MESSAGE: "${sentence}"

        STRICT HUMANOID INSTRUCTIONS:
        1. NEVER output robotic clichés or teacher-like questions such as "What would you like to know about this?", "Tell me more about X", "How can I assist you?", or "That's interesting! What specific details...".
        2. REACT LIKE A REAL HUMAN: Share a personal opinion, anecdote, or natural friendly reaction to "${sentence}" first, then ask a natural follow-up question to keep the conversation going smoothly.
        3. EVALUATE MISTAKES:
           - If the user made a grammar/spelling mistake or spoke in ${userLanguage}:
             * "corrected": Provide the most natural, idiomatic English sentence.
             * "explanation": Explain clearly in ${userLanguage} what mistake was made and how to correct it.
           - If the sentence is already correct English:
             * "corrected": Keep the original sentence or a stylish native phrasing.
             * "explanation": Return empty string "".

        Return JSON strictly in this format:
        {
          "corrected": "Natural English sentence",
          "response": "Your friendly, casual human conversational reply in English",
          "translation": "${userLanguage} translation of user sentence",
          "explanation": "Mistake explanation in ${userLanguage} or empty string"
        }`;

        const response = await ai.models.generateContent({
          model: "gemini-2.5-flash",
          contents: prompt,
          config: { responseMimeType: "application/json" }
        });

        const rawText = response.text || "";
        const parsed = safeJsonParse(rawText);

        if (parsed && (parsed.response || parsed.corrected)) {
          return {
            corrected: parsed.corrected || sentence,
            response: parsed.response || rawText.trim(),
            translation: parsed.translation || sentence,
            explanation: parsed.explanation || ""
          };
        }

        return {
          corrected: sentence,
          response: rawText.trim() || `Oh cool! I was actually thinking about something similar today. How did that turn out for you?`,
          translation: sentence,
          explanation: ""
        };
      });
    } catch (error) {
      console.error("Gemini Chat API Error:", error);
      return {
        corrected: sentence,
        response: `Oh nice! That sounds pretty cool. How long have you been into that?`,
        translation: sentence,
        explanation: ""
      };
    }
  }
};
