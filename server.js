const path = require('path');
const express = require('express');
const compression = require('compression');
const { UPLOAD_DIR } = require('./src/db');
const { seed, ensureAdmin } = require('./src/seed');
const auth = require('./src/auth');

seed();
ensureAdmin();
auth.cleanupSessions();
setInterval(auth.cleanupSessions, 6 * 3600 * 1000).unref();

const app = express();
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.set('trust proxy', process.env.TRUST_PROXY || 'loopback, linklocal, uniquelocal');
app.disable('x-powered-by');

app.use(compression());
app.use((req, res, next) => {
  res.set({
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'X-Frame-Options': 'SAMEORIGIN',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  });
  next();
});

// The service worker must be served from the root so it can control every page.
app.get('/sw.js', (req, res) => {
  res.set('Cache-Control', 'no-cache');
  res.sendFile(path.join(__dirname, 'public', 'sw.js'));
});
app.use(express.static(path.join(__dirname, 'public'), { maxAge: '7d' }));
app.use('/uploads', express.static(UPLOAD_DIR, { maxAge: '30d', immutable: true }));

app.use(auth.loadUsers);
app.use('/api', require('./src/routes/api'));
app.use('/', require('./src/routes/public'));

app.use((req, res) => {
  res.status(404).render('404');
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).send('Something went wrong. Please try again.');
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Karma Omassery website running on http://localhost:${port}`));
