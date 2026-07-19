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

  const { email, password } = req.body || {};

  if (!email || !password) {
    return res.status(400).json({ message: 'Email aur Password required hain.' });
  }

  const normalizedEmail = String(email).trim().toLowerCase();

  try {
    const result = await client.execute({
      sql: 'SELECT * FROM users WHERE email = ?',
      args: [normalizedEmail],
    });

    if (result.rows.length === 0) {
      return res.status(401).json({ message: 'Email ya password galat hai.' });
    }

    const user = result.rows[0] as any;

    if (user.password !== String(password)) {
      return res.status(401).json({ message: 'Email ya password galat hai.' });
    }

    return res.status(200).json({
      message: 'Login successful!',
      name: user.name,
      email: user.email,
      level: user.level,
      is_pro: user.is_pro,
      is_admin: user.is_admin,
    });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ message: 'Server error. Please try again.' });
  }
}
