import { db } from './index.ts';
import { plans, assessmentQuestions, modules, lessons } from './schema.ts';
import { count } from 'drizzle-orm';

export async function seedDatabase() {
  try {
    console.log("Checking database seeds...");

    // Seed plans if empty
    const [plansCountResult] = await db.select({ value: count() }).from(plans);
    if (plansCountResult.value === 0) {
      console.log("Seeding plans...");
      await db.insert(plans).values([
        { id: 'trial_1day', name: '1 Day Free Trial', price: 0.00, interval: 'day' },
        { id: 'trial_7day', name: '7 Days Trial', price: 99.00, interval: 'week' },
        { id: 'monthly', name: 'Pro Monthly', price: 499.00, interval: 'month' },
        { id: 'yearly', name: 'Pro Yearly', price: 4999.00, interval: 'year' },
      ]);
    }

    // Seed assessment questions if empty
    const [assessmentCountResult] = await db.select({ value: count() }).from(assessmentQuestions);
    if (assessmentCountResult.value === 0) {
      console.log("Seeding assessment questions...");
      const initialQuestions = [
        {
          question: "Which sentence is grammatically correct?",
          options_json: JSON.stringify(["He go to school.", "He goes to school.", "He going to school."]),
          answer: "He goes to school."
        },
        {
          question: "What is the synonym of 'Happy'?",
          options_json: JSON.stringify(["Sad", "Joyful", "Angry"]),
          answer: "Joyful"
        },
        {
          question: "Complete the sentence: 'I ___ been waiting for you for an hour.'",
          options_json: JSON.stringify(["has", "have", "am"]),
          answer: "have"
        }
      ];
      await db.insert(assessmentQuestions).values(initialQuestions);
    }

    // Seed modules if empty
    const [modulesCountResult] = await db.select({ value: count() }).from(modules);
    if (modulesCountResult.value === 0) {
      console.log("Seeding modules and lessons...");
      const initialModules = [
        { id: 'vocab', title: 'Vocabulary', icon: 'Book', color: 'bg-blue-50 text-blue-600', count: '250+ Words', description: "Expand your word bank with essential English vocabulary for daily use and professional settings." },
        { id: 'tenses', title: 'Tenses', icon: 'Type', color: 'bg-purple-50 text-purple-600', count: '12 Lessons', description: "Master the 12 English tenses to express time accurately in your conversations." },
        { id: 'voice', title: 'Active/Passive', icon: 'Mic2', color: 'bg-emerald-50 text-emerald-600', count: '8 Lessons', description: "Learn how to shift focus in sentences using Active and Passive voice correctly." },
        { id: 'grammar', title: 'Grammar', icon: 'Hash', color: 'bg-orange-50 text-orange-600', count: '15 Lessons', description: "Deep dive into English grammar rules, sentence structure, and common pitfalls." },
        { id: 'comprehension', title: 'Comprehension', icon: 'FileText', color: 'bg-pink-50 text-pink-600', count: '20 Exercises', description: "Improve your reading and listening skills with real-world English texts and audio." },
        { id: 'parts', title: 'Parts of Speech', icon: 'Layers', color: 'bg-indigo-50 text-indigo-600', count: '10 Lessons', description: "Understand the building blocks of English: Nouns, Verbs, Adjectives, and more." },
      ];
      await db.insert(modules).values(initialModules);

      const initialLessons = [
        { 
          id: 'vocab_greetings',
          module_id: 'vocab',
          title: "Common Greetings", 
          duration: "10 min", 
          content_json: JSON.stringify([
            { word: "Hello / Hi", meaning: "A standard way to greet someone.", example: "Hello! How are you today?" },
            { word: "Good Morning", meaning: "A greeting used before noon.", example: "Good morning, did you sleep well?" },
            { word: "Nice to meet you", meaning: "A polite way to greet someone you are meeting for the first time.", example: "Hi Rahul, nice to meet you!" },
            { word: "How's it going?", meaning: "An informal way to ask how someone is.", example: "Hey! How's it going with your project?" },
            { word: "Take care", meaning: "A friendly way to say goodbye while wishing someone well.", example: "See you later, take care!" }
          ])
        },
        { 
          id: 'tenses_present',
          module_id: 'tenses',
          title: "Present Simple vs Continuous", 
          duration: "15 min", 
          content_json: JSON.stringify([
            { word: "Present Simple", meaning: "Used for habits, facts, and general truths.", example: "I drink coffee every morning." },
            { word: "Present Continuous", meaning: "Used for actions happening right now.", example: "I am drinking coffee right now." }
          ])
        }
      ];
      await db.insert(lessons).values(initialLessons);
    }

    console.log("Seeding check completed successfully!");
  } catch (error) {
    console.error("Failed to seed database:", error);
  }
}
