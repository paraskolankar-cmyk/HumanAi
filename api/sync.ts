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
    // 1. Fetch user data
    const userRes = await client.execute({
      sql: 'SELECT * FROM users WHERE email = ?',
      args: [normalizedEmail],
    });

    if (userRes.rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    const user = userRes.rows[0] as any;

    // 2. Handle POST Updates (Time spent, Streak, Lessons Completed)
    if (req.method === 'POST') {
      const { time_spent, streak, goal_progress, achievements } = body;
      
      const updates: string[] = [];
      const args: any[] = [];

      if (time_spent !== undefined) { updates.push('time_spent = ?'); args.push(time_spent); }
      if (streak !== undefined) { updates.push('streak = ?'); args.push(streak); }
      if (goal_progress !== undefined) { updates.push('goal_progress = ?'); args.push(goal_progress); }
      if (achievements !== undefined) { updates.push('achievements = ?'); args.push(achievements); }

      if (updates.length > 0) {
        args.push(normalizedEmail);
        await client.execute({
          sql: `UPDATE users SET ${updates.join(', ')} WHERE email = ?`,
          args,
        });
      }
    }

    // 3. Fetch latest dynamic values
    const updatedUserRes = await client.execute({
      sql: 'SELECT * FROM users WHERE email = ?',
      args: [normalizedEmail],
    });
    
    const freshUser = updatedUserRes.rows[0] as any;

    // Dynamic fallback values if columns are empty
    return res.status(200).json({
      streak: freshUser.streak ?? 0,
      time_spent: freshUser.time_spent ?? 0,
      goal_progress: freshUser.goal_progress ?? 0,
      achievements: freshUser.achievements ?? 0,
      graph_data: [
        { day: 'Mon', progress: freshUser.mon_progress || 10 },
        { day: 'Tue', progress: freshUser.tue_progress || 25 },
        { day: 'Wed', progress: freshUser.wed_progress || 40 },
        { day: 'Thu', progress: freshUser.thu_progress || 30 },
        { day: 'Fri', progress: freshUser.fri_progress || 60 },
        { day: 'Sat', progress: freshUser.sat_progress || 80 },
        { day: 'Sun', progress: freshUser.sun_progress || freshUser.goal_progress || 90 },
      ]
    });

  } catch (err: any) {
    console.error('Sync API Error:', err);
    return res.status(500).json({ message: 'Server error', error: err.message });
  }
}
