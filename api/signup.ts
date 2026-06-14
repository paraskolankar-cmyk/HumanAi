import type { VercelRequest, VercelResponse } from '@vercel/node';

const SUPABASE_URL = 'https://oeuerdnisbplolskepin.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY!;

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
    const checkRes = await fetch(
      `${SUPABASE_URL}/rest/v1/users?email=eq.${encodeURIComponent(normalizedEmail)}&select=id`,
      {
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
        },
      }
    );

    const existing = await checkRes.json();
    if (Array.isArray(existing) && existing.length > 0) {
      return res.status(400).json({ message: 'Is email se account pehle se exist karta hai.' });
    }

    // Insert new user
    const insertRes = await fetch(`${SUPABASE_URL}/rest/v1/users`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
      },
      body: JSON.stringify({
        email: normalizedEmail,
        password: String(password),
        name: String(name || '').trim(),
        mobile: String(mobile || '').trim(),
        level: 'Beginner',
        is_pro: 0,
        is_admin: 0,
      }),
    });

    const newUser = await insertRes.json();

    if (!insertRes.ok) {
      console.error('Supabase insert error:', newUser);
      return res.status(500).json({ message: 'User save karne mein error aaya.' });
    }

    return res.status(201).json({
      message: 'Registration successful!',
      name: newUser[0]?.name,
      email: newUser[0]?.email,
    });
  } catch (err) {
    console.error('Signup error:', err);
    return res.status(500).json({ message: 'Server error. Please try again.' });
  }
}
