import type { VercelRequest, VercelResponse } from '@vercel/node';
const SUPABASE_URL = 'https://oeuerdnisbplolskepin.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY!;
export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();
  try {
    const [usersRes, paymentsRes] = await Promise.all([
      fetch(`${SUPABASE_URL}/rest/v1/users?select=*`, { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }),
      fetch(`${SUPABASE_URL}/rest/v1/payments?select=*`, { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }),
    ]);
    const users = await usersRes.json();
    const payments = paymentsRes.ok ? await paymentsRes.json() : [];
    const totalUsers = Array.isArray(users) ? users.length : 0;
    const proUsers = Array.isArray(users) ? users.filter((u: any) => u.is_pro).length : 0;
    const revenue = Array.isArray(payments) ? payments.filter((p: any) => p.status === 'Success').reduce((sum: number, p: any) => sum + (p.amount || 0), 0) : 0;
    return res.status(200).json({ totalUsers, proUsers, revenue, recentPayments: [], userGrowth: [] });
  } catch (err) {
    return res.status(500).json({ message: 'Stats fetch error' });
  }
}

