import { GoogleGenAI } from "@google/genai";

// 1. User ki profile se Selected Native Language read karne ka function
export function getSelectedLanguageName(): string {
  if (typeof window === 'undefined') return 'Hindi';
  
  // Profile.tsx me saved keys ('humnai_user_language' ya 'humnai_native_language') check karein
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

  // Agar direct code hai (e.g. 'hi') toh map se name lega, agar direct name saved hai (e.g. 'Marathi') toh wahi return karega
  return languageMap[savedLang.toLowerCase()] || savedLang || 'Hindi';
}

// 2. Multiple Keys Load Karein (Primary + Backup)
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

// Key Limit Overflow Hone Par Next Backup Key Par Switch Karne Ka Logic
function rotateToBackupKey(): void {
  if (GEMINI_KEYS.length <= 1) return;
  const prevIndex = currentKeyIndex;
  currentKeyIndex = (currentKeyIndex + 1) % GEMINI_KEYS.length;
  console.warn(
    `⚠️ Primary API Limit Exceeded (Key #${prevIndex + 1}). Switched to Backup Key #${currentKeyIndex + 1}`
  );
}

// Retry & Failover Helper Function
async function withRetry<T>(fn: (ai: GoogleGenAI) => Promise<T>, maxRetries = GEMINI_KEYS.length || 3): Promise<T> {
  let lastError: any;
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      const activeAi = getAiInstance();
      return await fn(activeAi);
    } catch (error: any) {
      lastError = error;
      const errorMessage = error?.message || String(error);
      
      // Agar 429 Status Code ya Rate Exceeded Error mile
      if (errorMessage.includes("429") || errorMessage.includes("Rate exceeded") || errorMessage.includes("Quota")) {
        rotateToBackupKey(); // Next API key par switch karein
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
    contents: "", // Placeholder
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
    // Agar targetLanguage pass na ho toh profile ki selected language use karein
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

  async getDailyLearningContent(category: string, level: string, targetLanguage?: string) {
    // User ki selected language get karein
    const userLanguage = targetLanguage || getSelectedLanguageName();

    return withRetry(async (ai) => {
      const date = new Date().toDateString();
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: `You are an AI English Tutor. Generate a daily learning lesson for the category: "${category}" at "${level}" level for today (${date}).
        
        Requirements:
        1. Topic: Select a specific, relevant topic for today.
        2. Content: Provide a detailed explanation of the topic in English, with a translation in ${userLanguage}.
        3. Vocabulary Specific: If category is "Vocabulary", provide exactly 10 words. Each word must have:
           - word: The English word
           - meaning: English meaning
           - translation: Meaning in ${userLanguage}
           - example: An example sentence in English
        4. Synonyms & Antonyms Specific: If category is "Synonyms & Antonyms", provide exactly 5 synonyms pairs and 5 antonyms pairs. Each item must have:
           - word: The main English word
           - type: "synonym" or "antonym"
           - target: The synonym or antonym word
           - meaning: English meaning of the main word
           - translation: Meaning in ${userLanguage}
           - example: An example sentence in English
        5. Noun & Pronoun Specific: If category is "Noun & Pronoun", provide:
           - explanation: A clear definition of what Nouns and Pronouns are.
           - nouns: 10 example nouns with translation and example.
           - pronouns: 10 example pronouns with translation and example.
        6. Verbs Specific: If category is "Verbs", provide 10 verbs. Each verb must have:
           - v1: Base form
           - v2: Past simple
           - v3: Past participle
           - v4: Present participle (-ing)
           - translation: Meaning in ${userLanguage}
           - example: An example sentence using one of the forms.
        7. Voice & Narration Specific: If category is "Voice & Narration", provide:
           - explanation: A clear explanation of Active/Passive Voice or Direct/Indirect Narration rules.
           - rules: Key rules for transformation.
           - examples: 10 pairs of examples (e.g., Active vs Passive or Direct vs Indirect) with translations.
        8. Other Parts of Speech Specific: If category is "Other Parts of Speech", focus on ONE of these: Adjective, Conjunction, Article, Preposition, or Adverb. Provide:
           - explanation: Definition and usage rules for the selected part of speech.
           - items: 10 examples of the selected part of speech. Each item must have:
             - word: The English word/phrase
             - translation: Meaning in ${userLanguage}
             - example: An example sentence in English
        9. Expert Grammar Specific: If category is "Expert Grammar", focus on ONE of these: Infinitive, Participle, Inversion, or Mood. Provide:
           - explanation: Definition and usage rules for the selected topic.
           - items: 10 examples/sentences demonstrating the concept. Each item must have:
             - word: The English sentence/phrase
             - translation: Meaning in ${userLanguage}
             - example: A brief note on the structure used.
        10. Tenses Specific: If category is "Tenses", focus on ONE specific tense structure (e.g., Present Continuous) with its formula, usage, and examples.
        11. Practice Questions: Provide exactly 10 practice questions related to this topic/vocabulary/synonyms/antonyms/verbs/voice/narration/parts of speech/expert grammar.
        12. Question Format: Each question should have:
           - Question text (English)
           - Translation (${userLanguage})
           - 4 Options
           - Correct Answer
           - Explanation in ${userLanguage}
        
        Return JSON format:
        {
          "topic": "Topic Name (e.g., Prepositions of Time)",
          "explanation": "Detailed explanation in English",
          "explanationTranslation": "Explanation in ${userLanguage}",
          "rules": ["Rule 1", "Rule 2"],
          "vocabulary": [
            { "word": "Word", "meaning": "English Meaning", "translation": "Native Meaning", "example": "Example sentence" }
          ],
          "synonymsAntonyms": [
            { "word": "Word", "type": "synonym/antonym", "target": "TargetWord", "meaning": "Meaning", "translation": "Native", "example": "Example" }
          ],
          "nouns": [
            { "word": "Word", "translation": "Native", "example": "Example" }
          ],
          "pronouns": [
            { "word": "Word", "translation": "Native", "example": "Example" }
          ],
          "verbs": [
            { "v1": "go", "v2": "went", "v3": "gone", "v4": "going", "translation": "Native", "example": "Example" }
          ],
          "voiceNarrationExamples": [
            { "original": "Active/Direct sentence", "transformed": "Passive/Indirect sentence", "translation": "Native translation" }
          ],
          "posItems": [
            { "word": "Word", "translation": "Native", "example": "Example" }
          ],
          "tenseStructure": "Formula/Structure (only if category is Tenses)",
          "examples": [
            { "english": "Example sentence", "translation": "Translation in ${userLanguage}" }
          ],
          "questions": [
            {
              "id": 1,
              "question": "Question text",
              "translation": "Translation",
              "options": ["A", "B", "C", "D"],
              "answer": "Correct Option",
              "explanation": "Why this is correct in ${userLanguage}"
            }
          ]
        }`,
        config: {
          responseMimeType: "application/json",
        }
      });
      return safeJsonParse(response.text);
    });
  },

  async correctSentence(sentence: string, targetLanguage?: string) {
    // User ki selected language get karein
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
