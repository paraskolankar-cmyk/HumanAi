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
    // Clean markdown codeblocks if present (e.g. ```json ... ```)
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

  async getDailyLearningContent(category: string, level: string, dayNumber: number = 1, targetLanguage?: string) {
    const userLanguage = targetLanguage || getSelectedLanguageName();
    const cacheKey = `humnai_cache_module_${category}_day${dayNumber}_${userLanguage.toLowerCase()}`;

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

        REQUIREMENTS BY CATEGORY:
        1. Topic: Create a Day ${dayNumber} specific topic title.
        2. Content & Explanation: Provide a detailed explanation in English AND a complete translation in ${userLanguage}.
        
        3. Vocabulary Specific (If category is "Vocabulary" or "Synonyms & Antonyms"):
           - Provide Words/Pairs with English Word, Meaning, ${userLanguage} Translation, and Example sentence.

        4. Verbs Specific (If category is "Verbs"):
           - Provide Verbs with v1, v2, v3, v4, ${userLanguage} translation, and example sentence.

        5. Noun, Pronoun, Voice, Narration, Tenses & Grammar Specific:
           - Provide 3-5 Important Grammar Rules in "rules", formula in "tenseStructure", and Example Sentences.

        6. Practice Questions:
           - Provide 5 MCQs with Question Text, Translation in ${userLanguage}, 4 Options, Correct Answer, and Explanation.

        Return JSON format.`,
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

  // DYNAMIC & REAL-TIME AI CHAT RESPONSE FIX
  async correctSentence(sentence: string, targetLanguage?: string) {
    const userLanguage = targetLanguage || getSelectedLanguageName();

    try {
      return await withRetry(async (ai) => {
        const response = await ai.models.generateContent({
          model: "gemini-2.5-flash",
          contents: `You are an empathetic, highly intelligent AI English Tutor named HumnAi.
          The user sent this message in AI Chat: "${sentence}".

          YOUR GOAL:
          1. Understand what the user wants to discuss or ask (e.g. machine learning, daily talk, grammar question, etc.).
          2. Give a direct, naturally engaging, and helpful response in English that directly answers/continues their topic.
          3. If the user's sentence had grammatical errors or was written in ${userLanguage}, provide a corrected/natural English sentence in "corrected".
          4. Provide the meaning in ${userLanguage} in "translation".
          5. Provide a helpful grammar/learning note in ${userLanguage} in "explanation".

          CRITICAL RULE:
          - DO NOT output repetitive generic sentences like "I understood you! Let's continue practicing".
          - "response" MUST BE A DYNAMIC, THOUGHTFUL ANSWER TO USER'S SPECIFIC STATEMENT ("${sentence}").

          Return JSON strictly in this format:
          {
            "corrected": "Corrected English version or original if already correct",
            "response": "Your thoughtful dynamic answer discussing ${sentence}",
            "translation": "${userLanguage} translation of user's sentence",
            "explanation": "Brief English grammar or vocabulary tip in ${userLanguage}"
          }`,
          config: { responseMimeType: "application/json" }
        });

        const text = response.text || "";
        const parsed = safeJsonParse(text);

        if (parsed && (parsed.response || parsed.corrected)) {
          return {
            corrected: parsed.corrected || sentence,
            response: parsed.response || text,
            translation: parsed.translation || sentence,
            explanation: parsed.explanation || ""
          };
        }

        // If JSON parse failed, use raw text directly as conversational response
        return {
          corrected: sentence,
          response: text.trim() || `That's great! Let's talk more about ${sentence}.`,
          translation: sentence,
          explanation: ""
        };
      });
    } catch (error) {
      console.error("Gemini Chat API Error:", error);
      return {
        corrected: sentence,
        response: `That sounds interesting! What specific details about ${sentence} would you like to discuss?`,
        translation: sentence,
        explanation: ""
      };
    }
  }
};
