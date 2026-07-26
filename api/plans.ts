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
      CREATE TABLE IF NOT EXISTS plans (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        price REAL NOT NULL,
        interval TEXT NOT NULL,
        features TEXT
      );
    `);

    // 2. Default Plans Insert karein agar table empty ho
    await client.execute(`
      INSERT OR IGNORE INTO plans (id, name, price, interval, features) VALUES 
      ('monthly_pro', 'Pro Monthly', 499, 'month', 'Unlimited AI Access'),
      ('yearly_pro', 'Pro Yearly', 3999, 'year', 'Unlimited AI Access');
    `);

    // 3. Fetch Data
    const result = await client.execute('SELECT * FROM plans');
    return res.status(200).json(result.rows || []);
  } catch (err: any) {
    console.error('Plans API error:', err);
    return res.status(200).json([]); // Fallback array
  }
}
