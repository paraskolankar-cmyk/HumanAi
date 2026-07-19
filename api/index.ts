import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@libsql/client';

const client = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN!,
});

function setCors(res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
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

      const check = await client.execute({
        sql: 'SELECT id FROM users WHERE email = ?',
        args: [normalizedEmail],
      });
      if (check.rows.length > 0) {
        return res.status(400).json({ message: 'Is email se account pehle se exist karta hai.' });
      }

      await client.execute({
        sql: `INSERT INTO users (email, password, name, mobile, level, is_pro, is_admin)
              VALUES (?, ?, ?, ?, ?, ?, ?)`,
        args: [normalizedEmail, String(password), String(name || '').trim(), String(mobile || '').trim(), 'Beginner', 0, 0],
      });

      return res.status(201).json({ message: 'Registration successful!', name: String(name || '').trim(), email: normalizedEmail });
    }

    if (path === 'auth/login' && req.method === 'POST') {
      const { email, password } = body;
      if (!email || !password) return res.status(400).json({ message: 'Email aur Password required hain.' });

      const normalizedEmail = String(email).trim().toLowerCase();
      const result = await client.execute({
        sql: 'SELECT * FROM users WHERE email = ?',
        args: [normalizedEmail],
      });

      if (!result.rows.length) return res.status(401).json({ message: 'Email ya password galat hai.' });
      const user = result.rows[0] as any;
      if (user.password !== String(password)) return res.status(401).json({ message: 'Email ya password galat hai.' });

      return res.status(200).json({
        message: 'Login successful!',
        name: user.name,
        email: user.email,
        level: user.level,
        is_pro: user.is_pro,
        is_admin: user.is_admin,
      });
    }

    // SYNC
    if (path === 'sync' && req.method === 'POST') {
      const { email, name, mobile, level, is_pro } = body;
      if (!email) return res.status(400).json({ error: 'Email required' });

      const check = await client.execute({
        sql: 'SELECT * FROM users WHERE email = ?',
        args: [email],
      });

      if (check.rows.length > 0) {
        const updates: string[] = [];
        const args: any[] = [];
        if (name) { updates.push('name = ?'); args.push(name); }
        if (mobile) { updates.push('mobile = ?'); args.push(mobile); }
        if (level) { updates.push('level = ?'); args.push(level); }
        if (is_pro !== undefined) { updates.push('is_pro = ?'); args.push(is_pro ? 1 : 0); }

        if (updates.length > 0) {
          args.push(email);
          await client.execute({
            sql: `UPDATE users SET ${updates.join(', ')} WHERE email = ?`,
            args,
          });
        }

        const updated = await client.execute({
          sql: 'SELECT * FROM users WHERE email = ?',
          args: [email],
        });
        return res.status(200).json(updated.rows[0] || {});
      } else {
        await client.execute({
          sql: `INSERT INTO users (email, name, mobile, level, is_pro, is_admin)
                VALUES (?, ?, ?, ?, ?, ?)`,
          args: [email, name || '', mobile || '', level || 'Beginner', is_pro ? 1 : 0, 0],
        });
        return res.status(200).json({ email, name, level: level || 'Beginner' });
      }
    }

    // USERS
    if (path === 'users' && req.method === 'GET') {
      const result = await client.execute('SELECT * FROM users');
      return res.status(200).json(result.rows);
    }

    // PLANS
    if (path === 'plans' && req.method === 'GET') {
      const result = await client.execute('SELECT * FROM plans');
      return res.status(200).json(result.rows);
    }

    // MODULES
    if (path === 'modules' && req.method === 'GET') {
      const result = await client.execute('SELECT * FROM modules');
      return res.status(200).json(result.rows);
    }

    // ASSESSMENT QUESTIONS
    if (path === 'assessment-questions' && req.method === 'GET') {
      const result = await client.execute('SELECT * FROM assessment_questions');
      return res.status(200).json(result.rows);
    }

    // ADMIN STATS
    if (path === 'admin/stats' && req.method === 'GET') {
      const [usersRes, paymentsRes] = await Promise.all([
        client.execute('SELECT * FROM users'),
        client.execute('SELECT * FROM payments'),
      ]);
      const users = usersRes.rows as any[];
      const payments = paymentsRes.rows as any[];

      return res.status(200).json({
        totalUsers: users.length,
        proUsers: users.filter((u) => u.is_pro).length,
        revenue: payments.filter((p) => p.status === 'Success').reduce((s, p) => s + (p.amount || 0), 0),
        recentPayments: [],
        userGrowth: [],
      });
    }

    // ADMIN USERS
    if (path === 'admin/users' && req.method === 'GET') {
      const result = await client.execute('SELECT * FROM users');
      return res.status(200).json(result.rows);
    }

    if (path === 'admin/users/delete' && req.method === 'POST') {
      await client.execute({ sql: 'DELETE FROM users WHERE id = ?', args: [body.id] });
      return res.status(200).json({ message: 'Deleted' });
    }

    if (path === 'admin/users/update-pro' && req.method === 'POST') {
      await client.execute({
        sql: 'UPDATE users SET is_pro = ? WHERE id = ?',
        args: [body.is_pro ? 1 : 0, body.id],
      });
      return res.status(200).json({ message: 'Updated' });
    }

    if (path === 'admin/users/update-admin' && req.method === 'POST') {
      await client.execute({
        sql: 'UPDATE users SET is_admin = ? WHERE id = ?',
        args: [body.is_admin ? 1 : 0, body.id],
      });
      return res.status(200).json({ message: 'Updated' });
    }

    if (path === 'admin/users/update' && req.method === 'POST') {
      const { id, name, email, mobile, level, is_pro, is_admin } = body;
      await client.execute({
        sql: `UPDATE users SET name = ?, email = ?, mobile = ?, level = ?, is_pro = ?, is_admin = ? WHERE id = ?`,
        args: [name, email, mobile, level, is_pro ? 1 : 0, is_admin ? 1 : 0, id],
      });
      return res.status(200).json({ message: 'Updated' });
    }

    // ADMIN PLANS
    if (path === 'admin/plans/create' && req.method === 'POST') {
      const { name, price, interval, features } = body;
      await client.execute({
        sql: 'INSERT INTO plans (name, price, interval, features) VALUES (?, ?, ?, ?)',
        args: [name, price, interval, features || ''],
      });
      return res.status(201).json({ message: 'Created' });
    }

    if (path === 'admin/plans/update' && req.method === 'POST') {
      await client.execute({
        sql: 'UPDATE plans SET price = ?, interval = ? WHERE id = ?',
        args: [body.price, body.interval, body.id],
      });
      return res.status(200).json({ message: 'Updated' });
    }

    if (path === 'admin/plans/delete' && req.method === 'POST') {
      await client.execute({ sql: 'DELETE FROM plans WHERE id = ?', args: [body.id] });
      return res.status(200).json({ message: 'Deleted' });
    }

    return res.status(404).json({ message: 'Route not found' });

  } catch (err: any) {
    console.error('API Error:', err);
    return res.status(500).json({ message: 'Server error', error: err.message });
  }
}
