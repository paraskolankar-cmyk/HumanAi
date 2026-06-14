import type { NextApiRequest, NextApiResponse } from 'next';
import fs from 'fs';

const DB_PATH = '/tmp/humnai_users.json';

function loadUsers() {
  try {
    if (fs.existsSync(DB_PATH)) {
      return JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));
    }
  } catch (e) {
    console.error('DB load error:', e);
  }
  return [];
}

function saveUsers(users: any[]) {
  try {
    fs.writeFileSync(DB_PATH, JSON.stringify(users, null, 2), 'utf-8');
  } catch (e) {
    console.error('DB save error:', e);
  }
}

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const { email, password, name, mobile } = req.body || {};

  if (!email || !password) {
    return res.status(400).json({ message: 'Email aur Password required hain.' });
  }

  const normalizedEmail = String(email).trim().toLowerCase();

  if (String(password).length < 6) {
    return res.status(400).json({ message: 'Password kam se kam 6 characters ka hona chahiye.' });
  }

  const users = loadUsers();
  const existingUser = users.find((u: any) => u.email === normalizedEmail);

  if (existingUser) {
    return res.status(400).json({ message: 'Is email se account pehle se exist karta hai.' });
  }

  const newUser = {
    id: Date.now(),
    email: normalizedEmail,
    password: String(password),
    name: String(name || '').trim(),
    mobile: String(mobile || '').trim(),
    level: 'Beginner',
    is_pro: 0,
    is_admin: 0,
    createdAt: new Date().toISOString(),
  };

  users.push(newUser);
  saveUsers(users);

  return res.status(201).json({
    message: 'Registration successful!',
    name: newUser.name,
    email: newUser.email,
  });
}
