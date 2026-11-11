const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
const authMiddleware = require('../middleware/auth');
const { verifyGoogleIdToken } = require('../services/googleAuth');

const prisma = new PrismaClient();
const SECRET = process.env.JWT_SECRET || 'dit-claims-secret-2024';

function buildAuthResponse(user) {
  const role = user.role || 'lecturer';
  const token = jwt.sign(
    { id: user.id, email: user.email, name: user.name, role },
    SECRET,
    { expiresIn: '30d' }
  );
  return {
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role,
      isActive: user.isActive !== false,
      hasPassword: Boolean(user.password),
      googleLinked: Boolean(user.googleId),
    },
  };
}

router.get('/google/config', (req, res) => {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim() || null;
  res.json({ enabled: Boolean(clientId), clientId });
});

router.post('/google', async (req, res) => {
  try {
    const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
    const { googleId, email, name } = await verifyGoogleIdToken(req.body?.credential, clientId);

    let user = await prisma.user.findUnique({ where: { googleId } });

    if (!user) {
      const existingByEmail = await prisma.user.findUnique({ where: { email } });
      if (existingByEmail) {
        if (existingByEmail.googleId && existingByEmail.googleId !== googleId) {
          return res.status(409).json({ error: 'This email is already linked to a different Google account' });
        }
        user = await prisma.user.update({
          where: { id: existingByEmail.id },
          data: { googleId },
        });
      } else {
        user = await prisma.$transaction(async (tx) => {
          const created = await tx.user.create({
            data: { name, email, googleId, password: null },
          });
          await tx.lecturer.create({
            data: { userId: created.id, name },
          });
          return created;
        });
      }
    }

    if (user.isActive === false) {
      return res.status(403).json({ error: 'This account has been disabled by an administrator' });
    }
    res.json(buildAuthResponse(user));
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message });
  }
});

router.post('/register', async (req, res) => {
  try {
    const name = req.body?.name?.trim();
    const email = req.body?.email?.trim().toLowerCase();
    const password = req.body?.password;
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email, and password are required' });
    }
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return res.status(400).json({ error: 'Email already registered' });
    const hashed = await bcrypt.hash(password, 10);
    const user = await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({ data: { name, email, password: hashed } });
      await tx.lecturer.create({
        data: { userId: created.id, name },
      });
      return created;
    });
    res.json(buildAuthResponse(user));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/login', async (req, res) => {
  try {
    const rawEmail = req.body?.email?.trim();
    const email = rawEmail?.toLowerCase();
    const password = req.body?.password;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }
    let user = await prisma.user.findUnique({ where: { email } });
    if (!user && rawEmail !== email) {
      user = await prisma.user.findUnique({ where: { email: rawEmail } });
    }
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });
    if (user.isActive === false) {
      return res.status(403).json({ error: 'This account has been disabled by an administrator' });
    }
    if (!user.password) {
      return res.status(401).json({ error: 'This account uses Google Sign-In. Please continue with Google.' });
    }
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });
    res.json(buildAuthResponse(user));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/me', authMiddleware, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (user.isActive === false) {
      return res.status(403).json({ error: 'This account has been disabled by an administrator' });
    }
    res.json({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role || 'lecturer',
      isActive: user.isActive !== false,
      hasPassword: Boolean(user.password),
      googleLinked: Boolean(user.googleId),
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/change-password', authMiddleware, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters' });
    }
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (user.password) {
      const valid = await bcrypt.compare(currentPassword || '', user.password);
      if (!valid) return res.status(401).json({ error: 'Current password is incorrect' });
    }
    const hashed = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({ where: { id: user.id }, data: { password: hashed } });
    res.json({
      ok: true,
      hasPassword: true,
      message: user.password ? 'Password changed successfully' : 'Password set successfully',
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
