import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@libsql/client';

const client = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN!,
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    // 1. Table auto create karein agar missing ho
    await client.execute(`
      CREATE TABLE IF NOT EXISTS modules (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT
      );
    `);

    // 2. Fetch Data
    const result = await client.execute('SELECT * FROM modules');
    return res.status(200).json(result.rows || []);
  } catch (err: any) {
    console.error('Modules API error:', err);
    return res.status(200).json([]); // Fallback array
  }
}
