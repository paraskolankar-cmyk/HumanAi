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
    const result = await client.execute('SELECT * FROM plans');
    return res.status(200).json(result.rows);
  } catch (err: any) {
    return res.status(500).json({ message: 'Error fetching plans', error: err.message });
  }
}
