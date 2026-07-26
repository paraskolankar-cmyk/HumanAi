import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@libsql/client';

const client = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN!,
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const body = req.body || {};
  const email = body.email || req.query.email;

  if (!email) {
    return res.status(400).json({ error: 'Email required' });
  }

  const normalizedEmail = String(email).trim().toLowerCase();

  try {
    // 1. Check if user exists
    const userRes = await client.execute({
      sql: 'SELECT * FROM users WHERE email = ?',
      args: [normalizedEmail],
    });

    if (userRes.rows.length === 0) {
      // If user does not exist during POST request, create user automatically
      if (req.method === 'POST') {
        await client.execute({
          sql: `INSERT INTO users (email, name, mobile, level, is_pro, is_admin)
                VALUES (?, ?, ?, ?, ?, ?)`,
          args: [
            normalizedEmail,
            body.name || '',
            body.mobile || '',
            body.level || 'Beginner',
            body.is_pro ? 1 : 0,
            0
          ],
        });
      } else {
        return res.status(404).json({ message: 'User not found' });
      }
    }

    // 2. Handle POST Updates (Time spent, Streak, Pro status, Level, Name, etc.)
    if (req.method === 'POST') {
      const { name, mobile, level, is_pro, time_spent, streak, goal_progress, achievements } = body;
      
      const updates: string[] = [];
      const args: any[] = [];

      if (name !== undefined) { updates.push('name = ?'); args.push(String(name).trim()); }
      if (mobile !== undefined) { updates.push('mobile = ?'); args.push(String(mobile).trim()); }
      if (level !== undefined) { updates.push('level = ?'); args.push(level); }
      if (is_pro !== undefined) { updates.push('is_pro = ?'); args.push(is_pro ? 1 : 0); }
      if (time_spent !== undefined) { updates.push('time_spent = ?'); args.push(Number(time_spent)); }
      if (streak !== undefined) { updates.push('streak = ?'); args.push(Number(streak)); }
      if (goal_progress !== undefined) { updates.push('goal_progress = ?'); args.push(Number(goal_progress)); }
      if (achievements !== undefined) { updates.push('achievements = ?'); args.push(Number(achievements)); }

      if (updates.length > 0) {
        args.push(normalizedEmail);
        await client.execute({
          sql: `UPDATE users SET ${updates.join(', ')} WHERE email = ?`,
          args,
        });
      }
    }

    // 3. Fetch latest database state for user
    const updatedUserRes = await client.execute({
      sql: 'SELECT * FROM users WHERE email = ?',
      args: [normalizedEmail],
    });
    
    const freshUser = updatedUserRes.rows[0] as any;

    // Return full profile state including Pro Status & Dynamic Stats
    return res.status(200).json({
      id: freshUser.id,
      email: freshUser.email,
      name: freshUser.name || '',
      mobile: freshUser.mobile || '',
      level: freshUser.level || 'Beginner',
      is_pro: Boolean(freshUser.is_pro), // Ensure Pro status is returned as boolean
      is_admin: Boolean(freshUser.is_admin),
      streak: freshUser.streak ?? 0,
      time_spent: freshUser.time_spent ?? 0,
      goal_progress: freshUser.goal_progress ?? 0,
      achievements: freshUser.achievements ?? 0,
      graph_data: [
        { day: 'Mon', progress: freshUser.mon_progress ?? 10 },
        { day: 'Tue', progress: freshUser.tue_progress ?? 25 },
        { day: 'Wed', progress: freshUser.wed_progress ?? 40 },
        { day: 'Thu', progress: freshUser.thu_progress ?? 30 },
        { day: 'Fri', progress: freshUser.fri_progress ?? 60 },
        { day: 'Sat', progress: freshUser.sat_progress ?? 80 },
        { day: 'Sun', progress: freshUser.sun_progress ?? freshUser.goal_progress ?? 90 },
      ]
    });

  } catch (err: any) {
    console.error('Sync API Error:', err);
    return res.status(500).json({ message: 'Server error', error: err.message });
  }
}
