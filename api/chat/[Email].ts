import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@libsql/client';

const client = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN!,
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ message: 'Method not allowed' });

  // Dynamic route param from filename [email].ts -> matches dbService's
  // fetch(`/api/chat/${email}`) call exactly.
  const email = (req.query.email as string) || '';

  if (!email) {
    return res.status(400).json({ message: 'email required hai.' });
  }

  const normalizedEmail = decodeURIComponent(email).trim().toLowerCase();

  try {
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
      sql: 'SELECT * FROM chat_messages WHERE user_email = ? ORDER BY timestamp ASC LIMIT 100',
      args: [normalizedEmail],
    });

    return res.status(200).json(result.rows);
  } catch (err) {
    console.error('Get chat history error:', err);
    return res.status(500).json({ message: 'Server error. Please try again.' });
  }
}
