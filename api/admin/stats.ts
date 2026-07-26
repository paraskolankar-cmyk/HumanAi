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

  try {
    const usersRes = await client.execute('SELECT * FROM users');
    const users = usersRes.rows as any[];

    return res.status(200).json({
      totalUsers: users.length,
      proUsers: users.filter((u) => Boolean(u.is_pro)).length,
      revenue: 0,
      recentPayments: [],
      userGrowth: [],
    });
  } catch (err: any) {
    console.error('Fetch stats error:', err);
    return res.status(500).json({ message: 'Error fetching stats', error: err.message });
  }
}
