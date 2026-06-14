import { Router } from "express";
import { GoogleGenAI, Type } from "@google/genai";

const router = Router();

// Check if Gemini API key is configured with a valid value
function isGeminiApiKeyConfigured(): boolean {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return false;
  const cleanKey = key.trim();
  if (
    cleanKey === "" ||
    cleanKey.toLowerCase().includes("your_") ||
    cleanKey.toLowerCase().includes("placeholder") ||
    cleanKey === "undefined" ||
    cleanKey === "null"
  ) {
    return false;
  }
  return true;
}

// Gemini API Server-Side Routes (Lazy Initialized to ensure process.env.GEMINI_API_KEY is fully loaded)
let aiClient: GoogleGenAI | null = null;

function getGeminiClient(): GoogleGenAI {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    aiClient = new GoogleGenAI({
      apiKey: apiKey || "",
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build'
        }
      }
    });
  }
  return aiClient;
}

const ai = {
  get models() {
    return getGeminiClient().models;
  }
};

async function withRetry<T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> {
  let lastError: any;
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;
      const errorMessage = error?.message || String(error);
      if ((errorMessage.includes("429") || errorMessage.includes("Rate exceeded")) && i < maxRetries - 1) {
        const delay = Math.pow(2, i) * 2000;
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      throw error;
    }
  }
  throw lastError;
}

