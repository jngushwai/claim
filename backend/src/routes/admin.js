const router = require('express').Router();
const bcrypt = require('bcryptjs');
const ExcelJS = require('exceljs');
const { PrismaClient } = require('@prisma/client');
const auth = require('../middleware/auth');
const superAdmin = require('../middleware/superAdmin');

const prisma = new PrismaClient();
const SHORT_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const FULL_MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const VALID_ROLES = new Set(['lecturer', 'super_admin']);

router.use(auth, superAdmin);

function buildPeriodPrefix(month, year) {
  if (!year) return null;
  if (month) return `${year}-${String(month).padStart(2, '0')}`;
  return `${year}-`;
}

router.get('/overview', async (req, res) => {
  try {
    const [users, allSessions] = await Promise.all([
      prisma.user.findMany({
        select: { id: true, name: true, email: true, role: true, isActive: true },
      }),
      prisma.session.findMany({
        include: { module: true, class: true },
        orderBy: [{ date: 'desc' }, { startTime: 'desc' }],
      }),
    ]);

    const userMap = new Map(users.map(u => [u.id, u]));
    const monthly = {};
    let totalHours = 0;
    let totalTuition = 0;
    let totalTransport = 0;
    let totalGross = 0;

    for (const s of allSessions) {
      totalHours += s.hours;
      totalTuition += s.tuition;
      totalTransport += s.transport;
      totalGross += s.gross;

      const key = s.date.substring(0, 7);
      if (!monthly[key]) monthly[key] = { tuition: 0, transport: 0, hours: 0, sessions: 0 };
      monthly[key].tuition += s.tuition;
      monthly[key].transport += s.transport;
      monthly[key].hours += s.hours;
      monthly[key].sessions += 1;
    }

    const monthlyChart = Object.entries(monthly)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-12)
      .map(([k, v]) => {
        const [y, m] = k.split('-');
        return {
          month: k,
          label: `${SHORT_MONTHS[parseInt(m, 10) - 1] || m} ${y}`,
          ...v,
        };
      });

    const recentSessions = allSessions.slice(0, 10).map(s => ({
      ...s,
      lecturerName: userMap.get(s.userId)?.name || `User #${s.userId}`,
      lecturerEmail: userMap.get(s.userId)?.email || '',
    }));

    res.json({
      stats: {
        totalUsers: users.length,
        activeUsers: users.filter(u => u.isActive).length,
        superAdmins: users.filter(u => u.role === 'super_admin').length,
        lecturers: users.filter(u => u.role === 'lecturer').length,
        totalSessions: allSessions.length,
        totalHours,
        totalTuition,
        totalTransport,
        totalGross,
      },
      monthlyChart,
      recentSessions,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/users', async (req, res) => {
  try {
    const [users, sessionStats] = await Promise.all([
      prisma.user.findMany({
        include: { lecturer: true },
        orderBy: [{ role: 'asc' }, { createdAt: 'desc' }],
      }),
      prisma.session.groupBy({
        by: ['userId'],
        _count: { _all: true },
        _sum: { hours: true, gross: true, tuition: true, transport: true },
      }),
    ]);

    const statsByUser = new Map(sessionStats.map(s => [s.userId, s]));

    res.json(users.map(u => {
      const st = statsByUser.get(u.id);
      return {
        id: u.id,
        name: u.name,
        email: u.email,
        role: u.role,
        isActive: u.isActive,
        hasPassword: Boolean(u.password),
        googleLinked: Boolean(u.googleId),
        createdAt: u.createdAt,
        lecturer: u.lecturer,
        stats: {
          sessions: st?._count?._all || 0,
          hours: st?._sum?.hours || 0,
          tuition: st?._sum?.tuition || 0,
          transport: st?._sum?.transport || 0,
          gross: st?._sum?.gross || 0,
        },
      };
    }));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/users', async (req, res) => {
  try {
    const name = req.body?.name?.trim();
    const email = req.body?.email?.trim().toLowerCase();
    const password = req.body?.password;
    const role = VALID_ROLES.has(req.body?.role) ? req.body.role : 'lecturer';

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email, and password are required' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return res.status(400).json({ error: 'Email already registered' });

    const hashed = await bcrypt.hash(password, 10);
    const created = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: { name, email, password: hashed, role, isActive: true },
      });
      const lecturer = await tx.lecturer.create({
        data: {
          userId: user.id,
          name,
          accountName: '',
          department: req.body?.department?.trim() || '',
          degreeRate: parseInt(req.body?.degreeRate, 10) || 0,
          odRate: parseInt(req.body?.odRate, 10) || 0,
          transportRate: parseInt(req.body?.transportRate, 10) || 0,
        },
      });
      return { user, lecturer };
    });

    res.status(201).json({
      id: created.user.id,
      name: created.user.name,
      email: created.user.email,
      role: created.user.role,
      isActive: created.user.isActive,
      hasPassword: true,
      googleLinked: false,
      createdAt: created.user.createdAt,
      lecturer: created.lecturer,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.patch('/users/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid user ID' });

    const existing = await prisma.user.findUnique({
      where: { id },
      include: { lecturer: true },
    });
    if (!existing) return res.status(404).json({ error: 'User not found' });

    const { name, email, role, isActive, lecturer } = req.body || {};

    if (id === req.user.id) {
      if (isActive === false) {
        return res.status(400).json({ error: 'You cannot disable your own Super Admin account' });
      }
      if (role && role !== 'super_admin') {
        return res.status(400).json({ error: 'You cannot demote your own Super Admin account' });
      }
    }

    const userUpdate = {};
    if (typeof name === 'string' && name.trim()) userUpdate.name = name.trim();
    if (typeof email === 'string' && email.trim()) {
      const normalized = email.trim().toLowerCase();
      if (normalized !== existing.email) {
        const dup = await prisma.user.findUnique({ where: { email: normalized } });
        if (dup) return res.status(400).json({ error: 'Email already in use' });
        userUpdate.email = normalized;
      }
    }
    if (role !== undefined) {
      if (!VALID_ROLES.has(role)) return res.status(400).json({ error: 'Invalid role' });
      userUpdate.role = role;
    }
    if (typeof isActive === 'boolean') userUpdate.isActive = isActive;

    const updated = await prisma.$transaction(async (tx) => {
      const user = await tx.user.update({ where: { id }, data: userUpdate });
      let updatedLecturer = existing.lecturer;
      if (lecturer && typeof lecturer === 'object') {
        const lData = {
          name: userUpdate.name || lecturer.name || existing.lecturer?.name || user.name,
          department: lecturer.department ?? existing.lecturer?.department ?? '',
          address: lecturer.address ?? existing.lecturer?.address ?? '',
          bank: lecturer.bank ?? existing.lecturer?.bank ?? '',
          branch: lecturer.branch ?? existing.lecturer?.branch ?? '',
          accountNo: lecturer.accountNo ?? existing.lecturer?.accountNo ?? '',
          accountName: lecturer.accountName ?? existing.lecturer?.accountName ?? '',
          academicYear: lecturer.academicYear ?? existing.lecturer?.academicYear ?? '',
          degreeRate: lecturer.degreeRate !== '' && Number.isFinite(Number(lecturer.degreeRate)) ? parseInt(lecturer.degreeRate, 10) : (existing.lecturer?.degreeRate ?? 0),
          odRate: lecturer.odRate !== '' && Number.isFinite(Number(lecturer.odRate)) ? parseInt(lecturer.odRate, 10) : (existing.lecturer?.odRate ?? 0),
          transportRate: lecturer.transportRate !== '' && Number.isFinite(Number(lecturer.transportRate)) ? parseInt(lecturer.transportRate, 10) : (existing.lecturer?.transportRate ?? 0),
        };
        if (existing.lecturer) {
          updatedLecturer = await tx.lecturer.update({ where: { userId: id }, data: lData });
        } else {
          updatedLecturer = await tx.lecturer.create({ data: { userId: id, ...lData } });
        }
      } else if (userUpdate.name && existing.lecturer) {
        updatedLecturer = await tx.lecturer.update({
          where: { userId: id },
          data: { name: userUpdate.name },
        });
      }
      return { user, lecturer: updatedLecturer };
    });

    res.json({
      id: updated.user.id,
      name: updated.user.name,
      email: updated.user.email,
      role: updated.user.role,
      isActive: updated.user.isActive,
      hasPassword: Boolean(updated.user.password),
      googleLinked: Boolean(updated.user.googleId),
      createdAt: updated.user.createdAt,
      lecturer: updated.lecturer,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/users/:id/reset-password', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const newPassword = req.body?.newPassword;
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid user ID' });
    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }
    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: 'User not found' });

    const hashed = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({ where: { id }, data: { password: hashed } });
    res.json({ ok: true, message: 'Password reset successfully' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.delete('/users/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid user ID' });
    if (id === req.user.id) {
      return res.status(400).json({ error: 'You cannot delete your own Super Admin account' });
    }
    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: 'User not found' });

    await prisma.$transaction(async (tx) => {
      await tx.session.deleteMany({ where: { userId: id } });
      await tx.timetableEntry.deleteMany({ where: { userId: id } });
      await tx.module.deleteMany({ where: { userId: id } });
      await tx.class.deleteMany({ where: { userId: id } });
      await tx.lecturer.deleteMany({ where: { userId: id } });
      await tx.user.delete({ where: { id } });
    });

    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

async function queryClaimsData({ month, year, userId, programme }) {
  const where = {};
  const prefix = buildPeriodPrefix(month, year);
  if (prefix) where.date = { startsWith: prefix };
  if (userId) where.userId = parseInt(userId, 10);
  if (programme && programme !== 'ALL') where.programme = programme;

  const [users, sessions] = await Promise.all([
    prisma.user.findMany({
      include: { lecturer: true },
      orderBy: { name: 'asc' },
    }),
    prisma.session.findMany({
      where,
      include: { module: true, class: true },
      orderBy: [{ date: 'desc' }, { startTime: 'asc' }],
    }),
  ]);

  const userMap = new Map(users.map(u => [u.id, u]));
  const summaryMap = new Map();

  for (const s of sessions) {
    const u = userMap.get(s.userId);
    if (!summaryMap.has(s.userId)) {
      summaryMap.set(s.userId, {
        userId: s.userId,
        name: u?.lecturer?.name || u?.name || `User #${s.userId}`,
        email: u?.email || '',
        department: u?.lecturer?.department || '',
        bank: u?.lecturer?.bank || '',
        accountNo: u?.lecturer?.accountNo || '',
        accountName: u?.lecturer?.accountName || '',
        sessions: 0,
        hours: 0,
        tuition: 0,
        transport: 0,
        gross: 0,
      });
    }
    const row = summaryMap.get(s.userId);
    row.sessions += 1;
    row.hours += s.hours;
    row.tuition += s.tuition;
    row.transport += s.transport;
    row.gross += s.gross;
  }

  const summaryByLecturer = Array.from(summaryMap.values()).sort((a, b) => b.gross - a.gross);
  const enrichedSessions = sessions.map(s => ({
    ...s,
    lecturerName: userMap.get(s.userId)?.lecturer?.name || userMap.get(s.userId)?.name || `User #${s.userId}`,
    lecturerEmail: userMap.get(s.userId)?.email || '',
  }));

  return { summaryByLecturer, sessions: enrichedSessions };
}

router.get('/claims', async (req, res) => {
  try {
    const { month, year, userId, programme } = req.query;
    const data = await queryClaimsData({ month, year, userId, programme });
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/claims/excel', async (req, res) => {
  try {
    const { month, year, userId, programme } = req.query;
    const { summaryByLecturer } = await queryClaimsData({ month, year, userId, programme });

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Claims Summary');
    const periodLabel = month && year
      ? `${FULL_MONTHS[parseInt(month, 10) - 1] || month} ${year}`
      : (year ? `Year ${year}` : 'All Time');

    ws.mergeCells('A1:J1');
    ws.getCell('A1').value = `DIT CONSULTANCY CLAIMS — INSTITUTION SUMMARY (${periodLabel.toUpperCase()})`;
    ws.getCell('A1').font = { bold: true, size: 13 };
    ws.getCell('A1').alignment = { horizontal: 'center' };

    const headers = ['Lecturer', 'Email', 'Department', 'Bank', 'Account No', 'Sessions', 'Hours', 'Tuition (TZS)', 'Transport (TZS)', 'Gross (TZS)'];
    const headerRow = ws.getRow(3);
    headers.forEach((h, i) => {
      const cell = headerRow.getCell(i + 1);
      cell.value = h;
      cell.font = { bold: true };
    });

    let rIdx = 4;
    let totSessions = 0;
    let totHours = 0;
    let totTuition = 0;
    let totTransport = 0;
    let totGross = 0;

    for (const item of summaryByLecturer) {
      ws.getRow(rIdx).values = [
        item.name, item.email, item.department, item.bank, item.accountNo,
        item.sessions, item.hours, item.tuition, item.transport, item.gross,
      ];
      totSessions += item.sessions;
      totHours += item.hours;
      totTuition += item.tuition;
      totTransport += item.transport;
      totGross += item.gross;
      rIdx++;
    }

    const totalRow = ws.getRow(rIdx);
    totalRow.values = ['TOTAL', '', '', '', '', totSessions, totHours, totTuition, totTransport, totGross];
    totalRow.font = { bold: true };

    ws.columns.forEach((col, i) => {
      col.width = [26, 28, 22, 14, 18, 10, 10, 16, 16, 16][i] || 15;
    });

    const filename = `DIT_SuperAdmin_Claims_${periodLabel.replace(/\s+/g, '_')}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    await wb.xlsx.write(res);
    res.end();
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
