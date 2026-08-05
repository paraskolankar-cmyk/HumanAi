import { GoogleGenAI } from "@google/genai";

// 1. LocalStorage se User ki Native Language read karne ka function
export function getSelectedLanguageName(): string {
  if (typeof window === 'undefined') return 'Hindi';
  
  const savedLang = localStorage.getItem('humnai_user_language') || localStorage.getItem('humnai_native_language') || 'hi';
  
  const languageMap: Record<string, string> = {
    hi: 'Hindi',
    bn: 'Bengali',
    mr: 'Marathi',
    te: 'Telugu',
    ta: 'Tamil',
    gu: 'Gujarati',
    kn: 'Kannada',
    ml: 'Malayalam',
    pa: 'Punjabi',
    en: 'English',
    ur: 'Urdu',
    as: 'Assamese',
    bho: 'Bhojpuri',
    or: 'Odia',
    es: 'Spanish',
    fr: 'French',
    de: 'German',
    ja: 'Japanese'
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

// Current Active SDK Instance Lene Ke Liye Helper
function getAiInstance(): GoogleGenAI {
  const apiKey = GEMINI_KEYS[currentKeyIndex] || process.env.GEMINI_API_KEY || "";
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
      
      // Status 429 / Rate Limit error aane par backup key par switch karein
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
    if (text?.includes("Rate exceeded")) {
      throw new Error("Rate limit exceeded. Please try again in a moment.");
    }
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
  async assessLevel(testAnswers: string) {
    return withRetry(async (ai) => {
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: `Assess the English level (Beginner, Intermediate, Advanced) based on these answers: ${testAnswers}. Return JSON with level and a brief explanation.`,
        config: {
          responseMimeType: "application/json",
        }
      });
      return safeJsonParse(response.text);
    });
  },

  async generateLearningPlan(level: string) {
    return withRetry(async (ai) => {
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: `Create a 12-month high-level English learning roadmap for a ${level} level student. 
        For each month, provide a theme and key learning objectives. 
        Return JSON format: { roadmap: [ { month: 1, theme: "", objectives: [] }, ... ] }`,
        config: {
          responseMimeType: "application/json",
        }
      });
      return safeJsonParse(response.text);
    });
  },

  async generateDailyTasks(level: string, month: number, day: number, targetLanguage?: string) {
    const userLanguage = targetLanguage || getSelectedLanguageName();

    return withRetry(async (ai) => {
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: `Generate daily English practice tasks for a ${level} level student on Month ${month}, Day ${day}.
        Total 30 questions:
        1. 10 short sentences for speaking practice (with ${userLanguage} translation).
        2. 10 translation tasks: Provide a sentence in ${userLanguage} and the student must know the English translation.
        3. 5 multiple-choice questions (MCQs) for grammar.
        4. 5 sentence arrangement (jumbled words) questions: Provide a sentence where words are jumbled, and the student must arrange them.
        
        For all items, provide:
        - The English text/answer.
        - The ${userLanguage} translation/question.
        - For MCQs, also provide 4 options and a brief explanation in ${userLanguage}.
        - For Sentence Arrangement, provide the jumbled words as a list.
        
        Return JSON format: { 
        "sentences": [ { "english": "", "translation": "" } ], 
        "translations": [ { "translation": "", "english": "" } ],
        "mcqs": [ { "question": "", "options": [], "answer": "", "explanation": "", "translation": "" } ],
        "arrangements": [ { "jumbled": [], "correct": "", "translation": "" } ]
        }`,
        config: {
          responseMimeType: "application/json",
        }
      });
      return safeJsonParse(response.text);
    });
  },

  // HIGHLY OPTIMIZED & CACHED COMPETITIVE EXAM CONTENT GENERATOR
  async getDailyLearningContent(category: string, level: string, dayNumber: number = 1, targetLanguage?: string) {
    const userLanguage = targetLanguage || getSelectedLanguageName();
    const cacheKey = `humnai_cache_module_${category}_day${dayNumber}_${userLanguage.toLowerCase()}`;

    // 1. LOCAL STORAGE CACHE CHECK (Zero Latency, Instant Load, No AI Quota Usage)
    if (typeof window !== 'undefined') {
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          if (parsed && (parsed.vocabulary || parsed.explanation || parsed.topic)) {
            return parsed;
          }
        } catch (e) {
          console.warn("Cache parse failed, generating fresh content...", e);
        }
      }
    }

    // 2. IF NOT CACHED -> CALL GEMINI AI WITH COMPETITIVE EXAM PROMPT
    return withRetry(async (ai) => {
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: `You are an AI English Tutor for Indian Competitive Exams (SSC CGL/CHSL, Banking IBPS/SBI, UPSC, NDA/CDS).
        Generate DAY ${dayNumber} learning content for category: "${category}" at "${level}" level.

        SOURCES/STYLE TO ADHERE TO:
        "Black Book of English Vocabulary", "SP Bakshi Objective General English", and "Plinth to Paramount by Neetu Singh".

        REQUIREMENTS BY CATEGORY:
        1. Topic: Create a Day ${dayNumber} specific competitive exam topic title.
        2. Content & Explanation: Provide a detailed, high-level explanation in English AND a complete translation in ${userLanguage}.
        
        3. Vocabulary Specific (If category is "Vocabulary" or "Synonyms & Antonyms"):
           - MUST PROVIDE MINIMUM 10 High-Frequency Exam Words/Idioms/Substitutions.
           - Each item MUST have:
             * word: English Word
             * meaning: Clear English meaning
             * translation: Native meaning in ${userLanguage}
             * example: A high-level competitive exam pattern example sentence
             * examNote: Year or exam info (e.g. "Repeated in SSC CGL 2021-2023")

        4. Verbs Specific (If category is "Verbs"):
           - Provide MINIMUM 10 Competitive Exam Verbs with all 4 forms:
             * v1: Base form
             * v2: Past form
             * v3: Past participle
             * v4: Present participle (-ing)
             * translation: Meaning in ${userLanguage}
             * example: Competitive exam error-spotting example sentence

        5. Noun, Pronoun, Voice, Narration, Tenses & Grammar Specific:
           - Provide 3-5 Critical Error-Spotting Rules.
           - Rule explanations in English and ${userLanguage}.
           - For Tenses: Clear formula/structure string in "tenseStructure".
           - 5-10 Exam Pattern Sentence Transformations / Examples.

        6. Practice Questions:
           - Provide EXACTLY 5-10 Competitive Exam Pattern MCQs (Spotting Errors or Fill in the blanks).
           - Question Text, Translation in ${userLanguage}, 4 Options, Correct Answer, and Detailed Explanation in ${userLanguage}.

        Return JSON format:
        {
          "topic": "Day ${dayNumber}: Topic Title",
          "explanation": "Detailed explanation in English",
          "explanationTranslation": "Explanation in ${userLanguage}",
          "rules": ["Rule 1", "Rule 2"],
          "vocabulary": [
            { "word": "Word", "meaning": "Meaning", "translation": "Native Translation", "example": "Sentence", "examNote": "SSC CGL 2023" }
          ],
          "synonymsAntonyms": [
            { "word": "Word", "type": "synonym/antonym", "target": "Target", "meaning": "Meaning", "translation": "Native", "example": "Sentence" }
          ],
          "nouns": [
            { "word": "Noun", "translation": "Native", "example": "Sentence" }
          ],
          "pronouns": [
            { "word": "Pronoun", "translation": "Native", "example": "Sentence" }
          ],
          "verbs": [
            { "v1": "v1", "v2": "v2", "v3": "v3", "v4": "v4", "translation": "Native", "example": "Sentence" }
          ],
          "voiceNarrationExamples": [
            { "original": "Active/Direct", "transformed": "Passive/Indirect", "translation": "Native" }
          ],
          "posItems": [
            { "word": "Word", "translation": "Native", "example": "Sentence" }
          ],
          "tenseStructure": "Structure Formula (If category is Tenses)",
          "examples": [
            { "english": "English sentence", "translation": "Translation in ${userLanguage}" }
          ],
          "questions": [
            {
              "id": 1,
              "question": "Question text",
              "translation": "Translation in ${userLanguage}",
              "options": ["Option A", "Option B", "Option C", "Option D"],
              "answer": "Correct Option",
              "explanation": "Detailed explanation in ${userLanguage}"
            }
          ]
        }`,
        config: {
          responseMimeType: "application/json",
        }
      });

      const parsed = safeJsonParse(response.text);

      // SAVE TO LOCAL STORAGE CACHE PERMANENTLY
      if (typeof window !== 'undefined' && parsed && (parsed.topic || parsed.vocabulary || parsed.explanation)) {
        try {
          localStorage.setItem(cacheKey, JSON.stringify(parsed));
        } catch (e) {
          console.warn("Storage quota full, skipping cache save", e);
        }
      }

      return parsed;
    });
  },

  async correctSentence(sentence: string, targetLanguage?: string) {
    const userLanguage = targetLanguage || getSelectedLanguageName();

    return withRetry(async (ai) => {
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: `You are an AI English Tutor. 
        The user said: "${sentence}".
        
        Tasks:
        1. If the user's input is in ${userLanguage} or any language other than English, translate it to natural, conversational English.
        2. If the user's input is in English but has grammatical errors, correct it.
        3. Provide a brief, friendly conversational response to the user's intent in English.
        4. Provide the meaning of the user's input in ${userLanguage}.
        5. Provide a clear explanation in ${userLanguage} about how to say the user's intent correctly in English. If they spoke in ${userLanguage}, explain the English translation. If they made a mistake in English, explain the grammar rule in ${userLanguage}.
        
        Return JSON with:
        {
          "corrected": "The natural English version of what the user wanted to say",
          "response": "Your friendly conversational reply in English",
          "translation": "The meaning of the user's input in ${userLanguage}",
          "explanation": "A helpful explanation in ${userLanguage} about the English structure/translation"
        }`,
        config: {
          responseMimeType: "application/json",
        }
      });
      return safeJsonParse(response.text);
    });
  }
};
