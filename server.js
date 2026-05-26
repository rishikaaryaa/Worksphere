const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');
const { PrismaClient } = require('@prisma/client');

const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || 5050;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(morgan('dev'));

// Static files for frontend
app.use(express.static(path.join(__dirname, 'public')));

// In-memory session/OTP maps (these don't need persistence)
const pendingOTPs = new Map();
const sessions = new Map();

// ==========================================
// SEED DEFAULT USERS
// ==========================================
async function seedDefaultUsers() {
  try {
    const count = await prisma.user.count();
    if (count === 0) {
      console.log('Seeding default users...');
      await prisma.user.createMany({
        data: [
          { id: 'usr_superadmin', name: 'Super Admin User', email: 'superadmin@office.com', password: 'SuperAdmin123!', role: 'super_admin' },
          { id: 'usr_admin', name: 'Admin User', email: 'admin@office.com', password: 'Admin123!', role: 'admin' },
          { id: 'usr_user', name: 'Standard Employee', email: 'user@office.com', password: 'User123!', role: 'user' }
        ]
      });
      console.log('Default users seeded successfully.');
    } else {
      console.log(`Database has ${count} users. Skipping seed.`);
    }
  } catch (error) {
    console.error('Failed to seed default users:', error);
  }
}

// ==========================================
// HELPERS
// ==========================================
async function addLog(userId, action, details, req) {
  try {
    let user = null;
    if (userId) {
      user = await prisma.user.findUnique({ where: { id: userId } });
    }
    const ip = req ? (req.headers['x-forwarded-for'] || req.socket.remoteAddress) : '127.0.0.1';
    await prisma.log.create({
      data: {
        userId: userId || null,
        userName: user ? user.name : 'System',
        email: user ? user.email : 'system@office.com',
        role: user ? user.role : 'system',
        action,
        details,
        ip
      }
    });
  } catch (err) {
    console.error('Logging failed:', err);
  }
}

async function sendSimulatedEmail(to, subject, body, type = 'general', otp = null) {
  try {
    await prisma.email.create({ data: { to, subject, body, type, otp } });
    console.log(`[SIMULATED EMAIL] To: ${to} | Subject: ${subject}`);
  } catch (err) {
    console.error('Failed to record simulated email:', err);
  }
}

// ==========================================
// RBAC
// ==========================================
const ROLES = { USER: 'user', ADMIN: 'admin', SUPER_ADMIN: 'super_admin' };
const ROLE_RANK = { [ROLES.USER]: 1, [ROLES.ADMIN]: 2, [ROLES.SUPER_ADMIN]: 3 };

function authenticate(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication token required' });
  }
  const token = authHeader.substring(7);
  const user = sessions.get(token);
  if (!user) {
    return res.status(401).json({ error: 'Invalid or expired session' });
  }
  req.user = user;
  req.token = token;
  next();
}

function requireRole(minRole) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    const userRank = ROLE_RANK[req.user.role] || 0;
    const minRank = ROLE_RANK[minRole] || 99;
    if (userRank >= minRank) next();
    else res.status(403).json({ error: `Forbidden: Requires minimum role of ${minRole}` });
  };
}

// ==========================================
// AUTH ROUTES
// ==========================================
app.post('/api/auth/signup', async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password) return res.status(400).json({ error: 'Name, email, and password are required' });
  const normalizedEmail = email.toLowerCase().trim();
  try {
    const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (existing) return res.status(400).json({ error: 'A user with this email already exists' });
    const newUser = await prisma.user.create({ data: { name, email: normalizedEmail, password, role: 'user' } });
    await sendSimulatedEmail(newUser.email, 'Welcome to Office 360 Work Portal!',
      `Hello ${newUser.name},\n\nYour account has been successfully created under the 'User' role.\n\nYou can now log in to the portal and start submitting work.\n\nBest Regards,\nHR Team`, 'welcome');
    await addLog(newUser.id, 'SIGNUP', 'User signed up via registration portal', req);
    res.status(201).json({ message: 'User registered successfully', userId: newUser.id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error during registration' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password are required' });
  try {
    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });
    if (!user || user.password !== password) return res.status(401).json({ error: 'Invalid email or password' });
    const token = 'tok_' + Math.random().toString(36).substr(2, 9) + Math.random().toString(36).substr(2, 9);
    sessions.set(token, user);
    await addLog(user.id, 'LOGIN', `User successfully logged in as ${user.role.toUpperCase()}`, req);
    res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error during login' });
  }
});

app.get('/api/auth/me', authenticate, (req, res) => {
  res.json({ id: req.user.id, name: req.user.name, email: req.user.email, role: req.user.role });
});

app.post('/api/auth/forgot-password', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email is required' });
  try {
    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });
    if (!user) return res.status(404).json({ error: 'User with this email does not exist' });
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    pendingOTPs.set(user.email.toLowerCase(), { otp, expiresAt: Date.now() + 10 * 60 * 1000 });
    await sendSimulatedEmail(user.email, 'Reset Password OTP - Office 360',
      `Hello ${user.name},\n\nWe received a request to reset your password.\nYour One-Time Password (OTP) is: ${otp}\n\nThis OTP will expire in 10 minutes.\n\nBest Regards,\nSecurity Team`, 'otp', otp);
    res.json({ message: 'OTP sent successfully to your email.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error requesting OTP' });
  }
});

