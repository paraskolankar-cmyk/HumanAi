import type { VercelRequest, VercelResponse } from '@vercel/node';
const SUPABASE_URL = 'https://oeuerdnisbplolskepin.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY!;
export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  const { id, name, price, interval } = req.body;
  await fetch(`${SUPABASE_URL}/rest/v1/plans`, { method: 'POST', headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ id, name, price, interval }) });
  return res.status(201).json({ message: 'Created' });
}
