import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@libsql/client';

const client = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN!,
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ message: 'Method not allowed' });

  const { email, role, text, correction, translation, explanation } = req.body || {};

  if (!email || !role || !text) {
    return res.status(400).json({ message: 'email, role aur text required hain.' });
  }

  const normalizedEmail = String(email).trim().toLowerCase();

  try {
    // Safe to run every time — only creates the table the first time it's missing.
    await client.execute(`
      CREATE TABLE IF NOT EXISTS chat_messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_email TEXT,
        role TEXT,
        text TEXT,
        correction TEXT,
        translation TEXT,
        explanation TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    const result = await client.execute({
      sql: 'INSERT INTO chat_messages (user_email, role, text, correction, translation, explanation) VALUES (?, ?, ?, ?, ?, ?)',
      args: [
        normalizedEmail,
        String(role),
        String(text),
        correction ?? null,
        translation ?? null,
        explanation ?? null,
      ],
    });

    return res.status(201).json({
      message: 'Chat message saved.',
      id: result.lastInsertRowid ? Number(result.lastInsertRowid) : undefined,
    });
  } catch (err) {
    console.error('Save chat message error:', err);
    return res.status(500).json({ message: 'Server error. Please try again.' });
  }
}
