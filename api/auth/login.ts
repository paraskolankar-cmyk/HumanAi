const fs = require('fs');

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

module.exports = function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const { email, password } = req.body || {};

  if (!email || !password) {
    return res.status(400).json({ message: 'Email aur password required hain.' });
  }

  const normalizedEmail = String(email).trim().toLowerCase();
  const users = loadUsers();
  const user = users.find((u) => u.email === normalizedEmail);

  if (!user || user.password !== String(password)) {
    return res.status(401).json({ message: 'Email ya password galat hai.' });
  }

  return res.status(200).json({
    message: 'Login successful',
    name: user.name,
    email: user.email,
    level: user.level || 'Beginner',
    is_pro: user.is_pro || 0,
  });
};
