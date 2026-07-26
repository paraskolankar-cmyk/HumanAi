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

  const { email, password, name, mobile } = req.body || {};

  if (!email || !password) {
    return res.status(400).json({ message: 'Email aur Password required hain.' });
  }
  if (String(password).length < 6) {
    return res.status(400).json({ message: 'Password kam se kam 6 characters ka hona chahiye.' });
  }

  const normalizedEmail = String(email).trim().toLowerCase();

  try {
    // Check if user already exists
    const existing = await client.execute({
      sql: 'SELECT id FROM users WHERE email = ?',
      args: [normalizedEmail],
    });

    if (existing.rows.length > 0) {
      return res.status(400).json({ message: 'Is email se account pehle se exist karta hai.' });
    }

    // Insert new user
    await client.execute({
      sql: `INSERT INTO users (email, password, name, mobile, level, is_pro, is_admin)
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
      args: [
        normalizedEmail,
        String(password),
        String(name || '').trim(),
        String(mobile || '').trim(),
        'Beginner',
        0,
        0,
      ],
    });

    return res.status(201).json({
      message: 'Registration successful!',
      name: String(name || '').trim(),
      email: normalizedEmail,
    });
  } catch (err) {
    console.error('Signup error:', err);
    return res.status(500).json({ message: 'Server error. Please try again.' });
  }
}
