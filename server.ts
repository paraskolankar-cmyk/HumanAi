import express from "express";
import { GoogleGenAI, Type } from "@google/genai";
import { createServer as createViteServer } from "vite";
import { createServer as createHttpServer } from "http";
import { Server } from "socket.io";
import path from "path";
import fs from "fs";
import Stripe from "stripe";
import Razorpay from "razorpay";
import crypto from "crypto";
import helmet from "helmet";
import cors from "cors";
import bcrypt from "bcryptjs"; // Hashing package imported

const dbPath = process.env.NODE_ENV === 'production' ? '/tmp/humanai.db' : 'humanai.db';

// Fallback Pure JS SQLite mock engine for Serverless Vercel Node
class PureJSStatement {
  constructor(private sql: string, private db: any) {}
  run(...args: any[]) { return this.db.executeRun(this.sql, args); }
  get(...args: any[]) { return this.db.executeGet(this.sql, args); }
  all(...args: any[]) { return this.db.executeAll(this.sql, args); }
}

class PureJSDB {
  private filePath: string;
  public data: any;

  constructor(dbPath: string) {
    this.filePath = dbPath.replace(/\.db$/, '.json');
    // Generating static secure hashes for fallback mock data
    const salt = bcrypt.genSaltSync(10);
    const defaultPasswordHash = bcrypt.hashSync("password123", salt);

    this.data = {
      users: [
        { id: 1, email: "admin@humnai.com", password: defaultPasswordHash, name: "HumnAi Admin", mobile: "+91 99999 88888", level: "Advanced", is_pro: 1, is_admin: 1 },
        { id: 2, email: "amit.sharma@gmail.com", password: defaultPasswordHash, name: "Amit Sharma", mobile: "+91 98765 43210", level: "Beginner", is_pro: 0, is_admin: 0, onboarding_json: JSON.stringify({ nativeLanguage: "Hindi" }), progress_json: JSON.stringify([{ day: 1, score: 85 }]) },
        { id: 3, email: "priya.patel@yahoo.com", password: defaultPasswordHash, name: "Priya Patel", mobile: "+91 91234 56789", level: "Intermediate", is_pro: 1, is_admin: 0, onboarding_json: JSON.stringify({ nativeLanguage: "Gujarati" }), progress_json: JSON.stringify([{ day: 1, score: 90 }, { day: 2, score: 95 }]) },
        { id: 4, email: "rahul.verma@outlook.com", password: defaultPasswordHash, name: "Rahul Verma", mobile: "+91 88888 77777", level: "Intermediate", is_pro: 0, is_admin: 0, onboarding_json: JSON.stringify({ nativeLanguage: "Hindi" }) },
        { id: 5, email: "sneha.reddy@gmail.com", password: defaultPasswordHash, name: "Sneha Reddy", mobile: "+91 77777 66666", level: "Advanced", is_pro: 1, is_admin: 0, onboarding_json: JSON.stringify({ nativeLanguage: "Telugu" }) }
      ],
      chat_messages: [],
      payments: [],
      plans: [],
      modules: [],
      lessons: [],
      assessment_questions: []
    };
    this.load();
  }

  private load() {
    try {
      if (fs.existsSync(this.filePath)) {
        const loaded = JSON.parse(fs.readFileSync(this.filePath, 'utf-8'));
        if (loaded.users && loaded.users.length > 0) {
          const mergedUsers = [...this.data.users];
          loaded.users.forEach((u: any) => {
            const idx = mergedUsers.findIndex(existing => existing.email === u.email);
            if (idx >= 0) {
              mergedUsers[idx] = { ...mergedUsers[idx], ...u };
            } else {
              mergedUsers.push(u);
            }
          });
          loaded.users = mergedUsers;
        }
        this.data = { ...this.data, ...loaded };
      }
    } catch (e: any) {
      console.error("PureJSDB: Failed to load data from", this.filePath, e.message);
    }
  }

  private save() {
    try {
      const dir = path.dirname(this.filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this.filePath, JSON.stringify(this.data, null, 2), 'utf-8');
    } catch (e: any) {
      console.error("PureJSDB: Failed to save data to", this.filePath, e.message);
    }
  }

  exec(sql: string) {
    return { success: true };
  }

  prepare(sql: string) {
    return new PureJSStatement(sql, this);
  }

