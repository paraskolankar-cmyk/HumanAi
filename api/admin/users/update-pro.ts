import type { VercelRequest, VercelResponse } from '@vercel/node';
const SUPABASE_URL = 'https://oeuerdnisbplolskepin.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY!;
export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  const { id, is_pro } = req.body;
  await fetch(`${SUPABASE_URL}/rest/v1/users?id=eq.${id}`, { method: 'PATCH', headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ is_pro: is_pro ? 1 : 0 }) });
  return res.status(200).json({ message: 'Updated' });
}
