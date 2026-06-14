import type { VercelRequest, VercelResponse } from '@vercel/node';

const SUPABASE_URL = 'https://oeuerdnisbplolskepin.supabase.co';
const SUPABASE_KEY = () => process.env.SUPABASE_ANON_KEY!;

function setCors(res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

async function sb(path: string, method = 'GET', body?: any) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method,
    headers: {
      apikey: SUPABASE_KEY(),
      Authorization: `Bearer ${SUPABASE_KEY()}`,
      'Content-Type': 'application/json',
      Prefer: method === 'POST' ? 'return=representation' : '',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  try { return { ok: res.ok, data: JSON.parse(text) }; }
  catch { return { ok: res.ok, data: text }; }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  const path = (req.url || '').replace('/api/', '').split('?')[0];
  const body = req.body || {};

  try {
    // AUTH
    if (path === 'auth/signup' && req.method === 'POST') {
      const { email, password, name, mobile } = body;
      if (!email || !password) return res.status(400).json({ message: 'Email aur Password required hain.' });
      if (String(password).length < 6) return res.status(400).json({ message: 'Password 6+ characters hona chahiye.' });
      const normalizedEmail = String(email).trim().toLowerCase();
      const check = await sb(`users?email=eq.${encodeURIComponent(normalizedEmail)}&select=id`);
      if (check.data?.length > 0) return res.status(400).json({ message: 'Is email se account pehle se exist karta hai.' });
      const insert = await sb('users', 'POST', { email: normalizedEmail, password: String(password), name: String(name || '').trim(), mobile: String(mobile || '').trim(), level: 'Beginner', is_pro: 0, is_admin: 0 });
      if (!insert.ok) return res.status(500).json({ message: 'User save karne mein error aaya.' });
      return res.status(201).json({ message: 'Registration successful!', name: insert.data[0]?.name, email: insert.data[0]?.email });
    }

    if (path === 'auth/login' && req.method === 'POST') {
      const { email, password } = body;
      if (!email || !password) return res.status(400).json({ message: 'Email aur Password required hain.' });
      const normalizedEmail = String(email).trim().toLowerCase();
      const result = await sb(`users?email=eq.${encodeURIComponent(normalizedEmail)}&select=*`);
      if (!result.data?.length) return res.status(401).json({ message: 'Email ya password galat hai.' });
      const user = result.data[0];
      if (user.password !== String(password)) return res.status(401).json({ message: 'Email ya password galat hai.' });
      return res.status(200).json({ message: 'Login successful!', name: user.name, email: user.email, level: user.level, is_pro: user.is_pro, is_admin: user.is_admin });
    }

    // SYNC
    if (path === 'sync' && req.method === 'POST') {
      const { email, name, mobile, level, is_pro } = body;
      if (!email) return res.status(400).json({ error: 'Email required' });
      const check = await sb(`users?email=eq.${encodeURIComponent(email)}&select=*`);
      if (check.data?.length > 0) {
        const upd: any = {};
        if (name) upd.name = name;
        if (mobile) upd.mobile = mobile;
        if (level) upd.level = level;
        if (is_pro !== undefined) upd.is_pro = is_pro ? 1 : 0;
        await sb(`users?email=eq.${encodeURIComponent(email)}`, 'PATCH', upd);
        const updated = await sb(`users?email=eq.${encodeURIComponent(email)}&select=*`);
        return res.status(200).json(updated.data[0] || {});
      } else {
        await sb('users', 'POST', { email, name, mobile, level: level || 'Beginner', is_pro: is_pro ? 1 : 0, is_admin: 0 });
        return res.status(200).json({ email, name, level: level || 'Beginner' });
      }
    }

    // USERS
    if (path === 'users' && req.method === 'GET') {
      const result = await sb('users?select=*');
      return res.status(200).json(Array.isArray(result.data) ? result.data : []);
    }

    // PLANS
    if (path === 'plans' && req.method === 'GET') {
      const result = await sb('plans?select=*');
      return res.status(200).json(Array.isArray(result.data) ? result.data : []);
    }

    // MODULES
    if (path === 'modules' && req.method === 'GET') {
      const result = await sb('modules?select=*');
      return res.status(200).json(Array.isArray(result.data) ? result.data : []);
    }

    // ASSESSMENT QUESTIONS
    if (path === 'assessment-questions' && req.method === 'GET') {
      const result = await sb('assessment_questions?select=*');
      return res.status(200).json(Array.isArray(result.data) ? result.data : []);
    }

    // ADMIN STATS
    if (path === 'admin/stats' && req.method === 'GET') {
      const [usersRes, paymentsRes] = await Promise.all([
        sb('users?select=*'),
        sb('payments?select=*'),
      ]);
      const users = Array.isArray(usersRes.data) ? usersRes.data : [];
      const payments = Array.isArray(paymentsRes.data) ? paymentsRes.data : [];
      return res.status(200).json({
        totalUsers: users.length,
        proUsers: users.filter((u: any) => u.is_pro).length,
        revenue: payments.filter((p: any) => p.status === 'Success').reduce((s: number, p: any) => s + (p.amount || 0), 0),
        recentPayments: [],
        userGrowth: [],
      });
    }

    // ADMIN USERS
    if (path === 'admin/users' && req.method === 'GET') {
      const result = await sb('users?select=*');
      return res.status(200).json(Array.isArray(result.data) ? result.data : []);
    }
    if (path === 'admin/users/delete' && req.method === 'POST') {
      await sb(`users?id=eq.${body.id}`, 'DELETE');
      return res.status(200).json({ message: 'Deleted' });
    }
    if (path === 'admin/users/update-pro' && req.method === 'POST') {
      await sb(`users?id=eq.${body.id}`, 'PATCH', { is_pro: body.is_pro ? 1 : 0 });
      return res.status(200).json({ message: 'Updated' });
    }
    if (path === 'admin/users/update-admin' && req.method === 'POST') {
      await sb(`users?id=eq.${body.id}`, 'PATCH', { is_admin: body.is_admin ? 1 : 0 });
      return res.status(200).json({ message: 'Updated' });
    }
    if (path === 'admin/users/update' && req.method === 'POST') {
      const { id, name, email, mobile, level, is_pro, is_admin } = body;
      await sb(`users?id=eq.${id}`, 'PATCH', { name, email, mobile, level, is_pro, is_admin });
      return res.status(200).json({ message: 'Updated' });
    }

    // ADMIN PLANS
    if (path === 'admin/plans/create' && req.method === 'POST') {
      await sb('plans', 'POST', body);
      return res.status(201).json({ message: 'Created' });
    }
    if (path === 'admin/plans/update' && req.method === 'POST') {
      await sb(`plans?id=eq.${body.id}`, 'PATCH', { price: body.price, interval: body.interval });
      return res.status(200).json({ message: 'Updated' });
    }
    if (path === 'admin/plans/delete' && req.method === 'POST') {
      await sb(`plans?id=eq.${body.id}`, 'DELETE');
      return res.status(200).json({ message: 'Deleted' });
    }

    return res.status(404).json({ message: 'Route not found' });

  } catch (err: any) {
    console.error('API Error:', err);
    return res.status(500).json({ message: 'Server error', error: err.message });
  }
}
