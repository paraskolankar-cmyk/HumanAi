import type { VercelRequest, VercelResponse } from '@vercel/node';
const SUPABASE_URL = 'https://oeuerdnisbplolskepin.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY!;
export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ message: 'Method not allowed' });
  const { email, name, mobile, level, is_pro } = req.body || {};
  if (!email) return res.status(400).json({ error: 'Email required' });
  try {
    const checkRes = await fetch(`${SUPABASE_URL}/rest/v1/users?email=eq.${encodeURIComponent(email)}&select=*`, { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } });
    const existing = await checkRes.json();
    if (Array.isArray(existing) && existing.length > 0) {
      const updateBody: any = {};
      if (name) updateBody.name = name;
      if (mobile) updateBody.mobile = mobile;
      if (level) updateBody.level = level;
      if (is_pro !== undefined) updateBody.is_pro = is_pro ? 1 : 0;
      await fetch(`${SUPABASE_URL}/rest/v1/users?email=eq.${encodeURIComponent(email)}`, { method: 'PATCH', headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' }, body: JSON.stringify(updateBody) });
      const updated = await fetch(`${SUPABASE_URL}/rest/v1/users?email=eq.${encodeURIComponent(email)}&select=*`, { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } });
      const data = await updated.json();
      return res.status(200).json(data[0] || {});
    } else {
      await fetch(`${SUPABASE_URL}/rest/v1/users`, { method: 'POST', headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ email, name, mobile, level: level || 'Beginner', is_pro: is_pro ? 1 : 0, is_admin: 0 }) });
      return res.status(200).json({ email, name, level: level || 'Beginner' });
    }
  } catch (err) {
    return res.status(500).json({ error: 'Sync failed' });
  }
}
