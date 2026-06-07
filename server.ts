import express from "express";
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
    this.data = {
      users: [],
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
        this.data = JSON.parse(fs.readFileSync(this.filePath, 'utf-8'));
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
        return String(itemVal) === String(val);
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

// Initialize DB
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    email TEXT UNIQUE,
    mobile TEXT,
    level TEXT DEFAULT 'Beginner',
    is_pro INTEGER DEFAULT 0,
    is_admin INTEGER DEFAULT 0,
    progress_json TEXT,
    onboarding_json TEXT
  );
`);

// Migration: Add onboarding_json if it doesn't exist (for existing databases)
try {
  const tableInfo = db.prepare("PRAGMA table_info(users)").all() as any[];
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

// Seed plans if empty
const plansCount = db.prepare("SELECT COUNT(*) as count FROM plans").get() as any;
if (plansCount.count === 0) {
  db.prepare("INSERT INTO plans (id, name, price, interval) VALUES (?, ?, ?, ?)").run('trial_1day', '1 Day Free Trial', 0.00, 'day');
  db.prepare("INSERT INTO plans (id, name, price, interval) VALUES (?, ?, ?, ?)").run('trial_7day', '7 Days Trial', 99.00, 'week');
  db.prepare("INSERT INTO plans (id, name, price, interval) VALUES (?, ?, ?, ?)").run('monthly', 'Pro Monthly', 499.00, 'month');
  db.prepare("INSERT INTO plans (id, name, price, interval) VALUES (?, ?, ?, ?)").run('yearly', 'Pro Yearly', 4999.00, 'year');
}

// Seed assessment questions if empty
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

// Seed modules if empty
// ... (previous seeding code)

// Seed modules if empty
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

// API Routes
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

  app.post("/api/admin/plans/update", (req, res) => {
    const { id, price } = req.body;
    if (!id || price === undefined) {
      return res.status(400).json({ error: "Missing id or price" });
    }
    db.prepare("UPDATE plans SET price = ? WHERE id = ?").run(price, id);
    res.json({ success: true });
  });

  app.get("/api/modules", (req, res) => {
    const modules = db.prepare("SELECT * FROM modules").all();
    res.json(modules);
  });

  app.get("/api/modules/:id/lessons", (req, res) => {
    const lessons = db.prepare("SELECT * FROM lessons WHERE module_id = ?").all(req.params.id);
    res.json(lessons.map((l: any) => ({ ...l, content: JSON.parse(l.content_json) })));
  });

  app.post("/api/admin/modules/update", (req, res) => {
    const { id, title, description } = req.body;
    db.prepare("UPDATE modules SET title = ?, description = ? WHERE id = ?").run(title, description, id);
    res.json({ success: true });
  });

  app.post("/api/admin/modules/create", (req, res) => {
    const { id, title, description } = req.body;
    db.prepare("INSERT INTO modules (id, title, description, icon, color, count) VALUES (?, ?, ?, ?, ?, ?)").run(
      id, title, description, 'Book', 'bg-blue-50 text-blue-600', '0 Lessons'
    );
    res.json({ success: true });
  });

  app.post("/api/admin/modules/delete", (req, res) => {
    const { id } = req.body;
    db.prepare("DELETE FROM lessons WHERE module_id = ?").run(id);
    db.prepare("DELETE FROM modules WHERE id = ?").run(id);
    res.json({ success: true });
  });

  app.post("/api/admin/lessons/update", (req, res) => {
    const { id, title, duration, content } = req.body;
    db.prepare("UPDATE lessons SET title = ?, duration = ?, content_json = ? WHERE id = ?").run(title, duration, JSON.stringify(content), id);
    res.json({ success: true });
  });

  app.post("/api/admin/lessons/create", (req, res) => {
    const { id, moduleId, title, duration, content } = req.body;
    db.prepare("INSERT INTO lessons (id, module_id, title, duration, content_json) VALUES (?, ?, ?, ?, ?)").run(
      id, moduleId, title, duration, JSON.stringify(content)
    );
    res.json({ success: true });
  });

  app.post("/api/admin/lessons/delete", (req, res) => {
    const { id } = req.body;
    db.prepare("DELETE FROM lessons WHERE id = ?").run(id);
    res.json({ success: true });
  });

  app.get("/api/assessment-questions", (req, res) => {
    const questions = db.prepare("SELECT * FROM assessment_questions").all();
    res.json(questions.map((q: any) => ({ ...q, options: JSON.parse(q.options_json) })));
  });

  app.post("/api/admin/assessment-questions/update", (req, res) => {
    const { id, question, options, answer } = req.body;
    db.prepare("UPDATE assessment_questions SET question = ?, options_json = ?, answer = ? WHERE id = ?").run(question, JSON.stringify(options), answer, id);
    res.json({ success: true });
  });

  app.post("/api/admin/assessment-questions/create", (req, res) => {
    const { question, options, answer } = req.body;
    db.prepare("INSERT INTO assessment_questions (question, options_json, answer) VALUES (?, ?, ?)").run(
      question, JSON.stringify(options), answer
    );
    res.json({ success: true });
  });

  app.post("/api/admin/assessment-questions/delete", (req, res) => {
    const { id } = req.body;
    db.prepare("DELETE FROM assessment_questions WHERE id = ?").run(id);
    res.json({ success: true });
  });

  // User Management
  app.post("/api/user/sync", (req, res) => {
    const { email, name, mobile, onboarding, progress, isPro } = req.body;
    if (!email) return res.status(400).json({ error: "Email required" });

    const user = db.prepare("SELECT * FROM users WHERE email = ?").get(email) as any;
    
    if (!user) {
      db.prepare("INSERT INTO users (email, name, mobile, onboarding_json, progress_json, is_pro) VALUES (?, ?, ?, ?, ?, ?)").run(
        email, 
        name || email.split('@')[0], 
        mobile || null,
        onboarding ? JSON.stringify(onboarding) : null,
        progress ? JSON.stringify(progress) : null,
        isPro ? 1 : 0
      );
    } else {
      if (name) {
        db.prepare("UPDATE users SET name = ? WHERE email = ?").run(name, email);
      }
      if (mobile) {
        db.prepare("UPDATE users SET mobile = ? WHERE email = ?").run(mobile, email);
      }
      if (onboarding) {
        db.prepare("UPDATE users SET onboarding_json = ? WHERE email = ?").run(JSON.stringify(onboarding), email);
      }
      if (progress) {
        db.prepare("UPDATE users SET progress_json = ? WHERE email = ?").run(JSON.stringify(progress), email);
      }
      if (isPro !== undefined) {
        db.prepare("UPDATE users SET is_pro = ? WHERE email = ?").run(isPro ? 1 : 0, email);
      }
    }
    
    const updatedUser = db.prepare("SELECT * FROM users WHERE email = ?").get(email) as any;
    const userData = {
      ...updatedUser,
      onboarding: updatedUser.onboarding_json ? JSON.parse(updatedUser.onboarding_json) : null,
      progress: updatedUser.progress_json ? JSON.parse(updatedUser.progress_json) : null
    };

    // Emit real-time update for admin panel
    if (io) {
      io.emit("user:registered", userData);
    }

    res.json(userData);
  });

  app.get("/api/user/:email", (req, res) => {
    const user = db.prepare("SELECT * FROM users WHERE email = ?").get(req.params.email) as any;
    if (!user) return res.status(404).json({ error: "User not found" });
    
    res.json({
      ...user,
      onboarding: user.onboarding_json ? JSON.parse(user.onboarding_json) : null,
      progress: user.progress_json ? JSON.parse(user.progress_json) : null
    });
  });

  // Chat History
  app.get("/api/chat/:email", (req, res) => {
    const messages = db.prepare("SELECT * FROM chat_messages WHERE user_email = ? ORDER BY timestamp ASC").all(req.params.email);
    res.json(messages);
  });

  app.post("/api/chat/message", (req, res) => {
    const { email, role, text, correction, translation, explanation } = req.body;
    db.prepare("INSERT INTO chat_messages (user_email, role, text, correction, translation, explanation) VALUES (?, ?, ?, ?, ?, ?)").run(
      email, role, text, correction || null, translation || null, explanation || null
    );
    res.json({ success: true });
  });

  app.get("/api/admin/users", (req, res) => {
    const users = db.prepare("SELECT * FROM users").all();
    res.json(users);
  });

  app.post("/api/admin/users/delete", (req, res) => {
    const { id } = req.body;
    db.prepare("DELETE FROM users WHERE id = ?").run(id);
    res.json({ success: true });
  });

  app.post("/api/admin/users/update-pro", (req, res) => {
    const { id, is_pro } = req.body;
    db.prepare("UPDATE users SET is_pro = ? WHERE id = ?").run(is_pro ? 1 : 0, id);
    res.json({ success: true });
  });

  app.post("/api/admin/users/update-admin", (req, res) => {
    const { id, is_admin } = req.body;
    db.prepare("UPDATE users SET is_admin = ? WHERE id = ?").run(is_admin ? 1 : 0, id);
    res.json({ success: true });
  });

  app.post("/api/admin/users/update", (req, res) => {
    const { id, name, email, mobile, level, is_pro, is_admin } = req.body;
    db.prepare("UPDATE users SET name = ?, email = ?, mobile = ?, level = ?, is_pro = ?, is_admin = ? WHERE id = ?").run(
      name,
      email,
      mobile,
      level,
      is_pro !== undefined ? (is_pro ? 1 : 0) : 0,
      is_admin !== undefined ? (is_admin ? 1 : 0) : 0,
      id
    );
    res.json({ success: true });
  });

  app.post("/api/admin/plans/create", (req, res) => {
    const { id, name, price, interval } = req.body;
    db.prepare("INSERT INTO plans (id, name, price, interval) VALUES (?, ?, ?, ?)").run(id, name, price, interval);
    res.json({ success: true });
  });

  // Account Deletion with Notification
  app.post("/api/user/delete-account", (req, res) => {
    const { email, mobile } = req.body;
    
    if (!email) {
      return res.status(400).json({ error: "Email is required" });
    }

    try {
      // 1. Find user to ensure they exist
      const user = db.prepare("SELECT * FROM users WHERE email = ?").get(email) as any;
      
      // 2. Delete user data
      db.prepare("DELETE FROM chat_messages WHERE user_email = ?").run(email);
      db.prepare("DELETE FROM users WHERE email = ?").run(email);

      // 3. Simulate sending notifications
      const message = `Your HumnAi account (${email}) has been successfully deleted. We're sorry to see you go!`;
      
      console.log(`[NOTIFICATION] Sending Email to ${email}: ${message}`);
      if (mobile || user?.mobile) {
        console.log(`[NOTIFICATION] Sending SMS to ${mobile || user?.mobile}: ${message}`);
      }

      // Note: In a real app, you would integrate with Twilio/SendGrid here:
      /*
      if (process.env.SENDGRID_API_KEY) {
        await sendEmail(email, "Account Deleted", message);
      }
      if (process.env.TWILIO_SID) {
        await sendSMS(mobile || user?.mobile, message);
      }
      */

      res.json({ success: true, message: "Account deleted and notifications sent." });
    } catch (error: any) {
      console.error("Delete account error:", error);
      res.status(500).json({ error: "Failed to delete account" });
    }
  });

  app.post("/api/user/upgrade-demo", (req, res) => {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: "Email required" });
    
    const user = db.prepare("SELECT * FROM users WHERE email = ?").get(email) as any;
    if (user) {
      db.prepare("UPDATE users SET is_pro = 1 WHERE id = ?").run(user.id);
      res.json({ success: true });
    } else {
      res.status(404).json({ error: "User not found" });
    }
  });

  // Stripe Checkout Session
  app.post("/api/create-checkout-session", async (req, res) => {
    if (!stripe) {
      return res.status(500).json({ error: "Stripe is not configured" });
    }

    const { planId } = req.body;
    const plan = db.prepare("SELECT * FROM plans WHERE id = ?").get(planId) as any;
    
    if (!plan) {
      return res.status(404).json({ error: "Plan not found" });
    }

    try {
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: [
          {
            price_data: {
              currency: 'inr',
              product_data: {
                name: plan.name,
                description: 'Full access to AI Tutor and all learning modules',
              },
              unit_amount: Math.round(plan.price * 100),
            },
            quantity: 1,
          },
        ],
        mode: 'payment',
        success_url: `${process.env.APP_URL || 'http://localhost:3000'}/?payment=success`,
        cancel_url: `${process.env.APP_URL || 'http://localhost:3000'}/?payment=cancel`,
      });

      res.json({ id: session.id, url: session.url });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Razorpay Integration
  app.post("/api/razorpay/create-order", async (req, res) => {
    const { planId } = req.body;
    const plan = db.prepare("SELECT * FROM plans WHERE id = ?").get(planId) as any;

    if (!plan) {
      return res.status(404).json({ error: "Plan not found" });
    }

    if (!razorpay) {
      // Return a demo order if Razorpay is not configured
      return res.json({ 
        isDemo: true, 
        id: `demo_order_${Date.now()}`,
        amount: Math.round(plan.price * 100),
        currency: "INR",
        message: "Razorpay is not configured. Using demo mode."
      });
    }

    try {
      const options = {
        amount: Math.round(plan.price * 100), // amount in smallest currency unit (paise)
        currency: "INR",
        receipt: `receipt_${Date.now()}`,
      };

      const order = await razorpay.orders.create(options);
      res.json({
        id: order.id,
        amount: order.amount,
        currency: order.currency,
        key: process.env.RAZORPAY_KEY_ID
      });
    } catch (error: any) {
      console.error("Razorpay order error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/razorpay/verify-payment", async (req, res) => {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, email, planId } = req.body;

    const body = razorpay_order_id + "|" + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET!)
      .update(body.toString())
      .digest("hex");

    if (expectedSignature === razorpay_signature) {
      // Payment verified!
      // 1. Update user to Pro
      const user = db.prepare("SELECT * FROM users WHERE email = ?").get(email) as any;
      if (user) {
        db.prepare("UPDATE users SET is_pro = 1 WHERE id = ?").run(user.id);
        
        // 2. Record payment
        const plan = db.prepare("SELECT * FROM plans WHERE id = ?").get(planId) as any;
        db.prepare("INSERT INTO payments (user_id, amount, currency, status, stripe_session_id, date) VALUES (?, ?, ?, ?, ?, ?)").run(
          user.id, plan.price, 'INR', 'Success', razorpay_payment_id, new Date().toISOString()
        );
      }
      
      res.json({ success: true });
    } else {
      res.status(400).json({ success: false, error: "Invalid signature" });
    }
  });

  app.get("/api/admin/stats", (req, res) => {
    const totalUsers = db.prepare("SELECT COUNT(*) as count FROM users").get() as any;
    const proUsers = db.prepare("SELECT COUNT(*) as count FROM users WHERE is_pro = 1").get() as any;
    const totalRevenue = db.prepare("SELECT SUM(amount) as total FROM payments WHERE status = 'Success'").get() as any;
    
    const recentPayments = db.prepare(`
      SELECT p.*, u.name as user_name 
      FROM payments p 
      JOIN users u ON p.user_id = u.id 
      ORDER BY p.date DESC LIMIT 5
    `).all() as any[];

    res.json({
      totalUsers: totalUsers?.count || 0,
      proUsers: proUsers?.count || 0,
      revenue: totalRevenue?.total || 0,
      recentPayments: recentPayments.map(p => ({
        id: p.id,
        user: p.user_name || 'Anonymous',
        amount: p.amount,
        status: p.status,
        date: p.date,
        plan: p.amount > 1000 ? 'Yearly' : 'Monthly'
      })),
      userGrowth: [
        { month: 'Jan', users: Math.floor((totalUsers?.count || 0) * 0.6) },
        { month: 'Feb', users: totalUsers?.count || 0 },
      ]
    });
  });

  // Vite middleware for development (moved to startServer for dev, but for Vercel production we handle it here)
  if (process.env.NODE_ENV === "production" && process.env.VERCEL === '1') {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

if (process.env.VERCEL !== '1') {
  startServer();
}

export default app;
