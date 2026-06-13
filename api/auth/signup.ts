import type { VercelRequest, VercelResponse } from '@vercel/node';
import fs from 'fs';
import path from 'path';

const DB_PATH = '/tmp/humanai_users.json';

function loadUsers(): any[] {
  try {
    if (fs.existsSync(DB_PATH)) {
      return JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));
    }
  } catch (e) {}
  return []; // pehli baar empty
}

function saveUsers(users: any[]) {
  fs.writeFileSync(DB_PATH, JSON.stringify(users, null, 2), 'utf-8');
}

export default function handler(req: VercelRequest, res: VercelResponse) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ message: 'Method not allowed' });

  const { email, password, name, mobile } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: 'Email aur Password required hain.' });
  }

  const normalizedEmail = email.trim().toLowerCase();
  const users = loadUsers();

  const existingUser = users.find((u: any) => u.email === normalizedEmail);
  if (existingUser) {
    return res.status(400).json({ message: 'Is email se user pehle se registered hai.' });
  }

  const newUser = {
    id: Date.now(),
    email: normalizedEmail,
    password, // Production mein bcrypt use karo
    name: name || '',
    mobile: mobile || '',
    level: 'Beginner',
    is_pro: 0,
    is_admin: 0,
    createdAt: new Date().toISOString()
  };

  users.push(newUser);
  saveUsers(users);

  return res.status(201).json({ 
    message: 'Registration successful!', 
    name: newUser.name 
  });
}
