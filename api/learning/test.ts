import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@libsql/client';

const client = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN!,
});

function getServerGeminiKey(): string | undefined {
  return process.env.GEMINI_API_KEY || process.env.VITE_PRIMARY_GEMINI_KEY;
}

const MODEL_FALLBACK_CHAIN = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-2.5-flash-lite', 'gemini-flash-latest'];

async function callGemini(prompt: string): Promise<string> {
  const apiKey = getServerGeminiKey();
  if (!apiKey) throw new Error('No Gemini API key configured on server.');

  let lastError: any = null;
  for (const model of MODEL_FALLBACK_CHAIN) {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.7, responseMimeType: 'application/json' }
        })
      });

      if (response.ok) {
        const data = await response.json();
        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
        if (text.trim()) return text;
      } else {
        const errText = await response.text();
        lastError = new Error(`Model ${model} - ${response.status}: ${errText}`);
        if (response.status === 404) continue;
        if (response.status === 429 && errText.includes('"limit": 0')) continue;
      }
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError || new Error('All Gemini models failed');
}

function safeJsonParse(text: string): any {
  try {
    const match = text.replace(/```json/gi, '').replace(/```/g, '').match(/\{[\s\S]*\}/);
    return JSON.parse(match ? match[0] : text);
  } catch {
    return null;
  }
}

const TOPIC_LABELS: Record<string, string> = {
  vocabulary: 'Vocabulary',
  grammar_essentials: 'Grammar Essentials',
  tenses_structure: 'Tenses & Structure',
  synonyms_antonyms: 'Synonyms & Antonyms',
  noun_pronoun: 'Noun & Pronoun',
  verbs: 'Verbs (V1 - V4)',
  voice_narration: 'Voice & Narration',
  advanced_grammar: 'Advanced Grammar',
  expert_grammar: 'Expert Grammar'
};

async function ensureTable() {
  await client.execute(`
    CREATE TABLE IF NOT EXISTS learning_test_cache (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      day_number INTEGER,
      topic_id TEXT,
      test_json TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(day_number, topic_id)
    )
  `);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ message: 'Method not allowed' });

  const dayNumber = parseInt((req.query.day as string) || '', 10);
  const topicId = (req.query.topic as string) || '';

  if (!dayNumber || !topicId || !TOPIC_LABELS[topicId]) {
    return res.status(400).json({ message: 'Valid day and topic query params required.' });
  }

  try {
    await ensureTable();

    const cached = await client.execute({
      sql: 'SELECT test_json FROM learning_test_cache WHERE day_number = ? AND topic_id = ?',
      args: [dayNumber, topicId],
    });

    if (cached.rows.length > 0) {
      const row = cached.rows[0] as any;
      return res.status(200).json({ ...JSON.parse(row.test_json), cached: true });
    }

    const topicLabel = TOPIC_LABELS[topicId];
    const prompt = `Create a REAL competitive-exam-style test (SSC/Banking/Railway English section pattern) for Day ${dayNumber}, topic: "${topicLabel}".

Write 10 ORIGINAL multiple-choice questions in the exact style/difficulty of real SSC CGL / IBPS PO English section questions — but do NOT copy any specific real exam question verbatim. Write fresh questions in that pattern/style.

Return STRICT JSON in this exact shape, nothing else:
{
  "day": ${dayNumber},
  "topic": "${topicLabel}",
  "questions": [
    {
      "id": 1,
      "question": "Question text",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correctAnswer": "Option A",
      "explanation": "Brief explanation of why this is correct, in simple English"
    }
  ]
}

Exactly 10 questions. Mix question types appropriate to the topic (error detection, fill-in-the-blank, sentence correction, MCQ, etc., matching real exam patterns for "${topicLabel}").`;

    const rawText = await callGemini(prompt);
    const parsed = safeJsonParse(rawText);

    if (!parsed || !Array.isArray(parsed.questions)) {
      return res.status(502).json({ message: 'Failed to generate test. Please try again.' });
    }

    await client.execute({
      sql: 'INSERT OR REPLACE INTO learning_test_cache (day_number, topic_id, test_json) VALUES (?, ?, ?)',
      args: [dayNumber, topicId, JSON.stringify(parsed)],
    });

    return res.status(200).json({ ...parsed, cached: false });
  } catch (err: any) {
    console.error('Learning test error:', err);
    return res.status(500).json({ message: 'Server error. Please try again.' });
  }
}
