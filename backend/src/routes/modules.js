const router = require('express').Router();
const auth = require('../middleware/auth');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

router.get('/', auth, async (req, res) => {
  const modules = await prisma.module.findMany({
    where: { userId: req.user.id },
    orderBy: { code: 'asc' }
  });
  res.json(modules);
});

router.post('/', auth, async (req, res) => {
  try {
    const { code, name, programme, status } = req.body;
    const m = await prisma.module.create({
      data: { userId: req.user.id, code, name, programme, status: status || 'active' }
    });
    res.json(m);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/:id', auth, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const owned = await prisma.module.findFirst({ where: { id, userId: req.user.id } });
    if (!owned) return res.status(404).json({ error: 'Module not found' });
    const { code, name, programme, status } = req.body;
    const m = await prisma.module.update({ where: { id }, data: { code, name, programme, status } });
    res.json(m);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/:id', auth, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const result = await prisma.module.deleteMany({ where: { id, userId: req.user.id } });
    if (result.count === 0) return res.status(404).json({ error: 'Module not found' });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