  private executeCount(sql: string) {
    const match = sql.match(/SELECT\s+COUNT\(\*\)\s+as\s+count\s+FROM\s+(\w+)/i);
    if (match) {
      const table = match[1].toLowerCase();
      const list = this.data[table] || [];
      return { count: list.length };
    }
    return { count: 0 };
  }

  private executeSum(sql: string) {
    const list = this.data.payments || [];
    const total = list
      .filter((p: any) => p.status === 'Success')
      .reduce((sum: number, p: any) => sum + (p.amount || 0), 0);
    return { total };
  }

  public executeRun(sql: string, args: any[]) {
    // 1. INSERT INTO
    const insertMatch = sql.match(/INSERT\s+INTO\s+(\w+)\s*\(([^)]+)\)/i);
    if (insertMatch) {
      const table = insertMatch[1].toLowerCase();
      const colStr = insertMatch[2];
      const columns = colStr.split(',').map(c => c.trim().toLowerCase());
      
      const record: Record<string, any> = {};
      if (['users', 'chat_messages', 'payments', 'assessment_questions'].includes(table)) {
        const list = this.data[table] || [];
        const maxId = list.reduce((max: number, item: any) => (item.id && item.id > max) ? item.id : max, 0);
        record.id = maxId + 1;
      }
      
      columns.forEach((col, idx) => {
        record[col] = args[idx];
      });
      
      if (!this.data[table]) {
        this.data[table] = [];
      }
      this.data[table].push(record);
      this.save();
      return { changes: 1, lastInsertRowid: record.id || 0 };
    }

    // 2. UPDATE
    const updateMatch = sql.match(/UPDATE\s+(\w+)\s+SET\s+(.*?)\s+WHERE\s+(\w+)\s*=\s*\?/i);
    if (updateMatch) {
      const table = updateMatch[1].toLowerCase();
      const setClause = updateMatch[2];
      const whereKey = updateMatch[3].toLowerCase();
      
      const setCols = setClause.split(',').map(s => s.split('=')[0].trim().toLowerCase());
      const whereVal = args[args.length - 1];
      
      const list = this.data[table] || [];
      let changes = 0;
      
      list.forEach((item: any) => {
        const itemWhereVal = item[whereKey] !== undefined ? item[whereKey] : item[whereKey === 'user_email' ? 'user_email' : whereKey];
        if (String(itemWhereVal) === String(whereVal)) {
          setCols.forEach((col, idx) => {
            item[col] = args[idx];
          });
          changes++;
        }
      });
      
      if (changes > 0) {
        this.save();
      }
      return { changes };
    }

    // 3. DELETE
    const deleteMatch = sql.match(/DELETE\s+FROM\s+(\w+)\s+WHERE\s+(\w+)\s*=\s*\?/i);
    if (deleteMatch) {
      const table = deleteMatch[1].toLowerCase();
      const key = deleteMatch[2].toLowerCase();
      const val = args[0];
      
      const originalLength = (this.data[table] || []).length;
      if (this.data[table]) {
        this.data[table] = this.data[table].filter((item: any) => {
          const itemVal = item[key] !== undefined ? item[key] : item[key === 'user_email' ? 'user_email' : key];
          return String(itemVal) !== String(val);
        });
      }
      
      const changes = originalLength - (this.data[table] || []).length;
      if (changes > 0) {
        this.save();
      }
      return { changes };
    }

    return { changes: 0 };
  }

  public executeGet(sql: string, args: any[]) {
    if (sql.includes("COUNT(*)")) {
      return this.executeCount(sql);
    }
    if (sql.includes("SUM(amount)")) {
      return this.executeSum(sql);
    }
    const results = this.executeAll(sql, args);
    return results && results.length > 0 ? results[0] : null;
  }

  public executeAll(sql: string, args: any[]) {
    if (sql.includes("PRAGMA table_info")) {
      return [
        { name: 'id' },
        { name: 'name' },
        { name: 'email' },
        { name: 'password' },
        { name: 'mobile' },
        { name: 'level' },
        { name: 'is_pro' },
        { name: 'is_admin' },
        { name: 'progress_json' },
        { name: 'onboarding_json' }
      ];
    }

    // 1. SELECT * FROM <table> WHERE <key> = ?
    const matchWithWhere = sql.match(/SELECT\s+.*?\s+FROM\s+(\w+)\s+WHERE\s+(\w+)\s*=\s*\?/i);
    if (matchWithWhere) {
      const table = matchWithWhere[1].toLowerCase();
      const key = matchWithWhere[2].toLowerCase();
      const val = args[0];
      let list = this.data[table] || [];
      
      list = list.filter((item: any) => {
        const itemVal = item[key] !== undefined ? item[key] : item[key === 'user_email' ? 'user_email' : key];
        return String(itemVal).toLowerCase() === String(val).toLowerCase();
      });
      return list;
    }

    // 2. JOIN query in stats
    if (sql.includes("JOIN users")) {
      const list = this.data.payments || [];
      return list.map((p: any) => {
        const u = (this.data.users || []).find((user: any) => user.id === p.user_id);
        return {
          ...p,
          user_name: u ? u.name : 'Anonymous'
        };
      });
    }

    // 3. SELECT * FROM <table>
    const matchAll = sql.match(/SELECT\s+.*?\s+FROM\s+(\w+)/i);
    if (matchAll) {
      const table = matchAll[1].toLowerCase();
      return this.data[table] || [];
    }

    return [];
  }
}

