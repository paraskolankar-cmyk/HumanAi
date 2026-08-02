import { GoogleGenAI } from "@google/genai";

// LocalStorage se User ki Native Language read karne ka function
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

const GEMINI_KEYS = [
  process.env.GEMINI_API_KEY,
  process.env.VITE_PRIMARY_GEMINI_KEY,
  process.env.VITE_BACKUP_GEMINI_KEY
].filter((key): key is string => Boolean(key) && key.trim().length > 0);

let currentKeyIndex = 0;

function getAiInstance(): GoogleGenAI {
  const apiKey = GEMINI_KEYS[currentKeyIndex] || process.env.GEMINI_API_KEY || "";
  return new GoogleGenAI({ apiKey });
}

function rotateToBackupKey(): void {
  if (GEMINI_KEYS.length <= 1) return;
  currentKeyIndex = (currentKeyIndex + 1) % GEMINI_KEYS.length;
}

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
        await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, i)));
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

    // Local Storage Cache Check for instant loading
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
        contents: `You are an AI English Tutor. Generate DAY ${dayNumber} learning content for category: "${category}" at "${level}" level.

        KNOWLEDGE BASE & CONTENT QUALITY:
        Use concepts, vocabulary, and grammar structures from standard references like "Black Book of English Vocabulary", "SP Bakshi Objective General English", and "Plinth to Paramount by Neetu Singh".

        REQUIREMENTS:
        1. Topic: Create a clear, specific topic name for Day ${dayNumber}.
        2. Content: Provide a detailed explanation in English and a translation in ${userLanguage}.
        
        3. Vocabulary Specific (If category is "Vocabulary" or "Synonyms & Antonyms"):
           - MUST PROVIDE EXACTLY 10 High-Quality Words.
           - Each item MUST contain:
             * word: The English Word
             * meaning: Clear English meaning
             * translation: Native meaning in ${userLanguage}
             * example: A natural practice sentence

        4. Verbs Specific (If category is "Verbs"):
           - MUST PROVIDE EXACTLY 10 Verbs with 4 forms:
             * v1: Base form
             * v2: Past form
             * v3: Past participle
             * v4: Present participle (-ing)
             * translation: Meaning in ${userLanguage}
             * example: Example sentence

        5. Noun, Pronoun, Voice, Narration, Tenses & Grammar Specific:
           - Provide 3-5 Important Grammar Rules.
           - For Tenses: Formula/structure string in "tenseStructure".
           - 5-10 Example sentences with translations in ${userLanguage}.

        6. Practice Questions:
           - Provide EXACTLY 5 MCQs.
           - Question Text, Translation in ${userLanguage}, 4 Options, Correct Answer, and Detailed Explanation in ${userLanguage}.

        Return JSON format:
        {
          "topic": "Day ${dayNumber}: Topic Title",
          "explanation": "Detailed explanation in English",
          "explanationTranslation": "Explanation in ${userLanguage}",
          "rules": ["Rule 1", "Rule 2"],
          "vocabulary": [
            { "word": "Word", "meaning": "Meaning", "translation": "Native Translation", "example": "Sentence" }
          ],
          "synonymsAntonyms": [
            { "word": "Word", "type": "synonym/antonym", "target": "Target", "meaning": "Meaning", "translation": "Native", "example": "Sentence" }
          ],
          "nouns": [ { "word": "Noun", "translation": "Native", "example": "Sentence" } ],
          "pronouns": [ { "word": "Pronoun", "translation": "Native", "example": "Sentence" } ],
          "verbs": [ { "v1": "v1", "v2": "v2", "v3": "v3", "v4": "v4", "translation": "Native", "example": "Sentence" } ],
          "voiceNarrationExamples": [ { "original": "Active/Direct", "transformed": "Passive/Indirect", "translation": "Native" } ],
          "posItems": [ { "word": "Word", "translation": "Native", "example": "Sentence" } ],
          "tenseStructure": "Structure Formula (if category is Tenses)",
          "examples": [ { "english": "English sentence", "translation": "Translation in ${userLanguage}" } ],
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

  async correctSentence(sentence: string, targetLanguage?: string) {
    const userLanguage = targetLanguage || getSelectedLanguageName();

    return withRetry(async (ai) => {
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: `Correct or translate this sentence: "${sentence}" into conversational English with explanations in ${userLanguage}.`,
        config: { responseMimeType: "application/json" }
      });
      return safeJsonParse(response.text);
    });
  }
};
