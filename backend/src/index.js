require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');
const lecturerRoutes = require('./routes/lecturer');
const moduleRoutes = require('./routes/modules');
const classRoutes = require('./routes/classes');
const sessionRoutes = require('./routes/sessions');
const claimRoutes = require('./routes/claims');
const reportRoutes = require('./routes/reports');
const timetableRoutes = require('./routes/timetable');
const { ensureSuperAdmin } = require('./services/seedSuperAdmin');

const app = express();
const PORT = process.env.PORT || 3747;

app.use(cors({ origin: /^http:\/\/localhost:\d+$/ }));
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/lecturer', lecturerRoutes);
app.use('/api/modules', moduleRoutes);
app.use('/api/classes', classRoutes);
app.use('/api/sessions', sessionRoutes);
app.use('/api/claims', claimRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/timetable', timetableRoutes);

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: err.message || 'Internal Server Error' });
});

ensureSuperAdmin()
  .catch((err) => console.error('Super Admin seed error:', err.message))
  .finally(() => {
    app.listen(PORT, () => {
      console.log(`DIT Claims Server running at http://localhost:${PORT}`);
    });
  });
