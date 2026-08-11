const router = require('express').Router();
const auth = require('../middleware/auth');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

router.get('/dashboard', auth, async (req, res) => {
  try {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');

    const allSessions = await prisma.session.findMany({
      where: { userId: req.user.id },
      include: { module: true, class: true },
      orderBy: { date: 'desc' }
    });

    const thisMon = allSessions.filter(s => s.date.startsWith(`${year}-${month}`));
    const monthly = {};
    for (const s of allSessions) {
      const key = s.date.substring(0, 7);
      if (!monthly[key]) monthly[key] = { tuition: 0, transport: 0, hours: 0 };
      monthly[key].tuition += s.tuition;
      monthly[key].transport += s.transport;
      monthly[key].hours += s.hours;
    }

    res.json({
      thisMonth: {
        sessions: thisMon.length,
        hours: thisMon.reduce((a, s) => a + s.hours, 0),
        tuition: thisMon.reduce((a, s) => a + s.tuition, 0),
        transport: thisMon.reduce((a, s) => a + s.transport, 0),
        gross: thisMon.reduce((a, s) => a + s.gross, 0)
      },
      recentSessions: allSessions.slice(0, 10),
      monthlyChart: Object.entries(monthly).sort(([a],[b]) => a.localeCompare(b)).slice(-12).map(([k, v]) => ({
        month: k, label: MONTHS[parseInt(k.split('-')[1]) - 1] + ' ' + k.split('-')[0], ...v
      }))
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
