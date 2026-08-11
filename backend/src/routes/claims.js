const router = require('express').Router();
const auth = require('../middleware/auth');
const { PrismaClient } = require('@prisma/client');
const ExcelJS = require('exceljs');
const prisma = new PrismaClient();

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

async function getSessions(userId, month, year) {
  const lecturer = await prisma.lecturer.findUnique({ where: { userId } });
  const pad = String(month).padStart(2, '0');
  const sessions = await prisma.session.findMany({
    where: { userId, date: { startsWith: `${year}-${pad}` } },
    include: { module: true, class: true },
    orderBy: [{ moduleId: 'asc' }, { date: 'asc' }, { startTime: 'asc' }]
  });
  return { lecturer, sessions };
}

router.get('/preview', auth, async (req, res) => {
  try {
    const { month, year } = req.query;
    const { lecturer, sessions } = await getSessions(req.user.id, month, year);
    const grouped = {};
    for (const s of sessions) {
      const key = `${s.module.code}|${s.class.code}`;
      if (!grouped[key]) grouped[key] = { module: s.module, class: s.class, sessions: [] };
      grouped[key].sessions.push(s);
    }
    const modules = Object.values(grouped).map(g => ({
      module: g.module,
      class: g.class,
      sessions: g.sessions,
      totalTuition: g.sessions.reduce((a, s) => a + s.tuition, 0),
      totalTransport: g.sessions.reduce((a, s) => a + s.transport, 0)
    }));
    const totalTuition = modules.reduce((a, m) => a + m.totalTuition, 0);
    const totalTransport = modules.reduce((a, m) => a + m.totalTransport, 0);
    res.json({
      lecturer, month: MONTHS[parseInt(month) - 1], year,
      modules, totalTuition, totalTransport, gross: totalTuition + totalTransport
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/excel', auth, async (req, res) => {
  try {
    const { month, year } = req.query;
    const { lecturer, sessions } = await getSessions(req.user.id, month, year);
    const monthName = MONTHS[parseInt(month) - 1];

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Claim Form');
    ws.pageSetup = { paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1 };

    const bold = { bold: true };
    const center = { horizontal: 'center' };
    const borderAll = {
      top: { style: 'thin' }, bottom: { style: 'thin' },
      left: { style: 'thin' }, right: { style: 'thin' }
    };

    const setRow = (r, values) => {
      const row = ws.getRow(r);
      values.forEach((v, i) => {
        if (v !== null) row.getCell(i + 1).value = v;
      });
      row.commit();
    };

    ws.mergeCells('A1:H1'); ws.getCell('A1').value = 'DAR ES SALAAM INSTITUTE OF TECHNOLOGY';
    ws.mergeCells('A2:H2'); ws.getCell('A2').value = 'COMPUTER STUDIES DEPARTMENT';
    ws.mergeCells('A3:H3'); ws.getCell('A3').value = 'CONSULTANCY CLAIM FORM';
    ['A1','A2','A3'].forEach(c => { ws.getCell(c).font = bold; ws.getCell(c).alignment = center; });

    ws.getRow(5).getCell(1).value = 'LECTURER/TUTOR NAME:'; ws.getRow(5).getCell(2).value = lecturer.name;
    ws.getRow(6).getCell(1).value = 'ADDRESS'; ws.getRow(6).getCell(2).value = lecturer.address;
    ws.getRow(7).getCell(1).value = 'DEPARTMENT:'; ws.getRow(7).getCell(2).value = lecturer.department;
    ws.getRow(9).getCell(1).value = 'BANK DETAILS:'; ws.getRow(9).getCell(2).value = lecturer.bank;
    ws.getRow(10).getCell(2).value = lecturer.branch;
    ws.getRow(11).getCell(2).value = lecturer.accountNo;
    ws.getRow(12).getCell(2).value = lecturer.accountName;
    ws.getRow(14).getCell(1).value = 'ACADEMIC YEAR:'; ws.getRow(14).getCell(2).value = lecturer.academicYear;
    ws.getRow(15).getCell(1).value = 'RATE PER HOUR'; ws.getRow(15).getCell(2).value = `${lecturer.degreeRate.toLocaleString()}/=`; ws.getRow(15).getCell(3).value = 'DEGREE PROGRAM';
    ws.getRow(16).getCell(2).value = `${lecturer.odRate.toLocaleString()}/=`; ws.getRow(16).getCell(3).value = 'OD PROGRAM';
    ws.getRow(17).getCell(1).value = 'TRANSPORT'; ws.getRow(17).getCell(2).value = `${lecturer.transportRate.toLocaleString()}/=`;

    let row = 19;
    ws.getRow(row).getCell(1).value = 'MONTH'; ws.getRow(row).getCell(2).value = `${monthName}, ${year}`;
    row++;
    const hRow = ws.getRow(row);
    ['DATE','CLASS','TIME','','HOURS','TUITION/HR','TUITION','TRANSPORT'].forEach((h, i) => {
      hRow.getCell(i+1).value = h; hRow.getCell(i+1).font = bold; hRow.getCell(i+1).border = borderAll;
    });
    row++;
    const h2Row = ws.getRow(row);
    ['','','FROM','TO','','TSHS','PAYMENT','TSHS'].forEach((h, i) => {
      h2Row.getCell(i+1).value = h; h2Row.getCell(i+1).font = bold; h2Row.getCell(i+1).border = borderAll;
    });
    row++;

    const grouped = {};
    for (const s of sessions) {
      const key = `${s.module.code}|${s.class.code}`;
      if (!grouped[key]) grouped[key] = { module: s.module, class: s.class, sessions: [] };
      grouped[key].sessions.push(s);
    }

    for (const g of Object.values(grouped)) {
      const mRow = ws.getRow(row);
      ws.mergeCells(`A${row}:H${row}`);
      mRow.getCell(1).value = `MODULE: ${g.module.name} (${g.module.code}) — ${g.class.code}`;
      mRow.getCell(1).font = bold;
      row++;
      let modTuition = 0, modTransport = 0;
      for (const s of g.sessions) {
        const r = ws.getRow(row);
        [s.date, s.class.code, s.startTime, s.endTime, s.hours, s.hourlyRate,
         s.tuition, s.transport || ''].forEach((v, i) => {
          r.getCell(i+1).value = v;
          r.getCell(i+1).border = borderAll;
        });
        modTuition += s.tuition; modTransport += s.transport;
        row++;
      }
      const tRow = ws.getRow(row);
      ws.mergeCells(`A${row}:F${row}`);
      tRow.getCell(1).value = 'TOTAL'; tRow.getCell(1).alignment = { horizontal: 'right' };
      tRow.getCell(7).value = modTuition; tRow.getCell(8).value = modTransport;
      [1,7,8].forEach(i => { tRow.getCell(i).font = bold; tRow.getCell(i).border = borderAll; });
      row += 2;
    }

    const totalTuition = sessions.reduce((a, s) => a + s.tuition, 0);
    const totalTransport = sessions.reduce((a, s) => a + s.transport, 0);

    ws.getRow(row).getCell(1).value = 'Total Tuition Payment';
    ws.getRow(row).getCell(8).value = totalTuition; ws.getRow(row).getCell(8).font = bold;
    row++;
    ws.getRow(row).getCell(1).value = 'Total Transport Payment';
    ws.getRow(row).getCell(8).value = totalTransport; ws.getRow(row).getCell(8).font = bold;
    row++;
    ws.getRow(row).getCell(1).value = `Gross pay as per ${monthName}, ${year}`;
    ws.getRow(row).getCell(1).font = bold;
    ws.getRow(row).getCell(8).value = totalTuition + totalTransport;
    ws.getRow(row).getCell(8).font = bold;
    row += 3;

    ws.getRow(row).getCell(1).value = 'Claimant:'; row += 2;
    ws.getRow(row).getCell(1).value = `Name : ${lecturer.name}`;
    ws.getRow(row).getCell(4).value = 'Signature: ____________________';
    ws.getRow(row).getCell(7).value = `Date: ${new Date().toLocaleDateString()}`;
    row += 2;
    ws.getRow(row).getCell(1).value = 'Checked by Head of Section:'; row++;
    ws.getRow(row).getCell(1).value = 'I certify that the above claim is valid and the task mentioned were executed satisfactory';
    row += 2;
    ws.getRow(row).getCell(1).value = 'Name : ……………………………………';
    ws.getRow(row).getCell(4).value = 'Signature: ……………………………………………………';
    ws.getRow(row).getCell(7).value = 'Date: ……………………………………………………';

    ws.columns = [
      { width: 14 }, { width: 16 }, { width: 10 }, { width: 10 },
      { width: 8 }, { width: 12 }, { width: 14 }, { width: 14 }
    ];

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="claim_${monthName}_${year}.xlsx"`);
    await wb.xlsx.write(res);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/summary-preview', auth, async (req, res) => {
  try {
    const { year } = req.query;
    const lecturer = await prisma.lecturer.findUnique({ where: { userId: req.user.id } });
    const rows = [];
    let grandTuition = 0, grandTransport = 0, grandTotal = 0;
    for (let m = 1; m <= 12; m++) {
      const pad = String(m).padStart(2, '0');
      const sessions = await prisma.session.findMany({
        where: { userId: req.user.id, date: { startsWith: `${year}-${pad}` } },
        include: { module: true }
      });
      if (!sessions.length) continue;
      const tuition = sessions.reduce((a, s) => a + s.tuition, 0);
      const transport = sessions.reduce((a, s) => a + s.transport, 0);
      const total = tuition + transport;
      grandTuition += tuition; grandTransport += transport; grandTotal += total;
      const modules = [...new Set(sessions.map(s => s.module.name))].join(', ');
      rows.push({ month: MONTHS[m - 1], modules, tuition, transport, total, sessionCount: sessions.length });
    }
    res.json({
      lecturer, year, rows,
      grandTuition, grandTransport, grandTotal
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/summary-excel', auth, async (req, res) => {
  try {
    const { year } = req.query;
    const lecturer = await prisma.lecturer.findUnique({ where: { userId: req.user.id } });
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Summary');
    const bold = { bold: true };
    const borderAll = { top:{style:'thin'}, bottom:{style:'thin'}, left:{style:'thin'}, right:{style:'thin'} };

    ws.mergeCells('A1:F1'); ws.getCell('A1').value = 'DAR ES SALAAM INSTITUTE OF TECHNOLOGY';
    ws.mergeCells('A2:F2'); ws.getCell('A2').value = 'COMPUTER STUDIES DEPARTMENT';
    ws.mergeCells('A3:F3'); ws.getCell('A3').value = 'SUMMARY OF CONSULTANCY CLAIM FORM';
    ['A1','A2','A3'].forEach(c => { ws.getCell(c).font = bold; ws.getCell(c).alignment = { horizontal: 'center' }; });

    ws.getRow(5).getCell(1).value = 'LECTURER/TUTOR NAME:'; ws.getRow(5).getCell(2).value = lecturer.name;
    ws.getRow(6).getCell(1).value = 'ACADEMIC YEAR:'; ws.getRow(6).getCell(2).value = lecturer.academicYear;

    const hRow = ws.getRow(9);
    ['MODULE','MONTH','TUITION PAYMENT','TRANSPORT','TOTAL'].forEach((h, i) => {
      hRow.getCell(i+1).value = h; hRow.getCell(i+1).font = bold; hRow.getCell(i+1).border = borderAll;
    });

    let row = 10;
    let grandTuition = 0, grandTransport = 0, grandTotal = 0;
    for (let m = 1; m <= 12; m++) {
      const pad = String(m).padStart(2, '0');
      const sessions = await prisma.session.findMany({
        where: { userId: req.user.id, date: { startsWith: `${year}-${pad}` } },
        include: { module: true }
      });
      if (!sessions.length) continue;
      const tuition = sessions.reduce((a, s) => a + s.tuition, 0);
      const transport = sessions.reduce((a, s) => a + s.transport, 0);
      const total = tuition + transport;
      grandTuition += tuition; grandTransport += transport; grandTotal += total;
      const modules = [...new Set(sessions.map(s => s.module.name))].join(', ');
      const r = ws.getRow(row);
      [modules, `${MONTHS[m-1]}, ${year}`, tuition, transport, total].forEach((v, i) => {
        r.getCell(i+1).value = v; r.getCell(i+1).border = borderAll;
      });
      row++;
    }
    const tRow = ws.getRow(row);
    ws.mergeCells(`A${row}:B${row}`);
    tRow.getCell(1).value = 'TOTAL AMOUNT'; tRow.getCell(1).font = bold; tRow.getCell(1).alignment = { horizontal: 'right' };
    [grandTuition, grandTransport, grandTotal].forEach((v, i) => {
      tRow.getCell(i+3).value = v; tRow.getCell(i+3).font = bold; tRow.getCell(i+3).border = borderAll;
    });
    ws.columns = [{ width: 60 }, { width: 18 }, { width: 18 }, { width: 14 }, { width: 14 }];
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="summary_${year}.xlsx"`);
    await wb.xlsx.write(res);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
