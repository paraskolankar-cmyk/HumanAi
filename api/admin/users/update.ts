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

  try {
    const { id, name, email, mobile, level, is_pro, is_admin } = req.body || {};

    if (!id) {
      return res.status(400).json({ message: 'User ID is required' });
    }

    await client.execute({
      sql: `UPDATE users SET name = ?, email = ?, mobile = ?, level = ?, is_pro = ?, is_admin = ? WHERE id = ?`,
      args: [name, email, mobile, level, is_pro ? 1 : 0, is_admin ? 1 : 0, id],
    });

    return res.status(200).json({ message: 'User updated successfully' });
  } catch (err: any) {
    console.error('Update user error:', err);
    return res.status(500).json({ message: 'Server error', error: err.message });
  }
}