app.post('/api/auth/reset-password', async (req, res) => {
  const { email, otp, newPassword } = req.body;
  if (!email || !otp || !newPassword) return res.status(400).json({ error: 'Email, OTP, and new password are required' });
  const normalizedEmail = email.toLowerCase().trim();
  const record = pendingOTPs.get(normalizedEmail);
  if (!record) return res.status(400).json({ error: 'No pending reset request for this email' });
  if (record.otp !== otp) return res.status(400).json({ error: 'Invalid One-Time Password (OTP)' });
  if (Date.now() > record.expiresAt) { pendingOTPs.delete(normalizedEmail); return res.status(400).json({ error: 'OTP has expired' }); }
  try {
    const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (!user) return res.status(404).json({ error: 'User no longer exists' });
    await prisma.user.update({ where: { id: user.id }, data: { password: newPassword } });
    pendingOTPs.delete(normalizedEmail);
    await addLog(user.id, 'PASSWORD_RESET', 'User reset password via OTP authentication', req);
    res.json({ message: 'Password has been reset successfully. You can now log in.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error resetting password' });
  }
});

app.post('/api/auth/logout', authenticate, async (req, res) => {
  await addLog(req.user.id, 'LOGOUT', 'User logged out', req);
  sessions.delete(req.token);
  res.json({ message: 'Logged out successfully' });
});

// ==========================================
// WORK ROUTES
// ==========================================
app.post('/api/work', authenticate, async (req, res) => {
  const { clientName, clientEmail, notes } = req.body;
  if (!clientName || !clientEmail) return res.status(400).json({ error: 'Client Name and Client Email are required' });
  try {
    const workEntry = await prisma.work.create({
      data: { userId: req.user.id, userName: req.user.name, clientName, clientEmail, notes: notes || '' }
    });
    await addLog(req.user.id, 'WORK_SUBMITTED', `Submitted work for client: ${clientName} (${clientEmail})`, req);
    res.status(201).json({ message: 'Work saved successfully', work: workEntry });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error saving work' });
  }
});

app.get('/api/work', authenticate, async (req, res) => {
  try {
    let records;
    if (ROLE_RANK[req.user.role] >= ROLE_RANK[ROLES.ADMIN]) {
      records = await prisma.work.findMany({ orderBy: { createdAt: 'desc' } });
    } else {
      records = await prisma.work.findMany({ where: { userId: req.user.id }, orderBy: { createdAt: 'desc' } });
    }
    res.json(records);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error fetching work' });
  }
});

app.delete('/api/work/:id', authenticate, requireRole(ROLES.SUPER_ADMIN), async (req, res) => {
  try {
    const existing = await prisma.work.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'Work record not found' });
    await prisma.work.delete({ where: { id: req.params.id } });
    await addLog(req.user.id, 'WORK_DELETED', `Super Admin deleted work record ID: ${req.params.id}`, req);
    res.json({ message: 'Work record deleted successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error deleting work' });
  }
});

// ==========================================
// USER MANAGEMENT ROUTES
// ==========================================
app.get('/api/users', authenticate, requireRole(ROLES.ADMIN), async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      select: { id: true, name: true, email: true, role: true, createdAt: true },
      orderBy: { createdAt: 'desc' }
    });
    res.json(users);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error fetching users' });
  }
});

app.post('/api/users', authenticate, requireRole(ROLES.SUPER_ADMIN), async (req, res) => {
  const { name, email, password, role } = req.body;
  if (!name || !email || !password || !role) return res.status(400).json({ error: 'Name, email, password, and role are required' });
  const normalizedEmail = email.toLowerCase().trim();
  try {
    const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (existing) return res.status(400).json({ error: 'User with this email already exists' });
    if (!Object.values(ROLES).includes(role)) return res.status(400).json({ error: 'Invalid role' });
    const newUser = await prisma.user.create({ data: { name, email: normalizedEmail, password, role } });
    await sendSimulatedEmail(newUser.email, `Account Created - Role: ${role.toUpperCase()}`,
      `Hello ${newUser.name},\n\nYour administrator has created an account for you.\n\nRole: ${role}\nTemp Password: ${password}\n\nPlease log in and change your password.\n\nBest Regards,\nIT Administration`, 'welcome');
    await addLog(req.user.id, 'USER_CREATED', `Super Admin created user: ${newUser.email} as ${role}`, req);
    res.status(201).json({ message: 'User created successfully', user: { id: newUser.id, name: newUser.name, email: newUser.email, role: newUser.role } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error creating user' });
  }
});

app.delete('/api/users/:id', authenticate, requireRole(ROLES.SUPER_ADMIN), async (req, res) => {
  if (req.user.id === req.params.id) return res.status(400).json({ error: 'You cannot delete your own account' });
  try {
    const target = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!target) return res.status(404).json({ error: 'User not found' });
    if (target.role === ROLES.SUPER_ADMIN && target.id === 'usr_superadmin') return res.status(400).json({ error: 'Cannot delete the master Super Admin account' });
    await prisma.user.delete({ where: { id: req.params.id } });
    await addLog(req.user.id, 'USER_DELETED', `Super Admin deleted user: ${target.email}`, req);
    res.json({ message: 'User deleted successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error deleting user' });
  }
});

app.post('/api/users/:id/change-password', authenticate, requireRole(ROLES.SUPER_ADMIN), async (req, res) => {
  const { newPassword } = req.body;
  if (!newPassword) return res.status(400).json({ error: 'New password is required' });
  try {
    const target = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!target) return res.status(404).json({ error: 'User not found' });
    await prisma.user.update({ where: { id: req.params.id }, data: { password: newPassword } });
    await addLog(req.user.id, 'PASSWORD_CHANGED_BY_ADMIN', `Super Admin changed password for: ${target.email}`, req);
    res.json({ message: 'Password changed successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error changing password' });
  }
});

