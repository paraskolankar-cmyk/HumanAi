import type { NextApiRequest, NextApiResponse } from 'next';

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY!;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
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
    const userRes = await fetch(
      `${SUPABASE_URL}/rest/v1/users?email=eq.${encodeURIComponent(normalizedEmail)}&select=*`,
      {
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
        },
      }
    );

    const users = await userRes.json();

    if (!users.length) {
      return res.status(401).json({ message: 'Email ya password galat hai.' });
    }

    const user = users[0];

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
    console.error('Signin error:', err);
    return res.status(500).json({ message: 'Server error. Please try again.' });
  }
}
