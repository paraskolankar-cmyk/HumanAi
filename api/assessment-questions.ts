import type { VercelRequest, VercelResponse } from '@vercel/node';
const SUPABASE_URL = 'https://oeuerdnisbplolskepin.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY!;
export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/assessment_questions?select=*`, { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } });
    const data = await r.json();
    return res.status(200).json(Array.isArray(data) ? data : []);
  } catch { return res.status(200).json([]); }
}