function safeJsonParse(text: string | undefined): any {
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

router.post("/assess-level", async (req, res) => {
  const { testAnswers } = req.body;
  
  if (!isGeminiApiKeyConfigured()) {
    return res.json({
      level: "Intermediate",
      explanation: "Aapke answers ke mutabik aapka levels Intermediate hai. Aap basic english samajh sakte hain aur likh sakte hain, bas thodi practice aur confidence ki zarurat hai!"
    });
  }

  try {
    const result = await withRetry(async () => {
      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: `Assess the English level (Beginner, Intermediate, Advanced) based on these answers: ${testAnswers}. Return JSON with level and a brief explanation.`,
        config: {
          responseMimeType: "application/json",
        }
      });
      return safeJsonParse(response.text);
    });
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/learning-plan", async (req, res) => {
  const { level } = req.body;

  if (!isGeminiApiKeyConfigured()) {
    return res.json({
      roadmap: [
        { month: 1, theme: "Foundations & Vocabulary building", objectives: ["Learn 100+ basic daily verbs", "Understand subject-verb agreement"] },
        { month: 2, theme: "Daily Conversational Practice", objectives: ["Practice greeting people confidently", "Small talk about your day, hobbies, etc."] },
        { month: 3, theme: "Speaking and Pronunciation", objectives: ["Form short correct sentences in English", "Master word stresses and sound symbols"] },
        { month: 4, theme: "Mastering Basic Tenses", objectives: ["Deep dive into Simple Present and Continuous", "Frame active questions effortlessly"] },
        { month: 5, theme: "Listening & Accents Comprehension", objectives: ["Understand basic English audio clips", "Repeat exercises to mirror accent"] },
        { month: 6, theme: "Writing & Composition Skills", objectives: ["Learn to draft simple daily professional emails", "Formulate compound and complex sentences"] },
        { month: 7, theme: "Past and Future Tenses", objectives: ["Master Past Simple, Continuous, and Future forms", "Tell stories about your past memories"] },
        { month: 8, theme: "Office and Workplace English", objectives: ["Learn professional phrases and vocabulary", "Participate mock business calls"] },
        { month: 9, theme: "Expert Grammar Structures", objectives: ["Understand Modal verbs, Active vs Passive voice", "Implement advanced conjunctions"] },
        { month: 10, theme: "Public Speaking & Presentations", objectives: ["Reduce pause noise and filler words", "Speak non-stop for 2 minutes on random topics"] },
        { month: 11, theme: "Advanced Vocabulary & Idioms", objectives: ["Integrate 50+ popular English idioms in speech", "Differentiate synonyms & antonyms"] },
        { month: 12, theme: "Confidence and Daily Fluency", objectives: ["Engage in non-stop fluent discussions", "Express thoughts clearly without native-transation pause"] }
      ]
    });
  }

  try {
    const result = await withRetry(async () => {
      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: `Create a 12-month high-level English learning roadmap for a ${level} level student. 
        For each month, provide a theme and key learning objectives. 
        Return JSON format: { roadmap: [ { month: 1, theme: "", objectives: [] }, ... ] }`,
        config: {
          responseMimeType: "application/json",
        }
      });
      return safeJsonParse(response.text);
    });
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/daily-tasks", async (req, res) => {
  const { level, month, day, targetLanguage = "Hindi" } = req.body;

  if (!isGeminiApiKeyConfigured()) {
    return res.json({
      sentences: [
        { english: "Hello, how are you doing today?", translation: "नमस्ते, आप आज कैसे हैं?" },
        { english: "I am learning English with HumnAi.", translation: "मैं HumnAi के साथ अंग्रेजी सीख रहा हूँ।" },
        { english: "Can you please pass the water bottle?", translation: "क्या आप कृपया पानी की बोतल बढ़ा सकते हैं?" },
        { english: "It is a beautiful day outside.", translation: "बाहर मौसम बहुत अच्छा है।" },
        { english: "I will call you back in five minutes.", translation: "मैं आपको पांच मिनट में वापस फोन करता हूँ।" },
        { english: "Where is the nearest railway station?", translation: "सबसे पास का रेलवे स्टेशन कहाँ है?" },
        { english: "I need to buy some fresh vegetables.", translation: "मुझे कुछ ताज़ी सब्जियाँ खरीदनी हैं।" },
        { english: "Thank you so much for your help.", translation: "आपकी मदद के लिए बहुत-बहुत धन्यवाद।" },
        { english: "What time does the lesson start?", translation: "पाठ कितने बजे शुरू होता है?" },
        { english: "Have a wonderful day ahead!", translation: "आपका आगे का दिन शानदार रहे!" }
      ],
      translations: [
        { translation: "वह प्रतिदिन सुबह दौड़ने जाता है।", english: "He goes for a run every morning." },
        { translation: "मुझे चाय पीना पसंद है।", english: "I like to drink tea." },
        { translation: "क्या आप मेरी मदद कर सकते हैं? ", english: "Can you help me?" },
        { translation: "आज बहुत गर्मी है।", english: "It is very hot today." },
        { translation: "हम कल सिनेमा देखने जा रहे हैं।", english: "We are going to the cinema tomorrow." },
        { translation: "कृपया यहाँ बैठिये।", english: "Please sit here." },
        { translation: "दरवाजा बंद कर दो।", english: "Close the door." },
        { translation: "वह बहुत अच्छा खाना बनाती है।", english: "She cooks very well." },
        { translation: "आप कहाँ रहते हैं?", english: "Where do you live?" },
        { translation: "यह पुस्तक मेरी है।", english: "This book is mine." }
      ],
      mcqs: [
        { question: "She ___ (go) to the market yesterday.", options: ["go", "goes", "went", "going"], answer: "went", explanation: "चूंकि कार्य कल (yesterday) हुआ था, हम past tense 'went' का उपयोग करते हैं।", translation: "वह कल बाज़ार गई थी।" },
        { question: "Neither of the two candidates ___ selected.", options: ["was", "were", "are", "have"], answer: "was", explanation: "'Neither' के साथ हमेशा singular verb (was) का प्रयोग किया जाता है।", translation: "दोनों में से कोई भी उम्मीदवार नहीं चुना गया।" },
        { question: "They ___ playing football since 2 o'clock.", options: ["are", "have been", "has been", "were"], answer: "have been", explanation: "चूंकि निश्चित समय 'since 2 o'clock' दिया है, यहाँ Present Perfect Continuous tense 'have been' का प्रयोग होगा।", translation: "वे 2 बजे से फुटबॉल खेल रहे हैं।" },
        { question: "I cannot agree ___ your proposal.", options: ["to", "with", "at", "by"], answer: "to", explanation: "किसी प्रस्ताव (proposal) के साथ सहमत होने के लिए 'agree to' का प्रयोग होता है, जबकि किसी व्यक्ति के साथ 'agree with' का।", translation: "मैं आपके प्रस्ताव से सहमत नहीं हो सकता।" },
        { question: "He is senior ___ me in the office.", options: ["than", "to", "from", "with"], answer: "to", explanation: "Senior, junior, superior आदि के बाद 'than' के स्थान पर 'to' का प्रयोग होता है।", translation: "वह कार्यालय में मुझसे वरिष्ठ हैं।" }
      ],
      arrangements: [
        { jumbled: ["English", "I", "learning", "am"], correct: "I am learning English", translation: "मैं अंग्रेजी सीख रहा हूँ।" },
        { jumbled: ["book", "reading", "she", "is", "a"], correct: "She is reading a book", translation: "वह एक किताब पढ़ रही है।" },
        { jumbled: ["live", "Delhi", "in", "they"], correct: "They live in Delhi", translation: "वे दिल्ली में रहते हैं।" },
        { jumbled: ["goes", "morning", "for", "he", "a", "walk"], correct: "He goes for a morning walk", translation: "वह सुबह की सैर पर जाता है।" },
        { jumbled: ["heavy", "is", "raining", "it", "how"], correct: "How heavy it is raining", translation: "कितनी तेज़ बारिश हो रही है।" }
      ]
    });
  }

  try {
    const result = await withRetry(async () => {
      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: `Generate daily English practice tasks for a ${level} level student on Month ${month}, Day ${day}.
        Total 30 questions:
        1. 10 short sentences for speaking practice (with ${targetLanguage} translation).
        2. 10 translation tasks: Provide a sentence in ${targetLanguage} and the student must know the English translation.
        3. 5 multiple-choice questions (MCQs) for grammar.
        4. 5 sentence arrangement (jumbled words) questions: Provide a sentence where words are jumbled, and the student must arrange them.
        
        For all items, provide:
        - The English text/answer.
        - The ${targetLanguage} translation/question.
        - For MCQs, also provide 4 options and a brief explanation in ${targetLanguage}.
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
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/daily-learning", async (req, res) => {
  const { category, level, targetLanguage = "Hindi" } = req.body;

  if (!isGeminiApiKeyConfigured()) {
    // Default fallback responses based on category
    const fallbackResult: any = {
      topic: `${category} Lesson`,
      explanation: `This is a comprehensive lesson covering "${category}" for "${level}" level.`,
      explanationTranslation: `यह "${level}" स्तर के लिए "${category}" को कवर करने वाला एक व्यापक पाठ है।`,
      rules: ["Rule 1: Practice everyday and speak out loud.", "Rule 2: Read, listen, and speak - consistency is the key to fluency!"],
      questions: [
        {
          id: 1,
          question: "Identify the correct English word for 'किताब'.",
          translation: "'किताब' के लिए सही अंग्रेजी शब्द पहचानें।",
          options: ["Pen", "Pencil", "Book", "Eraser"],
          answer: "Book",
          explanation: "'किताब' को अंग्रेजी में 'Book' कहते हैं।"
        },
        {
          id: 2,
          question: "Which of these is a verb?",
          translation: "इनमें से कौन सी एक क्रिया (verb) है?",
          options: ["Beautiful", "Successfully", "Run", "Happiness"],
          answer: "Run",
          explanation: "Run (दौड़ना) एक क्रिया है जो किसी कार्य को दर्शाती है।"
        }
      ]
    };

    if (category === "Vocabulary") {
      fallbackResult.topic = "Common Daily Action Verbs";
      fallbackResult.vocabulary = [
        { word: "Achieve", meaning: "To successfully bring about or reach a desired objective", translation: "हासिल करना", example: "With hard work, you can achieve your goals." },
        { word: "Acknowledge", meaning: "Accept or admit the existence or truth of", translation: "स्वीकार करना", example: "He acknowledged his mistake." },
        { word: "Acquire", meaning: "Buy or obtain for oneself", translation: "प्राप्त करना", example: "You will acquire English skills over time." },
        { word: "Adapt", meaning: "Make suitable for a new use or purpose", translation: "अनुकूल बनाना", example: "We must adapt to changing situations." },
        { word: "Analyze", meaning: "Examine methodically and in detail", translation: "विश्लेषण करना", example: "We need to analyze the language levels." },
        { word: "Clarify", meaning: "Make a statement or situation less confused", translation: "स्पष्ट करना", example: "Could you clarify this rule?" },
        { word: "Collaborate", meaning: "Work jointly on an activity or project", translation: "सहयोग करना", example: "Let's collaborate to practice speaking." },
        { word: "Deliver", meaning: "Bring or hand over to the proper recipient", translation: "वितरण करना / पहुँचाना", example: "They deliver good results." },
        { word: "Encourage", meaning: "Give support, confidence, or hope to", translation: "प्रोत्साहित करना", example: "My tutor encourages me to speak English." },
        { word: "Enhance", meaning: "Intensify, increase, or further improve the quality", translation: "सुधारना / बढ़ाना", example: "Use this app to enhance your vocabulary." }
      ];
    } else if (category === "Synonyms & Antonyms") {
      fallbackResult.topic = "Essential Academic Synonyms & Antonyms";
      fallbackResult.synonymsAntonyms = [
        { word: "Happy", type: "synonym", target: "Joyful", meaning: "Feeling or showing pleasure", translation: "खुश", example: "She was happy to see her test results." },
        { word: "Sad", type: "antonym", target: "Happy", meaning: "Feeling small or unhappy", translation: "उदास", example: "He felt sad about the bad weather." },
        { word: "Begin", type: "synonym", target: "Start", meaning: "To initiate an action", translation: "शुरू करना", example: "Let's begin the daily workout." },
        { word: "Finish", type: "antonym", target: "Begin", meaning: "To bring something to an end", translation: "समाप्त करना", example: "I will finish the lesson soon." },
        { word: "Smart", type: "synonym", target: "Intelligent", meaning: "Quick-witted or clean", translation: "होशियार", example: "He is a very smart boy." }
      ];
    } else if (category === "Noun & Pronoun") {
      fallbackResult.topic = "Nouns and Pronouns Basics";
      fallbackResult.nouns = [
        { word: "Teacher", translation: "शिक्षक", example: "The teacher helped us learn english." },
        { word: "City", translation: "शहर", example: "Delhi is a very big city." }
      ];
      fallbackResult.pronouns = [
        { word: "He", translation: "वह (पुरुष)", example: "He is my best friend." },
        { word: "They", translation: "वे / उन्होंने", example: "They are coming to our house tonight." }
      ];
    } else if (category === "Verbs") {
      fallbackResult.topic = "Regular & Irregular Verb Forms";
      fallbackResult.verbs = [
        { v1: "go", v2: "went", v3: "gone", v4: "going", translation: "जाना", example: "He went to school." },
        { v1: "write", v2: "wrote", v3: "written", v4: "writing", translation: "लिखना", example: "I am writing a letter." },
        { v1: "speak", v2: "spoke", v3: "spoken", v4: "speaking", translation: "बोलना", example: "She spoke English fluently." }
      ];
    } else if (category === "Voice & Narration") {
      fallbackResult.topic = "Understanding Active & Passive Voice";
      fallbackResult.voiceNarrationExamples = [
        { original: "Rama killed Ravana. (Active)", transformed: "Ravana was killed by Rama. (Passive)", translation: "राम ने रावण को मारा। / रावण राम द्वारा मारा गया।" }
      ];
    } else if (category === "Tenses") {
      fallbackResult.topic = "The Present Continuous Tense";
      fallbackResult.tenseStructure = "Subject + is/am/are + Verb-ing (e.g., I am running)";
      fallbackResult.examples = [
        { english: "She is reading a book.", translation: "वह एक किताब पढ़ रही है।" },
        { english: "They are playing soccer.", translation: "वे सॉकर खेल रहे हैं।" }
      ];
    } else {
      fallbackResult.topic = "Basic English Grammar Lesson";
      fallbackResult.posItems = [
        { word: "Beautiful", translation: "सुंदर (Adjective)", example: "This is a beautiful park." },
        { word: "Quickly", translation: "तेज़ी से (Adverb)", example: "Please come quickly." }
      ];
    }

    return res.json(fallbackResult);
  }

  try {
    const result = await withRetry(async () => {
      const date = new Date().toDateString();
      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: `You are an AI English Tutor. Generate a daily learning lesson for the category: "${category}" at "${level}" level for today (${date}).
        
        Requirements:
        1. Topic: Select a specific, relevant topic for today.
        2. Content: Provide a detailed explanation of the topic in English, with a translation in ${targetLanguage}.
        3. Vocabulary Specific: If category is "Vocabulary", provide exactly 10 words. Each word must have:
           - word: The English word
           - meaning: English meaning
           - translation: Meaning in ${targetLanguage}
           - example: An example sentence in English
        4. Synonyms & Antonyms Specific: If category is "Synonyms & Antonyms", provide exactly 5 synonyms pairs and 5 antonyms pairs. Each item must have:
           - word: The main English word
           - type: "synonym" or "antonym"
           - target: The synonym or antonym word
           - meaning: English meaning of the main word
           - translation: Meaning in ${targetLanguage}
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
           - translation: Meaning in ${targetLanguage}
           - example: An example sentence using one of the forms.
        7. Voice & Narration Specific: If category is "Voice & Narration", provide:
           - explanation: A clear explanation of Active/Passive Voice or Direct/Indirect Narration rules.
           - rules: Key rules for transformation.
           - examples: 10 pairs of examples (e.g., Active vs Passive or Direct vs Indirect) with translations.
        8. Other Parts of Speech Specific: If category is "Other Parts of Speech", focus on ONE of these: Adjective, Conjunction, Article, Preposition, or Adverb. Provide:
           - explanation: Definition and usage rules for the selected part of speech.
           - items: 10 examples of the selected part of speech. Each item must have:
             - word: The English word/phrase
             - translation: Meaning in ${targetLanguage}
             - example: An example sentence in English
        9. Expert Grammar Specific: If category is "Expert Grammar", focus on ONE of these: Infinitive, Participle, Inversion, or Mood. Provide:
           - explanation: Definition and usage rules for the selected topic.
           - items: 10 examples/sentences demonstrating the concept. Each item must have:
             - word: The English sentence/phrase
             - translation: Meaning in ${targetLanguage}
             - example: A brief note on the structure used.
        10. Tenses Specific: If category is "Tenses", focus on ONE specific tense structure (e.g., Present Continuous) with its formula, usage, and examples.
        11. Practice Questions: Provide exactly 10 practice questions related to this topic/vocabulary/synonyms/antonyms/verbs/voice/narration/parts of speech/expert grammar.
        12. Question Format: Each question should have:
           - Question text (English)
           - Translation (${targetLanguage})
           - 4 Options
           - Correct Answer
           - Explanation in ${targetLanguage}
        
        Return JSON format:
        {
          "topic": "Topic Name (e.g., Prepositions of Time)",
          "explanation": "Detailed explanation in English",
          "explanationTranslation": "Explanation in ${targetLanguage}",
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
            { "english": "Example sentence", "translation": "Translation in ${targetLanguage}" }
          ],
          "questions": [
            {
              "id": 1,
              "question": "Question text",
              "translation": "Translation",
              "options": ["A", "B", "C", "D"],
              "answer": "Correct Option",
              "explanation": "Why this is correct in ${targetLanguage}"
            }
          ]
        }`,
        config: {
          responseMimeType: "application/json",
        }
      });
      return safeJsonParse(response.text);
    });
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/correct-sentence", async (req, res) => {
  const { sentence, targetLanguage = "Hindi" } = req.body;

  if (!isGeminiApiKeyConfigured()) {
    return res.json({
      corrected: "I would like to practice speaking English with you.",
      response: "That's wonderful! Speaking is indeed the fastest path to mastering a language. Let's practice now! Tell me, what did you do today?",
      translation: "मैं आपके साथ अंग्रेजी बोलने का अभ्यास करना चाहता हूँ।",
      explanation: "Aapka sentence lagbhag sahi tha, standard structure mein 'I want to practice speaking English with you' bole, ya more polite tarike se 'I would like to practice...'"
    });
  }

  try {
    const result = await withRetry(async () => {
      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: `You are an AI English Tutor. 
        The user said: "${sentence}".
        
        Tasks:
        1. If the user's input is in ${targetLanguage} or any language other than English, translate it to natural, conversational English.
        2. If the user's input is in English but has grammatical errors, correct it.
        3. Provide a brief, friendly conversational response to the user's intent in English.
        4. Provide the meaning of the user's input in ${targetLanguage}.
        5. Provide a clear explanation in ${targetLanguage} about how to say the user's intent correctly in English. If they spoke in ${targetLanguage}, explain the English translation. If they made a mistake in English, explain the grammar rule in ${targetLanguage}.
        
        Return JSON with:
        {
          "corrected": "The natural English version of what the user wanted to say",
          "response": "Your friendly conversational reply in English",
          "translation": "The meaning of the user's input in ${targetLanguage}",
          "explanation": "A helpful explanation in ${targetLanguage} about the English structure/translation"
        }`,
        config: {
          responseMimeType: "application/json",
        }
      });
      return safeJsonParse(response.text);
    });
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/translate-trial", async (req, res) => {
  const { nativeLang } = req.body;
  const defaultTrialTranslations = {
    title: "Free Trial Expired!",
    message: "Your 24-hour free trial has ended. Upgrade to Pro to unlock unlimited AI conversations and all learning modules.",
    button: "Get Pro Plan",
    secondary: "Maybe Later"
  };

  if (!nativeLang || nativeLang.toLowerCase() === "english" || !isGeminiApiKeyConfigured()) {
    return res.json(defaultTrialTranslations);
  }

  try {
    const result = await withRetry(async () => {
      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: `Translate the following English strings into ${nativeLang}. 
        Return a JSON object with these keys:
        - title: "Free Trial Expired!"
        - message: "Your 24-hour free trial has ended. Upgrade to Pro to unlock unlimited AI conversations and all learning modules."
        - button: "Get Pro Plan"
        - secondary: "Maybe Later"
        `,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              message: { type: Type.STRING },
              button: { type: Type.STRING },
              secondary: { type: Type.STRING },
            }
          }
        }
      });
      return safeJsonParse(response.text);
    });
    res.json(result);
  } catch (err: any) {
    console.warn("Trial translation fallback activated. English default strings used.");
    res.json(defaultTrialTranslations);
  }
});

router.post("/translate-onboarding", async (req, res) => {
  const { nativeLanguage } = req.body;
  const defaultOnboardingTranslations = {
    q2Title: "What do you do?",
    q2Sub: "Tell us about your current status.",
    q3Title: "How much English can you speak?",
    q3Sub: "Select your current proficiency level.",
    finishTitle: "All Set!",
    finishMessage: "Pareshan n ho mai HumnAi apka dost english practice me apki madad karuga .",
    next: "Next",
    back: "Back",
    finish: "Finish",
    specify: "Please specify...",
    options: {
      school: "School",
      college: "College",
      work: "Work",
      business: "Business",
      other: "Other",
      words: "1-2 Words bol lete hai",
      sentences: "1-2 Sentences bol lete hai",
      normal: "Normal day-to-day bol lete hai par confident nahi hai",
      advance: "Advance level tak"
    }
  };

  if (!nativeLanguage || nativeLanguage.toLowerCase() === "english" || !isGeminiApiKeyConfigured()) {
    return res.json(defaultOnboardingTranslations);
  }

  try {
    const result = await withRetry(async () => {
      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: `Translate the following English strings into ${nativeLanguage}. 
        Return a JSON object with these keys:
        - q2Title: "What do you do?"
        - q2Sub: "Tell us about your current status."
        - q3Title: "How much English can you speak?"
        - q3Sub: "Select your current proficiency level."
        - finishTitle: "All Set!"
        - finishMessage: "Pareshan n ho mai HumnAi apka dost english practice me apki madad karuga ."
        - next: "Next"
        - back: "Back"
        - finish: "Finish"
        - specify: "Please specify..."
        - options: {
            school: "School",
            college: "College",
            work: "Work",
            business: "Business",
            other: "Other",
            words: "1-2 Words bol lete hai",
            sentences: "1-2 Sentences bol lete hai",
            normal: "Normal day-to-day bol lete hai par confident nahi hai",
            advance: "Advance level tak"
          }
        `,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              q2Title: { type: Type.STRING },
              q2Sub: { type: Type.STRING },
              q3Title: { type: Type.STRING },
              q3Sub: { type: Type.STRING },
              finishTitle: { type: Type.STRING },
              finishMessage: { type: Type.STRING },
              next: { type: Type.STRING },
              back: { type: Type.STRING },
              finish: { type: Type.STRING },
              specify: { type: Type.STRING },
              options: {
                type: Type.OBJECT,
                properties: {
                  school: { type: Type.STRING },
                  college: { type: Type.STRING },
                  work: { type: Type.STRING },
                  business: { type: Type.STRING },
                  other: { type: Type.STRING },
                  words: { type: Type.STRING },
                  sentences: { type: Type.STRING },
                  normal: { type: Type.STRING },
                  advance: { type: Type.STRING }
                }
              }
            }
          }
        }
      });
      return safeJsonParse(response.text);
    });
    res.json(result);
  } catch (err: any) {
    console.warn("Onboarding translation fallback activated. Hinglish default strings used.");
    res.json(defaultOnboardingTranslations);
  }
});

export default router;
