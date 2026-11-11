const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');

const DEFAULT_SUPER_ADMIN = {
  name: process.env.SUPER_ADMIN_NAME || 'Super Administrator',
  email: (process.env.SUPER_ADMIN_EMAIL || 'superadmin@dit.ac.tz').trim().toLowerCase(),
  password: process.env.SUPER_ADMIN_PASSWORD || 'DitAdmin@2026',
};

/**
 * Ensures at least one active super_admin account exists in the database.
 */
async function ensureSuperAdmin(prismaClient) {
  const prisma = prismaClient || new PrismaClient();
  const shouldDisconnect = !prismaClient;

  try {
    const existingAdmin = await prisma.user.findFirst({
      where: { role: 'super_admin' },
    });
    if (existingAdmin) return existingAdmin;

    const existingByEmail = await prisma.user.findUnique({
      where: { email: DEFAULT_SUPER_ADMIN.email },
    });
    if (existingByEmail) {
      return await prisma.user.update({
        where: { id: existingByEmail.id },
        data: { role: 'super_admin', isActive: true },
      });
    }

    const hashed = await bcrypt.hash(DEFAULT_SUPER_ADMIN.password, 10);
    const created = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          name: DEFAULT_SUPER_ADMIN.name,
          email: DEFAULT_SUPER_ADMIN.email,
          password: hashed,
          role: 'super_admin',
          isActive: true,
        },
      });
      await tx.lecturer.create({
        data: {
          userId: user.id,
          name: DEFAULT_SUPER_ADMIN.name,
        },
      });
      return user;
    });

    console.log(`Seeded Super Admin account: ${DEFAULT_SUPER_ADMIN.email}`);
    return created;
  } finally {
    if (shouldDisconnect) await prisma.$disconnect();
  }
}

module.exports = { ensureSuperAdmin, DEFAULT_SUPER_ADMIN };
