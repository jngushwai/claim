const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

/**
 * Verifies the authenticated user is active and holds the super_admin role.
 */
module.exports = async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { id: true, email: true, name: true, role: true, isActive: true },
    });
    if (!user) return res.status(401).json({ error: 'User not found' });
    if (!user.isActive) return res.status(403).json({ error: 'Account is disabled' });
    if (user.role !== 'super_admin') {
      return res.status(403).json({ error: 'Super Admin access required' });
    }
    req.adminUser = user;
    next();
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
