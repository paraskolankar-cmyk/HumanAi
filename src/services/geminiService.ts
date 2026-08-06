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
    try {
      return await withRetry(async (ai) => {
        const response = await ai.models.generateContent({
          model: "gemini-2.5-flash",
          contents: `Assess the English level (Beginner, Intermediate, Advanced) based on these answers: ${testAnswers}. Return JSON with level and a brief explanation.`,
          config: { responseMimeType: "application/json" }
        });
        const parsed = safeJsonParse(response.text);
        return parsed.level ? parsed : { level: "Intermediate", explanation: "Based on level assessment." };
      });
    } catch (e) {
      return { level: "Beginner", explanation: "Default starting level." };
    }
  },

  // FIXED 12-MONTH ROADMAP PLAN GENERATOR WITH GUARANTEED FALLBACK
  async generateLearningPlan(level: string) {
    try {
      return await withRetry(async (ai) => {
        const response = await ai.models.generateContent({
          model: "gemini-2.5-flash",
          contents: `Create a 12-month high-level English learning roadmap for a ${level} level student. 
          For each month (1 to 12), provide a theme and key learning objectives. 
          Return JSON format strictly: { "roadmap": [ { "month": 1, "theme": "", "objectives": [] }, ... ] }`,
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

      // GUARANTEED 12-MONTH FALLBACK ROADMAP FOR PRACTICE SECTION
      const defaultThemes = [
        { theme: "Foundations & Basics", objectives: ["Basic sentence formation", "Essential daily vocabulary", "Alphabet & Phonics rules"] },
        { theme: "Present & Past Tenses", objectives: ["Simple Present Tense usage", "Simple Past Tense usage", "Regular & Irregular verbs"] },
        { theme: "Future Tense & Modals", objectives: ["Future Tense structure", "Modals (Can, Could, Should)", "Daily routine practice"] },
        { theme: "Nouns, Pronouns & Adjectives", objectives: ["Types of Nouns", "Subject & Object Pronouns", "Descriptive Adjectives"] },
        { theme: "Verbs & Sentence Patterns", objectives: ["Verb Forms (V1 to V4)", "Subject-Verb Agreement", "Sentence Transformations"] },
        { theme: "Prepositions & Conjunctions", objectives: ["Prepositions of Place & Time", "Connecting Sentences", "Common Errors"] },
        { theme: "Voice Transformation", objectives: ["Active Voice Rules", "Passive Voice Rules", "Conversations in Passive Voice"] },
        { theme: "Direct & Indirect Narration", objectives: ["Direct Speech Rules", "Indirect Speech Conversion", "Reporting Verbs"] },
        { theme: "Advanced Vocabulary & Idioms", objectives: ["High-frequency Idioms", "Phrasal Verbs", "Contextual Vocabulary"] },
        { theme: "Reading & Error Spotting", objectives: ["Comprehension Practice", "Error Spotting Drills", "Sentence Rearrangement"] },
        { theme: "Conversational Fluency", objectives: ["Speaking without Hesitation", "Public Speaking Basics", "Professional Emails"] },
        { theme: "Mastery & Review", objectives: ["Advanced Grammar Inversion", "Complete Course Review", "Fluency Certification Practice"] }
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

  // HUMAN-LIKE CONVERSATIONAL CHAT RESPONSE (SUPPORT FOR POLYMORPHIC ARGS)
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
          ? `RECENT CHAT HISTORY FOR CONTEXT:\n${historyContext.join('\n')}\n` 
          : '';

        const response = await ai.models.generateContent({
          model: "gemini-2.5-flash",
          contents: `You are HumnAi, a warm, empathetic, witty, and human-like AI English Companion.
          
          ${historyPrompt}
          CURRENT USER INPUT: "${sentence}"

          HUMAN-LIKE CONVERSATION INSTRUCTIONS:
          1. Act like a real, supportive human friend having a natural conversation.
          2. Directly address, discuss, or answer the user's specific topic ("${sentence}").
          3. Ask engaging follow-up questions to keep the natural flow of conversation going.
          4. NEVER output generic or repetitive lines like "I understood you! Let's continue practicing".
          5. If the user's message had grammatical mistakes or was in ${userLanguage}, provide the refined English sentence in "corrected" and a brief helpful tip in "explanation" in ${userLanguage}.

          Return JSON strictly in this format:
          {
            "corrected": "Refined English sentence or original if correct",
            "response": "Your thoughtful, natural, human-like dynamic answer discussing '${sentence}'",
            "translation": "${userLanguage} translation of user sentence",
            "explanation": "Brief English grammar or vocabulary tip in ${userLanguage}"
          }`,
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
          response: rawText.trim() || `That's really interesting! What else would you like to discuss about "${sentence}"?`,
          translation: sentence,
          explanation: ""
        };
      });
    } catch (error) {
      console.error("Gemini Chat API Error:", error);
      return {
        corrected: sentence,
        response: `That sounds fascinating! Tell me more about what you think regarding "${sentence}".`,
        translation: sentence,
        explanation: ""
      };
    }
  }
};
