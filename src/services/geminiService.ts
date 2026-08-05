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
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    const cleanText = jsonMatch ? jsonMatch[0] : text;
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
        contents: `Create a 12-month high-level English learning roadmap for a ${level} level student. 
        For each month, provide a theme and key learning objectives. 
        Return JSON format: { roadmap: [ { month: 1, theme: "", objectives: [] }, ... ] }`,
        config: { responseMimeType: "application/json" }
      });
      return safeJsonParse(response.text);
    });
  },

  async generateDailyTasks(level: string, month: number, day: number, targetLanguage?: string) {
    const userLanguage = targetLanguage || getSelectedLanguageName();

    try {
      return await withRetry(async (ai) => {
        const response = await ai.models.generateContent({
          model: "gemini-2.5-flash",
          contents: `Generate daily English practice tasks for a ${level} level student on Month ${month}, Day ${day}.
          Provide:
          1. Short sentences for speaking practice.
          2. Translation tasks.
          3. Grammar MCQs.
          4. Sentence arrangement tasks.
          
          Return JSON format strictly:
          { 
            "sentences": [ { "english": "Hello, how are you?", "translation": "नमस्ते, आप कैसे हैं?" } ], 
            "translations": [ { "translation": "मैं अंग्रेजी सीख रहा हूँ।", "english": "I am learning English." } ],
            "mcqs": [ { "question": "She ___ to school daily.", "options": ["go", "goes", "going", "gone"], "answer": "goes", "explanation": "Third person singular takes 'goes'.", "translation": "वह रोज स्कूल जाती है।" } ],
            "arrangements": [ { "jumbled": ["learning", "am", "English", "I"], "correct": "I am learning English", "translation": "मैं अंग्रेजी सीख रहा हूँ।" } ]
          }`,
          config: { responseMimeType: "application/json" }
        });

        const parsed = safeJsonParse(response.text);
        if (parsed && (parsed.sentences || parsed.mcqs)) {
          return parsed;
        }
        throw new Error("Invalid Tasks Structure");
      });
    } catch (error) {
      console.error("Daily Tasks Generation Error. Serving Fallback Tasks.", error);
      return {
        sentences: [
          { english: "I am learning English every day.", translation: "मैं हर दिन अंग्रेजी सीख रहा हूँ।" },
          { english: "Practice makes a person perfect.", translation: "अभ्यास इंसान को बेहतर बनाता है।" }
        ],
        translations: [
          { translation: "आपका नाम क्या है?", english: "What is your name?" },
          { translation: "मैं आज बहुत खुश हूँ।", english: "I am very happy today." }
        ],
        mcqs: [
          {
            question: "Choose the correct sentence:",
            options: ["He go to market", "He goes to market", "He going to market", "He gone to market"],
            answer: "He goes to market",
            explanation: "Singular subject 'He' uses 'goes' in simple present tense.",
            translation: "सही वाक्य चुनें:"
          }
        ],
        arrangements: [
          {
            jumbled: ["a", "good", "student", "He", "is"],
            correct: "He is a good student",
            translation: "वह एक अच्छा छात्र है।"
          }
        ]
      };
    }
  },

  // CACHED LEARNING CONTENT GENERATOR (Flexibly structured)
  async getDailyLearningContent(category: string, level: string, dayNumber: number = 1, targetLanguage?: string) {
    const userLanguage = targetLanguage || getSelectedLanguageName();
    const cacheKey = `humnai_cache_module_${category}_day${dayNumber}_${userLanguage.toLowerCase()}`;

    // 1. LOCAL STORAGE CACHE CHECK
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

    // 2. IF NOT CACHED -> CALL GEMINI AI
    return withRetry(async (ai) => {
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: `You are an AI English Tutor. Generate DAY ${dayNumber} learning content for category: "${category}" at "${level}" level.

        SOURCES/STYLE TO ADHERE TO:
        Standard reference materials like "Black Book of English Vocabulary", "SP Bakshi Objective General English", and "Plinth to Paramount by Neetu Singh".

        REQUIREMENTS BY CATEGORY:
        1. Topic: Create a Day ${dayNumber} specific topic title.
        2. Content & Explanation: Provide a detailed explanation in English AND a complete translation in ${userLanguage}.
        
        3. Vocabulary Specific (If category is "Vocabulary" or "Synonyms & Antonyms"):
           - Provide relevant, high-quality Words/Pairs for today's lesson.
           - Each item MUST have:
             * word: English Word
             * meaning: Clear English meaning
             * translation: Native meaning in ${userLanguage}
             * example: A practice example sentence

        4. Verbs Specific (If category is "Verbs"):
           - Provide Verbs with all 4 forms:
             * v1: Base form
             * v2: Past form
             * v3: Past participle
             * v4: Present participle (-ing)
             * translation: Meaning in ${userLanguage}
             * example: Example sentence

        5. Noun, Pronoun, Voice, Narration, Tenses & Grammar Specific:
           - Provide important Grammar Rules in "rules".
           - Rule explanations in English and ${userLanguage}.
           - For Tenses: Clear formula string in "tenseStructure".
           - Example Sentences.

        6. Practice Questions:
           - Provide MCQs related to the lesson.
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

    try {
      return await withRetry(async (ai) => {
        const response = await ai.models.generateContent({
          model: "gemini-2.5-flash",
          contents: `You are an AI English Tutor. 
          The user said: "${sentence}".
          
          Tasks:
          1. Translate to natural English if non-English.
          2. Correct grammatical errors.
          3. Provide a friendly conversational reply in English.
          4. Provide meaning of user's intent in ${userLanguage}.
          5. Provide explanation in ${userLanguage} about grammar or structure.
          
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

        const parsed = safeJsonParse(response.text);
        if (!parsed || (!parsed.response && !parsed.corrected)) {
          return {
            corrected: sentence,
            response: response.text || "That sounds interesting! Tell me more.",
            translation: sentence,
            explanation: `Keep practicing in ${userLanguage}!`
          };
        }
        return parsed;
      });
    } catch (error) {
      console.error("Gemini Chat API Error:", error);
      return {
        corrected: sentence,
        response: "I understood you! Let's continue practicing English together.",
        translation: sentence,
        explanation: "Keep practicing daily!"
      };
    }
  }
};
