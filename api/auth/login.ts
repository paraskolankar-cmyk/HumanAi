import type { VercelRequest, VercelResponse } from '@vercel/node';
import fs from 'fs';

const DB_PATH = '/tmp/humanai_users.json';

function loadUsers(): any[] {
  try {
    if (fs.existsSync(DB_PATH)) {
      return JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));
    }
  } catch (e) {}
  return [];
}

export default function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ message: 'Method not allowed' });

  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: 'Email aur password required hain.' });
  }

  const normalizedEmail = email.trim().toLowerCase();
  const users = loadUsers();

  const user = users.find((u: any) => u.email === normalizedEmail);

  if (!user || user.password !== password) {
    return res.status(401).json({ message: 'Email ya password galat hai.' });
  }

  return res.json({ 
    message: 'Login successful', 
    name: user.name, 
    email: user.email 
  });
}
