import type { VercelRequest, VercelResponse } from '@vercel/node';

const SUPABASE_URL = 'https://oeuerdnisbplolskepin.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY!;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ message: 'Method not allowed' });

  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/users?select=*`, {
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
      },
    });

    const users = await response.json();

    if (!response.ok) {
      console.error('Supabase fetch error:', users);
      return res.status(500).json({ message: 'Users fetch karne mein error.' });
    }

    return res.status(200).json(users);
  } catch (err) {
    console.error('Users API error:', err);
    return res.status(500).json({ message: 'Server error.' });
  }
}