// ==========================================
// LOGS ROUTES
// ==========================================
app.get('/api/logs', authenticate, async (req, res) => {
  try {
    let logs;
    if (req.user.role === ROLES.SUPER_ADMIN) {
      logs = await prisma.log.findMany({ orderBy: { timestamp: 'desc' } });
    } else if (req.user.role === ROLES.ADMIN) {
      logs = await prisma.log.findMany({ where: { NOT: { role: ROLES.SUPER_ADMIN } }, orderBy: { timestamp: 'desc' } });
    } else {
      logs = await prisma.log.findMany({ where: { userId: req.user.id }, orderBy: { timestamp: 'desc' } });
    }
    res.json(logs);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error retrieving logs' });
  }
});

// ==========================================
// SIMULATED EMAIL ROUTES
// ==========================================
app.get('/api/debug/emails', async (req, res) => {
  try {
    let user = null;
    const authHeader = req.headers['authorization'];
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      user = sessions.get(token);
    }

    const emailParam = req.query.email ? req.query.email.toLowerCase().trim() : null;
    const emails = await prisma.email.findMany({ orderBy: { timestamp: 'desc' } });

    if (user) {
      if (user.role === 'super_admin') {
        return res.json(emails);
      }

      const dbUsers = await prisma.user.findMany({ select: { email: true, role: true } });
      const emailToRole = new Map();
      dbUsers.forEach(u => emailToRole.set(u.email.toLowerCase().trim(), u.role));

      if (user.role === 'admin') {
        const filtered = emails.filter(em => {
          const toEmail = em.to.toLowerCase().trim();
          if (toEmail === user.email.toLowerCase().trim()) return true;
          return emailToRole.get(toEmail) === 'user';
        });
        return res.json(filtered);
      } else {
        const filtered = emails.filter(em => em.to.toLowerCase().trim() === user.email.toLowerCase().trim());
        return res.json(filtered);
      }
    }

    if (emailParam) {
      const filtered = emails.filter(em => em.to.toLowerCase().trim() === emailParam);
      return res.json(filtered);
    }

    return res.json([]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error fetching emails' });
  }
});

app.post('/api/debug/emails/clear', async (req, res) => {
  try {
    let user = null;
    const authHeader = req.headers['authorization'];
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      user = sessions.get(token);
    }

    const emailParam = req.query.email ? req.query.email.toLowerCase().trim() : null;

    if (user) {
      if (user.role === 'super_admin') {
        await prisma.email.deleteMany({});
        return res.json({ message: 'All emails cleared' });
      }

      const dbUsers = await prisma.user.findMany({ select: { email: true, role: true } });
      const emailToRole = new Map();
      dbUsers.forEach(u => emailToRole.set(u.email.toLowerCase().trim(), u.role));

      if (user.role === 'admin') {
        const emails = await prisma.email.findMany();
        const idsToDelete = emails
          .filter(em => {
            const toEmail = em.to.toLowerCase().trim();
            if (toEmail === user.email.toLowerCase().trim()) return true;
            return emailToRole.get(toEmail) === 'user';
          })
          .map(em => em.id);
        
        await prisma.email.deleteMany({ where: { id: { in: idsToDelete } } });
        return res.json({ message: 'Admin and standard user emails cleared' });
      } else {
        await prisma.email.deleteMany({ where: { to: { equals: user.email, mode: 'insensitive' } } });
        return res.json({ message: 'Your emails cleared' });
      }
    }

    if (emailParam) {
      await prisma.email.deleteMany({ where: { to: { equals: emailParam, mode: 'insensitive' } } });
      return res.json({ message: `Emails for ${emailParam} cleared` });
    }

    return res.status(401).json({ error: 'Authentication required to clear mailbox' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error clearing emails' });
  }
});

// ==========================================
// START SERVER
// ==========================================
async function startServer() {
  await seedDefaultUsers();
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Open http://localhost:${PORT} in your browser`);
  });
}

startServer();
