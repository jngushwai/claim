const router = require('express').Router();
const auth = require('../middleware/auth');
const { PrismaClient } = require('@prisma/client');
const multer = require('multer');
const ExcelJS = require('exceljs');
const prisma = new PrismaClient();
const upload = multer({ storage: multer.memoryStorage() });

function calcHours(start, end) {
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  return ((eh * 60 + em) - (sh * 60 + sm)) / 60;
}

router.get('/', auth, async (req, res) => {
  try {
    const { month, year } = req.query;
    let where = { userId: req.user.id };
    if (month && year) {
      const pad = String(month).padStart(2, '0');
      where.date = { startsWith: `${year}-${pad}` };
    }
    const sessions = await prisma.session.findMany({
      where,
      include: { module: true, class: true },
      orderBy: [{ date: 'asc' }, { startTime: 'asc' }]
    });
    res.json(sessions);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/', auth, async (req, res) => {
  try {
    const { date, moduleId, classId, programme, startTime, endTime, hasTransport, remarks } = req.body;
    const lecturer = await prisma.lecturer.findUnique({ where: { userId: req.user.id } });
    const hours = calcHours(startTime, endTime);
    const hourlyRate = programme === 'DEGREE' ? lecturer.degreeRate : lecturer.odRate;
    const tuition = Math.round(hours) * hourlyRate;
    const transport = hasTransport ? lecturer.transportRate : 0;
    const session = await prisma.session.create({
      data: {
        userId: req.user.id,
        date, moduleId: parseInt(moduleId), classId: parseInt(classId),
        programme, startTime, endTime, hours, hourlyRate, tuition, transport,
        gross: tuition + transport, remarks: remarks || ''
      },
      include: { module: true, class: true }
    });
    res.json(session);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/:id', auth, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const owned = await prisma.session.findFirst({ where: { id, userId: req.user.id } });
    if (!owned) return res.status(404).json({ error: 'Session not found' });
    const { date, moduleId, classId, programme, startTime, endTime, hasTransport, remarks } = req.body;
    const lecturer = await prisma.lecturer.findUnique({ where: { userId: req.user.id } });
    const hours = calcHours(startTime, endTime);
    const hourlyRate = programme === 'DEGREE' ? lecturer.degreeRate : lecturer.odRate;
    const tuition = Math.round(hours) * hourlyRate;
    const transport = hasTransport ? lecturer.transportRate : 0;
    const session = await prisma.session.update({
      where: { id },
      data: { date, moduleId: parseInt(moduleId), classId: parseInt(classId), programme, startTime, endTime, hours, hourlyRate, tuition, transport, gross: tuition + transport, remarks: remarks || '' },
      include: { module: true, class: true }
    });
    res.json(session);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/:id', auth, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const result = await prisma.session.deleteMany({ where: { id, userId: req.user.id } });
    if (result.count === 0) return res.status(404).json({ error: 'Session not found' });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/nearest-pattern', auth, async (req, res) => {
  try {
    const { month, year } = req.query;
    // Find all distinct year-month combos that have sessions, pick the closest to the requested month
    const all = await prisma.session.findMany({
      where: { userId: req.user.id },
      select: { date: true },
      orderBy: { date: 'asc' }
    });
    const monthSet = {};
    for (const s of all) {
      const [y, m] = s.date.split('-');
      const key = `${y}-${m}`;
      monthSet[key] = { year: parseInt(y), month: parseInt(m) };
    }
    const months = Object.values(monthSet);
    if (!months.length) return res.json({ patterns: [] });

    // Find closest by absolute distance in months
    const targetTotal = parseInt(year) * 12 + parseInt(month);
    let best = null, bestDist = Infinity;
    for (const m of months) {
      const mTotal = m.year * 12 + m.month;
      if (mTotal === targetTotal) continue; // skip current month itself
      const dist = Math.abs(mTotal - targetTotal);
      if (dist < bestDist) { bestDist = dist; best = m; }
    }
    if (!best) return res.json({ patterns: [] });

    // Get patterns from that best month
    const pad = String(best.month).padStart(2, '0');
    const sessions = await prisma.session.findMany({
      where: { userId: req.user.id, date: { startsWith: `${best.year}-${pad}` } },
      include: { module: true, class: true }
    });
    const patternMap = {};
    for (const s of sessions) {
      const dow = new Date(s.date + 'T00:00:00').getDay();
      const key = `${dow}|${s.startTime}|${s.endTime}|${s.moduleId}|${s.classId}`;
      if (!patternMap[key]) patternMap[key] = { dayOfWeek: dow, startTime: s.startTime, endTime: s.endTime, hours: s.hours, moduleId: s.moduleId, classId: s.classId, programme: s.programme, hasTransport: s.transport > 0, remarks: s.remarks, moduleName: s.module.name, moduleCode: s.module.code, classCode: s.class.code, count: 0 };
      patternMap[key].count++;
    }
    res.json({ patterns: Object.values(patternMap), sourceMonth: best.month, sourceYear: best.year });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/pattern', auth, async (req, res) => {
  try {
    const { month, year } = req.query;
    const pad = String(month).padStart(2, '0');
    const sessions = await prisma.session.findMany({
      where: { userId: req.user.id, date: { startsWith: `${year}-${pad}` } },
      include: { module: true, class: true },
      orderBy: [{ moduleId: 'asc' }, { classId: 'asc' }, { startTime: 'asc' }]
    });
    // Extract unique patterns: dayOfWeek + time + module + class
    const patternMap = {};
    for (const s of sessions) {
      const dow = new Date(s.date + 'T00:00:00').getDay();
      const key = `${dow}|${s.startTime}|${s.endTime}|${s.moduleId}|${s.classId}`;
      if (!patternMap[key]) {
        patternMap[key] = {
          dayOfWeek: dow,
          startTime: s.startTime,
          endTime: s.endTime,
          hours: s.hours,
          moduleId: s.moduleId,
          classId: s.classId,
          programme: s.programme,
          hasTransport: s.transport > 0,
          remarks: s.remarks,
          moduleName: s.module.name,
          moduleCode: s.module.code,
          classCode: s.class.code,
          count: 0
        };
      }
      patternMap[key].count++;
    }
    res.json({ patterns: Object.values(patternMap), sourceMonth: parseInt(month), sourceYear: parseInt(year) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/autofill', auth, async (req, res) => {
  try {
    const { sourceMonth, sourceYear, targetMonth, targetYear } = req.body;
    const lecturer = await prisma.lecturer.findUnique({ where: { userId: req.user.id } });
    if (!lecturer) return res.status(400).json({ error: 'Complete your profile first' });

    // Get patterns from source month
    const pad = String(sourceMonth).padStart(2, '0');
    const sourceSessions = await prisma.session.findMany({
      where: { userId: req.user.id, date: { startsWith: `${sourceYear}-${pad}` } },
      include: { module: true, class: true }
    });

    // Build unique patterns
    const patternMap = {};
    for (const s of sourceSessions) {
      const dow = new Date(s.date + 'T00:00:00').getDay();
      const key = `${dow}|${s.startTime}|${s.endTime}|${s.moduleId}|${s.classId}`;
      if (!patternMap[key]) {
        patternMap[key] = { dayOfWeek: dow, startTime: s.startTime, endTime: s.endTime, hours: s.hours, moduleId: s.moduleId, classId: s.classId, programme: s.programme, transport: s.transport > 0, remarks: s.remarks };
      }
    }

    // Find all matching dates in target month
    const targetPad = String(targetMonth).padStart(2, '0');
    const daysInMonth = new Date(targetYear, targetMonth, 0).getDate();
    let created = 0, skipped = 0;

    for (const pattern of Object.values(patternMap)) {
      const hourlyRate = pattern.programme === 'DEGREE' ? lecturer.degreeRate : lecturer.odRate;
      const tuition = Math.round(pattern.hours) * hourlyRate;
      const transport = pattern.transport ? lecturer.transportRate : 0;
      const gross = tuition + transport;

      for (let d = 1; d <= daysInMonth; d++) {
        const date = new Date(targetYear, targetMonth - 1, d);
        if (date.getDay() !== pattern.dayOfWeek) continue;
        const dateStr = `${targetYear}-${targetPad}-${String(d).padStart(2, '0')}`;
        const existing = await prisma.session.findFirst({ where: { userId: req.user.id, date: dateStr, moduleId: pattern.moduleId, classId: pattern.classId, startTime: pattern.startTime } });
        if (existing) { skipped++; continue; }
        await prisma.session.create({
          data: { userId: req.user.id, date: dateStr, moduleId: pattern.moduleId, classId: pattern.classId, programme: pattern.programme, startTime: pattern.startTime, endTime: pattern.endTime, hours: pattern.hours, hourlyRate, tuition, transport, gross, remarks: pattern.remarks || '' }
        });
        created++;
      }
    }
    res.json({ created, skipped, message: `${created} sessions created for the new month` });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/bulk', auth, async (req, res) => {
  try {
    const { dates, moduleId, classId, programme, hours: hoursIn, startTime, endTime, hasTransport, remarks } = req.body;
    if (!dates || !dates.length) return res.status(400).json({ error: 'No dates selected' });
    if (!moduleId || !classId) return res.status(400).json({ error: 'Module and Class are required' });
    const lecturer = await prisma.lecturer.findUnique({ where: { userId: req.user.id } });
    if (!lecturer) return res.status(400).json({ error: 'Please complete your profile first (hourly rates required)' });
    const parsedHours = hoursIn ? parseFloat(hoursIn) : null;
    const hours = (parsedHours && !isNaN(parsedHours)) ? parsedHours : (startTime && endTime ? calcHours(startTime, endTime) : null);
    if (!hours || isNaN(hours) || hours <= 0) return res.status(400).json({ error: 'Enter hours or start & end time' });
    const hourlyRate = programme === 'DEGREE' ? lecturer.degreeRate : lecturer.odRate;
    const tuition = Math.round(hours) * hourlyRate;
    const transport = hasTransport ? lecturer.transportRate : 0;
    const gross = tuition + transport;
    let created = 0, skipped = 0;
    for (const date of dates) {
      const existing = await prisma.session.findFirst({ where: { userId: req.user.id, date, moduleId: parseInt(moduleId), classId: parseInt(classId), startTime: startTime || '' } });
      if (existing) { skipped++; continue; }
      await prisma.session.create({
        data: { userId: req.user.id, date, moduleId: parseInt(moduleId), classId: parseInt(classId), programme, startTime: startTime || '', endTime: endTime || '', hours, hourlyRate, tuition, transport, gross, remarks: remarks || '' }
      });
      created++;
    }
    res.json({ created, skipped });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/import', auth, upload.single('file'), async (req, res) => {
  try {
    const lecturer = await prisma.lecturer.findUnique({ where: { userId: req.user.id } });
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(req.file.buffer);
    const sheet = workbook.worksheets[0];
    const imported = [];
    const errors = [];

    for (let i = 2; i <= sheet.rowCount; i++) {
      const row = sheet.getRow(i);
      const date = row.getCell(1).value;
      const moduleCode = String(row.getCell(2).value || '').trim();
      const classCode = String(row.getCell(3).value || '').trim();
      const programme = String(row.getCell(4).value || '').trim().toUpperCase();
      const startTime = String(row.getCell(5).value || '').trim();
      const endTime = String(row.getCell(6).value || '').trim();
      const hasTransport = row.getCell(7).value;

      if (!date || !moduleCode || !classCode) continue;

      const mod = await prisma.module.findFirst({ where: { userId: req.user.id, code: moduleCode } });
      const cls = await prisma.class.findFirst({ where: { userId: req.user.id, code: classCode } });

      if (!mod || !cls) {
        errors.push(`Row ${i}: Module '${moduleCode}' or Class '${classCode}' not found`);
        continue;
      }

      const dateStr = date instanceof Date
        ? date.toISOString().split('T')[0]
        : String(date).trim();

      const hours = calcHours(startTime, endTime);
      const hourlyRate = programme === 'DEGREE' ? lecturer.degreeRate : lecturer.odRate;
      const tuition = Math.round(hours) * hourlyRate;
      const transport = hasTransport ? lecturer.transportRate : 0;

      const existing = await prisma.session.findFirst({
        where: { userId: req.user.id, date: dateStr, moduleId: mod.id, classId: cls.id, startTime }
      });
      if (existing) { errors.push(`Row ${i}: Duplicate session skipped`); continue; }

      const s = await prisma.session.create({
        data: { userId: req.user.id, date: dateStr, moduleId: mod.id, classId: cls.id, programme, startTime, endTime, hours, hourlyRate, tuition, transport, gross: tuition + transport }
      });
      imported.push(s);
    }
    res.json({ imported: imported.length, errors });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
