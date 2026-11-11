const router = require('express').Router();
const auth = require('../middleware/auth');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

router.get('/', auth, async (req, res) => {
  try {
    const lecturer = await prisma.lecturer.findUnique({ where: { userId: req.user.id } });
    res.json(lecturer);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/', auth, async (req, res) => {
  try {
    const { name, department, address, bank, branch, accountNo, accountName,
            academicYear, degreeRate, odRate, transportRate } = req.body;
    const lecturer = await prisma.lecturer.update({
      where: { userId: req.user.id },
      data: {
        name, department, address, bank, branch, accountNo, accountName,
        academicYear,
        degreeRate: parseInt(degreeRate, 10) || 0,
        odRate: parseInt(odRate, 10) || 0,
        transportRate: parseInt(transportRate, 10) || 0
      }
    });
    res.json(lecturer);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
