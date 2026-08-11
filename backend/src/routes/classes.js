const router = require('express').Router();
const auth = require('../middleware/auth');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

router.get('/', auth, async (req, res) => {
  const classes = await prisma.class.findMany({
    where: { userId: req.user.id },
    orderBy: { code: 'asc' }
  });
  res.json(classes);
});

router.post('/', auth, async (req, res) => {
  try {
    const { code, programme, year, semester } = req.body;
    const c = await prisma.class.create({
      data: { userId: req.user.id, code, programme, year, semester: semester || '1' }
    });
    res.json(c);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/:id', auth, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const owned = await prisma.class.findFirst({ where: { id, userId: req.user.id } });
    if (!owned) return res.status(404).json({ error: 'Class not found' });
    const { code, programme, year, semester } = req.body;
    const c = await prisma.class.update({ where: { id }, data: { code, programme, year, semester } });
    res.json(c);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/:id', auth, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const result = await prisma.class.deleteMany({ where: { id, userId: req.user.id } });
    if (result.count === 0) return res.status(404).json({ error: 'Class not found' });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