let db: any;
try {
  if (process.env.VERCEL === "1" || process.env.NOW_REGION) {
    throw new Error("Serverless environment detected, bypassing better-sqlite3 dynamic load");
  }
  const { default: DatabaseClass } = await import("better-sqlite3");
  db = new DatabaseClass(dbPath);
  console.log("better-sqlite3 initialized successfully");
} catch (e: any) {
  console.warn("Using PureJS fallback database layer because:", e.message);
  db = new PureJSDB(dbPath);
}

const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null;
const razorpay = process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET 
  ? new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET,
    })
  : null;

// Initialize DB with password column
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    email TEXT UNIQUE,
    password TEXT,
    mobile TEXT,
    level TEXT DEFAULT 'Beginner',
    is_pro INTEGER DEFAULT 0,
    is_admin INTEGER DEFAULT 0,
    progress_json TEXT,
    onboarding_json TEXT
  );
`);

// Migration Management
try {
  const tableInfo = db.prepare("PRAGMA table_info(users)").all() as any[];
  const hasPassword = tableInfo.some(col => col.name === 'password');
  if (!hasPassword) {
    db.exec("ALTER TABLE users ADD COLUMN password TEXT");
    // Seed initial hash for fallback systems if columns were dynamically updated
    const salt = bcrypt.genSaltSync(10);
    const mockHash = bcrypt.hashSync("password123", salt);
    try {
      db.prepare("UPDATE users SET password = ? WHERE password IS NULL").run(mockHash);
    } catch {}
  }
  const hasOnboarding = tableInfo.some(col => col.name === 'onboarding_json');
  if (!hasOnboarding) {
    db.exec("ALTER TABLE users ADD COLUMN onboarding_json TEXT");
  }
  const hasMobile = tableInfo.some(col => col.name === 'mobile');
  if (!hasMobile) {
    db.exec("ALTER TABLE users ADD COLUMN mobile TEXT");
  }
  const hasAdmin = tableInfo.some(col => col.name === 'is_admin');
  if (!hasAdmin) {
    db.exec("ALTER TABLE users ADD COLUMN is_admin INTEGER DEFAULT 0");
  }
} catch (e) {
  console.error("Migration failed", e);
}

db.exec(`
  CREATE TABLE IF NOT EXISTS chat_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_email TEXT,
    role TEXT,
    text TEXT,
    correction TEXT,
    translation TEXT,
    explanation TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    amount REAL,
    currency TEXT,
    status TEXT,
    stripe_session_id TEXT,
    date TEXT
  );
  CREATE TABLE IF NOT EXISTS plans (
    id TEXT PRIMARY KEY,
    name TEXT,
    price REAL,
    interval TEXT
  );
  CREATE TABLE IF NOT EXISTS modules (
    id TEXT PRIMARY KEY,
    title TEXT,
    icon TEXT,
    color TEXT,
    count TEXT,
    description TEXT
  );
  CREATE TABLE IF NOT EXISTS lessons (
    id TEXT PRIMARY KEY,
    module_id TEXT,
    title TEXT,
    duration TEXT,
    content_json TEXT,
    FOREIGN KEY(module_id) REFERENCES modules(id)
  );
  CREATE TABLE IF NOT EXISTS assessment_questions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    question TEXT,
    options_json TEXT,
    answer TEXT
  );
