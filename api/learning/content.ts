import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@libsql/client';

const client = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN!,
});

// Server-side only — never exposed to the browser bundle (unlike VITE_ vars).
function getServerGeminiKey(): string | undefined {
  return process.env.GEMINI_API_KEY || process.env.VITE_PRIMARY_GEMINI_KEY;
}

const MODEL_FALLBACK_CHAIN = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-2.5-flash-lite', 'gemini-flash-latest'];

async function callGemini(prompt: string): Promise<string> {
  const apiKey = getServerGeminiKey();
  if (!apiKey) throw new Error('No Gemini API key configured on server (GEMINI_API_KEY env var missing).');

  let lastError: any = null;
  for (const model of MODEL_FALLBACK_CHAIN) {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.8, responseMimeType: 'application/json' }
        })
      });

      if (response.ok) {
        const data = await response.json();
        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
        if (text.trim()) return text;
      } else {
        const errText = await response.text();
        lastError = new Error(`Model ${model} - ${response.status}: ${errText}`);
        if (response.status === 404) continue; // try next model
        if (response.status === 429 && errText.includes('"limit": 0')) continue; // move to next model bucket
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
    CREATE TABLE IF NOT EXISTS learning_content_cache (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      day_number INTEGER,
      topic_id TEXT,
      content_json TEXT,
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

    // 1. Check cache first — this is what makes it "AI only runs once".
    const cached = await client.execute({
      sql: 'SELECT content_json FROM learning_content_cache WHERE day_number = ? AND topic_id = ?',
      args: [dayNumber, topicId],
    });

    if (cached.rows.length > 0) {
      const row = cached.rows[0] as any;
      return res.status(200).json({ ...JSON.parse(row.content_json), cached: true });
    }

    // 2. Cache miss -> generate ONCE via Gemini, then store for every future request/user.
    const topicLabel = TOPIC_LABELS[topicId];
    const prompt = `You are creating Day ${dayNumber} of a 90-day English learning course for Indian competitive-exam aspirants (SSC, Banking, Railway, UPSC prelims English section).

Topic for today: "${topicLabel}"

Write 100% ORIGINAL content — do not copy or closely paraphrase any specific published book, guide, or coaching-institute material. Write your own explanations and your own fresh example sentences, in a clear, exam-focused style similar in SPIRIT to standard competitive-exam prep books, but in your own original words.

Return STRICT JSON in this exact shape, nothing else:
{
  "topic": "${topicLabel}",
  "day": ${dayNumber},
  "explanation": "Clear, well-structured explanation of today's concept (3-5 short paragraphs or bullet points), written in simple English with Hindi translations of key terms in brackets where helpful.",
  "explanationTranslation": "A concise Hindi (Devanagari) translation/summary of the explanation above, 2-4 sentences.",
  "rules": ["Rule 1 stated simply", "Rule 2", "..."],
  "tenseStructure": "Only fill this if the topic is about a specific tense — the formula, e.g. 'Subject + has/have + V3 + Object'. Otherwise empty string.",
  "examples": [
    { "english": "Original example sentence 1", "translation": "Hindi translation" },
    { "english": "Original example sentence 2", "translation": "Hindi translation" }
  ],
  "vocabulary": [
    { "word": "word1", "meaning": "meaning in English", "translation": "Hindi meaning", "example": "Original sentence using the word" }
  ],
  "verbs": [
    { "v1": "base form", "v2": "past form", "v3": "past participle", "v4": "-ing form", "translation": "Hindi meaning of v1", "example": "Original sentence using v1" }
  ]
}

Rules for which fields to fill based on topic:
- If topic is "Vocabulary": fill "vocabulary" with 10 fresh, exam-relevant words. Leave "verbs" and "tenseStructure" empty/blank.
- If topic is "Verbs (V1 - V4)": fill "verbs" with 8-10 common irregular/regular verbs in all 4 forms. Leave "vocabulary" as empty array.
- If topic is "Tenses & Structure": fill "tenseStructure" with today's specific tense formula, and give plenty of "examples". Leave "vocabulary"/"verbs" empty.
- For all other grammar topics: focus on "explanation", "rules", and "examples". Leave "vocabulary"/"verbs" empty.`;

    const rawText = await callGemini(prompt);
    const parsed = safeJsonParse(rawText);

    if (!parsed) {
      return res.status(502).json({ message: 'Failed to generate content. Please try again.' });
    }

    // 3. Persist to cache — every subsequent user for this day+topic hits step 1 instead.
    await client.execute({
      sql: 'INSERT OR REPLACE INTO learning_content_cache (day_number, topic_id, content_json) VALUES (?, ?, ?)',
      args: [dayNumber, topicId, JSON.stringify(parsed)],
    });

    return res.status(200).json({ ...parsed, cached: false });
  } catch (err: any) {
    console.error('Learning content error:', err);
    return res.status(500).json({ message: 'Server error. Please try again.' });
  }
}
