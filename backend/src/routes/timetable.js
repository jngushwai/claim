const router = require('express').Router();
const auth = require('../middleware/auth');
const { PrismaClient } = require('@prisma/client');
const multer = require('multer');
const ExcelJS = require('exceljs');
const prisma = new PrismaClient();
const upload = multer({ storage: multer.memoryStorage() });

const DAYS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const DAY_MAP = { sunday:0,monday:1,tuesday:2,wednesday:3,thursday:4,friday:5,saturday:6 };

function calcHours(start, end) {
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  return ((eh * 60 + em) - (sh * 60 + sm)) / 60;
}

function getDatesInMonth(year, month, dayOfWeek) {
  const dates = [];
  const d = new Date(year, month - 1, 1);
  while (d.getMonth() === month - 1) {
    if (d.getDay() === dayOfWeek) {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      dates.push(`${y}-${m}-${day}`);
    }
    d.setDate(d.getDate() + 1);
  }
  return dates;
}

// Get all timetable entries
router.get('/', auth, async (req, res) => {
  try {
    const entries = await prisma.timetableEntry.findMany({
      where: { userId: req.user.id },
      orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }]
    });
    // Enrich with module/class info
    const modules = await prisma.module.findMany({ where: { userId: req.user.id } });
    const classes = await prisma.class.findMany({ where: { userId: req.user.id } });
    const modMap = Object.fromEntries(modules.map(m => [m.id, m]));
    const clsMap = Object.fromEntries(classes.map(c => [c.id, c]));
    const enriched = entries.map(e => ({
      ...e,
      module: modMap[e.moduleId],
      class: clsMap[e.classId]
    }));
    res.json(enriched);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Add single entry
router.post('/', auth, async (req, res) => {
  try {
    const { dayOfWeek, moduleId, classId, programme, startTime, endTime, hasTransport, remarks } = req.body;
    const entry = await prisma.timetableEntry.create({
      data: { userId: req.user.id, dayOfWeek, moduleId: parseInt(moduleId), classId: parseInt(classId), programme, startTime, endTime, hasTransport: !!hasTransport, remarks: remarks || '' }
    });
    res.json(entry);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Delete entry
router.delete('/:id', auth, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const result = await prisma.timetableEntry.deleteMany({ where: { id, userId: req.user.id } });
    if (result.count === 0) return res.status(404).json({ error: 'Entry not found' });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Clear all entries (current user only)
router.delete('/', auth, async (req, res) => {
  try {
    await prisma.timetableEntry.deleteMany({ where: { userId: req.user.id } });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Import timetable from Excel
router.post('/import', auth, upload.single('file'), async (req, res) => {
  try {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(req.file.buffer);
    const sheet = workbook.worksheets[0];
    const imported = [];
    const errors = [];

    // Clear this user's existing timetable first
    await prisma.timetableEntry.deleteMany({ where: { userId: req.user.id } });

    for (let i = 2; i <= sheet.rowCount; i++) {
      const row = sheet.getRow(i);
      const dayRaw = String(row.getCell(1).value || '').trim();
      const moduleCode = String(row.getCell(2).value || '').trim();
      const classCode = String(row.getCell(3).value || '').trim();
      const programme = String(row.getCell(4).value || '').trim().toUpperCase() || 'DEGREE';
      const startTime = String(row.getCell(5).value || '').trim();
      const endTime = String(row.getCell(6).value || '').trim();
      const transportRaw = String(row.getCell(7).value || '').trim().toLowerCase();
      const remarks = String(row.getCell(8).value || '').trim();

      if (!dayRaw || !moduleCode || !classCode || !startTime || !endTime) continue;

      const dayKey = dayRaw.toLowerCase();
      if (!(dayKey in DAY_MAP)) {
        errors.push(`Row ${i}: Unknown day "${dayRaw}". Use Monday, Tuesday...`);
        continue;
      }
      const dayOfWeek = dayRaw.charAt(0).toUpperCase() + dayRaw.slice(1).toLowerCase();

      const mod = await prisma.module.findFirst({ where: { userId: req.user.id, code: moduleCode } });
      const cls = await prisma.class.findFirst({ where: { userId: req.user.id, code: classCode } });

      if (!mod) { errors.push(`Row ${i}: Module "${moduleCode}" not found`); continue; }
      if (!cls) { errors.push(`Row ${i}: Class "${classCode}" not found`); continue; }

      const hasTransport = ['yes','true','1','y'].includes(transportRaw);

      const entry = await prisma.timetableEntry.create({
        data: { userId: req.user.id, dayOfWeek, moduleId: mod.id, classId: cls.id, programme, startTime, endTime, hasTransport, remarks }
      });
      imported.push(entry);
    }
    res.json({ imported: imported.length, errors });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Download blank timetable template
router.get('/template', auth, async (req, res) => {
  try {
    const modules = await prisma.module.findMany({ where: { userId: req.user.id, status: 'active' } });
    const classes = await prisma.class.findMany({ where: { userId: req.user.id } });

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Timetable');
    ws.columns = [
      { header: 'DAY OF WEEK', key: 'day', width: 14 },
      { header: 'MODULE CODE', key: 'module', width: 16 },
      { header: 'CLASS CODE', key: 'class', width: 18 },
      { header: 'PROGRAMME', key: 'prog', width: 12 },
      { header: 'START TIME', key: 'start', width: 12 },
      { header: 'END TIME', key: 'end', width: 12 },
      { header: 'TRANSPORT (Yes/No)', key: 'transport', width: 20 },
      { header: 'REMARKS', key: 'remarks', width: 20 },
    ];
    const hRow = ws.getRow(1);
    hRow.font = { bold: true };
    hRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F4C81' } };
    hRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };

    // Add example rows
    const examples = [
      ['Monday','COU 07202','BENG24BEBE-2','DEGREE','14:00','17:00','No',''],
      ['Monday','COU 07202','BENG24BEBE-2','DEGREE','18:00','21:00','No',''],
      ['Wednesday','CSEU 07203','BENG23EE-1','DEGREE','09:00','12:00','Yes',''],
    ];
    examples.forEach(e => ws.addRow(e));

    // Info sheet
    const info = wb.addWorksheet('Reference');
    info.getCell('A1').value = 'VALID DAYS'; info.getCell('A1').font = { bold: true };
    DAYS.slice(1).forEach((d, i) => info.getCell(`A${i+2}`).value = d);
    info.getCell('C1').value = 'YOUR MODULES'; info.getCell('C1').font = { bold: true };
    modules.forEach((m, i) => { info.getCell(`C${i+2}`).value = m.code; info.getCell(`D${i+2}`).value = m.name; });
    info.getCell('F1').value = 'YOUR CLASSES'; info.getCell('F1').font = { bold: true };
    classes.forEach((c, i) => info.getCell(`F${i+2}`).value = c.code);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="timetable_template.xlsx"');
    await wb.xlsx.write(res);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Populate sessions for a given month from timetable
router.post('/populate', auth, async (req, res) => {
  try {
    const { month, year, skipExisting } = req.body;
    const lecturer = await prisma.lecturer.findUnique({ where: { userId: req.user.id } });
    const entries = await prisma.timetableEntry.findMany({ where: { userId: req.user.id } });

    if (!entries.length) return res.status(400).json({ error: 'No timetable entries found. Please import your timetable first.' });

    const created = [];
    const skipped = [];

    for (const entry of entries) {
      const dayNum = DAY_MAP[entry.dayOfWeek.toLowerCase()];
      if (dayNum === undefined) continue;

      const dates = getDatesInMonth(parseInt(year), parseInt(month), dayNum);

      for (const date of dates) {
        // Check for existing session
        const existing = await prisma.session.findFirst({
          where: { userId: req.user.id, date, moduleId: entry.moduleId, classId: entry.classId, startTime: entry.startTime }
        });
        if (existing) { skipped.push(date); continue; }

        const hours = calcHours(entry.startTime, entry.endTime);
        const hourlyRate = entry.programme === 'DEGREE' ? lecturer.degreeRate : lecturer.odRate;
        const tuition = Math.round(hours) * hourlyRate;
        const transport = entry.hasTransport ? lecturer.transportRate : 0;

        const session = await prisma.session.create({
          data: {
            userId: req.user.id,
            date, moduleId: entry.moduleId, classId: entry.classId,
            programme: entry.programme, startTime: entry.startTime, endTime: entry.endTime,
            hours, hourlyRate, tuition, transport, gross: tuition + transport,
            remarks: entry.remarks || ''
          }
        });
        created.push(session);
      }
    }

    res.json({
      created: created.length,
      skipped: skipped.length,
      message: `Created ${created.length} sessions${skipped.length ? `, skipped ${skipped.length} duplicates` : ''}`
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