`);

// Seed data management
const plansCount = db.prepare("SELECT COUNT(*) as count FROM plans").get() as any;
if (plansCount.count === 0) {
  db.prepare("INSERT INTO plans (id, name, price, interval) VALUES (?, ?, ?, ?)").run('trial_1day', '1 Day Free Trial', 0.00, 'day');
  db.prepare("INSERT INTO plans (id, name, price, interval) VALUES (?, ?, ?, ?)").run('trial_7day', '7 Days Trial', 99.00, 'week');
  db.prepare("INSERT INTO plans (id, name, price, interval) VALUES (?, ?, ?, ?)").run('monthly', 'Pro Monthly', 499.00, 'month');
  db.prepare("INSERT INTO plans (id, name, price, interval) VALUES (?, ?, ?, ?)").run('yearly', 'Pro Yearly', 4999.00, 'year');
}

const assessmentCount = db.prepare("SELECT COUNT(*) as count FROM assessment_questions").get() as any;
if (assessmentCount.count === 0) {
  const initialQuestions = [
    {
      question: "Which sentence is grammatically correct?",
      options: ["He go to school.", "He goes to school.", "He going to school."],
      answer: "He goes to school."
    },
    {
      question: "What is the synonym of 'Happy'?",
      options: ["Sad", "Joyful", "Angry"],
      answer: "Joyful"
    },
    {
      question: "Complete the sentence: 'I ___ been waiting for you for an hour.'",
      options: ["has", "have", "am"],
      answer: "have"
    }
  ];
  const insertQuestion = db.prepare("INSERT INTO assessment_questions (question, options_json, answer) VALUES (?, ?, ?)");
  initialQuestions.forEach(q => insertQuestion.run(q.question, JSON.stringify(q.options), q.answer));
}

const modulesCount = db.prepare("SELECT COUNT(*) as count FROM modules").get() as any;
if (modulesCount.count === 0) {
  const initialModules = [
    { id: 'vocab', title: 'Vocabulary', icon: 'Book', color: 'bg-blue-50 text-blue-600', count: '250+ Words', description: "Expand your word bank with essential English vocabulary for daily use and professional settings." },
    { id: 'tenses', title: 'Tenses', icon: 'Type', color: 'bg-purple-50 text-purple-600', count: '12 Lessons', description: "Master the 12 English tenses to express time accurately in your conversations." },
    { id: 'voice', title: 'Active/Passive', icon: 'Mic2', color: 'bg-emerald-50 text-emerald-600', count: '8 Lessons', description: "Learn how to shift focus in sentences using Active and Passive voice correctly." },
    { id: 'grammar', title: 'Grammar', icon: 'Hash', color: 'bg-orange-50 text-orange-600', count: '15 Lessons', description: "Deep dive into English grammar rules, sentence structure, and common pitfalls." },
    { id: 'comprehension', title: 'Comprehension', icon: 'FileText', color: 'bg-pink-50 text-pink-600', count: '20 Exercises', description: "Improve your reading and listening skills with real-world English texts and audio." },
    { id: 'parts', title: 'Parts of Speech', icon: 'Layers', color: 'bg-indigo-50 text-indigo-600', count: '10 Lessons', description: "Understand the building blocks of English: Nouns, Verbs, Adjectives, and more." },
  ];

  const insertModule = db.prepare("INSERT INTO modules (id, title, icon, color, count, description) VALUES (?, ?, ?, ?, ?, ?)");
  initialModules.forEach(m => insertModule.run(m.id, m.title, m.icon, m.color, m.count, m.description));

  const initialLessons = [
    { 
      id: 'vocab_greetings',
      module_id: 'vocab',
      title: "Common Greetings", 
      duration: "10 min", 
      content: [
        { word: "Hello / Hi", meaning: "A standard way to greet someone.", example: "Hello! How are you today?" },
        { word: "Good Morning", meaning: "A greeting used before noon.", example: "Good morning, did you sleep well?" },
        { word: "Nice to meet you", meaning: "A polite way to greet someone you are meeting for the first time.", example: "Hi Rahul, nice to meet you!" },
        { word: "How's it going?", meaning: "An informal way to ask how someone is.", example: "Hey! How's it going with your project?" },
        { word: "Take care", meaning: "A friendly way to say goodbye while wishing someone well.", example: "See you later, take care!" }
      ]
    },
    { 
      id: 'tenses_present',
      module_id: 'tenses',
      title: "Present Simple vs Continuous", 
      duration: "15 min", 
      content: [
        { word: "Present Simple", meaning: "Used for habits, facts, and general truths.", example: "I drink coffee every morning." },
        { word: "Present Continuous", meaning: "Used for actions happening right now.", example: "I am drinking coffee right now." }
      ]
    }
  ];

  const insertLesson = db.prepare("INSERT INTO lessons (id, module_id, title, duration, content_json) VALUES (?, ?, ?, ?, ?)");
  initialLessons.forEach(l => insertLesson.run(l.id, l.module_id, l.title, l.duration, JSON.stringify(l.content)));
}

export const app = express();
let io: Server | null = null;

app.use(express.json());
app.use(cors());
app.use(
  helmet({
    contentSecurityPolicy: false,
  })
);

// ==========================================
// NEW SECURE AUTHENTICATION ROUTES
// ==========================================

app.post("/api/auth/signup", async (req, res) => {
  try {
    const { email, password, name, mobile } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required." });
    }
    const normalizedEmail = email.trim().toLowerCase();

    // Check existing user
    const userExists = db.prepare("SELECT * FROM users WHERE email = ?").get(normalizedEmail);
    if (userExists) {
      return res.status(400).json({ message: "An account with this email already exists." });
    }

    // Hash Securely
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Save into Database
    db.prepare("INSERT INTO users (name, email, password, mobile) VALUES (?, ?, ?, ?)")
      .run(name || "", normalizedEmail, hashedPassword, mobile || "");

    return res.status(201).json({ message: "Registration successful." });
  } catch (error) {
    console.error("Signup Endpoint Error:", error);
    return res.status(500).json({ message: "Internal Server Error." });
  }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required." });
    }
    const normalizedEmail = email.trim().toLowerCase();

    // Find User
    const user = db.prepare("SELECT * FROM users WHERE email = ?").get(normalizedEmail);
    if (!user || !user.password) {
      return res.status(401).json({ message: "Invalid email or password." });
    }

    // Check Match
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid email or password." });
    }

    return res.status(200).json({ 
      message: "Login successful.",
      name: user.name 
    });
  } catch (error) {
    console.error("Login Endpoint Error:", error);
    return res.status(500).json({ message: "Internal Server Error." });
  }
});

// ==========================================
// PRE-EXISTING APP SERVICES
// ==========================================

async function startServer() {
  const httpServer = createHttpServer(app);
  io = new Server(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    }
  });
  const PORT = 3000;

  io.on("connection", (socket) => {
    console.log("Client connected:", socket.id);
    socket.on("disconnect", () => {
      console.log("Client disconnected:", socket.id);
    });
  });

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  if (process.env.VERCEL !== '1') {
    httpServer.listen(PORT, "0.0.0.0", () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  }
}

app.get("/api/user/progress", (req, res) => {
  res.json({
    level: "Intermediate",
    isPro: false,
    dailyProgress: [
      { date: '2024-02-15', score: 65 },
      { date: '2024-02-16', score: 72 },
      { date: '2024-02-17', score: 68 },
      { date: '2024-02-18', score: 85 },
      { date: '2024-02-19', score: 78 },
      { date: '2024-02-20', score: 90 },
      { date: '2024-02-21', score: 88 },
    ],
    tasksCompleted: 12,
    totalTasks: 20
  });
});

app.get("/api/plans", (req, res) => {
  const plans = db.prepare("SELECT * FROM plans").all();
  res.json(plans);
});

// Gemini Engine Initialization
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build'
    }
  }
});

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

app.post("/api/gemini/assess-level", async (req, res) => {
  const { testAnswers } = req.body;
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

app.post("/api/gemini/learning-plan", async (req, res) => {
  const { level } = req.body;
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

app.post("/api/gemini/daily-tasks", async (req, res) => {
  const { level, month, day, targetLanguage = "Hindi" } = req.body;
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

app.post("/api/gemini/daily-learning", async (req, res) => {
  const { category, level, targetLanguage = "Hindi" } = req.body;
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

app.post("/api/gemini/correct-sentence", async (req, res) => {
  const { sentence, targetLanguage = "Hindi" } = req.body;
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

app.post("/api/gemini/translate-trial", async (req, res) => {
  const { nativeLang } = req.body;
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
              secondary: { type: Type.STRING }
            }
          }
        }
      });
      return safeJsonParse(response.text);
    });
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Start Hook execution
startServer();
